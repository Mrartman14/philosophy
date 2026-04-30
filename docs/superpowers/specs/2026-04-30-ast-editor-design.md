# AST Editor — Design

**Status**: Foundation implemented (2026-04-30). Phase 2 (pickers, image flow, toolbar UX, drift-warn, integration tests via RTL) — отдельный план.
**Date**: 2026-04-30
**Owner**: frontend
**Related**:
- Backend AST: `philosophy-api/internal/ast/`
- Backend domain: `philosophy-api/docs/domain/media-and-images.md`, `philosophy-api/docs/conventions/marks.md`
- Existing editor: `src/components/markdown-editor/`
- Foundation: `docs/superpowers/specs/2026-04-26-frontend-foundation-design.md`

---

## 1. Контекст и мотивация

В проекте текстовый контент сущностей (`document`, `glossary`, `comment`, `annotation`, `banner`, `event`, `form`) хранится бэком как **AST** — массив `ast.Block` с inline-нодами и marks. Бэк — единственный источник истины для модели данных, и он валидирует контент per-context (`ast.ValidateForContext`).

Текущий `src/components/markdown-editor/` сериализует Tiptap-документ в **markdown-строку**. Это ломает first-class элементы AST, которые в markdown не выражаются:

- 6 navigation marks: `glossary_ref`, `lecture_ref`, `document_ref`, `comment_ref`, `media_ref`, `canvas_ref` — инлайн-ссылки с типизированными attrs (UUID + опциональные inline-citation поля, см. §6.1), а не URL.
- `image` блок: `attrs.storage_key` (SHA256 содержимого), а не URL.
- Атрибуты блоков: `code_block.language`, `list.ordered/start`, `list_item.checked`, `heading.id`, `table_row.header`, `table_cell.align`.
- `code_block` — leaf-нода без `Content`; код хранится в `Block.Text`. Это асимметрично с другими блоками и должно быть отражено в сериалайзере (см. §5.2).

Markdown-конвертация — lossy. AST-эдитор работает с `ast.Block[]` напрямую, без посредника.

## 2. Цели / нецели

### Цели

- Эдитор оперирует `ast.Block[]` на вход и на выход — никакой markdown-сериализации.
- Поддерживает все 11 block-нод и 10 mark-типов из `internal/ast/schema.go`.
- Гейтит фичи (toolbar/slash-menu/nodes) per **entity context** на основании `/api/ast/schema → block_levels`.
- Лимиты (`max_text_len`, `max_content_items`, `max_marks_per_node`, `max_depth`) и `url_policy.dangerous_schemes` тянутся рантаймом из `/api/ast/schema` и применяются в Tiptap-плагинах валидации.
- Picker UX для всех 6 navigation-marks через выделенные эндпоинты.
- Image upload через `POST /api/uploads/images`; рендер через `<API_BASE>/static/files/<storage_key>`.
- Полная независимость от существующего `markdown-editor/` (никакого общего слоя на старте).

### Нецели

- Realtime / collab editing.
- Виртуализация для очень больших документов (`document` context допускает до 20000 блоков, но MVP не оптимизирует под это).
- Inline-редактирование `heading.id` (anchor-id) — пропускаем, в future work.
- Импорт markdown / import-export legacy форматов.
- Замена `markdown-editor/` или его удаление.

## 3. Архитектура: подход C — гибрид

**Tiptap-extensions хардкодятся** (по одному классу на nodeType / markType, повторяя `internal/ast/schema.go`). **Гейты и лимиты — рантайм** из `/api/ast/schema`.

```
                ┌──────────────────────────────────────┐
                │  GET /api/ast/schema (one-time fetch)│
                │  → block_levels, entity_block_limits,│
                │    limits, url_policy,               │
                │    nodes[*].attrs, elements[*].attrs │
                └──────────────┬───────────────────────┘
                               │
                               ▼
                ┌──────────────────────────────────────┐
                │   <SchemaContextProvider>            │
                │   renders skeleton until loaded      │
                └──────────────┬───────────────────────┘
                               │
                               ▼
   <AstEditor entityContext="document" value={blocks} onChange={...} />
                               │
                               │ uses schema context for:
                               │   - which extensions to activate
                               │   - which toolbar buttons to show
                               │   - validation limits
                               │   - URL scheme policy on Link mark
                               ▼
                  ┌────────────────────────────┐
                  │   useTiptapEditor(...)     │
                  │   - extensions hardcoded   │
                  │   - filtered by allowed    │
                  │     blocks for context     │
                  └────────────┬───────────────┘
                               ▼
                       ┌───────────────┐
                       │ ProseMirror   │
                       │ document      │
                       └───────┬───────┘
                               │
                  serialize()  │  deserialize()
                               ▼
                        ast.Block[]
```

