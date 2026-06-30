# Под-блочная адресуемость якорей (node_id) — FE Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Поддержать ломающий бэкенд-контракт migration 026 — текстовый якорь (аннотации/комментарии) адресует текстовый ЛИСТ (`node_id`) внутри верхнеуровневого блока (`block_id`), разблокируя якорение в ячейках таблиц и вложенных абзацах списков/цитат.

**Architecture:** Подход A — единый AST-`id` на каждом текстовом листе и топ-блоке (минтит бэк, FE round-трипит). READ-рендер кладёт `data-block-id` на топ-блок и `data-node-id` на каждый текстовый лист (топ-абзац несёт оба). Anchor-engine капчурит/резолвит по листу (`data-node-id`), офсеты — node-relative. Таблицы в Core — single-cell (within-leaf). Multi-cell rectangle отложен (Phase 2).

**Tech Stack:** TypeScript, Next.js, React, ProseMirror/Tiptap (ast-editor), Vitest (jsdom), pnpm.

**Нормативный контракт:** [philosophy-api/docs/domain/anchors.md](../../../../philosophy-api/docs/domain/anchors.md) §«Под-блочная адресуемость». **Спека:** [docs/superpowers/specs/2026-06-30-subblock-node-id-anchors-design.md](../specs/2026-06-30-subblock-node-id-anchors-design.md).

## Global Constraints

- **Пакетник — pnpm** (НЕ npm; npm install ломает тулчейн). Тесты: `pnpm test <path>`; гейт: `pnpm lint && pnpm test && pnpm build`.
- **Параллельные агенты:** НЕ `git add -A`/`git add .`; добавлять только свои файлы по имени. НЕ `git stash`/`reset`/`checkout .`/`clean`. Коммит — `git add <files> && git commit --only <те же files>`.
- **Запретные зоны вне объёма:** `src/api/schema.ts` (уже перегенерирован пользователем 2026-06-30 — НЕ трогать), `src/components/ui/*`, root/admin shell. `src/utils/text-anchor.ts` и anchor-engine/ast-editor/ast-content-map/ast-render — субстрат аннотаций, правка в рамках этого контракта разрешена.
- **node_id всегда заполнен** на текстовом якоре; для top-level прозы `node_id == block_id`.
- **Текстовые листы (несут id):** `paragraph`, `heading`, `code_block`, `table_cell`. **Структурные узлы без id:** `list`, `list_item`, `blockquote`, `table`, `table_row`. **Не-текст-листы без id:** `image`, `thematic_break`.
- **Минт id — бэкенд.** FE только round-трипит. Клиентский минтинг (TipTap UniqueID) запрещён.
- Именование файлов в `src/` — kebab-case. TDD: тест → провал → реализация → проход → коммит.

---

## File Structure

| Файл | Ответственность | Задача |
| --- | --- | --- |
| `src/components/ast-editor/serializer.ts` | PM→AST: эмит `id` на вложенных текст-листах | T1 |
| `src/components/ast-editor/deserializer.ts` | AST→PM: гидрация `blockId` из `node.id` | T1 |
| `src/components/ast-editor/extensions/nodes/table.ts` | `blockId`-атрибут на `TableCellExt` | T1 |
| `src/components/ast-editor/extensions/dedup-block-id-plugin.ts` | дедуп id на вложенных листах | T2 |
| `src/components/ast-render/block-renderer.tsx` | depth-aware `data-block-id`/`data-node-id` | T3 |
| `src/components/anchor-engine/types.ts` | `TextAnchor` += `startNodeId`/`endNodeId` | T4 |
| `src/utils/text-anchor.ts` | конвертер coords↔engine: node-id оба направления | T4 |
| `src/components/anchor-engine/anchor-from-selection.ts` | капчур по листу + single-cell гард | T4, T5 |
| `src/components/anchor-engine/anchor-to-range.ts` | резолв по листу; rectangle→null | T6 |
| `src/features/comments/anchor.ts`, `src/features/annotations/anchor.ts` | node-id через общий конвертер (тесты) | T7 |

---

## Task 1: Editor round-trip — node_id на вложенных текстовых листах

**Files:**
- Modify: `src/components/ast-editor/serializer.ts:58-68` (`serializeNode`)
- Modify: `src/components/ast-editor/deserializer.ts:42-54` (`deserializeNode`)
- Modify: `src/components/ast-editor/extensions/nodes/table.ts:80-90` (`TableCellExt.addAttributes`)
- Test: `src/components/ast-editor/serializer.test.ts`, `src/components/ast-editor/deserializer.test.ts`

**Interfaces:**
- Consumes: `ProseMirrorJSON` (serializer), `AstBlock`/`AstNode` (`ast.Node` has top-level `id?: string`), `blockIdPmAttr()` from `../block-id-attr`.
- Produces: вложенный текст-лист (`paragraph`/`heading`/`code_block`/`table_cell`) round-трипит `id`: PM `attrs.blockId` ↔ AST `node.id`. `table_cell` PM-нода несёт `blockId`-атрибут.

- [ ] **Step 1: Write failing test — serializeNode эмитит id для вложенного листа**

В `src/components/ast-editor/serializer.test.ts` добавить:

```ts
import { serialize } from "./serializer";

it("serializeNode: вложенный table_cell несёт node id из attrs.blockId", () => {
  const doc = {
    type: "doc",
    content: [
      {
        type: "table",
        attrs: { blockId: "tbl-1" },
        content: [
          {
            type: "table_row",
            content: [
              { type: "table_cell", attrs: { blockId: "cell-1" }, content: [{ type: "text", text: "x" }] },
            ],
          },
        ],
      },
    ],
  };
  const blocks = serialize(doc);
  const cell = blocks[0]!.content![0]!.content![0]!;
  expect(cell.id).toBe("cell-1");
  expect((cell.attrs as Record<string, unknown> | undefined)?.blockId).toBeUndefined();
});

it("serializeNode: структурный table_row НЕ несёт id", () => {
  const doc = {
    type: "doc",
    content: [
      {
        type: "table",
        attrs: { blockId: "tbl-1" },
        content: [{ type: "table_row", attrs: { blockId: "should-drop" }, content: [
          { type: "table_cell", content: [{ type: "text", text: "x" }] },
        ] }],
      },
    ],
  };
  const row = serialize(doc)[0]!.content![0]!;
  expect(row.id).toBeUndefined();
});
```

