// src/utils/dates.test.ts
import { describe, it, expect } from "vitest";

import { isPast, relativeTimeParts, unixSecToDate } from "./dates";

describe("unixSecToDate", () => {
  it("undefined/null → null", () => {
    expect(unixSecToDate(undefined)).toBeNull();
    expect(unixSecToDate(null)).toBeNull();
  });
  it("секунды → Date в миллисекундах", () => {
    expect(unixSecToDate(1_700_000_000)?.getTime()).toBe(1_700_000_000_000);
  });
});

describe("isPast", () => {
  const NOW = 1_000_000_000_000;
  it("прошлое → true", () => {
    expect(isPast(NOW - 1, NOW)).toBe(true);
  });
  it("будущее → false", () => {
    expect(isPast(NOW + 1, NOW)).toBe(false);
  });
  it("ровно сейчас → false (строгое <)", () => {
    expect(isPast(NOW, NOW)).toBe(false);
  });
  it("Date и ISO-строка поддержаны", () => {
    expect(isPast(new Date(NOW - 1), NOW)).toBe(true);
    expect(isPast("2000-01-01T00:00:00Z", NOW)).toBe(true);
  });
  it("невалидная дата → false", () => {
    expect(isPast("не дата", NOW)).toBe(false);
  });
});

describe("relativeTimeParts", () => {
  const NOW = 1_000_000_000_000;
  const DAY = 86_400_000;
  const HOUR = 3_600_000;
  const MIN = 60_000;
  it("будущее в днях → положительный value, unit day", () => {
    expect(relativeTimeParts(NOW + 3 * DAY, NOW)).toEqual({ value: 3, unit: "day" });
  });
  it("прошлое в днях → отрицательный value", () => {
    expect(relativeTimeParts(NOW - 2 * DAY, NOW)).toEqual({ value: -2, unit: "day" });
  });
  it("меньше суток → часы", () => {
    expect(relativeTimeParts(NOW + 5 * HOUR, NOW)).toEqual({ value: 5, unit: "hour" });
  });
  it("меньше часа → минуты", () => {
    expect(relativeTimeParts(NOW + 10 * MIN, NOW)).toEqual({ value: 10, unit: "minute" });
  });
});
