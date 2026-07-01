// src/components/anchor-engine/use-hover-reveal.ts
// Lazy-подсветка: движение мыши в AST-руте → hit-test по КЭШИРОВАННЫМ geometries →
// onHover(id) подсвечивает фрагмент под курсором; mouseleave → onHover(null).
// Throttle через rAF. Используется eager-слоем MarginAnchorLayer (текст-hover →
// эмфаза). Хит-тест по готовым geometries (не пересчитывает rangeFromAnchor на каждый кадр).
import { useEffect, type RefObject } from "react";

import { noteAtPointInGeometry } from "./hit-test";
import type { AnchorGeometry } from "./types";

export function useHoverReveal({
  astRootRef,
  geometries,
  ready,
  onHover,
}: {
  astRootRef: RefObject<HTMLElement | null>;
  geometries: Map<string, AnchorGeometry | null>;
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
        emit(noteAtPointInGeometry(clientX, clientY, geometries, root));
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
  }, [astRootRef, geometries, ready, onHover]);
}
