# Дедупликация `name` в формах через Base UI (итерация 2)

**Дата:** 2026-06-22
**Статус:** дизайн одобрен, готов к написанию плана
**Слой:** foundation (kit `src/components/ui/*`)
**Предшественник:** итерация 1 — [2026-06-22-form-type-safety-design.md](2026-06-22-form-type-safety-design.md) (`createTypedForm`, required-enforcement)

---

## 1. Проблема

`name` пишется дважды: на обёртке `<Field>` (= Base UI `Field.Root`, маршрут ошибок) и на самом контроле (`<TextInput name>`/`<Select name>` — FormData-ключ). Два места руками; рассинхрон ловится типами (итерация 1 связала оба с `keyof T`), но дубль остаётся. Цель: писать `name` **один раз**.

## 2. Что даёт Base UI (исследование @base-ui/react 1.4.1, стабильный)

Доказательно по исходникам:

- **Дедуп решён нативно и однородно.** Строка `const name = fieldName ?? nameProp` (наследование `name` из контекста `Field.Root`) стоит в `Field.Control` ([field/control/FieldControl.js:60](../../../node_modules/@base-ui/react/field/control/FieldControl.js)) **и в корне каждого композитного контрола**: Select (`select/root/SelectRoot.js:91`), Checkbox (`checkbox/root/CheckboxRoot.js:93`), Switch, NumberField, RadioGroup, Combobox, Slider. Композитные контролы **сами рисуют hidden `<input>`** с этим именем; multi-value размножают N hidden-инпутов с одним `name` (нативная FormData-семантика).
- **`Form.errors` матчит строго по `name` на `Field.Root`** (`field/root/FieldRoot.js:71`; `form/Form.d.ts:36-41`).
- **`<Input>` = `Field.Control`** ([input/Input.js](../../../node_modules/@base-ui/react/input/Input.js) рендерит `<Field.Control {...props}/>`), и `useFieldRootContext(optional=true)` по умолчанию **не кидает** вне `Field.Root` (`internals/field-root-context/FieldRootContext.js:55-58`) → Field.Control **standalone-безопасен**.
- **`render`-проп безопасен для закрытых-className контролов:** `mergeProps` **конкатенирует** className (`theirs + ours`, `merge-props/mergeProps.js:217-226`), объединяет ref'ы, цепочкой вызывает оба event-handler'а. Фикс-классы leaf не затираются.
- **Латентный баг.** `data-[invalid]:border-(--color-danger)` в `text-input.tsx:28`/`textarea.tsx:32` **никогда не срабатывает** — `data-invalid` эмитят только Base UI-части. Сырой `<input>` его не получает → красная рамка на ошибке **сейчас не появляется**.

## 3. Выбор подхода

**A (Base-UI-native) — выбран.** Текстовые контролы → через `Field.Control`; композитные — просто снять `name`; кастом/hidden — остаются на `f()`.

**B (свой React-context) — отвергнут.** Переизобрёл бы `fieldName ?? nameProp` И не дал бы validity/a11y-проводку (оставив мёртвую рамку и aria-разрывы). Это ровно то дублирование, которого требовалось избежать.

---

## 4. Дизайн

### 4.1. Механизм: `name` только на `Field.Root`

После итерации 2 `name` задаётся один раз — типизированным `<Field name="…">` (из `createTypedForm`). Наследование:

| Тип контрола | Как получает `name` | Что меняем |
| --- | --- | --- |
| Текстовые (`TextInput`, `Textarea`, `ColorInput`) | через `Field.Control` (`fieldName ?? nameProp`) | перевести leaf на `Field.Control` |
| Композитные (`Select`, `Checkbox`) | уже читают из `Field.Root` | снять явный `name` внутри `Field` |
| Кастом/hidden (AST-редактор, `idempotency`, `blocks`, `lecture_id`) | не Base UI-контролы | оставить явный `f("…")` |

### 4.2. Изменения в kit

- **`TextInput` / `ColorInput`** — внутри рендерят `Field.Control` вместо сырого `<input>`. Фикс-классы (`SHELL_BASE`/`FOCUS_RING_INPUT`/…) передаются как `className` Control'а (конкатенация безопасна); `type` остаётся в leaf (`ColorInput` — `type="color"`); кастомный `grow` по-прежнему влияет только на className, вниз не уходит; `ref` форвардится. Публичный `TextInputProps` (с закрытым className, G8) **не меняется**.
- **`Textarea`** — `Field.Control render={<textarea className={…} {...rest}/>}` (render-проп, т.к. Control по умолчанию `<input>`).
- **`Select` / `Checkbox`** — обёртки **не трогаем вообще**: проп `name` у них **уже опционален** (`select.tsx:16`, `checkbox.tsx:9` — `name?: string`), а сами они Base UI-компоненты и читают `name` из `Field.Root`. Меняются только call-site'ы (перестаём передавать `name` внутри `<Field>`; standalone — передаём явно).
- **`FormField` / типизированный `Field`** — **без структурных изменений** (рендерят `Field.Root` + children). Required-enforcement итерации 1 сохраняется (`required` — проп на `Field`).

