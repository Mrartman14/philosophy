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
- **Image upload** (Phase 2a): `upload/upload-image.ts` server action + paste/drop plugin.
- **Pickers** (Phase 2b): AsyncCombobox + 5 активных категорий + 2-stage comment picker. `canvas-picker.tsx` — dormant (canvas вне скоупа программы), в RefMenu не подключён.
- **Toolbar + slash-menu** (Phase 2c): per-context кнопки и `/`-палитра.
- **Drift-warn** (Phase 2c): dev-only sanity-check hardcode ⊆ runtime.
- **Integration** (Phase 2d): image-кнопка в toolbar (`toolbar/buttons/image-button.tsx`), RefMenu-кнопка (`toolbar/buttons/ref-popover.tsx`), `@`-suggestion (`pickers/at-suggestion-plugin.ts` + `pickers/at-menu.tsx`), прокид `defaultLectureId` до comment-picker'а.

## Frozen zones

- `src/api/schema.ts` — регенерация координированно (foundation-update PR).
- `src/utils/*`, `src/components/ui/*`, `package.json` — за пределами этого слайса.

## Тесты

- `*.test.tsx` — RTL для UI компонентов.
- `pm-schema.test.ts` — round-trip через реальную PM-schema (catches name-mismatch и content-model).
- `round-trip.test.ts` — JSON ↔ JSON через serialize/deserialize.
- `*-plugin.test.ts` — изолированно через mock Editor.

## Что НЕ покрыто (Phase 3+)

- Canvas: picker dormant, `canvas_ref` вставить из UI нельзя (graceful fallback в ast-render).
- Toast при ошибке paste/drop-загрузки картинки (plugin пишет console.warn; toast есть только у toolbar-кнопки).
- Позиционирование slash-/at-меню под курсором через `view.coordsAtPos`.
- Drag-handle reorder блоков.
- Heading anchor (`heading.id`) inline edit.
- Code-block syntax highlight.
- Виртуализация для документов >5000 блоков.