- [ ] **Step 2: Run test — verify fail**

Run: `pnpm test src/components/ast-editor/serializer.test.ts`
Expected: FAIL (`cell.id` is `undefined`).

- [ ] **Step 3: Implement serializeNode id emission**

В `src/components/ast-editor/serializer.ts` добавить набор типов-листов и эмит `id`:

```ts
const TEXT_LEAF_NODE_TYPES = new Set(["paragraph", "heading", "code_block", "table_cell"]);

function serializeNode(node: ProseMirrorJSON): AstNode {
  const result: AstNode = { type: node.type as NodeType };
  if (node.attrs) {
    const blockId = node.attrs.blockId;
    if (TEXT_LEAF_NODE_TYPES.has(node.type) && typeof blockId === "string" && blockId.length > 0) {
      result.id = blockId;
    }
    const attrs = stripBlockId(node.attrs);
    if (attrs && Object.keys(attrs).length > 0) result.attrs = attrs;
  }
  if (node.text != null) result.text = node.text;
  if (node.marks && node.marks.length > 0) result.marks = node.marks.map(serializeMark);
  if (node.content && node.content.length > 0) result.content = node.content.map(serializeNode);
  return result;
}
```

- [ ] **Step 4: Run test — verify pass**

Run: `pnpm test src/components/ast-editor/serializer.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing test — deserializeNode гидрирует blockId из node.id**

В `src/components/ast-editor/deserializer.test.ts` добавить:

```ts
import { deserialize } from "./deserializer";

it("deserializeNode: node.id вложенного листа → attrs.blockId", () => {
  const blocks = [
    {
      id: "tbl-1",
      type: "table" as const,
      position: 0,
      content: [
        { type: "table_row" as const, content: [
          { type: "table_cell" as const, id: "cell-1", content: [{ type: "text" as const, text: "x" }] },
        ] },
      ],
    },
  ];
  const doc = deserialize(blocks);
  const cell = doc.content![0]!.content![0]!.content![0]!;
  expect(cell.attrs?.blockId).toBe("cell-1");
});
```

- [ ] **Step 6: Run test — verify fail**

Run: `pnpm test src/components/ast-editor/deserializer.test.ts`
Expected: FAIL (`cell.attrs.blockId` is `undefined`).

- [ ] **Step 7: Implement deserializeNode hydration**

В `src/components/ast-editor/deserializer.ts`:

```ts
function deserializeNode(node: AstNode): ProseMirrorJSON {
  const out: ProseMirrorJSON = { type: node.type ?? "text" };
  const attrs: Record<string, unknown> = node.attrs ? { ...node.attrs } : {};
  if (typeof node.id === "string" && node.id.length > 0) attrs.blockId = node.id;
  if (Object.keys(attrs).length > 0) out.attrs = attrs;
  if (node.text != null) out.text = node.text;
  if (node.marks) {
    out.marks = node.marks.map((m) => ({
      type: m.type ?? "",
      ...(m.attrs ? { attrs: { ...m.attrs } } : {}),
    }));
  }
  if (node.content) out.content = node.content.map(deserializeNode);
  return out;
}
```

- [ ] **Step 8: Run test — verify pass**

Run: `pnpm test src/components/ast-editor/deserializer.test.ts`
Expected: PASS.

- [ ] **Step 9: Add blockId attr to TableCellExt**

В `src/components/ast-editor/extensions/nodes/table.ts`, `TableCellExt.addAttributes` (рядом с `align`):

```ts
  addAttributes() {
    return {
      blockId: blockIdPmAttr(),
      align: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-align"),
        renderHTML: (attrs: { align?: string | null }) =>
          attrs.align ? { "data-align": attrs.align } : {},
      },
    };
  },
```

(`blockIdPmAttr` уже импортирован в файле — строка 3.)

- [ ] **Step 10: Run editor suite + commit**

Run: `pnpm test src/components/ast-editor`
Expected: PASS (включая round-trip.test.ts).

```bash
git add src/components/ast-editor/serializer.ts src/components/ast-editor/deserializer.ts src/components/ast-editor/extensions/nodes/table.ts src/components/ast-editor/serializer.test.ts src/components/ast-editor/deserializer.test.ts
git commit --only src/components/ast-editor/serializer.ts src/components/ast-editor/deserializer.ts src/components/ast-editor/extensions/nodes/table.ts src/components/ast-editor/serializer.test.ts src/components/ast-editor/deserializer.test.ts -m "feat(ast): round-trip node_id на вложенных текстовых листах"
```

---

## Task 2: Dedup node_id на вложенных листах

**Files:**
- Modify: `src/components/ast-editor/extensions/dedup-block-id-plugin.ts`
- Test: `src/components/ast-editor/extensions/dedup-block-id-plugin.test.ts` (создать, если нет)

**Interfaces:**
- Consumes: ProseMirror `Plugin`, `newState.doc.descendants`, `setNodeMarkup`.
- Produces: при дубле `blockId` (block ИЛИ node) в документе — очистка на всех вхождениях кроме первого (document-order). Бэк ре-минтит на save.

- [ ] **Step 1: Write failing test — дубль node_id в ячейке чистится**

Создать/дополнить `src/components/ast-editor/extensions/dedup-block-id-plugin.test.ts`:

```ts
import { EditorState } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { createDedupBlockIdPlugin } from "./dedup-block-id-plugin";
// предполагается тестовая схема ast-editor; если в файле уже есть хелпер makeState — переиспользовать его.
import { astSchema } from "../pm-schema"; // путь к собранной схеме редактора

