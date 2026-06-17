// src/features/annotations/actions.ts
"use server";
import "server-only";
import { cookies } from "next/headers";

import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { instrumentedFetch } from "@/services/observability/server-fetch";
import {
  rethrowApiError,
  type ApiError,
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
import { ifMatchHeader } from "@/utils/optimistic-lock";
import { requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import { getAnnotationById } from "./api";
import {
  canCreateAnnotation,
  canDeleteAnnotation,
  canEditAnnotation,
  canAdminDeleteAnnotation,
} from "./permissions";
import {
  AnnotationCreateSchema,
  AnnotationUpdateSchema,
  AnnotationIdSchema,
} from "./schemas";
import { PER_ENTITY_PATH, type Annotation } from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

/** Маппинг UPPER_SNAKE-кодов бекенда на доменные ошибки фронта. */
const ERRORS: ApiErrorMessages = {
  BLOCKS_EMPTY: "Тело аннотации не может быть пустым.",
  BLOCKS_INVALID: "Тело аннотации не прошло валидацию AST.",
  ANCHOR_INVALID: "Некорректная привязка (якорь) аннотации.",
  INVALID_PARENT_TYPE: "Аннотации недоступны для этого типа сущности.",
  REQUEST_BODY_TOO_LARGE: "Аннотация слишком большая.",
};

/**
 * Создание аннотации. Реальный роут — пер-сущностный POST
 * `/api/{entity}/{id}/annotations` (§10.1), которого нет в openapi-fetch
 * (там фикция /api/entities/{type}/{id}/annotations). Поэтому ручной fetch
 * с токеном из cookie. Тело — annotation.CreateRequest (тип валиден).
 * visibility ФИКСИРУЕТСЯ здесь и не меняется (§6.8).
 */
export const createAnnotation = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canCreateAnnotation);
  const input = parseFormData(AnnotationCreateSchema, formData);

  const token = (await cookies()).get("token")?.value;
  const seg = PER_ENTITY_PATH[input.parent_entity_type];
  const body: Record<string, unknown> = {
    blocks: input.blocks,
    visibility: input.visibility,
  };
  if (input.anchor !== undefined) body.anchor = input.anchor;

  const res = await instrumentedFetch(
    `${API_URL}/api/${seg}/${encodeURIComponent(input.parent_entity_id)}/annotations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...idempotencyHeaders(ctx.idempotencyKey),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
    { surface: "annotations.create" },
  );
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as ApiError;
    rethrowApiError(errBody, ERRORS);
  }
  const json = (await res.json()) as { data?: Annotation };
  revalidateEntity(Tags.ANNOTATIONS);
  return (json.data ?? null);
}, "createAnnotation");

/**
 * Редактирование. Только автор (бек owner-only). blocks обязательны, anchor
 * опционален. visibility менять нельзя — её нет в UpdateRequest. Content-edit
 * PUT требует `If-Match: "<version>"` (optimistic lock, см.
 * docs/conventions/optimistic-locking.md). Версия берётся из
 * `annotation.version` (тело single-GET) через hidden-поле формы.
 * Отсутствие → 428, расхождение → 412.
 */
export const updateAnnotation = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  const input = parseFormData(AnnotationUpdateSchema, formData);

  // Defense-in-depth: грузим аннотацию, проверяем ownership.
  const existing = await getAnnotationById(input.id);
  if (!existing) throw new Error("Аннотация не найдена.");
  requireCapability(me, (m) => canEditAnnotation(m, existing));

  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/annotations/{id}", {
    params: {
      path: { id: input.id },
      header: ifMatchHeader(formData, "аннотации"),
    },
    body: {
      blocks: input.blocks,
      ...(input.anchor !== undefined ? { anchor: input.anchor as never } : {}),
    },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.ANNOTATIONS, input.id);
  revalidateEntity(Tags.ANNOTATIONS);
  return unwrap(data);
}, "updateAnnotation");

/** Удаление своей аннотации (DELETE /api/annotations/{id}). */
export const deleteAnnotation = createAction(async (rawId: string, ctx) => {
  const me = await getMe();
  const { id } = AnnotationIdSchema.parse({ id: rawId });
  const existing = await getAnnotationById(id);
  if (!existing) throw new Error("Аннотация не найдена.");
  requireCapability(me, (m) => canDeleteAnnotation(m, existing));

  const api = await createApiClient();
  const { error } = await api.DELETE("/api/annotations/{id}", {
    params: { path: { id } },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.ANNOTATIONS, id);
  revalidateEntity(Tags.ANNOTATIONS);
  return undefined;
}, "deleteAnnotation");

/**
 * Admin-удаление публичной аннотации (DELETE /api/admin/annotations/{id}).
 * Капа annotation.delete_any + visibility === "public" (§6.2). Для private
 * бек вернёт 404 — UI кнопку для private не показывает.
 */
export const adminDeleteAnnotation = createAction(async (rawId: string) => {
  const me = await getMe();
  const { id } = AnnotationIdSchema.parse({ id: rawId });
  const existing = await getAnnotationById(id);
  if (!existing) throw new Error("Аннотация не найдена.");
  requireCapability(me, (m) => canAdminDeleteAnnotation(m, existing));

  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/annotations/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.ANNOTATIONS, id);
  revalidateEntity(Tags.ANNOTATIONS);
  return undefined;
}, "adminDeleteAnnotation");
