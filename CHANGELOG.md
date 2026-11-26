# Changelog

## 1.2.7 — 2026-11-26

- macOS app shell (CH Web): the sidebar frame was only a 40–50 % tint over the window's native vibrancy, which follows the macOS appearance, while its text follows CH Web's theme — so light text could end up on a light sidebar (and vice versa). The frame now uses the opaque palette sidebar colour, and the New Session button background is derived from the palette, so sidebar text and background always come from the same palette.

## 1.2.6 — 2026-11-26

- CH Web: "Follow host" now reads CH Web's own body[data-ds-dark-theme] instead of prefers-color-scheme, which could disagree in the macOS app shell and produce a dark palette over a light host (dark sidebar text on a dark sidebar).
- CH Web: sidebar-local text colours (`--ch-sidebar-text-*`) follow the palette scheme, so "Always dark / Always light" stays readable when the host uses the other scheme.

## 1.2.5 — 2026-11-26

- Phones (≤ 640 px): the usage panel on the CH Web new-session screen becomes compact — 3-column cards, smaller type, Harness and project pickers side by side, and the heatmap, breakdown lines and footer hidden. About 234 px tall instead of ~1000 px, so the greeting and composer stay on screen. The full view remains in the settings page.

## 1.2.4 — 2026-11-26

- Windows: every font stack now falls back to Microsoft YaHei UI / Microsoft YaHei instead of the generic `monospace`, which resolved to SimSun (serif) on Chinese Windows and made the usage numbers look out of place. Numbers use tabular figures.

## 1.2.3 — 2026-11-26

- Publishing follows the codexhost extension registry rules: the Release workflow uploads one ZIP plus the icon and screenshots as same-named assets.
- `tools/pack.mjs` builds the ZIP with Node's zlib (no `child_process`, no external `zip`), so the repository passes the registry's static scan in source mode as well.
- Screenshots use made-up demo data; author set to SgAlice.

## 1.2.2 — 2026-11-26

- Ambient prism light toned down (about 40–50 % dimmer at every level) while keeping the three levels distinct.

## 1.2.1 — 2026-11-26

- Ambient prism light levels are now clearly distinct: the spectrum line grows from 1 px to 3 px with a stronger glow, and the top aura gets taller and brighter (low / medium / high). The settings-page preview matches the real effect.

## 1.2.0 — 2026-11-26

- Usage statistics now come from codexhost itself (`codexhost/usage/statistics/get` via CH Web's `/api/ch/v1/rpc`): every Harness, cost, requests, input / output / cache split, per-Harness tab, Harness filter and today / 7 / 30 / 90 days / all ranges. Quota tab reads the Codex account managed by codexhost.
- CH Web new-session screen: the usage panel sits above the greeting and pushes the composer down; re-mounts when the screen re-renders; hide with × or the new `homeStats` setting.
- Codex Desktop keeps the Codex-log backend as a labelled fallback (its pages cannot reach the Host RPC).

## 1.1.0 — 2026-11-26

- New **usage statistics** (settings page tab + widget panel): sessions, messages, total tokens (main vs sub-agents), active days, cache hit rate, top model, 26-week heatmap, per-model breakdown and rate-limit quota; filter by project and all / 30 / 7 days.
- New single-instance backend reads Codex rollout logs read-only (streaming, zstd archives supported) and caches per-file summaries in the extension data folder.
- New setting `codexHome` for a non-default Codex data folder.

## 1.0.0 — 2026-11-26

- First release: unofficial codexhost port of the Obsidian Prism colour system.
- Four palettes (Obsidian, Warm Basalt, Daylight Crystal, Alabaster), follow-host / always-dark / always-light.
- Accent tones (palette, Cobalt, Iris, Amber, Titanium), corners, code fonts + ligatures.
- Ambient prism light (static hairline + aura), scene presets, frosted menus.
- Settings page with live preview; draggable quick-switch widget; Desktop + Web injection.
