// src/components/scene-3d/compute-bounds.test.ts
import { describe, it, expect } from "vitest";

import { computeBounds } from "./compute-bounds";

describe("computeBounds", () => {
  it("проходит присланные финитные bounds насквозь (3 оси)", () => {
    const r = computeBounds(
      { min: [-2, -3, -4], max: [2, 3, 4] },
      new Float32Array([100, 100, 100]),
      1,
    );
    expect(r).toEqual({ min: [-2, -3, -4], max: [2, 3, 4] });
  });

  it("проходит присланные 2D-bounds насквозь (z дефолтит)", () => {
    const r = computeBounds({ min: [-2, -3], max: [2, 3] }, new Float32Array(0), 0);
    expect(r).toEqual({ min: [-2, -3, -1], max: [2, 3, 1] });
  });

  it("частичный Infinity в присланных bounds → расчёт-из-точек (проверяет ВСЕ оси)", () => {
    // min[0] финитен, но min[1] = Infinity → не доверяем bounds, считаем по точкам.
    const r = computeBounds(
      { min: [0, Infinity], max: [10, -Infinity] },
      new Float32Array([1, 2, 3, 4, 5, 6]),
      2,
    );
    expect(r).toEqual({ min: [1, 2, 3], max: [4, 5, 6] });
  });

  it("вырожденные bounds [±Infinity] → расчёт-из-точек", () => {
    const r = computeBounds(
      { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
      new Float32Array([1, 1, 1, 3, 3, 3]),
      2,
    );
    expect(r).toEqual({ min: [1, 1, 1], max: [3, 3, 3] });
  });

  it("нефинитная координата-точка пропускается (не отравляет min/max)", () => {
    // Вторая точка несёт NaN/Infinity — должна быть проигнорирована покоординатно.
    const positions = new Float32Array([2, 2, 2, NaN, Infinity, -Infinity, 4, 4, 4]);
    const r = computeBounds(undefined, positions, 3);
    expect(r).toEqual({ min: [2, 2, 2], max: [4, 4, 4] });
  });

  it("пустой набор → дефолт [-1,-1,-1]/[1,1,1]", () => {
    expect(computeBounds(undefined, new Float32Array(0), 0)).toEqual({
      min: [-1, -1, -1],
      max: [1, 1, 1],
    });
  });

  it("все координаты нефинитны → дефолт (вырождение)", () => {
    const r = computeBounds(undefined, new Float32Array([NaN, NaN, NaN]), 1);
    expect(r).toEqual({ min: [-1, -1, -1], max: [1, 1, 1] });
  });
});
