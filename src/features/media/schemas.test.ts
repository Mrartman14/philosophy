import { describe, it, expect } from "vitest";

import type { NamespaceT } from "@/i18n";

import { makeMediaIdSchema, makeMediaVisibilitySchema } from "./schemas";

const t = ((key: string) => key) as unknown as NamespaceT<"validation">;
const MediaIdSchema = makeMediaIdSchema(t);
const MediaVisibilitySchema = makeMediaVisibilitySchema(t);

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("MediaIdSchema", () => {
  it("принимает валидный uuid", () => {
    const r = MediaIdSchema.safeParse({ id: UUID });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.id).toBe(UUID);
  });
  it("отклоняет невалидный uuid", () => {
    expect(MediaIdSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
  });
  it("отклоняет пустой объект", () => {
    expect(MediaIdSchema.safeParse({}).success).toBe(false);
  });
});

describe("MediaVisibilitySchema", () => {
  it("принимает private→public апдейт", () => {
    const r = MediaVisibilitySchema.safeParse({ id: UUID, visibility: "public" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.id).toBe(UUID);
      expect(r.data.visibility).toBe("public");
    }
  });
  it("принимает visibility=private (бек отвергнет downgrade — это валидно на уровне схемы)", () => {
    const r = MediaVisibilitySchema.safeParse({ id: UUID, visibility: "private" });
    expect(r.success).toBe(true);
  });
  it("отклоняет неизвестную видимость", () => {
    expect(
      MediaVisibilitySchema.safeParse({ id: UUID, visibility: "secret" }).success,
    ).toBe(false);
  });
  it("отклоняет битый id", () => {
    expect(
      MediaVisibilitySchema.safeParse({ id: "x", visibility: "public" }).success,
    ).toBe(false);
  });
});
