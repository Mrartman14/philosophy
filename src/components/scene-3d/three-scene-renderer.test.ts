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

import type { SceneRenderModel } from "./scene-render-model";
import { ThreeSceneRenderer } from "./three-scene-renderer";

function pickCanvas(): HTMLCanvasElement {
  const et = new EventTarget();
  return Object.assign(et, {
    clientWidth: 200,
    clientHeight: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
  }) as unknown as HTMLCanvasElement;
}

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function model1(): SceneRenderModel {
  return {
    count: 1,
    positions: new Float32Array([0, 0, 0]),
    colors: new Float32Array([1, 1, 1]),
    ids: ["pt-A"],
    bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
  };
}

function down(c: HTMLCanvasElement, x: number, y: number) {
  c.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: x, clientY: y }));
}
function up(c: HTMLCanvasElement, x: number, y: number) {
  c.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: x, clientY: y }));
}

interface WithControls {
  controls: { enableDamping: boolean } | null;
}

describe("ThreeSceneRenderer base scaffolding", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("setReducedMotion до mount не бросает; после mount правит damping", () => {
    const r = new ThreeSceneRenderer();
    expect(() => { r.setReducedMotion(true); }).not.toThrow();
    r.mount(pickCanvas());
    expect((r as unknown as WithControls).controls?.enableDamping).toBe(false);
    r.setReducedMotion(false);
    expect((r as unknown as WithControls).controls?.enableDamping).toBe(true);
    r.destroy();
  });

  it("клик по точке → onPick(point.id)", () => {
    const r = new ThreeSceneRenderer();
    const canvas = pickCanvas();
    r.mount(canvas);
    r.setModel(model1());
    vi.spyOn(r, "getViewProjection").mockReturnValue(IDENTITY);
    const cb = vi.fn();
    r.onPick(cb);
    down(canvas, 100, 50);
    up(canvas, 100, 50);
    expect(cb).toHaveBeenCalledWith("pt-A");
    r.destroy();
  });

  it("драг (смещение > порога) НЕ триггерит pick", () => {
    const r = new ThreeSceneRenderer();
    const canvas = pickCanvas();
    r.mount(canvas);
    r.setModel(model1());
    vi.spyOn(r, "getViewProjection").mockReturnValue(IDENTITY);
    const cb = vi.fn();
    r.onPick(cb);
    down(canvas, 100, 50);
    up(canvas, 140, 80);
    expect(cb).not.toHaveBeenCalled();
    r.destroy();
  });

  it("onModelApplied вызывается после setModel (хук для подклассов)", () => {
    const hook = vi.fn();
    class Probe extends ThreeSceneRenderer {
      protected override onModelApplied(): void { hook(); }
    }
    const r = new Probe();
    r.mount(pickCanvas());
    r.setModel(model1());
    expect(hook).toHaveBeenCalledOnce();
    r.destroy();
  });

  it("onModelApplied вызывается ДО fitToBounds в setModel (marker читает bounds-scale из готовой модели)", () => {
    const order: string[] = [];
    class OrderProbe extends ThreeSceneRenderer {
      protected override onModelApplied(): void { order.push("onModelApplied"); }
      override fitToBounds(): void {
        order.push("fitToBounds");
        super.fitToBounds();
      }
    }
    const r = new OrderProbe();
    r.mount(pickCanvas());
    // mount→applyMode зовёт fitToBounds ещё до модели — измеряем только порядок ВНУТРИ setModel.
    order.length = 0;
    r.setModel(model1());
    // В setModel хук пересборки слоёв обязан отработать раньше подгонки камеры.
    expect(order.indexOf("onModelApplied")).toBeLessThan(order.indexOf("fitToBounds"));
    r.destroy();
  });
});
