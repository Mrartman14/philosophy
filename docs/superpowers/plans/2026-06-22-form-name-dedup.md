# Form `name` Dedup via Base UI (итерация 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Писать `name` в формах один раз (на `<Field>`/`Field.Root`), переведя текстовые kit-контролы на Base UI `Field.Control` — контролы наследуют `name` из контекста, а заодно оживает native validity/a11y-проводка.

**Architecture:** Base UI `Field.Control` берёт `name = fieldName ?? nameProp` из `Field.Root`. Текстовые leaf-контролы (`TextInput`/`Textarea`/`ColorInput`) внутри рендерят `Field.Control` вместо сырого `<input>`/`<textarea>` (фикс-классы сохраняются — `mergeProps` конкатенирует className; standalone-безопасно — optional context). Композитные (`Select`/`Checkbox`) уже наследуют — только снимаем `name` в call-site'ах. Кастом/hidden остаются на `f()`.

**Tech Stack:** Next 16 / React 19 / TypeScript 6 / @base-ui/react 1.4.1 / Vitest + jsdom + @testing-library/react / pnpm.

## Global Constraints

- **Пакетный менеджер — только `pnpm`.**
- **Общение на русском; kebab-case в `src/`.**
- **Git:** не `git stash`/`reset`/`checkout .`/`clean`; не `git add -A`/`.` — только свои файлы по имени; коммит `git commit --only <те же файлы>` (параллельные агенты). Новые файлы — `git add <свои>` ПЕРЕД `--only`. Не пушить.
- **Серверная валидация — инвариант:** `Field.Root.validate` НЕ задавать (клиентская валидация Base UI остаётся инертной, сабмит не блокируется). Активируется только `clearErrors`-on-change + показ `data-invalid`/aria от серверных ошибок (через `<Form errors>` по `name`).
- **НЕ ломать:** `FormField`/`createTypedForm`/required-enforcement итерации 1 (`<Field name=… required>` остаётся). `eslint.config.mjs` не трогать. Публичные типы контролов (закрытый `className`, G8) не менять.
- **Базовый импорт:** `import { Field } from "@base-ui/react/field"` (G7 разрешает прямой `@base-ui` внутри `src/components/ui/**`).
- **Контингенсии (если tsc/рантайм укажет):** (а) ref-вариантность — `Field.Control` типизирует ref как `HTMLElement`; если tsc ругается на `Ref<HTMLInputElement>`/`Ref<HTMLTextAreaElement>`, привести `ref={ref as React.Ref<HTMLElement>}` (реальный DOM — `<input>`/`<textarea>`, сужение безопасно). (б) точный атрибут invalid — ассертить тот, что реально появляется на инпуте при `<Form errors>` (`data-invalid` ИЛИ `aria-invalid`); проверить в отрендеренном выводе.
- **Зелёные перед PR:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` + **ручная браузер-приёмка** error-состояний (subagent кликать не может).
- **Субагенты** (если запускаются) — на модели **opus**.
- **Вне охвата:** клиентская Zod-валидация, `Field.Validity`/`match`, богатый `field()`-спред, `multiple` Select.

---

## File Structure

| Файл | Ответственность | Действие |
| --- | --- | --- |
| `src/components/ui/text-input.tsx` | leaf-инпут → на `Field.Control` | Modify |
| `src/components/ui/color-input.tsx` | leaf color-инпут → на `Field.Control` (`type="color"`) | Modify |
| `src/components/ui/textarea.tsx` | leaf textarea → `Field.Control render={<textarea/>}` | Modify |
| `src/components/ui/text-input.test.tsx` | + тест наследования name + data-invalid (standalone-тесты сохраняются) | Modify |
| `src/components/ui/textarea.test.tsx` | + тест наследования name | Modify |
| `src/components/ui/color-input.test.tsx` | standalone сохраняется; + наследование name | Modify |
| `src/features/banners/ui/banner-create-form.tsx` | снять `name` с контролов внутри `<Field>` | Modify |
| `src/features/comments/ui/comment-create-form.tsx` | снять `name` со `Select` (type) | Modify |
| `docs/frontend-conventions.md` | §3.4 — name один раз на `Field`; `f()` только hidden/кастом/standalone | Modify |

---

## Task 1: Перевести текстовые kit-контролы на `Field.Control`

Глобальное kit-изменение: после него ВСЕ формы получают наследование name + активацию validity-проводки (старый явный `name` на контроле продолжает работать как `nameProp`-фолбэк → backward-compat).

**Files:**
- Modify: `src/components/ui/text-input.tsx`, `src/components/ui/color-input.tsx`, `src/components/ui/textarea.tsx`
- Modify (tests): `src/components/ui/text-input.test.tsx`, `src/components/ui/textarea.test.tsx`, `src/components/ui/color-input.test.tsx`

**Interfaces:**
- Consumes: `Field` из `@base-ui/react/field` (`Field.Control`); `cn`/`SHELL_BASE`/`FOCUS_RING_INPUT` из `./cn`.
- Produces: `TextInput`/`Textarea`/`ColorInput` рендерят через `Field.Control` — внутри `Field.Root` наследуют `name` (без явного пропа); standalone работают с явным `name`. Публичные `TextInputProps`/`TextareaProps`/`ColorInputProps` не меняются.

- [ ] **Step 1: Написать падающий тест наследования name** (`src/components/ui/text-input.test.tsx`)

Добавить в конец `describe("TextInput", …)` (импорт `FormField` сверху файла: `import { FormField } from "./form-field";`):

```tsx
it("внутри FormField наследует name из Field.Root без явного пропа", () => {
  render(
    <FormField name="title" label="Заголовок">
      <TextInput />
    </FormField>,
  );
  const input = screen.getByLabelText<HTMLInputElement>("Заголовок");
  expect(input).toHaveAttribute("name", "title");
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm vitest run src/components/ui/text-input.test.tsx`
Expected: FAIL — сырой `<input>` не читает Field-контекст, `name` отсутствует (получит `null`/нет атрибута).

- [ ] **Step 3: Перевести TextInput на Field.Control** (`src/components/ui/text-input.tsx`) — полный файл

```tsx
// src/components/ui/text-input.tsx
import { Field } from "@base-ui/react/field";
import { forwardRef, type InputHTMLAttributes } from "react";

import { cn, FOCUS_RING_INPUT, SHELL_BASE } from "./cn";

/**
 * Leaf-контрол: className НЕ принимается (вид инпута фиксирован kit'ом).
 * Рендерит Base UI `Field.Control` → внутри `Field.Root` наследует `name`/`id`/
 * aria/validity-проводку из контекста; standalone (вне Field.Root) — обычный
 * `<input>` с явным `name` (optional-контекст не кидает). Растяжение в ряду —
 * типизированным `grow`. Любой позиционный/размерный класс задаёт structural-родитель.
 */
export type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  /** `true` → `flex-1 min-w-0`: тянуть инпут по свободной ширине flex-ряда. */
  grow?: boolean;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ grow, type = "text", ...rest }, ref) {
    return (
      <Field.Control
        ref={ref}
        type={type}
        className={cn(
          SHELL_BASE,
          "h-(--size-control-h-md) w-full px-(--space-control-pad-x) text-sm",
          "placeholder:text-(--color-fg-muted)",
          FOCUS_RING_INPUT,
          "disabled:opacity-50 data-[invalid]:border-(--color-danger)",
          grow && "min-w-0 flex-1",
        )}
        {...rest}
      />
    );
  },
);
```

- [ ] **Step 4: Запустить тесты TextInput — наследование + standalone**

Run: `pnpm vitest run src/components/ui/text-input.test.tsx`
Expected: PASS — новый тест зелёный; существующие standalone-тесты (grow/type/name/defaultValue) тоже зелёные (className-конкатенация и явный name сохраняются). Если ref-tsc-ошибка — применить контингенсию (а) из Global Constraints.

- [ ] **Step 5: Перевести ColorInput на Field.Control** (`src/components/ui/color-input.tsx`) — полный файл

```tsx
// src/components/ui/color-input.tsx
import { Field } from "@base-ui/react/field";
import { forwardRef, type InputHTMLAttributes } from "react";

