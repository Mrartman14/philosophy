// src/features/trails/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";
import { getT } from "@/i18n";
import { unwrap, unwrapList } from "@/utils/api-unwrap";

import type { Trail, TrailWithItems, TrailDocumentSummary } from "./types";

export interface TrailListFilter {
  offset?: number;
  limit?: number;
}

export interface AdminTrailListFilter {
  offset?: number;
  limit?: number;
  ownerId?: string;
}

export interface TrailListResult {
  items: Trail[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Список маршрутов — единый scope-фасетный GET /api/trails (см. эталон
 * src/features/canvas/api.ts). Бекенд УДАЛИЛ /api/trails/my и /api/admin/trails,
 * заменив их одной ручкой с query `scope`:
 *   visible (дефолт) — own ∪ public; public — только public (anon);
 *   mine — свои вкл. приватные (auth); all — все non-private, требует
 *   `trail.delete_any`.
 * ДЕФОЛТ бека = visible, но мы ВСЕГДА передаём scope ЯВНО (контракт), чтобы
 * семантика была видна на месте вызова и не плыла при смене дефолта.
 */
const SCOPE_VISIBLE = "visible";
const SCOPE_MINE = "mine";
const SCOPE_ALL = "all";

/**
 * Публичный список маршрутов: scope=visible (own ∪ public). Для гостя бек
 * сужает до public автоматически (актора нет).
 */
export const getTrails = cache(
  async (filter: TrailListFilter = {}): Promise<TrailListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const { data, error } = await api.GET("/api/trails", {
      params: { query: { scope: SCOPE_VISIBLE, offset, limit } },
    });
    if (error) throw new Error(error.error ?? (await getT("trails"))("api.loadListFailed"));
    return unwrapList(data, { offset, limit });
  },
);

/** Мои маршруты: scope=mine — свои вкл. приватные. Гейт — auth. */
export const getMyTrails = cache(
  async (filter: TrailListFilter = {}): Promise<TrailListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const { data, error } = await api.GET("/api/trails", {
      params: { query: { scope: SCOPE_MINE, offset, limit } },
    });
    if (error) throw new Error(error.error ?? (await getT("trails"))("api.loadListFailed"));
    return unwrapList(data, { offset, limit });
  },
);

/**
 * Маршрут по id с items (GET /api/trails/{id}). 404 → null.
 * token (?token=) пробрасывается для приватных маршрутов через share-link
 * (shareTokenMW, philosophy-api cmd/server/main.go:1198). Без токена — поведение
 * прежнее. schema.ts не объявляет token в query (§10.5) → cast `as never`.
 */
export const getTrailById = cache(
  async (id: string, token?: string): Promise<TrailWithItems | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/trails/{id}", {
      params: {
        path: { id },
        ...(token ? { query: { token } as never } : {}),
      },
    });
    if (response.status === 404) return null;
    if (error) throw new Error(error.error ?? (await getT("trails"))("api.loadItemFailed"));
    return unwrap(data);
  },
);

/**
 * Admin-список маршрутов: scope=all — все НЕ-private (требует `trail.delete_any`,
 * иначе бек вернёт 403). owner-фильтр (`owner_id`) допустим ТОЛЬКО на scope=all.
 */
export const getAdminTrails = cache(
  async (filter: AdminTrailListFilter = {}): Promise<TrailListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const query: { scope: string; offset: number; limit: number; owner_id?: string } = {
      scope: SCOPE_ALL,
      offset,
      limit,
    };
    if (filter.ownerId) query.owner_id = filter.ownerId;
    const { data, error } = await api.GET("/api/trails", { params: { query } });
    if (error) throw new Error(error.error ?? (await getT("trails"))("api.loadListFailed"));
    return unwrapList(data, { offset, limit });
  },
);

/**
 * Резолвит метаданные документа для отображения items маршрута. Items приходят
 * только как document_id — отдельный GET за каждым. 404 (удалённый/недоступный
 * документ) → элемент с заглушкой-именем, чтобы UI не падал.
 *
 * НЕ импортируем cross-feature — зовём /api/documents/{id} напрямую.
 * React.cache дедуплицирует одинаковые id в запросе.
 */
export const getDocumentSummary = cache(
  async (id: string): Promise<TrailDocumentSummary> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/documents/{document_id}", {
      params: { path: { document_id: id } },
    });
    if (error) {
      return { id, filename: "Документ недоступен" };
    }
    const doc = unwrap(data);
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- API может вернуть "", "" трактуется как «нет имени»
    return { id, filename: doc?.filename || "Без названия" };
  },
);
