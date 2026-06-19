import { BACKDROP, HUE, deriveOn, type ThemeMode } from "./primitives";
import type { ColorTokenName } from "./apca-targets";
import type { Contrast } from "./enums";

function targets(contrast: Contrast) {
  const boost = contrast === "high" ? 15 : 0;
  return {
    fg: 90, fgMuted: Math.min(90, 62 + boost), fgSubtle: 30 + boost,
    link: 62 + boost, accentFg: 60 + boost,
    border: 17 + boost, borderStrong: 30 + boost, ring: 45 + boost,
    // accentFill: 60 in light (darker fill for white label), 45 in dark (lighter fill, sweet-spot)
    accentFillLight: 60, accentFillDark: 45,
    status: 62 + boost, statusOnTint: 65 + boost, tint: 8,
  };
}

export function buildColorLayer(theme: ThemeMode, contrast: Contrast): Record<ColorTokenName, string> {
  const bd = BACKDROP[theme];
  const t = targets(contrast);
  const dirFg = theme === "light" ? "darker" : "lighter";
  const dirTint = theme === "light" ? "darker" : "lighter"; // тинт явно по теме (не auto)
  // fg-семейство деривируем против наименее контрастного фона:
  // light: bgSubtle — самый тёмный из surface-семейства (bg/bgSubtle/bgRaised)
  // dark:  bgSubtle — самый светлый из surface-семейства
  const worstFg = bd.bgSubtle;

  // In light mode: higher accentFill = darker fill = easier for near-white fg-on-accent (boost adds contrast).
  // In dark mode: accentFill stays at 45 regardless of contrast — boosting makes fill lighter, which
  // paradoxically HURTS fg-on-accent (white text needs a dark-enough fill to reach Lc 60).
  const accentFill = theme === "light"
    ? t.accentFillLight + (contrast === "high" ? 15 : 0)
    : t.accentFillDark; // NO boost in dark — lighter fill reduces white-text contrast
  const accent = deriveOn(bd.bg, accentFill, HUE.accent.h, HUE.accent.c, dirFg);
  // accent-hover: in light, go darker from bg (fill darkens on hover);
  // in dark, go slightly darker from accent so fg-on-accent (near-white) keeps Lc ≥ 60
  const accentHover = theme === "light"
    ? deriveOn(bd.bg, accentFill + 10, HUE.accent.h, HUE.accent.c, dirFg)
    : deriveOn(accent, 15, HUE.accent.h, HUE.accent.c, "darker");

  // danger-solid: a fixed-lightness saturated red for solid danger buttons.
  // L=0.42 gives a dark-enough fill so a near-white label reaches Lc≥60 in both themes.
  // boost nudges it slightly darker in high-contrast mode (lower L = more contrast for the label).
  const dangerSolidL = contrast === "high" ? 0.39 : 0.42;
  const dangerSolid = `oklch(${dangerSolidL} ${HUE.danger.c} ${HUE.danger.h})`;
  const dangerOnSolid = deriveOn(dangerSolid, 65, HUE.neutral.h, 0.0, "lighter");
  const dangerBg = deriveOn(bd.bg, t.tint, HUE.danger.h, HUE.danger.c * 0.3, dirTint);
  const successBg = deriveOn(bd.bg, t.tint, HUE.success.h, HUE.success.c * 0.3, dirTint);
  const warningBg = deriveOn(bd.bg, t.tint, HUE.warning.h, HUE.warning.c * 0.3, dirTint);
  const infoBg = deriveOn(bd.bg, t.tint, HUE.info.h, HUE.info.c * 0.3, dirTint);

  // Derive status tokens with a higher target in dark to overcome quantisation gaps
  const statusTarget = theme === "dark" ? Math.max(t.status, 65) : t.status;

  return {
    surface: bd.bg, "surface-subtle": bd.bgSubtle, "surface-raised": bd.bgRaised,
    "surface-overlay": theme === "light" ? "oklch(0.21 0.018 250 / 0.45)" : "oklch(0 0 0 / 0.6)",

    fg: deriveOn(worstFg, t.fg, HUE.neutral.h, HUE.neutral.c, dirFg),
    "fg-muted": deriveOn(worstFg, t.fgMuted, HUE.neutral.h, HUE.neutral.c, dirFg),
    "fg-subtle": deriveOn(bd.bg, t.fgSubtle, HUE.neutral.h, HUE.neutral.c, dirFg),
    // fg-on-accent: "lighter" direction → near-white label, valid on any solid fill ≤ 65% oklch L
    "fg-on-accent": deriveOn(accent, t.accentFg, HUE.neutral.h, 0.0, "lighter"),

    border: deriveOn(bd.bg, t.border, HUE.neutral.h, HUE.neutral.c, dirFg),
    "border-strong": deriveOn(bd.bg, t.borderStrong, HUE.neutral.h, HUE.neutral.c, dirFg),
    // ring — нейтральный (не accent-hue), чтобы оставаться различимым на любой поверхности
    ring: deriveOn(bd.bg, t.ring, HUE.link.h, HUE.link.c, dirFg),

    accent, "accent-hover": accentHover,
    "accent-fg": deriveOn(accent, t.accentFg, HUE.neutral.h, 0.0, "lighter"),

    link: deriveOn(bd.bg, t.link, HUE.link.h, HUE.link.c, dirFg),
    "link-hover": deriveOn(bd.bg, t.link + 10, HUE.link.h, HUE.link.c, dirFg),

    danger: deriveOn(bd.bg, statusTarget, HUE.danger.h, HUE.danger.c, dirFg),
    "danger-bg": dangerBg,
    "danger-fg": deriveOn(dangerBg, t.statusOnTint, HUE.danger.h, HUE.danger.c, dirFg),
    "danger-solid": dangerSolid,
    "danger-on-solid": dangerOnSolid,
    success: deriveOn(bd.bg, statusTarget, HUE.success.h, HUE.success.c, dirFg),
    "success-bg": successBg,
    "success-fg": deriveOn(successBg, t.statusOnTint, HUE.success.h, HUE.success.c, dirFg),
    warning: deriveOn(bd.bg, statusTarget, HUE.warning.h, HUE.warning.c, dirFg),
    "warning-bg": warningBg,
    "warning-fg": deriveOn(warningBg, t.statusOnTint, HUE.warning.h, HUE.warning.c, dirFg),
    info: deriveOn(bd.bg, statusTarget, HUE.info.h, HUE.info.c, dirFg),
    "info-bg": infoBg,
    "info-fg": deriveOn(infoBg, t.statusOnTint, HUE.info.h, HUE.info.c, dirFg),
  };
}

export const COLOR_LAYERS = {
  "light-normal": buildColorLayer("light", "normal"),
  "light-high": buildColorLayer("light", "high"),
  "dark-normal": buildColorLayer("dark", "normal"),
  "dark-high": buildColorLayer("dark", "high"),
} as const;
