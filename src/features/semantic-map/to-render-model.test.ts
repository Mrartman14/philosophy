/* eslint-disable testing-library/render-result-naming-convention --
   toRenderModel — доменная нормализация MapData→RenderModel, не RTL render(); правило ложно матчит «render» в имени. */
// src/features/semantic-map/to-render-model.test.ts
import { describe, it, expect } from "vitest";

import { toRenderModel } from "./to-render-model";
import type { MapData } from "./types";

function baseData(overrides: Partial<MapData> = {}): MapData {
  return {
    layout_version: "v1",
    dims: 3,
    bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
    clusters: [{ id: 0, label: "A", color: "#ffffff", size: 1 }],
    points: [{ type: "document", id: "x", coords: [0.5, -0.5, 0.25], cluster: 0 }],
    ...overrides,
  };
}

describe("toRenderModel", () => {
  it("раскладывает координаты в Float32Array", () => {
    const result = toRenderModel(baseData());
    expect(result.count).toBe(1);
    expect(Array.from(result.positions)).toEqual([0.5, -0.5, 0.25]);
    expect(result.ids).toEqual(["x"]);
  });

  it("неизвестный type сворачивается в слот other, не падает", () => {
    const result = toRenderModel(
      baseData({ points: [{ type: "podcast", id: "p", coords: [0, 0, 0], cluster: 0 }] }),
    );
    expect(result.typeTable).toContain("other");
    // noUncheckedIndexedAccess: result.typeCodes[0] → number | undefined
    const code = result.typeCodes[0];
    expect(code).toBeDefined();
    if (code !== undefined) {
      expect(result.typeTable[code]).toBe("other");
    }
  });

  it("отсутствие cluster.color → цвет из палитры (валидный RGB)", () => {
    const result = toRenderModel(
      baseData({ clusters: [{ id: 0, label: "A" }] }),
    );
    expect(result.colors).toHaveLength(3);
    // noUncheckedIndexedAccess: result.colors[0] → number | undefined
    const r = result.colors[0];
    expect(r).toBeDefined();
    if (r !== undefined) {
      expect(r >= 0 && r <= 1).toBe(true);
    }
    // noUncheckedIndexedAccess: result.clusters[0] → RenderCluster | undefined
    expect(result.clusters[0]?.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("dims=2 → z обнуляется", () => {
    const result = toRenderModel(
      baseData({ dims: 2, points: [{ type: "document", id: "y", coords: [0.1, 0.2], cluster: 0 }] }),
    );
    // positions — Float32Array: 0.1/0.2 НЕ точны в float32 → toBeCloseTo, не toEqual.
    const pos = Array.from(result.positions);
    // noUncheckedIndexedAccess: pos[0] → number | undefined
    const x = pos[0];
    const y = pos[1];
    const z = pos[2];
    expect(x).toBeDefined();
    expect(y).toBeDefined();
    expect(z).toBeDefined();
    if (x !== undefined) expect(x).toBeCloseTo(0.1, 6);
    if (y !== undefined) expect(y).toBeCloseTo(0.2, 6);
    expect(z).toBe(0);
  });

  it("без bounds — считает из точек", () => {
    const data = baseData({
      points: [
        { type: "document", id: "a", coords: [-2, 0, 0], cluster: 0 },
        { type: "document", id: "b", coords: [3, 1, -1], cluster: 0 },
      ],
    });
    // @ts-expect-error — намеренно убираем bounds для проверки фолбэка
    delete data.bounds;
    const result = toRenderModel(data);
    expect(result.bounds.min[0]).toBe(-2);
    expect(result.bounds.max[0]).toBe(3);
  });

  it("вычисляет центроид кластера", () => {
    const result = toRenderModel(
      baseData({
        points: [
          { type: "document", id: "a", coords: [0, 0, 0], cluster: 0 },
          { type: "document", id: "b", coords: [2, 2, 2], cluster: 0 },
        ],
      }),
    );
    // noUncheckedIndexedAccess: result.clusters[0] → RenderCluster | undefined
    expect(result.clusters[0]?.centroid).toEqual([1, 1, 1]);
  });
});
