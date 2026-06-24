# Editor ref-picker на Base UI Combobox — design

**Дата:** 2026-06-24
**Статус:** approved (brainstorming) → ожидает ревью спеки перед планом

## 1. Контекст и проблема

В AST-редакторе ссылки на сущности (`*_ref`-марки) вставляются через `RefMenu` — категорийные
кнопки (Термин/Документ/Медиа/Комментарий) + пер-типовой пикер на ручном `AsyncCombobox`.
Комментарий — двухступенчатый (`Comment2StagePicker`: лекция → комментарий). Проблемы:

- UX выбора сделан вручную (`AsyncCombobox`: свой input/listbox/клавиатура/aria/debounce/пагинация).
- Контекст-зависимость («комментарий живёт в лекции») зашита неявно, без единой точки истины.
- Раньше всё меню рисовалось статикой внизу контента (баг позиционирования уже починен через
  Base UI Popover + caret-anchor) — поэтому 2-stage comment был плохо заметен.

Цель: контекст-осознанная combobox-композиция с максимальным переиспользованием Base UI
(без костылей), удобная по UX, + конвергенция ручного движка на Base UI во всём проекте.

## 2. Решения (зафиксировано с пользователем)

- **Типы ссылок:** 4 активных категории — Термин (`glossary_ref`), Документ (`document_ref`),
  Медиа (`media_ref`), Комментарий (`comment_ref`). Canvas остаётся dormant (как сейчас).
- **`annotation_ref` НЕ добавляем.** Подтверждено по `philosophy-api`: в `ast.MarkType` его нет;
  аннотации — маргиналии, суб-ресурс родителя (`/api/{document|comment|…}/{id}/annotations`),
  не вставляются в контент. Отсутствие в опциях — корректно, не баг.
- **Поверхности:** `@`-меню (inline) + кнопка тулбара. Slash (`/`) остаётся только для блоков.
- **Контекст-зависимость:** небольшая FE-карта. Бэкенд НЕ отдаёт машиночитаемый picker-context
  (только block-level `entity_contexts`). Из 4 типов контекст нужен только комментарию (lecture).
  В марку пишется лишь `id` (даже у comment — `lecture_id` не сохраняется, он лишь scope поиска).
- **Композиция:** Scoped combobox — один Base UI Combobox-попап, категория = переключатель-заголовок,
  комментарий = drill-in лекции через хлебную крошку. Без внешнего Popover (нет двойного попапа).
- **Охват:** полная конвергенция — `AsyncCombobox` реимплементируется на Base UI и заменяется везде
  (canvas/trails/attachments), старый ручной движок удаляется. Их тесты держим зелёными.
- **Иконка тулбара:** меняем `BookmarkIcon` → новый символ «@» (`AtIcon`), т.к. и `@`-меню, и
  кнопка тулбара ведут один и тот же ref-пикер.

### Бэкенд-контракт (проверено в philosophy-api)

`ast.MarkType` = `bold|italic|code|link|glossary_ref|document_ref|comment_ref|media_ref|canvas_ref`.
Все `*_ref` — категория `navigation`, атрибут `id` (UUID, required) + опц. anchor-атрибуты
(`start_block_id`/`start_char`/`exact`/… — для привязки к диапазону в цели; FE их сейчас не задаёт).
Скоупы поиска: glossary/document/media/canvas — глобальные (`/api/{glossary|documents|media|canvases}`);
comment — лекция-скоуп (`/api/lectures/{id}/comments/search`). Валидация на сохранении: `422 REF_NOT_FOUND`
проверяет лишь существование `id` (lecture_id в марке не требуется).

## 3. Архитектура

```
useAsyncComboboxItems(fetcher)   ← чистый хук: debounce + seq-token + пагинация + {items,status,error}
        │
        ├── AsyncCombobox        ← generic self-contained Combobox (drop-in API). features/* + attachments
        └── RefPicker            ← scoped-combobox оболочка редактора (категории + drill-in)
                ├── refTypes (FE-карта)  ← SOT: категория → {mark, labelKey, scope, fetch, renderItem, getKey}
                ├── AtMenu        ← anchor=каретка (caret-anchor.ts), open=плагин @-suggestion
                └── RefPopover    ← Combobox.Trigger=кнопка тулбара (иконка @)
```

Серверная логика поиска вынесена в **хук**; UI — два шелла поверх него (generic + scoped). Один
движок, две оболочки, без дублирования.

### 3.1 `useAsyncComboboxItems(fetcher, pageSize?)`

Чистый engine (без UI). Переносит проверенную логику текущего `AsyncCombobox`:
- debounce запроса (200ms);
- sequence-token: только последний ответ коммитится (отбрасывает устаревшие при гонке q/пагинации/смене fetcher);
- пагинация (offset += pageSize, append; `canLoadMore = total!=null && items.length<total`);
- состояния `loading | error | empty | ready`, retry.

