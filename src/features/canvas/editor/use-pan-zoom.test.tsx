// src/features/canvas/editor/use-pan-zoom.test.tsx
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Viewport } from "./editor-types";
import { usePanZoom, type UsePanZoomOptions } from "./use-pan-zoom";

function mount(over: Partial<UsePanZoomOptions> = {}) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const onViewportChange = vi.fn<(v: Viewport) => void>();
  const opts: UsePanZoomOptions = {
    viewport: { x: 0, y: 0, zoom: 1 },
    onViewportChange,
    enablePanDrag: true,
    ...over,
  };
  const ref = { current: el };
  const view = renderHook(() => { usePanZoom(ref, opts); });
  return { el, onViewportChange, unmount: view.unmount };
}

afterEach(() => { document.body.innerHTML = ""; });

describe("usePanZoom — wheel", () => {
  it("ctrl+колесо вверх → зум (zoom ≈ 1.1)", () => {
    const { el, onViewportChange } = mount();
    el.dispatchEvent(new WheelEvent("wheel", { deltaY: -10, ctrlKey: true, bubbles: true, cancelable: true }));
    expect(onViewportChange).toHaveBeenCalledTimes(1);
    const [vp] = onViewportChange.mock.calls[0] ?? [];
    expect(vp?.zoom).toBeCloseTo(1.1);
  });

  it("плоское колесо → пан (zoom не меняется, x/y = delta/zoom)", () => {
    const { el, onViewportChange } = mount();
    el.dispatchEvent(new WheelEvent("wheel", { deltaX: 30, deltaY: 12, bubbles: true, cancelable: true }));
    const [vp] = onViewportChange.mock.calls[0] ?? [];
    expect(vp?.zoom).toBe(1);
    expect(vp?.x).toBeCloseTo(30);
    expect(vp?.y).toBeCloseTo(12);
  });

  it("disabled → колесо игнорируется", () => {
    const { el, onViewportChange } = mount({ disabled: true });
    el.dispatchEvent(new WheelEvent("wheel", { deltaY: -10, ctrlKey: true, bubbles: true, cancelable: true }));
    expect(onViewportChange).not.toHaveBeenCalled();
  });

  it("после unmount слушатель снят", () => {
    const { el, onViewportChange, unmount } = mount();
    unmount();
    el.dispatchEvent(new WheelEvent("wheel", { deltaY: -10, ctrlKey: true, bubbles: true, cancelable: true }));
    expect(onViewportChange).not.toHaveBeenCalled();
  });
});
