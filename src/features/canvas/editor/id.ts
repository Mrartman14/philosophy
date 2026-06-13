// src/features/canvas/editor/id.ts

/**
 * Генерирует уникальный id для нового узла/ребра. Обёртка над
 * crypto.randomUUID (доступен в браузере и в jsdom/Node ≥ 19). Вынесена
 * отдельно, чтобы тесты редьюсера могли подменять её через vi.spyOn.
 * Бек принимает любую непустую строку id.
 */
export function newId(): string {
  return crypto.randomUUID();
}
