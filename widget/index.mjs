// SPDX-License-Identifier: GPL-3.0-only
// Prism Facets — floating crystal quick switcher on the main window.
// Only the orb and the open panel accept pointer input; the rest of the
// overlay stays click-through.

import {
  ACCENTS,
  AMBIENT_LEVELS,
  DARK_PALETTES,
  LIGHT_PALETTES,
  PALETTES,
  effectivePaletteId,
  normalizeSettings,
  resolveColors,
} from "../shared/palettes.mjs";
import { translator } from "../shared/i18n.mjs";
import { applyVars, h, paletteVars, prismGlyph } from "../shared/dom.mjs";
import { mountUsageView } from "../shared/usage-view.mjs";

const POS_KEY = "prism-facets:widget-pos";
const ORB = 36;
const MARGIN = 8;

function loadPos() {
  try {
    const value = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
    if (value && Number.isFinite(value.right) && Number.isFinite(value.bottom)) return value;
  } catch {
    // Ignore unreadable storage.
  }
  return { right: 18, bottom: 96 };
}

function savePos(pos) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
  } catch {
    // Storage may be unavailable (private mode); position is then per-session.
  }
}

function clampPos(pos) {
  const maxRight = Math.max(MARGIN, window.innerWidth - ORB - MARGIN);
  const maxBottom = Math.max(MARGIN, window.innerHeight - ORB - MARGIN);
  return {
    right: Math.min(maxRight, Math.max(MARGIN, pos.right)),
    bottom: Math.min(maxBottom, Math.max(MARGIN, pos.bottom)),
  };
}

