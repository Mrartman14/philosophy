# Glossary Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать на фронте полную фичу глоссария — admin CRUD + публичные read-only страницы + shared AST-рендер.

**Architecture:** Один PR с тремя зонами. Зона A — shared infrastructure (`src/components/ast-render/` + расширение `Capability`/`Tags`/admin sidebar; foundation-апдейт коммитом). Зона B — слайс `src/features/glossary/` по `_template`. Зона C — pages (`/glossary`, `/glossary/[id]`, `/admin/glossary`, `/admin/glossary/[id]/edit`).

**Tech Stack:** Next.js 16 (server actions, server components), TypeScript, Zod, Vitest+jsdom, Tailwind, Base UI Form, openapi-fetch (через `@/api/client`).

**Spec:** `docs/superpowers/specs/2026-05-02-glossary-feature-design.md`

---

## File Structure

### Foundation (shared)

| Файл | Действие | Ответственность |
| --- | --- | --- |
| `src/utils/permissions.ts` | Modify | Расширить `Capability` union значениями `glossary.*` |
| `src/api/tags.ts` | Modify | Добавить `GLOSSARY: "glossary"` в `Tags` |
| `src/app/admin/layout.tsx` | Modify | Расширить `buildNavItems` пунктом «Глоссарий» |
| `src/components/ast-render/types.ts` | Create | Типы `AstRenderProps`, `AstRenderContext`, `RefLinkRenderer` |
| `src/components/ast-render/ast-render.tsx` | Create | Server-component, корневой рендер |
| `src/components/ast-render/block-renderer.tsx` | Create | Switch по `block.type` → JSX (exhaustive) |
| `src/components/ast-render/inline-renderer.tsx` | Create | Inline-узлы и marks |
| `src/components/ast-render/marks/link.tsx` | Create | Mark `link` с safety-валидацией href |
| `src/components/ast-render/marks/glossary-ref.tsx` | Create | Mark `glossary_ref` (default: ссылка) |
| `src/components/ast-render/marks/lecture-ref.tsx` | Create | Mark `lecture_ref` (default: ссылка) |
| `src/components/ast-render/marks/document-ref.tsx` | Create | Mark `document_ref` (default: ссылка) |
| `src/components/ast-render/nodes/image.tsx` | Create | Node `image` |
| `src/components/ast-render/__fixtures__/blocks.ts` | Create | Фикстуры AST для тестов |
| `src/components/ast-render/ast-render.test.tsx` | Create | Snapshot + safety + ref-marks тесты |
| `src/components/ast-render/index.ts` | Create | Public API |

### Slice `src/features/glossary/`

| Файл | Действие | Ответственность |
| --- | --- | --- |
| `src/features/glossary/types.ts` | Create | `type Term = components["schemas"]["glossary.Term"]` |
| `src/features/glossary/schemas.ts` | Create | Zod-схемы для FormData |
| `src/features/glossary/schemas.test.ts` | Create | Тесты Zod-схем |
| `src/features/glossary/permissions.ts` | Create | `canCreateTerm`, `canUpdateTerm`, `canDeleteTerm` |
| `src/features/glossary/permissions.test.ts` | Create | Тесты permission-хелперов |
| `src/features/glossary/api.ts` | Create | `getTerms`, `getTermById` |
| `src/features/glossary/actions.ts` | Create | `createTerm`, `updateTermBlocks`, `deleteTerm`, `rethrowApiError` |
| `src/features/glossary/ui/glossary-list.tsx` | Create | Server: публичный список |
| `src/features/glossary/ui/glossary-search-form.tsx` | Create | Client: форма поиска `?q=` |
| `src/features/glossary/ui/glossary-detail.tsx` | Create | Server: детальная (title + AstRender) |
| `src/features/glossary/ui/glossary-admin-row.tsx` | Create | Server: строка в admin-списке |
| `src/features/glossary/ui/glossary-create-form.tsx` | Create | Client: title-only форма + редирект |
| `src/features/glossary/ui/glossary-edit-form.tsx` | Create | Client: AstEditor + hidden input + submit |
| `src/features/glossary/ui/glossary-delete-button.tsx` | Create | Client: ConfirmDialog + toast |
| `src/features/glossary/index.ts` | Create | Public API слайса |

### Pages

| Файл | Действие | Ответственность |
| --- | --- | --- |
| `src/app/glossary/page.tsx` | Create | Public list page |
| `src/app/glossary/[id]/page.tsx` | Create | Public detail page |
| `src/app/admin/glossary/page.tsx` | Create | Admin list page |
| `src/app/admin/glossary/[id]/edit/page.tsx` | Create | Admin edit page |

---

## Task 1: Foundation — расширить `Capability` union

**Files:**

- Modify: `src/utils/permissions.ts`

- [ ] **Step 1: Прочитать текущее содержимое `Capability`**

Run: `grep -A 20 "export type Capability" src/utils/permissions.ts`

Expected: видим union из `lecture.create | lecture.update | … | admin.access`. Среди них **нет** `glossary.*`.

- [ ] **Step 2: Добавить три значения в union**

В `src/utils/permissions.ts`, в `export type Capability`, после `"push.send"` (или в любом удобном месте, сохраняя alphabetical-группы) добавить:

```ts
  | "glossary.create"
  | "glossary.update"
  | "glossary.delete"
```

Итоговый фрагмент:

```ts
export type Capability =
  | "lecture.create"
  | "lecture.update"
  | "lecture.delete"
  | "lecture.upload_files"
  | "comment.moderate"
  | "comment.delete_any"
  | "annotation.moderate"
  | "annotation.delete_any"
  | "transcript.edit"
  | "user.moderate"
  | "user.list"
  | "push.send"
  | "glossary.create"
  | "glossary.update"
  | "glossary.delete"
  | "admin.access";
```

- [ ] **Step 3: Проверить компиляцию TS**

Run: `npx tsc --noEmit`
Expected: нет ошибок (или ошибки только в файлах, не связанных с glossary; список ошибок до изменений сравнить с после изменений — должен совпасть).

- [ ] **Step 4: Запустить тесты**

Run: `npm test -- --run src/utils`
Expected: все тесты utils зелёные.

- [ ] **Step 5: Commit**

```bash
git add src/utils/permissions.ts
git commit -m "feat(permissions): add glossary.* capabilities to Capability union

Foundation update for the glossary feature — narrows the TS-side
capability registry so can(me, \"glossary.*\") compiles."
```

---

## Task 2: Foundation — расширить `Tags`

**Files:**

- Modify: `src/api/tags.ts`

- [ ] **Step 1: Прочитать текущее содержимое**

Run: `cat src/api/tags.ts`
Expected: видим объект `Tags` с одной константой `LECTURES`.

- [ ] **Step 2: Добавить `GLOSSARY`**

Заменить тело `Tags` на:

```ts
export const Tags = {
  LECTURES: "lectures",
  GLOSSARY: "glossary",
} as const;
```

- [ ] **Step 3: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: нет новых ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/api/tags.ts
git commit -m "feat(tags): register GLOSSARY cache tag

Foundation update for the glossary feature."
```

---

## Task 3: AstRender — каркас и типы

**Files:**

- Create: `src/components/ast-render/types.ts`
- Create: `src/components/ast-render/ast-render.tsx`
- Create: `src/components/ast-render/block-renderer.tsx`
- Create: `src/components/ast-render/inline-renderer.tsx`
- Create: `src/components/ast-render/index.ts`

- [ ] **Step 1: Создать `types.ts`**

```ts
// src/components/ast-render/types.ts
import type { components } from "@/api/schema";
import type { ReactNode } from "react";

export type AstBlock = components["schemas"]["ast.Block"];
export type AstNode = components["schemas"]["ast.Node"];
export type AstMark = components["schemas"]["ast.Mark"];
export type AstNodeType = components["schemas"]["ast.NodeType"];
export type AstMarkType = components["schemas"]["ast.MarkType"];

export interface AstRenderProps {
  blocks: AstBlock[];
  ctx?: AstRenderContext;
}

export interface AstRenderContext {
  /** Override how `glossary_ref` mark is rendered. Default: <a href="/glossary/{id}">{label}</a>. */
  renderGlossaryRef?: RefLinkRenderer;
  /** Override how `lecture_ref` mark is rendered. Default: <a href="/lectures/{id}">{label}</a>. */
  renderLectureRef?: RefLinkRenderer;
  /** Override how `document_ref` mark is rendered. Default: <a href="/documents/{id}">{label}</a>. */
  renderDocumentRef?: RefLinkRenderer;
}

export type RefLinkRenderer = (props: { id: string; label: string }) => ReactNode;
```

- [ ] **Step 2: Создать `inline-renderer.tsx` (заглушка, расширим в следующих задачах)**

```tsx
// src/components/ast-render/inline-renderer.tsx
import type { ReactNode } from "react";
import type { AstNode, AstRenderContext } from "./types";

interface Props {
  nodes: AstNode[] | undefined;
  ctx: AstRenderContext;
}

/**
 * Рендерит массив инлайн-узлов (text / hard_break) с применёнными marks.
 * Marks применяются от внутренней к внешней (порядок в массиве `marks`).
 */
export function InlineRenderer({ nodes, ctx: _ctx }: Props): ReactNode {
  if (!nodes) return null;
  return nodes.map((node, i) => {
    if (node.type === "text") return <span key={i}>{node.text ?? ""}</span>;
    if (node.type === "hard_break") return <br key={i} />;
    return <span key={i} data-unsupported={node.type ?? "unknown"}>{node.text ?? ""}</span>;
  });
}
```

- [ ] **Step 3: Создать `block-renderer.tsx` (заглушка с paragraph)**

```tsx
// src/components/ast-render/block-renderer.tsx
import type { ReactNode } from "react";
import type { AstBlock, AstRenderContext } from "./types";
import { InlineRenderer } from "./inline-renderer";

