import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// FormFeedback тянет useT("errors") внутри — мокаем client-фасад на реальный ru-каталог.
vi.mock("@/i18n/client", async () => {
  const { makeErrorsT } = await import("@/test/errors-t");
  const tErrors = makeErrorsT();
  return { useT: () => tErrors };
});

import { FormFeedback } from "./form-feedback";

afterEach(cleanup);

describe("FormFeedback", () => {
  it("renders nothing on success without successText", () => {
    render(<FormFeedback result={{ success: true, data: null }} forbiddenAction="тест" />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders success text when provided", () => {
    render(<FormFeedback result={{ success: true, data: null }} forbiddenAction="тест" successText="Сохранено." />);
    expect(screen.getByRole("status")).toHaveTextContent("Сохранено.");
  });

  it("renders forbidden message", () => {
    render(
      <FormFeedback
        result={{ success: false, error: "Forbidden", code: "forbidden" }}
        forbiddenAction="создание лекции"
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("У вас нет прав на создание лекции.");
  });

  it("renders generic error", () => {
    render(
      <FormFeedback
        result={{ success: false, error: "Что-то пошло не так" }}
        forbiddenAction="тест"
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Что-то пошло не так");
  });

  it("renders _form validation error", () => {
    render(
      <FormFeedback
        result={{ success: false, error: "Ошибка валидации", code: "validation", fieldErrors: { _form: "Неверные данные" } }}
        forbiddenAction="тест"
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Неверные данные");
  });

  it("renders nothing for validation without _form", () => {
    render(
      <FormFeedback
        result={{ success: false, error: "Ошибка валидации", code: "validation", fieldErrors: { name: "Обязательно" } }}
        forbiddenAction="тест"
      />
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
