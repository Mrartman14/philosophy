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
    tree: [{ id: 0, label: "A", color: "#ffffff", size: 1 }],
    points: [{ id: "x", coords: [0.5, -0.5, 0.25], node: 0 }],
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

  it("прокидывает point.doc в docs (ключ матча оверлея), отсутствующий doc → пустая строка", () => {
    const result = toRenderModel(
      baseData({
        points: [
          { id: "p0", coords: [0, 0, 0], node: 0, doc: "docA" },
          { id: "p1", coords: [1, 1, 1], node: 0 },
        ],
      }),
    );
    expect(result.docs).toEqual(["docA", ""]);
  });

  it("отсутствие tree-node.color → цвет из палитры (валидный RGB)", () => {
    const result = toRenderModel(baseData({ tree: [{ id: 0, label: "A" }] }));
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
      baseData({ dims: 2, points: [{ id: "y", coords: [0.1, 0.2], node: 0 }] }),
    );
    // positions — Float32Array: 0.1/0.2 НЕ точны в float32 → toBeCloseTo, не toEqual.
    const pos = Array.from(result.positions);
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
    const m = toRenderModel({
      layout_version: "v1",
      dims: 3,
      tree: [{ id: 0, label: "A", size: 1 }],
      points: [
        { id: "a", coords: [-2, 0, 0], node: 0 },
        { id: "b", coords: [3, 1, -1], node: 0 },
      ],
    });
    expect(m.bounds.min[0]).toBe(-2);
    expect(m.bounds.max[0]).toBe(3);
  });

  it("пустой/частичный ответ (все поля отсутствуют) — не падает", () => {
    const m = toRenderModel({});
    expect(m.count).toBe(0);
    expect(m.clusters).toEqual([]);
    expect(m.bounds.min).toEqual([-1, -1, -1]);
    expect(m.bounds.max).toEqual([1, 1, 1]);
  });

  it("центроид: фоллбек на агрегат точек, если бэк не прислал TreeNode.centroid", () => {
    const result = toRenderModel(
      baseData({
        tree: [{ id: 0, label: "A", size: 1 }],
        points: [
          { id: "a", coords: [0, 0, 0], node: 0 },
          { id: "b", coords: [2, 2, 2], node: 0 },
        ],
      }),
    );
    // noUncheckedIndexedAccess: result.clusters[0] → RenderCluster | undefined
    expect(result.clusters[0]?.centroid).toEqual([1, 1, 1]);
  });

  it("центроид берётся из TreeNode.centroid, когда передан (а не из агрегата точек)", () => {
    const result = toRenderModel(
      baseData({
        tree: [{ id: 0, label: "A", centroid: [5, 5, 5] }],
        points: [{ id: "a", coords: [0, 0, 0], node: 0 }],
      }),
    );
    expect(result.clusters[0]?.centroid).toEqual([5, 5, 5]);
  });
});