function blockIds(doc: import("@tiptap/pm/model").Node): string[] {
  const ids: string[] = [];
  doc.descendants((n) => {
    const id = n.attrs.blockId;
    if (typeof id === "string" && id !== "") ids.push(id);
  });
  return ids;
}

it("дубль node_id двух ячеек → второй очищается", () => {
  const doc = astSchema.node("doc", null, [
    astSchema.node("table", { blockId: "tbl-1" }, [
      astSchema.node("table_row", null, [
        astSchema.node("table_cell", { blockId: "dup" }, [astSchema.text("a")]),
        astSchema.node("table_cell", { blockId: "dup" }, [astSchema.text("b")]),
      ]),
    ]),
  ]);
  const state = EditorState.create({ schema: astSchema, doc, plugins: [createDedupBlockIdPlugin()] });
  // тривиальная транзакция, чтобы appendTransaction отработал
  const next = state.apply(state.tr.insertText("", 1, 1));
  expect(blockIds(next.doc).filter((id) => id === "dup")).toHaveLength(1);
});
```

> Если в файле уже есть готовая фабрика состояния/схемы для тестов dedup — использовать её вместо `astSchema`-импорта. Имя собранной схемы уточнить по `src/components/ast-editor/pm-schema.test.ts`.

- [ ] **Step 2: Run test — verify fail**

Run: `pnpm test src/components/ast-editor/extensions/dedup-block-id-plugin.test.ts`
Expected: FAIL (оба `dup` остаются — текущий плагин обходит только `doc.children`).

- [ ] **Step 3: Rewrite plugin to walk all descendants**

Заменить тело `src/components/ast-editor/extensions/dedup-block-id-plugin.ts`:

```ts
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const dedupBlockIdKey = new PluginKey("ast-editor-dedup-block-id");

/**
 * Soft post-fix для split/copy-paste, где Tiptap клонирует id на новый узел.
 * Инвариант бэка: id (block И node) уникален в документе. Обходим ВСЕ узлы
 * (descendants), а не только top-level: id несут и вложенные текстовые листы
 * (table_cell, абзацы списков/цитат). На дубле чистим все вхождения кроме
 * ПЕРВОГО (document-order) — insertion-side получит новый id от бэка на save.
 */
export function createDedupBlockIdPlugin() {
  return new Plugin({
    key: dedupBlockIdKey,
    appendTransaction(_trs, _oldState, newState) {
      const seen = new Set<string>();
      const toClear: number[] = [];
      newState.doc.descendants((node: PMNode, pos: number) => {
        const id = node.attrs.blockId as unknown;
        if (typeof id !== "string" || id === "") return;
        if (seen.has(id)) toClear.push(pos);
        else seen.add(id);
      });
      if (toClear.length === 0) return null;
      const tr = newState.tr;
      for (const pos of toClear) {
        const node = newState.doc.nodeAt(pos);
        if (node) tr.setNodeMarkup(pos, undefined, { ...node.attrs, blockId: "" });
      }
      return tr.setMeta("addToHistory", false);
    },
  });
}
```

(`setNodeMarkup` не меняет размер узла → позиции в `toClear` остаются валидны.)

- [ ] **Step 4: Run test — verify pass**

Run: `pnpm test src/components/ast-editor/extensions/dedup-block-id-plugin.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-editor/extensions/dedup-block-id-plugin.ts src/components/ast-editor/extensions/dedup-block-id-plugin.test.ts
git commit --only src/components/ast-editor/extensions/dedup-block-id-plugin.ts src/components/ast-editor/extensions/dedup-block-id-plugin.test.ts -m "feat(ast): дедуп node_id на вложенных текстовых листах"
```

---

## Task 3: Read-render — depth-aware data-block-id / data-node-id

**Files:**
- Modify: `src/components/ast-render/block-renderer.tsx`
- Test: `src/components/ast-render/block-renderer.test.tsx`

**Interfaces:**
- Consumes: `NODE_MAP`, `specToReact`, `AstBlock`/`AstNode`. `block.id` — id блока/листа.
- Produces: READ DOM-контракт — `data-block-id` на топ-блоке (incl `<table>`), `data-node-id` на каждом текст-листе (`<p>`/`<h*>`/`<pre>`/`<td>`); топ-лист несёт оба; вложенный лист — только `data-node-id`. Эмиссия здесь, НЕ в карте → map-level тесты не трогаются.

- [ ] **Step 1: Write failing test — таблица и ячейки**

В `src/components/ast-render/block-renderer.test.tsx` (использовать существующий `markupFor`/render-хелпер файла) добавить:

```ts
it("table несёт data-block-id, ячейка — data-node-id (read)", () => {
  const html = markupFor({
    id: "tbl-1",
    type: "table",
    content: [
      { type: "table_row", content: [
        { type: "table_cell", id: "cell-1", content: [{ type: "text", text: "x" }] },
      ] },
    ],
  });
  expect(html).toContain('data-block-id="tbl-1"');
  expect(html).toContain('data-node-id="cell-1"');
});

it("top-level paragraph несёт оба атрибута с одним id", () => {
  const html = markupFor({ id: "p-1", type: "paragraph", content: [{ type: "text", text: "hi" }] });
  expect(html).toContain('data-block-id="p-1"');
  expect(html).toContain('data-node-id="p-1"');
});

