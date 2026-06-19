import { describe, it, expect } from "vitest";

import type { NamespaceT } from "@/i18n";

import { makeLoginSchema, makeRegisterSchema } from "./schemas";

// Заглушка переводчика: возвращает ключ, чтобы не зависеть от next-intl в тестах.
const t = ((key: string) => key) as unknown as NamespaceT<"validation">;

const LoginSchema = makeLoginSchema(t);
const RegisterSchema = makeRegisterSchema(t);

describe("LoginSchema", () => {
  it("принимает валидные creds без next", () => {
    const r = LoginSchema.safeParse({ username: "alice", password: "secret123" });
    expect(r.success).toBe(true);
  });

  it("принимает валидные creds с next", () => {
    const r = LoginSchema.safeParse({
      username: "alice",
      password: "secret123",
      next: "/admin",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.next).toBe("/admin");
  });

  it("отклоняет пустой username", () => {
    const r = LoginSchema.safeParse({ username: "  ", password: "x" });
    expect(r.success).toBe(false);
  });

  it("отклоняет пустой password", () => {
    const r = LoginSchema.safeParse({ username: "alice", password: "" });
    expect(r.success).toBe(false);
  });

  it("отклоняет username длиннее 200", () => {
    const r = LoginSchema.safeParse({ username: "a".repeat(201), password: "x" });
    expect(r.success).toBe(false);
  });
});

describe("RegisterSchema", () => {
  const valid = {
    username: "alice",
    password: "secret1",
    password_confirm: "secret1",
  };

  it("принимает валидные данные с совпадающими паролями", () => {
    const r = RegisterSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("принимает next и trim'ит username", () => {
    const r = RegisterSchema.safeParse({
      ...valid,
      username: "  alice  ",
      next: "/admin",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.username).toBe("alice");
      expect(r.data.next).toBe("/admin");
    }
  });

  it("отклоняет username короче 3 символов", () => {
    const r = RegisterSchema.safeParse({ ...valid, username: "ab" });
    expect(r.success).toBe(false);
  });

  it("отклоняет username длиннее 30 символов", () => {
    const r = RegisterSchema.safeParse({ ...valid, username: "a".repeat(31) });
    expect(r.success).toBe(false);
  });

  it("отклоняет пароль короче 6 символов", () => {
    const r = RegisterSchema.safeParse({
      ...valid,
      password: "12345",
      password_confirm: "12345",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет пароль длиннее 72 символов", () => {
    const long = "a".repeat(73);
    const r = RegisterSchema.safeParse({
      ...valid,
      password: long,
      password_confirm: long,
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет несовпадающие пароли с ошибкой на password_confirm", () => {
    const r = RegisterSchema.safeParse({
      ...valid,
      password_confirm: "another7",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find(
        (i) => i.path.join(".") === "password_confirm"
      );
      // Заглушка t возвращает ключ — проверяем, что сообщение присутствует
      expect(issue?.message).toBe("register.passwordConfirmMismatch");
    }
  });
});
