// src/features/tokens/token-format.ts
// Доменный статус PAT. Чистые date-вычисления — из общего @/utils/dates.
import { isPast, unixSecToDate } from "@/utils/dates";

import type { PatToken } from "./types";

export type TokenStatus = "active" | "revoked" | "expired";

/**
 * Статус токена на момент `nowMs` (мс). nowMs приходит снаружи — функция
 * чистая и тестируемая.
 *  - revoked_at задан → revoked (приоритетнее срока);
 *  - expires_at прошёл → expired;
 *  - иначе → active (в т.ч. бессрочный токен без expires_at).
 */
export function tokenStatus(token: PatToken, nowMs: number): TokenStatus {
  if (token.revoked_at) return "revoked";
  const exp = unixSecToDate(token.expires_at);
  if (exp && isPast(exp, nowMs)) return "expired";
  return "active";
}
