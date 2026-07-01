// src/components/anchor-engine/highlight-overlay.test.tsx
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HighlightOverlay } from "./highlight-overlay";
import { must } from "./test-support";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

/**
 * scrollX/scrollY в jsdom — read-only геттеры (всегда 0). Переопределяем через
 * defineProperty, чтобы проверить document-координатный сдвиг оверлея, и
 * ОБЯЗАТЕЛЬНО восстанавливаем в finally (моки не текут между тестами).
 */
function withScroll(x: number, y: number, run: () => void): void {
  const origX = Object.getOwnPropertyDescriptor(window, "scrollX");
  const origY = Object.getOwnPropertyDescriptor(window, "scrollY");
  Object.defineProperty(window, "scrollX", { configurable: true, value: x });
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  try {
    run();
  } finally {
    if (origX) Object.defineProperty(window, "scrollX", origX);
    else Reflect.deleteProperty(window, "scrollX");
    if (origY) Object.defineProperty(window, "scrollY", origY);
    else Reflect.deleteProperty(window, "scrollY");
  }
}

function overlayBoxes(): HTMLElement[] {
  // Оверлей порталится в document.body → без document.querySelectorAll до него не добраться.
  return [...document.querySelectorAll<HTMLElement>(".annotation-overlay")];
}

describe("HighlightOverlay", () => {
  it("top/left сдвинуты на scrollX/scrollY (document-координаты)", () => {
    withScroll(100, 200, () => {
      render(
        <HighlightOverlay
          rects={[new DOMRect(10, 20, 40, 15)]}
          activeRects={[]}
        />,
      );
      const box = must(overlayBoxes()[0]);
      // top = rect.top(20) + scrollY(200); left = rect.left(10) + scrollX(100).
      expect(box.style.top).toBe("220px");
      expect(box.style.left).toBe("110px");
      expect(box.style.width).toBe("40px");
      expect(box.style.height).toBe("15px");
    });
  });

  it("active-набор помечен модификатором, persistent — нет", () => {
    withScroll(0, 0, () => {
      render(
        <HighlightOverlay
          rects={[new DOMRect(0, 0, 10, 10)]}
          activeRects={[new DOMRect(50, 50, 10, 10)]}
        />,
      );
      const boxes = overlayBoxes();
      expect(boxes.length).toBe(2);
      // Порядок collect: persistent (rects) сначала, active (activeRects) следом.
      const persistent = must(boxes[0]);
      const active = must(boxes[1]);
      expect(persistent.className).toBe("annotation-overlay");
      expect(persistent.classList.contains("annotation-overlay--active")).toBe(false);
      expect(active.classList.contains("annotation-overlay--active")).toBe(true);
    });
  });
});
