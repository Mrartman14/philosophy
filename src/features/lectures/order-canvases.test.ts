import { describe, expect, it } from "vitest";

import { orderLectureCanvases } from "./order-canvases";

describe("orderLectureCanvases", () => {
  it("ставит основной канвас (is_entry) первым, сохраняя порядок остальных", () => {
    const ordered = orderLectureCanvases([
      { id: "a" },
      { id: "b", is_entry: true },
      { id: "c" },
    ]);
    expect(ordered.map((c) => c.id)).toEqual(["b", "a", "c"]);
  });

  it("без is_entry сохраняет исходный порядок", () => {
    const ordered = orderLectureCanvases([{ id: "a" }, { id: "b" }, { id: "c" }]);
    expect(ordered.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("отфильтровывает элементы без id", () => {
    const ordered = orderLectureCanvases([{ id: "a" }, {}, { id: "b" }]);
    expect(ordered.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("несколько is_entry (дрейф контракта) — все вперёд, стабильно", () => {
    const ordered = orderLectureCanvases([
      { id: "a" },
      { id: "b", is_entry: true },
      { id: "c", is_entry: true },
    ]);
    expect(ordered.map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("пустой список → пустой", () => {
    expect(orderLectureCanvases([])).toEqual([]);
  });
});
