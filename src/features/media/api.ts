// src/features/media/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";
import { getT } from "@/i18n";
import { unwrap, unwrapList } from "@/utils/api-unwrap";

import type { Media, MediaAttachment, MediaListItem } from "./types";

export interface MyMediaFilter {
  offset?: number;
  /** Бек: default 20, max 100. */
  limit?: number;
  /** Только незакреплённые (без вхождения в attachments). Валидно на scope=mine. */
  freeFloating?: boolean;
}

export interface MyMediaResult {
  items: MediaListItem[];
  total: number;
  offset: number;
  limit: number;
}

/** Результат GET /api/media?scope=all — модерация non-private медиа всех владельцев.
 *  Облегчённый media.MediaListItem (owner: userref.Ref несёт username, без url);
 *  отдельный тип от MyMediaResult сохранён по смыслу (admin-листинг vs «мои медиа»). */
export interface AdminMediaResult {
  items: MediaListItem[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * GET /api/media?scope=mine — мои медиа вкл. приватные (requiredAuth). Scope
 * передаётся ЯВНО (дефолт ручки = visible). Фильтр free_floating валиден только
 * на scope=mine. Per-user, постоянно меняется → только React.cache (дедуп в
 * рамках запроса), без unstable_cache (как audit/api.ts). Отдаёт облегчённый
 * media.MediaListItem[] (без подписанного url — за url см. getMediaById).
 */
export const getMyMedia = cache(
  async (filter: MyMediaFilter = {}): Promise<MyMediaResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const query: {
      scope: string;
      offset: number;
      limit: number;
      free_floating?: boolean;
    } = { scope: "mine", offset, limit };
    if (filter.freeFloating) query.free_floating = true;
    const { data, error } = await api.GET("/api/media", {
      params: { query },
    });
    if (error) {
      throw new Error(error.error ?? (await getT("media"))("api.loadMyFailed"));
    }
    return unwrapList(data, { offset, limit });
  },
);

/**
 * GET /api/media?scope=all — admin-список non-private медиа всех владельцев
 * (модерация, гейт media.delete_any; без капы бек вернёт 403). Приватные бек
 * не листит. Scope передаётся ЯВНО (дефолт ручки = visible). Фильтр owner_id
 * валиден на scope=all. Отдаёт облегчённый media.MediaListItem[] (owner:
 * userref.Ref с username, без url) → AdminMediaResult, НЕ MyMediaResult.
 * Per-actor → только React.cache, без unstable_cache (как getMyMedia).
 */
export const getAdminMedia = cache(
  async (
    filter: { owner_id?: string; offset?: number; limit?: number } = {},
  ): Promise<AdminMediaResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const { data, error } = await api.GET("/api/media", {
      params: {
        query: {
          scope: "all",
          offset,
          limit,
          ...(filter.owner_id ? { owner_id: filter.owner_id } : {}),
        },
      },
    });
    if (error) {
      throw new Error(error.error ?? (await getT("media"))("api.loadAdminFailed"));
    }
    return unwrapList(data, { offset, limit });
  },
);

/**
 * GET /api/media/{media_id} — одно медиа с подписанным url. 404 →
 * возвращаем null (secure-by-obscurity: «не видно» ≡ «не существует»).
 *
 * Намеренно НЕ используем unstable_cache: медиа бывает приватным, а
 * unstable_cache — глобальный кеш без измерения actor'а в ключе. Ответ
 * содержит подписанный URL хранилища — кешировать его между пользователями
 * означало бы отдавать приватное медиа владельца A чужому пользователю B.
 * Единственный уровень кеширования — React.cache (per-request, per-actor),
 * который дедуплицирует повторные вызовы внутри одного серверного рендера.
 */
export const getMediaById = cache(
  async (id: string, token?: string): Promise<Media | null> => {
    // shareTokenMW (philosophy-api cmd/server/main.go:944) принимает ?token=,
    // schema.ts его не объявляет (§10.5) → cast `as never`.
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/media/{media_id}", {
      params: {
        path: { media_id: id },
        ...(token ? { query: { token } as never } : {}),
      },
    });
    if (response.status === 404) return null;
    if (error) {
      throw new Error(error.error ?? (await getT("media"))("api.loadItemFailed"));
    }
    return unwrap(data);
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
      throw new Error(error.error ?? (await getT("media"))("api.loadContainersFailed"));
    }
    return unwrap(data) ?? [];
  },
);
