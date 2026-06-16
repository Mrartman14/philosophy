# AST Editor — Phase 2c — Toolbar + Slash-menu + Drift-warn + README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать редактору видимый UI: toolbar с per-context gating, slash-меню для вставки блоков (`/heading`, `/list`, etc.), drift-warning (sanity-check для рассинхрона hardcoded extensions ↔ runtime schema), README слайса.

**Architecture:** Toolbar — компонент над `@base-ui/react/toolbar`, принимает `editor: Editor` и `schema: SchemaSnapshot` + `context: EntityContext`. Каждая кнопка проверяет `block_levels[context]` или allowed-mark набор перед рендером. Slash-меню — Tiptap-расширение через `@tiptap/suggestion`-style паттерн (или собственная implementation: ProseMirror plugin, ловит `/` в начале параграфа, рендерит Popover с блок-командами). Drift-warn — useEffect в `ast-editor.tsx`, сравнивает имена nodes/marks из `schema.nodes/marks` с теми, что ожидаются в hardcode (whitelist). README — короткий док для будущих консьюмеров.

**Tech Stack:** `@base-ui/react/{toolbar, select, popover, tooltip, dialog}`, Tiptap commands (`editor.chain().focus().…run()`), reuse icons из `@/assets/icons/`.

---

## Parallel-safety contract

Этот план собирается в собственном worktree параллельно с **2a (Image)** и **2b (Pickers)**.

**Модифицирует** (один файл, который не трогает никто другой):
- `src/components/ast-editor/ast-editor.tsx` — добавляет рендер `<EditorToolbar />` и `useDriftWarn(schema)` хук.

**Создаёт** (только новые файлы):

```
src/components/ast-editor/
├── toolbar/
│   ├── toolbar.tsx                # EditorToolbar — основной компонент
│   ├── buttons/
│   │   ├── inline-marks.tsx       # bold/italic/code
│   │   ├── link-popover.tsx       # link mark + url-policy gate
│   │   ├── heading-select.tsx     # h1..h6 select (по allowed levels)
│   │   ├── block-buttons.tsx      # blockquote/code-block/hr/table
│   │   └── list-buttons.tsx       # ordered/unordered/task
│   ├── slash-menu.tsx             # /-trigger + popup commands
│   ├── slash-menu-plugin.ts       # PM plugin: detect "/" at line start
│   ├── toolbar.test.tsx
│   └── slash-menu.test.tsx
├── drift-warn.ts                  # at-mount diff hardcode ⊆ runtime
├── drift-warn.test.ts
└── README.md                      # документация слайса
```

**Frozen zones** (CLAUDE.md): `src/api/schema.ts`, `src/utils/*`, `src/components/ui/*`, `package.json` — не трогать.

**Параллельная работа агентов** (CLAUDE.md): запрещены `git stash/reset/checkout./clean`, `git add -A/.`, перезапись чужих изменений.

**Что НЕ трогает (резерв за параллельными планами):**
- `src/components/ast-editor/extensions/*` — 2a, Phase 1.
- `src/components/ast-editor/use-ast-editor.ts` — никто не трогает в Phase 2.
- `src/components/ast-editor/index.ts` — Phase 2c НЕ дополняет public API (toolbar — internal default-render внутри AstEditor).

**Что НЕ входит в 2c (вынесено в follow-up after 2a/2b merge, чтобы плана 2c остались независимыми):**
- Image toolbar-кнопка (нужен `uploadImage` из 2a) → mini-PR.
- RefMenu trigger в toolbar (нужен `RefMenu` из 2b) → mini-PR.
- `@`-suggestion в редакторе — открывает RefMenu при печати `@` → mini-PR.

---

## Task 1: Inline marks buttons (bold, italic, code)

**Files:**
- Create: `src/components/ast-editor/toolbar/buttons/inline-marks.tsx`

**Why per-context gating:** spec §6.6 — кнопка disabled, если соответствующая mark не в allowed set. Inline marks (`bold`, `italic`, `code`) определены глобально per-context в `schema.marks` — кнопка скрывается, если mark отсутствует.

- [ ] **Step 1: Реализация**

```tsx
// src/components/ast-editor/toolbar/buttons/inline-marks.tsx
"use client";
import type { Editor } from "@tiptap/core";
import { Toolbar } from "@base-ui/react/toolbar";
import type { SchemaSnapshot } from "../../types";

interface Props { editor: Editor; schema: SchemaSnapshot }

export function InlineMarksGroup({ editor, schema }: Props) {
  return (
    <Toolbar.Group>
      {schema.marks.has("bold") && (
        <Toolbar.Button
          aria-label="Жирный"
          aria-pressed={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </Toolbar.Button>
      )}
      {schema.marks.has("italic") && (
        <Toolbar.Button
          aria-label="Курсив"
          aria-pressed={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </Toolbar.Button>
      )}
      {schema.marks.has("code") && (
        <Toolbar.Button
          aria-label="Код"
          aria-pressed={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          {"<>"}
        </Toolbar.Button>
      )}
    </Toolbar.Group>
  );
}
```

(Иконки из `@/assets/icons/{bold,italic,code}-icon` — импорт по аналогии с `markdown-editor/toolbar.tsx`. Текстовые лейблы выше — placeholder, заменить на `<BoldIcon />` etc. при имплементации.)

- [ ] **Step 2: Commit**

```bash
git add src/components/ast-editor/toolbar/buttons/inline-marks.tsx
git commit -m "feat(ast-editor): add inline-marks toolbar group with schema gating"
```

---

## Task 2: Heading select (per-context allowed levels)

**Files:**
- Create: `src/components/ast-editor/toolbar/buttons/heading-select.tsx`

