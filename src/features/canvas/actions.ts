// src/features/canvas/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { rethrowApiError, type ApiErrorMessages } from "@/utils/api-error";
import { createAction, createFormAction, parseFormData } from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { requireActive, requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import { canCreateCanvas } from "./permissions";
import {
  CanvasCreateSchema,
  CanvasUpdateSchema,
  CanvasVisibilitySchema,
  CanvasIdSchema,
} from "./schemas";
import type { Canvas, CanvasData } from "./types";

/** Доменные коды canvas → русский текст. role-403/SUSPENDED/BANNED и REF_NOT_FOUND
 * обрабатывает централизованный `rethrowApiError`. VALIDATION_ERROR/BAD_REQUEST —
 * фиксированный текст (не `err.error ??`). */
const ERRORS: ApiErrorMessages = {
  PUBLIC_IMMUTABLE: "Публичный канвас нельзя сделать приватным.",
  PRECONDITION_FAILED:
    "Канвас изменён в другом месте — обновите страницу и повторите.",
  PAYLOAD_TOO_LARGE: "Данные графа слишком большие (лимит 1 МиБ).",
  REQUEST_BODY_TOO_LARGE: "Данные графа слишком большие (лимит 1 МиБ).",
  VALIDATION_ERROR: "Граф не прошёл валидацию (узлы/рёбра/ссылки на сущности).",
  BAD_REQUEST: "Граф не прошёл валидацию (узлы/рёбра/ссылки на сущности).",
};

/** POST /api/canvases (JSON). Гейт — canvas.create. */
export const createCanvas = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canCreateCanvas);
  const input = parseFormData(CanvasCreateSchema, formData);
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
  return (data.data ?? null) as Canvas | null;
});

/**
 * PUT /api/canvases/{id} (полная замена title+data). Owner-only enforce'ит бек.
 * Требует If-Match — берётся из заголовка ETag ответа GET (скрытое поле `etag`
 * формы), а НЕ из JSON canvas.updated_at: Go сериализует updated_at как
 * RFC3339Nano и обрезает хвостовые нули мс (`.000Z` → `Z`), тогда как бек
 * сравнивает по фиксированному `.000Z` — это давало ложный 412 (см. api.ts /
 * handler.go). Значение шлётся как есть (кавычки включены, бек снимает их сам).
 * If-Match типизирован в schema.ts как обязательный header-параметр PUT —
 * передаём через params.header (type-safe, без кастомного fetch-fallback).
 */
export const updateCanvas = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const input = parseFormData(CanvasUpdateSchema, formData);
  const etag = formData.get("etag");
  if (typeof etag !== "string" || etag === "") {
    throw new Error("Отсутствует версия канваса (ETag) — обновите страницу.");
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
  return (data.data ?? null) as Canvas | null;
});

/** PATCH /api/canvases/{id}/visibility. UI шлёт только private→public. */
export const setCanvasVisibility = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const input = parseFormData(CanvasVisibilitySchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/canvases/{id}/visibility", {
    params: { path: { id: input.id } },
    body: { visibility: input.visibility },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.CANVASES, input.id);
  revalidateEntity(Tags.CANVASES);
  return (data.data ?? null) as Canvas | null;
});

/** DELETE /api/canvases/{id}. Owner (любая) или admin delete_any (public) — enforce'ит бек. */
export const deleteCanvas = createAction(async (rawId: string) => {
  const me = await getMe();
  requireActive(me);
  const { id } = CanvasIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/canvases/{id}", { params: { path: { id } } });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.CANVASES);
  return undefined;
});
