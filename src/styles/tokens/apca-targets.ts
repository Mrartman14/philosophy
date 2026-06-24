export type ColorTokenName =
  | "surface" | "surface-subtle" | "surface-raised" | "surface-overlay"
  | "fg" | "fg-muted" | "fg-subtle" | "fg-on-accent"
  | "border" | "border-strong" | "ring"
  | "accent" | "accent-hover" | "accent-fg"
  | "link" | "link-hover"
  | "danger" | "danger-bg" | "danger-fg" | "danger-solid" | "danger-on-solid"
  | "success" | "success-bg" | "success-fg"
  | "warning" | "warning-bg" | "warning-fg"
  | "info" | "info-bg" | "info-fg"
  | "highlight" | "highlight-active";

// NB: ключи fg:/bg: ниже — это поля пары (foreground/background), а не имена токенов.
// Значения — токены ColorTokenName. Статусные -bg/-fg — тинт-подложка/текст-на-тинте.
export const CONTRAST_PAIRS: { fg: ColorTokenName; bg: ColorTokenName; minLc: number; note: string }[] = [
  { fg: "fg", bg: "surface", minLc: 75, note: "body text on app surface (preferred 90)" },
  { fg: "fg", bg: "surface-subtle", minLc: 75, note: "body on subtle surface" },
  { fg: "fg", bg: "surface-raised", minLc: 75, note: "body on raised surface" },
  { fg: "fg-muted", bg: "surface", minLc: 60, note: "secondary text" },
  { fg: "fg-muted", bg: "surface-subtle", minLc: 60, note: "secondary on subtle surface" },
  { fg: "fg-muted", bg: "surface-raised", minLc: 60, note: "secondary on raised surface" },
  { fg: "fg-subtle", bg: "surface", minLc: 30, note: "placeholder/disabled" },
  { fg: "link", bg: "surface", minLc: 60, note: "link" },
  { fg: "link-hover", bg: "surface", minLc: 60, note: "link hover" },
  { fg: "accent", bg: "surface", minLc: 15, note: "accent fill discernible as object on surface" },
  { fg: "accent-fg", bg: "accent", minLc: 60, note: "label on accent fill" },
  { fg: "fg-on-accent", bg: "accent", minLc: 60, note: "alt label on accent" },
  { fg: "accent-fg", bg: "accent-hover", minLc: 60, note: "label on accent hover state" },
  { fg: "fg-on-accent", bg: "accent-hover", minLc: 60, note: "alt label on accent hover" },
  { fg: "border", bg: "surface", minLc: 15, note: "discernible border" },
  { fg: "border-strong", bg: "surface", minLc: 30, note: "interactive border" },
  // Focus rings render with outline-offset, so the ring sits in a surface-coloured gap separated
  // from any fill — the binding contrast is ring-vs-surface. A neutral ring cannot reach Lc≥45
  // against BOTH surface AND accent fill (same-lightness problem), so only the surface pair is kept.
  { fg: "ring", bg: "surface", minLc: 45, note: "focus ring on surface" },
  { fg: "danger", bg: "surface", minLc: 60, note: "danger text/icon" },
  { fg: "danger-on-solid", bg: "danger-solid", minLc: 60, note: "light label on solid danger fill (danger button)" },
  { fg: "danger-fg", bg: "danger-bg", minLc: 60, note: "danger text on tint" },
  { fg: "danger-bg", bg: "surface", minLc: 8, note: "danger tint discernible from surface" },
  { fg: "success", bg: "surface", minLc: 60, note: "success text/icon" },
  { fg: "success-fg", bg: "success-bg", minLc: 60, note: "success text on tint" },
  { fg: "warning", bg: "surface", minLc: 60, note: "warning text/icon" },
  { fg: "warning-fg", bg: "warning-bg", minLc: 60, note: "warning text on tint" },
  { fg: "info", bg: "surface", minLc: 60, note: "info text/icon" },
  { fg: "info-fg", bg: "info-bg", minLc: 60, note: "info text on tint" },
  // Аннотации-маркер: текст документа (fg) ДОЛЖЕН оставаться читаемым под подсветкой.
  // highlight/-active — полупрозрачные «маркеры» (alpha); APCAcontrast меряет их
  // ИНТРИНСИК-цвет (alpha игнорируется в sRGBtoY) → это worst-case подложка, по которой
  // и держим тело-уровень Lc≥75. Различимость самого маркера от surface идёт по chroma
  // (amber-тинт), который APCA не меряет, поэтому пары highlight-vs-surface здесь нет.
  { fg: "fg", bg: "highlight", minLc: 75, note: "body text on annotation highlight" },
  { fg: "fg", bg: "highlight-active", minLc: 75, note: "body text on active annotation highlight" },
];
// NB: surface-overlay — полупрозрачный слой; APCAcontrast напрямую его не меряет.
// Контент модалок рендерится на surface-raised поверх overlay → покрыто парой fg на surface-raised.
