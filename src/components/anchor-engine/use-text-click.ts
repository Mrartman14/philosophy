// src/components/anchor-engine/use-text-click.ts
// Клик в AST-руте → hit-test (какой note под caret) → onPick(id). Политика
// решает, что делать с id (активировать карточку / скроллить к треду).
import { useEffect, type RefObject } from "react";

import { noteAtPoint } from "./hit-test";
import type { AnchoredNote } from "./types";

export function useTextClick({
  astRootRef,
  notes,
  ready,
  onPick,
}: {
  astRootRef: RefObject<HTMLElement | null>;
  notes: AnchoredNote[];
  ready: boolean;
  onPick: (id: string) => void;
}) {
  useEffect(() => {
    const root = astRootRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const id = noteAtPoint(e.clientX, e.clientY, notes, root);
      if (id) onPick(id);
    };
    root.addEventListener("click", onClick);
    return () => {
      root.removeEventListener("click", onClick);
    };
    // ready в deps: переподписка после готовности рута (root null→element).
  }, [astRootRef, notes, ready, onPick]);
}
