// src/features/comments/actions.ts
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
import { ifMatchHeader } from "@/utils/optimistic-lock";
import { requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import {
  canCreateComment,
  canModerateComments,
} from "./permissions";
import {
  CommentBlocksUpdateSchema,
  CommentCreateSchema,
  CommentIdSchema,
  ReactionSchema,
  RemoveReactionSchema,
} from "./schemas";
import type { ReactionAxis } from "./types";

/** Доменные коды бека → русский текст. role-403/SUSPENDED/BANNED и дефолтный
 * REF_NOT_FOUND обрабатывает централизованный rethrowApiError. BLOCKS_HAVE_ANCHORS
 * у комментариев отличается от дефолта, поэтому переопределён локально. */
const ERRORS: ApiErrorMessages = {
  SELF_REACTION: "Нельзя реагировать на собственный комментарий.",
  AXIS_NOT_ALLOWED: "Эта реакция недоступна для данного типа комментария.",
  INVALID_INSIGHT_VALUE: "Реакция «Инсайт» возможна только со знаком плюс.",
  COMMENT_DELETED: "Комментарий удалён.",
  PARENT_NOT_AVAILABLE: "Родительский комментарий недоступен.",
  PARENT_WRONG_LECTURE: "Родительский комментарий недоступен.",
  INVALID_ROOT_TYPE: "Этот тип комментария нельзя использовать как корневой.",
  INVALID_TYPE_FOR_PARENT:
    "Этот тип комментария недопустим как ответ на выбранный узел.",
  MAX_DEPTH_EXCEEDED: "Превышена максимальная глубина ветки.",
  BLOCKS_EMPTY: "Комментарий не может быть пустым.",
  BLOCKS_INVALID: "Тело комментария не прошло проверку AST.",
  BLOCK_ID_UNKNOWN: "Ошибка идентификаторов блоков. Перезагрузите редактор.",
  DUPLICATE_BLOCK_ID: "Ошибка идентификаторов блоков. Перезагрузите редактор.",
  COMMENT_REFERENCED:
    "На этот комментарий ссылаются другие материалы. Сначала удалите ссылки.",
  BLOCK_REFERENCED:
    "На блок этого комментария ссылаются извне. Сначала удалите ссылки.",
  BLOCKS_HAVE_ANCHORS:
    "К блокам этого комментария привязаны другие комментарии. Сначала открепите их.",
};

/** Создать комментарий (корень или ответ). FormData: type, blocks(JSON), parent_id?. */
export const createComment = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canCreateComment);
  const rawLectureId = formData.get("lecture_id");
  const lectureId = typeof rawLectureId === "string" ? rawLectureId : "";
  if (!lectureId) throw new Error("Не указана лекция.");
  const input = parseFormData(CommentCreateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/lectures/{id}/comments", {
    params: { path: { id: lectureId } },
    body: {
      type: input.type,
      blocks: input.blocks,
      ...(input.parent_id ? { parent_id: input.parent_id } : {}),
    },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.COMMENTS, lectureId);
  revalidateEntity(Tags.COMMENTS);
  return unwrap(data);
}, "createComment");

/**
 * Редактировать blocks комментария (owner-only — бек проверит). FormData: id,
 * blocks(JSON), version. Content-edit PUT требует `If-Match: "<version>"`
 * (optimistic lock, см. docs/conventions/optimistic-locking.md). У комментария
 * нет single-GET — версия берётся из body-поля `comment.version` узла дерева и
 * кладётся в hidden-поле формы. Отсутствие → 428, расхождение → 412.
 */
export const updateCommentBlocks = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canCreateComment); // active+create — точную owner-проверку делает бек
  const input = parseFormData(CommentBlocksUpdateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/comments/{id}/blocks", {
    params: {
      path: { id: input.id },
      header: ifMatchHeader(formData, "комментария"),
    },
    body: { blocks: input.blocks },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.COMMENTS, input.id);
  revalidateEntity(Tags.COMMENTS);
  return unwrap(data);
}, "updateCommentBlocks");

/** Удалить свой комментарий (owner). Аргумент — id (uuid). */
export const deleteComment = createAction(async (rawId: string, ctx) => {
  const me = await getMe();
  requireCapability(me, canCreateComment);
  const { id } = CommentIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/comments/{id}", {
    params: { path: { id } },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.COMMENTS, id);
  revalidateEntity(Tags.COMMENTS);
  return undefined;
}, "deleteComment");

/** Admin-удаление (comment.delete_any, независимо от периметра). Аргумент — id. */
export const adminDeleteComment = createAction(async (rawId: string) => {
  const me = await getMe();
  requireCapability(me, canModerateComments);
  const { id } = CommentIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/comments/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.COMMENTS, id);
  revalidateEntity(Tags.COMMENTS);
  return undefined;
}, "adminDeleteComment");

/** Поставить реакцию по оси (upsert). Аргумент: {id, axis, value}. */
export const setReaction = createAction(
  async (raw: { id: string; axis: ReactionAxis; value: number }) => {
    const me = await getMe();
    requireCapability(me, canCreateComment); // active-пользователь
    const input = ReactionSchema.parse(raw);
    const api = await createApiClient();
    const { error } = await api.POST("/api/comments/{id}/reactions", {
      params: { path: { id: input.id } },
      body: { axis: input.axis, value: input.value as -1 | 1 },
    });
    if (error) rethrowApiError(error, ERRORS);
    revalidateEntity(Tags.COMMENTS, input.id);
    return undefined;
  },
  "setReaction",
);

/** Снять реакцию с оси. Аргумент: {id, axis}. */
export const removeReaction = createAction(
  async (raw: { id: string; axis: ReactionAxis }) => {
    const me = await getMe();
    requireCapability(me, canCreateComment);
    const input = RemoveReactionSchema.parse(raw);
    const api = await createApiClient();
    const { error } = await api.DELETE("/api/comments/{id}/reactions/{axis}", {
      params: { path: { id: input.id, axis: input.axis } },
    });
    if (error) rethrowApiError(error, ERRORS);
    revalidateEntity(Tags.COMMENTS, input.id);
    return undefined;
  },
  "removeReaction",
);