### Drift safety

Хардкод TS-типов и схемы Tiptap должен совпадать с бэком. Защита:

- В `dev`-режиме — at-mount assertion: `nodes[*].type` и `elements[*].name` из ответа ⊆ хардкоду extensions. Расхождение → `console.warn` с диффом. На прод сборке assertion no-op (см. open question про Sentry-репорт в §9).
- Полный compile-time чек невозможен (openapi-typescript генерирует `string` для NodeType/MarkType, не enum). Полагаемся на runtime warn + ручную регенерацию `src/api/schema.ts` при бэк-изменениях.
- Лимиты и attr-правила — **полностью runtime-driven**, не дублируются в коде. Расхождение здесь невозможно.

## 4. Структура слайса

`src/components/ast-editor/` — frozen zone (foundation-update PR).

```
src/components/ast-editor/
├── index.ts                     # public re-exports
├── ast-editor.tsx               # entry component
├── use-ast-editor.ts            # Tiptap setup hook
├── schema-context.tsx           # Provider: fetched schema (limits, url_policy, block_levels)
├── types.ts                     # AstBlock, EntityContext, SchemaSnapshot
├── serializer.ts                # ProseMirror.Node → ast.Block[]
├── deserializer.ts              # ast.Block[] → ProseMirror.Node
├── extensions/
│   ├── index.ts                 # build extension list per context
│   ├── core.ts                  # paragraph, text, hard-break (always on)
│   ├── heading.ts
│   ├── blockquote.ts
│   ├── code-block.ts
│   ├── list.ts                  # bullet/ordered/task — single Tiptap nodeView
│   ├── image.ts                 # uses upload service
│   ├── table.ts
│   ├── thematic-break.ts
│   ├── marks/
│   │   ├── bold.ts, italic.ts, code.ts
│   │   ├── link.ts              # validates against url_policy
│   │   ├── glossary-ref.ts, lecture-ref.ts, document-ref.ts,
│   │   │ media-ref.ts, canvas-ref.ts, comment-ref.ts
│   └── validation.ts            # plugin: enforces max_text_len, max_content_items, max_marks_per_node, max_depth
├── toolbar/
│   ├── toolbar.tsx              # composes per-context buttons
│   ├── buttons/                 # one per toggle (bold, heading, list, …)
│   ├── slash-menu.tsx           # "/" command palette for blocks
│   └── ref-menu.tsx             # "@" trigger for nav-mark pickers
├── pickers/
│   ├── glossary-picker.tsx      # GET /api/glossary?q=
│   ├── lecture-picker.tsx       # GET /api/lectures?q=
│   ├── document-picker.tsx      # GET /api/documents?q=
│   ├── media-picker.tsx         # GET /api/media?q=&type=
│   ├── canvas-picker.tsx        # GET /api/canvases?q=
│   ├── comment-picker.tsx       # 2-stage: lecture → comment
│   └── async-combobox.tsx       # shared primitive: q-search + offset/limit
├── upload/
│   └── image-upload.ts          # POST /api/uploads/images
└── styles/
    └── prose.css                # editor-specific overrides on top of `prose`
```

## 5. Контракт компонента

### 5.1 Props

