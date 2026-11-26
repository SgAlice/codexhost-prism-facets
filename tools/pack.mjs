#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Builds the theme CSS, checks size limits, then writes
// dist/prism-facets-<version>.zip with manifest.json at the archive root.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
execFileSync(process.execPath, [join(root, "tools/build-css.mjs")], { stdio: "inherit" });

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

const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });
const out = join(dist, `${manifest.id}-${manifest.version}.zip`);
rmSync(out, { force: true });
execFileSync("zip", ["-X", "-q", out, ...FILES], { cwd: root, stdio: "inherit" });

const sha256 = createHash("sha256").update(readFileSync(out)).digest("hex");
console.log(`\n${out}\n  ${(statSync(out).size / KiB).toFixed(1)} KiB  sha256 ${sha256}`);
