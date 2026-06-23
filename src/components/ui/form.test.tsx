/**
 * Integration tests: Form / FormField / FormFeedback — ActionResult → rendered feedback
 *
 * Verifies the end-to-end contract:
 *   fieldErrors  → rendered under the matching <FormField name>
 *   code:"forbidden" → branded «У вас нет прав на …» text, NOT raw result.error
 *   code:undefined + error → raw error echoes via FormFeedback
 *
 * The Base UI Form distributes errors via React context (FormContext → FieldRootContext).
 * All three layers are context-only, so they work correctly in jsdom.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActionResult } from "@/utils/create-action";

// FormFeedback тянет useT("errors"), FormField — useT("common"). Мокаем client-фасад
// namespace-aware: "errors" → makeErrorsT (с {var}-подстановкой), прочие — резолв
// dotted-ключа из реального ru-каталога (без поднятия next-intl провайдера).
vi.mock("@/i18n/client", async () => {
  const { makeErrorsT } = await import("@/test/errors-t");
  const tErrors = makeErrorsT();
  const common = (await import("@/i18n/messages/ru/common")).default;
  const tCommon = (key: string) =>
    key
      .split(".")
      .reduce<unknown>(
        (acc, k) => (acc as Record<string, unknown> | undefined)?.[k],
        common,
      ) ?? key;
  return { useT: (ns?: string) => (ns === "common" ? tCommon : tErrors) };
});

import { Form } from "./form";
import { FormFeedback } from "./form-feedback";
import { FormField } from "./form-field";
import { TextInput } from "./text-input";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Behavioural contract: Form is layout-agnostic (no flex/gap default)
// ---------------------------------------------------------------------------
describe("Form — поведение only (без layout-дефолта и className)", () => {
  it("does NOT carry a `flex flex-col gap-4` layout default", () => {
    render(
      <Form aria-label="bare">
        <span>дитя</span>
      </Form>,
    );

    const form = screen.getByRole("form", { name: "bare" });
    expect(form.className).not.toContain("flex");
    expect(form.className).not.toContain("gap-4");
    expect(form.className).not.toContain("flex-col");
  });

  it("renders its children", () => {
    render(
      <Form aria-label="kids">
        <span>видимый ребёнок</span>
      </Form>,
    );

    expect(screen.getByText("видимый ребёнок")).toBeInTheDocument();
  });

  it("forwards ref to the native <form> element", () => {
    const ref = createRef<HTMLFormElement>();
    render(
      <Form ref={ref} aria-label="ref">
        <span>дитя</span>
      </Form>,
    );

    expect(ref.current).toBeInstanceOf(HTMLFormElement);
    expect(ref.current).toBe(screen.getByRole("form", { name: "ref" }));
  });
});

// ---------------------------------------------------------------------------
// Smoke test: Form errors → FormField Field.Error distribution
// ---------------------------------------------------------------------------
describe("Form + FormField — field error distribution (smoke)", () => {
  it("renders the field error under the matching FormField name", () => {
    render(
      <Form errors={{ title: "Слишком коротко" }}>
        <FormField name="title" label="Название">
          <TextInput name="title" />
        </FormField>
      </Form>,
    );

    expect(screen.getByText("Слишком коротко")).toBeInTheDocument();
  });

  it("does NOT render an error for a field whose name is not in errors", () => {
    render(
      <Form errors={{ title: "Слишком коротко" }}>
        <FormField name="description" label="Описание">
          <TextInput name="description" />
        </FormField>
      </Form>,
    );

    expect(screen.queryByText("Слишком коротко")).toBeNull();
  });

  it("renders errors for multiple fields independently", () => {
    render(
      <Form errors={{ title: "Обязательно", description: "Слишком длинное" }}>
        <FormField name="title" label="Название">
          <TextInput name="title" />
        </FormField>
        <FormField name="description" label="Описание">
          <TextInput name="description" />
        </FormField>
      </Form>,
    );

    expect(screen.getByText("Обязательно")).toBeInTheDocument();
    expect(screen.getByText("Слишком длинное")).toBeInTheDocument();
  });

  it("renders no error when errors map is empty", () => {
    render(
      <Form errors={{}}>
        <FormField name="title" label="Название">
          <TextInput name="title" />
        </FormField>
      </Form>,
    );

    // label must exist but no error text
    expect(screen.getByText("Название")).toBeInTheDocument();
    expect(screen.queryByText("Обязательно")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Native `required` (valueMissing) — локализованное сообщение вместо браузерного
// ---------------------------------------------------------------------------
describe("FormField — native required localized", () => {
  it("на пустой required-сабмит показывает локализованный текст, а не browser-default", async () => {
    render(
      <Form aria-label="req">
        <FormField name="title" label="Название" required>
          <TextInput required />
        </FormField>
        <button type="submit">Сохранить</button>
      </Form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(screen.getByText("Заполните это поле")).toBeInTheDocument();
    });
    // jsdom-нативное сообщение (в браузере «Please fill in this field») НЕ дублируется
    expect(screen.queryByText("Constraints not satisfied")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Integration: ActionResult states → Form + FormField + FormFeedback pipeline
// ---------------------------------------------------------------------------

/**
 * A minimal presentational form that mirrors the pattern used in feature slices
 * (e.g. GlossaryCreateForm): it receives an ActionResult and derives fieldErrors
 * from it, then renders Form / FormField / FormFeedback.
 */
