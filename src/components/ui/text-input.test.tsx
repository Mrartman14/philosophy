import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Form } from "./form";
import { FormField } from "./form-field";
import { TextInput } from "./text-input";

afterEach(cleanup);

describe("TextInput", () => {
  it("по умолчанию (без grow) не растягивается — нет flex-1", () => {
    render(<TextInput aria-label="строка" />);
    const input = screen.getByLabelText("строка");
    expect(input).not.toHaveClass("flex-1");
    expect(input).not.toHaveClass("min-w-0");
  });

  it("grow добавляет flex-1 min-w-0 (растяжение в Inline-ряду)", () => {
    render(<TextInput grow aria-label="строка" />);
    const input = screen.getByLabelText("строка");
    expect(input).toHaveClass("flex-1");
    expect(input).toHaveClass("min-w-0");
  });

  it("type по умолчанию text; name/defaultValue прокидываются", () => {
    render(<TextInput name="q" defaultValue="привет" aria-label="строка" />);
    const input = screen.getByLabelText<HTMLInputElement>("строка");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("name", "q");
    expect(input.value).toBe("привет");
  });

  it("внутри FormField наследует name из Field.Root без явного пропа", () => {
    render(
      <FormField name="title" label="Заголовок">
        <TextInput />
      </FormField>,
    );
    const input = screen.getByLabelText<HTMLInputElement>("Заголовок");
    expect(input).toHaveAttribute("name", "title");
  });

  it("получает invalid-маркер, когда <Form errors> содержит ключ поля (оживший data-invalid)", () => {
    render(
      <Form errors={{ title: "Обязательное поле" }}>
        <FormField name="title" label="Заголовок">
          <TextInput />
        </FormField>
      </Form>,
    );
    const input = screen.getByLabelText("Заголовок");
    // Контингенсия (б): ассертить реальный маркер. По Base UI на инпуте появляется
    // data-invalid (драйвит data-[invalid]:border). Если в выводе он называется
    // иначе (aria-invalid) — ассертить его.
    expect(input).toHaveAttribute("data-invalid");
  });

  it("controlled внутри FormField: пользовательский onChange вызывается (чейнится с Base UI)", () => {
    const onChange = vi.fn();
    render(
      <FormField name="title" label="Заголовок">
        <TextInput value="x" onChange={onChange} />
      </FormField>,
    );
    fireEvent.change(screen.getByLabelText("Заголовок"), { target: { value: "y" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("внутри FormField aria-label на контроле перебивается Field.Label (accessible name = label)", () => {
    render(
      <FormField name="title" label="Видимый лейбл">
        <TextInput aria-label="другое имя" />
      </FormField>,
    );
    // На @base-ui/react 1.4.1 Field инжектит aria-labelledby (→ Field.Label), но НЕ
    // вычищает пользовательский aria-label. По ARIA-спеке accessible name считается
    // через aria-labelledby (приоритет над aria-label), поэтому role-name резолвится
    // в видимый лейбл — это и есть оживший a11y-override. (getByLabelText матчит сырой
    // атрибут aria-label, поэтому здесь нужен именно role-name через computeAccessibleName.)
    expect(screen.getByRole("textbox", { name: "Видимый лейбл" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "другое имя" })).toBeNull();
  });
});
