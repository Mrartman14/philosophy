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

import { ThreeMapRenderer } from "./three-map-renderer";

function fakeCanvas(): HTMLCanvasElement {
  // Реальный EventTarget — mount() теперь навешивает pointer-слушатели,
  // поэтому фейку нужны add/removeEventListener (плюс размеры/rect для resize/pick).
  const et = new EventTarget();
  return Object.assign(et, {
    clientWidth: 100,
    clientHeight: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  }) as unknown as HTMLCanvasElement;
}
interface WithControls {
  controls: { enableDamping: boolean } | null;
}

describe("ThreeMapRenderer.setReducedMotion", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("вызов до mount не бросает (controls ещё нет)", () => {
    const r = new ThreeMapRenderer();
    expect(() => { r.setReducedMotion(true); r.setReducedMotion(false); }).not.toThrow();
  });

  it("после mount applyMode выставляет controls.enableDamping = !reduce", () => {
    const r = new ThreeMapRenderer();
    r.setReducedMotion(true);   // флаг до mount → applyMode применит его
    r.mount(fakeCanvas());
    const controls = (r as unknown as WithControls).controls;
    expect(controls?.enableDamping).toBe(false);

    r.setReducedMotion(false);  // рантайм-переключение
    expect(controls?.enableDamping).toBe(true);
    r.destroy();
  });

  it("setMode пере-создаёт controls, но сохраняет enableDamping=false при reduce", () => {
    const r = new ThreeMapRenderer();
    r.setReducedMotion(true);
    r.mount(fakeCanvas());
    // applyMode внутри setMode создаёт НОВЫЙ OrbitControls — флаг reduce должен дожить.
    r.setMode("3d");
    const controls = (r as unknown as WithControls).controls; // перечитать после пере-создания
    expect(controls?.enableDamping).toBe(false);
    r.destroy();
  });
});

// Фейковый canvas с реальной шиной событий + rect.
function pickCanvas(): HTMLCanvasElement {
  const et = new EventTarget();
  return Object.assign(et, {
    clientWidth: 200,
    clientHeight: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
  }) as unknown as HTMLCanvasElement;
}

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function model1() {
  // одна точка в центре мира → экранный центр (100,50) при identity vp.
  return {
    count: 1,
    positions: new Float32Array([0, 0, 0]),
    colors: new Float32Array([1, 1, 1]),
    ids: ["pt-A"],
    docs: ["doc-1"],
    bounds: { min: [-1, -1, -1] as [number, number, number], max: [1, 1, 1] as [number, number, number] },
    clusters: [],
  };
}

function down(c: HTMLCanvasElement, x: number, y: number) {
  c.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: x, clientY: y }));
}
function up(c: HTMLCanvasElement, x: number, y: number) {
  c.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: x, clientY: y }));
}

describe("ThreeMapRenderer.onPick", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("клик по точке → cb(point.id)", () => {
    const r = new ThreeMapRenderer();
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

  it("клик в пустоту → cb(null)", () => {
    const r = new ThreeMapRenderer();
    const canvas = pickCanvas();
    r.mount(canvas);
    r.setModel(model1());
    vi.spyOn(r, "getViewProjection").mockReturnValue(IDENTITY);
    const cb = vi.fn();
    r.onPick(cb);
    down(canvas, 10, 10);
    up(canvas, 10, 10);
    expect(cb).toHaveBeenCalledWith(null);
    r.destroy();
  });

  it("драг (смещение > порога) НЕ триггерит pick", () => {
    const r = new ThreeMapRenderer();
    const canvas = pickCanvas();
    r.mount(canvas);
    r.setModel(model1());
    vi.spyOn(r, "getViewProjection").mockReturnValue(IDENTITY);
    const cb = vi.fn();
    r.onPick(cb);
    down(canvas, 100, 50);
    up(canvas, 140, 80); // ушёл далеко → это пан/орбита, не клик
    expect(cb).not.toHaveBeenCalled();
    r.destroy();
  });
});
