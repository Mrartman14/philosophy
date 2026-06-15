// src/app/_offline/registry.test.ts
import { describe, it, expect } from "vitest";

import { OFFLINE_REGISTRY, resolveDescriptor } from "./registry";

describe("offline registry", () => {
  it("резолвит lectureDescriptor по 'lectures'", () => {
    const d = resolveDescriptor("lectures");
    expect(d).toBeDefined();
    expect(d?.entity).toBe("lectures");
    expect(typeof d?.assemble).toBe("function");
    expect(typeof d?.extractImageKeys).toBe("function");
    expect(Object.keys(OFFLINE_REGISTRY)).toContain("lectures");
  });

  it("resolveDescriptor → undefined для незарегистрированной сущности", () => {
    expect(resolveDescriptor("nope")).toBeUndefined();
  });
});
