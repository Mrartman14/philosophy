# Под-блочная адресуемость якорей (node_id) — FE Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Поддержать ломающий бэкенд-контракт migration 026 — текстовый якорь (аннотации/комментарии) адресует текстовый ЛИСТ (`node_id`) внутри верхнеуровневого блока (`block_id`), разблокируя якорение в ячейках таблиц и вложенных абзацах списков/цитат.

**Architecture:** Подход A — единый AST-`id` на каждом текстовом листе и топ-блоке (минтит бэк, FE round-трипит). READ-рендер кладёт `data-block-id` на топ-блок и `data-node-id` на каждый текстовый лист (топ-абзац несёт оба). Anchor-engine капчурит/резолвит по листу (`data-node-id`), офсеты — node-relative. Таблицы в Core — single-cell (within-leaf). Multi-cell rectangle отложен (Phase 2).

**Tech Stack:** TypeScript, Next.js, React, ProseMirror/Tiptap (ast-editor), Vitest (jsdom), pnpm.

**Нормативный контракт:** [philosophy-api/docs/domain/anchors.md](../../../../philosophy-api/docs/domain/anchors.md) §«Под-блочная адресуемость». **Спека:** [docs/superpowers/specs/2026-06-30-subblock-node-id-anchors-design.md](../specs/2026-06-30-subblock-node-id-anchors-design.md).

> **Версия после ревью (2026-06-30):** план прошёл 5-осевое субагент-ревью (контракт / корректность / интеграция / TDD / полнота). Вшиты блокеры B1–B5 и majors M1–M5 (см. §«Журнал ревью» в конце). Команды итераций переведены на `pnpm exec vitest run`.

## Global Constraints

- **Пакетник — pnpm** (НЕ npm; npm install ломает тулчейн). **Итерации по одному файлу — `pnpm exec vitest run <path>`** (быстро, без eslint-гарда). ⚠️ `pnpm test` = `node eslint.config.test.mjs && vitest run` — eslint-гард бежит ПЕРЕД vitest и может дать «непонятный» красный от незакоммиченного кода; для per-file TDD-циклов используй `pnpm exec vitest run <path>`. Финальный гейт (T8): `pnpm lint && pnpm test && pnpm build`.
- **Параллельные агенты:** НЕ `git add -A`/`git add .`; добавлять только свои файлы по имени. НЕ `git stash`/`reset`/`checkout .`/`clean`. Коммит — `git add <files> && git commit --only <те же files>`.
- **Запретные зоны вне объёма:** `src/api/schema.ts` (уже перегенерирован пользователем 2026-06-30 — НЕ трогать), `src/components/ui/*`, root/admin shell. `src/utils/text-anchor.ts`, `src/components/ast-editor/extensions/block-id-attr.ts` и anchor-engine/ast-editor/ast-content-map/ast-render — субстрат аннотаций, правка в рамках этого контракта разрешена.
- **node_id всегда заполнен** на текстовом якоре; для top-level прозы `node_id == block_id`.
- **Текстовые листы (несут id):** `paragraph`, `heading`, `code_block`, `table_cell`. **Структурные узлы без id:** `list`, `list_item`, `blockquote`, `table`, `table_row`. **Не-текст-листы без id:** `image`, `thematic_break`.
- **Минт id — бэкенд.** FE только round-трипит. Клиентский минтинг (TipTap UniqueID) запрещён.
- Именование файлов в `src/` — kebab-case. TDD: тест → провал → реализация → проход → коммит.

---

## File Structure

| Файл | Ответственность | Задача |
| --- | --- | --- |
| `src/components/ast-editor/serializer.ts` | PM→AST: эмит `id` на вложенных текст-листах | T1 |
| `src/components/ast-editor/deserializer.ts` | AST→PM: гидрация `blockId` из `node.id` (gated) | T1 |
| `src/components/ast-editor/extensions/block-id-attr.ts` | `parseHTML` fallback на `data-node-id` (paste-канал) | T1 |
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
- Modify: `src/components/ast-editor/extensions/block-id-attr.ts` (`parseHTML` fallback)
- Modify: `src/components/ast-editor/extensions/nodes/table.ts:80-90` (`TableCellExt.addAttributes`)
- Test: `src/components/ast-editor/serializer.test.ts`, `src/components/ast-editor/deserializer.test.ts`

**Interfaces:**
- Consumes: `ProseMirrorJSON` (serializer), `AstBlock`/`AstNode` (`ast.Node` has top-level `id?: string`), `blockIdPmAttr()` from `../block-id-attr`.
- Produces: вложенный текст-лист (`paragraph`/`heading`/`code_block`/`table_cell`) round-трипит `id`: PM `attrs.blockId` ↔ AST `node.id`. `table_cell` PM-нода несёт `blockId`-атрибут. `blockIdPmAttr.parseHTML` читает `data-block-id` ИЛИ `data-node-id`.

- [ ] **Step 1: Write failing test — serializeNode эмитит id для вложенного листа (и НЕ для структурного)**

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
          { type: "table_row", content: [
            { type: "table_cell", attrs: { blockId: "cell-1" }, content: [{ type: "text", text: "x" }] },
          ] },
        ],
      },
    ],
  };
  const cell = serialize(doc)[0]!.content![0]!.content![0]!;
  expect(cell.id).toBe("cell-1");
  expect((cell.attrs as Record<string, unknown> | undefined)?.blockId).toBeUndefined();
});