interface Props {
  block: AstBlock;
  ctx: AstRenderContext;
}

export function BlockRenderer({ block, ctx }: Props): ReactNode {
  switch (block.type) {
    case "paragraph":
      return <p><InlineRenderer nodes={block.content} ctx={ctx} /></p>;
    default:
      return (
        <div data-unsupported={block.type ?? "unknown"}>
          <InlineRenderer nodes={block.content} ctx={ctx} />
        </div>
      );
  }
}
```

- [ ] **Step 4: Создать `ast-render.tsx` (server component-обёртка)**

```tsx
// src/components/ast-render/ast-render.tsx
import type { ReactNode } from "react";
import { BlockRenderer } from "./block-renderer";
import type { AstRenderProps, AstRenderContext } from "./types";

export function AstRender({ blocks, ctx }: AstRenderProps): ReactNode {
  const effectiveCtx: AstRenderContext = ctx ?? {};
  return (
    <div className="ast-render">
      {blocks.map((block, i) => (
        <BlockRenderer key={block.id ?? i} block={block} ctx={effectiveCtx} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Создать `index.ts`**

```ts
// src/components/ast-render/index.ts
export { AstRender } from "./ast-render";
export type {
  AstRenderProps,
  AstRenderContext,
  RefLinkRenderer,
  AstBlock,
  AstNode,
  AstMark,
} from "./types";
```

- [ ] **Step 6: Убедиться, что TS компилируется**

Run: `npx tsc --noEmit`
Expected: нет ошибок в `src/components/ast-render/*`.

- [ ] **Step 7: Commit**

```bash
git add src/components/ast-render/
git commit -m "feat(ast-render): scaffold types and base components

Server-only AST→JSX renderer skeleton. Paragraph + text + hard_break
implemented; other block types fall back to data-unsupported div."
```

---

## Task 4: AstRender — фикстуры и первый snapshot-тест paragraph

**Files:**

- Create: `src/components/ast-render/__fixtures__/blocks.ts`
- Create: `src/components/ast-render/ast-render.test.tsx`

- [ ] **Step 1: Создать фикстуру для paragraph**

```ts
// src/components/ast-render/__fixtures__/blocks.ts
import type { AstBlock } from "../types";

export const PARAGRAPH_PLAIN: AstBlock = {
  id: "p1",
  type: "paragraph",
  content: [{ type: "text", text: "Простой текст." }],
};

export const PARAGRAPH_WITH_BOLD: AstBlock = {
  id: "p2",
  type: "paragraph",
  content: [
    { type: "text", text: "Жирное " },
    { type: "text", text: "слово", marks: [{ type: "bold" }] },
    { type: "text", text: "." },
  ],
};

export const PARAGRAPH_WITH_HARD_BREAK: AstBlock = {
  id: "p3",
  type: "paragraph",
  content: [
    { type: "text", text: "Первая строка" },
    { type: "hard_break" },
    { type: "text", text: "Вторая строка" },
  ],
};
```

- [ ] **Step 2: Написать первый failing-тест**

```tsx
// src/components/ast-render/ast-render.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AstRender } from "./ast-render";
import {
  PARAGRAPH_PLAIN,
  PARAGRAPH_WITH_BOLD,
  PARAGRAPH_WITH_HARD_BREAK,
} from "./__fixtures__/blocks";

describe("AstRender — paragraph + inline marks", () => {
  it("рендерит plain paragraph", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_PLAIN]} />);
    expect(container.querySelector("p")?.textContent).toBe("Простой текст.");
  });

  it("оборачивает текст в <strong> для mark bold", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_BOLD]} />);
    expect(container.querySelector("p strong")?.textContent).toBe("слово");
  });

  it("рендерит hard_break как <br>", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_HARD_BREAK]} />);
    expect(container.querySelectorAll("p br")).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Запустить тест — он должен упасть на bold**

Run: `npm test -- --run src/components/ast-render/ast-render.test.tsx`
Expected: FAIL — «оборачивает текст в `<strong>` для mark bold» падает (наш inline-renderer пока не применяет marks).

- [ ] **Step 4: Реализовать применение базовых marks (`bold`, `italic`, `code`) в inline-renderer**

Заменить содержимое `inline-renderer.tsx`:

```tsx
// src/components/ast-render/inline-renderer.tsx
import type { ReactNode } from "react";
import type { AstMark, AstNode, AstRenderContext } from "./types";

interface Props {
  nodes: AstNode[] | undefined;
  ctx: AstRenderContext;
}

export function InlineRenderer({ nodes, ctx }: Props): ReactNode {
  if (!nodes) return null;
  return nodes.map((node, i) => {
    if (node.type === "hard_break") return <br key={i} />;
    if (node.type === "text") {
      return <TextWithMarks key={i} text={node.text ?? ""} marks={node.marks} ctx={ctx} />;
    }
    return <span key={i} data-unsupported={node.type ?? "unknown"}>{node.text ?? ""}</span>;
  });
}

interface TextWithMarksProps {
  text: string;
  marks: AstMark[] | undefined;
  ctx: AstRenderContext;
}

function TextWithMarks({ text, marks, ctx: _ctx }: TextWithMarksProps): ReactNode {
  if (!marks || marks.length === 0) return text;
  return marks.reduce<ReactNode>((children, mark) => applyMark(mark, children), text);
}

function applyMark(mark: AstMark, children: ReactNode): ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong>{children}</strong>;
    case "italic":
      return <em>{children}</em>;
    case "code":
      return <code>{children}</code>;
    default:
      return <span data-unsupported-mark={mark.type ?? "unknown"}>{children}</span>;
  }
}
```

- [ ] **Step 5: Запустить тесты**

Run: `npm test -- --run src/components/ast-render/ast-render.test.tsx`
Expected: PASS — все 3 теста зелёные.

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-render/
git commit -m "feat(ast-render): paragraph, text, hard_break, bold/italic/code marks"
```

---

## Task 5: AstRender — heading

**Files:**

- Modify: `src/components/ast-render/block-renderer.tsx`
- Modify: `src/components/ast-render/__fixtures__/blocks.ts`
- Modify: `src/components/ast-render/ast-render.test.tsx`

- [ ] **Step 1: Добавить фикстуры heading**

В `__fixtures__/blocks.ts` добавить:

```ts
export const HEADING_LEVEL_1: AstBlock = {
  id: "h1",
  type: "heading",
  attrs: { level: 1 },
  content: [{ type: "text", text: "Главный заголовок" }],
};

export const HEADING_LEVEL_3: AstBlock = {
  id: "h3",
  type: "heading",
  attrs: { level: 3 },
  content: [{ type: "text", text: "Подзаголовок" }],
};

export const HEADING_NO_LEVEL: AstBlock = {
  id: "h0",
  type: "heading",
  attrs: {},
  content: [{ type: "text", text: "Заголовок без уровня" }],
};
```

- [ ] **Step 2: Написать failing-тест**

В конец `ast-render.test.tsx` добавить:

```tsx
import {
  HEADING_LEVEL_1,
  HEADING_LEVEL_3,
  HEADING_NO_LEVEL,
} from "./__fixtures__/blocks";

describe("AstRender — heading", () => {
  it("рендерит heading level=1 как <h1>", () => {
    const { container } = render(<AstRender blocks={[HEADING_LEVEL_1]} />);
    expect(container.querySelector("h1")?.textContent).toBe("Главный заголовок");
  });

  it("рендерит heading level=3 как <h3>", () => {
    const { container } = render(<AstRender blocks={[HEADING_LEVEL_3]} />);
    expect(container.querySelector("h3")?.textContent).toBe("Подзаголовок");
  });

  it("без level или с невалидным level рендерит <h2>", () => {
    const { container } = render(<AstRender blocks={[HEADING_NO_LEVEL]} />);
    expect(container.querySelector("h2")?.textContent).toBe("Заголовок без уровня");
  });
});
```

- [ ] **Step 3: Запустить — должен упасть**

Run: `npm test -- --run src/components/ast-render`
Expected: FAIL на heading-тестах.

- [ ] **Step 4: Добавить case `heading` в `block-renderer.tsx`**

Заменить тело `BlockRenderer` switch на:

```tsx
export function BlockRenderer({ block, ctx }: Props): ReactNode {
  switch (block.type) {
    case "paragraph":
      return <p><InlineRenderer nodes={block.content} ctx={ctx} /></p>;
    case "heading": {
      const level = readHeadingLevel(block.attrs);
      const Tag = (`h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6");
      return <Tag><InlineRenderer nodes={block.content} ctx={ctx} /></Tag>;
    }
    default:
      return (
        <div data-unsupported={block.type ?? "unknown"}>
          <InlineRenderer nodes={block.content} ctx={ctx} />
        </div>
      );
  }
}

function readHeadingLevel(attrs: AstBlock["attrs"]): 1 | 2 | 3 | 4 | 5 | 6 {
  const raw = (attrs as { level?: unknown } | undefined)?.level;
  if (typeof raw !== "number") return 2;
  if (raw < 1 || raw > 6) return 2;
  return raw as 1 | 2 | 3 | 4 | 5 | 6;
}
```

И добавить импорт:

```tsx
import type { AstBlock } from "./types";
```

- [ ] **Step 5: Запустить тесты**

Run: `npm test -- --run src/components/ast-render`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-render/
git commit -m "feat(ast-render): heading block (level 1..6 with fallback to h2)"
```

---

## Task 6: AstRender — list + list_item

**Files:**

- Modify: `src/components/ast-render/block-renderer.tsx`
- Modify: `src/components/ast-render/__fixtures__/blocks.ts`
- Modify: `src/components/ast-render/ast-render.test.tsx`

