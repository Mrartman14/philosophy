# AST Editor Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать программно-используемое ядро AST-эдитора — `<AstEditor>` компонент, принимающий и возвращающий `ast.Block[]`, без UI пикеров/тулбара/аплоада. После выполнения этого плана эдитор готов к round-trip serialize/deserialize и валидации; Phase 2 (UI) идёт отдельным планом.

**Architecture:** Гибрид по design-spec'у §3 — Tiptap-extensions хардкодятся (по одному классу на nodeType / markType), лимиты и per-attr правила приходят рантаймом из `/api/ast/schema`. Schema кэшируется через module-level singleton promise. Валидация — soft-block через ProseMirror plugin.

**Tech Stack:** Next.js 16, React 19, Tiptap 3 (StarterKit + custom extensions), Base UI, Vitest + jsdom, openapi-fetch.

**Spec:** [docs/superpowers/specs/2026-04-30-ast-editor-design.md](../specs/2026-04-30-ast-editor-design.md)

**Frozen zone:** `src/components/ast-editor/` — foundation-update PR. Не трогаем `src/components/markdown-editor/` и другие frozen zones (см. CLAUDE.md).

---

## Файловая структура (создаётся этим планом)

```
src/components/ast-editor/
  index.ts                    # public API (re-exports)
  ast-editor.tsx              # entry React component
  use-ast-editor.ts           # Tiptap setup hook
  types.ts                    # AstBlock, EntityContext, SchemaSnapshot
  schema-cache.ts             # module-level cached promise + reset
  schema-context.tsx          # SchemaContextProvider + useSchema hook
  serializer.ts               # PM Node → ast.Block[]
  deserializer.ts             # ast.Block[] → ProseMirror JSON
  extensions/
    index.ts                  # buildExtensions(snapshot, ctx)
    nodes/
      heading.ts
      code-block.ts
      list.ts                 # list + list-item combined
      image.ts
      table.ts                # table + row + cell
    marks/
      link.ts
      nav-ref.ts              # parameterized for 6 nav-marks
  validation/
    limits-plugin.ts          # ProseMirror plugin: max_text_len, max_content_items, max_marks_per_node, max_depth
    attr-plugin.ts            # ProseMirror plugin: per-attr validation from ExportedAttr
  __fixtures__/
    sample-blocks.ts          # AstBlock[] fixtures for round-trip tests
  schema-cache.test.ts
  serializer.test.ts
  deserializer.test.ts
  round-trip.test.ts
  ast-editor.test.tsx
```

Параграфы и hard_break не получают своих файлов — берутся из StarterKit «как есть».

---

## Task 1: Создать каркас `types.ts`

**Files:**
- Create: `src/components/ast-editor/types.ts`

- [ ] **Step 1: Создать файл с базовыми типами**

```ts
// src/components/ast-editor/types.ts
import type { components } from "@/api/schema";

export type AstBlock = components["schemas"]["ast.Block"];
export type AstNode = components["schemas"]["ast.Node"];
export type AstMark = components["schemas"]["ast.Mark"];
export type ExportedAttr = components["schemas"]["ast.ExportedAttr"];
export type ExportedElement = components["schemas"]["ast.ExportedElement"];
export type ExportedNode = components["schemas"]["ast.ExportedNode"];
export type SchemaResponse = components["schemas"]["ast.SchemaResponse"];

export type EntityContext =
  | "document"
  | "glossary"
  | "comment"
  | "annotation"
  | "banner"
  | "event"
  | "form";

/** Snapshot of /api/ast/schema fetched at runtime. */
export interface SchemaSnapshot {
  blockLevels: Record<string, string[]>;
  entityBlockLimits: Record<string, number>;
  entityContexts: Record<string, string>;
  limits: {
    maxDepth: number;
    maxTextLen: number;
    maxContentItems: number;
    maxMarksPerNode: number;
  };
  urlPolicy: {
    dangerousSchemes: string[];
  };
  /** Map keyed by NodeType → ExportedNode (Content, Marks, Leaf, Attrs). */
  nodes: Map<string, ExportedNode>;
  /** Map keyed by MarkType → ExportedElement (Category, Attrs). */
  marks: Map<string, ExportedElement>;
  exclusiveCategories: string[];
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: PASS — типы импортируются из `@/api/schema`, всё на месте.

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/types.ts
git commit -m "feat(ast-editor): types.ts — narrow types from @/api/schema"
```

---

## Task 2: schema-cache (module-level cached promise)

**Files:**
- Create: `src/components/ast-editor/schema-cache.ts`
- Create: `src/components/ast-editor/schema-cache.test.ts`

- [ ] **Step 1: Написать failing-тест**

```ts
// src/components/ast-editor/schema-cache.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadSchema, __resetSchemaCache } from "./schema-cache";

describe("schema-cache", () => {
  beforeEach(() => {
    __resetSchemaCache();
    vi.restoreAllMocks();
  });

  it("returns same promise on repeated calls", () => {
    const fetcher = vi.fn().mockResolvedValue({
      block_levels: {}, entity_block_limits: {}, entity_contexts: {},
      limits: { max_depth: 32, max_text_len: 100, max_content_items: 10, max_marks_per_node: 5 },
      url_policy: { dangerous_schemes: [] },
      nodes: [], elements: [], exclusive_categories: [],
    });
    const a = loadSchema(fetcher);
    const b = loadSchema(fetcher);
    expect(a).toBe(b);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("normalizes nodes and marks into Maps", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      block_levels: { full: ["paragraph"] },
      entity_block_limits: { document: 20000 },
      entity_contexts: { document: "full" },
      limits: { max_depth: 32, max_text_len: 100, max_content_items: 10, max_marks_per_node: 5 },
      url_policy: { dangerous_schemes: ["javascript"] },
      nodes: [{ type: "paragraph", content: ["text"], marks: ["bold"], leaf: false }],
      elements: [{ name: "bold", category: "formatting" }],
      exclusive_categories: ["navigation"],
    });
    const snap = await loadSchema(fetcher);
    expect(snap.nodes.get("paragraph")?.content).toEqual(["text"]);
    expect(snap.marks.get("bold")?.category).toBe("formatting");
    expect(snap.limits.maxTextLen).toBe(100);
    expect(snap.urlPolicy.dangerousSchemes).toEqual(["javascript"]);
  });

  it("resets cache via __resetSchemaCache", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      block_levels: {}, entity_block_limits: {}, entity_contexts: {},
      limits: { max_depth: 32, max_text_len: 100, max_content_items: 10, max_marks_per_node: 5 },
      url_policy: { dangerous_schemes: [] },
      nodes: [], elements: [], exclusive_categories: [],
    });
    await loadSchema(fetcher);
    __resetSchemaCache();
    await loadSchema(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Проверить, что тест не компилируется (модуль не создан)**

Run: `npm test -- schema-cache.test.ts`
Expected: FAIL — `Cannot find module './schema-cache'`.

- [ ] **Step 3: Реализовать модуль**

```ts
// src/components/ast-editor/schema-cache.ts
import type { SchemaResponse, SchemaSnapshot, ExportedNode, ExportedElement } from "./types";

let cached: Promise<SchemaSnapshot> | null = null;

export function loadSchema(
  fetcher: () => Promise<SchemaResponse>,
): Promise<SchemaSnapshot> {
  if (!cached) {
    cached = fetcher().then(normalize).catch((err) => {
      cached = null;
      throw err;
    });
  }
  return cached;
}

export function __resetSchemaCache(): void {
  cached = null;
}

