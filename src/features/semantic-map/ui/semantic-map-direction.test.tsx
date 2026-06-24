import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Рендерер замокан целиком — тест проверяет ТОЛЬКО JSX-изоляцию направления,
// без реального WebGL/three (по образцу semantic-map-view.test.tsx).
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
  setReducedMotion: vi.fn(),
  getCamera: vi.fn(() => null),
  applyCamera: vi.fn(),
  onSettle: vi.fn(),
  destroy: vi.fn(),
};
vi.mock("../renderer", () => ({
  ThreeMapRenderer: vi.fn(function () {
    return rendererInstance;
  }),
  projectToScreen: vi.fn(() => ({ visible: false, x: 0, y: 0 })),
}));
vi.mock("../to-render-model", () => ({
  toRenderModel: vi.fn(() => ({
    ids: ["pt-A"],
    docs: ["doc-1"],
    positions: new Float32Array([0, 0, 0]),
    clusters: [],
    count: 1,
    bounds: { min: [0, 0, 0], max: [1, 1, 1] },
  })),
}));
vi.mock("../actions", () => ({
  getMapPointDetails: vi.fn(),
}));
vi.mock("./map-point-panel", () => ({
  MapPointPanel: () => <div data-testid="point-panel" />,
}));
vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));
vi.mock("@/components/appearance", () => ({ useReducedMotion: () => false }));

import SemanticMapView from "./semantic-map-view";

const DATA = {} as Parameters<typeof SemanticMapView>[0]["data"];
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

describe("3D-изоляция направления (карта)", () => {
  it("canvas+labels под dir=ltr, а оверлей-панель — снаружи (зеркалится)", () => {
    const { container } = render(
      <div dir="rtl" style={{ height: 400 }}>
        <SemanticMapView data={DATA} initialView={NO_VIEW} />
      </div>,
    );

    // Изолирующая обёртка несёт dir=ltr и содержит сам canvas. Это структурный
    // (DOM-топология) тест: обёртка/canvas без роли/лейбла, RTL-запросом не достать.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- структурная обёртка без роли (прецедент: idempotency-field.test.tsx)
    const isolated = container.querySelector("[data-scene-canvas]");
    expect(isolated?.getAttribute("dir")).toBe("ltr");
    // eslint-disable-next-line testing-library/no-node-access -- проверяем вложенность canvas в изоляцию
    expect(isolated?.querySelector("canvas")).not.toBeNull();

    // НЕГАТИВ: оверлей-тогл (.end-3) НЕ должен сидеть внутри dir=ltr изоляции —
    // оверлеи зеркалятся вместе со страницей.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- класс-селектор оверлея, роли нет
    const toggleHost = container.querySelector(".end-3, [class*='end-3']");
    expect(toggleHost).not.toBeNull();
    // eslint-disable-next-line testing-library/no-node-access -- closest() проверяет, что оверлей вне изоляции
    expect(toggleHost?.closest("[data-scene-canvas]")).toBeNull();
  });
});
