# RTL-инфраструктура — дизайн

- **Дата:** 2026-06-22
- **Статус:** одобрен (brainstorming), к написанию плана
- **Тип:** foundation-update (затрагивает заморожённые зоны: `src/app/layout.tsx`, `src/app/globals.css`, `src/components/ui/*`, `eslint.config.mjs`)

## Цель

Сделать кодовую базу **полностью готовой к RTL-языкам** (как если бы у нас был арабский или фарси), не отгружая реальный RTL-перевод. После работы переключение направления на `dir="rtl"` корректно зеркалит весь UI; пространственно-значимые поверхности (3D) и always-LTR контент (код, идентификаторы) изолированы и не ломаются.

### Принятые решения (из brainstorming)

1. **Проверяемость:** только плумбинг + тесты. Пользовательского RTL-тумблера и реальной `ar`-локали в проде НЕ заводим. Проверка — юнит/снапшот-тесты на `dir="rtl"` + возможность временно руками выставить direction.
2. **Объём миграции:** полный свип физических direction-зависимых стилей → логические по всему `src/` + ESLint-гард от новых.
3. **Особые поверхности:** закрываем все три класса сразу — 3D-изоляция, флип направленных иконок, bidi-изоляция always-LTR контента.

### Не-цели (YAGNI)

- Реальный перевод на арабский/фарси и добавление RTL-локали в `RESOLVED_LOCALES`.
- Пользовательская настройка направления (UI-тумблер). Направление — свойство языка, не предпочтение.
- `dir` как ось appearance / провайдер с клиентской синхронизацией.
- Постпроцессинг зеркального стейтшита (rtlcss-стиль) — заменён логическими свойствами.

## Архитектура

### Выбранный подход: вывод `dir` из локали, единственный источник на `<html>`

`dir` — свойство языка, поэтому выводится из резолвнутой локали ровно так же, как `lang`. Весь UI стоит на логических CSS-свойствах → зеркалирование автоматическое, без per-component логики. `[dir="rtl"]`-селекторы используются только там, где логические свойства не выражают эффект (флип иконок, направление теней).

Отклонённые альтернативы:
- **`dir` как ось appearance / data-атрибут через провайдер** — лишняя машинерия, противоречит семантике (направление не предпочтение).
- **RTL-стейтшит через постпроцессинг** — дублирует CSS, воюет с нативной поддержкой `ms-/me-` в Tailwind, легаси.

## Компоненты

### 1. Источник направления — `src/i18n`

В [src/i18n/locales.ts](../../../src/i18n/locales.ts):

- `export const RTL_LOCALES = ["ar", "fa", "he", "ur"] as const;` — таблица RTL-языков как данные (не обязаны присутствовать в `RESOLVED_LOCALES`).
- `export type Direction = "ltr" | "rtl";`
- `export function dirForLocale(locale: string): Direction` — `"rtl"` если primary-tag входит в `RTL_LOCALES`, иначе `"ltr"`. Принимает `string` (любой BCP-47 primary-tag), чтобы быть осмысленной и тестируемой уже сейчас, не дожидаясь добавления RTL-локали в систему.

Свойства: client-safe (без `next/server`), чистая функция, текущие `ru`/`en` → `"ltr"`.

### 2. Прокидка в DOM — `src/app/layout.tsx`

[src/app/layout.tsx:114](../../../src/app/layout.tsx) — добавить `dir`:

```tsx
<html lang={locale} dir={dirForLocale(locale)} {...dataAttrs} style={{ ...style, colorScheme }}>
```

`dir` НЕ добавляется в `htmlAttrs(appearance)` — там живут только оси оформления. SSR, без FOUC (как `lang`).

### 3. Полный свип физических → логических свойств

**Tailwind-классы (36 tsx-файлов, по ~1 совпадению на файл):**

