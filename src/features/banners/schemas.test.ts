// src/features/banners/schemas.test.ts
import { describe, it, expect } from "vitest";

import {
  BannerCreateSchema,
  BannerUpdateSchema,
  BannerIdSchema,
} from "./schemas";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

const baseCreate = {
  variant: "info",
  target_audience: "all",
  dismissible: "true",
  start_at: "2026-07-01T10:00",
};

describe("BannerCreateSchema", () => {
  it("принимает полный валидный набор и конвертирует даты в RFC3339 (UTC)", () => {
    const r = BannerCreateSchema.safeParse({
      ...baseCreate,
      end_at: "2026-07-02T10:00",
      event_id: UUID,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.variant).toBe("info");
      expect(r.data.target_audience).toBe("all");
      expect(r.data.dismissible).toBe(true);
      expect(r.data.start_at).toBe("2026-07-01T10:00:00Z");
      expect(r.data.end_at).toBe("2026-07-02T10:00:00Z");
      expect(r.data.event_id).toBe(UUID);
    }
  });

  it("минимальный набор: без end_at/event_id, dismissible=false", () => {
    const r = BannerCreateSchema.safeParse({
      ...baseCreate,
      dismissible: "false",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.dismissible).toBe(false);
      expect(r.data.end_at).toBeUndefined();
      expect(r.data.event_id).toBeUndefined();
    }
  });

  it("принимает каждый валидный вариант", () => {
    for (const variant of ["info", "success", "warning", "danger", "brand", "neutral"]) {
      const r = BannerCreateSchema.safeParse({ ...baseCreate, variant });
      expect(r.success).toBe(true);
    }
  });

  it("отклоняет неизвестный вариант", () => {
    const r = BannerCreateSchema.safeParse({
      ...baseCreate,
      variant: "rainbow",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет неизвестную аудиторию", () => {
    const r = BannerCreateSchema.safeParse({
      ...baseCreate,
      target_audience: "everyone",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет end_at, равный start_at (бек требует строго после)", () => {
    const r = BannerCreateSchema.safeParse({
      ...baseCreate,
      end_at: "2026-07-01T10:00",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет end_at раньше start_at", () => {
    const r = BannerCreateSchema.safeParse({
      ...baseCreate,
      end_at: "2026-06-30T10:00",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет event_id, не являющийся UUID", () => {
    const r = BannerCreateSchema.safeParse({
      ...baseCreate,
      event_id: "not-a-uuid",
    });
    expect(r.success).toBe(false);
  });

  it("пустая строка event_id нормализуется в undefined", () => {
    const r = BannerCreateSchema.safeParse({
      ...baseCreate,
      event_id: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.event_id).toBeUndefined();
  });

  it("отклоняет пустой start_at", () => {
    const r = BannerCreateSchema.safeParse({
      ...baseCreate,
      start_at: "  ",
    });
    expect(r.success).toBe(false);
  });
});

describe("BannerUpdateSchema", () => {
  const baseUpdate = {
    id: UUID,
    variant: "warning",
    target_audience: "authenticated",
    dismissible: "true",
    start_at: "2026-07-01T10:00",
    blocks: JSON.stringify([
      { type: "paragraph", content: [{ type: "text", text: "x" }] },
    ]),
  };

  it("принимает валидный апдейт; пустой event_id остаётся пустой строкой (отвязка)", () => {
    const r = BannerUpdateSchema.safeParse({ ...baseUpdate, event_id: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.id).toBe(UUID);
      expect(Array.isArray(r.data.blocks)).toBe(true);
      expect(r.data.event_id).toBe("");
      expect(r.data.dismissible).toBe(true);
      expect(r.data.start_at).toBe("2026-07-01T10:00:00Z");
    }
  });

  it("принимает пустой массив blocks (явная очистка текста)", () => {
    const r = BannerUpdateSchema.safeParse({ ...baseUpdate, blocks: "[]" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.blocks).toEqual([]);
  });

  it("отклоняет битый JSON в blocks", () => {
    const r = BannerUpdateSchema.safeParse({ ...baseUpdate, blocks: "{oops" });
    expect(r.success).toBe(false);
  });

  it("отклоняет JSON-объект (не массив) в blocks", () => {
    const r = BannerUpdateSchema.safeParse({
      ...baseUpdate,
      blocks: JSON.stringify({ not: "array" }),
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет битый uuid в id", () => {
    const r = BannerUpdateSchema.safeParse({ ...baseUpdate, id: "not-uuid" });
    expect(r.success).toBe(false);
  });
});

describe("BannerIdSchema", () => {
  it("принимает валидный uuid", () => {
    expect(BannerIdSchema.safeParse({ id: UUID }).success).toBe(true);
  });
  it("отклоняет невалидный uuid", () => {
    expect(BannerIdSchema.safeParse({ id: "x" }).success).toBe(false);
  });
});
