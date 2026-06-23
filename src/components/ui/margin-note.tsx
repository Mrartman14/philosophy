// src/components/ui/margin-note.tsx
import type { ReactNode } from "react";

import { cn } from "./cn";

/** Карта стороны → логическая грид-колонка (RTL-зеркалирование бесплатно). */
export const MARGIN_NOTE_SIDE = {
  start: "col-margin-start",
  end: "col-margin-end",
} as const;

/** Карта поведения на узких экранах (< xl). */
const COLLAPSE_CLASS = {
  inline: "margin-note--inline",
  hidden: "margin-note--hidden",
} as const;

export interface MarginNoteProps {
  /** Логическая сторона: start (инлайн-начало) | end (инлайн-конец). */
  side: keyof typeof MARGIN_NOTE_SIDE;
  /** Поведение на < xl (1280px): inline — втекает в поток (default); hidden — скрыт. */
  collapse?: keyof typeof COLLAPSE_CLASS;
  className?: string;
  children: ReactNode;
}

/**
 * Маргиналия: контент в поле слева/справа от хребта. Появляется только на >= xl
 * (1280px); ниже — по `collapse`. ДОЛЖЕН быть прямым потомком `.page-grid`
 * (страница возвращает фрагмент: контент-хребет + <MarginNote>). Server-rendered,
 * RTL — через логические грид-линии. Structural-примитив → className ОТКРЫТ.
 */
export function MarginNote({ side, collapse = "inline", className, children }: MarginNoteProps) {
  return (
    <aside className={cn(MARGIN_NOTE_SIDE[side], COLLAPSE_CLASS[collapse], className)}>
      {children}
    </aside>
  );
}
