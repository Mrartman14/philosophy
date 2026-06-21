# Strict Minimal UI-kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить UI-kit в строгий минимальный набор: размер через типизированный `compact`, 4 семантических тона, layout в `Stack`/`Inline`, className закрыт на leaf-контролах (с типизированными выходами `grow`/`fill`/`mono` + примитив `ColorInput`) — чтобы kit нельзя было применить неправильно.

**Architecture:** Закрытые intentful leaf-контролы (пропы, ноль className) + открытые structural/compound примитивы (композиция). Размер — бинарный `compact?: boolean` → токены `--size-control-h-md`/`--size-control-h-sm` (оба density-aware), НЕ через глобальный `data-density`. Легитимные раскладочные нужды покрыты типизированными пропами и structural-родителями. `tailwind-merge` в `cn` — вторичная подстраховка ОТКРЫТЫХ поверхностей. Каждая фаза — отдельный шиппабельный срез с ре-миграцией своих потребителей.

**Tech Stack:** Next.js (RSC + server actions), React 19, TypeScript (strictTypeChecked), `@base-ui/react` ^1.4.1, Tailwind v4 (CSS-токены), `tailwind-merge` (новая зависимость), Vitest + Testing Library, pnpm.

## Global Constraints

- Менеджер пакетов — **pnpm** (НЕ npm). Гейт каждой фазы: `pnpm lint && pnpm test && pnpm build`. Pre-existing долг (НЕ наш, не блокирует): `semantic-map/*`, `canvas/{editor,editor-inspector,canvas-detail}`, `banners/api.ts`. Сверять с базой ДО задачи, чтобы не приписать себе чужие падения.
- Запрет деструктивных git (`stash`/`reset`/`checkout .`/`clean`/`restore`) и `git add -A`/`.`/`-u`. Коммитить ТОЛЬКО свои файлы ЯВНЫМ pathspec: `git commit <files...>`. НЕ `git add` в общий индекс (параллельные агенты).
- В репозитории работают параллельные агенты: не трогать чужие файлы; передавать это требование субагентам.
- Именование файлов — kebab-case; комментарии и сообщения коммитов на русском.
- **Эта инициатива — координированный foundation-update.** Касание `src/components/ui/*`, `src/components/ui/index.ts`, `package.json` (добавление `tailwind-merge`), `eslint.config.mjs` — САНКЦИОНИРОВАНО в рамках этого PR (обычный запрет на эти зоны относится к фиче-работе). НЕ менять токен-генератор `src/styles/tokens/` — только потребление токенов в компонентах.
- **Токены размера** (`src/styles/tokens.generated.css`, density-aware, НЕ менять): `--size-control-h-md` = 2.5rem/2.25rem (comfortable/compact); `--size-control-h-sm` = 2rem/1.75rem. `--space-stack` = 1rem/0.75rem. `--space-control-pad-x`, `--space-control-pad-y` — паддинги.
- **Глобальный `data-density`** на `<html>` — это ПОЛЬЗОВАТЕЛЬСКАЯ настройка appearance ([appearance-provider.tsx](../../../src/components/appearance/appearance-provider.tsx)). НЕ использовать её как инструмент локального размера контрола — для этого есть `compact`.
- **Граница:** leaf-контролы ЗАКРЫТЫ (Button, IconButton, Select, TextInput, Textarea, Checkbox, Label, ColorInput) — без className; structural ОТКРЫТЫ (Stack, Inline, FormField, Toolbar, Popover, NavigationMenu, Dialog, Table) — className легитимен. Form — поведение only.
- **tsc НЕ исчерпывающий детектор:** object-spread (`<Button {...obj}>`) и реэкспорт-обёртки проходят молча. При удалении ЛЮБОГО пропа из типа — обязателен grep-шаг `rg -n '\{\.\.\.' src` рядом с kit-контролами + ручная проверка `subscribe-button.tsx`.
- Guardrail 7 (ноль нативных тегов/прямых base-ui вне kit) — НЕ ломать. Тест-файлы (`src/**/*.test.{ts,tsx}`) — в ignores Guardrail 7/8.

---

## Phase 1 — `cn` + tailwind-merge (подстраховка открытых поверхностей)

### Task 1: добавить tailwind-merge в `cn`

**Files:**
- Modify: `package.json` (dep), `src/components/ui/cn.ts`
- Create: `src/components/ui/cn.test.ts`

**Interfaces:**
- Produces: `cn(...inputs)` — теперь разрешает Tailwind-конфликты через `twMerge` (последний-в-группе побеждает детерминированно). Сигнатура не меняется. Все потребители `cn` (весь kit) автоматически получают конфликт-разрешение на открытых поверхностях.

- [ ] **Step 1: Установить зависимость**

Run: `pnpm add tailwind-merge` (поставит совместимую с Tailwind v4 версию — `^3`). Проверить, что `package.json` получил `tailwind-merge` в `dependencies`.

- [ ] **Step 2: Написать тест совместимости с v4-токенами**

`src/components/ui/cn.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn (tailwind-merge)", () => {
  it("drops falsy inputs", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("resolves size/height conflicts (last wins): size-7 over h-9 w-9", () => {
    const out = cn("h-9 w-9", "size-7");
    expect(out).toContain("size-7");
    expect(out).not.toContain("h-9");
    expect(out).not.toContain("w-9");
  });

  it("resolves v4 CSS-variable height tokens (sm wins over md)", () => {
    const out = cn("h-(--size-control-h-md)", "h-(--size-control-h-sm)");
    expect(out).toContain("h-(--size-control-h-sm)");
    expect(out).not.toContain("h-(--size-control-h-md)");
  });

  it("resolves gap conflict on a structural surface (consumer gap wins)", () => {
    const out = cn("flex flex-col gap-(--space-stack)", "gap-2");
    expect(out).toContain("gap-2");
    expect(out).not.toContain("gap-(--space-stack)");
    expect(out).toContain("flex-col");
  });
});
```

- [ ] **Step 3: Прогнать — падает.** Run: `pnpm vitest run src/components/ui/cn.test.ts`
Expected: FAIL (naive join не разрешает конфликты; `h-9` остаётся).

- [ ] **Step 4: Реализовать**

