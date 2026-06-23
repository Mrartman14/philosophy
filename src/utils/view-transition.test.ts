import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withViewTransition } from "./view-transition";

function setMatchMedia(reduce: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("reduce") ? reduce : false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-motion");
  delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
});

describe("withViewTransition", () => {
  let animate: MockInstance;
  beforeEach(() => {
    setMatchMedia(false);
    // jsdom-стаб WAAPI: хвостовой ready.then(...animate) не должен падать.
    // jsdom 29 не реализует Element.prototype.animate — vi.spyOn требует
    // существующего свойства, поэтому сначала сеем no-op, затем шпионим.
    if (typeof document.documentElement.animate !== "function") {
      (document.documentElement as unknown as { animate: () => Animation }).animate =
        () => ({}) as Animation;
    }
    animate = vi.spyOn(document.documentElement, "animate").mockReturnValue({} as Animation);
  });

  it("без поддержки startViewTransition → mutate синхронно", () => {
    const mutate = vi.fn();
    withViewTransition(mutate);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("при reduced motion → mutate синхронно, startViewTransition НЕ зовётся", () => {
    document.documentElement.setAttribute("data-motion", "reduced");
    const start = vi.fn();
    (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
    const mutate = vi.fn();
    withViewTransition(mutate);
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
  });

  it("VT доступен + motion разрешён → startViewTransition(mutate)", () => {
    const start = vi.fn((cb: () => void) => { cb(); return { ready: Promise.resolve() }; });
    (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
    const mutate = vi.fn();
    withViewTransition(mutate);
    expect(start).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("origin берётся из последней точки указателя (pointerdown)", async () => {
    let ready!: () => void;
    const start = vi.fn((cb: () => void) => { cb(); return { ready: new Promise<void>((r) => { ready = () => { r(); }; }) }; });
    (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
    document.dispatchEvent(new MouseEvent("pointerdown", { clientX: 10, clientY: 20 }));
    withViewTransition(vi.fn());
    ready();
    await Promise.resolve();
    expect(animate).toHaveBeenCalled();
    const [keyframes] = animate.mock.calls[0] as [{ clipPath: string[] }];
    expect(keyframes.clipPath[0]).toContain("at 10px 20px");
  });

  it("ready реджектится (пропущенный/вытесненный переход) → нет unhandled rejection, mutate отработал один раз", async () => {
    const onUnhandled = vi.fn();
    process.on("unhandledRejection", onUnhandled);
    try {
      const rejected = Promise.reject(new Error("VT skipped"));
      const start = vi.fn((cb: () => void) => { cb(); return { ready: rejected }; });
      (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
      const mutate = vi.fn();
      withViewTransition(mutate);
      // Дать микротаскам (.then→.catch) отработать и дать шанс unhandledRejection всплыть.
      await Promise.resolve();
      await new Promise((r) => { setTimeout(r, 0); });
      expect(mutate).toHaveBeenCalledTimes(1);
      expect(animate).not.toHaveBeenCalled();
      expect(onUnhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("startViewTransition бросает синхронно → mutate отработал ровно один раз, исключение не вылетает", () => {
    const start = vi.fn(() => { throw new Error("boom"); });
    (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
    const mutate = vi.fn();
    expect(() => { withViewTransition(mutate); }).not.toThrow();
    expect(start).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  describe("readNumberToken (--vt-duration)", () => {
    let ready!: () => void;
    function arm(tokenValue: string) {
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        getPropertyValue: (n: string) => (n === "--vt-duration" ? tokenValue : ""),
      } as unknown as CSSStyleDeclaration);
      const start = vi.fn((cb: () => void) => { cb(); return { ready: new Promise<void>((r) => { ready = () => { r(); }; }) }; });
      (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
    }
    async function durationFromAnimate(): Promise<number> {
      withViewTransition(vi.fn());
      ready();
      await Promise.resolve();
      const [, options] = animate.mock.calls[0] as [unknown, { duration: number }];
      return options.duration;
    }

    it('"0ms" → 0 (не воскрешает 400ms-fallback)', async () => {
      arm("0ms");
      expect(await durationFromAnimate()).toBe(0);
    });
    it('"0.3s" → 300 (s→ms ×1000)', async () => {
      arm("0.3s");
      expect(await durationFromAnimate()).toBe(300);
    });
    it("пусто → fallback 400", async () => {
      arm("");
      expect(await durationFromAnimate()).toBe(400);
    });
    it('мусор "abc" → fallback 400', async () => {
      arm("abc");
      expect(await durationFromAnimate()).toBe(400);
    });
    it('отрицательное "-50ms" → клампится до 0', async () => {
      arm("-50ms");
      expect(await durationFromAnimate()).toBe(0);
    });
  });

  it("origin падает в центр вьюпорта, если pointerdown ещё не было", async () => {
    // lastPointer — module-singleton; берём СВЕЖИЙ модуль через resetModules,
    // чтобы pointerdown из предыдущих тестов не протёк сюда (детерминизм).
    vi.resetModules();
    setMatchMedia(false);
    vi.stubGlobal("innerWidth", 200);
    vi.stubGlobal("innerHeight", 100);
    let ready!: () => void;
    const start = vi.fn((cb: () => void) => { cb(); return { ready: new Promise<void>((r) => { ready = () => { r(); }; }) }; });
    (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
    const localAnimate = vi.spyOn(document.documentElement, "animate").mockReturnValue({} as Animation);

    const mod = await import("./view-transition");
    mod.withViewTransition(vi.fn());
    ready();
    await Promise.resolve();

    expect(localAnimate).toHaveBeenCalled();
    const [keyframes] = localAnimate.mock.calls[0] as [{ clipPath: string[] }];
    // центр = (innerWidth/2, innerHeight/2) = (100, 50)
    expect(keyframes.clipPath[0]).toContain("at 100px 50px");
  });
});
