// src/utils/action-state.ts
import type { ActionResult } from "./create-action";

/**
 * Начальный success-state для `useActionState` мутирующих форм:
 * `{ success: true, data }`. Единый источник формы начального ActionResult —
 * вместо копипасты литерала в каждой форме. `data` обычно `null` (сущность ещё
 * не создана/не сохранена), но бывает `false` (boolean-экшены) или union.
 *
 * Импорт `ActionResult` — type-only, поэтому модуль client-safe (не тянет
 * server-код из create-action.ts в клиентский бандл).
 *
 * Тип-аргумент передавай явно, чтобы зафиксировать T формы:
 *   const initial = initialActionState<Trail | null>(null);
 */
export function initialActionState<T>(data: T): ActionResult<T> {
  return { success: true, data };
}
