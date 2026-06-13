// src/features/search/schemas.test.ts
import { describe, it, expect } from "vitest";
import {
  SearchQuerySchema,
  SearchTypeSchema,
  SearchOffsetSchema,
  SearchParamsSchema,
} from "./schemas";

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

describe("SearchTypeSchema", () => {
  it("принимает lecture", () => {
    expect(SearchTypeSchema.safeParse("lecture").success).toBe(true);
  });
  it("принимает glossary", () => {
    expect(SearchTypeSchema.safeParse("glossary").success).toBe(true);
  });
  it("отклоняет неизвестный тип", () => {
    expect(SearchTypeSchema.safeParse("document").success).toBe(false);
  });
});

describe("SearchOffsetSchema", () => {
  it("приводит строку к числу", () => {
    const r = SearchOffsetSchema.safeParse("20");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe(20);
  });
  it("отклоняет отрицательное", () => {
    expect(SearchOffsetSchema.safeParse("-1").success).toBe(false);
  });
  it("отклоняет не-число", () => {
    expect(SearchOffsetSchema.safeParse("abc").success).toBe(false);
  });
});

describe("SearchParamsSchema", () => {
  it("парсит полный валидный набор", () => {
    const r = SearchParamsSchema.parse({
      q: "  гегель ",
      type: "glossary",
      offset: "20",
    });
    expect(r).toEqual({ q: "гегель", type: "glossary", offset: 20 });
  });
  it("пустой объект → q undefined, прочие undefined", () => {
    const r = SearchParamsSchema.parse({});
    expect(r.q).toBeUndefined();
    expect(r.type).toBeUndefined();
    expect(r.offset).toBeUndefined();
  });
  it("битый type отбрасывается, q выживает", () => {
    const r = SearchParamsSchema.parse({ q: "кант", type: "bogus" });
    expect(r.q).toBe("кант");
    expect(r.type).toBeUndefined();
  });
  it("битый offset отбрасывается", () => {
    const r = SearchParamsSchema.parse({ q: "кант", offset: "-5" });
    expect(r.offset).toBeUndefined();
  });
  it("слишком длинный q отбрасывается в undefined (parse не бросает)", () => {
    const r = SearchParamsSchema.parse({ q: "a".repeat(201) });
    expect(r.q).toBeUndefined();
  });
  it("неизвестные ключи не просачиваются", () => {
    const r = SearchParamsSchema.parse({ q: "кант", limit: "999" });
    expect("limit" in r).toBe(false);
  });
});
