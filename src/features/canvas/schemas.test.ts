// src/features/_template/schemas.test.ts
import { describe, it, expect } from "vitest";
import { PlaceholderSchema } from "./schemas";

describe("PlaceholderSchema", () => {
  it("accepts an empty object (placeholder)", () => {
    expect(PlaceholderSchema.safeParse({}).success).toBe(true);
  });

  // Замените на реальные тесты после реализации:
  // it("rejects empty title");
  // it("trims and accepts valid title");
  // it("rejects description longer than max");
});
