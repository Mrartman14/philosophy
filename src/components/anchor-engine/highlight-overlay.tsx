"use client";
// src/components/anchor-engine/highlight-overlay.tsx
// Подсветка прямоугольниками в абсолютном слое. Ноль мутаций текстового DOM.
// Источник rect'ов — вызывающий (range.getClientRects() для линейных в фолбэке,
// bounding-box для прямоугольных якорей). Прямоугольный якорь рисуется ТОЛЬКО здесь
// (CSS Custom Highlight API берёт лишь текстовые Range).
import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  rects: DOMRect[];
  activeRects: DOMRect[];
}
interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  active: boolean;
}

function collect(rects: DOMRect[], activeRects: DOMRect[]): Box[] {
  const map = (r: DOMRect, active: boolean): Box => ({
    top: r.top + window.scrollY,
    left: r.left + window.scrollX,
    width: r.width,
    height: r.height,
    active,
  });
  return [...rects.map((r) => map(r, false)), ...activeRects.map((r) => map(r, true))];
}

export function HighlightOverlay({ rects, activeRects }: Props) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  useLayoutEffect(() => {
    const update = () => {
      setBoxes(collect(rects, activeRects));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [rects, activeRects]);
  return createPortal(
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      {boxes.map((b, i) => (
        <div
          key={i}
          className={b.active ? "annotation-overlay annotation-overlay--active" : "annotation-overlay"}
          // eslint-disable-next-line no-restricted-syntax -- координатный оверлей, направление-нейтрально
          style={{ position: "absolute", top: b.top, left: b.left, width: b.width, height: b.height }}
        />
      ))}
    </div>,
    document.body,
  );
}
