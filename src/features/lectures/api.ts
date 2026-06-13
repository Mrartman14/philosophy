// src/features/lectures/api.ts
import "server-only";
import { cache } from "react";
import { createApiClient } from "@/api/client";
import type {
  Lecture,
  LectureDocument,
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
      throw new Error(error.error ?? "Не удалось загрузить лекции");
    }
    return {
      items: (data?.data ?? []) as Lecture[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);

export const getLectureById = cache(async (id: string): Promise<Lecture | null> => {
  const api = await createApiClient();
  const { data, error, response } = await api.GET("/api/lectures/{id}", {
    params: { path: { id } },
  });
  if (response.status === 404) return null;
  if (error) {
    throw new Error(error.error ?? "Не удалось загрузить лекцию");
  }
  const lecture = data?.data;
  return (lecture ?? null) as Lecture | null;
});

/** GET /api/lectures/{id}/documents — документы лекции (по sort_order). 404 → []. */
export const getLectureDocuments = cache(
  async (id: string): Promise<LectureDocument[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/lectures/{id}/documents", {
      params: { path: { id } },
    });
    if (response.status === 404) return [];
    if (error) throw new Error(error.error ?? "Не удалось загрузить документы лекции");
    return (data?.data ?? []) as LectureDocument[];
  },
);

/** GET /api/lectures/{id}/media — медиа лекции (по sort_order). 404 → []. */
export const getLectureMedia = cache(
  async (id: string): Promise<LectureMediaItem[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/lectures/{id}/media", {
      params: { path: { id } },
    });
    if (response.status === 404) return [];
    if (error) throw new Error(error.error ?? "Не удалось загрузить медиа лекции");
    return (data?.data ?? []) as LectureMediaItem[];
  },
);
