// src/features/comments/comment-format.test.ts
import { describe, expect, it } from "vitest";

import { formatCommentDate } from "./comment-format";

describe("formatCommentDate", () => {
  it("ISO → дд.мм.гггг, чч:мм (ru, UTC) по умолчанию", () => {
    const out = formatCommentDate("2026-06-14T10:30:00Z");
    expect(out).toBe("14.06.2026, 10:30");
  });
  it("пустое → пустая строка", () => {
    expect(formatCommentDate(undefined)).toBe("");
    expect(formatCommentDate("")).toBe("");
  });
  it("неразбираемое → как есть", () => {
    expect(formatCommentDate("not-a-date")).toBe("not-a-date");
  });
  it("en-локаль меняет формат", () => {
    expect(formatCommentDate("2026-06-14T10:30:00Z", "en")).not.toBe(
      formatCommentDate("2026-06-14T10:30:00Z", "ru"),
    );
  });
});
