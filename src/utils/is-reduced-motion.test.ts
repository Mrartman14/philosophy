import { describe, expect, it } from "vitest";

import { isReducedMotion } from "./is-reduced-motion";

describe("isReducedMotion", () => {
  it("motion=reduced → всегда true", () => {
    expect(isReducedMotion({ motion: "reduced", osReduce: false })).toBe(true);
    expect(isReducedMotion({ motion: "reduced", osReduce: true })).toBe(true);
  });
  it("motion=full → всегда false (перебивает OS)", () => {
    expect(isReducedMotion({ motion: "full", osReduce: true })).toBe(false);
  });
  it("motion=system → следует OS", () => {
    expect(isReducedMotion({ motion: "system", osReduce: true })).toBe(true);
    expect(isReducedMotion({ motion: "system", osReduce: false })).toBe(false);
  });
});
