# Под-блочные якоря Phase 2 — table-rectangle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Включить третий случай диапазона контракта — прямоугольный якорь по двум угловым ячейкам ОДНОЙ таблицы: капчур кросс-ячеечного выделения, структурный резолв по двум node_id, bounding-box подсветка.

**Architecture:** FE-only (бэк не меняется). Новый юнит `table-grid` (grid-индекс ячейки + сбор диапазона + bbox). `resolveAnchor` возвращает нормализованный `AnchorGeometry` (`range` | `rect`). `useAnchorRanges` отдаёт `geometries`-карту + производный `ranges` (range-only) — существующие Range-хуки (Highlight-контроллер) не меняются; прямоугольник добавляется аддитивно через `geometries` в getAnchorRect / overlay / hit-test. Прямоугольник всегда рисуется div-оверлеем (CSS Custom Highlight API берёт только текстовые Range).

**Tech Stack:** TypeScript, React, Vitest (jsdom), pnpm. DOM-геометрия (getBoundingClientRect/getClientRects).

**Спека:** [docs/superpowers/specs/2026-07-01-subblock-anchors-phase2-table-rectangle-design.md](../specs/2026-07-01-subblock-anchors-phase2-table-rectangle-design.md). **Контракт:** [philosophy-api/docs/domain/anchors.md](../../../../philosophy-api/docs/domain/anchors.md) §«Диапазоны» + правило 4.

## Global Constraints

- **pnpm.** Итерации по файлу — `pnpm exec vitest run <path>` (НЕ `pnpm test` — тянет eslint-гард). Финальный гейт T7: `pnpm lint && pnpm test && pnpm build`.
- **ESLint:** запрещены non-null assertions (`!`). Использовать `?.` / `must()` из [test-support.ts](../../../src/components/anchor-engine/test-support.ts). После задачи прогонять `pnpm lint` на своих файлах.
- **Git (параллельные агенты):** коммитить ТОЛЬКО свои файлы по имени (`git add <files> && git commit --only <те же files>`). НЕ `git add -A`/`.`. НЕ коммитить `src/api/schema.ts` (может быть модифицирован в дереве — coordinated zone). Не добавлять untracked-доки. Без деструктивного git.
- **Бэк НЕ меняется.** `src/api/schema.ts` НЕ трогать. Якорь кодируется существующими полями `TextAnchor` (node_id уже есть).
- **Прямоугольник cell-granular**: `start_char`/`end_char`/`exact` несутся из выделения, но прямоугольным резолвом ИГНОРИРУЮТСЯ.
- **Прямоугольник всегда через div-оверлей**, не Highlight API.
- jsdom: `tagName` uppercase (`TD`/`TH`); `getBoundingClientRect()` без layout = нулевой rect → в тестах геометрии мокать rect'ы на элементах.
- Именование файлов kebab-case; русские комментарии где уместно. TDD.

---

## File Structure

| Файл | Ответственность | Задача |
| --- | --- | --- |
| `src/components/anchor-engine/table-grid.ts` (новый) | grid-индекс ячейки, сбор ячеек диапазона, bbox | T1 |
| `src/components/anchor-engine/types.ts` | `AnchorGeometry` тип | T2 |
| `src/components/anchor-engine/anchor-to-range.ts` | `resolveAnchor` (rect|range) | T2 |
| `src/components/anchor-engine/anchor-from-selection.ts` | капчур: same-table rectangle allow | T3 |
| `src/components/anchor-engine/use-anchor-ranges.ts` | `geometries`-карта + производный `ranges` + getAnchorRect via boundingRect | T4 |
| `src/components/anchor-engine/margin-anchor-layer.tsx` | orphan/onActivate via geometries; overlay-разводка | T4, T5 |
| `src/components/anchor-engine/highlight-overlay.tsx` | принимает `rects: DOMRect[]` | T5 |
| `src/components/anchor-engine/hit-test.ts` | ветка rect (point-in-bbox); карта geometries | T6 |
| `src/components/anchor-engine/use-hover-reveal.ts`, `use-text-click.ts` | потребляют geometries | T6 |

---

## Task 1: table-grid — grid-индекс, сбор диапазона, bbox

**Files:**
- Create: `src/components/anchor-engine/table-grid.ts`
- Test: `src/components/anchor-engine/table-grid.test.ts`

**Interfaces:**
- Produces: `cellGridPos(cell: Element): { row: number; col: number } | null`; `rectangleCells(startCell: Element, endCell: Element): Element[] | null` (null если ячейки не в одной таблице); `boundingBoxOf(cells: Element[]): DOMRect | null`.

- [ ] **Step 1: Write failing tests**

Создать `src/components/anchor-engine/table-grid.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { boundingBoxOf, cellGridPos, rectangleCells } from "./table-grid";

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
  expect(cellGridPos(r.querySelector("#a")!)).toEqual({ row: 0, col: 0 });
  expect(cellGridPos(r.querySelector("#f")!)).toEqual({ row: 1, col: 2 });
  expect(cellGridPos(r.querySelector("#h")!)).toEqual({ row: 2, col: 1 });
});

it("rectangleCells: 2×2 угол (a..e) → 4 ячейки, ориентация-инвариантно", () => {
  const r = table(GRID);
  const ids = (cells: Element[] | null) => (cells ?? []).map((c) => c.id).sort();
  expect(ids(rectangleCells(r.querySelector("#a")!, r.querySelector("#e")!))).toEqual(["a", "b", "d", "e"]);
  // обратный порядок углов → тот же прямоугольник
  expect(ids(rectangleCells(r.querySelector("#e")!, r.querySelector("#a")!))).toEqual(["a", "b", "d", "e"]);
});

it("rectangleCells: вырожденная строка (a..c) → 1×3", () => {
  const r = table(GRID);
  expect((rectangleCells(r.querySelector("#a")!, r.querySelector("#c")!) ?? []).map((c) => c.id)).toEqual(["a", "b", "c"]);
});

it("rectangleCells: разные таблицы → null", () => {
  const r = table(GRID + GRID);
  const [t1, t2] = Array.from(r.querySelectorAll("table"));
  const c1 = t1!.querySelector("td")!, c2 = t2!.querySelector("td")!;
  expect(rectangleCells(c1, c2)).toBeNull();
});

it("boundingBoxOf: объединение rect'ов углов (мокаем getBoundingClientRect)", () => {
  const r = table(GRID);
  const a = r.querySelector("#a")!, e = r.querySelector("#e")!;
  a.getBoundingClientRect = () => new DOMRect(10, 20, 30, 15);
  e.getBoundingClientRect = () => new DOMRect(40, 35, 30, 15);
  const box = boundingBoxOf([a, e]);
  expect(box).not.toBeNull();
  expect([box!.left, box!.top, box!.right, box!.bottom]).toEqual([10, 20, 70, 50]);
});
```

