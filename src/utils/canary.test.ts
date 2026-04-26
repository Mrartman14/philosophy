// src/utils/canary.test.ts
import { describe, it, expect } from "vitest";

describe("vitest canary", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });

  it("has FormData in jsdom", () => {
    const fd = new FormData();
    fd.set("name", "Alice");
    expect(fd.get("name")).toBe("Alice");
  });
});
