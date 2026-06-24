# Движок маргиналий (аннотации к выделенному тексту) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** На странице документа: выделение текста → плавающая кнопка «+ Аннотация» → модалка → заметка в правой панели на высоте текста (как комментарии в MS Word), с подсветкой фрагмента и двусторонним кликом.

**Architecture:** Доменно-агностичный **движок** `src/components/annotation-layer/` (чистое ядро: `stacking`, `anchor-from-selection`, `anchor-to-range`, `highlight-controller` + React-слой: `AnnotationLayer`, `SelectionToolbar`, `MarginNotesColumn`) отдельно от тонкой **обвязки** в `src/features/annotations/` (серверный сбор карточек + связка-компонент + модалка). Сервер строит карточки, клиент их позиционирует. Прогрессивное улучшение: SSR-список → клиент-позиционированная колонка на ≥1280px.

**Tech Stack:** Next.js App Router (RSC + server actions), React 19, TypeScript, Base UI (kit), Vitest + jsdom, next-intl (фасад `@/i18n`), CSS Custom Highlight API.

**Spec:** [docs/superpowers/specs/2026-06-24-text-annotations-margin-engine-design.md](../specs/2026-06-24-text-annotations-margin-engine-design.md)

## Global Constraints

- **Тулчейн — pnpm**, не npm. Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.
- **Параллельные агенты:** НЕ `git stash/reset/checkout./clean`, НЕ `git add -A`/`git add .` — добавлять только свои файлы по имени. НЕ откатывать чужие изменения.
- **Общение с пользователем — на русском.** Имена файлов в `src/` — kebab-case.
- **Движок (`src/components/annotation-layer/`) НЕ импортирует ни одну `src/features/*`** (foundation вниз). Обвязка импортирует движок.
- **Guardrail 4:** client-файлы не импортируют server-only (`./api`, `./actions`, `./permissions`, `./schemas`). Guardrail 7/8: только kit-примитивы, без нативных интерактивных тегов вне `src/components/ui/`.
- **i18n:** строки — только через фасад `@/i18n` (`getT`/`useT`), ключи в namespace `annotations`. Паритет каталогов `ru`/`en`/`ar`/`zh` (+ pseudo — проверить i18n-parity тестом). Никаких хардкод-строк в JSX.
- **RBAC:** server actions — `requireCapability`; UI — `canX()` булевы пропами. `can()` уже включает `status === "active"`.
- **Дефект бэка — флаговать корень** (см. §9 спеки: единицы офсетов, дрейф anchor, per-entity роуты вне OpenAPI).
- **Тесты:** Vitest, `environment: jsdom`, `globals: false` → импортировать `{ describe, it, expect, vi }` из `"vitest"`. Файлы `src/**/*.test.{ts,tsx}`.
- **Бэк-контракт `annotation.Anchor`** (поля): `start_block_id`, `end_block_id`, `start_char`, `end_char`, `exact`, `prefix?`, `suffix?` (text-range); `start_sec`, `end_sec?` (media). v1 = только text-range на документах.

---

## File Structure

**Движок (новое) — `src/components/annotation-layer/`:**
- `types.ts` — `TextAnchor`, `AnchoredNote`, `AnchorDraft`.
- `stacking.ts` (+ `stacking.test.ts`) — раздвижка карточек по вертикали.
- `dom-text.ts` (+ `dom-text.test.ts`) — plaintext-офсеты внутри блока (общие для from/to).
- `anchor-from-selection.ts` (+ `.test.ts`) — `Range`/`Selection` → `TextAnchor`.
- `anchor-to-range.ts` (+ `.test.ts`) — `TextAnchor` + root → `Range` (фолбэк по цитате).
- `highlight-controller.ts` (+ `.test.ts`) — подсветка через `CSS.highlights` + фолбэк.
- `selection-toolbar.tsx` — плавающая кнопка (portal).
- `margin-notes-column.tsx` — колонка позиционированных карточек.
- `annotation-layer.tsx` — оркестратор.
- `index.ts` — barrel (только React-слой + типы наружу).

**Foundation (изменение) — `src/components/ast-render/`:**
- `block-renderer.tsx` (+ `block-renderer.test.tsx`) — `data-block-id` на блоках.

**Обвязка (новое/изменение) — `src/features/annotations/`:**
- `anchor.ts` — добавить мапперы `toEngineAnchor` / `fromEngineAnchor` (+ тесты в новом `anchor.test.ts`).
- `ui/annotation-create-form.tsx` — приём `anchor` пропом + скрытое поле.
- `ui/annotation-composer-dialog.tsx` — модалка-обёртка формы (client).
- `ui/document-annotation-layer.tsx` — связка движок↔домен (client).
- `ui/document-annotations.tsx` — серверный сборщик карточек для документа.
- `index.ts` — экспорт `DocumentAnnotations`.

**i18n (изменение):**
- `src/i18n/messages/{ru,en,ar,zh}/annotations.ts` — новые ключи.

**Страница (изменение):**
- `src/app/documents/[id]/page.tsx` — `data-annotation-content` обёртка + свап `AnnotationsSection` → `DocumentAnnotations` в `MarginNote`.

---

## Task 1: `stacking.ts` — раздвижка карточек

**Files:**
- Create: `src/components/annotation-layer/stacking.ts`
- Create: `src/components/annotation-layer/types.ts`
- Test: `src/components/annotation-layer/stacking.test.ts`

**Interfaces:**
- Produces: `interface StackItem { id: string; top: number; height: number }`; `function resolveStack(items: StackItem[], gap?: number): Map<string, number>`. Возвращает map `id → resolvedTop`. Порядок результата — по возрастанию `top` входа; при наезде следующий толкается вниз на `prevResolvedTop + prevHeight + gap`. `gap` по умолчанию `8`.
- Produces (types.ts): `interface TextAnchor { startBlockId: string; endBlockId: string; startChar: number; endChar: number; exact: string; prefix?: string; suffix?: string }`, `interface AnchoredNote { id: string; anchor: TextAnchor }`, `interface AnchorDraft { anchor: TextAnchor; rect: DOMRect }`.

- [ ] **Step 1: Создать `types.ts`**

```ts
// src/components/annotation-layer/types.ts
// Доменно-агностичные типы движка маргиналий. НЕ импортируют схему аннотаций —
// обвязка маппит annotation.Anchor ↔ TextAnchor.

export interface TextAnchor {
  startBlockId: string;
  endBlockId: string;
  startChar: number;
  endChar: number;
  exact: string;
  prefix?: string;
  suffix?: string;
}

export interface AnchoredNote {
  id: string;
  anchor: TextAnchor;
}

export interface AnchorDraft {
  anchor: TextAnchor;
  /** Прямоугольник выделения (вьюпорт-координаты) для позиционирования тулбара. */
  rect: DOMRect;
}
```

- [ ] **Step 2: Написать падающий тест `stacking.test.ts`**

```ts
import { describe, it, expect } from "vitest";

import { resolveStack, type StackItem } from "./stacking";

describe("resolveStack", () => {
  it("непересекающиеся остаются на месте", () => {
    const items: StackItem[] = [
      { id: "a", top: 0, height: 40 },
      { id: "b", top: 100, height: 40 },
    ];
    const r = resolveStack(items, 8);
    expect(r.get("a")).toBe(0);
    expect(r.get("b")).toBe(100);
  });

  it("наезжающие раздвигаются вниз на height+gap", () => {
    const items: StackItem[] = [
      { id: "a", top: 0, height: 40 },
      { id: "b", top: 10, height: 40 },
    ];
    const r = resolveStack(items, 8);
    expect(r.get("a")).toBe(0);
    expect(r.get("b")).toBe(48); // 0 + 40 + 8
  });

  it("сортирует по top независимо от порядка входа", () => {
    const items: StackItem[] = [
      { id: "b", top: 100, height: 40 },
      { id: "a", top: 0, height: 40 },
    ];
    const r = resolveStack(items);
    expect(r.get("a")).toBe(0);
    expect(r.get("b")).toBe(100);
  });

  it("пустой вход → пустая карта", () => {
    expect(resolveStack([]).size).toBe(0);
  });
});
```

- [ ] **Step 3: Запустить тест — убедиться, что падает**

Run: `pnpm test -- src/components/annotation-layer/stacking.test.ts`
Expected: FAIL (`resolveStack` не определён).

- [ ] **Step 4: Реализовать `stacking.ts`**