> Тесты используют `!` для краткости в фикстурах — ЗАМЕНИТЬ на `must()` из `./test-support` ИЛИ `?.` перед коммитом (eslint-гард запрещает `!`). Паттерн: `must(r.querySelector("#a"))`.

- [ ] **Step 2: Run — verify fail**

Run: `pnpm exec vitest run src/components/anchor-engine/table-grid.test.ts`
Expected: FAIL (модуль не существует).

- [ ] **Step 3: Implement table-grid.ts**

```ts
// src/components/anchor-engine/table-grid.ts
// Геометрия табличного прямоугольника: grid-индекс ячейки, сбор ячеек диапазона
// строк×столбцов по двум углам, bounding-box. Простой грид (AST-таблицы без
// colspan/rowspan). DOM-чтение, без React.

/**
 * СОБСТВЕННЫЕ строки таблицы. `querySelectorAll("tr")` — descendant-запрос и ловит
 * строки ВЛОЖЕННЫХ таблиц (table в ячейке) → загрязняет row-индекс внешней таблицы.
 * Фильтруем по «ближайшая таблица строки === эта таблица».
 */
function ownRows(table: Element): Element[] {
  return Array.from(table.querySelectorAll("tr")).filter((tr) => tr.closest("table") === table);
}

export function cellGridPos(cell: Element): { row: number; col: number } | null {
  const tr = cell.parentElement;
  if (!tr || tr.tagName !== "TR") return null;
  const table = cell.closest("table");
  if (!table) return null;
  const col = Array.prototype.indexOf.call(tr.children, cell);
  const row = ownRows(table).indexOf(tr);
  return col < 0 || row < 0 ? null : { row, col };
}

/** Ячейки прямоугольника по двум углам. null если ячейки не в ОДНОЙ таблице. */
export function rectangleCells(startCell: Element, endCell: Element): Element[] | null {
  const table = startCell.closest("table");
  if (!table || endCell.closest("table") !== table) return null;
  const a = cellGridPos(startCell), b = cellGridPos(endCell);
  if (!a || !b) return null;
  const r0 = Math.min(a.row, b.row), r1 = Math.max(a.row, b.row);
  const c0 = Math.min(a.col, b.col), c1 = Math.max(a.col, b.col);
  const rows = ownRows(table);
  const out: Element[] = [];
  for (let r = r0; r <= r1; r++) {
    const tr = rows[r];
    if (!tr) continue;
    for (let c = c0; c <= c1; c++) {
      const cell = tr.children[c];
      if (cell) out.push(cell);
    }
  }
  return out;
}

export function boundingBoxOf(cells: Element[]): DOMRect | null {
  if (cells.length === 0) return null;
  let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
  for (const cell of cells) {
    const r = cell.getBoundingClientRect();
    top = Math.min(top, r.top); left = Math.min(left, r.left);
    right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom);
  }
  return new DOMRect(left, top, right - left, bottom - top);
}
```

- [ ] **Step 4: Run — verify pass + lint**

Run: `pnpm exec vitest run src/components/anchor-engine/table-grid.test.ts && pnpm lint`
Expected: PASS, lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/anchor-engine/table-grid.ts src/components/anchor-engine/table-grid.test.ts
git commit --only src/components/anchor-engine/table-grid.ts src/components/anchor-engine/table-grid.test.ts -m "feat(anchor): table-grid — grid-индекс/сбор диапазона/bbox для прямоугольных якорей"
```

---

## Task 2: AnchorGeometry + resolveAnchor

**Files:**
- Modify: `src/components/anchor-engine/types.ts` (добавить `AnchorGeometry`)
- Modify: `src/components/anchor-engine/anchor-to-range.ts` (добавить `resolveAnchor`)
- Test: `src/components/anchor-engine/anchor-to-range.test.ts` (дополнить)

**Interfaces:**
- Consumes: `rectangleCells`/`boundingBoxOf` (T1), `rangeFromAnchor` (существующий), `leafEl`/`isCell` (в anchor-to-range.ts).
- Produces: `AnchorGeometry = { kind:"range"; range; boundingRect; clientRects } | { kind:"rect"; boundingRect; clientRects }`; `resolveAnchor(a: TextAnchor, root: HTMLElement): AnchorGeometry | null`.

- [ ] **Step 1: Add AnchorGeometry type**

В `src/components/anchor-engine/types.ts` (после `AnchorDraft`):

```ts
/**
 * Нормализованная геометрия резолва: линейный якорь несёт Range (для Highlight API
 * и caret-хит-теста), прямоугольный — только rect'ы. Общие boundingRect/clientRects
 * у обоих → потребители (карточка/коннектор/оверлей) source-agnostic.
 */
export type AnchorGeometry =
  | { kind: "range"; range: Range; boundingRect: DOMRect; clientRects: DOMRect[] }
  | { kind: "rect"; boundingRect: DOMRect; clientRects: DOMRect[] };
