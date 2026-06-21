# Строгий минимальный UI-kit: оси вариации + границы ответственности

**Дата:** 2026-06-21 (ревизия после мультиагентного ревью)
**Статус:** дизайн одобрен (скорректирован по итогам ревью), готов к написанию плана
**Контекст:** надстройка над инициативой [2026-06-21-ui-kit-base-ui-coverage](2026-06-21-ui-kit-base-ui-coverage-design.md) (вся миграция нативных элементов и base-ui за UI-kit уже выполнена).

## История ревизии

Первая редакция этого дизайна предлагала: убрать `size` и выражать компактность ТОЛЬКО через глобальный `data-density`; 3 тона; закрыть className на всех leaf-контролах единообразно. Мультиагентное ревью (5 линз, на коде) вскрыло, что часть решений ломается о реальность:

- **`size → data-density` арифметически неверно.** `--size-control-h-md` под `[data-density="compact"]` = **36px**, тогда как сегодняшний `size="sm"` Button = **32px**, IconButton sm = **28px**. То есть «компактная» замена была бы **больше** заменяемого. К тому же `data-density` — это глобальная пользовательская настройка appearance (`<html>`); локально гонять ею «эта кнопка мелкая» затирает выбор пользователя и не вкладывается.
- **Полное закрытие className единообразно** ломало бы легитимные кейсы: `Label`-как-обёртка (80% использований), `flex-1` на инпуте в ряду, `w-auto` на инлайн-фильтре, `type=color`/`font-mono`-инпуты.
- **default tone = neutral** тихо демотил бы ~35 главных submit-кнопок (TS это не ловит).

Скорректированная редакция (ниже) сохраняет выбранное направление — **строгий, закрытый, минимальный kit** — но даёт каждому брейкеру **типизированный** выход вместо открытого className, и чинит ось размера.

## Проблема (корень, не симптом)

Миграция вскрыла повторяющийся класс багов: дефолт обёртки и `className` потребителя целятся в одно CSS-свойство, а наивный `cn` (`src/components/ui/cn.ts`, plain join без tailwind-merge) их не разрешает — исход решает emit-order Tailwind, а не код.

**Но `cn`/tailwind-merge — не корень.** Конфликт возникает потому, что на одно свойство есть ДВА источника истины. А двое их потому, что **примитивы залезают в зону ответственности потребителя**: запекают layout/размер, хотя должны владеть только идентичностью (семантика, a11y, поведение, фокус). `className`-merge как универсальный override — это открытая поверхность, которая по построению создаёт конфликты.

**Выбранное направление — строгость (закрытые intentful-примитивы), минимум вариантов.** Цель: kit, который **нельзя применить неправильно**. Стоимость (объём ре-миграции, ручные правки) сознательно принята как приемлемая ради строгости и простоты системы.

`tailwind-merge` остаётся в дизайне, но **как подстраховка для ОТКРЫТЫХ structural-поверхностей** (Stack/Inline/Toolbar/Popover/Dialog/Table), где className потребителя легитимно мёржится с базой. Для закрытых leaf-контролов merge не нужен — там className вообще нет. Это вторичное средство, а не центр решения.

## Модель: оси вариации

| Ось | Решение |
|---|---|
| **Размер** | per-component `size` (sm/md/lg) УБИРАЕТСЯ. Вместо него — **бинарный типизированный** `compact?: boolean` на Button/IconButton: `false`→`--size-control-h-md`, `true`→`--size-control-h-sm`. Оба токена каскадируют под пользовательскую плотность. Это структурная ось «обычный/компактный», ортогональная глобальной пользовательской density. |
| **Tone** | 4 семантических тона: `primary` (главное, filled) / `neutral` (второстепенное, border+subtle-fill) / `quiet` (тихое, hover-only без resting-фона) / `danger` (разрушительное, filled). default = `primary`. Каждый тон — ровно одна каноничная отрисовка. |
| **Layout** | Из поведенческих/leaf-примитивов УБИРАЕТСЯ. Два structural layout-примитива: `Stack` (вертикальный ритм) и `Inline` (горизонтальный ряд). |
| **className (core-стиль)** | Leaf-контролы НЕ принимают `className` — только типизированные пропы. Легитимные раскладочные/структурные нужды покрыты явными пропами (`compact`, `grow`, `fill`, `mono`) или специализированными примитивами (`ColorInput`), либо переносятся на structural-родителя (`Stack`/`Inline`/`FormField`). |