> **Замечание о структуре.** В `ast.Block.content` тип — `ast.Node[]`, но для list / list_item фактически приходят дочерние блоки. Сверь с фикстурой `src/components/ast-editor/__fixtures__/sample-blocks.ts` если такая есть. Если структура отличается — поправь фикстуры/реализацию ниже под реальную семантику. План предполагает: list имеет `attrs: { kind: "bullet" | "ordered" }` и `content` содержит `list_item`-блоки (через type-cast).

- [ ] **Step 1: Добавить фикстуры**

```ts
export const BULLET_LIST: AstBlock = {
  id: "ul1",
  type: "list",
  attrs: { kind: "bullet" },
  content: [
    {
      type: "list_item",
      content: [
        { type: "text", text: "Первый" },
      ],
    } as unknown as AstBlock["content"][number],
    {
      type: "list_item",
      content: [
        { type: "text", text: "Второй" },
      ],
    } as unknown as AstBlock["content"][number],
  ],
};

export const ORDERED_LIST: AstBlock = {
  id: "ol1",
  type: "list",
  attrs: { kind: "ordered" },
  content: [
    {
      type: "list_item",
      content: [{ type: "text", text: "Один" }],
    } as unknown as AstBlock["content"][number],
  ],
};
```

- [ ] **Step 2: Написать failing-тест**

```tsx
import { BULLET_LIST, ORDERED_LIST } from "./__fixtures__/blocks";

describe("AstRender — list", () => {
  it("рендерит bullet-list как <ul>", () => {
    const { container } = render(<AstRender blocks={[BULLET_LIST]} />);
    expect(container.querySelector("ul")).not.toBeNull();
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.querySelector("ul > li")?.textContent).toBe("Первый");
  });

  it("рендерит ordered-list как <ol>", () => {
    const { container } = render(<AstRender blocks={[ORDERED_LIST]} />);
    expect(container.querySelector("ol")).not.toBeNull();
    expect(container.querySelectorAll("ol > li")).toHaveLength(1);
  });
});
```

Run: `npm test -- --run src/components/ast-render`
Expected: FAIL на list-тестах.

- [ ] **Step 3: Реализовать case `list` и `list_item` в `block-renderer.tsx`**

Добавить в switch (перед `default`):

```tsx
    case "list": {
      const kind = (block.attrs as { kind?: unknown } | undefined)?.kind;
      const Tag = kind === "ordered" ? "ol" : "ul";
      const items = (block.content ?? []) as unknown as AstBlock[];
      return (
        <Tag>
          {items.map((child, i) => (
            <BlockRenderer key={child.id ?? i} block={child} ctx={ctx} />
          ))}
        </Tag>
      );
    }
    case "list_item":
      return <li><InlineRenderer nodes={block.content} ctx={ctx} /></li>;
```

- [ ] **Step 4: Запустить тесты**

Run: `npm test -- --run src/components/ast-render`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-render/
git commit -m "feat(ast-render): list (bullet/ordered) + list_item"
```

---

## Task 7: AstRender — code_block

**Files:**

- Modify: `src/components/ast-render/block-renderer.tsx`
- Modify: `src/components/ast-render/__fixtures__/blocks.ts`
- Modify: `src/components/ast-render/ast-render.test.tsx`

- [ ] **Step 1: Фикстура**

```ts
export const CODE_BLOCK: AstBlock = {
  id: "code1",
  type: "code_block",
  attrs: { language: "ts" },
  content: [{ type: "text", text: "const x = 1;\nconst y = 2;" }],
};
```

- [ ] **Step 2: Тест**

```tsx
import { CODE_BLOCK } from "./__fixtures__/blocks";

describe("AstRender — code_block", () => {
  it("рендерит code_block как <pre><code>", () => {
    const { container } = render(<AstRender blocks={[CODE_BLOCK]} />);
    const code = container.querySelector("pre > code");
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe("const x = 1;\nconst y = 2;");
  });

  it("проставляет data-language из attrs", () => {
    const { container } = render(<AstRender blocks={[CODE_BLOCK]} />);
    expect(container.querySelector("pre")?.getAttribute("data-language")).toBe("ts");
  });
});
```

Run: `npm test -- --run src/components/ast-render`
Expected: FAIL.

- [ ] **Step 3: Реализация**

В `block-renderer.tsx` switch добавить (перед `default`):

```tsx
    case "code_block": {
      const lang = (block.attrs as { language?: unknown } | undefined)?.language;
      const langStr = typeof lang === "string" ? lang : undefined;
      const text = (block.content ?? [])
        .map((n) => (n.type === "text" ? n.text ?? "" : ""))
        .join("");
      return (
        <pre data-language={langStr}>
          <code>{text}</code>
        </pre>
      );
    }
```

- [ ] **Step 4: Тесты зелёные**

Run: `npm test -- --run src/components/ast-render`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-render/
git commit -m "feat(ast-render): code_block with optional data-language"
```

---

## Task 8: AstRender — link mark с safety

**Files:**

- Create: `src/components/ast-render/marks/link.tsx`
- Modify: `src/components/ast-render/inline-renderer.tsx`
- Modify: `src/components/ast-render/__fixtures__/blocks.ts`
- Modify: `src/components/ast-render/ast-render.test.tsx`

- [ ] **Step 1: Фикстуры**

```ts
export const PARAGRAPH_WITH_LINK: AstBlock = {
  id: "p-link",
  type: "paragraph",
  content: [
    { type: "text", text: "Ссылка: " },
    {
      type: "text",
      text: "Anthropic",
      marks: [{ type: "link", attrs: { href: "https://anthropic.com" } }],
    },
  ],
};

export const PARAGRAPH_WITH_RELATIVE_LINK: AstBlock = {
  id: "p-link-rel",
  type: "paragraph",
  content: [
    {
      type: "text",
      text: "На главную",
      marks: [{ type: "link", attrs: { href: "/about" } }],
    },
  ],
};

export const PARAGRAPH_WITH_DANGEROUS_LINK: AstBlock = {
  id: "p-link-bad",
  type: "paragraph",
  content: [
    {
      type: "text",
      text: "Опасная",
      marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
    },
  ],
};
```

- [ ] **Step 2: Тесты**

```tsx
import {
  PARAGRAPH_WITH_LINK,
  PARAGRAPH_WITH_RELATIVE_LINK,
  PARAGRAPH_WITH_DANGEROUS_LINK,
} from "./__fixtures__/blocks";

describe("AstRender — link mark + safety", () => {
  it("рендерит mark link как <a> с rel=noopener", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_LINK]} />);
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://anthropic.com");
    expect(a?.getAttribute("rel")).toContain("noopener");
    expect(a?.textContent).toBe("Anthropic");
  });

  it("разрешает относительные href", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_RELATIVE_LINK]} />);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/about");
  });

  it("javascript: URL рендерится как plain text без <a>", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_DANGEROUS_LINK]} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("p")?.textContent).toBe("Опасная");
  });
});
```

Run: `npm test -- --run src/components/ast-render`
Expected: FAIL.

- [ ] **Step 3: Создать `marks/link.tsx` с safety-функцией**

```tsx
// src/components/ast-render/marks/link.tsx
import type { ReactNode } from "react";

interface Props {
  href: string | undefined;
  children: ReactNode;
}

/**
 * Разрешённые href: абсолютные http(s):, относительные (начинаются с "/"),
 * якоря (начинаются с "#") и mailto:. Остальные — рендерятся как plain text.
 */
export function isSafeHref(href: unknown): href is string {
  if (typeof href !== "string" || href.length === 0) return false;
  if (href.startsWith("/") || href.startsWith("#")) return true;
  if (href.startsWith("mailto:")) return true;
  if (href.startsWith("http://") || href.startsWith("https://")) return true;
  return false;
}

export function LinkMark({ href, children }: Props): ReactNode {
  if (!isSafeHref(href)) return <>{children}</>;
  const external = href.startsWith("http://") || href.startsWith("https://");
  return (
    <a
      href={href}
      rel={external ? "noopener noreferrer" : undefined}
      target={external ? "_blank" : undefined}
    >
      {children}
    </a>
  );
}
```

- [ ] **Step 4: Подключить в `inline-renderer.tsx::applyMark`**

Заменить case `"link"` (если ранее не было) — добавить в switch:

```tsx
    case "link": {
      const href = (mark.attrs as { href?: unknown } | undefined)?.href;
      return <LinkMark href={typeof href === "string" ? href : undefined}>{children}</LinkMark>;
    }
```

И импорт сверху файла:

```tsx
import { LinkMark } from "./marks/link";
```

- [ ] **Step 5: Тесты зелёные**

Run: `npm test -- --run src/components/ast-render`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-render/
git commit -m "feat(ast-render): link mark with href safety (block javascript:)"
```

---

## Task 9: AstRender — image node

**Files:**

- Create: `src/components/ast-render/nodes/image.tsx`
- Modify: `src/components/ast-render/block-renderer.tsx`
- Modify: `src/components/ast-render/__fixtures__/blocks.ts`
- Modify: `src/components/ast-render/ast-render.test.tsx`

> **Замечание.** В `ast-editor` точная сериализация `image` определяется в `src/components/ast-editor/extensions/`. План предполагает: `block.type === "image"`, `attrs: { src, alt?, width?, height? }`. Если в реализации фактическая сериализация другая — подстрой `attrs`-разбор.

- [ ] **Step 1: Фикстуры**

```ts
export const IMAGE_BLOCK: AstBlock = {
  id: "img1",
  type: "image",
  attrs: { src: "/uploads/foo.png", alt: "Описание" },
  content: [],
};

