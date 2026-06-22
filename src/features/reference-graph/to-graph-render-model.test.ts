/* eslint-disable testing-library/render-result-naming-convention --
   toGraphRenderModel — доменная нормализация, не RTL render(); правило ложно матчит «render» в имени. */
// src/features/reference-graph/to-graph-render-model.test.ts
import { describe, it, expect } from "vitest";

import { toGraphRenderModel, edgeAlpha } from "./to-graph-render-model";
import type { GraphData } from "./types";

describe("toGraphRenderModel — узлы", () => {
  it("маппит coords→positions, id→ids", () => {
    const data: GraphData = {
      dims: 3,
      nodes: [
        { id: "d1", type: "document", coords: [1, 2, 3] },
        { id: "g1", type: "glossary", coords: [4, 5, 6] },
      ],
      edges: [],
    };
    const m = toGraphRenderModel(data);
    expect(m.count).toBe(2);
    expect(Array.from(m.positions)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(m.ids).toEqual(["d1", "g1"]);
  });

  it("document и glossary окрашены разными тонами; узел без type — нейтральный", () => {
    const data: GraphData = {
      nodes: [
        { id: "d", type: "document", coords: [0, 0, 0] },
        { id: "g", type: "glossary", coords: [0, 0, 0] },
        { id: "u", coords: [0, 0, 0] }, // type отсутствует → нейтральный цвет (оставшийся fallback)
      ],
      edges: [],
    };
    const m = toGraphRenderModel(data);
    const doc = Array.from(m.colors.slice(0, 3));
    const glo = Array.from(m.colors.slice(3, 6));
    const unk = Array.from(m.colors.slice(6, 9));
    expect(doc).not.toEqual(glo);
    expect(unk).not.toEqual(doc);
    expect(unk).not.toEqual(glo);
  });

  it("dims<3 кладёт z=0", () => {
    const data: GraphData = { dims: 2, nodes: [{ id: "a", type: "document", coords: [7, 8] }], edges: [] };
    const m = toGraphRenderModel(data);
    expect(Array.from(m.positions)).toEqual([7, 8, 0]);
  });

  it("bounds из контракта; фолбэк — расчёт из точек при отсутствии", () => {
    const withB = toGraphRenderModel({
      nodes: [{ id: "a", type: "document", coords: [0, 0, 0] }],
      bounds: { min: [-2, -2, -2], max: [2, 2, 2] },
      edges: [],
    });
    expect(withB.bounds).toEqual({ min: [-2, -2, -2], max: [2, 2, 2] });

    const noB = toGraphRenderModel({
      nodes: [
        { id: "a", type: "document", coords: [-1, -1, -1] },
        { id: "b", type: "document", coords: [3, 3, 3] },
      ],
      edges: [],
    });
    expect(noB.bounds.min).toEqual([-1, -1, -1]);
    expect(noB.bounds.max).toEqual([3, 3, 3]);
  });
});

describe("toGraphRenderModel — рёбра", () => {
  const data: GraphData = {
    nodes: [
      { id: "a", type: "document", coords: [0, 0, 0] },
      { id: "b", type: "document", coords: [10, 0, 0] },
    ],
    edges: [
      { source: { id: "a" }, target: { id: "b" }, weight: 1 },
      { source: { id: "a" }, target: { id: "ghost" }, weight: 1 }, // неразрешимое → пропуск
    ],
  };

  it("разрешённое ребро → 6 чисел (2 вершины × xyz) по координатам узлов", () => {
    const m = toGraphRenderModel(data);
    expect(Array.from(m.edges)).toEqual([0, 0, 0, 10, 0, 0]);
  });

  it("неразрешимое ребро (id вне набора) молча пропущено", () => {
    const m = toGraphRenderModel(data);
    expect(m.edges.length).toBe(6); // только первое ребро
    expect(m.edgeAlphas.length).toBe(2); // альфа на вершину
  });
});

describe("edgeAlpha", () => {
  it("больший weight → больше альфы, в пределах [мин,1]", () => {
    expect(edgeAlpha(1)).toBeGreaterThan(edgeAlpha(0.1));
    expect(edgeAlpha(100)).toBeLessThanOrEqual(1);
    expect(edgeAlpha(0)).toBeGreaterThan(0);
    expect(edgeAlpha(undefined)).toBeGreaterThan(0);
  });
});

describe("toGraphRenderModel — устойчивость", () => {
  it("пустой/malformed граф не бросает", () => {
    expect(() => toGraphRenderModel({})).not.toThrow();
    const empty = toGraphRenderModel({});
    expect(empty.count).toBe(0);
    expect(empty.positions.length).toBe(0);
    expect(empty.edges.length).toBe(0);
    expect(empty.edgeAlphas.length).toBe(0);
    expect(empty.bounds).toEqual({ min: [-1, -1, -1], max: [1, 1, 1] });

    // узлы без id/coords, ребро на узлы без id — без падений и без вершин ребра.
    const malformed = toGraphRenderModel({
      nodes: [{}, { coords: [1] }],
      edges: [{ source: {}, target: {} }, { weight: 5 }],
    });
    expect(malformed.count).toBe(2);
    expect(Array.from(malformed.positions)).toEqual([0, 0, 0, 1, 0, 0]);
    expect(malformed.edges.length).toBe(0);
  });
});
