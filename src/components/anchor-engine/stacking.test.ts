import { describe, it, expect } from "vitest";

import { applyOrder, resolveStack } from "./stacking";

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
  it("order — id в вертикальном порядке (по top), независимо от входного порядка", () => {
    const r = resolveStack([
      { id: "b", top: 100, height: 40 },
      { id: "a", top: 0, height: 40 },
      { id: "c", top: 200, height: 40 },
    ]);
    expect(r.order).toEqual(["a", "b", "c"]);
  });
});

describe("applyOrder", () => {
  it("переставляет элементы в заданный порядок по id", () => {
    const items = [{ id: "c" }, { id: "a" }, { id: "b" }];
    expect(applyOrder(items, ["a", "b", "c"]).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
  it("id вне порядка идут в конце, сохраняя относительный порядок (stable)", () => {
    const items = [{ id: "x" }, { id: "a" }, { id: "y" }, { id: "b" }];
    expect(applyOrder(items, ["a", "b"]).map((i) => i.id)).toEqual(["a", "b", "x", "y"]);
  });
  it("пустой порядок → вход без изменений", () => {
    const items = [{ id: "c" }, { id: "a" }];
    expect(applyOrder(items, []).map((i) => i.id)).toEqual(["c", "a"]);
  });
});
