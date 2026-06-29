// src/features/canvas/editor/coords.test.ts
import { describe, it, expect } from "vitest";

import { screenToWorld, worldToScreen, applyZoomAtPoint, fitViewport, centerViewport, rulerTicks, snapToGrid, snapPoint, viewBoxFromViewport } from "./coords";
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

describe("fitViewport", () => {
  it("квадратный bbox без отступа точно заполняет поверхность по центру", () => {
    const v = fitViewport({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, { width: 200, height: 200 }, 1);
    expect(v).toEqual({ x: 0, y: 0, zoom: 2 });
    // углы bbox ложатся в углы поверхности
    expect(worldToScreen({ x: 0, y: 0 }, v)).toEqual({ x: 0, y: 0 });
    expect(worldToScreen({ x: 100, y: 100 }, v)).toEqual({ x: 200, y: 200 });
  });
  it("узкий bbox центрируется по короткой оси (зум по лимитирующей стороне)", () => {
    const v = fitViewport({ minX: 0, minY: 0, maxX: 200, maxY: 100 }, { width: 200, height: 200 }, 1);
    expect(v.zoom).toBeCloseTo(1);
    // центр bbox (100,50) → центр поверхности (100,100)
    expect(worldToScreen({ x: 100, y: 50 }, v)).toEqual({ x: 100, y: 100 });
  });
  it("отступ pad<1 оставляет поля", () => {
    const v = fitViewport({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, { width: 200, height: 200 }, 0.8);
    expect(v.zoom).toBeCloseTo(1.6);
  });
  it("зум зажат в [0.1, 8]", () => {
    expect(fitViewport({ minX: 0, minY: 0, maxX: 100000, maxY: 100000 }, { width: 200, height: 200 }).zoom).toBeGreaterThanOrEqual(0.1);
    expect(fitViewport({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, { width: 2000, height: 2000 }).zoom).toBeLessThanOrEqual(8);
  });
  it("вырожденный bbox или нулевой размер → дефолтный вьюпорт", () => {
    expect(fitViewport({ minX: 0, minY: 0, maxX: 0, maxY: 0 }, { width: 200, height: 200 })).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(fitViewport({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, { width: 0, height: 0 })).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});

describe("centerViewport", () => {
  it("ставит мировую точку в центр поверхности, зум не меняет", () => {
    const v = centerViewport({ x: 100, y: 50 }, { width: 200, height: 200 }, 2);
    expect(v.zoom).toBe(2);
    expect(worldToScreen({ x: 100, y: 50 }, v)).toEqual({ x: 100, y: 100 });
  });
});

describe("rulerTicks", () => {
  it("шаг — «красивое» число, экранный интервал ≈ target (зум 1)", () => {
    // target 80, zoom 1 → niceStep(80) = 100 → засечки 0,100,200
    const ts = rulerTicks(0, 200, 1, 80);
    expect(ts.map((t) => t.world)).toEqual([0, 100, 200]);
    expect(ts.map((t) => t.screen)).toEqual([0, 100, 200]);
  });
  it("первая засечка — ближайшее кратное шага у края (смещённый origin)", () => {
    const ts = rulerTicks(50, 200, 1, 80); // шаг 100, мир 50..250 → 100,200
    expect(ts.map((t) => t.world)).toEqual([100, 200]);
    expect(ts.map((t) => t.screen)).toEqual([50, 150]); // (world-origin)*zoom
  });
  it("адаптивность к зуму: при zoom 2 шаг мельче, экранный интервал держится", () => {
    const ts = rulerTicks(0, 200, 2, 80); // target/zoom=40 → niceStep=50; мир 0..100
    expect(ts.map((t) => t.world)).toEqual([0, 50, 100]);
    expect(ts.map((t) => t.screen)).toEqual([0, 100, 200]); // интервал 100px ≈ target
  });
  it("нулевая длина/зум → пусто", () => {
    expect(rulerTicks(0, 0, 1)).toEqual([]);
    expect(rulerTicks(0, 200, 0)).toEqual([]);
  });
});

describe("viewBoxFromViewport", () => {
  it("строит viewBox из вьюпорта и размера (учитывает zoom)", () => {
    expect(viewBoxFromViewport({ x: 10, y: 20, zoom: 1 }, { width: 800, height: 600 })).toBe("10 20 800 600");
    expect(viewBoxFromViewport({ x: 0, y: 0, zoom: 2 }, { width: 800, height: 600 })).toBe("0 0 400 300");
  });
});
