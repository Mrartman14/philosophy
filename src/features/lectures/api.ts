// src/features/lectures/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";
import { getT } from "@/i18n";
import { unwrap, unwrapList } from "@/utils/api-unwrap";

import type {
  Lecture,
  LectureCanvasItem,
  LectureDocument,
  LectureFormItem,
  LectureMediaItem,
} from "./types";

export interface LectureListFilter {
  q?: string;
  tag?: string;
  offset?: number;
  limit?: number;
}

export interface LectureListResult {
  items: Lecture[];
  total: number;
  offset: number;
  limit: number;
}

export const getLectures = cache(
  async (filter: LectureListFilter = {}): Promise<LectureListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const query: { offset: number; limit: number; q?: string; tag?: string } = {
      offset,
      limit,
    };
    if (filter.q) query.q = filter.q;
    if (filter.tag) query.tag = filter.tag;

    const { data, error } = await api.GET("/api/lectures", { params: { query } });
    if (error) {
      throw new Error(error.error ?? (await getT("lectures"))("api.loadListFailed"));
    }
    return unwrapList(data, { offset, limit });
  },
);

/**
 * Лекция по id (GET /api/lectures/{id}). 404 → null.
 * token (?token=) пробрасывается для приватных лекций через share-link
 * (shareTokenMW, philosophy-api cmd/server/main.go:910). Без токена — поведение
 * прежнее. schema.ts не объявляет token в query (§10.5) → cast `as never`.
 */
export const getLectureById = cache(
  async (id: string, token?: string): Promise<Lecture | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/lectures/{id}", {
      params: {
        path: { id },
        ...(token ? { query: { token } as never } : {}),
      },
    });
    if (response.status === 404) return null;
    if (error) {
      throw new Error(error.error ?? (await getT("lectures"))("api.loadItemFailed"));
    }
    return unwrap(data);
  },
);

/** GET /api/lectures/{id}/documents — документы лекции (по sort_order). 404 → [].
 *  token (?token=) для приватных лекций через share-link. */
export const getLectureDocuments = cache(
  async (id: string, token?: string): Promise<LectureDocument[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/lectures/{id}/documents", {
      params: { path: { id }, ...(token ? { query: { token } } : {}) },
    });
    if (response.status === 404) return [];
    if (error) throw new Error(error.error ?? (await getT("lectures"))("api.loadDocumentsFailed"));
    return unwrap(data) ?? [];
  },
);

/** GET /api/lectures/{id}/media — медиа лекции (по sort_order). 404 → [].
 *  token (?token=) для приватных лекций через share-link. */
export const getLectureMedia = cache(
  async (id: string, token?: string): Promise<LectureMediaItem[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/lectures/{id}/media", {
      params: { path: { id }, ...(token ? { query: { token } } : {}) },
    });
    if (response.status === 404) return [];
    if (error) throw new Error(error.error ?? (await getT("lectures"))("api.loadMediaFailed"));
    return unwrap(data) ?? [];
  },
);

/** GET /api/lectures/{id}/canvases — канвасы лекции (лёгкий листинг, без data
 *  графа). is_entry помечает основной канвас. 404 → [].
 *  token (?token=) для приватных лекций через share-link. */
export const getLectureCanvases = cache(
  async (id: string, token?: string): Promise<LectureCanvasItem[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/lectures/{id}/canvases", {
      params: { path: { id }, ...(token ? { query: { token } } : {}) },
    });
    if (response.status === 404) return [];
    if (error) throw new Error(error.error ?? (await getT("lectures"))("api.loadCanvasesFailed"));
    return unwrap(data) ?? [];
  },
);

/** GET /api/lectures/{id}/forms — формы лекции (лёгкий листинг). is_entry
 *  помечает основную форму. 404 → [].
 *  token (?token=) для приватных лекций через share-link. */
export const getLectureForms = cache(
  async (id: string, token?: string): Promise<LectureFormItem[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/lectures/{id}/forms", {
      params: { path: { id }, ...(token ? { query: { token } } : {}) },
    });
    if (response.status === 404) return [];
    if (error) throw new Error(error.error ?? (await getT("lectures"))("api.loadFormsFailed"));
    return unwrap(data) ?? [];
  },
);
