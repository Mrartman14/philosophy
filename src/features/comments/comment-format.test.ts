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

describe("formatCommentDate tz", () => {
  const iso = "2026-06-21T22:30:00Z";
  it("разные зоны дают разный результат", () => {
    expect(formatCommentDate(iso, "ru", "Europe/Moscow")).not.toBe(
      formatCommentDate(iso, "ru", "Asia/Tokyo"),
    );
  });
  it("без tz — обратная совместимость (UTC)", () => {
    expect(formatCommentDate(iso, "ru")).toBe(formatCommentDate(iso, "ru", "UTC"));
  });
  it("пустая строка → пусто", () => {
    expect(formatCommentDate(undefined, "ru", "Europe/Moscow")).toBe("");
  });
});
