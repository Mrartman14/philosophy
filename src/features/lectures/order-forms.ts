// src/features/lectures/order-forms.ts

/**
 * Формы лекции с основной (is_entry) первой; остальные — в исходном порядке.
 * Отбрасывает элементы без id (нечего линковать). Стабильная партиция, а не
 * sort — несколько is_entry (дрейф контракта) сохраняют взаимный порядок.
 *
 * is_entry выставляется ТОЛЬКО листингом GET /api/lectures/{id}/forms
 * («основная форма»). Лёгкий листинг — поля формы здесь не рендерятся,
 * заполнение остаётся на странице /forms/{id}.
 */
export function orderLectureForms<T extends { id?: string; is_entry?: boolean }>(
  forms: T[],
): (T & { id: string })[] {
  const withId = forms.filter((f): f is T & { id: string } => Boolean(f.id));
  const entries = withId.filter((f) => f.is_entry);
  const rest = withId.filter((f) => !f.is_entry);
  return [...entries, ...rest];
}
