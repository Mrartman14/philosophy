import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Рендерер замокан целиком — тест проверяет ТОЛЬКО JSX-изоляцию направления,
// без реального WebGL/three (по образцу semantic-map-direction.test.tsx).
const rendererInstance = {
  mount: vi.fn(),
  setModel: vi.fn(),
  setMode: vi.fn(),
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
vi.mock("../to-graph-render-model", () => ({
  toGraphRenderModel: vi.fn(() => ({
    positions: new Float32Array([0, 0, 0]),
    count: 1,
  })),
}));
// SceneModeToggle (оверлей-тогл) НЕ мокаем — он должен реально отрендериться в
// .end-3, иначе негатив-проверка (тогл вне dir=ltr) была бы бессмысленной.
vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));
vi.mock("@/components/appearance", () => ({ useReducedMotion: () => false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import GraphView from "./graph-view";

const DATA = {
  nodes: [{ id: "n-A", type: "document", title: "A", degree: 1 }],
  edges: [],
} as unknown as Parameters<typeof GraphView>[0]["data"];
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

describe("3D-изоляция направления (граф)", () => {
  it("canvas под dir=ltr, а оверлей-тогл — снаружи (зеркалится)", () => {
    const { container } = render(
      <div dir="rtl" style={{ height: 400 }}>
        <GraphView data={DATA} initialView={NO_VIEW} />
      </div>,
    );

    // Изолирующая обёртка несёт dir=ltr и содержит сам canvas. Структурный
    // (DOM-топология) тест: обёртка/canvas без роли/лейбла, RTL-запросом не достать.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- структурная обёртка без роли (прецедент: semantic-map-direction.test.tsx)
    const isolated = container.querySelector("[data-scene-canvas]");
    expect(isolated?.getAttribute("dir")).toBe("ltr");
    // eslint-disable-next-line testing-library/no-node-access -- проверяем вложенность canvas в изоляцию
    expect(isolated?.querySelector("canvas")).not.toBeNull();

    // НЕГАТИВ: оверлей-тогл (.end-3, реально отрендерен) НЕ должен сидеть внутри
    // dir=ltr изоляции — оверлеи зеркалятся вместе со страницей.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- класс-селектор оверлея, роли нет
    const toggleHost = container.querySelector(".end-3, [class*='end-3']");
    expect(toggleHost).not.toBeNull();
    // eslint-disable-next-line testing-library/no-node-access -- closest() проверяет, что оверлей вне изоляции
    expect(toggleHost?.closest("[data-scene-canvas]")).toBeNull();
  });
});
