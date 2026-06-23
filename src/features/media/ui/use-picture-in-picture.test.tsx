import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePictureInPicture } from "./use-picture-in-picture";

// --- Фейк video со СТАНДАРТНЫМ PiP (Chrome/десктоп-Safari) ---
class FakeStandardVideo {
  disablePictureInPicture = false;
  requestPictureInPicture = vi.fn(() => Promise.resolve({}));
  private listeners = new Map<string, Set<EventListener>>();
  addEventListener(type: string, cb: EventListener): void {
    const set = this.listeners.get(type) ?? new Set<EventListener>();
    this.listeners.set(type, set);
    set.add(cb);
  }
  removeEventListener(type: string, cb: EventListener): void {
    this.listeners.get(type)?.delete(cb);
  }
  emit(type: string): void {
    this.listeners.get(type)?.forEach((cb) => {
      cb(new Event(type));
    });
  }
  hasListeners(type: string): boolean {
    return (this.listeners.get(type)?.size ?? 0) > 0;
  }
}

// --- Фейк video с WEBKIT PiP (iOS Safari): нет стандартного API ---
class FakeWebkitVideo {
  webkitPresentationMode = "inline";
  webkitSupportsPresentationMode = vi.fn((m: string) => m === "picture-in-picture");
  webkitSetPresentationMode = vi.fn((m: string) => {
    this.webkitPresentationMode = m;
  });
  private listeners = new Map<string, Set<EventListener>>();
  addEventListener(type: string, cb: EventListener): void {
    const set = this.listeners.get(type) ?? new Set<EventListener>();
    this.listeners.set(type, set);
    set.add(cb);
  }
  removeEventListener(type: string, cb: EventListener): void {
    this.listeners.get(type)?.delete(cb);
  }
  emit(type: string): void {
    this.listeners.get(type)?.forEach((cb) => {
      cb(new Event(type));
    });
  }
}

// --- Фейк video БЕЗ PiP вообще (хук рано выходит, методы не нужны) ---
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- намеренно пустой stub: видео без PiP-API
class FakeNoVideo {}

function refFor(el: unknown) {
  return { current: el as HTMLMediaElement };
}

function setDocPiP(opts: { enabled: boolean; element?: unknown }): void {
  Object.defineProperty(document, "pictureInPictureEnabled", {
    configurable: true,
    value: opts.enabled,
  });
  Object.defineProperty(document, "pictureInPictureElement", {
    configurable: true,
    value: opts.element ?? null,
  });
}

const exitMock = vi.fn(() => Promise.resolve());

beforeEach(() => {
  Object.defineProperty(document, "exitPictureInPicture", {
    configurable: true,
    value: exitMock,
  });
});

afterEach(() => {
  Reflect.deleteProperty(document, "pictureInPictureEnabled");
  Reflect.deleteProperty(document, "pictureInPictureElement");
  Reflect.deleteProperty(document, "exitPictureInPicture");
  vi.clearAllMocks();
});

describe("usePictureInPicture — поддержка", () => {
  it("стандартный API → supported=true", () => {
    setDocPiP({ enabled: true });
    const { result } = renderHook(() => usePictureInPicture(refFor(new FakeStandardVideo())));
    expect(result.current.supported).toBe(true);
  });

  it("только webkit (iOS, document.pictureInPictureEnabled=false) → supported=true", () => {
    setDocPiP({ enabled: false });
    const { result } = renderHook(() => usePictureInPicture(refFor(new FakeWebkitVideo())));
    expect(result.current.supported).toBe(true);
  });

  it("нет ни одного API → supported=false", () => {
    setDocPiP({ enabled: false });
    const { result } = renderHook(() => usePictureInPicture(refFor(new FakeNoVideo())));
    expect(result.current.supported).toBe(false);
  });
});

describe("usePictureInPicture — toggle", () => {
  it("стандарт, не активно → requestPictureInPicture", () => {
    setDocPiP({ enabled: true, element: null });
    const el = new FakeStandardVideo();
    const { result } = renderHook(() => usePictureInPicture(refFor(el)));
    act(() => {
      result.current.toggle();
    });
    expect(el.requestPictureInPicture).toHaveBeenCalledTimes(1);
  });

  it("стандарт, активно → exitPictureInPicture", () => {
    const el = new FakeStandardVideo();
    setDocPiP({ enabled: true, element: el });
    const { result } = renderHook(() => usePictureInPicture(refFor(el)));
    act(() => {
      result.current.toggle();
    });
    expect(exitMock).toHaveBeenCalledTimes(1);
  });

  it("webkit, не активно → webkitSetPresentationMode('picture-in-picture')", () => {
    setDocPiP({ enabled: false });
    const el = new FakeWebkitVideo();
    const { result } = renderHook(() => usePictureInPicture(refFor(el)));
    act(() => {
      result.current.toggle();
    });
    expect(el.webkitSetPresentationMode).toHaveBeenCalledWith("picture-in-picture");
  });

  it("webkit, активно → webkitSetPresentationMode('inline')", () => {
    setDocPiP({ enabled: false });
    const el = new FakeWebkitVideo();
    el.webkitPresentationMode = "picture-in-picture";
    const { result } = renderHook(() => usePictureInPicture(refFor(el)));
    act(() => {
      result.current.toggle();
    });
    expect(el.webkitSetPresentationMode).toHaveBeenCalledWith("inline");
  });

  it("отклонение requestPictureInPicture не роняет", () => {
    setDocPiP({ enabled: true, element: null });
    const el = new FakeStandardVideo();
    el.requestPictureInPicture = vi.fn(() => Promise.reject(new Error("denied")));
    const { result } = renderHook(() => usePictureInPicture(refFor(el)));
    expect(() => {
      act(() => {
        result.current.toggle();
      });
    }).not.toThrow();
  });
});

describe("usePictureInPicture — active и cleanup", () => {
  it("active синхронизируется по enterpictureinpicture", () => {
    const el = new FakeStandardVideo();
    setDocPiP({ enabled: true, element: null });
    const { result } = renderHook(() => usePictureInPicture(refFor(el)));
    expect(result.current.active).toBe(false);
    setDocPiP({ enabled: true, element: el });
    act(() => {
      el.emit("enterpictureinpicture");
    });
    expect(result.current.active).toBe(true);
  });

  it("active синхронизируется по webkitpresentationmodechanged", () => {
    setDocPiP({ enabled: false });
    const el = new FakeWebkitVideo();
    const { result } = renderHook(() => usePictureInPicture(refFor(el)));
    expect(result.current.active).toBe(false);
    el.webkitPresentationMode = "picture-in-picture";
    act(() => {
      el.emit("webkitpresentationmodechanged");
    });
    expect(result.current.active).toBe(true);
  });

  it("unmount снимает слушатели", () => {
    setDocPiP({ enabled: true, element: null });
    const el = new FakeStandardVideo();
    const { unmount } = renderHook(() => usePictureInPicture(refFor(el)));
    unmount();
    expect(el.hasListeners("enterpictureinpicture")).toBe(false);
    expect(el.hasListeners("leavepictureinpicture")).toBe(false);
  });
});