`src/components/ui/cn.ts` — обернуть join в `twMerge`:
```ts
// src/components/ui/cn.ts
import { twMerge } from "tailwind-merge";

/** Значение класса: строка либо falsy (отбрасывается). */
type ClassValue = string | false | null | undefined;

/**
 * Склеивание классов с разрешением Tailwind-конфликтов (последний-в-группе
 * побеждает детерминированно, а не по emit-order). Нужно для ОТКРЫТЫХ
 * structural-поверхностей (Stack/Inline/Toolbar/…), где className потребителя
 * легитимно мёржится с базой; leaf-контролы className не принимают, но `cn`
 * у них всё равно безопасен.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(inputs.filter(Boolean).join(" "));
}

// FOCUS_RING_INPUT / FOCUS_RING_CONTROL / SHELL_BASE — без изменений (см. ниже)
```
Сохранить существующие экспорты `FOCUS_RING_INPUT`, `FOCUS_RING_CONTROL`, `SHELL_BASE` как есть.

> Если Step 5 покажет, что `twMerge` НЕ разрешает `h-(--token)` (v4 CSS-var shorthand) — настроить через `extendTailwindMerge` (добавить группу), но по умолчанию `tailwind-merge@^3` это поддерживает. Зафиксировать в отчёте, понадобился ли fallback.

- [ ] **Step 5: Прогнать — проходит.** Run: `pnpm vitest run src/components/ui/cn.test.ts` → PASS.

- [ ] **Step 6: Регрессия — весь kit**

Run: `pnpm vitest run src/components/ui` — все существующие тесты kit зелёные (twMerge не должен сломать ни один `toHaveClass`). Если какой-то тест ассертил ТОЧНУЮ строку className и сломался на дедупликации — поправить ассерт на `toHaveClass`/`toContain` (не менять компонент). Зафиксировать в отчёте список поправленных тестов.

- [ ] **Step 7: Гейт фазы.** Run: `pnpm lint && pnpm test && pnpm build` — наши 0 новых ошибок.

- [ ] **Step 8: Коммит**
```bash
git commit package.json pnpm-lock.yaml src/components/ui/cn.ts src/components/ui/cn.test.ts -m "feat(ui): tailwind-merge в cn — детерминированное разрешение конфликтов на открытых поверхностях"
```
> Если `pnpm add` изменил `pnpm-lock.yaml` — включить его в pathspec (он наш в этой задаче). НЕ коммитить чужие изменения.

---

## Phase 2 — Размер: ось `compact` (убрать `size`)

### Task 2: `Button` — заменить `size` на `compact`

**Files:**
- Modify: `src/components/ui/button.tsx`, `src/components/ui/button.test.tsx`, `src/components/ui/index.ts`
- Modify (re-migration): потребители `<Button size=…>` (grep), `src/app/dev/kit/page.tsx` (демо размеров)

**Interfaces:**
- Produces: `Button` БЕЗ `size`/`ButtonSize`; новый проп `compact?: boolean` (default `false`). `false`→`h-(--size-control-h-md)`, `true`→`h-(--size-control-h-sm)`. `variant`/`unstyled`/`className` пока без изменений. `ButtonSize` УДАЛЁН из `button.tsx` И из barrel `index.ts`.

- [ ] **Step 1: Найти потребителей `size`**

Run: `rg -n 'size=' src --type tsx | rg '<Button|Button\b' ` и шире (многострочные теги):
```bash
rg -lU '<Button[^>]*\bsize=' src --type tsx | rg -v '\.test\.'
```
Выписать список. Ожидаемо ~42 `size="sm"` (нет `md`/`lg`).

- [ ] **Step 2: Обновить тест** в `button.test.tsx`:
```tsx
it("default size binds to the comfortable control-height token", () => {
  render(<Button>x</Button>);
  expect(screen.getByRole("button", { name: "x" })).toHaveClass("h-(--size-control-h-md)");
});
it("compact binds to the small control-height token", () => {
  render(<Button compact>x</Button>);
  expect(screen.getByRole("button", { name: "x" })).toHaveClass("h-(--size-control-h-sm)");
});
```
Удалить старые `size="sm"|"md"|"lg"`-тесты.

- [ ] **Step 3: Прогнать — падает.** Run: `pnpm vitest run src/components/ui/button.test.tsx` → FAIL.

- [ ] **Step 4: Реализовать** `button.tsx`:
```tsx
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Структурно-компактный размер контрола (ось, ортогональная глобальной плотности). */
  compact?: boolean;
  unstyled?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", compact = false, unstyled = false, className, type = "button", ...rest },
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
        "inline-flex items-center justify-center gap-2 rounded px-4 text-sm font-medium transition",
        compact ? "h-(--size-control-h-sm)" : "h-(--size-control-h-md)",
        FOCUS_RING_CONTROL,
        variantClasses[variant],
        className,
      )}
      {...rest}
    />
  );
});
```
Убрать `ButtonSize` и `sizeClasses` полностью.

- [ ] **Step 5: Почистить barrel** `index.ts` — убрать `type ButtonSize` из реэкспорта `./button` (иначе build красный: «Module has no exported member ButtonSize»):
```ts
export { Button, type ButtonProps, type ButtonVariant } from "./button";
```

- [ ] **Step 6: Прогнать тест — проходит.** Run: `pnpm vitest run src/components/ui/button.test.tsx` → PASS.

- [ ] **Step 7: Ре-миграция `size=` (tsc-детектор)**

Run: `pnpm exec tsc --noEmit 2>&1 | rg 'size'` — после удаления `size` из типа компилятор перечислит ВСЕ прямые `<Button size=>`. Для каждого: `size="sm"` → `compact`. Дополнительно проверить object-spread: `rg -n '\{\.\.\.' src | rg -i button` — нет ли `<Button {...{size:…}}>` (tsc не ловит). Прогнать тесты затронутых фич.

- [ ] **Step 8: Витрина `dev/kit`** — в `src/app/dev/kit/page.tsx` секция демонстрации размеров: заменить демо `size="sm/md/lg"` на демо `compact`/обычный (Button рядом normal + compact). Если витрина не компилится по `size` — это и есть сигнал.

