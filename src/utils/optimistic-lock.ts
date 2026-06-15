// src/utils/optimistic-lock.ts
/**
 * Оптимистичная блокировка (If-Match/version) мутирующих форм.
 *
 * Бэк перевёл optimistic lock на монотонный `version INTEGER`; токен — это
 * strong-ETag `"<version>"` (см. docs/conventions/optimistic-locking.md). Форма
 * кладёт версию в скрытое поле `VERSION_FIELD` (источник — body-поле `*.version`
 * read-DTO; у comment это ЕДИНСТВЕННЫЙ источник, single-GET нет), а server action
 * строит из неё заголовок `If-Match` через `ifMatchHeader`.
 *
 * Прямой аналог `idempotencyHeaders` (src/utils/idempotency.ts).
 */

/** Имя скрытого поля формы с версией сущности (для optimistic-lock). */
export const VERSION_FIELD = "version";

/**
 * Строит обязательный заголовок `If-Match: "<version>"` из скрытого поля формы
 * для content-edit PUT. Бросает (→ `ActionResult.error` в `createFormAction`),
 * если версии нет: PUT без `If-Match` вернул бы 428 `IF_MATCH_REQUIRED` — лучше
 * упасть раньше понятным «обновите страницу», чем слать stale/пустую версию.
 *
 * `entity` — существительное в родительном падеже для текста ошибки
 * («комментария», «документа», «термина»).
 */
export function ifMatchHeader(
  formData: FormData,
  entity: string,
): { "If-Match": string } {
  const version = formData.get(VERSION_FIELD);
  if (typeof version !== "string" || version === "") {
    throw new Error(`Отсутствует версия ${entity} — обновите страницу.`);
  }
  return { "If-Match": `"${version}"` };
}
