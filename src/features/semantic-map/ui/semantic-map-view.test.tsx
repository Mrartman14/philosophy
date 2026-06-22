import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Рендерер замокан целиком — тест проверяет ТОЛЬКО проводку setReducedMotion
// из view, без реального WebGL/three.
const setReducedMotion = vi.fn();
const rendererInstance = {
  mount: vi.fn(),
  setModel: vi.fn(),
  setMode: vi.fn(),
  fitToBounds: vi.fn(),
  resize: vi.fn(),
  getViewProjection: vi.fn(() => null),
  onChange: vi.fn(),
  onPick: vi.fn(),
  setOverlay: vi.fn(),
  setReducedMotion,
  destroy: vi.fn(),
};
vi.mock("../renderer", () => ({
  // `function` (не arrow) — view зовёт `new ThreeMapRenderer()`; конструктор,
  // возвращающий объект, отдаёт общий rendererInstance со spy-методами.
  ThreeMapRenderer: vi.fn(function () {
    return rendererInstance;
  }),
  projectToScreen: vi.fn(() => ({ visible: false, x: 0, y: 0 })),
}));
vi.mock("../to-render-model", () => ({
  toRenderModel: vi.fn(() => ({
    ids: [],
    docs: [],
    positions: new Float32Array(),
    clusters: [],
    count: 0,
    bounds: { min: [0, 0, 0], max: [1, 1, 1] },
  })),
}));
vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));
let reduceValue = false;
vi.mock("@/components/appearance", () => ({ useReducedMotion: () => reduceValue }));

import SemanticMapView from "./semantic-map-view";

// data пустой — toRenderModel замокан и игнорирует содержимое.
const DATA = {} as Parameters<typeof SemanticMapView>[0]["data"];

beforeEach(() => {
  reduceValue = false;
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SemanticMapView reduced-motion wiring", () => {
  it("applies reduce=true to the renderer on mount", () => {
    reduceValue = true;
    render(<SemanticMapView data={DATA} />);
    expect(setReducedMotion).toHaveBeenCalledWith(true);
  });

  it("applies reduce=false to the renderer on mount", () => {
    reduceValue = false;
    render(<SemanticMapView data={DATA} />);
    expect(setReducedMotion).toHaveBeenCalledWith(false);
  });

  it("re-applies when the motion preference changes", () => {
    const { rerender } = render(<SemanticMapView data={DATA} />);
    expect(setReducedMotion).toHaveBeenLastCalledWith(false);
    reduceValue = true;
    rerender(<SemanticMapView data={DATA} />);
    expect(setReducedMotion).toHaveBeenLastCalledWith(true);
  });

  it("re-applies the current reduce after a data change (renderer re-created)", () => {
    reduceValue = true;
    const { rerender } = render(<SemanticMapView data={DATA} />);
    setReducedMotion.mockClear();
    // Новая ссылка data → useMemo пересчитывает model → [model]-эффект пере-маунтит рендерер.
    rerender(<SemanticMapView data={{ ...DATA } as typeof DATA} />);
    expect(setReducedMotion).toHaveBeenCalledWith(true);
  });
});
