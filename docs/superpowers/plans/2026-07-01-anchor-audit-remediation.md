# Anchor Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Устранить 2 Important + 12 Minor находки многоосевого аудита фичи «под-блочные якоря» (DRY/консистентность/симметрия/корректность/тесты/границы), плюс закрыть 4 пробела тестов.

**Architecture:** FE-only правки в anchor-engine + шов text-anchor + адаптеры annotations + node_id round-trip (ast-editor/ast-render/ast-content-map). Один Important — реальный correctness-баг (rect-деградация → фантомная подсветка); второй — подъём дублированного SOT текст-листов в нейтральный foundation-слой. Остальное — уборка мёртвого кода, дедуп констант/хелперов, мемоизация, тесты.

**Tech Stack:** Next.js, React, ProseMirror/TipTap, TypeScript, Vitest, ESLint.

**Источник требований:** аудит-отчёт (workflow `wh6o2dgfw`, 19 подтверждённых находок, дедуп → 14). Каждая задача ссылается на находку(и).

## Global Constraints

- **FE-only.** `src/api/schema.ts` НЕ трогать (только читать тип `AstNodeType`).
- **ESLint запрещает `!` (non-null assertion)** — только `must()` / `?.`; `prefer-optional-chain` активен. Итерации `pnpm exec vitest run <path>`, но **перед коммитом каждой задачи прогнать `pnpm exec eslint <затронутые файлы>`** (урок Core SDD: `no-non-null-assertion` ловится только на финальном гейте).
- **kebab-case** для новых файлов в `src/`.
- **Параллельные агенты:** `git add <свои файлы по имени> && git commit --only <те же>`. НИКАКИХ `git add -A`, `git stash`, `git reset`, `git checkout .`, `git clean`. НЕ трогать чужие M-файлы (`src/api/schema.ts`, `src/features/forms/index.ts` — вне нашего объёма).
- **Поведение не менять**, кроме T1 (осознанный correctness-фикс) — там меняется резолв «мёртвого угла».
- Commit-месседжи на русском, conventional commits, с трейлером `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: I-1 — прямоугольный якорь с мёртвым углом → чистый орфан (не фантомная линейная подсветка)

**Находка (symmetry, Important):** rect-якорь пишет `exact = range.toString()` (линейный мусор через колонки). Резолв определяет rect только по `isCell(sL) && isCell(eL)`. Если одна угловая ячейка удалена (удалили строку/столбец) → `isCell(eL)=false` → падает в `rangeFromAnchor`, где гард `isCell(sL) && isCell(eL)` тоже не срабатывает → выполняется `searchQuote(root, junk-exact)` по всему документу → якорь может «прилипнуть» к несвязанной прозе. Нарушает спеку Phase 2 («мёртвый угол → null → орфан»).

**Files:**
- Modify: `src/components/anchor-engine/anchor-to-range.ts:71-78`
- Test: `src/components/anchor-engine/anchor-to-range.test.ts`

**Interfaces:**
- Consumes: `isCell(el: Element | null): boolean` (существует, `anchor-to-range.ts:13-15`), `leafEl(root, id)`.
- Produces: (без изменения сигнатур) — только семантика `rangeFromAnchor`/`resolveAnchor` для кросс-node якоря с ≥1 ячейкой.

- [ ] **Step 1: Написать падающий тест.** В `anchor-to-range.test.ts` добавить кейс: DOM с таблицей (2 ячейки одной строки, `data-node-id="c1"`/`"c2"`, `data-block-id="t1"` на table) И где-то ниже — обычный абзац, чьё содержимое СОВПАДАЕТ с junk-`exact` rect-якоря. Якорь: `{ startBlockId:"t1", endBlockId:"t1", startNodeId:"c1", endNodeId:"c2", startChar:0, endChar:2, exact:"<текст, который есть в том абзаце>" }`. Удалить из DOM ячейку `c2` (или не рендерить её). Ассерт: `resolveAnchor(anchor, root)` === `null` (чистый орфан, НЕ range на постороннем абзаце). Ключ: `exact` обязан встречаться в постороннем абзаце — иначе тест зелёный и на старом коде (как существующий dead-corner тест).

- [ ] **Step 2: Запустить — убедиться, что падает.** `pnpm exec vitest run src/components/anchor-engine/anchor-to-range.test.ts`. Ожидание: FAIL — старый код возвращает range на посторонний абзац, а не null.

- [ ] **Step 3: Фикс.** В `rangeFromAnchor` заменить гард (строки 72-78) на:

```ts
export function rangeFromAnchor(a: TextAnchor, root: HTMLElement): Range | null {
  // Кросс-node якорь, у которого ХОТЯ БЫ ОДИН конец — ячейка таблицы, не имеет
  // валидного ЛИНЕЙНОГО резолва: прямоугольный кейс (обе ячейки одной таблицы)
  // обрабатывается выше в resolveAnchor; всё остальное с участием ячейки (мёртвый
  // угол, ячейка+проза) → чистый орфан. Симметрично капчуру (anchor-from-selection
  // правило 4). БЕЗ этого гарда мёртвый угол уходил бы в searchQuote(root) по
  // junk-exact (range.toString() через колонки) и мог фантомно совпасть с
  // несвязанной прозой. anchors.md правило 4.
  if (a.startNodeId !== a.endNodeId) {
    const sL = leafEl(root, a.startNodeId), eL = leafEl(root, a.endNodeId);
    if (isCell(sL) || isCell(eL)) return null;
  }
  // 1) Быстрый путь: офсеты внутри листа + сверка exact.
  const exact = tryExact(a, root);
  // …остальное без изменений…
```

(Единственное изменение логики — `isCell(sL) && isCell(eL)` → `isCell(sL) || isCell(eL)`; плюс переписан устаревший «Phase 1 / ДОЛГ Phase 2» комментарий — закрывает Minor-находки о стейл-комментарии в этом блоке.)

- [ ] **Step 4: Запустить весь файл тестов — зелёный.** `pnpm exec vitest run src/components/anchor-engine/anchor-to-range.test.ts`. Существующий dead-corner тест (`exact:"aabb"`) остаётся зелёным (теперь по правильной причине: `isCell(sL)` alive → null сразу). Новый — зелёный.

- [ ] **Step 5: Lint + commit.** `pnpm exec eslint src/components/anchor-engine/anchor-to-range.ts src/components/anchor-engine/anchor-to-range.test.ts`, затем:
```bash
git add src/components/anchor-engine/anchor-to-range.ts src/components/anchor-engine/anchor-to-range.test.ts
git commit --only src/components/anchor-engine/anchor-to-range.ts src/components/anchor-engine/anchor-to-range.test.ts -m "fix(anchor): мёртвый угол rect-якоря → чистый орфан, не фантомная подсветка"
```

---

### Task 2: Удалить мёртвый хит-тест `noteAtPoint`/`noteContainingCaret` + стейл-комменты

**Находки (consistency/symmetry/boundaries, Minor ×3 → одна уборка):** прод-хит-тест целиком на `noteAtPointInGeometry` (`use-text-click.ts:27`, `use-hover-reveal.ts:38`). `noteAtPoint` (`hit-test.ts:43`) — 0 вызовов где-либо. `noteContainingCaret` (`hit-test.ts:11`) — только в `hit-test.test.ts` и внутри мёртвого `noteAtPoint`; rect-слепа. Комментарий `use-text-click.ts:4-6` «эквивалентно noteAtPoint» отсылает к мёртвой функции. Docstring `noteAtPointInGeometry` «Заменяет noteAtPointInRanges» — остаток рефактора (`noteAtPointInRanges` не существует).

**Files:**
- Modify: `src/components/anchor-engine/hit-test.ts` (удалить `noteContainingCaret` строки 10-19 и `noteAtPoint` строки 42-47; оставить `CaretPos`, `caretFromPoint`, `pointInRect`, `noteAtPointInGeometry`; переписать его docstring)
- Modify: `src/components/anchor-engine/hit-test.test.ts` (удалить тесты `noteContainingCaret`; оставить/сохранить тесты `noteAtPointInGeometry` и `pointInRect`)
- Modify: `src/components/anchor-engine/use-text-click.ts:4-6` (переписать стейл-комментарий)
- Check: `caretFromPoint` — после удаления `noteAtPoint` она остаётся используемой только `noteAtPointInGeometry` (строка 66). Убедиться, что не стала мёртвой (она НЕ мёртвая — жива).

**Interfaces:**
- Consumes: ничего нового.
- Produces: `hit-test.ts` экспортирует только `noteAtPointInGeometry` (+ типы `CaretPos`). `noteAtPoint`/`noteContainingCaret` больше не существуют.

- [ ] **Step 1: Grep-подтверждение мёртвости.** `grep -rn "noteAtPoint\b\|noteContainingCaret" src` — убедиться, что вне `hit-test.ts`/`hit-test.test.ts`/комментариев ссылок нет. Если найдётся прод-ссылка — СТОП, эскалировать (находка была бы неверна).

- [ ] **Step 2: Удалить `noteContainingCaret` (hit-test.ts:10-19) и `noteAtPoint` (hit-test.ts:42-47).** `rangeFromAnchor` больше не импортируется в `hit-test.ts` — удалить импорт `import { rangeFromAnchor } from "./anchor-to-range";` (строка 2), если он больше не нужен (после удаления обеих функций — не нужен).

- [ ] **Step 3: Переписать docstring `noteAtPointInGeometry` (hit-test.ts:53-59)** — убрать «эквивалентно noteAtPoint» и «Заменяет noteAtPointInRanges». Новый текст: хит-тест по УЖЕ ПОСЧИТАННЫМ geometries; range-kind → caret + comparePoint; rect-kind → point-in-boundingRect (caret не применим). Единственный хит-тест-контракт движка.

- [ ] **Step 4: Переписать комментарий use-text-click.ts:4-6** — убрать «эквивалентно noteAtPoint, т.к. range-geometries строятся тем же rangeFromAnchor». Новый: хит-тест по готовым geometries (без пересчёта rangeFromAnchor на клик), kind-aware внутри `noteAtPointInGeometry`.

- [ ] **Step 5: Обновить hit-test.test.ts** — удалить тест(ы), вызывающие `noteContainingCaret` (строки ~14-27 по находке). Оставить покрытие `noteAtPointInGeometry` (rect + range ветки) и `pointInRect`. Если после удаления `pointInRect` где-то экспортировалась только для теста — оставить как есть (она internal).

- [ ] **Step 6: Тесты + lint.** `pnpm exec vitest run src/components/anchor-engine/hit-test.test.ts src/components/anchor-engine/use-text-click.test.tsx src/components/anchor-engine/use-hover-reveal.test.tsx` — зелёные. `pnpm exec eslint` на все 4 файла (проверить: нет unused-import `rangeFromAnchor`).

- [ ] **Step 7: Commit.**
```bash
git add src/components/anchor-engine/hit-test.ts src/components/anchor-engine/hit-test.test.ts src/components/anchor-engine/use-text-click.ts
git commit --only src/components/anchor-engine/hit-test.ts src/components/anchor-engine/hit-test.test.ts src/components/anchor-engine/use-text-click.ts -m "refactor(anchor): удалён мёртвый rect-слепой хит-тест noteAtPoint/noteContainingCaret + стейл-комменты"
```

---

### Task 3: DRY — единый type-guard `isCell` в table-grid.ts

**Находки (dry/consistency, Minor):** `isCell` определён дважды с разошедшимися сигнатурами: `anchor-from-selection.ts:11` (`HTMLElement`, без null-guard) и `anchor-to-range.ts:13` (`Element | null`, с `!!el`). Оба — правило 4. В `resolveAnchor:103` из-за не-type-guard стоит избыточный `&& sL && eL`.

**Files:**
- Modify: `src/components/anchor-engine/table-grid.ts` (добавить экспорт type-guard)
- Modify: `src/components/anchor-engine/anchor-from-selection.ts` (удалить локальный `isCell`, импортировать)
- Modify: `src/components/anchor-engine/anchor-to-range.ts` (удалить локальный `isCell`, импортировать; убрать избыточный `&& sL && eL`)
- Test: существующие `table-grid.test.ts`, `anchor-from-selection.test.ts`, `anchor-to-range.test.ts` (регресс)

**Interfaces:**
- Produces: `export function isCell(el: Element | null): el is HTMLTableCellElement` в `table-grid.ts`.
- Consumes: T1, T2 уже завершены (anchor-to-range.ts в актуальном состоянии).

- [ ] **Step 1: Добавить в `table-grid.ts` (после `ownRows` или рядом с `cellGridPos`):**
```ts
/** Type-guard: элемент — ячейка таблицы (TD/TH). null-толерантен. */
export function isCell(el: Element | null): el is HTMLTableCellElement {
  return !!el && (el.tagName === "TD" || el.tagName === "TH");
}
```

- [ ] **Step 2: `anchor-from-selection.ts`** — удалить локальный `isCell` (строки 11-13), добавить в импорт из `./table-grid`: `import { isCell } from "./table-grid";`. Вызовы `isCell(sLeaf)`/`isCell(eLeaf)` (`HTMLElement` подтип `Element` — совместимо) остаются.

- [ ] **Step 3: `anchor-to-range.ts`** — удалить локальный `isCell` (строки 13-15), добавить `isCell` в существующий импорт `import { boundingBoxOf, isCell, rectangleCells } from "./table-grid";`. В `resolveAnchor` (строка 103) убрать избыточный хвост: `if (isCell(sL) && isCell(eL))` — теперь type-guard сузит `sL`/`eL` до `HTMLTableCellElement`, `rectangleCells(sL, eL)` принимает `Element`, компилируется без `&& sL && eL`.

- [ ] **Step 4: Тесты + lint.** `pnpm exec vitest run src/components/anchor-engine/table-grid.test.ts src/components/anchor-engine/anchor-from-selection.test.ts src/components/anchor-engine/anchor-to-range.test.ts` — зелёные (поведение идентично). `pnpm exec eslint` на 3 файла + `table-grid.ts`.

- [ ] **Step 5: Commit.**
```bash
git add src/components/anchor-engine/table-grid.ts src/components/anchor-engine/anchor-from-selection.ts src/components/anchor-engine/anchor-to-range.ts
git commit --only src/components/anchor-engine/table-grid.ts src/components/anchor-engine/anchor-from-selection.ts src/components/anchor-engine/anchor-to-range.ts -m "refactor(anchor): единый type-guard isCell в table-grid (убран дубль + избыточный guard)"
```

---

### Task 4: DRY — общий breakpoint `WIDE`

**Находка (consistency, Minor):** `WIDE = "(min-width: 80rem)"` дублирован литералом в `connector-layer.tsx:17` и `margin-notes-column.tsx:36`. Оба слоя обязаны включаться синхронно (выноски рисуются, только когда колонка в wide-режиме).

**Files:**
- Create: `src/components/anchor-engine/breakpoints.ts`
- Modify: `src/components/anchor-engine/connector-layer.tsx:17`
- Modify: `src/components/anchor-engine/margin-notes-column.tsx:36`

**Interfaces:**
- Produces: `export const WIDE = "(min-width: 80rem)";` в `breakpoints.ts`.

- [ ] **Step 1: Создать `src/components/anchor-engine/breakpoints.ts`:**
```ts
// Единый порог раскрытия полей-маргиналий. Колонка карточек (margin-notes-column)
// и выноски-коннекторы (connector-layer) ОБЯЗАНЫ включаться синхронно: линии
// осмысленны только когда карточки спозиционированы абсолютно в wide-режиме.
export const WIDE = "(min-width: 80rem)";
```

- [ ] **Step 2: `connector-layer.tsx`** — удалить локальный `const WIDE = ...` (строка 17), добавить `import { WIDE } from "./breakpoints";`.

- [ ] **Step 3: `margin-notes-column.tsx`** — удалить локальный `const WIDE = ...` (строка 36), добавить `import { WIDE } from "./breakpoints";`.

- [ ] **Step 4: Тесты + lint.** `pnpm exec vitest run src/components/anchor-engine/connector-layer.test.tsx src/components/anchor-engine/margin-notes-column.test.tsx` — зелёные. `pnpm exec eslint` на 3 файла.

- [ ] **Step 5: Commit.**
```bash
git add src/components/anchor-engine/breakpoints.ts src/components/anchor-engine/connector-layer.tsx src/components/anchor-engine/margin-notes-column.tsx
git commit --only src/components/anchor-engine/breakpoints.ts src/components/anchor-engine/connector-layer.tsx src/components/anchor-engine/margin-notes-column.tsx -m "refactor(anchor): единый breakpoint WIDE для колонки и выносок"
```

---

### Task 5: hasAnyText учитывает node_id (media-гард)

**Находка (consistency, Minor):** `hasAnyText` (`annotations/anchor.ts:35-45`), которым `isValidMediaAnchor` отсеивает text-загрязнение, НЕ включает `start_node_id`/`end_node_id`, хотя `isValidTextAnchor` их требует. Media-якорь со случайным `start_node_id` (без прочих text-полей) пройдёт `isValidMediaAnchor`. Контракт: node_id — text-поле (anchors.md).

Находка #19 (unused barrel-exports `buildTextAnchor`/`isValidTextAnchor`/…) — **без правки кода**: заголовок `anchor.ts:7-12` уже документирует их как осознанный defensive-mirror бэкенда; remedy находки («пометить осознанным») уже выполнен. Зафиксировать в ledger как «resolved by existing doc».

**Files:**
- Modify: `src/features/annotations/anchor.ts:35-45`
- Test: `src/features/annotations/anchor.test.ts`

- [ ] **Step 1: Падающий тест.** В `anchor.test.ts` добавить: media-якорь `{ start_sec: 5, start_node_id: "n1" }` → `isValidMediaAnchor(a)` === `false` (node_id — text-загрязнение). Запустить → FAIL (сейчас `true`).

- [ ] **Step 2: Фикс `hasAnyText`** — добавить две дизъюнкции:
```ts
function hasAnyText(a: Anchor): boolean {
  return (
    !!a.start_block_id ||
    !!a.end_block_id ||
    !!a.start_node_id ||
    !!a.end_node_id ||
    (a.start_char ?? 0) !== 0 ||
    (a.end_char ?? 0) !== 0 ||
    !!a.exact ||
    !!a.prefix ||
    !!a.suffix
  );
}
```

- [ ] **Step 3: Тест зелёный + lint.** `pnpm exec vitest run src/features/annotations/anchor.test.ts`; `pnpm exec eslint src/features/annotations/anchor.ts src/features/annotations/anchor.test.ts`.

- [ ] **Step 4: Commit.**
```bash
git add src/features/annotations/anchor.ts src/features/annotations/anchor.test.ts
git commit --only src/features/annotations/anchor.ts src/features/annotations/anchor.test.ts -m "fix(annotations): node_id считается text-полем в media-гарде hasAnyText"
```

---

### Task 6: Мемоизация engineNotes в слое аннотаций (паритет со слоем комментариев)

**Находка (correctness, Minor):** `document-annotation-layer.tsx:74` собирает `engineNotes` инлайн `notes.flatMap(...)` без `useMemo` → новая идентичность каждый рендер → `useAnchorRanges` держит `notes` в deps recompute-эффекта → перерегистрация resize/ResizeObserver/fonts-listeners + форс-пересчёт геометрии на каждый рендер родителя (toggle подсветки, open/close композера). Слой комментариев (`document-comment-layer.tsx:60`) от этого защищён `useMemo([notes])` с явным комментом.

**Files:**
- Modify: `src/features/annotations/ui/document-annotation-layer.tsx` (импорт `useMemo`; обернуть `engineNotes`, `cardById`, `engineIds`, `ssrOnly`)

- [ ] **Step 1: Импорт.** Добавить `useMemo` в `import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";`.

- [ ] **Step 2: Обернуть построение (строки 74-80)** по образцу `document-comment-layer.tsx:60-68`:
```ts
  // Доменные ноты → движковые: только валидные text-range якоря. Мемоизация по
  // notes: MarginAnchorLayer держит notes в deps useAnchorRanges (иначе новая
  // идентичность каждый рендер → перерегистрация listeners + форс-пересчёт
  // геометрии). Паритет с document-comment-layer.
  const engineNotes: AnchoredNote[] = useMemo(
    () =>
      notes.flatMap((n) => {
        const engine = n.anchor ? toEngineAnchor(n.anchor) : null;
        return engine ? [{ id: n.id, anchor: engine }] : [];
      }),
    [notes],
  );
  const cardById = useMemo(() => new Map(notes.map((n) => [n.id, n.card])), [notes]);
  const engineIds = useMemo(() => new Set(engineNotes.map((n) => n.id)), [engineNotes]);
  const ssrOnly = useMemo(() => notes.filter((n) => !engineIds.has(n.id)), [notes, engineIds]);
```

- [ ] **Step 3: Тесты + lint.** Найти тест слоя (`document-annotation-layer.test.tsx`, если есть) и прогнать; иначе прогнать соседние annotations-тесты. `pnpm exec eslint src/features/annotations/ui/document-annotation-layer.tsx` — проверить `react-hooks/exhaustive-deps` чист.

- [ ] **Step 4: Commit.**
```bash
git add src/features/annotations/ui/document-annotation-layer.tsx
git commit --only src/features/annotations/ui/document-annotation-layer.tsx -m "perf(annotations): мемоизация engineNotes — стоп churn listeners/геометрии (паритет с комментами)"
```

---

### Task 7: I-2 — подъём `TEXT_LEAF_NODE_TYPES` в нейтральный ast-content-map (единый SOT)

**Находка (dry/boundaries, Important):** `text-leaf-types.ts` (в `ast-editor`) объявляет себя «ЕДИНЫЙ источник истины», но ESLint-граница `ast-render ↛ ast-editor` делает его недостижимым из read-слоя → `block-renderer.tsx:28-33` держит байт-в-байт копию `TEXT_LEAF_TYPES`. Тройная точка истины на инвариант адресуемости якоря (serializer запись id ↔ deserializer чтение id ↔ read-render навешивание data-node-id). Дрейф → тихий орфан для нового типа листа.

**Решение:** SOT живёт в нейтральном `@/components/ast-content-map` (импортят оба слоя — ast-editor и ast-render уже импортят оттуда). Типизировать `ReadonlySet<AstNodeType>` → компилятор ловит дрейф против schema.ts.

**Files:**
- Create: `src/components/ast-content-map/text-leaves.ts`
- Modify: `src/components/ast-content-map/index.ts` (реэкспорт)
- Delete: `src/components/ast-editor/text-leaf-types.ts`
- Modify: `src/components/ast-editor/serializer.ts:1` (импорт из ast-content-map)
- Modify: `src/components/ast-editor/deserializer.ts:2` (импорт из ast-content-map)
- Modify: `src/components/ast-render/block-renderer.tsx:4,28-33,55` (импорт из ast-content-map, удалить локальный Set)
- Create/Test: `src/components/ast-content-map/text-leaves.test.ts`

**Interfaces:**
- Produces: `export const TEXT_LEAF_NODE_TYPES: ReadonlySet<AstNodeType>` из `@/components/ast-content-map`.
- Consumes: `AstNodeType` из `./types`.

- [ ] **Step 1: Создать `src/components/ast-content-map/text-leaves.ts`:**
```ts
import type { AstNodeType } from "./types";

// Типы AST-узлов, несущих текстовый ЛИСТ с собственным node_id (sub-block anchor).
// ЕДИНЫЙ источник истины трёх точек round-trip адресуемости якоря:
//  - serializer: пишет node.id в data-block-id/JSON,
//  - deserializer: читает node.id обратно,
//  - read-render (block-renderer): навешивает data-node-id, по которому резолвер
//    ищет лист (anchor-to-range.leafEl).
// Живёт в нейтральном ast-content-map, т.к. ast-render НЕ импортит ast-editor
// (ESLint-граница). Дрейф любой из трёх точек → тихий орфан для типа листа.
// ReadonlySet<AstNodeType> → компилятор ловит рассинхрон с schema.ts.
export const TEXT_LEAF_NODE_TYPES: ReadonlySet<AstNodeType> = new Set<AstNodeType>([
  "paragraph",
  "heading",
  "code_block",
  "table_cell",
]);
```

- [ ] **Step 2: Реэкспорт из `index.ts`** — добавить строку: `export { TEXT_LEAF_NODE_TYPES } from "./text-leaves";`.

- [ ] **Step 3: Тест `src/components/ast-content-map/text-leaves.test.ts`** — зафиксировать состав и что все члены — известные листовые типы карты (защита от дрейфа): проверить, что set содержит ровно `paragraph/heading/code_block/table_cell`, и что каждый член присутствует как ключ в `NODE_MAP` (импортировать `NODE_MAP`). Ассерт на `size === 4` и на членство. Запустить → должен пройти.

- [ ] **Step 4: `serializer.ts`** — заменить `import { TEXT_LEAF_NODE_TYPES } from "./text-leaf-types";` на `import { TEXT_LEAF_NODE_TYPES } from "@/components/ast-content-map";`.

- [ ] **Step 5: `deserializer.ts`** — та же замена импорта.

- [ ] **Step 6: `block-renderer.tsx`** — удалить локальный `const TEXT_LEAF_TYPES = new Set<AstNodeType>([...])` (строки 28-33); импортировать `TEXT_LEAF_NODE_TYPES` из `@/components/ast-content-map` (дополнить существующий импорт строки 4); в `applyIdentity` (строка 55) заменить `TEXT_LEAF_TYPES.has(block.type)` на `TEXT_LEAF_NODE_TYPES.has(block.type)`.

- [ ] **Step 7: Удалить `src/components/ast-editor/text-leaf-types.ts`** (`git rm`). Grep `grep -rn "text-leaf-types" src` → 0 ссылок.

- [ ] **Step 8: Тесты + lint.** `pnpm exec vitest run src/components/ast-content-map/ src/components/ast-editor/ src/components/ast-render/` — зелёные (serializer/deserializer round-trip, block-renderer identity, новый text-leaves). `pnpm exec eslint` на все затронутые + проверить, что ESLint-граница не нарушена (импорт из ast-content-map разрешён обоим слоям).

- [ ] **Step 9: Commit.**
```bash
git add src/components/ast-content-map/text-leaves.ts src/components/ast-content-map/text-leaves.test.ts src/components/ast-content-map/index.ts src/components/ast-editor/serializer.ts src/components/ast-editor/deserializer.ts src/components/ast-render/block-renderer.tsx
git rm src/components/ast-editor/text-leaf-types.ts
git commit --only src/components/ast-content-map/text-leaves.ts src/components/ast-content-map/text-leaves.test.ts src/components/ast-content-map/index.ts src/components/ast-editor/serializer.ts src/components/ast-editor/deserializer.ts src/components/ast-render/block-renderer.tsx src/components/ast-editor/text-leaf-types.ts -m "refactor(ast): единый SOT TEXT_LEAF_NODE_TYPES в ast-content-map (устранён тройной дубль)"
```

---

### Task 8: Закрыть 4 пробела тестов (test-only)

**Находки (tests, Minor ×4):** (a) rect center-attach через `ConnectorLayer` не тестируется (все тесты шлют `rectIds={new Set()}`); (b) клик по rect-kind через `useTextClick` не покрыт (только range); (c) `highlight-overlay` (scroll-offset, active-флаг) и `use-anchor-highlights` (enabled=false→clear) без юнит-тестов; (d) round-trip node_id в редакторном DOM ячейки не зафиксирован.

**Files:**
- Modify: `src/components/anchor-engine/connector-layer.test.tsx`
- Modify: `src/components/anchor-engine/use-text-click.test.tsx`
- Create: `src/components/anchor-engine/highlight-overlay.test.tsx`
- Create: `src/components/anchor-engine/use-anchor-highlights.test.ts`
- Modify: `src/components/ast-editor/extensions/round-trip-overlays.test.ts`

- [ ] **Step 1: connector-layer rect center-attach.** В `connector-layer.test.tsx` добавить кейс: `rectIds={new Set(["a"])}`, замокать `getAnchorRect("a")` → `DOMRect(x, top, w, H)` с большой `H` (>48). Ассерт: y-точка крепления выноски = `top + H/2` (центр bbox), НЕ `top + min(H,24)/2` (line-clamp). Проверять через сгенерированный `path`/координату так же, как существующие тесты слоя измеряют геометрию.

- [ ] **Step 2: use-text-click rect-kind.** В `use-text-click.test.tsx` добавить кейс с `geometries`, содержащей `kind:"rect"` (`boundingRect`, покрывающий точку клика). Клик внутри bbox → `onPick(id)` вызван. Rect-ветка не требует caret-стаба.

- [ ] **Step 3: highlight-overlay.test.tsx.** Замокать `window.scrollX`/`scrollY` (напр. 100/200), передать `rects`/`activeRects`, отрендерить `HighlightOverlay`, проверить: (1) `top`/`left` элементов оверлея сдвинуты на scroll; (2) active-набор помечен (класс/атрибут active), persistent — нет. Оверлей порталится в `document.body` → `document.querySelector` (с line-scoped `eslint-disable testing-library/no-node-access` + причина). Восстановить scroll-моки в finally.

- [ ] **Step 4: use-anchor-highlights.test.ts.** Фейковый controller (`vi.fn()` на `apply`/`setActive`/`clear`). Кейсы: (1) `enabled=false` → `controller.clear()` вызван, `apply` — нет; (2) `persistentIds` с id, отсутствующим в `ranges` → отфильтрован (не в `apply`-аргументе); (3) `activeId` присутствует → `setActive(range)`; `activeId` null → `setActive(null)`. Образец стиля — `highlight-controller.test.ts`.

- [ ] **Step 5: round-trip cell node_id (editor-DOM контракт).** В `round-trip-overlays.test.ts` добавить кейс, фиксирующий текущее НАМЕРЕННОЕ поведение: в редакторном DOM `<td>` НЕ несёт `data-node-id` (капчур висит над read-рендером, не над редактором). Ассерт: сериализованный `<td>` не имеет `data-node-id`; при этом JSON round-trip (`getJSON → node.id`) для ячейки сохраняет id (если это уже покрыто соседним тестом — сослаться, не дублировать). Комментарий в тесте: «editor-cell id намеренно только в JSON; DOM-капчур ячейки — read-surface (block-renderer applyIdentity), не editor».

- [ ] **Step 6: Все новые/изменённые тесты зелёные + lint.** `pnpm exec vitest run <5 файлов>`; `pnpm exec eslint <5 файлов>` (следить за `!` и `no-node-access` — line-scoped disable с причиной).

- [ ] **Step 7: Commit.**
```bash
git add src/components/anchor-engine/connector-layer.test.tsx src/components/anchor-engine/use-text-click.test.tsx src/components/anchor-engine/highlight-overlay.test.tsx src/components/anchor-engine/use-anchor-highlights.test.ts src/components/ast-editor/extensions/round-trip-overlays.test.ts
git commit --only src/components/anchor-engine/connector-layer.test.tsx src/components/anchor-engine/use-text-click.test.tsx src/components/anchor-engine/highlight-overlay.test.tsx src/components/anchor-engine/use-anchor-highlights.test.ts src/components/ast-editor/extensions/round-trip-overlays.test.ts -m "test(anchor): закрыты пробелы — rect center-attach, rect-клик, overlay scroll/active, highlights-хук, editor-cell id"
```

---

## Финальный гейт (после всех задач, контроллер инлайн)

`pnpm lint && pnpm test && pnpm build` — всё зелёное. Затем финальное whole-branch ревью (Opus) диапазона задач, затем `finishing-a-development-branch`.

## Self-Review (проверено при написании)

- **Покрытие находок:** I-1→T1, I-2→T7; мёртвый код (3 оси)→T2; isCell dup→T3; WIDE→T4; hasAnyText→T5; notes-memo→T6; 4 теста→T8; #19 (unused exports)→T5 no-op (уже задокументировано). Все 14 различных находок закрыты.
- **Плейсхолдеры:** нет — код приведён для нетривиальных шагов, тестовые интенты конкретны.
- **Типы/сигнатуры:** `isCell` type-guard (T3) согласован с `rectangleCells(Element, Element)`; `TEXT_LEAF_NODE_TYPES: ReadonlySet<AstNodeType>` (T7) согласован с `.has(block.type)` в block-renderer и `.has(node.type)` в serializer.
- **Зависимости задач:** T1→T2→T3 последовательны на общих файлах; T4/T5/T6/T7 независимы; T8 последней. SDD исполняет последовательно → нет параллельных правок одного файла.
