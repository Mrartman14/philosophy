// src/features/notifications/actions.ts
"use server";
import "server-only";

import { createApiClient } from "@/api/client";
import { rethrowApiError, type ApiError } from "@/utils/api-error";
import { createAction } from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireActive } from "@/utils/permissions";

import {
  getNotifications,
  getNotificationCounts,
  type NotificationListResult,
} from "./api";
import { canUseNotifications } from "./permissions";
import type { NotificationCounts } from "./types";

// --- Мутации (залогинен + active) ---

export const markRead = createAction(async (id: string) => {
  const me = await getMe();
  requireActive(me);
  const api = await createApiClient();
  const { error } = await api.POST("/api/me/notifications/{id}/read", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error as ApiError);
  return undefined;
});

// ВАЖНО: для action'ов БЕЗ входа указываем дженерики `<void, TOutput>` явно.
// Без них `createAction(async () => …)` выводит `TInput = unknown`, и
// возвращаемая функция требует обязательный аргумент → `markAllSeen()` /
// `fetchCounts()` и передача в `run` (ждёт `() => …`) НЕ компилируются
// («Expected 1-2 arguments, but got 0»). `TInput = void` делает параметр
// опускаемым (правило void-параметров TS) и совместимым с `() => …`.
export const markAllRead = createAction<void, void>(async () => {
  const me = await getMe();
  requireActive(me);
  const api = await createApiClient();
  const { error } = await api.POST("/api/me/notifications/read-all", {});
  if (error) rethrowApiError(error as ApiError);
  return undefined;
});

export const markAllSeen = createAction<void, void>(async () => {
  const me = await getMe();
  requireActive(me);
  const api = await createApiClient();
  const { error } = await api.POST("/api/me/notifications/seen-all", {});
  if (error) rethrowApiError(error as ApiError);
  return undefined;
});

export const subscribeDocument = createAction(async (documentId: string) => {
  const me = await getMe();
  requireActive(me);
  const api = await createApiClient();
  const { error } = await api.POST("/api/documents/{id}/subscribe", {
    params: { path: { id: documentId } },
  });
  if (error) rethrowApiError(error as ApiError);
  return undefined;
});

export const unsubscribeDocument = createAction(async (documentId: string) => {
  const me = await getMe();
  requireActive(me);
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/documents/{id}/subscribe", {
    params: { path: { id: documentId } },
  });
  if (error) rethrowApiError(error as ApiError);
  return undefined;
});

// --- Read-actions для клиентских островков (нужен залогиненный) ---

export const fetchCounts = createAction<void, NotificationCounts>(async () => {
  const me = await getMe();
  if (!canUseNotifications(me)) throw new ForbiddenError("guest");
  return getNotificationCounts();
});

export const fetchNotifications = createAction(
  async (input: { offset: number; limit: number }): Promise<NotificationListResult> => {
    const me = await getMe();
    if (!canUseNotifications(me)) throw new ForbiddenError("guest");
    return getNotifications(input.offset, input.limit);
  },
);
