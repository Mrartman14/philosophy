# WYSIWYG Markdown Editor — Design

## Overview

Reusable WYSIWYG-редактор для длинных markdown-заметок. Построен на Tiptap (headless ProseMirror), стилизован через Tailwind + CSS-переменные проекта. Вход и выход — чистый Markdown-текст.

## Component API

```tsx
interface MarkdownEditorProps {
  defaultValue?: string;            // начальный MD-текст
  onValueChange?: (md: string) => void; // колбэк при каждом изменении
  name?: string;                    // имя для hidden <input> (FormData / server actions)
  placeholder?: string;
  disabled?: boolean;
}
```

- Если передан `name` — рендерит скрытый `<input>` с текущим MD, работает с server actions через `FormData`.
- Без debounce — вызывающая сторона решает сама.
- Компонент не отвечает за конвертацию или отправку данных.

## Packages

| Пакет | Назначение |
|-------|-----------|
| `@tiptap/react` | React-обёртка |
| `@tiptap/starter-kit` | Базовый набор: параграфы, заголовки, bold, italic, списки, code blocks, blockquote, hard break |
| `@tiptap/extension-table` | Таблицы |
| `@tiptap/extension-table-row` | Строки таблицы |
| `@tiptap/extension-table-cell` | Ячейки таблицы |
| `@tiptap/extension-table-header` | Заголовки таблицы |
| `@tiptap/extension-link` | Ссылки |
| `@tiptap/extension-image` | Картинки |
| `@tiptap/extension-placeholder` | Placeholder-текст |
| `tiptap-markdown` | MD ↔ Tiptap JSON конвертация |

## Toolbar

Горизонтальная панель сверху. Все контролы — Base UI (`Toolbar`, `ToggleGroup`, `Select`, `Popover`, `Tooltip`, `Separator`).

```
<Toolbar.Root>
  <ToggleGroup>  Bold | Italic | Strikethrough | Code  </ToggleGroup>
  <Separator />
  <Select>  Paragraph / H1 / H2 / H3  </Select>
  <ToggleGroup>  Blockquote | Code block | HR  </ToggleGroup>
  <Separator />
  <ToggleGroup>  Bulleted list | Numbered list  </ToggleGroup>
  <Separator />
  <Button + Popover>  Link  </Button>
  <Button + Popover>  Image (URL only)  </Button>
  <Button>  Table (вставляет 3×3, внутри таблицы — кнопки строк/колонок)  </Button>
</Toolbar.Root>
```

- Кнопки — иконки без текста, с title-тултипом.
- Активное форматирование подсвечивается.
- Заголовки — дропдаун (Select).
- Картинки — только по URL (попап с полем ввода).

## Styling

- **Обёртка:** `border border-(--color-border) rounded-lg`, `bg-(--color-background)`
- **Тулбар:** `border-b border-(--color-border) p-1 flex items-center gap-1`, фон `bg-(--color-text-pane)`
- **Контент:** `prose` через `@tailwindcss/typography`, цвета через CSS-переменные
- **Таблицы:** бордеры ячеек `border-(--color-border)`, выделенные ячейки — лёгкий фон
- **Placeholder:** `text-(--color-description)`, через Tiptap Placeholder extension + CSS `&.is-empty::before`
- **Фокус:** ring на обёртке при фокусе внутри ProseMirror
- **Disabled:** `opacity-50 pointer-events-none`
- Никаких импортированных CSS от Tiptap — все стили свои.

## Markdown ↔ Tiptap

- Инициализация: `defaultValue` → `tiptap-markdown` парсит в Tiptap JSON → `useEditor({ content })`
- Редактирование: `onUpdate` → `editor.storage.markdown.getMarkdown()` → `onValueChange(md)` + обновление hidden input
- Source of truth — Tiptap editor instance, MD генерируется на лету

## File Structure

```
src/components/markdown-editor/
  markdown-editor.tsx       — основной компонент <MarkdownEditor />
  toolbar.tsx               — тулбар (Base UI)
  use-markdown-editor.ts    — хук: инициализация useEditor с extensions
  link-popover.tsx          — попап для вставки ссылки
  image-popover.tsx         — попап для вставки картинки
  editor-styles.css         — стили для .ProseMirror (курсор, selection, table cell highlight)
```

Живёт в `src/components/` — общий переиспользуемый компонент, не привязан к фиче.
