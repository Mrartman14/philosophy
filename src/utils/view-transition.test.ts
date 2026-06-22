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
});
