// src/services/observability/core/redact.test.ts
import { describe, it, expect } from "vitest";

import type { Attributes } from "./types";
import { DENY_KEY_PATTERNS, redactAttributes } from "./redact";

describe("redactAttributes", () => {
  it("выбрасывает PII-ключи (case-insensitive), сохраняет примитивы", () => {
    const input: Attributes = {
      route: "/x",
      count: 3,
      ok: true,
      nada: null,
      Token: "abc",
      AUTHORIZATION: "Bearer y",
      password: "p",
      userEmail: "a@b.c",
      username: "joe",
      api_secret: "s",
      cookie: "sid=1",
    };
    const out = redactAttributes(input);
    expect(out).toEqual({ route: "/x", count: 3, ok: true, nada: null });
  });

  it("пустой объект → пустой объект", () => {
    expect(redactAttributes({})).toEqual({});
  });

  it("DENY_KEY_PATTERNS покрывает базовые PII-маркеры", () => {
    const joined = DENY_KEY_PATTERNS.map((re) => re.source).join("|");
    for (const marker of [
      "token",
      "authorization",
      "password",
      "email",
      "username",
      "secret",
      "cookie",
    ]) {
      expect(joined).toContain(marker);
    }
  });

  it("не мутирует вход", () => {
    const input: Attributes = { token: "x", route: "/y" };
    redactAttributes(input);
    expect(input.token).toBe("x");
  });
});
