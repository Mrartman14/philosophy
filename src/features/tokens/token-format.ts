// src/features/tokens/token-format.ts
// Чистые хелперы статуса/времени PAT. Без "server-only": нужны и UI, и тестам.
import type { PatToken } from "./types";

export type TokenStatus = "active" | "revoked" | "expired";

/**
 * Статус токена на момент `nowSec` (Unix-секунды). nowSec приходит снаружи,
 * чтобы функция оставалась чистой и тестируемой.
 *  - revoked_at задан → revoked (приоритетнее срока);
 *  - expires_at задан и уже прошёл → expired;
 *  - иначе → active (в т.ч. бессрочный токен без expires_at).
 */
export function tokenStatus(token: PatToken, nowSec: number): TokenStatus {
  if (token.revoked_at) return "revoked";
  if (token.expires_at !== undefined && token.expires_at <= nowSec) {
    return "expired";
  }
  return "active";
}

/** Unix-секунды → Date. null, если значение отсутствует (бессрочно/нет даты). */
export function unixSecToDate(sec?: number): Date | null {
  if (sec === undefined) return null;
  return new Date(sec * 1000);
}