it("вложенный абзац списка — data-node-id, НЕ data-block-id", () => {
  const html = markupFor({
    id: "list-1",
    type: "list",
    attrs: { ordered: false },
    content: [
      { type: "list_item", content: [
        { type: "paragraph", id: "li-p-1", content: [{ type: "text", text: "item" }] },
      ] },
    ],
  });
  expect(html).toContain('data-block-id="list-1"');
  expect(html).toContain('data-node-id="li-p-1"');
  // вложенный абзац НЕ должен нести свой data-block-id
  expect(html).not.toContain('data-block-id="li-p-1"');
});
```

> `markupFor` — существующий хелпер в `block-renderer.test.tsx` (рендерит `BlockRenderer` в строку через `renderToStaticMarkup`). Использовать его сигнатуру as-is.

- [ ] **Step 2: Run test — verify fail**

Run: `pnpm test src/components/ast-render/block-renderer.test.tsx`
Expected: FAIL (нет `data-node-id`; у table нет `data-block-id`).

- [ ] **Step 3: Implement depth-aware identity in BlockRenderer**

В `src/components/ast-render/block-renderer.tsx`:

```tsx
interface Props {
  block: AstBlock;
  isTopLevel?: boolean;
}

const TEXT_LEAF_TYPES = new Set<AstNodeType>(["paragraph", "heading", "code_block", "table_cell"]);

/** data-block-id (топ-блок) + data-node-id (текст-лист). Единый авторитет READ. */
function anchorIdentityAttrs(block: AstBlock, isTopLevel: boolean): Record<string, string> {
  const id = typeof block.id === "string" && block.id.length > 0 ? block.id : null;
  if (!id) return {};
  const out: Record<string, string> = {};
  if (isTopLevel) out["data-block-id"] = id;
  if (block.type && TEXT_LEAF_TYPES.has(block.type)) out["data-node-id"] = id;
  return out;
}

export function BlockRenderer({ block, isTopLevel = true }: Props): ReactNode {
  const type = block.type;
  const renderer = type ? NODE_MAP[type] : undefined;
  if (!renderer) {
    const label = (block.type as string | undefined) ?? "unknown";
    log.warn(`AstRender: unsupported block type "${label}"`, { blockType: label });
    return <div data-unsupported={label} />;
  }

  const [tag, baseAttrs, ...kids] = renderer(block as AstNode);
  // Карта могла положить data-block-id (через blockIdAttr) — снимаем: depth-aware
  // авторитет здесь. Для вложенного листа block-id ошибочен (closest зарезолвит
  // в лист вместо объемлющего блока).
  const { "data-block-id": _drop, ...rest } = baseAttrs;
  void _drop;
  let mergedAttrs: Record<string, string> = { ...rest, ...anchorIdentityAttrs(block, isTopLevel) };
  // READ-only: id заголовка для scroll-spy/TOC (поверх data-*-id).
  if (type === "heading" && typeof block.id === "string" && block.id.length > 0) {
    mergedAttrs = { ...mergedAttrs, id: block.id };
  }
  const spec: NeutralSpec = [tag, mergedAttrs, ...kids];
  return specToReact(spec, renderChildren(block, type));
}
```

В `renderChildren`, рекурсивный вызов — пробросить `isTopLevel={false}`:

```tsx
      return <BlockRenderer key={key} block={child} isTopLevel={false} />;
```

В `HeaderCell` — добавить node-id ячейке (header-строка, вложенный лист):

```tsx
function HeaderCell({ cell }: { cell: AstBlock }): ReactNode {
  const renderer = NODE_MAP.table_cell;
  if (!renderer) return null;
  const [, attrs] = renderer(cell as AstNode);
  const spec: NeutralSpec = ["th", { ...attrs, ...anchorIdentityAttrs(cell, false), scope: "col" }, HOLE];
  return specToReact(spec, <InlineRenderer nodes={cell.content} />);
}
```

- [ ] **Step 4: Run test — verify pass**

Run: `pnpm test src/components/ast-render/block-renderer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run map-level + render suites for regressions**

Run: `pnpm test src/components/ast-render src/components/ast-content-map`
Expected: PASS. Если `block-renderer.test.tsx` содержит старые ассерты «table БЕЗ data-block-id» / «image без data-block-id остаётся без data-node-id» — обновить их под новый контракт (table теперь несёт data-block-id; image/thematic_break НЕ текст-листы → без data-node-id). Map-level тесты (composite/node-map/edit-read-parity) НЕ меняются — карта по-прежнему не эмитит data-block-id на table; его добавляет BlockRenderer.

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-render/block-renderer.tsx src/components/ast-render/block-renderer.test.tsx
git commit --only src/components/ast-render/block-renderer.tsx src/components/ast-render/block-renderer.test.tsx -m "feat(ast-render): depth-aware data-block-id/data-node-id для под-блочных якорей"
```

---

## Task 4: TextAnchor + конвертер — node-id (миграция типа)

**Files:**
- Modify: `src/components/anchor-engine/types.ts:5-13` (`TextAnchor`)
- Modify: `src/utils/text-anchor.ts` (`TextAnchorCoords`, `coordsToEngineAnchor`, `engineAnchorToCoords`)
- Modify: `src/components/anchor-engine/anchor-from-selection.ts:26` (временный проброс node-id; полноценный лист — Task 5)
- Test: `src/utils/text-anchor.test.ts` + миграция фикстур во всех файлах с `startBlockId:`

**Interfaces:**
- Produces: `TextAnchor` несёт обязательные `startNodeId: string`/`endNodeId: string`. Конвертер маппит `start_node_id`/`end_node_id` оба направления; на чтении fallback `node ?? block` (терпимость к прозе/legacy).
- Consumes (Task 5/6/7): `a.startNodeId`/`a.endNodeId`, `coords.start_node_id`/`coords.end_node_id`.

- [ ] **Step 1: Write failing test — конвертер обоих направлений**

В `src/utils/text-anchor.test.ts` добавить:

```ts
import { coordsToEngineAnchor, engineAnchorToCoords } from "./text-anchor";

