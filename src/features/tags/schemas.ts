// src/features/tags/schemas.ts
import "server-only";
import { z } from "zod";

import type { NamespaceT } from "@/i18n";

type ValidationT = NamespaceT<"validation">;

/** Бекенд: name required, min=1, max=100 (internal/tag/request.go). */
function makeTagName(t: ValidationT) {
  return z
    .string()
    .trim()
    .min(1, t("tags.nameRequired"))
    .max(100, t("tags.nameMax"));
}

function makeTagId(t: ValidationT) {
  return z.coerce.number().int(t("tags.invalidId")).positive(t("tags.invalidId"));
}

export function makeTagCreateSchema(t: ValidationT) {
  return z.object({
    name: makeTagName(t),
  });
}

export function makeTagUpdateSchema(t: ValidationT) {
  return z.object({
    id: makeTagId(t),
    name: makeTagName(t),
  });
}

export const TagIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * tag_ids приходит из hidden input как JSON-строка (parseFormData не
 * поддерживает multi-value поля — см. src/utils/create-action.ts).
 * Пустой массив валиден: бекенд трактует его как «снять все теги».
 */
export function makeSetLectureTagsSchema(t: ValidationT) {
  return z.object({
    lecture_id: z.uuid(t("tags.invalidLectureId")),
    tag_ids: z
      .string()
      .min(1, t("tags.tagIdsEmpty"))
      .transform((s, ctx) => {
        try {
          const parsed: unknown = JSON.parse(s);
          if (
            !Array.isArray(parsed) ||
            !parsed.every(
              (n) => typeof n === "number" && Number.isInteger(n) && n > 0,
            )
          ) {
            ctx.addIssue({
              code: "custom",
              message: t("tags.tagIdsInvalid"),
            });
            return z.NEVER;
          }
          return parsed as number[];
        } catch {
          ctx.addIssue({
            code: "custom",
            message: t("tags.tagIdsBadJson"),
          });
          return z.NEVER;
        }
      }),
  });
}

export type TagCreateInput = z.infer<ReturnType<typeof makeTagCreateSchema>>;
/** Вход формы (pre-transform): имена полей и их required-ность для createTypedForm. */
export type TagCreateFormInput = z.input<ReturnType<typeof makeTagCreateSchema>>;
export type TagUpdateInput = z.infer<ReturnType<typeof makeTagUpdateSchema>>;
/** Вход формы (pre-transform): имена полей и их required-ность для createTypedForm. */
export type TagUpdateFormInput = z.input<ReturnType<typeof makeTagUpdateSchema>>;
export type TagIdInput = z.infer<typeof TagIdSchema>;
export type SetLectureTagsInput = z.infer<ReturnType<typeof makeSetLectureTagsSchema>>;