Возвращает `{ items, total, status, error, query, setQuery, loadMore, canLoadMore, reload }`.
`fetcher` — стабильная ссылка (как сейчас, смена identity = рефетч).

### 3.2 `AsyncCombobox` (generic, реимплементация на Base UI)

Внешний контракт сохраняем (drop-in): `fetcher / renderItem / getKey / onSelect / onClose? /
placeholder? / pageSize? / copy?{empty,error,loading}`. Внутри:
`Combobox.Root` (`filter={null}`, `items` из хука, контролируемые `inputValue`/`onInputValueChange`)
→ `Combobox.Input` + `Combobox.List`/`Item` + `Combobox.Status` (loading/error) + `Combobox.Empty`
+ футер «загрузить ещё». Клавиатура/listbox/aria/aria-activedescendant — нативно Base UI
(ручной a11y-bridge удаляется). Объект-значения через `itemToStringLabel`/`isItemEqualToValue`.

Потребители (zero-change по API): `features/canvas/ui/entity-ref-dialog.tsx`,
`features/trails/ui/trail-items-editor.tsx`, `components/attachments/attach-target-picker.tsx`
(+ `features/lectures` attachments-manager), а также пер-типовые пикеры
(`glossary/document/media/comment/lecture-picker`), которые остаются тонкими обёртками.

### 3.3 `refTypes` — FE-карта (SOT контекст-зависимости)

```ts
// псевдо-структура
{
  glossary: { mark:"glossary_ref", labelKey:"refCategoryGlossary", scope:"global",
              fetch:searchGlossary, renderItem, getKey },
  document: { mark:"document_ref", labelKey:"refCategoryDocument", scope:"global",
              fetch:searchDocuments, ... },
  media:    { mark:"media_ref",    labelKey:"refCategoryMedia",    scope:"global",
              fetch:searchMedia, ... },
  comment:  { mark:"comment_ref",  labelKey:"refCategoryComment",
              scope:{ parent:"lecture", parentFetch:searchLectures, childFetch:searchCommentsByLecture },
              renderItem, getKey },
}
```

Модель `scope` обобщённая (`"global" | { parent, parentFetch, childFetch }`) — добавить второй
контекстный тип в будущем = одна запись, без правок шелла.

### 3.4 `RefPicker` — scoped combobox (один `Combobox.Root`)

Состояние шелла: `{ activeType, parentId? }`.
- **Заголовок:** переключатель категорий (kit ToggleGroup/segmented; см. §6 про kit). Смена →
  `activeType`, сброс `inputValue`, новый `fetch` в хук.
- **Тело:** `Combobox.Input` + `Combobox.List` от хука с фетчером активного scope.
- **Comment drill-in:** `scope=parent:lecture`, `parentId` нет → ищем лекции (`parentFetch`);
  выбор лекции → `onValueChange` ставит `parentId` (НЕ вставляет, попап открыт), показывает
  крошку `‹ Лекция: …` (клик/Backspace-on-empty = сброс `parentId`); далее ищем комментарии
  лекции (`childFetch(parentId)`). `defaultLectureId` префиллит `parentId` (сразу шаг 2).
- **Выбор сущности (терминальный):** `onValueChange` → `onWillInsert()` (убрать `@`-маркер,
  только в AtMenu) → вставка label-текста с `setMark(mark,{id})` (как сейчас в RefMenu.apply:
  collapsed → insertContent с маркой; non-empty selection → setMark) → закрыть.

Маршрутизация drill-vs-insert — через контролируемые `value`/`open`/`inputValue` (легитимно, без хаков).

### 3.5 Поверхности

- **AtMenu:** `Combobox.Root` (`open`=плагин-состояние `at-suggestion`, `onOpenChange(false)`→
  `closeAtSuggestion`+focus редактора) → `Combobox.Positioner anchor={caretVirtualElement}`
  (переиспользуем `caret-anchor.ts`) → `Combobox.Popup` с `<RefPicker>` (input внутри попапа).
- **RefPopover (тулбар):** `Combobox.Trigger` = кнопка-закладка с иконкой `AtIcon` →
  `Positioner` (якорь = кнопка) → `Popup` с `<RefPicker>`.

> ⚠️ **СПАЙК (первая задача плана):** подтвердить, что Base UI Combobox поддерживает «Input внутри
> Popup + якорь Positioner к каретке/кнопке без внешнего Input-trigger». Если поддержки нет —
> **fallback:** caret-anchored `Popover` (уже реализован для AtMenu) + Combobox в inline-режиме
> (Input+List inline, без собственного Combobox-попапа). Оба варианта без костылей; спайк выбирает
> предпочтительный. Это единственная техническая неизвестность; реализация гарантирована fallback'ом.

## 4. Иконка тулбара