```

- [ ] **Step 2: Write failing tests**

В `src/components/anchor-engine/anchor-to-range.test.ts` дополнить:

```ts
import { resolveAnchor } from "./anchor-to-range";

it("resolveAnchor: две ячейки одной таблицы → kind:rect", () => {
  const r = setup(
    '<table data-block-id="t1"><tbody><tr>' +
    '<td data-node-id="c1" id="c1">aa</td><td data-node-id="c2" id="c2">bb</td>' +
    '</tr></tbody></table>',
  );
  r.querySelector("#c1")!.getBoundingClientRect = () => new DOMRect(0, 0, 10, 10);
  r.querySelector("#c2")!.getBoundingClientRect = () => new DOMRect(10, 0, 10, 10);
  const g = resolveAnchor(
    { startBlockId: "t1", endBlockId: "t1", startNodeId: "c1", endNodeId: "c2", startChar: 0, endChar: 2, exact: "aabb" },
    r,
  );
  expect(g?.kind).toBe("rect");
  expect(g?.clientRects.length).toBe(1);
});

it("resolveAnchor: мёртвый угол (node_id нет) → null", () => {
  const r = setup('<table data-block-id="t1"><tbody><tr><td data-node-id="c1">aa</td></tr></tbody></table>');
  const g = resolveAnchor(
    { startBlockId: "t1", endBlockId: "t1", startNodeId: "c1", endNodeId: "GONE", startChar: 0, endChar: 2, exact: "aabb" },
    r,
  );
  expect(g).toBeNull();
});

it("resolveAnchor: линейный within-leaf → kind:range", () => {
  const r = setup('<p data-block-id="p1" data-node-id="p1">Hello</p>');
  const g = resolveAnchor(
    { startBlockId: "p1", endBlockId: "p1", startNodeId: "p1", endNodeId: "p1", startChar: 1, endChar: 4, exact: "ell" },
    r,
  );
  expect(g?.kind).toBe("range");
});
```

> `setup(html)` — хелпер уже есть в `anchor-to-range.test.ts` (НЕ `root` — тот в `anchor-from-selection.test.ts`). Заменить `!` на `must()`/`?.` перед коммитом.
> **Сквозной round-trip тест (capture→resolve) перенесён в Task 3** — он зависит от капчур-правила 4 (выделение 2 ячеек даёт `null` до Task 3). В Task 2 — только 3 resolve-юнита (rect / dead-corner→null / linear→range).

- [ ] **Step 3: Run — verify fail**

Run: `pnpm exec vitest run src/components/anchor-engine/anchor-to-range.test.ts`
Expected: FAIL (`resolveAnchor` не существует).

- [ ] **Step 4: Implement resolveAnchor**

В `src/components/anchor-engine/anchor-to-range.ts` — добавить импорты и функцию (НЕ трогать `rangeFromAnchor` и существующие хелперы):

```ts
import { boundingBoxOf, rectangleCells } from "./table-grid";
// ВНИМАНИЕ (import/no-duplicates = error): `AnchorGeometry` СЛИТЬ в существующую
// строку импорта из "./types", НЕ отдельной строкой:
//   import type { AnchorGeometry, TextAnchor } from "./types";
```

```ts
/**
 * Нормализованный резолв: прямоугольник (две ячейки ОДНОЙ таблицы — правило 4)
 * структурно по node_id; иначе линейный через rangeFromAnchor. Прямоугольный
 * резолв ИГНОРИРУЕТ офсеты/exact (ячейки id-стабильны).
 */
export function resolveAnchor(a: TextAnchor, root: HTMLElement): AnchorGeometry | null {
  if (a.startNodeId !== a.endNodeId) {
    const sL = leafEl(root, a.startNodeId), eL = leafEl(root, a.endNodeId);
    if (isCell(sL) && isCell(eL) && sL && eL) {
      const cells = rectangleCells(sL, eL);
      const bbox = cells ? boundingBoxOf(cells) : null;
      if (!bbox) return null; // разные таблицы / мёртвый угол → орфан
      return { kind: "rect", boundingRect: bbox, clientRects: [bbox] };
    }
  }
  const range = rangeFromAnchor(a, root);
  if (!range) return null;
  // jsdom: Range.getBoundingClientRect/getClientRects ОТСУТСТВУЮТ (есть только у
  // Element; в браузере есть и у Range). Guard — иначе юнит-тест с резолвимым
  // линейным якорем падает с TypeError, а не на ассертах (C1 из ревью).
  const boundingRect = range.getBoundingClientRect?.() ?? new DOMRect();
  const clientRects =
    typeof range.getClientRects === "function" ? Array.from(range.getClientRects()) : [];
  return { kind: "range", range, boundingRect, clientRects };
}
```

- [ ] **Step 5: Run — verify pass + lint**

Run: `pnpm exec vitest run src/components/anchor-engine/anchor-to-range.test.ts && pnpm lint`
Expected: PASS, lint clean. (`rangeFromAnchor`-тесты не затронуты.)

- [ ] **Step 6: Commit**

```bash
git add src/components/anchor-engine/types.ts src/components/anchor-engine/anchor-to-range.ts src/components/anchor-engine/anchor-to-range.test.ts
git commit --only src/components/anchor-engine/types.ts src/components/anchor-engine/anchor-to-range.ts src/components/anchor-engine/anchor-to-range.test.ts -m "feat(anchor): resolveAnchor → AnchorGeometry (rect|range)"
```

---

## Task 3: Капчур — same-table rectangle allow

**Files:**
- Modify: `src/components/anchor-engine/anchor-from-selection.ts:20-22` (single-cell гард)
- Test: `src/components/anchor-engine/anchor-from-selection.test.ts` (дополнить)

**Interfaces:**
- Produces: `anchorFromRange`/`anchorFromSelection` теперь возвращают прямоугольный якорь (оба cell node_id) для выделения в пределах ОДНОЙ таблицы; cross-table и cell+проза → `null`.

- [ ] **Step 1: Write failing tests**

В `src/components/anchor-engine/anchor-from-selection.test.ts` дополнить:

```ts
it("same-table cross-cell → прямоугольный якорь (оба cell node_id)", () => {
  const r = root('<table data-block-id="t1"><tbody><tr><td data-node-id="c1">aa</td><td data-node-id="c2">bb</td></tr></tbody></table>');
  const t1 = r.querySelector('[data-node-id="c1"]')!.firstChild as Text;
  const t2 = r.querySelector('[data-node-id="c2"]')!.firstChild as Text;
  const a = anchorFromSelection(selectRange(t1, 0, t2, 2), r);
  expect(a).toMatchObject({ startNodeId: "c1", endNodeId: "c2", startBlockId: "t1", endBlockId: "t1" });
});

