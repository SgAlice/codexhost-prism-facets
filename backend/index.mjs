// SPDX-License-Identifier: GPL-3.0-only
// Prism Facets — usage statistics backend (single shared-Host Node process).
//
// Reads Codex rollout logs (~/.codex/sessions/**/rollout-*.jsonl[.zst] and
// ~/.codex/archived_sessions) READ-ONLY, summarises each file once and caches
// the summary in ctx.dataDir keyed by (size, mtime). The Host runs backends
// with a 128 MB heap and a 10 s invoke timeout, so files are streamed line by
// line and the scan runs in the background; callers poll `usage.summary`.

import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import * as zlib from "node:zlib";

const CACHE_VERSION = 3;
const CACHE_FILE = "usage-cache.json";
const RESCAN_AFTER_MS = 30_000;
const MAX_RL_PER_FILE = 40;
const HEATMAP_WEEKS = 26;
const DAY_MS = 86_400_000;

// ---------------------------------------------------------------- helpers --

const pad = (n) => String(n).padStart(2, "0");
/** Local calendar day for an epoch-ms timestamp. */
function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function listRollouts(codexHome) {
  const out = [];
  async function walk(dir, depth) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && depth < 4) await walk(full, depth + 1);
      else if (entry.isFile() && /^rollout-.*\.jsonl(\.zst)?$/u.test(entry.name)) out.push(full);
    }
  }
  await walk(path.join(codexHome, "sessions"), 0);
  await walk(path.join(codexHome, "archived_sessions"), 0);
  return out;
}

const PREFIX = /^\{"timestamp":"([^"]+)",(?:"ordinal":\d+,)?"type":"([a-z_]+)","payload":\{"type":"([a-z_]+)"/u;
const META = /^\{"timestamp":"([^"]+)",(?:"ordinal":\d+,)?"type":"(session_meta|turn_context)"/u;

function usageOf(u) {
  return u && typeof u === "object"
    ? {
        total: Number(u.total_tokens) || 0,
        input: Number(u.input_tokens) || 0,
        cached: Number(u.cached_input_tokens) || 0,
        output: Number(u.output_tokens) || 0,
      }
    : null;
}

function windowOf(w) {
  if (!w || typeof w !== "object") return null;
  const used = Number(w.used_percent);
  if (!Number.isFinite(used)) return null;
  let reset = null;
  if (Number.isFinite(Number(w.resets_at)) && w.resets_at !== null) reset = Number(w.resets_at) * 1000;
  return [used, Number(w.window_minutes) || null, reset];
}

/**
 * Summarise one rollout file by streaming it.
 *  u:  { model: { day: [total, input, cached, output] } }
 *  m:  { day: messages }
 *  rl: [[tMs, limitId, planType, primary|null, secondary|null], ...]
 */
