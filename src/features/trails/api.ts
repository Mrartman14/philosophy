// src/features/trails/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";

import type { Trail, TrailWithItems, TrailLectureSummary } from "./types";

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
    return {
      items: (data.data ?? []) as Trail[],
      total: data.pagination?.total ?? 0,
      offset: data.pagination?.offset ?? offset,
      limit: data.pagination?.limit ?? limit,
    };
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
    return {
      items: (data.data ?? []) as Trail[],
      total: data.pagination?.total ?? 0,
      offset: data.pagination?.offset ?? offset,
      limit: data.pagination?.limit ?? limit,
    };
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
    return (data.data ?? null) as TrailWithItems | null;
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
    return {
      items: (data.data ?? []) as Trail[],
      total: data.pagination?.total ?? 0,
      offset: data.pagination?.offset ?? offset,
      limit: data.pagination?.limit ?? limit,
    };
  },
);

/**
 * Резолвит заголовки лекций для отображения items маршрута. Items приходят
 * только как lecture_id — отдельный GET за каждым. 404 (удалённая/недоступная
 * лекция) → элемент с заглушкой-заголовком, чтобы UI не падал.
 *
 * НЕ импортируем @/features/lectures (cross-feature запрещён ESLint'ом) — зовём
 * /api/lectures/{id} напрямую. React.cache дедуплицирует одинаковые id в запросе.
 */
export const getLectureSummary = cache(
  async (id: string): Promise<TrailLectureSummary> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/lectures/{id}", {
      params: { path: { id } },
    });
    if (response.status === 404 || error) {
      return { id, title: "Лекция недоступна" };
    }
    const lecture = data.data as { id?: string; title?: string } | undefined;
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- API может вернуть "", "" трактуется как «нет заголовка»
    return { id, title: lecture?.title || "Без названия" };
  },
);
