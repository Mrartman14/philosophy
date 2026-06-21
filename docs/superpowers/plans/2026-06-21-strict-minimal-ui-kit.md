# Strict Minimal UI-kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить UI-kit в строгий минимальный набор: размер только через плотность, 3 семантических тона, layout в `Stack`, className закрыт на leaf-контролах — чтобы kit нельзя было применить неправильно.

**Architecture:** Закрытые intentful leaf-контролы (пропы, ноль className-для-вида) + открытые structural/compound примитивы (композиция). Размер контролов — один density-aware токен, скоупится через `data-density` на контейнере. Каждая фаза — отдельный шиппабельный срез с ре-миграцией своих потребителей.

**Tech Stack:** Next.js (RSC + server actions), React 19, TypeScript (strictTypeChecked), `@base-ui/react` ^1.4.1, Tailwind v4 (CSS-токены), Vitest + Testing Library, pnpm.

## Global Constraints

- Менеджер пакетов — **pnpm** (НЕ npm). Гейт: `pnpm lint && pnpm test && pnpm build` (учитывать pre-existing долг `semantic-map/*` + `canvas/{editor,editor-inspector,canvas-detail}` + `banners/api.ts` — НЕ наш, не блокирует наши задачи).
- Запрет деструктивных git (`stash`/`reset`/`checkout .`/`clean`/`restore`) и `git add -A`/`.`/`-u`. Коммитить ТОЛЬКО свои файлы ЯВНЫМ pathspec: `git commit <files...>` (не bare `git commit` после `git add` — общий индекс с параллельными агентами).
- В репозитории работают параллельные агенты: не трогать чужие файлы; передавать это субагентам.
- Именование файлов — kebab-case; комментарии на русском.
- Скоуп размера контролов — ОДИН токен `--size-control-h-md` (density-aware: comfortable 2.5rem / compact 2.25rem). Stack-gap — токен `--space-stack` (1rem / 0.75rem). НЕ менять токен-генератор (`src/styles/tokens/`), только потребление в компонентах.
- Плотность — 2 уровня (`comfortable` default, `compact`), скоупится `data-density="compact"` на контейнере (каскад токенов уже это поддерживает).
- Граница: **leaf-контролы ЗАКРЫТЫ** (Button, IconButton, Select, TextInput, Textarea, Checkbox, Label) — без className-для-вида; **structural ОТКРЫТЫ** (Stack, Toolbar, Popover, NavigationMenu, Dialog, Table) — className легитимен.
- Guardrail 7 (ноль нативных тегов/прямых base-ui вне kit) — НЕ ломать.

---

## Phase 1 — Размер: одна ось (плотность), убрать per-component `size`

### Task 1: `IconButton` — убрать `size`, привязать к токену высоты контрола

**Files:**
- Modify: `src/components/ui/icon-button.tsx`
- Test: `src/components/ui/icon-button.test.tsx`
- Modify (re-migration): `src/components/attachments/attachments-panel.tsx`, `src/features/notifications/ui/notification-bell.tsx`

**Interfaces:**
- Produces: `IconButton` БЕЗ `size`-пропа; геометрия = `h-(--size-control-h-md) w-(--size-control-h-md)` (квадрат высотой контрола, density-aware). `IconButtonSize` тип удалён.

- [ ] **Step 1: Обновить тест — density-aware квадрат, нет `size`**

Заменить размер-тесты в `src/components/ui/icon-button.test.tsx` на:
```tsx
it("renders a square control-height button (token-based, no size prop)", () => {
  render(<IconButton aria-label="x">i</IconButton>);
  const btn = screen.getByRole("button", { name: "x" });
  expect(btn).toHaveClass("h-(--size-control-h-md)");
  expect(btn).toHaveClass("w-(--size-control-h-md)");
});
```
Удалить любой тест, ссылающийся на `size="sm"`/`h-7 w-7`.

- [ ] **Step 2: Прогнать — падает**

Run: `pnpm vitest run src/components/ui/icon-button.test.tsx`
Expected: FAIL (`size` ещё есть / класс `h-9 w-9`).

