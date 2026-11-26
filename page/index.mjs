// SPDX-License-Identifier: GPL-3.0-only
// Prism Facets — cross-host settings page (Desktop settings / Web plugin tab).

import {
  ACCENTS,
  AMBIENT_LEVELS,
  CORNERS,
  CODE_FONTS,
  DARK_PALETTES,
  DEFAULTS,
  LIGHT_PALETTES,
  PALETTES,
  SCENES,
  effectivePaletteId,
  normalizeSettings,
  resolveColors,
} from "../shared/palettes.mjs";
import { translator } from "../shared/i18n.mjs";
import { applyVars, h, paletteVars, prismGlyph } from "../shared/dom.mjs";
import { mountUsageView } from "../shared/usage-view.mjs";

const SOURCE_URL = "https://github.com/RMvdesi/obsidian-prism";
// Mirrors tools/build-css.mjs AMBIENT_STYLE (aura heights scaled to the preview).
const PREVIEW_AMBIENT = {
  off: {},
  low: { "--pv-line": "1px", "--pv-line-o": "0.4", "--pv-glow": "4px", "--pv-aura-h": "65px", "--pv-aura-o": "0.05" },
  medium: { "--pv-line": "1.5px", "--pv-line-o": "0.6", "--pv-glow": "8px", "--pv-aura-h": "105px", "--pv-aura-o": "0.09" },
  high: { "--pv-line": "2px", "--pv-line-o": "0.8", "--pv-glow": "12px", "--pv-aura-h": "150px", "--pv-aura-o": "0.15" },
};

