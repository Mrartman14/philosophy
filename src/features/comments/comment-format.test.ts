// src/features/comments/comment-format.test.ts
import { describe, it, expect } from "vitest";

import { formatCommentDate } from "./comment-format";

describe("formatCommentDate", () => {
  it("форматирует валидный ISO (UTC)", () => {
    const out = formatCommentDate("2026-06-14T10:30:00Z");
    expect(out).toContain("2026");
    expect(out).toContain("10:30");
  });
  it("пустой/undefined → пустая строка", () => {
    expect(formatCommentDate(undefined)).toBe("");
    expect(formatCommentDate("")).toBe("");
  });
  it("битую строку возвращает как есть", () => {
    expect(formatCommentDate("not-a-date")).toBe("not-a-date");
  });
});