it("serializeNode: структурный table_row НЕ несёт id", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "table", attrs: { blockId: "tbl-1" }, content: [
        { type: "table_row", attrs: { blockId: "should-drop" }, content: [
          { type: "table_cell", content: [{ type: "text", text: "x" }] },
        ] },
      ] },
    ],
  };
  expect(serialize(doc)[0]!.content![0]!.id).toBeUndefined();
});
```

- [ ] **Step 2: Run test — verify fail**

Run: `pnpm exec vitest run src/components/ast-editor/serializer.test.ts`
Expected: FAIL (`cell.id` is `undefined`).

- [ ] **Step 3: Implement serializeNode id emission (gated by text-leaf set)**

В `src/components/ast-editor/serializer.ts`:

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

Run: `pnpm exec vitest run src/components/ast-editor/serializer.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing test — deserializeNode гидрирует blockId из node.id, gated**

В `src/components/ast-editor/deserializer.test.ts`:

```ts
import { deserialize } from "./deserializer";

it("deserializeNode: node.id текст-листа → attrs.blockId", () => {
  const blocks = [
    { id: "tbl-1", type: "table" as const, position: 0, content: [
      { type: "table_row" as const, content: [
        { type: "table_cell" as const, id: "cell-1", content: [{ type: "text" as const, text: "x" }] },
      ] },
    ] },
  ];
  const cell = deserialize(blocks).content![0]!.content![0]!.content![0]!;
  expect(cell.attrs?.blockId).toBe("cell-1");
});

it("deserializeNode: id структурного узла НЕ гидрируется в blockId", () => {
  const blocks = [
    { id: "tbl-1", type: "table" as const, position: 0, content: [
      { type: "table_row" as const, id: "row-x", content: [
        { type: "table_cell" as const, id: "cell-1", content: [{ type: "text" as const, text: "x" }] },
      ] },
    ] },
  ];
  const row = deserialize(blocks).content![0]!.content![0]!;
  expect(row.attrs?.blockId).toBeUndefined();
});
```

- [ ] **Step 6: Run test — verify fail**

Run: `pnpm exec vitest run src/components/ast-editor/deserializer.test.ts`
Expected: FAIL (`cell.attrs.blockId` is `undefined`).

- [ ] **Step 7: Implement deserializeNode hydration (gated by text-leaf set — симметрия с serializeNode, M3)**

В `src/components/ast-editor/deserializer.ts`:

```ts
const TEXT_LEAF_NODE_TYPES = new Set(["paragraph", "heading", "code_block", "table_cell"]);

function deserializeNode(node: AstNode): ProseMirrorJSON {
  const type = node.type ?? "text";
  const out: ProseMirrorJSON = { type };
  const attrs: Record<string, unknown> = node.attrs ? { ...node.attrs } : {};
  if (TEXT_LEAF_NODE_TYPES.has(type) && typeof node.id === "string" && node.id.length > 0) {
    attrs.blockId = node.id;
  }
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

Run: `pnpm exec vitest run src/components/ast-editor/deserializer.test.ts`
Expected: PASS.

- [ ] **Step 9: parseHTML fallback на data-node-id (закрывает paste-канал орфана, M2)**

READ-рендер кладёт на вложенный лист `data-node-id` (без `data-block-id`). Без этого fallback paste отрендеренной статьи в редактор терял бы node_id (parseHTML читал только `data-block-id`) → тихий орфан. `src/components/ast-editor/extensions/block-id-attr.ts`:

```ts
export function blockIdPmAttr() {
  return {
    default: "",
    parseHTML: (el: HTMLElement) =>
      el.getAttribute("data-block-id") ?? el.getAttribute("data-node-id") ?? "",
    renderHTML: (attrs: { blockId?: string }) =>
      attrs.blockId ? { "data-block-id": attrs.blockId } : {},
  };
}
```

(Тест не обязателен — паттерн тривиален; покрытие round-trip в Step 10.)

- [ ] **Step 10: Add blockId attr to TableCellExt**

В `src/components/ast-editor/extensions/nodes/table.ts`, `TableCellExt.addAttributes`:

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

(`blockIdPmAttr` уже импортирован — строка 3. **Заметка (integration-M1):** `TableCellExt.renderHTML` делегирует в `domSpecFromNode` и НЕ мёржит `HTMLAttributes` — значит `data-block-id` на `<td>` в DOM редактора намеренно НЕ появляется. Это ОК: ячейка round-трипит node_id через JSON (`getJSON → serialize`), а не через editor-DOM/клипборд. НЕ приводить к виду `TableExt`.)

- [ ] **Step 11: Run editor suite + commit**

Run: `pnpm exec vitest run src/components/ast-editor`
Expected: PASS. **Риск-точка:** `round-trip.test.ts:62` (`result.content` deep-equals fixture). `fixtureTable` имеет id только на топ-блоке, вложенные ячейки — без id → пустой `blockId` стрипается (`stripBlockId` + гард `length > 0`) → контент совпадает. Зелёный.

```bash
git add src/components/ast-editor/serializer.ts src/components/ast-editor/deserializer.ts src/components/ast-editor/extensions/block-id-attr.ts src/components/ast-editor/extensions/nodes/table.ts src/components/ast-editor/serializer.test.ts src/components/ast-editor/deserializer.test.ts
git commit --only src/components/ast-editor/serializer.ts src/components/ast-editor/deserializer.ts src/components/ast-editor/extensions/block-id-attr.ts src/components/ast-editor/extensions/nodes/table.ts src/components/ast-editor/serializer.test.ts src/components/ast-editor/deserializer.test.ts -m "feat(ast): round-trip node_id на вложенных текстовых листах"
```

---

## Task 2: Dedup node_id на вложенных листах

**Files:**
- Modify: `src/components/ast-editor/extensions/dedup-block-id-plugin.ts`
- Test: `src/components/ast-editor/extensions/dedup-block-id-plugin.test.ts` (создать)

**Interfaces:**
- Consumes: ProseMirror `Plugin`, `newState.doc.descendants`, `setNodeMarkup`. Сборка тестовой схемы — `getSchema(buildExtensions(...))` (см. ниже).
- Produces: при дубле `blockId` (block ИЛИ node) в документе — очистка на всех вхождениях кроме первого (document-order). Бэк ре-минтит на save.

- [ ] **Step 1: Write failing test — дубль node_id в ячейке чистится**

Создать `src/components/ast-editor/extensions/dedup-block-id-plugin.test.ts`. **Схему собрать как в `pm-schema.test.ts` / `round-trip-overlays.test.ts`** — экспортируемого `astSchema` в проекте НЕТ (B1):

```ts
import { getSchema } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { expect, it } from "vitest";

