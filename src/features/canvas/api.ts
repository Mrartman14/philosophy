// src/features/canvas/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";

import type {
  AttachmentDTO,
  Canvas,
  CanvasRevision,
  CanvasRevisionMeta,
  CanvasSummary,
} from "./types";

export interface CanvasListFilter {
  q?: string;
  offset?: number;
  limit?: number;
}

export interface CanvasListResult {
  items: CanvasSummary[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Канвас + его ETag (значение заголовка ответа GET, КАВЫЧКИ ВКЛЮЧЕНЫ).
 * etag — источник истины для оптимистичной блокировки (If-Match на PUT).
 * НЕ берём версию из JSON-поля canvas.updated_at: Go сериализует time.Time
 * как RFC3339Nano и обрезает хвостовые нули дробной части (`.000Z` → `Z`),
 * тогда как бек сравнивает по фиксированному `.000Z` — это давало ложный 412.
 * Заголовок ETag эмитится в правильном `"...000Z"` формате (см. handler.go).
 */
export interface CanvasWithETag {
  canvas: Canvas;
  /** Сырое значение заголовка ETag (с кавычками) или null, если бек не прислал. */
  etag: string | null;
}

/** Список доступных канвасов (GET /api/canvases — свои + публичные). Гейт — auth. */
export const getCanvases = cache(
  async (filter: CanvasListFilter = {}): Promise<CanvasListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const query: { offset: number; limit: number; q?: string } = { offset, limit };
    if (filter.q) query.q = filter.q;
    const { data, error } = await api.GET("/api/canvases", { params: { query } });
    if (error) throw new Error(error.error ?? "Не удалось загрузить канвасы");
    return {
      items: (data?.data ?? []) as CanvasSummary[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);

/**
 * Канвас по id (GET /api/canvases/{id}). 404 → null. token (?token=) — для
 * приватных через share-link (shareTokenMW). token типизирован в schema.ts,
 * поэтому передаём через обычный typed query (cast не нужен).
 *
 * Возвращает `{ canvas, etag }`: etag — значение заголовка ответа ETag
 * (openapi-fetch отдаёт сырой `response`), которое нужно слать обратно как
 * If-Match на PUT. См. CanvasWithETag.
 */
export const getCanvasById = cache(
  async (id: string, token?: string): Promise<CanvasWithETag | null> => {
    const api = await createApiClient();
    const query: { token?: string } = {};
    if (token) query.token = token;
    const { data, error, response } = await api.GET("/api/canvases/{id}", {
      params: { path: { id }, query },
    });
    if (response.status === 404) return null;
    if (error) throw new Error(error.error ?? "Не удалось загрузить канвас");
    const canvas = (data?.data ?? null) as Canvas | null;
    if (!canvas) return null;
    return { canvas, etag: response.headers.get("ETag") };
  },
);

/**
 * Список ревизий (GET /api/canvases/{id}/revisions). created_at ASC — слайс
 * переворачивает в мостике. Только у public. token — для приватных через share.
 */
export const getCanvasRevisions = cache(
  async (id: string, token?: string): Promise<CanvasRevisionMeta[]> => {
    const api = await createApiClient();
    const query: { token?: string } = {};
    if (token) query.token = token;
    const { data, error } = await api.GET("/api/canvases/{id}/revisions", {
      params: { path: { id }, query },
    });
    if (error) throw new Error(error.error ?? "Не удалось загрузить ревизии");
    return (data?.data ?? []) as CanvasRevisionMeta[];
  },
);

/** Одна ревизия (GET /api/canvases/{id}/revisions/{rev}). rev = rev_num (int). 404 → null. */
export const getCanvasRevision = cache(
  async (id: string, rev: number, token?: string): Promise<CanvasRevision | null> => {
    const api = await createApiClient();
    const query: { token?: string } = {};
    if (token) query.token = token;
    const { data, error, response } = await api.GET("/api/canvases/{id}/revisions/{rev}", {
      params: { path: { id, rev }, query },
    });
    if (response.status === 404) return null;
    if (error) throw new Error(error.error ?? "Не удалось загрузить ревизию");
    return (data?.data ?? null) as CanvasRevision | null;
  },
);

/** Лекции-контейнеры канваса (reverse-lookup GET /api/canvases/{id}/attachments). */
export const getCanvasContainers = cache(
  async (id: string, token?: string): Promise<AttachmentDTO[]> => {
    const api = await createApiClient();
    const query: { token?: string } = {};
    if (token) query.token = token;
    const { data, error } = await api.GET("/api/canvases/{id}/attachments", {
      params: { path: { id }, query },
    });
    if (error) throw new Error(error.error ?? "Не удалось загрузить привязки");
    return (data?.data ?? []) as AttachmentDTO[];
  },
);
