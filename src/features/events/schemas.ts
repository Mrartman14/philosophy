// src/features/events/schemas.ts
import "server-only";
import { z } from "zod";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * datetime-local ("YYYY-MM-DDTHH:mm[:ss]") → RFC3339 с суффиксом Z.
 * Бек для all_day=false требует RFC3339 (internal/event/service.go
 * validateDates). Введённое время трактуется как UTC — осознанное
 * упрощение MVP (см. секцию рисков плана); формы подписаны «(UTC)».
 */
function toRfc3339(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return `${value}:00Z`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return `${value}Z`;
  return value;
}

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
    rrule: raw.rrule ? raw.rrule : undefined,
  };
}

type NormalizedFields = ReturnType<typeof normalizeFields>;

function validateFields(v: NormalizedFields, ctx: z.RefinementCtx): void {
  if (v.all_day) {
    if (!DATE_ONLY_RE.test(v.start_date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["start_date"],
        message: "Формат даты — ГГГГ-ММ-ДД",
      });
    }
    if (v.end_date && !DATE_ONLY_RE.test(v.end_date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: "Формат даты — ГГГГ-ММ-ДД",
      });
    }
  } else {
    if (Number.isNaN(Date.parse(v.start_date))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["start_date"],
        message: "Укажите дату и время начала",
      });
    }
    if (v.end_date && Number.isNaN(Date.parse(v.end_date))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: "Укажите дату и время окончания",
      });
    }
  }
  // Оба значения нормализованы к одному формату — лексикографическое
  // сравнение корректно и для YYYY-MM-DD, и для RFC3339.
  if (v.end_date && v.end_date < v.start_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["end_date"],
      message: "Дата окончания раньше даты начала",
    });
  }
  if (v.rrule && !v.rrule.startsWith("FREQ=")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rrule"],
      message: "RRULE должен начинаться с FREQ=",
    });
  }
}

export const EventCreateSchema = EventFieldsSchema.transform(
  normalizeFields,
).superRefine(validateFields);

const BlocksJsonSchema = z
  .string()
  .min(1, "Тело не может быть пустым")
  .transform((s, ctx) => {
    try {
      const parsed: unknown = JSON.parse(s);
      if (!Array.isArray(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Тело должно быть массивом блоков",
        });
        return z.NEVER;
      }
      return parsed as unknown[];
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Битый JSON в теле формы",
      });
      return z.NEVER;
    }
  });

export const EventUpdateSchema = EventFieldsSchema.extend({
  id: z.string().uuid("Некорректный id события"),
  blocks: BlocksJsonSchema,
})
  .transform((raw) => ({
    ...normalizeFields(raw),
    id: raw.id,
    blocks: raw.blocks,
  }))
  .superRefine(validateFields);

export const EventIdSchema = z.object({
  id: z.string().uuid("Некорректный id события"),
});

export type EventCreateInput = z.infer<typeof EventCreateSchema>;
export type EventUpdateInput = z.infer<typeof EventUpdateSchema>;
export type EventIdInput = z.infer<typeof EventIdSchema>;