async function summarize(file, zstdOk) {
  const s = { id: null, cwd: "", sub: 0, start: 0, model: "", u: {}, m: {}, rl: [] };
  const isZst = file.endsWith(".zst");
  if (isZst && !zstdOk) return { ...s, skipped: "zstd" };
  const raw = createReadStream(file);
  const stream = isZst ? raw.pipe(zlib.createZstdDecompress()) : raw;
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let prev = null;
  let model = "unknown";
  let lastRl = "";
  try {
    for await (const line of rl) {
      if (line.length < 40) continue;
      const head = line.slice(0, 200);
      const meta = META.exec(head);
      if (meta) {
        if (meta[2] === "session_meta") {
          // session_meta can embed long base instructions; parse it once.
          try {
            const p = JSON.parse(line).payload ?? {};
            s.id = p.id ?? p.session_id ?? s.id;
            s.cwd = typeof p.cwd === "string" ? p.cwd : s.cwd;
            s.sub = p.source && typeof p.source === "object" && p.source.subagent ? 1 : 0;
            s.start = Date.parse(p.timestamp ?? meta[1]) || Date.parse(meta[1]) || 0;
          } catch {
            s.start ||= Date.parse(meta[1]) || 0;
          }
        } else if (line.length < 200_000) {
          try {
            const p = JSON.parse(line).payload ?? {};
            if (typeof p.model === "string" && p.model) model = s.model = p.model;
            if (!s.cwd && typeof p.cwd === "string") s.cwd = p.cwd;
          } catch {
            // Ignore malformed context lines.
          }
        }
        continue;
      }
      const m = PREFIX.exec(head);
      if (!m) continue;
      const [, ts, kind, ptype] = m;
      if (kind === "event_msg" && ptype === "token_count") {
        let payload;
        try {
          payload = JSON.parse(line).payload;
        } catch {
          continue;
        }
        const t = Date.parse(ts);
        const total = usageOf(payload?.info?.total_token_usage);
        if (total) {
          // Cumulative counters: attribute only the increase since the last event.
          let delta = total;
          if (prev && total.total >= prev.total) {
            delta = {
              total: total.total - prev.total,
              input: Math.max(0, total.input - prev.input),
              cached: Math.max(0, total.cached - prev.cached),
              output: Math.max(0, total.output - prev.output),
            };
          }
          prev = total;
          if (delta.total > 0 && Number.isFinite(t)) {
            const day = dayKey(t);
            const byDay = (s.u[model] ??= {});
            const cell = (byDay[day] ??= [0, 0, 0, 0]);
            cell[0] += delta.total;
            cell[1] += delta.input;
            cell[2] += delta.cached;
            cell[3] += delta.output;
          }
        }
        const r = payload?.rate_limits;
        if (r && (r.primary || r.secondary) && Number.isFinite(t)) {
          const snap = [t, r.limit_id ?? "codex", r.plan_type ?? null, windowOf(r.primary), windowOf(r.secondary)];
          const sig = JSON.stringify(snap.slice(1));
          if (sig !== lastRl) {
            lastRl = sig;
            s.rl.push(snap);
            if (s.rl.length > MAX_RL_PER_FILE) s.rl.shift();
          }
        }
      } else if (kind === "response_item" && ptype === "message") {
        const role = /"role":"(user|assistant)"/u.exec(line.slice(0, 400))?.[1];
        if (!role) continue;
        if (role === "user") {
          // Skip context injected by Codex (AGENTS.md, environment, etc.).
          const i = line.indexOf('"text":"');
          const text = i === -1 ? "" : line.slice(i + 8, i + 20);
          if (text.startsWith("<") || text.startsWith("# AGENTS.md")) continue;
        }
        const t = Date.parse(ts);
        if (Number.isFinite(t)) {
          const day = dayKey(t);
          s.m[day] = (s.m[day] ?? 0) + 1;
        }
      }
    }
  } finally {
    rl.close();
    raw.destroy();
  }
  if (!s.start) {
    const days = Object.keys(s.m).concat(...Object.values(s.u).map((d) => Object.keys(d))).sort();
    if (days[0]) s.start = Date.parse(`${days[0]}T00:00:00`);
  }
  return s;
}

// -------------------------------------------------------------- aggregate --

const RANGE_DAYS = { today: 1, "7d": 7, "30d": 30, "90d": 90, 7: 7, 30: 30 };
function rangeStart(range) {
  const days = RANGE_DAYS[range];
  if (!days) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dayKey(today.getTime() - (days - 1) * DAY_MS);
}

function projectLabel(cwd, duplicate) {
  if (!cwd) return "—";
  const parts = cwd.split(/[\\/]+/u).filter(Boolean);
  const name = parts.at(-1) ?? cwd;
  return duplicate && parts.length > 1 ? `${parts.at(-2)}/${name}` : name;
}