### Размер: `compact`, а НЕ `data-density`

Существующие токены уже трёхтировые и каскадируют под пользовательскую плотность (`src/styles/tokens.generated.css`):

| | comfortable (`:root`) | compact (`[data-density=compact]`) |
|---|---|---|
| `--size-control-h-md` | 2.5rem (40px) | 2.25rem (36px) |
| `--size-control-h-sm` | 2rem (32px) | 1.75rem (28px) |

Решение: контрол по умолчанию привязан к `--size-control-h-md`; `compact={true}` переключает на `--size-control-h-sm`. Это:
- даёт **правильный** компактный размер (28-32px, как сегодняшний `sm`), а не 36px;
- **композируется** с глобальной пользовательской плотностью (оба токена каскадируют): пользователь-compact + контрол-compact = 28px, пользователь-comfortable + контрол-compact = 32px;
- **не смешивает** две оси: глобальная density (`data-density` на `<html>`) остаётся чисто пользовательской настройкой appearance; структурная компактность — отдельный типизированный проп.

`lg`-тир удаляется из публичного API (0 использований в коде). `--size-control-h-lg` остаётся в токенах как потенциально-мёртвый — его удаление из генератора токенов выносится отдельным координированным PR (генератор — запретная зона), сейчас не трогаем.

`IconButton` переводится с литерала `h-9 w-9` на токен (`compact={false}`→`--size-control-h-md` квадрат, `compact={true}`→`--size-control-h-sm`) — становится density-aware, как Button. Только что добавленный (прошлая инициатива) `IconButton.size` удаляется, его 3 потребителя (`attachments-panel.tsx` ×2, `notification-bell.tsx` ×1) переводятся на `compact`.

### Tone: 4 значения, default `primary`

Ревью показало распределение: `ghost` 38× / `secondary` 22× / `danger` 22× / `primary` 3× (явно; остальные primary — из дефолта). `secondary` (border+fill) и `ghost` (hover-only) — **две разные визуальные роли**, не шум. Поэтому маппинг 1:1 без потери иерархии:

| старый `variant` | новый `tone` | отрисовка |
|---|---|---|
| `primary` | `primary` | filled (`bg-fg`/`text-surface`) |
| `secondary` | `neutral` | `border + bg-surface-subtle` |
| `ghost` | `quiet` | hover-only, без resting-фона/рамки |
| `danger` | `danger` | filled (`bg-danger-solid`) |

default остаётся `primary` (как сейчас у Button) → главные submit-кнопки не теряют акцент молча.

`IconButton` имеет СВОЙ набор (иконочная кнопка не должна конкурировать с filled-кнопкой): `tone: "neutral" | "primary" | "danger"`, default `neutral`. Здесь `neutral` = hover-only (то, что у Button называется `quiet`) — это сознательное расхождение, документируется в коде: иконочная кнопка по своей природе тихая.

## Граница: leaf vs structural

- **Leaf-контролы — ЗАКРЫТЫ** (только пропы, ноль className): `Button`, `IconButton`, `Select`, `TextInput`, `Textarea`, `Checkbox`, `Label`, `ColorInput`. Ширина/позиция/растяжение — забота родителя или явного пропа, не className.
- **Structural / compound — ОТКРЫТЫ** (className = раскладка): `Stack`, `Inline`, `FormField`, `Toolbar`, `Popover`, `NavigationMenu`, `Dialog`, `Table`. Здесь className легитимен.
- **Form** — поведение only (`errors`/`onSubmit`/`action`/`ref`), без layout-className.

