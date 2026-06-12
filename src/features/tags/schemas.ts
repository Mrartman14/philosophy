// src/features/tags/schemas.ts
import "server-only";
import { z } from "zod";

/** Бекенд: name required, min=1, max=100 (internal/tag/request.go). */
const TagName = z
  .string()
  .trim()
  .min(1, "Введите имя тега")
  .max(100, "До 100 символов");

export const TagCreateSchema = z.object({
  name: TagName,
});

export const TagUpdateSchema = z.object({
  id: z.coerce.number().int("Некорректный id тега").positive("Некорректный id тега"),
  name: TagName,
});

export const TagIdSchema = z.object({
  id: z.coerce.number().int("Некорректный id тега").positive("Некорректный id тега"),
});

/**
 * tag_ids приходит из hidden input как JSON-строка (parseFormData не
 * поддерживает multi-value поля — см. src/utils/create-action.ts).
 * Пустой массив валиден: бекенд трактует его как «снять все теги».
 */
export const SetLectureTagsSchema = z.object({
  lecture_id: z.string().uuid("Некорректный id лекции"),
  tag_ids: z
    .string()
    .min(1, "Пустое поле tag_ids")
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
            code: z.ZodIssueCode.custom,
            message: "tag_ids должен быть массивом целых положительных id",
          });
          return z.NEVER;
        }
        return parsed as number[];
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Битый JSON в tag_ids",
        });
        return z.NEVER;
      }
    }),
});

export type TagCreateInput = z.infer<typeof TagCreateSchema>;
export type TagUpdateInput = z.infer<typeof TagUpdateSchema>;
export type TagIdInput = z.infer<typeof TagIdSchema>;
export type SetLectureTagsInput = z.infer<typeof SetLectureTagsSchema>;
