import type { ColorTokenName } from "./apca-targets";
import type { Contrast } from "./enums";
import { BACKDROP, HUE, deriveOn, type ThemeMode } from "./primitives";

function targets(contrast: Contrast) {
  const boost = contrast === "high" ? 15 : 0;
  return {
    fg: 90, fgMuted: Math.min(90, 62 + boost), fgSubtle: 30 + boost,
    link: 62 + boost, accentFg: 60 + boost,
    border: 17 + boost, borderStrong: 30 + boost, ring: 45 + boost,
    // accentFill: 60 in light (darker fill for white label) + boost in high-contrast;
    // 45 in dark (lighter fill sweet-spot) — NO boost (a lighter fill would hurt white text).
    accentFillLight: 60 + boost, accentFillDark: 45,
    status: 62 + boost, statusOnTint: 65 + boost, tint: 8,
  };
}

export function buildColorLayer(theme: ThemeMode, contrast: Contrast): Record<ColorTokenName, string> {
  const bd = BACKDROP[theme];
  const t = targets(contrast);
  // Derivation search-direction by theme: darker for light surfaces, lighter for dark.
  // fg, tints, borders, links all share this direction (it's a property of the theme).
  const dir = theme === "light" ? "darker" : "lighter";
  // fg-семейство деривируем против наименее контрастного фона:
  // light: bgSubtle — самый тёмный из surface-семейства (bg/bgSubtle/bgRaised)
  // dark:  bgSubtle — самый светлый из surface-семейства
  const worstFg = bd.bgSubtle;

  // In light mode: higher accentFill = darker fill = easier for near-white fg-on-accent (boost adds contrast).
  // In dark mode: accentFill stays at 45 regardless of contrast — boosting makes fill lighter, which
  // paradoxically HURTS fg-on-accent (white text needs a dark-enough fill to reach Lc 60).
  const accentFill = theme === "light" ? t.accentFillLight : t.accentFillDark;
  const accent = deriveOn(bd.bg, accentFill, HUE.accent.h, HUE.accent.c, dir);
  // accent-hover: in light, go darker from bg (fill darkens on hover);
  // in dark, go slightly darker from accent so fg-on-accent (near-white) keeps Lc ≥ 60
  const accentHover = theme === "light"
    ? deriveOn(bd.bg, accentFill + 10, HUE.accent.h, HUE.accent.c, dir)
    : deriveOn(accent, 15, HUE.accent.h, HUE.accent.c, "darker");

  // danger-solid: a fixed-lightness saturated red for solid danger buttons.
  // L=0.42 gives a dark-enough fill so a near-white label reaches Lc≥60 in both themes.
  // boost nudges it slightly darker in high-contrast mode (lower L = more contrast for the label).
  const dangerSolidL = contrast === "high" ? 0.39 : 0.42;
  // Chroma clamped to the sRGB gamut at this lightness/hue (HUE.danger.c=0.2 is
  // out of sRGB here → would be clipped on sRGB displays, drifting the verified
  // danger-on-solid contrast). These values stay in-gamut; label keeps Lc≥60.
  const dangerSolidC = contrast === "high" ? 0.158 : 0.171;
  const dangerSolid = `oklch(${dangerSolidL} ${dangerSolidC} ${HUE.danger.h})`;
  const dangerOnSolid = deriveOn(dangerSolid, 65, HUE.neutral.h, 0.0, "lighter");
  const dangerBg = deriveOn(bd.bg, t.tint, HUE.danger.h, HUE.danger.c * 0.3, dir);
  const successBg = deriveOn(bd.bg, t.tint, HUE.success.h, HUE.success.c * 0.3, dir);
  const warningBg = deriveOn(bd.bg, t.tint, HUE.warning.h, HUE.warning.c * 0.3, dir);
  const infoBg = deriveOn(bd.bg, t.tint, HUE.info.h, HUE.info.c * 0.3, dir);

  // Derive status tokens with a higher target in dark to overcome quantisation gaps
  const statusTarget = theme === "dark" ? Math.max(t.status, 65) : t.status;

  // Annotation highlight ("маркер") — полупрозрачный амбер-слой поверх текста документа.
  // Задаётся ЛИТЕРАЛАМИ (как surface-overlay), а не deriveOn: токену нужен alpha-канал,
  // которого derive-пайплайн (apcach) не даёт. Подбор оттенков/L под APCA-гард:
  //   • fg остаётся читаемым под маркером (Lc≥75 во всех 4 комбо — apca.test.ts);
  //   • light: яркий амбер (высокий L) под чёрным fg; dark: тёмный амбер (низкий L)
  //     под near-white fg — оба дают translucent-тинт, различимый по chroma;
  //   • -active отличается ВТОРЫМ каналом: выше alpha + насыщеннее + (в CSS) underline;
  //   • high-contrast → чуть выше alpha (плотнее маркер), L отодвинут для запаса Lc.
  //   Chroma выбран В ПРЕДЕЛАХ sRGB-gamut при данных L/hue (primitives.test.ts gamut-гард).
  const highlight = theme === "light"
    ? (contrast === "high" ? "oklch(0.92 0.082 85 / 0.55)" : "oklch(0.90 0.105 85 / 0.45)")
    : (contrast === "high" ? "oklch(0.38 0.074 85 / 0.55)" : "oklch(0.42 0.083 85 / 0.45)");
  const highlightActive = theme === "light"
    ? (contrast === "high" ? "oklch(0.88 0.110 80 / 0.70)" : "oklch(0.86 0.130 80 / 0.60)")
    : (contrast === "high" ? "oklch(0.40 0.079 80 / 0.70)" : "oklch(0.44 0.088 80 / 0.60)");

  return {
    surface: bd.bg, "surface-subtle": bd.bgSubtle, "surface-raised": bd.bgRaised,
    "surface-overlay": theme === "light" ? "oklch(0.21 0.018 250 / 0.45)" : "oklch(0 0 0 / 0.6)",

    fg: deriveOn(worstFg, t.fg, HUE.neutral.h, HUE.neutral.c, dir),
    "fg-muted": deriveOn(worstFg, t.fgMuted, HUE.neutral.h, HUE.neutral.c, dir),
    "fg-subtle": deriveOn(bd.bg, t.fgSubtle, HUE.neutral.h, HUE.neutral.c, dir),
    // fg-on-accent: "lighter" direction → near-white label, valid on any solid fill ≤ 65% oklch L
    "fg-on-accent": deriveOn(accent, t.accentFg, HUE.neutral.h, 0.0, "lighter"),

    border: deriveOn(bd.bg, t.border, HUE.neutral.h, HUE.neutral.c, dir),
    "border-strong": deriveOn(bd.bg, t.borderStrong, HUE.neutral.h, HUE.neutral.c, dir),
    // ring — на link-hue (синий), НЕ accent-hue: отличается от акцентной заливки,
    // поэтому focus-кольцо остаётся различимым в т.ч. поверх accent-поверхностей.
    ring: deriveOn(bd.bg, t.ring, HUE.link.h, HUE.link.c, dir),

    accent, "accent-hover": accentHover,
    "accent-fg": deriveOn(accent, t.accentFg, HUE.neutral.h, 0.0, "lighter"),

    link: deriveOn(bd.bg, t.link, HUE.link.h, HUE.link.c, dir),
    "link-hover": deriveOn(bd.bg, t.link + 10, HUE.link.h, HUE.link.c, dir),

    danger: deriveOn(bd.bg, statusTarget, HUE.danger.h, HUE.danger.c, dir),
    "danger-bg": dangerBg,
    "danger-fg": deriveOn(dangerBg, t.statusOnTint, HUE.danger.h, HUE.danger.c, dir),
    "danger-solid": dangerSolid,
    "danger-on-solid": dangerOnSolid,
    success: deriveOn(bd.bg, statusTarget, HUE.success.h, HUE.success.c, dir),
    "success-bg": successBg,
    "success-fg": deriveOn(successBg, t.statusOnTint, HUE.success.h, HUE.success.c, dir),
    warning: deriveOn(bd.bg, statusTarget, HUE.warning.h, HUE.warning.c, dir),
    "warning-bg": warningBg,
    "warning-fg": deriveOn(warningBg, t.statusOnTint, HUE.warning.h, HUE.warning.c, dir),
    info: deriveOn(bd.bg, statusTarget, HUE.info.h, HUE.info.c, dir),
    "info-bg": infoBg,
    "info-fg": deriveOn(infoBg, t.statusOnTint, HUE.info.h, HUE.info.c, dir),

    highlight, "highlight-active": highlightActive,
  };
}

export const COLOR_LAYERS = {
  "light-normal": buildColorLayer("light", "normal"),
  "light-high": buildColorLayer("light", "high"),
  "dark-normal": buildColorLayer("dark", "normal"),
  "dark-high": buildColorLayer("dark", "high"),
} as const;
