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

  it("вырожденный отрезок ребра (start==end) → ветка len2===0 (hypot до точки)", () => {
    // o1 и o2 полностью совпадают (оба в (0,0), 100×60). Ребро left↔left:
    // sidePoint(left) обоих = (0,30) → edgeSegment даёт start==end=(0,30),
    // т.е. len2===0 в distToSegment → Math.hypot(p, start).
    const o1 = node("o1", 0, 0);
    const o2 = node("o2", 0, 0);
    const byId = new Map<string, RenderNode>([["o1", o1], ["o2", o2]]);
    const deg: RenderEdge[] = [
      { id: "deg", fromNode: "o1", toNode: "o2", fromSide: "left", toSide: "left" },
    ];
    // (0,31): дист от (0,30) = 1 ≤ 6 → попадание
    expect(hitTestEdge({ x: 0, y: 31 }, deg, byId, EDGE_HIT)).toBe("deg");
    // (0,40): дист от (0,30) = 10 > 6 → мимо
    expect(hitTestEdge({ x: 0, y: 40 }, deg, byId, EDGE_HIT)).toBeNull();
  });

  it("верхнее из перекрывающихся рёбер (с конца массива) → последнее", () => {
    // e1 и e2 — одинаковая геометрия a→b (right→left). Точка на линии → e2 (последнее).
    const overlap: RenderEdge[] = [
      { id: "e1", fromNode: "a", toNode: "b", fromSide: "right", toSide: "left" },
      { id: "e2", fromNode: "a", toNode: "b", fromSide: "right", toSide: "left" },
    ];
    expect(hitTestEdge({ x: 200, y: 30 }, overlap, nodesById, EDGE_HIT)).toBe("e2");
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

  it("верхний из перекрывающихся узлов выигрывает (последний в массиве = верхний z-order)", () => {
    // a: 0..100×0..60; top: 40..140×30..90; точка (60,45) в обоих.
    const top = node("top", 40, 30);
    const byId = new Map<string, RenderNode>([["a", a], ["top", top]]);
    // nodes:[a, top] → последний (top) выигрывает
    expect(hitTest({ x: 60, y: 45 }, { nodes: [a, top], edges: [], nodesById: byId, singleSelectedNodeId: null }))
      .toEqual({ kind: "node", nodeId: "top" });
    // зеркально nodes:[top, a] → та же точка → "a" (теперь a последний)
    expect(hitTest({ x: 60, y: 45 }, { nodes: [top, a], edges: [], nodesById: byId, singleSelectedNodeId: null }))
      .toEqual({ kind: "node", nodeId: "a" });
  });

  it("ручка-середина стороны детектится как resize-handle (не порт/узел)", () => {
    // Средняя ручка "e" узла a = (x+w, y+h/2) = (100,30). Ручки проверяются до
    // узла → resize-handle. Зоны ручек и портов НЕ пересекаются by-construction:
    // PORT_OFFSET=14 > 2×tol=12 (порт "right" вынесен на (114,30)), поэтому
    // «точка в зоне и ручки, и порта» невозможна.
    expect(hitTest({ x: 100, y: 30 }, { ...base, singleSelectedNodeId: "a" }))
      .toEqual({ kind: "resize-handle", nodeId: "a", handle: "e" });
  });
});