import { buildExtensions } from "../index"; // экспортирует buildExtensions (см. pm-schema.test.ts:импорт)
import { createDedupBlockIdPlugin } from "./dedup-block-id-plugin";

// Минимальный snapshot со схемой таблицы — скопировать форму fullSnapshot из
// round-trip-overlays.test.ts (нужны table/table_row/table_cell/text).
const snapshot = /* SchemaSnapshot из round-trip-overlays.test.ts */;
const schema = getSchema(buildExtensions({ snapshot, context: "document" }));

function blockIds(doc: PMNode): string[] {
  const ids: string[] = [];
  doc.descendants((n) => {
    const id = n.attrs.blockId;
    if (typeof id === "string" && id !== "") ids.push(id);
  });
  return ids;
}

it("дубль node_id двух ячеек → второй очищается", () => {
  const doc = schema.node("doc", null, [
    schema.node("table", { blockId: "tbl-1" }, [
      schema.node("table_row", null, [
        schema.node("table_cell", { blockId: "dup" }, [schema.text("a")]),
        schema.node("table_cell", { blockId: "dup" }, [schema.text("b")]),
      ]),
    ]),
  ]);
  const state = EditorState.create({ schema, doc, plugins: [createDedupBlockIdPlugin()] });
  // appendTransaction бежит на ЛЮБОЙ применённой транзакции → meta-only достаточно
  // (insertText по позиции 1 невалиден: это граница таблицы, не текст-блок — B2).
  const next = state.apply(state.tr.setMeta("dedup-test", true));
  expect(blockIds(next.doc).filter((id) => id === "dup")).toHaveLength(1);
});
```

> Точное имя экспорта схемы-сборщика (`buildExtensions`) и форму `snapshot` взять из `src/components/ast-editor/pm-schema.test.ts` и `round-trip-overlays.test.ts` (там это уже собрано для тестов). НЕ импортировать несуществующий `../pm-schema`.

- [ ] **Step 2: Run test — verify fail**

Run: `pnpm exec vitest run src/components/ast-editor/extensions/dedup-block-id-plugin.test.ts`
Expected: FAIL (оба `dup` остаются — текущий плагин обходит только `doc.forEach` top-level).

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

Run: `pnpm exec vitest run src/components/ast-editor/extensions/dedup-block-id-plugin.test.ts`
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
- Produces: READ DOM-контракт — `data-block-id` на топ-блоке (incl `<table>`, который карта не эмитит), `data-node-id` на каждом текст-листе (`<p>`/`<h*>`/`<pre>`/`<td>`); топ-лист несёт оба; вложенный лист — только `data-node-id`. **Сохраняем текущий контракт `image`/`thematic_break`** (image без block-id, B4).

**Подход (B4):** НЕ навешиваем `data-block-id` по одному `isTopLevel` (это добавило бы его `image`, сломав контракт+тест). Вместо этого: карта уже корректно эмитит `data-block-id` на нужные top-блоки (paragraph/heading/blockquote/list/code_block/thematic_break; image — нет). Мы лишь (а) у ВЛОЖЕННОГО узла СНИМАЕМ `data-block-id`, (б) у `table` ДОБАВЛЯЕМ его (карта опускает), (в) на каждый текст-лист добавляем `data-node-id`.

- [ ] **Step 1: Write failing/updated tests — новый контракт + правка конфликтующих (B3/B4)**

В `src/components/ast-render/block-renderer.test.tsx`. Добавить новые кейсы И обновить существующие конфликтующие ассерты (иначе красный конец задачи):

НОВЫЕ:

```ts
it("table несёт data-block-id, ячейка — data-node-id (read)", () => {
  const html = markupFor({
    id: "tbl-1", type: "table",
    content: [{ type: "table_row", content: [
      { type: "table_cell", id: "cell-1", content: [{ type: "text", text: "x" }] },
    ] }],
  });
  expect(html).toContain('data-block-id="tbl-1"');
  expect(html).toContain('data-node-id="cell-1"');
});

