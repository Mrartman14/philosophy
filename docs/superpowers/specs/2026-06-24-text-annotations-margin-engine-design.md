# Аннотации к выделенному тексту — движок маргиналий (Word-style)

- **Дата:** 2026-06-24
- **Статус:** Draft (на ревью)
- **Автор:** дизайн-сессия (brainstorming)

## 1. Цель

На странице просмотра документа пользователь выделяет фрагмент текста → у выделения
всплывает кнопка «+ Аннотация» → по клику открывается **модалка** ввода → при сохранении
заметка, привязанная к этому фрагменту, появляется в **боковой панели справа**, на одной
высоте с текстом, к которому относится. Визуально — как комментарии в Microsoft Word:
подсветка фрагмента в тексте + карточка-заметка на полях, связанные двусторонне.

### Ключевое нефункциональное требование

Функционал привязки заметок к тексту будет **переиспользоваться в других местах приложения**
(глоссарий, комментарии, транскрипты медиа). Поэтому ядро проектируется как **изолированный,
оттестированный «движок»**, который инжектится на поверхность просмотра, ничего не зная о
конкретной доменной сущности. Это аналог того, как `src/components/scene-3d/` стал общей
базой для карты и графа.

## 2. Зафиксированные решения

| Развилка | Решение |
| --- | --- |
| Ввод заметки | **Модалка** (`Dialog` из kit) с полем текста |
| Видимость | **Выбор private/public**, дефолт — private (модель бэка уже есть) |
| Сторона панели | **Справа** (логическое `end`, зеркалится в RTL); на узких экранах (<1280px) — список снизу |
| Объём v1 | **Полный Word-эффект**: подсветка фрагмента + двусторонний клик (текст↔карточка) |
| Reading-mode | Подсветку можно **выключить**; v1 — локальный тумблер (`localStorage`), движок агностичен к источнику флага |
| Техника подсветки | **CSS Custom Highlight API** (ноль мутаций DOM), фолбэк — оверлей-прямоугольники |
| Имя движка | `src/components/annotation-layer/` |
| Офлайн | **Вне scope** (slice A офлайн-write остаётся на паузе) |

## 3. Архитектура: движок (foundation) ↔ обвязка (фича)

Строгая граница: **фича зависит от движка, движок не знает о фиче.** Без cross-feature
импортов, без upward-coupling (ESLint Guardrail-чисто). Движок — `"use client"` shared-foundation
в `src/components/` (можно импортировать из фич), не импортирует ни одну `src/features/*`.

```
┌─ src/features/annotations/ (обвязка) ─────────────────────────┐
│  SSR-фетч аннотаций · createAnnotation(anchor) · RBAC-булевы   │
│  модалка на базе AnnotationCreateForm · renderNote(card)       │
│         │ передаёт данные + колбэки вниз                       │
│         ▼                                                      │
├─ src/components/annotation-layer/ (движок, доменно-агностичен) ┤
│  React-слой: <AnnotationLayer> <SelectionToolbar>             │
│              <MarginNotesColumn>                              │
│  Чистое ядро: anchor-from-selection · anchor-to-range ·       │
│               stacking · highlight-controller                 │
└───────────────────────────────────────────────────────────────┘
            │ читает DOM-контракт
            ▼
   src/components/ast-render/  (каждый блок несёт data-block-id)
```

### 3.1. Доменно-агностичные типы движка

Движок определяет **собственный** `TextAnchor` (структурный подмножество-тип), чтобы не
импортировать схему аннотаций. Фича маппит `annotation.Anchor` ↔ `TextAnchor` (поля
идентичны для text-range).

```ts
// src/components/annotation-layer/types.ts
export interface TextAnchor {
  startBlockId: string;
  endBlockId: string;
  startChar: number;
  endChar: number;
  exact: string;
  prefix?: string;
  suffix?: string;
}

export interface AnchoredNote {
  id: string;
  anchor: TextAnchor;
}

export interface AnchorDraft {
  anchor: TextAnchor;
  /** Прямоугольник выделения (вьюпорт-координаты) для позиционирования тулбара. */
  rect: DOMRect;
}
```

## 4. Чистое ядро движка (юнит-тестируемо на jsdom)

Вся доменная-агностичная логика — **чистые функции**, отделённые от React. Это и есть
«оттестированный движок».