function normalize(resp: SchemaResponse): SchemaSnapshot {
  const nodes = new Map<string, ExportedNode>();
  for (const n of resp.nodes ?? []) {
    if (n.type) nodes.set(n.type, n);
  }
  const marks = new Map<string, ExportedElement>();
  for (const e of resp.elements ?? []) {
    if (e.name) marks.set(e.name, e);
  }
  return {
    blockLevels: resp.block_levels ?? {},
    entityBlockLimits: resp.entity_block_limits ?? {},
    entityContexts: resp.entity_contexts ?? {},
    limits: {
      maxDepth: resp.limits?.max_depth ?? 32,
      maxTextLen: resp.limits?.max_text_len ?? 1_000_000,
      maxContentItems: resp.limits?.max_content_items ?? 10_000,
      maxMarksPerNode: resp.limits?.max_marks_per_node ?? 100,
    },
    urlPolicy: {
      dangerousSchemes: resp.url_policy?.dangerous_schemes ?? [],
    },
    nodes,
    marks,
    exclusiveCategories: resp.exclusive_categories ?? [],
  };
}
```

- [ ] **Step 4: Прогнать тест**

Run: `npm test -- schema-cache.test.ts`
Expected: PASS — все три теста зелёные.

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-editor/schema-cache.ts src/components/ast-editor/schema-cache.test.ts
git commit -m "feat(ast-editor): schema-cache with module-level singleton"
```

---

## Task 3: SchemaContextProvider

**Files:**
- Create: `src/components/ast-editor/schema-context.tsx`

- [ ] **Step 1: Создать Provider и hook**

```tsx
// src/components/ast-editor/schema-context.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createApiClient } from "@/api/client";
import { loadSchema } from "./schema-cache";
import type { SchemaSnapshot, SchemaResponse } from "./types";

const SchemaContext = createContext<SchemaSnapshot | null>(null);

async function defaultFetcher(): Promise<SchemaResponse> {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/ast/schema");
  if (error || !data) throw new Error(error?.message ?? "schema fetch failed");
  return data;
}

interface ProviderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Test seam — overrides the default api fetcher. */
  fetcher?: () => Promise<SchemaResponse>;
}

export function SchemaContextProvider({
  children,
  fallback = null,
  fetcher = defaultFetcher,
}: ProviderProps) {
  const [snapshot, setSnapshot] = useState<SchemaSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSchema(fetcher)
      .then((s) => {
        if (!cancelled) setSnapshot(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  if (error) {
    return <div role="alert">AST schema недоступна: {error.message}</div>;
  }
  if (!snapshot) return <>{fallback}</>;
  return <SchemaContext.Provider value={snapshot}>{children}</SchemaContext.Provider>;
}

export function useSchema(): SchemaSnapshot {
  const ctx = useContext(SchemaContext);
  if (!ctx) throw new Error("useSchema must be used inside <SchemaContextProvider>");
  return ctx;
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/schema-context.tsx
git commit -m "feat(ast-editor): SchemaContextProvider with module-level cache"
```

---

## Task 4: AstEditor entry component skeleton

**Files:**
- Create: `src/components/ast-editor/ast-editor.tsx`
- Create: `src/components/ast-editor/use-ast-editor.ts`

- [ ] **Step 1: useAstEditor hook (минимальный, без extensions)**

```ts
// src/components/ast-editor/use-ast-editor.ts
"use client";

import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { Editor } from "@tiptap/react";
import type { AstBlock, EntityContext, SchemaSnapshot } from "./types";

export interface UseAstEditorOptions {
  defaultValue?: AstBlock[];
  entityContext: EntityContext;
  editable?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  schema: SchemaSnapshot;
  onChange?: (blocks: AstBlock[]) => void;
}

export function useAstEditor(opts: UseAstEditorOptions): Editor | null {
  const { defaultValue, editable = true, placeholder, ariaLabel } = opts;
  return useEditor(
    {
      immediatelyRender: false,
      shouldRerenderOnTransaction: true,
      editable,
      editorProps: {
        attributes: {
          "aria-label": ariaLabel ?? "Редактор AST",
          role: "textbox",
          "aria-multiline": "true",
        },
      },
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: placeholder ?? "" }),
      ],
      content: { type: "doc", content: deserializePlaceholder(defaultValue) },
    },
    [editable],
  );
}

// Stub — implemented in Task 9 (deserializer).
function deserializePlaceholder(_blocks?: AstBlock[]) {
  return [{ type: "paragraph" }];
}
```

- [ ] **Step 2: AstEditor entry component**

```tsx
// src/components/ast-editor/ast-editor.tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorContent } from "@tiptap/react";
import { useAstEditor } from "./use-ast-editor";
import { useSchema } from "./schema-context";
import type { AstBlock, EntityContext } from "./types";

export interface AstEditorProps {
  defaultValue?: AstBlock[];
  value?: AstBlock[];
  onChange?: (blocks: AstBlock[]) => void;
  entityContext: EntityContext;
  defaultLectureId?: string;
  name?: string;
  editable?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}

export interface AstEditorRef {
  getBlocks(): AstBlock[];
  validate(): string | null;
}

export const AstEditor = forwardRef<AstEditorRef, AstEditorProps>(function AstEditor(
  props,
  ref,
) {
  const schema = useSchema();
  const editor = useAstEditor({
    defaultValue: props.defaultValue ?? props.value ?? [],
    entityContext: props.entityContext,
    editable: props.editable !== false,
    placeholder: props.placeholder,
    ariaLabel: props.ariaLabel,
    schema,
    onChange: props.onChange,
  });

  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      getBlocks: () => [], // stub — wired in Task 22
      validate: () => null, // stub — wired in Task 22
    }),
    [],
  );

  // hidden-input sync — wired in Task 26
  useEffect(() => undefined, []);

  if (!editor) return null;

  return (
    <div
      className={`ast-editor border border-(--color-border) rounded-lg overflow-hidden
        ${props.editable === false ? "opacity-50 pointer-events-none" : ""}`}
    >
      <EditorContent editor={editor} className="prose prose-sm max-w-none" />
      {props.name ? (
        <input
          ref={hiddenInputRef}
          type="hidden"
          name={props.name}
          defaultValue={JSON.stringify(props.defaultValue ?? props.value ?? [])}
        />
      ) : null}
    </div>
  );
});
```

- [ ] **Step 3: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ast-editor/ast-editor.tsx src/components/ast-editor/use-ast-editor.ts
git commit -m "feat(ast-editor): scaffold entry component + hook (no extensions yet)"
```

---

## Task 5: Smoke test — AstEditor mounts with empty defaultValue

**Files:**
- Create: `src/components/ast-editor/ast-editor.test.tsx`

- [ ] **Step 1: Написать failing-тест**

```tsx
// src/components/ast-editor/ast-editor.test.tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SchemaContextProvider } from "./schema-context";
import { AstEditor } from "./ast-editor";
import { __resetSchemaCache } from "./schema-cache";

const fakeSchema = {
  block_levels: { full: ["paragraph"] },
  entity_block_limits: { document: 20000 },
  entity_contexts: { document: "full" },
  limits: { max_depth: 32, max_text_len: 1_000_000, max_content_items: 10_000, max_marks_per_node: 100 },
  url_policy: { dangerous_schemes: ["javascript"] },
  nodes: [{ type: "paragraph", content: ["text"], marks: ["bold"], leaf: false }],
  elements: [{ name: "bold", category: "formatting" }],
  exclusive_categories: ["navigation"],
};

