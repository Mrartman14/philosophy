# Markdown WYSIWYG Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Создать reusable WYSIWYG Markdown-редактор на Tiptap с тулбаром на Base UI, вписанный в дизайн-систему проекта.

**Architecture:** Headless Tiptap (ProseMirror) с `tiptap-markdown` для MD ↔ JSON конвертации. Тулбар на Base UI компонентах (`Toolbar`, `ToggleGroup`, `Select`, `Popover`, `Tooltip`, `Separator`). Стили — Tailwind + CSS-переменные проекта + `@tailwindcss/typography`.

**Tech Stack:** Next.js 16, React 19, Tiptap, Base UI, Tailwind 4, TypeScript

**Design doc:** `docs/plans/2026-04-10-markdown-editor-design.md`

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Tiptap packages**

Run:
```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header @tiptap/extension-link @tiptap/extension-image @tiptap/extension-placeholder tiptap-markdown
```

**Step 2: Verify install**

Run: `npm ls @tiptap/react`
Expected: version resolved, no errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add tiptap and tiptap-markdown dependencies"
```

---

### Task 2: Editor hook — `use-markdown-editor.ts`

**Files:**
- Create: `src/components/markdown-editor/use-markdown-editor.ts`

**Step 1: Create the hook**

```ts
"use client";

import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";

interface UseMarkdownEditorOptions {
  defaultValue?: string;
  placeholder?: string;
  onValueChange?: (md: string) => void;
}

export function useMarkdownEditor({
  defaultValue,
  placeholder,
  onValueChange,
}: UseMarkdownEditorOptions) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Markdown,
    ],
    content: defaultValue ?? "",
    onUpdate: ({ editor }) => {
      const md = editor.storage.markdown.getMarkdown();
      onValueChange?.(md);
    },
  });

  return editor;
}
```

Ключевые решения:
- `StarterKit` включает: bold, italic, strike, code, codeBlock, heading, bulletList, orderedList, blockquote, horizontalRule, hardBreak.
- `Link.configure({ openOnClick: false })` — клик по ссылке не открывает URL (мешает редактированию).
- `Table.configure({ resizable: false })` — без ресайза колонок, упрощает стили.
- `Markdown` extension из `tiptap-markdown` — парсит `content` (defaultValue) как markdown и даёт `editor.storage.markdown.getMarkdown()`.

**Step 2: Verify — вручную проверь, что файл не имеет TS-ошибок**

Run: `npx tsc --noEmit --pretty 2>&1 | grep use-markdown-editor || echo "OK"`
Expected: OK (или ошибки, которые надо починить)

**Step 3: Commit**

```bash
git add src/components/markdown-editor/use-markdown-editor.ts
git commit -m "feat(markdown-editor): add useMarkdownEditor hook with Tiptap extensions"
```

---

### Task 3: Toolbar icons

**Files:**
- Create: `src/assets/icons/bold-icon.tsx`
- Create: `src/assets/icons/italic-icon.tsx`
- Create: `src/assets/icons/strikethrough-icon.tsx`
- Create: `src/assets/icons/code-icon.tsx`
- Create: `src/assets/icons/heading-icon.tsx`
- Create: `src/assets/icons/quote-icon.tsx`
- Create: `src/assets/icons/code-block-icon.tsx`
- Create: `src/assets/icons/horizontal-rule-icon.tsx`
- Create: `src/assets/icons/list-bullet-icon.tsx`
- Create: `src/assets/icons/list-ordered-icon.tsx`
- Create: `src/assets/icons/link-icon.tsx`
- Create: `src/assets/icons/image-icon.tsx`
- Create: `src/assets/icons/table-icon.tsx`

Все иконки следуют существующему паттерну проекта (см. `src/assets/icons/copy-icon.tsx`):

```tsx
import { SVGProps } from "react";

export const BoldIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="..." fill="currentColor" />
  </svg>
);
```

Используй 24×24 viewBox, `fill="currentColor"`, `width/height="1em"`. SVG-пути бери из Lucide Icons (MIT-лицензия) — они минималистичные и подходят под стиль проекта.

**Step 1: Создай все 13 иконок**

**Step 2: Commit**

```bash
git add src/assets/icons/bold-icon.tsx src/assets/icons/italic-icon.tsx src/assets/icons/strikethrough-icon.tsx src/assets/icons/code-icon.tsx src/assets/icons/heading-icon.tsx src/assets/icons/quote-icon.tsx src/assets/icons/code-block-icon.tsx src/assets/icons/horizontal-rule-icon.tsx src/assets/icons/list-bullet-icon.tsx src/assets/icons/list-ordered-icon.tsx src/assets/icons/link-icon.tsx src/assets/icons/image-icon.tsx src/assets/icons/table-icon.tsx
git commit -m "feat(markdown-editor): add toolbar icons"
```

---

### Task 4: Toolbar component — `toolbar.tsx`

**Files:**
- Create: `src/components/markdown-editor/toolbar.tsx`

**Step 1: Create toolbar**

Структура:

```tsx
"use client";

