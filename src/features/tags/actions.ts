// src/features/tags/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { rethrowApiError, type ApiErrorMessages } from "@/utils/api-error";
import { unwrap } from "@/utils/api-unwrap";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { idempotencyHeaders } from "@/utils/idempotency";
import { getMe } from "@/utils/me";
import { requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import {
  canAssignTags,
  canCreateTag,
  canDeleteTag,
  canUpdateTag,
} from "./permissions";
import {
  SetLectureTagsSchema,
  TagCreateSchema,
  TagIdSchema,
  TagUpdateSchema,
} from "./schemas";


/**
 * Коды бекенда — UPPERCASE (internal/apperror, internal/middleware/auth.go,
 * internal/httputil/require_actor.go). Сверено с кодом, не со swagger.
 */
const ERRORS: ApiErrorMessages = {
  CONFLICT: "Тег с таким именем уже существует.",
  NOT_FOUND: "Объект не найден — возможно, уже удалён. Обновите страницу.",
};

export const createTag = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canCreateTag);
  const input = parseFormData(TagCreateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/admin/tags", {
    body: { name: input.name },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.TAGS);
  return unwrap(data);
}, "createTag");

export const updateTag = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canUpdateTag);
  const input = parseFormData(TagUpdateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/admin/tags/{id}", {
    params: { path: { id: input.id } },
    body: { name: input.name },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.TAGS);
  // Имя тега показывается на карточках/страницах лекций.
  revalidateEntity(Tags.LECTURES);
  return unwrap(data);
}, "updateTag");

export const deleteTag = createAction(async (rawId: number) => {
  const me = await getMe();
  requireCapability(me, canDeleteTag);
  const { id } = TagIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/tags/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.TAGS);
  // ON DELETE CASCADE снимает тег с лекций — их отображение тоже устарело.
  revalidateEntity(Tags.LECTURES);
  return undefined;
}, "deleteTag");

export const setLectureTags = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canAssignTags);
  const input = parseFormData(SetLectureTagsSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/admin/lectures/{id}/tags", {
    params: { path: { id: input.lecture_id } },
    body: { tag_ids: input.tag_ids },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.LECTURES, input.lecture_id);
  revalidateEntity(Tags.LECTURES);
  // Tag[] | null — чтобы initial state формы (data: null) совпал по типам
  // с useActionState (паттерн glossary: Term | null).
  return unwrap(data);
}, "setLectureTags");