### 4.1. `anchor-from-selection.ts`

`Selection` / `Range` + контент-рут → `TextAnchor | null`.

- Находит ближайший предок с `data-block-id` для start- и end-границы.
- Считает **plaintext-офсет** внутри блока: обходит текстовые узлы блока в порядке документа,
  суммируя длины, пока не дойдёт до границы Range. Inline-форматирование (`<strong>`, `<em>`,
  `<a>`, рефы) прозрачно — учитываются только текстовые узлы.
- `exact` = выделенный plaintext; `prefix`/`suffix` = N символов (напр. 32) контекста до/после
  в пределах блока (W3C TextQuoteSelector).
- Возвращает `null`, если выделение вне контент-рута, пустое (collapsed), или границы не
  принадлежат блокам с `data-block-id`.
- **Единицы офсетов** — см. §9 (вопрос к бэку): фиксируем UTF-16 code units по умолчанию,
  выравниваем под ответ.

### 4.2. `anchor-to-range.ts`

Сохранённый `TextAnchor` + контент-рут → `Range | null` (ре-анкоринг для подсветки).

- **Первично:** найти блоки по `data-block-id`, отмотать `startChar`/`endChar` по текстовым
  узлам, собрать `Range`.
- **Фолбэк по цитате:** если блок не найден или текст в нём изменился (не совпал `exact`) —
  искать `prefix + exact + suffix` в plaintext документа и привязаться к найденному месту.
- **`null` → сирота** (anchor не разрешился): фрагмент исчез после правки документа.

### 4.3. `stacking.ts`

`Array<{ id; anchorTop; height }>` → `Map<id, top>` — непересекающиеся вертикальные позиции
с сохранением порядка («магия Word»: при наезде карточка толкается вниз; при фокусе можно
сдвинуть к точной высоте якоря). Полностью чистая, центральный объект тестирования.

### 4.4. `highlight-controller.ts`

Императивный контроллер подсветки поверх `Range`'ов:

- `apply(ranges)` — через CSS Custom Highlight API (`CSS.highlights.set("annotation", new Highlight(...))`).
- `clear()` — снять (reading-mode / unmount).
- `setActive(id)` — выделенная подсветка активной заметки (отдельный `::highlight()` слой).
- **Фолбэк:** если `CSS.highlights` недоступен (старый Firefox) — оверлей-`<div>` из
  `range.getClientRects()` в абсолютном слое; репозиция на resize/scroll. Если и это
  отключено — деградация до «панель без подсветки» (функция сохранения не страдает).

## 5. React-слой движка («то, что инжектится»)

### 5.1. `<AnnotationLayer>`

Оркестратор. Props (доменно-агностичны):

```ts
interface AnnotationLayerProps {
  contentRef: RefObject<HTMLElement>;     // контент-рут с data-block-id блоками
  notes: AnchoredNote[];                  // из SSR-данных фичи
  renderNote: (note: AnchoredNote) => ReactNode;  // фича рисует карточку
  highlightEnabled: boolean;
  canCreate: boolean;
  onCreateRequest: (draft: AnchorDraft) => void;   // фича открывает свою модалку
  side?: "start" | "end";                 // дефолт "end"
  toolbarLabel: string;                   // i18n из фичи
}
```

- Подписка на `selectionchange` + `mouseup` (дебаунс), вычисление `AnchorDraft` через
  `anchor-from-selection`.
- При валидном выделении и `canCreate` → показывает `<SelectionToolbar>` у `rect`.
- Клик по тулбару → `onCreateRequest(draft)` (модалку владеет **фича**, не движок).
- Для каждой `note` → `anchor-to-range` → подсветка (если `highlightEnabled`) + позиция
  карточки в колонке через `stacking`.
- Двусторонний клик: клик по подсветке → `setActive` + скролл карточки; клик по карточке →
  `setActive` + скролл/вспышка фрагмента.
- Сироты (`anchor-to-range` → `null`) → карточка в начале колонки с пометкой, без подсветки.

### 5.2. `<SelectionToolbar>`

Плавающая кнопка (kit `Button`) в портале, спозиционированная по `rect` выделения. Скрывается
при снятии выделения / scroll.

### 5.3. `<MarginNotesColumn>`

