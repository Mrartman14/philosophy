// src/features/lectures/order-canvases.ts

/**
 * Канвасы лекции с основным (is_entry) первым; остальные — в исходном порядке.
 * Отбрасывает элементы без id (нечего линковать). Стабильная партиция, а не
 * sort — несколько is_entry (дрейф контракта) сохраняют взаимный порядок.
 *
 * is_entry выставляется ТОЛЬКО листингом GET /api/lectures/{id}/canvases
 * («основной канвас»). Лёгкий листинг — data графа там не приходит, рендер
 * самого канваса остаётся на странице /canvases/{id}.
 */
export function orderLectureCanvases<T extends { id?: string; is_entry?: boolean }>(
  canvases: T[],
): (T & { id: string })[] {
  const withId = canvases.filter((c): c is T & { id: string } => Boolean(c.id));
  const entries = withId.filter((c) => c.is_entry);
  const rest = withId.filter((c) => !c.is_entry);
  return [...entries, ...rest];
}