it("coordsToEngineAnchor: node-id из wire", () => {
  const e = coordsToEngineAnchor({
    start_block_id: "b1", end_block_id: "b1",
    start_node_id: "n1", end_node_id: "n2",
    start_char: 0, end_char: 2, exact: "ab",
  });
  expect(e).toMatchObject({ startNodeId: "n1", endNodeId: "n2", startBlockId: "b1", endBlockId: "b1" });
});

it("coordsToEngineAnchor: node-id отсутствует → fallback на block-id", () => {
  const e = coordsToEngineAnchor({ start_block_id: "b1", end_block_id: "b1", start_char: 0, end_char: 2, exact: "ab" });
  expect(e).toMatchObject({ startNodeId: "b1", endNodeId: "b1" });
});

it("engineAnchorToCoords: node-id в wire", () => {
  const c = engineAnchorToCoords({
    startBlockId: "b1", endBlockId: "b1", startNodeId: "n1", endNodeId: "n2",
    startChar: 0, endChar: 2, exact: "ab",
  });
  expect(c).toMatchObject({ start_node_id: "n1", end_node_id: "n2" });
});
```

- [ ] **Step 2: Run test — verify fail**

Run: `pnpm test src/utils/text-anchor.test.ts`
Expected: FAIL (типы/поля node-id отсутствуют).

- [ ] **Step 3: Extend TextAnchor type**

`src/components/anchor-engine/types.ts`:

```ts
export interface TextAnchor {
  startBlockId: string;
  startNodeId: string;
  endBlockId: string;
  endNodeId: string;
  startChar: number; // UTF-16 code units, node-relative (внутри листа)
  endChar: number;
  exact: string;
  prefix?: string;
  suffix?: string;
}
```

- [ ] **Step 4: Extend converter**

`src/utils/text-anchor.ts` — добавить поля в `TextAnchorCoords` и маппинг:

```ts
export interface TextAnchorCoords {
  start_block_id?: string;
  start_node_id?: string;
  end_block_id?: string;
  end_node_id?: string;
  start_char?: number;
  end_char?: number;
  exact?: string;
  prefix?: string;
  suffix?: string;
  start_sec?: number;
  end_sec?: number;
}

export function coordsToEngineAnchor(a: TextAnchorCoords): TextAnchor | null {
  if (a.start_sec !== undefined || a.end_sec !== undefined) return null;
  if (!a.start_block_id || !a.end_block_id || !a.exact) return null;
  const engine: TextAnchor = {
    startBlockId: a.start_block_id,
    startNodeId: a.start_node_id ?? a.start_block_id,
    endBlockId: a.end_block_id,
    endNodeId: a.end_node_id ?? a.end_block_id,
    startChar: a.start_char ?? 0,
    endChar: a.end_char ?? 0,
    exact: a.exact,
  };
  if (a.prefix) engine.prefix = a.prefix;
  if (a.suffix) engine.suffix = a.suffix;
  return engine;
}

export function engineAnchorToCoords(a: TextAnchor): TextAnchorCoords {
  const coords: TextAnchorCoords = {
    start_block_id: a.startBlockId,
    start_node_id: a.startNodeId,
    end_block_id: a.endBlockId,
    end_node_id: a.endNodeId,
    start_char: a.startChar,
    end_char: a.endChar,
    exact: a.exact,
  };
  if (a.prefix) coords.prefix = a.prefix;
  if (a.suffix) coords.suffix = a.suffix;
  return coords;
}
```

- [ ] **Step 5: Temp-populate node-id in capture (компиляция)**

`src/components/anchor-engine/anchor-from-selection.ts` — в `anchorFromRange`, объект `anchor` (строка 26): добавить node-id, равные block-id (для текущего top-level капчура `node == block`; полноценный лист — Task 5):

```ts
  const anchor: TextAnchor = {
    startBlockId: startId,
    startNodeId: startId,
    endBlockId: endId,
    endNodeId: endId,
    startChar,
    endChar,
    exact,
  };
```

- [ ] **Step 6: Migrate all TextAnchor fixtures**

Во всех литералах `TextAnchor` добавить `startNodeId`/`endNodeId`. Файлы (по grep `startBlockId:`):
`src/components/anchor-engine/anchor-to-range.test.ts` (6), `src/components/anchor-engine/anchor-from-selection.test.ts`, `src/components/anchor-engine/hit-test.test.ts`, `src/components/anchor-engine/margin-anchor-layer.test.tsx`, `src/features/comments/anchor.test.ts`, `src/features/annotations/anchor.test.ts`, `src/utils/text-anchor.test.ts`.

Шаблон правки (для прозы `node == block`):

```ts
// было: { startBlockId: "b1", endBlockId: "b1", startChar: 0, endChar: 2, exact: "ab" }
// стало:
{ startBlockId: "b1", startNodeId: "b1", endBlockId: "b1", endNodeId: "b1", startChar: 0, endChar: 2, exact: "ab" }
```

- [ ] **Step 7: Run full anchor + utils + features suites**

Run: `pnpm test src/components/anchor-engine src/utils/text-anchor.test.ts src/features/comments src/features/annotations`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/anchor-engine/types.ts src/utils/text-anchor.ts src/utils/text-anchor.test.ts src/components/anchor-engine/anchor-from-selection.ts src/components/anchor-engine/anchor-to-range.test.ts src/components/anchor-engine/anchor-from-selection.test.ts src/components/anchor-engine/hit-test.test.ts src/components/anchor-engine/margin-anchor-layer.test.tsx src/features/comments/anchor.test.ts src/features/annotations/anchor.test.ts
git commit --only src/components/anchor-engine/types.ts src/utils/text-anchor.ts src/utils/text-anchor.test.ts src/components/anchor-engine/anchor-from-selection.ts src/components/anchor-engine/anchor-to-range.test.ts src/components/anchor-engine/anchor-from-selection.test.ts src/components/anchor-engine/hit-test.test.ts src/components/anchor-engine/margin-anchor-layer.test.tsx src/features/comments/anchor.test.ts src/features/annotations/anchor.test.ts -m "feat(anchor): TextAnchor + конвертер несут node_id"
```

