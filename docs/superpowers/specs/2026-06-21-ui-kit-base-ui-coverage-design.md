# UI-kit: полное покрытие base-ui обёртками + ноль прямых импортов

**Дата:** 2026-06-21
**Статус:** дизайн одобрен, готов к написанию плана

## Проблема

По коду рассыпаны нативные интерактивные элементы (`<button>`, `<select>`,
`<form>`, `<fieldset>`/`<legend>`, `<label>`, `<textarea>`) и прямые импорты
`@base-ui/react` мимо UI-kit. Это даёт расхождение стилей, дублирование
focus-ring/shell-логики и обход дизайн-токенов. Цель — все интерактивные
примитивы идут через единый shared UI-kit ([src/components/ui/](../../../src/components/ui/)),
**ноль прямых импортов `@base-ui/react`** вне самого kit, и машинный гард,
не дающий регрессировать.

> Замечание по терминологии: пользователь называет это «shared/ui». Физически
> shared UI-kit проекта живёт в `src/components/ui/` — отдельной папки `src/shared/`
> нет. Используем существующую папку как «shared ui».

## Масштаб (зафиксировано опросом)

**В этой итерации:**

- Нативные элементы с уже существующей обёрткой → миграция:
  `<button>` ×~22 → `Button`/`IconButton`; `<select>` ×9 → `Select`;
  `<form>` ×~15 → `Form`; `<textarea>` ×1 (canvas) → `Textarea` (см. исключения).
- Нативные элементы без обёртки → новые обёртки + миграция:
  `<fieldset>`/`<legend>` → `Fieldset`; standalone `<label>` → `Label`.
- Прямые base-ui без обёрток → новые compound-обёртки + миграция:
  `Toolbar`, `Popover` (ast-editor, ~10 файлов), `NavigationMenu` (app-header);
  сырой `Field` в `dev/ui/page.tsx`.
- ESLint-гарды: запрет `@base-ui/react` вне kit + запрет нативных JSX-тегов
  `button|select|form|fieldset|legend|textarea` вне kit.
- Попутно: проставить `required` на действительно обязательных полях форм,
  которые трогаем при миграции (видимая звёздочка + клиентская валидация).
  См. раздел «Проставление required».

**Вне итерации (отдельный фоллоу-ап):**

- Миграция нативных `<input>` (~40 файлов, разнородные: text/checkbox/radio/
  file/hidden/range) и новые примитивы под них (Radio/RadioGroup/FileInput/
  Switch/NumberField). `<input>` НЕ включается в лента-гард этой итерации.

## Находка: семантика сабмита у base-ui Form (критично для миграции форм)

Прочитан исходник `node_modules/@base-ui/react/form/Form.js`. Поведение
`onSubmit`-обработчика, который base-ui навешивает на нативный `<form>`:

1. На форму ставится **`noValidate: true`** — нативная браузерная HTML5-валидация
   (пузырьки «Please fill out this field», блокировка сабмита по `required`/
   `pattern`/`type=email`) **отключается**.
2. На сабмите base-ui валидирует ТОЛЬКО поля, зарегистрированные через base-ui
   `Field`-контекст (`formRef.fields`). Нативные `<input>` вне `Field` в валидации
   **не участвуют**.
3. Если есть невалидное Field → `event.preventDefault()` + фокус на первое
   невалидное, **пользовательский `onSubmit` НЕ вызывается**.
4. Если все валидны (или зарегистрированных Field нет) → вызывается
   `onSubmit?.(event)` и base-ui **сам preventDefault НЕ делает** (кроме случая
   `onFormSubmit`-проп, который мы не используем).

**Вывод по нашим формам** (проверены все 15 поимённо):

- Формы `onSubmit` + ручной `e.preventDefault()` в обработчике
  (comment-search, share-lookup, canvas-search, audit-filter, search-input ×2,
  glossary-search, lecture-search, media-upload) — base-ui не находит base-ui
  Field, считает форму валидной, зовёт наш `onSubmit`, который сам делает
  preventDefault. **Поведение идентично. Безопасно.**
- Формы `action={serverAction}` (share-button, canvas-visibility-button,
  lecture-visibility-toggle, tokens-manager) — base-ui не preventDefault'ит,
  React обрабатывает `action`. Это ровно тот паттерн, который существующий kit
  `Form` уже использует по всему приложению. **Безопасно.**
- Нативная `method="get"`-форма (admin/comments/page.tsx) — без onSubmit/action;
  base-ui не preventDefault'ит → нативная GET-навигация проходит. **Работает.**
- **Единственное реальное изменение поведения — `noValidate`.** Из всего набора
  нативный `required` есть только в `tokens-manager.tsx:97` (на нативном `<input>`
  внутри `action`-формы). После оборачивания в `Form` браузерный required-гард
  пропадёт. Серверная валидация + `fieldErrors` остаются. **Митигация:** на этапе
  миграции либо обернуть это поле в `FormField` (base-ui Field вернёт клиентскую
  валидацию `required`), либо отложить миграцию именно этой формы до input-фоллоу-апа.
  Решение по умолчанию — обернуть поле в `FormField`.

