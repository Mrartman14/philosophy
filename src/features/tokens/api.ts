// src/features/tokens/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";
import { getT } from "@/i18n";
import { unwrap } from "@/utils/api-unwrap";

import type { PatToken, UsageTracking } from "./types";

/**
 * Список персональных токенов текущего актора (только метаданные, без секрета).
 * GET /api/me/tokens → httputil.Response & { data: pat.Token[] }.
 *
 * Пер-юзерные данные — НЕ оборачиваем в unstable_cache; React.cache
 * дедуплицирует в рамках одного запроса. 401 (нет токена/протух) пробрасываем
 * как ошибку — страница за requireUserOrRedirect сюда не дойдёт гостем.
 */
export const getTokens = cache(async (): Promise<PatToken[]> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/me/tokens");
  if (error) {
    throw new Error(error.error ?? (await getT("tokens"))("api.loadFailed"));
  }
  return unwrap<PatToken[]>(data) ?? [];
});

/**
 * Состояние трекинга использования PAT текущего актора.
 * GET /api/me/tokens/usage-tracking → httputil.Response & { data: pat.UsageTracking }.
 * Пер-юзерные данные — React.cache дедуплицирует в рамках запроса.
 */
export const getUsageTracking = cache(async (): Promise<UsageTracking> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/me/tokens/usage-tracking");
  if (error) {
    throw new Error(error.error ?? (await getT("tokens"))("api.loadFailed"));
  }
  return unwrap<UsageTracking>(data) ?? { tracking_enabled: false };
});
