import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
  // ids НЕ пустой — у wiring есть что выбрать по клику (renderer.onPick → "pt-A").
  toRenderModel: vi.fn(() => ({
    ids: ["pt-A"],
    docs: ["doc-1"],
    positions: new Float32Array([0, 0, 0]),
    clusters: [],
    count: 1,
    bounds: { min: [0, 0, 0], max: [1, 1, 1] },
  })),
}));
// Action замокана — view импортит "use server"-ручку в client-компонент (граница Next).
// Резолвит известную деталь для "pt-A", чтобы проверить ветку success.
const getMapPointDetails = vi.fn((_ids: string[]) =>
  Promise.resolve({
    success: true as const,
    data: { "pt-A": { doc: "doc-1", chunk_ord: 3, snippet: "hello" } },
  }),
);
vi.mock("../actions", () => ({
  getMapPointDetails: (ids: string[]) => getMapPointDetails(ids),
}));
// Панель замокана простым маркером — проверяем видимость без реального kit.
vi.mock("./map-point-panel", () => ({
  MapPointPanel: ({ detail }: { detail: { doc?: string } }) => (
    <div data-testid="point-panel">{detail.doc}</div>
  ),
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

describe("SemanticMapView point-pick → fetch → panel wiring", () => {
  type PickCb = (id: string | null) => void;
  // Достать колбэк, переданный в renderer.onPick из lifecycle-эффекта [model].
  function getPickCb(): PickCb {
    const calls = rendererInstance.onPick.mock.calls as PickCb[][];
    const cb = calls.at(-1)?.[0];
    if (typeof cb !== "function") throw new Error("onPick callback not registered");
    return cb;
  }

  it("subscribes onPick inside the lifecycle effect", () => {
    render(<SemanticMapView data={DATA} />);
    expect(rendererInstance.onPick).toHaveBeenCalled();
  });

  it("on pick(id) fetches detail and shows the panel; pick(null) hides it", async () => {
    render(<SemanticMapView data={DATA} />);
    const pick = getPickCb();

    // Клик по точке → fetch одной детали → панель видна с doc из ответа.
    pick("pt-A");
    expect(getMapPointDetails).toHaveBeenCalledWith(["pt-A"]);
    // findBy* ждёт флаша микротаска action.then → setSelected → ре-рендер.
    expect(await screen.findByTestId("point-panel")).toHaveTextContent("doc-1");

    // Клик «в пустоту» (null) → панель скрыта, без нового fetch.
    getMapPointDetails.mockClear();
    pick(null);
    await waitFor(() => {
      expect(screen.queryByTestId("point-panel")).toBeNull();
    });
    expect(getMapPointDetails).not.toHaveBeenCalled();
  });

  it("resets the selection when the data (model) changes", async () => {
    const { rerender } = render(<SemanticMapView data={DATA} />);
    getPickCb()("pt-A");
    expect(await screen.findByTestId("point-panel")).toBeInTheDocument();

    // Новая ссылка data → пере-маунт рендерера → выбор сбрасывается, панель уходит.
    rerender(<SemanticMapView data={{ ...DATA } as typeof DATA} />);
    await waitFor(() => {
      expect(screen.queryByTestId("point-panel")).toBeNull();
    });
  });
});