export const IMAGE_BLOCK_NO_SRC: AstBlock = {
  id: "img2",
  type: "image",
  attrs: { alt: "Без src" },
  content: [],
};
```

- [ ] **Step 2: Тесты**

```tsx
import { IMAGE_BLOCK, IMAGE_BLOCK_NO_SRC } from "./__fixtures__/blocks";

describe("AstRender — image node", () => {
  it("рендерит <img> с src и alt", () => {
    const { container } = render(<AstRender blocks={[IMAGE_BLOCK]} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/uploads/foo.png");
    expect(img?.getAttribute("alt")).toBe("Описание");
    expect(img?.getAttribute("loading")).toBe("lazy");
  });

  it("без src рендерит data-unsupported (без <img>)", () => {
    const { container } = render(<AstRender blocks={[IMAGE_BLOCK_NO_SRC]} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-unsupported]")).not.toBeNull();
  });
});
```

Run: `npm test -- --run src/components/ast-render`
Expected: FAIL.

- [ ] **Step 3: Создать `nodes/image.tsx`**

```tsx
// src/components/ast-render/nodes/image.tsx
import type { ReactNode } from "react";

interface Props {
  attrs: Record<string, unknown> | undefined;
}

export function ImageNode({ attrs }: Props): ReactNode {
  const src = attrs?.src;
  const alt = attrs?.alt;
  if (typeof src !== "string" || src.length === 0) {
    return <div data-unsupported="image" data-reason="missing-src" />;
  }
  return (
    <img
      src={src}
      alt={typeof alt === "string" ? alt : ""}
      loading="lazy"
    />
  );
}
```

- [ ] **Step 4: Подключить в `block-renderer.tsx`**

В switch добавить (перед `default`):

```tsx
    case "image":
      return <ImageNode attrs={block.attrs} />;
```

И импорт:

```tsx
import { ImageNode } from "./nodes/image";
```

- [ ] **Step 5: Тесты зелёные**

Run: `npm test -- --run src/components/ast-render`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-render/
git commit -m "feat(ast-render): image node with lazy loading and missing-src fallback"
```

---

## Task 10: AstRender — ref-marks (`glossary_ref`, `lecture_ref`, `document_ref`) с поддержкой `ctx`

**Files:**

- Create: `src/components/ast-render/marks/glossary-ref.tsx`
- Create: `src/components/ast-render/marks/lecture-ref.tsx`
- Create: `src/components/ast-render/marks/document-ref.tsx`
- Modify: `src/components/ast-render/inline-renderer.tsx`
- Modify: `src/components/ast-render/__fixtures__/blocks.ts`
- Modify: `src/components/ast-render/ast-render.test.tsx`

- [ ] **Step 1: Фикстуры**

```ts
export const PARAGRAPH_WITH_GLOSSARY_REF: AstBlock = {
  id: "p-gref",
  type: "paragraph",
  content: [
    { type: "text", text: "См. " },
    {
      type: "text",
      text: "термин",
      marks: [{ type: "glossary_ref", attrs: { id: "term-uuid-123" } }],
    },
  ],
};

export const PARAGRAPH_WITH_LECTURE_REF: AstBlock = {
  id: "p-lref",
  type: "paragraph",
  content: [
    {
      type: "text",
      text: "лекция",
      marks: [{ type: "lecture_ref", attrs: { id: "lec-uuid-456" } }],
    },
  ],
};

export const PARAGRAPH_WITH_EMPTY_REF: AstBlock = {
  id: "p-empty-ref",
  type: "paragraph",
  content: [
    {
      type: "text",
      text: "пустой",
      marks: [{ type: "glossary_ref", attrs: { id: "" } }],
    },
  ],
};
```

- [ ] **Step 2: Тесты**

```tsx
import {
  PARAGRAPH_WITH_GLOSSARY_REF,
  PARAGRAPH_WITH_LECTURE_REF,
  PARAGRAPH_WITH_EMPTY_REF,
} from "./__fixtures__/blocks";

describe("AstRender — ref-marks", () => {
  it("default: glossary_ref → <a href='/glossary/{id}'>", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_GLOSSARY_REF]} />);
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/glossary/term-uuid-123");
    expect(a?.textContent).toBe("термин");
  });

  it("default: lecture_ref → <a href='/lectures/{id}'>", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_LECTURE_REF]} />);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/lectures/lec-uuid-456");
  });

  it("ctx.renderGlossaryRef переопределяет рендер", () => {
    const { container } = render(
      <AstRender
        blocks={[PARAGRAPH_WITH_GLOSSARY_REF]}
        ctx={{
          renderGlossaryRef: ({ id, label }) => (
            <span data-custom-glossary-ref={id}>{label}</span>
          ),
        }}
      />
    );
    expect(container.querySelector("a")).toBeNull();
    expect(
      container.querySelector("[data-custom-glossary-ref='term-uuid-123']")?.textContent
    ).toBe("термин");
  });

  it("ref с пустым id рендерится как plain text", () => {
    const { container } = render(<AstRender blocks={[PARAGRAPH_WITH_EMPTY_REF]} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("p")?.textContent).toBe("пустой");
  });
});
```

Run: `npm test -- --run src/components/ast-render`
Expected: FAIL.

- [ ] **Step 3: Создать default-renderer'ы**

```tsx
// src/components/ast-render/marks/glossary-ref.tsx
import type { ReactNode } from "react";

export function defaultGlossaryRef({ id, label }: { id: string; label: string }): ReactNode {
  return <a href={`/glossary/${id}`}>{label}</a>;
}
```

```tsx
// src/components/ast-render/marks/lecture-ref.tsx
import type { ReactNode } from "react";

export function defaultLectureRef({ id, label }: { id: string; label: string }): ReactNode {
  return <a href={`/lectures/${id}`}>{label}</a>;
}
```

```tsx
// src/components/ast-render/marks/document-ref.tsx
import type { ReactNode } from "react";

export function defaultDocumentRef({ id, label }: { id: string; label: string }): ReactNode {
  return <a href={`/documents/${id}`}>{label}</a>;
}
```

- [ ] **Step 4: Подключить в `inline-renderer.tsx`**

Расширить `applyMark` switch:

```tsx
    case "glossary_ref":
      return renderRefMark(mark, children, ctx.renderGlossaryRef ?? defaultGlossaryRef);
    case "lecture_ref":
      return renderRefMark(mark, children, ctx.renderLectureRef ?? defaultLectureRef);
    case "document_ref":
      return renderRefMark(mark, children, ctx.renderDocumentRef ?? defaultDocumentRef);
```

И добавить хелпер `renderRefMark` ниже:

```tsx
function renderRefMark(
  mark: AstMark,
  children: ReactNode,
  renderer: RefLinkRenderer
): ReactNode {
  const id = (mark.attrs as { id?: unknown } | undefined)?.id;
  if (typeof id !== "string" || id.length === 0) return <>{children}</>;
  const label = nodeToString(children);
  return renderer({ id, label });
}

function nodeToString(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToString).join("");
  if (node && typeof node === "object" && "props" in node) {
    return nodeToString((node as { props: { children: ReactNode } }).props.children);
  }
  return "";
}
```

И добавить импорты сверху:

```tsx
import { defaultGlossaryRef } from "./marks/glossary-ref";
import { defaultLectureRef } from "./marks/lecture-ref";
import { defaultDocumentRef } from "./marks/document-ref";
import type { RefLinkRenderer } from "./types";
```

Update `applyMark` сигнатуру — передавать `ctx`:

```tsx
function applyMark(mark: AstMark, children: ReactNode, ctx: AstRenderContext): ReactNode {
  switch (mark.type) {
    case "bold": return <strong>{children}</strong>;
    case "italic": return <em>{children}</em>;
    case "code": return <code>{children}</code>;
    case "link": {
      const href = (mark.attrs as { href?: unknown } | undefined)?.href;
      return <LinkMark href={typeof href === "string" ? href : undefined}>{children}</LinkMark>;
    }
    case "glossary_ref":
      return renderRefMark(mark, children, ctx.renderGlossaryRef ?? defaultGlossaryRef);
    case "lecture_ref":
      return renderRefMark(mark, children, ctx.renderLectureRef ?? defaultLectureRef);
    case "document_ref":
      return renderRefMark(mark, children, ctx.renderDocumentRef ?? defaultDocumentRef);
    default:
      return <span data-unsupported-mark={mark.type ?? "unknown"}>{children}</span>;
  }
}
```

И в `TextWithMarks` пропихнуть ctx:

```tsx
function TextWithMarks({ text, marks, ctx }: TextWithMarksProps): ReactNode {
  if (!marks || marks.length === 0) return text;
  return marks.reduce<ReactNode>((children, mark) => applyMark(mark, children, ctx), text);
}
```

- [ ] **Step 5: Запустить тесты**

Run: `npm test -- --run src/components/ast-render`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-render/
git commit -m "feat(ast-render): glossary_ref/lecture_ref/document_ref marks with ctx override"
```

---

## Task 11: AstRender — exhaustive switch и unsupported-fallback для marks

**Files:**

- Modify: `src/components/ast-render/inline-renderer.tsx`
- Modify: `src/components/ast-render/ast-render.test.tsx`

- [ ] **Step 1: Тест на unsupported mark**

```tsx
describe("AstRender — unsupported marks fallback", () => {
  it("неизвестный mark рендерится как plain text с data-unsupported-mark", () => {
    const block: AstBlock = {
      id: "p-unk",
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "media-ref",
          marks: [{ type: "media_ref", attrs: { id: "x" } }],
        },
      ],
    };
    const { container } = render(<AstRender blocks={[block]} />);
    expect(container.querySelector("[data-unsupported-mark='media_ref']")).not.toBeNull();
    expect(container.querySelector("p")?.textContent).toBe("media-ref");
  });
});
```

И импорт `AstBlock` из `./types` если ещё не импортирован.

- [ ] **Step 2: Запустить тест**

Run: `npm test -- --run src/components/ast-render`
Expected: PASS (т.к. default-case в `applyMark` уже даёт `data-unsupported-mark`).

- [ ] **Step 3: Добавить dev-warning**

В `applyMark` default-case заменить на:

```tsx
    default: {
      if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.warn(`AstRender: unsupported mark type "${mark.type}"`);
      }
      return <span data-unsupported-mark={mark.type ?? "unknown"}>{children}</span>;
    }