describe("AstEditor smoke", () => {
  beforeEach(() => {
    __resetSchemaCache();
  });

  it("mounts with empty defaultValue", async () => {
    const fetcher = vi.fn().mockResolvedValue(fakeSchema);
    render(
      <SchemaContextProvider fetcher={fetcher} fallback={<div>loading</div>}>
        <AstEditor entityContext="document" defaultValue={[]} ariaLabel="test-editor" />
      </SchemaContextProvider>,
    );
    expect(await screen.findByRole("textbox", { name: "test-editor" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Проверить наличие @testing-library/react**

Run: `npm ls @testing-library/react`
Expected: либо установлен, либо отсутствует.

Если отсутствует — установить:

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Прогнать тест**

Run: `npm test -- ast-editor.test.tsx`
Expected: PASS — компонент монтируется и aria-label виден.

- [ ] **Step 4: Commit**

```bash
git add src/components/ast-editor/ast-editor.test.tsx package.json package-lock.json
git commit -m "test(ast-editor): smoke test — mounts with empty defaultValue"
```

---

## Task 6: Тестовые фикстуры (sample-blocks.ts)

**Files:**
- Create: `src/components/ast-editor/__fixtures__/sample-blocks.ts`

- [ ] **Step 1: Написать fixture-файл со всеми типами нод и марков**

```ts
// src/components/ast-editor/__fixtures__/sample-blocks.ts
import type { AstBlock } from "../types";

export const fixtureParagraph: AstBlock = {
  id: "p1",
  type: "paragraph",
  position: 0,
  content: [{ type: "text", text: "Привет, мир." }],
  text: "Привет, мир.",
};

export const fixtureHeading: AstBlock = {
  id: "h1",
  type: "heading",
  position: 0,
  attrs: { level: 2 },
  content: [{ type: "text", text: "Заголовок" }],
  text: "Заголовок",
};

export const fixtureBlockquote: AstBlock = {
  id: "bq1",
  type: "blockquote",
  position: 0,
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Цитата." }] },
  ],
  text: "Цитата.",
};

export const fixtureCodeBlock: AstBlock = {
  id: "cb1",
  type: "code_block",
  position: 0,
  attrs: { language: "go" },
  text: "func main() {}\n",
};

export const fixtureBulletList: AstBlock = {
  id: "ul1",
  type: "list",
  position: 0,
  attrs: { ordered: false },
  content: [
    {
      type: "list_item",
      content: [{ type: "paragraph", content: [{ type: "text", text: "один" }] }],
    },
    {
      type: "list_item",
      content: [{ type: "paragraph", content: [{ type: "text", text: "два" }] }],
    },
  ],
  text: "один\nдва",
};

export const fixtureOrderedList: AstBlock = {
  id: "ol1",
  type: "list",
  position: 0,
  attrs: { ordered: true, start: 3 },
  content: [
    {
      type: "list_item",
      content: [{ type: "paragraph", content: [{ type: "text", text: "третий" }] }],
    },
  ],
  text: "третий",
};

export const fixtureTaskList: AstBlock = {
  id: "tl1",
  type: "list",
  position: 0,
  attrs: { ordered: false },
  content: [
    {
      type: "list_item",
      attrs: { checked: true },
      content: [{ type: "paragraph", content: [{ type: "text", text: "сделано" }] }],
    },
  ],
  text: "сделано",
};

export const fixtureImage: AstBlock = {
  id: "img1",
  type: "image",
  position: 0,
  attrs: {
    storage_key: "0".repeat(64),
    alt: "alt-текст",
    caption: "подпись",
  },
  text: "",
};

export const fixtureThematicBreak: AstBlock = {
  id: "hr1",
  type: "thematic_break",
  position: 0,
  text: "",
};

export const fixtureTable: AstBlock = {
  id: "tbl1",
  type: "table",
  position: 0,
  content: [
    {
      type: "table_row",
      attrs: { header: true },
      content: [
        {
          type: "table_cell",
          attrs: { align: "left" },
          content: [{ type: "text", text: "колонка" }],
        },
      ],
    },
    {
      type: "table_row",
      content: [
        {
          type: "table_cell",
          content: [{ type: "text", text: "ячейка" }],
        },
      ],
    },
  ],
  text: "колонка\nячейка",
};

export const fixtureFormattingMarks: AstBlock = {
  id: "fm1",
  type: "paragraph",
  position: 0,
  content: [
    { type: "text", marks: [{ type: "bold" }], text: "жирный" },
    { type: "text", text: " и " },
    { type: "text", marks: [{ type: "italic" }], text: "курсив" },
    { type: "text", text: " и " },
    { type: "text", marks: [{ type: "code" }], text: "код" },
  ],
  text: "жирный и курсив и код",
};

export const fixtureLink: AstBlock = {
  id: "lnk1",
  type: "paragraph",
  position: 0,
  content: [
    {
      type: "text",
      marks: [{ type: "link", attrs: { href: "https://example.com", title: "пример" } }],
      text: "ссылка",
    },
  ],
  text: "ссылка",
};

export const fixtureNavMarks: AstBlock = {
  id: "nm1",
  type: "paragraph",
  position: 0,
  content: [
    {
      type: "text",
      marks: [{ type: "lecture_ref", attrs: { id: "11111111-1111-1111-1111-111111111111" } }],
      text: "лекция",
    },
    { type: "text", text: " " },
    {
      type: "text",
      marks: [{ type: "glossary_ref", attrs: { id: "22222222-2222-2222-2222-222222222222" } }],
      text: "термин",
    },
    { type: "text", text: " " },
    {
      type: "text",
      marks: [{ type: "comment_ref", attrs: { id: "33333333-3333-3333-3333-333333333333" } }],
      text: "комментарий",
    },
  ],
  text: "лекция термин комментарий",
};

export const fixtureFullDocument: AstBlock[] = [
  fixtureHeading,
  fixtureParagraph,
  fixtureFormattingMarks,
  fixtureLink,
  fixtureNavMarks,
  fixtureBlockquote,
  fixtureCodeBlock,
  fixtureBulletList,
  fixtureOrderedList,
  fixtureTaskList,
  fixtureImage,
  fixtureThematicBreak,
  fixtureTable,
];
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/__fixtures__/sample-blocks.ts
git commit -m "test(ast-editor): fixtures covering all node and mark types"
```

---

## Task 7: Heading extension (custom — id-attr)

**Files:**
- Create: `src/components/ast-editor/extensions/nodes/heading.ts`

- [ ] **Step 1: Создать extension с id-attr и block-id-attr**

```ts
// src/components/ast-editor/extensions/nodes/heading.ts
import Heading from "@tiptap/extension-heading";

export const HeadingExt = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-heading-id"),
        renderHTML: (attrs: { id?: string | null }) =>
          attrs.id ? { "data-heading-id": attrs.id } : {},
      },
      blockId: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-block-id") ?? "",
        renderHTML: (attrs: { blockId?: string }) =>
          attrs.blockId ? { "data-block-id": attrs.blockId } : {},
      },
    };
  },
}).configure({ levels: [1, 2, 3, 4, 5, 6] });
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/extensions/nodes/heading.ts
git commit -m "feat(ast-editor): heading extension with id and block-id attrs"
```

---

## Task 8: code-block extension (leaf-like, language attr, text in node)

**Files:**
- Create: `src/components/ast-editor/extensions/nodes/code-block.ts`

- [ ] **Step 1: Создать extension**

```ts
// src/components/ast-editor/extensions/nodes/code-block.ts
import CodeBlock from "@tiptap/extension-code-block";

export const CodeBlockExt = CodeBlock.extend({
  addAttributes() {
    return {
      language: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-language"),
        renderHTML: (attrs: { language?: string | null }) =>
          attrs.language ? { "data-language": attrs.language } : {},
      },
      blockId: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-block-id") ?? "",
        renderHTML: (attrs: { blockId?: string }) =>
          attrs.blockId ? { "data-block-id": attrs.blockId } : {},
      },
    };
  },
});
```

`@tiptap/extension-code-block` уже установлен косвенно через StarterKit; экспорт идёт оттуда.

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/extensions/nodes/code-block.ts
git commit -m "feat(ast-editor): code-block extension with language attr"
```

---

## Task 9: list + list_item extension (custom, replaces StarterKit's three list types)

**Files:**
- Create: `src/components/ast-editor/extensions/nodes/list.ts`

- [ ] **Step 1: Создать custom Tiptap nodes**

```ts
// src/components/ast-editor/extensions/nodes/list.ts
import { Node, mergeAttributes } from "@tiptap/core";

export const ListExt = Node.create({
  name: "list",
  group: "block",
  content: "list_item+",

  addAttributes() {
    return {
      ordered: { default: false },
      start: { default: null },
      blockId: { default: "" },
    };
  },

  parseHTML() {
    return [
      { tag: "ul[data-list]", attrs: { ordered: false } },
      { tag: "ol[data-list]", attrs: { ordered: true } },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const tag = node.attrs.ordered ? "ol" : "ul";
    const attrs = mergeAttributes(HTMLAttributes, {
      "data-list": "",
      ...(node.attrs.ordered && node.attrs.start != null
        ? { start: String(node.attrs.start) }
        : {}),
      ...(node.attrs.blockId ? { "data-block-id": node.attrs.blockId } : {}),
    });
    return [tag, attrs, 0];
  },
});

export const ListItemExt = Node.create({
  name: "list_item",
  content: "paragraph block*",
  defining: true,

  addAttributes() {
    return {
      checked: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "li" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const attrs = mergeAttributes(HTMLAttributes, {
      ...(typeof node.attrs.checked === "boolean"
        ? { "data-checked": node.attrs.checked ? "true" : "false" }
        : {}),
    });
    return ["li", attrs, 0];
  },
});
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/extensions/nodes/list.ts
git commit -m "feat(ast-editor): custom list/list_item replacing StarterKit defaults"
```

---

## Task 10: image extension (stub — attrs only, NodeView в Phase 2)

**Files:**
- Create: `src/components/ast-editor/extensions/nodes/image.ts`

- [ ] **Step 1: Создать extension**

```ts
// src/components/ast-editor/extensions/nodes/image.ts
import { Node, mergeAttributes } from "@tiptap/core";

export const ImageExt = Node.create({
  name: "image",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      storage_key: { default: "" },
      alt: { default: "" },
      caption: { default: "" },
      blockId: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-ast-image]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = mergeAttributes(HTMLAttributes, { "data-ast-image": "" });
    return ["figure", attrs];
  },
});
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/extensions/nodes/image.ts
git commit -m "feat(ast-editor): image node (stub, NodeView в Phase 2)"
```

---

## Task 11: table family — custom config

**Files:**
- Create: `src/components/ast-editor/extensions/nodes/table.ts`

- [ ] **Step 1: Создать extension с header-attr на row, align-attr на cell**

```ts
// src/components/ast-editor/extensions/nodes/table.ts
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";

export const TableExt = Table.configure({ resizable: false });

export const TableRowExt = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      header: { default: false },
      blockId: { default: "" },
    };
  },
  renderHTML({ HTMLAttributes, node }) {
    const attrs = {
      ...HTMLAttributes,
      ...(node.attrs.header ? { "data-header": "true" } : {}),
      ...(node.attrs.blockId ? { "data-block-id": node.attrs.blockId } : {}),
    };
    return ["tr", attrs, 0];
  },
});

export const TableCellExt = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: { default: null },
    };
  },
  renderHTML({ HTMLAttributes, node }) {
    const tag = "td";
    const attrs = {
      ...HTMLAttributes,
      ...(node.attrs.align ? { "data-align": node.attrs.align } : {}),
    };
    return [tag, attrs, 0];
  },
});
```

`TableHeader` extension не используется — header-state это атрибут row.

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/extensions/nodes/table.ts
git commit -m "feat(ast-editor): table family with header on row, align on cell"
```