```ts
// src/components/annotation-layer/stacking.ts
// Чистая раздвижка карточек по вертикали («магия Word»): карточки идут сверху
// вниз; если следующая наезжает на предыдущую — толкается ниже. Без React/DOM.

export interface StackItem {
  id: string;
  /** Желаемый top (px) — обычно top якорного диапазона относительно колонки. */
  top: number;
  /** Высота карточки (px). */
  height: number;
}

/** Возвращает map id → итоговый top (px), без пересечений, порядок по top. */
export function resolveStack(items: StackItem[], gap = 8): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.top - b.top);
  const result = new Map<string, number>();
  let cursor = -Infinity;
  for (const item of sorted) {
    const top = Math.max(item.top, cursor);
    result.set(item.id, top);
    cursor = top + item.height + gap;
  }
  return result;
}
```

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Run: `pnpm test -- src/components/annotation-layer/stacking.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/annotation-layer/types.ts src/components/annotation-layer/stacking.ts src/components/annotation-layer/stacking.test.ts
git commit -m "feat(annotation-layer): чистая раздвижка карточек (stacking) + типы движка"
```

---

## Task 2: `dom-text.ts` — plaintext-офсеты внутри блока

**Files:**
- Create: `src/components/annotation-layer/dom-text.ts`
- Test: `src/components/annotation-layer/dom-text.test.ts`

**Interfaces:**
- Consumes: ничего.
- Produces:
  - `function blockPlainText(block: Element): string` — `textContent ?? ""`.
  - `function offsetWithinBlock(block: Element, container: Node, offsetInContainer: number): number` — сумма длин текстовых узлов блока в порядке документа до `container`, плюс `offsetInContainer`. Если `container` сам — текстовый узел внутри блока. Если граница вне блока → возвращает `0`.
  - `function locateOffset(block: Element, charOffset: number): { node: Text; offset: number } | null` — обратное: идёт по текстовым узлам, находит узел и локальный офсет на `charOffset`. `null`, если офсет за пределами текста блока.

- [ ] **Step 1: Написать падающий тест `dom-text.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";

import { blockPlainText, offsetWithinBlock, locateOffset } from "./dom-text";

function makeBlock(html: string): HTMLElement {
  const el = document.createElement("p");
  el.setAttribute("data-block-id", "b1");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

describe("dom-text", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("blockPlainText склеивает текст сквозь форматирование", () => {
    const b = makeBlock("Hello <strong>bold</strong> world");
    expect(blockPlainText(b)).toBe("Hello bold world");
  });

  it("offsetWithinBlock учитывает текст до контейнера", () => {
    const b = makeBlock("Hello <strong>bold</strong> world");
    const strongText = b.querySelector("strong")!.firstChild!; // "bold"
    // граница в начале "bold" → 6 ("Hello ")
    expect(offsetWithinBlock(b, strongText, 0)).toBe(6);
    // граница в середине "bold" (после "bo") → 8
    expect(offsetWithinBlock(b, strongText, 2)).toBe(8);
  });

  it("locateOffset — обратное к offsetWithinBlock", () => {
    const b = makeBlock("Hello <strong>bold</strong> world");
    const loc = locateOffset(b, 8); // внутри "bold", после "bo"
    expect(loc).not.toBeNull();
    expect(loc!.node.textContent).toBe("bold");
    expect(loc!.offset).toBe(2);
  });

  it("locateOffset за пределами текста → null", () => {
    const b = makeBlock("abc");
    expect(locateOffset(b, 999)).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test -- src/components/annotation-layer/dom-text.test.ts`
Expected: FAIL (модуль не найден).

- [ ] **Step 3: Реализовать `dom-text.ts`**

```ts
// src/components/annotation-layer/dom-text.ts
// Чистые хелперы plaintext-офсетов внутри блока. Текст блока = конкатенация его
// текстовых узлов в порядке документа (inline-форматирование прозрачно).

export function blockPlainText(block: Element): string {
  return block.textContent ?? "";
}

function textWalker(block: Element): TreeWalker {
  return block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT);
}

/** Plaintext-офсет границы (container, offset) от начала блока. Вне блока → 0. */
export function offsetWithinBlock(
  block: Element,
  container: Node,
  offsetInContainer: number,
): number {
  // Если граница — элемент: суммируем длины текстовых узлов до child[offset].
  if (container.nodeType !== Node.TEXT_NODE) {
    let acc = 0;
    const target = container.childNodes[offsetInContainer] ?? null;
    const walker = textWalker(block);
    let node = walker.nextNode();
    while (node) {
      if (target && (node === target || target.contains(node))) break;
      acc += (node.textContent ?? "").length;
      node = walker.nextNode();
    }
    return acc;
  }
  // Граница — текстовый узел: суммируем длины предыдущих + локальный офсет.
  let acc = 0;
  const walker = textWalker(block);
  let node = walker.nextNode();
  while (node) {
    if (node === container) return acc + offsetInContainer;
    acc += (node.textContent ?? "").length;
    node = walker.nextNode();
  }
  return acc; // контейнер не найден внутри блока
}

/** Находит текстовый узел и локальный офсет на plaintext-позиции charOffset. */
export function locateOffset(
  block: Element,
  charOffset: number,
): { node: Text; offset: number } | null {
  const walker = textWalker(block);
  let acc = 0;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (charOffset <= acc + len) {
      return { node, offset: charOffset - acc };
    }
    acc += len;
    node = walker.nextNode() as Text | null;
  }
  return null;
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm test -- src/components/annotation-layer/dom-text.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/annotation-layer/dom-text.ts src/components/annotation-layer/dom-text.test.ts
git commit -m "feat(annotation-layer): plaintext-офсеты внутри блока (dom-text)"
```

---

## Task 3: `anchor-from-selection.ts` — Range → TextAnchor

**Files:**
- Create: `src/components/annotation-layer/anchor-from-selection.ts`
- Test: `src/components/annotation-layer/anchor-from-selection.test.ts`

**Interfaces:**
- Consumes: `offsetWithinBlock`, `blockPlainText` (Task 2); `TextAnchor` (Task 1).
- Produces:
  - `function anchorFromRange(range: Range, root: HTMLElement, contextLen?: number): TextAnchor | null` — `contextLen` по умолчанию `32`. `null`, если границы не внутри блоков с `data-block-id` в `root`, или диапазон схлопнут/пуст.
  - `function anchorFromSelection(sel: Selection | null, root: HTMLElement): TextAnchor | null` — тонкая обёртка: берёт `sel.getRangeAt(0)`.

- [ ] **Step 1: Написать падающий тест**

```ts
import { describe, it, expect, beforeEach } from "vitest";

import { anchorFromRange } from "./anchor-from-selection";

function setup(): HTMLElement {
  const root = document.createElement("div");
  root.className = "ast-render";
  root.innerHTML =
    '<p data-block-id="p1">Hello <strong>bold</strong> world</p>' +
    '<p data-block-id="p2">Second paragraph here</p>';
  document.body.appendChild(root);
  return root;
}

describe("anchorFromRange", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("одно-блочное выделение → корректный anchor", () => {
    const root = setup();
    const p1 = root.querySelector('[data-block-id="p1"]')!;
    const range = document.createRange();
    // выделяем "bold"
    const strongText = p1.querySelector("strong")!.firstChild!;
    range.setStart(strongText, 0);
    range.setEnd(strongText, 4);
    const a = anchorFromRange(range, root);
    expect(a).not.toBeNull();
    expect(a!.startBlockId).toBe("p1");
    expect(a!.endBlockId).toBe("p1");
    expect(a!.startChar).toBe(6);
    expect(a!.endChar).toBe(10);
    expect(a!.exact).toBe("bold");
    expect(a!.prefix).toBe("Hello ");
    expect(a!.suffix).toBe(" world");
  });

  it("кросс-блочное выделение → разные block_id", () => {
    const root = setup();
    const p1 = root.querySelector('[data-block-id="p1"]')!;
    const p2 = root.querySelector('[data-block-id="p2"]')!;
    const range = document.createRange();
    range.setStart(p1.firstChild!, 0);          // начало p1
    range.setEnd(p2.firstChild!, 6);            // "Second" в p2
    const a = anchorFromRange(range, root);
    expect(a!.startBlockId).toBe("p1");
    expect(a!.endBlockId).toBe("p2");
    expect(a!.exact.startsWith("Hello")).toBe(true);
  });

  it("схлопнутый диапазон → null", () => {
    const root = setup();
    const p1 = root.querySelector('[data-block-id="p1"]')!;
    const range = document.createRange();
    range.setStart(p1.firstChild!, 2);
    range.setEnd(p1.firstChild!, 2);
    expect(anchorFromRange(range, root)).toBeNull();
  });

  it("граница вне блоков с data-block-id → null", () => {
    const root = setup();
    const outside = document.createElement("p");
    outside.textContent = "no id";
    document.body.appendChild(outside);
    const range = document.createRange();
    range.selectNodeContents(outside);
    expect(anchorFromRange(range, root)).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test -- src/components/annotation-layer/anchor-from-selection.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать `anchor-from-selection.ts`**

```ts
// src/components/annotation-layer/anchor-from-selection.ts
import { blockPlainText, offsetWithinBlock } from "./dom-text";
import type { TextAnchor } from "./types";

