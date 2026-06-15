// src/utils/idempotency.ts
/**
 * Идемпотентность мутирующих форм (онлайн).
 *
 * Клиент кладёт ключ в скрытое поле `IDEMPOTENCY_FIELD` (см.
 * `src/components/ui/idempotency-field.tsx`), `createFormAction` извлекает его
 * в `ctx.idempotencyKey`, а server action пробрасывает в заголовок
 * `Idempotency-Key` вызова бэка через `idempotencyHeaders`.
 *
 * Модуль client-safe (БЕЗ `import "server-only"`): `IDEMPOTENCY_FIELD`
 * импортирует и клиентский `<IdempotencyField/>`.
 */

/** Имя скрытого поля формы с ключом идемпотентности. */
export const IDEMPOTENCY_FIELD = "__idempotency_key";

/** Имя HTTP-заголовка, который понимает бекенд. */
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** Максимальная длина ключа (>255 → 400 IDEMPOTENCY_KEY_INVALID на беке). */
const MAX_KEY_LENGTH = 255;

/**
 * Достаёт ключ из FormData. `undefined`, если поля нет, оно не строка, пустое
 * или длиннее 255 (такой ключ бэк отверг бы 400 — лучше не слать).
 */
export function readIdempotencyKey(formData: FormData): string | undefined {
  const value = formData.get(IDEMPOTENCY_FIELD);
  if (typeof value !== "string") return undefined;
  if (value.length === 0 || value.length > MAX_KEY_LENGTH) return undefined;
  return value;
}

/**
 * Заголовки для openapi-fetch / fetch. Пустой объект, если ключа нет — запрос
 * идёт без идемпотентности (бэк трактует как обычный).
 */
export function idempotencyHeaders(
  key: string | undefined,
): Record<string, string> {
  return key ? { [IDEMPOTENCY_HEADER]: key } : {};
}