**Behaviour:**
- Render `Select` с опциями: «Параграф» + h1..h6 (только если `block_levels[context]` содержит "heading").
- При выборе — `editor.chain().focus().setHeading({ level }).run()` или `setParagraph()`.
- Active value reflects `editor.isActive("heading", { level })`.
- AST schema позволяет `level: 1..6`, но per-context может быть жёстче — здесь упрощаем: показываем все 1..6 если "heading" allowed (фильтрация конкретных levels — не в MVP scope).

- [ ] **Step 1: Реализация**

```tsx
// src/components/ast-editor/toolbar/buttons/heading-select.tsx
"use client";
import type { Editor } from "@tiptap/core";
import { Select } from "@base-ui/react/select";
import type { SchemaSnapshot, EntityContext } from "../../types";

interface Props { editor: Editor; schema: SchemaSnapshot; context: EntityContext }

type Value = "paragraph" | `h${1 | 2 | 3 | 4 | 5 | 6}`;

const items: ReadonlyArray<{ label: string; value: Value }> = [
  { label: "Параграф", value: "paragraph" },
  { label: "Заголовок 1", value: "h1" },
  { label: "Заголовок 2", value: "h2" },
  { label: "Заголовок 3", value: "h3" },
  { label: "Заголовок 4", value: "h4" },
  { label: "Заголовок 5", value: "h5" },
  { label: "Заголовок 6", value: "h6" },
];

function getActive(editor: Editor): Value {
  for (let l = 1 as 1 | 2 | 3 | 4 | 5 | 6; l <= 6; l = (l + 1) as 1 | 2 | 3 | 4 | 5 | 6) {
    if (editor.isActive("heading", { level: l })) return `h${l}` as Value;
  }
  return "paragraph";
}

export function HeadingSelect({ editor, schema, context }: Props) {
  const level = schema.entityContexts[context] ?? "";
  const allowed = new Set(schema.blockLevels[level] ?? []);
  if (!allowed.has("heading")) return null;

  const active = getActive(editor);
  const onChange = (v: Value | null) => {
    if (!v) return;
    if (v === "paragraph") editor.chain().focus().setParagraph().run();
    else editor.chain().focus().setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  };

  return (
    <Select.Root<Value> value={active} onValueChange={onChange}>
      <Select.Trigger aria-label="Тип блока"><Select.Value /></Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Popup>
            {items.map((it) => (
              <Select.Item key={it.value} value={it.value}>
                <Select.ItemText>{it.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ast-editor/toolbar/buttons/heading-select.tsx
git commit -m "feat(ast-editor): add heading-select with per-context heading gating"
```

---

## Task 3: Block buttons (blockquote, code-block, hr, table) + Lists

**Files:**
- Create: `src/components/ast-editor/toolbar/buttons/block-buttons.tsx`
- Create: `src/components/ast-editor/toolbar/buttons/list-buttons.tsx`

- [ ] **Step 1: Block buttons**

```tsx
// src/components/ast-editor/toolbar/buttons/block-buttons.tsx
"use client";
import type { Editor } from "@tiptap/core";
import { Toolbar } from "@base-ui/react/toolbar";
import type { SchemaSnapshot, EntityContext } from "../../types";

interface Props { editor: Editor; schema: SchemaSnapshot; context: EntityContext }

export function BlockButtonsGroup({ editor, schema, context }: Props) {
  const level = schema.entityContexts[context] ?? "";
  const allowed = new Set(schema.blockLevels[level] ?? []);

  return (
    <Toolbar.Group>
      {allowed.has("blockquote") && (
        <Toolbar.Button
          aria-label="Цитата"
          aria-pressed={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          ❝
        </Toolbar.Button>
      )}
      {allowed.has("code_block") && (
        <Toolbar.Button
          aria-label="Блок кода"
          aria-pressed={editor.isActive("code_block")}
          onClick={() => editor.chain().focus().toggleNode("code_block", "paragraph").run()}
        >
          {"</>"}
        </Toolbar.Button>
      )}
      {allowed.has("thematic_break") && (
        <Toolbar.Button
          aria-label="Горизонтальная линия"
          onClick={() => editor.chain().focus().insertContent({ type: "thematic_break" }).run()}
        >
          —
        </Toolbar.Button>
      )}
      {allowed.has("table") && (
        <Toolbar.Button
          aria-label="Таблица"
          onClick={() =>
            editor.chain().focus().insertContent({
              type: "table",
              content: [
                { type: "table_row", content: [{ type: "table_cell" }, { type: "table_cell" }, { type: "table_cell" }] },
                { type: "table_row", content: [{ type: "table_cell" }, { type: "table_cell" }, { type: "table_cell" }] },
              ],
            }).run()
          }
        >
          ⊞
        </Toolbar.Button>
      )}
    </Toolbar.Group>
  );
}
```

**Note:** `editor.chain().insertTable(…)` из `@tiptap/extension-table` НЕ работает — мы не используем эту extension (см. Phase 1, table.ts custom). Вставляем через `insertContent` напрямую.

- [ ] **Step 2: List buttons**

