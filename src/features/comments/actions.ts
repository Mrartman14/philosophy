"use server";

import { revalidatePath } from "next/cache";
import { createApiClient } from "@/api/client";
import type {
  Comment,
  CommentCreateRequest,
  CommentReactionType,
} from "@/api/types";
import { createAction, createFormAction } from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError } from "@/utils/permissions";
import {
  canCreateComment,
  canReactToComment,
} from "./permissions";

/**
 * Создание комментария через форму. Используется с `useActionState`.
 * FormData ожидает поля: `lectureId`, `body`, `is_anonymous` (опционально).
 */
export const createComment = createFormAction<Comment>(async (formData) => {
  const lectureId = formData.get("lectureId");
  const body = formData.get("body");
  const isAnonymousRaw = formData.get("is_anonymous");

  if (typeof lectureId !== "string" || lectureId.length === 0) {
    throw new Error("Не указана лекция");
  }
  if (typeof body !== "string" || body.trim().length === 0) {
    throw new Error("Комментарий не может быть пустым");
  }

  const requestBody: CommentCreateRequest = { body: body.trim() };
  if (isAnonymousRaw === "on" || isAnonymousRaw === "true") {
    requestBody.is_anonymous = true;
  }

  const me = await getMe();
  if (!canCreateComment(me)) {
    throw new ForbiddenError(me ? "status" : "guest");
  }

  const client = await createApiClient();
  const { data, error } = await client.POST("/api/lectures/{id}/comments", {
    params: { path: { id: lectureId } },
    body: requestBody,
  });
  if (error || !data?.data) {
    throw new Error("Не удалось создать комментарий");
  }

  revalidatePath(`/lectures/${lectureId}`);
  return data.data;
});

/**
 * Редактирование комментария через форму. Используется с `useActionState`.
 * FormData ожидает поля: `commentId`, `lectureId`, `body`.
 */
export const editComment = createFormAction<Comment>(async (formData) => {
  const commentId = formData.get("commentId");
  const lectureId = formData.get("lectureId");
  const body = formData.get("body");

  if (typeof commentId !== "string" || commentId.length === 0) {
    throw new Error("Не указан комментарий");
  }
  if (typeof lectureId !== "string" || lectureId.length === 0) {
    throw new Error("Не указана лекция");
  }
  if (typeof body !== "string" || body.trim().length === 0) {
    throw new Error("Комментарий не может быть пустым");
  }

  const me = await getMe();
  if (!me) throw new ForbiddenError("guest");
  if (me.status !== "active") throw new ForbiddenError("status");
  // Ownership проверится бэком (см. блок «Зачем» в начале Task 8).

  const client = await createApiClient();
  const { data, error } = await client.PUT("/api/comments/{id}", {
    params: { path: { id: commentId } },
    body: { body: body.trim() },
  });
  if (error || !data?.data) {
    throw new Error("Не удалось изменить комментарий");
  }

  revalidatePath(`/lectures/${lectureId}`);
  return data.data;
});

/** Удаление комментария. Прямой вызов. */
export const deleteComment = createAction<
  { commentId: string; lectureId: string },
  void
>(async ({ commentId, lectureId }) => {
  const me = await getMe();
  if (!me) throw new ForbiddenError("guest");
  if (me.status !== "active") throw new ForbiddenError("status");
  // Ownership проверится бэком (см. блок «Зачем» в начале Task 8).

  const client = await createApiClient();
  const { error } = await client.DELETE("/api/comments/{id}", {
    params: { path: { id: commentId } },
  });
  if (error) {
    throw new Error("Не удалось удалить комментарий");
  }
  revalidatePath(`/lectures/${lectureId}`);
});

/** Поставить реакцию. Прямой вызов. */
export const addReaction = createAction<
  { commentId: string; lectureId: string; reaction: CommentReactionType },
  void
>(async ({ commentId, lectureId, reaction }) => {
  const me = await getMe();
  if (!canReactToComment(me)) {
    throw new ForbiddenError(me ? "status" : "guest");
  }

  const client = await createApiClient();
  const { error } = await client.POST("/api/comments/{id}/reactions", {
    params: { path: { id: commentId } },
    body: { reaction },
  });
  if (error) {
    throw new Error("Не удалось поставить реакцию");
  }
  revalidatePath(`/lectures/${lectureId}`);
});

/** Убрать реакцию. Прямой вызов. */
export const removeReaction = createAction<
  { commentId: string; lectureId: string },
  void
>(async ({ commentId, lectureId }) => {
  const me = await getMe();
  if (!canReactToComment(me)) {
    throw new ForbiddenError(me ? "status" : "guest");
  }

  const client = await createApiClient();
  const { error } = await client.DELETE("/api/comments/{id}/reactions", {
    params: { path: { id: commentId } },
  });
  if (error) {
    throw new Error("Не удалось убрать реакцию");
  }
  revalidatePath(`/lectures/${lectureId}`);
});