```ts
import type { components } from "@/api/schema";

type AstBlock = components["schemas"]["ast.Block"];
type EntityContext =
  | "document" | "glossary" | "comment" | "annotation"
  | "banner" | "event" | "form";

interface AstEditorProps {
  /** AST blocks the editor starts from. */
  defaultValue?: AstBlock[];

  /** When provided, editor is controlled. */
  value?: AstBlock[];

  /** Called on every doc change with the current AST. */
  onChange?: (blocks: AstBlock[]) => void;

  /** Drives which extensions/toolbar buttons activate and which limits apply. */
  entityContext: EntityContext;

  /**
   * Optional. Pre-selects the lecture for the comment_ref picker, skipping its
   * first step. Without it, the picker starts at "select a lecture". The value
   * is NOT written into the comment_ref mark — see §6.4.
   */
  defaultLectureId?: string;

  /**
   * If set, editor renders a hidden <input name={name}> and syncs JSON.stringify(blocks)
   * into it on every change. Use for FormData integration in small contexts.
   */
  name?: string;

  editable?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}

/** Imperative handle for parents that need to read state outside React. */
interface AstEditorRef {
  getBlocks(): AstBlock[];
  /** Validates against full server schema; returns null if valid, error message otherwise. */
  validate(): string | null;
}
```

Эдитор работает в обоих режимах (controlled / uncontrolled), как `<input>`. Это позволяет:
- Простые кейсы (формы с одним полем): uncontrolled + ref на сабмите.
- Сложные кейсы (preview, dirty-tracking): controlled.

### 5.2 ID, Position и Text — что заполняет фронт, что бэк

Согласно `internal/aststore/ClassifyBulkPayload` и `internal/document/service.go:223`:

- **`Block.ID`** — для новых блоков фронт ставит `""` (бэк сгенерирует UUID). Для существующих блоков (пришедших в `defaultValue`) `id` обязан сохраниться при rerender. Дубликат id в payload → `422 DUPLICATE_BLOCK_ID`.
- **`Block.Position`** — бэк нормализует по индексу массива. Фронт может ставить любые значения (`0`, `i`, оригинал — без разницы); канонической истиной является порядок в `blocks[]`.
- **`Block.Text`** — двойственное значение в зависимости от типа блока:
  - Для **leaf-блоков с текстовой нагрузкой** (`code_block`) — это **первоисточник**: содержимое блока хранится здесь, `Content` пуст. Сериалайзер обязан класть код в `Block.Text`.
  - Для **non-leaf-блоков** (`paragraph`, `heading`, `blockquote`, `list_item`, `table_cell`) — это плоский экстракт из `Content` для FTS. Бэк его пересчитывает при сохранении, поэтому фронт может класть `""` или результат `extractText(content)` — на сохранение это не повлияет.
  - Для **leaf-блоков без текста** (`image`, `thematic_break`) — `""`.

Сериалайзер сохраняет `id` на ProseMirror.Node-attrs (через `addAttributes` каждого block-extension) и пробрасывает обратно при выходе.

### 5.3 Save flow

Эдитор **не делает запросов сохранения**. Парент-server-action вызывает `/api/{entity}/{id}/blocks` с результатом `getBlocks()`/`onChange`.

**Простые контексты** (`banner`, `event`, `form`, `comment` — небольшие документы) — pattern с hidden-input по аналогии с текущим `markdown-editor/`: эдитор внутри пишет в `<input type="hidden" ref=…>` через `onChange` (синхронизирует JSON.stringify(blocks)), форм-action читает из FormData.

```tsx
// client component внутри server-rendered <form>
<form action={updateBannerBlocksAction}>
  <AstEditor name="blocks" entityContext="banner" defaultValue={banner.blocks} />
  <button type="submit">Save</button>
</form>
```

Для **больших контекстов** (`document` — до 20000 блоков) JSON.stringify на каждый keystroke прожорлив. Здесь используется **ref-based подход**:

```tsx
"use client";
const ref = useRef<AstEditorRef>(null);
const onSubmit = async () => {
  const blocks = ref.current!.getBlocks();
  await updateDocumentBlocks({ id, blocks });
};
```

Эдитор поддерживает оба паттерна одновременно: если задан `name`, рендерит hidden-input и пишет в него. Если задан `ref` — отдаёт getBlocks(). Опциональны оба.

## 6. Подсистемы

### 6.1 Tiptap schema mapping

Источник истины по attrs — `philosophy-api/internal/ast/marks.go` (registry of marks) и `internal/ast/schema.go` (`nodeSpecs`). Полный набор полей доступен фронту через `/api/ast/schema → elements[*].attrs` и `nodes[*].attrs` (см. `ast.ExportedAttr`: `required`, `type`, `min/max`, `min_len/max_len`, `enum`, `depends_on`, `scheme_allowlist`, `hex_only`).

