// src/features/annotations/schemas.test.ts
import { describe, it, expect } from "vitest";

import type { NamespaceT } from "@/i18n";

import {
  makeAnnotationCreateSchema,
  makeAnnotationUpdateSchema,
  makeAnnotationIdSchema,
  AdminAnnotationFilterSchema,
  AnnotationOffsetSchema,
} from "./schemas";

// Stub translator: returns key as-is (паттерн из playbook)
const t = ((key: string) => key) as unknown as NamespaceT<"validation">;

const AnnotationCreateSchema = makeAnnotationCreateSchema(t);
const AnnotationUpdateSchema = makeAnnotationUpdateSchema(t);
const AnnotationIdSchema = makeAnnotationIdSchema(t);

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const blocksJson = JSON.stringify([{ type: "paragraph", content: [] }]);

describe("AnnotationCreateSchema", () => {
  it("success: blocks + private + parent поля", () => {
    const r = AnnotationCreateSchema.safeParse({
      parent_entity_type: "document",
      parent_entity_id: UUID,
      visibility: "private",
      blocks: blocksJson,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.parent_entity_type).toBe("document");
      expect(Array.isArray(r.data.blocks)).toBe(true);
      expect(r.data.visibility).toBe("private");
    }
  });

  it("success: visibility по умолчанию private при отсутствии", () => {
    const r = AnnotationCreateSchema.safeParse({
      parent_entity_type: "glossary",
      parent_entity_id: UUID,
      blocks: blocksJson,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.visibility).toBe("private");
  });

  it("failure: неизвестный parent_entity_type", () => {
    const r = AnnotationCreateSchema.safeParse({
      parent_entity_type: "banner",
      parent_entity_id: UUID,
      blocks: blocksJson,
    });
    expect(r.success).toBe(false);
  });

  it("failure: пустые blocks (битый JSON)", () => {
    const r = AnnotationCreateSchema.safeParse({
      parent_entity_type: "document",
      parent_entity_id: UUID,
      blocks: "не json",
    });
    expect(r.success).toBe(false);
  });

  it("failure: blocks не массив", () => {
    const r = AnnotationCreateSchema.safeParse({
      parent_entity_type: "document",
      parent_entity_id: UUID,
      blocks: JSON.stringify({ type: "paragraph" }),
    });
    expect(r.success).toBe(false);
  });
});

describe("AnnotationUpdateSchema", () => {
  it("success: id + blocks", () => {
    const r = AnnotationUpdateSchema.safeParse({ id: UUID, blocks: blocksJson });
    expect(r.success).toBe(true);
  });
  it("failure: невалидный id", () => {
    const r = AnnotationUpdateSchema.safeParse({ id: "x", blocks: blocksJson });
    expect(r.success).toBe(false);
  });
  it("failure: visibility в апдейте игнорируется (иммутабельна)", () => {
    const r = AnnotationUpdateSchema.safeParse({
      id: UUID,
      blocks: blocksJson,
      visibility: "public",
    });
    expect(r.success).toBe(true);
    // даже если прислали — в выходной объект не просачивается
    if (r.success) expect("visibility" in r.data).toBe(false);
  });
});

describe("AnnotationIdSchema", () => {
  it("success: валидный uuid", () =>
    { expect(AnnotationIdSchema.safeParse({ id: UUID }).success).toBe(true); });
  it("failure: не uuid", () =>
    { expect(AnnotationIdSchema.safeParse({ id: "nope" }).success).toBe(false); });
});

describe("AnnotationOffsetSchema", () => {
  it("success: строку приводит к числу", () => {
    const r = AnnotationOffsetSchema.safeParse("40");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe(40);
  });
  it("failure: отрицательное", () =>
    { expect(AnnotationOffsetSchema.safeParse("-1").success).toBe(false); });
});

describe("AdminAnnotationFilterSchema", () => {
  it("success: полный набор фильтров", () => {
    const r = AdminAnnotationFilterSchema.parse({
      parent_entity_type: "document",
      parent_entity_id: UUID,
      author_id: UUID,
      offset: "20",
    });
    expect(r.parent_entity_type).toBe("document");
    expect(r.offset).toBe(20);
  });
  it("success: пустой объект → все undefined", () => {
    const r = AdminAnnotationFilterSchema.parse({});
    expect(r.parent_entity_type).toBeUndefined();
    expect(r.offset).toBeUndefined();
  });
  it("битые значения → undefined, parse не бросает", () => {
    const r = AdminAnnotationFilterSchema.parse({
      parent_entity_type: "bogus",
      author_id: "не-uuid",
      offset: "-5",
    });
    expect(r.parent_entity_type).toBeUndefined();
    expect(r.author_id).toBeUndefined();
    expect(r.offset).toBeUndefined();
  });
});
