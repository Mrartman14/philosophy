// src/features/canvas/editor/geometry-editor.test.ts
import { describe, it, expect } from "vitest";

import type { RenderNode } from "@/components/canvas-render";

import { pointInRect, hitTestNode, resizeHandles, applyResize, marqueeHits, handleAtPoint } from "./geometry-editor";

const node = (over: Partial<RenderNode> = {}): RenderNode => ({
  id: "n", type: "shape", x: 0, y: 0, width: 100, height: 50, shapeKind: "rect", ...over,
});

describe("pointInRect", () => {
  const n = node({ x: 10, y: 10, width: 100, height: 50 });
  it("точка внутри", () => { expect(pointInRect({ x: 50, y: 30 }, n)).toBe(true); });
  it("точка снаружи", () => { expect(pointInRect({ x: 5, y: 5 }, n)).toBe(false); });
  it("на границе считается внутри", () => { expect(pointInRect({ x: 10, y: 10 }, n)).toBe(true); });
});

describe("hitTestNode — последний (верхний) узел под точкой", () => {
  const a = node({ id: "a", x: 0, y: 0, width: 100, height: 100 });
  const b = node({ id: "b", x: 50, y: 50, width: 100, height: 100 });
  it("возвращает верхний (последний в массиве) при перекрытии", () => {
    expect(hitTestNode({ x: 60, y: 60 }, [a, b])?.id).toBe("b");
  });
  it("возвращает a вне пересечения", () => {
    expect(hitTestNode({ x: 10, y: 10 }, [a, b])?.id).toBe("a");
  });
  it("null если мимо всех", () => {
    expect(hitTestNode({ x: 500, y: 500 }, [a, b])).toBeNull();
  });
});

describe("resizeHandles", () => {
  const n = node({ x: 0, y: 0, width: 100, height: 50 });
  it("возвращает 8 ручек", () => {
    expect(Object.keys(resizeHandles(n))).toHaveLength(8);
  });
  it("nw в левом-верхнем углу, se в правом-нижнем", () => {
    const h = resizeHandles(n);
    expect(h.nw).toEqual({ x: 0, y: 0 });
    expect(h.se).toEqual({ x: 100, y: 50 });
    expect(h.n).toEqual({ x: 50, y: 0 });
  });
});

describe("handleAtPoint", () => {
  const n = node({ x: 0, y: 0, width: 100, height: 50 });
  it("находит ручку se рядом с углом", () => {
    expect(handleAtPoint({ x: 100, y: 50 }, n, 6)).toBe("se");
  });
  it("null вдали от ручек", () => {
    expect(handleAtPoint({ x: 50, y: 25 }, n, 6)).toBeNull();
  });
});

describe("applyResize", () => {
  const n = node({ x: 0, y: 0, width: 100, height: 50 });
  it("se увеличивает width/height", () => {
    const r = applyResize(n, "se", 20, 10);
    expect(r).toEqual({ x: 0, y: 0, width: 120, height: 60 });
  });
  it("nw двигает x/y и уменьшает размер", () => {
    const r = applyResize(n, "nw", 10, 5);
    expect(r).toEqual({ x: 10, y: 5, width: 90, height: 45 });
  });
  it("клампит минимальный размер 20x20", () => {
    const r = applyResize(n, "se", -200, -200);
    expect(r.width).toBeGreaterThanOrEqual(20);
    expect(r.height).toBeGreaterThanOrEqual(20);
  });
  it("e меняет только width", () => {
    const r = applyResize(n, "e", 30, 999);
    expect(r.width).toBe(130);
    expect(r.height).toBe(50);
    expect(r.y).toBe(0);
  });
});

describe("marqueeHits", () => {
  const a = node({ id: "a", x: 0, y: 0, width: 40, height: 40 });
  const b = node({ id: "b", x: 200, y: 200, width: 40, height: 40 });
  it("захватывает узлы, пересекающие рамку", () => {
    const hits = marqueeHits({ x: -10, y: -10, width: 100, height: 100 }, [a, b]);
    expect(hits).toEqual(["a"]);
  });
  it("рамка вокруг обоих", () => {
    const hits = marqueeHits({ x: -10, y: -10, width: 300, height: 300 }, [a, b]);
    expect(hits).toEqual(["a", "b"]);
  });
});