---

## Task 5: Капчур по листу — node-relative офсеты + single-cell гард

**Files:**
- Modify: `src/components/anchor-engine/anchor-from-selection.ts`
- Test: `src/components/anchor-engine/anchor-from-selection.test.ts`

**Interfaces:**
- Consumes: DOM `[data-node-id]` (лист) и `[data-block-id]` (блок), `offsetWithinBlock`/`blockPlainText` (работают на любом элементе — здесь на листе).
- Produces: `anchorFromRange`/`anchorFromSelection` → `TextAnchor` с node-relative офсетами; `null` при cross-cell / cell+проза (single-cell гард Phase 1).

- [ ] **Step 1: Write failing tests**

Заменить/дополнить `src/components/anchor-engine/anchor-from-selection.test.ts`. Хелпер строит DOM-рут с листами (использовать паттерн существующих тестов, но с `data-node-id`):

```ts
import { anchorFromSelection } from "./anchor-from-selection";

function root(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}
function selectText(node: Text, start: number, end: number): Selection {
  const range = document.createRange();
  range.setStart(node, start); range.setEnd(node, end);
  const sel = window.getSelection()!;
  sel.removeAllRanges(); sel.addRange(range);
  return sel;
}

it("офсет node-relative внутри ячейки; node_id = ячейка, block_id = таблица", () => {
  const r = root(
    '<table data-block-id="tbl-1"><tbody><tr>' +
    '<td data-node-id="cell-1">Hello</td></tr></tbody></table>',
  );
  const text = r.querySelector('[data-node-id="cell-1"]')!.firstChild as Text;
  const a = anchorFromSelection(selectText(text, 1, 4), r);
  expect(a).toMatchObject({ startNodeId: "cell-1", endNodeId: "cell-1", startBlockId: "tbl-1", startChar: 1, endChar: 4, exact: "ell" });
});

it("single-cell гард: выделение через две ячейки → null", () => {
  const r = root(
    '<table data-block-id="tbl-1"><tbody><tr>' +
    '<td data-node-id="c1">aa</td><td data-node-id="c2">bb</td>' +
    '</tr></tbody></table>',
  );
  const t1 = r.querySelector('[data-node-id="c1"]')!.firstChild as Text;
  const t2 = r.querySelector('[data-node-id="c2"]')!.firstChild as Text;
  const range = document.createRange();
  range.setStart(t1, 0); range.setEnd(t2, 2);
  const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
  expect(anchorFromSelection(sel, r)).toBeNull();
});

it("линейный кросс-лист прозы (два абзаца) — разрешён", () => {
  const r = root(
    '<p data-block-id="p1" data-node-id="p1">foo</p>' +
    '<p data-block-id="p2" data-node-id="p2">bar</p>',
  );
  const t1 = r.querySelector('[data-node-id="p1"]')!.firstChild as Text;
  const t2 = r.querySelector('[data-node-id="p2"]')!.firstChild as Text;
  const range = document.createRange();
  range.setStart(t1, 1); range.setEnd(t2, 2);
  const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
  const a = anchorFromSelection(sel, r);
  expect(a).toMatchObject({ startNodeId: "p1", endNodeId: "p2" });
});
```

- [ ] **Step 2: Run test — verify fail**

Run: `pnpm test src/components/anchor-engine/anchor-from-selection.test.ts`
Expected: FAIL (капчур ещё block-based, node-id = block-id).

- [ ] **Step 3: Rewrite capture leaf-based**

Заменить `src/components/anchor-engine/anchor-from-selection.ts`:

```ts
// src/components/anchor-engine/anchor-from-selection.ts
import { blockPlainText, offsetWithinBlock } from "./dom-text";
import type { TextAnchor } from "./types";

function closestAttr(node: Node, root: HTMLElement, attr: string): HTMLElement | null {
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const found = el?.closest<HTMLElement>(`[${attr}]`) ?? null;
  return found && root.contains(found) ? found : null;
}

function isCell(leaf: HTMLElement): boolean {
  return leaf.tagName === "TD" || leaf.tagName === "TH";
}

export function anchorFromRange(range: Range, root: HTMLElement, contextLen = 32): TextAnchor | null {
  if (range.collapsed) return null;
  const sLeaf = closestAttr(range.startContainer, root, "data-node-id");
  const eLeaf = closestAttr(range.endContainer, root, "data-node-id");
  if (!sLeaf || !eLeaf) return null;
  // Single-cell гард (Phase 1): если хоть один конец — ячейка, оба конца обязаны
  // быть ОДНОЙ ячейкой. Cross-cell / cell+проза → не создаём якорь.
  if ((isCell(sLeaf) || isCell(eLeaf)) && sLeaf !== eLeaf) return null;

  const sBlock = closestAttr(range.startContainer, root, "data-block-id");
  const eBlock = closestAttr(range.endContainer, root, "data-block-id");
  if (!sBlock || !eBlock) return null;

  const startNodeId = sLeaf.getAttribute("data-node-id");
  const endNodeId = eLeaf.getAttribute("data-node-id");
  const startBlockId = sBlock.getAttribute("data-block-id");
  const endBlockId = eBlock.getAttribute("data-block-id");
  if (!startNodeId || !endNodeId || !startBlockId || !endBlockId) return null;

  const startChar = offsetWithinBlock(sLeaf, range.startContainer, range.startOffset);
  const endChar = offsetWithinBlock(eLeaf, range.endContainer, range.endOffset);
  const exact = range.toString();
  if (exact.length === 0) return null;
  const prefix = blockPlainText(sLeaf).slice(Math.max(0, startChar - contextLen), startChar);
  const suffix = blockPlainText(eLeaf).slice(endChar, endChar + contextLen);

  const anchor: TextAnchor = { startBlockId, startNodeId, endBlockId, endNodeId, startChar, endChar, exact };
  if (prefix) anchor.prefix = prefix;
  if (suffix) anchor.suffix = suffix;
  return anchor;
}

export function anchorFromSelection(sel: Selection | null, root: HTMLElement): TextAnchor | null {
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  return anchorFromRange(sel.getRangeAt(0), root);
}
```