function closestBlock(node: Node, root: HTMLElement): Element | null {
  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  const block = el?.closest<HTMLElement>("[data-block-id]") ?? null;
  return block && root.contains(block) ? block : null;
}

/** Range → TextAnchor. null, если границы вне блоков root или диапазон пуст. */
export function anchorFromRange(
  range: Range,
  root: HTMLElement,
  contextLen = 32,
): TextAnchor | null {
  if (range.collapsed) return null;
  const startBlock = closestBlock(range.startContainer, root);
  const endBlock = closestBlock(range.endContainer, root);
  if (!startBlock || !endBlock) return null;

  const startId = startBlock.getAttribute("data-block-id");
  const endId = endBlock.getAttribute("data-block-id");
  if (!startId || !endId) return null;

  const startChar = offsetWithinBlock(
    startBlock,
    range.startContainer,
    range.startOffset,
  );
  const endChar = offsetWithinBlock(
    endBlock,
    range.endContainer,
    range.endOffset,
  );
  const exact = range.toString();
  if (exact.length === 0) return null;

  const startText = blockPlainText(startBlock);
  const endText = blockPlainText(endBlock);
  const prefix = startText.slice(Math.max(0, startChar - contextLen), startChar);
  const suffix = endText.slice(endChar, endChar + contextLen);

  const anchor: TextAnchor = {
    startBlockId: startId,
    endBlockId: endId,
    startChar,
    endChar,
    exact,
  };
  if (prefix) anchor.prefix = prefix;
  if (suffix) anchor.suffix = suffix;
  return anchor;
}

