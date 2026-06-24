# Движок маргиналий (аннотации к выделенному тексту) — Implementation Plan v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** На странице документа: выделение текста → плавающая кнопка «+ Аннотация» (только на AST-блоках) → модалка → заметка в правой панели на высоте текста (как комментарии MS Word), с подсветкой фрагмента, отключаемой, и двусторонним кликом текст↔карточка.

**Architecture:** Доменно-агностичный, но AST-субстрат-привязанный **движок** `src/components/annotation-layer/` (чистое ядро + React-слой) + тонкая **обвязка** `src/features/annotations/` (серверный сбор карточек + связка + урезанная AST-модалка). Сервер строит карточки, клиент позиционирует/подсвечивает. Прогрессивное улучшение: SSR-список → клиент-позиционированная колонка ≥1280px.

**Tech Stack:** Next.js App Router (RSC + server actions), React 19, TypeScript, Base UI (kit), Vitest+jsdom, next-intl (`@/i18n`), CSS Custom Highlight API (+ overlay-фолбэк).

**Spec:** [docs/superpowers/specs/2026-06-24-text-annotations-margin-engine-design.md](../specs/2026-06-24-text-annotations-margin-engine-design.md) (v2)

**История:** v1-план переработан после 6-осевого адверсариального ревью и фиксов бэка (UTF-16 офсеты подтверждены; per-entity роуты в OpenAPI).

## Global Constraints

- **Тулчейн — pnpm.** Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.
- **Параллельные агенты:** НЕ `git stash/reset/checkout./clean`, НЕ `git add -A`/`.`. Добавлять только свои файлы по имени. Не откатывать чужое.
- **Русский** в общении; **kebab-case** имён в `src/`.
- **Движок `src/components/annotation-layer/` НЕ импортирует `src/features/*`.** Обвязка импортирует движок.
- **Guardrail 4:** client не импортит server-only (`./api`/`./actions`/`./permissions`/`./schemas`). G7/8: только kit, без нативных интерактивных тегов вне `src/components/ui/`.
- **i18n** через `@/i18n`; namespace `annotations`; паритет `ru`/`en`/`ar`/`zh` (pseudo en-XA — авто из `en`, НЕ редактировать). Проверка ключей — grep по 4 файлам (i18n-parity тест НЕ ловит забытый плоский ключ).
- **RBAC:** actions — `requireCapability`; UI — `canX()` булевы пропами.
- **anchor-офсеты — UTF-16 code units** (контракт бэка `schema.ts`: «UTF-16 code units (JS String.length / DOM Range semantics). Stored opaquely.»). Конверсия не нужна; FE — источник истины для `exact`.
- **AST-субстрат — hard-precondition** (§7.1 спеки): аннотируется только `ast-render`-DOM; аффорданс не показывается вне `[data-block-id]` AST-рута.
- **Тесты:** Vitest, jsdom, `globals:false` → импорт `{describe,it,expect,vi}` из `"vitest"`. `@testing-library/react@16` есть в devDeps. `react-dom/server` доступен. **В jsdom нет глобального `CSS`** (ни `CSS.highlights`, ни `CSS.escape`) и `Range.getBoundingClientRect` бросает — учитывать.
- **Запретные зоны** (foundation-touch, помечать в ревью): `src/components/ast-render/*`, `src/app/globals.css`, `src/styles/tokens/*`. Аддитивно.

---

## File Structure

**Движок `src/components/annotation-layer/`:** `types.ts`, `stacking.ts`, `dom-text.ts`, `anchor-from-selection.ts`, `anchor-to-range.ts`, `highlight-controller.ts`, `hit-test.ts` (+ тесты); `use-selection-capture.ts`, `selection-affordance.tsx`, `highlight-overlay.tsx`, `margin-notes-column.tsx`, `annotation-layer.tsx`, `index.ts`.

**Foundation:** `ast-render/ast-render.tsx` (+`data-ast-root`), `ast-render/block-renderer.tsx` (+`data-block-id`, +тест); `styles/tokens/*`+`apca-targets.ts` (`--color-highlight`); `app/globals.css` (`::highlight`).

**Обвязка `src/features/annotations/`:** `anchor.ts` (мапперы, +тест), `actions.ts`/`api.ts` (типизированный клиент), `ui/annotation-create-form.tsx` (anchor+onClose), `ui/annotation-composer-dialog.tsx`, `ui/annotation-cards-builder.tsx` (DRY), `ui/document-annotation-layer.tsx`, `ui/document-annotations.tsx`, `index.ts`.

**i18n:** `messages/{ru,en,ar,zh}/annotations.ts`. **Страница:** `app/documents/[id]/page.tsx`.

---

# Фаза 1 — Чистое ядро движка (TDD)

## Task 1: `types.ts` + `stacking.ts`

**Files:** Create `src/components/annotation-layer/types.ts`, `stacking.ts`; Test `stacking.test.ts`.

**Interfaces:**
- Produces: `TextAnchor`, `AnchoredNote`, `AnchorDraft` (types.ts); `StackItem`, `resolveStack(items, gap?) → { tops: Map<string,number>; totalHeight: number }`.

- [ ] **Step 1: `types.ts`**

```ts
// src/components/annotation-layer/types.ts
// Доменно-агностичные, но AST-субстрат-специфичные типы движка. НЕ импортируют
// схему аннотаций; обвязка маппит annotation.Anchor ↔ TextAnchor (поля и единицы
// идентичны — UTF-16 code units).
export interface TextAnchor {
  startBlockId: string;
  endBlockId: string;
  startChar: number; // UTF-16 code units
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
  rect: DOMRect; // вьюпорт-координаты выделения для тултипа
}
```

- [ ] **Step 2: Падающий тест `stacking.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { resolveStack, type StackItem } from "./stacking";

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
```

- [ ] **Step 3: Запустить — FAIL.** `pnpm test -- src/components/annotation-layer/stacking.test.ts`

- [ ] **Step 4: Реализовать `stacking.ts`**

```ts
// src/components/annotation-layer/stacking.ts
// Чистая раздвижка карточек по вертикали («магия Word»). Без React/DOM.
export interface StackItem {
  id: string;
  top: number; // желаемый top (px) относительно контейнера колонки
  height: number;
}
export interface StackResult {
  tops: Map<string, number>;
  totalHeight: number; // для min-height-распорки колонки
}
export function resolveStack(items: StackItem[], gap = 8): StackResult {
  const sorted = [...items].sort((a, b) => a.top - b.top);
  const tops = new Map<string, number>();
  let cursor = -Infinity;
  let totalHeight = 0;
  for (const item of sorted) {
    const top = Math.max(item.top, cursor);
    tops.set(item.id, top);
    cursor = top + item.height + gap;
    totalHeight = top + item.height;
  }
  return { tops, totalHeight };
}
```

- [ ] **Step 5: Запустить — PASS.**

- [ ] **Step 6: Commit**

```bash
git add src/components/annotation-layer/types.ts src/components/annotation-layer/stacking.ts src/components/annotation-layer/stacking.test.ts
git commit -m "feat(annotation-layer): типы движка + раздвижка карточек (stacking + totalHeight)"
```

---

## Task 2: `dom-text.ts` (plaintext-офсеты + `<br>`→\n)

**Files:** Create `src/components/annotation-layer/dom-text.ts`; Test `dom-text.test.ts`.

**Interfaces:**
- Produces: `blockPlainText(block) → string` (включает `\n` за `<br>`); `offsetWithinBlock(block, container, offset) → number`; `locateOffset(block, charOffset) → { node: Text; offset: number } | null`. Все — UTF-16, учитывают `<br>` как один code unit `\n`.

- [ ] **Step 1: Падающий тест (включая кириллицу/эмодзи/`<br>`)**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { blockPlainText, offsetWithinBlock, locateOffset } from "./dom-text";

