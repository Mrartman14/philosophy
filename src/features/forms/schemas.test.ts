// src/features/forms/schemas.test.ts
import { describe, expect, it } from "vitest";

import type { NamespaceT } from "@/i18n";

import {
  makeFormCreateSchema,
  makeFormUpdateSchema,
  makeFormVisibilitySchema,
  makeSubmitSchema,
  makeSubmissionEditSchema,
  FormIdSchema,
  SubmissionIdSchema,
} from "./schemas";

// Stub переводчика: возвращает ключ как-есть (достаточно для проверки success/failure).
const t = ((key: string) => key) as unknown as NamespaceT<"validation">;

const FormCreateSchema = makeFormCreateSchema(t);
const FormUpdateSchema = makeFormUpdateSchema(t);
const FormVisibilitySchema = makeFormVisibilitySchema(t);
const SubmitSchema = makeSubmitSchema(t);
const SubmissionEditSchema = makeSubmissionEditSchema(t);

const UUID = "550e8400-e29b-41d4-a716-446655440000";

function field(over: Record<string, unknown> = {}) {
  return {
    type: "text",
    prompt: "Ваше имя",
    required: true,
    sort_order: 0,
    ...over,
  };
}

describe("FormCreateSchema", () => {
  it("принимает минимальную форму (1 текстовое поле)", () => {
    const r = FormCreateSchema.safeParse({
      payload: JSON.stringify({
        title: "Опрос",
        visibility: "private",
        submission_mode: "editable",
        fields: [field()],
      }),
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.title).toBe("Опрос");
      expect(r.data.fields).toHaveLength(1);
    }
  });

  it("принимает single_choice с options", () => {
    const r = FormCreateSchema.safeParse({
      payload: JSON.stringify({
        title: "Выбор",
        visibility: "public",
        submission_mode: "immutable",
        fields: [field({ type: "single_choice", options: ["Да", "Нет"] })],
      }),
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.fields[0]?.options).toEqual(["Да", "Нет"]);
  });

  it("отклоняет форму без полей", () => {
    const r = FormCreateSchema.safeParse({
      payload: JSON.stringify({
        title: "Пусто",
        visibility: "private",
        submission_mode: "editable",
        fields: [],
      }),
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет пустой title", () => {
    const r = FormCreateSchema.safeParse({
      payload: JSON.stringify({
        title: "   ",
        visibility: "private",
        submission_mode: "editable",
        fields: [field()],
      }),
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет choice-поле без options", () => {
    const r = FormCreateSchema.safeParse({
      payload: JSON.stringify({
        title: "X",
        visibility: "private",
        submission_mode: "editable",
        fields: [field({ type: "multi_choice", options: [] })],
      }),
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет options у нечойс-поля", () => {
    const r = FormCreateSchema.safeParse({
      payload: JSON.stringify({
        title: "X",
        visibility: "private",
        submission_mode: "editable",
        fields: [field({ type: "text", options: ["a"] })],
      }),
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет дублирующийся sort_order", () => {
    const r = FormCreateSchema.safeParse({
      payload: JSON.stringify({
        title: "X",
        visibility: "private",
        submission_mode: "editable",
        fields: [field({ sort_order: 0 }), field({ prompt: "B", sort_order: 0 })],
      }),
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет неизвестный submission_mode", () => {
    const r = FormCreateSchema.safeParse({
      payload: JSON.stringify({
        title: "X",
        visibility: "private",
        submission_mode: "weird",
        fields: [field()],
      }),
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет битый JSON в payload", () => {
    const r = FormCreateSchema.safeParse({ payload: "{oops" });
    expect(r.success).toBe(false);
  });
});

describe("FormUpdateSchema", () => {
  it("принимает апдейт с id и полями", () => {
    const r = FormUpdateSchema.safeParse({
      id: UUID,
      payload: JSON.stringify({
        title: "Новый",
        fields: [field()],
      }),
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.id).toBe(UUID);
  });

  it("отклоняет битый id", () => {
    const r = FormUpdateSchema.safeParse({
      id: "no",
      payload: JSON.stringify({ title: "x", fields: [field()] }),
    });
    expect(r.success).toBe(false);
  });
});

describe("FormVisibilitySchema (только private→public)", () => {
  it("принимает public", () => {
    expect(FormVisibilitySchema.safeParse({ id: UUID, visibility: "public" }).success).toBe(true);
  });
  it("отклоняет private (даунгрейд не предлагается UI)", () => {
    expect(FormVisibilitySchema.safeParse({ id: UUID, visibility: "private" }).success).toBe(false);
  });
});

describe("SubmitSchema", () => {
  it("принимает answers JSON", () => {
    const r = SubmitSchema.safeParse({
      formId: UUID,
      answers: JSON.stringify([{ field_id: "x", value: { text: "hi" } }]),
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.answers).toHaveLength(1);
  });
  it("token опционален", () => {
    const r = SubmitSchema.safeParse({
      formId: UUID,
      answers: JSON.stringify([]),
      token: "abc",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.token).toBe("abc");
  });
  it("отклоняет битый answers", () => {
    expect(SubmitSchema.safeParse({ formId: UUID, answers: "{x" }).success).toBe(false);
  });
  it("отклоняет answers не-массив", () => {
    expect(SubmitSchema.safeParse({ formId: UUID, answers: JSON.stringify({}) }).success).toBe(false);
  });
});

describe("SubmissionEditSchema", () => {
  it("принимает id+answers", () => {
    const r = SubmissionEditSchema.safeParse({
      id: UUID,
      answers: JSON.stringify([{ field_id: "x", value: { text: "hi" } }]),
    });
    expect(r.success).toBe(true);
  });
});

describe("Id-схемы", () => {
  it("FormIdSchema принимает uuid", () => { expect(FormIdSchema.safeParse({ id: UUID }).success).toBe(true); });
  it("FormIdSchema отклоняет мусор", () => { expect(FormIdSchema.safeParse({ id: "x" }).success).toBe(false); });
  it("SubmissionIdSchema принимает uuid", () =>
    { expect(SubmissionIdSchema.safeParse({ id: UUID }).success).toBe(true); });
});
