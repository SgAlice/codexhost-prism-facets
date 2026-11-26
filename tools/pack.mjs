#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Builds the generated CSS, checks size limits, then writes
// dist/prism-facets-<version>.zip with manifest.json at the archive root.
// Pure Node (zlib) — no external `zip` binary and no child processes, so the
// repository passes the extension registry's static scan in source mode too.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
await import("./build-css.mjs"); // regenerates the stylesheets on import

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const FILES = [
  "manifest.json",
  "LICENSE",
  "NOTICE",
  "THIRD_PARTY_NOTICES.md",
  "README.md",
  "CHANGELOG.md",
  "shared/palettes.mjs",
  "shared/i18n.mjs",
  "shared/dom.mjs",
  "shared/usage-view.mjs",
  "shared/usage-sources.mjs",
  "shared/usage-css.mjs",
  "shared/usage.css",
  "page/index.mjs",
  "page/base.css",
  "page/style.css",
  "widget/index.mjs",
  "widget/base.css",
  "widget/style.css",
  "desktop/index.js",
  "desktop/style.css",
  "web/index.mjs",
  "web/style.css",
  "web/home.css",
  "backend/index.mjs",
  "tools/build-css.mjs", // source of the generated stylesheets (GPL "corresponding source")
  manifest.icon,
  ...(manifest.screenshots ?? []),
];

const KiB = 1024;
const limits = [
  [manifest.icon, 128 * KiB],
  ...(manifest.screenshots ?? []).map((s) => [s, 512 * KiB]),
  [manifest.desktop.script, 2048 * KiB],
  [manifest.desktop.style, 256 * KiB],
  [manifest.backend.entry, 2048 * KiB],
];
for (const [file, max] of limits) {
  const size = statSync(join(root, file)).size;
  if (size > max) throw new Error(`${file} is ${size} bytes (limit ${max})`);
}
const shots = (manifest.screenshots ?? []).reduce((n, s) => n + statSync(join(root, s)).size, 0);
if (shots > 2048 * KiB) throw new Error(`screenshots total ${shots} bytes (limit 2 MiB)`);

// ---- minimal ZIP writer (DEFLATE / STORE, fixed timestamps for reproducible builds)
const DOS_TIME = 0; // 00:00:00
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01
function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const deflated = deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const crc = crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4); // made by: Unix
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(useDeflate ? 8 : 0, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(((0o100644 & 0xffff) << 16) >>> 0, 38); // regular file, rw-r--r--
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + body.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

const archive = zip(FILES.map((name) => ({ name, data: readFileSync(join(root, name)) })));
const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });
const out = join(dist, `${manifest.id}-${manifest.version}.zip`);
writeFileSync(out, archive);
const sha256 = createHash("sha256").update(archive).digest("hex");
console.log(`\n${out}\n  ${(archive.length / KiB).toFixed(1)} KiB  sha256 ${sha256}`);
