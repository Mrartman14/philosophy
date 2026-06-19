// src/features/documents/schemas.test.ts
import { describe, expect, it } from "vitest";

import type { NamespaceT } from "@/i18n";

// Стаб переводчика — возвращает ключ вместо текста (паттерн playbook Case 1).
const t = ((key: string) => key) as unknown as NamespaceT<"validation">;

import {
  makeDocumentCreateSchema,
  makeDocumentBlocksSchema,
  makeDocumentMetaSchema,
  makeDocumentVisibilitySchema,
  makeDocumentIdSchema,
} from "./schemas";

const DocumentCreateSchema = makeDocumentCreateSchema(t);
const DocumentBlocksSchema = makeDocumentBlocksSchema(t);
const DocumentMetaSchema = makeDocumentMetaSchema(t);
const DocumentVisibilitySchema = makeDocumentVisibilitySchema(t);
const DocumentIdSchema = makeDocumentIdSchema(t);

describe("DocumentCreateSchema", () => {
  it("success: title + валидный blocks JSON + visibility", () => {
    const r = DocumentCreateSchema.safeParse({
      title: "Мой документ",
      blocks: JSON.stringify([{ type: "paragraph" }]),
      visibility: "public",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.title).toBe("Мой документ");
      expect(Array.isArray(r.data.blocks)).toBe(true);
      expect(r.data.visibility).toBe("public");
    }
  });
  it("success: без visibility → undefined (бек дефолтит private)", () => {
    const r = DocumentCreateSchema.safeParse({
      title: "X",
      blocks: JSON.stringify([{ type: "paragraph" }]),
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.visibility).toBeUndefined();
  });
  it("failure: пустой title", () => {
    const r = DocumentCreateSchema.safeParse({
      title: "  ",
      blocks: JSON.stringify([{ type: "paragraph" }]),
    });
    expect(r.success).toBe(false);
  });
  it("failure: blocks не массив", () => {
    const r = DocumentCreateSchema.safeParse({
      title: "X",
      blocks: JSON.stringify({ not: "array" }),
    });
    expect(r.success).toBe(false);
  });
  it("failure: пустой массив blocks (бек требует min 1)", () => {
    const r = DocumentCreateSchema.safeParse({
      title: "X",
      blocks: JSON.stringify([]),
    });
    expect(r.success).toBe(false);
  });
  it("failure: невалидное visibility", () => {
    const r = DocumentCreateSchema.safeParse({
      title: "X",
      blocks: JSON.stringify([{ type: "paragraph" }]),
      visibility: "secret",
    });
    expect(r.success).toBe(false);
  });
});

describe("DocumentBlocksSchema", () => {
  it("success: id + валидный blocks", () => {
    const r = DocumentBlocksSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      blocks: JSON.stringify([{ type: "paragraph" }]),
    });
    expect(r.success).toBe(true);
  });
  it("failure: битый JSON", () => {
    const r = DocumentBlocksSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      blocks: "{not json",
    });
    expect(r.success).toBe(false);
  });
  it("failure: невалидный uuid", () => {
    const r = DocumentBlocksSchema.safeParse({
      id: "nope",
      blocks: JSON.stringify([{ type: "paragraph" }]),
    });
    expect(r.success).toBe(false);
  });
});

describe("DocumentMetaSchema", () => {
  it("success", () => {
    const r = DocumentMetaSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Новое имя",
    });
    expect(r.success).toBe(true);
  });
  it("failure: пустой title", () => {
    const r = DocumentMetaSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("DocumentVisibilitySchema", () => {
  it("success: public", () => {
    const r = DocumentVisibilitySchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      visibility: "public",
    });
    expect(r.success).toBe(true);
  });
  it("failure: невалидное значение", () => {
    const r = DocumentVisibilitySchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      visibility: "secret",
    });
    expect(r.success).toBe(false);
  });
});

describe("DocumentIdSchema", () => {
  it("success", () => {
    const r = DocumentIdSchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(r.success).toBe(true);
  });
  it("failure: не uuid", () => {
    const r = DocumentIdSchema.safeParse({ id: "x" });
    expect(r.success).toBe(false);
  });
});
