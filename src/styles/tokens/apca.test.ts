import { describe, it, expect } from "vitest";
import { APCAcontrast, sRGBtoY } from "apca-w3";
import { parse, converter } from "culori";
import { TOKENS, CONTRAST_PAIRS } from "./index";

const toRgb = converter("rgb");
function lc(fg: string, bg: string): number {
  const f = toRgb(parse(fg))!, b = toRgb(parse(bg))!;
  const k = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));
  return APCAcontrast(sRGBtoY([k(f.r), k(f.g), k(f.b)]), sRGBtoY([k(b.r), k(b.g), k(b.b)]));
}
const COMBOS = ["light-normal","light-high","dark-normal","dark-high"] as const;

describe("APCA guardrail", () => {
  for (const combo of COMBOS) {
    const layer = TOKENS.colorLayers[combo];
    for (const p of CONTRAST_PAIRS) {
      it(`[${combo}] ${p.fg} on ${p.bg} ≥ Lc ${p.minLc} (${p.note})`, () => {
        expect(Math.abs(lc(layer[p.fg], layer[p.bg]))).toBeGreaterThanOrEqual(p.minLc);
      });
    }
  }
  it("self-check: rejects surface-on-surface (Lc≈0)", () => {
    const bg = TOKENS.colorLayers["light-normal"].surface;
    expect(Math.abs(lc(bg, bg))).toBeLessThan(75);
  });
});
