// src/components/anchor-engine/use-anchor-highlights.test.ts
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HighlightController } from "./highlight-controller";
import { useAnchorHighlights } from "./use-anchor-highlights";

// Фейковый controller: apply/setActive/clear — vi.fn(); supported не читается хуком.
// Каст к HighlightController — хук зовёт только эти три метода (образец —
// highlight-controller.test.ts, где сам контроллер тестируется отдельно).
function fakeController() {
  const apply = vi.fn();
  const setActive = vi.fn();
  const clear = vi.fn();
  const controller = { apply, setActive, clear } as unknown as HighlightController;
  return { controller, apply, setActive, clear };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAnchorHighlights", () => {
  it("enabled=false → controller.clear(), apply НЕ вызван", () => {
    const { controller, apply, clear } = fakeController();
    renderHook(() => {
      useAnchorHighlights({
        controller,
        ranges: new Map([["a", document.createRange()]]),
        persistentIds: ["a"],
        activeId: null,
        enabled: false,
      });
    });
    expect(clear).toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  it("persistentId, которого нет в ranges → отфильтрован из apply", () => {
    const { controller, apply } = fakeController();
    const rangeA = document.createRange();
    renderHook(() => {
      useAnchorHighlights({
        controller,
        // "b" отсутствует в ranges → ranges.get("b") = undefined → null → отфильтрован.
        ranges: new Map([["a", rangeA]]),
        persistentIds: ["a", "b"],
        activeId: null,
        enabled: true,
      });
    });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith([rangeA]); // только "a", без "b"
  });

  it("activeId присутствует → setActive(range) этого якоря", () => {
    const { controller, setActive } = fakeController();
    const rangeA = document.createRange();
    const rangeB = document.createRange();
    renderHook(() => {
      useAnchorHighlights({
        controller,
        ranges: new Map([
          ["a", rangeA],
          ["b", rangeB],
        ]),
        persistentIds: [],
        activeId: "b",
        enabled: true,
      });
    });
    expect(setActive).toHaveBeenCalledWith(rangeB);
  });

  it("activeId=null → setActive(null)", () => {
    const { controller, setActive } = fakeController();
    renderHook(() => {
      useAnchorHighlights({
        controller,
        ranges: new Map([["a", document.createRange()]]),
        persistentIds: [],
        activeId: null,
        enabled: true,
      });
    });
    expect(setActive).toHaveBeenCalledWith(null);
  });
});
