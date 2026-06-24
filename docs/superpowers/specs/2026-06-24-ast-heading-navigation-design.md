# Навигация по заголовкам из AST (оглавление документа)

**Дата:** 2026-06-24
**Статус:** дизайн одобрен, ожидает плана реализации

## Цель

Компонент, который из AST-контента строит навигацию по заголовкам
(оглавление) и подсвечивает текущий раздел при скролле. Применяется на
странице просмотра документа в **левом поле** лейаута; на узких экранах
(< xl) **полностью скрыт**. Компонент **агностичен к роду сущности** —
зависит только от существующего в проекте AST (`ast.Block`), не от
`Document`/`Lecture`/`Canvas`. Это позволяет переиспользовать его на любой
странице, рендерящей AST.

## Контекст и ключевые факты

### AST-контракт заголовков

Из `src/api/schema.ts`:

- `ast.Block`: `{ id?: string, type?: ast.NodeType, attrs?, content?, text?, position? }`.
- Заголовок: `type === "heading"`, уровень в `attrs.level` (число 1–6,
  дефолт 2 при отсутствии/невалидности), текст в `content[]` (inline-ноды),
  плюс предвычисленный `block.text`.
- `ast.NodeType`: `"paragraph" | "heading" | "blockquote" | "code_block" |
  "list" | "list_item" | "image" | "table" | … | "text" | "hard_break"`.

### `block.id` — backend-owned стабильная идентичность (НЕ FE-slug)

Из доменного контракта бэкенда (`philosophy-api/docs/domain/anchors.md`):

> `block_id` — глобально уникальный UUID.

`block.id` — авторитетная, стабильная, глобально уникальная идентичность
блока, которой владеет бэкенд. Она уже используется домен-широко как якорь:
комментарии и аннотации пинятся к блокам через `start_block_id`, а
`BLOCKS_HAVE_ANCHORS` (409) запрещает удалить запинённый блок. Критично: при
правке текста блок **сохраняет тот же `block_id`** — ровно свойство, нужное
долговечному якорю оглавления (адрес переживает переименование заголовка).

**Решение FE/BE-разделения (зафиксировано):**

- **Нового от бэка не требуется.** Идентичность уже backend-owned, стабильная,
  уникальная — просить «проставить id заголовкам» = дублировать существующее.
- **FE НЕ кует свою идентичность** (slug из текста). Это создало бы вторую,
  дрейфующую «личность» блока, расходящуюся с якорной идентичностью
  комментариев/аннотаций. У блока один адрес — `block.id`.
- DOM-`id` на заголовке, само оглавление, scroll-spy — чисто FE-презентация.
  Бэк про «оглавление» знать не должен (никакого TOC-специфичного поля).
- **Флаг бэку (не блокер):** в OpenAPI `ast.Block.id` типизирован как `id?`
  (опциональный). Раз комментарии к блокам якорятся, на практике UUID всегда
  присутствует в GET-ответах документа — но стоит подтвердить, что **каждый**
  заголовочный блок всегда несёт `id`. FE держит детерминированный фолбэк
  (по индексу) как **помеченный стопгап**, чтобы навигация деградировала мягко.

URL deep-link получается вида `/documents/x#<uuid>` — некрасиво, но
долговечно (не ломается при переименовании, не коллизит на одинаковых
заголовках). Человекочитаемые slug'и, если понадобятся, — осознанная
**бэкенд**-фича (поле slug), не FE-самодеятельность.

### Текущий пробел: заголовки рендерятся без `id`

`BlockRenderer` (`src/components/ast-render/block-renderer.tsx`) рендерит
`<h1>…<h6>` **без `id`-атрибута** — `block.id` используется лишь как
React-ключ. Без DOM-`id` якорные ссылки оглавления не сработают. Это
устраняется в рамках фичи (см. ниже).

### Лейаут (marginalia foundation)