```

И в `BlockRenderer` `default`:

```tsx
    default: {
      if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.warn(`AstRender: unsupported block type "${block.type}"`);
      }
      return (
        <div data-unsupported={block.type ?? "unknown"}>
          <InlineRenderer nodes={block.content} ctx={ctx} />
        </div>
      );
    }
```

- [ ] **Step 4: Тесты зелёные**

Run: `npm test -- --run src/components/ast-render`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-render/
git commit -m "feat(ast-render): dev-warn on unsupported marks/blocks"
```

---

## Task 12: AstRender — финальный snapshot и проверка lint/build

**Files:**

- Modify: `src/components/ast-render/ast-render.test.tsx`

- [ ] **Step 1: Добавить combo-snapshot со всеми поддержанными типами**

В конец `ast-render.test.tsx` добавить:

```tsx
import {
  PARAGRAPH_PLAIN,
  PARAGRAPH_WITH_BOLD,
  HEADING_LEVEL_1,
  BULLET_LIST,
  CODE_BLOCK,
  IMAGE_BLOCK,
  PARAGRAPH_WITH_LINK,
  PARAGRAPH_WITH_GLOSSARY_REF,
} from "./__fixtures__/blocks";

describe("AstRender — combo snapshot", () => {
  it("рендерит all-supported AST стабильно", () => {
    const { container } = render(
      <AstRender
        blocks={[
          HEADING_LEVEL_1,
          PARAGRAPH_PLAIN,
          PARAGRAPH_WITH_BOLD,
          PARAGRAPH_WITH_LINK,
          PARAGRAPH_WITH_GLOSSARY_REF,
          BULLET_LIST,
          CODE_BLOCK,
          IMAGE_BLOCK,
        ]}
      />
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Запустить тест и зафиксировать snapshot**

Run: `npm test -- --run src/components/ast-render`
Expected: PASS, создаётся файл `__snapshots__/ast-render.test.tsx.snap`.

- [ ] **Step 3: Lint check**

Run: `npm run lint -- src/components/ast-render`
Expected: PASS.

- [ ] **Step 4: Commit (фиксируем snapshot файл)**

```bash
git add src/components/ast-render/
git commit -m "test(ast-render): combo snapshot of all supported block/mark types"
```

---

## Task 13: Slice — каркас slice (`types.ts`, пустой `index.ts`)

**Files:**

- Create: `src/features/glossary/types.ts`
- Create: `src/features/glossary/index.ts`

- [ ] **Step 1: Создать директорию по `_template`**

Run:

```bash
mkdir -p src/features/glossary/ui
```

- [ ] **Step 2: types.ts**

```ts
// src/features/glossary/types.ts
import type { components } from "@/api/schema";

export type Term = components["schemas"]["glossary.Term"];
```

- [ ] **Step 3: index.ts (заглушка, постепенно расширим)**

```ts
// src/features/glossary/index.ts
export type { Term } from "./types";
```

- [ ] **Step 4: TS-проверка**

Run: `npx tsc --noEmit`
Expected: чисто.

- [ ] **Step 5: Commit**

```bash
git add src/features/glossary/
git commit -m "feat(glossary): scaffold slice with Term type"
```

---

## Task 14: Slice — `schemas.ts` + тесты

**Files:**

- Create: `src/features/glossary/schemas.ts`
- Create: `src/features/glossary/schemas.test.ts`

- [ ] **Step 1: Написать failing-тесты**

```ts
// src/features/glossary/schemas.test.ts
import { describe, it, expect } from "vitest";
import {
  TermCreateSchema,
  TermBlocksUpdateSchema,
  TermIdSchema,
} from "./schemas";

describe("TermCreateSchema", () => {
  it("принимает валидный title", () => {
    const r = TermCreateSchema.safeParse({ title: "Эпистемология" });
    expect(r.success).toBe(true);
  });
  it("отклоняет пустой title", () => {
    const r = TermCreateSchema.safeParse({ title: "  " });
    expect(r.success).toBe(false);
  });
  it("отклоняет title длиннее 300", () => {
    const r = TermCreateSchema.safeParse({ title: "a".repeat(301) });
    expect(r.success).toBe(false);
  });
});

describe("TermBlocksUpdateSchema", () => {
  it("принимает валидный uuid и JSON-массив", () => {
    const r = TermBlocksUpdateSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      blocks: JSON.stringify([{ type: "paragraph", content: [{ type: "text", text: "x" }] }]),
    });
    expect(r.success).toBe(true);
    if (r.success) expect(Array.isArray(r.data.blocks)).toBe(true);
  });
  it("отклоняет битый uuid", () => {
    const r = TermBlocksUpdateSchema.safeParse({ id: "not-uuid", blocks: "[]" });
    expect(r.success).toBe(false);
  });
  it("отклоняет пустой blocks", () => {
    const r = TermBlocksUpdateSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      blocks: "",
    });
    expect(r.success).toBe(false);
  });
  it("отклоняет битый JSON", () => {
    const r = TermBlocksUpdateSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      blocks: "{not-json",
    });
    expect(r.success).toBe(false);
  });
  it("отклоняет JSON, который не массив", () => {
    const r = TermBlocksUpdateSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      blocks: JSON.stringify({ not: "array" }),
    });
    expect(r.success).toBe(false);
  });
});

