// src/features/reference-graph/ui/graph-view.test.tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rendererInstance = {
  mount: vi.fn(),
  setModel: vi.fn(),
  setMode: vi.fn(),
  fitToBounds: vi.fn(),
  resize: vi.fn(),
  getViewProjection: vi.fn(() => null),
  onChange: vi.fn(),
  onPick: vi.fn(),
  setReducedMotion: vi.fn(),
  destroy: vi.fn(),
};
vi.mock("./three-graph-renderer", () => ({
  ThreeGraphRenderer: vi.fn(function () {
    return rendererInstance;
  }),
}));
// Общие шеллы/хелперы scene-3d — тонкие заглушки.
vi.mock("@/components/scene-3d", () => ({
  SceneModeToggle: () => <div data-testid="mode-toggle" />,
  SceneRegionLabels: () => <div data-testid="region-labels" />,
  readSavedMode: () => "2d",
  projectToScreen: () => ({ visible: false, x: 0, y: 0 }),
}));
// Модель: два узла, у "a" известный type=document → href навигируем.
vi.mock("../to-graph-render-model", () => ({
  toGraphRenderModel: vi.fn(() => ({
    count: 2,
    positions: new Float32Array([0, 0, 0, 1, 1, 1]),
    colors: new Float32Array(6),
    ids: ["a", "b"],
    types: ["document", "weird"],
    edges: new Float32Array(),
    edgeAlphas: new Float32Array(),
    bounds: { min: [0, 0, 0], max: [1, 1, 1] },
  })),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));
vi.mock("@/components/appearance", () => ({ useReducedMotion: () => false }));

import GraphView from "./graph-view";

const DATA = {} as Parameters<typeof GraphView>[0]["data"];

beforeEach(() => {
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

describe("GraphView navigation wiring", () => {
  type PickCb = (id: string | null) => void;
  function getPickCb(): PickCb {
    const calls = rendererInstance.onPick.mock.calls as PickCb[][];
    const cb = calls.at(-1)?.[0];
    if (typeof cb !== "function") throw new Error("onPick not registered");
    return cb;
  }

  it("подписывает onPick в lifecycle-эффекте", () => {
    render(<GraphView data={DATA} />);
    expect(rendererInstance.onPick).toHaveBeenCalled();
  });

  it("клик по document-узлу → router.push(/documents/{id})", () => {
    render(<GraphView data={DATA} />);
    getPickCb()("a");
    expect(push).toHaveBeenCalledWith("/documents/a");
  });

  it("клик по узлу с неизвестным type → навигации нет (href=null)", () => {
    render(<GraphView data={DATA} />);
    getPickCb()("b");
    expect(push).not.toHaveBeenCalled();
  });

  it("клик в пустоту (null) → навигации нет", () => {
    render(<GraphView data={DATA} />);
    getPickCb()(null);
    expect(push).not.toHaveBeenCalled();
  });
});
