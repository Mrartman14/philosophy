// src/features/canvas/editor/hit-test.test.ts
import { describe, it, expect } from "vitest";

import type { RenderNode, RenderEdge } from "@/components/canvas-render";

import { PORT_OFFSET } from "./geometry-editor";
import { hitTest, hitTestEdge, portAtPoint, PORT_HIT, EDGE_HIT } from "./hit-test";

const node = (id: string, x: number, y: number): RenderNode => ({
  id, type: "shape", x, y, width: 100, height: 60, shapeKind: "rect",
});

const a = node("a", 0, 0);   // тело 0..100 × 0..60; центр (50,30)
const b = node("b", 300, 0);
const nodesById = new Map<string, RenderNode>([["a", a], ["b", b]]);
const nodes = [a, b];
const edges: RenderEdge[] = [{ id: "e1", fromNode: "a", toNode: "b", fromSide: "right", toSide: "left" }];
const base = { nodes, edges, nodesById };

describe("hitTestEdge", () => {
  it("точка у линии ребра → id ребра", () => {
    // ребро (100,30)→(300,30); точка (200,31) в пределах допуска
    expect(hitTestEdge({ x: 200, y: 31 }, edges, nodesById, EDGE_HIT)).toBe("e1");
  });
  it("точка вдали от ребра → null", () => {
    expect(hitTestEdge({ x: 200, y: 100 }, edges, nodesById, EDGE_HIT)).toBeNull();
  });
  it("ребро с отсутствующим узлом пропускается", () => {
    const bad: RenderEdge[] = [{ id: "x", fromNode: "a", toNode: "missing" }];
    expect(hitTestEdge({ x: 200, y: 30 }, bad, nodesById, EDGE_HIT)).toBeNull();
  });
});

describe("portAtPoint", () => {
  it("точка у порта стороны → сторона", () => {
    // правая середина (100,30); порт вынесен на (114,30)
    expect(portAtPoint({ x: 114, y: 30 }, a, PORT_OFFSET, PORT_HIT)).toBe("right");
  });
  it("точка вдали от портов → null", () => {
    expect(portAtPoint({ x: 50, y: 30 }, a, PORT_OFFSET, PORT_HIT)).toBeNull();
  });
});

describe("hitTest приоритет", () => {
  it("ручка ресайза побеждает тело узла (одиночное выделение)", () => {
    expect(hitTest({ x: 0, y: 0 }, { ...base, singleSelectedNodeId: "a" }))
      .toEqual({ kind: "resize-handle", nodeId: "a", handle: "nw" });
  });
  it("порт побеждает фон (одиночное выделение)", () => {
    expect(hitTest({ x: 114, y: 30 }, { ...base, singleSelectedNodeId: "a" }))
      .toEqual({ kind: "port", nodeId: "a", side: "right" });
  });
  it("без одиночного выделения ручки/порты не активны → узел", () => {
    expect(hitTest({ x: 0, y: 0 }, { ...base, singleSelectedNodeId: null }))
      .toEqual({ kind: "node", nodeId: "a" });
  });
  it("точка в теле узла → node", () => {
    expect(hitTest({ x: 50, y: 30 }, { ...base, singleSelectedNodeId: null }))
      .toEqual({ kind: "node", nodeId: "a" });
  });
  it("точка на ребре вне узлов → edge", () => {
    expect(hitTest({ x: 200, y: 30 }, { ...base, singleSelectedNodeId: null }))
      .toEqual({ kind: "edge", edgeId: "e1" });
  });
  it("пустое место → background", () => {
    expect(hitTest({ x: 200, y: 200 }, { ...base, singleSelectedNodeId: null }))
      .toEqual({ kind: "background" });
  });
});
