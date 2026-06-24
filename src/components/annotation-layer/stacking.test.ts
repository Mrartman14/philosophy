import { describe, it, expect } from "vitest";

import { resolveStack } from "./stacking";

describe("resolveStack", () => {
  it("непересекающиеся остаются на месте", () => {
    const r = resolveStack([{ id: "a", top: 0, height: 40 }, { id: "b", top: 100, height: 40 }], 8);
    expect(r.tops.get("a")).toBe(0);
    expect(r.tops.get("b")).toBe(100);
  });
  it("наезжающие раздвигаются на height+gap", () => {
    const r = resolveStack([{ id: "a", top: 0, height: 40 }, { id: "b", top: 10, height: 40 }], 8);
    expect(r.tops.get("b")).toBe(48);
  });
  it("сортирует по top независимо от порядка", () => {
    const r = resolveStack([{ id: "b", top: 100, height: 40 }, { id: "a", top: 0, height: 40 }]);
    expect(r.tops.get("a")).toBe(0);
    expect(r.tops.get("b")).toBe(100);
  });
  it("totalHeight = низ последней карточки", () => {
    const r = resolveStack([{ id: "a", top: 0, height: 40 }, { id: "b", top: 10, height: 30 }], 8);
    expect(r.totalHeight).toBe(78); // 48 + 30
  });
  it("пустой вход", () => {
    const r = resolveStack([]);
    expect(r.tops.size).toBe(0);
    expect(r.totalHeight).toBe(0);
  });
});
