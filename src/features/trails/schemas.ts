// src/features/trails/schemas.ts
import "server-only";
import { z } from "zod";

import { VISIBILITY } from "@/api/enums";

const TitleSchema = z
  .string()
  .trim()
  .min(1, "Введите название")
  .max(200, "До 200 символов");

const DescriptionSchema = z
  .string()
  .max(2000, "До 2000 символов");

const VisibilityEnum = z.enum(VISIBILITY);

const TrailIdField = z.uuid("Некорректный id маршрута");

/**
 * Парсит JSON-строку lecture_ids из скрытого поля формы в массив uuid лекций.
 * Пустой массив допустим (полная очистка содержимого). Дубликаты запрещены —
 * бек вернул бы 422 `duplicate lecture_id`, ловим заранее в UI.
 */
const LectureIdsJsonSchema = z
  .string()
  .min(1, "Список не задан")
  .transform((s, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(s);
    } catch {
      ctx.addIssue({ code: "custom", message: "Битый JSON в списке лекций" });
      return z.NEVER;
    }
    if (!Array.isArray(parsed)) {
      ctx.addIssue({ code: "custom", message: "Список должен быть массивом" });
      return z.NEVER;
    }
    const ids = parsed as unknown[];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of ids) {
      if (typeof item !== "string") {
        ctx.addIssue({ code: "custom", message: "Элемент списка не строка" });
        return z.NEVER;
      }
      // UUID v4 формат (как в остальных схемах слайса).
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item)) {
        ctx.addIssue({ code: "custom", message: "Некорректный id лекции" });
        return z.NEVER;
      }
      if (seen.has(item)) {
        ctx.addIssue({ code: "custom", message: "Лекция добавлена дважды" });
        return z.NEVER;
      }
      seen.add(item);
      out.push(item);
    }
    return out;
  });

/** POST /api/trails. visibility/description опциональны. */
export const TrailCreateSchema = z.object({
  title: TitleSchema,
  description: DescriptionSchema.optional(),
  visibility: VisibilityEnum.optional(),
});

/** PUT /api/trails/{id} (метаданные: title + description). */
export const TrailMetaSchema = z.object({
  id: TrailIdField,
  title: TitleSchema,
  // Пустая строка допустима — очищает описание. Поэтому без .min(1).
  description: DescriptionSchema,
});

/** PATCH /api/trails/{id}/visibility. UI предлагает только private→public. */
export const TrailVisibilitySchema = z.object({
  id: TrailIdField,
  visibility: VisibilityEnum,
});

/** PUT /api/trails/{id}/items. lecture_ids — JSON-массив uuid в порядке. */
export const TrailItemsSchema = z.object({
  id: TrailIdField,
  lecture_ids: LectureIdsJsonSchema,
});

/** Для delete: только id. */
export const TrailIdSchema = z.object({
  id: TrailIdField,
});

export type TrailCreateInput = z.infer<typeof TrailCreateSchema>;
export type TrailMetaInput = z.infer<typeof TrailMetaSchema>;
export type TrailVisibilityInput = z.infer<typeof TrailVisibilitySchema>;
export type TrailItemsInput = z.infer<typeof TrailItemsSchema>;
export type TrailIdInput = z.infer<typeof TrailIdSchema>;
