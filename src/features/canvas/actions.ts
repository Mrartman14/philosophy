// src/features/canvas/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { getT } from "@/i18n";
import { rethrowApiError, type ApiErrorMessageKeys } from "@/utils/api-error";
import { unwrap } from "@/utils/api-unwrap";
import { createAction, createFormAction, parseFormData } from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { requireActive, requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import { canCreateCanvas } from "./permissions";
import {
  makeCanvasCreateSchema,
  makeCanvasUpdateSchema,
  makeCanvasVisibilitySchema,
  makeCanvasIdSchema,
} from "./schemas";
import type { CanvasData } from "./types";

/** Доменные коды canvas → ключ каталога `errors` (Case 2 i18n-миграции).
 * role-403/SUSPENDED/BANNED и REF_NOT_FOUND обрабатывает централизованный
 * `rethrowApiError`. VERSION_MISMATCH переопределяет generic DEFAULT_MESSAGES
 * canvas-специфичным ключом. */
const ERRORS: ApiErrorMessageKeys = {
  PUBLIC_IMMUTABLE: "PUBLIC_IMMUTABLE",
  // optimistic lock: бек шлёт VERSION_MISMATCH (412) на устаревший If-Match.
  // Прежний generic PRECONDITION_FAILED для этого потока больше не эмитится.
  VERSION_MISMATCH: "CANVAS_VERSION_MISMATCH",
  PAYLOAD_TOO_LARGE: "CANVAS_PAYLOAD_TOO_LARGE",
  REQUEST_BODY_TOO_LARGE: "CANVAS_PAYLOAD_TOO_LARGE",
  VALIDATION_ERROR: "CANVAS_VALIDATION_ERROR",
  BAD_REQUEST: "CANVAS_VALIDATION_ERROR",
};

/** POST /api/canvases (JSON). Гейт — canvas.create. */
export const createCanvas = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canCreateCanvas);
  const t = await getT("validation");
  const input = parseFormData(makeCanvasCreateSchema(t), formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/canvases", {
    body: {
      title: input.title,
      ...(input.visibility ? { visibility: input.visibility } : {}),
      data: input.data as CanvasData,
    },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.CANVASES);
  return unwrap(data);
}, "createCanvas");

/**
 * PUT /api/canvases/{id} (полная замена title+data). Owner-only enforce'ит бек.
 * Требует If-Match — это strong-ETag `"<version>"` (монотонный version-токен,
 * см. docs/conventions/optimistic-locking.md). Берётся из заголовка ETag ответа
 * GET (скрытое поле `etag` формы) и шлётся как есть, кавычки включены — бек
 * снимает их сам. Поток формат-агностичен (эхо сырого заголовка), поэтому
 * миграция бека с updated_at-as-ETag на version-as-ETag прозрачна для фронта.
 * If-Match типизирован в schema.ts как обязательный header-параметр PUT —
 * передаём через params.header (type-safe, без кастомного fetch-fallback).
 * Устаревшее значение → 412 VERSION_MISMATCH.
 */
export const updateCanvas = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const t = await getT("validation");
  const input = parseFormData(makeCanvasUpdateSchema(t), formData);
  const etag = formData.get("etag");
  if (typeof etag !== "string" || etag === "") {
    throw new Error(t("canvas.etagMissing"));
  }
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/canvases/{id}", {
    params: {
      path: { id: input.id },
      header: { "If-Match": etag },
    },
    body: { title: input.title, data: input.data as CanvasData },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.CANVASES, input.id);
  revalidateEntity(Tags.CANVASES);
  return unwrap(data);
}, "updateCanvas");

/** PATCH /api/canvases/{id}/visibility. UI шлёт только private→public. */
export const setCanvasVisibility = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const t = await getT("validation");
  const input = parseFormData(makeCanvasVisibilitySchema(t), formData);
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/canvases/{id}/visibility", {
    params: { path: { id: input.id } },
    body: { visibility: input.visibility },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.CANVASES, input.id);
  revalidateEntity(Tags.CANVASES);
  return unwrap(data);
}, "setCanvasVisibility");

/** DELETE /api/canvases/{id}. Owner (любая) или admin delete_any (public) — enforce'ит бек. */
export const deleteCanvas = createAction(async (rawId: string) => {
  const me = await getMe();
  requireActive(me);
  const t = await getT("validation");
  const { id } = makeCanvasIdSchema(t).parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/canvases/{id}", { params: { path: { id } } });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.CANVASES);
  return undefined;
}, "deleteCanvas");
