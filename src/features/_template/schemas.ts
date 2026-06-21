// src/features/_template/schemas.ts
import "server-only";
import { z } from "zod";

/**
 * Zod-схемы для валидации FormData в server actions. Используются через
 * `parseFormData(Schema, formData)`.
 *
 * Файл server-only (`import "server-only"` выше) — напрямую в "use client"-форму
 * НЕ импортируется (это уронит build: «server-only cannot be imported from a
 * Client Component»). Если схема нужна для client-side preview-валидации — вынеси
 * её в отдельный client-safe модуль и реэкспортни через client.ts
 * (docs/frontend-conventions.md §2.1), а не импортируй этот файл.
 */

// export const EntityCreateSchema = z.object({
//   title: z.string().min(1).max(200),
//   description: z.string().max(1000).optional(),
// });
// export type EntityCreateInput = z.infer<typeof EntityCreateSchema>;

export const PlaceholderSchema = z.object({});
