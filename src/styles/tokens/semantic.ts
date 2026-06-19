import { BACKDROP, HUE, deriveOn, type ThemeMode } from "./primitives";
import type { ColorTokenName } from "./apca-targets";
import type { Contrast } from "./enums";

function targets(contrast: Contrast) {
  const boost = contrast === "high" ? 15 : 0;
  return {
    fg: 90, fgMuted: Math.min(90, 60 + boost), fgSubtle: 30 + boost,
    link: 60 + boost, accentFg: 60 + boost,
    border: 15 + boost, borderStrong: 30 + boost, ring: 45 + boost,
    accentFill: 45 + boost, status: 60 + boost, statusOnTint: 60 + boost, tint: 8,
  };
}

export function buildColorLayer(theme: ThemeMode, contrast: Contrast): Record<ColorTokenName, string> {
  const bd = BACKDROP[theme];
  const t = targets(contrast);
  const dirFg = theme === "light" ? "darker" : "lighter";
  const dirTint = theme === "light" ? "darker" : "lighter"; // тинт явно по теме (не auto)
  // fg-семейство деривируем против наименее контрастного фона:
  const worstFg = theme === "light" ? bd.bgRaised : bd.bgSubtle;

  const accent = deriveOn(bd.bg, t.accentFill, HUE.accent.h, HUE.accent.c, dirFg);
  const accentHover = deriveOn(bd.bg, t.accentFill + 10, HUE.accent.h, HUE.accent.c, dirFg);

  const dangerBg = deriveOn(bd.bg, t.tint, HUE.danger.h, HUE.danger.c * 0.3, dirTint);
  const successBg = deriveOn(bd.bg, t.tint, HUE.success.h, HUE.success.c * 0.3, dirTint);
  const warningBg = deriveOn(bd.bg, t.tint, HUE.warning.h, HUE.warning.c * 0.3, dirTint);
  const infoBg = deriveOn(bd.bg, t.tint, HUE.info.h, HUE.info.c * 0.3, dirTint);

  return {
    surface: bd.bg, "surface-subtle": bd.bgSubtle, "surface-raised": bd.bgRaised,
    "surface-overlay": theme === "light" ? "oklch(0.21 0.018 250 / 0.45)" : "oklch(0 0 0 / 0.6)",

    fg: deriveOn(worstFg, t.fg, HUE.neutral.h, HUE.neutral.c, dirFg),
    "fg-muted": deriveOn(worstFg, t.fgMuted, HUE.neutral.h, HUE.neutral.c, dirFg),
    "fg-subtle": deriveOn(bd.bg, t.fgSubtle, HUE.neutral.h, HUE.neutral.c, dirFg),
    "fg-on-accent": deriveOn(accent, t.accentFg, HUE.neutral.h, 0.0, "auto"),

    border: deriveOn(bd.bg, t.border, HUE.neutral.h, HUE.neutral.c, dirFg),
    "border-strong": deriveOn(bd.bg, t.borderStrong, HUE.neutral.h, HUE.neutral.c, dirFg),
    // ring — нейтральный (не accent-hue), чтобы оставаться различимым на любой поверхности
    ring: deriveOn(bd.bg, t.ring, HUE.link.h, HUE.link.c, dirFg),

    accent, "accent-hover": accentHover,
    "accent-fg": deriveOn(accent, t.accentFg, HUE.neutral.h, 0.0, "auto"),

    link: deriveOn(bd.bg, t.link, HUE.link.h, HUE.link.c, dirFg),
    "link-hover": deriveOn(bd.bg, t.link + 10, HUE.link.h, HUE.link.c, dirFg),

    danger: deriveOn(bd.bg, t.status, HUE.danger.h, HUE.danger.c, dirFg),
    "danger-bg": dangerBg,
    "danger-fg": deriveOn(dangerBg, t.statusOnTint, HUE.danger.h, HUE.danger.c, dirFg),
    success: deriveOn(bd.bg, t.status, HUE.success.h, HUE.success.c, dirFg),
    "success-bg": successBg,
    "success-fg": deriveOn(successBg, t.statusOnTint, HUE.success.h, HUE.success.c, dirFg),
    warning: deriveOn(bd.bg, t.status, HUE.warning.h, HUE.warning.c, dirFg),
    "warning-bg": warningBg,
    "warning-fg": deriveOn(warningBg, t.statusOnTint, HUE.warning.h, HUE.warning.c, dirFg),
    info: deriveOn(bd.bg, t.status, HUE.info.h, HUE.info.c, dirFg),
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
