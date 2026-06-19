// src/features/forms/field-kinds.test.ts
import { describe, expect, it } from "vitest";

import {
  FIELD_TYPES,
  makeFieldTypeOptions,
  fieldTypeHasOptions,
  isFieldType,
} from "./field-kinds";

// Stub переводчика: возвращает ключ как-есть (достаточно для структурных проверок).
const stubT = (key: string) => key;

describe("field-kinds", () => {
  it("FIELD_TYPES содержит ровно 6 типов бека", () => {
    expect(FIELD_TYPES).toEqual([
      "text",
      "long_text",
      "single_choice",
      "multi_choice",
      "number",
      "date",
    ]);
  });

  it("makeFieldTypeOptions — массив {value,label} для Select", () => {
    const options = makeFieldTypeOptions(stubT);
    expect(options).toHaveLength(6);
    // Каждый тип присутствует и получает метку из переводчика
    for (const type of FIELD_TYPES) {
      const opt = options.find((o) => o.value === type);
      expect(opt).toBeTruthy();
      expect(typeof opt?.label).toBe("string");
    }
  });

  it("fieldTypeHasOptions: только choice-типы", () => {
    expect(fieldTypeHasOptions("single_choice")).toBe(true);
    expect(fieldTypeHasOptions("multi_choice")).toBe(true);
    expect(fieldTypeHasOptions("text")).toBe(false);
    expect(fieldTypeHasOptions("number")).toBe(false);
    expect(fieldTypeHasOptions("date")).toBe(false);
    expect(fieldTypeHasOptions("long_text")).toBe(false);
  });

  it("isFieldType — type guard", () => {
    expect(isFieldType("text")).toBe(true);
    expect(isFieldType("checkbox")).toBe(false);
    expect(isFieldType("")).toBe(false);
  });
});
