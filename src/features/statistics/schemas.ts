// src/features/_template/schemas.ts
import "server-only";
import { z } from "zod";

/**
 * Zod-схемы для валидации FormData в server actions. Используются через
 * `parseFormData(Schema, formData)`.
 *
 * Хранятся отдельно от actions.ts, чтобы при необходимости их можно было
 * импортировать в client-форму для preview-валидации (через "use client"
 * границу).
 */

// export const EntityCreateSchema = z.object({
//   title: z.string().min(1).max(200),
//   description: z.string().max(1000).optional(),
// });
// export type EntityCreateInput = z.infer<typeof EntityCreateSchema>;

export const PlaceholderSchema = z.object({});
