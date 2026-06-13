import { describe, expect, it } from "vitest";
import { parseNonNegativeInt, parsePaging } from "./paging";

describe("parseNonNegativeInt", () => {
  it("валидное целое", () => expect(parseNonNegativeInt("5", 0)).toBe(5));
  it("ноль валиден", () => expect(parseNonNegativeInt("0", 7)).toBe(0));
  it("undefined → fallback", () => expect(parseNonNegativeInt(undefined, 7)).toBe(7));
  it("пустая строка → fallback", () => expect(parseNonNegativeInt("", 7)).toBe(7));
  it("не-число → fallback (а не NaN)", () =>
    expect(parseNonNegativeInt("abc", 0)).toBe(0));
  it("отрицательное → fallback", () => expect(parseNonNegativeInt("-3", 0)).toBe(0));
  it("дробное → fallback", () => expect(parseNonNegativeInt("2.5", 0)).toBe(0));
  it("массив берёт первый элемент", () =>
    expect(parseNonNegativeInt(["3", "9"], 0)).toBe(3));
});

describe("parsePaging", () => {
  it("дефолты по умолчанию (offset 0, limit 20)", () =>
    expect(parsePaging({})).toEqual({ offset: 0, limit: 20 }));
  it("кастомный дефолтный limit", () =>
    expect(parsePaging({}, { limit: 50 })).toEqual({ offset: 0, limit: 50 }));
  it("парсит offset и limit", () =>
    expect(parsePaging({ offset: "10", limit: "5" })).toEqual({
      offset: 10,
      limit: 5,
    }));
  it("битый offset → дефолт, валидный limit сохраняется", () =>
    expect(parsePaging({ offset: "abc", limit: "5" })).toEqual({
      offset: 0,
      limit: 5,
    }));
});
