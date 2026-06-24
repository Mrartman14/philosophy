import { describe, it, expect } from "vitest";

import type { NamespaceT } from "@/i18n";

import {
  makeTermCreateSchema,
  makeTermBlocksUpdateSchema,
  makeTermIdSchema,
} from "./schemas";

// Заглушка переводчика: возвращает ключ как есть (поведение совпадает с
// resolveErrorMessage вне request-scope: см. playbook Case 1).
const t = ((key: string) => key) as unknown as NamespaceT<"validation">;

describe("TermCreateSchema", () => {
  const TermCreateSchema = makeTermCreateSchema(t);
  const validBlocks = JSON.stringify([
    { type: "paragraph", content: [{ type: "text", text: "тело" }] },
  ]);

  it("принимает валидный title и непустые blocks", () => {
    const r = TermCreateSchema.safeParse({ title: "Эпистемология", blocks: validBlocks });
    expect(r.success).toBe(true);
    if (r.success) expect(Array.isArray(r.data.blocks)).toBe(true);
  });
  it("отклоняет пустой title", () => {
    const r = TermCreateSchema.safeParse({ title: "  ", blocks: validBlocks });
    expect(r.success).toBe(false);
  });
  it("отклоняет title длиннее 300", () => {
    const r = TermCreateSchema.safeParse({ title: "a".repeat(301), blocks: validBlocks });
    expect(r.success).toBe(false);
  });
  it("отклоняет пустой массив blocks (тело обязательно)", () => {
    const r = TermCreateSchema.safeParse({ title: "Эпистемология", blocks: "[]" });
    expect(r.success).toBe(false);
  });
  it("отклоняет битый JSON в blocks", () => {
    const r = TermCreateSchema.safeParse({ title: "Эпистемология", blocks: "{not-json" });
    expect(r.success).toBe(false);
  });
});

describe("TermBlocksUpdateSchema", () => {
  const TermBlocksUpdateSchema = makeTermBlocksUpdateSchema(t);

  it("принимает валидный uuid и JSON-массив", () => {
    const r = TermBlocksUpdateSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      blocks: JSON.stringify([{ type: "paragraph", content: [{ type: "text", text: "x" }] }]),
    });
    expect(r.success).toBe(true);
    if (r.success) expect(Array.isArray(r.data.blocks)).toBe(true);
  });
  it("отклоняет битый uuid", () => {
    const r = TermBlocksUpdateSchema.safeParse({ id: "not-uuid", blocks: "[]" });
    expect(r.success).toBe(false);
  });
  it("отклоняет пустой blocks", () => {
    const r = TermBlocksUpdateSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      blocks: "",
    });
    expect(r.success).toBe(false);
  });
  it("отклоняет битый JSON", () => {
    const r = TermBlocksUpdateSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      blocks: "{not-json",
    });
    expect(r.success).toBe(false);
  });
  it("отклоняет JSON, который не массив", () => {
    const r = TermBlocksUpdateSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      blocks: JSON.stringify({ not: "array" }),
    });
    expect(r.success).toBe(false);
  });
});

describe("TermIdSchema", () => {
  const TermIdSchema = makeTermIdSchema(t);

  it("принимает валидный uuid", () => {
    const r = TermIdSchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(r.success).toBe(true);
  });
  it("отклоняет невалидный uuid", () => {
    const r = TermIdSchema.safeParse({ id: "x" });
    expect(r.success).toBe(false);
  });
});
