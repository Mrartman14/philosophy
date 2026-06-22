import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMediaSession } from "./use-media-session";

// --- Фейк media-элемента (jsdom не даёт настоящего воспроизведения) ---
class FakeMediaElement {
  currentTime = 0;
  duration = 100;
  playbackRate = 1;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  fastSeek = vi.fn((t: number) => {
    this.currentTime = t;
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

// --- Фейк navigator.mediaSession ---
class FakeMediaSession {
  metadata: unknown = null;
  playbackState = "none";
  handlers = new Map<string, ((d: MediaSessionActionDetails) => void) | null>();
  setActionHandler = vi.fn(
    (action: string, handler: ((d: MediaSessionActionDetails) => void) | null) => {
      this.handlers.set(action, handler);
    },
  );
  setPositionState = vi.fn();
  invoke(action: string, details: Partial<MediaSessionActionDetails> = {}): void {
    this.handlers.get(action)?.(details as MediaSessionActionDetails);
  }
}

class FakeMediaMetadata {
  title: string;
  artist: string;
  artwork: unknown[];
  constructor(init: { title?: string; artist?: string; artwork?: unknown[] }) {
    this.title = init.title ?? "";
    this.artist = init.artist ?? "";
    this.artwork = init.artwork ?? [];
  }
}

let ms: FakeMediaSession;
function installMediaSession(): void {
  ms = new FakeMediaSession();
  Object.defineProperty(navigator, "mediaSession", {
    configurable: true,
    value: ms,
  });
  vi.stubGlobal("MediaMetadata", FakeMediaMetadata);
}

function refFor(el: FakeMediaElement) {
  return { current: el as unknown as HTMLMediaElement };
}

const META = { title: "Бытие и время", artist: "Философия ликбез" };

afterEach(() => {
  Reflect.deleteProperty(navigator as object, "mediaSession");
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useMediaSession", () => {
  beforeEach(() => {
    installMediaSession();
  });

  it("ставит metadata из meta", () => {
    const el = new FakeMediaElement();
    renderHook(() => { useMediaSession(refFor(el), META); });
    expect((ms.metadata as FakeMediaMetadata).title).toBe("Бытие и время");
    expect((ms.metadata as FakeMediaMetadata).artist).toBe("Философия ликбез");
    expect((ms.metadata as FakeMediaMetadata).artwork.length).toBeGreaterThan(0);
  });

  it("регистрирует play/pause/seek*, но НЕ previoustrack/nexttrack", () => {
    const el = new FakeMediaElement();
    renderHook(() => { useMediaSession(refFor(el), META); });
    for (const a of ["play", "pause", "seekbackward", "seekforward", "seekto"]) {
      expect(ms.handlers.has(a)).toBe(true);
    }
    expect(ms.handlers.has("previoustrack")).toBe(false);
    expect(ms.handlers.has("nexttrack")).toBe(false);
  });

  it("play/pause действия проксируются на элемент", () => {
    const el = new FakeMediaElement();
    renderHook(() => { useMediaSession(refFor(el), META); });
    ms.invoke("play");
    expect(el.play).toHaveBeenCalledTimes(1);
    ms.invoke("pause");
    expect(el.pause).toHaveBeenCalledTimes(1);
  });

  it("seekbackward/seekforward сдвигают currentTime с клампом", () => {
    const el = new FakeMediaElement();
    el.currentTime = 30;
    renderHook(() => { useMediaSession(refFor(el), META); });
    ms.invoke("seekbackward", { seekOffset: 10 });
    expect(el.currentTime).toBe(20);
    el.currentTime = 5;
    ms.invoke("seekbackward", { seekOffset: 10 });
    expect(el.currentTime).toBe(0); // кламп к 0
    el.currentTime = 95;
    ms.invoke("seekforward", { seekOffset: 10 });
    expect(el.currentTime).toBe(100); // кламп к duration
  });

  it("seekto: с fastSeek и без", () => {
    const el = new FakeMediaElement();
    renderHook(() => { useMediaSession(refFor(el), META); });
    ms.invoke("seekto", { seekTime: 42 });
    expect(el.currentTime).toBe(42);
    ms.invoke("seekto", { seekTime: 60, fastSeek: true });
    expect(el.fastSeek).toHaveBeenCalledWith(60);
  });

  it("seekto без поддержки fastSeek — присваивает currentTime напрямую", () => {
    const el = new FakeMediaElement();
    // Элемент без метода fastSeek: гард `"fastSeek" in el` ложен,
    // даже при fastSeek:true должен сработать прямой путь.
    Reflect.deleteProperty(el, "fastSeek");
    renderHook(() => { useMediaSession(refFor(el), META); });
    ms.invoke("seekto", { seekTime: 42, fastSeek: true });
    expect(el.currentTime).toBe(42);
  });

  it("seekforward на стриме (duration=Infinity) — растёт без верхнего клампа", () => {
    const el = new FakeMediaElement();
    el.duration = Infinity;
    el.currentTime = 100;
    renderHook(() => { useMediaSession(refFor(el), META); });
    ms.invoke("seekforward", { seekOffset: 10 });
    expect(el.currentTime).toBe(110);
  });

  it("playbackState следует за событиями элемента", () => {
    const el = new FakeMediaElement();
    renderHook(() => { useMediaSession(refFor(el), META); });
    el.emit("play");
    expect(ms.playbackState).toBe("playing");
    el.emit("pause");
    expect(ms.playbackState).toBe("paused");
  });

  it("setPositionState вызывается при конечной длительности", () => {
    const el = new FakeMediaElement();
    el.currentTime = 12;
    renderHook(() => { useMediaSession(refFor(el), META); });
    el.emit("loadedmetadata");
    expect(ms.setPositionState).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 100, position: 12 }),
    );
  });

  it("setPositionState пропускается при бесконечной длительности (стрим)", () => {
    const el = new FakeMediaElement();
    el.duration = Infinity;
    renderHook(() => { useMediaSession(refFor(el), META); });
    el.emit("timeupdate");
    expect(ms.setPositionState).not.toHaveBeenCalled();
  });

  it("unmount снимает хендлеры и сбрасывает metadata", () => {
    const el = new FakeMediaElement();
    const { unmount } = renderHook(() => { useMediaSession(refFor(el), META); });
    unmount();
    for (const a of ["play", "pause", "seekbackward", "seekforward", "seekto"]) {
      expect(ms.handlers.get(a)).toBeNull();
    }
    expect(ms.metadata).toBeNull();
    expect(ms.playbackState).toBe("none");
  });

  it("без mediaSession — no-op без ошибок", () => {
    Reflect.deleteProperty(navigator as object, "mediaSession");
    const el = new FakeMediaElement();
    expect(() => {
      renderHook(() => { useMediaSession(refFor(el), META); });
    }).not.toThrow();
  });
});