- [ ] **Step 4: Run test — verify pass**

Run: `pnpm test src/components/anchor-engine/anchor-from-selection.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/anchor-engine/anchor-from-selection.ts src/components/anchor-engine/anchor-from-selection.test.ts
git commit --only src/components/anchor-engine/anchor-from-selection.ts src/components/anchor-engine/anchor-from-selection.test.ts -m "feat(anchor): капчур по листу (node-relative офсеты, single-cell гард)"
```

---

## Task 6: Резолв по листу — within-leaf + кросс-лист; rectangle→null

**Files:**
- Modify: `src/components/anchor-engine/anchor-to-range.ts`
- Test: `src/components/anchor-engine/anchor-to-range.test.ts`

**Interfaces:**
- Consumes: `TextAnchor` (node-id), DOM `[data-node-id]`, `locateOffset`, `cssEscape`, `searchQuote`/`textIndex` (без изменений).
- Produces: `rangeFromAnchor(a, root)` резолвит within-leaf и линейный кросс-лист по `node_id`; table-rectangle (обе ячейки, разные node) → `null`.

- [ ] **Step 1: Write failing tests**

Дополнить `src/components/anchor-engine/anchor-to-range.test.ts`:

```ts
import { rangeFromAnchor } from "./anchor-to-range";

function root(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

it("within-leaf: резолв офсетов внутри ячейки по node_id", () => {
  const r = root('<table data-block-id="tbl-1"><tbody><tr><td data-node-id="c1">Hello</td></tr></tbody></table>');
  const a = { startBlockId: "tbl-1", endBlockId: "tbl-1", startNodeId: "c1", endNodeId: "c1", startChar: 1, endChar: 4, exact: "ell" };
  const range = rangeFromAnchor(a, r);
  expect(range?.toString()).toBe("ell");
});

it("table-rectangle (две разные ячейки) → null", () => {
  const r = root('<table data-block-id="tbl-1"><tbody><tr><td data-node-id="c1">aa</td><td data-node-id="c2">bb</td></tr></tbody></table>');
  const a = { startBlockId: "tbl-1", endBlockId: "tbl-1", startNodeId: "c1", endNodeId: "c2", startChar: 0, endChar: 2, exact: "aabb" };
  expect(rangeFromAnchor(a, r)).toBeNull();
});
```

- [ ] **Step 2: Run test — verify fail**

Run: `pnpm test src/components/anchor-engine/anchor-to-range.test.ts`
Expected: FAIL (резолв ищет по `data-block-id`/block-офсетам, не находит лист).

- [ ] **Step 3: Rewrite resolve leaf-based**

Заменить `src/components/anchor-engine/anchor-to-range.ts` (функции `block`/`tryExact`/`rangeFromAnchor`; `textIndex`/`rangeAt`/`searchQuote` оставить без изменений):

```ts
// src/components/anchor-engine/anchor-to-range.ts
import { cssEscape } from "./css-escape";
import { locateOffset } from "./dom-text";
import type { TextAnchor } from "./types";

function leafEl(root: HTMLElement, id: string): Element | null {
  return root.querySelector(`[data-node-id="${cssEscape(id)}"]`);
}
function blockEl(root: HTMLElement, id: string): Element | null {
  return root.querySelector(`[data-block-id="${cssEscape(id)}"]`);
}
function isCell(el: Element | null): boolean {
  return !!el && (el.tagName === "TD" || el.tagName === "TH");
}

// … textIndex / rangeAt / searchQuote — БЕЗ ИЗМЕНЕНИЙ (см. текущий файл) …

function tryExact(a: TextAnchor, root: HTMLElement): Range | null {
  const sLeaf = leafEl(root, a.startNodeId), eLeaf = leafEl(root, a.endNodeId);
  if (!sLeaf || !eLeaf) return null;
  const s = locateOffset(sLeaf, a.startChar), e = locateOffset(eLeaf, a.endChar);
  if (!s || !e) return null;
  const r = root.ownerDocument.createRange();
  r.setStart(s.node, s.offset); r.setEnd(e.node, e.offset);
  return r.toString() === a.exact ? r : null;
}

export function rangeFromAnchor(a: TextAnchor, root: HTMLElement): Range | null {
  // Phase 1: table-rectangle (разные ячейки) не поддержан → мягкий орфан.
  if (a.startNodeId !== a.endNodeId) {
    const sL = leafEl(root, a.startNodeId), eL = leafEl(root, a.endNodeId);
    if (isCell(sL) && isCell(eL)) return null;
  }
  // 1) Быстрый путь: офсеты внутри листа + сверка exact.
  const exact = tryExact(a, root);
  if (exact) return exact;
  // 2) Квота-поиск внутри стартового листа (точная дизамбигуация).
  const sLeaf = leafEl(root, a.startNodeId);
  if (sLeaf) { const r = searchQuote(sLeaf, a); if (r) return r; }
  // 3) Внутри объемлющего блока.
  const sBlock = blockEl(root, a.startBlockId);
  if (sBlock) { const r = searchQuote(sBlock, a); if (r) return r; }
  // 4) Последний резерв — по всему руту.
  return searchQuote(root, a);
}
```