- [ ] **Step 9: Гейт + Коммит**
```bash
pnpm lint && pnpm test && pnpm build   # наши 0 новых ошибок
git commit src/components/ui/button.tsx src/components/ui/button.test.tsx src/components/ui/index.ts src/app/dev/kit/page.tsx <consumers...> -m "refactor(ui): Button compact вместо size (токен высоты, density-aware)"
```

---

### Task 3: `IconButton` — `compact`, откат `IconButton.size`, миграция 3 потребителей

**Files:**
- Modify: `src/components/ui/icon-button.tsx`, `src/components/ui/icon-button.test.tsx`, `src/components/ui/index.ts`
- Modify (re-migration): `src/components/attachments/attachments-panel.tsx` (2×), `src/features/notifications/ui/notification-bell.tsx` (1×)

**Interfaces:**
- Produces: `IconButton` БЕЗ `size`/`IconButtonSize`; `compact?: boolean` (default `false`). Геометрия — квадрат высотой контрола: `false`→`h-(--size-control-h-md) w-(--size-control-h-md)`, `true`→`h-(--size-control-h-sm) w-(--size-control-h-sm)`. `variant`/`className` пока без изменений. `IconButtonSize` НЕ был в barrel (проверить — экспортируется только `IconButton, IconButtonProps`).

- [ ] **Step 1: Тест** `icon-button.test.tsx`:
```tsx
it("renders a square control-height button (token-based, no size prop)", () => {
  render(<IconButton aria-label="x">i</IconButton>);
  const btn = screen.getByRole("button", { name: "x" });
  expect(btn).toHaveClass("h-(--size-control-h-md)");
  expect(btn).toHaveClass("w-(--size-control-h-md)");
});
it("compact binds to the small control-height token", () => {
  render(<IconButton compact aria-label="x">i</IconButton>);
  expect(screen.getByRole("button", { name: "x" })).toHaveClass("h-(--size-control-h-sm)");
});
```
Удалить `size="sm"`/`h-7 w-7`-тест.

- [ ] **Step 2: Прогнать — падает.** Run: `pnpm vitest run src/components/ui/icon-button.test.tsx` → FAIL.

- [ ] **Step 3: Реализовать** `icon-button.tsx` — убрать `IconButtonSize`, `sizeClasses`, проп `size`:
```tsx
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  compact?: boolean;
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ variant = "ghost", compact = false, className, type = "button", ...rest }, ref) {
    const side = compact ? "--size-control-h-sm" : "--size-control-h-md";
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded transition",
          compact ? "h-(--size-control-h-sm) w-(--size-control-h-sm)" : "h-(--size-control-h-md) w-(--size-control-h-md)",
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
(Убрать неиспользуемую `side`-переменную если оставил литералы — оставить только один способ; код выше: использовать литералы в `cn`, `side` удалить.)

- [ ] **Step 4: Прогнать — проходит.** Run: `pnpm vitest run src/components/ui/icon-button.test.tsx` → PASS.

- [ ] **Step 5: Ре-миграция 3 потребителей** — `attachments-panel.tsx` (2 стрелки `size="sm"`) и `notification-bell.tsx` (`size="sm"`): `size="sm"` → `compact`. Контролы получат правильный компактный размер (28-32px по плотности), как раньше. Прогнать `pnpm vitest run src/components/attachments src/features/notifications`.

- [ ] **Step 6: Гейт + Коммит**
```bash
pnpm lint && pnpm test && pnpm build
git commit src/components/ui/icon-button.tsx src/components/ui/icon-button.test.tsx src/components/attachments/attachments-panel.tsx src/features/notifications/ui/notification-bell.tsx -m "refactor(ui): IconButton compact вместо size; откат IconButton.size"
```

---

## Phase 3 — Layout-примитивы `Stack` + `Inline`

### Task 4: `Stack` primitive

**Files:**
- Create: `src/components/ui/stack.tsx`, `src/components/ui/stack.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: `Stack({ align?, className?, children })` — structural (className ОТКРЫТ): `div` с `flex flex-col gap-(--space-stack)` (density-aware). `align?: "stretch" | "start"` (default `stretch`). Экспорт `STACK_CLASS` для тестируемости без node-access.

