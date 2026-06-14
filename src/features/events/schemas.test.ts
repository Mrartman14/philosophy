// src/features/events/schemas.test.ts
import { describe, it, expect } from "vitest";

import {
  EventCreateSchema,
  EventUpdateSchema,
  EventIdSchema,
} from "./schemas";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("EventCreateSchema", () => {
  it("принимает all_day-событие с датой YYYY-MM-DD", () => {
    const r = EventCreateSchema.safeParse({
      title: "Семинар по Канту",
      all_day: "on",
      start_date: "2026-07-01",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.all_day).toBe(true);
      expect(r.data.start_date).toBe("2026-07-01");
      expect(r.data.end_date).toBeUndefined();
      expect(r.data.rrule).toBeUndefined();
    }
  });

  it("не-all_day: конвертирует datetime-local в RFC3339 (UTC)", () => {
    const r = EventCreateSchema.safeParse({
      title: "Лекция",
      start_date: "2026-07-01T19:00",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.all_day).toBe(false);
      expect(r.data.start_date).toBe("2026-07-01T19:00:00Z");
    }
  });

  it("отклоняет пустой title", () => {
    const r = EventCreateSchema.safeParse({
      title: "  ",
      start_date: "2026-07-01T19:00",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет title длиннее 500", () => {
    const r = EventCreateSchema.safeParse({
      title: "a".repeat(501),
      all_day: "on",
      start_date: "2026-07-01",
    });
    expect(r.success).toBe(false);
  });

  it("all_day: отклоняет datetime в start_date", () => {
    const r = EventCreateSchema.safeParse({
      title: "X",
      all_day: "on",
      start_date: "2026-07-01T19:00",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет end_date раньше start_date", () => {
    const r = EventCreateSchema.safeParse({
      title: "X",
      all_day: "on",
      start_date: "2026-07-02",
      end_date: "2026-07-01",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет rrule без FREQ=", () => {
    const r = EventCreateSchema.safeParse({
      title: "X",
      all_day: "on",
      start_date: "2026-07-01",
      rrule: "WEEKLY",
    });
    expect(r.success).toBe(false);
  });

  it("принимает валидный rrule и пробрасывает его", () => {
    const r = EventCreateSchema.safeParse({
      title: "X",
      all_day: "on",
      start_date: "2026-07-01",
      rrule: "FREQ=WEEKLY;BYDAY=MO",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.rrule).toBe("FREQ=WEEKLY;BYDAY=MO");
  });

  it("пустая строка rrule нормализуется в undefined", () => {
    const r = EventCreateSchema.safeParse({
      title: "X",
      all_day: "on",
      start_date: "2026-07-01",
      rrule: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.rrule).toBeUndefined();
  });
});

describe("EventUpdateSchema", () => {
  const base = {
    id: UUID,
    title: "Семинар",
    all_day: "on",
    start_date: "2026-07-01",
    blocks: JSON.stringify([
      { type: "paragraph", content: [{ type: "text", text: "x" }] },
    ]),
  };

  it("принимает валидный апдейт и парсит blocks в массив", () => {
    const r = EventUpdateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.id).toBe(UUID);
      expect(Array.isArray(r.data.blocks)).toBe(true);
      expect(r.data.all_day).toBe(true);
    }
  });

  it("принимает пустой массив blocks (явная очистка тела)", () => {
    const r = EventUpdateSchema.safeParse({ ...base, blocks: "[]" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.blocks).toEqual([]);
  });

  it("отклоняет битый uuid", () => {
    const r = EventUpdateSchema.safeParse({ ...base, id: "not-uuid" });
    expect(r.success).toBe(false);
  });

  it("отклоняет битый JSON в blocks", () => {
    const r = EventUpdateSchema.safeParse({ ...base, blocks: "{oops" });
    expect(r.success).toBe(false);
  });

  it("отклоняет JSON-объект (не массив) в blocks", () => {
    const r = EventUpdateSchema.safeParse({
      ...base,
      blocks: JSON.stringify({ not: "array" }),
    });
    expect(r.success).toBe(false);
  });
});

describe("EventIdSchema", () => {
  it("принимает валидный uuid", () => {
    expect(EventIdSchema.safeParse({ id: UUID }).success).toBe(true);
  });
  it("отклоняет невалидный uuid", () => {
    expect(EventIdSchema.safeParse({ id: "x" }).success).toBe(false);
  });
});