export async function mount(root, api) {
  let t = translator(api.locale);
  let scheme = api.colorScheme;
  let state = normalizeSettings(await api.storage.get().catch(() => ({})));
  let open = false;
  let pos = clampPos(loadPos());
  let saveQueue = Promise.resolve();
  let stats = false;
  const usageHost = h("div", { class: "pfw-usage" });
  let usage = null;

  const layer = h("div", { class: "pfw" });
  root.replaceChildren(layer);

  function commit(patch) {
    state = normalizeSettings({ ...state, ...patch });
    render();
    const snapshot = { ...state };
    saveQueue = saveQueue
      .then(() => api.storage.set(snapshot))
      .catch(() =>
        api.storage
          .get()
          .then((values) => {
            state = normalizeSettings(values);
            render();
          })
          .catch(() => undefined),
      );
  }

  // ---- drag (orb) ----------------------------------------------------------
  let drag = null;
  function onPointerDown(event) {
    if (event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: { ...pos }, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    pos = clampPos({ right: drag.start.right - dx, bottom: drag.start.bottom - dy });
    placeOrb();
  }
  function onPointerUp(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const moved = drag.moved;
    drag = null;
    if (moved) {
      savePos(pos);
      render();
    } else {
      open = !open;
      render();
    }
  }

  let orbEl = null;
  let panelEl = null;
  function placeOrb() {
    if (!orbEl) return;
    orbEl.style.right = `${pos.right}px`;
    orbEl.style.bottom = `${pos.bottom}px`;
    if (panelEl) placePanel();
  }
  function placePanel() {
    const orbLeft = window.innerWidth - pos.right - ORB;
    const orbTop = window.innerHeight - pos.bottom - ORB;
    const openLeft = orbLeft > window.innerWidth / 2;
    const openUp = orbTop > window.innerHeight / 2;
    panelEl.style.left = openLeft ? "auto" : `${orbLeft}px`;
    panelEl.style.right = openLeft ? `${pos.right}px` : "auto";
    panelEl.style.top = openUp ? "auto" : `${orbTop + ORB + 8}px`;
    panelEl.style.bottom = openUp ? `${pos.bottom + ORB + 8}px` : "auto";
  }

  // ---- panel ---------------------------------------------------------------
  function swatch(id) {
    const p = PALETTES[id];
    const key = p.scheme === "dark" ? "darkPalette" : "lightPalette";
    const selected = state[key] === id;
    const active = effectivePaletteId(state, scheme) === id;
    return h(
      "button",
      {
        type: "button",
        class: `pfw-sw${selected ? " is-selected" : ""}${active ? " is-active" : ""}`,
        title: t(id),
        "aria-label": t(id),
        "aria-pressed": selected ? "true" : "false",
        style: { "--sw-side": p.sidebar, "--sw-bg": p.bg, "--sw-accent": resolveColors(id, state.accent).accent },
        onClick: () => {
          const patch = { [key]: id };
          if (state.mode !== "auto" && state.mode !== p.scheme) patch.mode = p.scheme;
          commit(patch);
        },
      },
      h("span", { class: "pfw-sw__side" }),
      h("span", { class: "pfw-sw__dot" }),
    );
  }

  function seg(key, options) {
    return h(
      "div",
      { class: "pfw-seg", role: "radiogroup" },
      options.map(([value, label, title]) =>
        h(
          "button",
          {
            type: "button",
            role: "radio",
            class: state[key] === value ? "is-on" : "",
            "aria-checked": state[key] === value ? "true" : "false",
            title: title ?? label,
            onClick: () => commit({ [key]: value }),
          },
          label,
        ),
      ),
    );
  }

  function panel() {
    const pid = effectivePaletteId(state, scheme);
    const pScheme = PALETTES[pid].scheme;
    const statsButton = h(
      "button",
      {
        type: "button",
        class: `pfw-tabbtn${stats ? " is-on" : ""}`,
        title: stats ? t("tabAppearance") : t("tabUsage"),
        "aria-label": stats ? t("tabAppearance") : t("tabUsage"),
        "aria-pressed": stats ? "true" : "false",
        onClick: () => {
          stats = !stats;
          render();
        },
      },
      stats ? "◐" : "▥",
    );
    if (stats) {
      usage ??= mountUsageView(usageHost, api, () => t, { compact: true });
      return h(
        "div",
        { class: "pfw-panel pfw-panel--wide", role: "dialog", "aria-label": t("usageTitle") },
        h("div", { class: "pfw-head" }, prismGlyph(16, "wp"), h("strong", null, t("usageTitle")), h("span", { class: "pfw-head__spacer" }), statsButton),
        usageHost,
      );
    }
    return h(
      "div",
      { class: "pfw-panel", role: "dialog", "aria-label": t("widgetTitle") },
      h(
        "div",
        { class: "pfw-head" },
        prismGlyph(16, "wp"),
        h("strong", null, t("widgetTitle")),
        statsButton,
        h("span", { class: "pfw-head__spacer" }),
        h("span", { class: "pfw-head__label" }, t("widgetTheme")),
        h(
          "button",
          {
            type: "button",
            role: "switch",
            class: "pfw-switch",
            "aria-checked": state.enabled ? "true" : "false",
            "aria-label": t("applyTheme"),
            onClick: () => commit({ enabled: !state.enabled }),
          },
          h("span", { class: "pfw-switch__thumb" }),
        ),
      ),
      seg("mode", [
        ["auto", "A", t("modeAuto")],
        ["dark", "☾", t("modeDark")],
        ["light", "☀", t("modeLight")],
      ]),
      h(
        "div",
        { class: "pfw-swatches" },
        h("div", { class: "pfw-sw-group", title: t("darkGroup") }, DARK_PALETTES.map(swatch)),
        h("span", { class: "pfw-divider" }),
        h("div", { class: "pfw-sw-group", title: t("lightGroup") }, LIGHT_PALETTES.map(swatch)),
      ),
      h("div", { class: "pfw-caption" }, t(pid)),
      h(
        "div",
        { class: "pfw-accents", role: "radiogroup", "aria-label": t("sectionAccent") },
        ["follow", ...Object.keys(ACCENTS)].map((id) =>
          h("button", {
            type: "button",
            role: "radio",
            class: `pfw-acc${state.accent === id ? " is-on" : ""}`,
            title: t(id),
            "aria-label": t(id),
            "aria-checked": state.accent === id ? "true" : "false",
            style: { "--chip": id === "follow" ? PALETTES[pid].accent : ACCENTS[id][pScheme].accent },
            onClick: () => commit({ accent: id }),
          }),
        ),
      ),
      h("div", { class: "pfw-row" }, h("span", null, t("ambient")), seg("ambient", Object.keys(AMBIENT_LEVELS).map((id) => [id, t(id)]))),
    );
  }

  function render() {
    applyVars(layer, paletteVars(effectivePaletteId(state, scheme), state.accent));
    if (!state.showWidget) {
      open = false;
      orbEl = null;
      panelEl = null;
      layer.replaceChildren();
      return;
    }
    orbEl = h(
      "button",
      {
        type: "button",
        class: `pfw-orb${open ? " is-open" : ""}${state.enabled ? "" : " is-off"}`,
        title: t("widgetTitle"),
        "aria-label": t("widgetTitle"),
        "aria-expanded": open ? "true" : "false",
        onPointerdown: onPointerDown,
        onPointermove: onPointerMove,
        onPointerup: onPointerUp,
        onPointercancel: () => {
          drag = null;
        },
        onKeydown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open = !open;
            render();
          }
        },
      },
      prismGlyph(20, "orb"),
    );
    panelEl = open ? panel() : null;
    layer.replaceChildren(...[panelEl, orbEl].filter(Boolean));
    placeOrb();
  }

  render();

  // Close on outside click / Escape. Events from inside our shadow root are
  // retargeted to the shadow host (closed roots hide inner nodes), so accept
  // either the layer itself or the host element in the composed path.
  const shadowHost = root.getRootNode()?.host ?? null;
  const onDocPointer = (event) => {
    if (!open) return;
    const path = event.composedPath();
    if (path.includes(layer) || (shadowHost && path.includes(shadowHost))) return;
    open = false;
    render();
  };
  const onKey = (event) => {
    if (open && event.key === "Escape") {
      open = false;
      render();
    }
  };
  const onResize = () => {
    pos = clampPos(pos);
    placeOrb();
  };
  document.addEventListener("pointerdown", onDocPointer, { capture: true, signal: api.signal });
  document.addEventListener("keydown", onKey, { signal: api.signal });
  window.addEventListener("resize", onResize, { signal: api.signal });

  const stopStorage = api.storage.onChange((values) => {
    state = normalizeSettings(values);
    render();
  });
  const stopLocale = api.onLocaleChange((locale) => {
    t = translator(locale);
    render();
    usage?.rerender();
  });
  const stopScheme = api.onColorSchemeChange((next) => {
    scheme = next;
    render();
  });

  return () => {
    usage?.dispose();
    stopStorage();
    stopLocale();
    stopScheme();
    root.replaceChildren();
  };
}
