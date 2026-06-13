// src/features/trails/schemas.test.ts
import { describe, expect, it } from "vitest";
import {
  TrailCreateSchema,
  TrailMetaSchema,
  TrailVisibilitySchema,
  TrailItemsSchema,
  TrailIdSchema,
} from "./schemas";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const UUID2 = "550e8400-e29b-41d4-a716-446655440001";

describe("TrailCreateSchema", () => {
  it("success: title + description + visibility", () => {
    const r = TrailCreateSchema.safeParse({
      title: "Введение в логику",
      description: "Базовый курс",
      visibility: "public",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.title).toBe("Введение в логику");
      expect(r.data.visibility).toBe("public");
    }
  });
  it("success: без visibility и description → undefined (бек дефолтит)", () => {
    const r = TrailCreateSchema.safeParse({ title: "X" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.visibility).toBeUndefined();
      expect(r.data.description).toBeUndefined();
    }
  });
  it("failure: пустой title", () => {
    expect(TrailCreateSchema.safeParse({ title: "   " }).success).toBe(false);
  });
  it("failure: title длиннее 200", () => {
    expect(TrailCreateSchema.safeParse({ title: "a".repeat(201) }).success).toBe(false);
  });
  it("failure: description длиннее 2000", () => {
    expect(
      TrailCreateSchema.safeParse({ title: "X", description: "a".repeat(2001) }).success,
    ).toBe(false);
  });
  it("failure: невалидное visibility", () => {
    expect(TrailCreateSchema.safeParse({ title: "X", visibility: "secret" }).success).toBe(false);
  });
});

describe("TrailMetaSchema", () => {
  it("success: id + title + description", () => {
    const r = TrailMetaSchema.safeParse({ id: UUID, title: "Новое", description: "desc" });
    expect(r.success).toBe(true);
  });
  it("success: пустое description допустимо (очистка)", () => {
    const r = TrailMetaSchema.safeParse({ id: UUID, title: "Новое", description: "" });
    expect(r.success).toBe(true);
  });
  it("failure: пустой title", () => {
    expect(TrailMetaSchema.safeParse({ id: UUID, title: "" }).success).toBe(false);
  });
  it("failure: невалидный uuid", () => {
    expect(TrailMetaSchema.safeParse({ id: "nope", title: "X" }).success).toBe(false);
  });
});

describe("TrailVisibilitySchema", () => {
  it("success: public", () => {
    expect(TrailVisibilitySchema.safeParse({ id: UUID, visibility: "public" }).success).toBe(true);
  });
  it("failure: невалидное значение", () => {
    expect(TrailVisibilitySchema.safeParse({ id: UUID, visibility: "secret" }).success).toBe(false);
  });
});

describe("TrailItemsSchema", () => {
  it("success: id + JSON-массив uuid лекций", () => {
    const r = TrailItemsSchema.safeParse({
      id: UUID,
      lecture_ids: JSON.stringify([UUID, UUID2]),
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.lecture_ids).toEqual([UUID, UUID2]);
    }
  });
  it("success: пустой список (полная очистка содержимого)", () => {
    const r = TrailItemsSchema.safeParse({ id: UUID, lecture_ids: JSON.stringify([]) });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.lecture_ids).toEqual([]);
  });
  it("failure: битый JSON", () => {
    expect(TrailItemsSchema.safeParse({ id: UUID, lecture_ids: "{not json" }).success).toBe(false);
  });
  it("failure: не массив", () => {
    expect(
      TrailItemsSchema.safeParse({ id: UUID, lecture_ids: JSON.stringify({ x: 1 }) }).success,
    ).toBe(false);
  });
  it("failure: элемент не uuid", () => {
    expect(
      TrailItemsSchema.safeParse({ id: UUID, lecture_ids: JSON.stringify(["nope"]) }).success,
    ).toBe(false);
  });
  it("failure: дубликат лекции (бек вернул бы 422)", () => {
    expect(
      TrailItemsSchema.safeParse({ id: UUID, lecture_ids: JSON.stringify([UUID, UUID]) }).success,
    ).toBe(false);
  });
});

describe("TrailIdSchema", () => {
  it("success", () => {
    expect(TrailIdSchema.safeParse({ id: UUID }).success).toBe(true);
  });
  it("failure: не uuid", () => {
    expect(TrailIdSchema.safeParse({ id: "x" }).success).toBe(false);
  });
});