describe("TermIdSchema", () => {
  it("принимает валидный uuid", () => {
    const r = TermIdSchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(r.success).toBe(true);
  });
  it("отклоняет невалидный uuid", () => {
    const r = TermIdSchema.safeParse({ id: "x" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить — должны упасть (нет файла schemas.ts)**

Run: `npm test -- --run src/features/glossary/schemas.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Реализовать schemas.ts**

```ts
// src/features/glossary/schemas.ts
import "server-only";
import { z } from "zod";

export const TermCreateSchema = z.object({
  title: z.string().trim().min(1, "Введите название").max(300, "До 300 символов"),
});

export const TermBlocksUpdateSchema = z.object({
  id: z.string().uuid("Некорректный id термина"),
  blocks: z
    .string()
    .min(1, "Тело не может быть пустым")
    .transform((s, ctx) => {
      try {
        const parsed: unknown = JSON.parse(s);
        if (!Array.isArray(parsed)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Тело должно быть массивом блоков",
          });
          return z.NEVER;
        }
        return parsed as unknown[];
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Битый JSON в теле формы",
        });
        return z.NEVER;
      }
    }),
});

export const TermIdSchema = z.object({
  id: z.string().uuid("Некорректный id термина"),
});

export type TermCreateInput = z.infer<typeof TermCreateSchema>;
export type TermBlocksUpdateInput = z.infer<typeof TermBlocksUpdateSchema>;
export type TermIdInput = z.infer<typeof TermIdSchema>;
```

- [ ] **Step 4: Тесты зелёные**

Run: `npm test -- --run src/features/glossary/schemas.test.ts`
Expected: PASS — все 10 тестов.

- [ ] **Step 5: Commit**

```bash
git add src/features/glossary/schemas.ts src/features/glossary/schemas.test.ts
git commit -m "feat(glossary): zod schemas for create/update/id with JSON transform"
```

---

## Task 15: Slice — `permissions.ts` + тесты

**Files:**

- Create: `src/features/glossary/permissions.ts`
- Create: `src/features/glossary/permissions.test.ts`

- [ ] **Step 1: Написать failing-тесты**

```ts
// src/features/glossary/permissions.test.ts
import { describe, it, expect } from "vitest";
import type { Me } from "@/utils/me";
import { canCreateTerm, canUpdateTerm, canDeleteTerm } from "./permissions";

const guest = null;

const adminFull: Me = {
  id: "u1",
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: ["glossary.create", "glossary.update", "glossary.delete"],
};

const userNoCap: Me = {
  id: "u2",
  username: "user",
  role: "user",
  status: "active",
  capabilities: [],
};

const suspendedAdmin: Me = {
  ...adminFull,
  status: "suspended",
};

describe("canCreateTerm", () => {
  it("гость → false", () => expect(canCreateTerm(guest)).toBe(false));
  it("active без cap → false", () => expect(canCreateTerm(userNoCap)).toBe(false));
  it("suspended с cap → false", () => expect(canCreateTerm(suspendedAdmin)).toBe(false));
  it("active с cap → true", () => expect(canCreateTerm(adminFull)).toBe(true));
});

describe("canUpdateTerm", () => {
  it("гость → false", () => expect(canUpdateTerm(guest)).toBe(false));
  it("active с cap → true", () => expect(canUpdateTerm(adminFull)).toBe(true));
  it("active без cap → false", () => expect(canUpdateTerm(userNoCap)).toBe(false));
});

describe("canDeleteTerm", () => {
  it("гость → false", () => expect(canDeleteTerm(guest)).toBe(false));
  it("active с cap → true", () => expect(canDeleteTerm(adminFull)).toBe(true));
  it("active без cap → false", () => expect(canDeleteTerm(userNoCap)).toBe(false));
});
```

- [ ] **Step 2: Запустить — FAIL**

Run: `npm test -- --run src/features/glossary/permissions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Реализация**

```ts
// src/features/glossary/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";

export function canCreateTerm(me: MaybeMe): boolean {
  return can(me, "glossary.create");
}

export function canUpdateTerm(me: MaybeMe): boolean {
  return can(me, "glossary.update");
}

export function canDeleteTerm(me: MaybeMe): boolean {
  return can(me, "glossary.delete");
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `npm test -- --run src/features/glossary/permissions.test.ts`
Expected: PASS — все 10 тестов.

- [ ] **Step 5: Commit**

```bash
git add src/features/glossary/permissions.ts src/features/glossary/permissions.test.ts
git commit -m "feat(glossary): canCreateTerm/canUpdateTerm/canDeleteTerm helpers"
```

---

## Task 16: Slice — `api.ts` (server fetchers)

**Files:**

- Create: `src/features/glossary/api.ts`

- [ ] **Step 1: Реализация**

```ts
// src/features/glossary/api.ts
import "server-only";
import { cache } from "react";
import { createApiClient } from "@/api/client";
import type { Term } from "./types";

export interface TermListFilter {
  q?: string;
  offset?: number;
  limit?: number;
}

export interface TermListResult {
  items: Term[];
  total: number;
  offset: number;
  limit: number;
}

export const getTerms = cache(
  async (filter: TermListFilter = {}): Promise<TermListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    const query: { offset: number; limit: number; q?: string } = { offset, limit };
    if (filter.q) query.q = filter.q;

    const { data, error } = await api.GET("/api/glossary", { params: { query } });
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить термины");
    }
    return {
      items: (data?.data ?? []) as Term[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  }
);

export const getTermById = cache(async (id: string): Promise<Term | null> => {
  const api = await createApiClient();
  const { data, error, response } = await api.GET("/api/glossary/{id}", {
    params: { path: { id } },
  });
  if (response.status === 404) return null;
  if (error) {
    throw new Error(error.error ?? "Не удалось загрузить термин");
  }
  return (data?.data ?? null) as Term | null;
});
```

- [ ] **Step 2: TS-проверка**

Run: `npx tsc --noEmit`
Expected: нет новых ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/features/glossary/api.ts
git commit -m "feat(glossary): getTerms/getTermById server fetchers"
```

---

## Task 17: Slice — `actions.ts` с `createTerm`

**Files:**

- Create: `src/features/glossary/actions.ts`

- [ ] **Step 1: Заложить полный файл с одним пока action'ом**

```ts
// src/features/glossary/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";
import { Tags } from "@/api/tags";
import {
  canCreateTerm,
  canUpdateTerm,
  canDeleteTerm,
} from "./permissions";
import {
  TermCreateSchema,
  TermBlocksUpdateSchema,
  TermIdSchema,
} from "./schemas";
import type { Term } from "./types";

type ApiError = { code?: string; error?: string };

function rethrowApiError(err: ApiError | undefined): never {
  if (err?.code === "forbidden") {
    throw new ForbiddenError("role", err.error);
  }
  switch (err?.code) {
    case "BLOCKS_EMPTY":
      throw new Error("Тело термина не может быть пустым.");
    case "BLOCKS_HAVE_ANCHORS":
      throw new Error(
        "Нельзя удалить блок с привязанными комментариями. Удалите комментарии или оставьте блок."
      );
    case "BLOCK_REFERENCED":
      throw new Error(
        "На блок ссылаются другие материалы. Удалите ссылки или оставьте блок."
      );
    case "REF_NOT_FOUND":
      throw new Error("Одна из ссылок указывает на несуществующий объект.");
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}

export const createTerm = createFormAction(async (formData) => {
  const me = await getMe();
  const input = parseFormData(TermCreateSchema, formData);
  requireCapability(me, canCreateTerm);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/admin/glossary", {
    body: {
      title: input.title,
      blocks: [
        {
          id: "",
          type: "paragraph",
          content: [],
        },
      ],
    },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.GLOSSARY);
  return (data?.data ?? null) as Term | null;
});

// updateTermBlocks — Task 18
// deleteTerm — Task 19

export {
  // Re-exports чтобы TS не жаловался на unused imports пока другие actions не дописаны
};

// Заглушки, чтобы импорты не были unused (заменим в Task 18/19):
void canUpdateTerm;
void canDeleteTerm;
void TermBlocksUpdateSchema;
void TermIdSchema;
```

> **Замечание о форме paragraph-stub.** Бэк требует `min=1` блок. `id: ""` обязателен (бэк генерит UUID). `content: []` — самый минимальный валидный paragraph по AST. Если бэк отвергнет такую форму с 422 — добавь `content: [{ type: "text", text: "" }]` либо подсмотри в `internal/glossary/handler_md.go` / Go-фикстурах фактический минимум.

- [ ] **Step 2: TS-проверка**

Run: `npx tsc --noEmit`
Expected: чисто (если жалуется на `void canUpdateTerm` — это нормальный no-op для unused, можно временно удалить эти импорты до Task 18, но удобнее оставить).

- [ ] **Step 3: Commit**

```bash
git add src/features/glossary/actions.ts
git commit -m "feat(glossary): createTerm action with rethrowApiError mapping"
```

---

## Task 18: Slice — `updateTermBlocks` action

**Files:**

- Modify: `src/features/glossary/actions.ts`

- [ ] **Step 1: Удалить заглушку `void TermBlocksUpdateSchema; void canUpdateTerm;`**

В `src/features/glossary/actions.ts` найти строки:

```ts
void canUpdateTerm;
void TermBlocksUpdateSchema;
```

И удалить их.

- [ ] **Step 2: Добавить action**

После `createTerm` (перед оставшимися заглушками):

```ts
export const updateTermBlocks = createFormAction(async (formData) => {
  const me = await getMe();
  const input = parseFormData(TermBlocksUpdateSchema, formData);
  requireCapability(me, canUpdateTerm);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/admin/glossary/{id}/blocks", {
    params: { path: { id: input.id } },
    body: { blocks: input.blocks as never },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.GLOSSARY, input.id);
  revalidateEntity(Tags.GLOSSARY);
  return (data?.data ?? null) as Term | null;
});
```

> **Замечание о `as never`.** `input.blocks` — `unknown[]` после Zod-`transform`. Точная типовая совместимость с `components["schemas"]["ast.Block"][]` достижима только через runtime-валидацию AST, что мы делегируем бэку. `as never` помечает место осознанной потери типов; при найденном лучшем решении замени.

- [ ] **Step 3: TS-проверка**

Run: `npx tsc --noEmit`
Expected: чисто.

- [ ] **Step 4: Commit**

```bash
git add src/features/glossary/actions.ts
git commit -m "feat(glossary): updateTermBlocks action with cache invalidation"
```

---

## Task 19: Slice — `deleteTerm` action

**Files:**

- Modify: `src/features/glossary/actions.ts`

- [ ] **Step 1: Удалить оставшиеся заглушки**

Найти и удалить:

```ts
void canDeleteTerm;
void TermIdSchema;

export {
  // Re-exports чтобы TS не жаловался на unused imports пока другие actions не дописаны
};
```

- [ ] **Step 2: Добавить deleteTerm**

В конец файла:

```ts
export const deleteTerm = createAction(async (rawId: string) => {
  const me = await getMe();
  const { id } = TermIdSchema.parse({ id: rawId });
  requireCapability(me, canDeleteTerm);
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/glossary/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.GLOSSARY);
  return undefined;
});
```

- [ ] **Step 3: TS-проверка**

Run: `npx tsc --noEmit`
Expected: чисто.

- [ ] **Step 4: Lint**

Run: `npm run lint -- src/features/glossary`
Expected: чисто.

- [ ] **Step 5: Commit**

```bash
git add src/features/glossary/actions.ts
git commit -m "feat(glossary): deleteTerm action"
```

---

## Task 20: Slice UI — public компоненты (`glossary-list`, `glossary-search-form`, `glossary-detail`)

**Files:**

- Create: `src/features/glossary/ui/glossary-search-form.tsx`
- Create: `src/features/glossary/ui/glossary-list.tsx`
- Create: `src/features/glossary/ui/glossary-detail.tsx`

- [ ] **Step 1: glossary-search-form.tsx (client)**

```tsx
// src/features/glossary/ui/glossary-search-form.tsx
"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Form, FormField, TextInput, SubmitButton } from "@/components/ui";

interface Props {
  defaultQ: string;
}

export function GlossarySearchForm({ defaultQ }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(defaultQ);
  const [, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (q) params.set("q", q);
        else params.delete("q");
        params.delete("offset");
        startTransition(() => router.replace(`${pathname}?${params.toString()}`));
      }}
      className="flex gap-2"
    >
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Поиск по названию"
        className="flex-1 rounded border border-(--color-border) bg-(--color-text-pane) px-3 py-1.5"
      />
      <button
        type="submit"
        className="rounded bg-(--color-foreground) px-3 py-1.5 text-sm text-(--color-background)"
      >
        Найти
      </button>
    </form>
  );
}
```

- [ ] **Step 2: glossary-list.tsx (server)**

```tsx
// src/features/glossary/ui/glossary-list.tsx
import Link from "next/link";
import type { Term } from "../types";

interface Props {
  items: Term[];
  total: number;
}

export function GlossaryList({ items, total }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded border border-dashed border-(--color-border) p-6 text-center text-sm text-(--color-description)">
        Термины не найдены.
      </div>
    );
  }
  const sorted = [...items].sort((a, b) =>
    (a.title ?? "").localeCompare(b.title ?? "", "ru")
  );
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-(--color-description)">Всего: {total}</p>
      <ul className="flex flex-col divide-y divide-(--color-border)">
        {sorted.map((term) => (
          <li key={term.id} className="py-2">
            <Link
              href={`/glossary/${term.id}`}
              className="text-base hover:underline"
            >
              {term.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: glossary-detail.tsx (server)**

```tsx
// src/features/glossary/ui/glossary-detail.tsx
import { AstRender } from "@/components/ast-render";
import type { Term } from "../types";

interface Props {
  term: Term;
}

export function GlossaryDetail({ term }: Props) {
  const updated = term.updated_at ? new Date(term.updated_at) : null;
  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{term.title}</h1>
        {updated && (
          <p className="text-xs text-(--color-description)">
            Обновлено: {updated.toLocaleDateString("ru-RU")}
          </p>
        )}
      </header>
      <div className="prose">
        <AstRender blocks={term.blocks ?? []} />
      </div>
    </article>
  );
}
```

- [ ] **Step 4: TS+lint**

Run: `npx tsc --noEmit && npm run lint -- src/features/glossary`
Expected: чисто.

- [ ] **Step 5: Commit**

```bash
git add src/features/glossary/ui/
git commit -m "feat(glossary): public UI — list, search-form, detail"
```

---

## Task 21: Slice UI — admin row

**Files:**

- Create: `src/features/glossary/ui/glossary-admin-row.tsx`

- [ ] **Step 1: Реализация**

```tsx
// src/features/glossary/ui/glossary-admin-row.tsx
import Link from "next/link";
import type { Term } from "../types";
import { GlossaryDeleteButton } from "./glossary-delete-button";

interface Props {
  term: Term;
  canEdit: boolean;
  canDelete: boolean;
}

export function GlossaryAdminRow({ term, canEdit, canDelete }: Props) {
  return (
    <li className="flex items-center justify-between gap-4 py-2">
      <span className="flex-1 truncate">{term.title}</span>
      <div className="flex items-center gap-2">
        {canEdit && (
          <Link
            href={`/admin/glossary/${term.id}/edit`}
            className="text-sm hover:underline"
          >
            Редактировать
          </Link>
        )}
        {canDelete && term.id && (
          <GlossaryDeleteButton id={term.id} />
        )}
      </div>
    </li>
  );
}
```

> **Замечание.** Этот файл импортирует `GlossaryDeleteButton` из Task 24. TS будет жаловаться на отсутствующий модуль, пока Task 24 не выполнен. Можно: (а) выполнить Task 24 до этого, (б) использовать заглушку и удалить её в Task 24. Рекомендация — следовать порядку Task 21 → 24 в одной сессии и зафиксировать чистым коммитом, либо переставить Task 24 перед Task 21. План оставляет порядок «по семантике страниц», финальный TS-чек идёт в Task 25.

- [ ] **Step 2: Commit (промежуточный, без TS-чека пока не готова Task 24)**

```bash
git add src/features/glossary/ui/glossary-admin-row.tsx
git commit -m "feat(glossary): admin row component (depends on delete-button, see Task 24)"
```

---

## Task 22: Slice UI — `glossary-create-form` (client)

**Files:**

- Create: `src/features/glossary/ui/glossary-create-form.tsx`

- [ ] **Step 1: Реализация**

```tsx
// src/features/glossary/ui/glossary-create-form.tsx
"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Form,
  FormField,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { createTerm } from "../actions";
import type { Term } from "../types";

const initial: ActionResult<Term | null> = { success: true, data: null };

export function GlossaryCreateForm() {
  const router = useRouter();
  const [state, action] = useActionState(createTerm, initial);
  const fieldErrors: Record<string, string> =
    state.success === false && state.code === "validation"
      ? state.fieldErrors
      : {};

  useEffect(() => {
    if (state.success && state.data?.id) {
      router.push(`/admin/glossary/${state.data.id}/edit`);
    }
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors} className="max-w-xl">
      <FormField name="title" label="Название" required>
        <TextInput name="title" required maxLength={300} placeholder="Например: «Эпистемология»" />
      </FormField>

      {state.success === false && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на создание термина.</p>
      )}
      {state.success === false && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>Создать</SubmitButton>
      </div>
    </Form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/glossary/ui/glossary-create-form.tsx
git commit -m "feat(glossary): create-form (title only, redirects to edit on success)"
```

---

## Task 23: Slice UI — `glossary-edit-form` (AstEditor + hidden input pattern)

**Files:**

- Create: `src/features/glossary/ui/glossary-edit-form.tsx`

- [ ] **Step 1: Прочесть текущую сигнатуру AstEditor**

Run: `grep -A 20 "export.*AstEditor\|interface AstEditorProps\|type AstEditorProps" src/components/ast-editor/ast-editor.tsx src/components/ast-editor/types.ts src/components/ast-editor/index.ts`

Expected: видим публичный экспорт `AstEditor` и его пропсы — `defaultValue`, `onChange`, `editable` минимум.

> **Замечание (важное).** Если `AstEditor.onChange` не отдаёт массив `AstBlock`, а отдаёт другую структуру (внутренний state редактора, JSON.stringify-ready snapshot, и т.п.) — оберни преобразование внутри `onChange`. Точную форму подсмотри в [src/components/ast-editor/use-ast-editor.ts](src/components/ast-editor/use-ast-editor.ts). Если в публичном API нет точки получения текущих blocks — нужен **mini-foundation step** (отдельный коммит) на расширение AstEditor одним коллбэком/ref. Это первый раз когда мы интегрируем AstEditor с формой; здесь возможен сюрприз.

- [ ] **Step 2: Реализация (предполагая `onChange: (blocks: AstBlock[]) => void`)**

```tsx
// src/features/glossary/ui/glossary-edit-form.tsx
"use client";
import { useActionState, useState } from "react";
import {
  Form,
  FormField,
  SubmitButton,
} from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { AstEditor } from "@/components/ast-editor";
import type { AstBlock } from "@/components/ast-render";
import { updateTermBlocks } from "../actions";
import type { Term } from "../types";

const initial: ActionResult<Term | null> = { success: true, data: null };

interface Props {
  term: Term;
}

export function GlossaryEditForm({ term }: Props) {
  const [blocks, setBlocks] = useState<AstBlock[]>(term.blocks ?? []);
  const [state, action] = useActionState(updateTermBlocks, initial);

  const fieldErrors: Record<string, string> =
    state.success === false && state.code === "validation"
      ? state.fieldErrors
      : {};

  return (
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={term.id ?? ""} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />

      <FormField name="blocks" label="Тело термина">
        <AstEditor
          defaultValue={term.blocks ?? []}
          onChange={(next: AstBlock[]) => setBlocks(next)}
        />
      </FormField>

      {state.success && state.data && (
        <p className="text-sm text-(--color-description)">Сохранено.</p>
      )}
      {state.success === false && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на изменение термина.</p>
      )}
      {state.success === false && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </Form>
  );
}
```

> **Если шаг 1 показал, что `AstEditor.onChange` отдаёт другую форму (например, JSON-string или ProseMirror state):**
>
> - Если выдаётся уже-сериализованный JSON-массив блоков как строка — храни строку в state и в hidden input передавай как есть (без `JSON.stringify`).
> - Если выдаётся объект, не совместимый с `AstBlock[]` напрямую — добавь функцию-конвертер в `glossary-edit-form.tsx` (или, если это нужно повсеместно, в shared `src/components/ast-editor/serialize.ts` отдельным коммитом).
> - Если **нет коллбэка `onChange`** вовсе — это блокер: нужно расширить публичный API AstEditor одним коллбэком. Это foundation update, делать в отдельном коммите перед этой задачей.

- [ ] **Step 3: TS-проверка**

Run: `npx tsc --noEmit`
Expected: чисто (если жалуется на `AstEditor` props — поправь под фактическую сигнатуру).

- [ ] **Step 4: Lint**

Run: `npm run lint -- src/features/glossary`
Expected: чисто.

- [ ] **Step 5: Commit**

```bash
git add src/features/glossary/ui/glossary-edit-form.tsx
git commit -m "feat(glossary): edit-form using AstEditor with hidden input JSON-bridge

Establishes the AstEditor-in-form pattern for the project (lectures
edit only string fields, AstEditor was previously used only on the
dev/ui smoke page)."
```

---

## Task 24: Slice UI — `glossary-delete-button` (client)

**Files:**

- Create: `src/features/glossary/ui/glossary-delete-button.tsx`

- [ ] **Step 1: Реализация**

```tsx
// src/features/glossary/ui/glossary-delete-button.tsx
"use client";
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { deleteTerm } from "../actions";

interface Props {
  id: string;
}

export function GlossaryDeleteButton({ id }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">Удалить</Button>}
      title="Удалить термин?"
      description="Действие необратимо. Если на блоки термина ссылаются другие материалы — удаление будет отклонено."
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = await deleteTerm(id);
        if (!result.success) {
          if (result.code === "forbidden") {
            toast.add({
              title: "Нет прав",
              description: "У вас нет прав на удаление термина.",
            });
          } else {
            toast.add({ title: "Ошибка", description: result.error });
          }
          return;
        }
        // Если мы на edit-странице термина — редирект на список; иначе refresh.
        if (pathname.startsWith(`/admin/glossary/${id}`)) {
          startTransition(() => router.push("/admin/glossary"));
        } else {
          startTransition(() => router.refresh());
        }
      }}
    />
  );
}
```

- [ ] **Step 2: TS-проверка (теперь и admin-row из Task 21 должен компилироваться)**

Run: `npx tsc --noEmit`
Expected: чисто.

- [ ] **Step 3: Lint**

Run: `npm run lint -- src/features/glossary`
Expected: чисто.

- [ ] **Step 4: Commit**

```bash
git add src/features/glossary/ui/glossary-delete-button.tsx
git commit -m "feat(glossary): delete-button with ConfirmDialog and contextual redirect"
```

---

## Task 25: Slice — public `index.ts`

**Files:**

- Modify: `src/features/glossary/index.ts`

- [ ] **Step 1: Заменить содержимое**

```ts
// src/features/glossary/index.ts
export { getTerms, getTermById } from "./api";
export type { TermListFilter, TermListResult } from "./api";
export { createTerm, updateTermBlocks, deleteTerm } from "./actions";
export {
  canCreateTerm,
  canUpdateTerm,
  canDeleteTerm,
} from "./permissions";
export { GlossaryList } from "./ui/glossary-list";
export { GlossarySearchForm } from "./ui/glossary-search-form";
export { GlossaryDetail } from "./ui/glossary-detail";
export { GlossaryAdminRow } from "./ui/glossary-admin-row";
export { GlossaryCreateForm } from "./ui/glossary-create-form";
export { GlossaryEditForm } from "./ui/glossary-edit-form";
export { GlossaryDeleteButton } from "./ui/glossary-delete-button";
export type { Term } from "./types";
```

- [ ] **Step 2: TS+lint**

Run: `npx tsc --noEmit && npm run lint -- src/features/glossary`
Expected: чисто.

- [ ] **Step 3: Commit**

```bash
git add src/features/glossary/index.ts
git commit -m "feat(glossary): public slice API"
```

---

## Task 26: Pages — публичные `/glossary` и `/glossary/[id]`

**Files:**

- Create: `src/app/glossary/page.tsx`
- Create: `src/app/glossary/[id]/page.tsx`

- [ ] **Step 1: Создать директории**

```bash
mkdir -p "src/app/glossary/[id]"
```

- [ ] **Step 2: List page**

```tsx
// src/app/glossary/page.tsx
import {
  getTerms,
  GlossaryList,
  GlossarySearchForm,
} from "@/features/glossary";

