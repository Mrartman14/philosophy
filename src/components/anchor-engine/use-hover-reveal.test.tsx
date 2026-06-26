import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { useHoverReveal } from "./use-hover-reveal";

describe("useHoverReveal", () => {
  it("подписывается на mousemove и mouseleave рута", () => {
    const el = document.createElement("div");
    const add = vi.spyOn(el, "addEventListener");
    const ref = createRef<HTMLElement>();
    ref.current = el;
    renderHook(() => {
      useHoverReveal({ astRootRef: ref, ranges: new Map(), ready: true, onHover: vi.fn() });
    });
    expect(add).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(add).toHaveBeenCalledWith("mouseleave", expect.any(Function));
  });

  it("mouseleave вызывает onHover(null)", () => {
    const el = document.createElement("div");
    const ref = createRef<HTMLElement>();
    ref.current = el;
    const onHover = vi.fn();
    renderHook(() => {
      useHoverReveal({ astRootRef: ref, ranges: new Map(), ready: true, onHover });
    });
    el.dispatchEvent(new MouseEvent("mouseleave"));
    expect(onHover).toHaveBeenCalledWith(null);
  });
});
