// src/features/annotations/api.ts
import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";

import { createApiClient } from "@/api/client";

import {
  PER_ENTITY_PATH,
  type Annotation,
  type AnnotationListResponse,
  type AnnotationListResult,
  type AnnotationRevisionMeta,
  type AnnotationRevision,
  type ParentEntityType,
} from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

function toResult(
  resp: AnnotationListResponse | null,
  offset: number,
  limit: number,
): AnnotationListResult {
  return {
    items: resp?.data ?? [],
    total: resp?.pagination?.total ?? 0,
    offset: resp?.pagination?.offset ?? offset,
    limit: resp?.pagination?.limit ?? limit,
  };
}

/**
 * Список аннотаций на конкретной сущности. Роут `GET /api/{entity}/{id}/
 * annotations` НЕ описан в schema.ts (§10.2) — ручной fetch с токеном из
 * cookie (паттерн export/route.ts). Бек применяет матрицу видимости: аноним
 * видит только public, актор — свои (любые) + чужие public.
 */
export const getAnnotationsFor = cache(
  async (
    parentEntityType: ParentEntityType,
    parentId: string,
    offset = 0,
    limit = 20,
  ): Promise<AnnotationListResult> => {
    const token = (await cookies()).get("token")?.value;
    const seg = PER_ENTITY_PATH[parentEntityType];
    const url = new URL(
      `${API_URL}/api/${seg}/${encodeURIComponent(parentId)}/annotations`,
    );
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("limit", String(limit));
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    // 404 (parent невидим) → пустой список, не валим страницу.
    if (res.status === 404) return toResult(null, offset, limit);
    if (!res.ok) {
      throw new Error(`Не удалось загрузить аннотации (${res.status})`);
    }
    const json = (await res.json()) as AnnotationListResponse;
    return toResult(json, offset, limit);
  },
);

/** Одна аннотация по id (GET /api/annotations/{id} — optional-auth). */
export const getAnnotationById = cache(
  async (id: string): Promise<Annotation | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/annotations/{id}", {
      params: { path: { id } },
    });
    if (response.status === 404) return null;
    if (error) throw new Error(error?.error ?? "Не удалось загрузить аннотацию");
    return (data?.data ?? null) as Annotation | null;
  },
);

/** «Мои аннотации» (GET /api/me/annotations, требует auth). */
export const getMyAnnotations = cache(
  async (
    offset = 0,
    limit = 20,
    parentEntityType?: ParentEntityType,
  ): Promise<AnnotationListResult> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/me/annotations", {
      params: {
        query: {
          offset,
          limit,
          ...(parentEntityType ? { parent_entity_type: parentEntityType } : {}),
        },
      },
    });
    if (error) throw new Error(error?.error ?? "Не удалось загрузить мои аннотации");
    return {
      items: (data?.data ?? []) as Annotation[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);

/** Агрегация по лекции (GET /api/lectures/{id}/annotations — есть в schema.ts). */
export const getLectureAnnotations = cache(
  async (
    lectureId: string,
    offset = 0,
    limit = 20,
    parentEntityType?: "document" | "comment" | "media",
  ): Promise<AnnotationListResult> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/lectures/{id}/annotations", {
      params: {
        path: { id: lectureId },
        query: {
          offset,
          limit,
          ...(parentEntityType ? { parent_entity_type: parentEntityType } : {}),
        },
      },
    });
    if (error) throw new Error(error?.error ?? "Не удалось загрузить аннотации лекции");
    return {
      items: (data?.data ?? []) as Annotation[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);

/** Admin-список публичных аннотаций (GET /api/admin/annotations). */
export const getAdminAnnotations = cache(
  async (filter: {
    parent_entity_type?: string;
    parent_entity_id?: string;
    author_id?: string;
    offset?: number;
    limit?: number;
  }): Promise<AnnotationListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const { data, error } = await api.GET("/api/admin/annotations", {
      params: {
        query: {
          offset,
          limit,
          ...(filter.parent_entity_type
            ? { parent_entity_type: filter.parent_entity_type }
            : {}),
          ...(filter.parent_entity_id
            ? { parent_entity_id: filter.parent_entity_id }
            : {}),
          ...(filter.author_id ? { author_id: filter.author_id } : {}),
        },
      },
    });
    if (error) throw new Error(error?.error ?? "Не удалось загрузить список аннотаций");
    return {
      items: (data?.data ?? []) as Annotation[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);

/** Список ревизий аннотации (GET /api/annotations/{id}/revisions). */
export const getAnnotationRevisions = cache(
  async (id: string): Promise<AnnotationRevisionMeta[]> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/annotations/{id}/revisions", {
      params: { path: { id } },
    });
    if (error) throw new Error(error?.error ?? "Не удалось загрузить ревизии");
    return (data?.data ?? []) as AnnotationRevisionMeta[];
  },
);

/** Одна ревизия (GET /api/annotations/{id}/revisions/{revisionID}). */
export const getAnnotationRevision = cache(
  async (id: string, revisionId: string): Promise<AnnotationRevision | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET(
      "/api/annotations/{id}/revisions/{revisionID}",
      { params: { path: { id, revisionID: revisionId } } },
    );
    if (response.status === 404) return null;
    if (error) throw new Error(error?.error ?? "Не удалось загрузить ревизию");
    return (data?.data ?? null) as AnnotationRevision | null;
  },
);

/**
 * Контекст блока для резолва text-якоря. schema.ts типизирует data ответа
 * `GET /api/blocks/{block_id}` как ast.Block (text?: string). Возвращает текст
 * блока или null (graceful: 404/ошибка → null).
 */
export const getBlockContext = cache(
  async (blockId: string): Promise<{ exact?: string | undefined } | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/blocks/{block_id}", {
      params: { path: { block_id: blockId } },
    });
    if (response.status === 404 || error) return null;
    const text = data?.data?.text;
    return { exact: text };
  },
);
