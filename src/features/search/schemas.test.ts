import { describe, it, expect } from "vitest";

import type { NamespaceT } from "@/i18n";

import {
  makeSearchQuerySchema,
  makeSearchParamsSchema,
} from "./schemas";

// Заглушка переводчика: возвращает ключ как текст (достаточно для тестов схемы).
const t = ((key: string) => key) as unknown as NamespaceT<"validation">;

const SearchQuerySchema = makeSearchQuerySchema(t);
const SearchParamsSchema = makeSearchParamsSchema(t);

describe("SearchQuerySchema", () => {
  it("принимает непустую строку", () => {
    expect(SearchQuerySchema.safeParse("кант").success).toBe(true);
  });
  it("тримит пробелы", () => {
    const r = SearchQuerySchema.safeParse("  кант  ");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("кант");
  });
  it("отклоняет пустую строку", () => {
    expect(SearchQuerySchema.safeParse("").success).toBe(false);
  });
  it("отклоняет строку из одних пробелов", () => {
    expect(SearchQuerySchema.safeParse("   ").success).toBe(false);
  });
  it("отклоняет строку длиннее 200 символов", () => {
    expect(SearchQuerySchema.safeParse("a".repeat(201)).success).toBe(false);
  });
  it("принимает ровно 200 символов", () => {
    expect(SearchQuerySchema.safeParse("a".repeat(200)).success).toBe(true);
  });
});

describe("SearchParamsSchema", () => {
  it("парсит валидный q (с тримом)", () => {
    const r = SearchParamsSchema.parse({ q: "  гегель " });
    expect(r).toEqual({ q: "гегель" });
  });
  it("пустой объект → q undefined", () => {
    const r = SearchParamsSchema.parse({});
    expect(r.q).toBeUndefined();
  });
  it("слишком длинный q отбрасывается в undefined (parse не бросает)", () => {
    const r = SearchParamsSchema.parse({ q: "a".repeat(201) });
    expect(r.q).toBeUndefined();
  });
  it("неизвестные ключи не просачиваются", () => {
    const r = SearchParamsSchema.parse({ q: "кант", type: "glossary", offset: "20" });
    expect("type" in r).toBe(false);
    expect("offset" in r).toBe(false);
  });
});
