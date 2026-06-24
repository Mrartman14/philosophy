// src/features/annotations/actions.ts
"use server";
import "server-only";

import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { getT } from "@/i18n";
import {
  rethrowApiError,
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

import { getAnnotationById } from "./api";
import {
  canCreateAnnotation,
  canDeleteAnnotation,
  canEditAnnotation,
  canAdminDeleteAnnotation,
} from "./permissions";
import {
  makeAnnotationCreateSchema,
  makeAnnotationUpdateSchema,
  makeAnnotationIdSchema,
} from "./schemas";
import { type AnnotationCreateBody, type ParentEntityType } from "./types";

/** Маппинг UPPER_SNAKE-кодов бекенда на ключи каталога errors (локализуемый канал). */
const ERRORS: ApiErrorMessageKeys = {
  BLOCKS_EMPTY: "ANNOTATION_BLOCKS_EMPTY",
  BLOCKS_INVALID: "ANNOTATION_BLOCKS_INVALID",
  ANCHOR_INVALID: "ANNOTATION_ANCHOR_INVALID",
  INVALID_PARENT_TYPE: "ANNOTATION_INVALID_PARENT_TYPE",
  REQUEST_BODY_TOO_LARGE: "ANNOTATION_REQUEST_BODY_TOO_LARGE",
};

/**
 * Создание аннотации через типизированный openapi-fetch клиент. Реальный роут —
 * пер-сущностный POST `/api/{entity}/{id}/annotations` (§10.1). Бэк добавил эти
 * 4 роута в OpenAPI → ручной `instrumentedFetch`-стопгап снят (правило AGENTS
 * «корень починен → убрать обход»).
 *
 * openapi-fetch типизирует пути по ЛИТЕРАЛУ (шаблонный union как первый аргумент
 * `POST` не выводит params/body), поэтому диспатч по 4 литералам через `switch`.
 * Тело идентично у всех 4 роутов (`annotation.CreateRequest`) — строим один раз.
 * visibility ФИКСИРУЕТСЯ здесь и не меняется (§6.8).
 */
export const createAnnotation = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canCreateAnnotation);
  const t = await getT("validation");
  const input = parseFormData(makeAnnotationCreateSchema(t), formData);

  const api = await createApiClient();
  const body: AnnotationCreateBody = {
    blocks: input.blocks,
    visibility: input.visibility,
    ...(input.anchor !== undefined ? { anchor: input.anchor } : {}),
  };
  const init = {
    params: { path: { id: input.parent_entity_id } },
    body,
    headers: idempotencyHeaders(ctx.idempotencyKey),
  } as const;

  // openapi-fetch требует литеральный путь для вывода типов params/body —
  // диспатчим по 4 значениям ParentEntityType.
  const post = (type: ParentEntityType) => {
    switch (type) {
      case "document":
        return api.POST("/api/documents/{id}/annotations", init);
      case "comment":
        return api.POST("/api/comments/{id}/annotations", init);
      case "glossary":
        return api.POST("/api/glossary/{id}/annotations", init);
      case "media":
        return api.POST("/api/media/{id}/annotations", init);
    }
  };
  const { data, error } = await post(input.parent_entity_type);
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.ANNOTATIONS);
  return unwrap(data);
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
  const t = await getT("validation");
  const input = parseFormData(makeAnnotationUpdateSchema(t), formData);

  // Defense-in-depth: грузим аннотацию, проверяем ownership.
  const existing = await getAnnotationById(input.id);
  const tAnnotations = await getT("annotations");
  if (!existing) throw new Error(tAnnotations("notFound"));
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
  const t = await getT("validation");
  const { id } = makeAnnotationIdSchema(t).parse({ id: rawId });
  const existing = await getAnnotationById(id);
  const tAnnotations = await getT("annotations");
  if (!existing) throw new Error(tAnnotations("notFound"));
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
  const t = await getT("validation");
  const { id } = makeAnnotationIdSchema(t).parse({ id: rawId });
  const existing = await getAnnotationById(id);
  const tAnnotations = await getT("annotations");
  if (!existing) throw new Error(tAnnotations("notFound"));
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
