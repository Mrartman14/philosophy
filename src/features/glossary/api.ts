// src/features/glossary/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";

import type { Term, TermRevision, TermRevisionMeta } from "./types";

export interface TermListFilter {
  q?: string;
  offset?: number;
  limit?: number;
}

export interface TermListResult {
  items: Term[];
  total: number;
  offset: number;
  limit: number;
}

export const getTerms = cache(
  async (filter: TermListFilter = {}): Promise<TermListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    const query: { offset: number; limit: number; q?: string } = { offset, limit };
    if (filter.q) query.q = filter.q;

    const { data, error } = await api.GET("/api/glossary", { params: { query } });
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить термины");
    }
    return {
      items: (data.data ?? []) as Term[],
      total: data.pagination?.total ?? 0,
      offset: data.pagination?.offset ?? offset,
      limit: data.pagination?.limit ?? limit,
    };
  },
);

export const getTermById = cache(async (id: string): Promise<Term | null> => {
  const api = await createApiClient();
  const { data, error, response } = await api.GET("/api/glossary/{id}", {
    params: { path: { id } },
  });
  if (response.status === 404) return null;
  if (error) {
    throw new Error(error.error ?? "Не удалось загрузить термин");
  }
  return (data.data ?? null) as Term | null;
});

/**
 * Список ревизий термина. Эндпоинт публичный (без капабилити-гейтов).
 * Бек отдаёт по created_at ASC (старые первыми) с потолком 200 записей
 * (internal/revision/repo.go) — порядок отображения решает UI.
 * 404 (термин не найден) → пустой список: страница уже отдала notFound()
 * по самому термину раньше, сюда 404 может прийти только в гонке удаления.
 */
export const getTermRevisions = cache(
  async (id: string): Promise<TermRevisionMeta[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET(
      "/api/glossary/{id}/revisions",
      { params: { path: { id } } },
    );
    if (response.status === 404) return [];
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить ревизии термина");
    }
    return (data.data ?? []) as TermRevisionMeta[];
  },
);

/**
 * Одна ревизия термина со снапшотом blocks. 404 (нет ревизии или она
 * принадлежит другому термину) и 400 (битый id из ?revision= в URL) → null —
 * секция ревизий просто не покажет панель снапшота.
 */
export const getTermRevision = cache(
  async (id: string, revisionId: string): Promise<TermRevision | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET(
      "/api/glossary/{id}/revisions/{revisionID}",
      { params: { path: { id, revisionID: revisionId } } },
    );
    if (response.status === 404 || response.status === 400) return null;
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить ревизию термина");
    }
    return (data.data ?? null) as TermRevision | null;
  },
);