it("top-level paragraph несёт оба атрибута с одним id", () => {
  const html = markupFor({ id: "p-1", type: "paragraph", content: [{ type: "text", text: "hi" }] });
  expect(html).toContain('data-block-id="p-1"');
  expect(html).toContain('data-node-id="p-1"');
});
```

ОБНОВИТЬ существующие (они кодируют СТАРЫЙ baseline и сломаются):

- Тест «table — БЕЗ data-block-id» (ранее `not.toContain("data-block-id")`): теперь table **несёт** `data-block-id`. Переписать ассерт на `toContain('data-block-id="...")`.
- **Тест «blockquote и его вложенный paragraph несут собственные data-block-id»** (≈ строки 105-115): вложенный абзац теперь несёт ТОЛЬКО `data-node-id`. Переписать:

```ts
it("blockquote несёт data-block-id; вложенный paragraph — data-node-id, НЕ data-block-id", () => {
  const html = markupFor({
    id: "bq", type: "blockquote",
    content: [{ type: "paragraph", id: "p2", content: [{ type: "text", text: "q" }] }],
  });
  expect(html).toContain('data-block-id="bq"');
  expect(html).toContain('data-node-id="p2"');
  expect(html).not.toMatch(/<p[^>]*data-block-id="p2"/);
});
```

- Тест «image — нет data-block-id» (≈ строки 138-147): **остаётся as-is** — наш подход НЕ добавляет block-id image. Убедиться, что он по-прежнему зелёный (это и есть проверка B4: image не получает ни block-id, ни node-id).

- [ ] **Step 2: Run test — verify fail**

Run: `pnpm exec vitest run src/components/ast-render/block-renderer.test.tsx`
Expected: FAIL на новых (нет `data-node-id`; у table нет `data-block-id`).

- [ ] **Step 3: Implement depth-aware identity in BlockRenderer**

`src/components/ast-render/block-renderer.tsx`:

```tsx
interface Props {
  block: AstBlock;
  isTopLevel?: boolean;
}

const TEXT_LEAF_TYPES = new Set<AstNodeType>(["paragraph", "heading", "code_block", "table_cell"]);

/**
 * Depth-aware identity поверх карты:
 *  - вложенный узел: СНЯТЬ data-block-id (block_id — только top-level; иначе
 *    closest('[data-block-id]') зарезолвит в лист вместо объемлющего блока);
 *  - table (top-level): ДОБАВИТЬ data-block-id (карта его опускает);
 *  - текст-лист (top И nested): ДОБАВИТЬ data-node-id.
 * image/thematic_break не трогаем — их block-id-контракт остаётся как в карте.
 */
function applyIdentity(
  baseAttrs: Record<string, string>,
  block: AstBlock,
  isTopLevel: boolean,
): Record<string, string> {
  const id = typeof block.id === "string" && block.id.length > 0 ? block.id : null;
  const attrs: Record<string, string> = { ...baseAttrs };
  if (!isTopLevel) {
    delete attrs["data-block-id"]; // вложенный никогда не несёт block_id
  } else if (block.type === "table" && id) {
    attrs["data-block-id"] = id; // table: карта block-id опускает
  }
  if (id && block.type && TEXT_LEAF_TYPES.has(block.type)) {
    attrs["data-node-id"] = id;
  }
  return attrs;
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
  let attrs = applyIdentity(baseAttrs, block, isTopLevel);
  // READ-only: id заголовка для scroll-spy/TOC (системный block.id, НЕ attrs.id).
  if (type === "heading" && typeof block.id === "string" && block.id.length > 0) {
    attrs = { ...attrs, id: block.id };
  }
  const spec: NeutralSpec = [tag, attrs, ...kids];
  return specToReact(spec, renderChildren(block, type));
}
```

В `renderChildren`, рекурсивный вызов — пробросить `isTopLevel={false}`:

```tsx
      return <BlockRenderer key={key} block={child} isTopLevel={false} />;
```

В `HeaderCell` — добавить node-id ячейке (вложенный лист):

```tsx
function HeaderCell({ cell }: { cell: AstBlock }): ReactNode {
  const renderer = NODE_MAP.table_cell;
  if (!renderer) return null;
  const [, attrs] = renderer(cell as AstNode);
  const spec: NeutralSpec = ["th", { ...applyIdentity(attrs, cell, false), scope: "col" }, HOLE];
  return specToReact(spec, <InlineRenderer nodes={cell.content} />);
}
```

- [ ] **Step 4: Run test — verify pass**

Run: `pnpm exec vitest run src/components/ast-render/block-renderer.test.tsx`
Expected: PASS (новые + обновлённые; image остаётся зелёным).

- [ ] **Step 5: Run map-level + render suites — НЕ должны меняться**

Run: `pnpm exec vitest run src/components/ast-render src/components/ast-content-map`
Expected: PASS. Map-level (`composite.test.ts`, `node-map.test.ts`, `edit-read-parity.test.ts`) НЕ трогаем — карта по-прежнему НЕ эмитит `data-block-id` на `table`; его добавляет BlockRenderer (ветка `isTopLevel`). Если что-то красное вне `block-renderer.test.tsx` — это сигнал, что правка протекла в карту; откатить.

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
- Modify: `src/components/anchor-engine/anchor-from-selection.ts` (временный проброс node-id; полноценный лист — Task 5)
- Test: `src/utils/text-anchor.test.ts` + миграция фикстур

**Interfaces:**
- Produces: `TextAnchor` несёт обязательные `startNodeId: string`/`endNodeId: string`. Конвертер маппит `start_node_id`/`end_node_id` оба направления; на чтении fallback `node ?? block` (ТОЛЬКО legacy/proza-совместимость).

- [ ] **Step 1: Write failing test — конвертер обоих направлений**

В `src/utils/text-anchor.test.ts`:

```ts
import { coordsToEngineAnchor, engineAnchorToCoords } from "./text-anchor";

it("coordsToEngineAnchor: node-id из wire", () => {
  const e = coordsToEngineAnchor({
    start_block_id: "b1", end_block_id: "b1", start_node_id: "n1", end_node_id: "n2",
    start_char: 0, end_char: 2, exact: "ab",
  });
  expect(e).toMatchObject({ startNodeId: "n1", endNodeId: "n2", startBlockId: "b1", endBlockId: "b1" });
});

it("coordsToEngineAnchor: node-id отсутствует → fallback на block-id (legacy/proza)", () => {
  const e = coordsToEngineAnchor({ start_block_id: "b1", end_block_id: "b1", start_char: 0, end_char: 2, exact: "ab" });
  expect(e).toMatchObject({ startNodeId: "b1", endNodeId: "b1" });
});

it("engineAnchorToCoords: node-id в wire", () => {
  const c = engineAnchorToCoords({
    startBlockId: "b1", endBlockId: "b1", startNodeId: "n1", endNodeId: "n2", startChar: 0, endChar: 2, exact: "ab",
  });
  expect(c).toMatchObject({ start_node_id: "n1", end_node_id: "n2" });
});
```

- [ ] **Step 2: Run test — verify fail**

Run: `pnpm exec vitest run src/utils/text-anchor.test.ts`
Expected: FAIL (поля node-id отсутствуют).

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

`src/utils/text-anchor.ts`:

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
    // fallback ?? block — ТОЛЬКО legacy/proza (node==block). Бэк теперь всегда
    // минтит node_id; на ячейке/вложенном листе wire всегда несёт start_node_id.
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

- [ ] **Step 5: Temp-populate node-id in capture (компиляция; полноценный лист — Task 5)**

`src/components/anchor-engine/anchor-from-selection.ts`, объект `anchor`: добавить node-id, равные block-id:

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

- [ ] **Step 6: Migrate TextAnchor fixtures (точный список — M4)**

Добавить `startNodeId`/`endNodeId` во ВСЕ литералы `TextAnchor`. Точный набор по `grep -rn "startBlockId:" src` (литералы только здесь; `anchor-from-selection.test.ts` НЕ содержит литералов — он переписывается в Task 5):

- `src/components/anchor-engine/anchor-to-range.test.ts` — **6** вхождений
- `src/components/anchor-engine/hit-test.test.ts` — **1**
- `src/components/anchor-engine/margin-anchor-layer.test.tsx` — **1**
- `src/features/comments/anchor.test.ts` — **2**
- `src/features/annotations/anchor.test.ts` — **5**
- `src/utils/text-anchor.test.ts` — **2**

Шаблон (проза `node == block`):

```ts
{ startBlockId: "b1", startNodeId: "b1", endBlockId: "b1", endNodeId: "b1", startChar: 0, endChar: 2, exact: "ab" }
```

Прод-конструкторов `TextAnchor` только два (`text-anchor.ts`, `anchor-from-selection.ts`) — оба обновлены (Step 4/5); прочий прод-код идёт через `coordsToEngineAnchor` (chokepoint) → node_id наследуется. `pnpm build` тайп-комплит держится.

- [ ] **Step 7: Run anchor + utils + features suites**

Run: `pnpm exec vitest run src/components/anchor-engine src/utils/text-anchor.test.ts src/features/comments src/features/annotations`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/anchor-engine/types.ts src/utils/text-anchor.ts src/utils/text-anchor.test.ts src/components/anchor-engine/anchor-from-selection.ts src/components/anchor-engine/anchor-to-range.test.ts src/components/anchor-engine/hit-test.test.ts src/components/anchor-engine/margin-anchor-layer.test.tsx src/features/comments/anchor.test.ts src/features/annotations/anchor.test.ts
git commit --only src/components/anchor-engine/types.ts src/utils/text-anchor.ts src/utils/text-anchor.test.ts src/components/anchor-engine/anchor-from-selection.ts src/components/anchor-engine/anchor-to-range.test.ts src/components/anchor-engine/hit-test.test.ts src/components/anchor-engine/margin-anchor-layer.test.tsx src/features/comments/anchor.test.ts src/features/annotations/anchor.test.ts -m "feat(anchor): TextAnchor + конвертер несут node_id"
```

> ⚠️ Файлы `comments/anchor.test.ts` и `annotations/anchor.test.ts` снова трогаются в Task 7 — Task 7 идёт СТРОГО после Task 4 (без параллелизма по этим двум файлам, integration-m1).

---

## Task 5: Капчур по листу — node-relative офсеты + single-cell гард

**Files:**
- Modify: `src/components/anchor-engine/anchor-from-selection.ts`
- Test: `src/components/anchor-engine/anchor-from-selection.test.ts`

**Interfaces:**
- Consumes: DOM `[data-node-id]` (лист) и `[data-block-id]` (блок), `offsetWithinBlock`/`blockPlainText` (работают на любом элементе — здесь на листе).
- Produces: `anchorFromRange`/`anchorFromSelection` → `TextAnchor` с node-relative офсетами; `null` при cross-cell / cell+проза (single-cell гард Phase 1).

- [ ] **Step 1: Update existing fixtures + write new tests (C3)**

В `src/components/anchor-engine/anchor-from-selection.test.ts`. **СНАЧАЛА** обновить существующий хелпер `setup()`: каждый `<p data-block-id="pN">` → `<p data-block-id="pN" data-node-id="pN">` (без `data-node-id` рерайт капчура вернёт `null` и ВСЕ старые тесты упадут). Затем добавить новые кейсы:

```ts
import { anchorFromSelection } from "./anchor-from-selection";

function root(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}
function selectRange(s: Node, so: number, e: Node, eo: number): Selection {
  const range = document.createRange();
  range.setStart(s, so); range.setEnd(e, eo);
  const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
  return sel;
}

it("офсет node-relative внутри ячейки; node_id = ячейка, block_id = таблица", () => {
  const r = root('<table data-block-id="tbl-1"><tbody><tr><td data-node-id="cell-1">Hello</td></tr></tbody></table>');
  const t = r.querySelector('[data-node-id="cell-1"]')!.firstChild as Text;
  const a = anchorFromSelection(selectRange(t, 1, t, 4), r);
  expect(a).toMatchObject({ startNodeId: "cell-1", endNodeId: "cell-1", startBlockId: "tbl-1", startChar: 1, endChar: 4, exact: "ell" });
});

it("single-cell гард: выделение через две ячейки → null", () => {
  const r = root('<table data-block-id="tbl-1"><tbody><tr><td data-node-id="c1">aa</td><td data-node-id="c2">bb</td></tr></tbody></table>');
  const t1 = r.querySelector('[data-node-id="c1"]')!.firstChild as Text;
  const t2 = r.querySelector('[data-node-id="c2"]')!.firstChild as Text;
  expect(anchorFromSelection(selectRange(t1, 0, t2, 2), r)).toBeNull();
});

it("single-cell гард: ячейка + проза (mixed) → null", () => {
  const r = root('<p data-block-id="p0" data-node-id="p0">pre</p><table data-block-id="tbl-1"><tbody><tr><td data-node-id="c1">aa</td></tr></tbody></table>');
  const p = r.querySelector('[data-node-id="p0"]')!.firstChild as Text;
  const c = r.querySelector('[data-node-id="c1"]')!.firstChild as Text;
  expect(anchorFromSelection(selectRange(p, 0, c, 2), r)).toBeNull();
});

it("линейный кросс-лист прозы (два абзаца) — разрешён", () => {
  const r = root('<p data-block-id="p1" data-node-id="p1">foo</p><p data-block-id="p2" data-node-id="p2">bar</p>');
  const t1 = r.querySelector('[data-node-id="p1"]')!.firstChild as Text;
  const t2 = r.querySelector('[data-node-id="p2"]')!.firstChild as Text;
  expect(anchorFromSelection(selectRange(t1, 1, t2, 2), r)).toMatchObject({ startNodeId: "p1", endNodeId: "p2" });
});
```

- [ ] **Step 2: Run test — verify fail**

Run: `pnpm exec vitest run src/components/anchor-engine/anchor-from-selection.test.ts`
Expected: FAIL (капчур ещё block-based, node-id = block-id; single-cell гарда нет).

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

Run: `pnpm exec vitest run src/components/anchor-engine/anchor-from-selection.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/anchor-engine/anchor-from-selection.ts src/components/anchor-engine/anchor-from-selection.test.ts
git commit --only src/components/anchor-engine/anchor-from-selection.ts src/components/anchor-engine/anchor-from-selection.test.ts -m "feat(anchor): капчур по листу (node-relative офсеты, single-cell гард)"
```

---

## Task 6: Резолв по листу — within-leaf + кросс-лист; rectangle→null; интеграция

**Files:**
- Modify: `src/components/anchor-engine/anchor-to-range.ts`
- Test: `src/components/anchor-engine/anchor-to-range.test.ts`

**Interfaces:**
- Consumes: `TextAnchor` (node-id), DOM `[data-node-id]`, `locateOffset`, `cssEscape`, `searchQuote`/`textIndex`/`rangeAt` (scope-агностичны, переносятся без изменений).
- Produces: `rangeFromAnchor(a, root)` резолвит within-leaf и линейный кросс-лист; table-rectangle (обе ячейки, разные node) → `null`.

- [ ] **Step 1: Write failing tests (resolve + integration round-trip M1)**

Дополнить `src/components/anchor-engine/anchor-to-range.test.ts`. **Существующие DOM-фикстуры** (`<p data-block-id="p1">…`) после рерайта `tryExact` (ищет `[data-node-id]`) пройдут только через `searchQuote`-fallback — это ок (их `exact` уникальны), но добавь `data-node-id` к прозе в фикстурах, чтобы покрыть быстрый путь.

```ts
import { rangeFromAnchor } from "./anchor-to-range";
import { anchorFromSelection } from "./anchor-from-selection";

function root(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

it("within-leaf: резолв офсетов внутри ячейки по node_id", () => {
  const r = root('<table data-block-id="tbl-1"><tbody><tr><td data-node-id="c1">Hello</td></tr></tbody></table>');
  const a = { startBlockId: "tbl-1", endBlockId: "tbl-1", startNodeId: "c1", endNodeId: "c1", startChar: 1, endChar: 4, exact: "ell" };
  expect(rangeFromAnchor(a, r)?.toString()).toBe("ell");
});

it("table-rectangle (две разные ячейки) → null", () => {
  const r = root('<table data-block-id="tbl-1"><tbody><tr><td data-node-id="c1">aa</td><td data-node-id="c2">bb</td></tr></tbody></table>');
  const a = { startBlockId: "tbl-1", endBlockId: "tbl-1", startNodeId: "c1", endNodeId: "c2", startChar: 0, endChar: 2, exact: "aabb" };
  expect(rangeFromAnchor(a, r)).toBeNull();
});

// ИНТЕГРАЦИЯ (M1): капчур → резолв на одном руте.
it("round-trip within-cell: anchorFromSelection → rangeFromAnchor резолвит ту же ячейку", () => {
  const r = root('<table data-block-id="tbl-1"><tbody><tr><td data-node-id="c1">Hello world</td></tr></tbody></table>');
  const t = r.querySelector('[data-node-id="c1"]')!.firstChild as Text;
  const range = document.createRange(); range.setStart(t, 6); range.setEnd(t, 11);
  const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
  const a = anchorFromSelection(sel, r)!;
  expect(a.exact).toBe("world");
  expect(rangeFromAnchor(a, r)?.toString()).toBe("world");
});
```

- [ ] **Step 2: Run test — verify fail**

Run: `pnpm exec vitest run src/components/anchor-engine/anchor-to-range.test.ts`
Expected: FAIL (резолв ищет по `data-block-id`/block-офсетам, не находит лист).

- [ ] **Step 3: Rewrite resolve leaf-based**

Заменить функции `block`/`tryExact`/`rangeFromAnchor` в `src/components/anchor-engine/anchor-to-range.ts` (`textIndex`/`rangeAt`/`searchQuote` — БЕЗ изменений):

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

// … textIndex / rangeAt / searchQuote — БЕЗ ИЗМЕНЕНИЙ (скопировать из текущего файла) …

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
  // ДОЛГ Phase 2: при включении rectangle добавить проверку «обе ячейки ОДНОЙ
  // таблицы» (одинаковый block_id) — anchors.md правило 4 (contract-MINOR).
  if (a.startNodeId !== a.endNodeId) {
    const sL = leafEl(root, a.startNodeId), eL = leafEl(root, a.endNodeId);
    if (isCell(sL) && isCell(eL)) return null;
  }
  // 1) Быстрый путь: офсеты внутри листа + сверка exact.
  const exact = tryExact(a, root);
  if (exact) return exact;
  // 2) Квота-поиск внутри стартового листа (within-leaf дрейф).
  const sLeaf = leafEl(root, a.startNodeId);
  if (sLeaf) { const r = searchQuote(sLeaf, a); if (r) return r; }
  // 3) Внутри объемлющего блока.
  const sBlock = blockEl(root, a.startBlockId);
  if (sBlock) { const r = searchQuote(sBlock, a); if (r) return r; }
  // 4) Последний резерв — по всему руту. ПРИМЕЧАНИЕ: линейный кросс-лист прозы
  //    (start_node_id != end_node_id, exact спанит границу двух листов) на
  //    быстром пути tryExact обычно НЕ сходится (r.toString() включает текст
  //    между листами) и резолвится именно здесь, по руту.
  return searchQuote(root, a);
}
```

- [ ] **Step 4: Run test — verify pass**

Run: `pnpm exec vitest run src/components/anchor-engine/anchor-to-range.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/anchor-engine/anchor-to-range.ts src/components/anchor-engine/anchor-to-range.test.ts
git commit --only src/components/anchor-engine/anchor-to-range.ts src/components/anchor-engine/anchor-to-range.test.ts -m "feat(anchor): резолв по листу (node_id) + capture→resolve round-trip; rectangle отложен"
```

---

## Task 7: Фичи — node_id через общий конвертер (характеризующие тесты)

**Files:**
- Test: `src/features/comments/anchor.test.ts`, `src/features/annotations/anchor.test.ts`
- Прод-код (`comments/anchor.ts`, `annotations/anchor.ts`) уже делегирует в `engineAnchorToCoords` — node-id наследуется без правок.

**Зависимость:** строго ПОСЛЕ Task 4 (те же два файла мигрировались там).

- [ ] **Step 1: Write characterization tests — node_id в доменном якоре**

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

- [ ] **Step 2: Run — характеризующий тест (ожидаем PASS, НЕ TDD-red)**

Run: `pnpm exec vitest run src/features/comments/anchor.test.ts src/features/annotations/anchor.test.ts`
Expected: **PASS сразу** — node_id наследуется через делегацию в `engineAnchorToCoords` (Task 4). Это lock-in регрессии (характеризующий тест), а НЕ нарушение TDD-red. Если PASS — не «чинить» рабочий прод-код.

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
Expected: 0 errors. Фиксить только своё. `void`-паттерн для unused не нужен — eslint `varsIgnorePattern: "^_"` покрывает `_`-префиксы (в T3 `applyIdentity` не оставляет unused, паттерн не требуется).

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: PASS. Частые остаточные места: фикстуры `TextAnchor` без node-id (дополнить по M4-списку); read-render снапшоты с table/ячейками (обновить под data-block-id/data-node-id); фикстуры `use-selection-capture.test.tsx`/`margin-anchor-layer.test.tsx` — их `<p data-block-id>` остаются зелёными по случайности (smoke `draft===null` / orphan-кейс без позитивного capture/resolve), НЕ «чинить» вслепую.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: success (обязательные `startNodeId`/`endNodeId` заполнены во всех конструкторах).

- [ ] **Step 4: Commit (если были фиксы)**

Перечислить РОВНО изменённые на Step 1-3 файлы по имени. Если затронут чужой незакоммиченный файл — НЕ коммитить, эскалировать (правило параллельных агентов).

```bash
git add <конкретные изменённые файлы>
git commit --only <те же файлы> -m "fix(anchor): остаточные правки гейта node_id"
```

---

## Спека ↔ план: сверка

- **Слой 1 (editor round-trip)** → T1 (serializer/deserializer/parseHTML/TableCellExt), T2 (dedup).
- **Слой 2 (read-render DOM-контракт)** → T3.
- **Слой 3 (anchor-engine)** → T4 (тип+конвертер), T5 (капчур), T6 (резолв + интеграция).
- **Слой 4 (конвертер/фичи)** → T4 (конвертер), T7 (фичи).
- **Слой 5 (marginalia sort)** → **СНЯТ** (verified 5-осевым ревью): на FE нет сортировки маргиналий по `start_char` (только визуальный `resolveStack` по `top`; порядок нот — server-driven). Document-order + node-id тай-брейк — забота бэкенда. Спека-риск #3 — бэк-сторона.

## Known-limitations / Phase-2 долг (зафиксировано по ревью)

- **Cross-cell аффорданс** молча гаснет (капчур → null). Опц. UI-тест в `use-selection-capture.test.tsx` («cross-cell range → draft===null») — не блокер.
- **Table-rectangle из данных** (другой клиент/Phase 2) → `rangeFromAnchor` отдаёт `null` → нота показывается как орфан, НЕотличимый от дрейф-орфана. Известный лимит до Phase 2 (явная индикация «не поддержано»).
- **Старые составные dev-якоря** (block_id = list/table/blockquote, без node_id): fallback `node=block` не найдёт лист → деградация в exact-резолв по блоку или мягкий орфан. Прода нет, бэкфилла нет.
- **Геометрия подсветки/выносок** (`highlight-overlay`/`use-anchor-ranges`/`connector-geometry`/`stacking`) — node-id-agnostic (оперируют DOM Range из `rangeFromAnchor`), правок не требуют. within-leaf якорь в ячейке резолвится в Range → геометрия наследуется.
- **a11y/focus-порядок выносок** для нескольких листов одного блока, RTL-таблицы — Phase 2.
- **`comment-anchor-context`** показывает ОБЪЕМЛЮЩИЙ блок (таблицу/список) через `getBlock(start_block_id)` — ожидаемо (API оперирует топ-блоками), не лист.

## Журнал ревью (2026-06-30, 5 осей, Opus)

Вшито: **B1** схема теста dedup через `getSchema(buildExtensions(...))` (T2); **B2** триггер `setMeta` вместо невалидного `insertText("",1,1)` (T2); **B3** обновление теста blockquote-nested (T3 Step 1); **B4** `applyIdentity` сохраняет контракт image/thematic_break (T3 Step 3); **B5** `data-node-id` в фикстурах капчура (T5 Step 1). **M1** интеграционный capture→resolve тест (T6); **M2** `parseHTML` fallback на `data-node-id` (T1 Step 9); **M3** gated `deserializeNode` (T1 Step 7); **M4** точный список миграции фикстур (T4 Step 6); **M5** `pnpm exec vitest run` для итераций (Global Constraints).

## Self-Review notes

- **Placeholder scan:** конкретный код во всех шагах; в T2 `snapshot` помечен «скопировать из round-trip-overlays.test.ts» — это указание на реальный существующий источник, не TBD.
- **Type consistency:** `startNodeId`/`endNodeId` (camelCase) ↔ `start_node_id`/`end_node_id` (snake) согласованы T4→T5→T6→T7. `applyIdentity`/`closestAttr`/`isCell`/`leafEl`/`blockEl` — имена консистентны.
- **Green-per-task:** T1 (round-trip fixtures без id зелёные), T3 (конфликтующие ассерты обновлены в Step 1), T4 (node-id обязательны + все литералы мигрированы + temp-проброс), T5 (фикстуры с data-node-id), T6 — каждая задача зелёная на коммите.