### 4.3. Активируемая validity/a11y-проводка (побочный эффект = фикс)

Перевод текстовых контролов на `Field.Control` оживляет:
- **`data-invalid` рамку** (чинит §2-баг): серверная ошибка ставит `invalid` на `Field.Root` (по `name` из `<Form errors>`) → теперь долетает до инпута.
- `aria-invalid`, `aria-describedby` (связь инпута с `Field.Error`/`Field.Description`), focus-on-error при сабмите, `clearErrors` при вводе.

**Совместимость с серверной валидацией (инвариант проекта):** мы НЕ задаём `validate` на `Field.Root` → клиентская валидация Base UI инертна, сабмит не блокируется, server action отрабатывает как раньше. Единственное новое живое поведение — `clearErrors(name)` при правке поля (гасит показ ошибки до следующего сабмита). Это улучшение UX, не регресс. `Field.Error` без `match` сам берёт текст из `Form.errors` по `name` (приоритет form-error) — уже используется.

### 4.4. `f()` — сжимается, но остаётся

Нужен только для: hidden-инпутов (`idempotency`, `blocks`-JSON, `lecture_id`), кастом-виджетов (AST-редактор), standalone-контролов вне `Field`. С обычных контролов внутри `<Field>` `name` снимается. Идея «богатого `field()`-объекта под спред» (рассматривалась в итерации 1) **отпадает**: Base UI сам инжектит id/aria/value/ref — инжектить нечего.

### 4.5. `FormFeedback` — не трогаем

Форма-уровневый слой (`_form`/`forbidden`/generic из `ActionResult`), которого `Field.Error` (поле-уровень) не покрывает. Не дубль Base UI.

---

## 5. Радиус и миграция

- **Kit-изменение глобально:** как только `TextInput`/`Textarea`/`ColorInput` становятся `Field.Control`-based, validity-проводка активируется во **всех** формах сразу (не opt-in). → **обязательна визуальная приёмка error-состояний** (красная рамка теперь появляется) в браузере на паре форм.
- **Снятие `name` с контролов — косметика, opt-in пер-форма** (старый явный `name` на контроле совпадёт с наследуемым — не ломается).
- **Поставка итерации 2:**
  1. Kit-контролы на `Field.Control` (+ тесты).
  2. 2 образца (`banners`, `comments`) — снять `name` с контролов внутри `<Field>`.
  3. Раздел в `docs/frontend-conventions.md` (name один раз на `Field`; `f()` — только hidden/кастом/standalone).
  4. Браузер-приёмка error-состояний.
  Остальные ~37 форм — opt-in снятие `name` пер-слайс.

## 6. Тестирование

- **Kit (vitest + jsdom):** `TextInput`/`Textarea`/`ColorInput` рендерят `<input>`/`<textarea>` через `Field.Control`; **standalone** (вне `Field.Root`) — работают с явным `name`, без падения; **внутри `Field.Root name="x"`** — инпут получает `name="x"` без явного пропа; **`data-invalid`** появляется, когда `<Form errors>` содержит ключ поля (оживший баг). `Select`/`Checkbox` — `name` опционален, наследуется внутри `Field`.
- **Существующие** form/kit-тесты остаются зелёными (или обновляются под наследование name).
- Перед PR: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; **плюс ручная браузер-приёмка** error-рамки/aria (subagent кликать не может).

## 7. Вне охвата

- Клиентская Zod-валидация (остаётся серверной; `Field.Root.validate` не задаём).
- `Field.Validity`/`match`-условные клиентские сообщения.
- Богатый `field()`-спред (Base UI инжектит сам).
- `multiple` Select/Combobox (kit-Select сейчас одиночный; multi — отдельной задачей при появлении).

## 8. Ссылки

- Итерация 1: [2026-06-22-form-type-safety-design.md](2026-06-22-form-type-safety-design.md); план [../plans/2026-06-22-form-type-safety.md](../plans/2026-06-22-form-type-safety.md).
- Base UI evidence: `FieldControl.js:60`, `Input.js`, `FieldRootContext.js:55-58`, `mergeProps.js:217-226`, `SelectRoot.js:91/400-414`, `CheckboxRoot.js:93`, `FieldRoot.js:71`.
- Kit: [text-input.tsx](../../../src/components/ui/text-input.tsx), [textarea.tsx](../../../src/components/ui/textarea.tsx), [select.tsx](../../../src/components/ui/select.tsx), [form-field.tsx](../../../src/components/ui/form-field.tsx), [typed-form.ts](../../../src/components/ui/typed-form.ts).
