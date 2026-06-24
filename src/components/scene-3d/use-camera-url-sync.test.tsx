// src/components/scene-3d/use-camera-url-sync.test.tsx
// Юнит-тест камера-URL хука: закрывает дыру покрытия — restore/H1/fallback/settle-write/
// mode-write раньше только рендерились во view, но НЕ проверялись.
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import type { CameraState, SceneRenderer } from "./scene-renderer";
import type { ParsedView } from "./url-view";
import { useCameraUrlSync } from "./use-camera-url-sync";

const MODE_KEY = "test-scene:mode";

// Минимальный мок-рендерер — только методы, которые трогает хук.
function makeMockScene() {
  return {
    setMode: vi.fn(),
    getCamera: vi.fn<() => CameraState | null>(() => null),
    applyCamera: vi.fn(),
    onSettle: vi.fn<(cb: () => void) => void>(),
  };
}
type MockScene = ReturnType<typeof makeMockScene>;

// Хук типизирован на SceneRenderer; мок несёт лишь подмножество — каст только для типов теста.
function asRenderer(scene: MockScene): SceneRenderer {
  return scene as unknown as SceneRenderer;
}
function rendererRefOf(scene: MockScene) {
  return { current: asRenderer(scene) };
}

// URL последней записи в history.replaceState (3-й позиционный аргумент).
function lastWrittenUrl(spy: MockInstance<typeof window.history.replaceState>): string {
  return String(spy.mock.calls.at(-1)?.[2]);
}

let replaceState: MockInstance<typeof window.history.replaceState>;

beforeEach(() => {
  window.localStorage.clear();
  // База URL для writeViewToUrl (читает pathname/search/hash); спай — ПОСЛЕ, чтобы эта запись не считалась.
  window.history.replaceState({}, "", "/map");
  replaceState = vi.spyOn(window.history, "replaceState");
});
afterEach(() => {
  replaceState.mockRestore();
  window.localStorage.clear();
});

describe("useCameraUrlSync", () => {
  it("H1: URL-режим бьёт localStorage (и mode, и modeRef стартуют с URL)", () => {
    window.localStorage.setItem(MODE_KEY, "2d");
    const view: ParsedView = { mode: "3d", camera: null };
    const scene = makeMockScene();
    const { result } = renderHook(() => useCameraUrlSync(MODE_KEY, view, rendererRefOf(scene)));

    expect(result.current.mode).toBe("3d");
    expect(result.current.modeRef.current).toBe("3d");
  });

  it("fallback: без URL-режима стартует с сохранённого в localStorage", () => {
    window.localStorage.setItem(MODE_KEY, "3d");
    const view: ParsedView = { mode: null, camera: null };
    const scene = makeMockScene();
    const { result } = renderHook(() => useCameraUrlSync(MODE_KEY, view, rendererRefOf(scene)));

    expect(result.current.mode).toBe("3d");
  });

  it("restore: wireCamera подписывает onSettle и применяет камеру из initialView", () => {
    const view: ParsedView = { mode: "2d", camera: { mode: "2d", values: [1, 2, 3] } };
    const scene = makeMockScene();
    const { result } = renderHook(() => useCameraUrlSync(MODE_KEY, view, rendererRefOf(scene)));

    act(() => {
      result.current.wireCamera(asRenderer(scene));
    });

    expect(scene.applyCamera).toHaveBeenCalledWith({ mode: "2d", values: [1, 2, 3] });
    expect(scene.onSettle).toHaveBeenCalled();
  });

  it("no restore при camera=null: applyCamera не зовётся, onSettle — да", () => {
    const view: ParsedView = { mode: "2d", camera: null };
    const scene = makeMockScene();
    const { result } = renderHook(() => useCameraUrlSync(MODE_KEY, view, rendererRefOf(scene)));

    act(() => {
      result.current.wireCamera(asRenderer(scene));
    });

    expect(scene.applyCamera).not.toHaveBeenCalled();
    expect(scene.onSettle).toHaveBeenCalled();
  });

  it("settle-write: колбэк onSettle пишет осевший вид в URL", () => {
    const view: ParsedView = { mode: "2d", camera: null };
    const scene = makeMockScene();
    const { result } = renderHook(() => useCameraUrlSync(MODE_KEY, view, rendererRefOf(scene)));

    act(() => {
      result.current.wireCamera(asRenderer(scene));
    });
    // Колбэк, переданный в onSettle.
    const settleCb = scene.onSettle.mock.calls.at(-1)?.[0];
    expect(typeof settleCb).toBe("function");

    // Жест осел: getCamera отдаёт новую камеру → settle-колбэк пишет вид в URL.
    scene.getCamera.mockReturnValue({ mode: "2d", values: [4, 5, 6] });
    replaceState.mockClear();
    act(() => {
      settleCb?.();
    });

    expect(replaceState).toHaveBeenCalled();
    const url = lastWrittenUrl(replaceState);
    expect(url).toContain("m=2d");
    expect(url).toContain("c=4"); // первое значение камеры в параметре c
  });

  it("no write на маунте: mode-эффект пропускает первую запись (modeWriteSkip)", () => {
    const view: ParsedView = { mode: "2d", camera: null };
    const scene = makeMockScene();
    scene.getCamera.mockReturnValue({ mode: "2d", values: [7, 8, 9] });
    renderHook(() => useCameraUrlSync(MODE_KEY, view, rendererRefOf(scene)));

    // renderHook без StrictMode — mode-эффект прогоняется один раз и страж глушит запись.
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("mode-write на тогле: setMode → setMode рендерера + персист + запись вида", () => {
    const view: ParsedView = { mode: "2d", camera: null };
    const scene = makeMockScene();
    scene.getCamera.mockReturnValue({ mode: "3d", values: [0, 0, 0, 0, 0, 0] });
    const { result } = renderHook(() => useCameraUrlSync(MODE_KEY, view, rendererRefOf(scene)));

    replaceState.mockClear();
    act(() => {
      result.current.setMode("3d");
    });

    expect(scene.setMode).toHaveBeenCalledWith("3d");
    expect(window.localStorage.getItem(MODE_KEY)).toBe("3d");
    expect(replaceState).toHaveBeenCalled();
    expect(lastWrittenUrl(replaceState)).toContain("m=3d");
  });
});