- [ ] **Step 3: Реализовать**

`src/components/ui/icon-button.tsx` — убрать `IconButtonSize`, `sizeClasses`, проп `size`; геометрия токеном:
```tsx
// src/components/ui/icon-button.tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";

import type { ButtonVariant } from "./button";
import { cn, FOCUS_RING_CONTROL } from "./cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Обязательный label для скринридеров. */
  "aria-label": string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-(--color-fg) text-(--color-surface) hover:opacity-90 disabled:opacity-50",
  secondary:
    "border border-(--color-border) hover:bg-(--color-surface-subtle) disabled:opacity-50",
  ghost: "hover:bg-(--color-surface-subtle) disabled:opacity-50",
  danger: "text-(--color-danger) hover:bg-(--color-danger-bg) disabled:opacity-50",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ variant = "ghost", className, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex h-(--size-control-h-md) w-(--size-control-h-md) items-center justify-center rounded transition",
          FOCUS_RING_CONTROL,
          variantClasses[variant],
          className,
        )}
        {...rest}
      />
    );
  },
);
```
> Примечание: `className` пока остаётся (закрывается в Phase 4 Task 7); `variant` пока остаётся (тон-консолидация — Phase 3 Task 5). Эта задача — ТОЛЬКО размер.

- [ ] **Step 4: Прогнать — проходит**

Run: `pnpm vitest run src/components/ui/icon-button.test.tsx`
Expected: PASS.

- [ ] **Step 5: Ре-миграция 3 потребителей `size`**

`attachments-panel.tsx` (2 стрелки `size="sm"`) и `notification-bell.tsx` (`size="sm"`): убрать `size="sm"`. Контролы станут высотой контрола (density-aware). Для компактности этих регионов — обернуть РЕГИОН в `data-density="compact"`: для стрелок — ближайшую обёртку строки списка вложений; для колокола — оставить высоту контрола (в шапке нормально) ЛИБО, если визуально велик, обернуть header-кластер в `data-density="compact"`. Имплементер выбирает per-context и фиксирует в отчёте.
Run: `pnpm exec eslint <файлы>` clean; `pnpm vitest run src/components/attachments src/features/notifications` green.

- [ ] **Step 6: Коммит**
```bash
git commit src/components/ui/icon-button.tsx src/components/ui/icon-button.test.tsx src/components/attachments/attachments-panel.tsx src/features/notifications/ui/notification-bell.tsx -m "refactor(ui): IconButton без size — размер через токен/плотность"
```

---

### Task 2: `Button` — убрать `size`, один канонический размер

