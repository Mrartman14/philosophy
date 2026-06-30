import { beforeEach, expect, it } from "vitest";

import { boundingBoxOf, cellGridPos, rectangleCells } from "./table-grid";
import { must } from "./test-support";

// Чистим DOM между тестами: фикстуры дублируют id (#a..#i), а jsdom строит
// document-уровневую ID-карту — без сброса scoped querySelector("#e") во 2-м+
// тесте возвращает null (та же конвенция, что в остальных anchor-engine-тестах).
beforeEach(() => {
  document.body.innerHTML = "";
});

function table(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}
const GRID =
  "<table><tbody>" +
  "<tr><td id='a'>A</td><td id='b'>B</td><td id='c'>C</td></tr>" +
  "<tr><td id='d'>D</td><td id='e'>E</td><td id='f'>F</td></tr>" +
  "<tr><td id='g'>G</td><td id='h'>H</td><td id='i'>I</td></tr>" +
  "</tbody></table>";

it("cellGridPos: строка/столбец из DOM", () => {
  const r = table(GRID);
  expect(cellGridPos(must(r.querySelector("#a")))).toEqual({ row: 0, col: 0 });
  expect(cellGridPos(must(r.querySelector("#f")))).toEqual({ row: 1, col: 2 });
  expect(cellGridPos(must(r.querySelector("#h")))).toEqual({ row: 2, col: 1 });
});

it("rectangleCells: 2×2 угол (a..e) → 4 ячейки, ориентация-инвариантно", () => {
  const r = table(GRID);
  const ids = (cells: Element[] | null) => (cells ?? []).map((c) => c.id).sort();
  expect(ids(rectangleCells(must(r.querySelector("#a")), must(r.querySelector("#e"))))).toEqual(["a", "b", "d", "e"]);
  // обратный порядок углов → тот же прямоугольник
  expect(ids(rectangleCells(must(r.querySelector("#e")), must(r.querySelector("#a"))))).toEqual(["a", "b", "d", "e"]);
});

it("rectangleCells: вырожденная строка (a..c) → 1×3", () => {
  const r = table(GRID);
  expect((rectangleCells(must(r.querySelector("#a")), must(r.querySelector("#c"))) ?? []).map((c) => c.id)).toEqual([
    "a",
    "b",
    "c",
  ]);
});

it("rectangleCells: разные таблицы → null", () => {
  const r = table(GRID + GRID);
  const [t1, t2] = Array.from(r.querySelectorAll("table"));
  const c1 = must(must(t1).querySelector("td")),
    c2 = must(must(t2).querySelector("td"));
  expect(rectangleCells(c1, c2)).toBeNull();
});

it("boundingBoxOf: объединение rect'ов углов (мокаем getBoundingClientRect)", () => {
  const r = table(GRID);
  const a = must(r.querySelector("#a")),
    e = must(r.querySelector("#e"));
  a.getBoundingClientRect = () => new DOMRect(10, 20, 30, 15);
  e.getBoundingClientRect = () => new DOMRect(40, 35, 30, 15);
  const box = boundingBoxOf([a, e]);
  expect(box).not.toBeNull();
  expect([must(box).left, must(box).top, must(box).right, must(box).bottom]).toEqual([10, 20, 70, 50]);
});