import { cn, FOCUS_RING_INPUT, SHELL_BASE } from "./cn";

// className закрыт; type фиксирован "color"; геометрия — внутренняя забота примитива.
// Рендерит Field.Control → внутри Field.Root наследует name; standalone — обычный input.
export type ColorInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type">;

/** Контрол выбора цвета (своя геометрия color-picker). leaf — без className. */
export const ColorInput = forwardRef<HTMLInputElement, ColorInputProps>(
  function ColorInput(props, ref) {
    return (
      <Field.Control
        ref={ref}
        type="color"
        className={cn(SHELL_BASE, "h-(--size-control-h-md) w-16 cursor-pointer p-1", FOCUS_RING_INPUT, "disabled:opacity-50")}
        {...props}
      />
    );
  },
);
```

- [ ] **Step 6: Перевести Textarea на Field.Control (render-проп)** (`src/components/ui/textarea.tsx`) — полный файл

```tsx
// src/components/ui/textarea.tsx
import { Field } from "@base-ui/react/field";
import { forwardRef, type TextareaHTMLAttributes } from "react";

import { cn, FOCUS_RING_INPUT, SHELL_BASE } from "./cn";

/**
 * Leaf-контрол: className НЕ принимается (вид textarea фиксирован kit'ом).
 * Рендерит `Field.Control render={<textarea/>}` → внутри `Field.Root` наследует
 * `name`/aria/validity; standalone — обычная `<textarea>`. Растяжение по высоте —
 * `grow`; моноширинный режим для JSON/кода — `mono`.
 */
