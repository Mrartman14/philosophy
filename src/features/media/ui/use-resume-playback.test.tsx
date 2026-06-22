import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useResumePlayback } from "./use-resume-playback";

class FakeMediaElement {
  currentTime = 0;
  duration = 100;
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

function refFor(el: FakeMediaElement) {
  return { current: el as unknown as HTMLMediaElement };
}

const KEY = "media-resume:m1";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useResumePlayback", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("возобновляет сохранённую позицию на loadedmetadata", () => {
    localStorage.setItem(KEY, "42");
    const el = new FakeMediaElement();
    renderHook(() => { useResumePlayback(refFor(el), "m1"); });
    el.emit("loadedmetadata");
    expect(el.currentTime).toBe(42);
  });

  it("не возобновляет, если позиция < 5с (почти начало)", () => {
    localStorage.setItem(KEY, "3");
    const el = new FakeMediaElement();
    renderHook(() => { useResumePlayback(refFor(el), "m1"); });
    el.emit("loadedmetadata");
    expect(el.currentTime).toBe(0);
  });

  it("не возобновляет у самого конца (> duration − 5с)", () => {
    localStorage.setItem(KEY, "98"); // duration=100
    const el = new FakeMediaElement();
    renderHook(() => { useResumePlayback(refFor(el), "m1"); });
    el.emit("loadedmetadata");
    expect(el.currentTime).toBe(0);
  });

  it("пишет позицию на timeupdate с троттлингом", () => {
    vi.useFakeTimers();
    const el = new FakeMediaElement();
    renderHook(() => { useResumePlayback(refFor(el), "m1"); });

    el.currentTime = 10;
    el.emit("timeupdate");
    expect(localStorage.getItem(KEY)).toBe("10"); // первая запись сразу

    el.currentTime = 11;
    el.emit("timeupdate");
    expect(localStorage.getItem(KEY)).toBe("10"); // троттл — не записалось

    vi.advanceTimersByTime(5000);
    el.currentTime = 20;
    el.emit("timeupdate");
    expect(localStorage.getItem(KEY)).toBe("20"); // после окна — записалось
  });

  it("очищает ключ на ended", () => {
    localStorage.setItem(KEY, "42");
    const el = new FakeMediaElement();
    renderHook(() => { useResumePlayback(refFor(el), "m1"); });
    el.emit("ended");
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("недоступная ЗАПИСЬ localStorage — тихий no-op без ошибок", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const el = new FakeMediaElement();
    el.currentTime = 10;
    expect(() => {
      renderHook(() => { useResumePlayback(refFor(el), "m1"); });
      el.emit("timeupdate");
    }).not.toThrow();
  });

  it("недоступное ЧТЕНИЕ localStorage — без ошибок, позиция не двигается", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const el = new FakeMediaElement();
    expect(() => {
      renderHook(() => { useResumePlayback(refFor(el), "m1"); });
      el.emit("loadedmetadata");
    }).not.toThrow();
    expect(el.currentTime).toBe(0);
  });
});
