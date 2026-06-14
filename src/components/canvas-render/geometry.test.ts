// src/components/canvas-render/geometry.test.ts
import { describe, it, expect } from "vitest";

import { boundingBox, sidePoint, boxBorderIntersection, edgePath } from "./geometry";
import type { RenderNode } from "./types";

const node = (over: Partial<RenderNode> = {}): RenderNode => ({
  id: "n", type: "shape", x: 0, y: 0, width: 100, height: 50, shapeKind: "rect", ...over,
});

describe("boundingBox", () => {
  it("пустой массив → нулевой бокс", () => {
    expect(boundingBox([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });
  it("один узел", () => {
    expect(boundingBox([node({ x: 10, y: 20, width: 100, height: 50 })])).toEqual({
      minX: 10, minY: 20, maxX: 110, maxY: 70,
    });
  });
  it("два узла — объединение", () => {
    const r = boundingBox([
      node({ x: 0, y: 0, width: 50, height: 50 }),
      node({ x: 100, y: 80, width: 40, height: 40 }),
    ]);
    expect(r).toEqual({ minX: 0, minY: 0, maxX: 140, maxY: 120 });
  });
});

describe("sidePoint", () => {
  const n = node({ x: 0, y: 0, width: 100, height: 50 });
  it("top → центр верхней грани", () => { expect(sidePoint(n, "top")).toEqual({ x: 50, y: 0 }); });
  it("right → центр правой грани", () => { expect(sidePoint(n, "right")).toEqual({ x: 100, y: 25 }); });
  it("bottom → центр нижней грани", () => { expect(sidePoint(n, "bottom")).toEqual({ x: 50, y: 50 }); });
  it("left → центр левой грани", () => { expect(sidePoint(n, "left")).toEqual({ x: 0, y: 25 }); });
});

describe("boxBorderIntersection", () => {
  const n = node({ x: 0, y: 0, width: 100, height: 100 }); // центр (50,50)
  it("луч вправо пересекает правую грань", () => {
    const p = boxBorderIntersection(n, { x: 200, y: 50 });
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(50);
  });
  it("луч вверх пересекает верхнюю грань", () => {
    const p = boxBorderIntersection(n, { x: 50, y: -100 });
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(0);
  });
  it("цель в центре → возвращает центр (без NaN)", () => {
    const p = boxBorderIntersection(n, { x: 50, y: 50 });
    expect(Number.isNaN(p.x)).toBe(false);
    expect(Number.isNaN(p.y)).toBe(false);
  });
});

describe("edgePath", () => {
  const a = node({ id: "a", x: 0, y: 0, width: 100, height: 50 });
  const b = node({ id: "b", x: 200, y: 0, width: 100, height: 50 });
  it("с явными сторонами соединяет указанные грани", () => {
    const { d, mid } = edgePath(a, b, "right", "left");
    expect(d).toContain("M 100 25"); // правая грань a = (100,25)
    expect(d).toContain("200 25");   // левая грань b при x=200 = (200,25)
    expect(mid.x).toBeCloseTo(150);
    expect(mid.y).toBeCloseTo(25);
  });
  it("без сторон — от границы к границе (не NaN)", () => {
    const { d, mid } = edgePath(a, b, undefined, undefined);
    expect(d.startsWith("M ")).toBe(true);
    expect(Number.isNaN(mid.x)).toBe(false);
  });
});
