// src/features/annotations/ui/annotation-anchor-context.tsx
import type { Anchor } from "../types";

interface Props {
  anchor?: Anchor | undefined;
}

/**
 * Показывает цитату из text-якоря (поле `exact` — W3C TextQuoteSelector,
 * сохранено самим беком в anchor). Для media-якоря — временной интервал.
 * Резолв блока через getBlockContext опционален и не нужен, пока exact есть
 * в самом anchor — показываем его напрямую (graceful). Без якоря — ничего.
 */
export function AnnotationAnchorContext({ anchor }: Props) {
  if (!anchor) return null;

  // Media-якорь.
  if (anchor.start_sec !== undefined) {
    const fmt = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${String(sec).padStart(2, "0")}`;
    };
    return (
      <p className="text-xs text-(--color-fg-muted)">
        ⏱ {fmt(anchor.start_sec)}
        {anchor.end_sec !== undefined ? `–${fmt(anchor.end_sec)}` : ""}
      </p>
    );
  }

  // Text-якорь — цитата.
  if (anchor.exact) {
    return (
      <blockquote className="border-l-2 border-(--color-border) pl-2 text-xs text-(--color-fg-muted)">
        «{anchor.prefix ?? ""}
        <mark>{anchor.exact}</mark>
        {anchor.suffix ?? ""}»
      </blockquote>
    );
  }

  return null;
}