export async function mount(root, api) {
  let t = translator(api.locale);
  let scheme = api.colorScheme;
  let state = normalizeSettings(await api.storage.get().catch(() => ({})));
  let saveQueue = Promise.resolve();
  let toastTimer = 0;
  let status = { kind: "idle", text: "" };
  let view = "appearance";
  const usageHost = h("div", { class: "pf-usage" });
  let usage = null;

  const shell = h("div", { class: "pf-page" });
  root.replaceChildren(shell);

  // ---- persistence -------------------------------------------------------
  function commit(patch) {
    state = normalizeSettings({ ...state, ...patch });
    render();
    const snapshot = { ...state };
    saveQueue = saveQueue
      .then(() => api.storage.set(snapshot))
      .then(() => flash("ok", t("saved")))
      .catch((error) => {
        flash("error", t("saveFailed") + (error?.message ?? String(error)));
        return api.storage
          .get()
          .then((values) => {
            state = normalizeSettings(values);
            render();
          })
          .catch(() => undefined);
      });
  }

  function flash(kind, text) {
    status = { kind, text };
    renderStatus();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      status = { kind: "idle", text: "" };
      renderStatus();
    }, kind === "error" ? 6000 : 1400);
  }

  // ---- small controls ----------------------------------------------------
  const segmented = (key, options, label) =>
    h(
      "div",
      { class: "pf-seg", role: "radiogroup", "aria-label": label },
      options.map(([value, text]) =>
        h(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": state[key] === value ? "true" : "false",
            class: state[key] === value ? "is-on" : "",
            "data-focus": `${key}:${value}`,
            onClick: () => commit({ [key]: value }),
          },
          text,
        ),
      ),
    );

  const toggle = (key, label, hint) =>
    h(
      "label",
      { class: "pf-row pf-row--toggle" },
      h("span", { class: "pf-row__text" }, h("span", { class: "pf-row__label" }, label), hint && h("span", { class: "pf-row__hint" }, hint)),
      h(
        "button",
        {
          type: "button",
          role: "switch",
          class: "pf-switch",
          "aria-checked": state[key] ? "true" : "false",
          "aria-label": label,
          "data-focus": `switch:${key}`,
          onClick: () => commit({ [key]: !state[key] }),
        },
        h("span", { class: "pf-switch__thumb" }),
      ),
    );

  const row = (label, control) =>
    h("div", { class: "pf-row" }, h("span", { class: "pf-row__label" }, label), control);

  const section = (title, ...children) =>
    h("section", { class: "pf-section" }, h("h2", { class: "pf-section__title" }, title), ...children);

  // ---- palette cards -----------------------------------------------------
  function paletteCard(id) {
    const p = PALETTES[id];
    const key = p.scheme === "dark" ? "darkPalette" : "lightPalette";
    const selected = state[key] === id;
    const active = state.enabled && effectivePaletteId(state, scheme) === id;
    const accent = resolveColors(id, state.accent).accent;
    return h(
      "button",
      {
        type: "button",
        class: `pf-card${selected ? " is-selected" : ""}`,
        "aria-pressed": selected ? "true" : "false",
        "data-focus": `palette:${id}`,
        onClick: () => {
          const patch = { [key]: id };
          if (state.mode !== "auto" && state.mode !== p.scheme) patch.mode = p.scheme;
          commit(patch);
        },
      },
      h(
        "span",
        { class: "pf-card__swatch", style: { "--sw-side": p.sidebar, "--sw-bg": p.bg, "--sw-card": p.card, "--sw-fg": p.fg, "--sw-accent": accent, "--sw-border": p.cardBorder } },
        h("span", { class: "pf-card__side" }),
        h("span", { class: "pf-card__main" }, h("span", { class: "pf-card__line" }), h("span", { class: "pf-card__line pf-card__line--short" }), h("span", { class: "pf-card__dot" })),
      ),
      h("span", { class: "pf-card__name" }, t(id), active && h("span", { class: "pf-badge" }, t("active"))),
      h("span", { class: "pf-card__hint" }, t(`${id}Hint`)),
    );
  }

  // ---- accent chips ------------------------------------------------------
  function accentChips() {
    const pid = effectivePaletteId(state, scheme);
    const pScheme = PALETTES[pid].scheme;
    const ids = ["follow", ...Object.keys(ACCENTS)];
    return h(
      "div",
      { class: "pf-chips", role: "radiogroup", "aria-label": t("sectionAccent") },
      ids.map((id) => {
        const color = id === "follow" ? PALETTES[pid].accent : ACCENTS[id][pScheme].accent;
        const on = state.accent === id;
        return h(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": on ? "true" : "false",
            class: `pf-chip${on ? " is-on" : ""}`,
            "data-focus": `accent:${id}`,
            onClick: () => commit({ accent: id }),
          },
          h("span", { class: "pf-chip__dot", style: { "--chip": color } }),
          t(id),
        );
      }),
    );
  }

  // ---- live preview ------------------------------------------------------
  function preview() {
    const pid = effectivePaletteId(state, scheme);
    const vars = paletteVars(pid, state.accent);
    const radius = { sharp: "5px", balanced: "9px", soft: "14px" }[state.corners];
    const mono = CODE_FONTS[state.codeFont] ?? "ui-monospace, SFMono-Regular, Menlo, Consolas, \"Cascadia Mono\", \"Microsoft YaHei UI\", \"Microsoft YaHei\", monospace";
    return h(
      "figure",
      {
        class: `pf-preview${state.enabled ? "" : " is-off"}`,
        "data-amb": state.ambient,
        style: { ...vars, "--pv-r": radius, "--pv-mono": mono, ...PREVIEW_AMBIENT[state.ambient] },
        "aria-label": t("previewTitle"),
      },
      h("div", { class: "pf-pv__hair" }),
      h("div", { class: "pf-pv__aura" }),
      h(
        "div",
        { class: "pf-pv__side" },
        h("div", { class: "pf-pv__brand" }, prismGlyph(14, "pv"), h("span", null, "Codex")),
        h("div", { class: "pf-pv__nav is-active" }, h("span", { class: "pf-pv__navdot" }), "theme-loader"),
        h("div", { class: "pf-pv__nav" }, h("span", { class: "pf-pv__navdot is-idle" }), "release-notes"),
        h("div", { class: "pf-pv__nav" }, h("span", { class: "pf-pv__navdot is-idle" }), "fix-ci"),
      ),
      h(
        "div",
        { class: "pf-pv__main" },
        h("div", { class: "pf-pv__bubble" }, t("previewUser")),
        h("p", { class: "pf-pv__text" }, t("previewBot"), " ", h("code", null, "shared/palettes.mjs"), "."),
        h(
          "pre",
          { class: "pf-pv__code" },
          h("span", { class: "tk-k" }, "export const "),
          h("span", { class: "tk-f" }, "palette"),
          " = ",
          h("span", { class: "tk-s" }, `"${pid}"`),
          "; ",
          h("span", { class: "tk-c" }, "// => !=="),
        ),
        h(
          "div",
          { class: "pf-pv__composer" },
          h("span", { class: "pf-pv__placeholder" }, t("previewComposer")),
          h("span", { class: "pf-pv__send", "aria-hidden": "true" }, "↑"),
        ),
      ),
      h("figcaption", { class: "pf-pv__caption" }, `${t("previewTitle")} · ${t(pid)}`),
    );
  }

  // ---- render ------------------------------------------------------------
  let statusEl = h("span", { class: "pf-status", role: "status", "aria-live": "polite" });
  function renderStatus() {
    statusEl.textContent = status.text;
    statusEl.className = `pf-status${status.kind === "idle" ? "" : ` is-${status.kind}`}`;
  }

  function render() {
    const focused = root.getRootNode()?.activeElement?.getAttribute?.("data-focus") ?? null;
    applyVars(shell, paletteVars(effectivePaletteId(state, scheme), state.accent));
    shell.style.setProperty("--pf-r", { sharp: "6px", balanced: "10px", soft: "14px" }[state.corners]);

    statusEl = h("span", { class: "pf-status", role: "status", "aria-live": "polite" });
    renderStatus();

    if (view === "usage") usage ??= mountUsageView(usageHost, api, () => t);
    const nav = h(
      "nav",
      { class: "pf-tabs", role: "tablist" },
      [
        ["appearance", t("tabAppearance")],
        ["usage", t("tabUsage")],
      ].map(([id, label]) =>
        h(
          "button",
          {
            type: "button",
            role: "tab",
            class: view === id ? "is-on" : "",
            "aria-selected": view === id ? "true" : "false",
            "data-focus": `tab:${id}`,
            onClick: () => {
              view = id;
              render();
            },
          },
          label,
        ),
      ),
    );

    shell.replaceChildren(
      ...[
      h(
        "header",
        { class: "pf-head" },
        h("div", { class: "pf-head__logo" }, prismGlyph(28, "head")),
        h("div", { class: "pf-head__text" }, h("h1", null, t("title")), h("p", null, t("subtitle"))),
        statusEl,
        h(
          "button",
          {
            type: "button",
            role: "switch",
            class: "pf-switch pf-switch--lg",
            "aria-checked": state.enabled ? "true" : "false",
            "aria-label": t("applyTheme"),
            title: t("applyThemeHint"),
            "data-focus": "switch:enabled",
            onClick: () => commit({ enabled: !state.enabled }),
          },
          h("span", { class: "pf-switch__thumb" }),
        ),
      ),
      nav,
      view === "usage" ? h("section", { class: "pf-section pf-usage-wrap" }, h("div", { class: "pf-usage-opts" }, toggle("homeStats", t("homeStats"), t("homeStatsHint"))), usageHost) : null,
      view !== "appearance" ? null : h(
        "div",
        { class: "pf-layout" },
        h(
          "div",
          { class: "pf-col" },
          section(
            t("sectionPalette"),
            row(t("mode"), segmented("mode", [["auto", t("modeAuto")], ["dark", t("modeDark")], ["light", t("modeLight")]], t("mode"))),
            h("div", { class: "pf-group-label" }, t("darkGroup")),
            h("div", { class: "pf-cards" }, DARK_PALETTES.map(paletteCard)),
            h("div", { class: "pf-group-label" }, t("lightGroup")),
            h("div", { class: "pf-cards" }, LIGHT_PALETTES.map(paletteCard)),
          ),
          section(t("sectionAccent"), accentChips()),
          section(
            t("sectionShape"),
            row(t("corners"), segmented("corners", CORNERS.map((id) => [id, t(id)]), t("corners"))),
            row(
              t("codeFont"),
              segmented(
                "codeFont",
                Object.keys(CODE_FONTS).map((id) => [id, id === "default" ? t("fontDefault") : { jetbrains: "JetBrains Mono", cascadia: "Cascadia Code", sfmono: "SF Mono" }[id]]),
                t("codeFont"),
              ),
            ),
            toggle("ligatures", t("ligatures")),
          ),
          section(
            t("sectionLight"),
            row(
              t("scene"),
              h(
                "div",
                { class: "pf-scenes" },
                Object.entries(SCENES).map(([id, patch]) => {
                  const on = Object.entries(patch).every(([k, v]) => state[k] === v);
                  return h(
                    "button",
                    { type: "button", class: `pf-scene${on ? " is-on" : ""}`, "data-focus": `scene:${id}`, onClick: () => commit(patch) },
                    t(`scene${id[0].toUpperCase()}${id.slice(1)}`),
                  );
                }),
              ),
            ),
            row(t("ambient"), segmented("ambient", Object.keys(AMBIENT_LEVELS).map((id) => [id, t(id)]), t("ambient"))),
            toggle("glassMenus", t("glassMenus"), t("glassMenusHint")),
            toggle("showWidget", t("showWidget"), t("showWidgetHint")),
          ),
        ),
        h("div", { class: "pf-col pf-col--preview" }, preview()),
      ),
      view !== "appearance" ? null : h(
        "footer",
        { class: "pf-foot" },
        h("div", { class: "pf-foot__about" }, h("strong", null, t("about")), h("p", null, t("aboutBody")), h("a", { href: SOURCE_URL, target: "_blank", rel: "noreferrer noopener" }, `${t("source")}: Obsidian Prism · RMvdesi ↗`)),
        h("button", { type: "button", class: "pf-btn", "data-focus": "reset", onClick: () => commit({ ...DEFAULTS }) }, t("reset")),
      ),
      ].filter(Boolean), // replaceChildren() would stringify null as "null"
    );

    if (focused) shell.querySelector(`[data-focus="${CSS.escape(focused)}"]`)?.focus();
  }

  render();

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
    clearTimeout(toastTimer);
    usage?.dispose();
    stopStorage();
    stopLocale();
    stopScheme();
    root.replaceChildren();
  };
}
