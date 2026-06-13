// src/features/annotations/types.ts
import type { components } from "@/api/schema";

/** Аннотация (заметка пользователя с AST-телом и якорем). */
export type Annotation = components["schemas"]["annotation.Annotation"];

/** Видимость аннотации. Фиксируется при создании (спека §6.8). */
export type AnnotationVisibility =
  components["schemas"]["annotation.Visibility"];

/** Якорь — text-range или media-interval (взаимоисключающие). */
export type Anchor = components["schemas"]["annotation.Anchor"];

/** Тело POST-создания. Тип schema.ts валиден, хотя путь — фикция (§10.1). */
export type AnnotationCreateBody =
  components["schemas"]["annotation.CreateRequest"];

/** Тело PUT-редактирования (без visibility — она иммутабельна). */
export type AnnotationUpdateBody =
  components["schemas"]["annotation.UpdateRequest"];

/** AST-блок (тело аннотации). */
export type AnnotationBlock = components["schemas"]["ast.Block"];

/** Мета ревизии (элемент списка). */
export type AnnotationRevisionMeta =
  components["schemas"]["revision.RevisionMeta"];

/** Полная ревизия со снапшотом blocks. */
export type AnnotationRevision = components["schemas"]["revision.Revision"];

/**
 * Полный домен parent-типов с бэка (сгенерированный enum). Источник истины.
 */
type BackendParentEntityType =
  components["schemas"]["annotation.ParentEntityType"];

/**
 * Подмножество parent-типов, для которых строим UI создания/просмотра.
 * Бек поддерживает также banner/event/canvas, UI для них не делаем (§4).
 * `Extract` якорит к бэку: если бэк удалит/переименует одно из 4 значений,
 * downstream-потребители (PER_ENTITY_PATH Record) → ошибка tsc.
 */
export type ParentEntityType = Extract<
  BackendParentEntityType,
  "document" | "glossary" | "media" | "comment"
>;

/**
 * Рантайм-набор UI parent-типов + двусторонний drift-гард (по образцу
 * share-links/types.ts). `satisfies Record<ParentEntityType, true>` валит tsc,
 * если набор разойдётся с типом в любую сторону. Из него строятся Zod-схемы и
 * options селекта — единственная рантайм-копия значений в слайсе.
 */
const PARENT_ENTITY_TYPE_SET = {
  document: true,
  glossary: true,
  media: true,
  comment: true,
} as const satisfies Record<ParentEntityType, true>;

export const PARENT_ENTITY_TYPES = Object.keys(
  PARENT_ENTITY_TYPE_SET,
) as [ParentEntityType, ...ParentEntityType[]];

/**
 * Реальный путь пер-сущностного роута `/api/{entity}/{id}/annotations`
 * (§10.1: documents/comments/glossary/media). Единый источник для `api.ts`
 * (список) и `actions.ts` (создание) — этих роутов нет в schema.ts.
 */
export const PER_ENTITY_PATH: Record<ParentEntityType, string> = {
  document: "documents",
  comment: "comments",
  glossary: "glossary",
  media: "media",
};

/**
 * Ответ пер-сущностного списка `GET /api/{entity}/{id}/annotations`.
 * Этих роутов НЕТ в schema.ts (§10.2) — типизируем вручную. Форма ответа —
 * стандартный httputil.ListResponse (data + pagination), как у лекционного
 * списка (schema.ts строка 8162).
 */
export interface AnnotationListResponse {
  data: Annotation[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
  };
}

/** Унифицированный результат списка для UI-компонентов. */
export interface AnnotationListResult {
  items: Annotation[];
  total: number;
  offset: number;
  limit: number;
}
