"use client";
// src/components/annotation-layer/highlight-overlay.tsx
// Фолбэк подсветки для браузеров без CSS Custom Highlight API: прямоугольники
// из range.getClientRects() в абсолютном слое. Ноль мутаций текстового DOM.
import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  ranges: Range[];
  activeRange: Range | null;
}
interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
  active: boolean;
}

function collect(ranges: Range[], active: Range | null): Rect[] {
  const out: Rect[] = [];
  const push = (r: Range, isActive: boolean) => {
    for (const cr of Array.from(r.getClientRects())) {
      out.push({
        top: cr.top + window.scrollY,
        left: cr.left + window.scrollX,
        width: cr.width,
        height: cr.height,
        active: isActive,
      });
    }
  };
  ranges.forEach((r) => {
    push(r, false);
  });
  if (active) push(active, true);
  return out;
}

export function HighlightOverlay({ ranges, activeRange }: Props) {
  const [rects, setRects] = useState<Rect[]>([]);
  useLayoutEffect(() => {
    const update = () => {
      setRects(collect(ranges, activeRange));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [ranges, activeRange]);
  return createPortal(
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      {rects.map((r, i) => (
        <div
          key={i}
          className={r.active ? "annotation-overlay annotation-overlay--active" : "annotation-overlay"}
          // eslint-disable-next-line no-restricted-syntax -- координатный оверлей, направление-нейтрально
          style={{ position: "absolute", top: r.top, left: r.left, width: r.width, height: r.height }}
        />
      ))}
    </div>,
    document.body,
  );
}
