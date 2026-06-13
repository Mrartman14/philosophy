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
 */
export const getCanvasById = cache(
  async (id: string, token?: string): Promise<Canvas | null> => {
    const api = await createApiClient();
    const query: { token?: string } = {};
    if (token) query.token = token;
    const { data, error, response } = await api.GET("/api/canvases/{id}", {
      params: { path: { id }, query },
    });
    if (response.status === 404) return null;
    if (error) throw new Error(error.error ?? "Не удалось загрузить канвас");
    return (data?.data ?? null) as Canvas | null;
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
