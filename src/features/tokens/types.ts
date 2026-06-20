// src/features/tokens/types.ts
import type { components } from "@/api/schema";

/**
 * Метаданные персонального токена (PAT). Бек: GET /api/me/tokens → data[].
 * Времена — Unix-СЕКУНДЫ (number), не ISO; `expires_at` отсутствует = бессрочный.
 * `token_hint` — безопасный «хвост» для опознания, НЕ сам секрет.
 */
export type PatToken = components["schemas"]["pat.Token"];

/** Тело POST /api/me/tokens (label/срок опциональны). */
export type CreateTokenRequest = components["schemas"]["pat.createTokenRequest"];

/**
 * Результат создания токена. Бек возвращает СЫРОЙ секрет ОДИН раз
 * (POST → httputil.Response.data, в схеме untyped) — показываем и забываем.
 */
export interface CreatedToken {
  token: string;
}

/** Состояние трекинга использования PAT (GET/PUT /api/me/tokens/usage-tracking). */
export type UsageTracking = components["schemas"]["pat.UsageTracking"];

/** Тело PUT /api/me/tokens/usage-tracking. */
export type SetUsageTrackingRequest =
  components["schemas"]["pat.setUsageTrackingRequest"];