#### Block-level nodes

| AST node | Tiptap base | Attrs | Кастомизация |
| --- | --- | --- | --- |
| `paragraph` | StarterKit `Paragraph` | — | StarterKit как есть |
| `heading` | StarterKit `Heading` | `level: 1..6 (req)`, `id: string ≤100` | `id` на MVP read-only (см. §9) |
| `blockquote` | StarterKit `Blockquote` | — | StarterKit как есть |
| `code_block` | custom (replaces StarterKit) | `language: string ≤50` | **leaf**, код в `Block.Text`, NodeView с language-dropdown |
| `list` + `list_item` | **custom** (replaces StarterKit BulletList/OrderedList/TaskList) | `list.{ordered: bool, start: int ≥0 dep_on=ordered}`, `list_item.{checked: bool}` | Один Tiptap-нод `list` с attr `ordered`. `list_item.checked` рендерится чекбоксом, иначе bullet/number. StarterKit list/listItem/orderedList/taskList **выключены**. |
| `image` | custom | `storage_key: hex64 (req)`, `alt: ≤1000`, `caption: ≤1000` | NodeView с upload-flow (§6.5), inline alt/caption |
| `table` / `table_row` / `table_cell` | `@tiptap/extension-table` (custom-config) | `table_row.{header: bool}`, `table_cell.{align: enum[left,center,right]}` | **`table_row.header` — атрибут**, не отдельный node-type. Tiptap-extension-table-header **не используется**; вместо этого custom render `<th>` если `row.attrs.header === true`. |
| `thematic_break` | StarterKit `HorizontalRule` | — | StarterKit как есть |

Inline:

| AST node | Tiptap base | Кастомизация |
| --- | --- | --- |
| `text` | StarterKit `Text` | StarterKit как есть |
| `hard_break` | StarterKit `HardBreak` | Shift+Enter |

#### Marks

| AST mark | Tiptap base | Attrs (registry) |
| --- | --- | --- |
| `bold`, `italic`, `code` | StarterKit `Bold`/`Italic`/`Code` | — |
| `link` | StarterKit `Link` (`openOnClick: false`) | `href: url (req, schemes=[http,https,mailto])`, `title: ≤1000` |
| `lecture_ref` | custom | `id: uuid (req)` |
| `canvas_ref` | custom | `id: uuid (req)` |
| `media_ref` | custom | `id: uuid (req)`, `start: number ≥0`, `end: number ≥0 dep_on=start` |
| `glossary_ref` | custom | `id: uuid (req)`, + inline-citation attrs (см. ниже) |
| `document_ref` | custom | `id: uuid (req)`, + inline-citation attrs |
| `comment_ref` | custom | `id: uuid (req)`, + inline-citation attrs |

**Inline-citation attrs** (только у `glossary_ref` / `document_ref` / `comment_ref`): `start_block_id`, `start_char` (dep), `end_block_id` (dep), `end_char` (dep), `block_ids` (dep), `exact` (dep), `prefix` (dep_on=exact), `suffix` (dep_on=exact). Все опциональные; задают inline-цитату из источника. **MVP-picker создаёт mark только с `id`** — citation-attrs не заполняются (но сериалайзер обязан их **сохранять при round-trip**, иначе теряем данные на edit).

**Exclusive categories.** Бэк гарантирует «≤1 navigation-mark per text node» (`internal/ast/schema.go:251`). Tiptap-плагин делает то же на клиенте: при попытке поставить второй nav-mark поверх первого — старый снимается.

**`link.href` валидация.** SchemeAllowlist для `link.href` приходит в схеме (`["http","https","mailto"]`). Plugin режет другие схемы при вводе. `url_policy.dangerous_schemes` из топ-уровня schema-response — это **дополнительный hint** (быстрый client-side reject `javascript:`/`data:`/`vbscript:`/`file:` в любых URL-полях), но точный allowlist всегда per-attr из `elements[*].attrs.<name>.scheme_allowlist`.

### 6.2 Сериализация

`serializer.ts` — обходит ProseMirror-doc, маппит каждый node/mark в `ast.Block` / `ast.Node` / `ast.Mark`. Соответствие 1-в-1; cборка `Block.text` (плоский текст) идёт по `ast.ExtractText`-эквиваленту.

