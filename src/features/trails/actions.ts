// src/features/trails/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { getT } from "@/i18n";
import {
  rethrowApiError,
  type ApiError,
  type ApiErrorMessageKeys,
} from "@/utils/api-error";
import { unwrap } from "@/utils/api-unwrap";
import {
  ApiMessageError,
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { idempotencyHeaders } from "@/utils/idempotency";
import { getMe } from "@/utils/me";
import { ifMatchHeader } from "@/utils/optimistic-lock";
import { requireActive, requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import { canCreateTrail, canListAdminTrails } from "./permissions";
import {
  makeTrailCreateSchema,
  makeTrailMetaSchema,
  TrailVisibilitySchema,
  makeTrailItemsSchema,
  TrailIdSchema,
} from "./schemas";


/** Доменные коды маршрутов → ключ каталога errors. */
const ERRORS: ApiErrorMessageKeys = {
  PUBLIC_IMMUTABLE: "TRAIL_PUBLIC_IMMUTABLE",
};

/** Локальная обёртка: SetItems-ошибки приходят без uppercase-кода (строки
 * бекенда) — распознаём по тексту, остальное делегируем централизованному
 * `rethrowApiError` (роль/статус-403, дефолты, фоллбек). */
function rethrowTrailApiError(err: ApiError | undefined): never {
  const msg = err?.error ?? "";
  if (msg.startsWith("duplicate document_id")) {
    throw new ApiMessageError("TRAIL_DUPLICATE_DOCUMENT");
  }
  if (msg.startsWith("document not found")) {
    throw new ApiMessageError("TRAIL_DOCUMENT_NOT_FOUND");
  }
  rethrowApiError(err, ERRORS);
}

/** POST /api/trails. Гейт — trail.create. */
export const createTrail = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canCreateTrail);
  const t = await getT("validation");
  const input = parseFormData(makeTrailCreateSchema(t), formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/trails", {
    body: {
      title: input.title,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.visibility ? { visibility: input.visibility } : {}),
    },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowTrailApiError(error);
  revalidateEntity(Tags.TRAILS);
  return unwrap(data);
}, "createTrail");

/** PUT /api/trails/{id} (метаданные: title + description). Owner-only enforce'ит бек. */
export const updateTrailMeta = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireActive(me);
  const t = await getT("validation");
  const input = parseFormData(makeTrailMetaSchema(t), formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/trails/{id}", {
    params: { path: { id: input.id }, header: ifMatchHeader(formData, "маршрута") },
    body: { title: input.title, description: input.description },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowTrailApiError(error);
  revalidateEntity(Tags.TRAILS, input.id);
  revalidateEntity(Tags.TRAILS);
  return unwrap(data);
}, "updateTrailMeta");

/** PUT /api/trails/{id}/items (bulk-replace упорядоченного списка документов). Owner-only. */
export const setTrailItems = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireActive(me);
  const t = await getT("validation");
  const input = parseFormData(makeTrailItemsSchema(t), formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/trails/{id}/items", {
    params: { path: { id: input.id }, header: ifMatchHeader(formData, "маршрута") },
    body: { document_ids: input.document_ids },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowTrailApiError(error);
  revalidateEntity(Tags.TRAILS, input.id);
  revalidateEntity(Tags.TRAILS);
  return unwrap(data);
}, "setTrailItems");

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
  if (error) rethrowTrailApiError(error);
  revalidateEntity(Tags.TRAILS, input.id);
  revalidateEntity(Tags.TRAILS);
  return unwrap(data);
}, "setTrailVisibility");

/** DELETE /api/trails/{id}. Owner (любая видимость) или admin delete_any (public) — enforce'ит бек. */
export const deleteTrail = createAction(async (rawId: string) => {
  const me = await getMe();
  requireActive(me);
  const { id } = TrailIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/trails/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowTrailApiError(error);
  revalidateEntity(Tags.TRAILS);
  return undefined;
}, "deleteTrail");

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
  if (error) rethrowTrailApiError(error);
  revalidateEntity(Tags.TRAILS);
  return undefined;
}, "adminDeleteTrail");