---

## Task 12: link mark with scheme allowlist

**Files:**
- Create: `src/components/ast-editor/extensions/marks/link.ts`

- [ ] **Step 1: Создать extension**

```ts
// src/components/ast-editor/extensions/marks/link.ts
import Link from "@tiptap/extension-link";

export const LinkExt = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      title: { default: null },
    };
  },
}).configure({
  openOnClick: false,
  autolink: false,
  protocols: ["http", "https", "mailto"],
});
```

`protocols` — built-in allowlist Link extension'а. Совпадает с бэк-конфигом `internal/ast/marks.go:108`.

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/extensions/marks/link.ts
git commit -m "feat(ast-editor): link mark with http/https/mailto allowlist"
```

---

## Task 13: nav-ref mark factory (parameterized for 6 nav-marks)

**Files:**
- Create: `src/components/ast-editor/extensions/marks/nav-ref.ts`

- [ ] **Step 1: Создать parameterized mark factory**

```ts
// src/components/ast-editor/extensions/marks/nav-ref.ts
import { Mark, mergeAttributes } from "@tiptap/core";

const NAV_MARK_TYPES = [
  "lecture_ref",
  "glossary_ref",
  "document_ref",
  "comment_ref",
  "media_ref",
  "canvas_ref",
] as const;

export type NavMarkType = (typeof NAV_MARK_TYPES)[number];

/**
 * Factory creating a Tiptap Mark for one of the 6 navigation-ref types.
 * Stores all attrs as `data-attr-<name>` on a span for round-trip safety.
 * Specific picker UX is wired in Phase 2.
 */
export function createNavRefMark(type: NavMarkType) {
  return Mark.create({
    name: type,
    inclusive: false,
    excludes: NAV_MARK_TYPES.filter((t) => t !== type).join(" "),

    addAttributes() {
      return {
        id: { default: "" },
        start_block_id: { default: null },
        start_char: { default: null },
        end_block_id: { default: null },
        end_char: { default: null },
        block_ids: { default: null },
        exact: { default: null },
        prefix: { default: null },
        suffix: { default: null },
        start: { default: null },
        end: { default: null },
      };
    },

    parseHTML() {
      return [{ tag: `span[data-mark="${type}"]` }];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        "span",
        mergeAttributes(HTMLAttributes, { "data-mark": type, class: `nav-ref nav-ref--${type}` }),
        0,
      ];
    },
  });
}

export const navRefMarks = NAV_MARK_TYPES.map((t) => createNavRefMark(t));
```

`excludes` гарантирует mutual-exclusivity navigation-marks (бэк требует ≤1 nav-mark per text node — `internal/ast/schema.go:251`).

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/extensions/marks/nav-ref.ts
git commit -m "feat(ast-editor): parameterized nav-ref mark factory"
```

---

## Task 14: extensions/index.ts — buildExtensions(snapshot, ctx)

**Files:**
- Create: `src/components/ast-editor/extensions/index.ts`

- [ ] **Step 1: Создать функцию сборки extensions с per-context фильтром**

