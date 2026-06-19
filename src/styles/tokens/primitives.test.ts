import { APCAcontrast, sRGBtoY } from "apca-w3";
import { parse, converter, inGamut } from "culori";
import { describe, it, expect } from "vitest";

import { BACKDROP, HUE, deriveOn } from "./primitives";

const toRgb = converter("rgb");
const rgbInGamut = inGamut("rgb");
function y(oklch: string): number {
  const c = toRgb(parse(oklch));
  if (!c) throw new Error(`y: unparseable colour (${oklch})`);
  const k = (x: number | undefined) => Math.max(0, Math.min(255, Math.round((x ?? 0) * 255)));
  return sRGBtoY([k(c.r), k(c.g), k(c.b)]);
}

describe("primitives", () => {
  it("light backdrop is a warm light beige", () => {
    const c = toRgb(parse(BACKDROP.light.bg));
    if (!c) throw new Error("toRgb returned undefined for light backdrop");
    expect(Math.min(c.r ?? 0, c.g ?? 0, c.b ?? 0)).toBeGreaterThan(0.85);
  });
  it("deriveOn hits target Lc on light bg and stays in sRGB gamut", () => {
    const fg = deriveOn(BACKDROP.light.bg, 75, HUE.neutral.h, HUE.neutral.c, "darker");
    expect(Math.abs(APCAcontrast(y(fg), y(BACKDROP.light.bg)))).toBeGreaterThanOrEqual(70);
    expect(rgbInGamut(parse(fg))).toBe(true);
  });
  it("chromatic accent stays in gamut via maxChroma", () => {
    const accent = deriveOn(BACKDROP.light.bg, 45, HUE.accent.h, HUE.accent.c, "darker");
    expect(rgbInGamut(parse(accent))).toBe(true);
  });
  it("deriveOn on dark bg yields lighter text (negative raw Lc)", () => {
    const fg = deriveOn(BACKDROP.dark.bg, 75, HUE.neutral.h, HUE.neutral.c, "lighter");
    expect(APCAcontrast(y(fg), y(BACKDROP.dark.bg))).toBeLessThan(0);
  });
});
