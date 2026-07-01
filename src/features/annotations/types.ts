// src/features/annotations/types.ts
import type { components } from "@/api/schema";

/** Аннотация (заметка пользователя с AST-телом и якорем). */
export type Annotation = components["schemas"]["annotation.Annotation"];

/** Видимость аннотации. Фиксируется при создании (спека §6.8). */
export type AnnotationVisibility =
  components["schemas"]["access.Visibility"];

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
export type BackendParentEntityType =
  components["schemas"]["annotation.ParentEntityType"];

/**
 * Подмножество parent-типов, для которых строим UI создания/просмотра.
 * Бек поддерживает также banner/event/canvas, UI для них не делаем (§4).
 * `Extract` якорит к бэку: если бэк удалит/переименует одно из 4 значений,
 * downstream-потребители (литеральный `switch` по роутам в actions.ts/api.ts +
 * PARENT_ENTITY_TYPE_SET drift-гард) → ошибка tsc.
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
 * Type-guard на границе движок→слайс: `draft.scope.entityType` это `string`;
 * сужаем к `ParentEntityType` по рантайм-набору (document/glossary/media/comment).
 * Канонический guard рядом с `PARENT_ENTITY_TYPES` — потребляется композером создания.
 */
export function isParentEntityType(value: string): value is ParentEntityType {
  return (PARENT_ENTITY_TYPES as readonly string[]).includes(value);
}

/** Унифицированный результат списка для UI-компонентов. */
export interface AnnotationListResult {
  items: Annotation[];
  total: number;
  offset: number;
  limit: number;
}