`unstyled` Button остаётся ЕДИНСТВЕННЫМ явным escape для «вида» (именованный проп, не className) — для кликабельных строк/карточек/ссылок-кнопок.

### Типизированные выходы для легитимных нужд (вместо className)

Ревью нашло реальные кейсы, которые нельзя просто «перенести на родителя». Каждый получает типизированный проп:

| Нужда (сейчас className) | Решение |
|---|---|
| `flex-1` на инпуте в горизонтальном ряду | `grow?: boolean` на `TextInput`/`Textarea` (= `flex-1 min-w-0`) |
| `w-auto` на инлайн-фильтре Select | `fill?: boolean` на `Select` (default `true`=`w-full`; `false`=intrinsic ширина) |
| `<TextInput type="color" className="h-10 w-20 p-1">` | новый примитив `ColorInput` (своя геометрия color-picker) |
| `<Textarea className="font-mono text-xs">` (JSON-редактор) | `mono?: boolean` на `Textarea` |
| `<Label className="flex flex-col gap-1">текст<control/></Label>` | миграция на существующий `FormField` (он владеет этим layout-ом) |
| `self-start`/выравнивание кнопки в форме | structural-родитель `Inline`/`Stack` с align-пропом |
| фиксированная ширина (`w-44`/`w-48`) | ширину задаёт structural-родитель (`Inline`/`Stack`/обёртка) |

### Layout-примитивы

**`Stack`** — вертикальный ритм. Рендерит `div` с `flex flex-col`, gap из `--space-stack` (density-aware). structural → className открыт. Опциональный `align?: "stretch" | "start"` (default `stretch` — поля тянутся на ширину; `start` — для кнопок/интринсик-контента).

**`Inline`** — горизонтальный ряд. Рендерит `div` с `flex flex-row items-center` (или `items-end` через проп), gap из density-токена, `flex-wrap`. structural → className открыт. Поглощает: горизонтальные формы, ряды фильтров, ряды кнопок, выравнивание одиночной кнопки.

**`FormField`** (существует) — `label + control + error` поверх base-ui Field, владеет вертикальным layout-ом поля. Цель миграции для `<Label>`-обёрток.

## Минимальный API (целевой)

```tsx
// Leaf-контролы: пропы, без className
<Button tone="primary" type="submit">Сохранить</Button>      // default tone = primary
<Button tone="quiet" onClick={onCancel}>Отмена</Button>
<Button compact tone="neutral">Ещё</Button>
<IconButton tone="neutral" aria-label="Удалить"><TrashIcon/></IconButton>
<Select name="visibility" options={[…]} aria-label="Видимость" />
<Select name="filter" options={[…]} fill={false} aria-label="Фильтр" />  // инлайн-фильтр

// Поведение + раскладка композицией
<Form action={action} errors={errs}>
  <Stack>
    <FormField name="title" label="Заголовок" required>
      <TextInput name="title" required />
    </FormField>
  </Stack>
</Form>

// Горизонтальная форма поиска
<Form action={searchAction}>
  <Inline align="end">
    <TextInput name="q" grow placeholder="Поиск…" />
    <Select name="scope" options={[…]} fill={false} aria-label="Область" />
    <SubmitButton>Найти</SubmitButton>
  </Inline>
</Form>

// Компактный регион (пользовательская плотность остаётся за data-density на <html>)
<Toolbar.Root>
  <IconButton compact tone="neutral" aria-label="Жирный"><BoldIcon/></IconButton>
</Toolbar.Root>
```

## Enforcement (TS + ESLint)

- **TS-уровень (строже линта):** leaf-контролы НЕ объявляют `className`. Для компонентов, чьи Props наследуют нативный HTML-тип (`TextInput`/`Textarea`/`Label`), используется `Omit<…HTMLAttributes<…>, "className">`; для рукописных интерфейсов (`Checkbox`, `Select`, `Button`, `IconButton`) — просто отсутствие поля. `size` убран; `tone`/`compact` — узкие типы.
- **Guardrail 8 (ESLint, по образцу Guardrail 7):** реальные `no-restricted-syntax`-селекторы с тест-фикстурой —
  - запрет JSX-атрибутов `variant=` и `size=` на kit-контролах (устаревшие имена);
  - запрет сырого `flex flex-col`/`grid`-layout-className на `<Form>`-уровне (направляет в `Stack`/`Inline`).
  Реализуется работающим селектором + фикстурой, НЕ «положиться на TS+ревью».