function StubForm({ result }: { result: ActionResult<unknown> }) {
  const fieldErrors: Record<string, string> =
    !result.success && result.code === "validation" ? result.fieldErrors : {};

  return (
    <Form errors={fieldErrors}>
      <FormField name="title" label="Название" required>
        <TextInput name="title" />
      </FormField>
      <FormField name="description" label="Описание">
        <TextInput name="description" />
      </FormField>
      <FormFeedback result={result} forbiddenAction="создание записи" />
    </Form>
  );
}

describe("ActionResult states → rendering pipeline", () => {
  it("validation: fieldErrors render under the matching FormField", () => {
    const result: ActionResult<unknown> = {
      success: false,
      error: "Ошибка валидации",
      code: "validation",
      fieldErrors: { title: "Слишком коротко" },
    };

    render(<StubForm result={result} />);

    expect(screen.getByText("Слишком коротко")).toBeInTheDocument();
    // The error for "description" field is NOT present
    expect(screen.queryByRole("alert")).toBeNull(); // FormFeedback is silent (no _form)
  });

  it("validation: _form error renders as FormFeedback alert", () => {
    const result: ActionResult<unknown> = {
      success: false,
      error: "Ошибка валидации",
      code: "validation",
      fieldErrors: { _form: "Глобальная ошибка формы" },
    };

    render(<StubForm result={result} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Глобальная ошибка формы");
  });

  it("forbidden: BRANDED text renders and raw result.error does NOT", () => {
    const result: ActionResult<unknown> = {
      success: false,
      error: "Forbidden",
      code: "forbidden",
    };

    render(<StubForm result={result} />);

    const alert = screen.getByRole("alert");
    // Branded text must appear
    expect(alert).toHaveTextContent("У вас нет прав на создание записи.");
    // Raw server error MUST NOT appear (CLAUDE.md invariant)
    expect(alert).not.toHaveTextContent("Forbidden");
    expect(screen.queryByText("Forbidden")).toBeNull();
  });

  it("generic error (no code): raw error echoes via FormFeedback", () => {
    const result: ActionResult<unknown> = {
      success: false,
      error: "Что-то пошло не так",
    };

    render(<StubForm result={result} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Что-то пошло не так");
  });

  it("success: no alerts, no field errors", () => {
    const result: ActionResult<unknown> = { success: true, data: null };

    render(<StubForm result={result} />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
