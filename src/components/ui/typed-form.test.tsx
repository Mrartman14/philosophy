import { describe, it, expect } from "vitest";

import type { ActionResult } from "@/utils/create-action";

import { createTypedForm } from "./typed-form";

interface Sample {
  title: string;
  note?: string;
  count: number;
  agree: boolean;
}

// Идиома проекта (ср. button.test.tsx): type-уровневые @ts-expect-error живут
// ВНУТРИ реальных it() рядом с рантайм-assert. Снятая ошибка в @ts-expect-error
// → `pnpm typecheck`/build падают «Unused '@ts-expect-error' directive».
describe("createTypedForm", () => {
  it("f возвращает имя поля (identity); не-ключ — ошибка типа", () => {
    const { f } = createTypedForm<Sample>();
    expect(f("title")).toBe("title");
    // @ts-expect-error — ключ не из схемы
    f("nope");
  });

  it("errors извлекает fieldErrors при code=validation; не-ключ — ошибка типа", () => {
    const { errors } = createTypedForm<Sample>();
    const state: ActionResult<unknown> = {
      success: false,
      code: "validation",
      error: "x",
      fieldErrors: { title: "плохо", _form: "cross-field" },
    };
    const e = errors(state);
    expect(e).toEqual({ title: "плохо", _form: "cross-field" });
    expect(e.title).toBe("плохо");
    expect(e._form).toBe("cross-field");
    // @ts-expect-error — несуществующий ключ ошибки
    void e.nope;
  });

  it("errors возвращает {} вне validation-ветки", () => {
    const { errors } = createTypedForm<Sample>();
    expect(errors({ success: true, data: undefined })).toEqual({});
    expect(errors({ success: false, error: "x", code: "forbidden" })).toEqual({});
  });

  it("Field прокидывает name; required/имя форсятся на уровне типа", () => {
    const { Field } = createTypedForm<Sample>();
    // Рантайм: Field === FormField, прокидывает name в проп (элемент не рендерим).
    const el = <Field name="title" label="x" required>{null}</Field>;
    expect((el.props as { name: string }).name).toBe("title");

    // Тип-уровень (валидируется typecheck): элементы создаются, но не рендерятся.
    // @ts-expect-error — required обязателен для required-ключа title
    void (<Field name="title" label="x">{null}</Field>);
    void (<Field name="note" label="x">{null}</Field>); // optional — required не нужен
    void (<Field name="agree" label="x">{null}</Field>); // required boolean — исключён, required НЕ форсится
    // @ts-expect-error — ключ не из схемы
    void (<Field name="nope" label="x">{null}</Field>);
  });
});
