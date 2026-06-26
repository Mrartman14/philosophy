// src/components/anchor-engine/use-text-click.ts
// Клик в AST-руте → hit-test (какой note под caret) → onPick(id). Политика
// решает, что делать с id (активировать карточку / скроллить к треду). Хит-тест
// по УЖЕ ПОСЧИТАННЫМ ranges (как useHoverReveal) — без пересчёта rangeFromAnchor
// на каждый клик; эквивалентно noteAtPoint, т.к. ranges строятся тем же
// rangeFromAnchor (см. useAnchorRanges / коммент в hit-test).
import { useEffect, type RefObject } from "react";

import { noteAtPointInRanges } from "./hit-test";

export function useTextClick({
  astRootRef,
  ranges,
  ready,
  onPick,
}: {
  astRootRef: RefObject<HTMLElement | null>;
  ranges: Map<string, Range | null>;
  ready: boolean;
  onPick: (id: string) => void;
}) {
  useEffect(() => {
    const root = astRootRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const id = noteAtPointInRanges(e.clientX, e.clientY, ranges, root);
      if (id) onPick(id);
    };
    root.addEventListener("click", onClick);
    return () => {
      root.removeEventListener("click", onClick);
    };
    // ready в deps: переподписка после готовности рута (root null→element).
  }, [astRootRef, ranges, ready, onPick]);
}
