// src/features/statistics/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { rethrowApiError } from "@/utils/api-error";
import { createAction } from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { requireCapability } from "@/utils/permissions";

import { canManageOwnHistory } from "./permissions";
import { HistoryTrackingSchema } from "./schemas";
import type { HistorySettings } from "./types";

/**
 * Включает/выключает трекинг просмотров. Выключение на бэке безвозвратно
 * удаляет всю историю просмотров (DisableAndPurgeTx) — предупреждение в UI
 * (ConfirmDialog в history-tracking-toggle).
 */
export const setHistoryTracking = createAction(async (raw: unknown) => {
  const me = await getMe();
  requireCapability(me, canManageOwnHistory);
  const enabled = HistoryTrackingSchema.parse(raw);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/me/history/settings", {
    body: { tracking_enabled: enabled },
  });
  if (error) rethrowApiError(error);
  return (data.data ?? null) as HistorySettings | null;
});
