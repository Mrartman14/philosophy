// src/components/anchor-engine/use-text-click.ts
// Клик в AST-руте → hit-test (какой note под caret) → onPick(id). Политика
// решает, что делать с id (активировать карточку / скроллить к треду). Хит-тест
// по УЖЕ ПОСЧИТАННЫМ geometries (как useHoverReveal) — без пересчёта rangeFromAnchor
// на каждый клик; эквивалентно noteAtPoint, т.к. range-geometries строятся тем же
// rangeFromAnchor (см. useAnchorRanges / коммент в hit-test).
import { useEffect, type RefObject } from "react";

import { noteAtPointInGeometry } from "./hit-test";
import type { AnchorGeometry } from "./types";

export function useTextClick({
  astRootRef,
  geometries,
  ready,
  onPick,
}: {
  astRootRef: RefObject<HTMLElement | null>;
  geometries: Map<string, AnchorGeometry | null>;
  ready: boolean;
  onPick: (id: string) => void;
}) {
  useEffect(() => {
    const root = astRootRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const id = noteAtPointInGeometry(e.clientX, e.clientY, geometries, root);
      if (id) onPick(id);
    };
    root.addEventListener("click", onClick);
    return () => {
      root.removeEventListener("click", onClick);
    };
    // ready в deps: переподписка после готовности рута (root null→element).
  }, [astRootRef, geometries, ready, onPick]);
}
