// SPDX-License-Identifier: GPL-3.0-only
// Prism Facets — palette data shared by page, widget and the CSS build script.
//
// Colour values are ported from Obsidian Prism (c) 2026 RMvdesi
// https://github.com/RMvdesi/obsidian-prism (style.css, v1.0.8-beta.3).
// Modified 2026-11-26: restructured into a data module for codexhost.

export const EXTENSION_ID = "prism-facets";

/** Four optical palettes: two dark, two light. */
export const PALETTES = {
  obsidian: {
    scheme: "dark",
    bg: "#0E0E11",
    sidebar: "#09090B",
    card: "#141418",
    secondary: "#1C1C22",
    muted: "#141418",
    raised: "#202534",
    codeBg: "#0D0F14",
    fg: "#F2F2F5",
    fg2: "#C4C4CE",
    fg3: "#8A8A98",
    placeholder: "#626270",
    accent: "#669DF6",
    onAccent: "#FFFFFF",
    link: "#8AB4F8",
    error: "#E5534B",
    warning: "#F2B84B",
    success: "#50A37B",
    border: "rgba(218, 228, 255, 0.052)",
    cardBorder: "rgba(218, 228, 255, 0.068)",
    menu: "rgba(13, 14, 18, 0.94)",
    menuBorder: "rgba(220, 230, 255, 0.105)",
    popover: "rgba(23, 24, 30, 0.93)",
    bubble: "rgba(255, 255, 255, 0.052)",
    scrim: "rgba(9, 9, 11, 0.74)",
    specular: "rgba(255, 255, 255, 0.095)",
    spectrum: ["#4285F4", "#9B72CB", "#EA4335", "#FBBC04"],
  },
  warm: {
    scheme: "dark",
    bg: "#141413",
    sidebar: "#10100F",
    card: "#1B1A18",
    secondary: "#22201D",
    muted: "#1B1A18",
    raised: "#2B2723",
    codeBg: "#141312",
    fg: "#F2EFE9",
    fg2: "#CEC8BC",
    fg3: "#A39E93",
    placeholder: "#6E6A61",
    accent: "#D97757",
    onAccent: "#FFFFFF",
    link: "#E59377",
    error: "#E5534B",
    warning: "#E5A93B",
    success: "#56A87E",
    border: "rgba(245, 240, 230, 0.056)",
    cardBorder: "rgba(245, 240, 230, 0.078)",
    menu: "rgba(24, 22, 20, 0.95)",
    menuBorder: "rgba(245, 235, 220, 0.11)",
    popover: "rgba(25, 24, 22, 0.93)",
    bubble: "rgba(245, 240, 230, 0.055)",
    scrim: "rgba(0, 0, 0, 0.64)",
    specular: "rgba(255, 248, 236, 0.09)",
    spectrum: ["#F6BD60", "#F0A37E", "#E59377", "#D97757"],
  },
  crystal: {
    scheme: "light",
    bg: "#F4F7FB",
    sidebar: "#E8EEF6",
    card: "#FFFFFF",
    secondary: "#E9EFF8",
    muted: "#ECF1F9",
    raised: "#FFFFFF",
    codeBg: "#EDF3FB",
    fg: "#0F172A",
    fg2: "#334155",
    fg3: "#4B5B73",
    placeholder: "#596880",
    accent: "#2563EB",
    onAccent: "#FFFFFF",
    link: "#1D4ED8",
    error: "#DC2626",
    warning: "#D97706",
    success: "#059669",
    border: "rgba(15, 23, 42, 0.11)",
    cardBorder: "rgba(15, 23, 42, 0.15)",
    menu: "rgba(252, 253, 254, 0.96)",
    menuBorder: "rgba(15, 23, 42, 0.10)",
    popover: "rgba(255, 255, 255, 0.96)",
    bubble: "#EAF1FB",
    scrim: "rgba(15, 23, 42, 0.36)",
    specular: "rgba(255, 255, 255, 0.94)",
    spectrum: ["#4285F4", "#9B72CB", "#EA4335", "#FBBC04"],
  },
  alabaster: {
    scheme: "light",
    bg: "#F6F4EE",
    sidebar: "#EBE6DC",
    card: "#FFFFFF",
    secondary: "#EFECE3",
    muted: "#F1EEE6",
    raised: "#FFFFFF",
    codeBg: "#F1ECE2",
    fg: "#1C1814",
    fg2: "#3F3830",
    fg3: "#574F45",
    placeholder: "#645B50",
    accent: "#C25934",
    onAccent: "#FFFFFF",
    link: "#B54D28",
    error: "#DC2626",
    warning: "#D97706",
    success: "#15803D",
    border: "rgba(42, 32, 20, 0.115)",
    cardBorder: "rgba(42, 32, 20, 0.155)",
    menu: "rgba(253, 251, 247, 0.96)",
    menuBorder: "rgba(42, 32, 20, 0.10)",
    popover: "rgba(255, 255, 255, 0.96)",
    bubble: "#EFECE2",
    scrim: "rgba(32, 24, 16, 0.34)",
    specular: "rgba(255, 255, 255, 0.97)",
    spectrum: ["#D97706", "#EA580C", "#C25934", "#9A3412"],
  },
};