> `searchQuote`/`textIndex`/`rangeAt` копируются из текущего файла без изменений (они оперируют переданным scope-элементом).

- [ ] **Step 4: Run test — verify pass**

Run: `pnpm test src/components/anchor-engine/anchor-to-range.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/anchor-engine/anchor-to-range.ts src/components/anchor-engine/anchor-to-range.test.ts
git commit --only src/components/anchor-engine/anchor-to-range.ts src/components/anchor-engine/anchor-to-range.test.ts -m "feat(anchor): резолв по листу (node_id); table-rectangle отложен"
```

---

## Task 7: Фичи — node_id через общий конвертер (комментарии + аннотации)

**Files:**
- Test: `src/features/comments/anchor.test.ts`, `src/features/annotations/anchor.test.ts`
- (Производственный код `comments/anchor.ts` и `annotations/anchor.ts` уже делегирует в `engineAnchorToCoords` — node-id наследуется без правок. Если тест падает — значит требуется явная правка; иначе только ассерты.)

**Interfaces:**
- Consumes: `buildCommentTextAnchor(a, documentId)`, `buildTextAnchor(a)` → `engineAnchorToCoords`.
- Produces: доменный якорь (`comment.Anchor`/`annotation.Anchor`) несёт `start_node_id`/`end_node_id`.

- [ ] **Step 1: Write failing test — node_id в доменном якоре**

В `src/features/comments/anchor.test.ts`:

```ts
import { buildCommentTextAnchor } from "./anchor";

it("buildCommentTextAnchor: пробрасывает node_id", () => {
  const a = buildCommentTextAnchor(
    { startBlockId: "tbl-1", endBlockId: "tbl-1", startNodeId: "c1", endNodeId: "c1", startChar: 0, endChar: 2, exact: "ab" },
    "doc-1",
  );
  expect(a).toMatchObject({ start_node_id: "c1", end_node_id: "c1", target_entity_id: "doc-1" });
});
```

В `src/features/annotations/anchor.test.ts`:

```ts
import { buildTextAnchor } from "./anchor";

it("buildTextAnchor: пробрасывает node_id", () => {
  const a = buildTextAnchor({ startBlockId: "b1", endBlockId: "b1", startNodeId: "b1", endNodeId: "b1", startChar: 0, endChar: 2, exact: "ab" });
  expect(a).toMatchObject({ start_node_id: "b1", end_node_id: "b1" });
});
```

- [ ] **Step 2: Run test — verify (likely PASS via delegation, else fix)**

Run: `pnpm test src/features/comments/anchor.test.ts src/features/annotations/anchor.test.ts`
Expected: PASS (конвертер из Task 4 уже несёт node-id). Если FAIL — проверить, что `buildCommentTextAnchor`/`buildTextAnchor` спредят `engineAnchorToCoords(a)` без потери полей; правка не требуется по дизайну.

- [ ] **Step 3: Commit**

```bash
git add src/features/comments/anchor.test.ts src/features/annotations/anchor.test.ts
git commit --only src/features/comments/anchor.test.ts src/features/annotations/anchor.test.ts -m "test(anchor): node_id через билдеры комментариев/аннотаций"
```

---

## Task 8: Интеграционный гейт — lint + test + build

**Files:** нет новых; финальная верификация и фикс остаточных падений.

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: 0 errors. Фиксить только своё (unused vars, типы). НЕ трогать чужие предупреждения.

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: PASS. Частые места остаточных падений: фикстуры `TextAnchor` без node-id (дополнить), снапшоты read-рендера с table/ячейками (обновить под data-block-id/data-node-id).

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: success (типы сходятся — обязательные `startNodeId`/`endNodeId` заполнены во всех конструкторах).

- [ ] **Step 4: Commit (если были фиксы)**

```bash
git add <изменённые файлы по имени>
git commit --only <те же файлы> -m "fix(anchor): остаточные правки гейта node_id"
```

---

## Спека ↔ план: сверка

- **Слой 1 (editor round-trip)** → T1 (serializer/deserializer/TableCellExt), T2 (dedup).
- **Слой 2 (read-render DOM-контракт)** → T3.
- **Слой 3 (anchor-engine)** → T4 (тип+конвертер), T5 (капчур), T6 (резолв).
- **Слой 4 (конвертер/фичи)** → T4 (конвертер), T7 (фичи).
- **Слой 5 (marginalia sort)** → **СНЯТ**: на FE нет сортировки маргиналий по `start_char` (только визуальный `resolveStack` по `top` в `stacking.ts`); document-order — забота бэкенда (`ORDER BY` + node-id тай-брейк). Спека-риск #3 — бэк-сторона; FE-правка не требуется.
- **Тесты по слоям** → покрыты в каждой задаче.
- **Риски/known-limitations** (спурьозный орфан, удаление листа не гардится, cross-cell молча без аффорданса) → поведенчески реализованы (round-trip+dedup; резолв rectangle→null; капчур single-cell гард).

## Self-Review notes

- **Placeholder scan:** код во всех шагах конкретный; единственная «уточнить» — имя собранной PM-схемы в T2 (`astSchema`) — указано искать в `pm-schema.test.ts`, т.к. имя зависит от существующего тест-хелпера.
- **Type consistency:** `startNodeId`/`endNodeId` (camelCase, engine) ↔ `start_node_id`/`end_node_id` (snake, wire) согласованы T4→T5→T6→T7. `closestAttr`/`isCell`/`leafEl`/`blockEl` — имена использованы консистентно.
- **Спан-кейс:** `searchQuote`/`textIndex`/`rangeAt` переносятся в T6 без изменений (явно отмечено), сигнатуры не меняются.
