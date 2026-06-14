// src/features/trails/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { handleCommonApiError, type ApiError } from "@/utils/api-error";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { requireActive, requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import { canCreateTrail, canListAdminTrails } from "./permissions";
import {
  TrailCreateSchema,
  TrailMetaSchema,
  TrailVisibilitySchema,
  TrailItemsSchema,
  TrailIdSchema,
} from "./schemas";
import type { Trail, TrailWithItems } from "./types";

/** Маппинг кодов/сообщений бека в понятный русский текст. */
function rethrowApiError(err: ApiError | undefined): never {
  switch (err?.code) {
    case "PUBLIC_IMMUTABLE":
      throw new Error("Публичный маршрут нельзя сделать приватным — только удалить.");
  }
  // SetItems-ошибки приходят без uppercase-кода (строки бекенда). Распознаём по тексту.
  const msg = err?.error ?? "";
  if (msg.startsWith("duplicate lecture_id")) {
    throw new Error("Лекция добавлена в маршрут дважды. Уберите дубликат.");
  }
  if (msg.startsWith("lecture not found")) {
    throw new Error("Одна из лекций не найдена. Обновите список и повторите.");
  }
  handleCommonApiError(err);
}

/** POST /api/trails. Гейт — trail.create. */
export const createTrail = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canCreateTrail);
  const input = parseFormData(TrailCreateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/trails", {
    body: {
      title: input.title,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.visibility ? { visibility: input.visibility } : {}),
    },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.TRAILS);
  return (data?.data ?? null) as Trail | null;
});

/** PUT /api/trails/{id} (метаданные: title + description). Owner-only enforce'ит бек. */
export const updateTrailMeta = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const input = parseFormData(TrailMetaSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/trails/{id}", {
    params: { path: { id: input.id } },
    body: { title: input.title, description: input.description },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.TRAILS, input.id);
  revalidateEntity(Tags.TRAILS);
  return (data?.data ?? null) as Trail | null;
});

/** PUT /api/trails/{id}/items (bulk-replace упорядоченного списка лекций). Owner-only. */
export const setTrailItems = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const input = parseFormData(TrailItemsSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/trails/{id}/items", {
    params: { path: { id: input.id } },
    body: { lecture_ids: input.lecture_ids },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.TRAILS, input.id);
  revalidateEntity(Tags.TRAILS);
  return (data?.data ?? null) as TrailWithItems | null;
});

/** PATCH /api/trails/{id}/visibility. UI шлёт только private→public. Owner-only. */
export const setTrailVisibility = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const input = parseFormData(TrailVisibilitySchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/trails/{id}/visibility", {
    params: { path: { id: input.id } },
    body: { visibility: input.visibility },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.TRAILS, input.id);
  revalidateEntity(Tags.TRAILS);
  return (data?.data ?? null) as Trail | null;
});

/** DELETE /api/trails/{id}. Owner (любая видимость) или admin delete_any (public) — enforce'ит бек. */
export const deleteTrail = createAction(async (rawId: string) => {
  const me = await getMe();
  requireActive(me);
  const { id } = TrailIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/trails/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.TRAILS);
  return undefined;
});

/**
 * DELETE /api/trails/{id} от имени админа из admin-списка. На беке отдельного
 * admin-DELETE-роута нет (см. main.go) — модерация идёт обычным DELETE, который
 * допускает delete_any на public. Гейт UI — trail.delete_any.
 */
export const adminDeleteTrail = createAction(async (rawId: string) => {
  const me = await getMe();
  requireCapability(me, canListAdminTrails);
  const { id } = TrailIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/trails/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.TRAILS);
  return undefined;
});
