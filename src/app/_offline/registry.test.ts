// src/app/_offline/registry.test.ts
import { describe, it, expect } from "vitest";

import { OFFLINE_REGISTRY, resolveDescriptor } from "./registry";

describe("offline registry", () => {
  it("стартует пустым (слайсы добавят дескрипторы)", () => {
    expect(Object.keys(OFFLINE_REGISTRY)).toEqual([]);
  });

  it("resolveDescriptor → undefined для незарегистрированной сущности", () => {
    expect(resolveDescriptor("lectures")).toBeUndefined();
  });
});
