// src/features/tags/schemas.test.ts
import { describe, it, expect } from "vitest";

import type { NamespaceT } from "@/i18n";

import {
  makeTagCreateSchema,
  makeTagUpdateSchema,
  TagIdSchema,
  makeSetLectureTagsSchema,
} from "./schemas";

const t = ((key: string) => key) as unknown as NamespaceT<"validation">;

const TagCreateSchema = makeTagCreateSchema(t);
const TagUpdateSchema = makeTagUpdateSchema(t);
const SetLectureTagsSchema = makeSetLectureTagsSchema(t);

const LECTURE_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("TagCreateSchema", () => {
  it("принимает валидное имя и тримит", () => {
    const r = TagCreateSchema.safeParse({ name: "  этика  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("этика");
  });
  it("отклоняет пустое имя", () => {
    const r = TagCreateSchema.safeParse({ name: "   " });
    expect(r.success).toBe(false);
  });
  it("отклоняет имя длиннее 100", () => {
    const r = TagCreateSchema.safeParse({ name: "a".repeat(101) });
    expect(r.success).toBe(false);
  });
});

describe("TagUpdateSchema", () => {
  it("принимает строковый id из FormData и приводит к числу", () => {
    const r = TagUpdateSchema.safeParse({ id: "7", name: "логика" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.id).toBe(7);
  });
  it("отклоняет нечисловой id", () => {
    const r = TagUpdateSchema.safeParse({ id: "abc", name: "логика" });
    expect(r.success).toBe(false);
  });
  it("отклоняет пустое имя", () => {
    const r = TagUpdateSchema.safeParse({ id: "7", name: "" });
    expect(r.success).toBe(false);
  });
});

describe("TagIdSchema", () => {
  it("принимает number", () => {
    const r = TagIdSchema.safeParse({ id: 7 });
    expect(r.success).toBe(true);
  });
  it("принимает числовую строку", () => {
    const r = TagIdSchema.safeParse({ id: "7" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.id).toBe(7);
  });
  it("отклоняет ноль и отрицательные", () => {
    expect(TagIdSchema.safeParse({ id: 0 }).success).toBe(false);
    expect(TagIdSchema.safeParse({ id: -3 }).success).toBe(false);
  });
  it("отклоняет нечисловое", () => {
    expect(TagIdSchema.safeParse({ id: "x" }).success).toBe(false);
  });
});

describe("SetLectureTagsSchema", () => {
  it("принимает uuid лекции и JSON-массив id", () => {
    const r = SetLectureTagsSchema.safeParse({
      lecture_id: LECTURE_ID,
      tag_ids: "[1,2,3]",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tag_ids).toEqual([1, 2, 3]);
  });
  it("принимает пустой массив (очистка тегов)", () => {
    const r = SetLectureTagsSchema.safeParse({
      lecture_id: LECTURE_ID,
      tag_ids: "[]",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tag_ids).toEqual([]);
  });
  it("отклоняет битый uuid лекции", () => {
    const r = SetLectureTagsSchema.safeParse({
      lecture_id: "not-uuid",
      tag_ids: "[1]",
    });
    expect(r.success).toBe(false);
  });
  it("отклоняет битый JSON", () => {
    const r = SetLectureTagsSchema.safeParse({
      lecture_id: LECTURE_ID,
      tag_ids: "{not-json",
    });
    expect(r.success).toBe(false);
  });
  it("отклоняет JSON, который не массив", () => {
    const r = SetLectureTagsSchema.safeParse({
      lecture_id: LECTURE_ID,
      tag_ids: '{"a":1}',
    });
    expect(r.success).toBe(false);
  });
  it("отклоняет нецелые и неположительные id", () => {
    expect(
      SetLectureTagsSchema.safeParse({ lecture_id: LECTURE_ID, tag_ids: "[1.5]" }).success,
    ).toBe(false);
    expect(
      SetLectureTagsSchema.safeParse({ lecture_id: LECTURE_ID, tag_ids: "[0]" }).success,
    ).toBe(false);
    expect(
      SetLectureTagsSchema.safeParse({ lecture_id: LECTURE_ID, tag_ids: '["1"]' }).success,
    ).toBe(false);
  });
});