function aggregate(summaries, { range = "all", project = "all" } = {}) {
  const from = rangeStart(range);
  const inRange = (day) => !from || day >= from;
  const today = dayKey(Date.now());

  const projects = new Map();
  for (const s of summaries) {
    if (s.sub) continue;
    const p = projects.get(s.cwd) ?? { cwd: s.cwd, label: "", sessions: 0, tokens: 0 };
    p.sessions += 1;
    for (const byDay of Object.values(s.u)) for (const c of Object.values(byDay)) p.tokens += c[0];
    projects.set(s.cwd, p);
  }
  const names = new Map();
  for (const p of projects.values()) {
    const base = projectLabel(p.cwd, false);
    names.set(base, (names.get(base) ?? 0) + 1);
  }
  for (const p of projects.values()) p.label = projectLabel(p.cwd, names.get(projectLabel(p.cwd, false)) > 1);
  // Sub-agents run in their parent's cwd, so filtering by cwd keeps them.
  const selected = project === "all" ? summaries : summaries.filter((s) => s.cwd === project);

  let sessions = 0;
  let subSessions = 0;
  let messages = 0;
  let mainTokens = 0;
  let subTokens = 0;
  let input = 0;
  let cached = 0;
  const active = new Set();
  const models = new Map();
  const heat = new Map();
  const heatFrom = dayKey(Date.now() - (HEATMAP_WEEKS * 7 + 6) * DAY_MS);

  for (const s of selected) {
    let touched = false;
    for (const [day, n] of Object.entries(s.m)) {
      if (!inRange(day)) continue;
      messages += n;
      touched = true;
      active.add(day);
    }
    for (const [model, byDay] of Object.entries(s.u)) {
      for (const [day, c] of Object.entries(byDay)) {
        if (day >= heatFrom) heat.set(day, (heat.get(day) ?? 0) + c[0]);
        if (!inRange(day)) continue;
        touched = true;
        active.add(day);
        if (s.sub) subTokens += c[0];
        else mainTokens += c[0];
        input += c[1];
        cached += c[2];
        const row = models.get(model) ?? { model, tokens: 0, input: 0, cached: 0, output: 0, sessions: new Set() };
        row.tokens += c[0];
        row.input += c[1];
        row.cached += c[2];
        row.output += c[3];
        row.sessions.add(s.id ?? s);
        models.set(model, row);
      }
    }
    if (touched) {
      if (s.sub) subSessions += 1;
      else sessions += 1;
    }
  }

  const tokens = mainTokens + subTokens;
  const modelRows = [...models.values()]
    .sort((a, b) => b.tokens - a.tokens)
    .map((r) => ({
      model: r.model,
      tokens: r.tokens,
      input: r.input,
      cached: r.cached,
      output: r.output,
      sessions: r.sessions.size,
      share: tokens ? r.tokens / tokens : 0,
      cacheRate: r.input ? r.cached / r.input : null,
    }));

  const heatDays = [];
  for (let t = Date.parse(`${heatFrom}T12:00:00`); dayKey(t) <= today; t += DAY_MS) {
    const day = dayKey(t);
    heatDays.push([day, heat.get(day) ?? 0]);
  }

  return {
    range,
    project,
    projects: [...projects.values()].sort((a, b) => b.tokens - a.tokens).slice(0, 40),
    overview: {
      sessions,
      subSessions,
      messages,
      tokens,
      mainTokens,
      subTokens,
      activeDays: active.size,
      cacheRate: input ? cached / input : null,
      topModel: modelRows[0]?.model ?? null,
    },
    models: modelRows.slice(0, 20),
    heatmap: heatDays,
    quota: quota(summaries),
  };
}

function quota(summaries) {
  const byLimit = new Map();
  for (const s of summaries) for (const snap of s.rl) {
    const list = byLimit.get(snap[1]) ?? [];
    list.push(snap);
    byLimit.set(snap[1], list);
  }
  const now = Date.now();
  const limits = [];
  for (const [id, snaps] of byLimit) {
    snaps.sort((a, b) => a[0] - b[0]);
    const last = snaps.at(-1);
    const describe = (index) => {
      const w = last[index];
      if (!w) return null;
      const [used, windowMinutes, resetsAt] = w;
      const windowMs = (windowMinutes ?? 300) * 60_000;
      // Linear projection from snapshots in the current window.
      let exhaustAt = null;
      const recent = snaps.filter((x) => x[index] && x[0] >= last[0] - windowMs && x[index][0] <= used);
      const first = recent[0];
      if (first && last[0] - first[0] >= 10 * 60_000 && used > first[index][0] && used < 100) {
        const rate = (used - first[index][0]) / (last[0] - first[0]);
        exhaustAt = last[0] + (100 - used) / rate;
        if (resetsAt && exhaustAt > resetsAt) exhaustAt = null;
      }
      const stale = resetsAt ? now > resetsAt : now - last[0] > windowMs;
      return { used, windowMinutes, resetsAt, exhaustAt, stale };
    };
    limits.push({ id, plan: last[2], updatedAt: last[0], primary: describe(3), secondary: describe(4) });
  }
  return limits.sort((a, b) => b.updatedAt - a.updatedAt);
}