**Files:**
- Modify: `src/components/ui/button.tsx`, `src/components/ui/button.test.tsx`
- Modify (re-migration): все потребители с `<Button size=…>` (найти grep'ом)

**Interfaces:**
- Produces: `Button` БЕЗ `size`-пропа; один размер `h-(--size-control-h-md) px-4 text-sm`. `ButtonSize` тип удалён. `variant` и `unstyled` пока остаются.

- [ ] **Step 1: Найти потребителей size**

Run: `grep -rn "<Button[^>]*size=" src --include="*.tsx" | grep -v "\.test\."` и многострочные: `grep -rEln "size=\"(sm|lg|md)\"" $(grep -rln "<Button" src --include=*.tsx | grep -v components/ui)`. Выписать список.

- [ ] **Step 2: Обновить тест**

В `button.test.tsx`: тест на единственный размер — `<Button>` имеет `h-(--size-control-h-md)` и НЕ имеет `h-(--size-control-h-sm)`/`h-(--size-control-h-lg)`; удалить size-тесты. (unstyled-тест и className-merge оставить.)

- [ ] **Step 3: Прогнать — падает.** Run: `pnpm vitest run src/components/ui/button.test.tsx` → FAIL.

- [ ] **Step 4: Реализовать**

`button.tsx` — убрать `ButtonSize`, `sizeClasses`, проп `size`; один размер инлайн:
```tsx
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  unstyled?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", unstyled = false, className, type = "button", ...rest },
  ref,
) {
  if (unstyled) {
    return <button ref={ref} type={type} className={cn(FOCUS_RING_CONTROL, className)} {...rest} />;
  }
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-(--size-control-h-md) items-center justify-center gap-2 rounded px-4 text-sm font-medium transition",
        FOCUS_RING_CONTROL,
        variantClasses[variant],
        className,
      )}
      {...rest}
    />
  );
});
```
(`variant` остаётся до Phase 3; `unstyled`/`className` до Phase 4.)

- [ ] **Step 5: Прогнать — проходит.** Run: `pnpm vitest run src/components/ui/button.test.tsx` → PASS.

- [ ] **Step 6: Ре-миграция `size=` потребителей**

Для каждого из списка Step 1: удалить `size="sm"|"md"|"lg"`. Кнопки станут одного размера. Если где-то `size="lg"` был визуально важным hero-CTA — всё равно убрать (модель: один размер; крупность не поддерживается). Прогнать тесты затронутых фич.

- [ ] **Step 7: Коммит** (явный pathspec со всеми изменёнными файлами):
```bash
git commit src/components/ui/button.tsx src/components/ui/button.test.tsx <consumer files...> -m "refactor(ui): Button без size — один канонический размер контрола"
```

---

## Phase 2 — `Stack`: единственный layout-примитив

### Task 3: `Stack` primitive

**Files:**
- Create: `src/components/ui/stack.tsx`, `src/components/ui/stack.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: `Stack({ className?, children })` — structural-примитив (className ОТКРЫТ): рендерит `div` с `flex flex-col gap-(--space-stack)` (density-aware вертикальный ритм). className мёржится через `cn` (structural — допускается).

- [ ] **Step 1: Тест**

Контракт-классы Stack тестируем через экспортируемую константу `STACK_CLASS` (lint-clean, без `container`/`.parentElement` — `testing-library/no-container`/`no-node-access` в ui/ это ERROR), а рендер — через `getByRole`. `src/components/ui/stack.test.tsx`:
```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Stack, STACK_CLASS } from "./stack";

afterEach(cleanup);