- **Guardrail 7** (ноль нативных тегов / прямых base-ui вне kit) — остаётся.

## Фазы и ЧЕСТНАЯ цена

Объём (измерено ревью по коду): **~106 уникальных файлов / ~236 точек правки** (45 `size` + 87 `variant` + 60 className-on-leaf + 44 Form). Это сравнимо с предыдущей миграцией. Делается строго пофазно, каждая фаза — отдельный шиппабельный срез, зелёный по `pnpm lint && pnpm test && pnpm build` (с учётом pre-existing долга semantic-map/canvas — не наш).

1. **`cn` + tailwind-merge** (подстраховка открытых поверхностей) + проверка v4-совместимой версии.
2. **Токен-консолидация размера + `compact`.** Button/IconButton: убрать `size`, ввести `compact`, привязать к токенам. Откат `IconButton.size`, ре-миграция его 3 потребителей.
3. **Layout-примитивы `Stack` + `Inline`** + тесты.
4. **Tone-консолидация.** Button: 4 тона, `variant→tone`-маппинг, default `primary`. IconButton: свой набор. Чистка barrel `index.ts` (`ButtonVariant`/`ButtonSize` → `ButtonTone`). Ре-миграция call-site'ов (включая object-spread `subscribe-button.tsx`, который tsc НЕ ловит — ловится grep'ом). Переписать витрину `dev/kit`.
5. **Типизированные выходы:** `grow` (TextInput/Textarea), `fill` (Select), `mono` (Textarea), примитив `ColorInput`. Ре-миграция соответствующих потребителей.
6. **Миграция `<Label>`-обёрток на `FormField`** (19 файлов), затем закрытие className на `Label`.
7. **Закрытие className на остальных leaf** (Button-styled/IconButton/Select/TextInput/Textarea/Checkbox) через `Omit`/отсутствие поля. Ре-миграция оставшихся className-потребителей.
8. **Form без layout** → потребители в `Stack`/`Inline` (снять дефолт `flex flex-col gap-4`, закрыть layout-className).
9. **Guardrail 8** (последним — lint зеленеет после миграции).

## Риски и решения (одобрены пользователем)

- **default tone = `primary`** (не neutral): сохраняет акцент главных действий, исключает тихую регрессию ~35 submit-кнопок.
- **4 тона, не 3:** `neutral`(обведённый)/`quiet`(тихий) — две живые роли (22+38 использований), схлопывание зашумило бы тулбары. Это честный минимум, а не лишний вариант.
- **Размер через `compact: boolean`, не глобальный `data-density`:** правильный размер (28-32px), композируется с пользовательской плотностью, не смешивает оси.
- **Leaf полностью без className**, но с типизированными выходами (`grow`/`fill`/`mono`/`ColorInput`) и structural-родителями (`Stack`/`Inline`/`FormField`) для всех легитимных нужд, найденных ревью. `unstyled` Button — единственный escape для «вида».
- **tailwind-merge — вторичная подстраховка** открытых structural-поверхностей, не центр решения.
- **tsc НЕ исчерпывающий детектор:** object-spread (`<Button {...cond}>`) и обёртки-реэкспорты проходят молча → план обязан добавлять grep-шаги (`\{\.\.\.` рядом с kit-контролами) при удалении любого пропа.
- **Совместимость с base-ui:** закрытие касается ВНЕШНЕГО API kit-обёртки; внутренняя композиция base-ui-частей (Select trigger, Checkbox root) не затрагивается (проверено: внешний className мёржится только в trigger/root, внутренние части — на локальных литералах).
- **Объём ~106 файлов** принят сознательно ради строгости; каждая фаза зелёная независимо.