export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
  /** `true` → `min-h-0 flex-1`: тянуть textarea по высоте flex-колонки. */
  grow?: boolean;
  /** `true` → `font-mono text-xs`: моноширинный мелкий режим для JSON/кода. */
  mono?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ grow, mono, rows = 4, ...rest }, ref) {
    return (
      <Field.Control
        render={<textarea />}
        ref={ref}
        rows={rows}
        className={cn(
          SHELL_BASE,
          "block w-full px-(--space-control-pad-x) py-(--space-control-pad-y)",
          mono ? "font-mono text-xs" : "text-sm",
          "placeholder:text-(--color-fg-muted)",
          FOCUS_RING_INPUT,
          "disabled:opacity-50 data-[invalid]:border-(--color-danger)",
          grow && "min-h-0 flex-1",
        )}
        {...rest}
      />
    );
  },
);
```

- [ ] **Step 7: Добавить тесты наследования для Textarea и ColorInput**

В `src/components/ui/textarea.test.tsx` (импорт `import { FormField } from "./form-field";`):

```tsx
it("внутри FormField наследует name из Field.Root без явного пропа", () => {
  render(
    <FormField name="bio" label="Био">
      <Textarea />
    </FormField>,
  );
  expect(screen.getByLabelText("Био")).toHaveAttribute("name", "bio");
});
```

В `src/components/ui/color-input.test.tsx` (импорт `FormField`):

```tsx
it("внутри FormField наследует name из Field.Root без явного пропа", () => {
  render(
    <FormField name="background_color" label="Цвет">
      <ColorInput />
    </FormField>,
  );
  expect(screen.getByLabelText("Цвет")).toHaveAttribute("name", "background_color");
});
```

- [ ] **Step 8: Добавить тест активации `data-invalid` от серверной ошибки** (`src/components/ui/text-input.test.tsx`)

Импорт сверху: `import { Form } from "./form";`. Тест:

```tsx
it("получает invalid-маркер, когда <Form errors> содержит ключ поля (оживший data-invalid)", () => {
  render(
    <Form errors={{ title: "Обязательное поле" }}>
      <FormField name="title" label="Заголовок">
        <TextInput />
      </FormField>
    </Form>,
  );
  const input = screen.getByLabelText("Заголовок");
  // Контингенсия (б): ассертить реальный маркер. По Base UI на инпуте появляется
  // data-invalid (драйвит data-[invalid]:border). Если в выводе он называется
  // иначе (aria-invalid) — ассертить его.
  expect(input).toHaveAttribute("data-invalid");
});
```

- [ ] **Step 9: Запустить весь kit-набор тестов**

Run: `pnpm vitest run src/components/ui`
Expected: PASS. Если какой-то существующий тест покраснел из-за новых атрибутов (aria-describedby/aria-invalid/data-*) — обновить ассерт под новое (корректное) поведение, НЕ откатывать активацию.

- [ ] **Step 10: Lint + typecheck свои файлы**

Run: `pnpm exec eslint src/components/ui/text-input.tsx src/components/ui/color-input.tsx src/components/ui/textarea.tsx src/components/ui/text-input.test.tsx src/components/ui/textarea.test.tsx src/components/ui/color-input.test.tsx && pnpm typecheck`
Expected: eslint clean; `pnpm typecheck` без ошибок в этих файлах (применить контингенсию (а) при ref-ошибке).

- [ ] **Step 11: Commit**

```bash
git add src/components/ui/text-input.tsx src/components/ui/color-input.tsx src/components/ui/textarea.tsx src/components/ui/text-input.test.tsx src/components/ui/textarea.test.tsx src/components/ui/color-input.test.tsx
git commit --only src/components/ui/text-input.tsx src/components/ui/color-input.tsx src/components/ui/textarea.tsx src/components/ui/text-input.test.tsx src/components/ui/textarea.test.tsx src/components/ui/color-input.test.tsx -m "feat(ui): текстовые контролы на Field.Control — наследование name + оживший data-invalid

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Снять `name` с контролов в образцах (banners + comments)