```tsx
// src/components/ast-editor/toolbar/buttons/list-buttons.tsx
"use client";
import type { Editor } from "@tiptap/core";
import { Toolbar } from "@base-ui/react/toolbar";
import type { SchemaSnapshot, EntityContext } from "../../types";

interface Props { editor: Editor; schema: SchemaSnapshot; context: EntityContext }

export function ListButtonsGroup({ editor, schema, context }: Props) {
  const level = schema.entityContexts[context] ?? "";
  const allowed = new Set(schema.blockLevels[level] ?? []);
  if (!allowed.has("list")) return null;

  // ListExt в Phase 1 — это собственный Node.create({ name: "list" }) без
  // Tiptap helper'ов (toggleBulletList/toggleOrderedList/toggleList не зарегистрированы).
  // Универсальные команды wrapIn / lift / updateAttributes — то, что работает.
  const toggle = (ordered: boolean, asTask = false) => {
    if (editor.isActive("list", { ordered })) {
      editor.chain().focus().lift("list_item").run();
      return;
    }
    editor.chain().focus().wrapIn("list", { ordered }).run();
    if (asTask) {
      editor.chain().focus().updateAttributes("list_item", { checked: false }).run();
    }
  };

  const itemChecked = editor.getAttributes("list_item")?.["checked"];
  const isTaskActive = editor.isActive("list_item") && itemChecked != null;

  return (
    <Toolbar.Group>
      <Toolbar.Button
        aria-label="Маркированный список"
        aria-pressed={editor.isActive("list", { ordered: false })}
        onClick={() => toggle(false)}
      >
        •
      </Toolbar.Button>
      <Toolbar.Button
        aria-label="Нумерованный список"
        aria-pressed={editor.isActive("list", { ordered: true })}
        onClick={() => toggle(true)}
      >
        1.
      </Toolbar.Button>
      <Toolbar.Button
        aria-label="Чек-лист"
        aria-pressed={isTaskActive}
        onClick={() => toggle(false, true)}
      >
        ☐
      </Toolbar.Button>
    </Toolbar.Group>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/toolbar/buttons/block-buttons.tsx src/components/ast-editor/toolbar/buttons/list-buttons.tsx
git commit -m "feat(ast-editor): add block and list toolbar groups with per-context gating"
```

---

## Task 4: Link popover

**Files:**
- Create: `src/components/ast-editor/toolbar/buttons/link-popover.tsx`

**Behaviour:**
- Popover с `<input type="url">` + кнопка Apply.
- При Apply — `editor.chain().focus().setMark("link", { href }).run()`.
- Ввод href валидируется attr-plugin'ом (Phase 1) на scheme_allowlist; ошибочный href транзакция отвергнется plugin'ом — fallback UX: input принимает любое, после run() проверяем `editor.isActive("link")`, если нет — показываем inline-error.

- [ ] **Step 1: Реализация**

```tsx
// src/components/ast-editor/toolbar/buttons/link-popover.tsx
"use client";
import { useState } from "react";
import type { Editor } from "@tiptap/core";
import { Popover } from "@base-ui/react/popover";
import { Toolbar } from "@base-ui/react/toolbar";
import type { SchemaSnapshot } from "../../types";

interface Props { editor: Editor; schema: SchemaSnapshot }

export function LinkPopover({ editor, schema }: Props) {
  if (!schema.marks.has("link")) return null;
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const onApply = () => {
    const v = href.trim();
    if (!v) return;
    const empty = editor.state.selection.empty;
    if (empty) {
      // collapsed selection — вставляем href как текст с link-mark, иначе
      // setMark уйдёт только в storedMarks и пользователь не увидит ссылки.
      editor.chain().focus()
        .insertContent({ type: "text", text: v, marks: [{ type: "link", attrs: { href: v } }] })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setMark("link", { href: v }).run();
    }
    // attr-plugin (Phase 1) отвергнет mark при недопустимой схеме URL.
    if (!editor.isActive("link", { href: v })) {
      setErr("Недопустимая схема ссылки (разрешены http, https, mailto)");
      return;
    }
    setOpen(false);
    setHref("");
    setErr(null);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger render={<Toolbar.Button aria-label="Ссылка" />}>🔗</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup>
            <input type="url" value={href} onChange={(e) => setHref(e.target.value)} placeholder="https://…" autoFocus />
            <button type="button" onClick={onApply}>Применить</button>
            {err ? <p role="alert">{err}</p> : null}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ast-editor/toolbar/buttons/link-popover.tsx
git commit -m "feat(ast-editor): add link popover with scheme-allowlist validation"
```

---

## Task 5: Composing EditorToolbar + tests

**Files:**
- Create: `src/components/ast-editor/toolbar/toolbar.tsx`
- Create: `src/components/ast-editor/toolbar/toolbar.test.tsx`

- [ ] **Step 1: Failing test (per-context gating)**

```tsx
// src/components/ast-editor/toolbar/toolbar.test.tsx
import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import { render, screen, cleanup } from "@testing-library/react";
import { EditorToolbar } from "./toolbar";
import { buildExtensions } from "../extensions";
import type { EntityContext, SchemaSnapshot } from "../types";

afterEach(cleanup);

const fullSchema: SchemaSnapshot = {
  blockLevels: {
    full: ["paragraph", "heading", "blockquote", "code_block", "list", "image", "table", "thematic_break"],
    basic: ["paragraph"],
  },
  entityBlockLimits: { full: 20000, basic: 100 },
  entityContexts: { document: "full", comment: "basic" },
  limits: { maxDepth: 32, maxTextLen: 1_000_000, maxContentItems: 10_000, maxMarksPerNode: 100 },
  urlPolicy: { dangerousSchemes: ["javascript", "data", "vbscript"] },
  nodes: new Map(),
  marks: new Map([["bold", { attrs: {} }], ["italic", { attrs: {} }], ["code", { attrs: {} }], ["link", { attrs: {} }]]),
  exclusiveCategories: [],
};

const makeEditor = (context: EntityContext) =>
  new Editor({ extensions: buildExtensions({ snapshot: fullSchema, context }) });

describe("EditorToolbar gating", () => {
  it("document context: shows heading select, blockquote, code-block, list, table, hr", () => {
    const editor = makeEditor("document");
    render(<EditorToolbar editor={editor} schema={fullSchema} context="document" />);
    expect(screen.getByLabelText(/тип блока/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/цитата/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/блок кода/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/маркированный список/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/нумерованный список/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/таблица/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/горизонтальная линия/i)).toBeInTheDocument();
    editor.destroy();
  });

  it("comment context (basic): hides everything except inline marks + link", () => {
    const editor = makeEditor("comment");
    render(<EditorToolbar editor={editor} schema={fullSchema} context="comment" />);
    expect(screen.queryByLabelText(/тип блока/i)).toBeNull();
    expect(screen.queryByLabelText(/цитата/i)).toBeNull();
    expect(screen.queryByLabelText(/блок кода/i)).toBeNull();
    expect(screen.queryByLabelText(/маркированный список/i)).toBeNull();
    expect(screen.queryByLabelText(/таблица/i)).toBeNull();
    // inline marks + link still present (always-allowed)
    expect(screen.getByLabelText(/жирный/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ссылка/i)).toBeInTheDocument();
    editor.destroy();
  });
});
```