// --------------------------------------------------------------- activate --

export async function activate(ctx) {
  const zstdOk = typeof zlib.createZstdDecompress === "function";
  const cachePath = path.join(ctx.dataDir, CACHE_FILE);
  let disposed = false;
  let cache = { v: CACHE_VERSION, home: "", files: {} };
  let status = { state: "idle", done: 0, total: 0, scannedAt: 0, error: null, zstd: zstdOk, home: "" };
  let scanning = null;

  try {
    const loaded = JSON.parse(await readFile(cachePath, "utf8"));
    if (loaded?.v === CACHE_VERSION && loaded.files) cache = loaded;
  } catch {
    // First run or unreadable cache: start fresh.
  }

  async function codexHome() {
    const settings = await ctx.readSettings().catch(() => ({}));
    const custom = typeof settings.codexHome === "string" ? settings.codexHome.trim() : "";
    if (custom) return path.resolve(custom.replace(/^~(?=$|\/)/u, os.homedir()));
    return path.join(os.homedir(), ".codex");
  }

  async function saveCache() {
    await mkdir(ctx.dataDir, { recursive: true });
    const tmp = `${cachePath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(cache));
    await rename(tmp, cachePath);
  }

  async function runScan() {
    const home = await codexHome();
    if (cache.home !== home) cache = { v: CACHE_VERSION, home, files: {} };
    const files = await listRollouts(home);
    const shown = home.startsWith(os.homedir()) ? `~${home.slice(os.homedir().length)}` : home;
    status = { ...status, state: "scanning", done: 0, total: files.length, error: null, home: shown };
    const seen = new Set();
    let changed = false;
    for (const file of files) {
      if (disposed) return;
      seen.add(file);
      try {
        const st = await stat(file);
        const hit = cache.files[file];
        if (!hit || hit.size !== st.size || hit.mtime !== st.mtimeMs) {
          cache.files[file] = { size: st.size, mtime: st.mtimeMs, s: await summarize(file, zstdOk) };
          changed = true;
        }
      } catch {
        // File vanished or is unreadable mid-scan; skip it this round.
      }
      status.done += 1;
    }
    for (const file of Object.keys(cache.files)) {
      if (!seen.has(file)) {
        delete cache.files[file];
        changed = true;
      }
    }
    if (changed) await saveCache().catch(() => undefined);
    status = { ...status, state: "ready", scannedAt: Date.now() };
  }

  function ensureScan(force = false) {
    if (scanning) return scanning;
    if (!force && status.state === "ready" && Date.now() - status.scannedAt < RESCAN_AFTER_MS) return null;
    scanning = runScan()
      .catch((error) => {
        status = { ...status, state: "error", error: String(error?.message ?? error) };
      })
      .finally(() => {
        scanning = null;
      });
    return scanning;
  }

  const summaries = () => Object.values(cache.files).map((f) => f.s);
  const hasData = () => Object.keys(cache.files).length > 0;

  ctx.handle("usage.summary", async (params) => {
    const p = params && typeof params === "object" ? params : {};
    ensureScan(Boolean(p.refresh));
    // Until the first file is summarised there is nothing to show; the page
    // polls and renders partial results (with progress) while scanning.
    if (!hasData()) {
      return { ready: false, status };
    }
    return { ready: true, status, ...aggregate(summaries(), p) };
  });

  ctx.handle("usage.status", async () => status);

  ensureScan(true);
  return () => {
    disposed = true;
  };
}
