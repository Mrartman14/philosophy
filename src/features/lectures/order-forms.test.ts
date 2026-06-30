import { describe, expect, it } from "vitest";

import { orderLectureForms } from "./order-forms";

describe("orderLectureForms", () => {
  it("ставит основную форму (is_entry) первой, сохраняя порядок остальных", () => {
    const ordered = orderLectureForms([
      { id: "a" },
      { id: "b", is_entry: true },
      { id: "c" },
    ]);
    expect(ordered.map((f) => f.id)).toEqual(["b", "a", "c"]);
  });

  it("без is_entry сохраняет исходный порядок", () => {
    const ordered = orderLectureForms([{ id: "a" }, { id: "b" }, { id: "c" }]);
    expect(ordered.map((f) => f.id)).toEqual(["a", "b", "c"]);
  });

  it("отфильтровывает элементы без id", () => {
    const ordered = orderLectureForms([{ id: "a" }, {}, { id: "b" }]);
    expect(ordered.map((f) => f.id)).toEqual(["a", "b"]);
  });

  it("несколько is_entry (дрейф контракта) — все вперёд, стабильно", () => {
    const ordered = orderLectureForms([
      { id: "a" },
      { id: "b", is_entry: true },
      { id: "c", is_entry: true },
    ]);
    expect(ordered.map((f) => f.id)).toEqual(["b", "c", "a"]);
  });

  it("пустой список → пустой", () => {
    expect(orderLectureForms([])).toEqual([]);
  });
});
