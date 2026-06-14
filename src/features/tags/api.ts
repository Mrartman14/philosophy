// src/features/tags/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";

import type { Tag } from "./types";

export interface TagListFilter {
  offset?: number;
  limit?: number;
}

export interface TagListResult {
  items: Tag[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Публичный список тегов. Admin-GET на беке не существует — страница
 * /admin/tags тоже читает отсюда. Лимит бекенда: default 20, max 100.
 */
export const getTags = cache(
  async (filter: TagListFilter = {}): Promise<TagListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 100;

    const { data, error } = await api.GET("/api/tags", {
      params: { query: { offset, limit } },
    });
    if (error) {
      // openapi-типизирует error этого роута как `never` (нет error-body в
      // схеме) — пробросить error.error нельзя, отдаём фиксированный текст.
      throw new Error("Не удалось загрузить теги");
    }
    return {
      items: (data?.data ?? []) as Tag[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);

/**
 * Теги конкретной лекции (публичный GET). До 100 тегов — практический
 * потолок; пагинация лекционных тегов UI не нужна.
 */
export const getLectureTags = cache(async (lectureId: string): Promise<Tag[]> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/lectures/{id}/tags", {
    params: { path: { id: lectureId }, query: { offset: 0, limit: 100 } },
  });
  if (error) {
    throw new Error(error.error ?? "Не удалось загрузить теги лекции");
  }
  return (data?.data ?? []) as Tag[];
});
