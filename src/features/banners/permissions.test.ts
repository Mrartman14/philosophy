// src/features/_template/permissions.test.ts
import { describe, it, expect } from "vitest";
import { canPlaceholder } from "./permissions";

describe("canPlaceholder", () => {
  it("returns false for guest (placeholder)", () => {
    expect(canPlaceholder(null)).toBe(false);
  });

  // Замените на реальные тесты после реализации:
  // it("owner может удалить свой ресурс");
  // it("owner не может удалить чужой без delete_any");
  // it("status='inactive' блокирует");
  // it("гость всегда false");
});
