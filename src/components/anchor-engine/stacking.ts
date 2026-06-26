// src/components/annotation-layer/stacking.ts
// Чистая раздвижка карточек по вертикали («магия Word»). Без React/DOM.
export interface StackItem {
  id: string;
  top: number; // желаемый top (px) относительно контейнера колонки
  height: number;
}
export interface StackResult {
  tops: Map<string, number>;
  totalHeight: number; // для min-height-распорки колонки
}
export function resolveStack(items: StackItem[], gap = 8): StackResult {
  const sorted = [...items].sort((a, b) => a.top - b.top);
  const tops = new Map<string, number>();
  let cursor = -Infinity;
  let totalHeight = 0;
  for (const item of sorted) {
    const top = Math.max(item.top, cursor);
    tops.set(item.id, top);
    cursor = top + item.height + gap;
    totalHeight = top + item.height;
  }
  return { tops, totalHeight };
}
