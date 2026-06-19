// src/features/media/schemas.ts
import "server-only";
import { z } from "zod";

import { VISIBILITY } from "@/api/enums";
import type { NamespaceT } from "@/i18n";

type ValidationT = NamespaceT<"validation">;

/** Фабрика схемы валидации media_id перед DELETE. */
export function makeMediaIdSchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("media.invalidId")),
  });
}

/**
 * Фабрика схемы PATCH /api/media/{id}/visibility. Схема принимает обе видимости —
 * бекенд сам отвергает public→private (422 PUBLIC_IMMUTABLE). UI вызывает
 * только private→public, но валидатор схемы остаётся общим.
 */
export function makeMediaVisibilitySchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("media.invalidId")),
    visibility: z.enum(VISIBILITY),
  });
}

export type MediaIdInput = z.infer<ReturnType<typeof makeMediaIdSchema>>;
export type MediaVisibilityInput = z.infer<ReturnType<typeof makeMediaVisibilitySchema>>;
