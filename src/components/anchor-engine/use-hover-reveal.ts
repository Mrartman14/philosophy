// src/components/anchor-engine/use-hover-reveal.ts
// Lazy-подсветка: движение мыши в AST-руте → hit-test по КЭШИРОВАННЫМ ranges →
// onHover(id) подсвечивает фрагмент под курсором; mouseleave → onHover(null).
// Throttle через rAF. Используется eager-слоем MarginAnchorLayer (текст-hover →
// эмфаза). Хит-тест по готовым ranges (не пересчитывает rangeFromAnchor на каждый кадр).
import { useEffect, type RefObject } from "react";

import { noteAtPointInRanges } from "./hit-test";

export function useHoverReveal({
  astRootRef,
  ranges,
  ready,
  onHover,
}: {
  astRootRef: RefObject<HTMLElement | null>;
  ranges: Map<string, Range | null>;
  ready: boolean;
  onHover: (id: string | null) => void;
}) {
  useEffect(() => {
    const root = astRootRef.current;
    if (!root) return;
    let raf = 0;
    let last: string | null = null;
    const emit = (id: string | null) => {
      if (id !== last) {
        last = id;
        onHover(id);
      }
    };
    const onMove = (e: MouseEvent) => {
      if (raf) return;
      const { clientX, clientY } = e;
      const run = () => {
        raf = 0;
        emit(noteAtPointInRanges(clientX, clientY, ranges, root));
      };
      raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(run) : 0;
      if (!raf) run();
    };
    const onLeave = () => {
      // Уход курсора — редкое событие: всегда сбрасываем подсветку, минуя dedup
      // (last мог быть null с самого начала). Отменяем висящий кадр, чтобы он не
      // переустановил hover после ухода.
      if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
      raf = 0;
      last = null;
      onHover(null);
    };
    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);
    return () => {
      if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
    };
  }, [astRootRef, ranges, ready, onHover]);
}
