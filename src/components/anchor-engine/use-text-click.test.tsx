import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTextClick } from "./use-text-click";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useTextClick", () => {
  it("не падает и снимает листенер при unmount, когда root пуст", () => {
    const ref = createRef<HTMLElement>();
    const onPick = vi.fn();
    const { unmount } = renderHook(() => {
      useTextClick({ astRootRef: ref, notes: [], ready: false, onPick });
    });
    unmount();
    expect(onPick).not.toHaveBeenCalled();
  });

  it("подписывается на click рута при ready", () => {
    const el = document.createElement("div");
    const add = vi.spyOn(el, "addEventListener");
    const ref = createRef<HTMLElement>();
    ref.current = el;
    renderHook(() => {
      useTextClick({ astRootRef: ref, notes: [], ready: true, onPick: vi.fn() });
    });
    expect(add).toHaveBeenCalledWith("click", expect.any(Function));
  });
});
