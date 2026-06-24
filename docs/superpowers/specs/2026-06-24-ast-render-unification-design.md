# Унификация рендера AST: edit/read без дублирования (нейтральная таблица + два адаптера)

**Дата:** 2026-06-24
**Статус:** дизайн одобрен, ожидает плана реализации

## Цель

Устранить **дублирование логики рендеринга AST** между режимом
редактирования и режимом чтения, не ставя горячий read-путь в зависимость от
редакторного фреймворка.

Сейчас один и тот же AST (`ast.Block[]`) превращается в DOM **двумя
независимыми кодовыми путями**:

- **EDIT** — Tiptap v3 / ProseMirror: `renderHTML` каждого extension в
  `src/components/ast-editor/extensions/*` (клиентский редактор).
- **READ** — самописный React server-компонент
  `src/components/ast-render/*` (zero-JS SSR), который **повторно вручную**
  маппит те же узлы в DOM.

Два маппинга дрейфуют (уже ловили баг расхождения типографики, commit
`234fa020`). Решение: ввести **один framework-нейтральный источник истины**
node→DOM, из которого оба пути выводятся через тонкие адаптеры.

## Не-цели (важная переформулировка)

- **НЕ** «байт-идентичный edit≡read DOM». Это недостижимо общим рендером и не
  нужно: редактор легитимно добавляет editing-chrome (nodeView-обёртки,
  ресайз-ручки, selection), которого в read быть не должно. Канонический
  пример индустрии — Tiptap в живом редакторе оборачивает таблицу в
  `<div class="tableWrapper">`, статика выдаёт голый `<table>`
  ([tiptap#7029](https://github.com/ueberdosis/tiptap/issues/7029),
  by design). Достижимая и правильная цель — **общий структурный +
  типографический маппинг**, поверх которого edit доклеивает свои
  аффордансы.
- **НЕ** добавлять зависимость в `package.json` (охраняемая зона). Решение
  обходится без `@tiptap/static-renderer` и без JSDOM.
- **НЕ** read = редактор в read-only (V3): теряет zero-JS/SEO/CSP, грузит
  бандл редактора на горячий путь. Индустрия это **избегает** — Atlassian
  поставляет отдельный display-only Renderer, а не read-only ProseMirror
  ([@atlaskit/renderer](https://atlaskit.atlassian.com/packages/editor/renderer)).

## Контекст и ключевые факты

### Источник истины и мосты (уже есть, server-safe)

- AST = `ast.Block[]` (см. `src/api/schema.ts`). Блоки + inline-ноды + марки.
- `deserialize(blocks) → ProseMirror-JSON` и `serialize(doc) → AST` —
  **чистые, server-safe** (`src/components/ast-editor/deserializer.ts`,
  `serializer.ts`). `serialize()` читает `attrs`, **не** DOM — поэтому
  вычисляемые в рендере атрибуты (href, rel) **не попадают в AST**.

### Зрелость зависимостей (обоснование развязки)

- `prosemirror-model`/`-state`/`-transform`/`-view` держатся на **1.x ~9 лет
  без ломающего 2.0** ([changelog](https://prosemirror.net/docs/changelog/)).
  Churn живёт в **редакторном слое (Tiptap, v2→v3)**, не в модели.
- Вывод: «владеем схемой, редактор — лишь один потребитель» — реальная
  позиция. Третье-лицовый риск изолируется в edit-путь, off the hot path.
- Нюанс (verified): `prosemirror-model` `DOMSerializer` **не** даёт чистого
  DOM-free серверного сериализатора — падает в Node без `window.document`,
  нужен JSDOM или свой сериализатор. Поэтому самый чистый zero-dependency
  путь — **наш собственный React-сериализатор, который у нас уже есть**.

### Прецеденты (подтверждают V2)

- **Portable Text (Sanity):** JSON-AST, отвязанный от редактора; редактор —
  отдельный пакет; рендер делегирован сериализаторам. Модель марок ложится на
  нашу: «decorators» (bold/italic/code) + «annotations» = ключи с метаданными
  (`{_key,_type,href}`) — это наши **nav-ref** с href из `id`.
- **Atlassian ADF:** `adf-schema-generator` использует нейтральный DSL
  (`adfNode`/`adfMark`) как единый источник, из которого **генерит и
  ProseMirror-схему, и рендер-маппинг** — эталон нашего V2.

### Контракт субстрата аннотаций (жёсткий инвариант)

Параллельный движок маргиналий (`src/components/annotation-layer/*`) якорится
к **read-DOM**. Любой рендер обязан сохранить контракт **байт-в-байт**:

- `data-block-id` — **только на текст-блоках** (paragraph, heading, list,
  list_item, blockquote, code_block, thematic_break). **НЕ на `<table>`**
  (строки/ячейки без id → `closest()` поднялся бы до всей таблицы → мусорный
  якорь). **НЕ оборачивая `<image>`**.
- plaintext блока = конкатенация text-узлов, `<br>` → `\n`
  (`dom-text.ts` использует `tagName === "BR"`).
- Вывод рендера = **прямые дети контейнера `.content`**, без обёртки (иначе
  ломаются flow-CSS `.content > * + *` и `root`-предположение аннотаций).
- `data-block-id` **должен эмититься через маппинг/`renderHTML`**, не через
  ProseMirror-плагин (иначе отсутствует в статике).

Контракт уже описан в `2026-06-24-text-annotations-margin-engine-design.md`
§7 — **здесь он входной инвариант**, не дублируется.

### Единственный nodeView — image

Grep подтверждает: nodeView использует **только** `ImageExt`
(`src/components/ast-editor/extensions/nodes/image.ts`). Остальные узлы —
`renderHTML`-only, дрейфа не дают. Значит «общий маппинг» покрывает всё, а
image — единственная точка, где edit (nodeView с editing-chrome) и read
(статическая `<figure>`) **законно различаются**.

### Общие server-safe хелперы (уже есть)

- `resolveStorageUrl(storageKey)` (`src/utils/storage-url.ts`) — чистая,
  используется и в edit-renderHTML, и в read.
- `isSafeHref` + rel/target (`src/components/ast-render/marks/link.tsx`).
- nav-ref href выводится из атрибута `id` (`/glossary/{id}` и т.п.).

## Решение: нейтральная таблица маппинга + два тонких адаптера

```text
                 ast.Block[]  (единственный источник истины)
                      │
        ┌─────────────┴──────────────┐
        ▼                            ▼
  EDIT-адаптер                  READ-адаптер
  toDomSpec(entry,node)         toReact(entry,node,children)
  → DOMOutputSpec               → React element (Server Component, 0 JS)
        │                            │
        └────── оба читают ──────────┘
                      │
        NODE_MAP / MARK_MAP  (framework-нейтральная таблица)
        per type: { tag, getAttrs(node)→pure, class, content }
```

Дрейф убивается **на уровне определения** (таблица), а не рендера. `ast-render`
**остаётся** (зеро-JS, под нашим контролем), но худеет — его per-node
тело-маппинги переезжают в таблицу.

### Модульная раскладка

Новый **нейтральный** модуль — единственное место, которое импортируют оба
потребителя; ни edit, ни read не импортируют друг друга:

```text
src/components/ast-content-map/        ← НОВЫЙ, framework-нейтральный
  node-map.ts      NODE_MAP: Record<NodeType, NodeEntry>
  mark-map.ts      MARK_MAP: Record<MarkType, MarkEntry>
  attrs.ts         чистые getAttrs (data-block-id rule, href из id,
                   isSafeHref+rel/target, storage-url+lazy+guard, data-align)
  types.ts         NodeEntry / MarkEntry (НЕ зависят от React и Tiptap)
  index.ts
```

- **EDIT-адаптер** живёт в `ast-editor` (рядом с extensions): читает
  `NODE_MAP/MARK_MAP`, отдаёт `DOMOutputSpec` (плоские массивы — структурно
  это не Tiptap-тип). Каждый extension `renderHTML` делегирует адаптеру.
- **READ-адаптер** живёт в `ast-render`: читает ту же таблицу, отдаёт React.
  `ast-render` остаётся server-компонентом, **без** импорта Tiptap/ProseMirror.

### Формат таблицы

```ts
// types.ts — нейтрально (никакого React/Tiptap)
interface NodeEntry {
  // тег: строка или функция от attrs (heading → `h${level}`)
  tag: string | ((node: AstNode) => string);
  // чистая функция AST-attrs → DOM-attrs; СЮДА уходит правило data-block-id,
  // data-align, storage-url и т.п. Server-safe, без побочек.
  getAttrs?: (node: AstNode) => Record<string, string>;
  // статические классы типографики (если нужны)
  class?: string;
  // модель содержимого: container (есть дети) | leaf (нет, напр. image/hr) |
  // text (текст-несущий лист, напр. code_block)
  content: "container" | "leaf" | "text";
}
interface MarkEntry {
  tag: string;                      // strong | em | code | a
  getAttrs?: (mark: AstMark) => Record<string, string> | null; // null → не оборачивать (небезопасный href)
}
```

- **data-block-id** ставит `getAttrs` **только** для текст-блоков (table/image
  его не возвращают) — инвариант аннотаций закодирован в одном месте.
- **link**: `getAttrs` зовёт `isSafeHref`; небезопасный → возвращает `null`
  (адаптеры рендерят голый текст). Внешний → `rel/target`.
- **nav-ref** (5 типов): `tag:"a"`, `getAttrs` → `{ href: "/glossary/"+id,
  "data-mark":type, class:"nav-ref nav-ref--"+type }`. Решение зафиксировано:
  nav-ref становится `<a>` **в обоих режимах** (в редакторе не навигирует —
  contenteditable; только вид).
- **image**: `getAttrs` → storage-url + `loading="lazy"` + guard `STORAGE_KEY_RE`
  (невалидный → `data-unsupported`). Edit доклеивает nodeView поверх.

### Поток данных

- **READ:** `ast-render` обходит `ast.Block[]` → для каждого узла берёт
  `NODE_MAP[type]`, применяет READ-адаптер → React. Inline-ноды/марки через
  `MARK_MAP`. Возвращает **Fragment** (прямые дети `.content`). Консьюмер
  по-прежнему оборачивает в `<div class="content" data-size>`.
- **EDIT:** `deserialize(blocks)` → PM-JSON; extensions' `renderHTML`
  делегируют EDIT-адаптеру. Редактор работает как раньше + nodeView image.

## Обработка ошибок

- Неизвестный тип узла/марки → безопасный фолбэк (текст/пропуск), не падать.
- Невалидный `storage_key` → `data-unsupported` (как сейчас, теперь из getAttrs).
- Небезопасный href → голый текст без `<a>` (MarkEntry.getAttrs → null).
- Пустой `blocks` → пустой вывод; `deserialize` уже отдаёт `doc` с параграфом.

## Тестирование

- **Parity-тест (главный страж):** фикстура AST со всеми типами → прогнать
  через **оба** адаптера (DOMOutputSpec → нормализовать в строку, и React →
  строка) и сравнить структуру (теги/атрибуты/классы). Падает при дрейфе.
- **Golden read-снапшот:** фикстура → READ-адаптер → HTML-снапшот.
- **Контракт аннотаций:** прогнать существующие `annotation-layer`-тесты
  против нового read-DOM; ассертить `data-block-id` только на текст-блоках,
  `<br>`, отсутствие обёртки.
- **Security:** набор href (`javascript:`, `//evil`, `mailto:`, относительные)
  → проверка `isSafeHref` в `getAttrs`.
- Существующие round-trip/serializer/pm-schema тесты остаются зелёными.

## Границы модулей (ESLint Guardrail)

- `ast-render/*` **не импортирует** `@tiptap/*`, `prosemirror-*`, `ast-editor/*`.
- `ast-editor/*` **не импортирует** `ast-render/*`.
- Оба импортируют только `ast-content-map/*`.
- `ast-content-map/*` **не импортирует** ни React, ни Tiptap.
- Добавить правило в существующий ESLint-guardrail-набор проекта.

## Последовательность реализации

**Task 0 — СПАЙК (де-рискинг, до фиксации деталей).**
Открытый риск (medium-confidence синтез ресерча): сможет ли Tiptap
`renderHTML` (сигнатура `DOMOutputSpec`) читать нейтральную таблицу, **не
протащив редакторные типы в read-путь**. Прототип на 2 узлах (paragraph +
heading) и 1 марке (link или nav-ref): таблица → оба адаптера → **сдиффить
DOM**; подтвердить, что read-адаптер не тянет Tiptap; проверить, что
`data-block-id` ставится через getAttrs, а не плагин.
**Fallback, если развязка не выходит чисто:** таблица питает только READ-адаптер;
EDIT остаётся на своём `renderHTML`, а parity-тест (Task 4) становится
обязательным стражем дрейфа. Это всё равно дедуплицирует read и ловит дрейф,
но слабее «один источник на оба».

**Task 1.** Создать `ast-content-map` (NODE_MAP/MARK_MAP/attrs/types) для всех
типов; перенести в `getAttrs` правило data-block-id, `isSafeHref`+rel/target,
nav-ref href, storage-url+lazy+guard, data-align.

**Task 2.** Переписать `ast-render` на READ-адаптер; сохранить контракт
аннотаций (data-block-id, `<br>`, прямые дети); убрать тело-маппинги.

**Task 3.** Переписать `renderHTML` extensions на EDIT-адаптер (если Task 0
подтвердил развязку); image сохраняет nodeView поверх базовой структуры.

**Task 4.** Parity + golden + security + annotation-layer тесты.

**Task 5.** ESLint-guard границ модулей.

**Гейт:** `pnpm lint && pnpm test && pnpm build` + ручная браузер-QA трёх
call-sites (`comment-node-view`, `form-detail`, `saved-lecture-view`).

## Координация с потоком аннотаций

Два потока делят DOM-субстрат-контракт и **имеют порядок**:

- Аннотации сейчас строятся против **текущего** `ast-render`. После Task 2
  субстрат производит обновлённый (но контракт-совместимый) рендер — целиться
  надо в него.
- Если аннотации **зашипятся первыми** и начнут персистить якоря, а потом
  read-DOM сдвинет plaintext (хоть на пробел) — Tier-1 (`block+char+exact`)
  поедет; fallback prefix/suffix-quote-search вытащит, **если видимый текст
  совпал** до символа. По данным разбора аннотации ещё не смонтированы и якоря
  не персистятся → окна миграции нет, **но контракт согласовать сейчас**.

## Риски, открытые вопросы, сигналы пересмотра

**Открытые вопросы (для спайка):**

1. Чистая ли развязка таблица↔`renderHTML` без протечки Tiptap-типов в read
   (Task 0). Если нет — fallback выше.
2. Read-представление image (единственный nodeView) — явный маппинг,
   server-safe storage-URL; правило «без data-block-id на image» сохранено.

**Сигналы пересмотреть решение:**

- Появилось много nodeView-узлов → таблица перестаёт ловить их вид, дрейф
  расширяется.
- Команда готова взять JSDOM в `package.json` → `prosemirror-model`
  DOMSerializer-путь может стать менее затратным, чем свой сериализатор.
- Tiptap v4 с большим ломающим слоем → ценность независимости read растёт
  (валидирует выбор).
- Потребность рендерить AST в non-React (PDF/email/plain-text) → нейтральный
  AST + сериализаторы окупаются вдвойне (мотив Portable Text).

## Источники (ресерч 2026-06-24)

- Tiptap static-renderer / nodeView-дрейф: tiptap.dev/docs, tiptap#7029, #6866.
- ProseMirror стабильность 1.x: prosemirror.net/docs/changelog.
- DOMSerializer нужен DOM/JSDOM: discuss.prosemirror.net/t/5419.
- Portable Text: portabletext.org/specification.
- Atlassian ADF + отдельный Renderer: atlaskit renderer, adf-schema, ADF docs.
- Якорение аннотаций (валидирует prefix/suffix fallback): W3C Web Annotation,
  Hypothes.is fuzzy/robust anchoring.
