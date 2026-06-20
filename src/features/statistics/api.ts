// src/features/statistics/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";
import { getT } from "@/i18n";

import type { HistorySettings, Inventory, ViewStatsData } from "./types";

/**
 * Self-only статистика текущего пользователя. Данные пер-юзерные — НЕ
 * оборачивать в unstable_cache: cross-request кеш протёк бы между
 * пользователями. React.cache дедуплицирует вызовы в рамках запроса.
 * Вызывать только после getMe() !== null.
 */
export const getProductionStats = cache(async (): Promise<Inventory> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/me/production");
  if (error) {
    throw new Error(error.error ?? (await getT("statistics"))("api.loadStatsFailed"));
  }
  return data.data ?? {};
});

export const getViewStats = cache(async (): Promise<ViewStatsData> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/me/history/stats");
  if (error) {
    throw new Error(error.error ?? (await getT("statistics"))("api.loadViewStatsFailed"));
  }
  return data.data ?? {};
});

export const getHistorySettings = cache(async (): Promise<HistorySettings> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/me/history/settings");
  if (error) {
    throw new Error(error.error ?? (await getT("statistics"))("api.loadHistorySettingsFailed"));
  }
  return data.data ?? {};
});