`src/styles/layout.css`: корневой `<main class="page-grid">` — грид с
именованными линиями `bleed | margin-start | content | margin-end | bleed`.
Левое поле — колонка `margin-start / content-start`, ширина появляется только
на ≥xl (1280px; ниже — `--layout-margin: 0`). Размещение — через классы
`col-margin-start` / `col-margin-end`; элемент ОБЯЗАН быть **прямым потомком**
`.page-grid`, иначе именованные линии не сошлются.

Существующий `.margin-nav` даёт sticky-нав в левом поле на ≥xl, но ниже xl
показывает **полосу сверху** (как `/me`). Нам нужно поведение «**скрыть
полностью** ниже xl» — добавляется минимальный вариант-класс (см. §5).

Страница документа (`src/app/documents/[id]/page.tsx`) и весь рендер-стек
(`DocumentDetail` → `AstRender` → `BlockRenderer`) — **серверные**
компоненты; AST доступен на сервере. Страница уже возвращает фрагмент:
контент-`<div>` + `<MarginNote side="end">`.

## Архитектура

Разбита на изолированные единицы с одной ответственностью каждая.

### 1. Единый источник правды по id/уровню — `src/components/ast-render/heading.ts`

Чтобы рендерер и оглавление **гарантированно** сходились по id и уровню,
выносим эти решения в один модуль:

```ts
export function readHeadingLevel(attrs: AstBlock["attrs"]): 1|2|3|4|5|6
// (перенос приватной копии из block-renderer.tsx — дедуп)

export function headingDomId(block: AstBlock, index: number): string
// block.id ?? `heading-${index}` (фолбэк-стопгап для редкого missing-id)
```

Экспортируются из `src/components/ast-render/index.ts` как публичный API.

### 2. Рендерер проставляет `id` заголовку — `block-renderer.tsx`

Кейс `heading`: `<Tag id={headingDomId(block, i)}>…`. Глобально — для **всех**
сущностей, рендерящих AST (бонус: deep-link на любой заголовок). `BlockRenderer`
принимает индекс блока (`i` уже есть в `.map` в `ast-render.tsx` — пробрасываем
пропом).

**`scroll-margin-top` НЕ добавляем** — он уже глобальный:
`* { scroll-margin-top: var(--spacing-header) }` в `globals.css` встаёт на
любой элемент с `id`, поэтому якорь заголовка уже корректно встаёт под
sticky-шапкой. Никакого касания замороженного `globals.css` не требуется.

### 3. Чистое извлечение — `src/components/ast-toc/extract-headings.ts`

```ts
export interface HeadingEntry { id: string; level: number; text: string }
export function extractHeadings(blocks: AstBlock[]): HeadingEntry[]
```

Перечисляет **полный** массив top-level блоков с индексом, фильтрует
`type === "heading"`, берёт `level = readHeadingLevel(attrs)`,
`text = block.text ?? extractText(content)`, `id = headingDomId(block, index)`.
**`index` — позиция блока в полном top-level массиве** (НЕ среди
отфильтрованных заголовков), потому что `BlockRenderer` нумерует так же → при
редком фолбэке (`block.id` отсутствует) id согласован между рендером и
оглавлением. Server-safe, чистая, тестируется изолированно. (Top-level —
паритет с `block.text`, который бэк считает по top-level; заголовки внутри
blockquote/list в оглавление не идут.)

### 4. Компонент оглавления — `src/components/ast-toc/ast-toc.tsx` (клиентский)

`<AstToc headings={HeadingEntry[]} label={string} maxLevel?={number} />`:

- Рендерит `<nav aria-labelledby={id}>` с видимым заголовком `<p id>{label}` и
  списком якорных ссылок `<a href={"#" + id}>`; вложенность — отступом по
  `level` (мин. уровень в наборе = базовый отступ). Показывает **все
  присутствующие уровни** (h1–h6). `maxLevel` — опциональный потолок (по
  умолчанию без ограничения), на будущее. `aria-labelledby` (а не `aria-label` +
  видимый текст) → один источник лейбла, без дубля для скринридера. Длинный
  текст: `break-words` + `title={text}` (узкое поле не переполняется).
