// src/features/canvas/editor/render-map.test.ts
import { describe, it, expect } from "vitest";
import { canvasDataToRenderData } from "./render-map";
import type { CanvasData } from "../types";

describe("canvasDataToRenderData", () => {
  it("пустой граф", () => {
    expect(canvasDataToRenderData({ nodes: [], edges: [] })).toEqual({ nodes: [], edges: [] });
  });
  it("undefined → пустой", () => {
    expect(canvasDataToRenderData(undefined)).toEqual({ nodes: [], edges: [] });
  });
  it("мапит text/shape/entity_ref и ребро", () => {
    const data: CanvasData = {
      nodes: [
        { id: "n1", type: "text", x: 1, y: 2, width: 100, height: 40, text: "hi" },
        { id: "n2", type: "shape", x: 5, y: 6, width: 80, height: 80, shape_kind: "ellipse" },
        { id: "n3", type: "entity_ref", x: 0, y: 0, width: 120, height: 60, entity_type: "document", entity_id: "d1" },
      ],
      edges: [{ id: "e1", from_node: "n1", to_node: "n2", from_side: "right", to_side: "left", label: "x", style: "dashed", end: "arrow" }],
    };
    const r = canvasDataToRenderData(data);
    expect(r.nodes[0]).toEqual({ id: "n1", type: "text", x: 1, y: 2, width: 100, height: 40, text: "hi", shapeKind: undefined, entityType: undefined, entityId: undefined });
    expect(r.nodes[1]?.shapeKind).toBe("ellipse");
    expect(r.nodes[2]?.entityType).toBe("document");
    expect(r.edges[0]).toEqual({ id: "e1", fromNode: "n1", toNode: "n2", fromSide: "right", toSide: "left", label: "x", style: "dashed", end: "arrow" });
  });
  it("пропускает узлы без id/type и рёбра без концов", () => {
    const data: CanvasData = {
      nodes: [{ type: "text", x: 0, y: 0, width: 10, height: 10, text: "x" } as NonNullable<CanvasData["nodes"]>[number]],
      edges: [{ id: "e1", from_node: "n1" } as NonNullable<CanvasData["edges"]>[number]],
    };
    const r = canvasDataToRenderData(data);
    expect(r.nodes).toHaveLength(0);
    expect(r.edges).toHaveLength(0);
  });
});