it("cross-table выделение → null", () => {
  const r = root(
    '<table data-block-id="t1"><tbody><tr><td data-node-id="c1">aa</td></tr></tbody></table>' +
    '<table data-block-id="t2"><tbody><tr><td data-node-id="c2">bb</td></tr></tbody></table>',
  );
  const t1 = r.querySelector('[data-node-id="c1"]')!.firstChild as Text;
  const t2 = r.querySelector('[data-node-id="c2"]')!.firstChild as Text;
  expect(anchorFromSelection(selectRange(t1, 0, t2, 2), r)).toBeNull();
});

it("ячейка + проза (mixed) → null (явный регресс-ассерт)", () => {
  const r = root('<p data-block-id="p0" data-node-id="p0">pre</p><table data-block-id="t1"><tbody><tr><td data-node-id="c1">aa</td></tr></tbody></table>');
  const p = r.querySelector('[data-node-id="p0"]')!.firstChild as Text;
  const c = r.querySelector('[data-node-id="c1"]')!.firstChild as Text;
  expect(anchorFromSelection(selectRange(p, 0, c, 2), r)).toBeNull();
});
```

> `selectRange`/`root` — хелперы уже в файле (из Core T5). Если имена иные — использовать существующие. Заменить `!` перед коммитом. Существующие cell+prose→null и within-cell тесты Core остаются (cell+prose мёртв через mixed-ветку ниже).

**СКВОЗНОЙ round-trip (#9) — ДОБАВИТЬ в `anchor-to-range.test.ts`** (там живёт Core-тест «round-trip within-cell», уже импортит и `anchorFromSelection`, и `resolveAnchor`; `setup`-хелпер тоже там). После капчур-правила 4 он зелёный (до Task 3 капчур двух ячеек → null, поэтому он здесь, не в Task 2):

```ts
it("round-trip rect: anchorFromSelection(2 ячейки) → resolveAnchor kind:rect", () => {
  const r = setup('<table data-block-id="t1"><tbody><tr><td data-node-id="c1" id="c1">aa</td><td data-node-id="c2" id="c2">bb</td></tr></tbody></table>');
  r.querySelector("#c1")!.getBoundingClientRect = () => new DOMRect(0, 0, 10, 10);
  r.querySelector("#c2")!.getBoundingClientRect = () => new DOMRect(10, 0, 10, 10);
  const t1 = r.querySelector("#c1")!.firstChild as Text;
  const t2 = r.querySelector("#c2")!.firstChild as Text;
  const range = document.createRange();
  range.setStart(t1, 0); range.setEnd(t2, 2);
  const sel = window.getSelection()!;
  sel.removeAllRanges(); sel.addRange(range);
  const a = anchorFromSelection(sel, r);
  expect(a).toMatchObject({ startNodeId: "c1", endNodeId: "c2" });
  const g = a ? resolveAnchor(a, r) : null;
  expect(g?.kind).toBe("rect");
});
```
(Заменить `!` на `must()`/`?.`. → Task 3 коммитит ТАКЖЕ `anchor-to-range.test.ts`.)

- [ ] **Step 2: Run — verify fail**

Run: `pnpm exec vitest run src/components/anchor-engine/anchor-from-selection.test.ts`
Expected: FAIL (same-table cross-cell сейчас → null по Core-гарду).

- [ ] **Step 3: Replace the single-cell guard with rule-4 logic**

В `src/components/anchor-engine/anchor-from-selection.ts` заменить блок гарда (строки ~20-26) так, чтобы `sBlock`/`eBlock` считались ДО решения:

```ts
  const sBlock = closestAttr(range.startContainer, root, "data-block-id");
  const eBlock = closestAttr(range.endContainer, root, "data-block-id");
  if (!sBlock || !eBlock) return null;

  // Правило 4 (контракт): если хоть один конец — ячейка, ОБА обязаны быть
  // ячейками ОДНОЙ таблицы (sBlock === eBlock) → прямоугольник. Иначе (cross-table
  // ячейки ИЛИ ячейка+проза) — не создаём якорь. Линейная проза (ни одной ячейки)
  // — без ограничений.
  if (isCell(sLeaf) || isCell(eLeaf)) {
    const bothCells = isCell(sLeaf) && isCell(eLeaf);
    if (!bothCells || sBlock !== eBlock) return null;
  }
