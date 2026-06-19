// src/features/banners/actions.ts
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
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { idempotencyHeaders } from "@/utils/idempotency";
import { getMe } from "@/utils/me";
import { ifMatchHeader } from "@/utils/optimistic-lock";
import { requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import {
  canCreateBanner,
  canUpdateBanner,
  canDeleteBanner,
  canDismissBanner,
} from "./permissions";
import {
  makeBannerCreateSchema,
  makeBannerUpdateSchema,
  BannerIdSchema,
} from "./schemas";

/** Доменные коды баннеров → ключ каталога errors. Бек пишет code в UPPER_SNAKE_CASE
 * (internal/apperror, middleware/auth.go). REF_NOT_FOUND и BLOCKS_HAVE_ANCHORS —
 * из DEFAULT_MESSAGES api-error.ts.
 * CONFLICT (409) — используется только в dismissBanner (dismissible=false). */
const ERRORS: ApiErrorMessageKeys = {
  INVALID_COLOR: "BANNER_INVALID_COLOR",
  INVALID_DATE: "BANNER_INVALID_DATE",
  INVALID_EVENT: "BANNER_INVALID_EVENT",
  BLOCKS_INVALID: "BANNER_BLOCKS_INVALID",
  BLOCK_REFERENCED: "BANNER_BLOCK_REFERENCED",
  CONFLICT: "BANNER_NOT_DISMISSIBLE",
};

export const createBanner = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canCreateBanner);
  const t = await getT("validation");
  const input = parseFormData(makeBannerCreateSchema(t), formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/admin/banners", {
    body: {
      background_color: input.background_color,
      target_audience: input.target_audience,
      dismissible: input.dismissible,
      start_at: input.start_at,
      ...(input.end_at ? { end_at: input.end_at } : {}),
      ...(input.event_id ? { event_id: input.event_id } : {}),
    },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.BANNERS);
  return unwrap(data);
}, "createBanner");

/**
 * PUT /api/admin/banners/{id}. Content-edit PUT требует `If-Match: "<version>"`
 * (optimistic lock, см. docs/conventions/optimistic-locking.md). Версия берётся
 * из `banner.version` (тело single-GET) через hidden-поле формы. Отсутствие →
 * 428, расхождение → 412.
 */
export const updateBanner = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canUpdateBanner);
  const t = await getT("validation");
  const input = parseFormData(makeBannerUpdateSchema(t), formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/admin/banners/{id}", {
    params: {
      path: { id: input.id },
      header: ifMatchHeader(formData, "баннера"),
    },
    body: {
      background_color: input.background_color,
      target_audience: input.target_audience,
      dismissible: input.dismissible,
      start_at: input.start_at,
      blocks: input.blocks,
      // event_id отправляем ВСЕГДА: пустая строка = «отвязать событие»
      // (repo.Update бекенда: "" → SQL NULL).
      event_id: input.event_id,
      // Известное ограничение бекенда: omitted-поле НЕ очищает значение
      // (UpdateRequest — частичный апдейт), а пустая строка end_at не пройдёт
      // RFC3339-парсинг. Очистка end_at невозможна — см. секцию рисков плана.
      ...(input.end_at ? { end_at: input.end_at } : {}),
    },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.BANNERS, input.id);
  revalidateEntity(Tags.BANNERS);
  return unwrap(data);
}, "updateBanner");

export const deleteBanner = createAction(async (rawId: string, ctx) => {
  const me = await getMe();
  requireCapability(me, canDeleteBanner);
  const { id } = BannerIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/banners/{id}", {
    params: { path: { id } },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.BANNERS);
  return undefined;
}, "deleteBanner");

export const dismissBanner = createAction(async (rawId: string) => {
  const me = await getMe();
  requireCapability(me, canDismissBanner);
  const { id } = BannerIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.POST("/api/banners/{id}/dismiss", {
    params: { path: { id } },
  });
  // dismissible=false → 409 CONFLICT → BANNER_NOT_DISMISSIBLE в ERRORS-карте.
  if (error) rethrowApiError(error as ApiError, ERRORS);
  revalidateEntity(Tags.BANNERS);
  return undefined;
}, "dismissBanner");
