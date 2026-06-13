// src/features/share-links/types.ts
import type { components } from "@/api/schema";

/** Модель share-ссылки: GET/POST /api/share-links → data[]. */
export type ShareLink = components["schemas"]["sharelink.ShareLink"];

/** Тип ресурса, поддерживаемый бекендом (model.go: ResourceType). */
export type ResourceType = components["schemas"]["sharelink.ResourceType"];

/**
 * Типы ресурсов, для которых фронт ПРЕДЛАГАЕТ создать ссылку.
 * canvas исключён: фича canvas вне скоупа (spec §4). Бек принял бы canvas,
 * но UI его не показывает.
 */
export const SHARE_RESOURCE_TYPES = [
  "lecture",
  "document",
  "trail",
  "media",
  "form",
] as const satisfies readonly ResourceType[];

/**
 * Все типы, которые может вернуть бек (включая canvas) — для валидации
 * lookup-форм и admin-модерации, где может встретиться canvas-ссылка.
 */
export const ALL_RESOURCE_TYPES = [
  "lecture",
  "document",
  "trail",
  "media",
  "form",
  "canvas",
] as const satisfies readonly ResourceType[];

/** Человекочитаемые подписи типов ресурсов (ru) для UI. */
export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  lecture: "Лекция",
  document: "Документ",
  trail: "Трейл",
  media: "Медиа",
  form: "Форма",
  canvas: "Канвас",
};
