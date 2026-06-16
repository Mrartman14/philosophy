// src/utils/datetime-form.test.ts
import { describe, it, expect } from "vitest";

import { toRfc3339, DATE_ONLY } from "./datetime-form";

describe("toRfc3339", () => {
  it("appends :00Z to HH:mm datetime-local values", () => {
    expect(toRfc3339("2026-07-01T19:00")).toBe("2026-07-01T19:00:00Z");
  });

  it("appends Z to HH:mm:ss datetime-local values", () => {
    expect(toRfc3339("2026-07-01T19:00:30")).toBe("2026-07-01T19:00:30Z");
  });

  it("returns date-only strings unchanged", () => {
    expect(toRfc3339("2026-07-01")).toBe("2026-07-01");
  });

  it("returns already-RFC3339 strings unchanged", () => {
    expect(toRfc3339("2026-07-01T19:00:00Z")).toBe("2026-07-01T19:00:00Z");
  });

  it("returns arbitrary strings unchanged", () => {
    expect(toRfc3339("not-a-date")).toBe("not-a-date");
  });

  it("returns empty string unchanged", () => {
    expect(toRfc3339("")).toBe("");
  });
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