```

(Удалить прежний `if ((isCell(sLeaf) || isCell(eLeaf)) && sLeaf !== eLeaf) return null;` и прежнее отдельное вычисление `sBlock`/`eBlock` ниже — теперь оно выше.)

- [ ] **Step 4: Run — verify pass + lint**

Run: `pnpm exec vitest run src/components/anchor-engine/anchor-from-selection.test.ts && pnpm lint`
Expected: PASS (same-table cross-cell → якорь; cross-table → null; within-cell и cell+prose Core-тесты зелёные).

- [ ] **Step 5: Commit**

```bash
git add src/components/anchor-engine/anchor-from-selection.ts src/components/anchor-engine/anchor-from-selection.test.ts src/components/anchor-engine/anchor-to-range.test.ts
git commit --only src/components/anchor-engine/anchor-from-selection.ts src/components/anchor-engine/anchor-from-selection.test.ts src/components/anchor-engine/anchor-to-range.test.ts -m "feat(anchor): капчур разрешает same-table прямоугольник (правило 4) + round-trip"
```

---

## Task 4: use-anchor-ranges → geometries-карта + getAnchorRect via boundingRect

**Files:**
- Modify: `src/components/anchor-engine/use-anchor-ranges.ts`
- Modify: `src/components/anchor-engine/margin-anchor-layer.tsx` (orphan/onActivate via geometries)
- Test: `src/components/anchor-engine/use-anchor-ranges.test.tsx` (дополнить)

**Interfaces:**
- Consumes: `resolveAnchor` (T2), `AnchorGeometry` (T2).
- Produces: `useAnchorRanges` возвращает `{ geometries: Map<string, AnchorGeometry|null>, ranges: Map<string, Range|null>, getAnchorRect, recomputeKey, ready }`. `ranges` — производный (range-kind → range, иначе null) для существующих Range-хуков. `getAnchorRect(id)` = `geometries.get(id)?.boundingRect ?? null`.

- [ ] **Step 1: Write failing test**

В `src/components/anchor-engine/use-anchor-ranges.test.tsx` дополнить (драйвер `renderHook` уже используется в файле; `notes` — стабильная ссылка, как `EMPTY` в файле):

```ts
it("geometries: rect-якорь → kind:rect (ranges.get=null); range-якорь → оба", () => {
  const el = document.createElement("div");
  el.innerHTML =
    '<table data-block-id="t1"><tbody><tr>' +
    '<td data-node-id="c1" id="c1">aa</td><td data-node-id="c2" id="c2">bb</td>' +
    "</tr></tbody></table>" +
    '<p data-block-id="p1" data-node-id="p1">Hello</p>';
  document.body.appendChild(el);
  const c1 = el.querySelector("#c1"), c2 = el.querySelector("#c2");
  if (c1) c1.getBoundingClientRect = () => new DOMRect(0, 0, 10, 10);
  if (c2) c2.getBoundingClientRect = () => new DOMRect(10, 0, 10, 10);
  const ref = createRef<HTMLElement>();
  ref.current = el;
  const notes: AnchoredNote[] = [
    { id: "rect1", anchor: { startBlockId: "t1", endBlockId: "t1", startNodeId: "c1", endNodeId: "c2", startChar: 0, endChar: 2, exact: "aabb" } },
    { id: "lin1", anchor: { startBlockId: "p1", endBlockId: "p1", startNodeId: "p1", endNodeId: "p1", startChar: 1, endChar: 4, exact: "ell" } },
  ];
  const { result } = renderHook(() => useAnchorRanges({ astRootRef: ref, notes }));
  expect(result.current.geometries.get("rect1")?.kind).toBe("rect");
  expect(result.current.ranges.get("rect1")).toBeNull();
  expect(result.current.geometries.get("lin1")?.kind).toBe("range");
  expect(result.current.ranges.get("lin1")).not.toBeNull();
});
```

(`notes` — const, объявлен ДО `renderHook` → стабильная ссылка, не гоняет recompute-эффект по кругу; см. коммент `EMPTY` в файле.)

- [ ] **Step 2: Run — verify fail**

Run: `pnpm exec vitest run src/components/anchor-engine/use-anchor-ranges.test.tsx`
Expected: FAIL (нет `geometries` в выдаче).

- [ ] **Step 3: Implement geometries + derived ranges + getAnchorRect**

Заменить тело `useAnchorRanges` в `src/components/anchor-engine/use-anchor-ranges.ts` (импорт `resolveAnchor` вместо `rangeFromAnchor`, добавить `AnchorGeometry`):

```ts
import { resolveAnchor } from "./anchor-to-range";
import type { AnchoredNote, AnchorGeometry } from "./types";
```

Внутри хука (заменить блок `ranges`/`getAnchorRect`, эффекты resize/fonts/notes — без изменений):

```ts
  // Геометрия (range|rect) по каждому note. recomputeKey/ready форсят перестроение.
  const geometries = useMemo(() => {
    const root = astRootRef.current;
    const m = new Map<string, AnchorGeometry | null>();
    if (root) for (const n of notes) m.set(n.id, resolveAnchor(n.anchor, root));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, astRootRef, ready, recomputeKey]);

  // Производный range-only слой для существующих Range-потребителей
  // (Highlight API контроллер). rect-якоря → null (в Highlight API не идут).
  const ranges = useMemo(() => {
    const m = new Map<string, Range | null>();
    for (const [id, g] of geometries) m.set(id, g?.kind === "range" ? g.range : null);
    return m;
  }, [geometries]);

  const getAnchorRect = useCallback(
    (id: string) => geometries.get(id)?.boundingRect ?? null,
    [geometries],
  );

  return { geometries, ranges, getAnchorRect, recomputeKey, ready };
```

- [ ] **Step 4: Update orchestrator direct uses (geometries)**

В `src/components/anchor-engine/margin-anchor-layer.tsx`:
- получить `geometries` из хука: `const { geometries, ranges, getAnchorRect, recomputeKey, ready } = useAnchorRanges({ astRootRef, notes });`
- orphan через geometries:

```ts
    const orphan = (geometries.get(n.id) ?? null) === null;
```

- `onActivate` через boundingRect:

```ts
  const onActivate = useCallback(
    (id: string) => {
      setActiveId(id);
      const rect = geometries.get(id)?.boundingRect ?? null;
      if (rect) {
        window.scrollTo({
          top: rect.top + window.scrollY - ACTIVATE_SCROLL_OFFSET_PX,
          behavior: scrollBehavior(),
        });
      }
    },
    [geometries],
  );