```ts
// src/components/ast-editor/extensions/index.ts
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { Extensions } from "@tiptap/core";
import type { EntityContext, SchemaSnapshot } from "../types";
import { HeadingExt } from "./nodes/heading";
import { CodeBlockExt } from "./nodes/code-block";
import { ListExt, ListItemExt } from "./nodes/list";
import { ImageExt } from "./nodes/image";
import { TableExt, TableRowExt, TableCellExt } from "./nodes/table";
import { LinkExt } from "./marks/link";
import { navRefMarks } from "./marks/nav-ref";

interface BuildOpts {
  snapshot: SchemaSnapshot;
  context: EntityContext;
  placeholder?: string;
}

export function buildExtensions({ snapshot, context, placeholder }: BuildOpts): Extensions {
  const allowedBlocks = new Set(snapshot.blockLevels[snapshot.entityContexts[context]] ?? []);

  // StarterKit: keep paragraph, text, hard_break, history, dropcursor, gapcursor.
  // Disable nodes we replace with custom: heading, codeBlock, bulletList, orderedList, listItem, blockquote? (kept), horizontalRule (kept).
  const starter = StarterKit.configure({
    heading: false,
    codeBlock: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
    // We keep blockquote, horizontalRule, bold, italic, code from StarterKit defaults.
  });

  const exts: Extensions = [starter, Placeholder.configure({ placeholder: placeholder ?? "" })];

  if (allowedBlocks.has("heading")) exts.push(HeadingExt);
  if (allowedBlocks.has("code_block")) exts.push(CodeBlockExt);
  if (allowedBlocks.has("list")) exts.push(ListExt, ListItemExt);
  if (allowedBlocks.has("image")) exts.push(ImageExt);
  if (allowedBlocks.has("table")) exts.push(TableExt, TableRowExt, TableCellExt);
  // thematic_break is StarterKit's HorizontalRule — kept above.

  // Marks are universally available (filtering per-context for marks lives in toolbar gating, Phase 2).
  exts.push(LinkExt, ...navRefMarks);

  return exts;
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/extensions/index.ts
git commit -m "feat(ast-editor): buildExtensions with per-context block filter"
```

---

## Task 15: Wire buildExtensions into useAstEditor

**Files:**
- Modify: `src/components/ast-editor/use-ast-editor.ts`

- [ ] **Step 1: Заменить временные extensions на реальные**

```ts
// src/components/ast-editor/use-ast-editor.ts
"use client";

import { useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import type { AstBlock, EntityContext, SchemaSnapshot } from "./types";
import { buildExtensions } from "./extensions";
import { deserialize } from "./deserializer";

export interface UseAstEditorOptions {
  defaultValue?: AstBlock[];
  entityContext: EntityContext;
  editable?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  schema: SchemaSnapshot;
  onChange?: (blocks: AstBlock[]) => void;
}

export function useAstEditor(opts: UseAstEditorOptions): Editor | null {
  const { defaultValue, entityContext, editable = true, placeholder, ariaLabel, schema } = opts;
  return useEditor(
    {
      immediatelyRender: false,
      shouldRerenderOnTransaction: true,
      editable,
      editorProps: {
        attributes: {
          "aria-label": ariaLabel ?? "Редактор AST",
          role: "textbox",
          "aria-multiline": "true",
        },
      },
      extensions: buildExtensions({ snapshot: schema, context: entityContext, placeholder }),
      content: deserialize(defaultValue ?? [], schema),
    },
    [editable, entityContext],
  );
}
```

`deserialize` будет реализован в Task 17 — пока тест от Task 5 упадёт, чиним в Task 17.

- [ ] **Step 2: Не запускать тест ещё (deserializer не готов)**

Просто проверить компиляцию:
Run: `npx tsc --noEmit`
Expected: FAIL — `Cannot find module './deserializer'`. Это ожидаемо.

- [ ] **Step 3: Commit (WIP)**

```bash
git add src/components/ast-editor/use-ast-editor.ts
git commit -m "feat(ast-editor): wire buildExtensions into useAstEditor (WIP, deserializer pending)"
```

---

## Task 16: Serializer (PM Node → AstBlock[])

**Files:**
- Create: `src/components/ast-editor/serializer.ts`
- Create: `src/components/ast-editor/serializer.test.ts`

- [ ] **Step 1: Написать failing-test**

```ts
// src/components/ast-editor/serializer.test.ts
import { describe, it, expect } from "vitest";
import { serialize } from "./serializer";
import type { ProseMirrorJSON } from "./serializer";

describe("serializer", () => {
  it("paragraph with text", () => {
    const doc: ProseMirrorJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { blockId: "p1" },
          content: [{ type: "text", text: "Привет" }],
        },
      ],
    };
    expect(serialize(doc)).toEqual([
      {
        id: "p1",
        type: "paragraph",
        position: 0,
        content: [{ type: "text", text: "Привет" }],
        text: "Привет",
      },
    ]);
  });

  it("new block (no blockId) gets empty id", () => {
    const doc: ProseMirrorJSON = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "новый" }] },
      ],
    };
    expect(serialize(doc)[0].id).toBe("");
  });

  it("code_block stores text on Block.Text, no Content", () => {
    const doc: ProseMirrorJSON = {
      type: "doc",
      content: [
        {
          type: "code_block",
          attrs: { blockId: "cb1", language: "go" },
          content: [{ type: "text", text: "func main() {}" }],
        },
      ],
    };
    const out = serialize(doc);
    expect(out).toEqual([
      {
        id: "cb1",
        type: "code_block",
        position: 0,
        attrs: { language: "go" },
        text: "func main() {}",
      },
    ]);
    expect(out[0].content).toBeUndefined();
  });

  it("link mark gets href + title attrs", () => {
    const doc: ProseMirrorJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { blockId: "p1" },
          content: [
            {
              type: "text",
              text: "click",
              marks: [{ type: "link", attrs: { href: "https://x", title: "y" } }],
            },
          ],
        },
      ],
    };
    expect(serialize(doc)[0].content?.[0].marks).toEqual([
      { type: "link", attrs: { href: "https://x", title: "y" } },
    ]);
  });

  it("nav-ref mark drops null attrs", () => {
    const doc: ProseMirrorJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { blockId: "p1" },
          content: [
            {
              type: "text",
              text: "ссылка",
              marks: [
                {
                  type: "lecture_ref",
                  attrs: { id: "uuid", start_block_id: null, start_char: null },
                },
              ],
            },
          ],
        },
      ],
    };
    expect(serialize(doc)[0].content?.[0].marks?.[0]).toEqual({
      type: "lecture_ref",
      attrs: { id: "uuid" },
    });
  });
});
```

- [ ] **Step 2: Прогнать — должен упасть**

Run: `npm test -- serializer.test.ts`
Expected: FAIL — `Cannot find module './serializer'`.

- [ ] **Step 3: Реализовать сериалайзер**

```ts
// src/components/ast-editor/serializer.ts
import type { AstBlock, AstNode, AstMark } from "./types";

export interface ProseMirrorJSON {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorJSON[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

const LEAF_BLOCK_TYPES = new Set(["code_block", "image", "thematic_break"]);

export function serialize(doc: ProseMirrorJSON): AstBlock[] {
  if (doc.type !== "doc" || !doc.content) return [];
  return doc.content.map((node, i) => serializeBlock(node, i));
}

function serializeBlock(node: ProseMirrorJSON, position: number): AstBlock {
  const id = (node.attrs?.blockId as string | undefined) ?? "";
  const attrs = stripBlockId(node.attrs);

  if (node.type === "code_block") {
    const text = (node.content ?? []).map((c) => c.text ?? "").join("");
    return {
      id,
      type: node.type,
      position,
      ...(attrs && Object.keys(attrs).length > 0 ? { attrs } : {}),
      text,
    };
  }

  if (LEAF_BLOCK_TYPES.has(node.type)) {
    return {
      id,
      type: node.type,
      position,
      ...(attrs && Object.keys(attrs).length > 0 ? { attrs } : {}),
      text: "",
    };
  }

  const content = (node.content ?? []).map(serializeNode);
  return {
    id,
    type: node.type,
    position,
    ...(attrs && Object.keys(attrs).length > 0 ? { attrs } : {}),
    ...(content.length > 0 ? { content } : {}),
    text: extractText(content),
  };
}

function serializeNode(node: ProseMirrorJSON): AstNode {
  const result: AstNode = { type: node.type };
  if (node.attrs) {
    const attrs = stripBlockId(node.attrs);
    if (attrs && Object.keys(attrs).length > 0) result.attrs = attrs;
  }
  if (node.text != null) result.text = node.text;
  if (node.marks && node.marks.length > 0) result.marks = node.marks.map(serializeMark);
  if (node.content && node.content.length > 0) result.content = node.content.map(serializeNode);
  return result;
}

function serializeMark(mark: { type: string; attrs?: Record<string, unknown> }): AstMark {
  const out: AstMark = { type: mark.type };
  if (mark.attrs) {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(mark.attrs)) {
      if (v !== null && v !== undefined && v !== "") cleaned[k] = v;
    }
    if (Object.keys(cleaned).length > 0) out.attrs = cleaned;
  }
  return out;
}

function stripBlockId(attrs: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!attrs) return undefined;
  const { blockId, ...rest } = attrs;
  void blockId;
  // Drop attrs with null/undefined values.
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== null && v !== undefined) cleaned[k] = v;
  }
  return cleaned;
}

function extractText(nodes: AstNode[]): string {
  let result = "";
  for (const n of nodes) {
    if (n.text) result += n.text;
    if (n.content) result += extractText(n.content);
  }
  return result;
}
```