`deserializer.ts` — `ast.Block[] → ProseMirror.Node` через ProseMirror schema parser. Используется на mount и при пересоздании эдитора при смене `entityContext`.

Контракт: сериализация и десериализация коммутативны для валидного AST: `serialize(deserialize(blocks)) ≡ blocks` (по структуре, без учёта пересчёта `Block.text` — его бэк всё равно нормализует при сохранении).

### 6.3 Schema fetching

`schema-context.tsx` — Provider, который тянет `/api/ast/schema` один раз и держит результат в module-level cache (singleton promise) → все эдиторы на странице используют один ответ. Пока schema не загружена — эдитор рендерит skeleton. (Это **не** React Suspense; просто условный рендер.)

```tsx
"use client";
let cached: Promise<SchemaSnapshot> | null = null;

function loadSchema(): Promise<SchemaSnapshot> {
  if (!cached) cached = apiClient.GET("/api/ast/schema").then(({ data }) => data!);
  return cached;
}

export function SchemaContextProvider({ children }) {
  const [schema, setSchema] = useState<SchemaSnapshot | null>(null);
  useEffect(() => { loadSchema().then(setSchema); }, []);
  if (!schema) return <EditorSkeleton />;
  return <SchemaContext.Provider value={schema}>{children}</SchemaContext.Provider>;
}
```

- На SSR фетч не делается; эдитор client-only (`immediatelyRender: false`). Можно ускорить через server-fetch + `initialSchema` prop на Provider — это улучшение второго круга, не MVP.
- При недоступности `/api/ast/schema` (бэк down) — fallback на жёстко-зашитые консервативные лимиты (то, что было на момент написания фронта). В UI — баннер «работаем в офлайн-режиме валидации».
- В тестах cache сбрасывается через exported `__resetSchemaCache()`; mock-ответ подаётся через msw.

### 6.4 Pickers

**Унифицированный примитив `<AsyncCombobox>`:**

```ts
interface AsyncComboboxProps<T> {
  fetcher: (q: string, offset: number, limit: number) => Promise<{ data: T[]; total?: number }>;
  renderItem: (item: T) => ReactNode;
  onSelect: (item: T) => void;
  placeholder?: string;
}
```

Каждый picker — тонкая обёртка над `<AsyncCombobox>` с конкретным `fetcher` и `renderItem`.

**Triggering pattern.** Slash-меню (`/`) — для **вставки блоков** (heading, list, code-block, image, table, hr). `@`-меню — для **вставки nav-marks**: пользователь печатает `@`, выбирает категорию (lecture/glossary/document/media/canvas/comment), затем ищет в этой категории. Toolbar-кнопка «вставить ссылку» эквивалентна `@`-меню. Это разделение конвенциональное (Notion, Linear) и не пересекается.

**Comment picker (2-этапный):**

```text
Step 1: Выбрать лекцию (LecturePicker, q-search по /api/lectures)
   ↓ user picks lecture
Step 2: Выбрать комментарий (CommentPicker scoped to lecture)
   ↓ user picks comment
   → mark inserted with attrs: { id: <comment.id> }
```

`defaultLectureId` пропускает шаг 1, но юзер всегда может «back» и сменить лекцию — что даёт возможность ссылаться на комментарий из *другой* лекции (продуктовое требование).

**Важно про attrs.** Лекция используется **только** для поиска (бэк-эндпоинт scoped к лекции). В саму mark лекция **не пишется**: `comment_ref.attrs` содержит только `id` (UUID комментария). Резолв «какой лекции принадлежит этот комментарий» — задача бэка (`internal/render/refresolver/`).

**`MediaPicker`** — radio-фильтр `type: video | audio | all` поверх q-search. Insert по умолчанию ставит только `id`; optional `start`/`end` (time-range) — вне MVP picker, добавим если будет UX-потребность.

### 6.5 Image flow

```
user action (paste / drop / toolbar button)
   │
   ▼
upload/image-upload.ts:
   POST /api/uploads/images (multipart)
   ↓
   { storage_key, upload_id }
   │
   ▼
insert image-node:
   { type: "image", attrs: { storage_key, alt: "", caption: "" } }
   │
   ▼
NodeView рендерит:
   <img src=`${API_BASE}/static/files/${storage_key}`
        alt={alt} />
   <figcaption contentEditable>{caption}</figcaption>
```

