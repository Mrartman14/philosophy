import type { Density, FontChoice, TextSize } from "./enums";

export type TypeStep = "2xs" | "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

export const TYPE_SCALE: Record<TypeStep, { size: string; line: string }> = {
  "2xs": { size: "0.6875rem", line: "1rem" },
  xs:    { size: "0.75rem",   line: "1rem" },
  sm:    { size: "0.875rem",  line: "1.25rem" },
  base:  { size: "1rem",      line: "1.5rem" },
  lg:    { size: "1.125rem",  line: "1.75rem" },
  xl:    { size: "1.25rem",   line: "1.75rem" },
  "2xl": { size: "1.5rem",    line: "2rem" },
  "3xl": { size: "1.875rem",  line: "2.25rem" },
  "4xl": { size: "2.25rem",   line: "2.5rem" },
};
export const RADIUS = { sm: "0.25rem", md: "0.5rem", lg: "0.75rem", full: "9999px" } as const;
export const SHADOW = {
  sm: "0 1px 2px 0 oklch(0% 0 0 / 0.05)",
  md: "0 4px 6px -1px oklch(0% 0 0 / 0.1), 0 2px 4px -2px oklch(0% 0 0 / 0.1)",
  lg: "0 10px 15px -3px oklch(0% 0 0 / 0.1), 0 4px 6px -4px oklch(0% 0 0 / 0.1)",
} as const;
export const Z = { base: 0, dropdown: 10, sticky: 20, overlay: 30, modal: 40, toast: 50 } as const;
export const DURATION = { fast: "120ms", base: "200ms", slow: "320ms" } as const;

export const DENSITY: Record<Density, { controlH: Record<"sm"|"md"|"lg", string>; padX: string; padY: string; stack: string }> = {
  comfortable: { controlH: { sm: "2rem", md: "2.5rem", lg: "3rem" }, padX: "0.75rem", padY: "0.5rem", stack: "1rem" },
  compact:     { controlH: { sm: "1.75rem", md: "2.25rem", lg: "2.75rem" }, padX: "0.5rem", padY: "0.375rem", stack: "0.75rem" },
};

export const FONT_STACKS: Record<FontChoice, string> = {
  sans: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  // legible: латиница — Atkinson, кириллица — Geist-фоллбек (у Atkinson нет cyrillic)
  legible: "var(--font-atkinson), var(--font-geist-sans), sans-serif",
  serif: "var(--font-serif), ui-serif, Georgia, serif",
};
export const TEXT_SCALE: Record<TextSize, number> = { sm: 0.9, md: 1, lg: 1.125, xl: 1.25 };
