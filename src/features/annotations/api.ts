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
    token?: string,
  ): Promise<AnnotationListResult> => {
    const api = await createApiClient();
    const init = {
      params: {
        path: { id: parentId },
        query: { offset, limit, ...(token ? { token } : {}) },
      },
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

/** «Мои аннотации» (GET /api/annotations?scope=mine, требует auth). */
export const getMyAnnotations = cache(
  async (
    offset = 0,
    limit = 20,
    parentEntityType?: ParentEntityType,
  ): Promise<AnnotationListResult> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/annotations", {
      params: {
        query: {
          scope: "mine",
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

/** Агрегация по лекции (GET /api/lectures/{id}/annotations — есть в schema.ts).
 *  token (?token=) для приватных лекций через share-link (query объявлен в schema.ts). */
export const getLectureAnnotations = cache(
  async (
    lectureId: string,
    offset = 0,
    limit = 20,
    parentEntityType?: "document" | "comment" | "media",
    token?: string,
  ): Promise<AnnotationListResult> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/lectures/{id}/annotations", {
      params: {
        path: { id: lectureId },
        query: {
          offset,
          limit,
          ...(parentEntityType ? { parent_entity_type: parentEntityType } : {}),
          ...(token ? { token } : {}),
        },
      },
    });
    // 404 (лекция невидима зрителю без гранта) → пустой список, не валим рендер
    // дерева комментов throw'ом (паритет с getAnnotationsFor). Аудит 2026-07-01.
    if (response.status === 404) return unwrapList({}, { offset, limit });
    if (error) throw new Error(error.error ?? (await getT("annotations"))("api.loadLectureFailed"));
    return unwrapList(data, { offset, limit });
  },
);

/**
 * Полная проходка страничной ручки. Терминируем по ПУСТОЙ странице (НЕ по
 * `items.length < limit`) и продвигаем offset на ФАКТИЧЕСКОЕ число элементов.
 * Бэк может клампить limit server-side (частая Go-конвенция, напр. cap 100):
 * тогда (а) `< limit`-предикат оборвал бы обход после 1-й страницы, МОЛЧА потеряв
 * >cap; (б) шаг offset на запрошенный limit ПЕРЕПРЫГНУЛ бы записи. Шаг по
 * items.length + терминация по пустой странице корректны независимо от клампа.
 * `maxPages` — защита от бесконечного цикла на битом бэке.
 */
async function paginateAll(
  fetchPage: (offset: number, limit: number) => Promise<Annotation[]>,
  limit = 200,
  maxPages = 50,
): Promise<Annotation[]> {
  const all: Annotation[] = [];
  let offset = 0;
  for (let page = 0; page < maxPages; page++) {
    const items = await fetchPage(offset, limit);
    if (items.length === 0) break;
    all.push(...items);
    offset += items.length;
  }
  return all;
}

/**
 * ВСЕ аннотации лекции (по типу родителя), все страницы — поверх пагинированной
 * `getLectureAnnotations`. Свой `cache()` дедуплицирует полный обход: N серверных
 * `CommentNode` в дереве дают один проход (а не N). Решение N+1 — лекционный
 * агрегат `GET /api/lectures/{id}/annotations?parent_entity_type=...`, группировка
 * по `parent_entity_id` на стороне потребителя. `token` (?token=) — share-link.
 */
export const getAllLectureAnnotations = cache(
  async (
    lectureId: string,
    parentEntityType?: "document" | "comment" | "media",
    token?: string,
  ): Promise<Annotation[]> =>
    paginateAll((offset, limit) =>
      getLectureAnnotations(lectureId, offset, limit, parentEntityType, token).then(
        (r) => r.items,
      ),
    ),
);

/**
 * ВСЕ аннотации одной сущности (document/comment/glossary/media), все страницы —
 * поверх пагинированной `getAnnotationsFor`. Для маргиналий документа rail больше
 * НЕ усекается на limit (был стопгап limit=200 в DocumentAnnotations — M11/#24):
 * документ с >200 аннотациями теперь собирается полностью. Свой `cache()`
 * дедуплицирует полный обход на запрос. `token` (?token=) — share-link.
 */
export const getAllAnnotationsFor = cache(
  async (
    parentEntityType: ParentEntityType,
    parentId: string,
    token?: string,
  ): Promise<Annotation[]> =>
    paginateAll((offset, limit) =>
      getAnnotationsFor(parentEntityType, parentId, offset, limit, token).then(
        (r) => r.items,
      ),
    ),
);

/** Admin-список публичных аннотаций (GET /api/annotations?scope=all). */
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
    const { data, error } = await api.GET("/api/annotations", {
      params: {
        query: {
          scope: "all",
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