```

(Хуки `useAnchorHighlights`/`useHoverReveal`/`useTextClick` пока получают производный `ranges` — сигнатуры не меняются. **НЕ удалять `ranges` из деструктуризации/выдачи хука** до T6. `overlayRanges`/overlay — Task 5. ПРИМЕЧАНИЕ (из ревью): rect-подсветка визуально появится только ПОСЛЕ T5 (rect → null в производном `ranges`, в старый overlay-фолбэк не попадает), а активная/hover rect — после T6. На коммите T4 это промежуточное состояние, НЕ регресс линейных.)

- [ ] **Step 5: Run — verify pass + lint + broader**

Run: `pnpm exec vitest run src/components/anchor-engine/use-anchor-ranges.test.tsx src/components/anchor-engine/margin-anchor-layer.test.tsx && pnpm lint`
Expected: PASS, lint clean. Прогнать и `pnpm exec vitest run src/components/anchor-engine` — линейные якоря без регресса.

- [ ] **Step 6: Commit**

```bash
git add src/components/anchor-engine/use-anchor-ranges.ts src/components/anchor-engine/margin-anchor-layer.tsx src/components/anchor-engine/use-anchor-ranges.test.tsx
git commit --only src/components/anchor-engine/use-anchor-ranges.ts src/components/anchor-engine/margin-anchor-layer.tsx src/components/anchor-engine/use-anchor-ranges.test.tsx -m "feat(anchor): geometries-карта (range|rect) + getAnchorRect via boundingRect"
```

---

## Task 5: Прямоугольная подсветка через div-оверлей

**Files:**
- Modify: `src/components/anchor-engine/highlight-overlay.tsx` (принимать `rects: DOMRect[]`)
- Modify: `src/components/anchor-engine/margin-anchor-layer.tsx` (разводка overlay по geometries)
- Test: `src/components/anchor-engine/margin-anchor-layer.test.tsx` (дополнить)

**Interfaces:**
- Produces: `HighlightOverlay` принимает `rects: DOMRect[]` + `activeRects: DOMRect[]`. Оркестратор кормит overlay: rect-якоря (ВСЕГДА) + range-якоря (только если `!controller.supported`), активный — в `activeRects`.

- [ ] **Step 1: Write failing test**

В `src/components/anchor-engine/margin-anchor-layer.test.tsx` дополнить. Мокаем Highlight API как ПОДДЕРЖАННЫЙ → линейные якоря ушли бы в Highlight API (без оверлея), значит `.annotation-overlay` div может прийти ТОЛЬКО от rect-якоря (драйвер `render` + `useRef` — как `Harness` в файле; overlay портален в `document.body`):

```tsx
it("rect-якорь рендерится оверлеем (bbox) даже при поддержке Highlight API", () => {
  const g = globalThis as Record<string, unknown>;
  const savedCSS = g.CSS, savedHL = g.Highlight;
  g.CSS = { highlights: new Map() };
  g.Highlight = class { constructor(..._r: Range[]) { void _r; } };
  try {
    function RectHarness() {
      const ref = useRef<HTMLDivElement>(null);
      return (
        <div>
          <div ref={ref} data-ast-root>
            <table data-block-id="t1"><tbody><tr>
              <td data-node-id="c1">aa</td><td data-node-id="c2">bb</td>
            </tr></tbody></table>
          </div>
          <MarginAnchorLayer
            astRootRef={ref}
            notes={[{ id: "r1", anchor: { startBlockId: "t1", endBlockId: "t1", startNodeId: "c1", endNodeId: "c2", startChar: 0, endChar: 2, exact: "aabb" } }]}
            highlightEnabled
            canCreate={false}
            onCreateRequest={() => undefined}
            affordanceLabel="Add"
            renderNote={(n) => <span>{n.id}</span>}
          />
        </div>
      );
    }
    render(<RectHarness />);
    expect(document.querySelector(".annotation-overlay")).toBeTruthy();
  } finally {
    g.CSS = savedCSS;
    g.Highlight = savedHL;
  }
});
```

(jsdom: `getBoundingClientRect`→0 → bbox = `DOMRect(0,0,0,0)`, но `.annotation-overlay` div всё равно рендерится — проверяем именно факт оверлея от rect-якоря.)

- [ ] **Step 2: Run — verify fail**

Run: `pnpm exec vitest run src/components/anchor-engine/margin-anchor-layer.test.tsx`
Expected: FAIL (rect не рисуется — overlay сейчас только в fallback и только Range).

- [ ] **Step 3: HighlightOverlay принимает rects**

Заменить `src/components/anchor-engine/highlight-overlay.tsx` на rect-based (убрать `getClientRects` — rect'ы приходят готовыми):

```tsx
"use client";
// src/components/anchor-engine/highlight-overlay.tsx
// Подсветка прямоугольниками в абсолютном слое. Ноль мутаций текстового DOM.
// Источник rect'ов — вызывающий (range.getClientRects() для линейных в фолбэке,
// bounding-box для прямоугольных якорей). Прямоугольный якорь рисуется ТОЛЬКО здесь
// (CSS Custom Highlight API берёт лишь текстовые Range).
import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  rects: DOMRect[];
  activeRects: DOMRect[];
}
interface Box {
  top: number; left: number; width: number; height: number; active: boolean;
}

function collect(rects: DOMRect[], activeRects: DOMRect[]): Box[] {
  const map = (r: DOMRect, active: boolean): Box => ({
    top: r.top + window.scrollY, left: r.left + window.scrollX,
    width: r.width, height: r.height, active,
  });
  return [...rects.map((r) => map(r, false)), ...activeRects.map((r) => map(r, true))];
}

