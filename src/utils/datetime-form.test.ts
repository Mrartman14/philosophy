// src/utils/datetime-form.test.ts
import { describe, it, expect } from "vitest";

import {
  wallClockToRfc3339,
  instantToWallClock,
  DATE_ONLY,
} from "./datetime-form";

describe("wallClockToRfc3339", () => {
  it("interprets the wall-clock in the given timezone (Moscow +03:00)", () => {
    expect(wallClockToRfc3339("2026-07-01T19:00", "Europe/Moscow")).toBe(
      "2026-07-01T16:00:00Z",
    );
  });

  it("UTC behaves like the old UTC-only helper (drop-in superset)", () => {
    expect(wallClockToRfc3339("2026-07-01T19:00", "UTC")).toBe("2026-07-01T19:00:00Z");
    expect(wallClockToRfc3339("2026-07-01T19:00:30", "UTC")).toBe("2026-07-01T19:00:30Z");
  });

  it("is DST-aware (New York: EDT -04:00 in summer, EST -05:00 in winter)", () => {
    expect(wallClockToRfc3339("2026-07-01T12:00", "America/New_York")).toBe(
      "2026-07-01T16:00:00Z",
    );
    expect(wallClockToRfc3339("2026-01-01T12:00", "America/New_York")).toBe(
      "2026-01-01T17:00:00Z",
    );
  });

  it("returns date-only / already-RFC3339 / garbage / empty unchanged", () => {
    expect(wallClockToRfc3339("2026-07-01", "Europe/Moscow")).toBe("2026-07-01");
    expect(wallClockToRfc3339("2026-07-01T19:00:00Z", "Europe/Moscow")).toBe(
      "2026-07-01T19:00:00Z",
    );
    expect(wallClockToRfc3339("not-a-date", "Europe/Moscow")).toBe("not-a-date");
    expect(wallClockToRfc3339("", "Europe/Moscow")).toBe("");
  });
});

describe("instantToWallClock", () => {
  it("renders the instant as a wall-clock in the given timezone", () => {
    expect(instantToWallClock("2026-07-01T16:00:00Z", "Europe/Moscow")).toBe(
      "2026-07-01T19:00",
    );
    expect(instantToWallClock("2026-07-01T16:00:00Z", "UTC")).toBe("2026-07-01T16:00");
  });

  it("crosses the day boundary correctly", () => {
    // 23:30 UTC → 02:30 next day in Moscow.
    expect(instantToWallClock("2026-07-01T23:30:00Z", "Europe/Moscow")).toBe(
      "2026-07-02T02:30",
    );
  });

  it("empty / undefined / invalid → empty string", () => {
    expect(instantToWallClock(undefined, "Europe/Moscow")).toBe("");
    expect(instantToWallClock("", "Europe/Moscow")).toBe("");
    expect(instantToWallClock("garbage", "Europe/Moscow")).toBe("");
  });
});

describe("round-trip wallClock ↔ instant", () => {
  const cases: [string, string][] = [
    ["2026-07-01T19:00", "Europe/Moscow"],
    ["2026-07-01T19:00", "UTC"],
    // Across DST in both seasons — proves no constant-offset assumption.
    ["2026-07-15T09:30", "Europe/Berlin"],
    ["2026-01-15T09:30", "Europe/Berlin"],
  ];
  for (const [wall, tz] of cases) {
    it(`${wall} @ ${tz} survives wall→instant→wall`, () => {
      const instant = wallClockToRfc3339(wall, tz);
      expect(instantToWallClock(instant, tz)).toBe(wall);
    });
  }
});

describe("DATE_ONLY", () => {
  it("matches YYYY-MM-DD", () => {
    expect(DATE_ONLY.test("2026-07-01")).toBe(true);
  });

  it("does not match datetime strings", () => {
    expect(DATE_ONLY.test("2026-07-01T19:00")).toBe(false);
  });

  it("does not match partial dates", () => {
    expect(DATE_ONLY.test("2026-07")).toBe(false);
  });
});
