import { apcach, apcachToCss, crToBg, maxChroma } from "apcach";

export type ThemeMode = "light" | "dark";

export const BACKDROP: Record<ThemeMode, { bg: string; bgSubtle: string; bgRaised: string }> = {
  light: { bg: "oklch(0.96 0.012 80)", bgSubtle: "oklch(0.90 0.016 80)", bgRaised: "oklch(0.985 0.008 80)" },
  dark:  { bg: "oklch(0.21 0.018 250)", bgSubtle: "oklch(0.27 0.02 250)", bgRaised: "oklch(0.25 0.02 250)" },
};

export const HUE = {
  neutral: { h: 80,  c: 0.012 },
  accent:  { h: 70,  c: 0.14 },
  link:    { h: 250, c: 0.13 },
  danger:  { h: 27,  c: 0.2 },
  success: { h: 149, c: 0.16 },
  warning: { h: 75,  c: 0.16 },
  info:    { h: 250, c: 0.12 },
} as const;

/** oklch-цвет с |Lc| ≈ targetLc против фона; maxChroma() держит результат в gamut. */
export function deriveOn(
  bgOklch: string, targetLc: number, hue: number, chroma: number,
  dir: "lighter" | "darker" | "auto" = "auto",
): string {
  const color = apcach(crToBg(bgOklch, targetLc, "apca", dir), maxChroma(chroma), hue, 100, "srgb");
  return apcachToCss(color, "oklch");
}
