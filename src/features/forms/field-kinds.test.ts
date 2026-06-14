// src/features/forms/field-kinds.test.ts
import { describe, expect, it } from "vitest";

import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  FIELD_TYPE_OPTIONS,
  fieldTypeHasOptions,
  isFieldType,
} from "./field-kinds";

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

  it("каждый тип имеет русскую метку", () => {
    for (const t of FIELD_TYPES) {
      expect(FIELD_TYPE_LABELS[t]).toBeTruthy();
    }
  });

  it("FIELD_TYPE_OPTIONS — массив {value,label} для Select", () => {
    expect(FIELD_TYPE_OPTIONS).toHaveLength(6);
    expect(FIELD_TYPE_OPTIONS[0]).toEqual({ value: "text", label: FIELD_TYPE_LABELS.text });
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