- **`label` — проп, а не внутренний i18n-вызов.** Переведённую строку передаёт
  потребитель (страница, server-side `getT`). Так компонент остаётся **полностью
  i18n-агностичным и презентационным** — не знает ни про namespace, ни про
  `@/i18n`. Усиливает агностичность к сущности.
- **Прогрессивное улучшение (scroll-spy):** в `useEffect` (клиентский рантайм)
  `IntersectionObserver` по `getElementById(h.id)` отслеживает текущий заголовок
  → подсветка ссылки + `aria-current="location"`. Эффект бежит только на клиенте,
  начальный рендер без активного пункта = совпадает с сервером (нет hydration
  mismatch).
- **Плавный скролл — в обработчике клика (рантайм):** `preventDefault` +
  `el.scrollIntoView({ behavior })` + обновление hash; `behavior` берём из
  `useReducedMotion()` (`reduced → "auto"`, иначе `"smooth"`). Чтение motion в
  **обработчике** (рантайм-поведение) — санкционированная область хука; разметку
  ссылок им НЕ гейтим (иначе hydration mismatch — см. docstring хука).
- **A11y: перенос фокуса на заголовок.** После скролла обработчик ставит
  `tabindex="-1"` на целевой `<hN>` и `focus({preventScroll:true})`. Иначе
  нативный якорь на не-фокусируемый заголовок фокус НЕ двигает → клавиатура и
  скринридер «теряются» (следующий Tab — из навигации, а не из раздела).
- **Без JS:** ссылки `<a href="#id">` уже в SSR-HTML (Next рендерит клиентские
  компоненты на сервере для initial-HTML) → нативный мгновенный переход к
  заголовку (`scroll-margin-top` глобальный). Scroll-spy и smooth — только
  улучшение поверх.
- **Пустой `headings` → `null`** (поле остаётся пустым, ничего не рисуем).

Принимает **лёгкий сериализуемый** `HeadingEntry[]` (не весь AST — не гоняем
контент в клиент повторно). Зависит только от AST-производных типов и строкового
`label` — не от доменных сущностей → агностичен.

### 5. Размещение в лейауте

`<AstToc>` рендерит `<nav>` (агностичен к размещению); **потребитель** оборачивает
его в `<aside class="margin-nav margin-nav--hide-narrow">` — **прямой потомок**
`.page-grid` (третий ребёнок фрагмента страницы документа, рядом с `<MarginNote
side="end">`). `.margin-nav` сам даёт и `grid-column: margin-start / content-start`,
и sticky под шапкой на ≥xl; `col-margin-start` НЕ нужен (избыточен). На <xl —
**скрыт полностью**. На ≥xl у сайдбара свой скролл (`max-block-size` + `overflow-y`),
поэтому длинное оглавление не обрезается.

Переиспользуем sticky/placement-логику `.margin-nav`, добавив в `layout.css`
минимальный вариант-класс «скрыть на узком экране» (вместо полосы сверху):

```css
@media (width < theme(--breakpoint-xl)) {
  .margin-nav--hide-narrow { display: none; }
}
```

`<aside class="margin-nav margin-nav--hide-narrow">`. Это **координированное
касание лейаут-фундамента** (`src/styles/layout.css`) — отмечено как
foundation-touch.

### 6. Подключение на странице документа

`src/app/documents/[id]/page.tsx` (сервер):

```tsx
const headings = extractHeadings(document.blocks ?? []);
// …в фрагменте, прямым потомком .page-grid:
<AstToc headings={headings} label={t("documentToc")} />
```

`AstToc` сам вернёт `null`, если заголовков нет.

## Поток данных

```text
document.blocks (сервер)
  └─ extractHeadings()  → HeadingEntry[]  (сервер, чистая ф-я)
       └─ <AstToc headings>  (клиент: <nav> + scroll-spy)
            └─ <a href="#id">  ──jump──►  <hN id> (из BlockRenderer)
```

Согласованность id обеспечена общим `headingDomId(block, index)` в
`ast-render/heading.ts`, который зовут и `BlockRenderer`, и
`extractHeadings` с одинаковым индексом обхода.

## Граничные случаи и ошибки

