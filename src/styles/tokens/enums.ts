// Единый источник значений настраиваемых осей. Импортится моделью токенов,
// клиентским parseAppearance (appearance-cookie.ts) и серверной Zod-схемой.
export const THEMES = ["light", "dark", "system"] as const;
// "auto" (default) follows the OS prefers-contrast; "normal"/"high" are explicit
// user choices (explicit "normal" opts out of the OS more-contrast boost).
export const CONTRASTS = ["auto", "normal", "high"] as const;
export const DENSITIES = ["comfortable", "compact"] as const;
export const FONTS = ["sans", "legible", "serif"] as const;
export const TEXT_SIZES = ["sm", "md", "lg", "xl"] as const;

export type Theme = (typeof THEMES)[number];
export type Contrast = (typeof CONTRASTS)[number];
export type Density = (typeof DENSITIES)[number];
export type FontChoice = (typeof FONTS)[number];
export type TextSize = (typeof TEXT_SIZES)[number];