import type { Editor } from "@tiptap/react";
import { Toolbar } from "@base-ui/react/toolbar";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle } from "@base-ui/react/toggle";
import { Separator } from "@base-ui/react/separator";
import { Select } from "@base-ui/react/select";
import { Tooltip } from "@base-ui/react/tooltip";
// ... icon imports

interface EditorToolbarProps {
  editor: Editor;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor }) => {
  // ...
};
```

Используй Base UI компоненты по паттерну проекта (см. `src/features/player/volume-control.tsx` для Popover, `src/components/app/app-header/app-header.tsx` для NavigationMenu).

Ключевые моменты:
- `ToggleGroup` для inline-форматирования (bold/italic/strike/code) — `value` привязан к `editor.isActive("bold")` и т.д.
- `Select` для заголовков — опции: Paragraph, H1, H2, H3. На выбор вызывает `editor.chain().focus().toggleHeading({ level })` или `setParagraph()`.
- Вторая `ToggleGroup` для blockquote / code block / horizontal rule.
- Третья `ToggleGroup` для списков (bullet / ordered).
- Кнопки Link и Image открывают `Popover` (Task 5).
- Кнопка Table вызывает `editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()`.
- Каждая кнопка обёрнута в `Tooltip` с описанием и шорткатом.
- Стили кнопок: `p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description)` + active state `bg-(--color-text-pane) text-(--color-primary)`.

**Step 2: Verify — проверь TS**

Run: `npx tsc --noEmit --pretty 2>&1 | grep toolbar || echo "OK"`

**Step 3: Commit**

```bash
git add src/components/markdown-editor/toolbar.tsx
git commit -m "feat(markdown-editor): add toolbar with Base UI controls"
```

---

### Task 5: Link and Image popovers

**Files:**
- Create: `src/components/markdown-editor/link-popover.tsx`
- Create: `src/components/markdown-editor/image-popover.tsx`

**Step 1: Link popover**

```tsx
"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Popover } from "@base-ui/react/popover";
// ... icon imports

interface LinkPopoverProps {
  editor: Editor;
}
```

Поведение:
- При клике на кнопку Link — открывается `Popover` с полем URL и кнопками «Вставить» / «Удалить ссылку».
- Если курсор уже на ссылке — поле предзаполнено текущим href.
- «Вставить» → `editor.chain().focus().setLink({ href }).run()`, закрыть попап.
- «Удалить» → `editor.chain().focus().unsetLink().run()`, закрыть попап.

**Step 2: Image popover**

Аналогично, но:
- Поле URL для картинки + опциональное поле alt.
- «Вставить» → `editor.chain().focus().setImage({ src, alt }).run()`.
- Без кнопки «Удалить» (картинку можно удалить через Backspace в редакторе).

Оба попапа используют тот же паттерн стилей что в `src/features/player/volume-control.tsx`:
```tsx
<Popover.Popup className="bg-(--color-background) border border-(--color-border) rounded p-3 shadow-lg">
```

**Step 3: Commit**

```bash
git add src/components/markdown-editor/link-popover.tsx src/components/markdown-editor/image-popover.tsx
git commit -m "feat(markdown-editor): add link and image URL popovers"
```

---

### Task 6: Editor styles — `editor-styles.css`

**Files:**
- Create: `src/components/markdown-editor/editor-styles.css`
- Modify: `src/app/globals.css` — добавить `@import`

**Step 1: Create editor styles**

```css
/* ProseMirror editor area styles */

.markdown-editor .ProseMirror {
  outline: none;
  min-height: 200px;
  padding: 1rem;
}

/* Placeholder */
.markdown-editor .ProseMirror p.is-empty::before {
  content: attr(data-placeholder);
  color: var(--color-description);
  pointer-events: none;
  float: left;
  height: 0;
}

/* Table cell selection */
.markdown-editor .ProseMirror .selectedCell::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--color-primary);
  opacity: 0.1;
  pointer-events: none;
}