Добавить `src/assets/icons/at-icon.tsx` (`AtIcon`) — тот же паттерн, что `BookmarkIcon`
(`SVGProps<SVGSVGElement>`, `viewBox="0 0 24 24"`, `fill="currentColor"`, `width/height="1em"`),
символ «@». В `toolbar/buttons/ref-popover.tsx` заменить `<BookmarkIcon />` → `<AtIcon />`.
`src/assets/icons` не в заморозке. `BookmarkIcon` используется ТОЛЬКО в `ref-popover.tsx` (проверено) →
после замены становится мёртвым кодом → удаляем `src/assets/icons/bookmark-icon.tsx` (иначе knip пожалуется).

## 5. Конвергенция и удаление

- `AsyncCombobox` реимплементируется на (`useAsyncComboboxItems` + Base UI Combobox); имя/путь
  сохраняем → consumers zero-change по API.
- Пер-типовые пикеры (`glossary/document/media/comment/lecture-picker`) и `Comment2StagePicker` —
  **остаются файлами** (нужны canvas/trails/attachments), но в редакторе их роль берёт `RefPicker`+`refTypes`.
- `ref-menu.tsx` (старый категорийный шелл) удаляется/замещается `RefPicker`.
- Гейт: тесты `features/canvas`, `features/trails`, `features/lectures`, `components/attachments`
  остаются зелёными (могут потребовать правок селекторов под новую DOM-структуру Combobox).

## 6. UI-kit (foundation-update — ОБЯЗАТЕЛЬНО)

**Новый kit-примитив `Combobox`.** В kit его нет (есть Popover/Select), а Guardrail 7 запрещает
прямой импорт `@base-ui/react` вне `src/components/ui` (ESLint: «новый примитив — добавь обёртку
в UI-kit»). Поэтому в `src/components/ui/combobox.tsx` добавляем тонкую compound-обёртку над
`@base-ui/react/combobox` (по образцу `popover.tsx`: passthrough Root/Input/List/Item/Positioner/
Popup/Status/Empty/… + surface-стиль на Popup) и экспортируем из `src/components/ui/index.ts`.
`src/components/ui/*` — заморожённая зона; это foundation-часть работы (флаг пользователю в handoff).

Переключатель категорий хочет сегмент-контрол/ToggleGroup. Если в kit (`src/components/ui`) такого
примитива нет — это **заморожённая зона** (новый примитив = отдельный foundation-PR с обсуждением).
Варианты без расширения kit: (a) ряд kit-`Button` с `aria-pressed`/`tone` (как сейчас в RefMenu —
точно доступно), (b) Base UI `ToggleGroup` напрямую — но это вне kit (Guardrail 7 «kit-only»).
**Решение по умолчанию:** ряд kit-`Button` с `aria-pressed` (роль `tablist`/`radiogroup` для a11y),
без нового kit-примитива. Если хочется сегмент-контрол в kit — отдельный PR.

## 7. i18n / a11y

- Новые строки: лейблы категорий (уже есть `refCategory*`), крошка «Лекция: {title}», шаг-подсказки,
  плейсхолдеры поиска по типам. Во все каталоги: ru/en/ar/zh + псевдо en-XA. ICU где нужно.
- a11y: Base UI Combobox даёт role=combobox/listbox/option + aria-activedescendant + клавиатуру
  (стрелки/Enter/Esc) нативно — ручные бриджи (как в slash-menu/AsyncCombobox) убираем.
- RTL: логические свойства; стрелка крошки `rtl-flip` (как `ChevronIcon` в Comment2StagePicker).

## 8. Тесты

- `useAsyncComboboxItems`: debounce, seq-token (drop stale), пагинация, error→retry, empty.
- `AsyncCombobox`: поиск/выбор/empty/loading/«ещё» на новом движке (переписать текущий тест).
- `RefPicker`: переключение категорий; drill-in лекция→комментарий; `defaultLectureId`-префилл;
  вставка каждой из 4 марок (glossary/document/media/comment) с корректным `id` и удалением `@`;
  отмена/Esc.
- `AtMenu` / `RefPopover`: открытие, якорь (coordsAtPos вызван), вставка, закрытие; иконка `AtIcon`.
- Регресс: `features/canvas`, `features/trails`, `features/lectures`, `components/attachments`.
- Гейт перед PR: `pnpm lint && pnpm test && pnpm build` зелёные.

## 9. Параллельная работа агентов

Файлы трогают несколько зон (ast-editor/pickers, features/canvas|trails|lectures, attachments,
assets/icons, i18n-каталоги). Коммитим только свои файлы по имени (`git add <files>`), без `-A`,
без деструктивных git-операций (AGENTS.md).

## 10. Открытые вопросы / риски

- **Спайк §3.5** — input-in-popup + anchor (единственная неизвестность, fallback гарантирован).
- **Селекторы тестов consumers** — новая DOM-структура Combobox может потребовать правок их тестов
  (часть конвергенции, ожидаемо).
- **anchor-атрибуты марок** (`start_block_id`/`exact`/…) — вне охвата (FE задаёт только `id`, как сейчас).
- **canvas_ref** — остаётся dormant; при желании добавить 5-ю категорию — одна запись в `refTypes`.