- **Нет заголовков** → `AstToc` → `null`; поле пустое.
- **Один заголовок** → показываем (валидное мини-оглавление).
- **`block.id` отсутствует** (не должно по контракту) → фолбэк
  `heading-${index}` в обоих местах → навигация работает. Помечено стопгапом;
  флаг бэку про `id?`-типизацию.
- **Дубли текста заголовков** → не проблема: id = UUID (уникален).
- **Заголовки в blockquote/list** → не попадают (top-level-обход) —
  осознанно, паритет с `block.text`.
- **UUID как DOM-id** → валиден в HTML5 (hex+дефисы, не начинается «странным»);
  `href="#uuid"`, `:target`, `getElementById` работают. Для `querySelector`
  (если понадобится) — `CSS.escape`.

## i18n

Лейбл навигации (`documentToc`: «Содержание» / «On this page» / ar / zh +
псевдо en-XA) добавляется в каталог **потребителя** (namespace `pages`) и
переводится на сервере (`getT("pages")`), затем передаётся в `<AstToc>` пропом
`label`. Сам компонент `ast-toc` строк в каталоге не заводит и i18n-фасад не
импортирует. Паритет всех локалей; ar — RTL автоматически через логические
свойства.

## Тестирование

- `extract-headings.test.ts`: уровни (вкл. дефолт-2 и клампинг), текст из
  `block.text` и из `content`, пропуск не-заголовков, top-level-обход,
  согласованность фолбэк-id с индексом, пустой ввод.
- `block-renderer`/`ast-render` снапшот: заголовок несёт `id` (= `block.id`).
- `ast-toc.test.tsx`: рендер ссылок и вложенности по уровню, `maxLevel`,
  пустой `headings` → `null`, `aria-labelledby`/`aria-current`, фокус-перенос,
  `maxLevel`, корректные `href`.
- scroll-spy под jsdom: мок `IntersectionObserver`, проверка переключения
  активной ссылки; ветка reduced-motion (без smooth).
- Гейт перед PR: `pnpm lint && pnpm test && pnpm build` — зелёные.

## Затрагиваемые/новые файлы

**Новые:**
- `src/components/ast-toc/extract-headings.ts`
- `src/components/ast-toc/ast-toc.tsx`
- `src/components/ast-toc/index.ts`
- `src/components/ast-render/heading.ts`
- тесты к вышеперечисленному.

**Изменяемые:**
- `src/components/ast-render/block-renderer.tsx` — `id` на заголовке (через
  `heading.ts`), `BlockRenderer` принимает индекс блока.
- `src/components/ast-render/ast-render.tsx` — пробрасывает индекс в
  `BlockRenderer` (`i` уже есть в `.map`).
- `src/components/ast-render/index.ts` — экспорт `heading.ts`.
- `src/app/documents/[id]/page.tsx` — подключение `<AstToc>` + `getT` лейбла.
- `src/styles/layout.css` — вариант-класс `.margin-nav--hide-narrow`
  (**foundation-touch**, единственное касание лейаут-CSS).
- каталоги i18n namespace `pages` — `documentToc` во всех локалях (ru/en/ar/zh;
  псевдо en-XA генерится автоматически).

`globals.css` и `content.css` **не трогаем** (scroll-margin уже глобальный).

## Замечания по фундаменту (координация)

- `src/components/ast-render/*` — общий рендер-компонент; правка `BlockRenderer`
  глобально добавляет `id` всем заголовкам. Беневолентно (deep-link везде), но
  это изменение общего контракта рендера — флагнуто.
- `src/styles/layout.css` — лейаут-фундамент; добавляем один вариант-класс.
- Оба касания минимальны и обслуживают текущую цель (не рефакторинг впрок).

## Открытые вопросы к бэкенду (флаги, не блокеры)

1. Подтвердить: каждый **heading**-блок в GET-ответе документа всегда несёт
   `id` (UUID). В OpenAPI поле `ast.Block.id` опционально — если гарантия есть,
   снимем FE-фолбэк-стопгап; если нет — это бэкенд-пробел.
