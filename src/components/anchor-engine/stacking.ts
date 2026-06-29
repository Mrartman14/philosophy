// src/components/anchor-engine/stacking.ts
// Чистая раздвижка карточек по вертикали («магия Word»). Без React/DOM.
export interface StackItem {
  id: string;
  top: number; // желаемый top (px) относительно контейнера колонки
  height: number;
}
export interface StackResult {
  tops: Map<string, number>;
  totalHeight: number; // для min-height-распорки колонки
  // id в вертикальном (по top) порядке. Колонка рендерит карточки в этом
  // порядке, чтобы DOM/таб-порядок совпадал с визуальным (WCAG 2.4.3 Focus
  // Order): иначе абсолютно-позиционированные карточки в DOM идут во входном
  // порядке, а на экране — по якорю, и фокус «прыгает».
  order: string[];
}
export function resolveStack(items: StackItem[], gap = 8): StackResult {
  const sorted = [...items].sort((a, b) => a.top - b.top);
  const tops = new Map<string, number>();
  const order: string[] = [];
  let cursor = -Infinity;
  let totalHeight = 0;
  for (const item of sorted) {
    const top = Math.max(item.top, cursor);
    tops.set(item.id, top);
    order.push(item.id);
    cursor = top + item.height + gap;
    totalHeight = top + item.height;
  }
  return { tops, totalHeight, order };
}

/**
 * Переставляет элементы по заданному порядку id (`order` из resolveStack).
 * Стабильно: элементы, чьих id нет в `order` (ещё не измеренный якорь),
 * сохраняют относительный порядок и идут после упорядоченных. Пустой `order`
 * (narrow/до измерения) → вход без изменений. Чистая (без React/DOM), чтобы
 * выравнивание DOM-порядка с визуальным было юнит-тестируемо.
 */
export function applyOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...items].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}
