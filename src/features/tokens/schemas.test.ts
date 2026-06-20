// src/features/tokens/schemas.test.ts
import { describe, it, expect } from "vitest";

import type { NamespaceT } from "@/i18n";

import { makeCreateTokenSchema } from "./schemas";

const t = ((key: string) => key) as unknown as NamespaceT<"validation">;
const Schema = makeCreateTokenSchema(t);

describe("CreateTokenSchema", () => {
  it("label обязателен: пустой объект → fail", () => {
    expect(Schema.safeParse({}).success).toBe(false);
  });
  it("label обязателен: пустая строка / пробелы → fail", () => {
    expect(Schema.safeParse({ label: "" }).success).toBe(false);
    expect(Schema.safeParse({ label: "   " }).success).toBe(false);
  });
  it("валидный label тримится", () => {
    expect(Schema.parse({ label: "  ci  " }).label).toBe("ci");
  });
  it("label + пустой срок → expires undefined (бессрочно)", () => {
    const r = Schema.parse({ label: "ci", expires_in_days: "" });
    expect(r.label).toBe("ci");
    expect(r.expires_in_days).toBeUndefined();
  });
  it("expires_in_days: строка → число", () => {
    expect(Schema.parse({ label: "ci", expires_in_days: "30" }).expires_in_days).toBe(30);
  });
  it("отклоняет нецелое/0/слишком большое (при валидном label)", () => {
    expect(Schema.safeParse({ label: "ci", expires_in_days: "0" }).success).toBe(false);
    expect(Schema.safeParse({ label: "ci", expires_in_days: "1.5" }).success).toBe(false);
    expect(Schema.safeParse({ label: "ci", expires_in_days: "99999" }).success).toBe(false);
  });
  it("отклоняет label длиннее 100", () => {
    expect(Schema.safeParse({ label: "a".repeat(101) }).success).toBe(false);
  });
});