Дедуп в call-site'ах: контролы внутри `<Field>` больше не несут `name` (наследуют). `f()` остаётся только на hidden-инпутах/кастом-виджетах.

**Files:**
- Modify: `src/features/banners/ui/banner-create-form.tsx`, `src/features/comments/ui/comment-create-form.tsx`

**Interfaces:**
- Consumes: kit-контролы на `Field.Control` (Task 1); `createTypedForm` (итерация 1).

- [ ] **Step 1: banners — снять `name` с контролов внутри `<Field>`** (`src/features/banners/ui/banner-create-form.tsx`)

Изменить три места (hidden `dismissible` через `f("dismissible")` — НЕ трогать, он вне `<Field>`):

```tsx
// было: <ColorInput name={f("background_color")} defaultValue="#336699" required aria-label={t("fieldColor")} />
// стало:
<ColorInput defaultValue="#336699" required aria-label={t("fieldColor")} />
```
```tsx
// было: <Select name={f("target_audience")} defaultValue="all" options={audienceOptions(t)} aria-label={t("fieldAudienceAriaLabel")} />
// стало:
<Select defaultValue="all" options={audienceOptions(t)} aria-label={t("fieldAudienceAriaLabel")} />
```
```tsx
// было: <TextInput name={f("start_at")} type="datetime-local" required />
// стало:
<TextInput type="datetime-local" required />
```
```tsx
// было: <TextInput name={f("end_at")} type="datetime-local" />
// стало:
<TextInput type="datetime-local" />
```
```tsx
// было: <TextInput name={f("event_id")} placeholder={t("eventIdPlaceholder")} />
// стало:
<TextInput placeholder={t("eventIdPlaceholder")} />
```

После правок `f` используется только в hidden `<input type="hidden" name={f("dismissible")} …>`. Импорт `f` из `createTypedForm` остаётся (для dismissible). Проверить, что `f` всё ещё используется (иначе eslint no-unused).

- [ ] **Step 2: comments — снять `name` со Select** (`src/features/comments/ui/comment-create-form.tsx`)

```tsx
// было: <Select name={f("type")} options={options} defaultValue={rootTypes[0] ?? ""} aria-label={t("createTypeAriaLabel")} />
// стало:
<Select options={options} defaultValue={rootTypes[0] ?? ""} aria-label={t("createTypeAriaLabel")} />
```

`f("blocks")` (hidden-инпут вне `<Field name="blocks">`) и raw `name="lecture_id"` — НЕ трогать. `f` остаётся используемым (blocks).

- [ ] **Step 3: Typecheck + lint + тесты слайсов**

Run: `pnpm typecheck && pnpm exec eslint src/features/banners/ui/banner-create-form.tsx src/features/comments/ui/comment-create-form.tsx && pnpm vitest run src/features/banners src/features/comments`
Expected: всё зелёное. Типизация `<Field name=…>` (iteration 1) сохраняет имя-контракт; контролы валидны без `name`. `f` не должен оказаться unused (banners: dismissible; comments: blocks).

- [ ] **Step 4: Commit**

