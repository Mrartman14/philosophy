// src/features/preferences/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";
import { Tags } from "@/api/tags";
import {
  canSendPush,
  canSubscribePush,
  canUpdatePreferences,
} from "./permissions";
import {
  PreferencesUpdateSchema,
  PushSendSchema,
  PushSubscribeSchema,
  PushUnsubscribeSchema,
} from "./schemas";
import type { Preferences } from "./types";

type ApiError = { code?: string; error?: string };

/** Маппинг кодов httputil/apperror бекенда на доменные ошибки фронта. */
function rethrowApiError(err: ApiError | undefined): never {
  switch (err?.code) {
    case "FORBIDDEN":
      throw new ForbiddenError("role", err.error);
    case "SUSPENDED":
      throw new ForbiddenError("status", err.error);
    case "NOT_CONFIGURED":
      throw new Error("Push-уведомления не настроены на сервере.");
    case "VALIDATION_ERROR":
      throw new Error(err.error ?? "Сервер отклонил данные формы.");
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}

export const updatePreferences = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canUpdatePreferences);
  const input = parseFormData(PreferencesUpdateSchema, formData);
  const api = await createApiClient();
  // PATCH-body в schema.ts типизирован как Record<string, never> (swagger не
  // описывает partial-формат). Реальный формат — частичный
  // preference.Preferences (merge-семантика бекенда,
  // philosophy-api internal/preference/service.go). Регенерация schema.ts
  // запрещена (CLAUDE.md) — поэтому cast.
  const { data, error } = await api.PATCH("/api/me/preferences", {
    body: { reading_mode: input.reading_mode } as never,
  });
  if (error) rethrowApiError(error as ApiError);
  revalidateEntity(Tags.PREFERENCES);
  return (data?.data ?? null) as Preferences | null;
});

/**
 * Вызывается из push-subscription-toggle с результатом
 * PushSubscription.toJSON() — поэтому вход unknown + Zod-парсинг.
 */
export const subscribePush = createAction(async (rawSubscription: unknown) => {
  const me = await getMe();
  requireCapability(me, canSubscribePush);
  const input = PushSubscribeSchema.parse(rawSubscription);
  const api = await createApiClient();
  const { error } = await api.POST("/api/push/subscribe", { body: input });
  if (error) rethrowApiError(error as ApiError);
  return undefined;
});

export const unsubscribePush = createAction(async (rawEndpoint: string) => {
  const me = await getMe();
  requireCapability(me, canSubscribePush);
  const { endpoint } = PushUnsubscribeSchema.parse({ endpoint: rawEndpoint });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/push/subscribe", {
    body: { endpoint },
  });
  if (error) rethrowApiError(error as ApiError);
  return undefined;
});

export const sendPushBroadcast = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canSendPush);
  const input = parseFormData(PushSendSchema, formData);
  const api = await createApiClient();
  const { error } = await api.POST("/api/admin/push/send", {
    body: {
      title: input.title,
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.url !== undefined ? { url: input.url } : {}),
    },
  });
  if (error) rethrowApiError(error as ApiError);
  // Бекенд отвечает 202 Accepted — рассылка асинхронная.
  return true;
});
