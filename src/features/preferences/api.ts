// src/features/preferences/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";

import type { Preferences } from "./types";

/**
 * Настройки текущего пользователя. Данные пер-юзерные — НЕ оборачивать в
 * unstable_cache: cross-request кеш протёк бы между пользователями.
 * React.cache дедуплицирует вызовы в рамках одного запроса.
 *
 * Вызывать только после проверки getMe() !== null (требует auth-токен).
 */
export const getPreferences = cache(async (): Promise<Preferences> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/me/preferences");
  if (error) {
    throw new Error(error.error ?? "Не удалось загрузить настройки");
  }
  return data?.data ?? {};
});

/**
 * Публичный VAPID-ключ с бекенда (НЕ из env — env-заглушка уходит вместе с
 * push-service в foundation-touch части B). Возвращает null, если push на
 * бекенде не сконфигурирован (503 NOT_CONFIGURED) или ключ пуст — страница
 * настроек должна работать и без push.
 */
export const getVapidKey = cache(async (): Promise<string | null> => {
  const api = await createApiClient();
  const { data, response } = await api.GET("/api/push/vapid-key");
  if (!response.ok) return null;
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- пустая строка "" — невалидный VAPID-ключ, трактуется как «не задано»
  return data?.data?.publicKey || null;
});
