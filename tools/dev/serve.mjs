#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Dev server: serves the package root and bridges POST /__invoke to the real
// backend/index.mjs (fake ctx, data dir under the OS temp folder).
//   node --max-old-space-size=128 tools/dev/serve.mjs [port]
// Optional: CH_WEB_URL=http://127.0.0.1:4400 CH_WEB_TOKEN=<access token> also
// forwards POST /api/ch/v1/rpc to a running CH Web (dev testing only).
// CH_WEB_FAKE=1 answers it with made-up statistics instead (for screenshots).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const port = Number(process.argv[2] ?? 8765);
const handlers = new Map();
let settings = {};
const backend = await import(new URL("../../backend/index.mjs", import.meta.url));
await backend.activate({
  extensionId: "prism-facets",
  extensionDir: root,
  dataDir: join(tmpdir(), "prism-facets-dev-data"),
  readSettings: async () => settings,
  writeSettings: async (v) => (settings = v),
  handle: (m, h) => handlers.set(m, h),
});

const TYPES = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json" };
createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/__invoke") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const { method, params } = JSON.parse(body);
      const handler = handlers.get(method);
      if (!handler) throw new Error("Backend method is not registered");
      const value = await handler(params);
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true, value }));
      return;
    }
    if (req.method === "POST" && req.url.endsWith("/api/ch/v1/rpc") && process.env.CH_WEB_FAKE) {
      let body = "";
      for await (const chunk of req) body += chunk;
      const { method, params } = JSON.parse(body);
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ result: fakeRpc(method, params) }));
      return;
    }
    if (req.method === "POST" && req.url.endsWith("/api/ch/v1/rpc")) {
      if (!process.env.CH_WEB_URL || !process.env.CH_WEB_TOKEN) {
        res.writeHead(503, { "content-type": "application/json" }).end(JSON.stringify({ error: { code: -32090, message: "CH_WEB_URL/CH_WEB_TOKEN not set" } }));
        return;
      }
      let body = "";
      for await (const chunk of req) body += chunk;
      const upstream = await fetch(new URL("/api/ch/v1/rpc", process.env.CH_WEB_URL), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.CH_WEB_TOKEN}` },
        body,
      });
      res.writeHead(upstream.status, { "content-type": "application/json" }).end(Buffer.from(await upstream.arrayBuffer()));
      return;
    }
    const rel = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
    if (rel.startsWith("..")) throw Object.assign(new Error("forbidden"), { code: 403 });
    const data = await readFile(join(root, rel));
    res.writeHead(200, { "content-type": TYPES[extname(rel)] ?? "application/octet-stream" }).end(data);
  } catch (error) {
    if (req.url === "/__invoke") res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: false, error: String(error.message) }));
    else res.writeHead(error.code === 403 ? 403 : 404).end();
  }
}).listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}/tools/dev/harness.html?view=page`));

// ---- made-up data for screenshots (deterministic) -------------------------
function fakeRpc(method, params) {
  if (method === "codexhost/account/list") return { version: 2, currentAccountId: "demo", phase: "ready", revision: 1, accounts: [{ accountId: "demo", label: "Demo", planType: "plus" }] };
  if (method === "codexhost/account/usage/inspect")
    return { accountId: "demo", freshness: "live", observedAt: new Date().toISOString(), usage: { planFiveHourUsedPercent: 38, planFiveHourResetsAtUnix: Math.floor(Date.now() / 1000) + 7200, planSevenDayUsedPercent: 61, planSevenDayResetsAtUnix: Math.floor(Date.now() / 1000) + 3 * 86400 } };
  const days = { today: 1, "7d": 7, "30d": 30, "90d": 90, all: 200 }[params.range] ?? 30;
  const harnesses = ["codex", "claude-code", "antigravity", "deepseek-harness"].filter((h) => !params.harness || params.harness === h);
  const models = { codex: ["gpt-5.5", "gpt-5.4-mini"], "claude-code": ["claude-sonnet-4-5"], antigravity: ["gemini-3-pro"], "deepseek-harness": ["deepseek-chat"] };
  const weight = { codex: 1, "claude-code": 0.8, antigravity: 0.35, "deepseek-harness": 0.15 };
  const price = { codex: 0.9, "claude-code": 1.4, antigravity: 0.5, "deepseek-harness": 0.05 };
  const zero = () => ({ requests: 0, inputTokens: 0, cachedInputTokens: 0, cacheWriteInputTokens: 0, cacheKnownInputTokens: 0, cacheHitCachedInputTokens: 0, cacheHitInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0, costUsd: 0, unpricedRequests: 0, unmeteredRequests: 0 });
  const add = (a, b) => { for (const k of Object.keys(a)) a[k] += b[k]; return a; };
  const daily = [], byH = new Map(), byM = new Map(), totals = zero();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86400000);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const wave = (Math.sin(i * 0.9) + Math.sin(i * 0.37) + 2.2) / 4.2;
    const weekend = [0, 6].includes(d.getDay()) ? 0.35 : 1;
    for (const h of harnesses) {
      const req = Math.round(60 * weight[h] * wave * weekend * ((i * 7 + h.length) % 5 === 0 ? 0 : 1));
      if (!req) continue;
      const input = req * 92000, cached = Math.round(input * 0.93);
      const row = { ...zero(), requests: req, inputTokens: input, cachedInputTokens: cached, cacheKnownInputTokens: input, cacheHitCachedInputTokens: cached, cacheHitInputTokens: input, outputTokens: req * 700, reasoningOutputTokens: req * 200, costUsd: req * price[h] * 0.12 };
      daily.push({ date, harness: h, ...row });
      add(byH.get(h) ?? byH.set(h, zero()).get(h), row);
      const ms = models[h];
      ms.forEach((m, j) => { const part = j === 0 ? 0.8 : 0.2; const r = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number.isInteger(v) ? Math.round(v * (ms.length > 1 ? part : 1)) : v * (ms.length > 1 ? part : 1)])); add(byM.get(m) ?? byM.set(m, zero()).get(m), r); });
      add(totals, row);
    }
  }
  return {
    range: params.range, from: daily[0]?.date ?? null, to: daily.at(-1)?.date ?? "",
    filters: { harness: params.harness ?? null, model: null, unknownModel: false, project: params.project ?? null, unknownProject: false, date: null },
    reading: { complete: true, sources: 120, read: 120 }, failures: [],
    options: { harnesses: ["antigravity", "claude-code", "codex", "deepseek-harness"], models: Object.values(models).flat(), projects: ["/home/demo/projects/web-app", "/home/demo/projects/api-server", "/home/demo/notes"] },
    modelLabels: [], totals, daily, hourly: [],
    byHarness: [...byH].map(([harness, v]) => ({ harness, ...v })),
    byModel: [...byM].map(([model, v]) => ({ model, ...v, harnessPricedRequests: 0 })),
    byProject: [], sessions: [], recentSessions: [],
  };
}
