import { describe, it, expect } from "vitest";

import { HistoryTrackingSchema } from "./schemas";

describe("HistoryTrackingSchema", () => {
  it("принимает boolean", () => {
    expect(HistoryTrackingSchema.parse(true)).toBe(true);
    expect(HistoryTrackingSchema.parse(false)).toBe(false);
  });
  it("отклоняет не-boolean", () => {
    expect(() => HistoryTrackingSchema.parse("yes")).toThrow();
    expect(() => HistoryTrackingSchema.parse(1)).toThrow();
    expect(() => HistoryTrackingSchema.parse(null)).toThrow();
  });
});
