import { describe, it, expect } from "vitest";

import { weightedCentroid } from "./weighted-centroid";

describe("weightedCentroid", () => {
  it("пустой вход → null", () => {
    expect(weightedCentroid([])).toBeNull();
  });

  it("одна точка → она сама", () => {
    expect(weightedCentroid([{ pos: [1, 2, 3], weight: 0.5 }])).toEqual([1, 2, 3]);
  });

  it("взвешивает по весу", () => {
    const c = weightedCentroid([
      { pos: [0, 0, 0], weight: 1 },
      { pos: [10, 0, 0], weight: 3 },
    ]);
    expect(c).not.toBeNull();
    expect(c?.[0]).toBeCloseTo(7.5, 6); // (0*1 + 10*3) / 4
  });

  it("нулевые/отрицательные веса → равновес (среднее)", () => {
    const c = weightedCentroid([
      { pos: [0, 0, 0], weight: 0 },
      { pos: [4, 0, 0], weight: 0 },
    ]);
    expect(c?.[0]).toBeCloseTo(2, 6);
  });
});
