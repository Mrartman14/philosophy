// src/features/trails/types.ts
import type { components } from "@/api/schema";

/** Маршрут без items (список, создание, обновление, admin). */
export type Trail = components["schemas"]["trail.Trail"];

/** Маршрут с упорядоченным списком лекций (GET /api/trails/{id}). */
export type TrailWithItems = components["schemas"]["trail.TrailWithItems"];

/** Элемент маршрута: ссылка на лекцию + позиция. */
export type TrailItem = components["schemas"]["trail.TrailItem"];

/** Видимость: "private" | "public". */
export type TrailVisibility = components["schemas"]["access.Visibility"];

/**
 * Лёгкая сводка документа для отображения items и пикера. Локальный тип, потому
 * что cross-feature импорт запрещён ESLint'ом; данные приходят с /api/documents.
 */
export interface TrailDocumentSummary {
  id: string;
  filename: string;
}

