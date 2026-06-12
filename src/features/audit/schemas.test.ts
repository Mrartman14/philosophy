// src/features/audit/schemas.test.ts
import { describe, it, expect } from "vitest";
import {
  AuditActionSchema,
  AuditActorSchema,
  AuditDateSchema,
  AuditLogFilterSchema,
  AuditOffsetSchema,
  AuditTargetTypeSchema,
} from "./schemas";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("AuditActorSchema", () => {
  it("принимает валидный uuid", () => {
    expect(AuditActorSchema.safeParse(UUID).success).toBe(true);
  });
  it("отклоняет не-uuid", () => {
    expect(AuditActorSchema.safeParse("admin").success).toBe(false);
  });
});

describe("AuditTargetTypeSchema", () => {
  it("принимает известный тип", () => {
    expect(AuditTargetTypeSchema.safeParse("lecture").success).toBe(true);
  });
  it("отклоняет неизвестный тип", () => {
    expect(AuditTargetTypeSchema.safeParse("bogus").success).toBe(false);
  });
});

describe("AuditActionSchema", () => {
  it("принимает domain.verb", () => {
    expect(AuditActionSchema.safeParse("lecture.create").success).toBe(true);
  });
  it("принимает три сегмента (lecture.cover.set)", () => {
    expect(AuditActionSchema.safeParse("lecture.cover.set").success).toBe(true);
  });
  it("принимает snake_case (user.status_change)", () => {
    expect(AuditActionSchema.safeParse("user.status_change").success).toBe(true);
  });
  it("отклоняет строку без точки", () => {
    expect(AuditActionSchema.safeParse("create").success).toBe(false);
  });
  it("отклоняет верхний регистр", () => {
    expect(AuditActionSchema.safeParse("Lecture.Create").success).toBe(false);
  });
});

describe("AuditDateSchema", () => {
  it("преобразует полный ISO в RFC3339 UTC", () => {
    const r = AuditDateSchema.safeParse("2026-06-12T10:00:00Z");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("2026-06-12T10:00:00.000Z");
  });
  it("принимает значение из <input type=datetime-local>", () => {
    const input = "2026-06-12T13:45";
    const r = AuditDateSchema.safeParse(input);
    expect(r.success).toBe(true);
    // ожидание считаем тем же способом — тест не зависит от TZ раннера
    if (r.success) expect(r.data).toBe(new Date(input).toISOString());
  });
  it("отклоняет не-дату", () => {
    expect(AuditDateSchema.safeParse("вчера").success).toBe(false);
  });
});

describe("AuditOffsetSchema", () => {
  it("приводит строку к числу", () => {
    const r = AuditOffsetSchema.safeParse("50");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe(50);
  });
  it("отклоняет отрицательное", () => {
    expect(AuditOffsetSchema.safeParse("-1").success).toBe(false);
  });
  it("отклоняет не-число", () => {
    expect(AuditOffsetSchema.safeParse("abc").success).toBe(false);
  });
});

describe("AuditLogFilterSchema", () => {
  it("парсит полный валидный набор фильтров", () => {
    const r = AuditLogFilterSchema.parse({
      actor: UUID,
      target_type: "lecture",
      target_id: "lec-1",
      action: "lecture.create",
      from: "2026-06-01T00:00:00Z",
      to: "2026-06-12T23:59:59Z",
      offset: "50",
    });
    expect(r).toEqual({
      actor: UUID,
      target_type: "lecture",
      target_id: "lec-1",
      action: "lecture.create",
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-12T23:59:59.000Z",
      offset: 50,
    });
  });
  it("пустой объект → все поля undefined", () => {
    const r = AuditLogFilterSchema.parse({});
    expect(r.actor).toBeUndefined();
    expect(r.target_type).toBeUndefined();
    expect(r.offset).toBeUndefined();
  });
  it("битые значения отбрасываются в undefined, parse не бросает", () => {
    const r = AuditLogFilterSchema.parse({
      actor: "не-uuid",
      target_type: "bogus",
      action: "без точек",
      from: "не дата",
      offset: "-5",
    });
    expect(r.actor).toBeUndefined();
    expect(r.target_type).toBeUndefined();
    expect(r.action).toBeUndefined();
    expect(r.from).toBeUndefined();
    expect(r.offset).toBeUndefined();
  });
  it("пустой/пробельный target_id отбрасывается", () => {
    const r = AuditLogFilterSchema.parse({ target_id: "   " });
    expect(r.target_id).toBeUndefined();
  });
  it("неизвестные ключи не просачиваются", () => {
    const r = AuditLogFilterSchema.parse({ q: "x" });
    expect("q" in r).toBe(false);
  });
});