```bash
git commit --only src/features/banners/ui/banner-create-form.tsx src/features/comments/ui/comment-create-form.tsx -m "feat(forms): снять дублирующий name с контролов в образцах (наследуется из Field)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Конвенции + финальный гейт + manual QA

**Files:**
- Modify: `docs/frontend-conventions.md`

- [ ] **Step 1: Обновить §3.4 — name один раз** (`docs/frontend-conventions.md`)

Заменить пример формы: убрать `name={f("…")}` с контрола (наследуется), оставить `f()` только в комментарии про hidden/кастом. Найти блок (иллюстративный пример из итерации 1) и привести `<TextInput name={f("title")} />` → `<TextInput />`:

```tsx
<Field name="title" label="Заголовок" required>
  <TextInput />
</Field>
```

И в абзаце после примера заменить фразу про вторую точку name на:

```markdown
`name` пишется ОДИН раз — на `<Field>` (= Base UI `Field.Root`); контролы
(`TextInput`/`Textarea`/`ColorInput`/`Select`/`Checkbox`) наследуют его из контекста
(Base UI `fieldName ?? nameProp`). `f("…")` нужен только для hidden-инпутов
(`idempotency`, JSON-острова), кастом-виджетов (AST-редактор) и standalone-контролов
вне `<Field>`. Перевод текстовых контролов на `Field.Control` попутно включает
native-проводку: `data-invalid` рамка, `aria-invalid`/`aria-describedby`, focus-on-error,
`clearErrors` при вводе (серверная валидация при этом не трогается — `Field.Root.validate`
не задаём).
```

- [ ] **Step 2: Финальный полный гейт**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: lint/typecheck/test зелёные. (`build` может падать только на офлайн Google-Fonts в `layout.tsx` — env, не дефект; см. итерацию 1.) Любое падение в своих файлах — фиксить.

- [ ] **Step 3: Commit**

```bash
git commit --only docs/frontend-conventions.md -m "docs(forms): конвенция — name один раз на Field, контролы наследуют (итерация 2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: MANUAL BROWSER QA (не автоматизируется — subagent кликать не может)**

Зафиксировать как PENDING для человека. Прогнать в браузере (`pnpm dev`, :3001) на форме banners create:
- Отправить невалидную форму → серверная ошибка → у текстового поля появляется **красная рамка** (`data-[invalid]:border`) — раньше была мёртвой.
- Поле связано с сообщением об ошибке (`aria-describedby`) и помечено `aria-invalid` (проверить в DevTools/скринридере).
- При вводе в поле с ошибкой — ошибка гаснет (`clearErrors`).
- Standalone-поля (поиск/фильтры, напр. `lecture-search`) работают как раньше.

---

## Self-Review

**Spec coverage** (против `2026-06-22-form-name-dedup-design.md`):
- §4.1 механизм (name только на Field.Root; текст→Control, композит→снять name, кастом→f) — Task 1 (Control) + Task 2 (снятие name) + §4.4 (f сохранён). ✅
- §4.2 kit-изменения (TextInput/ColorInput→Control, Textarea→render-проп, Select/Checkbox не трогаем, FormField не трогаем) — Task 1. ✅
- §4.3 активируемая проводка + совместимость с серверной валидацией (validate не задаём) — Task 1 (data-invalid тест) + Global Constraints + §QA. ✅
- §4.4 f сжимается — Task 2 (f только на hidden) + Task 3 (доки). ✅
- §5 радиус/миграция (kit глобально, снятие name opt-in, 2 образца, конвенции, браузер-приёмка) — Tasks 1-3 + Step QA. ✅
- §6 тесты (Control-рендер, standalone, наследование name, data-invalid) — Task 1 Steps 1-9. ✅
- §7 вне охвата — Global Constraints. ✅

**Placeholder scan:** нет TBD/«handle edge cases». Полный код контролов в каждом шаге. Две контингенсии (ref-вариантность, точный invalid-атрибут) — явные, с конкретным действием, не плейсхолдеры. ✅

**Type consistency:** `Field.Control`, `TextInputProps`/`TextareaProps`/`ColorInputProps` (не меняются), `f`/`Field` из `createTypedForm` (итерация 1) — согласованы. Снятие `name` не трогает типизированный `<Field name=…>`-контракт. ✅