Наш kit-`Form` ([form.tsx](../../../src/components/ui/form.tsx)) делает
`Omit<…, "children"|"errors">` и спредит `...rest`, поэтому `onSubmit`/`action`/
`method` доходят до нативного `<form>` без потерь.

## Архитектура: два стиля обёрток

Выбран **смешанный** подход по природе примитива (прецедент в kit уже есть —
`Dialog` + `export const DialogClose = BaseDialog.Close`):

1. **Закрытые обёртки** (фокусный prop-API) — для листовых примитивов:
   `Fieldset`, `Label`. По образцу существующих `Select`/`Checkbox`/`FormField`.
2. **Compound re-export** (namespace пред-стилизованных частей) — для
   композиционных: `Toolbar`, `Popover`, `NavigationMenu`. Каждая часть оборачивает
   base-ui-часть, вливает дефолтные классы через `cn(defaults, className)`,
   форвардит остальные props и `ref`. Сохраняет существующую композицию ast-editor
   дословно (например `Popover.Trigger render={<Toolbar.Button/>}`,
   чередование `Toolbar.Separator`), централизуя дефолтный стиль.

Отвергнутые альтернативы: (B) закрытый высокоуровневый API для всего — тулбар/
поповеры редактора слишком композиционны, потребовал бы рискованных переписываний
и потери гибкости; (C) голый barrel re-export без стилей — удовлетворяет буквё,
но не централизует стиль, пустая прослойка.

## Новые компоненты UI-kit

Все экспортируются из [index.ts](../../../src/components/ui/index.ts).

| Файл | Компонент | Контракт |
|---|---|---|
| `fieldset.tsx` | `Fieldset` | над base-ui `Fieldset.Root`+`Fieldset.Legend`; props: `legend?: ReactNode`, `className?`, `children`. Legend опционален (у form-builder-field-row его нет). ⚠ base-ui `Fieldset.Legend` по умолчанию рендерит `<div>` — форсим реальный `<legend>` через `render={<legend/>}`, чтобы сохранить нативную семантику (ассоциация подписи через aria сохраняется base-ui). |
| `label.tsx` | `Label` | styled нативный `<label>` (base-ui отдельного Label-примитива не даёт); props: `htmlFor?`, `className?`, `children`. |
| `toolbar.tsx` | `Toolbar` (compound) | `.Root/.Button/.Group/.Separator` над `@base-ui/react/toolbar`; forwardRef на каждой части. `.Root`/`.Group` несут дефолты из текущих inline (`flex items-center gap-1 p-1`). ⚠ `.Button` СЕЙЧАС в редакторе нестилизован (className нет нигде) → обёртка ВВОДИТ новый единый вид кнопки (осознанная редизайн-дельта, не «вынос» существующего стиля; критерий приёмки — эталон состояний default/hover/pressed/disabled/focus, а не «паритет»). |
| `popover.tsx` | `Popover` (compound) | `.Root/.Trigger/.Portal/.Positioner/.Popup/.Arrow/.Close` над `@base-ui/react/popover`; дефолтный стиль popup/arrow вынесен из link-popover/ref-popover. |
| `navigation-menu.tsx` | `NavigationMenu` (compound) | `.Root/.List/.Item/.Trigger/.Content/.Positioner/.Portal/.Popup/.Viewport/.Arrow` над `@base-ui/react/navigation-menu`; стиль из app-header. |

`dev/ui/page.tsx`: сырой `Field` → рефактор демо на `FormField`/обёртки kit,
ноль сырого base-ui (это собственный smoke-showcase kit, отдельный сырой Field
там не нужен).

## Карта миграции

- `<select>` ×9 → `Select`: `options=[{value,label}]`, `onChange`→`onValueChange`,
  `name`/`defaultValue` маппятся 1:1. Снять `<option>`-детей (×17).
- `<form>` ×~15 → `Form`: см. находку выше; поведение сохраняется, кроме
  `tokens-manager` (обернуть required-поле в `FormField`).
- `<button>` ×~22 → `Button`/`IconButton` (иконочные без текста → `IconButton`).
- `<fieldset>`/`<legend>` ×3/2 → `Fieldset`.
- standalone `<label>` → `Label`; пары label+control, где уместен Field —
  свернуть в `FormField` (часть из 43 уже идёт через FormField).
- ast-editor (~10 файлов): импорт `@base-ui/react/toolbar`→`Toolbar` из kit,
  `…/popover`→`Popover` из kit. Поведение неизменно.
- app-header: `NavigationMenu` из kit.

## Проставление required (попутно с миграцией форм)

При оборачивании полей в `FormField` проставляем `required` на действительно
обязательных — чтобы пользователь видел звёздочку и получал клиентскую валидацию.

- **Источник истины — Zod-схема фичи** (`src/features/<entity>/schemas.ts`), а не
  на глаз. Поле обязательно, если в схеме оно НЕ `.optional()`/`.nullish()` и без
  дефолта (например в share-links `resource_type`/`resource_id` обязательны,
  `expires_at` — нет).
