// src/features/canvas/editor/coords.test.ts
import { describe, it, expect } from "vitest";

import { screenToWorld, worldToScreen, applyZoomAtPoint, snapToGrid, snapPoint } from "./coords";
import type { Viewport } from "./editor-types";

const vp = (over: Partial<Viewport> = {}): Viewport => ({ x: 0, y: 0, zoom: 1, ...over });

describe("screenToWorld / worldToScreen — обратимость", () => {
  it("zoom=1, нет смещения — экран == мир", () => {
    expect(screenToWorld({ x: 10, y: 20 }, vp())).toEqual({ x: 10, y: 20 });
    expect(worldToScreen({ x: 10, y: 20 }, vp())).toEqual({ x: 10, y: 20 });
  });
  it("со смещением вьюпорта", () => {
    const v = vp({ x: 5, y: 7, zoom: 1 });
    expect(screenToWorld({ x: 0, y: 0 }, v)).toEqual({ x: 5, y: 7 });
    expect(worldToScreen({ x: 5, y: 7 }, v)).toEqual({ x: 0, y: 0 });
  });
  it("с зумом 2x", () => {
    const v = vp({ x: 0, y: 0, zoom: 2 });
    // экранная точка (20,20) при zoom 2 → мировая (10,10)
    expect(screenToWorld({ x: 20, y: 20 }, v)).toEqual({ x: 10, y: 10 });
    expect(worldToScreen({ x: 10, y: 10 }, v)).toEqual({ x: 20, y: 20 });
  });
  it("round-trip произвольной точки", () => {
    const v = vp({ x: 3.5, y: -2.25, zoom: 1.5 });
    const w = screenToWorld({ x: 123, y: 45 }, v);
    const back = worldToScreen(w, v);
    expect(back.x).toBeCloseTo(123);
    expect(back.y).toBeCloseTo(45);
  });
});

describe("applyZoomAtPoint", () => {
  it("точка под курсором остаётся на месте после зума", () => {
    const v = vp({ x: 0, y: 0, zoom: 1 });
    const screenPoint = { x: 100, y: 100 };
    const worldBefore = screenToWorld(screenPoint, v);
    const v2 = applyZoomAtPoint(v, 2, screenPoint.x, screenPoint.y);
    const worldAfter = screenToWorld(screenPoint, v2);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y);
    expect(v2.zoom).toBeCloseTo(2);
  });
  it("зум клампится в [0.1, 8]", () => {
    const v = vp({ zoom: 1 });
    expect(applyZoomAtPoint(v, 100, 0, 0).zoom).toBeLessThanOrEqual(8);
    expect(applyZoomAtPoint(v, 0.0001, 0, 0).zoom).toBeGreaterThanOrEqual(0.1);
  });
});

describe("snapToGrid / snapPoint", () => {
  it("округляет к ближайшим 8px когда включено", () => {
    expect(snapToGrid(11, true)).toBe(8);
    expect(snapToGrid(13, true)).toBe(16);
    expect(snapToGrid(-3, true)).toBe(0);
  });
  it("не трогает значение когда выключено (только int-округление)", () => {
    expect(snapToGrid(11.4, false)).toBe(11);
    expect(snapToGrid(11.6, false)).toBe(12);
  });
  it("snapPoint снапит обе координаты", () => {
    expect(snapPoint({ x: 11, y: 13 }, true)).toEqual({ x: 8, y: 16 });
  });
});