**Storage URL.** Базовый хост для `/static/files/<storage_key>` отличается dev↔prod (см. `philosophy-api/docs/domain/media-and-images.md`): на dev — это сам API-хост (`/static/files/...` mounted рядом с `/api/...`), на prod — публичный хост S3-бакета. Это **открытый вопрос** (см. §9): либо бэк прокидывает `static_files_base` через `/api/ast/schema`, либо фронт берёт отдельный env `NEXT_PUBLIC_STORAGE_URL` с дефолтом на `NEXT_PUBLIC_API_URL`. До решения — реализуем через env с дефолтом, и при необходимости перейдём на schema-driven без breaking change для NodeView.

**Errors:** 413 IMAGE_TOO_LARGE → toast «Изображение больше 10 MiB», 422 IMAGE_INVALID_MIME → «Только image/* файлы». Inline-error в node-view с возможностью retry/remove.

**Lifecycle:** загруженный файл — orphan upload до сохранения блоков. Бэк подхватит `image_storage_refs` при `PUT /api/{entity}/{id}/blocks`. Если юзер отказался от сохранения, orphan удалится бэк-cleanup-ом (см. `internal/image/`). Никаких explicit-cleanup со стороны фронта.

### 6.6 Toolbar

Кнопки toolbar показываются согласно `block_levels[entityContext]`. Например, для `comment` (basic level) — нет heading, image, table, thematic_break.

**Layout:**

- Inline group: bold, italic, code, link, `@`-menu (открывает категории nav-marks).
- Block group: heading (dropdown 1–6), list (split-button: unordered / ordered / task), blockquote, code-block, image, table, hr.
- Каждая кнопка disabled если соответствующий node/mark не в allowed set для текущего `entityContext` или над выделением не применим.

«list» — это одна Tiptap-нода с разными значениями `ordered`/`list_item.checked`. Toolbar-кнопка переключает эти значения, не переключает type.

### 6.7 Validation runtime

Tiptap-плагин (`extensions/validation.ts`) делает **soft-block** на каждом transaction:

- **Численные лимиты из `limits`:** `max_text_len` per text node, `max_content_items` per parent, `max_marks_per_node` per text node, `max_depth` от верхнего блока.
- **`entity_block_limits[context]`:** total top-level блоков.
- **Per-attr валидация из `elements[*].attrs` / `nodes[*].attrs`.** `ast.ExportedAttr` приносит `required`, `min/max` (числа), `min_len/max_len` (строки), `enum`, `depends_on`, `scheme_allowlist`, `hex_only`. Плагин проверяет это для всех attrs нод и марков. Так фронт не дублирует вшитый список правил, а синхронен с бэком.
- **`url_policy.dangerous_schemes`** применяется как глобальный fast-fail для любого URL-attr (любой `type: "url"`).

**Soft-block vs hard rollback.** При попытке ввести/вставить больше лимита — действие **не применяется** (вставка обрезается до лимита, ввод символа игнорируется), без отмены уже принятых изменений. В UI — inline-toast «Превышен лимит max_text_len», без блокирования всего эдитора. Сравните с hard-cancel transaction (`tr.dispatched = false`) — он создаёт скачкообразный UX и неприменим, например, для длинной paste-операции, которую можно частично принять.

Это не замена серверной валидации (бэк всё равно валидирует на bulk-replace), а UX-предохранитель.

### 6.8 RBAC интеграция

Эдитор сам не делает права-чеков — он визуальный примитив. Парент решает:
- Server component делает `requireCapability` или `canX(me)` и передаёт `editable={canEdit}`.
- `disabled`-стейт — opacity + pointer-events:none, как в текущем markdown-editor.

## 7. Migration plan

### Этап 1 — foundation PR (этот дизайн → план → код)

1. Скаффолд `src/components/ast-editor/` (типы, schema-context, hardcoded extensions, base toolbar).
2. Сериализация / десериализация для всех 11 nodes + 10 marks.
3. Pickers (включая 2-stage comment).
4. Image upload.
5. Validation плагин.
6. Тесты: round-trip serialize↔deserialize, RBAC-passthrough, picker-fetcher mocks, validation-плагин.

### Этап 2 — миграция консьюмеров (отдельные feature-PR-ы)

1. Включить AstEditor в новые фичи (lectures comments, glossary terms, etc.) — каждая в своей feature-PR.
2. Оставить `markdown-editor/` как-есть до полного отказа.

### Этап 3 — удаление `markdown-editor/`

После того как `git grep "markdown-editor"` пуст — удалить пакет одним PR. На момент написания дизайна consumer-ов уже нет, так что Этап 2 формально может пропустить миграцию.

### Когда extract в `_shared/`?

Только если найдём конкретный примитив (например, toolbar button `<EditorIconButton>`), которым реально пользуются оба эдитора без расхождений. До тех пор — независимо.

## 8. Тестирование

| Слой               | Что проверяем                                                                  | Подход                             |
| ------------------ | ------------------------------------------------------------------------------ | ---------------------------------- |
| Serializer         | `serialize(deserialize(blocks)) ≡ blocks` для каждого node/mark                | unit (Vitest) с фикстурами AST    |
| Schema context     | Fallback на офлайн-лимиты при 5xx                                              | unit + msw                         |
| Validation plugin  | Превышение лимитов → soft-block (ввод не применяется); per-attr правила из `ExportedAttr` | Vitest + jsdom + Tiptap fixtures |
| Pickers            | Q-search, pagination, error states                                             | unit + msw                         |
| Comment 2-step picker | Step navigation, defaultLectureId pre-select, "back" из step 2              | RTL                                |
| Image upload       | Success, 413, 422, 401                                                         | RTL + msw                          |
| RBAC pass-through  | `editable={false}` блокирует ввод                                              | RTL                                |
| Per-context gating | В `comment` контексте нет heading/image-кнопок                                 | RTL                                |

## 9. Open questions

- **Базовый URL для `/static/files`.** На проде хост S3-бакета отличается от API-хоста (см. `philosophy-api/docs/domain/media-and-images.md`). MVP — отдельный env `NEXT_PUBLIC_STORAGE_URL` с дефолтом `NEXT_PUBLIC_API_URL`. Лучшая долгосрочная альтернатива — добавить `static_files_base` в `/api/ast/schema` (бэк-сторона), и фронт возьмёт оттуда. Решить до начала работы над image-NodeView.
- **Heading anchor (`heading.id`).** Бэк принимает, но MVP UX — пропускаем (читаем при load, не меняем при edit). Future: «копировать ссылку на параграф» → автоген slug на bulk-replace или manual edit.
- **Drift-detection при изменении бэк-схемы.** При расхождении hardcoded extensions ↔ runtime schema (новая mark / новый node на бэке) сейчас — только dev-warn. Стоит ли отправлять в Sentry/observability? Future.
- **Виртуализация.** При 20000 блоков ProseMirror может тормозить. Не оптимизируем в MVP; если упрёмся — отдельная задача.
- **Collaboration.** Не в скоупе.
- **Drag-drop reorder блоков.** ProseMirror умеет, но требует UX-дизайна (handle, drop-target). Future.
- **Code-block syntax highlight.** Скип в MVP (просто `<pre><code class="language-…">`); подключить highlight.js / Prism — позже.

## 10. Decision log

- **2026-04-30.** Подход C (гибрид: hardcoded extensions + runtime gates/limits) выбран против A (полностью статичный) и B (полностью schema-driven). Обоснование: бэк остаётся источником истины для лимитов и per-context whitelisting, но Tiptap extensions имеют богатое поведение, которое плохо описывается «из JSON».
- **2026-04-30.** `comment_ref` picker — **2-stage** (lecture → comment), без принудительного `lectureId` от паркента. Обоснование: продуктовое требование — ссылаться на комментарии из *других* лекций.
- **2026-04-30.** `markdown-editor/` остаётся **независимым** на старте. Извлечение общего слоя — только при наличии конкретного шаринга, отдельным PR.
- **2026-04-30.** Schema fetch — **runtime**, не codegen. Источник истины — рантайм-ответ `/api/ast/schema`. Хардкод extensions — для DX, не для семантики.