- [ ] **Step 2: Прогнать — fail (нет EditorToolbar)**

Run: `npx vitest run src/components/ast-editor/toolbar/toolbar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализовать composition**

```tsx
// src/components/ast-editor/toolbar/toolbar.tsx
"use client";
import type { Editor } from "@tiptap/core";
import { Toolbar } from "@base-ui/react/toolbar";
import { Tooltip } from "@base-ui/react/tooltip";
import { InlineMarksGroup } from "./buttons/inline-marks";
import { HeadingSelect } from "./buttons/heading-select";
import { BlockButtonsGroup } from "./buttons/block-buttons";
import { ListButtonsGroup } from "./buttons/list-buttons";
import { LinkPopover } from "./buttons/link-popover";
import type { SchemaSnapshot, EntityContext } from "../types";

export interface EditorToolbarProps {
  editor: Editor;
  schema: SchemaSnapshot;
  context: EntityContext;
}

export function EditorToolbar({ editor, schema, context }: EditorToolbarProps) {
  return (
    <Tooltip.Provider>
      <Toolbar.Root>
        <InlineMarksGroup editor={editor} schema={schema} />
        <Toolbar.Separator />
        <HeadingSelect editor={editor} schema={schema} context={context} />
        <Toolbar.Separator />
        <BlockButtonsGroup editor={editor} schema={schema} context={context} />
        <Toolbar.Separator />
        <ListButtonsGroup editor={editor} schema={schema} context={context} />
        <Toolbar.Separator />
        <LinkPopover editor={editor} schema={schema} />
      </Toolbar.Root>
    </Tooltip.Provider>
  );
}
```

- [ ] **Step 4: Прогнать — PASS**

Run: `npx vitest run src/components/ast-editor/toolbar/toolbar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-editor/toolbar/toolbar.tsx src/components/ast-editor/toolbar/toolbar.test.tsx
git commit -m "feat(ast-editor): compose EditorToolbar with per-context block gating"
```

---

## Task 6: Slash-menu (`/`-trigger → block-insert palette)

**Files:**
- Create: `src/components/ast-editor/toolbar/slash-menu-plugin.ts`
- Create: `src/components/ast-editor/toolbar/slash-menu.tsx`
- Test: `src/components/ast-editor/toolbar/slash-menu.test.tsx`

**Approach:** ProseMirror plugin watches the editor state. Когда курсор находится в начале пустого параграфа и был напечатан `/`, плагин выставляет `state.open = true` и `query = ""`. Каждый последующий символ дописывает query, Backspace откатывает; Esc — закрывает; Enter / клик — выполняет команду.

UI — собственный Popover, привязанный к editor.view координатам (`view.coordsAtPos`). НЕ используем `@tiptap/suggestion` (избегаем доп. dep). Достаточно простого PluginState с position.

**Available commands** (фильтруются per-context):
- `heading 1` / `heading 2` / `heading 3` — если "heading" allowed.
- `blockquote` — если allowed.
- `code_block` — если allowed.
- `list bullet` / `list ordered` / `list task` — если "list" allowed.
- `table 3×3` — если allowed.
- `hr` — если "thematic_break" allowed.

- [ ] **Step 1: Plugin (state, key handlers)**

```ts
// src/components/ast-editor/toolbar/slash-menu-plugin.ts
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface SlashMenuState {
  open: boolean;
  from: number;          // позиция "/", чтобы закрыть/удалить
  query: string;
}

export const slashMenuKey = new PluginKey<SlashMenuState>("ast-editor-slash-menu");

export function createSlashMenuPlugin() {
  return new Plugin<SlashMenuState>({
    key: slashMenuKey,
    state: {
      init: () => ({ open: false, from: -1, query: "" }),
      apply(tr, prev) {
        const meta = tr.getMeta(slashMenuKey) as Partial<SlashMenuState> | undefined;
        if (meta) return { ...prev, ...meta };
        if (!prev.open) return prev;
        // Map prev.from через mapping любых правок других плагинов (например
        // dedup-block-id-plugin), иначе позиция "/" устареет и textBetween
        // вернёт мусор.
        const mappedFrom = tr.mapping.map(prev.from, -1);
        if (tr.docChanged) {
          const end = tr.selection.from;
          if (end < mappedFrom) return { open: false, from: -1, query: "" };
          const text = tr.doc.textBetween(mappedFrom, end);
          if (!text.startsWith("/")) return { open: false, from: -1, query: "" };
          return { ...prev, from: mappedFrom, query: text.slice(1) };
        }
        return { ...prev, from: mappedFrom };
      },
    },
    props: {
      handleTextInput(view, from, _to, text) {
        if (text !== "/") return false;
        const state = slashMenuKey.getState(view.state);
        if (state?.open) return false;
        // Open only at start of empty paragraph or after whitespace
        const $from = view.state.doc.resolve(from);
        const inEmpty = $from.parent.type.name === "paragraph" && $from.parent.textContent.length === 0;
        if (!inEmpty) return false;
        const tr = view.state.tr.setMeta(slashMenuKey, { open: true, from, query: "" });
        view.dispatch(tr);
        return false; // let "/" be inserted normally
      },
      handleKeyDown(view, event) {
        const s = slashMenuKey.getState(view.state);
        if (!s?.open) return false;
        if (event.key === "Escape") {
          view.dispatch(view.state.tr.setMeta(slashMenuKey, { open: false, from: -1, query: "" }));
          return true;
        }
        return false;
      },
    },
  });
}

