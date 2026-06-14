// src/features/media/api.ts
import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";

import type { Media, MediaAttachment } from "./types";

export interface MyMediaFilter {
  offset?: number;
  /** Бек: default 20, max 100. */
  limit?: number;
  /** Только незакреплённые (без вхождения в attachments). */
  freeFloating?: boolean;
}

export interface MyMediaResult {
  items: Media[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * GET /api/me/media — мои медиа. Per-user, постоянно меняется → только
 * React.cache (дедуп в рамках запроса), без unstable_cache (как audit/api.ts).
 */
export const getMyMedia = cache(
  async (filter: MyMediaFilter = {}): Promise<MyMediaResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const query: {
      offset: number;
      limit: number;
      free_floating?: boolean;
    } = { offset, limit };
    if (filter.freeFloating) query.free_floating = true;
    const { data, error } = await api.GET("/api/me/media", {
      params: { query },
    });
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить медиа");
    }
    return {
      items: (data?.data ?? []) as Media[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);

/**
 * GET /api/media/{media_id} — одно медиа с подписанным url. 404 →
 * возвращаем null (secure-by-obscurity: «не видно» ≡ «не существует»).
 * Кешируется per-id; инвалидация — revalidateEntity(Tags.MEDIA, id) после
 * смены видимости. unstable_cache требует, чтобы id попал и в keyParts, и в
 * tags — иначе все id делят один кеш.
 */
export const getMediaById = cache(
  async (id: string, token?: string): Promise<Media | null> => {
    // С токеном (viewer share-link) обходим cross-request unstable_cache:
    // приватный ответ не должен кешироваться между держателями ссылок.
    // shareTokenMW (philosophy-api cmd/server/main.go:944) принимает ?token=,
    // schema.ts его не объявляет (§10.5) → cast `as never`.
    if (token) {
      const api = await createApiClient();
      const { data, error, response } = await api.GET("/api/media/{media_id}", {
        params: {
          path: { media_id: id },
          query: { token } as never,
        },
      });
      if (response.status === 404) return null;
      if (error) {
        throw new Error(error.error ?? "Не удалось загрузить медиа");
      }
      return (data?.data ?? null) as Media | null;
    }
    const fetcher = unstable_cache(
      async (mediaId: string): Promise<Media | null> => {
        const api = await createApiClient();
        const { data, error, response } = await api.GET(
          "/api/media/{media_id}",
          { params: { path: { media_id: mediaId } } },
        );
        if (response.status === 404) return null;
        if (error) {
          throw new Error(error.error ?? "Не удалось загрузить медиа");
        }
        return (data?.data ?? null) as Media | null;
      },
      ["media-by-id", id],
      { tags: [`${Tags.MEDIA}:${id}`] },
    );
    return fetcher(id);
  },
);

/**
 * GET /api/media/{id}/attachments — контейнеры (лекции), к которым привязано
 * медиа. Read-only. Бек отдаёт только container_id (без заголовков). 404 →
 * пустой список (медиа без attachments).
 */
export const getMediaContainers = cache(
  async (id: string): Promise<MediaAttachment[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET(
      "/api/media/{id}/attachments",
      { params: { path: { id } } },
    );
    if (response.status === 404) return [];
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить контейнеры");
    }
    return (data?.data ?? []) as MediaAttachment[];
  },
);