- [ ] **Step 1: Тест** `src/components/ui/stack.test.tsx`:
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
    render(<Stack><button type="button">a</button><button type="button">b</button></Stack>);
    expect(screen.getByRole("button", { name: "a" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "b" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Прогнать — падает** (`Cannot resolve ./stack`).

- [ ] **Step 3: Реализовать** `src/components/ui/stack.tsx`:
```tsx
// src/components/ui/stack.tsx
import type { ReactNode } from "react";

import { cn } from "./cn";

/** Класс вертикального ритма (вынесен для тестируемости без node-access). */
export const STACK_CLASS = "flex flex-col gap-(--space-stack)";

export interface StackProps {
  /** stretch (default) — дети тянутся по ширине; start — интринсик-ширина. */
  align?: "stretch" | "start";
  className?: string;
  children: ReactNode;
}

/**
 * Вертикальный layout-примитив kit: density-aware gap (`--space-stack`).
 * Structural — className ОТКРЫТ (раскладка, не вид контрола).
 */
export function Stack({ align = "stretch", className, children }: StackProps) {
  return (
    <div className={cn(STACK_CLASS, align === "start" ? "items-start" : "items-stretch", className)}>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Экспорт** `index.ts`: `export { Stack, STACK_CLASS, type StackProps } from "./stack";`

- [ ] **Step 5: Прогнать — проходит.**

- [ ] **Step 6: Коммит**
```bash
git commit src/components/ui/stack.tsx src/components/ui/stack.test.tsx src/components/ui/index.ts -m "feat(ui): Stack — вертикальный layout-примитив (density-aware)"
```

---

### Task 5: `Inline` primitive

**Files:**
- Create: `src/components/ui/inline.tsx`, `src/components/ui/inline.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: `Inline({ align?, className?, children })` — structural (className ОТКРЫТ): `div` с `flex flex-row flex-wrap gap-(--space-stack)`. `align?: "center" | "end" | "start"` (default `center`, маппится в `items-*`). Экспорт `INLINE_CLASS`. Поглощает горизонтальные формы, ряды фильтров/кнопок, выравнивание одиночной кнопки.

> Gap намеренно тот же `--space-stack` (один density-токен для обоих примитивов — минимум вариантов). Если визуально ряды слишком разрежены — отдельный `--space-inline` вводится позже координированно с токен-генератором; сейчас не множить токены.

- [ ] **Step 1: Тест** `src/components/ui/inline.test.tsx`:
```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Inline, INLINE_CLASS } from "./inline";

afterEach(cleanup);

describe("Inline", () => {
  it("INLINE_CLASS is a wrapping horizontal row with the density-aware gap", () => {
    expect(INLINE_CLASS).toContain("flex");
    expect(INLINE_CLASS).toContain("flex-row");
    expect(INLINE_CLASS).toContain("flex-wrap");
    expect(INLINE_CLASS).toContain("gap-(--space-stack)");
  });
  it("renders its children", () => {
    render(<Inline><button type="button">a</button><button type="button">b</button></Inline>);
    expect(screen.getByRole("button", { name: "a" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "b" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Прогнать — падает.**

- [ ] **Step 3: Реализовать** `src/components/ui/inline.tsx`:
```tsx
// src/components/ui/inline.tsx
import type { ReactNode } from "react";

import { cn } from "./cn";

export const INLINE_CLASS = "flex flex-row flex-wrap gap-(--space-stack)";

const alignClass = {
  center: "items-center",
  end: "items-end",
  start: "items-start",
} as const;

export interface InlineProps {
  /** Вертикальное выравнивание ряда (default center). */
  align?: keyof typeof alignClass;
  className?: string;
  children: ReactNode;
}

/**
 * Горизонтальный layout-примитив kit: ряд с переносом, density-aware gap.
 * Structural — className ОТКРЫТ. Поглощает горизонтальные формы, ряды
 * фильтров/кнопок, выравнивание одиночной кнопки в форме.
 */
export function Inline({ align = "center", className, children }: InlineProps) {
  return <div className={cn(INLINE_CLASS, alignClass[align], className)}>{children}</div>;
}
```

- [ ] **Step 4: Экспорт** `index.ts`: `export { Inline, INLINE_CLASS, type InlineProps } from "./inline";`

- [ ] **Step 5: Прогнать — проходит.**

- [ ] **Step 6: Коммит**
```bash
git commit src/components/ui/inline.tsx src/components/ui/inline.test.tsx src/components/ui/index.ts -m "feat(ui): Inline — горизонтальный layout-примитив (density-aware)"
```

---

## Phase 4 — Tone: 4 семантических тона

### Task 6: `Button` — `tone` (4 значения), barrel, миграция, витрина

**Files:**
- Modify: `src/components/ui/button.tsx`, `src/components/ui/button.test.tsx`, `src/components/ui/index.ts`, `src/components/ui/icon-button.tsx` (импорт `ButtonVariant` — временный локальный тип)
- Modify (re-migration): все `<Button variant=…>` (87×, 56 файлов), `src/features/notifications/ui/subscribe-button.tsx` (object-spread — tsc НЕ ловит), `src/app/dev/kit/page.tsx` (секция variants→tones)

**Interfaces:**
- Produces: `ButtonTone = "primary" | "neutral" | "quiet" | "danger"`; проп `tone?: ButtonTone` (default `"primary"`). `variant`/`ButtonVariant` УДАЛЯЕТСЯ из `button.tsx` И из barrel. `ButtonTone` экспортируется (потребляет витрина; IconButton имеет свой тип). `toneClasses` — 4 записи.

- [ ] **Step 1: Маппинг ре-миграции (рецепт)**

| старый `variant` | новый `tone` |
|---|---|
| `primary` | удалить (default `primary`) или `tone="primary"` |
| `secondary` | `tone="neutral"` (border + bg-subtle) |
| `ghost` | `tone="quiet"` (hover-only) ИЛИ, если это кликабельная СТРОКА/карточка без хрома → `<Button unstyled className=…>` (её природа, не тон) |
| `danger` | `tone="danger"` |

Кнопки БЕЗ `variant` остаются default (был `primary`, стал `primary`) — поведение НЕ меняется (нет тихой демотизации).

- [ ] **Step 2: Тест** `button.test.tsx`: default → `primary`-классы (`bg-(--color-fg)`); `tone="neutral"` → border; `tone="quiet"` → hover-only без `bg-(--color-surface-subtle)` resting; `tone="danger"` → danger. Удалить variant-тесты.

- [ ] **Step 3: Прогнать — падает.**

- [ ] **Step 4: Реализовать** `button.tsx`:
```tsx
export type ButtonTone = "primary" | "neutral" | "quiet" | "danger";

const toneClasses: Record<ButtonTone, string> = {
  primary: "bg-(--color-fg) text-(--color-surface) hover:opacity-90 disabled:opacity-50",
  neutral: "border border-(--color-border) bg-(--color-surface-subtle) hover:bg-(--color-surface) disabled:opacity-50",
  quiet: "hover:bg-(--color-surface-subtle) disabled:opacity-50",
  danger: "bg-(--color-danger-solid) text-(--color-danger-on-solid) hover:opacity-90 disabled:opacity-50",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  compact?: boolean;
  unstyled?: boolean;
}
// деструктуризация: { tone = "primary", compact = false, unstyled = false, className, type = "button", ...rest }
// в cn: toneClasses[tone]
```
Убрать `ButtonVariant`, `variantClasses`.

- [ ] **Step 5: Barrel** `index.ts` — `ButtonVariant`→`ButtonTone`:
```ts
export { Button, type ButtonProps, type ButtonTone } from "./button";
```

- [ ] **Step 6: Не сломать `icon-button.tsx`** (импортирует `ButtonVariant`). Временно дать ему ЛОКАЛЬНЫЙ `type IconButtonVariant = "primary" | "secondary" | "ghost" | "danger"` (Task 7 заменит на `IconButtonTone`). Это держит сборку зелёной между задачами. Run: `pnpm exec tsc --noEmit` на обоих файлах.

- [ ] **Step 7: Прогнать тест — проходит.**

- [ ] **Step 8: Ре-миграция (tsc + grep)**

Run: `pnpm exec tsc --noEmit 2>&1 | rg 'variant'` — ВСЕ прямые `<Button variant=>`. Мигрировать по таблице Step 1.
Run: `rg -n '\{\.\.\.' src | rg -i 'button|variant'` — найти object-spread. Конкретно: `subscribe-button.tsx` несёт `<Button {...(subscribed ? { variant: "secondary" as const } : {})}>` — tsc это НЕ флагует → мигрировать ВРУЧНУЮ на `tone={subscribed ? "neutral" : "primary"}` (или явный условный `tone`). Проверить остальные spread-хиты.
Прогнать тесты затронутых фич + `pnpm exec eslint <files>`.

- [ ] **Step 9: Витрина** `dev/kit/page.tsx` — секцию «Variants» переписать в «Tones» (primary/neutral/quiet/danger), убрать ссылки на `variant`.

- [ ] **Step 10: Гейт + Коммит**
```bash
pnpm lint && pnpm test && pnpm build
git commit src/components/ui/button.tsx src/components/ui/button.test.tsx src/components/ui/index.ts src/components/ui/icon-button.tsx src/features/notifications/ui/subscribe-button.tsx src/app/dev/kit/page.tsx <consumers...> -m "refactor(ui): Button tone (primary/neutral/quiet/danger), default primary; variant→tone"
```

---

### Task 7: `IconButton` — `tone` (свой набор)

**Files:** `src/components/ui/icon-button.tsx`, `src/components/ui/icon-button.test.tsx`, re-migration `<IconButton variant=…>` (ожидаемо 0 — все на default; проверить grep'ом).

**Interfaces:**
- Produces: `IconButtonTone = "neutral" | "primary" | "danger"` (свой, БЕЗ `quiet` — иконочная кнопка по природе тихая, поэтому `neutral` = hover-only). Проп `tone?: IconButtonTone` (default `"neutral"`). Убрать временный `IconButtonVariant` из Task 6.

- [ ] **Step 1: Тест** default `neutral` (hover-only, без resting bg/border); `tone="primary"` filled; `tone="danger"` текстовый. Удалить variant-тест.
- [ ] **Step 2: Прогнать — падает.**
- [ ] **Step 3: Реализовать**:
```tsx
export type IconButtonTone = "neutral" | "primary" | "danger";

/**
 * Иконочная кнопка по природе тихая: `neutral` = hover-only (то, что у Button
 * называется `quiet`). Отдельный набор тонов — сознательное расхождение с Button,
 * чтобы иконочный контрол не конкурировал с filled-кнопкой формы.
 */
const toneClasses: Record<IconButtonTone, string> = {
  neutral: "hover:bg-(--color-surface-subtle) disabled:opacity-50",
  primary: "bg-(--color-fg) text-(--color-surface) hover:opacity-90 disabled:opacity-50",
  danger: "text-(--color-danger) hover:bg-(--color-danger-bg) disabled:opacity-50",
};
// props: { tone = "neutral", compact = false, className, type = "button", ...rest }
```
Убрать `import type { ButtonVariant }` и локальный `IconButtonVariant`.
- [ ] **Step 4: Прогнать — проходит.**
- [ ] **Step 5: Ре-миграция** — `rg -lU '<IconButton[^>]*variant=' src` (ожидаемо пусто). Если есть — `secondary/ghost`→`neutral`, `primary/danger`→same.
- [ ] **Step 6: Гейт + Коммит** (явный pathspec).

---

## Phase 5 — Примитив `ColorInput`

### Task 8: `ColorInput` + миграция color-инпутов

**Files:**
- Create: `src/components/ui/color-input.tsx`, `src/components/ui/color-input.test.tsx`
- Modify: `src/components/ui/index.ts`
- Modify (re-migration): `src/features/banners/ui/banner-create-form.tsx`, `banner-edit-form.tsx` (и др. `<TextInput type="color" …>` — найти grep'ом)

**Interfaces:**
- Produces: `ColorInput` — leaf-контрол для выбора цвета своей геометрии (квадрат), БЕЗ className. Принимает `name`/`value`/`defaultValue`/`onChange`/`disabled`/`aria-label`. Заменяет `<TextInput type="color" className="h-10 w-20 p-1">`.

- [ ] **Step 1: Найти color-инпуты** Run: `rg -nU '<TextInput[^>]*type="color"' src`. Выписать.

- [ ] **Step 2: Тест** `color-input.test.tsx`:
```tsx
it("renders a native color input with its label", () => {
  render(<ColorInput name="c" defaultValue="#ff0000" aria-label="Цвет" />);
  const input = screen.getByLabelText("Цвет");
  expect(input).toHaveAttribute("type", "color");
});
```

- [ ] **Step 3: Прогнать — падает.**

- [ ] **Step 4: Реализовать** `src/components/ui/color-input.tsx`:
```tsx
// src/components/ui/color-input.tsx
import { forwardRef, type InputHTMLAttributes } from "react";

import { cn, FOCUS_RING_INPUT, SHELL_BASE } from "./cn";

// className закрыт; type фиксирован "color"; геометрия — внутренняя забота примитива.
export type ColorInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type">;

/** Контрол выбора цвета (своя геометрия color-picker). leaf — без className. */
export const ColorInput = forwardRef<HTMLInputElement, ColorInputProps>(
  function ColorInput(props, ref) {
    return (
      <input
        ref={ref}
        type="color"
        className={cn(SHELL_BASE, "h-(--size-control-h-md) w-16 cursor-pointer p-1", FOCUS_RING_INPUT, "disabled:opacity-50")}
        {...props}
      />
    );
  },
);
```

- [ ] **Step 5: Экспорт** `index.ts`: `export { ColorInput, type ColorInputProps } from "./color-input";`

- [ ] **Step 6: Прогнать — проходит.**

- [ ] **Step 7: Ре-миграция** — заменить `<TextInput type="color" className="…">` на `<ColorInput name=… aria-label=… defaultValue=… />` в banner-формах. Прогнать `pnpm vitest run src/features/banners`.

- [ ] **Step 8: Гейт + Коммит** (явный pathspec).

---

## Phase 6 — Структура поля: `<Label>`-обёртки → `FormField`

### Task 9: миграция Label-обёрток на существующий `FormField`

**Files:**
- Modify (re-migration): ~19 файлов с `<Label className="flex flex-col gap-1">…<control/></Label>` (паттерн «label-обёртка над контролом»).

**Interfaces:**
- Consumes: существующий `FormField({ name, label, description?, required?, className?, children })` ([form-field.tsx](../../../src/components/ui/form-field.tsx)) — владеет `flex flex-col gap-1`, рисует Field.Label + required-звёздочку + Field.Error по `name`.
- Produces: `<Label>`-обёртки заменены на `FormField`; standalone `<Label>` (без раскладочного className) НЕ трогаются (их className закроется в Task 15).

- [ ] **Step 1: Найти Label-обёртки** Run: `rg -nU '<Label[^>]*className="[^"]*flex' src` — это обёртки (`flex flex-col gap-1` / `flex items-center gap-2`). Отделить от standalone `<Label>` без className.

- [ ] **Step 2: Рецепт миграции** (применять per-file, TDD по фиче где есть тест):
```tsx
// БЫЛО:
<Label className="flex flex-col gap-1">
  Заголовок
  <TextInput name="title" />
</Label>
// СТАЛО:
<FormField name="title" label="Заголовок">
  <TextInput name="title" />
</FormField>
```
Для чекбокс-строк (`<Label className="flex items-center gap-2"><Checkbox/>текст</Label>`) — это горизонтальная ассоциация, НЕ вертикальное поле. Такие оставить как есть до Task 15 (там className на Label закроется; для inline-чекбокса использовать `Inline` + standalone `Label` с `htmlFor`, либо `FormField` если он поддерживает horizontal — он НЕ поддерживает, поэтому: обернуть в `Inline` align="center", `<Checkbox id=…/>` + `<Label htmlFor=…>`). Зафиксировать классификацию (вертикальное поле → FormField; inline-чекбокс → Inline+Label) в отчёте.

- [ ] **Step 3: Мигрировать** все вертикальные label-обёртки → `FormField`. Сохранять `required` (звёздочка), `name`, ассоциацию. Прогнать тесты затронутых фич после каждой пачки.

- [ ] **Step 4: Гейт** `pnpm lint && pnpm test && pnpm build`. После миграции `rg -nU '<Label[^>]*className="[^"]*flex-col' src` должен быть пуст (вертикальные обёртки ушли).

- [ ] **Step 5: Коммит** (явный pathspec; допускается несколько коммитов батчами по фичам в рамках задачи).

---

## Phase 7 — `Form` без layout → `Stack`/`Inline`

### Task 10: `Form` — поведение only, миграция всех форм

**Files:**
- Modify: `src/components/ui/form.tsx`, `src/components/ui/form.test.tsx`
- Modify (re-migration): все `<Form>`-потребители (~44 несут layout-className, 5 на дефолте — всего ~49 форм)

**Interfaces:**
- Produces: `Form` БЕЗ дефолта `flex flex-col gap-4` и БЕЗ `className` (поведение only: `errors`/`onSubmit`/`action`/`ref` + form-атрибуты через rest, НЕ className). Раскладку даёт вложенный `Stack` (вертикальные) или `Inline` (горизонтальные/фильтры).

> Измерено ревью (важно — прошлый план описывал это инвертированно): на дефолт `flex flex-col gap-4` полагаются ТОЛЬКО ~5 форм; ~44 уже передают СВОЙ className, из них ~13 горизонтальных (`flex items-end/center`) + 1 grid → в `Stack` НЕ ложатся, идут в `Inline`/structural-обёртку.

- [ ] **Step 1: Реализовать** `form.tsx` — закрыть className, убрать layout-дефолт:
```tsx
interface FormProps extends Omit<ComponentProps<typeof BaseForm>, "children" | "errors" | "className"> {
  errors?: Record<string, string>;
  children: ReactNode;
}

export const Form = forwardRef<HTMLFormElement, FormProps>(function Form(
  { errors, children, ...rest },
  ref,
) {
  return (
    <BaseForm ref={ref} errors={errors} {...rest}>
      {children}
    </BaseForm>
  );
});
```
(layout НЕ навязывается; className убран — Form поведенческий.)

- [ ] **Step 2: Тест** `form.test.tsx` — `<Form>` НЕ несёт `flex flex-col gap-4`; рендерит детей; форвардит ref. (Если был тест на className-passthrough — убрать.)

- [ ] **Step 3: Прогнать — падает** (где-то тест/тип на className).

- [ ] **Step 4: Ре-миграция (tsc-детектор + классификация)**

Run: `pnpm exec tsc --noEmit 2>&1 | rg -i 'form'` — все `<Form className=…>` станут TS-ошибкой (className убран). Для каждого классифицировать и переписать:
```tsx
// вертикальная форма:
<Form className="flex flex-col gap-4">…</Form>
  → <Form><Stack>…</Stack></Form>
// горизонтальная/фильтр:
<Form className="flex items-end gap-2">…</Form>
  → <Form><Inline align="end">…</Inline></Form>
// grid (audit-filter):
<Form className="grid gap-3 sm:grid-cols-2">…</Form>
  → <Form><div className="grid gap-3 sm:grid-cols-2">…</div></Form>   // structural-обёртка, className ок
// max-w на форме (9 случаев):
<Form className="flex flex-col gap-4 max-w-xl">…</Form>
  → <Form><Stack className="max-w-xl">…</Stack></Form>   // Stack structural — className ок
```
Формы на дефолте (без className, ~5) — обернуть детей в `Stack` явно. Зафиксировать классификацию в отчёте.

- [ ] **Step 5: Гейт** `pnpm lint && pnpm test && pnpm build`. `rg -nU '<Form[^>]*className=' src` — пусто.

- [ ] **Step 6: Коммит** (явный pathspec; батчами по фичам ок).

---

## Phase 8 — Закрыть `className` на leaf-контролах

> Приём фазы: leaf-контрол перестаёт принимать `className`. Механика зависит от типа Props: наследует нативный HTML-тип → `Omit<…HTMLAttributes<…>, "className">`; рукописный интерфейс → убрать поле `className`. Перед закрытием — добавить типизированный выход для легитимных нужд (если есть). `pnpm exec tsc` ловит прямые передачи; `rg '\{\.\.\.'` — spread (tsc не ловит).

### Task 11: `Select` — `fill`, закрыть className

**Files:** `select.tsx`, re-migration `<Select className=…>` (5×).
**Interfaces:** Produces: `Select` без `className`; новый `fill?: boolean` (default `true`→`w-full`; `false`→intrinsic `w-auto`). Фиксированную ширину задаёт structural-родитель.

- [ ] **Step 1:** В `SelectProps` убрать `className`, добавить `fill?: boolean`. В trigger-классе: `fill === false ? "w-auto" : "w-full"` вместо хардкода `w-full`. Внешний `className` больше не мёржится в trigger (внутренняя композиция base-ui не затрагивается).
- [ ] **Step 2: Тест** — `<Select fill={false}>` trigger без `w-full`; `<Select>` (default) с `w-full`.
- [ ] **Step 3: Прогнать — падает.**
- [ ] **Step 4: Реализовать** (см. Step 1).
- [ ] **Step 5: Ре-миграция** Run: `rg -nU '<Select[^>]*className=' src`. `w-auto` → `fill={false}`. Фикс-ширины (`w-44`/`w-48`/`w-40`) → обёртка-родитель `Inline`/`Stack` с нужной шириной ИЛИ `fill={false}` + ширина на родителе. `pnpm exec tsc --noEmit | rg -i select` clean.
- [ ] **Step 6: Гейт + Коммит** (явный pathspec).

### Task 12: `TextInput` — `grow`, закрыть className

**Files:** `text-input.tsx`, re-migration.
**Interfaces:** Produces: `TextInput` без `className`; `grow?: boolean` (`true`→`flex-1 min-w-0` для растяжения в `Inline`-ряду).

- [ ] **Step 1:** Тип: `export type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & { grow?: boolean };`. В реализации деструктурировать `grow`, добавить `grow && "min-w-0 flex-1"` в `cn`.
- [ ] **Step 2: Тест** — `<TextInput grow>` несёт `flex-1`; `<TextInput>` — нет.
- [ ] **Step 3: Прогнать — падает.**
- [ ] **Step 4: Реализовать.**
- [ ] **Step 5: Ре-миграция** Run: `rg -nU '<TextInput[^>]*className=' src` + `pnpm exec tsc --noEmit | rg -i textinput`. `flex-1`/`min-w-60` → `grow` (+ `min-w` на родителе если нужно). Прочие позиционные → родитель. Color-инпуты уже ушли в ColorInput (Task 8).
- [ ] **Step 6: Гейт + Коммит** (явный pathspec).

### Task 13: `Textarea` — `grow` + `mono`, закрыть className

**Files:** `textarea.tsx`, re-migration.
**Interfaces:** Produces: `Textarea` без `className`; `grow?: boolean`; `mono?: boolean` (`true`→`font-mono text-xs` для JSON/код-редакторов).

- [ ] **Step 1:** Тип: `Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & { grow?: boolean; mono?: boolean }`. В `cn`: `mono && "font-mono"`, `grow && "min-h-0 flex-1"`.
- [ ] **Step 2: Тест** — `<Textarea mono>` несёт `font-mono`.
- [ ] **Step 3: Прогнать — падает.**
- [ ] **Step 4: Реализовать.**
- [ ] **Step 5: Ре-миграция** Run: `rg -nU '<Textarea[^>]*className=' src` + tsc. `font-mono`/`text-xs` (canvas-edit JSON) → `mono`. Прочее → родитель/проп.
- [ ] **Step 6: Гейт + Коммит** (явный pathspec).

### Task 14: `Checkbox` — закрыть className

**Files:** `checkbox.tsx`, re-migration (ожидаемо 0 внешних className).
- [ ] **Step 1:** Убрать поле `className?: string` из рукописного `CheckboxProps`. (Внутренняя композиция base-ui не затрагивается.)
- [ ] **Step 2:** Run: `rg -nU '<Checkbox[^>]*className=' src` — ожидаемо пусто; если есть — перенести на родителя (`Inline`). `pnpm exec tsc --noEmit | rg -i checkbox` clean.
- [ ] **Step 3: Тест** — существующие проходят (поведение не менялось).
- [ ] **Step 4: Гейт + Коммит** (явный pathspec).

### Task 15: `Label` — закрыть className

**Files:** `label.tsx`, re-migration standalone-меток.
**Interfaces:** Produces: `Label` без className (`Omit<LabelHTMLAttributes<HTMLLabelElement>, "className">`). Вертикальные обёртки уже ушли в FormField (Task 9); остаются standalone `<Label htmlFor=…>` без раскладки.

- [ ] **Step 1:** Тип: `export type LabelProps = Omit<LabelHTMLAttributes<HTMLLabelElement>, "className">`. Реализация: фикс. класс `text-sm font-medium` (без `cn(…, className)`).
- [ ] **Step 2: Ре-миграция** Run: `rg -nU '<Label[^>]*className=' src` — оставшиеся (inline-чекбокс-строки и пр.) перенести раскладку на `Inline`/родителя. `pnpm exec tsc --noEmit | rg -i label` clean.
- [ ] **Step 3: Тест** — `label.test.tsx` обновить под отсутствие className.
- [ ] **Step 4: Гейт + Коммит** (явный pathspec).

### Task 16: `Button` — закрыть className (escape `unstyled`)

**Files:** `button.tsx`, `button.test.tsx`, re-migration.
**Interfaces:** Produces: дискриминированный union — `unstyled: true` → `className` РАЗРЕШЁН (единственный escape для «вида»); иначе className отсутствует.

- [ ] **Step 1: Реализовать тип-разделение**:
```tsx
type ButtonBase = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;
export type ButtonProps =
  | (ButtonBase & { tone?: ButtonTone; compact?: boolean; unstyled?: false })
  | (ButtonBase & { unstyled: true; className?: string });
```
В реализации: при `unstyled` читать `className`; в styled-ветке className нет. Аккуратно типизировать union в деструктуризации (внутри использовать `"className" in props`-нарратив или раздельные ветки). forwardRef сохранить.
- [ ] **Step 2: Тест** — `// @ts-expect-error` на `<Button className="x">` без unstyled; `<Button unstyled className="x">` ок (рантайм: несёт класс).
- [ ] **Step 3: Прогнать — падает (типы).**
- [ ] **Step 4: Реализовать.**
- [ ] **Step 5: Ре-миграция** Run: `pnpm exec tsc --noEmit | rg -i button` + `rg -nU '<Button[^>]*className=' src`. Позиционные классы (`self-start` и пр.) → родитель `Inline`/`Stack` (теперь существуют, формы уже на них — Task 10). «Вид» (go-back `underline text-2xl`) → `unstyled` + className (escape). Spread: `rg '\{\.\.\.' src | rg -i button`. Зафиксировать каждое решение.
- [ ] **Step 6: Гейт + Коммит** (явный pathspec).

### Task 17: `IconButton` — закрыть className

**Files:** `icon-button.tsx`, re-migration.
- [ ] **Step 1:** `IconButtonProps`: `Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & { tone?: IconButtonTone; compact?: boolean; "aria-label": string }`.
- [ ] **Step 2: Ре-миграция** Run: `pnpm exec tsc --noEmit | rg -i iconbutton` + `rg -nU '<IconButton[^>]*className=' src`. Позиционные (`relative`, `ml-auto` на колоколе/поиске) → обёртка-родитель. Hover-цвет (если был className) → это тон, свести к `tone`. Spread-проверка.
- [ ] **Step 3: Тест** обновить.
- [ ] **Step 4: Гейт + Коммит** (явный pathspec).

---

## Phase 9 — Enforcement

### Task 18: Guardrail 8 (ESLint) + финальный гейт

**Files:** `eslint.config.mjs`, `eslint.config.test.mjs` (если есть фикстура-тест — по образцу Guardrail 7), финальный прогон.

**Interfaces:**
- Consumes: тот же `no-restricted-syntax`-приём, что Guardrail 7 (flat-config last-wins → повторить селекторы блока, который матчит те же файлы, ИЛИ добавить с правильным scope). esquery: литеральный `/` в regex → `/`.

- [ ] **Step 1: Селекторы Guardrail 8** (реальные, не «положиться на ревью»):
  - `JSXAttribute[name.name='variant']` на kit-контролах — запрет (устаревшее имя; TS уже ловит, но lint даёт явное сообщение и ловит в .jsx/нестрогих местах).
  - `JSXAttribute[name.name='size']` на kit-контролах — запрет.
  - Сообщение: «kit использует tone/compact, не variant/size».
  Scope: применять к `src/**/*.tsx` кроме `src/components/ui/**` и тест-файлов. Точечность по имени компонента в esquery ограничена — допускается запрет голых `variant=`/`size=` JSX-атрибутов в прикладных файлах (kit их больше не определяет, ложные срабатывания на чужих `size` — например нативный `<input size>` — вынести в ignore точечно если всплывут; зафиксировать).
- [ ] **Step 2: esquery pre-check** каждого селектора:
```bash
node -e 'require("esquery").parse("JSXAttribute[name.name='variant']"); console.log("ok")'
```
- [ ] **Step 3: Фикстура-тест** (по образцу существующего Guardrail-теста, если он есть в репозитории): `Linter.verify` на сниппете `<Button variant="x"/>` → ожидается 1 ошибка Guardrail 8; на `<Button tone="primary"/>` → 0. Если инфраструктуры теста линта нет — задокументировать селектор + ручная проверка `pnpm lint` на временном файле, затем удалить файл.
- [ ] **Step 4: `pnpm lint`** — категоризировать: новые Guardrail-8 нарушения (должны быть 0 после Phase 2/4 миграции) vs pre-existing (semantic-map/canvas/banners — не наши).
- [ ] **Step 5: ФИНАЛЬНЫЙ ГЕЙТ** `pnpm lint && pnpm test && pnpm build` — наши 0 новых ошибок; `pnpm exec tsc --noEmit` — 0 в наших файлах. Зафиксировать evidence (счётчики).
- [ ] **Step 6: Коммит** (явный pathspec).

---

## Self-Review (выполнено при написании)

**Spec coverage:** tailwind-merge (Task 1); размер→`compact`+токены (Tasks 2-3, откат IconButton.size — Task 3); `Stack`+`Inline` (Tasks 4-5); 4 тона + barrel + dev/kit (Tasks 6-7); `ColorInput` (Task 8); Label→FormField (Task 9); Form без layout (Task 10); типизированные выходы `fill`/`grow`/`mono` + закрытие className на всех leaf (Tasks 11-17); Guardrail 8 реальными селекторами + фикстура (Task 18). Граница leaf/structural отражена. data-density НЕ используется как ось размера (исправлено).

**Blockers ревью устранены:** barrel `index.ts` чистится в Tasks 2/6 (ButtonSize/Variant → ButtonTone); object-spread `subscribe-button.tsx` мигрируется вручную + grep `\{\.\.\.` (Task 6 Step 8, Global Constraints); `Omit<…,"className">`-механика расписана per-component (Tasks 11-17); полный TDD-код в задачах примитивов; витрина `dev/kit` переписана (Tasks 2/6); честный объём ~106 файлов в Global + фазовых заметках; Phase 7 описана по измеренной реальности (5 на дефолте, ~44 кастомных, 13 горизонтальных); default tone = `primary` (нет тихой демотизации); 4 тона (neutral/quiet различены).

**Type consistency:** `ButtonTone` (Task 6) экспортируется, потребляется витриной; `IconButtonTone` — свой (Task 7); `STACK_CLASS`/`INLINE_CLASS` экспортируются; Button discriminated union (Task 16) согласован с `compact`/`tone`/`unstyled`; токены `--size-control-h-md`/`-sm`/`--space-stack` — точные имена (проверены в tokens.generated.css).

**Главный риск:** объём ре-миграции (~106 файлов, ~236 правок) — принят пользователем. Митигация: каждое удаление пропа из типа делает `pnpm exec tsc` детектором прямых call-site'ов; spread-слепые пятна закрываются обязательным grep-шагом; каждая фаза зелёная независимо.