export function closeSlashMenu(view: import("@tiptap/pm/view").EditorView) {
  view.dispatch(view.state.tr.setMeta(slashMenuKey, { open: false, from: -1, query: "" }));
}

export function consumeSlashMarker(view: import("@tiptap/pm/view").EditorView, from: number) {
  // Удаляет "/" + query, оставляет курсор готовым для вставки
  const to = view.state.selection.from;
  view.dispatch(view.state.tr.delete(from, to).setMeta(slashMenuKey, { open: false, from: -1, query: "" }));
}
```

- [ ] **Step 2: SlashMenu UI**

```tsx
// src/components/ast-editor/toolbar/slash-menu.tsx
"use client";
import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { slashMenuKey, consumeSlashMarker, closeSlashMenu } from "./slash-menu-plugin";
import type { SchemaSnapshot, EntityContext } from "../types";

interface Cmd { id: string; label: string; run: (editor: Editor) => void }

function buildCommands(schema: SchemaSnapshot, context: EntityContext): Cmd[] {
  const level = schema.entityContexts[context] ?? "";
  const allowed = new Set(schema.blockLevels[level] ?? []);
  const cmds: Cmd[] = [];
  if (allowed.has("heading")) {
    for (const l of [1, 2, 3] as const) {
      cmds.push({ id: `h${l}`, label: `Заголовок ${l}`, run: (e) => e.chain().focus().setHeading({ level: l }).run() });
    }
  }
  if (allowed.has("blockquote")) cmds.push({ id: "bq", label: "Цитата", run: (e) => e.chain().focus().wrapIn("blockquote").run() });
  if (allowed.has("code_block")) cmds.push({ id: "cb", label: "Блок кода", run: (e) => e.chain().focus().setNode("code_block").run() });
  if (allowed.has("list")) {
    cmds.push({ id: "ul", label: "Маркированный список", run: (e) => e.chain().focus().wrapIn("list", { ordered: false }).run() });
    cmds.push({ id: "ol", label: "Нумерованный список", run: (e) => e.chain().focus().wrapIn("list", { ordered: true }).run() });
  }
  if (allowed.has("thematic_break")) cmds.push({ id: "hr", label: "Линия", run: (e) => e.chain().focus().insertContent({ type: "thematic_break" }).run() });
  if (allowed.has("table")) cmds.push({
    id: "table",
    label: "Таблица 3×3",
    run: (e) => e.chain().focus().insertContent({
      type: "table",
      content: [
        { type: "table_row", content: [{ type: "table_cell" }, { type: "table_cell" }, { type: "table_cell" }] },
        { type: "table_row", content: [{ type: "table_cell" }, { type: "table_cell" }, { type: "table_cell" }] },
        { type: "table_row", content: [{ type: "table_cell" }, { type: "table_cell" }, { type: "table_cell" }] },
      ],
    }).run(),
  });
  return cmds;
}

interface Props { editor: Editor; schema: SchemaSnapshot; context: EntityContext }

export function SlashMenu({ editor, schema, context }: Props) {
  const [state, setState] = useState({ open: false, from: -1, query: "" });
  const [active, setActive] = useState(0);

  useEffect(() => {
    const upd = () => {
      const s = slashMenuKey.getState(editor.view.state);
      if (s) setState(s);
    };
    editor.on("transaction", upd);
    return () => { editor.off("transaction", upd); };
  }, [editor]);

  const allCmds = buildCommands(schema, context);
  const cmds = state.query
    ? allCmds.filter((c) => c.label.toLowerCase().includes(state.query.toLowerCase()))
    : allCmds;

  if (!state.open || cmds.length === 0) return null;

  const apply = (cmd: Cmd) => {
    consumeSlashMarker(editor.view, state.from);
    cmd.run(editor);
  };

  return (
    <div role="listbox" aria-label="Команды блока" className="ast-slash-menu">
      {cmds.map((c, i) => (
        <button
          key={c.id}
          type="button"
          aria-selected={active === i}
          onMouseDown={(e) => { e.preventDefault(); apply(c); }}
          onMouseEnter={() => setActive(i)}
        >
          {c.label}
        </button>
      ))}
      <button type="button" onClick={() => closeSlashMenu(editor.view)}>Esc — закрыть</button>
    </div>
  );
}
```

**Note про позиционирование:** для MVP рендерим slash-menu inline в DOM рядом с editor (parent — `AstEditor`). Точное позиционирование под курсор через `view.coordsAtPos(state.from)` + absolute — добавим, если визуально мешает. Это не блокер для функциональности.

- [ ] **Step 3: Failing test**

```tsx
// src/components/ast-editor/toolbar/slash-menu.test.tsx
import { describe, it, expect, afterEach } from "vitest";
import { Editor, Extension } from "@tiptap/core";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { SlashMenu } from "./slash-menu";
import { createSlashMenuPlugin, slashMenuKey } from "./slash-menu-plugin";
import { buildExtensions } from "../extensions";
import type { SchemaSnapshot } from "../types";

afterEach(cleanup);

