// src/features/media/schemas.ts
import "server-only";
import { z } from "zod";

import { VISIBILITY } from "@/api/enums";

/** Валидация media_id перед DELETE. */
export const MediaIdSchema = z.object({
  id: z.uuid("Некорректный id медиа"),
});

/**
 * PATCH /api/media/{id}/visibility. Схема принимает обе видимости —
 * бекенд сам отвергает public→private (422 PUBLIC_IMMUTABLE). UI вызывает
 * только private→public, но валидатор схемы остаётся общим.
 */
export const MediaVisibilitySchema = z.object({
  id: z.uuid("Некорректный id медиа"),
  visibility: z.enum(VISIBILITY),
});

export type MediaIdInput = z.infer<typeof MediaIdSchema>;
export type MediaVisibilityInput = z.infer<typeof MediaVisibilitySchema>;
