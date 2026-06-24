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
  getCamera: vi.fn(() => null),
  applyCamera: vi.fn(),
  onSettle: vi.fn(),
  destroy: vi.fn(),
};
vi.mock("./three-graph-renderer", () => ({
  ThreeGraphRenderer: vi.fn(function () {
    return rendererInstance;
  }),
}));
// Общие шеллы/хелперы scene-3d — тонкие заглушки.
vi.mock("@/components/scene-3d", () => ({
  SceneCanvasIsolation: ({ children }: { children: React.ReactNode }) => (
    <div data-scene-canvas dir="ltr">{children}</div>
  ),
  SceneModeToggle: () => <div data-testid="mode-toggle" />,
  SceneRegionLabels: () => <div data-testid="region-labels" />,
  projectToScreen: () => ({ visible: false, x: 0, y: 0 }),
  // Заглушка камера-URL хука: режим "2d", wireCamera — no-op. Навигацию/pick не трогает.
  useCameraUrlSync: () => ({
    mode: "2d",
    setMode: vi.fn(),
    modeRef: { current: "2d" },
    wireCamera: vi.fn(),
  }),
}));
// Модель: два узла (тип во view берётся из data.nodes, а не из модели).
vi.mock("../to-graph-render-model", () => ({
  toGraphRenderModel: vi.fn(() => ({
    count: 2,
    positions: new Float32Array([0, 0, 0, 1, 1, 1]),
    colors: new Float32Array(6),
    ids: ["a", "b"],
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

// data.nodes — источник type для typeById: "a"=document (навигируем), "b" без type (undefined → no-op).
const DATA: Parameters<typeof GraphView>[0]["data"] = {
  nodes: [
    { id: "a", type: "document", coords: [0, 0, 0] },
    { id: "b", coords: [1, 1, 1] },
  ],
  edges: [],
};
// «Нет URL-состояния» ParsedView: mode=null → fallback на readSavedMode, camera=null → без restore.
const NO_VIEW = { mode: null, camera: null };

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
    render(<GraphView data={DATA} initialView={NO_VIEW} />);
    expect(rendererInstance.onPick).toHaveBeenCalled();
  });

  it("клик по document-узлу → router.push(/documents/{id})", () => {
    render(<GraphView data={DATA} initialView={NO_VIEW} />);
    getPickCb()("a");
    expect(push).toHaveBeenCalledWith("/documents/a");
  });

  it("клик по узлу без type → навигации нет (href=null)", () => {
    render(<GraphView data={DATA} initialView={NO_VIEW} />);
    getPickCb()("b");
    expect(push).not.toHaveBeenCalled();
  });

  it("клик в пустоту (null) → навигации нет", () => {
    render(<GraphView data={DATA} initialView={NO_VIEW} />);
    getPickCb()(null);
    expect(push).not.toHaveBeenCalled();
  });
});
