// src/features/forms/schemas.ts
import "server-only";
import { z } from "zod";

import { VISIBILITY, FORM_SUBMISSION_MODES, FORM_FIELD_TYPES } from "@/api/enums";
import type { NamespaceT } from "@/i18n";

type ValidationT = NamespaceT<"validation">;

function makeUUID(t: ValidationT) {
  return z.uuid(t("forms.invalidId"));
}

function makeTitleSchema(t: ValidationT) {
  return z.string().trim().min(1, t("common.titleRequired")).max(500, t("forms.titleMax"));
}

const VisibilityEnum = z.enum(VISIBILITY);
const ModeEnum = z.enum(FORM_SUBMISSION_MODES);
const FieldTypeEnum = z.enum(FORM_FIELD_TYPES);

/** Описание одного поля в payload конструктора. */
function makeFieldSchema(t: ValidationT) {
  return z
    .object({
      type: FieldTypeEnum,
      prompt: z.string().trim().min(1, t("forms.promptRequired")),
      help_text: z.string().optional(),
      required: z.boolean(),
      sort_order: z.number().int(),
      // Опции — массив plain-строк (label); id генерит бек.
      options: z.array(z.string().trim().min(1, t("forms.emptyOption"))).optional(),
    })
    .superRefine((f, ctx) => {
      const isChoice = f.type === "single_choice" || f.type === "multi_choice";
      const opts = f.options ?? [];
      if (isChoice && opts.length === 0) {
        ctx.addIssue({ code: "custom", message: t("forms.choiceRequiresOptions") });
      }
      if (!isChoice && opts.length > 0) {
        ctx.addIssue({ code: "custom", message: t("forms.optionsOnlyForChoice") });
      }
      if (isChoice && new Set(opts).size !== opts.length) {
        ctx.addIssue({ code: "custom", message: t("forms.duplicateOptions") });
      }
    });
}

/** Полный payload формы (общий для create/update); fields revalidate-уникальность sort_order. */
function makeFormPayloadShape(t: ValidationT) {
  return z
    .object({
      title: makeTitleSchema(t),
      description: z.string().optional(),
      after_submit: z.string().optional(),
      visibility: VisibilityEnum.optional(),
      submission_mode: ModeEnum.optional(),
      fields: z.array(makeFieldSchema(t)).min(1, t("forms.fieldsRequired")),
    })
    .superRefine((p, ctx) => {
      const seen = new Set<number>();
      p.fields.forEach((f, i) => {
        if (seen.has(f.sort_order)) {
          ctx.addIssue({
            code: "custom",
            message: t("forms.duplicateSortOrder", { n: i + 1 }),
          });
        }
        seen.add(f.sort_order);
      });
    });
}

type FormPayload = z.infer<ReturnType<typeof makeFormPayloadShape>>;

/** Парсит JSON-строку payload в объект и прогоняет через FormPayloadShape. */
function makePayloadField(t: ValidationT) {
  return z.string().min(1, t("forms.emptyPayload")).transform((s, ctx): FormPayload => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(s);
    } catch {
      ctx.addIssue({ code: "custom", message: t("forms.badJsonPayload") });
      return z.NEVER;
    }
    const r = makeFormPayloadShape(t).safeParse(parsed);
    if (!r.success) {
      ctx.addIssue({
        code: "custom",
        message: r.error.issues[0]?.message ?? t("forms.payloadStructureError"),
      });
      return z.NEVER;
    }
    return r.data;
  });
}

/** POST /api/forms. visibility/submission_mode обязательны для create. */
export function makeFormCreateSchema(t: ValidationT) {
  return z
    .object({ payload: makePayloadField(t) })
    .transform(({ payload }) => payload)
    .superRefine((p, ctx) => {
      if (!p.visibility) {
        ctx.addIssue({ code: "custom", message: t("forms.visibilityRequired"), path: ["visibility"] });
      }
      if (!p.submission_mode) {
        ctx.addIssue({ code: "custom", message: t("forms.modeRequired"), path: ["submission_mode"] });
      }
    });
}

/** PATCH /api/forms/{id}. Полная замена структуры (бек: fields = replace-all). */
export function makeFormUpdateSchema(t: ValidationT) {
  return z.object({
    id: makeUUID(t),
    payload: makePayloadField(t),
  });
}

/** PATCH /api/forms/{id} visibility-only (UI предлагает только private→public). */
export function makeFormVisibilitySchema(t: ValidationT) {
  return z.object({
    id: makeUUID(t),
    visibility: z.literal("public"),
  });
}

function makeAnswersJsonSchema(t: ValidationT) {
  return z
    .string()
    .min(1, t("forms.emptyAnswers"))
    .transform((s, ctx): z.infer<typeof AnswerWireSchema>[] => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(s);
      } catch {
        ctx.addIssue({ code: "custom", message: t("forms.badJsonAnswers") });
        return z.NEVER;
      }
      if (!Array.isArray(parsed)) {
        ctx.addIssue({ code: "custom", message: t("forms.answersNotArray") });
        return z.NEVER;
      }
      const r = z.array(AnswerWireSchema).safeParse(parsed);
      if (!r.success) {
        ctx.addIssue({ code: "custom", message: t("forms.invalidAnswer") });
        return z.NEVER;
      }
      return r.data;
    });
}

/** Один ответ в submit (value — произвольный JSON по типу поля). */
const AnswerWireSchema = z.object({
  field_id: z.string().min(1),
  value: z.record(z.string(), z.unknown()),
});

/** POST /api/forms/{id}/submissions. token — для приватной формы через share-link. */
export function makeSubmitSchema(t: ValidationT) {
  return z.object({
    formId: makeUUID(t),
    answers: makeAnswersJsonSchema(t),
    token: z.string().min(1).optional(),
  });
}

/** PATCH /api/submissions/{id} (editable-формы). */
export function makeSubmissionEditSchema(t: ValidationT) {
  return z.object({
    id: makeUUID(t),
    answers: makeAnswersJsonSchema(t),
  });
}

export const FormIdSchema = z.object({ id: z.uuid() });
export const SubmissionIdSchema = z.object({ id: z.uuid() });

// Convenience legacy exports for schemas used without localised messages
// (e.g. FormVisibilitySchema used in publishForm only needs UUID validation, no user messages).
// The action callers pass getT("validation") explicitly.
export type FormCreateInput = z.infer<ReturnType<typeof makeFormCreateSchema>>;
export type FormUpdateInput = z.infer<ReturnType<typeof makeFormUpdateSchema>>;
export type FormVisibilityInput = z.infer<ReturnType<typeof makeFormVisibilitySchema>>;
export type SubmitInput = z.infer<ReturnType<typeof makeSubmitSchema>>;
export type SubmissionEditInput = z.infer<ReturnType<typeof makeSubmissionEditSchema>>;
