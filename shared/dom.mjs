// SPDX-License-Identifier: GPL-3.0-only
// Prism Facets — tiny DOM helpers shared by page and widget (no innerHTML for data).

import { resolveColors } from "./palettes.mjs";

/** h("button", { class: "x", onClick }, "text", child) */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "style" && typeof value === "object") {
      for (const [name, v] of Object.entries(value)) el.style.setProperty(name, v);
    } else if (key === "class") {
      el.className = value;
    } else {
      el.setAttribute(key, value === true ? "" : String(value));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children) {
    if (child === undefined || child === null || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** The prism crystal glyph with a spectrum gradient (static markup). */
export function prismGlyph(size = 20, idSuffix = "g") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  const gid = `pf-spec-${idSuffix}`;
  const defs = document.createElementNS(SVG_NS, "defs");
  const grad = document.createElementNS(SVG_NS, "linearGradient");
  grad.setAttribute("id", gid);
  grad.setAttribute("x1", "0");
  grad.setAttribute("y1", "0");
  grad.setAttribute("x2", "1");
  grad.setAttribute("y2", "1");
  [
    ["0", "var(--pf-spec-1)"],
    ["0.4", "var(--pf-spec-2)"],
    ["0.75", "var(--pf-spec-3)"],
    ["1", "var(--pf-spec-4)"],
  ].forEach(([offset, color]) => {
    const stop = document.createElementNS(SVG_NS, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("style", `stop-color:${color}`);
    grad.append(stop);
  });
  defs.append(grad);
  svg.append(defs);
  const shapes = [
    ["path", { d: "M12 2.5 21 19.5H3Z", fill: `url(#${gid})`, opacity: "0.92" }],
    ["path", { d: "M12 2.5 14.6 19.5H9.4Z", fill: "#fff", opacity: "0.28" }],
    ["path", { d: "M12 2.5 21 19.5H3Z", fill: "none", stroke: "#fff", "stroke-opacity": "0.55", "stroke-width": "0.9", "stroke-linejoin": "round" }],
  ];
  for (const [tag, attrs] of shapes) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    svg.append(node);
  }
  return svg;
}

/** CSS custom properties for a resolved palette, applied to a local root. */
export function paletteVars(paletteId, accentId) {
  const c = resolveColors(paletteId, accentId);
  return {
    "color-scheme": c.scheme,
    "--pf-bg": c.bg,
    "--pf-sidebar": c.sidebar,
    "--pf-card": c.card,
    "--pf-secondary": c.secondary,
    "--pf-muted": c.muted,
    "--pf-raised": c.raised,
    "--pf-code-bg": c.codeBg,
    "--pf-fg": c.fg,
    "--pf-fg2": c.fg2,
    "--pf-fg3": c.fg3,
    "--pf-placeholder": c.placeholder,
    "--pf-accent": c.accent,
    "--pf-on-accent": c.onAccent,
    "--pf-link": c.link,
    "--pf-error": c.error,
    "--pf-warning": c.warning,
    "--pf-success": c.success,
    "--pf-border": c.border,
    "--pf-card-border": c.cardBorder,
    "--pf-menu": c.menu,
    "--pf-menu-border": c.menuBorder,
    "--pf-popover": c.popover,
    "--pf-bubble": c.bubble,
    "--pf-specular": c.specular,
    "--pf-spec-1": c.spectrum[0],
    "--pf-spec-2": c.spectrum[1],
    "--pf-spec-3": c.spectrum[2],
    "--pf-spec-4": c.spectrum[3],
  };
}

export function applyVars(el, vars) {
  for (const [name, value] of Object.entries(vars)) el.style.setProperty(name, value);
}