export function HighlightOverlay({ rects, activeRects }: Props) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  useLayoutEffect(() => {
    const update = () => setBoxes(collect(rects, activeRects));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [rects, activeRects]);
  return createPortal(
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      {boxes.map((b, i) => (
        <div
          key={i}
          className={b.active ? "annotation-overlay annotation-overlay--active" : "annotation-overlay"}
          // eslint-disable-next-line no-restricted-syntax -- координатный оверлей, направление-нейтрально
          style={{ position: "absolute", top: b.top, left: b.left, width: b.width, height: b.height }}
        />
      ))}
    </div>,
    document.body,
  );
}
```

- [ ] **Step 4: Wire overlay in orchestrator**

В `src/components/anchor-engine/margin-anchor-layer.tsx` заменить блок `overlayRanges`/`<HighlightOverlay>` на geometry-разводку:

```tsx
  // Оверлей: rect-якоря ВСЕГДА (Highlight API их не берёт) + линейные ТОЛЬКО когда
  // Highlight API не поддержан. Активный — в activeRects (annotation-overlay--active).
  const overlayRects: DOMRect[] = [];
  const activeOverlayRects: DOMRect[] = [];
  if (highlightEnabled) {
    for (const [id, g] of geometries) {
      if (!g) continue;
      const toOverlay = g.kind === "rect" || !controller.supported;
      if (!toOverlay) continue;
      (id === emphasizedId ? activeOverlayRects : overlayRects).push(...g.clientRects);
    }
  }
```

```tsx
      {(overlayRects.length > 0 || activeOverlayRects.length > 0) && (
        <HighlightOverlay rects={overlayRects} activeRects={activeOverlayRects} />
      )}
```

(Удалить прежний `overlayRanges` и старый вызов `<HighlightOverlay ranges=... activeRange=.../>`.)

- [ ] **Step 5: Run — verify pass + lint + broader**

Run: `pnpm exec vitest run src/components/anchor-engine/margin-anchor-layer.test.tsx src/components/anchor-engine/highlight-overlay* && pnpm lint`
Expected: PASS, lint clean. Прогнать `pnpm exec vitest run src/components/anchor-engine` — линейная подсветка (Highlight API + fallback) без регресса. Если есть отдельный `highlight-overlay.test.tsx` со старым `ranges`-API — обновить под `rects`/`activeRects`.

- [ ] **Step 6: Commit**

```bash
git add src/components/anchor-engine/highlight-overlay.tsx src/components/anchor-engine/margin-anchor-layer.tsx src/components/anchor-engine/margin-anchor-layer.test.tsx
git commit --only src/components/anchor-engine/highlight-overlay.tsx src/components/anchor-engine/margin-anchor-layer.tsx src/components/anchor-engine/margin-anchor-layer.test.tsx -m "feat(anchor): bounding-box подсветка прямоугольных якорей через оверлей"
```

---

## Task 6: Хит-тест прямоугольника (hover/click)

**Files:**
- Modify: `src/components/anchor-engine/hit-test.ts` (`noteAtPointInRanges` → geometries + rect-ветка)
- Modify: `src/components/anchor-engine/use-hover-reveal.ts`, `src/components/anchor-engine/use-text-click.ts` (потребляют geometries)
- Modify: `src/components/anchor-engine/margin-anchor-layer.tsx` (передать geometries в hover/click)
- Test: `src/components/anchor-engine/hit-test.test.ts` (дополнить)

**Interfaces:**
- Produces: `noteAtPointInGeometry(x, y, geometries: Map<string, AnchorGeometry|null>, root): string | null` — range-kind → `comparePoint(caret)`; rect-kind → point-in-`boundingRect`. `useHoverReveal`/`useTextClick` принимают `geometries` вместо `ranges`.

- [ ] **Step 1: Write failing test**

В `src/components/anchor-engine/hit-test.test.ts` дополнить:

```ts
import { noteAtPointInGeometry } from "./hit-test";

it("noteAtPointInGeometry: точка внутри rect-bbox → id ноты", () => {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const geometries = new Map([
    ["n1", { kind: "rect", boundingRect: new DOMRect(0, 0, 100, 50), clientRects: [new DOMRect(0, 0, 100, 50)] }],
  ]) as Map<string, import("./types").AnchorGeometry | null>;
  expect(noteAtPointInGeometry(10, 10, geometries, root)).toBe("n1");
  expect(noteAtPointInGeometry(200, 200, geometries, root)).toBeNull();
});
```

- [ ] **Step 2: Run — verify fail**

Run: `pnpm exec vitest run src/components/anchor-engine/hit-test.test.ts`
Expected: FAIL (`noteAtPointInGeometry` не существует).

- [ ] **Step 3: Implement noteAtPointInGeometry**

В `src/components/anchor-engine/hit-test.ts` добавить (импорт типа + новую функцию; `noteAtPointInRanges`/`noteContainingCaret`/`noteAtPoint` можно оставить или удалить после миграции потребителей — удалить `noteAtPointInRanges`, т.к. его заменяет geometry-версия):

```ts
import type { AnchoredNote, AnchorGeometry } from "./types";
```

```ts
function pointInRect(x: number, y: number, r: DOMRect): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/**
 * Хит-тест по посчитанным geometries (порядок Map = порядок notes → first-match):
 * range-kind → caret/comparePoint; rect-kind → point-in-boundingRect (caret не
 * применим — нет Range). Заменяет noteAtPointInRanges.
 */
