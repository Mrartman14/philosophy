// src/features/canvas/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { createAction, createFormAction, parseFormData } from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";
import { Tags } from "@/api/tags";
import { canCreateCanvas } from "./permissions";
import {
  CanvasCreateSchema,
  CanvasUpdateSchema,
  CanvasVisibilitySchema,
  CanvasIdSchema,
} from "./schemas";
import type { Canvas, CanvasData } from "./types";

type ApiError = { code?: string; error?: string };

/** Маппинг UPPER_SNAKE_CASE кодов бека в понятный русский текст. */
function rethrowApiError(err: ApiError | undefined): never {
  switch (err?.code) {
    case "FORBIDDEN":
      throw new ForbiddenError("role", err.error);
    case "PUBLIC_IMMUTABLE":
      throw new Error("Публичный канвас нельзя сделать приватным.");
    case "PRECONDITION_FAILED":
      throw new Error("Канвас изменён в другом месте — обновите страницу и повторите.");
    case "PAYLOAD_TOO_LARGE":
    case "REQUEST_BODY_TOO_LARGE":
      throw new Error("Данные графа слишком большие (лимит 1 МиБ).");
    case "VALIDATION_ERROR":
    case "BAD_REQUEST":
      throw new Error("Граф не прошёл валидацию (узлы/рёбра/ссылки на сущности).");
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}

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
      ...(input.data ? { data: input.data as CanvasData } : {}),
    },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.CANVASES);
  return (data?.data ?? null) as Canvas | null;
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
  if (!me || me.status !== "active") throw new ForbiddenError(me ? "status" : "guest");
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
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.CANVASES, input.id);
  revalidateEntity(Tags.CANVASES);
  return (data?.data ?? null) as Canvas | null;
});

/** PATCH /api/canvases/{id}/visibility. UI шлёт только private→public. */
export const setCanvasVisibility = createFormAction(async (formData) => {
  const me = await getMe();
  if (!me || me.status !== "active") throw new ForbiddenError(me ? "status" : "guest");
  const input = parseFormData(CanvasVisibilitySchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/canvases/{id}/visibility", {
    params: { path: { id: input.id } },
    body: { visibility: input.visibility },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.CANVASES, input.id);
  revalidateEntity(Tags.CANVASES);
  return (data?.data ?? null) as Canvas | null;
});

/** DELETE /api/canvases/{id}. Owner (любая) или admin delete_any (public) — enforce'ит бек. */
export const deleteCanvas = createAction(async (rawId: string) => {
  const me = await getMe();
  if (!me || me.status !== "active") throw new ForbiddenError(me ? "status" : "guest");
  const { id } = CanvasIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/canvases/{id}", { params: { path: { id } } });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.CANVASES);
  return undefined;
});