- [ ] **Step 4: Прогнать — должен пройти**

Run: `npm test -- serializer.test.ts`
Expected: PASS — все 5 тестов зелёные.

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-editor/serializer.ts src/components/ast-editor/serializer.test.ts
git commit -m "feat(ast-editor): serializer (PM Node → AstBlock[])"
```

---

## Task 17: Deserializer (AstBlock[] → ProseMirror JSON)

**Files:**
- Create: `src/components/ast-editor/deserializer.ts`
- Create: `src/components/ast-editor/deserializer.test.ts`

- [ ] **Step 1: Написать failing-test**

```ts
// src/components/ast-editor/deserializer.test.ts
import { describe, it, expect } from "vitest";
import { deserialize } from "./deserializer";
import { fixtureParagraph, fixtureCodeBlock, fixtureLink } from "./__fixtures__/sample-blocks";

const fakeSnapshot = {
  blockLevels: {}, entityBlockLimits: {}, entityContexts: {},
  limits: { maxDepth: 32, maxTextLen: 1_000_000, maxContentItems: 10_000, maxMarksPerNode: 100 },
  urlPolicy: { dangerousSchemes: [] },
  nodes: new Map(), marks: new Map(), exclusiveCategories: [],
};

describe("deserializer", () => {
  it("paragraph", () => {
    const doc = deserialize([fixtureParagraph], fakeSnapshot);
    expect(doc).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { blockId: "p1" },
          content: [{ type: "text", text: "Привет, мир." }],
        },
      ],
    });
  });

  it("code_block puts Block.Text into text-node content", () => {
    const doc = deserialize([fixtureCodeBlock], fakeSnapshot);
    expect(doc.content?.[0]).toEqual({
      type: "code_block",
      attrs: { blockId: "cb1", language: "go" },
      content: [{ type: "text", text: "func main() {}\n" }],
    });
  });

  it("link mark on text", () => {
    const doc = deserialize([fixtureLink], fakeSnapshot);
    expect(doc.content?.[0].content?.[0].marks?.[0]).toEqual({
      type: "link",
      attrs: { href: "https://example.com", title: "пример" },
    });
  });

  it("empty input returns empty doc", () => {
    expect(deserialize([], fakeSnapshot)).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });
});
```

- [ ] **Step 2: Прогнать — должен упасть**

Run: `npm test -- deserializer.test.ts`
Expected: FAIL — `Cannot find module './deserializer'`.

- [ ] **Step 3: Реализовать deserializer**

```ts
// src/components/ast-editor/deserializer.ts
import type { AstBlock, AstNode, SchemaSnapshot } from "./types";
import type { ProseMirrorJSON } from "./serializer";

const LEAF_BLOCK_TYPES = new Set(["code_block", "image", "thematic_break"]);

