// src/features/comments/api.ts
import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { createApiClient, createPublicApiClient } from "@/api/client";
import { Tags } from "@/api/tags";

import type {
  Comment,
  CommentRevision,
  CommentRevisionMeta,
  CommentSchema,
  CommentSummary,
  ResolvedBlock,
  RootSubtree,
} from "./types";

export interface CommentListResult {
  subtrees: RootSubtree[];
  total: number;
  offset: number;
  limit: number;
}

export interface CommentSearchResult {
  items: CommentSummary[];
  total: number;
}

/**
 * Схема типов/осей. Публичный эндпоинт, бек ставит Cache-Control 1h.
 * Кешируем cross-request тегом comments — инвалидируется крайне редко.
 */
export const getCommentSchema = unstable_cache(
  async (): Promise<CommentSchema | null> => {
    const api = createPublicApiClient();
    const { data, error } = await api.GET("/api/comments/schema");
    if (error) throw new Error("Не удалось загрузить схему комментариев");
    return (data?.data ?? null) as CommentSchema | null;
  },
  ["comments-schema"],
  { tags: [Tags.COMMENT_SCHEMA] },
);

/** Список корней лекции с поддеревьями (public, my_reactions при auth). */
export const getLectureComments = cache(
  async (
    lectureId: string,
    opts: { offset?: number; limit?: number; blockId?: string } = {},
  ): Promise<CommentListResult> => {
    const api = await createApiClient();
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? 20;
    const query: { offset: number; limit: number; block_id?: string } = {
      offset,
      limit,
    };
    if (opts.blockId) query.block_id = opts.blockId;
    const { data, error } = await api.GET("/api/lectures/{id}/comments", {
      params: { path: { id: lectureId }, query },
    });
    if (error) throw new Error(error.error ?? "Не удалось загрузить комментарии");
    return {
      subtrees: (data?.data ?? []) as RootSubtree[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);

/** Поддерево одного узла (public). null при 404. */
export const getCommentSubtree = cache(
  async (commentId: string): Promise<RootSubtree | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/comments/{id}/subtree", {
      params: { path: { id: commentId } },
    });
    if (response.status === 404) return null;
    if (error) throw new Error(error.error ?? "Не удалось загрузить ветку");
    return (data?.data ?? null) as RootSubtree | null;
  },
);

/**
 * Поиск по комментариям лекции (requiredAuth — для гостя бек вернёт 401).
 * Вызывать только после canSearchComments(me).
 */
export const searchComments = cache(
  async (
    lectureId: string,
    q: string,
    opts: { offset?: number; limit?: number } = {},
  ): Promise<CommentSearchResult> => {
    const api = await createApiClient();
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? 20;
    const { data, error } = await api.GET("/api/lectures/{id}/comments/search", {
      params: { path: { id: lectureId }, query: { q, offset, limit } },
    });
    if (error) throw new Error(error.error ?? "Не удалось выполнить поиск");
    return {
      items: (data?.data ?? []) as CommentSummary[],
      total: data?.pagination?.total ?? 0,
    };
  },
);

/** Ревизии комментария (public). Бек отдаёт ASC — переворот делает UI. */
export const getCommentRevisions = cache(
  async (commentId: string): Promise<CommentRevisionMeta[]> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/comments/{id}/revisions", {
      params: { path: { id: commentId } },
    });
    if (error) throw new Error(error.error ?? "Не удалось загрузить ревизии");
    return (data?.data ?? []) as CommentRevisionMeta[];
  },
);

export const getCommentRevision = cache(
  async (commentId: string, revisionId: string): Promise<CommentRevision | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET(
      "/api/comments/{id}/revisions/{revisionID}",
      { params: { path: { id: commentId, revisionID: revisionId } } },
    );
    if (response.status === 404) return null;
    if (error) throw new Error(error.error ?? "Не удалось загрузить ревизию");
    return (data?.data ?? null) as CommentRevision | null;
  },
);

/**
 * Резолв одного блока для контекста якоря (public, optionalAuth).
 * schema.ts теперь типизирует data как ast.Block (= ResolvedBlock).
 */
export const getBlock = cache(
  async (blockId: string): Promise<ResolvedBlock | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/blocks/{block_id}", {
      params: { path: { block_id: blockId } },
    });
    if (response.status === 404) return null;
    if (error) throw new Error(error.error ?? "Не удалось загрузить блок");
    return data?.data ?? null;
  },
);

/** Admin-список комментариев лекции (гейт comment.delete_any, lecture_id обязателен). */
export const getAdminLectureComments = cache(
  async (
    lectureId: string,
    opts: { offset?: number; limit?: number } = {},
  ): Promise<{ items: Comment[]; total: number; offset: number; limit: number }> => {
    const api = await createApiClient();
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? 20;
    const { data, error } = await api.GET("/api/admin/comments", {
      params: { query: { lecture_id: lectureId, offset, limit } },
    });
    if (error) throw new Error(error.error ?? "Не удалось загрузить комментарии");
    return {
      items: (data?.data ?? []) as Comment[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);
