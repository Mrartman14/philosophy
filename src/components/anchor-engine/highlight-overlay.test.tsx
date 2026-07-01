// src/components/anchor-engine/highlight-overlay.test.tsx
import { act, cleanup, render } from "@testing-library/react";
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

  it("на scroll держит document-позицию по СВЕЖЕМУ (пере-снятому) rect — не дрейфует", () => {
    // F4-регресс (аудит 2026-07-01). overlay считает top = rect.top + scrollY, где
    // rect.top — VIEWPORT-координата. Когда страница прокручена, viewport-top якоря
    // сам смещается на −ΔY, поэтому СВЕЖИЙ пере-снятый rect держит document-позицию
    // (top+scrollY) постоянной. Корневой фикс — scroll-listener в use-aggregated
    // пере-снимает geometries на scroll (throttled rAF) → сюда приходит свежий rect.
    // Здесь фиксируем инвариант на границе overlay: свежий rect на scroll → нет
    // дрейфа (document-top стабилен). Без пере-снятия (stale rect + свежий scrollY)
    // бокс уехал бы на всю величину скролла — тот самый баг.
    const DOC_TOP = 500; // якорь стоит на document-позиции 500 (не двигается)
    const viewportTop = (scrollY: number) => DOC_TOP - scrollY; // rect на scroll ↓

    const renderAt = (scrollY: number) => {
      Object.defineProperty(window, "scrollY", { configurable: true, value: scrollY });
      Object.defineProperty(window, "scrollX", { configurable: true, value: 0 });
    };

    renderAt(0);
    const { rerender } = render(
      <HighlightOverlay rects={[new DOMRect(10, viewportTop(0), 40, 15)]} activeRects={[]} />,
    );
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(must(overlayBoxes()[0]).style.top).toBe(`${DOC_TOP}px`);

    // Прокрутили на 300: свежий rect имеет viewport-top = 200; overlay пере-мерит на
    // scroll-событие → document-top = 200 + 300 = 500 (глядит на якорь, без дрейфа).
    renderAt(300);
    rerender(
      <HighlightOverlay rects={[new DOMRect(10, viewportTop(300), 40, 15)]} activeRects={[]} />,
    );
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(must(overlayBoxes()[0]).style.top).toBe(`${DOC_TOP}px`);

    Reflect.deleteProperty(window, "scrollY");
    Reflect.deleteProperty(window, "scrollX");
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