Контейнер-колонка (рендерится в поле `.col-margin-end` через грид `.page-grid`). Позиционирует
карточки абсолютно по результату `stacking`. Контент карточки — `renderNote(note)` от фичи.
Движок владеет геометрией, фича — содержимым.

## 6. Обвязка фичи `src/features/annotations/`

Дополняем существующий слайс (CRUD/RBAC/форма уже есть), **не переписываем**.

### 6.1. Новый клиентский компонент-связка

`ui/document-annotation-layer.tsx` (`"use client"`):

- Получает initial-список аннотаций (SSR-проп) и мапит `annotation.Anchor` → `TextAnchor`.
- Рендерит `<AnnotationLayer>` с `contentRef` на тело документа.
- `renderNote` → существующий `AnnotationCard` (+ `AnnotationAnchorContext` для цитаты).
- `onCreateRequest(draft)` → открывает `<Dialog>` с формой создания.
- `highlightEnabled` ← локальный тумблер (`localStorage`, дефолт `true`).
- `canCreate` ← булев-проп от server-компонента (`canCreateAnnotation(me)`).

### 6.2. Модалка создания

`Dialog` (kit) оборачивает вариант существующей `AnnotationCreateForm`:

- Форма получает `anchor: TextAnchor` пропом и рендерит **скрытое поле** `anchor` (JSON).
  Сейчас форма осознанно не задаёт anchor ([annotation-create-form.tsx:31-32](../../src/features/annotations/ui/annotation-create-form.tsx)) —
  добавляем `<input type="hidden" name={f("anchor")} value={JSON.stringify(anchor)} />`.
- Над формой — цитата выделенного фрагмента как контекст (переиспользуем
  `AnnotationAnchorContext`).
- `schemas.ts`: убедиться, что есть `makeAnchorJsonSchema` (парс JSON → объект, кастомные
  ошибки), привязать поле `anchor` к `CreateRequest`. Бэк-валидация — финальная (422
  `ANCHOR_INVALID`).
- `actions.ts` `createAnnotation` уже шлёт `anchor` если он есть; на сохранении —
  `revalidateEntity` → SSR-список обновляется → слой перечитывает.

### 6.3. Прогрессивное улучшение / SSR

- **Сервер** рендерит аннотации обычным списком (текущий `AnnotationsSection`) — это zero-JS
  и узко-экранный вид (доступно, индексируемо).
- **Клиент** `<AnnotationLayer>` получает те же данные и улучшает список в позиционированную
  колонку на ≥1280px (грид-поля `.page-grid` / `MarginNote`).
- На узких экранах подсветка работает, колонка деградирует до списка снизу.

### 6.4. Reading-mode тумблер

Кнопка в шапке колонки: прячет подсветку (и опц. колонку). Состояние в `localStorage`,
дефолт — включено. Движок получает только `boolean`; поднятие до оси appearance в будущем
не затронет движок (только проводок).

## 7. DOM-контракт (foundation-касание — флагуется)

Движку нужен стабильный якорь в DOM: каждый блок должен нести `data-block-id`. Сейчас
`block.id` идёт только в React-`key`, в DOM не попадает
([block-renderer.tsx](../../src/components/ast-render/block-renderer.tsx)).

**Изменение:** аддитивно добавить `data-block-id={block.id}` на корневой элемент каждого
блока в `BlockRenderer` (paragraph/heading/list/list_item/blockquote/code_block/table/image).

Это касание **shared-компонента `src/components/ast-render/`** (foundation-зона по AGENTS.md) —
безопасное и аддитивное (новый data-атрибут, поведение не меняется), но фиксируется как
**foundation-часть** работы, не «внутри фичи». Контракт: «контент-рут содержит элементы с
`data-block-id`, текст блока = конкатенация его текстовых узлов».

## 8. Устойчивость anchor / сироты

- Якорь хранит и `block_id`+`char` (точный), и цитату `exact`/`prefix`/`suffix` (устойчивый
  фолбэк). Ре-анкоринг — сперва по id+char, затем по цитате (§4.2).
- Если документ отредактирован и фрагмент исчез → `anchor-to-range` = `null` → карточка-сирота
  в начале колонки с цитатой и пометкой «фрагмент не найден», без подсветки. Данные не теряются.

## 9. Вопросы к бэкенду (правило «корень на бэке»)

