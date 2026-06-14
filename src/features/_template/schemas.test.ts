// src/features/_template/schemas.test.ts
import { describe, it, expect } from "vitest";

import { PlaceholderSchema } from "./schemas";

describe("PlaceholderSchema", () => {
  it("accepts an empty object (placeholder)", () => {
    expect(PlaceholderSchema.safeParse({}).success).toBe(true);
  });

  // Замените на реальные тесты после реализации:
  it.todo("rejects empty title");
  it.todo("trims and accepts valid title");
  it.todo("rejects description longer than max");
});
