// src/features/events/calendar.test.ts
import { describe, it, expect } from "vitest";
import {
  resolveMonthRange,
  groupOccurrencesByDate,
  formatEventDate,
} from "./calendar";
import type { EventOccurrence } from "./types";

describe("resolveMonthRange", () => {
  it("разрешает валидный месяц в границы месяца", () => {
    const r = resolveMonthRange("2026-07");
    expect(r.month).toBe("2026-07");
    expect(r.from).toBe("2026-07-01");
    expect(r.to).toBe("2026-07-31");
  });

  it("февраль високосного года → 29 дней", () => {
    expect(resolveMonthRange("2028-02").to).toBe("2028-02-29");
  });

  it("декабрь: nextMonth перекатывается в январь следующего года", () => {
    const r = resolveMonthRange("2026-12");
    expect(r.nextMonth).toBe("2027-01");
    expect(r.prevMonth).toBe("2026-11");
  });

  it("январь: prevMonth перекатывается в декабрь предыдущего года", () => {
    expect(resolveMonthRange("2026-01").prevMonth).toBe("2025-12");
  });

  it("невалидный параметр → текущий месяц (по now)", () => {
    const now = new Date(Date.UTC(2026, 5, 12)); // 2026-06-12
    const r = resolveMonthRange("13-2026", now);
    expect(r.month).toBe("2026-06");
    expect(r.from).toBe("2026-06-01");
    expect(r.to).toBe("2026-06-30");
  });

  it("отсутствующий параметр → текущий месяц", () => {
    const now = new Date(Date.UTC(2026, 0, 15));
    expect(resolveMonthRange(undefined, now).month).toBe("2026-01");
  });

  it("label содержит год", () => {
    expect(resolveMonthRange("2026-07").label).toContain("2026");
  });
});

describe("groupOccurrencesByDate", () => {
  const occ = (date: string, title: string): EventOccurrence => ({
    event_id: "e1",
    title,
    date,
    all_day: true,
    is_recurring: false,
    blocks: [],
  });

  it("группирует по дате; даты по возрастанию, внутри даты — по title", () => {
    const groups = groupOccurrencesByDate([
      occ("2026-07-02", "Б"),
      occ("2026-07-01", "А"),
      occ("2026-07-02", "А"),
    ]);
    expect(groups.map((g) => g.date)).toEqual(["2026-07-01", "2026-07-02"]);
    expect(groups[1]?.items.map((i) => i.title)).toEqual(["А", "Б"]);
  });

  it("пустой вход → пустой выход", () => {
    expect(groupOccurrencesByDate([])).toEqual([]);
  });

  it("пропускает occurrences без даты", () => {
    const broken: EventOccurrence = { event_id: "e1", title: "X" };
    expect(groupOccurrencesByDate([broken])).toEqual([]);
  });
});

describe("formatEventDate", () => {
  it("all_day: дата без времени", () => {
    const s = formatEventDate("2026-07-01", true);
    expect(s).toContain("2026");
    expect(s).not.toMatch(/\d{2}:\d{2}/);
  });

  it("timed: дата со временем (UTC)", () => {
    expect(formatEventDate("2026-07-01T19:00:00Z", false)).toMatch(/19:00/);
  });

  it("пустое значение → пустая строка", () => {
    expect(formatEventDate(undefined, true)).toBe("");
  });

  it("непарсибельное значение возвращается как есть", () => {
    expect(formatEventDate("garbage", false)).toBe("garbage");
  });
});
