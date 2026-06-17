// src/features/preferences/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import {
  rethrowApiError,
  type ApiErrorMessages,
} from "@/utils/api-error";
import { unwrap } from "@/utils/api-unwrap";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { idempotencyHeaders } from "@/utils/idempotency";
import { getMe } from "@/utils/me";
import { requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

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


/** Доменные коды apperror этого слайса. SUSPENDED/FORBIDDEN и фоллбек
 * "err.error ?? Ошибка сервера" (бывшие BAD_REQUEST/VALIDATION_ERROR, которые
 * предпочитали сообщение бека) — в централизованном rethrowApiError. */
const ERRORS: ApiErrorMessages = {
  NOT_CONFIGURED: "Push-уведомления не настроены на сервере.",
};

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
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.PREFERENCES);
  return unwrap(data);
}, "updatePreferences");

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
  if (error) rethrowApiError(error, ERRORS);
  return undefined;
}, "subscribePush");

export const unsubscribePush = createAction(async (rawEndpoint: string) => {
  const me = await getMe();
  requireCapability(me, canSubscribePush);
  const { endpoint } = PushUnsubscribeSchema.parse({ endpoint: rawEndpoint });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/push/subscribe", {
    body: { endpoint },
  });
  if (error) rethrowApiError(error, ERRORS);
  return undefined;
}, "unsubscribePush");

export const sendPushBroadcast = createFormAction(async (formData, ctx) => {
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
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  // Бекенд отвечает 202 Accepted — рассылка асинхронная.
  return true;
}, "sendPushBroadcast");