.markdown-editor .ProseMirror table td,
.markdown-editor .ProseMirror table th {
  border: 1px solid var(--color-border);
  padding: 0.5rem;
  position: relative;
  vertical-align: top;
}

.markdown-editor .ProseMirror table th {
  font-weight: 600;
  background: var(--color-text-pane);
}
```

**Step 2: Import в globals.css**

Добавь в начало `src/app/globals.css`:
```css
@import "../components/markdown-editor/editor-styles.css";
```

**Step 3: Commit**

```bash
git add src/components/markdown-editor/editor-styles.css src/app/globals.css
git commit -m "feat(markdown-editor): add ProseMirror editor styles"
```

---

### Task 7: Main component — `markdown-editor.tsx`

**Files:**
- Create: `src/components/markdown-editor/markdown-editor.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useRef } from "react";
import { EditorContent } from "@tiptap/react";
import { useMarkdownEditor } from "./use-markdown-editor";
import { EditorToolbar } from "./toolbar";

interface MarkdownEditorProps {
  defaultValue?: string;
  onValueChange?: (md: string) => void;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  defaultValue,
  onValueChange,
  name,
  placeholder,
  disabled,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const editor = useMarkdownEditor({
    defaultValue,
    placeholder,
    onValueChange: (md) => {
      onValueChange?.(md);
      if (inputRef.current) inputRef.current.value = md;
    },
  });

  if (!editor) return null;

  return (
    <div
      className={`markdown-editor border border-(--color-border) rounded-lg overflow-hidden
        focus-within:ring-2 focus-within:ring-(--color-primary)/30
        ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <EditorToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none
          prose-headings:text-(--color-foreground)
          prose-p:text-(--color-foreground)
          prose-a:text-(--color-link)
          prose-strong:text-(--color-foreground)
          prose-code:text-(--color-foreground)
          prose-blockquote:border-(--color-border)"
      />
      {name && (
        <input
          ref={inputRef}
          type="hidden"
          name={name}
          defaultValue={defaultValue ?? ""}
        />
      )}
    </div>
  );
};
```

Обрати внимание:
- `prose` из `@tailwindcss/typography` + переопределение цветов через CSS-переменные.
- `focus-within:ring` на обёртке — при фокусе внутри ProseMirror.
- Hidden input обновляется через ref (не state) — без лишних ре-рендеров.
- `disabled` — `opacity-50 pointer-events-none` на обёртке.

**Step 2: Verify TS**

Run: `npx tsc --noEmit --pretty 2>&1 | grep markdown-editor || echo "OK"`

**Step 3: Commit**

```bash
git add src/components/markdown-editor/markdown-editor.tsx
git commit -m "feat(markdown-editor): add main MarkdownEditor component"
```

---

### Task 8: Smoke test — dev page

**Files:**
- Create: `src/app/dev/editor/page.tsx` (временная страница для проверки)

**Step 1: Create dev page**

```tsx
import { MarkdownEditor } from "@/components/markdown-editor/markdown-editor";

export default function EditorDevPage() {
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-xl font-bold mb-4">Markdown Editor Dev</h1>
      <MarkdownEditor
        defaultValue={"# Hello\n\nThis is **bold** and *italic*.\n\n- list item\n- another item"}
        placeholder="Начните писать..."
        name="content"
      />
    </div>
  );
}
```

**Step 2: Run dev server and verify**

Run: `npm run dev`

Открой `http://localhost:3001/dev/editor` и проверь:
- Редактор рендерится, тулбар на месте
- Markdown из `defaultValue` отображается как WYSIWYG
- Bold/italic/heading/списки работают
- Таблица вставляется и редактируется
- Link/image попапы открываются и вставляют
- Стили соответствуют дизайн-системе (бордеры, цвета, шрифты)

**Step 3: Commit dev page**

```bash
git add src/app/dev/editor/page.tsx
git commit -m "feat(markdown-editor): add dev page for smoke testing"
```

---

### Task 9: Cleanup and final verification

**Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 2: Run lint**

Run: `npm run lint`
Expected: no errors (fix if any)

**Step 3: Run build**

Run: `npm run build`
Expected: build succeeds

**Step 4: Delete dev page**

Удали `src/app/dev/editor/page.tsx` (и `src/app/dev/` если пустая).

**Step 5: Final commit**

```bash
git rm src/app/dev/editor/page.tsx
git commit -m "chore(markdown-editor): remove dev page, cleanup"
```