describe("Stack", () => {
  it("STACK_CLASS is a vertical column with the density-aware stack gap", () => {
    expect(STACK_CLASS).toContain("flex");
    expect(STACK_CLASS).toContain("flex-col");
    expect(STACK_CLASS).toContain("gap-(--space-stack)");
  });

  it("renders its children", () => {
    render(
      <Stack>
        <button type="button">a</button>
        <button type="button">b</button>
      </Stack>,
    );
    expect(screen.getByRole("button", { name: "a" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "b" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Прогнать — падает** (`Cannot resolve ./stack`). Run: `pnpm vitest run src/components/ui/stack.test.tsx`.

- [ ] **Step 3: Реализовать**

`src/components/ui/stack.tsx`:
```tsx
// src/components/ui/stack.tsx
import type { ReactNode } from "react";

import { cn } from "./cn";

/** Класс вертикального ритма (вынесен для тестируемости без node-access). */
export const STACK_CLASS = "flex flex-col gap-(--space-stack)";

export interface StackProps {
  className?: string;
  children: ReactNode;
}

/**
 * Единственный layout-примитив kit: вертикальный ритм с density-aware gap
 * (`--space-stack`). Structural — className ОТКРЫТ (раскладка, не вид контрола).
 * Заменяет россыпь `flex flex-col gap-4` у потребителей форм.
 */
export function Stack({ className, children }: StackProps) {
  return <div className={cn(STACK_CLASS, className)}>{children}</div>;
}
```

- [ ] **Step 4: Экспорт в `index.ts`**: `export { Stack, STACK_CLASS, type StackProps } from "./stack";`

- [ ] **Step 5: Прогнать — проходит.** Run: `pnpm vitest run src/components/ui/stack.test.tsx` → PASS.

- [ ] **Step 6: Коммит**
```bash
git commit src/components/ui/stack.tsx src/components/ui/stack.test.tsx src/components/ui/index.ts -m "feat(ui): Stack — единственный layout-примитив (density-aware вертикальный ритм)"
```

---

## Phase 3 — Tone: 3 семантических тона

### Task 4: `Button` — `tone` (primary/neutral/danger), default neutral

**Files:**
- Modify: `src/components/ui/button.tsx`, `src/components/ui/button.test.tsx`, `src/components/ui/icon-button.tsx` (импортирует `ButtonVariant`)
- Modify (re-migration): все `<Button variant=…>` потребители

**Interfaces:**
- Produces: `ButtonTone = "primary" | "neutral" | "danger"`; проп `tone?: ButtonTone` (default `"neutral"`). `variant`/`ButtonVariant` УДАЛЯЕТСЯ. `toneClasses` — 3 записи.

- [ ] **Step 1: Маппинг и судейство (рецепт ре-миграции)**

Старый→новый: `variant="primary"`→`tone="primary"`; `variant="danger"`→`tone="danger"`; `variant="secondary"`→`tone="neutral"`; `variant="ghost"`→ СУДИТЬ:
- ghost-кнопка как вторичное действие (Отмена, тулбар-действие с фоном) → `tone="neutral"`;
- ghost-кнопка как кликабельная СТРОКА/инлайн без хрома (slash-menu-строки, full-width-row) → `<Button unstyled className=…>` (это её настоящая природа, не тон).
Кнопки без `variant` (был default `primary`) → теперь default `neutral`; если это ГЛАВНОЕ действие (submit формы) → проставить `tone="primary"` ЯВНО.

- [ ] **Step 2: Тест** — в `button.test.tsx`: default → `neutral`-классы; `tone="primary"` → filled; `tone="danger"` → danger-классы. Удалить variant-тесты.

- [ ] **Step 3: Прогнать — падает.**

- [ ] **Step 4: Реализовать** `button.tsx`:
```tsx
export type ButtonTone = "primary" | "neutral" | "danger";

const toneClasses: Record<ButtonTone, string> = {
  primary: "bg-(--color-fg) text-(--color-surface) hover:opacity-90 disabled:opacity-50",
  neutral: "border border-(--color-border) bg-(--color-surface-subtle) hover:bg-(--color-surface) disabled:opacity-50",
  danger: "bg-(--color-danger-solid) text-(--color-danger-on-solid) hover:opacity-90 disabled:opacity-50",
};
// props: { tone = "neutral", unstyled = false, className, type = "button", ...rest }
// в cn: toneClasses[tone] вместо variantClasses[variant]
```
Убрать `ButtonVariant`, `variantClasses`, импорт `variant`.

- [ ] **Step 5: Поправить `icon-button.tsx`** — он импортировал `ButtonVariant`. Временно объявить локальный тип в icon-button (тон IconButton делается в Task 5); чтобы не сломать сборку между задачами, в этой задаче дать icon-button СОБСТВЕННЫЙ `type IconButtonVariant = "primary"|"secondary"|"ghost"|"danger"` локально (Task 5 заменит на tone). Прогнать `pnpm exec tsc` на обоих.

- [ ] **Step 6: Прогнать тест — проходит.**

- [ ] **Step 7: Ре-миграция всех `<Button variant=…>`** по рецепту Step 1 (grep `variant=` среди `<Button`). Прогнать тесты затронутых фич + `pnpm exec eslint`.

- [ ] **Step 8: Коммит** (явный pathspec).
```bash
git commit src/components/ui/button.tsx src/components/ui/button.test.tsx src/components/ui/icon-button.tsx <consumers...> -m "refactor(ui): Button tone (primary/neutral/danger), default neutral; ghost→neutral/unstyled"
```

---

### Task 5: `IconButton` — `tone` (3 тона), default neutral

**Files:** `src/components/ui/icon-button.tsx`, `src/components/ui/icon-button.test.tsx`, re-migration `<IconButton variant=…>`.

**Interfaces:**
- Consumes: `ButtonTone` из `button.tsx` (Task 4). Produces: `IconButton` с `tone?: ButtonTone` (default `"neutral"`), без `variant`. Тихие тона (icon-кнопка не должна конкурировать с filled): `primary` filled, `neutral` — без resting-фона (hover-only), `danger` — текстом.

- [ ] **Step 1: Тест** default neutral (hover-only, без resting bg); `tone="danger"` текстовый. Удалить variant.
- [ ] **Step 2: падает.**
- [ ] **Step 3: Реализовать** — `tone` + `toneClasses` (icon-вариант), убрать локальный `IconButtonVariant` из Task 4:
```tsx
import { type ButtonTone } from "./button";
const toneClasses: Record<ButtonTone, string> = {
  primary: "bg-(--color-fg) text-(--color-surface) hover:opacity-90 disabled:opacity-50",
  neutral: "hover:bg-(--color-surface-subtle) disabled:opacity-50",
  danger: "text-(--color-danger) hover:bg-(--color-danger-bg) disabled:opacity-50",
};
// props: { tone = "neutral", className, type = "button", ...rest }
```
`button.tsx` должен экспортировать `ButtonTone` (Task 4 уже это делает).
- [ ] **Step 4: проходит.**
- [ ] **Step 5: Ре-миграция** `<IconButton variant=…>` → `tone=` (secondary/ghost→neutral, primary/danger→same).
- [ ] **Step 6: Коммит** (явный pathspec).

---

## Phase 4 — Закрыть `className` на leaf-контролах (TS)

> Приём для всех задач фазы: убрать `className` из Props-интерфейса leaf-контрола (TS-ошибка при передаче). Позиционные нужды потребителя → решаются родителем/`Stack`/обёрткой. Для каждого — grep потребителей с className, ре-миграция. Прогон `pnpm exec tsc` ловит все оставшиеся передачи.

### Task 6: `Button` — закрыть className (кроме `unstyled`-escape)

**Files:** `src/components/ui/button.tsx`, `button.test.tsx`, re-migration.

**Interfaces:**
- Produces: дискриминированный union — `unstyled: true` → `className` РАЗРЕШЁН (escape); иначе → `className` отсутствует в типе. Прочие пропы наследуются от `ButtonHTMLAttributes` МИНУС `className`.

- [ ] **Step 1: Реализовать тип-разделение**
```tsx
type ButtonBase = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;
export type ButtonProps =
  | (ButtonBase & { tone?: ButtonTone; unstyled?: false })
  | (ButtonBase & { unstyled: true; className?: string });
```
В реализации: при `unstyled` использовать `className`; иначе className нет (не читать). forwardRef сохранить. (Имплементер аккуратно типизирует деструктуризацию union.)
- [ ] **Step 2: Тест** — `<Button className="x">` БЕЗ unstyled даёт TS-ошибку (проверка через `// @ts-expect-error` в тесте + рантайм-тест, что styled-Button не несёт произвольный класс). `<Button unstyled className="x">` ок.
- [ ] **Step 3: Ре-миграция** — найти `<Button … className=…>` без unstyled; перенести позиционные классы на родителя/обёртку (например кнопка в строке → родитель управляет местом). `go-back.tsx` (underline text-2xl) — это ВИД, не позиция: реши через tone/unstyled (go-back как inline-ссылка → `unstyled` уместен ИЛИ оставить как `Button` без подчёркивания). Имплементер фиксирует каждое решение.
- [ ] **Step 4: `pnpm exec tsc` clean** (ловит все оставшиеся className-передачи) + тесты + lint.
- [ ] **Step 5: Коммит** (явный pathspec).

### Task 7: `IconButton` — закрыть className

**Files:** `icon-button.tsx`, test, re-migration.
- [ ] Убрать `className` из `IconButtonProps` (наследовать `Omit<ButtonHTMLAttributes, "className">` + `tone` + required `aria-label`). Позиционные классы потребителей (`relative`, hover-color на колоколе/поиске) → перенести на обёртку-родителя ИЛИ, если это ВИД (цвет hover) — это нарушение тона: свести к `tone`. Ре-миграция: `notification-bell` (relative, hover-color), `search-input` (иконки), `attachments` (стрелки). `pnpm exec tsc` clean. Коммит явным pathspec.

### Task 8: `Select` — закрыть className

**Files:** `select.tsx`, re-migration.
- [ ] Убрать `className` из `SelectProps`. Узкие фильтры (`w-auto` в annotation-admin-filter) → ширину задаёт родитель (обёртка с `max-w`/`w-40` ИЛИ `Stack`-контекст). Select по умолчанию full-width контейнера (trigger уже `w-full`). Ре-миграция всех `<Select className=…>` (grep многострочный). `pnpm exec tsc` clean. Коммит.

### Task 9: `TextInput`/`Textarea`/`Checkbox`/`Label` — закрыть className

**Files:** `text-input.tsx`, `textarea.tsx`, `checkbox.tsx`, `label.tsx` + ~20 потребителей.
- [ ] Убрать `className` из Props каждого. Позиционные нужды → родитель/Stack. `Label` без className: если где-то label нёс раскладочный класс — перенести на обёртку. Ре-миграция всех потребителей (`pnpm exec tsc` — главный детектор: соберёт ВСЕ оставшиеся передачи className по этим 4 компонентам). Прогнать тесты затронутых фич. Коммит явным pathspec со всеми файлами.
> Это самая крупная по числу файлов задача. Имплементер: сначала `pnpm exec tsc 2>&1 | grep -E "(TextInput|Textarea|Checkbox|Label)"` ПОСЛЕ удаления className из Props — получить полный список call-site'ов, затем чинить по списку.

---

## Phase 5 — Form без layout → `Stack`

### Task 10: `Form` — убрать layout-дефолт, потребители оборачивают поля в `Stack`

**Files:** `src/components/ui/form.tsx`, `form.test.tsx`, re-migration всех `<Form>` потребителей (~44 файла).

**Interfaces:**
- Produces: `Form` БЕЗ дефолтного `flex flex-col gap-4` и БЕЗ layout-className (поведение only: `errors`/`onSubmit`/`action`/`ref`). Раскладку даёт вложенный `Stack` (или structural у потребителя).

- [ ] **Step 1: Реализовать** `form.tsx` — убрать `className ?? "flex flex-col gap-4"`; Form рендерит `<BaseForm>` без навязанного layout. Решение по className: Form — поведенческий, но это `<form>`-элемент; оставить `className`-passthrough БЕЗ дефолта (form может нести `id`/тестовые классы), НО layout даёт Stack. (Не делать Form discriminated — просто убрать дефолтный layout-класс.)
```tsx
// className передаётся как есть (по умолчанию отсутствует), layout НЕ навязывается
<BaseForm ref={ref} errors={errors} className={className} {...rest}>{children}</BaseForm>
```
- [ ] **Step 2: Тест** — `<Form>` без className НЕ несёт `flex flex-col gap-4`.
- [ ] **Step 3: Ре-миграция ~44 потребителей** — каждый `<Form className="flex flex-col gap-4">…</Form>` → `<Form><Stack>…</Stack></Form>` (убрать layout-className с Form, обернуть детей в `Stack`). Горизонтальные/grid-формы (поиск/фильтры) → обернуть в structural с нужной раскладкой (НЕ Stack — он вертикальный; использовать обёртку-div с className, т.к. это structural-зона, ИЛИ оставить className на Form как structural-исключение — поиск-формы не вертикальный стек). Имплементер: вертикальные формы → `Stack`; горизонтальные/grid → обёртка-div с раскладкой (structural, className ок) внутри Form. Зафиксировать классификацию в отчёте.
- [ ] **Step 4: `pnpm exec eslint` + `pnpm vitest run src/features src/app` green.**
- [ ] **Step 5: Коммит** (явный pathspec, батчами по фичам если список огромный — несколько коммитов в рамках задачи ок).

---

## Phase 6 — Enforcement

### Task 11: Guardrail 8 (ESLint) + финальный гейт

**Files:** `eslint.config.mjs`, финальный прогон.

**Interfaces:**
- Consumes: тот же `no-restricted-syntax`-приём, что Guardrail 6/7 (flat-config last-wins → повторить rich/markup + base-ui + native-tag селекторы Guardrail 7 в этом блоке, ЛИБО добавить отдельным блоком с правильным scope; см. Guardrail 7 как образец).

- [ ] **Step 1: Добавить Guardrail 8-селекторы** (в блок Guardrail 7 ИЛИ новый, с учётом flat-config last-wins — повторить уже существующие селекторы блока, который матчит те же файлы):
  - `JSXAttribute[name.name='size']` на kit-контролах — запретить (size убран). Точечный селектор сложен (не отличить kit от чужих `size`); проще: TS уже ловит (size удалён из типов) → этот лента-гард ОПЦИОНАЛЕН, можно пропустить, положившись на TS.
  - `JSXAttribute[name.name='variant']` — аналогично, TS ловит (variant→tone). Опционально.
  - Реально ценный гард: запрет `className` на leaf-контролах — но это надёжнее ловит TS (className убран из Props). 
  → **Решение:** основное enforcement — TS-уровень (Phase 4 убрал className/size/variant из типов). Guardrail 8 ESLint добавляет ТОЛЬКО то, что TS не ловит: запрет сырого `className="…flex flex-col…"`/`grid` на `<Form …>` (layout вне Stack) — селектор по JSXOpeningElement[name.name='Form'] с атрибутом className содержащим flex/grid (через no-restricted-syntax непросто матчить значение; альтернатива — оставить это соглашением + ревью). Имплементер: если точный AST-селектор по значению className недостижим в esquery — задокументировать как соглашение в комментарии Guardrail-блока и положиться на TS + ревью.
- [ ] **Step 2: esquery pre-check** любого нового селектора (как в прошлой инициативе): `node -e 'require("esquery").parse("<selector>"); console.log("ok")'`.
- [ ] **Step 3: `pnpm lint`** — категоризировать: новые Guardrail-8/TS нарушения (должны быть 0 после ре-миграции) vs pre-existing (semantic-map/canvas/banners — не наши).
- [ ] **Step 4: Финальный гейт** `pnpm lint && pnpm test && pnpm build` — наши изменения 0 новых ошибок; pre-existing долг отдельно. `pnpm exec tsc --noEmit` — 0 в наших файлах.
- [ ] **Step 5: Коммит** (явный pathspec).

---

## Self-Review (выполнено при написании)

**Spec coverage:** размер→density+токен (Tasks 1-2), Stack (Task 3), 3 тона (Tasks 4-5), закрытие className на leaf (Tasks 6-9), Form без layout (Task 10), enforcement (Task 11). Граница leaf/structural отражена (leaf закрыты, Stack/Toolbar/etc. открыты). data-density-скоуп — Task 1 Step 5.

**Placeholder scan:** код примитивов приведён полностью; ре-миграции даны рецептом + grep-командой + worked-маппингом (полный дамп ~60 call-site'ов раздул бы план; `pnpm exec tsc` — детерминированный детектор оставшихся передач после удаления пропа из типа). Task 3 Step 1 содержит развёрнутое рассуждение о lint-clean тесте Stack — финальное решение: `STACK_CLASS`-константа + only-children-render тест (зафиксировано в Step 3 кодом).

**Type consistency:** `ButtonTone` (Task 4) потребляется IconButton (Task 5); `STACK_CLASS`/`StackProps` (Task 3) экспортируются; Button discriminated union (Task 6) согласован с `unstyled` из предыдущей инициативы. `--size-control-h-md`/`--space-stack` — точные имена токенов (проверены в tokens.generated.css).

**Главный риск:** объём ре-миграции (Phase 4 Task 9, Phase 5 Task 10 — десятки файлов). Митигация: TS-удаление пропа из типа делает `pnpm exec tsc` исчерпывающим детектором call-site'ов — имплементер чинит по списку компилятора, не по памяти.
