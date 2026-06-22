import * as THREE from "three";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("three/addons/controls/OrbitControls.js", () => ({
  OrbitControls: class {
    enableDamping = true;
    enableRotate = true;
    mouseButtons: Record<string, unknown> = {};
    target = { set: vi.fn() };
    update = vi.fn();
    addEventListener = vi.fn();
    dispose = vi.fn();
  },
}));
vi.mock("three", async (importActual) => {
  const actual = await importActual<typeof import("three")>();
  class FakeWebGLRenderer {
    domElement = {} as HTMLCanvasElement;
    setClearColor = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

import type { GraphRenderModel } from "../types";

import { ThreeGraphRenderer } from "./three-graph-renderer";

function fakeCanvas(): HTMLCanvasElement {
  const et = new EventTarget();
  return Object.assign(et, {
    clientWidth: 100,
    clientHeight: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  }) as unknown as HTMLCanvasElement;
}

function model(): GraphRenderModel {
  return {
    count: 2,
    positions: new Float32Array([0, 0, 0, 10, 0, 0]),
    colors: new Float32Array([1, 0, 0, 0, 1, 0]),
    ids: ["a", "b"],
    edges: new Float32Array([0, 0, 0, 10, 0, 0]),
    edgeAlphas: new Float32Array([1, 1]),
    bounds: { min: [0, 0, 0], max: [10, 0, 0] },
  };
}

// Достать меш рёбер из приватной сцены (тонкий доступ для проверки слоя).
function lineSegments(r: ThreeGraphRenderer): THREE.LineSegments | undefined {
  const scene = (r as unknown as { scene: THREE.Scene }).scene;
  return scene.children.find((c): c is THREE.LineSegments => c instanceof THREE.LineSegments);
}

describe("ThreeGraphRenderer edges layer", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("setModel строит LineSegments из model.edges", () => {
    const r = new ThreeGraphRenderer();
    r.mount(fakeCanvas());
    r.setModel(model());
    const seg = lineSegments(r);
    expect(seg).toBeDefined();
    const pos = seg?.geometry.getAttribute("position");
    expect(pos?.count).toBe(2); // 2 вершины = 1 ребро
    r.destroy();
  });

  it("повторный setModel пересобирает рёбра (нет дубля в сцене)", () => {
    const r = new ThreeGraphRenderer();
    r.mount(fakeCanvas());
    r.setModel(model());
    r.setModel(model());
    const scene = (r as unknown as { scene: THREE.Scene }).scene;
    const segs = scene.children.filter((c) => c instanceof THREE.LineSegments);
    expect(segs.length).toBe(1);
    r.destroy();
  });

  it("пустые рёбра (edges.length===0) → НЕ добавляет LineSegments; прежний меш убран/освобождён", () => {
    const r = new ThreeGraphRenderer();
    r.mount(fakeCanvas());
    // Сначала модель с ребром — меш есть.
    r.setModel(model());
    const prev = lineSegments(r);
    expect(prev).toBeDefined();
    if (!prev) throw new Error("ожидался меш рёбер после первой модели");
    const disposeSpy = vi.spyOn(prev.geometry, "dispose");
    // Затем модель без рёбер — слой обязан исчезнуть, прежний меш — освобождён.
    const empty: GraphRenderModel = { ...model(), edges: new Float32Array(), edgeAlphas: new Float32Array() };
    r.setModel(empty);
    expect(lineSegments(r)).toBeUndefined();
    expect(disposeSpy).toHaveBeenCalled();
    r.destroy();
  });

  it("клик по узлу → onPick(node.id) через базовый picking", () => {
    const r = new ThreeGraphRenderer();
    const canvas = fakeCanvas();
    r.mount(canvas);
    r.setModel(model());
    const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    vi.spyOn(r, "getViewProjection").mockReturnValue(IDENTITY);
    const cb = vi.fn();
    r.onPick(cb);
    // точка "a" в центре мира → экранный центр (50,50) при identity vp на 100×100.
    canvas.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 50, clientY: 50 }));
    canvas.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: 50, clientY: 50 }));
    expect(cb).toHaveBeenCalledWith("a");
    r.destroy();
  });
});
