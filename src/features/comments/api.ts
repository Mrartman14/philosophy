// src/features/comments/api.ts
import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { createApiClient, createPublicApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { getT } from "@/i18n";
import { unwrap, unwrapList } from "@/utils/api-unwrap";

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
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- openapi types this route error as never, but openapi-fetch sets it at runtime on network/non-2xx failures
    if (error) throw new Error((await getT("comments"))("api.loadSchemaFailed"));
    return unwrap(data);
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
    if (error) throw new Error(error.error ?? (await getT("comments"))("api.loadListFailed"));
    return {
      subtrees: data.data ?? [],
      total: data.pagination?.total ?? 0,
      offset: data.pagination?.offset ?? offset,
      limit: data.pagination?.limit ?? limit,
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
    if (error) throw new Error(error.error ?? (await getT("comments"))("api.loadSubtreeFailed"));
    return unwrap(data);
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
    if (error) throw new Error(error.error ?? (await getT("comments"))("api.searchFailed"));
    return {
      items: data.data ?? [],
      total: data.pagination?.total ?? 0,
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
    if (error) throw new Error(error.error ?? (await getT("comments"))("api.loadRevisionsFailed"));
    return unwrap(data) ?? [];
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
    if (error) throw new Error(error.error ?? (await getT("comments"))("api.loadRevisionFailed"));
    return unwrap(data);
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
    if (error) throw new Error(error.error ?? (await getT("comments"))("api.loadBlockFailed"));
    return data.data ?? null;
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
    if (error) throw new Error(error.error ?? (await getT("comments"))("api.loadListFailed"));
    return unwrapList(data, { offset, limit });
  },
);