- **Механика:** `FormField` уже рендерит `*` при `required`
  ([form-field.tsx](../../../src/components/ui/form-field.tsx)); дополнительно
  ставим `required` на сам контрол → base-ui `Field` даёт клиентскую валидацию
  (что также закрывает кейс `tokens-manager` из находки выше).
- **Граница:** только поля форм, которые реально трогаем при миграции
  (обёрнутые в `FormField`). Не аудит всех форм проекта — это не отдельная задача,
  а попутная гигиена в зоне касания.

## Санкционированные исключения (документируются явно)

1. `src/app/global-error.tsx` — корневой Next error-boundary, рендерится вне
   провайдеров приложения. На этапе миграции проверить, работает ли `Button`
   standalone; если ломает — оставить нативную кнопку с построчным
   `// eslint-disable` + комментарием.
2. `src/features/canvas/ui/editor-text-overlay.tsx` `<textarea>` — абсолютно-
   позиционированный inline-редактор узла канваса, не форм-контрол; shell-стиль
   `Textarea` (border/padding) мешает позиционированию. Остаётся нативным с
   `eslint-disable` + комментарием как единственное задокументированное исключение
   по `<textarea>`.

## Enforcement (ESLint) — ставится ПОСЛЕДНИМ

Чтобы `pnpm lint` зеленел только после завершения миграции. Оба запрета — ОДНИМ
блоком `no-restricted-syntax` (НЕ `no-restricted-imports`):

- **Запрет импорта base-ui** — селектор `no-restricted-syntax` на
  `ImportDeclaration` с regex по `source.value`. КРИТИЧНО: слеш ВНУТРИ тела regex
  нельзя писать литеральным символом — он обрывает regex-литерал в грамматике
  esquery и валит весь `pnpm lint` с исключением (проверено сквозным
  Linter.verify). Слеш кодируется unicode-escape-последовательностью — точный,
  протестированный селектор приведён в плане (Task 14). Реализуем
  через `no-restricted-syntax`, а НЕ `no-restricted-imports` как изначально в спеке:
  flat-config НЕ мержит опции одного правила, а `no-restricted-imports` уже задан
  пятью per-file блоками (Guardrail 1–5) — отдельный syntax-селектор не конфликтует
  с ними (тот же приём, что у Guardrail 6).
- **Запрет JSX-элементов** `button|select|form|fieldset|legend|textarea` (селекторы
  `JSXOpeningElement[name.name='button']` и т.д.).
- **Scope:** `src/**` минус `src/components/ui/**` минус `src/**/*.test.{ts,tsx}`
  (тесты исключены — mock-стабы/харнессы легитимно рендерят нативные теги и
  импортируют base-ui). Блок ПОВТОРЯЕТ rich/markup-селекторы G6 (flat-config
  last-wins). Точечные `// eslint-disable-next-line` для двух прод-исключений
  (global-error, canvas-overlay). `<input>` в гард НЕ включается (фоллоу-ап).

## Тестирование

- Smoke-тесты для новых обёрток по образцу существующих
  ([form.test.tsx](../../../src/components/ui/form.test.tsx),
  checkbox/confirm-dialog паттерны): рендер, прокидывание className/props,
  для compound — что части рендерят base-ui-структуру и форвардят ref.
- Существующие feature-тесты держим зелёными; правим только те, что цепляются за
  конкретный нативный тег (например, `getByRole`-селекторы при смене `<button>`).
- Гейт перед PR: `pnpm lint && pnpm test && pnpm build` зелёные.

## Фазы реализации

1. **Обёртки.** Новые `Fieldset`/`Label`/`Toolbar`/`Popover`/`NavigationMenu` +
   экспорты в `index.ts` + smoke-тесты. Без миграции потребителей.
2. **Простые форм-элементы.** Миграция `select`/`form`/`button`/`fieldset`/
   `legend`/`label` пофично. `tokens-manager` required-поле → `FormField`.
   Попутно проставить `required` (звёздочка + валидация) обязательным полям в
   зоне касания, сверяясь с Zod-схемой фичи (см. «Проставление required»).
3. **Сложные base-ui.** ast-editor (Toolbar/Popover) + app-header
   (NavigationMenu) + рефактор `dev/ui/page.tsx`.
4. **Гарды.** ESLint: base-ui import-ban + native-tag guard + два исключения.
5. **Финальный гейт.** `pnpm lint && pnpm test && pnpm build`.

## Риски

- `noValidate` у base-ui Form — единственная точка поведенческого изменения
  (см. `tokens-manager`, митигация через `FormField`). Прочие формы безопасны.
- Форвардинг `ref` в compound `Popover` (`initialFocus`, `Positioner`) — каждая
  обёрнутая часть обязана пробрасывать ref.
- `global-error` standalone-ограничения — проверить на этапе 2.
- Это foundation-update PR (касается замороженных зон `src/components/ui/*`,
  `src/components/{app,ast-editor,…}`, `eslint.config.mjs`) — координированный,
  не в составе фичи (как и предписывает AGENTS.md).
