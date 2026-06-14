// src/features/annotations/actions.ts
"use server";
import "server-only";
import { cookies } from "next/headers";
import { createApiClient } from "@/api/client";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireCapability } from "@/utils/permissions";
import { handleCommonApiError, type ApiError } from "@/utils/api-error";
import { revalidateEntity } from "@/utils/revalidate";
import { Tags } from "@/api/tags";
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
import { getAnnotationById } from "./api";
import { PER_ENTITY_PATH, type Annotation } from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

/** Маппинг UPPER_SNAKE-кодов бекенда на доменные ошибки фронта. */
function rethrowApiError(err: ApiError | undefined): never {
  switch (err?.code) {
    case "SUSPENDED":
      throw new ForbiddenError("status", err.error);
    case "BLOCKS_EMPTY":
      throw new Error("Тело аннотации не может быть пустым.");
    case "BLOCKS_INVALID":
      throw new Error("Тело аннотации не прошло валидацию AST.");
    case "ANCHOR_INVALID":
      throw new Error("Некорректная привязка (якорь) аннотации.");
    case "INVALID_PARENT_TYPE":
      throw new Error("Аннотации недоступны для этого типа сущности.");
    case "REF_NOT_FOUND":
      throw new Error("Одна из ссылок указывает на несуществующий объект.");
    case "REQUEST_BODY_TOO_LARGE":
      throw new Error("Аннотация слишком большая.");
  }
  handleCommonApiError(err);
}

/**
 * Создание аннотации. Реальный роут — пер-сущностный POST
 * `/api/{entity}/{id}/annotations` (§10.1), которого нет в openapi-fetch
 * (там фикция /api/entities/{type}/{id}/annotations). Поэтому ручной fetch
 * с токеном из cookie. Тело — annotation.CreateRequest (тип валиден).
 * visibility ФИКСИРУЕТСЯ здесь и не меняется (§6.8).
 */
export const createAnnotation = createFormAction(async (formData) => {
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

  const res = await fetch(
    `${API_URL}/api/${seg}/${encodeURIComponent(input.parent_entity_id)}/annotations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as ApiError;
    rethrowApiError(errBody);
  }
  const json = (await res.json()) as { data?: Annotation };
  revalidateEntity(Tags.ANNOTATIONS);
  return (json.data ?? null);
});

/**
 * Редактирование. Только автор (бек owner-only). blocks обязательны, anchor
 * опционален. visibility менять нельзя — её нет в UpdateRequest.
 */
export const updateAnnotation = createFormAction(async (formData) => {
  const me = await getMe();
  const input = parseFormData(AnnotationUpdateSchema, formData);

  // Defense-in-depth: грузим аннотацию, проверяем ownership.
  const existing = await getAnnotationById(input.id);
  if (!existing) throw new Error("Аннотация не найдена.");
  requireCapability(me, (m) => canEditAnnotation(m, existing));

  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/annotations/{id}", {
    params: { path: { id: input.id } },
    body: {
      blocks: input.blocks as never,
      ...(input.anchor !== undefined ? { anchor: input.anchor as never } : {}),
    },
  });
  if (error) rethrowApiError(error as ApiError);
  revalidateEntity(Tags.ANNOTATIONS, input.id);
  revalidateEntity(Tags.ANNOTATIONS);
  return (data?.data ?? null) as Annotation | null;
});

/** Удаление своей аннотации (DELETE /api/annotations/{id}). */
export const deleteAnnotation = createAction(async (rawId: string) => {
  const me = await getMe();
  const { id } = AnnotationIdSchema.parse({ id: rawId });
  const existing = await getAnnotationById(id);
  if (!existing) throw new Error("Аннотация не найдена.");
  requireCapability(me, (m) => canDeleteAnnotation(m, existing));

  const api = await createApiClient();
  const { error } = await api.DELETE("/api/annotations/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error as ApiError);
  revalidateEntity(Tags.ANNOTATIONS, id);
  revalidateEntity(Tags.ANNOTATIONS);
  return undefined;
});

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
  if (error) rethrowApiError(error as ApiError);
  revalidateEntity(Tags.ANNOTATIONS, id);
  revalidateEntity(Tags.ANNOTATIONS);
  return undefined;
});