const SchemaSnap: SchemaSnapshot = {
  blockLevels: { full: ["paragraph", "heading", "list", "thematic_break"] },
  entityBlockLimits: { full: 100 },
  entityContexts: { document: "full" },
  limits: { maxDepth: 32, maxTextLen: 100, maxContentItems: 100, maxMarksPerNode: 10 },
  urlPolicy: { dangerousSchemes: [] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

const slashHost = Extension.create({
  name: "slash-menu-host",
  addProseMirrorPlugins() { return [createSlashMenuPlugin()]; },
});

function makeEditor() {
  return new Editor({
    extensions: [
      ...buildExtensions({ snapshot: SchemaSnap, context: "document" }),
      slashHost,
    ],
    content: { type: "doc", content: [{ type: "paragraph" }] },
  });
}

describe("createSlashMenuPlugin", () => {
  it("handleTextInput opens state when '/' typed in empty paragraph", () => {
    const editor = makeEditor();
    const view = editor.view;
    const pos = view.state.selection.from; // inside empty paragraph
    const handled = view.someProp("handleTextInput", (fn) => fn(view, pos, pos, "/"));
    expect(handled).toBe(false); // returns false to let "/" insert normally
    const state = slashMenuKey.getState(view.state);
    expect(state?.open).toBe(true);
    expect(state?.from).toBe(pos);
    editor.destroy();
  });
});

describe("SlashMenu UI", () => {
  it("renders palette when state is open and applies heading on click", async () => {
    const editor = makeEditor();
    const { container } = render(
      <SlashMenu editor={editor} schema={SchemaSnap} context="document" />,
    );
    // Open via meta directly — UI-кейс не зависит от пути открытия.
    const pos = editor.view.state.selection.from;
    editor.view.dispatch(
      editor.view.state.tr
        .insertText("/", pos)
        .setMeta(slashMenuKey, { open: true, from: pos, query: "" }),
    );
    await waitFor(() => expect(container.querySelector('[role="listbox"]')).not.toBeNull());
    fireEvent.mouseDown(screen.getByText(/заголовок 1/i));
    expect(JSON.stringify(editor.getJSON())).toContain('"type":"heading"');
    editor.destroy();
  });
});
```

- [ ] **Step 4: Прогнать — оба теста PASS**

Run: `npx vitest run src/components/ast-editor/toolbar/slash-menu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-editor/toolbar/slash-menu-plugin.ts src/components/ast-editor/toolbar/slash-menu.tsx src/components/ast-editor/toolbar/slash-menu.test.tsx
git commit -m "feat(ast-editor): add slash-menu plugin and command palette UI"
```

---

## Task 7: Drift-warning hook

**Files:**
- Create: `src/components/ast-editor/drift-warn.ts`
- Test: `src/components/ast-editor/drift-warn.test.ts`

**Why:** spec §3 — нет compile-time чека для рассинхрона hardcoded extensions ↔ runtime schema. Нужен dev-warn. На прод-сборке — no-op.

**Behaviour:**
- На mount, если `process.env.NODE_ENV !== "production"`, сравниваем имена в `schema.nodes` / `schema.marks` с известным hardcode-набором (whitelist строк, синхронизированный с тем, что регистрирует `buildExtensions` Phase 1).
- Если `schema.nodes` содержит имя, которого нет в hardcode (бэк ввёл новый node) — `console.warn` с диффом.
- Если hardcode содержит имя, которого нет в schema (фронт устарел) — `console.warn`.
- Single fire per snapshot (по identity) — не спам в каждом render.

- [ ] **Step 1: Failing test**

```ts
// src/components/ast-editor/drift-warn.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDriftWarn } from "./drift-warn";
import type { SchemaSnapshot } from "./types";

const baseSnapshot = (nodes: string[], marks: string[]): SchemaSnapshot => ({
  blockLevels: {},
  entityBlockLimits: {},
  entityContexts: {},
  limits: { maxDepth: 32, maxTextLen: 1, maxContentItems: 1, maxMarksPerNode: 1 },
  urlPolicy: { dangerousSchemes: [] },
  nodes: new Map(nodes.map((n) => [n, { attrs: {} }])),
  marks: new Map(marks.map((m) => [m, { attrs: {} }])),
  exclusiveCategories: [],
});

describe("useDriftWarn", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { warnSpy.mockRestore(); });

  it("warns when runtime schema has a node missing from hardcode", () => {
    const schema = baseSnapshot(
      ["paragraph", "heading", "blockquote", "code_block", "list", "list_item", "image", "table", "table_row", "table_cell", "thematic_break", "hard_break", "text", "future_block"],
      ["bold", "italic", "code", "link", "lecture_ref", "glossary_ref", "document_ref", "media_ref", "canvas_ref", "comment_ref"],
    );
    renderHook(() => useDriftWarn(schema));
    expect(warnSpy).toHaveBeenCalled();
    const msg = (warnSpy.mock.calls[0]?.[0] as string) ?? "";
    expect(msg).toMatch(/future_block/);
  });

  it("warns when hardcode has a mark missing from runtime", () => {
    const schema = baseSnapshot(
      ["paragraph", "heading", "blockquote", "code_block", "list", "list_item", "image", "table", "table_row", "table_cell", "thematic_break", "hard_break", "text"],
      ["bold", "italic"], // missing several
    );
    renderHook(() => useDriftWarn(schema));
    expect(warnSpy).toHaveBeenCalled();
  });

  it("no warn when sets match", () => {
    const schema = baseSnapshot(
      ["paragraph", "heading", "blockquote", "code_block", "list", "list_item", "image", "table", "table_row", "table_cell", "thematic_break", "hard_break", "text"],
      ["bold", "italic", "code", "link", "lecture_ref", "glossary_ref", "document_ref", "media_ref", "canvas_ref", "comment_ref"],
    );
    renderHook(() => useDriftWarn(schema));
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Прогнать — fail (нет hook'а)**

Run: `npx vitest run src/components/ast-editor/drift-warn.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализация**

```ts
// src/components/ast-editor/drift-warn.ts
"use client";
import { useEffect } from "react";
import type { SchemaSnapshot } from "./types";

/**
 * Hardcoded set of node/mark names that the editor currently registers
 * (mirrors buildExtensions in extensions/index.ts and marks/* — Phase 1).
 * Update both lists when adding/removing extensions.
 */
const HARDCODE_NODES = new Set([
  "paragraph", "heading", "blockquote", "code_block", "list", "list_item",
  "image", "table", "table_row", "table_cell", "thematic_break", "hard_break",
  "text",
]);

const HARDCODE_MARKS = new Set([
  "bold", "italic", "code", "link",
  "lecture_ref", "glossary_ref", "document_ref",
  "media_ref", "canvas_ref", "comment_ref",
]);

const seen = new WeakSet<SchemaSnapshot>();

export function useDriftWarn(schema: SchemaSnapshot) {
  useEffect(() => {
    // Next.js inline-replace работает только для точечного доступа
    // (process.env.NODE_ENV), bracket-notation в браузерном бандле даст
    // ReferenceError. Не менять на process.env["NODE_ENV"].
    if (process.env.NODE_ENV === "production") return;
    if (seen.has(schema)) return;
    seen.add(schema);

    const runtimeNodes = new Set(schema.nodes.keys());
    const runtimeMarks = new Set(schema.marks.keys());

    const extraInRuntime = (a: Set<string>, b: Set<string>) =>
      [...a].filter((x) => !b.has(x));

    const newNodes = extraInRuntime(runtimeNodes, HARDCODE_NODES);
    const droppedNodes = extraInRuntime(HARDCODE_NODES, runtimeNodes);
    const newMarks = extraInRuntime(runtimeMarks, HARDCODE_MARKS);
    const droppedMarks = extraInRuntime(HARDCODE_MARKS, runtimeMarks);

    if (newNodes.length || droppedNodes.length || newMarks.length || droppedMarks.length) {
      console.warn(
        "[ast-editor] schema drift detected — regenerate src/api/schema.ts and update extensions:",
        { newNodes, droppedNodes, newMarks, droppedMarks },
      );
    }
  }, [schema]);
}
```

**Note:** runtime schema приходит из `/api/ast/schema`, нормализуется в `Map` (см. [schema-cache.ts](src/components/ast-editor/schema-cache.ts) и `SchemaSnapshot`). Бэк объявляет `text` и `hard_break` как nodes (`internal/ast/marks_export.go:57` `exportedNodeTypes` содержит `NodeText`, `NodeHardBreak`) — поэтому оставляем оба в `HARDCODE_NODES`.

- [ ] **Step 4: Прогнать — все тесты PASS**

Run: `npx vitest run src/components/ast-editor/drift-warn.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-editor/drift-warn.ts src/components/ast-editor/drift-warn.test.ts
git commit -m "feat(ast-editor): add dev-only schema-drift warn hook"
```

---

## Task 8: Wire EditorToolbar + SlashMenu + DriftWarn into AstEditor

**Files:**
- Modify: `src/components/ast-editor/ast-editor.tsx`

**Подход:** добавить опциональный `extraExtensions?: Extensions` в [use-ast-editor.ts](src/components/ast-editor/use-ast-editor.ts) (файл не frozen, монополия 2c). В `ast-editor.tsx` объявить `slashHost` extension в **module scope** (не внутри компонента — иначе на каждом рендере новый объект, что в худшем случае триггерит реинициализацию `useEditor`).

- [ ] **Step 1a: use-ast-editor.ts — добавить extraExtensions**

```ts
// src/components/ast-editor/use-ast-editor.ts (DIFF)
import type { Editor, Extensions } from "@tiptap/react";

export interface UseAstEditorOptions {
  // … existing …
  extraExtensions?: Extensions | undefined;
}

export function useAstEditor(opts: UseAstEditorOptions): Editor | null {
  const { /* … existing destructuring … */ extraExtensions } = opts;
  return useEditor(
    {
      // …
      extensions: [
        ...buildExtensions({ snapshot: schema, context: entityContext, placeholder }),
        ...(extraExtensions ?? []),
      ],
      // …
    },
    [editable, entityContext],
  );
}
```

- [ ] **Step 1b: ast-editor.tsx — wire toolbar + slash + drift-warn**

```tsx
// src/components/ast-editor/ast-editor.tsx
import { Extension } from "@tiptap/core";
import { EditorToolbar } from "./toolbar/toolbar";
import { SlashMenu } from "./toolbar/slash-menu";
import { createSlashMenuPlugin } from "./toolbar/slash-menu-plugin";
import { useDriftWarn } from "./drift-warn";
// … existing imports …

// Module scope — стабильная ссылка между рендерами.
const slashHost = Extension.create({
  name: "slash-menu-host",
  addProseMirrorPlugins() { return [createSlashMenuPlugin()]; },
});

// Внутри AstEditor: до useImperativeHandle (хук ДО любого conditional return)
useDriftWarn(schema);

// useAstEditor — добавить параметр:
const editor = useAstEditor({
  // … existing …
  extraExtensions: [slashHost],
});

// Замена return-блока (после if (!editor) return null;):
return (
  <div
    className={`ast-editor border border-(--color-border) rounded-lg overflow-hidden
      ${props.editable === false ? "opacity-50 pointer-events-none" : ""}`}
  >
    {props.editable !== false && (
      <EditorToolbar editor={editor} schema={schema} context={props.entityContext} />
    )}
    <EditorContent editor={editor} className="prose prose-sm max-w-none" />
    {props.editable !== false && (
      <SlashMenu editor={editor} schema={schema} context={props.entityContext} />
    )}
    {props.name ? (
      <input
        ref={hiddenInputRef}
        type="hidden"
        name={props.name}
        defaultValue={JSON.stringify(props.defaultValue ?? [])}
      />
    ) : null}
  </div>
);
```

**Уточнение про file-collision:** `use-ast-editor.ts` — НЕ касается ни 2a ни 2b → 2c имеет монополию.

- [ ] **Step 2: Прогнать весь test-suite**

Run: `npm test -- --run`
Expected: все тесты PASS.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/ast-editor/ast-editor.tsx src/components/ast-editor/use-ast-editor.ts
git commit -m "feat(ast-editor): wire toolbar, slash-menu and drift-warn into AstEditor"
```

---

## Task 9: README

**Files:**
- Create: `src/components/ast-editor/README.md`

- [ ] **Step 1: Содержимое**

```md
# AstEditor

Tiptap-based редактор `ast.Block[]`. Источник правды — бэк (`/api/ast/schema` + `internal/ast/`).

## Использование

```tsx
import { AstEditor, SchemaContextProvider } from "@/components/ast-editor";

<SchemaContextProvider>
  <AstEditor
    entityContext="document"
    defaultValue={blocks}
    onChange={setBlocks}
    editable={canEdit}
  />
</SchemaContextProvider>
```

`AstEditor` работает в обоих режимах — controlled (`onChange`) и uncontrolled (`ref.getBlocks()`).
Для FormData-патерна задайте `name="blocks"` — рендерится hidden-input с `JSON.stringify(blocks)`.

## Архитектура

- **Hardcoded extensions** (Phase 1): по одному `Node.create` / `Mark.create` на тип в `internal/ast/schema.go`. Имена snake_case (`code_block`, `table_row`, `hard_break`).
- **Runtime schema** (Phase 1, schema-context): `/api/ast/schema` → `block_levels`, лимиты, attr-правила, url-policy.
- **Validation plugins** (Phase 1): `limits-plugin` (численные лимиты), `attr-plugin` (per-attr из ExportedAttr), `dedup-block-id-plugin` (split-paragraph fixup).
- **Image upload** (Phase 2a, в разработке): `upload/upload-image.ts` server action + paste/drop plugin.
- **Pickers** (Phase 2b, в разработке): AsyncCombobox + 6 категорий + 2-stage comment picker.
- **Toolbar + slash-menu** (Phase 2c): per-context кнопки и `/`-палитра.
- **Drift-warn** (Phase 2c): dev-only sanity-check hardcode ⊆ runtime.

## Frozen zones

- `src/api/schema.ts` — регенерация координированно (foundation-update PR).
- `src/utils/*`, `src/components/ui/*`, `package.json` — за пределами этого слайса.

## Тесты

- `*.test.tsx` — RTL для UI компонентов.
- `pm-schema.test.ts` — round-trip через реальную PM-schema (catches name-mismatch и content-model).
- `round-trip.test.ts` — JSON ↔ JSON через serialize/deserialize.
- `*-plugin.test.ts` — изолированно через mock Editor.

## Что НЕ покрыто (Phase 3+)

- Image toolbar-кнопка / RefMenu trigger в toolbar / `@`-suggestion — добавляются tail-PR'ами после merge 2a + 2b.
- Drag-handle reorder блоков.
- Heading anchor (`heading.id`) inline edit.
- Code-block syntax highlight.
- Виртуализация для документов >5000 блоков.
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ast-editor/README.md
git commit -m "docs(ast-editor): add slice README"
```

---

## Task 10: Final lint/test/build + PR

- [ ] **Step 1: Гейты**

Run: `npm run lint && npm test -- --run && npm run build`
Expected: 3 зелёных.

- [ ] **Step 2: PR**

Title: `feat(ast-editor): Phase 2c — toolbar + slash-menu + drift-warn + README`.

PR body checklist:
- [ ] Покрыто тестами: toolbar gating (2 кейса), slash-menu (1), drift-warn (3).
- [ ] Frozen zones не тронуты (`git diff --name-only main...HEAD` — только `src/components/ast-editor/{toolbar,drift-warn.ts,drift-warn.test.ts,README.md,ast-editor.tsx,use-ast-editor.ts}`).
- [ ] No-conflict с 2a: ни один файл не пересекается.
- [ ] No-conflict с 2b: ни один файл не пересекается.

---

## Self-review checklist

- [ ] `git diff --name-only main...HEAD` — список соответствует «Файловой структуре»: только новые файлы + `ast-editor.tsx` + `use-ast-editor.ts`.
- [ ] `extensions/index.ts` НЕ изменён (зарезервирован за 2a).
- [ ] `extensions/nodes/image.ts` НЕ изменён (зарезервирован за 2a).
- [ ] `pickers/*` отсутствуют (зарезервированы за 2b).
- [ ] `package.json`, `src/api/schema.ts`, `src/utils/*`, `src/components/ui/*` НЕ изменены.
- [ ] `HARDCODE_NODES` / `HARDCODE_MARKS` в `drift-warn.ts` совпадают с реально регистрируемыми именами в `extensions/*` (Phase 1).
- [ ] Toolbar в `comment` контексте показывает только inline marks + link.
- [ ] Toolbar в `document` контексте показывает все группы.
- [ ] Slash-menu срабатывает только в начале пустого параграфа.
- [ ] Slash-menu не показывает команд для блоков, не разрешённых per-context.

## Что НЕ входит в этот план

- **Image toolbar-кнопка** — нужен `uploadImage` из 2a. После merge 2a → mini-PR `feat(ast-editor): wire image button into toolbar`.
- **RefMenu trigger в toolbar** — нужен `RefMenu` из 2b. После merge 2b → mini-PR `feat(ast-editor): wire ref-menu button into toolbar`.
- **`@`-suggestion** (печать `@` открывает RefMenu inline) — после 2b, та же mini-PR.
- **Slash-menu позиционирование под курсором** через `view.coordsAtPos` — improvement-PR.
- **Sentry/observability для drift-warn** — backlog.
- **Storage-URL schema-driven** — backend story (см. design §9), не frontend Phase 2.
- **Миграция первого консьюмера** (lecture/comment/glossary использует AstEditor) — отдельный feature-PR после Phase 2 merge.
