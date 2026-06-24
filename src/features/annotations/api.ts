// src/features/annotations/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";
import { getT } from "@/i18n";
import { unwrap, unwrapList } from "@/utils/api-unwrap";

import {
  type Annotation,
  type AnnotationListResult,
  type AnnotationRevisionMeta,
  type AnnotationRevision,
  type BackendParentEntityType,
  type ParentEntityType,
} from "./types";

/**
 * Список аннотаций на конкретной сущности через типизированный openapi-fetch
 * клиент. Роут `GET /api/{entity}/{id}/annotations` (§10.2) бэк добавил в
 * OpenAPI → ручной fetch-стопгап снят. openapi-fetch требует ЛИТЕРАЛЬНЫЙ путь
 * для вывода типов params/query, поэтому диспатчим по 4 значениям
 * ParentEntityType через `switch`. Бек применяет матрицу видимости: аноним
 * видит только public, актор — свои (любые) + чужие public.
 */
export const getAnnotationsFor = cache(
  async (
    parentEntityType: ParentEntityType,
    parentId: string,
    offset = 0,
    limit = 20,
  ): Promise<AnnotationListResult> => {
    const api = await createApiClient();
    const init = {
      params: { path: { id: parentId }, query: { offset, limit } },
    } as const;
    const get = (type: ParentEntityType) => {
      switch (type) {
        case "document":
          return api.GET("/api/documents/{id}/annotations", init);
        case "comment":
          return api.GET("/api/comments/{id}/annotations", init);
        case "glossary":
          return api.GET("/api/glossary/{id}/annotations", init);
        case "media":
          return api.GET("/api/media/{id}/annotations", init);
      }
    };
    const { data, error, response } = await get(parentEntityType);
    // 404 (parent невидим) → пустой список, не валим страницу.
    if (response.status === 404) return unwrapList({}, { offset, limit });
    if (error)
      throw new Error(
        error.error ??
          (await getT("annotations"))("api.loadListFailedStatus", {
            status: response.status,
          }),
      );
    return unwrapList(data, { offset, limit });
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
    if (error) throw new Error(error.error ?? (await getT("annotations"))("api.loadItemFailed"));
    return unwrap(data);
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
    if (error) throw new Error(error.error ?? (await getT("annotations"))("api.loadMyFailed"));
    return unwrapList(data, { offset, limit });
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
    if (error) throw new Error(error.error ?? (await getT("annotations"))("api.loadLectureFailed"));
    return unwrapList(data, { offset, limit });
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
          // Admin-фильтр приходит нетипизированной строкой из URL searchParams;
          // бэк валидирует значение, здесь кастим к полному доменному union'у,
          // которого ждёт сгенерированный query-тип (после регена schema.ts).
          ...(filter.parent_entity_type
            ? {
                parent_entity_type:
                  filter.parent_entity_type as BackendParentEntityType,
              }
            : {}),
          ...(filter.parent_entity_id
            ? { parent_entity_id: filter.parent_entity_id }
            : {}),
          ...(filter.author_id ? { author_id: filter.author_id } : {}),
        },
      },
    });
    if (error) throw new Error(error.error ?? (await getT("annotations"))("api.loadAdminFailed"));
    return unwrapList(data, { offset, limit });
  },
);

/** Список ревизий аннотации (GET /api/annotations/{id}/revisions). */
export const getAnnotationRevisions = cache(
  async (id: string): Promise<AnnotationRevisionMeta[]> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/annotations/{id}/revisions", {
      params: { path: { id } },
    });
    if (error) throw new Error(error.error ?? (await getT("annotations"))("api.loadRevisionsFailed"));
    return unwrap(data) ?? [];
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
    if (error) throw new Error(error.error ?? (await getT("annotations"))("api.loadRevisionFailed"));
    return unwrap(data);
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
    const text = data.data?.text;
    return { exact: text };
  },
);
