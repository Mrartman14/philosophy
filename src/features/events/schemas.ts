// src/features/events/schemas.ts
import "server-only";
import { z } from "zod";

import { blocksJsonField } from "@/utils/blocks-json";
import { toRfc3339, DATE_ONLY as DATE_ONLY_RE } from "@/utils/datetime-form";

const EventFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Введите название")
    .max(500, "До 500 символов"),
  // Чекбокс: ключ есть в FormData только если включён (значение "on").
  all_day: z.string().optional(),
  start_date: z.string().trim().min(1, "Укажите дату начала"),
  end_date: z.string().trim().optional(),
  rrule: z.string().trim().max(500, "До 500 символов").optional(),
});

type EventFieldsRaw = z.infer<typeof EventFieldsSchema>;

function normalizeFields(raw: EventFieldsRaw) {
  const allDay = raw.all_day !== undefined;
  return {
    title: raw.title,
    all_day: allDay,
    start_date: allDay ? raw.start_date : toRfc3339(raw.start_date),
    end_date: !raw.end_date
      ? undefined
      : allDay
        ? raw.end_date
        : toRfc3339(raw.end_date),
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- пустая строка "" трактуется как «не задано» (form trim + optional), ?? оставил бы "" как валидное значение
    rrule: raw.rrule ? raw.rrule : undefined,
  };
}

type NormalizedFields = ReturnType<typeof normalizeFields>;

function validateFields(v: NormalizedFields, ctx: z.RefinementCtx): void {
  if (v.all_day) {
    if (!DATE_ONLY_RE.test(v.start_date)) {
      ctx.addIssue({
        code: "custom",
        path: ["start_date"],
        message: "Формат даты — ГГГГ-ММ-ДД",
      });
    }
    if (v.end_date && !DATE_ONLY_RE.test(v.end_date)) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "Формат даты — ГГГГ-ММ-ДД",
      });
    }
  } else {
    if (Number.isNaN(Date.parse(v.start_date))) {
      ctx.addIssue({
        code: "custom",
        path: ["start_date"],
        message: "Укажите дату и время начала",
      });
    }
    if (v.end_date && Number.isNaN(Date.parse(v.end_date))) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "Укажите дату и время окончания",
      });
    }
  }
  // Оба значения нормализованы к одному формату — лексикографическое
  // сравнение корректно и для YYYY-MM-DD, и для RFC3339.
  if (v.end_date && v.end_date < v.start_date) {
    ctx.addIssue({
      code: "custom",
      path: ["end_date"],
      message: "Дата окончания раньше даты начала",
    });
  }
  if (v.rrule && !v.rrule.startsWith("FREQ=")) {
    ctx.addIssue({
      code: "custom",
      path: ["rrule"],
      message: "RRULE должен начинаться с FREQ=",
    });
  }
}

export const EventCreateSchema = EventFieldsSchema.transform(
  normalizeFields,
).superRefine(validateFields);

const BlocksJsonSchema = blocksJsonField({
  allowEmpty: true,
  messages: {
    invalidJson: "Битый JSON в теле формы",
    notArray: "Тело должно быть массивом блоков",
  },
});

export const EventUpdateSchema = EventFieldsSchema.extend({
  id: z.uuid("Некорректный id события"),
  blocks: BlocksJsonSchema,
})
  .transform((raw) => ({
    ...normalizeFields(raw),
    id: raw.id,
    blocks: raw.blocks,
  }))
  .superRefine(validateFields);

export const EventIdSchema = z.object({
  id: z.uuid("Некорректный id события"),
});

export type EventCreateInput = z.infer<typeof EventCreateSchema>;
export type EventUpdateInput = z.infer<typeof EventUpdateSchema>;
export type EventIdInput = z.infer<typeof EventIdSchema>;
