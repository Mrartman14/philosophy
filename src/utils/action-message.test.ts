import { describe, expect, it } from "vitest";

import { actionErrorMessage } from "./action-message";

describe("actionErrorMessage", () => {
  it("returns branded forbidden text", () => {
    const result = { success: false as const, error: "Forbidden", code: "forbidden" as const };
    expect(actionErrorMessage(result, "удаление лекции")).toBe("У вас нет прав на удаление лекции.");
  });

  it("returns server error for non-forbidden", () => {
    const result = { success: false as const, error: "Что-то пошло не так" };
    expect(actionErrorMessage(result, "удаление лекции")).toBe("Что-то пошло не так");
  });

  it("returns server error for validation code", () => {
    const result = { success: false as const, error: "Ошибка валидации", code: "validation" as const, fieldErrors: {} };
    expect(actionErrorMessage(result, "создание")).toBe("Ошибка валидации");
  });
});