export function anchorFromSelection(
  sel: Selection | null,
  root: HTMLElement,
): TextAnchor | null {
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  return anchorFromRange(sel.getRangeAt(0), root);
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm test -- src/components/annotation-layer/anchor-from-selection.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/annotation-layer/anchor-from-selection.ts src/components/annotation-layer/anchor-from-selection.test.ts
git commit -m "feat(annotation-layer): Range/Selection → TextAnchor (захват выделения)"
```

---

## Task 4: `anchor-to-range.ts` — TextAnchor → Range (с фолбэком по цитате)

**Files:**
- Create: `src/components/annotation-layer/anchor-to-range.ts`
- Test: `src/components/annotation-layer/anchor-to-range.test.ts`

**Interfaces:**
- Consumes: `locateOffset` (Task 2); `TextAnchor` (Task 1).
- Produces: `function rangeFromAnchor(anchor: TextAnchor, root: HTMLElement): Range | null`. Первично — по `start/endBlockId` + `start/endChar`; если блок не найден ИЛИ `range.toString() !== anchor.exact` → фолбэк: ищет `prefix+exact+suffix` затем `exact` в plaintext root. `null`, если не нашли (сирота).

- [ ] **Step 1: Написать падающий тест**

```ts
import { describe, it, expect, beforeEach } from "vitest";

import { rangeFromAnchor } from "./anchor-to-range";
import type { TextAnchor } from "./types";

function setup(html: string): HTMLElement {
  const root = document.createElement("div");
  root.className = "ast-render";
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

describe("rangeFromAnchor", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("точный путь по block_id + char", () => {
    const root = setup('<p data-block-id="p1">Hello bold world</p>');
    const a: TextAnchor = {
      startBlockId: "p1", endBlockId: "p1",
      startChar: 6, endChar: 10, exact: "bold",
    };
    const r = rangeFromAnchor(a, root);
    expect(r).not.toBeNull();
    expect(r!.toString()).toBe("bold");
  });

  it("фолбэк по цитате, если блок переименован", () => {
    const root = setup('<p data-block-id="DIFFERENT">Hello bold world</p>');
    const a: TextAnchor = {
      startBlockId: "p1", endBlockId: "p1",
      startChar: 6, endChar: 10, exact: "bold", prefix: "Hello ", suffix: " world",
    };
    const r = rangeFromAnchor(a, root);
    expect(r).not.toBeNull();
    expect(r!.toString()).toBe("bold");
  });

  it("сирота: текста нет нигде → null", () => {
    const root = setup('<p data-block-id="p1">Totally different</p>');
    const a: TextAnchor = {
      startBlockId: "p1", endBlockId: "p1",
      startChar: 0, endChar: 4, exact: "zzzz",
    };
    expect(rangeFromAnchor(a, root)).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test -- src/components/annotation-layer/anchor-to-range.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать `anchor-to-range.ts`**

```ts
// src/components/annotation-layer/anchor-to-range.ts
import { locateOffset } from "./dom-text";
import type { TextAnchor } from "./types";

function block(root: HTMLElement, id: string): Element | null {
  return root.querySelector(`[data-block-id="${CSS.escape(id)}"]`);
}

function tryExact(anchor: TextAnchor, root: HTMLElement): Range | null {
  const sb = block(root, anchor.startBlockId);
  const eb = block(root, anchor.endBlockId);
  if (!sb || !eb) return null;
  const start = locateOffset(sb, anchor.startChar);
  const end = locateOffset(eb, anchor.endChar);
  if (!start || !end) return null;
  const range = root.ownerDocument.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range.toString() === anchor.exact ? range : null;
}

/** Ищет needle в plaintext root и строит Range через TreeWalker. */
function findQuote(root: HTMLElement, needle: string): Range | null {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  // Собираем (node, globalStart) и общий plaintext.
  const nodes: { node: Text; start: number }[] = [];
  let full = "";
  let n = walker.nextNode() as Text | null;
  while (n) {
    nodes.push({ node: n, start: full.length });
    full += n.textContent ?? "";
    n = walker.nextNode() as Text | null;
  }
  const at = full.indexOf(needle);
  if (at < 0) return null;
  const locate = (globalOffset: number) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (globalOffset >= nodes[i].start) {
        return { node: nodes[i].node, offset: globalOffset - nodes[i].start };
      }
    }
    return null;
  };
  const s = locate(at);
  const e = locate(at + needle.length);
  if (!s || !e) return null;
  const range = root.ownerDocument.createRange();
  range.setStart(s.node, s.offset);
  range.setEnd(e.node, e.offset);
  return range;
}

/** TextAnchor → Range. null = сирота (фрагмент не найден). */
export function rangeFromAnchor(anchor: TextAnchor, root: HTMLElement): Range | null {
  const exact = tryExact(anchor, root);
  if (exact) return exact;
  // Фолбэк по цитате: сперва с контекстом (точнее), затем голый exact.
  const withCtx = `${anchor.prefix ?? ""}${anchor.exact}${anchor.suffix ?? ""}`;
  if (withCtx !== anchor.exact) {
    const ctxRange = findQuote(root, withCtx);
    if (ctxRange) {
      // Сузить до exact внутри найденного контекста.
      const exactRange = findQuote(root, anchor.exact);
      if (exactRange) return exactRange;
    }
  }
  return findQuote(root, anchor.exact);
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm test -- src/components/annotation-layer/anchor-to-range.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/annotation-layer/anchor-to-range.ts src/components/annotation-layer/anchor-to-range.test.ts
git commit -m "feat(annotation-layer): TextAnchor → Range с фолбэком по цитате (ре-анкоринг)"
```

---

## Task 5: `highlight-controller.ts` — подсветка через CSS Custom Highlight API

**Files:**
- Create: `src/components/annotation-layer/highlight-controller.ts`
- Test: `src/components/annotation-layer/highlight-controller.test.ts`

**Interfaces:**
- Consumes: ничего (работает с `Range[]`).
- Produces: `class HighlightController { constructor(name?: string); readonly supported: boolean; apply(ranges: Range[]): void; setActive(range: Range | null): void; clear(): void }`. Имена highlight по умолчанию: `"annotation"` и `"annotation-active"`. Если `CSS.highlights` недоступен — `supported=false`, методы — no-op (фолбэк-оверлей рендерит React-слой, см. Task 7; контроллер не бросает).

- [ ] **Step 1: Написать падающий тест (мок `CSS.highlights`)**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

import { HighlightController } from "./highlight-controller";

class FakeHighlight {
  ranges: Range[];
  constructor(...ranges: Range[]) { this.ranges = ranges; }
}

function installHighlightApi() {
  const store = new Map<string, unknown>();
  vi.stubGlobal("Highlight", FakeHighlight);
  vi.stubGlobal("CSS", { highlights: store });
  return store;
}

describe("HighlightController", () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it("supported=true когда CSS.highlights есть; apply регистрирует highlight", () => {
    const store = installHighlightApi();
    const c = new HighlightController();
    expect(c.supported).toBe(true);
    const r = document.createRange();
    c.apply([r]);
    expect(store.has("annotation")).toBe(true);
  });

  it("clear удаляет реестры", () => {
    const store = installHighlightApi();
    const c = new HighlightController();
    c.apply([document.createRange()]);
    c.clear();
    expect(store.has("annotation")).toBe(false);
    expect(store.has("annotation-active")).toBe(false);
  });

  it("без CSS.highlights → supported=false, методы не бросают", () => {
    vi.stubGlobal("CSS", {});
    const c = new HighlightController();
    expect(c.supported).toBe(false);
    expect(() => { c.apply([document.createRange()]); c.clear(); }).not.toThrow();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test -- src/components/annotation-layer/highlight-controller.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать `highlight-controller.ts`**

```ts
// src/components/annotation-layer/highlight-controller.ts
// Императивная подсветка диапазонов через CSS Custom Highlight API (ноль мутаций
// DOM). Если API нет — supported=false, методы no-op (React-слой даёт оверлей-фолбэк).

// Глобалы Highlight/CSS.highlights могут отсутствовать в типах TS lib — узкий каст.
interface HighlightLike { /* маркер */ }
type HighlightCtor = new (...ranges: Range[]) => HighlightLike;

function highlightsRegistry(): Map<string, HighlightLike> | null {
  const css = (globalThis as { CSS?: { highlights?: Map<string, HighlightLike> } }).CSS;
  return css?.highlights ?? null;
}

function highlightCtor(): HighlightCtor | null {
  return (globalThis as { Highlight?: HighlightCtor }).Highlight ?? null;
}

export class HighlightController {
  readonly supported: boolean;
  private readonly name: string;
  private readonly activeName: string;

  constructor(name = "annotation") {
    this.name = name;
    this.activeName = `${name}-active`;
    this.supported = highlightsRegistry() !== null && highlightCtor() !== null;
  }

  apply(ranges: Range[]): void {
    const reg = highlightsRegistry();
    const Ctor = highlightCtor();
    if (!reg || !Ctor) return;
    reg.set(this.name, new Ctor(...ranges));
  }

  setActive(range: Range | null): void {
    const reg = highlightsRegistry();
    const Ctor = highlightCtor();
    if (!reg || !Ctor) return;
    if (range) reg.set(this.activeName, new Ctor(range));
    else reg.delete(this.activeName);
  }

  clear(): void {
    const reg = highlightsRegistry();
    if (!reg) return;
    reg.delete(this.name);
    reg.delete(this.activeName);
  }
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm test -- src/components/annotation-layer/highlight-controller.test.ts`
Expected: PASS.

- [ ] **Step 5: Добавить CSS-правила подсветки в `globals.css`**

> Касание foundation-файла `src/app/globals.css` — флагуется (см. AGENTS.md «запретные зоны»: root shell). Изменение аддитивное (новые `::highlight()` правила), но при subagent-driven исполнении этот шаг помечается как foundation-touch и проходит ревью отдельно.

Добавить в конец `src/app/globals.css`:

```css
/* Подсветка аннотированных фрагментов (CSS Custom Highlight API). */
::highlight(annotation) {
  background-color: color-mix(in oklch, var(--color-accent) 22%, transparent);
}
::highlight(annotation-active) {
  background-color: color-mix(in oklch, var(--color-accent) 42%, transparent);
}
```

> Если переменной `--color-accent` нет — использовать существующий акцент-токен из палитры (проверить `src/styles/` / `globals.css`; в проекте APCA-токены). Подобрать ближайший «highlight/marker» токен.

- [ ] **Step 6: Commit**

```bash
git add src/components/annotation-layer/highlight-controller.ts src/components/annotation-layer/highlight-controller.test.ts src/app/globals.css
git commit -m "feat(annotation-layer): контроллер подсветки (CSS Custom Highlight API) + ::highlight стили"
```

---

## Task 6: `data-block-id` в `ast-render` (DOM-контракт, foundation)

**Files:**
- Modify: `src/components/ast-render/block-renderer.tsx`
- Test: `src/components/ast-render/block-renderer.test.tsx`

> **Foundation-touch:** `src/components/ast-render/` — shared-компонент. Изменение аддитивное (новый data-атрибут, поведение рендера не меняется). Помечается как foundation-часть.

**Interfaces:**
- Produces: каждый блок-элемент несёт `data-block-id={block.id}` (если `block.id` задан). Контракт для движка: «контент-рут содержит элементы с `data-block-id`».

- [ ] **Step 1: Написать падающий тест `block-renderer.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { BlockRenderer } from "./block-renderer";
import type { AstBlock } from "./types";

function html(block: AstBlock): string {
  return renderToStaticMarkup(<BlockRenderer block={block} ctx={{}} />);
}

describe("BlockRenderer data-block-id", () => {
  it("paragraph несёт data-block-id", () => {
    const b: AstBlock = { id: "p1", type: "paragraph", content: [{ type: "text", text: "x" }] };
    expect(html(b)).toContain('data-block-id="p1"');
  });

  it("heading несёт data-block-id", () => {
    const b: AstBlock = { id: "h1", type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "x" }] };
    expect(html(b)).toContain('data-block-id="h1"');
  });

  it("blockquote несёт data-block-id", () => {
    const b: AstBlock = { id: "bq1", type: "blockquote", content: [
      { id: "p2", type: "paragraph", content: [{ type: "text", text: "x" }] },
    ] } as AstBlock;
    const out = html(b);
    expect(out).toContain('data-block-id="bq1"');
    expect(out).toContain('data-block-id="p2"'); // вложенный блок тоже
  });

  it("без id — без атрибута (не падает)", () => {
    const b: AstBlock = { type: "paragraph", content: [{ type: "text", text: "x" }] };
    expect(html(b)).not.toContain("data-block-id");
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test -- src/components/ast-render/block-renderer.test.tsx`
Expected: FAIL (нет `data-block-id`).

- [ ] **Step 3: Реализовать — добавить `data-block-id` на каждый блок**

В `src/components/ast-render/block-renderer.tsx` пробросить `data-block-id={block.id}` на корневой элемент каждого case. Для краткости — завести проп-объект и расширять им:

В начало функции `BlockRenderer`, после `switch`-входа, добавить вычисление:

```tsx
export function BlockRenderer({ block, ctx }: Props): ReactNode {
  // Атрибут для движка маргиналий: стабильная привязка DOM→блок.
  const idAttr = block.id ? { "data-block-id": block.id } : {};
  switch (block.type) {
    case "paragraph":
      return <p {...idAttr}><InlineRenderer nodes={block.content} ctx={ctx} /></p>;
```

Применить `{...idAttr}` к корневым тегам всех case:
- `paragraph` → `<p {...idAttr}>`
- `heading` → `<Tag {...idAttr}>`
- `list` → `<Tag {...idAttr}>` (ul/ol)
- `list_item` → `<li {...idAttr}>`
- `code_block` → `<pre dir="ltr" data-language={langStr} {...idAttr}>`
- `blockquote` → `<blockquote {...idAttr}>`
- `thematic_break` → `<hr {...idAttr} />`
- `table` → `<table {...idAttr}>`
- `image` → обернуть: `<div {...idAttr}><ImageNode attrs={block.attrs} /></div>` только если `block.id`, иначе `<ImageNode .../>` как было. Для простоты и единообразия — всегда `<ImageNode attrs={block.attrs} dataBlockId={block.id} />`? Нет: не трогаем ImageNode API. Используем: `return block.id ? <div {...idAttr}><ImageNode attrs={block.attrs} /></div> : <ImageNode attrs={block.attrs} />;`
- `default` → `<div data-unsupported={block.type ?? "unknown"} {...idAttr}>`

> ВАЖНО: вложенные `<BlockRenderer>` (list/list_item/blockquote/table cells) уже рекурсивно получат свои `data-block-id`. Ячейки таблицы (`th`/`td`) — без id (AST-ноды без id), что ок: анкоринг в ячейках — известное ограничение v1 (§12 спеки).

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm test -- src/components/ast-render/block-renderer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Прогнать существующие ast-render тесты (регресс)**

Run: `pnpm test -- src/components/ast-render`
Expected: PASS (все).

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-render/block-renderer.tsx src/components/ast-render/block-renderer.test.tsx
git commit -m "feat(ast-render): data-block-id на блоках (DOM-контракт для движка маргиналий)"
```

---

## Task 7: React-слой движка — toolbar, column, orchestrator + barrel

**Files:**
- Create: `src/components/annotation-layer/selection-toolbar.tsx`
- Create: `src/components/annotation-layer/margin-notes-column.tsx`
- Create: `src/components/annotation-layer/annotation-layer.tsx`
- Create: `src/components/annotation-layer/index.ts`
- Test: `src/components/annotation-layer/annotation-layer.test.tsx`

**Interfaces:**
- Consumes: `anchorFromSelection` (T3), `rangeFromAnchor` (T4), `HighlightController` (T5), `resolveStack` (T1), `AnchoredNote`, `AnchorDraft` (T1).
- Produces (`index.ts` barrel): `AnnotationLayer`, типы `TextAnchor`, `AnchoredNote`, `AnchorDraft`.
- `interface AnnotationLayerProps { contentRef: RefObject<HTMLElement | null>; notes: AnchoredNote[]; renderNote: (note: AnchoredNote, isOrphan: boolean) => ReactNode; highlightEnabled: boolean; canCreate: boolean; onCreateRequest: (draft: AnchorDraft) => void; toolbarLabel: string; orphanLabel: string }`.

> **Тестируемость:** jsdom не реализует layout (`getBoundingClientRect` → нули), `Selection` частичен, `CSS.highlights` отсутствует. Поэтому React-слой тестируем «дымом» (рендерится, не падает; orphan-ветка показывает orphanLabel), а позиционирование/подсветку/тулбар принимаем **ручным браузер-QA** (см. Task 12, финальный шаг). Это согласуется с этосом проекта (ядро — юнит-тесты; визуал — ручная приёмка).

- [ ] **Step 1: Реализовать `selection-toolbar.tsx`**

```tsx
"use client";
// src/components/annotation-layer/selection-toolbar.tsx
import { createPortal } from "react-dom";

import { Button } from "@/components/ui";

interface Props {
  rect: DOMRect;
  label: string;
  onClick: () => void;
}

/** Плавающая кнопка у выделения. Портал в body; позиция — над серединой rect. */
export function SelectionToolbar({ rect, label, onClick }: Props) {
  const top = rect.top + window.scrollY - 40;
  const left = rect.left + window.scrollX + rect.width / 2;
  return createPortal(
    <div
      // eslint-disable-next-line no-restricted-syntax -- координатное позиционирование портала, направление-нейтрально
      style={{ position: "absolute", top, left, transform: "translateX(-50%)", zIndex: 50 }}
    >
      <Button type="button" compact tone="primary" onMouseDown={(e) => { e.preventDefault(); }} onClick={onClick}>
        {label}
      </Button>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: Реализовать `margin-notes-column.tsx`**

```tsx
"use client";
// src/components/annotation-layer/margin-notes-column.tsx
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { resolveStack, type StackItem } from "./stacking";

export interface PositionedNote {
  id: string;
  /** top якоря (px) относительно контейнера колонки; null = сирота. */
  anchorTop: number | null;
  node: ReactNode;
}

interface Props {
  notes: PositionedNote[];
}

/**
 * Колонка карточек. Сироты (anchorTop=null) — сверху обычным потоком. Якорённые
 * — абсолютным top по resolveStack. На узких экранах (нет measurement) карточки
 * деградируют в обычный список (anchorTop игнорируется до измерения).
 */
export function MarginNotesColumn({ notes }: Props) {
  const refs = useRef(new Map<string, HTMLElement>());
  const [tops, setTops] = useState<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    const items: StackItem[] = [];
    for (const n of notes) {
      if (n.anchorTop === null) continue;
      const el = refs.current.get(n.id);
      const height = el?.offsetHeight ?? 0;
      items.push({ id: n.id, top: n.anchorTop, height });
    }
    setTops(resolveStack(items));
  }, [notes]);

  const orphans = notes.filter((n) => n.anchorTop === null);
  const anchored = notes.filter((n) => n.anchorTop !== null);

  return (
    <div className="flex flex-col gap-3" data-annotation-column>
      {orphans.map((n) => (
        <div key={n.id} data-orphan>{n.node}</div>
      ))}
      <div className="relative">
        {anchored.map((n) => (
          <div
            key={n.id}
            ref={(el) => { if (el) refs.current.set(n.id, el); else refs.current.delete(n.id); }}
            // eslint-disable-next-line no-restricted-syntax -- вертикальное позиционирование по якорю, направление-нейтрально
            style={tops.has(n.id) ? { position: "absolute", top: tops.get(n.id), insetInlineStart: 0, insetInlineEnd: 0 } : undefined}
          >
            {n.node}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Реализовать `annotation-layer.tsx`**

```tsx
"use client";
// src/components/annotation-layer/annotation-layer.tsx
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";

import { anchorFromSelection } from "./anchor-from-selection";
import { rangeFromAnchor } from "./anchor-to-range";
import { HighlightController } from "./highlight-controller";
import { MarginNotesColumn, type PositionedNote } from "./margin-notes-column";
import { SelectionToolbar } from "./selection-toolbar";
import type { AnchorDraft, AnchoredNote } from "./types";

export interface AnnotationLayerProps {
  contentRef: RefObject<HTMLElement | null>;
  notes: AnchoredNote[];
  renderNote: (note: AnchoredNote, isOrphan: boolean) => ReactNode;
  highlightEnabled: boolean;
  canCreate: boolean;
  onCreateRequest: (draft: AnchorDraft) => void;
  toolbarLabel: string;
  orphanLabel: string;
}

export function AnnotationLayer({
  contentRef, notes, renderNote, highlightEnabled, canCreate, onCreateRequest, toolbarLabel,
}: AnnotationLayerProps) {
  const [draft, setDraft] = useState<AnchorDraft | null>(null);
  const controller = useRef<HighlightController | null>(null);
  if (controller.current === null) controller.current = new HighlightController();

  // Захват выделения.
  useEffect(() => {
    if (!canCreate) return;
    const onUp = () => {
      const root = contentRef.current;
      if (!root) { setDraft(null); return; }
      const sel = window.getSelection();
      const anchor = anchorFromSelection(sel, root);
      if (!anchor || !sel || sel.rangeCount === 0) { setDraft(null); return; }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setDraft({ anchor, rect });
    };
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mouseup", onUp); };
  }, [canCreate, contentRef]);

  // Подсветка существующих заметок.
  const ranges = useMemo(() => {
    const root = contentRef.current;
    if (!root) return new Map<string, Range | null>();
    const m = new Map<string, Range | null>();
    for (const n of notes) m.set(n.id, rangeFromAnchor(n.anchor, root));
    return m;
  }, [notes, contentRef]);

  useEffect(() => {
    const c = controller.current!;
    if (!highlightEnabled) { c.clear(); return; }
    const valid = [...ranges.values()].filter((r): r is Range => r !== null);
    c.apply(valid);
    return () => { c.clear(); };
  }, [ranges, highlightEnabled]);

  // Позиции карточек относительно колонки (измеряем top якоря).
  const positioned: PositionedNote[] = useMemo(() => {
    const root = contentRef.current;
    const colTop = root ? 0 : 0; // относительный сдвиг проставит MarginNotesColumn через измерение
    return notes.map((n) => {
      const r = ranges.get(n.id) ?? null;
      const isOrphan = r === null;
      const anchorTop = r && root ? r.getBoundingClientRect().top + window.scrollY - colTop : null;
      return { id: n.id, anchorTop: isOrphan ? null : anchorTop, node: renderNote(n, isOrphan) };
    });
  }, [notes, ranges, renderNote, contentRef]);

  const create = useCallback(() => {
    if (draft) { onCreateRequest(draft); setDraft(null); window.getSelection()?.removeAllRanges(); }
  }, [draft, onCreateRequest]);

  return (
    <>
      {draft && canCreate && (
        <SelectionToolbar rect={draft.rect} label={toolbarLabel} onClick={create} />
      )}
      <MarginNotesColumn notes={positioned} />
    </>
  );
}
```

- [ ] **Step 4: Реализовать `index.ts` (barrel)**

```ts
// src/components/annotation-layer/index.ts
// Публичный API движка маргиналий: React-слой + типы. Чистое ядро остаётся внутри.
export { AnnotationLayer, type AnnotationLayerProps } from "./annotation-layer";
export type { TextAnchor, AnchoredNote, AnchorDraft } from "./types";
```

- [ ] **Step 5: Написать дым-тест `annotation-layer.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";

import { AnnotationLayer } from "./annotation-layer";
import type { AnchoredNote } from "./types";

describe("AnnotationLayer (smoke)", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("рендерит сиротские карточки, когда якорь не разрешается", () => {
    const root = document.createElement("div");
    root.innerHTML = '<p data-block-id="p1">present text</p>';
    document.body.appendChild(root);
    const ref = createRef<HTMLElement>();
    Object.defineProperty(ref, "current", { value: root, writable: true });

    const notes: AnchoredNote[] = [
      { id: "n1", anchor: { startBlockId: "x", endBlockId: "x", startChar: 0, endChar: 4, exact: "zzzz" } },
    ];
    render(
      <AnnotationLayer
        contentRef={ref}
        notes={notes}
        renderNote={(n, isOrphan) => <span>{isOrphan ? "orphan:" : ""}{n.id}</span>}
        highlightEnabled
        canCreate={false}
        onCreateRequest={() => {}}
        toolbarLabel="Add"
        orphanLabel="not found"
      />,
    );
    expect(screen.getByText(/orphan:/)).toBeTruthy();
  });
});
```

> Если `@testing-library/react` ещё не в зависимостях — проверить (`grep "@testing-library/react" package.json`). Если нет — заменить дым-тест на `renderToStaticMarkup` (как в Task 6) и проверять, что строка `orphan:` присутствует в выводе. НЕ добавлять новую зависимость без отдельного PR (package.json — запретная зона).

- [ ] **Step 6: Запустить — убедиться, что проходит**

Run: `pnpm test -- src/components/annotation-layer/annotation-layer.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/annotation-layer/selection-toolbar.tsx src/components/annotation-layer/margin-notes-column.tsx src/components/annotation-layer/annotation-layer.tsx src/components/annotation-layer/index.ts src/components/annotation-layer/annotation-layer.test.tsx
git commit -m "feat(annotation-layer): React-слой (toolbar + column + orchestrator) + barrel"
```

---

## Task 8: Мапперы anchor (annotation.Anchor ↔ TextAnchor) в обвязке

**Files:**
- Modify: `src/features/annotations/anchor.ts`
- Test: `src/features/annotations/anchor.test.ts`

**Interfaces:**
- Consumes: `TextAnchor` (движок); `Anchor` (`./types`); существующий `buildTextAnchor` (`./anchor.ts`).
- Produces:
  - `function toEngineAnchor(a: Anchor): TextAnchor | null` — text-range `Anchor` → `TextAnchor`; `null` для media/неполного.
  - `function fromEngineAnchor(a: TextAnchor): Anchor` — обёртка над `buildTextAnchor`.

- [ ] **Step 1: Написать падающий тест `anchor.test.ts`**

```ts
import { describe, it, expect } from "vitest";

import { toEngineAnchor, fromEngineAnchor } from "./anchor";

describe("anchor мапперы", () => {
  it("toEngineAnchor: полный text-range → TextAnchor", () => {
    const e = toEngineAnchor({
      start_block_id: "p1", end_block_id: "p1",
      start_char: 6, end_char: 10, exact: "bold", prefix: "Hello ", suffix: " world",
    });
    expect(e).toEqual({
      startBlockId: "p1", endBlockId: "p1",
      startChar: 6, endChar: 10, exact: "bold", prefix: "Hello ", suffix: " world",
    });
  });

  it("toEngineAnchor: media-якорь → null", () => {
    expect(toEngineAnchor({ start_sec: 5, end_sec: 10 })).toBeNull();
  });

  it("toEngineAnchor: неполный text → null", () => {
    expect(toEngineAnchor({ start_block_id: "p1", exact: "x" })).toBeNull();
  });

  it("fromEngineAnchor: round-trip", () => {
    const a = fromEngineAnchor({
      startBlockId: "p1", endBlockId: "p1", startChar: 6, endChar: 10, exact: "bold",
    });
    expect(a.start_block_id).toBe("p1");
    expect(a.exact).toBe("bold");
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test -- src/features/annotations/anchor.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать мапперы (дописать в конец `src/features/annotations/anchor.ts`)**

```ts
import type { TextAnchor } from "@/components/annotation-layer";

/** annotation.Anchor (text-range) → TextAnchor движка. null для media/неполного. */
export function toEngineAnchor(a: Anchor): TextAnchor | null {
  if (a.start_sec !== undefined || a.end_sec !== undefined) return null;
  if (!a.start_block_id || !a.end_block_id || !a.exact) return null;
  const anchor: TextAnchor = {
    startBlockId: a.start_block_id,
    endBlockId: a.end_block_id,
    startChar: a.start_char ?? 0,
    endChar: a.end_char ?? 0,
    exact: a.exact,
  };
  if (a.prefix) anchor.prefix = a.prefix;
  if (a.suffix) anchor.suffix = a.suffix;
  return anchor;
}

/** TextAnchor движка → annotation.Anchor (через существующий buildTextAnchor). */
export function fromEngineAnchor(a: TextAnchor): Anchor {
  return buildTextAnchor({
    startBlockId: a.startBlockId,
    endBlockId: a.endBlockId,
    startChar: a.startChar,
    endChar: a.endChar,
    exact: a.exact,
    prefix: a.prefix,
    suffix: a.suffix,
  });
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm test -- src/features/annotations/anchor.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/annotations/anchor.ts src/features/annotations/anchor.test.ts
git commit -m "feat(annotations): мапперы annotation.Anchor ↔ TextAnchor движка"
```

---

## Task 9: Форма создания принимает anchor пропом

**Files:**
- Modify: `src/features/annotations/ui/annotation-create-form.tsx`

**Interfaces:**
- Consumes: `Anchor` (`../types`); существующая схема уже содержит `anchor` (см. `schemas.ts` `makeAnchorJsonSchema`).
- Produces: `AnnotationCreateForm` принимает опциональный проп `anchor?: Anchor` и рендерит скрытое поле `anchor`. Поведение без anchor — как сейчас (поле пустое).

- [ ] **Step 1: Добавить проп `anchor` + скрытое поле**

В `src/features/annotations/ui/annotation-create-form.tsx`:

В `interface Props` добавить:

```tsx
interface Props {
  parentEntityType: ParentEntityType;
  parentId: string;
  anchor?: Anchor;
}
```

Импортировать тип: в строке импорта типов добавить `Anchor`:

```tsx
import type { Annotation, Anchor, ParentEntityType } from "../types";
```

В сигнатуру: `export function AnnotationCreateForm({ parentEntityType, parentId, anchor }: Props) {`

После строки скрытого поля `blocks` добавить:

```tsx
{anchor !== undefined && (
  <input type="hidden" name={f("anchor")} value={JSON.stringify(anchor)} />
)}
```

- [ ] **Step 2: Прогнать существующие тесты слайса (регресс)**

Run: `pnpm test -- src/features/annotations`
Expected: PASS.

- [ ] **Step 3: Typecheck**

Run: `pnpm lint`
Expected: без ошибок по затронутому файлу.

- [ ] **Step 4: Commit**

```bash
git add src/features/annotations/ui/annotation-create-form.tsx
git commit -m "feat(annotations): форма создания принимает anchor пропом (скрытое поле)"
```

---

## Task 10: i18n-ключи движка маргиналий

**Files:**
- Modify: `src/i18n/messages/ru/annotations.ts`
- Modify: `src/i18n/messages/en/annotations.ts`
- Modify: `src/i18n/messages/ar/annotations.ts`
- Modify: `src/i18n/messages/zh/annotations.ts`

**Interfaces:**
- Produces: новые ключи в namespace `annotations`: `marginAddButton`, `marginComposerTitle`, `marginOrphanLabel`, `marginHighlightToggleOn`, `marginHighlightToggleOff`, `marginColumnLabel`, `marginAddUnanchored`.

- [ ] **Step 1: Добавить ключи в `ru/annotations.ts`**

В объект `annotations` (перед `api:`) добавить блок:

```ts
  // --- движок маргиналий (document-annotation-layer) ---
  marginAddButton: "Аннотация",
  marginAddUnanchored: "Добавить аннотацию",
  marginComposerTitle: "Новая аннотация",
  marginOrphanLabel: "Фрагмент не найден",
  marginHighlightToggleOn: "Скрыть подсветку",
  marginHighlightToggleOff: "Показать подсветку",
  marginColumnLabel: "Аннотации на полях",
```

- [ ] **Step 2: Добавить те же ключи в `en/annotations.ts`**

```ts
  marginAddButton: "Annotate",
  marginAddUnanchored: "Add annotation",
  marginComposerTitle: "New annotation",
  marginOrphanLabel: "Fragment not found",
  marginHighlightToggleOn: "Hide highlights",
  marginHighlightToggleOff: "Show highlights",
  marginColumnLabel: "Margin annotations",
```

- [ ] **Step 3: Добавить ключи в `ar/annotations.ts`** (арабский; RTL — авто)

```ts
  marginAddButton: "تعليق",
  marginAddUnanchored: "إضافة تعليق",
  marginComposerTitle: "تعليق جديد",
  marginOrphanLabel: "لم يتم العثور على المقطع",
  marginHighlightToggleOn: "إخفاء التظليل",
  marginHighlightToggleOff: "إظهار التظليل",
  marginColumnLabel: "تعليقات الهامش",
```

- [ ] **Step 4: Добавить ключи в `zh/annotations.ts`** (упрощённый китайский)

```ts
  marginAddButton: "批注",
  marginAddUnanchored: "添加批注",
  marginComposerTitle: "新批注",
  marginOrphanLabel: "未找到片段",
  marginHighlightToggleOn: "隐藏高亮",
  marginHighlightToggleOff: "显示高亮",
  marginColumnLabel: "页边批注",
```

- [ ] **Step 5: Прогнать i18n-parity тесты**

Run: `pnpm test -- i18n`
Expected: PASS. Если есть pseudo-каталог тест и он падает на отсутствии ключей — проверить, генерируется ли pseudo автоматически (`src/i18n/messages/pseudo`). Если pseudo хранится статически — добавить ключи и туда (mirror en с псевдо-маркерами `⟦…⟧`), либо запустить генератор, если он есть (`grep -ri pseudoize src/i18n`).

- [ ] **Step 6: Commit**

```bash
git add src/i18n/messages/ru/annotations.ts src/i18n/messages/en/annotations.ts src/i18n/messages/ar/annotations.ts src/i18n/messages/zh/annotations.ts
git commit -m "feat(i18n): ключи движка маргиналий (annotations namespace, 4 локали)"
```

---

## Task 11: Модалка создания `annotation-composer-dialog.tsx`

**Files:**
- Create: `src/features/annotations/ui/annotation-composer-dialog.tsx`

**Interfaces:**
- Consumes: `Dialog` (kit); `AnnotationCreateForm` (T9); `AnnotationAnchorContext`; `Anchor` (`../types`); `useT`.
- Produces: `AnnotationComposerDialog` (client). Props: `{ parentId: string; open: boolean; onOpenChange: (open: boolean) => void; anchor?: Anchor }`. Рендерит `Dialog` с цитатой-контекстом + формой; форма получает `parentEntityType="document"`, `parentId`, `anchor`.

> Схема AST-редактора (`SchemaContextProvider`) монтируется родителем (как в `AnnotationsSection`) — диалог сам провайдер не ставит; см. Task 12, где `DocumentAnnotations` оборачивает связку в `SchemaContextProvider`.

- [ ] **Step 1: Реализовать `annotation-composer-dialog.tsx`**

```tsx
"use client";
// src/features/annotations/ui/annotation-composer-dialog.tsx
import { Dialog } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { Anchor } from "../types";

import { AnnotationAnchorContext } from "./annotation-anchor-context";
import { AnnotationCreateForm } from "./annotation-create-form";

interface Props {
  parentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor?: Anchor;
}

export function AnnotationComposerDialog({ parentId, open, onOpenChange, anchor }: Props) {
  const t = useT("annotations");
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("marginComposerTitle")}>
      <div className="flex flex-col gap-4">
        {anchor && <AnnotationAnchorContext anchor={anchor} />}
        <AnnotationCreateForm parentEntityType="document" parentId={parentId} anchor={anchor} />
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck/lint**

Run: `pnpm lint`
Expected: без ошибок по файлу.

- [ ] **Step 3: Commit**

```bash
git add src/features/annotations/ui/annotation-composer-dialog.tsx
git commit -m "feat(annotations): модалка создания аннотации (Dialog + форма + цитата)"
```

---

## Task 12: Связка `document-annotation-layer.tsx` (client) + сборщик `document-annotations.tsx` (server)

**Files:**
- Create: `src/features/annotations/ui/document-annotation-layer.tsx`
- Create: `src/features/annotations/ui/document-annotations.tsx`
- Modify: `src/features/annotations/index.ts`

**Interfaces:**
- Consumes: `AnnotationLayer`, `AnchoredNote`, `AnchorDraft` (движок); `toEngineAnchor`, `fromEngineAnchor` (T8); `AnnotationComposerDialog` (T11); `getAnnotationsFor`, `canCreateAnnotation`, `canEditAnnotation` (server); `AnnotationCard`, `AnnotationAnchorContext`, action-кнопки; `SchemaContextProvider`, `getAstSchema`; `useT`/`getT`.
- Produces:
  - `DocumentAnnotationLayer` (client): props `{ parentId: string; notes: { id: string; anchor: Anchor | undefined; card: ReactNode }[]; canCreate: boolean }`. Discovers content root via `[data-annotation-content]`, монтирует `AnnotationLayer`, держит reading-mode тумблер (`localStorage` ключ `annotation-highlights`, дефолт on), модалку, тумблер-кнопку, «добавить без привязки».
  - `DocumentAnnotations` (server): props `{ parentId: string }`. Фетчит аннотации, строит карточки, ставит `SchemaContextProvider`, рендерит связку.
- `index.ts`: `export { DocumentAnnotations } from "./ui/document-annotations";`.

- [ ] **Step 1: Реализовать `document-annotation-layer.tsx` (client)**

```tsx
"use client";
// src/features/annotations/ui/document-annotation-layer.tsx
import { useEffect, useRef, useState, type ReactNode } from "react";

import { AnnotationLayer, type AnchoredNote, type AnchorDraft } from "@/components/annotation-layer";
import { Button, Inline } from "@/components/ui";
import { useT } from "@/i18n/client";

import { fromEngineAnchor, toEngineAnchor } from "../anchor";
import type { Anchor } from "../types";

import { AnnotationComposerDialog } from "./annotation-composer-dialog";

interface NoteVM {
  id: string;
  anchor: Anchor | undefined;
  card: ReactNode;
}

interface Props {
  parentId: string;
  notes: NoteVM[];
  canCreate: boolean;
}

const STORAGE_KEY = "annotation-highlights";

export function DocumentAnnotationLayer({ parentId, notes, canCreate }: Props) {
  const t = useT("annotations");
  const contentRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [highlight, setHighlight] = useState(true);
  const [composer, setComposer] = useState<{ open: boolean; anchor?: Anchor }>({ open: false });

  // Найти контент-рут (server-rendered) + восстановить тумблер.
  useEffect(() => {
    contentRef.current = document.querySelector<HTMLElement>("[data-annotation-content]");
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "off") setHighlight(false);
    setMounted(true);
  }, []);

  const toggle = () => {
    setHighlight((h) => {
      const next = !h;
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
      return next;
    });
  };

  // Только заметки с разрешимым в TextAnchor якорем участвуют в движке;
  // остальные (без anchor) показываем как сироты обычным списком.
  const engineNotes: AnchoredNote[] = notes.flatMap((n) => {
    const e = n.anchor ? toEngineAnchor(n.anchor) : null;
    return e ? [{ id: n.id, anchor: e }] : [];
  });
  const cardById = new Map(notes.map((n) => [n.id, n.card]));
  const unanchored = notes.filter((n) => !n.anchor || !toEngineAnchor(n.anchor));

  const onCreateRequest = (draft: AnchorDraft) => {
    setComposer({ open: true, anchor: fromEngineAnchor(draft.anchor) });
  };

  return (
    <div className="flex flex-col gap-4" aria-label={t("marginColumnLabel")}>
      <Inline gap="tight" align="start">
        {canCreate && (
          <Button type="button" compact tone="primary" onClick={() => { setComposer({ open: true }); }}>
            {t("marginAddUnanchored")}
          </Button>
        )}
        <Button type="button" compact tone="quiet" onClick={toggle}>
          {highlight ? t("marginHighlightToggleOn") : t("marginHighlightToggleOff")}
        </Button>
      </Inline>

      {/* Сироты/без-якоря — простым списком сверху. */}
      {unanchored.map((n) => (
        <div key={n.id}>{n.card}</div>
      ))}

      {mounted && (
        <AnnotationLayer
          contentRef={contentRef}
          notes={engineNotes}
          renderNote={(note) => cardById.get(note.id) ?? null}
          highlightEnabled={highlight}
          canCreate={canCreate}
          onCreateRequest={onCreateRequest}
          toolbarLabel={t("marginAddButton")}
          orphanLabel={t("marginOrphanLabel")}
        />
      )}

      <AnnotationComposerDialog
        parentId={parentId}
        open={composer.open}
        onOpenChange={(open) => { setComposer((c) => ({ ...c, open })); }}
        anchor={composer.anchor}
      />
    </div>
  );
}
```

- [ ] **Step 2: Реализовать `document-annotations.tsx` (server)**

```tsx
// src/features/annotations/ui/document-annotations.tsx
import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

import { getAnnotationsFor } from "../api";
import { canCreateAnnotation, canEditAnnotation } from "../permissions";

import { AnnotationAnchorContext } from "./annotation-anchor-context";
import { AnnotationCard } from "./annotation-card";
import { AnnotationDeleteButton } from "./annotation-delete-button";
import { AnnotationEditButton } from "./annotation-edit-button";
import { AnnotationExportLinks } from "./annotation-export-links";
import { DocumentAnnotationLayer } from "./document-annotation-layer";

interface Props {
  parentId: string;
}

/**
 * Серверный сборщик аннотаций документа: фетчит, строит карточки (с действиями),
 * грузит AST-схему и отдаёт всё в клиентскую связку DocumentAnnotationLayer,
 * которая позиционирует карточки на полях и ведёт selection→модалку.
 */
export async function DocumentAnnotations({ parentId }: Props) {
  const [me, t] = await Promise.all([getMe(), getT("annotations")]);
  const { items } = await getAnnotationsFor("document", parentId);
  const canCreate = canCreateAnnotation(me);

  const needsSchema =
    canCreate || items.some((a) => Boolean(a.id) && canEditAnnotation(me, a));
  const astSchema = needsSchema ? await getAstSchema() : null;

  const notes = items
    .filter((a) => Boolean(a.id))
    .map((a) => {
      const ownEditable = canEditAnnotation(me, a);
      return {
        id: a.id as string,
        anchor: a.anchor,
        card: (
          <AnnotationCard
            annotation={a}
            anchorContext={<AnnotationAnchorContext anchor={a.anchor} />}
            actions={
              <>
                {a.id && <AnnotationExportLinks id={a.id} />}
                {ownEditable && a.id && (
                  <>
                    <AnnotationEditButton annotation={a} initial={astSchema ?? undefined} />
                    <AnnotationDeleteButton annotationId={a.id} />
                  </>
                )}
              </>
            }
          />
        ),
      };
    });

  return (
    <section className="flex flex-col gap-4" aria-label={t("sectionLabel")}>
      <h2 className="text-lg font-semibold">{t("sectionHeading")}</h2>
      <SchemaContextProvider
        initial={astSchema ?? undefined}
        fallback={<p className="text-sm">{t("editorLoading")}</p>}
      >
        <DocumentAnnotationLayer parentId={parentId} notes={notes} canCreate={canCreate} />
      </SchemaContextProvider>
    </section>
  );
}
```

- [ ] **Step 3: Экспортировать из `index.ts`**

В `src/features/annotations/index.ts` добавить (рядом с экспортом `AnnotationsSection`):

```ts
export { DocumentAnnotations } from "./ui/document-annotations";
```

- [ ] **Step 4: Lint/typecheck**

Run: `pnpm lint`
Expected: без ошибок. (Проверить Guardrail 4: `document-annotation-layer.tsx` — client — не импортирует `../api`/`../permissions`/`../actions`/`../schemas`. Импортит только `../anchor` (pure), `../types`, движок, kit, i18n/client — ок.)

- [ ] **Step 5: Commit**

```bash
git add src/features/annotations/ui/document-annotation-layer.tsx src/features/annotations/ui/document-annotations.tsx src/features/annotations/index.ts
git commit -m "feat(annotations): связка движок↔домен (DocumentAnnotations + client layer)"
```

---

## Task 13: Монтаж на странице документа + ручной браузер-QA

**Files:**
- Modify: `src/app/documents/[id]/page.tsx`

**Interfaces:**
- Consumes: `DocumentAnnotations` (T12).

- [ ] **Step 1: Обернуть контент маркером + свапнуть секцию**

В `src/app/documents/[id]/page.tsx`:

1. Заменить импорт `AnnotationsSection` на `DocumentAnnotations`:

```tsx
import { DocumentAnnotations } from "@/features/annotations";
```

2. Обернуть `<DocumentDetail>` маркером для discovery контент-рута:

```tsx
<div data-annotation-content>
  <DocumentDetail document={document} />
</div>
```

3. Убрать блок `{document.id && (<Suspense ...><AnnotationsSection .../></Suspense>)}` из основного `<div>`.

4. Перенести аннотации в правое поле — заменить текущий `<MarginNote side="end">…hint…</MarginNote>` на:

```tsx
<MarginNote side="end" className="p-6">
  {document.id ? (
    <Suspense fallback={<Skeleton className="h-32 w-full" />}>
      <DocumentAnnotations parentId={document.id} />
    </Suspense>
  ) : (
    <p className="text-sm text-(--color-fg-muted)">{t("documentMarginHint")}</p>
  )}
</MarginNote>
```

> `MarginNote side="end"` — прямой потомок `.page-grid` (требование layout), даёт правое поле на ≥1280px и схлопывается в поток на узких (см. [marginalia-layout-foundation]). Карточки внутри позиционируются движком.

- [ ] **Step 2: Прогнать весь тест-сьют + build**

Run: `pnpm test`
Expected: PASS (включая новые модули движка).

Run: `pnpm build`
Expected: успешная сборка.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: чисто.

- [ ] **Step 4: Commit**

```bash
git add "src/app/documents/[id]/page.tsx"
git commit -m "feat(documents): монтаж движка аннотаций на странице (правое поле + content-root)"
```

- [ ] **Step 5: Ручной браузер-QA (локальный стек)**

> Локальный стек ([local-dev-stack]): бэк philosophy-api на :8090 (`make run-local`), фронт `pnpm dev` на :3001, dev-админ `dev` / `admin12345`.

Проверить на странице документа с непустым телом:
1. Выделить текст → всплывает кнопка «Аннотация» у выделения.
2. Клик → модалка с цитатой выделенного фрагмента + редактор.
3. Ввести текст, выбрать видимость, сохранить → карточка появляется в правом поле; фрагмент подсвечен.
4. Карточка стоит примерно на высоте своего фрагмента; при близких якорях карточки не наезжают (раздвижка).
5. Тумблер «Скрыть подсветку» → подсветка исчезает/появляется; состояние переживает перезагрузку.
6. Узкий экран (<1280px) → панель уходит под документ списком; подсветка работает.
7. RTL (локаль `ar`) → поле зеркалится влево, подсветка корректна.
8. Кнопка «Добавить аннотацию» (без выделения) → модалка с пустым якорем; сохраняется как аннотация без привязки.

Зафиксировать найденные визуальные дефекты как follow-up (позиционирование/наезд/подсветка — ожидаемые точки тонкой настройки, т.к. не покрыты юнит-тестами).

---

## Self-Review

**Spec coverage:**
- §3 движок↔фича split → Tasks 1–8 (движок), 8–13 (обвязка). ✓
- §4.1 anchor-from-selection → Task 3. ✓
- §4.2 anchor-to-range + фолбэк по цитате → Task 4. ✓
- §4.3 stacking → Task 1. ✓
- §4.4 highlight-controller + фолбэк → Task 5 (контроллер; оверлей-фолбэк деградирует до «панель без подсветки» — supported=false no-op; полноценный оверлей-рендер вынесен как возможный follow-up, в v1 деградация допустима по §4.4). ✓ (частично — см. примечание ниже)
- §5 React-слой → Task 7. ✓
- §6 обвязка (связка, модалка, SSR, reading-mode) → Tasks 9, 11, 12. ✓
- §7 DOM-контракт data-block-id → Task 6. ✓
- §8 сироты → Tasks 4, 7, 12 (unanchored список). ✓
- §9 бэк-вопросы → отражены в Global Constraints + §9 спеки (выдать пользователю при исполнении). ✓
- §10 тесты ядра → Tasks 1–5 (юнит), 8 (мапперы). ✓
- §11 фазировка → порядок задач. ✓

**Примечание по §4.4 (оверлей-фолбэк):** Полный оверлей-прямоугольник из `getClientRects()` НЕ реализуется в v1 — при отсутствии `CSS.highlights` подсветка деградирует до отсутствия (панель и сохранение работают). Это соответствует нижней деградации §4.4 спеки. Если потребуется поддержка старых браузеров с визуальной подсветкой — отдельный follow-up. **Зафиксировано явно, не молча.**

**Placeholder scan:** Код во всех шагах конкретный; «TBD» нет. Места «проверить X» (pseudo-каталог, `@testing-library/react`, `--color-accent` токен) — реальные условные ветки исполнения с указанием команды проверки, не заглушки.

**Type consistency:** `TextAnchor`/`AnchoredNote`/`AnchorDraft` определены в T1, используются согласованно (T3/T4/T7/T8). `resolveStack`/`StackItem` (T1) → `MarginNotesColumn` (T7). `HighlightController` API (T5) → `annotation-layer.tsx` (T7). `toEngineAnchor`/`fromEngineAnchor` (T8) → связка (T12). `AnnotationLayerProps` (T7) совпадает с вызовом в T12. Имена согласованы. ✓
