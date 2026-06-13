// Чистый helper парсинга пагинации из searchParams. Без "server-only": нужен
// тестам; используется в server-страницах списков.

type Raw = string | string[] | undefined;

/**
 * Парсит одно значение searchParams в неотрицательное целое. Невалидное
 * (NaN, дробное, отрицательное, массив без числа) → `fallback`. Защищает бек
 * от `offset=NaN` при `?offset=abc`.
 */
export function parseNonNegativeInt(value: Raw, fallback: number): number {
  const s = Array.isArray(value) ? value[0] : value;
  if (s === undefined || s === "") return fallback;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

/**
 * Парсит `offset`/`limit` из searchParams. Дефолты настраиваются (у разных
 * списков разный размер страницы).
 */
export function parsePaging(
  raw: { offset?: Raw; limit?: Raw },
  defaults: { offset?: number; limit?: number } = {},
): { offset: number; limit: number } {
  return {
    offset: parseNonNegativeInt(raw.offset, defaults.offset ?? 0),
    limit: parseNonNegativeInt(raw.limit, defaults.limit ?? 20),
  };
}
