// src/features/documents/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";
import { unwrap, unwrapList } from "@/utils/api-unwrap";

import type {
  AttachmentDTO,
  Document,
  DocumentRevision,
  DocumentRevisionMeta,
} from "./types";

export interface DocumentListFilter {
  offset?: number;
  limit?: number;
  freeFloating?: boolean;
}

export interface DocumentListResult {
  items: Document[];
  total: number;
  offset: number;
  limit: number;
}

export interface AdminDocumentListFilter {
  offset?: number;
  limit?: number;
  ownerId?: string;
}

/** Мои документы (GET /api/me/documents). Гейт — auth. */
export const getMyDocuments = cache(
  async (filter: DocumentListFilter = {}): Promise<DocumentListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const query: { offset: number; limit: number; free_floating?: boolean } = {
      offset,
      limit,
    };
    if (filter.freeFloating) query.free_floating = true;
    const { data, error } = await api.GET("/api/me/documents", { params: { query } });
    if (error) throw new Error(error.error ?? "Не удалось загрузить документы");
    return unwrapList(data, { offset, limit });
  },
);

/**
 * Документ по id (GET /api/documents/{id}). 404 → null.
 * token (?token=) пробрасывается для приватных документов через share-link
 * (shareTokenMW, philosophy-api cmd/server/main.go:929). Без токена — поведение
 * прежнее. schema.ts не объявляет token в query (§10.5) → cast `as never`.
 */
export const getDocumentById = cache(
  async (id: string, token?: string): Promise<Document | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/documents/{document_id}", {
      params: {
        path: { document_id: id },
        ...(token ? { query: { token } as never } : {}),
      },
    });
    if (response.status === 404) return null;
    if (error) throw new Error(error.error ?? "Не удалось загрузить документ");
    return unwrap(data);
  },
);

/** Лекции-контейнеры документа (reverse-lookup GET /api/documents/{id}/attachments). */
export const getDocumentContainers = cache(
  async (id: string): Promise<AttachmentDTO[]> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/documents/{id}/attachments", {
      params: { path: { id } },
    });
    if (error) throw new Error(error.error ?? "Не удалось загрузить привязки");
    return unwrap(data) ?? [];
  },
);

/**
 * Список ревизий (GET /api/documents/{id}/revisions). Бек отдаёт created_at ASC
 * (старые первыми, потолок 200) — переворачивает мостик ui (см. document-revisions).
 * Существуют только у public-документов.
 */
export const getDocumentRevisions = cache(
  async (id: string): Promise<DocumentRevisionMeta[]> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/documents/{id}/revisions", {
      params: { path: { id } },
    });
    if (error) throw new Error(error.error ?? "Не удалось загрузить ревизии");
    return unwrap(data) ?? [];
  },
);

/** Одна ревизия (GET /api/documents/{id}/revisions/{revisionID}). 404 → null. */
export const getDocumentRevision = cache(
  async (id: string, revisionId: string): Promise<DocumentRevision | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET(
      "/api/documents/{id}/revisions/{revisionID}",
      { params: { path: { id, revisionID: revisionId } } },
    );
    if (response.status === 404) return null;
    if (error) throw new Error(error.error ?? "Не удалось загрузить ревизию");
    return unwrap(data);
  },
);

/** Admin-список документов (GET /api/admin/documents — только НЕ-private). */
export const getAdminDocuments = cache(
  async (filter: AdminDocumentListFilter = {}): Promise<DocumentListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const query: { offset: number; limit: number; owner_id?: string } = { offset, limit };
    if (filter.ownerId) query.owner_id = filter.ownerId;
    const { data, error } = await api.GET("/api/admin/documents", { params: { query } });
    if (error) throw new Error(error.error ?? "Не удалось загрузить документы");
    return unwrapList(data, { offset, limit });
  },
);
