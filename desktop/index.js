/* SPDX-License-Identifier: GPL-3.0-only */
/* global define */
// Prism Facets — Codex Desktop host injection (classic script, not ESM).
// Only toggles marker attributes on <html> via api.dom.mark / unmark; every
// colour lives in desktop/style.css. Keep the marker logic in sync with
// shared/palettes.mjs → markersFor().
define({
  activate(api) {
    var doc = globalThis.document;
    var html = doc && doc.documentElement;
    if (!html) return undefined;
    var win = doc.defaultView || globalThis.window;

    var DARK = ["obsidian", "warm"];
    var LIGHT = ["crystal", "alabaster"];
    var SCHEME = { obsidian: "dark", warm: "dark", crystal: "light", alabaster: "light" };
    var DEFAULTS = {
      enabled: true,
      mode: "auto",
      darkPalette: "obsidian",
      lightPalette: "crystal",
      accent: "follow",
      corners: "balanced",
      codeFont: "default",
      ligatures: false,
      ambient: "medium",
      glassMenus: true,
    };
    var CHOICES = {
      mode: ["auto", "dark", "light"],
      darkPalette: DARK,
      lightPalette: LIGHT,
      accent: ["follow", "cobalt", "iris", "amber", "mono"],
      corners: ["sharp", "balanced", "soft"],
      codeFont: ["default", "jetbrains", "cascadia", "sfmono"],
      ambient: ["off", "low", "medium", "high"],
    };

    function normalize(raw) {
      var input = raw && typeof raw === "object" ? raw : {};
      var out = {};
      Object.keys(DEFAULTS).forEach(function (key) {
        var value = input[key];
        if (typeof DEFAULTS[key] === "boolean") {
          out[key] = typeof value === "boolean" ? value : DEFAULTS[key];
        } else {
          out[key] = CHOICES[key].indexOf(value) !== -1 ? value : DEFAULTS[key];
        }
      });
      return out;
    }

    function hostScheme() {
      var attr = html.getAttribute("data-theme");
      if (attr === "dark" || attr === "light") return attr;
      try {
        if (win && win.matchMedia && win.matchMedia("(prefers-color-scheme: light)").matches) {
          return "light";
        }
      } catch (_error) {
        // matchMedia may be unavailable in restricted contexts.
      }
      return "dark";
    }

    function markersFor(s) {
      if (!s.enabled) return [];
      var scheme = s.mode === "auto" ? hostScheme() : s.mode;
      var palette = scheme === "light" ? s.lightPalette : s.darkPalette;
      var list = ["on", "p-" + palette, "s-" + SCHEME[palette], "r-" + s.corners];
      if (s.accent !== "follow") list.push("a-" + s.accent);
      if (s.codeFont !== "default") list.push("f-" + s.codeFont);
      if (s.ligatures) list.push("lig");
      if (s.ambient !== "off") list.push("amb-" + s.ambient);
      if (s.glassMenus) list.push("glass");
      return list;
    }

    var settings = normalize({});
    var applied = [];

    function apply() {
      if (api.signal.aborted) return;
      var next = markersFor(settings);
      applied.forEach(function (name) {
        if (next.indexOf(name) === -1) api.dom.unmark(html, name);
      });
      next.forEach(function (name) {
        if (applied.indexOf(name) === -1) api.dom.mark(html, name);
      });
      applied = next;
    }

    apply();
    Promise.resolve(api.storage.get())
      .then(function (values) {
        if (api.signal.aborted) return;
        settings = normalize(values);
        apply();
      })
      .catch(function () {
        // Keep defaults until settings become readable.
      });

    var stopStorage = api.storage.onChange(function (values) {
      settings = normalize(values);
      apply();
    });

    // Follow Codex's own light/dark switch when mode is "auto".
    var observer =
      typeof MutationObserver === "function"
        ? new MutationObserver(function () {
            if (settings.mode === "auto") apply();
          })
        : null;
    if (observer) observer.observe(html, { attributes: true, attributeFilter: ["data-theme"] });

    var media = null;
    try {
      media = win && win.matchMedia ? win.matchMedia("(prefers-color-scheme: light)") : null;
    } catch (_error) {
      media = null;
    }
    function onMedia() {
      if (settings.mode === "auto") apply();
    }
    if (media && media.addEventListener) media.addEventListener("change", onMedia);

    function cleanup() {
      if (typeof stopStorage === "function") stopStorage();
      if (observer) observer.disconnect();
      if (media && media.removeEventListener) media.removeEventListener("change", onMedia);
      applied = [];
    }
    api.track(cleanup);
    return cleanup;
  },
});
