// src/components/ui/margin-note.tsx
import type { ReactNode } from "react";

import { cn } from "./cn";

/** Карта стороны → логическая грид-колонка (RTL-зеркалирование бесплатно). */
export const MARGIN_NOTE_SIDE = {
  start: "col-margin-start",
  end: "col-margin-end",
} as const;

/** Карта стороны → растянутая колонка (поле + смежный bleed, cap по ширине). */
export const MARGIN_NOTE_SIDE_WIDE = {
  start: "col-margin-start-wide",
  end: "col-margin-end-wide",
} as const;

/** Карта поведения, когда полю не хватает места (узкий контейнер). */
const COLLAPSE_CLASS = {
  inline: "margin-note--inline",
  hidden: "margin-note--hidden",
} as const;

export interface MarginNoteProps {
  /** Логическая сторона: start (инлайн-начало) | end (инлайн-конец). */
  side: keyof typeof MARGIN_NOTE_SIDE;
  /** Когда поле схлопнуто (узкий контейнер): inline — втекает в поток (default); hidden — скрыт. */
  collapse?: keyof typeof COLLAPSE_CLASS;
  /**
   * Растягивает поле в смежный bleed-трек до `--layout-margin-wide` (~32rem), когда
   * поля раскрыты; на узком контейнере — как обычно по collapse. Для широких панелей,
   * напр. комментариев/аннотаций. opt-in, default false.
   */
  grow?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Маргиналия: контент в поле слева/справа от хребта. Появляется, когда контейнер
 * широк настолько, что поле реально помещается (см. layout.css — @container, порог
 * в em, масштаб-инвариантно к размеру текста); иначе — по `collapse`. ДОЛЖЕН быть
 * прямым потомком `.page-grid`
 * (страница возвращает фрагмент: контент-хребет + <MarginNote>). Server-rendered,
 * RTL — через логические грид-линии. Structural-примитив → className ОТКРЫТ.
 */
export function MarginNote({ side, collapse = "inline", grow = false, className, children }: MarginNoteProps) {
  const placement = grow ? MARGIN_NOTE_SIDE_WIDE[side] : MARGIN_NOTE_SIDE[side];
  return (
    <aside className={cn(placement, COLLAPSE_CLASS[collapse], className)}>
      {children}
    </aside>
  );
}
