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
  return { clientWidth: 100, clientHeight: 100 } as unknown as HTMLCanvasElement;
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
});