function block(html: string): HTMLElement {
  const el = document.createElement("p");
  el.setAttribute("data-block-id", "b1");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

describe("dom-text", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("plainText сквозь форматирование", () => {
    expect(blockPlainText(block("Hello <strong>bold</strong> world"))).toBe("Hello bold world");
  });
  it("<br> → \\n в plainText и в офсетах", () => {
    const b = block("a<br>b");
    expect(blockPlainText(b)).toBe("a\nb");
    // offset узла "b" = 2 (a=1, \n=1)
    const bText = b.childNodes[2]; // text "b" после <br>
    expect(offsetWithinBlock(b, bText, 0)).toBe(2);
  });
  it("кириллица — UTF-16 (1 unit на символ BMP)", () => {
    const b = block("Кант писал");
    const t = b.firstChild!;
    expect(offsetWithinBlock(b, t, 4)).toBe(4); // «Кант» = 4 code units
    expect(blockPlainText(b).length).toBe(10);
  });
  it("эмодзи — суррогатная пара = 2 UTF-16 units", () => {
    const b = block("a😀b");
    expect(blockPlainText(b).length).toBe(4); // a(1)+😀(2)+b(1)
    expect(locateOffset(b, 3)!.offset).toBe(3); // граница после эмодзи
  });
  it("offsetWithinBlock учитывает текст до контейнера", () => {
    const b = block("Hello <strong>bold</strong> world");
    const strong = b.querySelector("strong")!.firstChild!;
    expect(offsetWithinBlock(b, strong, 0)).toBe(6);
    expect(offsetWithinBlock(b, strong, 2)).toBe(8);
  });
  it("locateOffset — обратное", () => {
    const b = block("Hello <strong>bold</strong> world");
    const loc = locateOffset(b, 8)!;
    expect(loc.node.textContent).toBe("bold");
    expect(loc.offset).toBe(2);
  });
  it("locateOffset за пределами → null", () => {
    expect(locateOffset(block("abc"), 999)).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — FAIL.**

- [ ] **Step 3: Реализовать `dom-text.ts`** (обход учитывает `<br>` как виртуальный `\n`-узел)

```ts
// src/components/annotation-layer/dom-text.ts
// Plaintext-офсеты внутри блока в UTF-16 code units (совпадает с контрактом бэка
// и DOM Range). <br> (hard_break) считается одним символом "\n".

interface Segment { node: Node; text: string } // node: Text | <br>; text: содержимое/\n

function segments(block: Element): Segment[] {
  const out: Segment[] = [];
  const walker = block.ownerDocument.createTreeWalker(
    block, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  );
  let n = walker.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) out.push({ node: n, text: n.textContent ?? "" });
    else if ((n as Element).tagName === "BR") out.push({ node: n, text: "\n" });
    n = walker.nextNode();
  }
  return out;
}

export function blockPlainText(block: Element): string {
  return segments(block).map((s) => s.text).join("");
}

export function offsetWithinBlock(block: Element, container: Node, offsetInContainer: number): number {
  const segs = segments(block);
  // Граница — текстовый узел: сумма предыдущих сегментов + локальный офсет.
  if (container.nodeType === Node.TEXT_NODE) {
    let acc = 0;
    for (const s of segs) {
      if (s.node === container) return acc + offsetInContainer;
      acc += s.text.length;
    }
    return acc;
  }
  // Граница — элемент: сумма сегментов до child[offset].
  const target = container.childNodes[offsetInContainer] ?? null;
  let acc = 0;
  for (const s of segs) {
    if (target && (s.node === target || target.contains(s.node))) break;
    acc += s.text.length;
  }
  return acc;
}

export function locateOffset(block: Element, charOffset: number): { node: Text; offset: number } | null {
  let acc = 0;
  for (const s of segments(block)) {
    if (s.node.nodeType !== Node.TEXT_NODE) { acc += s.text.length; continue; } // пропускаем <br>
    const len = s.text.length;
    if (charOffset <= acc + len) return { node: s.node as Text, offset: charOffset - acc };
    acc += len;
  }
  return null;
}
```

- [ ] **Step 4: Запустить — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/components/annotation-layer/dom-text.ts src/components/annotation-layer/dom-text.test.ts
git commit -m "feat(annotation-layer): plaintext-офсеты (UTF-16 + <br>→\\n)"
```

---

## Task 3: `anchor-from-selection.ts` (с AST-субстрат-гардом)

**Files:** Create `src/components/annotation-layer/anchor-from-selection.ts`; Test `anchor-from-selection.test.ts`.

**Interfaces:**
- Consumes: `offsetWithinBlock`, `blockPlainText` (T2); `TextAnchor` (T1).
- Produces: `anchorFromRange(range, root, contextLen=32) → TextAnchor | null`; `anchorFromSelection(sel, root) → TextAnchor | null`. `null`, если хоть одна граница не в `[data-block-id]` внутри `root`, id пуст, или диапазон collapsed.

- [ ] **Step 1: Падающий тест (вкл. AST-гард: выделение вне рута → null)**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { anchorFromRange } from "./anchor-from-selection";

function setup(): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-ast-root", "");
  root.innerHTML =
    '<p data-block-id="p1">Hello <strong>bold</strong> world</p>' +
    '<p data-block-id="p2">Second paragraph here</p>';
  document.body.appendChild(root);
  return root;
}

describe("anchorFromRange", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("одно-блочное выделение", () => {
    const root = setup();
    const strong = root.querySelector("strong")!.firstChild!;
    const r = document.createRange();
    r.setStart(strong, 0); r.setEnd(strong, 4);
    const a = anchorFromRange(r, root)!;
    expect(a.startBlockId).toBe("p1");
    expect(a.startChar).toBe(6); expect(a.endChar).toBe(10);
    expect(a.exact).toBe("bold");
    expect(a.prefix).toBe("Hello "); expect(a.suffix).toBe(" world");
  });
  it("кросс-блочное", () => {
    const root = setup();
    const r = document.createRange();
    r.setStart(root.querySelector('[data-block-id="p1"]')!.firstChild!, 0);
    r.setEnd(root.querySelector('[data-block-id="p2"]')!.firstChild!, 6);
    const a = anchorFromRange(r, root)!;
    expect(a.startBlockId).toBe("p1"); expect(a.endBlockId).toBe("p2");
  });
  it("collapsed → null", () => {
    const root = setup();
    const r = document.createRange();
    r.setStart(root.querySelector('[data-block-id="p1"]')!.firstChild!, 2);
    r.setEnd(root.querySelector('[data-block-id="p1"]')!.firstChild!, 2);
    expect(anchorFromRange(r, root)).toBeNull();
  });
  it("AST-гард: одна граница ВНЕ рута → null", () => {
    const root = setup();
    const outside = document.createElement("p");
    outside.textContent = "sidebar card";
    document.body.appendChild(outside);
    const r = document.createRange();
    r.setStart(root.querySelector('[data-block-id="p1"]')!.firstChild!, 0);
    r.setEnd(outside.firstChild!, 4);
    expect(anchorFromRange(r, root)).toBeNull();
  });
  it("AST-гард: текст без data-block-id → null", () => {
    const root = setup();
    const noId = document.createElement("div");
    noId.setAttribute("data-ast-root", "");
    noId.innerHTML = "<p>no block id</p>";
    document.body.appendChild(noId);
    const r = document.createRange();
    r.selectNodeContents(noId.querySelector("p")!);
    expect(anchorFromRange(r, noId)).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — FAIL.**

- [ ] **Step 3: Реализовать**

```ts
// src/components/annotation-layer/anchor-from-selection.ts
import { blockPlainText, offsetWithinBlock } from "./dom-text";
import type { TextAnchor } from "./types";

function astBlock(node: Node, root: HTMLElement): Element | null {
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const block = el?.closest<HTMLElement>("[data-block-id]") ?? null;
  // AST-субстрат-гард: блок обязан быть внутри переданного AST-рута.
  return block && root.contains(block) ? block : null;
}

export function anchorFromRange(range: Range, root: HTMLElement, contextLen = 32): TextAnchor | null {
  if (range.collapsed) return null;
  const sb = astBlock(range.startContainer, root);
  const eb = astBlock(range.endContainer, root);
  if (!sb || !eb) return null;
  const startId = sb.getAttribute("data-block-id");
  const endId = eb.getAttribute("data-block-id");
  if (!startId || !endId) return null;
  const startChar = offsetWithinBlock(sb, range.startContainer, range.startOffset);
  const endChar = offsetWithinBlock(eb, range.endContainer, range.endOffset);
  const exact = range.toString();
  if (exact.length === 0) return null;
  const prefix = blockPlainText(sb).slice(Math.max(0, startChar - contextLen), startChar);
  const suffix = blockPlainText(eb).slice(endChar, endChar + contextLen);
  const anchor: TextAnchor = { startBlockId: startId, endBlockId: endId, startChar, endChar, exact };
  if (prefix) anchor.prefix = prefix;
  if (suffix) anchor.suffix = suffix;
  return anchor;
}

export function anchorFromSelection(sel: Selection | null, root: HTMLElement): TextAnchor | null {
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  return anchorFromRange(sel.getRangeAt(0), root);
}
```

- [ ] **Step 4: Запустить — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/components/annotation-layer/anchor-from-selection.ts src/components/annotation-layer/anchor-from-selection.test.ts
git commit -m "feat(annotation-layer): Range→TextAnchor с AST-субстрат-гардом"
```

---

## Task 4: `anchor-to-range.ts` (фолбэк-дизамбигуация исправлена + CSS.escape guard)

**Files:** Create `src/components/annotation-layer/anchor-to-range.ts`; Test `anchor-to-range.test.ts`.

**Interfaces:**
- Consumes: `locateOffset` (T2); `TextAnchor` (T1).
- Produces: `rangeFromAnchor(anchor, root) → Range | null`. Точный путь (block_id+char, сверка `exact`); фолбэк — найти `prefix+exact+suffix`, **вырезать `exact` внутри найденного контекста** (дизамбигуация дубликатов); затем перебор голого `exact`. `null` = сирота.

- [ ] **Step 1: Падающий тест (вкл. дубликаты + CSS.escape)**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { rangeFromAnchor } from "./anchor-to-range";
import type { TextAnchor } from "./types";

function setup(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html; document.body.appendChild(root); return root;
}

describe("rangeFromAnchor", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("точный путь block_id+char", () => {
    const root = setup('<p data-block-id="p1">Hello bold world</p>');
    const a: TextAnchor = { startBlockId: "p1", endBlockId: "p1", startChar: 6, endChar: 10, exact: "bold" };
    expect(rangeFromAnchor(a, root)!.toString()).toBe("bold");
  });
  it("фолбэк по цитате при переименованном блоке", () => {
    const root = setup('<p data-block-id="X">Hello bold world</p>');
    const a: TextAnchor = { startBlockId: "p1", endBlockId: "p1", startChar: 6, endChar: 10, exact: "bold", prefix: "Hello ", suffix: " world" };
    expect(rangeFromAnchor(a, root)!.toString()).toBe("bold");
  });
  it("дизамбигуация дубликатов через контекст (берёт ВТОРОЙ 'кант')", () => {
    const root = setup('<p data-block-id="X">кант тут и кант там — второй кант важен</p>');
    // целимся во ВТОРОЙ 'кант' (после "и "): prefix "и ", suffix " там"
    const a: TextAnchor = { startBlockId: "p1", endBlockId: "p1", startChar: 0, endChar: 4, exact: "кант", prefix: "и ", suffix: " там" };
    const r = rangeFromAnchor(a, root)!;
    expect(r.toString()).toBe("кант");
    // проверяем, что это именно второе вхождение: текст до начала Range содержит первый 'кант'
    const pre = root.textContent!.slice(0, root.textContent!.indexOf("кант тут") + 0);
    expect(r.startOffset).toBeGreaterThan(5); // не первое вхождение (offset 0)
  });
  it("дизамбигуация по блоку: дубль exact в разных блоках → берёт из start-блока", () => {
    const root = setup('<p data-block-id="p1">кант здесь</p><p data-block-id="p2">и кант там</p>');
    // tryExact провалится (char 0..4 в p2 = "и ка" ≠ "кант") → block-scoped поиск в p2.
    const a: TextAnchor = { startBlockId: "p2", endBlockId: "p2", startChar: 0, endChar: 4, exact: "кант" };
    const r = rangeFromAnchor(a, root)!;
    expect(r.toString()).toBe("кант");
    expect(root.querySelector('[data-block-id="p2"]')!.contains(r.startContainer)).toBe(true);
  });
  it("сирота → null", () => {
    const root = setup('<p data-block-id="p1">Totally different</p>');
    const a: TextAnchor = { startBlockId: "p1", endBlockId: "p1", startChar: 0, endChar: 4, exact: "zzzz" };
    expect(rangeFromAnchor(a, root)).toBeNull();
  });
  it("спецсимволы в block_id не роняют (CSS.escape guard)", () => {
    const root = setup('<p data-block-id="a.b:c">text here</p>');
    const a: TextAnchor = { startBlockId: "a.b:c", endBlockId: "a.b:c", startChar: 0, endChar: 4, exact: "text" };
    expect(rangeFromAnchor(a, root)!.toString()).toBe("text");
  });
});
```

- [ ] **Step 2: Запустить — FAIL.**

- [ ] **Step 3: Реализовать**

```ts
// src/components/annotation-layer/anchor-to-range.ts
import { locateOffset } from "./dom-text";
import type { TextAnchor } from "./types";

// jsdom не имеет глобального CSS → guard (иначе TypeError, а не graceful).
function escapeId(id: string): string {
  const css = (globalThis as { CSS?: { escape?: (s: string) => string } }).CSS;
  return css?.escape ? css.escape(id) : id.replace(/["\\]/g, "\\$&");
}
function block(root: HTMLElement, id: string): Element | null {
  return root.querySelector(`[data-block-id="${escapeId(id)}"]`);
}

function rangeAt(root: HTMLElement, globalStart: number, length: number): Range | null {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: { node: Text; start: number }[] = [];
  let full = "";
  let n = walker.nextNode() as Text | null;
  while (n) { nodes.push({ node: n, start: full.length }); full += n.textContent ?? ""; n = walker.nextNode() as Text | null; }
  const locate = (g: number) => {
    for (let i = nodes.length - 1; i >= 0; i--) if (g >= nodes[i].start) return { node: nodes[i].node, offset: g - nodes[i].start };
    return null;
  };
  const s = locate(globalStart), e = locate(globalStart + length);
  if (!s || !e) return null;
  const r = root.ownerDocument.createRange();
  r.setStart(s.node, s.offset); r.setEnd(e.node, e.offset);
  return r;
}

function fullText(scope: Element): string {
  const walker = scope.ownerDocument.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  let full = "", n = walker.nextNode();
  while (n) { full += n.textContent ?? ""; n = walker.nextNode(); }
  return full;
}

// Квота-поиск exact (дизамбигуация по prefix/suffix) ВНУТРИ scope.
function searchQuote(scope: Element, a: TextAnchor): Range | null {
  const full = fullText(scope);
  const withCtx = `${a.prefix ?? ""}${a.exact}${a.suffix ?? ""}`;
  if (withCtx !== a.exact) {
    const ctxAt = full.indexOf(withCtx);
    if (ctxAt >= 0) return rangeAt(scope as HTMLElement, ctxAt + (a.prefix?.length ?? 0), a.exact.length);
  }
  const at = full.indexOf(a.exact);
  return at >= 0 ? rangeAt(scope as HTMLElement, at, a.exact.length) : null;
}

function tryExact(a: TextAnchor, root: HTMLElement): Range | null {
  const sb = block(root, a.startBlockId), eb = block(root, a.endBlockId);
  if (!sb || !eb) return null;
  const s = locateOffset(sb, a.startChar), e = locateOffset(eb, a.endChar);
  if (!s || !e) return null;
  const r = root.ownerDocument.createRange();
  r.setStart(s.node, s.offset); r.setEnd(e.node, e.offset);
  return r.toString() === a.exact ? r : null;
}

export function rangeFromAnchor(a: TextAnchor, root: HTMLElement): Range | null {
  // 1) Быстрый путь: офсеты block_id+char, сверка с exact (authoritative).
  const exact = tryExact(a, root);
  if (exact) return exact;
  // 2) Дрейф: блок гарантированно жив (бэк отвечает 409 BLOCKS_HAVE_ANCHORS на
  //    удаление запинённого блока) → ищем цитату ВНУТРИ того же блока — точнее
  //    дизамбигуация дубликатов, чем поиск по всему документу.
  const startBlock = block(root, a.startBlockId);
  if (startBlock) { const r = searchQuote(startBlock, a); if (r) return r; }
  // 3) Последний резерв: квота-поиск по всему руту.
  return searchQuote(root, a);
}
```

- [ ] **Step 4: Запустить — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/components/annotation-layer/anchor-to-range.ts src/components/annotation-layer/anchor-to-range.test.ts
git commit -m "feat(annotation-layer): TextAnchor→Range (дизамбигуация дубликатов + CSS.escape guard)"
```

---

## Task 5: `highlight-controller.ts` (CSS Highlight + active 2-й канал)

**Files:** Create `src/components/annotation-layer/highlight-controller.ts`; Test `highlight-controller.test.ts`.

**Interfaces:**
- Produces: `class HighlightController { readonly supported: boolean; apply(ranges): void; setActive(range|null): void; clear(): void }`. Имена `"annotation"` / `"annotation-active"`. Если `CSS.highlights` нет → `supported=false`, методы no-op (оверлей-фолбэк — Task 10).

- [ ] **Step 1: Падающий тест (мок CSS.highlights)**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { HighlightController } from "./highlight-controller";

class FakeHighlight { ranges: Range[]; constructor(...r: Range[]) { this.ranges = r; } }
function install() { const s = new Map(); vi.stubGlobal("Highlight", FakeHighlight); vi.stubGlobal("CSS", { highlights: s }); return s; }

describe("HighlightController", () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  it("supported + apply регистрирует", () => {
    const s = install(); const c = new HighlightController();
    expect(c.supported).toBe(true);
    c.apply([document.createRange()]);
    expect(s.has("annotation")).toBe(true);
  });
  it("setActive отдельным слоем; null снимает", () => {
    const s = install(); const c = new HighlightController();
    c.setActive(document.createRange()); expect(s.has("annotation-active")).toBe(true);
    c.setActive(null); expect(s.has("annotation-active")).toBe(false);
  });
  it("clear снимает оба", () => {
    const s = install(); const c = new HighlightController();
    c.apply([document.createRange()]); c.setActive(document.createRange()); c.clear();
    expect(s.has("annotation")).toBe(false); expect(s.has("annotation-active")).toBe(false);
  });
  it("без CSS.highlights → supported=false, no-throw", () => {
    vi.stubGlobal("CSS", {}); const c = new HighlightController();
    expect(c.supported).toBe(false);
    expect(() => { c.apply([document.createRange()]); c.setActive(null); c.clear(); }).not.toThrow();
  });
});
```

- [ ] **Step 2: Запустить — FAIL.**

- [ ] **Step 3: Реализовать**

```ts
// src/components/annotation-layer/highlight-controller.ts
// Подсветка через CSS Custom Highlight API (ноль мутаций DOM). Active — отдельный
// слой annotation-active, отличается ВТОРЫМ визуальным каналом (underline в CSS,
// см. globals.css), не только альфой. Нет API → no-op (оверлей-фолбэк отдельно).
interface HL { /* marker */ }
type HLCtor = new (...r: Range[]) => HL;
function registry(): Map<string, HL> | null {
  return (globalThis as { CSS?: { highlights?: Map<string, HL> } }).CSS?.highlights ?? null;
}
function ctor(): HLCtor | null {
  return (globalThis as { Highlight?: HLCtor }).Highlight ?? null;
}
export class HighlightController {
  readonly supported: boolean;
  constructor(private readonly name = "annotation") {
    this.supported = registry() !== null && ctor() !== null;
  }
  private active = `${this.name}-active`;
  apply(ranges: Range[]): void {
    const reg = registry(), C = ctor(); if (!reg || !C) return;
    reg.set(this.name, new C(...ranges));
  }
  setActive(range: Range | null): void {
    const reg = registry(), C = ctor(); if (!reg || !C) return;
    if (range) reg.set(this.active, new C(range)); else reg.delete(this.active);
  }
  clear(): void { const reg = registry(); if (!reg) return; reg.delete(this.name); reg.delete(this.active); }
}
```

- [ ] **Step 4: Запустить — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/components/annotation-layer/highlight-controller.ts src/components/annotation-layer/highlight-controller.test.ts
git commit -m "feat(annotation-layer): контроллер подсветки (CSS Highlight + active-слой)"
```

---

## Task 6: `hit-test.ts` (для двустороннего клика)

**Files:** Create `src/components/annotation-layer/hit-test.ts`; Test `hit-test.test.ts`.

**Interfaces:**
- Consumes: `TextAnchor`, `rangeFromAnchor` (T4).
- Produces: `noteAtPoint(x, y, notes: AnchoredNote[], root) → string | null` — `caretRangeFromPoint`/`caretPositionFromPoint` → точка → первый note, чей `Range` содержит позицию.

> jsdom не реализует `caretRangeFromPoint`/`getBoundingClientRect` → тест проверяет логику «содержит позицию» через инъекцию фейкового caret-резолвера (DI), не реальную геометрию.

- [ ] **Step 1: Падающий тест (DI caret-резолвера)**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { noteContainingCaret } from "./hit-test";
import type { AnchoredNote } from "./types";

function setup(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = '<p data-block-id="p1">alpha beta gamma</p>';
  document.body.appendChild(root); return root;
}

describe("noteContainingCaret", () => {
  beforeEach(() => { document.body.innerHTML = ""; });
  it("возвращает note, чей range накрывает caret", () => {
    const root = setup();
    const notes: AnchoredNote[] = [{ id: "n1", anchor: { startBlockId: "p1", endBlockId: "p1", startChar: 6, endChar: 10, exact: "beta" } }];
    const textNode = root.querySelector("p")!.firstChild as Text;
    // caret в середине "beta" (offset 8)
    expect(noteContainingCaret({ node: textNode, offset: 8 }, notes, root)).toBe("n1");
    // caret в "alpha" (offset 2) — вне beta
    expect(noteContainingCaret({ node: textNode, offset: 2 }, notes, root)).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — FAIL.**

- [ ] **Step 3: Реализовать** (чистое ядро `noteContainingCaret` + браузерная обёртка `noteAtPoint`)

```ts
// src/components/annotation-layer/hit-test.ts
import { rangeFromAnchor } from "./anchor-to-range";
import type { AnchoredNote } from "./types";

export interface CaretPos { node: Node; offset: number }

/** Чистое ядро: какой note накрывает caret-позицию. Тестируемо без геометрии. */
export function noteContainingCaret(caret: CaretPos, notes: AnchoredNote[], root: HTMLElement): string | null {
  const point = root.ownerDocument.createRange();
  point.setStart(caret.node, caret.offset);
  point.setEnd(caret.node, caret.offset);
  for (const n of notes) {
    const r = rangeFromAnchor(n.anchor, root);
    if (!r) continue;
    // point внутри r: r.start <= point <= r.end
    if (r.comparePoint(caret.node, caret.offset) === 0) return n.id;
  }
  return null;
}

/** Браузерная обёртка: координаты клика → caret → noteContainingCaret. */
export function noteAtPoint(x: number, y: number, notes: AnchoredNote[], root: HTMLElement): string | null {
  const doc = root.ownerDocument;
  let caret: CaretPos | null = null;
  // Стандарт (Firefox) и WebKit/Blink.
  const anyDoc = doc as unknown as {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (anyDoc.caretPositionFromPoint) {
    const p = anyDoc.caretPositionFromPoint(x, y);
    if (p) caret = { node: p.offsetNode, offset: p.offset };
  } else if (anyDoc.caretRangeFromPoint) {
    const r = anyDoc.caretRangeFromPoint(x, y);
    if (r) caret = { node: r.startContainer, offset: r.startOffset };
  }
  if (!caret || !root.contains(caret.node)) return null;
  return noteContainingCaret(caret, notes, root);
}
```

- [ ] **Step 4: Запустить — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/components/annotation-layer/hit-test.ts src/components/annotation-layer/hit-test.test.ts
git commit -m "feat(annotation-layer): hit-test caret→note (двусторонний клик)"
```

---

# Фаза 2 — Foundation

## Task 7: `data-block-id` + `data-ast-root` в `ast-render` (foundation)

**Files:** Modify `src/components/ast-render/ast-render.tsx`, `block-renderer.tsx`; Test `block-renderer.test.tsx`.

> **Foundation-touch** (`src/components/ast-render/`): аддитивно. Помечать в ревью.

**Interfaces:** Produces: обёртка `ast-render` несёт `data-ast-root`; каждый текст-блок несёт `data-block-id={block.id}` (при наличии). **`<table>` — БЕЗ `data-block-id`** (ячейки без id → мусорный якорь). `<image>` — DOM не меняется.

- [ ] **Step 1: Падающий тест `block-renderer.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BlockRenderer } from "./block-renderer";
import type { AstBlock } from "./types";

const html = (b: AstBlock) => renderToStaticMarkup(<BlockRenderer block={b} ctx={{}} />);

describe("BlockRenderer data-block-id", () => {
  it("paragraph", () => {
    expect(html({ id: "p1", type: "paragraph", content: [{ type: "text", text: "x" }] })).toContain('data-block-id="p1"');
  });
  it("heading", () => {
    expect(html({ id: "h1", type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "x" }] })).toContain('data-block-id="h1"');
  });
  it("blockquote + вложенный paragraph", () => {
    const out = html({ id: "bq", type: "blockquote", content: [{ id: "p2", type: "paragraph", content: [{ type: "text", text: "x" }] }] } as AstBlock);
    expect(out).toContain('data-block-id="bq"');
    expect(out).toContain('data-block-id="p2"');
  });
  it("table — БЕЗ data-block-id (ячейки без id)", () => {
    const out = html({ id: "t1", type: "table", content: [{ type: "table_row", content: [{ type: "table_cell", content: [{ type: "text", text: "c" }] }] }] } as AstBlock);
    expect(out).not.toContain("data-block-id");
  });
  it("без id — без атрибута", () => {
    expect(html({ type: "paragraph", content: [{ type: "text", text: "x" }] })).not.toContain("data-block-id");
  });
});
```

- [ ] **Step 2: Запустить — FAIL.** `pnpm test -- src/components/ast-render/block-renderer.test.tsx`

- [ ] **Step 3a: `data-ast-root` — НЕ на `ast-render` (исправлено по ходу).**

`AstRender` рендерит **фрагмент без обёртки** (flow-контракт `.content > * + *`; обёртка ломает
вертикальный ритм и регресс-тест `ast-render.test.tsx`). Поэтому `data-ast-root` вешается на
**page-level обёртку вокруг `DocumentDetail`** (Task 20), а не здесь. Движок берёт `root` от
консьюмера и ищет `[data-block-id]` внутри — `ast-render.tsx` НЕ трогаем. Этот шаг — только
`data-block-id` (Step 3b).

- [ ] **Step 3b: `block-renderer.tsx` — `data-block-id` (кроме table/image)**

В начало `BlockRenderer` добавить `const idAttr = block.id ? { "data-block-id": block.id } : {};` и применить `{...idAttr}` к корневым тегам: `paragraph`→`<p>`, `heading`→`<Tag>`, `list`→`<Tag>` (ul/ol), `list_item`→`<li>`, `code_block`→`<pre dir="ltr" data-language={langStr}>`, `blockquote`→`<blockquote>`, `thematic_break`→`<hr>`, `default`→`<div data-unsupported=…>`. **`table` — НЕ добавлять** `idAttr` (оставить `<table>` как есть). **`image` — НЕ менять** (`<ImageNode .../>` как было, без обёртки).

- [ ] **Step 4: Запустить — PASS** + регресс `pnpm test -- src/components/ast-render`

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-render/ast-render.tsx src/components/ast-render/block-renderer.tsx src/components/ast-render/block-renderer.test.tsx
git commit -m "feat(ast-render): data-ast-root + data-block-id (DOM-контракт движка, без table/image)"
```

---

## Task 8: Токен `--color-highlight` + APCA-пара + `::highlight` CSS (foundation)

**Files:** Modify `src/styles/tokens/` (семантические токены), `src/styles/tokens/apca-targets.ts`, `src/app/globals.css`.

> **Foundation-touch** (токены/globals.css): координированно.

- [ ] **Step 1: Изучить генератор токенов.** Прочитать `src/styles/tokens/` (как заданы `--color-accent`/`--color-surface`: семантические TS-определения → генерация CSS). Найти файл семантических токенов (напр. `semantic.ts`) и `apca-targets.ts` (`CONTRAST_PAIRS`).

- [ ] **Step 2: Добавить `--color-highlight` / `--color-highlight-active`** в семантические токены — амбер/жёлтый «маркер» с прозрачностью, 4 комбо тема×контраст (как surface-семейство). Прогнать генератор токенов (команда из `package.json` scripts, напр. `pnpm tokens:build` — проверить точное имя).

- [ ] **Step 3: APCA-пара.** В `apca-targets.ts` добавить в `CONTRAST_PAIRS` пары `fg`-on-`highlight` и `fg`-on-`highlight-active` с `minLc` уровня тела (≈75). Прогнать APCA-гард: `pnpm test -- apca` (или имя из scripts). Expected: PASS (текст читаем на подсветке во всех комбо).

- [ ] **Step 4: `::highlight` в `globals.css`**

```css
/* Подсветка аннотированных фрагментов (CSS Custom Highlight API). */
::highlight(annotation) { background-color: var(--color-highlight); }
::highlight(annotation-active) {
  background-color: var(--color-highlight-active);
  text-decoration: underline; /* второй визуальный канал — отличие от перекрытия */
}
```

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens src/app/globals.css
git commit -m "feat(styling): токен --color-highlight (+APCA-пара) + ::highlight стили"
```

---

# Фаза 3 — React-слой движка

> jsdom не даёт layout (`Range.getBoundingClientRect` бросает, `getClientRects` пуст, нет `CSS`/`matchMedia`/`ResizeObserver` без полифилла). Поэтому React-слой — **дым-тесты** (рендерится, ветки orphan/narrow не падают) + **ручной браузер-QA** (Task 19). Позиционная геометрия — единственная непокрытая автотестом точка, фиксируется явно.

## Task 9: Захват выделения + аффорданс

**Files:** Create `src/components/annotation-layer/use-selection-capture.ts`, `selection-affordance.tsx`.

**Interfaces:**
- Produces: `useSelectionCapture({ rootRef, enabled }) → { draft: AnchorDraft | null; clear() }` — подписка `selectionchange` (debounce 250мс) + `pointerup`/`touchend`; строит `AnchorDraft` через `anchorFromSelection`; guard на программное снятие; прячет на `scroll`/`resize`. `SelectionAffordance({ rect, label, onCreate })` — портал-кнопка у выделения.

- [ ] **Step 1: `use-selection-capture.ts`**

```ts
// src/components/annotation-layer/use-selection-capture.ts
import { useEffect, useRef, useState, type RefObject } from "react";
import { anchorFromSelection } from "./anchor-from-selection";
import type { AnchorDraft } from "./types";

export function useSelectionCapture({ rootRef, enabled }: { rootRef: RefObject<HTMLElement | null>; enabled: boolean }) {
  const [draft, setDraft] = useState<AnchorDraft | null>(null);
  const suppress = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const recompute = () => {
      const root = rootRef.current;
      if (!root) { setDraft(null); return; }
      const sel = window.getSelection();
      // AST-рамка (устрожение): выделение вне контент-рута даже не обрабатываем —
      // обе границы обязаны быть внутри AST-рута. Это гейт ПЕРВЫМ, до построения якоря.
      if (!sel || !sel.anchorNode || !sel.focusNode ||
          !root.contains(sel.anchorNode) || !root.contains(sel.focusNode)) { setDraft(null); return; }
      const anchor = anchorFromSelection(sel, root);
      if (!anchor || sel.rangeCount === 0) { setDraft(null); return; }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setDraft({ anchor, rect });
    };
    const onSelectionChange = () => {
      if (suppress.current) { suppress.current = false; return; }
      if (timer) clearTimeout(timer);
      timer = setTimeout(recompute, 250);
    };
    const onPointerUp = () => { if (timer) clearTimeout(timer); recompute(); };
    const onScrollResize = () => { setDraft(null); };
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("touchend", onPointerUp);
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("touchend", onPointerUp);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [enabled, rootRef]);

  const clear = () => { suppress.current = true; window.getSelection()?.removeAllRanges(); setDraft(null); };
  return { draft, clear };
}
```

- [ ] **Step 2: `selection-affordance.tsx`**

```tsx
"use client";
// src/components/annotation-layer/selection-affordance.tsx
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";

interface Props { rect: DOMRect; label: string; onCreate: () => void }

export function SelectionAffordance({ rect, label, onCreate }: Props) {
  const top = rect.top + window.scrollY - 40;
  const left = rect.left + window.scrollX + rect.width / 2;
  return createPortal(
    <div role="status" aria-live="polite"
      // eslint-disable-next-line no-restricted-syntax -- координатный портал, направление-нейтрально
      style={{ position: "absolute", top, left, transform: "translateX(-50%)", zIndex: 50 }}>
      <Button type="button" compact tone="primary" aria-label={label}
        onPointerDown={(e) => { e.preventDefault(); }} onClick={onCreate}>
        {label}
      </Button>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 3: Дым-тест** `use-selection-capture.test.ts` — смонтировать хук в компоненте через testing-library, диспатчить `selectionchange`, проверить, что без выделения `draft===null` и нет throw. (Реальный rect — нули в jsdom; проверяем только отсутствие падений и null-ветку.)

- [ ] **Step 4: Запустить — PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/components/annotation-layer/use-selection-capture.ts src/components/annotation-layer/selection-affordance.tsx src/components/annotation-layer/use-selection-capture.test.ts
git commit -m "feat(annotation-layer): захват выделения (selectionchange+touch) + аффорданс"
```

---

## Task 10: `highlight-overlay.tsx` (обязательный фолбэк)

**Files:** Create `src/components/annotation-layer/highlight-overlay.tsx`.

**Interfaces:** Produces: `HighlightOverlay({ ranges, activeRange })` — абсолютные `<div>` из `range.getClientRects()` для браузеров без CSS Highlight API. Репозиция на resize/scroll.

- [ ] **Step 1: Реализовать**

```tsx
"use client";
// src/components/annotation-layer/highlight-overlay.tsx
// Фолбэк подсветки для браузеров без CSS Custom Highlight API: прямоугольники
// из range.getClientRects() в абсолютном слое. Ноль мутаций текстового DOM.
import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Props { ranges: Range[]; activeRange: Range | null }
interface Rect { top: number; left: number; width: number; height: number; active: boolean }

function collect(ranges: Range[], active: Range | null): Rect[] {
  const out: Rect[] = [];
  const push = (r: Range, isActive: boolean) => {
    for (const cr of Array.from(r.getClientRects())) {
      out.push({ top: cr.top + window.scrollY, left: cr.left + window.scrollX, width: cr.width, height: cr.height, active: isActive });
    }
  };
  ranges.forEach((r) => { push(r, false); });
  if (active) push(active, true);
  return out;
}

export function HighlightOverlay({ ranges, activeRange }: Props) {
  const [rects, setRects] = useState<Rect[]>([]);
  useLayoutEffect(() => {
    const update = () => { setRects(collect(ranges, activeRange)); };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [ranges, activeRange]);
  return createPortal(
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      {rects.map((r, i) => (
        <div key={i} className={r.active ? "annotation-overlay annotation-overlay--active" : "annotation-overlay"}
          // eslint-disable-next-line no-restricted-syntax -- координатный оверлей, направление-нейтрально
          style={{ position: "absolute", top: r.top, left: r.left, width: r.width, height: r.height }} />
      ))}
    </div>,
    document.body,
  );
}
```

Добавить в `globals.css`:
```css
.annotation-overlay { background-color: var(--color-highlight); }
.annotation-overlay--active { background-color: var(--color-highlight-active); }
```

- [ ] **Step 2: Lint** `pnpm lint`. (Дым-тест необязателен — getClientRects в jsdom пуст; ветка собирает [] → не падает.)

- [ ] **Step 3: Commit**

```bash
git add src/components/annotation-layer/highlight-overlay.tsx src/app/globals.css
git commit -m "feat(annotation-layer): оверлей-фолбэк подсветки (getClientRects)"
```

---

## Task 11: `margin-notes-column.tsx` (позиционирование: референс-контейнер + RO + narrow + распорка)

**Files:** Create `src/components/annotation-layer/margin-notes-column.tsx`.

**Interfaces:** Produces: `MarginNotesColumn({ notes, getAnchorRect, onActivate })`, где `notes: { id; node; orphan }[]`, `getAnchorRect(id) → DOMRect | null` (от движка). Измеряет top якоря **относительно контейнера колонки**, raздвигает (`resolveStack`), ставит min-height-распорку, narrow-гард через `matchMedia`.

- [ ] **Step 1: Реализовать**

```tsx
"use client";
// src/components/annotation-layer/margin-notes-column.tsx
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { resolveStack, type StackItem } from "./stacking";

export interface ColumnNote { id: string; node: ReactNode; orphan: boolean }
interface Props {
  notes: ColumnNote[];
  getAnchorRect: (id: string) => DOMRect | null; // viewport-координаты якоря
  onActivate: (id: string) => void;
  recomputeKey: number; // меняется при resize/fonts/scroll от движка
}

const WIDE = "(min-width: 80rem)";

export function MarginNotesColumn({ notes, getAnchorRect, onActivate, recomputeKey }: Props) {
  const anchoredRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const [tops, setTops] = useState<Map<string, number>>(new Map());
  const [strut, setStrut] = useState(0);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const sync = () => { setWide(mq.matches); };
    sync(); mq.addEventListener("change", sync);
    return () => { mq.removeEventListener("change", sync); };
  }, []);

  const reposition = useCallback(() => {
    const container = anchoredRef.current;
    if (!container || !wide) { setTops(new Map()); setStrut(0); return; }
    const colTop = container.getBoundingClientRect().top; // общий референс
    const items: StackItem[] = [];
    for (const n of notes) {
      if (n.orphan) continue;
      const rect = getAnchorRect(n.id);
      if (!rect) continue;
      const el = cardRefs.current.get(n.id);
      items.push({ id: n.id, top: rect.top - colTop, height: el?.offsetHeight ?? 0 });
    }
    const { tops, totalHeight } = resolveStack(items);
    setTops(tops); setStrut(totalHeight);
  }, [notes, getAnchorRect, wide]);

  useLayoutEffect(() => { reposition(); }, [reposition, recomputeKey]);

  const orphans = notes.filter((n) => n.orphan);
  const anchored = notes.filter((n) => !n.orphan);

  return (
    <div className="flex flex-col gap-3" data-annotation-column>
      {orphans.map((n) => <div key={n.id}>{n.node}</div>)}
      <div ref={anchoredRef} className={wide ? "relative" : "flex flex-col gap-3"}
        // eslint-disable-next-line no-restricted-syntax -- распорка под абсолютные карточки
        style={wide ? { minHeight: strut } : undefined}>
        {anchored.map((n) => (
          <div key={n.id} ref={(el) => { if (el) cardRefs.current.set(n.id, el); else cardRefs.current.delete(n.id); }}
            onClick={() => { onActivate(n.id); }}
            // eslint-disable-next-line no-restricted-syntax -- вертикальное позиционирование по якорю
            style={wide && tops.has(n.id) ? { position: "absolute", top: tops.get(n.id), insetInlineStart: 0, insetInlineEnd: 0 } : undefined}>
            {n.node}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint** `pnpm lint`.

- [ ] **Step 3: Commit**

```bash
git add src/components/annotation-layer/margin-notes-column.tsx
git commit -m "feat(annotation-layer): колонка карточек (референс-контейнер + narrow-гард + распорка)"
```

---

## Task 12: `annotation-layer.tsx` оркестратор + barrel

**Files:** Create `src/components/annotation-layer/annotation-layer.tsx`, `index.ts`; Test `annotation-layer.test.tsx`.

**Interfaces:**
- Consumes: всё ядро + `useSelectionCapture`, `SelectionAffordance`, `HighlightController`, `HighlightOverlay`, `MarginNotesColumn`, `noteAtPoint`.
- Produces (barrel): `AnnotationLayer`, типы `TextAnchor`/`AnchoredNote`/`AnchorDraft`.
- `interface AnnotationLayerProps { astRootRef: RefObject<HTMLElement|null>; notes: AnchoredNote[]; renderNote: (note, orphan) => ReactNode; highlightEnabled: boolean; canCreate: boolean; onCreateRequest: (draft) => void; affordanceLabel: string }`.

- [ ] **Step 1: Реализовать**

```tsx
"use client";
// src/components/annotation-layer/annotation-layer.tsx
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { rangeFromAnchor } from "./anchor-to-range";
import { HighlightController } from "./highlight-controller";
import { HighlightOverlay } from "./highlight-overlay";
import { noteAtPoint } from "./hit-test";
import { MarginNotesColumn, type ColumnNote } from "./margin-notes-column";
import { SelectionAffordance } from "./selection-affordance";
import { useSelectionCapture } from "./use-selection-capture";
import type { AnchorDraft, AnchoredNote } from "./types";

export interface AnnotationLayerProps {
  astRootRef: RefObject<HTMLElement | null>;
  notes: AnchoredNote[];
  renderNote: (note: AnchoredNote, orphan: boolean) => ReactNode;
  highlightEnabled: boolean;
  canCreate: boolean;
  onCreateRequest: (draft: AnchorDraft) => void;
  affordanceLabel: string;
}

export function AnnotationLayer(props: AnnotationLayerProps) {
  const { astRootRef, notes, renderNote, highlightEnabled, canCreate, onCreateRequest, affordanceLabel } = props;
  const controllerRef = useRef<HighlightController | null>(null);
  if (!controllerRef.current) controllerRef.current = new HighlightController();
  const controller = controllerRef.current;

  const { draft, clear } = useSelectionCapture({ rootRef: astRootRef, enabled: canCreate });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [recomputeKey, setRecomputeKey] = useState(0);
  const [ready, setReady] = useState(false);

  // Готовность рута (ref заполнен) → форсим первый расчёт.
  useEffect(() => { setReady(astRootRef.current !== null); }, [astRootRef]);

  // Пересчёт геометрии: resize / fonts / scroll / смена notes.
  useEffect(() => {
    const bump = () => { setRecomputeKey((k) => k + 1); };
    bump();
    window.addEventListener("resize", bump);
    const ro = typeof ResizeObserver !== "undefined" && astRootRef.current ? new ResizeObserver(bump) : null;
    if (ro && astRootRef.current) ro.observe(astRootRef.current);
    (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready.then(bump).catch(() => {});
    return () => { window.removeEventListener("resize", bump); ro?.disconnect(); };
  }, [astRootRef, notes, ready]);

  // Range по каждому note (для подсветки/позиций/хит-теста).
  const ranges = useMemo(() => {
    const root = astRootRef.current; const m = new Map<string, Range | null>();
    if (root) for (const n of notes) m.set(n.id, rangeFromAnchor(n.anchor, root));
    return m;
  }, [notes, astRootRef, recomputeKey]);

  // Подсветка (основной путь). Оверлей-фолбэк — ниже через supported.
  useEffect(() => {
    if (!highlightEnabled) { controller.clear(); return; }
    const valid = [...ranges.values()].filter((r): r is Range => r !== null);
    controller.apply(valid);
    controller.setActive(activeId ? ranges.get(activeId) ?? null : null);
    return () => { controller.clear(); };
  }, [ranges, highlightEnabled, activeId, controller]);

  const getAnchorRect = useCallback((id: string) => {
    const r = ranges.get(id); return r ? r.getBoundingClientRect() : null;
  }, [ranges]);

  // Двусторонний клик: клик в AST-руте → note → активировать + скролл карточки.
  useEffect(() => {
    const root = astRootRef.current; if (!root) return;
    const onClick = (e: MouseEvent) => {
      const id = noteAtPoint(e.clientX, e.clientY, notes, root);
      if (id) { setActiveId(id); document.querySelector(`[data-note-card="${id}"]`)?.scrollIntoView({ block: "center" }); }
    };
    root.addEventListener("click", onClick);
    return () => { root.removeEventListener("click", onClick); };
  }, [notes, astRootRef]);

  const onActivate = useCallback((id: string) => {
    setActiveId(id);
    const r = ranges.get(id);
    if (r) { const rect = r.getBoundingClientRect(); window.scrollTo({ top: rect.top + window.scrollY - 100 }); }
  }, [ranges]);

  const columnNotes: ColumnNote[] = notes.map((n) => {
    const orphan = (ranges.get(n.id) ?? null) === null;
    return { id: n.id, orphan, node: <div data-note-card={n.id}>{renderNote(n, orphan)}</div> };
  });

  const create = useCallback(() => { if (draft) { onCreateRequest(draft); clear(); } }, [draft, onCreateRequest, clear]);

  const overlayRanges = !controller.supported && highlightEnabled
    ? [...ranges.values()].filter((r): r is Range => r !== null) : [];

  return (
    <>
      {draft && canCreate && <SelectionAffordance rect={draft.rect} label={affordanceLabel} onCreate={create} />}
      {overlayRanges.length > 0 && <HighlightOverlay ranges={overlayRanges} activeRange={activeId ? ranges.get(activeId) ?? null : null} />}
      <MarginNotesColumn notes={columnNotes} getAnchorRect={getAnchorRect} onActivate={onActivate} recomputeKey={recomputeKey} />
    </>
  );
}
```

- [ ] **Step 2: `index.ts`**

```ts
// src/components/annotation-layer/index.ts
export { AnnotationLayer, type AnnotationLayerProps } from "./annotation-layer";
export type { TextAnchor, AnchoredNote, AnchorDraft } from "./types";
```

- [ ] **Step 3: Дым-тест `annotation-layer.test.tsx`** — orphan-ветка рендерит карточку (testing-library `render`), не падает без layout. (Аналог v1 дым-теста: note с неразрешимым якорём → `renderNote(n, true)` → найти текст.)

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import { AnnotationLayer } from "./annotation-layer";
import type { AnchoredNote } from "./types";

function Harness({ notes }: { notes: AnchoredNote[] }) {
  const ref = useRef<HTMLElement>(null);
  return (
    <div>
      <div ref={ref as React.RefObject<HTMLDivElement>} data-ast-root>
        <p data-block-id="p1">present</p>
      </div>
      <AnnotationLayer astRootRef={ref} notes={notes} highlightEnabled canCreate={false}
        onCreateRequest={() => {}} affordanceLabel="Add"
        renderNote={(n, orphan) => <span>{orphan ? "orphan:" : ""}{n.id}</span>} />
    </div>
  );
}

describe("AnnotationLayer (smoke)", () => {
  beforeEach(() => { document.body.innerHTML = ""; });
  it("сирота рендерится", () => {
    render(<Harness notes={[{ id: "n1", anchor: { startBlockId: "x", endBlockId: "x", startChar: 0, endChar: 4, exact: "zzzz" } }]} />);
    expect(screen.getByText(/orphan:/)).toBeTruthy();
  });
});
```

- [ ] **Step 4: Запустить — PASS** (`pnpm test -- src/components/annotation-layer/annotation-layer.test.tsx`).

- [ ] **Step 5: Commit**

```bash
git add src/components/annotation-layer/annotation-layer.tsx src/components/annotation-layer/index.ts src/components/annotation-layer/annotation-layer.test.tsx
git commit -m "feat(annotation-layer): оркестратор (захват+подсветка+позиции+двусторонний клик) + barrel"
```

---

# Фаза 4 — Обвязка annotations

## Task 13: Мапперы anchor

**Files:** Modify `src/features/annotations/anchor.ts`; Test `src/features/annotations/anchor.test.ts`.

**Interfaces:** Produces `toEngineAnchor(a: Anchor) → TextAnchor | null` (text-range; null для media/неполного); `fromEngineAnchor(a: TextAnchor) → Anchor` (через `buildTextAnchor`). Импорт `TextAnchor` — строго `import type` (граница движок/server).

- [ ] **Step 1: Падающий тест** (как v1 Task 8: полный text→TextAnchor; media→null; неполный→null; round-trip).

- [ ] **Step 2: Запустить — FAIL.**

- [ ] **Step 3: Реализовать** (дописать в `anchor.ts`):

```ts
import type { TextAnchor } from "@/components/annotation-layer"; // import type — без рантайм-связи

export function toEngineAnchor(a: Anchor): TextAnchor | null {
  if (a.start_sec !== undefined || a.end_sec !== undefined) return null;
  if (!a.start_block_id || !a.end_block_id || !a.exact) return null;
  const e: TextAnchor = { startBlockId: a.start_block_id, endBlockId: a.end_block_id, startChar: a.start_char ?? 0, endChar: a.end_char ?? 0, exact: a.exact };
  if (a.prefix) e.prefix = a.prefix;
  if (a.suffix) e.suffix = a.suffix;
  return e;
}
export function fromEngineAnchor(a: TextAnchor): Anchor {
  return buildTextAnchor({ startBlockId: a.startBlockId, endBlockId: a.endBlockId, startChar: a.startChar, endChar: a.endChar, exact: a.exact, prefix: a.prefix, suffix: a.suffix });
}
```

- [ ] **Step 4: Запустить — PASS.**

- [ ] **Step 5: Commit** `git add src/features/annotations/anchor.ts src/features/annotations/anchor.test.ts && git commit -m "feat(annotations): мапперы annotation.Anchor ↔ TextAnchor"`

---

## Task 14: Снять ручной-fetch стопгап — типизированный клиент (бэк добавил роуты)

**Files:** Modify `src/features/annotations/actions.ts`, `api.ts`, `types.ts`.

> Бэк добавил `/api/{entity}/{id}/annotations` в OpenAPI → `createApiClient()` теперь типизирует эти пути. Снимаем ручной `instrumentedFetch` (по правилу AGENTS «корень починен → убрать обход»).

- [ ] **Step 1: Проверить типизацию роутов.** Убедиться (`grep -n '"/api/documents/{id}/annotations"' src/api/schema.ts`), что `paths` содержит GET+POST для documents/glossary/media/comments. Проверить форму `requestBodies["annotation.CreateRequest"]` и ответы.

- [ ] **Step 2: `createAnnotation` на типизированный клиент.** Заменить ручной `instrumentedFetch` блок в `actions.ts` на:

```ts
const api = await createApiClient();
const path = `/api/${PER_ENTITY_PATH[input.parent_entity_type]}/{id}/annotations` as const;
const { data, error } = await api.POST(path, {
  params: { path: { id: input.parent_entity_id } },
  body: { blocks: input.blocks, visibility: input.visibility, ...(input.anchor !== undefined ? { anchor: input.anchor } : {}) },
  headers: idempotencyHeaders(ctx.idempotencyKey),
});
if (error) rethrowApiError(error, ERRORS);
revalidateEntity(Tags.ANNOTATIONS);
return data?.data ?? null;
```

> Если openapi-fetch не принимает динамический `path` union — развести явным `switch (input.parent_entity_type)` по 4 литеральным путям (документировать как необходимость литералов для типизации). В `ERRORS` добавить только `IDEMPOTENCY_KEY_IN_USE` (ключ каталога errors). **`BLOCKS_HAVE_ANCHORS` (409) НЕ добавлять** — это ошибка редактирования документа (`aststore`, удаление запинённого блока), не создания аннотации; её обрабатывает слайс `documents` (см. spec §9, cross-feature follow-up).

- [ ] **Step 3: `getAnnotationsFor` в `api.ts`** — аналогично на `api.GET(path, { params: { path: { id }, query: { offset, limit } } })`, снять ручной fetch. Сохранить `AnnotationListResult` форму.

- [ ] **Step 4: Регресс** `pnpm test -- src/features/annotations` + `pnpm lint`. Expected: PASS.

- [ ] **Step 5: Commit** `git add src/features/annotations/actions.ts src/features/annotations/api.ts src/features/annotations/types.ts && git commit -m "refactor(annotations): типизированный клиент per-entity роутов (снят ручной-fetch стопгап)"`

---

## Task 15: Форма создания — anchor-проп + onClose

**Files:** Modify `src/features/annotations/ui/annotation-create-form.tsx`.

**Interfaces:** Produces: `AnnotationCreateForm` принимает `anchor?: Anchor` (скрытое поле) и `onSuccess?: () => void` (закрыть модалку при success). Урезанный AST сохраняется (`entityContext="annotation"`).

- [ ] **Step 1: Добавить пропы + скрытое поле + onSuccess.**

В `interface Props` добавить `anchor?: Anchor; onSuccess?: () => void;`. Импорт типа `Anchor`. После hidden-поля `blocks`:
```tsx
{anchor !== undefined && <input type="hidden" name={f("anchor")} value={JSON.stringify(anchor)} />}
```
В существующий `useEffect` успеха (где `router.refresh()`): добавить `props.onSuccess?.()` ПЕРЕД/вместе с refresh, чтобы модалка закрывалась:
```tsx
useEffect(() => {
  if (state.success && state.data?.id) { onSuccess?.(); router.refresh(); }
}, [state, router, onSuccess]);
```

- [ ] **Step 2: Регресс** `pnpm test -- src/features/annotations` + `pnpm lint`.

- [ ] **Step 3: Commit** `git add src/features/annotations/ui/annotation-create-form.tsx && git commit -m "feat(annotations): форма — anchor-проп + onSuccess (закрытие модалки)"`

---

## Task 16: Общий сборщик карточек (DRY) + рефактор AnnotationsSection

**Files:** Create `src/features/annotations/ui/annotation-cards-builder.tsx`; Modify `ui/annotations-section.tsx`.

**Interfaces:** Produces: server-функция `buildAnnotationCards({ items, me, astSchema }) → { id: string; anchor: Anchor | undefined; card: ReactNode }[]` — единая логика сборки `AnnotationCard` с действиями (export/edit/delete), потребляемая `AnnotationsSection` и `DocumentAnnotations`.

- [ ] **Step 1: Вынести сборку** из `annotations-section.tsx` в `annotation-cards-builder.tsx` (server-only функция; та же логика `canEditAnnotation`/действия/`anchorContext`, что сейчас в секции).

```tsx
// src/features/annotations/ui/annotation-cards-builder.tsx
import type { ReactNode } from "react";
import type { Me } from "@/utils/me";
import { canEditAnnotation } from "../permissions";
import type { Anchor, Annotation } from "../types";
import { AnnotationAnchorContext } from "./annotation-anchor-context";
import { AnnotationCard } from "./annotation-card";
import { AnnotationDeleteButton } from "./annotation-delete-button";
import { AnnotationEditButton } from "./annotation-edit-button";
import { AnnotationExportLinks } from "./annotation-export-links";

export interface AnnotationCardVM { id: string; anchor: Anchor | undefined; card: ReactNode }

export function buildAnnotationCards(
  { items, me, astSchema }: { items: Annotation[]; me: Me | null; astSchema: unknown },
): AnnotationCardVM[] {
  return items.filter((a) => Boolean(a.id)).map((a) => {
    const ownEditable = canEditAnnotation(me, a);
    return {
      id: a.id as string,
      anchor: a.anchor,
      card: (
        <AnnotationCard annotation={a} anchorContext={<AnnotationAnchorContext anchor={a.anchor} />}
          actions={<>
            {a.id && <AnnotationExportLinks id={a.id} />}
            {ownEditable && a.id && <>
              <AnnotationEditButton annotation={a} initial={(astSchema as never) ?? undefined} />
              <AnnotationDeleteButton annotationId={a.id} />
            </>}
          </>} />
      ),
    };
  });
}
```

- [ ] **Step 2: `annotations-section.tsx`** — заменить инлайн-сборку `<ul>` на `buildAnnotationCards(...)` + рендер `vm.card` в `<li>`. Поведение (list-режим для glossary/media/comment) не меняется.

- [ ] **Step 3: Регресс** `pnpm test -- src/features/annotations` + `pnpm lint`.

- [ ] **Step 4: Commit** `git add src/features/annotations/ui/annotation-cards-builder.tsx src/features/annotations/ui/annotations-section.tsx && git commit -m "refactor(annotations): общий сборщик карточек (DRY: section + document)"`

---

## Task 17: Модалка-композер (урезанный AST + onClose)

**Files:** Create `src/features/annotations/ui/annotation-composer-dialog.tsx`.

**Interfaces:** Produces: `AnnotationComposerDialog({ parentId, open, onOpenChange, anchor })` — `Dialog` + цитата-контекст + `AnnotationCreateForm` (`entityContext="annotation"` уже в форме) с `onSuccess={() => onOpenChange(false)}`.

- [ ] **Step 1: Реализовать**

```tsx
"use client";
// src/features/annotations/ui/annotation-composer-dialog.tsx
import { Dialog } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { Anchor } from "../types";
import { AnnotationAnchorContext } from "./annotation-anchor-context";
import { AnnotationCreateForm } from "./annotation-create-form";

interface Props { parentId: string; open: boolean; onOpenChange: (open: boolean) => void; anchor?: Anchor }

export function AnnotationComposerDialog({ parentId, open, onOpenChange, anchor }: Props) {
  const t = useT("annotations");
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("marginComposerTitle")}>
      <div className="flex flex-col gap-4">
        {anchor && <AnnotationAnchorContext anchor={anchor} />}
        <AnnotationCreateForm parentEntityType="document" parentId={parentId} anchor={anchor}
          onSuccess={() => { onOpenChange(false); }} />
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 2: Lint** `pnpm lint`.

- [ ] **Step 3: Commit** `git add src/features/annotations/ui/annotation-composer-dialog.tsx && git commit -m "feat(annotations): модалка-композер (урезанный AST + закрытие при success)"`

---

## Task 18: Связка `document-annotation-layer.tsx` + сборщик `document-annotations.tsx`

**Files:** Create `ui/document-annotation-layer.tsx`, `ui/document-annotations.tsx`; Modify `index.ts`.

**Interfaces:**
- `DocumentAnnotationLayer` (client): props `{ parentId; notes: AnnotationCardVM[]; canCreate; astRootSelector? }`. **SSR-фолбэк:** рендерит ВСЕ карточки списком (server-HTML), клиент улучшает позиционирование/подсветку. Получает `astRootRef` через client-обёртку контент-рута (см. Task 19); reading-mode тумблер (`localStorage`); модалка; кнопка «добавить без привязки».
- `DocumentAnnotations` (server): фетч + `buildAnnotationCards` + `SchemaContextProvider` + связка.
- `index.ts`: `export { DocumentAnnotations }`.

- [ ] **Step 1: `document-annotation-layer.tsx`** — ключевое: SSR рендерит карточки ВСЕГДА; `AnnotationLayer` монтируется поверх для позиций/подсветки (не прячет контент).

```tsx
"use client";
// src/features/annotations/ui/document-annotation-layer.tsx
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnnotationLayer, type AnchorDraft, type AnchoredNote } from "@/components/annotation-layer";
import { Button, Inline } from "@/components/ui";
import { useT } from "@/i18n/client";
import { fromEngineAnchor, toEngineAnchor } from "../anchor";
import type { Anchor } from "../types";
import { AnnotationComposerDialog } from "./annotation-composer-dialog";

interface NoteVM { id: string; anchor: Anchor | undefined; card: ReactNode }
interface Props { parentId: string; notes: NoteVM[]; canCreate: boolean }
const KEY = "annotation-highlights";

export function DocumentAnnotationLayer({ parentId, notes, canCreate }: Props) {
  const t = useT("annotations");
  const astRootRef = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [highlight, setHighlight] = useState(true);
  const [composer, setComposer] = useState<{ open: boolean; anchor?: Anchor }>({ open: false });

  useEffect(() => {
    astRootRef.current = document.querySelector<HTMLElement>("[data-ast-root]");
    if (window.localStorage.getItem(KEY) === "off") setHighlight(false);
    setReady(true);
  }, []);

  const toggle = () => setHighlight((h) => { const n = !h; window.localStorage.setItem(KEY, n ? "on" : "off"); return n; });

  const engineNotes: AnchoredNote[] = notes.flatMap((n) => {
    const e = n.anchor ? toEngineAnchor(n.anchor) : null;
    return e ? [{ id: n.id, anchor: e }] : [];
  });
  const cardById = new Map(notes.map((n) => [n.id, n.card]));
  const engineIds = new Set(engineNotes.map((n) => n.id));
  const ssrOnly = notes.filter((n) => !engineIds.has(n.id)); // без якоря/невалидные — всегда списком

  return (
    <div className="flex flex-col gap-4" aria-label={t("marginColumnLabel")}>
      <Inline gap="tight" align="start">
        {canCreate && <Button type="button" compact tone="primary" onClick={() => setComposer({ open: true })}>{t("marginAddUnanchored")}</Button>}
        <Button type="button" compact tone="quiet" onClick={toggle}>{highlight ? t("marginHighlightToggleOn") : t("marginHighlightToggleOff")}</Button>
      </Inline>

      {/* SSR-фолбэк: карточки без движкового якоря — всегда серверным списком. */}
      {ssrOnly.map((n) => <div key={n.id}>{n.card}</div>)}

      {/* Якорённые: на сервере — простой список (фолбэк); на клиенте AnnotationLayer
          их ПОЗИЦИОНИРУЕТ. Чтобы НЕ прятать контент до mount — рендерим список,
          а после ready отдаём те же ноды в AnnotationLayer (он перерисует позиции). */}
      {!ready
        ? engineNotes.map((n) => <div key={n.id}>{cardById.get(n.id)}</div>)
        : (
          <AnnotationLayer
            astRootRef={astRootRef}
            notes={engineNotes}
            renderNote={(n) => cardById.get(n.id) ?? null}
            highlightEnabled={highlight}
            canCreate={canCreate}
            onCreateRequest={(d: AnchorDraft) => setComposer({ open: true, anchor: fromEngineAnchor(d.anchor) })}
            affordanceLabel={t("marginAddButton")}
          />
        )}

      <AnnotationComposerDialog parentId={parentId} open={composer.open}
        onOpenChange={(open) => setComposer((c) => ({ ...c, open }))} anchor={composer.anchor} />
    </div>
  );
}
```

> **SSR-инвариант:** на server-проходе (`ready=false`) якорённые карточки рендерятся обычным списком → есть в HTML (SEO/no-JS). Клиент после mount заменяет на позиционированный `AnnotationLayer` — улучшение, не создание. (Hydration: первый client-рендер тоже `ready=false`, совпадает с SSR; `ready=true` — следующий тик.)

- [ ] **Step 2: `document-annotations.tsx` (server)**

```tsx
// src/features/annotations/ui/document-annotations.tsx
import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";
import { getAnnotationsFor } from "../api";
import { canCreateAnnotation, canEditAnnotation } from "../permissions";
import { buildAnnotationCards } from "./annotation-cards-builder";
import { DocumentAnnotationLayer } from "./document-annotation-layer";

export async function DocumentAnnotations({ parentId }: { parentId: string }) {
  const [me, t] = await Promise.all([getMe(), getT("annotations")]);
  const { items } = await getAnnotationsFor("document", parentId);
  const canCreate = canCreateAnnotation(me);
  const needsSchema = canCreate || items.some((a) => Boolean(a.id) && canEditAnnotation(me, a));
  const astSchema = needsSchema ? await getAstSchema() : null;
  const notes = buildAnnotationCards({ items, me, astSchema });

  return (
    <section className="flex flex-col gap-4" aria-label={t("sectionLabel")}>
      <h2 className="text-lg font-semibold">{t("sectionHeading")}</h2>
      <SchemaContextProvider initial={astSchema ?? undefined} fallback={<p className="text-sm">{t("editorLoading")}</p>}>
        <DocumentAnnotationLayer parentId={parentId} notes={notes} canCreate={canCreate} />
      </SchemaContextProvider>
    </section>
  );
}
```

- [ ] **Step 3: `index.ts`** — `export { DocumentAnnotations } from "./ui/document-annotations";`

- [ ] **Step 4: Lint** `pnpm lint` (Guardrail 4: `document-annotation-layer.tsx` client импортит только `../anchor` (pure type+fn), `../types`, движок, kit, i18n/client — НЕ api/actions/permissions/schemas).

- [ ] **Step 5: Commit** `git add src/features/annotations/ui/document-annotation-layer.tsx src/features/annotations/ui/document-annotations.tsx src/features/annotations/index.ts && git commit -m "feat(annotations): связка движок↔домен (SSR-фолбэк карточек + reading-mode)"`

---

## Task 19: i18n-ключи

**Files:** Modify `src/i18n/messages/{ru,en,ar,zh}/annotations.ts`.

**Interfaces:** Ключи: `marginAddButton`, `marginAddUnanchored`, `marginComposerTitle`, `marginOrphanLabel`, `marginHighlightToggleOn`, `marginHighlightToggleOff`, `marginColumnLabel`.

- [ ] **Step 1: ru** — добавить блок (значения см. таблицу ниже).
- [ ] **Step 2: en / ar / zh** — те же ключи.

| key | ru | en | ar | zh |
|---|---|---|---|---|
| marginAddButton | Аннотация | Annotate | تعليق | 批注 |
| marginAddUnanchored | Добавить аннотацию | Add annotation | إضافة تعليق | 添加批注 |
| marginComposerTitle | Новая аннотация | New annotation | تعليق جديد | 新批注 |
| marginOrphanLabel | Фрагмент не найден | Fragment not found | لم يتم العثور على المقطع | 未找到片段 |
| marginHighlightToggleOn | Скрыть подсветку | Hide highlights | إخفاء التظليل | 隐藏高亮 |
| marginHighlightToggleOff | Показать подсветку | Show highlights | إظهار التظليل | 显示高亮 |
| marginColumnLabel | Аннотации на полях | Margin annotations | تعليقات الهامش | 页边批注 |

- [ ] **Step 3: Проверка паритета (i18n-тест НЕ ловит забытый плоский ключ):**

Run: `grep -c "marginAddButton" src/i18n/messages/*/annotations.ts`
Expected: каждый из ru/en/ar/zh = 1 (pseudo — авто из en, не трогать). Затем `pnpm test -- i18n`.

- [ ] **Step 4: Commit** `git add src/i18n/messages/ru/annotations.ts src/i18n/messages/en/annotations.ts src/i18n/messages/ar/annotations.ts src/i18n/messages/zh/annotations.ts && git commit -m "feat(i18n): ключи движка маргиналий (4 локали)"`

---

## Task 20: Монтаж на странице + браузер/тач/RTL/a11y-QA

**Files:** Modify `src/app/documents/[id]/page.tsx`.

- [ ] **Step 1: Обернуть контент + свапнуть секцию в правое поле.**

1. Импорт: `import { DocumentAnnotations } from "@/features/annotations";` (вместо `AnnotationsSection`).
2. **Обернуть `<DocumentDetail>` в `<div data-ast-root>`** (page-level, НЕ в documents-слайсе): `AstRender` рендерит фрагмент без обёртки, поэтому маркер ставится на странице. Связка (Task 18) ищет `[data-ast-root]`. Обёртка — нейтральный flex-child в основном `<div className="flex flex-col gap-8 p-6">`, `.content`-flow внутри `DocumentDetail` не затрагивает:

```tsx
<div data-ast-root>
  <DocumentDetail document={document} />
</div>
```
3. Убрать блок `<Suspense><AnnotationsSection .../></Suspense>` из основного `<div>`.
4. Заменить хинт-`MarginNote`:

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

- [ ] **Step 2: Полный прогон.** `pnpm test` (PASS, вкл. ядро движка) · `pnpm build` (OK) · `pnpm lint` (чисто).

- [ ] **Step 3: Commit** `git add "src/app/documents/[id]/page.tsx" && git commit -m "feat(documents): монтаж движка аннотаций (правое поле, data-ast-root)"`

- [ ] **Step 4: Ручной QA** (локальный стек: бэк `make run-local` :8090, фронт `pnpm dev` :3001, dev/admin12345). Документ с непустым телом:
  - **Мышь (desktop ≥1280px):** выделить → кнопка «Аннотация» → модалка с цитатой + урезанный редактор (без таблиц/картинок) → сохранить → карточка справа на высоте фрагмента; фрагмент подсвечен; модалка закрылась; список обновился.
  - **Раздвижка:** близкие якоря → карточки не наезжают.
  - **Двусторонний клик:** клик по подсветке → активная карточка + скролл; клик по карточке → скролл/активная подсветка фрагмента.
  - **Тач (телефон/эмуляция):** long-press выделение → кнопка появляется (`selectionchange`); создание работает.
  - **Клавиатура:** Shift+стрелки выделение → кнопка появляется; путь создания доступен.
  - **Reading-mode:** тумблер прячет подсветку; переживает перезагрузку.
  - **Узкий экран (<1280px):** колонка уходит списком вниз; абсолют не применяется; подсветка работает.
  - **RTL (`ar`):** поле слева; тултип/подсветка/многострочное выделение корректны.
  - **AST-гард:** выделение, начатое в тексте и ушедшее в карточку/сайдбар → кнопка НЕ появляется.
  - **Appearance:** сменить ось шрифта/плотности → карточки пересчитали позиции (ResizeObserver).
  - **Фолбэк:** в браузере без CSS Highlight API (или заглушив) — оверлей-прямоугольники рисуют подсветку.
  - **AT:** скринридер читает SSR-список карточек + цитаты (аннотированность в семантике, не только в пикселе).

  Найденные визуальные дефекты позиционирования — фиксировать как follow-up (не покрыты автотестами).

---

## Self-Review

**Покрытие находок ревью:**
- Offset units (был Blocker) → §Global Constraints + Task 2: UTF-16 подтверждён контрактом, тесты с кириллицей/эмодзи. ✓
- Позиционирование (был Blocker) → Task 11: референс-контейнер `topCSS = rect.top − colTop`, ResizeObserver/fonts (Task 12), narrow-гард matchMedia, min-height-распорка. ✓
- Тач/клавиатура (был Blocker) → Task 9: selectionchange + pointerup/touchend. ✓
- CSS.escape (был Blocker) → Task 4: escapeId guard + тест. ✓
- SSR-фолбэк → Task 18: карточки рендерятся серверно при `ready=false`. ✓
- Двусторонний клик → Task 6 (hit-test) + Task 12 (wiring) + reduced-motion (scrollIntoView/scrollTo). ✓
- findQuote дизамбигуация → Task 4: вырезание exact внутри контекста + тест дубликатов. ✓
- data-block-id на table → Task 7: НЕ ставить. ✓
- AST-субстрат устрожение → Task 3 (гард) + Task 7 (data-ast-root) + §7.1 спеки. ✓
- Оверлей-фолбэк → Task 10 (обязателен). ✓
- Active 2-й канал → Task 5 + Task 8 (underline). ✓
- Highlight-токен → Task 8: `--color-highlight` + APCA-пара. ✓
- DRY сборщик → Task 16. ✓
- Create-flow модалка → Task 15 (onSuccess) + Task 17. ✓
- Per-entity роуты / стопгап → Task 14. ✓
- Урезанный AST → Task 17 (entityContext="annotation" в форме). ✓
- i18n ложная зелёнка → Task 19 (grep-проверка). ✓

**Placeholder-скан:** условные ветки исполнения («если openapi-fetch не принимает union — switch»; «проверить имя scripts токенов») — реальные развилки с указанием действия, не TBD. Код в шагах конкретный.

**Type-consistency:** `TextAnchor`/`AnchoredNote`/`AnchorDraft` (T1) согласованы по T3/4/6/12/13. `StackItem`/`resolveStack→{tops,totalHeight}` (T1) → T11. `HighlightController` (T5) → T12. `AnnotationLayerProps.astRootRef` (T12) ↔ вызов в T18. `buildAnnotationCards→AnnotationCardVM` (T16) ↔ потребление T18/T20. `noteAtPoint`/`noteContainingCaret` (T6) → T12. Имена согласованы. ✓

**Известные ограничения v1 (зафиксированы, §13 спеки):** перекрытия аннотаций — плоское объединение; печать — на SSR-списке; позиционная геометрия — ручной QA (jsdom не даёт layout).