| Физический | Логический |
|---|---|
| `ml-*` / `-ml-*` | `ms-*` / `-ms-*` |
| `mr-*` / `-mr-*` | `me-*` / `-me-*` |
| `pl-*` | `ps-*` |
| `pr-*` | `pe-*` |
| `left-*` | `start-*` |
| `right-*` | `end-*` |
| `text-left` | `text-start` |
| `text-right` | `text-end` |
| `border-l` / `border-r` | `border-s` / `border-e` |
| `rounded-l*` / `rounded-r*` | `rounded-s*` / `rounded-e*` |
| `float-left` / `float-right` | `float-start` / `float-end` |

Список файлов (на 2026-06-22 — план должен пере-сверить grep'ом перед стартом):

```
src/app/admin/layout.tsx
src/app/layout.tsx
src/app/saved/saved-lecture-view.tsx
src/components/app/app-header/app-header.tsx
src/components/app/update-prompt.tsx
src/components/ast-editor/ast-editor.tsx
src/components/ast-editor/toolbar/slash-menu.tsx
src/components/ast-merge/ast-merge-view.tsx
src/components/attachments/attachments-panel.tsx
src/components/ui/dialog.tsx
src/components/ui/form-field.tsx
src/components/ui/table.tsx
src/components/ui/toaster.tsx
src/features/annotations/ui/annotation-anchor-context.tsx
src/features/canvas/ui/canvas-editor.tsx
src/features/canvas/ui/canvas-my-list.tsx
src/features/canvas/ui/editor-toolbar.tsx
src/features/comments/ui/comment-anchor-context.tsx
src/features/comments/ui/comment-node-view.tsx
src/features/comments/ui/comment-reply-form.tsx
src/features/comments/ui/comment-tree-view.tsx
src/features/comments/ui/comment-tree.tsx
src/features/lectures/ui/lecture-detail.tsx
src/features/notifications/ui/notification-bell.tsx
src/features/notifications/ui/notification-item.tsx
src/features/notifications/ui/notification-popover.tsx
src/features/reference-graph/ui/graph-view.tsx
src/features/search/ui/search-results-skeleton.tsx
src/features/search/ui/search-results.tsx
src/features/semantic-map/ui/map-point-panel.tsx
src/features/semantic-map/ui/semantic-map-view.tsx
src/features/statistics/ui/production-stats-table.tsx
src/features/tokens/ui/connect-instructions.tsx
src/features/tokens/ui/tokens-manager.tsx
src/features/tokens/ui/usage-tracking-toggle.tsx
src/features/users/ui/users-table.tsx
```

**CSS — [src/app/globals.css](../../../src/app/globals.css):**

- 4× `left: calc(100% + Npx)` (строки ~48, 54, 127, 145 — позиционирование тултипов/поповеров) → `inset-inline-start: calc(...)`.

**Исключения (НЕ мигрируем — документируем как exempt):**

- `left: screen.x` в [src/components/scene-3d/ui/scene-region-labels.tsx:20](../../../src/components/scene-3d/ui/scene-region-labels.tsx) и [src/features/canvas/ui/editor-text-overlay.tsx:55](../../../src/features/canvas/ui/editor-text-overlay.tsx) — проекция 3D/canvas-координат на экран, не layout-направление.
- `collisionPadding={{ top, bottom, left, right }}` в [src/components/app/app-header/app-header.tsx:73](../../../src/components/app/app-header/app-header.tsx) — форма API Base UI (физическая по контракту библиотеки).

### 4. Особые поверхности

- **3D-изоляция.** Контейнеры canvas в `src/components/scene-3d/`, `src/features/semantic-map/`, `src/features/reference-graph/` получают `dir="ltr"` на обёртке canvas — гарантия, что проекция координат и инерция камеры не зеркалятся. UI-панели поверх сцены остаются в потоке (логические свойства).
- **Направленные иконки.** Утилита (CSS-класс / хелпер) `[dir="rtl"] … { transform: scaleX(-1); }` (или logical-обёртка) для иконок направления (next/prev, назад/вперёд, стрелки-шевроны навигации). Ненаправленные (лого, play, иконки сущностей) НЕ трогаем. План определяет конкретный список направленных иконок.
- **bidi-изоляция always-LTR контента.** Код / токены / латинские идентификаторы / числовые ID-колонки оборачиваются `dir="ltr"` или `<bdi>`, чтобы порядок не рвался в RTL-контексте. Кандидаты: `src/components/ast-render/{block-renderer,inline-renderer}.tsx` (code-блоки/инлайн-код), `src/features/tokens/ui/connect-instructions.tsx`, `src/features/audit/ui/audit-table.tsx`, `src/features/users/ui/users-table.tsx`, `src/features/tokens/ui/token-list.tsx`. План пере-сверяет точечно.

### 5. ESLint-гард (новый Guardrail)

В [eslint.config.mjs](../../../eslint.config.mjs) — расширить существующий паттерн `no-restricted-syntax` (используется в Guardrail 1–8):

- Запрет физических direction-классов в строковых литералах `className` (`ml-/mr-/pl-/pr-/left-/right-/text-left/text-right/border-l/border-r/rounded-l/rounded-r/float-left/float-right` и их negative-варианты).
- Запрет физических direction-свойств в `style={{}}` (`marginLeft/marginRight/paddingLeft/paddingRight/left/right/textAlign:"left"|"right"/borderLeft/borderRight`).
- Сообщение направляет на логические эквиваленты (`ms/me/ps/pe/start/end`, `marginInlineStart` и т.д.).
- Документированные исключения закрываются узким `eslint-disable-next-line` с комментарием-обоснованием (3D-координаты, Base UI API).

### 6. Док — [docs/frontend-conventions.md](../../../docs/frontend-conventions.md)

Короткий раздел: логические свойства обязательны; физические — только для exempt-кейсов (3D/canvas-координаты, API-формы библиотек); направление выводится из локали (`dirForLocale`), не является настройкой; always-LTR контент изолируется `dir`/`bdi`.

## Поток данных

```
cookie `locale` → resolveLocale() → ResolvedLocale
                                   ├─ lang={locale}            (как есть)
                                   └─ dir={dirForLocale(locale)} → <html dir>
<html dir="rtl"> → CSS логические свойства зеркалятся автоматически
                 → [dir="rtl"] селекторы флипят направленные иконки
                 → вложенные dir="ltr"/<bdi> изолируют 3D-сцены и код
```

## Обработка ошибок / краевые случаи

- `dirForLocale` на невалидном/неизвестном теге → `"ltr"` (безопасный дефолт).
- Текущие `ru`/`en` → `"ltr"` — нулевое изменение видимого поведения в проде.
- 3D-сцены: `dir="ltr"` на canvas-обёртке предотвращает зеркалирование screen-проекции; проверяется тестом.
- Base UI `collisionPadding` остаётся физическим (контракт библиотеки) — не регрессия.

## Тестирование

- **Юнит** (`src/i18n`): `dirForLocale` — `ru/en → ltr`; `ar/fa/he/ur → rtl`; мусор/`undefined` → `ltr`.
- **Рендер/снапшот:** `<html>` получает корректный `dir` по локали; ключевые экраны под принудительным `dir="rtl"` рендерятся без падений; контейнеры 3D-сцен сохраняют `dir="ltr"`.
- **bidi:** компоненты с кодом/идентификаторами несут `dir="ltr"`/`<bdi>`.
- **CI-гард:** ESLint-правило ловит новые физические классы (фикстура/негативный кейс).
- **Зелёные перед PR:** `pnpm lint && pnpm test && pnpm build`.

## Открытые вопросы к бэкенду

Нет. Инфраструктура чисто фронтовая. (Если в будущем заведут реальную RTL-локаль — бэку понадобится отдавать соответствующий `locale`, что уже покрыто существующим i18n-аском про поле `locale`.)

## Объём и риски

- ~36 tsx + globals.css (4 строки) + i18n (1 функция + константы) + layout (1 строка) + eslint (1 правило) + тесты + 3 класса спец-поверхностей.
- Свип механический и атомарный по файлам — низкий риск, легко ревьюится по диффу.
- Главный риск регрессии — пере-перевод exempt-кейсов (3D-координаты, API-формы). Митигируется явным списком исключений и `eslint-disable` с обоснованием.
