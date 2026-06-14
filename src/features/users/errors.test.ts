// src/features/users/errors.test.ts
import { describe, it, expect } from "vitest";
import { ForbiddenError } from "@/utils/permissions";
import { rethrowUserApiError } from "./errors";

describe("rethrowUserApiError", () => {
  it("FORBIDDEN → ForbiddenError (createAction вернёт code=forbidden)", () => {
    expect(() =>
      rethrowUserApiError({ code: "FORBIDDEN", error: "forbidden" }),
    ).toThrow(ForbiddenError);
  });

  it("CONFLICT: cannot modify your own status → русский текст", () => {
    expect(() =>
      rethrowUserApiError({
        code: "CONFLICT",
        error: "cannot modify your own status",
      }),
    ).toThrow("Нельзя изменить собственный статус.");
  });

  it("CONFLICT: cannot modify your own role → русский текст", () => {
    expect(() =>
      rethrowUserApiError({
        code: "CONFLICT",
        error: "cannot modify your own role",
      }),
    ).toThrow("Нельзя изменить собственную роль.");
  });

  it("CONFLICT: cannot remove the last active admin → русский текст", () => {
    expect(() =>
      rethrowUserApiError({
        code: "CONFLICT",
        error: "cannot remove the last active admin",
      }),
    ).toThrow(
      "Нельзя приостановить или заблокировать последнего активного администратора.",
    );
  });

  it("CONFLICT: cannot demote the last active admin → русский текст", () => {
    expect(() =>
      rethrowUserApiError({
        code: "CONFLICT",
        error: "cannot demote the last active admin",
      }),
    ).toThrow(
      "Нельзя понизить роль последнего активного администратора.",
    );
  });

  it("CONFLICT с неизвестным текстом → общий фоллбек, не raw-текст", () => {
    expect(() =>
      rethrowUserApiError({ code: "CONFLICT", error: "something else" }),
    ).toThrow("Операция отклонена сервером (конфликт).");
  });

  it("NOT_FOUND → «Пользователь не найден.»", () => {
    expect(() =>
      rethrowUserApiError({ code: "NOT_FOUND", error: "user not found" }),
    ).toThrow("Пользователь не найден.");
  });

  it("SUSPENDED → понятный текст про ограниченный аккаунт", () => {
    expect(() =>
      rethrowUserApiError({ code: "SUSPENDED", error: "account suspended" }),
    ).toThrow("Ваш аккаунт ограничен — действие недоступно.");
  });

  it("неизвестный код → пробрасывает error-текст", () => {
    expect(() =>
      rethrowUserApiError({ code: "INTERNAL", error: "internal server error" }),
    ).toThrow("internal server error");
  });

  it("undefined → «Ошибка сервера»", () => {
    expect(() => rethrowUserApiError(undefined)).toThrow("Ошибка сервера");
  });
});
