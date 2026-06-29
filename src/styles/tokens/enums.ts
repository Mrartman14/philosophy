// Единый источник значений настраиваемых осей. Импортится моделью токенов,
// клиентским parseAppearance (appearance-cookie.ts) и серверной Zod-схемой.
export const THEMES = ["light", "dark", "system"] as const;
// "auto" (default) follows the OS prefers-contrast; "normal"/"high" are explicit
// user choices (explicit "normal" opts out of the OS more-contrast boost).
export const CONTRASTS = ["auto", "normal", "high"] as const;
export const DENSITIES = ["comfortable", "compact"] as const;
export const FONTS = ["sans", "legible", "serif"] as const;
export const TEXT_SIZES = ["sm", "md", "lg", "xl"] as const;
// "system" (default) следует OS prefers-reduced-motion; "reduced" форсит
// уменьшение движения; "full" форсит анимации даже при OS reduce.
export const MOTIONS = ["system", "reduced", "full"] as const;
// Выравнивание прозы. ЛОГИЧЕСКИЕ значения (start = по началу строки, в LTR слева,
// в RTL справа) — физические left/right намеренно НЕ вводим, чтобы RTL работал
// сам. "start" (default) — рваный правый край; "justify" — по ширине (opt-in,
// книжный вид; включает переносы, см. content.css).
export const TEXT_ALIGNS = ["start", "justify"] as const;

export type Theme = (typeof THEMES)[number];
export type Contrast = (typeof CONTRASTS)[number];
export type Density = (typeof DENSITIES)[number];
export type FontChoice = (typeof FONTS)[number];
export type TextSize = (typeof TEXT_SIZES)[number];
export type Motion = (typeof MOTIONS)[number];
export type TextAlign = (typeof TEXT_ALIGNS)[number];