export function noteAtPointInGeometry(
  x: number,
  y: number,
  geometries: Map<string, AnchorGeometry | null>,
  root: HTMLElement,
): string | null {
  const caret = caretFromPoint(x, y, root);
  for (const [id, g] of geometries) {
    if (!g) continue;
    if (g.kind === "rect") {
      if (pointInRect(x, y, g.boundingRect)) return id;
    } else if (caret && g.range.comparePoint(caret.node, caret.offset) === 0) {
      return id;
    }
  }
  return null;
}
```

Удалить прежний `noteAtPointInRanges` (его потребители мигрируют в Step 4).

- [ ] **Step 4: Migrate hover/click to geometries**

В `src/components/anchor-engine/use-hover-reveal.ts` и `use-text-click.ts`:
- сменить проп `ranges: Map<string, Range | null>` → `geometries: Map<string, AnchorGeometry | null>` (импорт типа из `./types`);
- сменить вызов `noteAtPointInRanges(x, y, ranges, root)` → `noteAtPointInGeometry(x, y, geometries, root)` (импорт);
- в deps эффекта `ranges` → `geometries`.

В `src/components/anchor-engine/margin-anchor-layer.tsx` — передать `geometries` в оба хука:

```tsx
  useHoverReveal({ astRootRef, geometries, ready, onHover: setHoveredId });
  // ...
  useTextClick({ astRootRef, geometries, ready, onPick: pickFromText });
```

- [ ] **Step 5: Run — verify pass + lint + broader**

Run: `pnpm exec vitest run src/components/anchor-engine/hit-test.test.ts src/components/anchor-engine/use-hover-reveal.test.tsx src/components/anchor-engine/use-text-click.test.tsx && pnpm lint`
Expected: PASS, lint clean.

**ОБЯЗАТЕЛЬНО** обновить `use-hover-reveal.test.tsx` и `use-text-click.test.tsx`: они передают проп `ranges: Map<string, Range|null>` с live-`Range` (9 вызовов суммарно). После миграции проп — `geometries: Map<string, AnchorGeometry|null>`; КАЖДЫЙ существующий `Range` обернуть в geometry, иначе `noteAtPointInGeometry` не прочитает `g.range` и зелёные comparePoint-тесты станут красными не из-за регресса:

```ts
const wrap = (r: Range): AnchorGeometry => ({
  kind: "range", range: r,
  boundingRect: r.getBoundingClientRect?.() ?? new DOMRect(),
  clientRects: typeof r.getClientRects === "function" ? Array.from(r.getClientRects()) : [],
});
// было:  ranges={new Map([["n1", r]])}
// стало: geometries={new Map([["n1", wrap(r)]])}
```

Прогнать `pnpm exec vitest run src/components/anchor-engine`.

- [ ] **Step 6: Commit**

```bash
git add src/components/anchor-engine/hit-test.ts src/components/anchor-engine/use-hover-reveal.ts src/components/anchor-engine/use-text-click.ts src/components/anchor-engine/margin-anchor-layer.tsx src/components/anchor-engine/hit-test.test.ts
git commit --only src/components/anchor-engine/hit-test.ts src/components/anchor-engine/use-hover-reveal.ts src/components/anchor-engine/use-text-click.ts src/components/anchor-engine/margin-anchor-layer.tsx src/components/anchor-engine/hit-test.test.ts -m "feat(anchor): хит-тест прямоугольника (point-in-bbox) для hover/click"
```

---

## Task 7: Интеграционный гейт

**Files:** нет новых; верификация + фикс остаточных падений.

- [ ] **Step 1: Lint** — `pnpm lint` → 0 ошибок (фиксить только своё; `?.`/`must()` вместо `!`).
- [ ] **Step 2: Full test** — `pnpm test` → PASS. Частые остаточные: hover/click/overlay тесты, передававшие `ranges` → `geometries`/`rects`; обновить.
- [ ] **Step 3: Build** — `pnpm build` → compiled.
- [ ] **Step 4: Commit (если были фиксы)** — перечислить ровно изменённые файлы; НЕ трогать `schema.ts`/чужое.

```bash
git add <конкретные файлы>
git commit --only <те же файлы> -m "fix(anchor): остаточные правки гейта Phase 2"
```

---

## Спека ↔ план: сверка

- table-grid (grid-индекс/сбор/bbox) → T1.
- AnchorGeometry + resolveAnchor (rect|range, FE-структурный rect) → T2.
- Капчур правило 4 (same-table allow, cross-table/mixed→null) → T3.
- geometries-карта + getAnchorRect (карточка/коннектор source-agnostic) → T4.
- Highlight API не берёт rect → bounding-box оверлей → T5.
- Хит-тест rect-ветка (point-in-bbox) → T6.
- Гейт → T7.
- Краевые случаи (мёртвый угол→null, вырожденная строка/столбец, разные таблицы→null) покрыты в T1/T2/T3.

## Self-Review notes

- **Placeholders:** заглушек нет — T4/T5 Step 1 содержат реальные runnable-тесты (renderHook / render-Harness по образцу существующих файлов).
- **Фикс-пасс по 5-осевому субагент-ревью (2026-07-01):** C1 (guard на отсутствующую в jsdom Range-геометрию в `resolveAnchor`), M1 (`root`→`setup` в T2-тестах), M2-import (слить `AnchorGeometry` в импорт `./types`), M2-nested (`ownRows` фильтр против строк вложенных таблиц), сквозной round-trip тест capture→resolve (T2), явная миграция hover/click тестов с обёрткой `Range`→`AnchorGeometry` (T6), регресс-ассерт mixed→null (T3), заметки про T4→T5→T6 видимость rect. Контракт-фиделити подтверждена ревью (все 5 норм-пунктов).
- **Type consistency:** `AnchorGeometry` (T2) ↔ `geometries: Map<string, AnchorGeometry|null>` (T4) ↔ `noteAtPointInGeometry`/hover/click (T6). `getAnchorRect` → `boundingRect`. `clientRects` у обоих kind. `ranges` (производный range-only) только для Highlight-контроллера.
- **Green-per-task:** T1/T2 аддитивны; T3 капчур; T4 хуки получают производный `ranges` (сигнатуры не ломаются); T5 overlay+orchestrator; T6 hover/click мигрируют на geometries. Каждая зелёная на коммите.