interface Props {
  searchParams: Promise<{ q?: string; offset?: string }>;
}

export default async function GlossaryIndexPage({ searchParams }: Props) {
  const { q, offset } = await searchParams;
  const result = await getTerms({
    q,
    offset: offset ? Number(offset) : 0,
    limit: 50,
  });
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">Глоссарий</h1>
      <GlossarySearchForm defaultQ={q ?? ""} />
      <GlossaryList items={result.items} total={result.total} />
    </main>
  );
}

export const metadata = { title: "Глоссарий" };
```

- [ ] **Step 3: Detail page**

```tsx
// src/app/glossary/[id]/page.tsx
import { notFound } from "next/navigation";
import { getTermById, GlossaryDetail } from "@/features/glossary";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GlossaryTermPage({ params }: Props) {
  const { id } = await params;
  const term = await getTermById(id);
  if (!term) notFound();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <GlossaryDetail term={term} />
    </main>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const term = await getTermById(id);
  return { title: term?.title ?? "Термин" };
}
```

- [ ] **Step 4: TS+lint+build**

Run: `npx tsc --noEmit && npm run lint -- src/app/glossary`
Expected: чисто.

- [ ] **Step 5: Commit**

```bash
git add src/app/glossary/
git commit -m "feat(glossary): public pages — /glossary list and detail"
```

---

## Task 27: Pages — админские `/admin/glossary` и `/admin/glossary/[id]/edit`

**Files:**

- Create: `src/app/admin/glossary/page.tsx`
- Create: `src/app/admin/glossary/[id]/edit/page.tsx`

- [ ] **Step 1: Директории**

```bash
mkdir -p "src/app/admin/glossary/[id]/edit"
```

- [ ] **Step 2: Admin list page**

```tsx
// src/app/admin/glossary/page.tsx
import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  canCreateTerm,
  canUpdateTerm,
  canDeleteTerm,
  getTerms,
  GlossaryAdminRow,
  GlossaryCreateForm,
  GlossarySearchForm,
} from "@/features/glossary";

