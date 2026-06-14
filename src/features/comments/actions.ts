// src/features/comments/actions.ts
"use server";
import "server-only";
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
import type { Comment, ReactionAxis } from "./types";

/** Маппинг UPPER_SNAKE_CASE-кодов бека в понятные русские тексты. */
function rethrowApiError(err: ApiError | undefined): never {
  switch (err?.code) {
    case "SUSPENDED":
      throw new ForbiddenError("status", "Аккаунт ограничен: вы не можете писать.");
    case "SELF_REACTION":
      throw new Error("Нельзя реагировать на собственный комментарий.");
    case "AXIS_NOT_ALLOWED":
      throw new Error("Эта реакция недоступна для данного типа комментария.");
    case "INVALID_INSIGHT_VALUE":
      throw new Error("Реакция «Инсайт» возможна только со знаком плюс.");
    case "COMMENT_DELETED":
      throw new Error("Комментарий удалён.");
    case "PARENT_NOT_AVAILABLE":
    case "PARENT_WRONG_LECTURE":
      throw new Error("Родительский комментарий недоступен.");
    case "INVALID_ROOT_TYPE":
      throw new Error("Этот тип комментария нельзя использовать как корневой.");
    case "INVALID_TYPE_FOR_PARENT":
      throw new Error("Этот тип комментария недопустим как ответ на выбранный узел.");
    case "MAX_DEPTH_EXCEEDED":
      throw new Error("Превышена максимальная глубина ветки.");
    case "BLOCKS_EMPTY":
      throw new Error("Комментарий не может быть пустым.");
    case "BLOCKS_INVALID":
      throw new Error("Тело комментария не прошло проверку AST.");
    case "REF_NOT_FOUND":
      throw new Error("Одна из ссылок указывает на несуществующий объект.");
    case "BLOCK_ID_UNKNOWN":
    case "DUPLICATE_BLOCK_ID":
      throw new Error("Ошибка идентификаторов блоков. Перезагрузите редактор.");
    case "COMMENT_REFERENCED":
      throw new Error(
        "На этот комментарий ссылаются другие материалы. Сначала удалите ссылки.",
      );
    case "BLOCK_REFERENCED":
      throw new Error(
        "На блок этого комментария ссылаются извне. Сначала удалите ссылки.",
      );
    case "BLOCKS_HAVE_ANCHORS":
      throw new Error(
        "К блокам этого комментария привязаны другие комментарии. Сначала открепите их.",
      );
  }
  handleCommonApiError(err);
}

/** Создать комментарий (корень или ответ). FormData: type, blocks(JSON), parent_id?. */
export const createComment = createFormAction(async (formData) => {
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
      blocks: input.blocks as never,
      ...(input.parent_id ? { parent_id: input.parent_id } : {}),
    },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.COMMENTS, lectureId);
  revalidateEntity(Tags.COMMENTS);
  return (data?.data ?? null) as Comment | null;
});

/** Редактировать blocks комментария (owner-only — бек проверит). FormData: id, blocks(JSON). */
export const updateCommentBlocks = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canCreateComment); // active+create — точную owner-проверку делает бек
  const input = parseFormData(CommentBlocksUpdateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/comments/{id}/blocks", {
    params: { path: { id: input.id } },
    body: { blocks: input.blocks as never },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.COMMENTS, input.id);
  revalidateEntity(Tags.COMMENTS);
  return (data?.data ?? null) as Comment | null;
});

/** Удалить свой комментарий (owner). Аргумент — id (uuid). */
export const deleteComment = createAction(async (rawId: string) => {
  const me = await getMe();
  requireCapability(me, canCreateComment);
  const { id } = CommentIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/comments/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.COMMENTS, id);
  revalidateEntity(Tags.COMMENTS);
  return undefined;
});

/** Admin-удаление (comment.delete_any, независимо от периметра). Аргумент — id. */
export const adminDeleteComment = createAction(async (rawId: string) => {
  const me = await getMe();
  requireCapability(me, canModerateComments);
  const { id } = CommentIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/comments/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.COMMENTS, id);
  revalidateEntity(Tags.COMMENTS);
  return undefined;
});

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
    if (error) rethrowApiError(error);
    revalidateEntity(Tags.COMMENTS, input.id);
    return undefined;
  },
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
    if (error) rethrowApiError(error);
    revalidateEntity(Tags.COMMENTS, input.id);
    return undefined;
  },
);