export const DARK_PALETTES = ["obsidian", "warm"];
export const LIGHT_PALETTES = ["crystal", "alabaster"];

/** Industrial accent tones; "follow" keeps the palette's own accent. */
export const ACCENTS = {
  cobalt: {
    dark: { accent: "#669DF6", link: "#8AB4F8", onAccent: "#FFFFFF", spectrum: ["#3B82F6", "#60A5FA", "#38BDF8", "#93C5FD"] },
    light: { accent: "#2563EB", link: "#1D4ED8", onAccent: "#FFFFFF", spectrum: ["#2563EB", "#3B82F6", "#0284C7", "#60A5FA"] },
  },
  iris: {
    dark: { accent: "#A58AF8", link: "#BBA6FF", onAccent: "#FFFFFF", spectrum: ["#8B5CF6", "#A78BFA", "#C084FC", "#DDD6FE"] },
    light: { accent: "#7C3AED", link: "#6D28D9", onAccent: "#FFFFFF", spectrum: ["#7C3AED", "#8B5CF6", "#9333EA", "#A78BFA"] },
  },
  amber: {
    dark: { accent: "#F2B84B", link: "#F6CB75", onAccent: "#14120E", spectrum: ["#F59E0B", "#FBBF24", "#EA580C", "#FDE68A"] },
    light: { accent: "#D97706", link: "#B45309", onAccent: "#FFFFFF", spectrum: ["#D97706", "#F59E0B", "#EA580C", "#B45309"] },
  },
  mono: {
    dark: { accent: "#D4D7E0", link: "#E2E5EE", onAccent: "#0E0F14", spectrum: ["#E2E8F0", "#94A3B8", "#CBD5E1", "#F8FAFC"] },
    light: { accent: "#334155", link: "#1E293B", onAccent: "#F8FAFC", spectrum: ["#334155", "#64748B", "#475569", "#0F172A"] },
  },
};

export const CORNERS = ["sharp", "balanced", "soft"];
export const CODE_FONTS = {
  default: null,
  jetbrains: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, ui-monospace, monospace",
  cascadia: "'Cascadia Code', 'Cascadia Mono', 'Fira Code', Consolas, ui-monospace, monospace",
  sfmono: "'SF Mono', SFMono-Regular, Menlo, Monaco, Consolas, ui-monospace, monospace",
};
export const AMBIENT_LEVELS = { off: 0, low: 0.45, medium: 0.75, high: 1 };

/** Must stay in sync with manifest.json → settingsSchema defaults. */
export const DEFAULTS = Object.freeze({
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
  showWidget: true,
  homeStats: true,
  codexHome: "",
});

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

