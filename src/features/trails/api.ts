// src/features/trails/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";
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

/** Публичный список маршрутов (GET /api/trails). Гость видит только public. */
export const getTrails = cache(
  async (filter: TrailListFilter = {}): Promise<TrailListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const { data, error } = await api.GET("/api/trails", {
      params: { query: { offset, limit } },
    });
    if (error) throw new Error(error.error ?? "Не удалось загрузить маршруты");
    return unwrapList(data, { offset, limit });
  },
);

/** Мои маршруты (GET /api/trails/my). Гейт — auth. */
export const getMyTrails = cache(
  async (filter: TrailListFilter = {}): Promise<TrailListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const { data, error } = await api.GET("/api/trails/my", {
      params: { query: { offset, limit } },
    });
    if (error) throw new Error(error.error ?? "Не удалось загрузить маршруты");
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
    if (error) throw new Error(error.error ?? "Не удалось загрузить маршрут");
    return unwrap(data);
  },
);

/** Admin-список маршрутов (GET /api/admin/trails — только НЕ-private). */
export const getAdminTrails = cache(
  async (filter: AdminTrailListFilter = {}): Promise<TrailListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const query: { offset: number; limit: number; owner_id?: string } = { offset, limit };
    if (filter.ownerId) query.owner_id = filter.ownerId;
    const { data, error } = await api.GET("/api/admin/trails", { params: { query } });
    if (error) throw new Error(error.error ?? "Не удалось загрузить маршруты");
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
