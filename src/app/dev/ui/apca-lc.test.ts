import { APCAcontrast, sRGBtoY } from "apca-w3";
import { describe, it, expect } from "vitest";

import { srgbToY, apcaContrast } from "./apca-lc";

const RGB: [number, number, number][] = [
  [0, 0, 0], [255, 255, 255], [18, 18, 18], [240, 240, 240],
  [10, 80, 200], [200, 30, 40], [120, 120, 120], [0, 128, 96],
];

describe("apca-lc", () => {
  it("srgbToY matches apca-w3", () => {
    for (const c of RGB) expect(srgbToY(c)).toBeCloseTo(sRGBtoY(c), 6);
  });
  it("apcaContrast matches apca-w3 across all pairs", () => {
    for (const fg of RGB) {
      for (const bg of RGB) {
        const mine = apcaContrast(srgbToY(fg), srgbToY(bg));
        const ref = APCAcontrast(sRGBtoY(fg), sRGBtoY(bg));
        expect(Math.abs(mine - ref)).toBeLessThan(0.1);
      }
    }
  });
  it("known signed values (polarity)", () => {
    expect(apcaContrast(srgbToY([0, 0, 0]), srgbToY([255, 255, 255]))).toBeCloseTo(106.04, 0);
    expect(apcaContrast(srgbToY([255, 255, 255]), srgbToY([0, 0, 0]))).toBeCloseTo(-107.88, 0);
  });
});