1. **Единицы `start_char`/`end_char`** — UTF-16 code units или руны (Go-байты/руны)? Должны
   совпасть точно (эмодзи/суррогаты), иначе подсветка съезжает. Цитата `exact` страхует, но
   офсеты должны быть детерминированы.
2. **Дрейф anchor при правке документа** — бэк пересчитывает/мигрирует якоря при изменении тела,
   или хранит как есть, а FE сам ре-анкорит по цитате? От ответа зависит частота «сиротского» пути.
3. **Per-entity роуты** `GET/POST /api/{entity}/{id}/annotations` отсутствуют в OpenAPI
   (`src/api/schema.ts`) — типизируются вручную в `types.ts`. Просьба внести в контракт.

## 10. Тестирование

Ядро движка — плотные юнит-тесты (Vitest + jsdom):

- `anchor-from-selection`: офсеты при inline-форматировании; кросс-блочные выделения;
  collapsed/вне-рута → `null`; извлечение `exact`/`prefix`/`suffix`.
- `anchor-to-range`: точный путь (id+char); фолбэк по цитате; сирота → `null`.
- `stacking`: наезды → раздвижка; сохранение порядка; пустой/одиночный вход; фокус-сдвиг.
- `highlight-controller`: применение/очистка; ветка фолбэка (мок отсутствия `CSS.highlights`).

Дельта фичи:

- `permissions.test.ts` / `schemas.test.ts` — для `anchor` JSON-схемы (min 1 success + 1 failure).

## 11. Фазировка (для implementation-плана)

1. **Ядро движка** — чистая логика (`anchor-from-selection`, `anchor-to-range`, `stacking`,
   `highlight-controller`) + юнит-тесты. Без UI.
2. **DOM-контракт** — `data-block-id` в `ast-render` (foundation, аддитивно).
3. **React-слой движка** — `<AnnotationLayer>` + `<SelectionToolbar>` + `<MarginNotesColumn>`.
4. **Обвязка фичи** — связка-компонент, модалка на базе `AnnotationCreateForm` + скрытый anchor,
   SSR-фетч, RBAC-булевы, двусторонний клик, reading-mode тумблер.
5. **Полировка** — сироты, RTL, a11y (роли/фокус/клавиатура для тулбара и карточек), узкие
   экраны, наведение/активное состояние подсветки.

## 12. Вне scope (явно)

- Офлайн-создание аннотаций (slice A офлайн-write — на паузе).
- Media-interval якоря (видео-транскрипты) — движок проектируется расширяемым, но v1 = только
  text-range на документах.
- Глоссарий/комментарии как поверхности — движок доменно-агностичен и готов к ним, но
  подключение — отдельная работа.
- Поднятие reading-mode до оси appearance.
- Редактирование/удаление из колонки сверх существующего CRUD (используем готовые действия).

## 13. Инвентарь файлов

**Новое — движок (`src/components/annotation-layer/`):**

- `types.ts` — `TextAnchor`, `AnchoredNote`, `AnchorDraft`.
- `anchor-from-selection.ts` + тест.
- `anchor-to-range.ts` + тест.
- `stacking.ts` + тест.
- `highlight-controller.ts` + тест.
- `annotation-layer.tsx` — `<AnnotationLayer>`.
- `selection-toolbar.tsx` — `<SelectionToolbar>`.
- `margin-notes-column.tsx` — `<MarginNotesColumn>`.
- `index.ts` — публичный barrel.

**Изменения — `src/components/ast-render/`:**

- `block-renderer.tsx` — `data-block-id` на блоках (foundation).

**Изменения/новое — `src/features/annotations/`:**

- `ui/document-annotation-layer.tsx` — `"use client"` связка движок↔домен.
- `ui/annotation-create-form.tsx` — приём `anchor` пропом + скрытое поле.
- `ui/annotation-composer-dialog.tsx` — модалка-обёртка формы.
- `schemas.ts` — `anchor` JSON-поле (если ещё нет).
- `anchor.ts` — `annotation.Anchor` ↔ `TextAnchor` мапперы (рядом с `buildTextAnchor`).
- `index.ts` — экспорт нового связка-компонента.

**Изменения — страница:**

- `src/app/documents/[id]/page.tsx` — монтаж связка-компонента (передать `contentRef`/данные/`canCreate`).

**i18n:** ключи тулбара/модалки/тумблера/сирот в каталогах `ru`/`en`/`ar`/`zh` (+ псевдо en-XA).