export function deserialize(blocks: AstBlock[], _schema: SchemaSnapshot): ProseMirrorJSON {
  if (!blocks || blocks.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  return {
    type: "doc",
    content: blocks.map(deserializeBlock),
  };
}

function deserializeBlock(block: AstBlock): ProseMirrorJSON {
  const baseAttrs: Record<string, unknown> = { blockId: block.id ?? "" };
  if (block.attrs) Object.assign(baseAttrs, block.attrs);

  if (block.type === "code_block") {
    return {
      type: "code_block",
      attrs: baseAttrs,
      content: block.text ? [{ type: "text", text: block.text }] : [],
    };
  }

  if (block.type && LEAF_BLOCK_TYPES.has(block.type)) {
    return {
      type: block.type,
      attrs: baseAttrs,
    };
  }

  return {
    type: block.type ?? "paragraph",
    attrs: baseAttrs,
    content: (block.content ?? []).map(deserializeNode),
  };
}

function deserializeNode(node: AstNode): ProseMirrorJSON {
  const out: ProseMirrorJSON = { type: node.type ?? "text" };
  if (node.attrs) out.attrs = { ...node.attrs };
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

- [ ] **Step 4: Прогнать — должен пройти**

Run: `npm test -- deserializer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-editor/deserializer.ts src/components/ast-editor/deserializer.test.ts
git commit -m "feat(ast-editor): deserializer (AstBlock[] → ProseMirror JSON)"
```

---

## Task 18: Round-trip integration test

**Files:**
- Create: `src/components/ast-editor/round-trip.test.ts`

- [ ] **Step 1: Написать round-trip тест**

```ts
// src/components/ast-editor/round-trip.test.ts
import { describe, it, expect } from "vitest";
import { serialize } from "./serializer";
import { deserialize } from "./deserializer";
import {
  fixtureParagraph,
  fixtureHeading,
  fixtureBlockquote,
  fixtureCodeBlock,
  fixtureBulletList,
  fixtureOrderedList,
  fixtureTaskList,
  fixtureImage,
  fixtureThematicBreak,
  fixtureTable,
  fixtureFormattingMarks,
  fixtureLink,
  fixtureNavMarks,
} from "./__fixtures__/sample-blocks";
import type { AstBlock } from "./types";

const fakeSnapshot = {
  blockLevels: {}, entityBlockLimits: {}, entityContexts: {},
  limits: { maxDepth: 32, maxTextLen: 1_000_000, maxContentItems: 10_000, maxMarksPerNode: 100 },
  urlPolicy: { dangerousSchemes: [] },
  nodes: new Map(), marks: new Map(), exclusiveCategories: [],
};

const cases: Array<[string, AstBlock]> = [
  ["paragraph", fixtureParagraph],
  ["heading", fixtureHeading],
  ["blockquote", fixtureBlockquote],
  ["code_block", fixtureCodeBlock],
  ["bullet list", fixtureBulletList],
  ["ordered list", fixtureOrderedList],
  ["task list", fixtureTaskList],
  ["image", fixtureImage],
  ["thematic_break", fixtureThematicBreak],
  ["table", fixtureTable],
  ["formatting marks", fixtureFormattingMarks],
  ["link mark", fixtureLink],
  ["nav-ref marks", fixtureNavMarks],
];

describe("round-trip serialize ↔ deserialize", () => {
  for (const [name, block] of cases) {
    it(`preserves structure: ${name}`, () => {
      const pm = deserialize([block], fakeSnapshot);
      const out = serialize(pm);
      expect(out).toHaveLength(1);
      const result = out[0];
      // Position normalized to 0 (we always pass single-element).
      expect(result.position).toBe(0);
      // Type preserved.
      expect(result.type).toBe(block.type);
      // Id preserved.
      expect(result.id).toBe(block.id);
      // Attrs preserved (filter undefined).
      expect(result.attrs ?? {}).toEqual(block.attrs ?? {});
      // Content preserved (deep equality, allowing for empty Text recomputation).
      if (block.content) {
        expect(result.content).toEqual(block.content);
      }
      if (block.type === "code_block") {
        expect(result.text).toBe(block.text);
      }
    });
  }
});
```

- [ ] **Step 2: Прогнать**

Run: `npm test -- round-trip.test.ts`
Expected: PASS — все 13 кейсов зелёные. Если падает — фиксить serializer/deserializer до зелёного.

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/round-trip.test.ts
git commit -m "test(ast-editor): round-trip serialize↔deserialize for all node and mark types"
```

---

## Task 19: Limits validation plugin

**Files:**
- Create: `src/components/ast-editor/validation/limits-plugin.ts`

- [ ] **Step 1: Создать ProseMirror plugin для лимитов**

```ts
// src/components/ast-editor/validation/limits-plugin.ts
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { SchemaSnapshot } from "../types";

export const limitsPluginKey = new PluginKey("ast-editor-limits");

export function createLimitsPlugin(snapshot: SchemaSnapshot, contextLevel: string) {
  const { limits, entityBlockLimits } = snapshot;
  const blockCap = entityBlockLimits[contextLevel] ?? Number.MAX_SAFE_INTEGER;

  return new Plugin({
    key: limitsPluginKey,
    filterTransaction(tr) {
      if (!tr.docChanged) return true;
      const newDoc = tr.doc;
      // Total top-level blocks.
      if (newDoc.childCount > blockCap) return false;

      let ok = true;
      newDoc.descendants((node, _pos, _parent, _index) => {
        if (!ok) return false;
        if (node.isText && node.text != null && node.text.length > limits.maxTextLen) {
          ok = false;
          return false;
        }
        if (node.marks.length > limits.maxMarksPerNode) {
          ok = false;
          return false;
        }
        if (node.childCount > limits.maxContentItems) {
          ok = false;
          return false;
        }
        return true;
      });
      if (!ok) return false;

      // Depth check.
      if (treeDepth(newDoc) > limits.maxDepth) return false;
      return true;
    },
  });
}

function treeDepth(node: PMNode, current = 0): number {
  if (node.childCount === 0) return current;
  let max = current;
  for (let i = 0; i < node.childCount; i++) {
    max = Math.max(max, treeDepth(node.child(i), current + 1));
  }
  return max;
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/validation/limits-plugin.ts
git commit -m "feat(ast-editor): limits validation plugin (soft-block on transaction)"
```

---

## Task 20: Per-attr validation plugin

**Files:**
- Create: `src/components/ast-editor/validation/attr-plugin.ts`

- [ ] **Step 1: Создать plugin, который читает ExportedAttr из snapshot**

```ts
// src/components/ast-editor/validation/attr-plugin.ts
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as PMNode, Mark as PMMark } from "@tiptap/pm/model";
import type { SchemaSnapshot, ExportedAttr } from "../types";

export const attrPluginKey = new PluginKey("ast-editor-attrs");

export function createAttrPlugin(snapshot: SchemaSnapshot) {
  const { nodes, marks, urlPolicy } = snapshot;

  return new Plugin({
    key: attrPluginKey,
    filterTransaction(tr) {
      if (!tr.docChanged) return true;
      let ok = true;
      tr.doc.descendants((node) => {
        if (!ok) return false;
        const nodeSpec = nodes.get(node.type.name);
        if (nodeSpec?.attrs) {
          for (const [name, spec] of Object.entries(nodeSpec.attrs)) {
            if (!validateAttr(node.attrs[name], spec, urlPolicy.dangerousSchemes)) {
              ok = false;
              return false;
            }
          }
        }
        for (const m of node.marks) {
          if (!validateMark(m, marks, urlPolicy.dangerousSchemes)) {
            ok = false;
            return false;
          }
        }
        return true;
      });
      return ok;
    },
  });
}

function validateMark(
  mark: PMMark,
  registry: Map<string, { attrs?: Record<string, ExportedAttr> }>,
  dangerousSchemes: string[],
): boolean {
  const spec = registry.get(mark.type.name);
  if (!spec?.attrs) return true;
  for (const [name, attr] of Object.entries(spec.attrs)) {
    if (!validateAttr(mark.attrs[name], attr, dangerousSchemes)) return false;
  }
  return true;
}

function validateAttr(
  value: unknown,
  spec: ExportedAttr,
  dangerousSchemes: string[],
): boolean {
  if (value === null || value === undefined || value === "") {
    return !spec.required;
  }
  if (spec.type === "string" || spec.type === "uuid" || spec.type === "url") {
    if (typeof value !== "string") return false;
    if (spec.min_len && value.length < spec.min_len) return false;
    if (spec.max_len && value.length > spec.max_len) return false;
    if (spec.hex_only && !/^[0-9a-f]+$/.test(value)) return false;
    if (spec.scheme_allowlist && spec.scheme_allowlist.length > 0) {
      const scheme = extractScheme(value);
      if (scheme && !spec.scheme_allowlist.includes(scheme)) return false;
    }
    if (spec.type === "url" || spec.type === "string") {
      const scheme = extractScheme(value);
      if (scheme && dangerousSchemes.includes(scheme)) return false;
    }
  } else if (spec.type === "int" || spec.type === "number") {
    if (typeof value !== "number") return false;
    if (spec.min != null && value < spec.min) return false;
    if (spec.max != null && value > spec.max) return false;
  } else if (spec.type === "bool") {
    if (typeof value !== "boolean") return false;
  } else if (spec.type === "enum") {
    if (typeof value !== "string") return false;
    if (spec.enum && !spec.enum.includes(value)) return false;
  } else if (spec.type === "string_array") {
    if (!Array.isArray(value)) return false;
  }
  return true;
}

function extractScheme(s: string): string | null {
  const m = /^([a-z][a-z0-9+\-.]*):/i.exec(s);
  return m ? m[1].toLowerCase() : null;
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/validation/attr-plugin.ts
git commit -m "feat(ast-editor): per-attr validation plugin from ExportedAttr"
```

---

## Task 21: Wire validation plugins into useAstEditor

**Files:**
- Modify: `src/components/ast-editor/use-ast-editor.ts`
- Modify: `src/components/ast-editor/extensions/index.ts`

- [ ] **Step 1: Добавить validation extension в `buildExtensions`**

```ts
// src/components/ast-editor/extensions/index.ts (добавить вверху)
import { Extension } from "@tiptap/core";
import { createLimitsPlugin } from "../validation/limits-plugin";
import { createAttrPlugin } from "../validation/attr-plugin";
```

В функции `buildExtensions` перед return:

```ts
  const validation = Extension.create({
    name: "ast-validation",
    addProseMirrorPlugins() {
      const level = snapshot.entityContexts[context];
      return [createLimitsPlugin(snapshot, level), createAttrPlugin(snapshot)];
    },
  });
  exts.push(validation);
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Прогнать все тесты**

Run: `npm test`
Expected: PASS — round-trip + smoke + schema-cache + serializer + deserializer все зелёные.

- [ ] **Step 4: Commit**

```bash
git add src/components/ast-editor/extensions/index.ts
git commit -m "feat(ast-editor): wire validation plugins into editor"
```

---

## Task 22: Imperative ref API (getBlocks, validate)

**Files:**
- Modify: `src/components/ast-editor/ast-editor.tsx`
- Modify: `src/components/ast-editor/use-ast-editor.ts`

- [ ] **Step 1: Расширить `useAstEditor` — onUpdate в onChange + ref-handle**

```ts
// src/components/ast-editor/use-ast-editor.ts (заменить onUpdate-блок целиком)
import { useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import type { AstBlock, EntityContext, SchemaSnapshot } from "./types";
import { buildExtensions } from "./extensions";
import { deserialize } from "./deserializer";
import { serialize } from "./serializer";

export interface UseAstEditorOptions {
  defaultValue?: AstBlock[];
  entityContext: EntityContext;
  editable?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  schema: SchemaSnapshot;
  onChange?: (blocks: AstBlock[]) => void;
}

export function useAstEditor(opts: UseAstEditorOptions): Editor | null {
  const { defaultValue, entityContext, editable = true, placeholder, ariaLabel, schema, onChange } = opts;
  return useEditor(
    {
      immediatelyRender: false,
      shouldRerenderOnTransaction: true,
      editable,
      editorProps: {
        attributes: {
          "aria-label": ariaLabel ?? "Редактор AST",
          role: "textbox",
          "aria-multiline": "true",
        },
      },
      extensions: buildExtensions({ snapshot: schema, context: entityContext, placeholder }),
      content: deserialize(defaultValue ?? [], schema),
      onUpdate({ editor }) {
        if (!onChange) return;
        const json = editor.getJSON() as Parameters<typeof serialize>[0];
        onChange(serialize(json));
      },
    },
    [editable, entityContext],
  );
}
```

- [ ] **Step 2: Расширить `AstEditor` — useImperativeHandle с реальной реализацией + hidden-input sync**

```tsx
// src/components/ast-editor/ast-editor.tsx (заменить useImperativeHandle и effect)
useImperativeHandle(
  ref,
  () => ({
    getBlocks: () => {
      if (!editor) return [];
      const json = editor.getJSON() as Parameters<typeof serialize>[0];
      return serialize(json);
    },
    validate: () => null, // TODO Phase 2: вытащить ошибку из validation plugin state.
  }),
  [editor],
);

// hidden-input sync
const valueRef = useRef<AstBlock[]>(props.defaultValue ?? props.value ?? []);
const handleChange = (blocks: AstBlock[]) => {
  valueRef.current = blocks;
  if (hiddenInputRef.current) {
    hiddenInputRef.current.value = JSON.stringify(blocks);
  }
  props.onChange?.(blocks);
};
```

И заменить вызов `useAstEditor` на:

```tsx
const editor = useAstEditor({
  defaultValue: props.defaultValue ?? props.value ?? [],
  entityContext: props.entityContext,
  editable: props.editable !== false,
  placeholder: props.placeholder,
  ariaLabel: props.ariaLabel,
  schema,
  onChange: handleChange,
});
```

Добавить недостающие импорты:

```tsx
import { serialize } from "./serializer";
import type { AstBlock } from "./types";
```

- [ ] **Step 3: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ast-editor/ast-editor.tsx src/components/ast-editor/use-ast-editor.ts
git commit -m "feat(ast-editor): imperative ref (getBlocks) + hidden-input sync"
```

---

## Task 23: End-to-end test — getBlocks round-trip через mounted editor

**Files:**
- Modify: `src/components/ast-editor/ast-editor.test.tsx`

- [ ] **Step 1: Дописать кейс — defaultValue → mount → getBlocks возвращает идентичный AstBlock[]**

```tsx
// добавить в существующий describe
import { useRef } from "react";
import { fireEvent } from "@testing-library/react";
import type { AstEditorRef } from "./ast-editor";
import { fixtureParagraph, fixtureHeading, fixtureLink } from "./__fixtures__/sample-blocks";

it("round-trips defaultValue through mounted editor", async () => {
  const fetcher = vi.fn().mockResolvedValue(fakeSchema);
  const refHolder: { current: AstEditorRef | null } = { current: null };
  function Wrapper() {
    const ref = useRef<AstEditorRef>(null);
    refHolder.current = ref.current;
    return (
      <SchemaContextProvider fetcher={fetcher} fallback={<div>loading</div>}>
        <AstEditor
          ref={ref}
          entityContext="document"
          defaultValue={[fixtureParagraph, fixtureHeading, fixtureLink]}
          ariaLabel="rt"
        />
      </SchemaContextProvider>
    );
  }
  const { rerender } = render(<Wrapper />);
  await screen.findByRole("textbox", { name: "rt" });
  rerender(<Wrapper />);
  // Allow async editor mount.
  await new Promise((r) => setTimeout(r, 50));
  expect(refHolder.current).not.toBeNull();
  // We don't compare arrays exactly because Tiptap may rewrite text-node merging
  // and Block.Text recomputation on round-trip; we just check id and type preserved.
  const blocks = refHolder.current!.getBlocks();
  expect(blocks.map((b) => b.id)).toEqual(["p1", "h1", "lnk1"]);
  expect(blocks.map((b) => b.type)).toEqual(["paragraph", "heading", "paragraph"]);
});
```

(Этот тест проверяет интеграцию хука + extensions + serializer.)

- [ ] **Step 2: Прогнать**

Run: `npm test -- ast-editor.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/ast-editor.test.tsx
git commit -m "test(ast-editor): integration — defaultValue round-trips via getBlocks"
```

---

## Task 24: Public API (`index.ts`) и финальный lint/test/build

**Files:**
- Create: `src/components/ast-editor/index.ts`

- [ ] **Step 1: Объявить публичный API слайса**

```ts
// src/components/ast-editor/index.ts
export { AstEditor } from "./ast-editor";
export type { AstEditorProps, AstEditorRef } from "./ast-editor";
export { SchemaContextProvider, useSchema } from "./schema-context";
export type { AstBlock, EntityContext, SchemaSnapshot } from "./types";
```

- [ ] **Step 2: Прогнать линт**

Run: `npm run lint`
Expected: 0 ошибок. Если есть — починить точечно (например, неиспользуемый import).

- [ ] **Step 3: Прогнать все тесты**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Прогнать билд**

Run: `npm run build`
Expected: PASS — Next.js собирает прод-бандл, типы валидны.

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-editor/index.ts
git commit -m "feat(ast-editor): public API in index.ts; foundation done"
```

---

## Task 25: Обновить design-spec status

**Files:**
- Modify: `docs/superpowers/specs/2026-04-30-ast-editor-design.md:3`

- [ ] **Step 1: Поменять Status в шапке**

Изменить строку 3 с:
```markdown
**Status**: Draft
```
на:
```markdown
**Status**: Foundation implemented (2026-XX-XX). Phase 2 (pickers, image flow, toolbar UX) — отдельный план.
```

(Подставить актуальную дату на момент завершения.)

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-30-ast-editor-design.md
git commit -m "docs(ast-editor): mark spec as foundation-implemented"
```

---

## Self-review checklist

После завершения всех 25 задач — проверить:

- [ ] `npm run lint && npm test && npm run build` — всё зелёное.
- [ ] `src/components/ast-editor/` содержит все файлы из «Файловой структуры» в шапке.
- [ ] `markdown-editor/` не тронут (`git diff src/components/markdown-editor/` пуст).
- [ ] Frozen zones не тронуты — `git diff src/api/schema.ts` показывает только регенерацию (не модификации в этом плане).
- [ ] Round-trip тест проходит для всех 13 фикстур.
- [ ] Public API в `index.ts` экспортирует только то, что нужно снаружи.

## Что НЕ входит в этот план (Phase 2)

- AsyncCombobox primitive + 6 pickers (включая 2-stage comment).
- Image upload service (`POST /api/uploads/images`) и Image NodeView.
- Toolbar layout + per-context UI gating.
- Slash-меню для блоков и `@`-меню для марок.
- Drift-safety dev-warn (`nodes[*].type` ⊆ хардкоду).
- Storage-URL разрешение (env vs schema-driven).
- Документация / README слайса.
- Миграция первого консьюмера.

Каждое — отдельная задача в Phase 2 plan.
