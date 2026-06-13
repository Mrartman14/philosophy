// src/features/lectures/schemas.test.ts
import { describe, it, expect } from "vitest";
import {
  LectureCreateSchema,
  LectureUpdateSchema,
  LectureVisibilitySchema,
  LectureIdSchema,
  LectureCoverSchema,
  LectureCoverClearSchema,
} from "./schemas";

describe("LectureCreateSchema", () => {
  it("принимает валидные поля", () => {
    const r = LectureCreateSchema.safeParse({
      title: "Кант",
      description: "Введение в критику",
      date: "2026-04-27",
      visibility: "public",
    });
    expect(r.success).toBe(true);
  });

  it("принимает без description и без visibility", () => {
    const r = LectureCreateSchema.safeParse({
      title: "Кант",
      date: "2026-04-27",
    });
    expect(r.success).toBe(true);
  });

  it("отклоняет пустой title", () => {
    const r = LectureCreateSchema.safeParse({ title: "", date: "2026-04-27" });
    expect(r.success).toBe(false);
  });

  it("отклоняет title длиннее 200 символов", () => {
    const r = LectureCreateSchema.safeParse({
      title: "x".repeat(201),
      date: "2026-04-27",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет date в неверном формате", () => {
    const r = LectureCreateSchema.safeParse({
      title: "Кант",
      date: "27.04.2026",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет неизвестный visibility", () => {
    const r = LectureCreateSchema.safeParse({
      title: "Кант",
      date: "2026-04-27",
      visibility: "secret",
    });
    expect(r.success).toBe(false);
  });
});

describe("LectureUpdateSchema", () => {
  it("принимает валидные поля с id", () => {
    const r = LectureUpdateSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Кант",
      description: "",
      date: "2026-04-27",
    });
    expect(r.success).toBe(true);
  });

  it("отклоняет невалидный uuid", () => {
    const r = LectureUpdateSchema.safeParse({
      id: "not-a-uuid",
      title: "Кант",
      description: "",
      date: "2026-04-27",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет пустой title", () => {
    const r = LectureUpdateSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "",
      description: "",
      date: "2026-04-27",
    });
    expect(r.success).toBe(false);
  });
});

describe("LectureVisibilitySchema", () => {
  it("принимает валидную пару id+visibility", () => {
    const r = LectureVisibilitySchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      visibility: "private",
    });
    expect(r.success).toBe(true);
  });

  it("отклоняет невалидный uuid", () => {
    const r = LectureVisibilitySchema.safeParse({
      id: "x",
      visibility: "private",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет неизвестный visibility", () => {
    const r = LectureVisibilitySchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      visibility: "secret",
    });
    expect(r.success).toBe(false);
  });
});

describe("LectureIdSchema", () => {
  it("принимает валидный uuid", () => {
    const r = LectureIdSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(r.success).toBe(true);
  });

  it("отклоняет невалидный uuid", () => {
    const r = LectureIdSchema.safeParse({ id: "x" });
    expect(r.success).toBe(false);
  });
});

describe("LectureCoverSchema", () => {
  it("принимает id+upload_id (+опц. alt_text)", () => {
    const r = LectureCoverSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      upload_id: "11111111-1111-1111-1111-111111111111",
      alt_text: "Кант",
    });
    expect(r.success).toBe(true);
  });

  it("принимает без alt_text", () => {
    const r = LectureCoverSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      upload_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(r.success).toBe(true);
  });

  it("отклоняет пустой upload_id", () => {
    const r = LectureCoverSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      upload_id: "",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет невалидный id лекции", () => {
    const r = LectureCoverSchema.safeParse({ id: "x", upload_id: "u" });
    expect(r.success).toBe(false);
  });
});

describe("LectureCoverClearSchema", () => {
  it("принимает валидный uuid", () => {
    const r = LectureCoverClearSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(r.success).toBe(true);
  });

  it("отклоняет невалидный uuid", () => {
    const r = LectureCoverClearSchema.safeParse({ id: "x" });
    expect(r.success).toBe(false);
  });
});
