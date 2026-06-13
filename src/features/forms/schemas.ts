// src/features/forms/schemas.ts
import "server-only";
import { z } from "zod";

const UUID = z.string().uuid("Некорректный идентификатор");

const TitleSchema = z.string().trim().min(1, "Введите название").max(500, "До 500 символов");
const VisibilityEnum = z.enum(["private", "public"]);
const ModeEnum = z.enum(["editable", "immutable"]);
const FieldTypeEnum = z.enum([
  "text",
  "long_text",
  "single_choice",
  "multi_choice",
  "number",
  "date",
]);

/** Описание одного поля в payload конструктора. */
const FieldSchema = z
  .object({
    type: FieldTypeEnum,
    prompt: z.string().trim().min(1, "Текст вопроса обязателен"),
    help_text: z.string().optional(),
    required: z.boolean(),
    sort_order: z.number().int(),
    // Опции — массив plain-строк (label); id генерит бек.
    options: z.array(z.string().trim().min(1, "Пустой вариант")).optional(),
  })
  .superRefine((f, ctx) => {
    const isChoice = f.type === "single_choice" || f.type === "multi_choice";
    const opts = f.options ?? [];
    if (isChoice && opts.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Добавьте хотя бы один вариант" });
    }
    if (!isChoice && opts.length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Варианты только у полей выбора" });
    }
    if (isChoice && new Set(opts).size !== opts.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Варианты не должны повторяться" });
    }
  });

/** Полный payload формы (общий для create/update); fields revalidate-уникальность sort_order. */
const FormPayloadShape = z
  .object({
    title: TitleSchema,
    description: z.string().optional(),
    after_submit: z.string().optional(),
    visibility: VisibilityEnum.optional(),
    submission_mode: ModeEnum.optional(),
    fields: z.array(FieldSchema).min(1, "Добавьте хотя бы одно поле"),
  })
  .superRefine((p, ctx) => {
    const seen = new Set<number>();
    p.fields.forEach((f, i) => {
      if (seen.has(f.sort_order)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Дублируется порядок поля #${i + 1}`,
        });
      }
      seen.add(f.sort_order);
    });
  });

type FormPayload = z.infer<typeof FormPayloadShape>;

/** Парсит JSON-строку payload в объект и прогоняет через FormPayloadShape. */
function payloadField() {
  return z.string().min(1, "Пустая форма").transform((s, ctx): FormPayload => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(s);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Битый JSON формы" });
      return z.NEVER;
    }
    const r = FormPayloadShape.safeParse(parsed);
    if (!r.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: r.error.issues[0]?.message ?? "Ошибка структуры формы",
      });
      return z.NEVER;
    }
    return r.data;
  });
}

/** POST /api/forms. visibility/submission_mode обязательны для create. */
export const FormCreateSchema = z
  .object({ payload: payloadField() })
  .transform(({ payload }) => payload)
  .superRefine((p, ctx) => {
    if (!p.visibility) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Не указана видимость", path: ["visibility"] });
    }
    if (!p.submission_mode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Не указан режим", path: ["submission_mode"] });
    }
  });

/** PATCH /api/forms/{id}. Полная замена структуры (бек: fields = replace-all). */
export const FormUpdateSchema = z.object({
  id: UUID,
  payload: payloadField(),
});

/** PATCH /api/forms/{id} visibility-only (UI предлагает только private→public). */
export const FormVisibilitySchema = z.object({
  id: UUID,
  visibility: z.literal("public"),
});

/** Один ответ в submit (value — произвольный JSON по типу поля). */
const AnswerWireSchema = z.object({
  field_id: z.string().min(1),
  value: z.record(z.string(), z.unknown()),
});

const AnswersJsonSchema = z
  .string()
  .min(1, "Нет ответов")
  .transform((s, ctx): z.infer<typeof AnswerWireSchema>[] => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(s);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Битый JSON ответов" });
      return z.NEVER;
    }
    if (!Array.isArray(parsed)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ответы должны быть массивом" });
      return z.NEVER;
    }
    const r = z.array(AnswerWireSchema).safeParse(parsed);
    if (!r.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Некорректный ответ" });
      return z.NEVER;
    }
    return r.data;
  });

/** POST /api/forms/{id}/submissions. token — для приватной формы через share-link. */
export const SubmitSchema = z.object({
  formId: UUID,
  answers: AnswersJsonSchema,
  token: z.string().min(1).optional(),
});

/** PATCH /api/submissions/{id} (editable-формы). */
export const SubmissionEditSchema = z.object({
  id: UUID,
  answers: AnswersJsonSchema,
});

export const FormIdSchema = z.object({ id: UUID });
export const SubmissionIdSchema = z.object({ id: UUID });

export type FormCreateInput = z.infer<typeof FormCreateSchema>;
export type FormUpdateInput = z.infer<typeof FormUpdateSchema>;
export type FormVisibilityInput = z.infer<typeof FormVisibilitySchema>;
export type SubmitInput = z.infer<typeof SubmitSchema>;
export type SubmissionEditInput = z.infer<typeof SubmissionEditSchema>;
