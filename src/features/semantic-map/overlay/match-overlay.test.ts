// src/features/semantic-map/overlay/match-overlay.test.ts
import { describe, it, expect } from "vitest";

import type { MapOverlay, RenderModel } from "../types";

import { matchOverlay } from "./match-overlay";

// Минимальная модель: матчер читает только ids/docs/positions, но тип требует всё.
function makeModel(
  pts: { id: string; doc: string; pos: [number, number, number] }[],
): RenderModel {
  const positions = new Float32Array(pts.length * 3);
  pts.forEach((p, i) => {
    positions[i * 3] = p.pos[0];
    positions[i * 3 + 1] = p.pos[1];
    positions[i * 3 + 2] = p.pos[2];
  });
  return {
    count: pts.length,
    positions,
    colors: new Float32Array(pts.length * 3),
    ids: pts.map((p) => p.id),
    docs: pts.map((p) => p.doc),
    bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
    clusters: [],
  };
}

function overlay(hits: { id: string; type: string; score: number }[]): MapOverlay {
  return { query: "q", hits };
}

describe("matchOverlay", () => {
  it("матчит точки по doc, а в highlightIds кладёт point.id (не doc)", () => {
    const model = makeModel([
      { id: "p0", doc: "docA", pos: [0, 0, 0] },
      { id: "p1", doc: "docB", pos: [3, 4, 5] },
    ]);
    const result = matchOverlay(model, overlay([{ id: "docA", type: "document", score: 2 }]));
    expect(result.highlightIds).toEqual(new Set(["p0"]));
    expect(result.count).toBe(1);
    expect(result.marker).toEqual([0, 0, 0]);
  });

  it("регрессия chunk-shift: хит по point.id (не doc) НЕ подсвечивает", () => {
    const model = makeModel([{ id: "p0", doc: "docA", pos: [0, 0, 0] }]);
    // Раньше матч шёл по model.ids; теперь хиты несут id документов — id точки матчить нельзя.
    const result = matchOverlay(model, overlay([{ id: "p0", type: "document", score: 1 }]));
    expect(result.count).toBe(0);
    expect(result.highlightIds.size).toBe(0);
    expect(result.marker).toBeNull();
  });

  it("подсвечивает ВСЕ чанки одного документа (взвешенный центроид совпавших)", () => {
    const model = makeModel([
      { id: "p0", doc: "docA", pos: [0, 0, 0] },
      { id: "p1", doc: "docA", pos: [2, 2, 2] },
      { id: "p2", doc: "docB", pos: [9, 9, 9] },
    ]);
    const result = matchOverlay(model, overlay([{ id: "docA", type: "document", score: 1 }]));
    expect(result.highlightIds).toEqual(new Set(["p0", "p1"]));
    expect(result.count).toBe(2);
    expect(result.marker).toEqual([1, 1, 1]);
  });
});
