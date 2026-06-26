// src/features/comments/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { getT } from "@/i18n";
import { rethrowApiError, type ApiErrorMessageKeys } from "@/utils/api-error";
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
  CommentIdSchema,
  ReactionSchema,
  RemoveReactionSchema,
  makeCommentBlocksUpdateSchema,
  makeCommentCreateSchema,
} from "./schemas";
import type { Anchor, ReactionAxis } from "./types";

/** Доменные коды бека → ключи каталога errors (i18n-канал). role-403/SUSPENDED/BANNED
 * и дефолтный REF_NOT_FOUND обрабатывает централизованный rethrowApiError.
 * BLOCKS_HAVE_ANCHORS у комментариев отличается от дефолта (document/glossary-контекст),
 * поэтому переопределён entity-ключом BLOCKS_HAVE_ANCHORS_COMMENT. */
const ERRORS: ApiErrorMessageKeys = {
  SELF_REACTION: "SELF_REACTION",
  AXIS_NOT_ALLOWED: "AXIS_NOT_ALLOWED",
  INVALID_INSIGHT_VALUE: "INVALID_INSIGHT_VALUE",
  COMMENT_DELETED: "COMMENT_DELETED",
  PARENT_NOT_AVAILABLE: "PARENT_NOT_AVAILABLE",
  PARENT_WRONG_LECTURE: "PARENT_WRONG_LECTURE",
  // Якорь комментария (привязка к фрагменту) — 422-коды бека на
  // POST /api/lectures/{id}/comments. Путь отправки якоря строится в фиче
  // anchored-comments; маппинг здесь — её FE-realign под реген schema.ts.
  ANCHOR_ENTITY_UNKNOWN: "ANCHOR_ENTITY_UNKNOWN",
  ANCHOR_BLOCK_NOT_FOUND: "ANCHOR_BLOCK_NOT_FOUND",
  ANCHOR_TARGET_NOT_FOUND: "ANCHOR_TARGET_NOT_FOUND",
  ANCHOR_TARGET_WRONG_LECTURE: "ANCHOR_TARGET_WRONG_LECTURE",
  INVALID_ROOT_TYPE: "INVALID_ROOT_TYPE",
  INVALID_TYPE_FOR_PARENT: "INVALID_TYPE_FOR_PARENT",
  MAX_DEPTH_EXCEEDED: "MAX_DEPTH_EXCEEDED",
  BLOCKS_EMPTY: "BLOCKS_EMPTY",
  BLOCKS_INVALID: "BLOCKS_INVALID",
  BLOCK_ID_UNKNOWN: "BLOCK_ID_UNKNOWN",
  DUPLICATE_BLOCK_ID: "DUPLICATE_BLOCK_ID",
  COMMENT_REFERENCED: "COMMENT_REFERENCED",
  BLOCK_REFERENCED: "BLOCK_REFERENCED",
  BLOCKS_HAVE_ANCHORS: "BLOCKS_HAVE_ANCHORS_COMMENT",
};

/** Создать комментарий (корень или ответ). FormData: type, blocks(JSON), parent_id?. */
export const createComment = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canCreateComment);
  const rawLectureId = formData.get("lecture_id");
  const lectureId = typeof rawLectureId === "string" ? rawLectureId : "";
  if (!lectureId) throw new Error("Не указана лекция.");
  const t = await getT("validation");
  const input = parseFormData(makeCommentCreateSchema(t), formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/lectures/{id}/comments", {
    params: { path: { id: lectureId } },
    body: {
      type: input.type,
      blocks: input.blocks,
      ...(input.parent_id ? { parent_id: input.parent_id } : {}),
      // Каст на границе form-JSON → типизированное тело: anchorJsonField даёт
      // Record<string, unknown> (распарсенный из формы объект), здесь сужаем до
      // Anchor для тела запроса. Валидацию структуры делает бек (422 ANCHOR_*).
      ...(input.anchor !== undefined ? { anchor: input.anchor as Anchor } : {}),
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
  const t = await getT("validation");
  const input = parseFormData(makeCommentBlocksUpdateSchema(t), formData);
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
