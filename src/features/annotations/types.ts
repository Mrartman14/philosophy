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
 * Подмножество parent-типов, для которых строим UI создания/просмотра.
 * Бек поддерживает также banner/event/canvas, но UI для них не делаем (§4).
 */
export type ParentEntityType = "document" | "glossary" | "media" | "comment";

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
