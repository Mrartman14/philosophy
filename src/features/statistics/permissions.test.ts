// src/features/_template/permissions.test.ts
import { describe, it, expect } from "vitest";

import { canPlaceholder } from "./permissions";

describe("canPlaceholder", () => {
  it("returns false for guest (placeholder)", () => {
    expect(canPlaceholder(null)).toBe(false);
  });

  // Замените на реальные тесты после реализации:
  it.todo("owner может удалить свой ресурс");
  it.todo("owner не может удалить чужой без delete_any");
  it.todo("status='inactive' блокирует");
  it.todo("гость всегда false");
});
