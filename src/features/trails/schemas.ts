// src/features/trails/schemas.ts
import "server-only";
import { z } from "zod";

import { VISIBILITY } from "@/api/enums";
import type { NamespaceT } from "@/i18n";

type ValidationT = NamespaceT<"validation">;

const VisibilityEnum = z.enum(VISIBILITY);

function makeTitleSchema(t: ValidationT) {
  return z
    .string()
    .trim()
    .min(1, t("common.titleRequired"))
    .max(200, t("trails.titleMax"));
}

function makeDescriptionSchema(t: ValidationT) {
  return z.string().max(2000, t("trails.descriptionMax"));
}

function makeTrailIdField(t: ValidationT) {
  return z.uuid(t("trails.invalidId"));
}

/**
 * Парсит JSON-строку document_ids из скрытого поля формы в массив uuid документов.
 * Пустой массив допустим (полная очистка содержимого). Дубликаты запрещены —
 * бек вернул бы 422 `duplicate document_id`, ловим заранее в UI.
 */
function makeDocumentIdsJsonSchema(t: ValidationT) {
  return z
    .string()
    .min(1, t("trails.documentIdsRequired"))
    .transform((s, ctx) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(s);
      } catch {
        ctx.addIssue({ code: "custom", message: t("trails.documentIdsBadJson") });
        return z.NEVER;
      }
      if (!Array.isArray(parsed)) {
        ctx.addIssue({ code: "custom", message: t("trails.documentIdsNotArray") });
        return z.NEVER;
      }
      const ids = parsed as unknown[];
      const out: string[] = [];
      const seen = new Set<string>();
      for (const item of ids) {
        if (typeof item !== "string") {
          ctx.addIssue({ code: "custom", message: t("trails.documentItemNotString") });
          return z.NEVER;
        }
        // UUID-формат (как в остальных схемах слайса — z.uuid()).
        if (!z.uuid().safeParse(item).success) {
          ctx.addIssue({ code: "custom", message: t("trails.documentItemInvalidId") });
          return z.NEVER;
        }
        if (seen.has(item)) {
          ctx.addIssue({ code: "custom", message: t("trails.documentItemDuplicate") });
          return z.NEVER;
        }
        seen.add(item);
        out.push(item);
      }
      return out;
    });
}

/** POST /api/trails. visibility/description опциональны. */
export function makeTrailCreateSchema(t: ValidationT) {
  return z.object({
    title: makeTitleSchema(t),
    description: makeDescriptionSchema(t).optional(),
    visibility: VisibilityEnum.optional(),
  });
}

/** PUT /api/trails/{id} (метаданные: title + description). */
export function makeTrailMetaSchema(t: ValidationT) {
  return z.object({
    id: makeTrailIdField(t),
    title: makeTitleSchema(t),
    // Пустая строка допустима — очищает описание. Поэтому без .min(1).
    description: makeDescriptionSchema(t),
  });
}

/** PATCH /api/trails/{id}/visibility. UI предлагает только private→public. */
export const TrailVisibilitySchema = z.object({
  id: z.uuid(),
  visibility: VisibilityEnum,
});

/** PUT /api/trails/{id}/items. document_ids — JSON-массив uuid в порядке. */
export function makeTrailItemsSchema(t: ValidationT) {
  return z.object({
    id: makeTrailIdField(t),
    document_ids: makeDocumentIdsJsonSchema(t),
  });
}

/** Для delete: только id. */
export const TrailIdSchema = z.object({
  id: z.uuid(),
});

export type TrailCreateInput = z.infer<ReturnType<typeof makeTrailCreateSchema>>;
export type TrailMetaInput = z.infer<ReturnType<typeof makeTrailMetaSchema>>;
export type TrailVisibilityInput = z.infer<typeof TrailVisibilitySchema>;
export type TrailItemsInput = z.infer<ReturnType<typeof makeTrailItemsSchema>>;
export type TrailIdInput = z.infer<typeof TrailIdSchema>;