interface Props {
  searchParams: Promise<{ q?: string; offset?: string }>;
}

export default async function AdminGlossaryPage({ searchParams }: Props) {
  const me = await getMe();
  const canCreate = canCreateTerm(me);
  const canUpdate = canUpdateTerm(me);
  const canDelete = canDeleteTerm(me);
  if (!canCreate && !canUpdate && !canDelete) forbidden();

  const { q, offset } = await searchParams;
  const result = await getTerms({
    q,
    offset: offset ? Number(offset) : 0,
    limit: 50,
  });
  const sorted = [...result.items].sort((a, b) =>
    (a.title ?? "").localeCompare(b.title ?? "", "ru")
  );

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Глоссарий</h1>
        <p className="text-sm text-(--color-description)">Всего: {result.total}</p>
      </header>

      {canCreate && <GlossaryCreateForm />}

      <GlossarySearchForm defaultQ={q ?? ""} />

      <ul className="flex flex-col divide-y divide-(--color-border)">
        {sorted.map((term) => (
          <GlossaryAdminRow
            key={term.id}
            term={term}
            canEdit={canUpdate}
            canDelete={canDelete}
          />
        ))}
      </ul>
    </section>
  );
}

export const metadata = { title: "Глоссарий — админ" };
```

- [ ] **Step 3: Admin edit page**

```tsx
// src/app/admin/glossary/[id]/edit/page.tsx
import { forbidden, notFound } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  canUpdateTerm,
  canDeleteTerm,
  getTermById,
  GlossaryEditForm,
  GlossaryDeleteButton,
} from "@/features/glossary";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminGlossaryEditPage({ params }: Props) {
  const me = await getMe();
  const canUpdate = canUpdateTerm(me);
  const canDelete = canDeleteTerm(me);
  if (!canUpdate && !canDelete) forbidden();

  const { id } = await params;
  const term = await getTermById(id);
  if (!term) notFound();

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{term.title}</h1>
        <p className="text-xs text-(--color-description)">
          Название термина нельзя изменить. Можно редактировать только тело.
        </p>
      </header>

      {canUpdate && <GlossaryEditForm term={term} />}

      {canDelete && term.id && (
        <div>
          <GlossaryDeleteButton id={term.id} />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: TS+lint**

Run: `npx tsc --noEmit && npm run lint -- src/app/admin/glossary`
Expected: чисто.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/glossary/
git commit -m "feat(glossary): admin pages — list with create-form, edit page with delete"
```

---

## Task 28: Foundation update — admin sidebar

**Files:**

- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Найти `buildNavItems`**

Run: `grep -n "buildNavItems" src/app/admin/layout.tsx`

- [ ] **Step 2: Добавить пункт «Глоссарий»**

В `buildNavItems`, после блока с `lecture.*`, добавить:

```ts
  if (
    can(me, "glossary.create") ||
    can(me, "glossary.update") ||
    can(me, "glossary.delete")
  ) {
    items.push({ href: "/admin/glossary", label: "Глоссарий" });
  }
```

- [ ] **Step 3: TS+lint**

Run: `npx tsc --noEmit && npm run lint -- src/app/admin/layout.tsx`
Expected: чисто.

- [ ] **Step 4: Commit (отдельный «foundation update» коммит)**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat(glossary): foundation update — admin sidebar entry

Adds the «Глоссарий» admin sidebar item, gated by any-of
glossary.create | glossary.update | glossary.delete."
```

---

## Task 29: Финальная проверка — lint, test, build

**Files:** none

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: PASS, ноль warning'ов в новых файлах.

- [ ] **Step 2: Тесты**

Run: `npm test -- --run`
Expected: PASS — все тесты, включая новые (`ast-render`, `glossary/permissions`, `glossary/schemas`).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS, никаких ошибок типов или сборки.

- [ ] **Step 4: Acceptance в браузере (ручная проверка)**

Запустить локально (`npm run dev`) и пройти сценарии из spec'а §7.3:

1. **Гость** на `/glossary` — список и поиск работают.
2. **Гость** на `/glossary/<id>` — детальная страница рендерит AST-тело через `AstRender`.
3. **Гость** на `/admin/glossary` — `forbidden()` (страница `forbidden.tsx`).
4. **Active user без glossary-cap** на `/admin/glossary` — `forbidden()`.
5. **Admin с full-cap**:
   - В sidebar появился пункт «Глоссарий».
   - Создание термина (только title) → редирект на `/admin/glossary/<id>/edit`.
   - На edit: title plain text, AstEditor с пустым параграфом, сохранение работает.
   - Перечитка edit-страницы — изменения видны (cache invalidation работает).
   - На публичной `/glossary/<id>` — то же тело отрендерено через `AstRender`.
   - Поиск `?q=` фильтрует список (admin + public).
   - Удаление: ConfirmDialog → успех → редирект на `/admin/glossary`, термин исчез.
   - Domain-ошибка на удаление термина с external content_ref → понятное сообщение «На блок ссылаются другие материалы…».

- [ ] **Step 5: Если что-то падает** — фиксить отдельным коммитом, не амендить.

- [ ] **Step 6: Финальный итоговый коммит (опционально)** — если в acceptance найдены мелкие баги, их фиксы оформляются отдельными коммитами `fix(glossary): …`. Не амендим Task'и.

---

## Summary

При завершении плана:

- Создано: `src/components/ast-render/`, `src/features/glossary/`, 4 новые pages.
- Изменено: `src/utils/permissions.ts` (Capability), `src/api/tags.ts` (Tags), `src/app/admin/layout.tsx` (sidebar).
- Тесты добавлены для permissions, schemas, ast-render. Snapshot для combo AST.
- Acceptance-сценарии пройдены вручную.
- `npm run lint && npm test && npm run build` — зелёные.

**Следующие итерации (out of scope этого PR):**

- `POST /api/glossary/suggest` интеграция в редактор лекций.
- История ревизий `/admin/glossary/[id]/revisions`.
- Popover для `glossary_ref` mark на страницах лекций (использует `ctx.renderGlossaryRef`).
- Группировка списка по первой букве.
