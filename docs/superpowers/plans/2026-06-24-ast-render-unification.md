# AST Render Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Устранить дублирование node→DOM между edit (Tiptap `renderHTML`) и read (самописный server-сериализатор) — ввести один framework-нейтральный источник маппинга, из которого выводятся оба потребителя.

**Architecture:** Нейтральный модуль `src/components/ast-content-map/` экспортирует `NODE_MAP`/`MARK_MAP` — чистые функции `AstNode → NeutralSpec` (вложенный hyperscript `[tag, attrs, ...children]` с сентинелом `HOLE` для контента, структурно = ProseMirror `DOMOutputSpec`). Два тонких адаптера читают эти карты: READ-адаптер (`ast-render`, React, zero-JS) интерпретирует `NeutralSpec` рекурсивно; EDIT-адаптер (extensions' `renderHTML`) возвращает `NeutralSpec` напрямую как `DOMOutputSpec`. Media-specific вещи (read: link-санитайз, `<th>` для header-строк, image lazy/guard; edit: nodeView image) **доклеиваются** поверх общей структуры — байт-идентичность не цель.

**Tech Stack:** Next.js App Router (RSC), TypeScript, Tiptap v3 / ProseMirror, React server components, Vitest + @testing-library/react, pnpm, ESLint flat config.

## Global Constraints

- Пакетный менеджер — **pnpm** (НЕ npm). Гейт перед PR: `pnpm lint && pnpm test && pnpm build`.
- **Новых зависимостей в `package.json` НЕ добавлять** (охраняемая foundation-зона). Это решение их не требует.
- Параллельные агенты: коммитить только свои файлы по имени (`git add <file>` + `git commit --only <file>`), без `git add -A`/`-.`; без `git stash/reset/checkout .`/`clean`; **без push** (push за пользователем).
- Именование файлов в `src/` — kebab-case.
- **DOM-субстрат-контракт аннотаций (байт-в-байт, инвариант):** `data-block-id` — ТОЛЬКО на текст-блоках (paragraph, heading, list, list_item, blockquote, code_block, thematic_break); **НЕ** на `<table>`, **НЕ** оборачивая `<image>`. plaintext блока = конкатенация text-узлов, `<br>`→`\n`. Вывод READ = **прямые дети** `.content`, **без обёртки**.
- `data-block-id` эмитится через маппинг (`getAttrs`/`renderHTML`), НЕ через ProseMirror-плагин.
- Границы модулей: `ast-content-map/*` не импортирует React/Tiptap/ProseMirror; `ast-render/*` не импортирует Tiptap/ProseMirror/`ast-editor`; `ast-editor/*` не импортирует `ast-render`.
- Субагентам-имплементерам — модель **opus**, не haiku.

---

## File Structure

**Новый нейтральный модуль:**
- `src/components/ast-content-map/types.ts` — `HOLE`, `NeutralSpec`, `NeutralChild`, ре-экспорт AST-типов из `@/api/schema`.
- `src/components/ast-content-map/attrs.ts` — чистые хелперы атрибутов (`blockIdAttr`, `headingTag`, `cellAlignAttr`, `imageSpec`, `linkAttrs`, `navRefAttrs`).
- `src/components/ast-content-map/node-map.ts` — `NODE_MAP: Partial<Record<AstNodeType, NodeRenderer>>`.
- `src/components/ast-content-map/mark-map.ts` — `MARK_MAP: Partial<Record<AstMarkType, MarkRenderer>>`.
- `src/components/ast-content-map/index.ts` — публичный barrel.

**EDIT-адаптер:**
- `src/components/ast-editor/extensions/render-from-map.ts` — `domSpecFromNode(node)`, `domSpecFromMark(mark)` (NeutralSpec → DOMOutputSpec).
- Модификация всех `src/components/ast-editor/extensions/nodes/*.ts` и `marks/*.ts` — `renderHTML` делегирует в адаптер.

**READ-адаптер (переписывается):**
- `src/components/ast-render/spec-to-react.tsx` — рекурсивный интерпретатор `NeutralSpec → ReactNode`.
- `src/components/ast-render/block-renderer.tsx`, `inline-renderer.tsx` — переписаны на карты; ctx удаляется.
- `src/components/ast-render/ast-render.tsx`, `types.ts` — ctx удаляется.
- Удаляются: `src/components/ast-render/nodes/image.tsx`, `src/components/ast-render/marks/{link,glossary-ref,document-ref,media-ref,comment-ref,canvas-ref}.tsx` (логика переезжает в карты).

**Тесты:** рядом с источниками (`*.test.ts(x)`); ESLint-guard в `eslint.config.mjs`.

---

## Task 1: СПАЙК — нейтральная карта + оба адаптера на вертикальном срезе (DECISION GATE)

Цель: доказать механизм и **развязку** (READ-путь не тянет Tiptap-типы; EDIT `renderHTML` возвращает спеку из карты) на paragraph + heading + марках bold/link/glossary_ref. По итогу — решение: full-share (продолжаем Tasks 2-7) ИЛИ fallback (карта питает только READ, EDIT остаётся на своём renderHTML, Task 5 заменяется на parity-тест-страж).

**Files:**
- Create: `src/components/ast-content-map/types.ts`
- Create: `src/components/ast-content-map/attrs.ts`
- Create: `src/components/ast-content-map/node-map.ts`
- Create: `src/components/ast-content-map/mark-map.ts`
- Create: `src/components/ast-content-map/index.ts`
- Create: `src/components/ast-render/spec-to-react.tsx`
- Test: `src/components/ast-content-map/spec-to-react.test.tsx`
- Test: `src/components/ast-content-map/edit-parity.test.ts`

**Interfaces:**
- Produces:
  - `HOLE = 0 as const`; `type Hole = typeof HOLE`.
  - `type NeutralChild = NeutralSpec | Hole | string`.
  - `type NeutralSpec = [tag: string, attrs: Record<string, string>, ...children: NeutralChild[]]`.
  - `type AstBlock/AstNode/AstMark/AstNodeType/AstMarkType` (ре-экспорт из `@/api/schema`).
  - `type NodeRenderer = (node: AstNode) => NeutralSpec`.
  - `type MarkRenderer = (mark: AstMark) => [tag: string, attrs: Record<string, string>] | null`.
  - `NODE_MAP`, `MARK_MAP` (частичные на старте).
  - `specToReact(spec: NeutralChild, children: ReactNode, keyHint?: string): ReactNode`.

- [ ] **Step 1: Создать типы нейтральной спеки**

`src/components/ast-content-map/types.ts`:

```ts
import type { components } from "@/api/schema";

export type AstBlock = components["schemas"]["ast.Block"];
export type AstNode = components["schemas"]["ast.Node"];
export type AstMark = components["schemas"]["ast.Mark"];
export type AstNodeType = components["schemas"]["ast.NodeType"];
export type AstMarkType = components["schemas"]["ast.MarkType"];

/** Сентинел "сюда идут дети" — совпадает с ProseMirror DOMOutputSpec hole. */
export const HOLE = 0 as const;
export type Hole = typeof HOLE;

export type NeutralChild = NeutralSpec | Hole | string;
/** Всегда [tag, attrs, ...children]. Лист: [tag, attrs]. Контейнер: [tag, attrs, HOLE]. */
export type NeutralSpec = [tag: string, attrs: Record<string, string>, ...children: NeutralChild[]];

export type NodeRenderer = (node: AstNode) => NeutralSpec;
export type MarkRenderer = (mark: AstMark) => [tag: string, attrs: Record<string, string>] | null;
```

- [ ] **Step 2: Чистые хелперы атрибутов (срез)**

`src/components/ast-content-map/attrs.ts`:

```ts
import type { AstNode, AstMark } from "./types";

/** data-block-id ТОЛЬКО для текст-блоков. node.attrs.blockId кладёт deserializer. */
export function blockIdAttr(node: AstNode): Record<string, string> {
  const id = (node.attrs as { blockId?: unknown } | undefined)?.blockId;
  return typeof id === "string" && id.length > 0 ? { "data-block-id": id } : {};
}

export function headingTag(node: AstNode): string {
  const raw = (node.attrs as { level?: unknown } | undefined)?.level;
  const lvl = typeof raw === "number" && raw >= 1 && raw <= 6 ? raw : 2;
  return `h${lvl}`;
}

/** Базовые атрибуты ссылки (структура). Санитайз — read-only enhancement (см. spec-to-react). */
export function linkAttrs(mark: AstMark): Record<string, string> {
  const href = (mark.attrs as { href?: unknown } | undefined)?.href;
  return typeof href === "string" && href.length > 0 ? { href } : {};
}

const REF_PREFIX: Record<string, string> = {
  glossary_ref: "/glossary/",
  document_ref: "/documents/",
  media_ref: "/media/",
  comment_ref: "/comments/",
  canvas_ref: "/canvases/",
};

/** nav-ref → <a href из id>. Решение: <a> в edit И read. Возвращает null если id пуст. */
export function navRefAttrs(mark: AstMark): Record<string, string> | null {
  const type = mark.type as string | undefined;
  const id = (mark.attrs as { id?: unknown } | undefined)?.id;
  if (!type || !(type in REF_PREFIX) || typeof id !== "string" || id.length === 0) return null;
  return { href: REF_PREFIX[type] + id, "data-mark": type, class: `nav-ref nav-ref--${type}` };
}
```

- [ ] **Step 3: NODE_MAP / MARK_MAP (срез: paragraph, heading; bold, link, glossary_ref)**

`src/components/ast-content-map/node-map.ts`:

```ts
import { blockIdAttr, headingTag } from "./attrs";
import { HOLE, type AstNodeType, type NodeRenderer } from "./types";

export const NODE_MAP: Partial<Record<AstNodeType, NodeRenderer>> = {
  paragraph: (node) => ["p", blockIdAttr(node), HOLE],
  heading: (node) => [headingTag(node), blockIdAttr(node), HOLE],
};
```

`src/components/ast-content-map/mark-map.ts`:

```ts
import { linkAttrs, navRefAttrs } from "./attrs";
import type { AstMarkType, MarkRenderer } from "./types";

export const MARK_MAP: Partial<Record<AstMarkType, MarkRenderer>> = {
  bold: () => ["strong", {}],
  link: (mark) => ["a", linkAttrs(mark)],
  glossary_ref: (mark) => { const a = navRefAttrs(mark); return a ? ["a", a] : null; },
};
```

`src/components/ast-content-map/index.ts`:

```ts
export * from "./types";
export { NODE_MAP } from "./node-map";
export { MARK_MAP } from "./mark-map";
export * as attrs from "./attrs";
```

- [ ] **Step 4: READ-адаптер `specToReact` (рекурсивный интерпретатор)**

`src/components/ast-render/spec-to-react.tsx`:

```tsx
import { createElement, type ReactNode } from "react";

import { HOLE, type NeutralChild, type NeutralSpec } from "@/components/ast-content-map";

/** NeutralSpec → ReactNode. HOLE заменяется на `children`. attrs.class → className. */
export function specToReact(spec: NeutralChild, children: ReactNode, keyHint?: string): ReactNode {
  if (spec === HOLE) return children;
  if (typeof spec === "string") return spec;
  const [tag, attrs, ...kids] = spec as NeutralSpec;
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) props[k === "class" ? "className" : k] = v;
  if (keyHint != null) props.key = keyHint;
  const renderedKids = kids.map((k, i) => specToReact(k, children, String(i)));
  return createElement(tag, props, kids.length > 0 ? renderedKids : undefined);
}
```

- [ ] **Step 5: Тест READ-адаптера — написать падающий**

`src/components/ast-content-map/spec-to-react.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { NODE_MAP, MARK_MAP } from "@/components/ast-content-map";
import { specToReact } from "@/components/ast-render/spec-to-react";

describe("specToReact + NODE_MAP/MARK_MAP (срез)", () => {
  it("paragraph → <p data-block-id> с контентом в HOLE", () => {
    const spec = NODE_MAP.paragraph!({ type: "paragraph", attrs: { blockId: "b1" } });
    const { container } = render(<>{specToReact(spec, "текст")}</>);
    const p = container.querySelector("p");
    expect(p?.getAttribute("data-block-id")).toBe("b1");
    expect(p?.textContent).toBe("текст");
  });

  it("heading level 3 → <h3>", () => {
    const spec = NODE_MAP.heading!({ type: "heading", attrs: { level: 3, blockId: "h1" } });
    const { container } = render(<>{specToReact(spec, "Заголовок")}</>);
    expect(container.querySelector("h3")?.getAttribute("data-block-id")).toBe("h1");
  });

  it("glossary_ref mark → <a href=/glossary/{id} class=nav-ref>", () => {
    const m = MARK_MAP.glossary_ref!({ type: "glossary_ref", attrs: { id: "g42" } })!;
    const { container } = render(<>{specToReact([...m, "Бытие"], null)}</>);
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/glossary/g42");
    expect(a?.className).toBe("nav-ref nav-ref--glossary_ref");
    expect(a?.textContent).toBe("Бытие");
  });
});
```

- [ ] **Step 6: Прогнать — убедиться, что падает**

Run: `pnpm vitest run src/components/ast-content-map/spec-to-react.test.tsx`
Expected: FAIL (модули ещё не собраны/не экспортированы корректно — например `specToReact is not a function` или ошибка импорта).

- [ ] **Step 7: Довести Steps 1-4 до зелёного теста**

Run: `pnpm vitest run src/components/ast-content-map/spec-to-react.test.tsx`
Expected: PASS (3 теста).

- [ ] **Step 8: Тест EDIT-развязки — `renderHTML` возвращает NeutralSpec из карты**

Цель спайка — доказать, что editor `renderHTML` может вернуть `NODE_MAP[type](pseudoNode)` как `DOMOutputSpec`, не протащив Tiptap-типы в `ast-content-map`. `src/components/ast-content-map/edit-parity.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import { NODE_MAP } from "@/components/ast-content-map";

// Эмуляция вызова из renderHTML: PM-нода даёт {type:{name}, attrs}. Адаптер строит
// pseudo-AstNode {type:name, attrs} и зовёт NODE_MAP. Возврат = валидный DOMOutputSpec.
function renderHTMLViaMap(name: string, attrs: Record<string, unknown>) {
  const r = NODE_MAP[name as keyof typeof NODE_MAP];
  if (!r) throw new Error(`no map entry for ${name}`);
  return r({ type: name, attrs } as never);
}

describe("EDIT-адаптер: NODE_MAP → DOMOutputSpec без Tiptap-типов", () => {
  it("paragraph renderHTML = ['p', {data-block-id}, 0]", () => {
    expect(renderHTMLViaMap("paragraph", { blockId: "b1" })).toEqual(["p", { "data-block-id": "b1" }, 0]);
  });
  it("heading уважает level", () => {
    expect(renderHTMLViaMap("heading", { level: 3, blockId: "h1" })).toEqual([
      "h3", { "data-block-id": "h1" }, 0,
    ]);
  });
  it("HOLE === 0 (контракт DOMOutputSpec content-hole)", async () => {
    const { HOLE } = await import("@/components/ast-content-map");
    expect(HOLE).toBe(0);
  });
});
```

- [ ] **Step 9: Прогнать оба теста — зелёные**

Run: `pnpm vitest run src/components/ast-content-map`
Expected: PASS (все). Подтверждает: один источник (`NODE_MAP`) корректно интерпретируется READ-адаптером и структурно тождествен `DOMOutputSpec` для EDIT — **развязка чистая**.

- [ ] **Step 10: GATE-решение (зафиксировать в плане комментарием при исполнении)**

Если Step 8/9 зелёные и `ast-content-map` НЕ импортирует Tiptap → **full-share, продолжаем Tasks 2-7**.
Если в реальном EDIT-узле (Task 5) `renderHTML` не сможет вызвать карту без протечки редакторных типов в read-путь → **fallback**: карта остаётся источником для READ, EDIT-узлы НЕ трогаем (Task 5 → только parity-тест-страж в Task 6). Линтер `pnpm lint` на `ast-content-map` обязан быть чистым от `@tiptap`/`prosemirror` импортов.

- [ ] **Step 11: Commit**

```bash
git add src/components/ast-content-map/types.ts src/components/ast-content-map/attrs.ts \
  src/components/ast-content-map/node-map.ts src/components/ast-content-map/mark-map.ts \
  src/components/ast-content-map/index.ts src/components/ast-render/spec-to-react.tsx \
  src/components/ast-content-map/spec-to-react.test.tsx src/components/ast-content-map/edit-parity.test.ts
git commit --only src/components/ast-content-map/types.ts src/components/ast-content-map/attrs.ts \
  src/components/ast-content-map/node-map.ts src/components/ast-content-map/mark-map.ts \
  src/components/ast-content-map/index.ts src/components/ast-render/spec-to-react.tsx \
  src/components/ast-content-map/spec-to-react.test.tsx src/components/ast-content-map/edit-parity.test.ts \
  -m "feat(ast-content-map): спайк нейтральной карты node→DOM + READ/EDIT-адаптеры

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Простые блок-узлы и марки в карты

**Files:**
- Modify: `src/components/ast-content-map/node-map.ts`
- Modify: `src/components/ast-content-map/mark-map.ts`
- Modify: `src/components/ast-content-map/attrs.ts`
- Test: `src/components/ast-content-map/node-map.test.ts`

**Interfaces:**
- Consumes: `NODE_MAP`, `MARK_MAP`, `HOLE`, `blockIdAttr` (Task 1).
- Produces: `NODE_MAP` пополнен `blockquote, thematic_break, list, list_item`; `MARK_MAP` пополнен `italic, code`; `attrs.listAttrs`, `attrs.listItemAttrs`.

- [ ] **Step 1: Хелперы списков в `attrs.ts` (добавить)**

```ts
export function listAttrs(node: AstNode): Record<string, string> {
  const a = node.attrs as { ordered?: unknown; start?: unknown } | undefined;
  const ordered = a?.ordered === true;
  return {
    ...blockIdAttr(node),
    "data-list": "",
    ...(ordered && a?.start != null ? { start: String(a.start) } : {}),
  };
}

export function listItemAttrs(node: AstNode): Record<string, string> {
  const checked = (node.attrs as { checked?: unknown } | undefined)?.checked;
  return typeof checked === "boolean" ? { "data-checked": checked ? "true" : "false" } : {};
}
```

- [ ] **Step 2: Пополнить NODE_MAP**

В `node-map.ts` добавить в объект (импортнуть `listAttrs`, `listItemAttrs`):

```ts
  blockquote: (node) => ["blockquote", blockIdAttr(node), HOLE],
  thematic_break: (node) => ["hr", blockIdAttr(node)],
  list: (node) => [(node.attrs as { ordered?: unknown })?.ordered === true ? "ol" : "ul", listAttrs(node), HOLE],
  list_item: (node) => ["li", listItemAttrs(node), HOLE],
```

- [ ] **Step 3: Пополнить MARK_MAP**

```ts
  italic: () => ["em", {}],
  code: () => ["code", { dir: "ltr" }],
```

- [ ] **Step 4: Тест — написать**

`src/components/ast-content-map/node-map.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import { NODE_MAP, MARK_MAP, HOLE } from "@/components/ast-content-map";

describe("NODE_MAP — простые блоки", () => {
  it("blockquote → контейнер с data-block-id", () => {
    expect(NODE_MAP.blockquote!({ type: "blockquote", attrs: { blockId: "q1" } }))
      .toEqual(["blockquote", { "data-block-id": "q1" }, HOLE]);
  });
  it("thematic_break → лист <hr> без HOLE", () => {
    expect(NODE_MAP.thematic_break!({ type: "thematic_break", attrs: { blockId: "t1" } }))
      .toEqual(["hr", { "data-block-id": "t1" }]);
  });
  it("ordered list → ol с data-list и start", () => {
    expect(NODE_MAP.list!({ type: "list", attrs: { ordered: true, start: 3, blockId: "l1" } }))
      .toEqual(["ol", { "data-block-id": "l1", "data-list": "", start: "3" }, HOLE]);
  });
  it("bullet list → ul без start", () => {
    expect(NODE_MAP.list!({ type: "list", attrs: { ordered: false, blockId: "l2" } }))
      .toEqual(["ul", { "data-block-id": "l2", "data-list": "" }, HOLE]);
  });
  it("list_item с checked → data-checked", () => {
    expect(NODE_MAP.list_item!({ type: "list_item", attrs: { checked: true } }))
      .toEqual(["li", { "data-checked": "true" }, HOLE]);
  });
});

describe("MARK_MAP — простые марки", () => {
  it("italic → em", () => expect(MARK_MAP.italic!({ type: "italic" })).toEqual(["em", {}]));
  it("code → code dir=ltr", () => expect(MARK_MAP.code!({ type: "code" })).toEqual(["code", { dir: "ltr" }]));
});
```

- [ ] **Step 5: Прогнать — зелёные**

Run: `pnpm vitest run src/components/ast-content-map/node-map.test.ts`
Expected: PASS (7 тестов).

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-content-map/node-map.ts src/components/ast-content-map/mark-map.ts \
  src/components/ast-content-map/attrs.ts src/components/ast-content-map/node-map.test.ts
git commit --only src/components/ast-content-map/node-map.ts src/components/ast-content-map/mark-map.ts \
  src/components/ast-content-map/attrs.ts src/components/ast-content-map/node-map.test.ts \
  -m "feat(ast-content-map): простые блок-узлы (blockquote/hr/list/list_item) и марки (italic/code)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Композитные узлы — code_block, image, table-дерево

Композитные узлы выражаются вложенной `NeutralSpec`. **Важно:** read-only enhancements (image guard/lazy; `<th>` для header-строк) живут в READ-адаптере (Task 4), а НЕ в карте — карта даёт общую структуру.

**Files:**
- Modify: `src/components/ast-content-map/node-map.ts`
- Modify: `src/components/ast-content-map/attrs.ts`
- Test: `src/components/ast-content-map/composite.test.ts`

**Interfaces:**
- Consumes: `resolveStorageUrl` из `@/utils/storage-url`, `STORAGE_KEY_RE`.
- Produces: `NODE_MAP` пополнен `code_block, image, table, table_row, table_cell`; `attrs.imageChildren(node)`, `attrs.cellAlignAttr(node)`, `attrs.codeBlockAttrs(node)`.

- [ ] **Step 1: Подтвердить STORAGE_KEY_RE экспортируется**

Прочитать `src/utils/storage-url.ts`. Если `STORAGE_KEY_RE` (regex `/^[0-9a-f]{64}$/i`) не экспортирован — экспортировать его:

```ts
export const STORAGE_KEY_RE = /^[0-9a-f]{64}$/i;
```

(Файл `src/utils/*` — общая инфра; правка минимальна: только `export` существующей константы. Если её нет — добавить рядом с `resolveStorageUrl`. Флагнуть в PR как foundation-touch.)

- [ ] **Step 2: Хелперы композитов в `attrs.ts`**

```ts
import { resolveStorageUrl, STORAGE_KEY_RE } from "@/utils/storage-url";
import { HOLE, type NeutralChild } from "./types";

export function codeBlockAttrs(node: AstNode): Record<string, string> {
  const lang = (node.attrs as { language?: unknown } | undefined)?.language;
  return {
    ...blockIdAttr(node),
    dir: "ltr",
    ...(typeof lang === "string" && lang.length > 0 ? { "data-language": lang } : {}),
  };
}

export function cellAlignAttr(node: AstNode): Record<string, string> {
  const a = (node.attrs as { align?: unknown } | undefined)?.align;
  return a === "left" || a === "center" || a === "right" ? { "data-align": a } : {};
}

/** Дети <figure>: <img> (если валиден storage_key) + опц. <figcaption>. */
export function imageChildren(node: AstNode): NeutralChild[] {
  const a = node.attrs as { storage_key?: unknown; alt?: unknown; caption?: unknown } | undefined;
  const key = a?.storage_key;
  const out: NeutralChild[] = [];
  if (typeof key === "string" && STORAGE_KEY_RE.test(key)) {
    out.push(["img", {
      src: resolveStorageUrl(key),
      alt: typeof a?.alt === "string" ? a.alt : "",
      loading: "lazy",
    }]);
  }
  if (typeof a?.caption === "string" && a.caption.length > 0) {
    out.push(["figcaption", {}, a.caption]);
  }
  return out;
}
```

> NB. `loading="lazy"` и guard — общая структура; в edit это безвредно (nodeView перекрывает вид картинки в редакторе). Решение зафиксировано: image-структура общая, editing-chrome поверх через nodeView (Task 5 image не трогает nodeView).

- [ ] **Step 3: Пополнить NODE_MAP композитами**

```ts
  code_block: (node) => ["pre", codeBlockAttrs(node), ["code", {}, HOLE]],
  // image: НЕ несёт data-block-id (контракт аннотаций). Лист с вычисленными детьми.
  image: (node) => ["figure", {}, ...imageChildren(node)],
  // table: БЕЗ data-block-id. tbody-обёртка, дети-строки в HOLE.
  table: () => ["table", {}, ["tbody", {}, HOLE]],
  table_row: (node) => ["tr", (node.attrs as { header?: unknown })?.header === true ? { "data-header": "true" } : {}, HOLE],
  // table_cell: базово <td>. READ-адаптер апгрейдит до <th scope=col> в header-строке
  // (per-node renderHTML редактора не знает родителя → th только в read).
  table_cell: (node) => ["td", cellAlignAttr(node), HOLE],
```

- [ ] **Step 4: Тест композитов — написать**

`src/components/ast-content-map/composite.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import { NODE_MAP, HOLE } from "@/components/ast-content-map";

const KEY = "a".repeat(64); // валидный 64-hex

describe("NODE_MAP — композиты", () => {
  it("code_block → pre>code, dir=ltr, data-language, data-block-id", () => {
    expect(NODE_MAP.code_block!({ type: "code_block", attrs: { language: "ts", blockId: "c1" } }))
      .toEqual(["pre", { "data-block-id": "c1", dir: "ltr", "data-language": "ts" }, ["code", {}, HOLE]]);
  });
  it("image → figure>img(+figcaption), БЕЗ data-block-id", () => {
    const spec = NODE_MAP.image!({ type: "image", attrs: { storage_key: KEY, alt: "A", caption: "Cap", blockId: "i1" } });
    expect(spec[0]).toBe("figure");
    expect(spec[1]).toEqual({}); // нет data-block-id на image
    expect(spec[2]).toEqual(["img", { src: expect.stringContaining(KEY), alt: "A", loading: "lazy" }]);
    expect(spec[3]).toEqual(["figcaption", {}, "Cap"]);
  });
  it("image с невалидным key → figure без img", () => {
    const spec = NODE_MAP.image!({ type: "image", attrs: { storage_key: "bad", blockId: "i2" } });
    expect(spec).toEqual(["figure", {}]);
  });
  it("table → table>tbody, БЕЗ data-block-id", () => {
    expect(NODE_MAP.table!({ type: "table", attrs: { blockId: "tb1" } }))
      .toEqual(["table", {}, ["tbody", {}, HOLE]]);
  });
  it("header-строка → tr data-header", () => {
    expect(NODE_MAP.table_row!({ type: "table_row", attrs: { header: true } }))
      .toEqual(["tr", { "data-header": "true" }, HOLE]);
  });
  it("ячейка с align → td data-align", () => {
    expect(NODE_MAP.table_cell!({ type: "table_cell", attrs: { align: "center" } }))
      .toEqual(["td", { "data-align": "center" }, HOLE]);
  });
});
```

- [ ] **Step 5: Прогнать — зелёные**

Run: `pnpm vitest run src/components/ast-content-map/composite.test.ts`
Expected: PASS (6 тестов).

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-content-map/node-map.ts src/components/ast-content-map/attrs.ts \
  src/components/ast-content-map/composite.test.ts src/utils/storage-url.ts
git commit --only src/components/ast-content-map/node-map.ts src/components/ast-content-map/attrs.ts \
  src/components/ast-content-map/composite.test.ts src/utils/storage-url.ts \
  -m "feat(ast-content-map): композитные узлы (code_block/image/table-дерево)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Переписать READ (`ast-render`) на карты — рекурсивный интерпретатор

Читатель становится generic-обходом AST через `NODE_MAP`/`MARK_MAP` + `specToReact`. Сохранить субстрат-контракт. Удалить `ctx` (YAGNI — ни один консьюмер не использует) и старые per-node/mark файлы.

**Files:**
- Rewrite: `src/components/ast-render/block-renderer.tsx`
- Rewrite: `src/components/ast-render/inline-renderer.tsx`
- Modify: `src/components/ast-render/ast-render.tsx`
- Modify: `src/components/ast-render/types.ts`
- Delete: `src/components/ast-render/nodes/image.tsx`
- Delete: `src/components/ast-render/marks/{link,glossary-ref,document-ref,media-ref,comment-ref,canvas-ref}.tsx`
- Test: существующие `src/components/ast-render/ast-render.test.tsx` (должны остаться зелёными после удаления ctx-веток).

**Interfaces:**
- Consumes: `NODE_MAP`, `MARK_MAP`, `HOLE`, `specToReact`.
- Produces: `AstRender({ blocks })` (без `ctx`); `BlockRenderer({ block })`; `InlineRenderer({ nodes })`.

- [ ] **Step 1: Упростить типы — убрать ctx**

`src/components/ast-render/types.ts` — оставить:

```ts
import type { components } from "@/api/schema";

export type AstBlock = components["schemas"]["ast.Block"];
export type AstNode = components["schemas"]["ast.Node"];
export type AstMark = components["schemas"]["ast.Mark"];

export interface AstRenderProps {
  blocks: AstBlock[];
}
```

(`AstRenderContext`, `RefLinkRenderer` удалены.)

- [ ] **Step 2: Добавить `SANITIZE_HREF_MARKS` в `mark-map.ts`**

READ должен знать, какая марка требует санитайза href, без сравнения строк-префиксов. В `mark-map.ts` добавить и реэкспортнуть из `index.ts`:

```ts
/** Марки с пользовательским href → read-санитайз. nav-ref СЮДА НЕ входят (href вычислен из id). */
export const SANITIZE_HREF_MARKS = new Set<string>(["link"]);
```

- [ ] **Step 2b: Переписать `inline-renderer.tsx` на карты**

`src/components/ast-render/inline-renderer.tsx`:

```tsx
import type { ReactNode } from "react";

import { MARK_MAP, SANITIZE_HREF_MARKS, HOLE } from "@/components/ast-content-map";
import { log } from "@/services/observability/client";

import { isSafeHref } from "./safe-href";
import { specToReact } from "./spec-to-react";
import type { AstMark, AstNode } from "./types";

export function InlineRenderer({ nodes }: { nodes: AstNode[] | undefined }): ReactNode {
  if (!nodes) return null;
  return nodes.map((node, i) => {
    if (node.type === "hard_break") return <br key={i} />;
    if (node.type === "text") return <TextWithMarks key={i} text={node.text ?? ""} marks={node.marks} />;
    return <span key={i} data-unsupported={node.type ?? "unknown"}>{node.text ?? ""}</span>;
  });
}

function TextWithMarks({ text, marks }: { text: string; marks: AstMark[] | undefined }): ReactNode {
  if (!marks || marks.length === 0) return text;
  return marks.reduce<ReactNode>((children, mark) => applyMark(mark, children), text);
}

function applyMark(mark: AstMark, children: ReactNode): ReactNode {
  const renderer = MARK_MAP[mark.type as keyof typeof MARK_MAP];
  if (!renderer) {
    log.warn(`AstRender: unsupported mark type "${String(mark.type)}"`, { markType: String(mark.type) });
    return <span data-unsupported-mark={(mark.type as string | undefined) ?? "unknown"}>{children}</span>;
  }
  const spec = renderer(mark);
  if (!spec) return <>{children}</>; // пустой id у nav-ref → голый текст
  let attrs = spec[1];
  if (SANITIZE_HREF_MARKS.has(mark.type as string)) {
    const href = attrs.href;
    if (typeof href !== "string" || !isSafeHref(href)) return <>{children}</>; // read-санитайз
    if (href.startsWith("http://") || href.startsWith("https://")) {
      attrs = { ...attrs, rel: "noopener noreferrer", target: "_blank" };
    }
  }
  return specToReact([spec[0], attrs, HOLE], children);
}
```

Реэкспортнуть `SANITIZE_HREF_MARKS` из `ast-content-map/index.ts`.

- [ ] **Step 3: Перенести `isSafeHref` в `ast-render/safe-href.ts`**

Создать `src/components/ast-render/safe-href.ts` (копия из удаляемого `marks/link.tsx`):

```ts
export function isSafeHref(href: unknown): href is string {
  if (typeof href !== "string" || href.length === 0) return false;
  if (href.startsWith("//")) return false;
  if (href.startsWith("/") || href.startsWith("#")) return true;
  if (href.startsWith("mailto:")) return true;
  if (href.startsWith("http://") || href.startsWith("https://")) return true;
  return false;
}
```

- [ ] **Step 4: Переписать `block-renderer.tsx` на карты + table-enhancement**

```tsx
import type { ReactNode } from "react";

import { NODE_MAP, HOLE, type NeutralSpec } from "@/components/ast-content-map";
import { log } from "@/services/observability/client";

import { InlineRenderer } from "./inline-renderer";
import { specToReact } from "./spec-to-react";
import type { AstBlock } from "./types";

const INLINE_CONTAINERS = new Set(["paragraph", "heading", "table_cell"]);
const TEXT_CONTENT = new Set(["code_block"]);

export function BlockRenderer({ block }: { block: AstBlock }): ReactNode {
  const renderer = NODE_MAP[block.type as keyof typeof NODE_MAP];
  if (!renderer) {
    log.warn(`AstRender: unsupported block type "${String(block.type)}"`, { blockType: String(block.type) });
    return <div data-unsupported={block.type ?? "unknown"}><InlineRenderer nodes={block.content} /></div>;
  }
  let spec = renderer(block);
  // READ-only enhancement: header-строка → ячейки <th scope=col> (per-node edit не умеет).
  if (block.type === "table_row" && (block.attrs as { header?: unknown })?.header === true) {
    spec = spec; // строка остаётся tr; апгрейд ячеек делается ниже при их рендере
  }
  return <SpecNode block={block} spec={spec} />;
}

function SpecNode({ block, spec }: { block: AstBlock; spec: NeutralSpec }): ReactNode {
  const children = renderChildren(block);
  return <>{specToReact(spec, children)}</>;
}

function renderChildren(block: AstBlock): ReactNode {
  const type = block.type as string;
  if (TEXT_CONTENT.has(type)) {
    return (block.content ?? []).map((n) => (n.type === "text" ? n.text ?? "" : "")).join("");
  }
  if (INLINE_CONTAINERS.has(type)) {
    return <InlineRenderer nodes={block.content} />;
  }
  // Контейнеры блоков (list, list_item, blockquote, table, table_row) — дети тоже блоки.
  const kids = (block.content ?? []) as unknown as AstBlock[];
  // table_row в header → апгрейд ячеек до th
  const header = type === "table_row" && (block.attrs as { header?: unknown })?.header === true;
  return kids.map((child, i) => (
    <BlockRenderer key={child.id ?? i} block={header ? asHeaderCell(child) : child} />
  ));
}

/** Помечаем ячейку, чтобы NODE_MAP-вариант отдал th. Делаем через локальный флаг типа. */
function asHeaderCell(cell: AstBlock): AstBlock {
  return { ...cell, type: "table_cell_header" as AstBlock["type"] };
}
```

И добавить в `node-map.ts` синтетический вариант для header-ячейки (только read его увидит; edit не порождает этот тип):

```ts
  // синтетический: READ-апгрейд header-ячейки. edit никогда не зовёт (нет такого AST-типа).
  table_cell_header: (node) => ["th", { scope: "col", ...cellAlignAttr(node) }, HOLE],
```

> NB. `table_cell_header` — read-внутренний тип, в AST/PM его НЕТ. Это явная реализация «th только в read». Помечен комментарием.

- [ ] **Step 5: Упростить `ast-render.tsx` (убрать ctx)**

```tsx
import type { ReactNode } from "react";

import { BlockRenderer } from "./block-renderer";
import type { AstRenderProps } from "./types";

export function AstRender({ blocks }: AstRenderProps): ReactNode {
  // Без обёртки: блоки — прямые дети `.content` (flow-контракт + субстрат аннотаций).
  return <>{blocks.map((block, i) => <BlockRenderer key={block.id ?? i} block={block} />)}</>;
}
```

- [ ] **Step 6: Удалить мёртвые файлы**

```bash
git rm src/components/ast-render/nodes/image.tsx \
  src/components/ast-render/marks/link.tsx \
  src/components/ast-render/marks/glossary-ref.tsx \
  src/components/ast-render/marks/document-ref.tsx \
  src/components/ast-render/marks/media-ref.tsx \
  src/components/ast-render/marks/comment-ref.tsx \
  src/components/ast-render/marks/canvas-ref.tsx
```

- [ ] **Step 7: Обновить существующие тесты под удаление ctx**

Прочитать `src/components/ast-render/ast-render.test.tsx` целиком. Удалить тесты/импорты, которые проверяли `ctx`-оверрайды (если есть). Остальные (`PARAGRAPH_*`, `HEADING_*`, `TABLE*`, `IMAGE_*`, `*_REF`, `*_LINK`) должны проходить **без изменения ожиданий** — DOM-вывод сохранён. Если фикстура ожидала `<span class=nav-ref>` для ref — поправить на `<a class=nav-ref href=...>` (зафиксированное решение nav-ref→`<a>`).

- [ ] **Step 8: Прогнать весь read-набор**

Run: `pnpm vitest run src/components/ast-render`
Expected: PASS. Проверить вручную в выводе: `data-block-id` есть на текст-блоках и НЕТ на `<table>`/`<figure>`; `<br>` присутствует; нет обёртки.

- [ ] **Step 9: Commit**

```bash
git add src/components/ast-render/ src/components/ast-content-map/mark-map.ts \
  src/components/ast-content-map/node-map.ts src/components/ast-content-map/index.ts
git commit --only src/components/ast-render/types.ts src/components/ast-render/inline-renderer.tsx \
  src/components/ast-render/block-renderer.tsx src/components/ast-render/ast-render.tsx \
  src/components/ast-render/safe-href.ts src/components/ast-render/ast-render.test.tsx \
  src/components/ast-content-map/mark-map.ts src/components/ast-content-map/node-map.ts \
  src/components/ast-content-map/index.ts \
  -m "refactor(ast-render): READ на нейтральные карты, удалён ctx и per-node/mark файлы

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

(Удаления из Step 6 коммитятся тем же `git rm` — они уже застейджены; добавить их пути в `--only` при необходимости.)

---

## Task 5: Переписать EDIT `renderHTML` на карты (ТОЛЬКО если Task 1 GATE = full-share)

> **Если Task 1 Step 10 дал fallback** — пропустить эту задачу; вместо неё в Task 6 делается parity-тест-страж, а edit-узлы остаются на своих `renderHTML`.

**Files:**
- Create: `src/components/ast-editor/extensions/render-from-map.ts`
- Modify: `nodes/{paragraph,heading,blockquote,code-block,thematic-break,list}.ts`, `nodes/table.ts`, `marks/{link,nav-ref}.ts`
- Test: `src/components/ast-editor/extensions/render-from-map.test.ts`

**Interfaces:**
- Consumes: `NODE_MAP`, `MARK_MAP`.
- Produces: `domSpecFromNode(name: string, attrs: Record<string, unknown>): DOMOutputSpec`; `domSpecFromMark(name: string, attrs: Record<string, unknown>): DOMOutputSpec`.

- [ ] **Step 1: EDIT-адаптер**

`src/components/ast-editor/extensions/render-from-map.ts`:

```ts
import type { DOMOutputSpec } from "@tiptap/pm/model";

import { NODE_MAP, MARK_MAP } from "@/components/ast-content-map";

/** PM-нода → DOMOutputSpec через единую карту. NeutralSpec структурно = DOMOutputSpec. */
export function domSpecFromNode(name: string, attrs: Record<string, unknown>): DOMOutputSpec {
  const r = NODE_MAP[name as keyof typeof NODE_MAP];
  if (!r) throw new Error(`[ast] no NODE_MAP entry for "${name}"`);
  return r({ type: name, attrs } as never) as unknown as DOMOutputSpec;
}

/** Mark → DOMOutputSpec. В редакторе всегда оборачиваем (санитайз — read-only). */
export function domSpecFromMark(name: string, attrs: Record<string, unknown>): DOMOutputSpec {
  const r = MARK_MAP[name as keyof typeof MARK_MAP];
  const spec = r?.({ type: name, attrs } as never);
  if (!spec) return ["span", 0]; // нет записи/пустой id → нейтральная обёртка
  return [spec[0], spec[1], 0] as unknown as DOMOutputSpec;
}
```

- [ ] **Step 2: Делегировать в простых узлах**

В каждом из `paragraph.ts, heading.ts, blockquote.ts, code-block.ts, thematic-break.ts` заменить (или добавить) `renderHTML`:

```ts
  renderHTML({ node }) {
    return domSpecFromNode(node.type.name, node.attrs);
  },
```

(Импортнуть `domSpecFromNode`. `addAttributes`/`parseHTML` НЕ трогать — они отвечают за parse/storage. heading уже имеет `data-heading-id` — он не выводится картой; решение: `data-heading-id` оставить в `addAttributes.renderHTML`? НЕТ — карта владеет выводом. Перенести: добавить в `headingTag`-entry поддержку id, либо принять, что `data-heading-id` уходит. **Проверить** использование `data-heading-id` грепом; если используется навигацией — добавить в NODE_MAP.heading: `{ ...blockIdAttr(node), ...(id ? {"data-heading-id": id} : {}) }`.)

- [ ] **Step 3: list / table делегируют**

`list.ts` `ListExt.renderHTML` → `return domSpecFromNode("list", node.attrs);`
`ListItemExt.renderHTML` → `return domSpecFromNode("list_item", node.attrs);`
`table.ts`: `TableExt` → `domSpecFromNode("table", node.attrs)`; `TableRowExt` → `domSpecFromNode("table_row", node.attrs)`; `TableCellExt` → `domSpecFromNode("table_cell", node.attrs)`.

> NB. Редактор по-прежнему рендерит `<td>` для всех ячеек (карта `table_cell` → td). `<th>` для header-строк — только read (Task 4). Это зафиксированная законная дивергенция.

- [ ] **Step 4: nav-ref / link марки делегируют**

`marks/link.ts` — Tiptap mark `renderHTML` даёт `({ mark })`. Заменить на:

```ts
  renderHTML({ mark }) {
    return domSpecFromMark(mark.type.name, mark.attrs);
  },
```

`marks/nav-ref.ts` `renderHTML` (для каждого из 5 типов) → то же `domSpecFromMark(mark.type.name, mark.attrs)`. Результат: `<a href data-mark class=nav-ref>` в редакторе (зафиксированное решение).

- [ ] **Step 5: Тест EDIT-адаптера — написать**

`src/components/ast-editor/extensions/render-from-map.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import { domSpecFromNode, domSpecFromMark } from "./render-from-map";

describe("EDIT-адаптер → DOMOutputSpec", () => {
  it("paragraph", () => expect(domSpecFromNode("paragraph", { blockId: "b1" }))
    .toEqual(["p", { "data-block-id": "b1" }, 0]));
  it("table_cell в редакторе = td (НЕ th)", () => expect(domSpecFromNode("table_cell", { align: "center" }))
    .toEqual(["td", { "data-align": "center" }, 0]));
  it("link mark → a с href + content-hole", () => expect(domSpecFromMark("link", { href: "https://x.io" }))
    .toEqual(["a", { href: "https://x.io" }, 0]));
  it("glossary_ref mark → a в редакторе тоже", () => expect(domSpecFromMark("glossary_ref", { id: "g1" }))
    .toEqual(["a", { href: "/glossary/g1", "data-mark": "glossary_ref", class: "nav-ref nav-ref--glossary_ref" }, 0]));
});
```

- [ ] **Step 6: Прогнать edit-адаптер + существующие pm/round-trip тесты**

Run: `pnpm vitest run src/components/ast-editor`
Expected: PASS. Особо проверить `pm-schema.test.ts`, `round-trip.test.ts`, `serializer.test.ts` — они НЕ должны измениться (карта меняет только вывод renderHTML; `serialize()` читает attrs, не DOM).

- [ ] **Step 7: Commit**

```bash
git add src/components/ast-editor/extensions/render-from-map.ts \
  src/components/ast-editor/extensions/render-from-map.test.ts \
  src/components/ast-editor/extensions/nodes/ src/components/ast-editor/extensions/marks/ \
  src/components/ast-content-map/node-map.ts
git commit --only src/components/ast-editor/extensions/render-from-map.ts \
  src/components/ast-editor/extensions/render-from-map.test.ts \
  src/components/ast-editor/extensions/nodes/paragraph.ts \
  src/components/ast-editor/extensions/nodes/heading.ts \
  src/components/ast-editor/extensions/nodes/blockquote.ts \
  src/components/ast-editor/extensions/nodes/code-block.ts \
  src/components/ast-editor/extensions/nodes/thematic-break.ts \
  src/components/ast-editor/extensions/nodes/list.ts \
  src/components/ast-editor/extensions/nodes/table.ts \
  src/components/ast-editor/extensions/marks/link.ts \
  src/components/ast-editor/extensions/marks/nav-ref.ts \
  src/components/ast-content-map/node-map.ts \
  -m "refactor(ast-editor): renderHTML делегирует в единую нейтральную карту

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Сводные тесты — parity-матрица, golden, security, контракт аннотаций

**Files:**
- Test: `src/components/ast-content-map/parity.test.ts`
- Test: `src/components/ast-render/substrate-contract.test.tsx`
- Test (расширить): `src/components/ast-render/ast-render.test.tsx` (security ссылок)

**Interfaces:**
- Consumes: `NODE_MAP`, `MARK_MAP`, `domSpecFromNode`/`domSpecFromMark` (если full-share), `AstRender`.

- [ ] **Step 1: Parity-матрица (страж дрейфа)**

`src/components/ast-content-map/parity.test.ts` — для каждого узла, кроме задокументированных дивергенций (`table_cell` th/td, `image` nodeView), EDIT-спека == READ-спека (обе из одной карты, т.е. тождественны по построению; тест ловит будущий пост-процессинг в адаптерах):

```ts
import { describe, it, expect } from "vitest";

import { NODE_MAP } from "@/components/ast-content-map";
import { domSpecFromNode } from "@/components/ast-editor/extensions/render-from-map";

const SHARED = ["paragraph", "heading", "blockquote", "thematic_break", "list", "list_item", "code_block", "table", "table_row"] as const;

describe("parity: EDIT-спека == источник карты для общих узлов", () => {
  for (const t of SHARED) {
    it(`${t}`, () => {
      const attrs = { blockId: "x", level: 2, ordered: false, language: "ts" };
      const fromMap = NODE_MAP[t]!({ type: t, attrs } as never);
      expect(domSpecFromNode(t, attrs)).toEqual(fromMap);
    });
  }
});
```

> Если Task 1 = fallback: заменить тело на сравнение реального editor `renderHTML` (через сборку extension) с `NODE_MAP[t]`. См. fallback-заметку.

- [ ] **Step 2: Контракт субстрата аннотаций — написать**

`src/components/ast-render/substrate-contract.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { AstRender } from "./ast-render";

const blocks = [
  { id: "p1", type: "paragraph", content: [{ type: "text", text: "abc" }] },
  { id: "t1", type: "table", content: [{ type: "table_row", attrs: { header: true }, content: [{ type: "table_cell", content: [{ type: "text", text: "H" }] }] }] },
  { id: "i1", type: "image", attrs: { storage_key: "a".repeat(64) } },
] as never;

describe("DOM-субстрат-контракт аннотаций", () => {
  it("data-block-id на тексте, НЕ на table/figure", () => {
    const { container } = render(<AstRender blocks={blocks} />);
    expect(container.querySelector("p")?.getAttribute("data-block-id")).toBe("p1");
    expect(container.querySelector("table")?.hasAttribute("data-block-id")).toBe(false);
    expect(container.querySelector("figure")?.hasAttribute("data-block-id")).toBe(false);
  });
  it("header-строка даёт <th scope=col>", () => {
    const { container } = render(<AstRender blocks={blocks} />);
    expect(container.querySelector("th")?.getAttribute("scope")).toBe("col");
  });
  it("AstRender не оборачивает блоки (прямые дети фрагмента)", () => {
    const { container } = render(<AstRender blocks={blocks} />);
    // первый ребёнок контейнера — <p>, не обёртка
    expect(container.firstElementChild?.tagName).toBe("P");
  });
});
```

- [ ] **Step 3: Security ссылок (read-санитайз) — добавить в `ast-render.test.tsx`**

```tsx
import { AstRender } from "./ast-render";
// ...
describe("AstRender — link security", () => {
  const mk = (href: string) => [{ id: "p", type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href } }] }] }] as never;
  it("javascript: → без <a>", () => {
    const { container } = render(<AstRender blocks={mk("javascript:alert(1)")} />);
    expect(container.querySelector("a")).toBeNull();
  });
  it("//evil → без <a> (protocol-relative)", () => {
    const { container } = render(<AstRender blocks={mk("//evil.com")} />);
    expect(container.querySelector("a")).toBeNull();
  });
  it("https → <a target=_blank rel=noopener>", () => {
    const { container } = render(<AstRender blocks={mk("https://ok.io")} />);
    const a = container.querySelector("a");
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
```

- [ ] **Step 4: Прогнать аннотационные тесты против нового DOM**

Run: `pnpm vitest run src/components/annotation-layer src/components/ast-render src/components/ast-content-map`
Expected: PASS (включая существующие `annotation-layer/*.test.ts` — субстрат сохранён).

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-content-map/parity.test.ts \
  src/components/ast-render/substrate-contract.test.tsx src/components/ast-render/ast-render.test.tsx
git commit --only src/components/ast-content-map/parity.test.ts \
  src/components/ast-render/substrate-contract.test.tsx src/components/ast-render/ast-render.test.tsx \
  -m "test(ast): parity-матрица + субстрат-контракт аннотаций + link-security

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: ESLint-guard границ модулей

**Files:**
- Modify: `eslint.config.mjs`
- Test: `pnpm lint` (нет отдельного unit-теста; гейт через линтер).

**Interfaces:** —

- [ ] **Step 1: Прочитать текущие guardrail-правила**

Прочитать `eslint.config.mjs`, найти существующий блок `no-restricted-imports` (проект уже использует guardrails по cross-feature импортам). Сопоставить стиль.

- [ ] **Step 2: Добавить ограничения границ**

В соответствующие `files`-блоки добавить `no-restricted-imports` паттерны:

- Для `src/components/ast-content-map/**`: запрет `@tiptap/*`, `@tiptap/pm/*`, `prosemirror-*`, `react`, `@/components/ast-render/*`, `@/components/ast-editor/*`.
- Для `src/components/ast-render/**`: запрет `@tiptap/*`, `@tiptap/pm/*`, `prosemirror-*`, `@/components/ast-editor/*`.
- Для `src/components/ast-editor/**`: запрет `@/components/ast-render/*`.

Пример блока (вписать в массив конфигов):

```js
{
  files: ["src/components/ast-content-map/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", { patterns: [
      { group: ["@tiptap/*", "prosemirror-*", "react", "@/components/ast-render/*", "@/components/ast-editor/*"],
        message: "ast-content-map нейтрален: без React/Tiptap/ProseMirror и без потребителей." },
    ]}],
  },
},
```

(Аналогично для `ast-render` и `ast-editor` — со своими `group`.)

- [ ] **Step 3: Прогнать линтер**

Run: `pnpm lint`
Expected: PASS (0 ошибок). Если линтер ловит реальную протечку — это сигнал, что развязка нарушена; устранить импорт.

- [ ] **Step 4: Финальный гейт целиком**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное.

- [ ] **Step 5: Commit**

```bash
git add eslint.config.mjs
git commit --only eslint.config.mjs \
  -m "chore(eslint): guard границ ast-content-map / ast-render / ast-editor

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Ручная браузер-QA (после Task 7)

Не автоматизируется (jsdom не считает CSS). Проверить на трёх call-sites `AstRender`:
- `src/features/comments/ui/comment-node-view.tsx` (`.content` `data-size="sm"`).
- `src/features/forms/ui/form-detail.tsx` (`.content`).
- `src/app/saved/saved-lecture-view.tsx`.

Свериться: типографика/ритм совпадают с редактором; nav-ref выглядит ссылкой в обоих; таблицы/код/картинки корректны; RTL не сломан.

## Координация с потоком аннотаций

Перед мержем — синхронизироваться с веткой `2026-06-24-text-annotations-margin-engine`: убедиться, что движок аннотаций целится в обновлённый `ast-render` (Task 4), а не в удаляемые файлы. Контракт субстрата защищён Task 6 Step 2 + Step 4.
