// src/features/events/schemas.ts
import "server-only";
import { z } from "zod";

import type { NamespaceT } from "@/i18n";
import { blocksJsonField } from "@/utils/blocks-json";
import { wallClockToRfc3339, DATE_ONLY as DATE_ONLY_RE } from "@/utils/datetime-form";

type ValidationT = NamespaceT<"validation">;

function makeEventFieldsSchema(t: ValidationT) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(1, t("common.titleRequired"))
      .max(500, t("events.titleMax")),
    // Чекбокс: ключ есть в FormData только если включён (значение "on").
    all_day: z.string().optional(),
    start_date: z.string().trim().min(1, t("events.startDateRequired")),
    end_date: z.string().trim().optional(),
    rrule: z.string().trim().max(500, t("events.rruleMax")).optional(),
  });
}

type EventFieldsRaw = z.infer<ReturnType<typeof makeEventFieldsSchema>>;

function normalizeFields(raw: EventFieldsRaw, tz: string) {
  const allDay = raw.all_day !== undefined;
  return {
    title: raw.title,
    all_day: allDay,
    start_date: allDay ? raw.start_date : wallClockToRfc3339(raw.start_date, tz),
    end_date: !raw.end_date
      ? undefined
      : allDay
        ? raw.end_date
        : wallClockToRfc3339(raw.end_date, tz),
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- пустая строка "" трактуется как «не задано» (form trim + optional), ?? оставил бы "" как валидное значение
    rrule: raw.rrule ? raw.rrule : undefined,
  };
}

type NormalizedFields = ReturnType<typeof normalizeFields>;

function makeValidateFields(t: ValidationT) {
  return function validateFields(v: NormalizedFields, ctx: z.RefinementCtx): void {
    if (v.all_day) {
      if (!DATE_ONLY_RE.test(v.start_date)) {
        ctx.addIssue({
          code: "custom",
          path: ["start_date"],
          message: t("events.dateFormat"),
        });
      }
      if (v.end_date && !DATE_ONLY_RE.test(v.end_date)) {
        ctx.addIssue({
          code: "custom",
          path: ["end_date"],
          message: t("events.dateFormat"),
        });
      }
    } else {
      if (Number.isNaN(Date.parse(v.start_date))) {
        ctx.addIssue({
          code: "custom",
          path: ["start_date"],
          message: t("events.startDateTimeRequired"),
        });
      }
      if (v.end_date && Number.isNaN(Date.parse(v.end_date))) {
        ctx.addIssue({
          code: "custom",
          path: ["end_date"],
          message: t("events.endDateTimeRequired"),
        });
      }
    }
    // Оба значения нормализованы к одному формату — лексикографическое
    // сравнение корректно и для YYYY-MM-DD, и для RFC3339.
    if (v.end_date && v.end_date < v.start_date) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: t("events.endBeforeStart"),
      });
    }
    if (v.rrule && !v.rrule.startsWith("FREQ=")) {
      ctx.addIssue({
        code: "custom",
        path: ["rrule"],
        message: t("events.rrulePrefix"),
      });
    }
  };
}

export function makeEventCreateSchema(t: ValidationT, tz = "UTC") {
  return makeEventFieldsSchema(t)
    .transform((raw) => normalizeFields(raw, tz))
    .superRefine(makeValidateFields(t));
}

export function makeEventUpdateSchema(t: ValidationT, tz = "UTC") {
  const BlocksJsonSchema = blocksJsonField({
    allowEmpty: true,
    messages: {
      invalidJson: t("events.blocksInvalidJson"),
      notArray: t("common.blocksNotArray"),
    },
  });

  return makeEventFieldsSchema(t)
    .extend({
      id: z.uuid(t("events.invalidId")),
      blocks: BlocksJsonSchema,
    })
    .transform((raw) => ({
      ...normalizeFields(raw, tz),
      id: raw.id,
      blocks: raw.blocks,
    }))
    .superRefine(makeValidateFields(t));
}

export function makeEventIdSchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("events.invalidId")),
  });
}

export type EventCreateInput = z.infer<ReturnType<typeof makeEventCreateSchema>>;
/** Вход формы (pre-transform): имена полей и их required-ность для createTypedForm. */
export type EventCreateFormInput = z.input<ReturnType<typeof makeEventCreateSchema>>;
export type EventUpdateInput = z.infer<ReturnType<typeof makeEventUpdateSchema>>;
/** Вход формы (pre-transform): имена полей и их required-ность для createTypedForm. */
export type EventUpdateFormInput = z.input<ReturnType<typeof makeEventUpdateSchema>>;
export type EventIdInput = z.infer<ReturnType<typeof makeEventIdSchema>>;
