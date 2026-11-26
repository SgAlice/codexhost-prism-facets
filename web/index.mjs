// SPDX-License-Identifier: GPL-3.0-only
// Prism Facets — CH Web host injection.
//  1. Toggles theme marker attributes on <html> (colours live in web/style.css).
//  2. Puts the usage panel above the greeting of the new-session screen.

import {
  ALL_MARKERS,
  effectivePaletteId,
  markersFor,
  normalizeSettings,
  patchSettings,
} from "../shared/palettes.mjs";
import { translator } from "../shared/i18n.mjs";
import { applyVars, paletteVars } from "../shared/dom.mjs";
import { mountUsageView } from "../shared/usage-view.mjs";
import usageCss from "../shared/usage-css.mjs";

/**
 * CH Web's own light/dark state. The boot script and theme presenter toggle
 * body[data-ds-dark-theme]; trust it rather than prefers-color-scheme, which
 * can disagree with the host (e.g. the macOS app shell with "system" theme).
 */
function hostScheme(doc, win) {
  if (doc.body) return doc.body.hasAttribute("data-ds-dark-theme") ? "dark" : "light";
  try {
    return win?.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * The new-session hero (ui-conversation HeroShell) renders
 *   .root > .stack > [.headline > .fishHitbox + .titleGroup, .body]
 * with hashed CSS-module class names such as "_93RU4a_fishHitbox", so match
 * on the stable "_<local>" suffix. Returns the .stack element or null.
 */
function findHeroStack(doc) {
  const anchor =
    doc.querySelector('[class*="_fishHitbox"]') ?? doc.querySelector('[class*="_titleGroup"]');
  const headline = anchor?.closest('[class*="_headline"]');
  return headline?.parentElement ?? null;
}

function adoptCss(shadow, doc) {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(usageCss);
    shadow.adoptedStyleSheets = [sheet];
  } catch {
    const style = doc.createElement("style");
    style.textContent = usageCss;
    shadow.append(style);
  }
}

export async function activate(api) {
  const doc = globalThis.document;
  const html = doc?.documentElement;
  if (!html) return undefined;
  const win = doc.defaultView ?? globalThis.window;

  let settings = normalizeSettings({});
  let applied = [];
  let home = null; // { mount, root, view, stack }

  const locale = () => html.lang || win?.navigator?.language || "en";
  let t = translator(locale());

  // ---- theme markers -------------------------------------------------------
  const applyMarkers = () => {
    if (api.signal.aborted) return;
    const next = markersFor(settings, hostScheme(doc, win));
    for (const name of applied) if (!next.includes(name)) api.dom.unmark(html, name);
    for (const name of next) if (!applied.includes(name)) api.dom.mark(html, name);
    applied = next;
  };

  // ---- new-session usage panel ---------------------------------------------
  const viewApi = {
    hostTarget: "web",
    backend: api.backend,
    get locale() {
      return locale();
    },
  };

  const dropHome = () => {
    if (!home) return;
    home.view.dispose();
    home.mount.dispose();
    home = null;
  };

  const syncHome = () => {
    if (api.signal.aborted) return;
    const stack = settings.homeStats ? findHeroStack(doc) : null;
    if (home && (home.stack !== stack || !home.mount.container.isConnected)) dropHome();
    if (stack && !home) {
      const mount = api.dom.mount(stack, "prepend");
      if (!mount) return;
      const shadow = mount.container.attachShadow({ mode: "open" });
      adoptCss(shadow, doc);
      const root = doc.createElement("div");
      root.className = "pf-home";
      shadow.append(root);
      const view = mountUsageView(root, viewApi, () => t, {
        home: true,
        onClose: () => {
          patchSettings(api, { homeStats: false }).catch(() => undefined);
        },
      });
      home = { mount, root, view, stack };
    }
    if (home) applyVars(home.root, paletteVars(effectivePaletteId(settings, hostScheme(doc, win)), settings.accent));
  };

  const applyAll = () => {
    applyMarkers();
    syncHome();
  };

  try {
    settings = normalizeSettings(await api.storage.get());
  } catch {
    // Keep defaults until settings become readable.
  }
  if (api.signal.aborted) return undefined;
  applyAll();

  const stopStorage = api.storage.onChange((values) => {
    settings = normalizeSettings(values);
    applyAll();
  });

  // The hero mounts/unmounts as sessions change; re-check once per frame.
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = win.requestAnimationFrame(() => {
      frame = 0;
      syncHome();
    });
  };
  const domObserver =
    typeof MutationObserver === "function" && doc.body ? new MutationObserver(schedule) : null;
  domObserver?.observe(doc.body, { childList: true, subtree: true });

  // Host light/dark switch and UI language.
  const attrObserver =
    typeof MutationObserver === "function"
      ? new MutationObserver(() => {
          const next = translator(locale());
          if (next("tabUsage") !== t("tabUsage")) {
            t = next;
            home?.view.rerender();
          }
          if (settings.mode === "auto") applyAll();
          else syncHome();
        })
      : null;
  if (doc.body) attrObserver?.observe(doc.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
  attrObserver?.observe(html, { attributes: true, attributeFilter: ["lang"] });

  let media = null;
  try {
    media = win?.matchMedia?.("(prefers-color-scheme: dark)") ?? null;
  } catch {
    media = null;
  }
  const onMedia = () => {
    if (settings.mode === "auto") applyAll();
  };
  media?.addEventListener?.("change", onMedia);

  const cleanup = () => {
    stopStorage();
    domObserver?.disconnect();
    attrObserver?.disconnect();
    if (frame) win.cancelAnimationFrame(frame);
    media?.removeEventListener?.("change", onMedia);
    dropHome();
    if (!api.signal.aborted) {
      for (const name of ALL_MARKERS) {
        try {
          api.dom.unmark(html, name);
        } catch {
          // Host already reclaimed the marker.
        }
      }
    }
    applied = [];
  };
  api.track(cleanup);
  return cleanup;
}
