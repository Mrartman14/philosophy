import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Enhanced-mock: реальный target с x/y/z + реестр слушателей + dispatch (для Task 3).
vi.mock("three/addons/controls/OrbitControls.js", () => ({
  OrbitControls: class {
    enableDamping = true;
    enableRotate = true;
    mouseButtons: Record<string, unknown> = {};
    target = {
      x: 0, y: 0, z: 0,
      set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; },
    };
    listeners: Record<string, (() => void)[] | undefined> = {};
    update = vi.fn();
    addEventListener = (type: string, cb: () => void) => {
      (this.listeners[type] ??= []).push(cb);
    };
    dispatch(type: string) { (this.listeners[type] ?? []).forEach((cb) => { cb(); }); }
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

import type { SceneRenderModel } from "./scene-render-model";
import { ThreeSceneRenderer } from "./three-scene-renderer";

function pickCanvas(): HTMLCanvasElement {
  const et = new EventTarget();
  return Object.assign(et, {
    clientWidth: 200, clientHeight: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
  }) as unknown as HTMLCanvasElement;
}
function model1(): SceneRenderModel {
  return {
    count: 1,
    positions: new Float32Array([0, 0, 0]),
    colors: new Float32Array([1, 1, 1]),
    ids: ["pt-A"],
    bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
  };
}

describe("getCamera/applyCamera", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("getCamera = null до модели и после destroy", () => {
    const r = new ThreeSceneRenderer();
    r.mount(pickCanvas());
    expect(r.getCamera()).toBeNull(); // нет модели
    r.setModel(model1());
    expect(r.getCamera()).not.toBeNull();
    r.destroy();
    expect(r.getCamera()).toBeNull(); // disposed
  });

  it("2D round-trip: applyCamera → getCamera", () => {
    const r = new ThreeSceneRenderer();
    r.mount(pickCanvas());
    r.setModel(model1()); // mode по умолчанию 2d, fit → центр (0,0), zoom 1
    r.applyCamera({ mode: "2d", values: [5, 6, 2] });
    expect(r.getCamera()).toEqual({ mode: "2d", values: [5, 6, 2] });
    r.destroy();
  });

  it("3D round-trip: applyCamera → getCamera", () => {
    const r = new ThreeSceneRenderer();
    r.mount(pickCanvas());
    r.setModel(model1());
    r.setMode("3d");
    r.applyCamera({ mode: "3d", values: [1, 2, 3, 4, 5, 6] });
    expect(r.getCamera()).toEqual({ mode: "3d", values: [1, 2, 3, 4, 5, 6] });
    r.destroy();
  });

  it("mode-guard: applyCamera с чужим режимом — no-op", () => {
    const r = new ThreeSceneRenderer();
    r.mount(pickCanvas());
    r.setModel(model1()); // 2d
    r.applyCamera({ mode: "2d", values: [5, 6, 2] });
    r.applyCamera({ mode: "3d", values: [9, 9, 9, 9, 9, 9] }); // игнор
    expect(r.getCamera()).toEqual({ mode: "2d", values: [5, 6, 2] });
    r.destroy();
  });
});