/** Fill in defaults and drop unknown or invalid values. */
export function normalizeSettings(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const bool = (key) => (typeof input[key] === "boolean" ? input[key] : DEFAULTS[key]);
  return {
    enabled: bool("enabled"),
    mode: pick(input.mode, ["auto", "dark", "light"], DEFAULTS.mode),
    darkPalette: pick(input.darkPalette, DARK_PALETTES, DEFAULTS.darkPalette),
    lightPalette: pick(input.lightPalette, LIGHT_PALETTES, DEFAULTS.lightPalette),
    accent: pick(input.accent, ["follow", ...Object.keys(ACCENTS)], DEFAULTS.accent),
    corners: pick(input.corners, CORNERS, DEFAULTS.corners),
    codeFont: pick(input.codeFont, Object.keys(CODE_FONTS), DEFAULTS.codeFont),
    ligatures: bool("ligatures"),
    ambient: pick(input.ambient, Object.keys(AMBIENT_LEVELS), DEFAULTS.ambient),
    glassMenus: bool("glassMenus"),
    showWidget: bool("showWidget"),
    homeStats: bool("homeStats"),
    codexHome: typeof input.codexHome === "string" ? input.codexHome : DEFAULTS.codexHome,
  };
}

/** Which palette is active for the given host colour scheme. */
export function effectivePaletteId(settings, hostScheme) {
  const scheme = settings.mode === "auto" ? (hostScheme === "light" ? "light" : "dark") : settings.mode;
  return scheme === "light" ? settings.lightPalette : settings.darkPalette;
}

/** Resolved colours (palette + accent tone) for previews in page and widget. */
export function resolveColors(paletteId, accentId) {
  const base = PALETTES[paletteId] ?? PALETTES.obsidian;
  const tone = accentId !== "follow" ? ACCENTS[accentId]?.[base.scheme] : undefined;
  return tone ? { ...base, ...tone } : { ...base };
}

/**
 * Marker names applied to <html> through api.dom.mark. The CSS build uses the
 * same names, so keep this function the single source of truth.
 */
export function markersFor(settings, hostScheme) {
  if (!settings.enabled) return [];
  const paletteId = effectivePaletteId(settings, hostScheme);
  const scheme = PALETTES[paletteId].scheme;
  const markers = ["on", `p-${paletteId}`, `s-${scheme}`, `r-${settings.corners}`];
  if (settings.accent !== "follow") markers.push(`a-${settings.accent}`);
  if (settings.codeFont !== "default") markers.push(`f-${settings.codeFont}`);
  if (settings.ligatures) markers.push("lig");
  if (settings.ambient !== "off") markers.push(`amb-${settings.ambient}`);
  if (settings.glassMenus) markers.push("glass");
  return markers;
}

/** Every marker name that may ever be applied (used for clean-up). */
export const ALL_MARKERS = [
  "on",
  ...Object.keys(PALETTES).map((id) => `p-${id}`),
  "s-dark",
  "s-light",
  ...CORNERS.map((id) => `r-${id}`),
  ...Object.keys(ACCENTS).map((id) => `a-${id}`),
  ...Object.keys(CODE_FONTS).filter((id) => id !== "default").map((id) => `f-${id}`),
  "lig",
  ...Object.keys(AMBIENT_LEVELS).filter((id) => id !== "off").map((id) => `amb-${id}`),
  "glass",
];

/** Scene presets, mirroring Obsidian Prism's "full / focus / quiet" presets. */
export const SCENES = {
  full: { ambient: "high", glassMenus: true },
  focus: { ambient: "low", glassMenus: true },
  quiet: { ambient: "off", glassMenus: false },
};

/** Read → merge → write. storage.set replaces every value, so always merge. */
export async function patchSettings(api, patch) {
  const current = normalizeSettings(await api.storage.get());
  const next = normalizeSettings({ ...current, ...patch });
  return normalizeSettings(await api.storage.set(next));
}
