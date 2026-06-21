# UI-kit base-ui coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Все нативные интерактивные примитивы (button/select/form/fieldset/legend/label/textarea) и прямые `@base-ui/react`-импорты идут через единый shared UI-kit (`src/components/ui/`); ESLint-гарды не дают регрессировать.

**Architecture:** Два стиля обёрток. Закрытые (фокусный prop-API) — `Fieldset`, `Label`. Compound re-export (namespace пред-стилизованных частей с forwardRef) — `Popover`, `Toolbar`, `NavigationMenu`. Затем пофичная миграция потребителей и ESLint-enforcement последним шагом.

**Tech Stack:** Next.js (App Router, RSC + server actions), React 19, TypeScript (strictTypeChecked), `@base-ui/react` ^1.4.1, Tailwind v4 (CSS-токены), Vitest + Testing Library, pnpm.

## Global Constraints

- Менеджер пакетов — **pnpm** (НЕ npm). Гейт перед каждым PR: `pnpm lint && pnpm test && pnpm build` зелёные.
- Запрет деструктивных git-операций (`stash`/`reset`/`checkout .`/`clean`) и `git add -A`/`git add .`. Коммить только перечисленные в шаге файлы по имени.
- Именование файлов в `src/` — kebab-case.
- Проектный `cn` (`src/components/ui/cn.ts`) — наивный `join`, БЕЗ tailwind-merge. Обёртки форвардят `className` и НЕ запекают конфликтующих структурных дефолтов; на call-site удаляются дублирующие дефолт классы.
- Источник истины об обязательности поля — Zod-схема фичи (`src/features/<entity>/schemas.ts`): поле обязательно, если НЕ `.optional()`/`.nullish()` и без дефолта.
- Это foundation-update PR: касается замороженных зон (`src/components/ui/*`, `src/components/{app,ast-editor}`, `eslint.config.mjs`) — координированно, не в составе фичи.
- Общение и комментарии — на русском.

---

## Phase 1 — Новые обёртки UI-kit

### Task 1: `Fieldset` wrapper

**Files:**
- Create: `src/components/ui/fieldset.tsx`
- Test: `src/components/ui/fieldset.test.tsx`
- Modify: `src/components/ui/index.ts` (добавить экспорт)

**Interfaces:**
- Produces: `Fieldset({ legend?: ReactNode, className?: string, children: ReactNode })` — рендерит base-ui `Fieldset.Root`, и `Fieldset.Legend` только если `legend` передан.

- [ ] **Step 1: Написать падающий тест**

`src/components/ui/fieldset.test.tsx`:
```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Fieldset } from "./fieldset";

afterEach(cleanup);

describe("Fieldset", () => {
  it("renders a real <legend> element (not <div>) with the caption when legend provided", () => {
    const { container } = render(
      <Fieldset legend="Видимость">
        <span>child</span>
      </Fieldset>,
    );
    const legend = container.querySelector("legend");
    expect(legend).not.toBeNull(); // ловит регресс: base-ui по умолчанию даёт <div>
    expect(legend).toHaveTextContent("Видимость");
    expect(legend?.closest("fieldset")).not.toBeNull(); // legend — подпись fieldset
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("renders no legend element when legend omitted", () => {
    const { container } = render(
      <Fieldset>
        <span>child</span>
      </Fieldset>,
    );
    expect(container.querySelector("legend")).toBeNull();
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("forwards className to the fieldset element", () => {
    const { container } = render(<Fieldset className="custom-x"><span>c</span></Fieldset>);
    expect(container.querySelector("fieldset")).toHaveClass("custom-x");
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm vitest run src/components/ui/fieldset.test.tsx`
Expected: FAIL — Vite: `Failed to resolve import "./fieldset" … Does the file exist?` (модуль ещё не создан — настоящий TDD-red, точная строка не «Cannot find module»).

- [ ] **Step 3: Реализовать компонент**

`src/components/ui/fieldset.tsx`:
```tsx
"use client";
// src/components/ui/fieldset.tsx
import { Fieldset as BaseFieldset } from "@base-ui/react/fieldset";
import type { ReactNode } from "react";

import { cn } from "./cn";

export interface FieldsetProps {
  /** Опционально: у группированных полей без подписи legend нет. */
  legend?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Тонкая обёртка над Base UI Fieldset. Legend рендерится только когда передан —
 * часть fieldset'ов (например строка конструктора форм) подписи не имеют.
 *
 * ВАЖНО: base-ui Fieldset.Legend по умолчанию рендерит <div> (не <legend>) —
 * см. node_modules/@base-ui/react/fieldset/legend/FieldsetLegend.js. Чтобы
 * сохранить нативную семантику <legend> при миграции нативных fieldset/legend
 * (и чтобы lint-гард на <legend> не превращал семантику в <div>), форсим реальный
 * <legend> через render-проп. Base UI всё равно навешивает свой id + aria-labelledby
 * на Fieldset.Root, ассоциация подписи с группой сохраняется.
 */
export function Fieldset({ legend, className, children }: FieldsetProps) {
  return (
    <BaseFieldset.Root className={cn("flex flex-col gap-1", className)}>
      {legend !== undefined && (
        <BaseFieldset.Legend render={<legend />} className="text-sm text-(--color-fg-muted)">
          {legend}
        </BaseFieldset.Legend>
      )}
      {children}
    </BaseFieldset.Root>
  );
}
```
> Если base-ui по какой-то причине не примет `render={<legend />}` для Legend (проверяется тестом ниже — `querySelector("legend")` должен быть НЕ null), запасной вариант — отрисовать `<legend>` напрямую внутри `BaseFieldset.Root` со своим id и `aria-labelledby` на Root. Тест Step 1 ловит регресс семантики.

- [ ] **Step 4: Добавить экспорт в `index.ts`**

В `src/components/ui/index.ts` добавить строку (после `FormField`):
```ts
export { Fieldset, type FieldsetProps } from "./fieldset";
```

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Run: `pnpm vitest run src/components/ui/fieldset.test.tsx`
Expected: PASS (3 теста).

- [ ] **Step 6: Коммит**

```bash
git add src/components/ui/fieldset.tsx src/components/ui/fieldset.test.tsx src/components/ui/index.ts
git commit -m "feat(ui): Fieldset — обёртка над Base UI Fieldset"
```

---

### Task 2: `Label` wrapper

**Files:**
- Create: `src/components/ui/label.tsx`
- Test: `src/components/ui/label.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: `Label(props: LabelHTMLAttributes<HTMLLabelElement>)` — styled нативный `<label>` (base-ui отдельного Label-примитива не даёт), forwardRef.

- [ ] **Step 1: Написать падающий тест**

`src/components/ui/label.test.tsx`:
```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Label } from "./label";

afterEach(cleanup);

describe("Label", () => {
  it("renders text and forwards htmlFor", () => {
    render(<Label htmlFor="email">Почта</Label>);
    const label = screen.getByText("Почта");
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute("for", "email");
  });

  it("merges custom className over the base", () => {
    render(<Label className="custom-x">L</Label>);
    expect(screen.getByText("L")).toHaveClass("custom-x");
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm vitest run src/components/ui/label.test.tsx`
Expected: FAIL — Vite: `Failed to resolve import "./label" … Does the file exist?` (модуль ещё не создан).

- [ ] **Step 3: Реализовать**

`src/components/ui/label.tsx`:
```tsx
// src/components/ui/label.tsx
import { forwardRef, type LabelHTMLAttributes } from "react";

import { cn } from "./cn";

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

/**
 * Styled нативный <label>. Base UI отдельного Label-примитива не предоставляет
 * (только Field.Label внутри Field), поэтому для standalone-меток — единая
 * styled-обёртка вместо россыпи сырых <label>.
 */
export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, ...rest },
  ref,
) {
  return (
    <label ref={ref} className={cn("text-sm font-medium", className)} {...rest} />
  );
});
```

- [ ] **Step 4: Экспорт в `index.ts`**
```ts
export { Label, type LabelProps } from "./label";
```

- [ ] **Step 5: Запустить — проходит**

Run: `pnpm vitest run src/components/ui/label.test.tsx`
Expected: PASS (2 теста).

- [ ] **Step 6: Коммит**
```bash
git add src/components/ui/label.tsx src/components/ui/label.test.tsx src/components/ui/index.ts
git commit -m "feat(ui): Label — styled-обёртка над нативным label"
```

---

### Task 3: `Popover` compound wrapper

**Files:**
- Create: `src/components/ui/popover.tsx`
- Test: `src/components/ui/popover.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: namespace `Popover` с частями `Root`, `Trigger`, `Portal`, `Positioner`, `Popup`, `Arrow`, `Close`. `Popup` несёт дефолтный surface-стиль (`rounded border bg-surface shadow-lg`), `Arrow` — дефолтную заливку; обе мёржат `className` поверх. Остальные части — прямой passthrough base-ui.

- [ ] **Step 1: Написать падающий тест**

`src/components/ui/popover.test.tsx`:
```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Popover } from "./popover";

afterEach(cleanup);

describe("Popover (compound)", () => {
  it("renders trigger; opens popup content on defaultOpen", () => {
    render(
      <Popover.Root defaultOpen>
        <Popover.Trigger>Открыть</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>Контент</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    expect(screen.getByText("Открыть")).toBeInTheDocument();
    expect(screen.getByText("Контент")).toBeInTheDocument();
  });

  it("Popup merges custom className over the surface default", () => {
    render(
      <Popover.Root defaultOpen>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup className="p-3">Контент</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    const popup = screen.getByText("Контент");
    expect(popup).toHaveClass("p-3");
    expect(popup).toHaveClass("shadow-lg");
  });

  it("forwards ref to the Popup element (initialFocus/Positioner risk per spec)", () => {
    const ref = createRef<HTMLElement>();
    render(
      <Popover.Root defaultOpen>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup ref={ref}>Контент</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toHaveTextContent("Контент");
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm vitest run src/components/ui/popover.test.tsx`
Expected: FAIL — Vite: `Failed to resolve import "./popover" … Does the file exist?` (модуль ещё не создан).

- [ ] **Step 3: Реализовать**

`src/components/ui/popover.tsx`:
```tsx
"use client";
// src/components/ui/popover.tsx
import { Popover as BasePopover } from "@base-ui/react/popover";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { cn } from "./cn";

/**
 * Compound-обёртка над Base UI Popover. Root/Trigger/Portal/Positioner — прямой
 * passthrough; Popup/Arrow несут общий surface-стиль и мёржат className поверх.
 * className трактуется как строка (проектный cn — наивный join без tailwind-merge):
 * на call-site дублирующие surface-классы убираются, остаётся только позиционное/размерное.
 */
const Popup = forwardRef<
  ElementRef<typeof BasePopover.Popup>,
  ComponentPropsWithoutRef<typeof BasePopover.Popup>
>(function PopoverPopup({ className, ...rest }, ref) {
  return (
    <BasePopover.Popup
      ref={ref}
      className={cn("rounded border border-(--color-border) bg-(--color-surface) shadow-lg", className as string)}
      {...rest}
    />
  );
});

const Arrow = forwardRef<
  ElementRef<typeof BasePopover.Arrow>,
  ComponentPropsWithoutRef<typeof BasePopover.Arrow>
>(function PopoverArrow({ className, ...rest }, ref) {
  return (
    <BasePopover.Arrow
      ref={ref}
      className={cn("fill-(--color-surface) stroke-(--color-border)", className as string)}
      {...rest}
    />
  );
});

export const Popover = {
  Root: BasePopover.Root,
  Trigger: BasePopover.Trigger,
  Portal: BasePopover.Portal,
  Positioner: BasePopover.Positioner,
  Popup,
  Arrow,
  Close: BasePopover.Close,
};
```

- [ ] **Step 4: Экспорт в `index.ts`**
```ts
export { Popover } from "./popover";
```

- [ ] **Step 5: Запустить — проходит**

Run: `pnpm vitest run src/components/ui/popover.test.tsx`
Expected: PASS (2 теста).
> Если jsdom ругается на отсутствие layout-метрик у позиционера — это варнинг, не fail; тест проверяет наличие текста, а не координаты.

- [ ] **Step 6: Коммит**
```bash
git add src/components/ui/popover.tsx src/components/ui/popover.test.tsx src/components/ui/index.ts
git commit -m "feat(ui): Popover — compound-обёртка над Base UI Popover"
```

---

### Task 4: `Toolbar` compound wrapper

**Files:**
- Create: `src/components/ui/toolbar.tsx`
- Test: `src/components/ui/toolbar.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: namespace `Toolbar` с частями `Root`, `Button`, `Group`, `Separator`. `Root` несёт дефолт `flex items-center gap-1 p-1`; `Button` — дефолтные контрол-классы (`inline-flex h-9 w-9 ... rounded` + focus-ring + hover/pressed-состояния); `Group`/`Separator` — лёгкие дефолты. Все мёржат `className`.

- [ ] **Step 1: Написать падающий тест**

`src/components/ui/toolbar.test.tsx`:
```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Toolbar } from "./toolbar";

afterEach(cleanup);

describe("Toolbar (compound)", () => {
  it("renders a toolbar with a button", () => {
    render(
      <Toolbar.Root>
        <Toolbar.Group>
          <Toolbar.Button aria-label="bold">B</Toolbar.Button>
        </Toolbar.Group>
      </Toolbar.Root>,
    );
    expect(screen.getByRole("button", { name: "bold" })).toBeInTheDocument();
  });

  it("Button merges custom className over the default", () => {
    render(
      <Toolbar.Root>
        <Toolbar.Button aria-label="x" className="custom-x">X</Toolbar.Button>
      </Toolbar.Root>,
    );
    expect(screen.getByRole("button", { name: "x" })).toHaveClass("custom-x");
  });

  it("forwards ref to the underlying <button>", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Toolbar.Root>
        <Toolbar.Button ref={ref} aria-label="b">B</Toolbar.Button>
      </Toolbar.Root>,
    );
    expect(ref.current?.tagName).toBe("BUTTON");
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm vitest run src/components/ui/toolbar.test.tsx`
Expected: FAIL — Vite: `Failed to resolve import "./toolbar" … Does the file exist?` (модуль ещё не создан).

- [ ] **Step 3: Реализовать**

`src/components/ui/toolbar.tsx`:
```tsx
"use client";
// src/components/ui/toolbar.tsx
import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { cn, FOCUS_RING_CONTROL } from "./cn";

/**
 * Compound-обёртка над Base UI Toolbar. Root/Button/Group/Separator несут общие
 * дефолты редакторного тулбара (вынесены из inline-классов ast-editor); className
 * мёржится поверх (строкой — проектный cn без tailwind-merge).
 */
const Root = forwardRef<
  ElementRef<typeof BaseToolbar.Root>,
  ComponentPropsWithoutRef<typeof BaseToolbar.Root>
>(function ToolbarRoot({ className, ...rest }, ref) {
  return <BaseToolbar.Root ref={ref} className={cn("flex items-center gap-1 p-1", className as string)} {...rest} />;
});

const Group = forwardRef<
  ElementRef<typeof BaseToolbar.Group>,
  ComponentPropsWithoutRef<typeof BaseToolbar.Group>
>(function ToolbarGroup({ className, ...rest }, ref) {
  return <BaseToolbar.Group ref={ref} className={cn("flex items-center gap-1", className as string)} {...rest} />;
});

const Button = forwardRef<
  ElementRef<typeof BaseToolbar.Button>,
  ComponentPropsWithoutRef<typeof BaseToolbar.Button>
>(function ToolbarButton({ className, ...rest }, ref) {
  return (
    <BaseToolbar.Button
      ref={ref}
      className={cn(
        "inline-flex h-9 min-w-9 items-center justify-center rounded px-2 transition",
        "hover:bg-(--color-surface-subtle) aria-pressed:bg-(--color-surface-subtle)",
        "disabled:opacity-50",
        FOCUS_RING_CONTROL,
        className as string,
      )}
      {...rest}
    />
  );
});

const Separator = forwardRef<
  ElementRef<typeof BaseToolbar.Separator>,
  ComponentPropsWithoutRef<typeof BaseToolbar.Separator>
>(function ToolbarSeparator({ className, ...rest }, ref) {
  return <BaseToolbar.Separator ref={ref} className={cn("mx-1 h-5 w-px bg-(--color-border)", className as string)} {...rest} />;
});

export const Toolbar = { Root, Group, Button, Separator };
```

> ВАЖНО (осознанная редизайн-дельта, не «паритет»): сейчас НИ ОДИН `Toolbar.Button` в редакторе НЕ имеет className — base-ui рендерит кнопки БЕЗ стилей (проверено ревью: inline-marks/block-buttons/list-buttons/image-button/link-popover/ref-popover — везде только `aria-*`/`onClick`). Значит эта обёртка не «выносит существующий стиль», а ВВОДИТ новый единый вид кнопки тулбара. Эталон состояний задаётся здесь: default (`h-9 min-w-9 rounded px-2`), hover (`bg-surface-subtle`), pressed (`aria-pressed:bg-surface-subtle`), disabled (`opacity-50`), focus (`FOCUS_RING_CONTROL`). На этапе миграции (Task 11) у call-site'ов класса нет — их не нужно «чистить». Критерий приёмки в Task 11 — НЕ «визуальный паритет» (паритета с пустым стилем нет), а соответствие этому эталону состояний (ручная проверка default/hover/pressed/disabled/focus в реальном редакторе).

- [ ] **Step 4: Экспорт в `index.ts`**
```ts
export { Toolbar } from "./toolbar";
```

- [ ] **Step 5: Запустить — проходит**

Run: `pnpm vitest run src/components/ui/toolbar.test.tsx`
Expected: PASS (2 теста).

- [ ] **Step 6: Коммит**
```bash
git add src/components/ui/toolbar.tsx src/components/ui/toolbar.test.tsx src/components/ui/index.ts
git commit -m "feat(ui): Toolbar — compound-обёртка над Base UI Toolbar"
```

---

### Task 5: `NavigationMenu` compound wrapper

**Files:**
- Create: `src/components/ui/navigation-menu.tsx`
- Test: `src/components/ui/navigation-menu.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: namespace `NavigationMenu` с частями `Root`, `List`, `Item`, `Trigger`, `Content`, `Positioner`, `Portal`, `Popup`, `Viewport`, `Arrow`, `Link`. Все — passthrough с мёржем `className` (бесшовно: app-header несёт собственную bespoke-разметку, обёртка ничего не навязывает, только маршрутизирует импорт через kit + forwardRef).

- [ ] **Step 1: Написать падающий тест**

`src/components/ui/navigation-menu.test.tsx`:
```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NavigationMenu } from "./navigation-menu";

afterEach(cleanup);

describe("NavigationMenu (compound)", () => {
  it("renders Root>List>Item content", () => {
    render(
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item>Пункт</NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>,
    );
    expect(screen.getByText("Пункт")).toBeInTheDocument();
  });

  it("Item forwards className", () => {
    const { container } = render(
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item className="custom-x">П</NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>,
    );
    expect(container.querySelector(".custom-x")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm vitest run src/components/ui/navigation-menu.test.tsx`
Expected: FAIL — Vite: `Failed to resolve import "./navigation-menu" … Does the file exist?` (модуль ещё не создан).

- [ ] **Step 3: Реализовать**

`src/components/ui/navigation-menu.tsx`:
```tsx
"use client";
// src/components/ui/navigation-menu.tsx
import { NavigationMenu as BaseNavigationMenu } from "@base-ui/react/navigation-menu";

/**
 * Compound-обёртка над Base UI NavigationMenu. Единственный потребитель
 * (app-header) несёт полностью bespoke-разметку, поэтому обёртка не навязывает
 * дефолтных классов — только маршрутизирует импорт через kit (ноль прямых
 * @base-ui/react вне UI-kit). Все части — прямой re-export, className/ref
 * проходят как есть.
 */
export const NavigationMenu = {
  Root: BaseNavigationMenu.Root,
  List: BaseNavigationMenu.List,
  Item: BaseNavigationMenu.Item,
  Trigger: BaseNavigationMenu.Trigger,
  Content: BaseNavigationMenu.Content,
  Positioner: BaseNavigationMenu.Positioner,
  Portal: BaseNavigationMenu.Portal,
  Popup: BaseNavigationMenu.Popup,
  Viewport: BaseNavigationMenu.Viewport,
  Arrow: BaseNavigationMenu.Arrow,
  Link: BaseNavigationMenu.Link,
};
```

- [ ] **Step 4: Экспорт в `index.ts`**
```ts
export { NavigationMenu } from "./navigation-menu";
```

- [ ] **Step 5: Запустить — проходит**

Run: `pnpm vitest run src/components/ui/navigation-menu.test.tsx`
Expected: PASS (2 теста).

- [ ] **Step 6: Коммит**
```bash
git add src/components/ui/navigation-menu.tsx src/components/ui/navigation-menu.test.tsx src/components/ui/index.ts
git commit -m "feat(ui): NavigationMenu — compound-обёртка над Base UI NavigationMenu"
```

---

## Phase 2 — Миграция простых форм-элементов (features/app)

> Общий приём: после каждого файла прогонять его тесты (если есть) + `pnpm vitest run <feature>`. В конце фазы — полный `pnpm test`. Импорты добавлять в существующий `from "@/components/ui"`-блок (import/order форсит сортировку).

### Task 6: Миграция нативных `<select>` → `Select`

**Files (modify):** 9 файлов с нативным `<select>`:
- `src/features/documents/ui/document-create-form.tsx:42`
- `src/features/documents/ui/document-upload-form.tsx:39`
- `src/features/trails/ui/trail-create-form.tsx:41`
- `src/features/forms/ui/form-builder.tsx:118,130`
- `src/features/forms/ui/form-builder-field-row.tsx:56`
- `src/features/annotations/ui/annotation-admin-filter-form.tsx:32`
- `src/features/lectures/ui/lecture-visibility-toggle.tsx:35`
- `src/features/media/ui/media-upload-form.tsx:66`

**Interfaces:**
- Consumes: `Select` из `@/components/ui` (существует): `{ name?, defaultValue?, value?, onValueChange?, options: {value,label}[], placeholder?, disabled?, className?, "aria-label"? }`. Base UI Select сам рендерит hidden input под `name` для отправки в форме.

- [ ] **Step 1: Worked example — `document-create-form.tsx`**

Заменить блок `src/features/documents/ui/document-create-form.tsx:42-49`:
```tsx
        <select
          name="visibility"
          defaultValue="private"
          className="rounded border border-(--color-border) px-2 py-1 text-sm"
        >
          <option value="private">{t("visibilityPrivate")}</option>
          <option value="public">{t("visibilityPublic")}</option>
        </select>
```
на:
```tsx
        <Select
          name="visibility"
          defaultValue="private"
          options={[
            { value: "private", label: t("visibilityPrivate") },
            { value: "public", label: t("visibilityPublic") },
          ]}
        />
```
И добавить `Select` в импорт `@/components/ui` в этом файле.

- [ ] **Step 2: Применить тот же приём к остальным файлам**

Для каждого: собрать `<option>` в массив `options=[{value,label}]`, перенести `name`/`defaultValue`, удалить нативный `<select>`+`<option>`, добавить `Select` в импорт. Особые случаи (ревью вскрыл два опасных):

- **Контролируемые селекты** (`value=` + `onChange=`): `onChange={(e)=>setX(e.target.value)}` → `onValueChange={(v)=>setX(v)}`, `value` остаётся. Проверить в `form-builder.tsx` (×2), `form-builder-field-row.tsx`, `annotation-admin-filter-form.tsx`.
- Если у `<select>` нет `name` и он чисто UI-стейтовый — `Select` без `name` работает.
- **⚠ Авто-сабмит по нативному событию (`lecture-visibility-toggle.tsx`).** Нативный select сабмитит форму через `onChange={(e)=>e.currentTarget.form?.requestSubmit()}`. У kit-`Select` колбэк — `onValueChange(value: string)` БЕЗ DOM-события, `e.currentTarget.form` недостижим → механический перенос колбэка молча сломает сохранение видимости (UI-теста на это НЕТ). Рецепт: мигрировать этот файл **атомарно** (select + form + autosubmit разом, см. ниже), а НЕ дробить между Task 6/7/9.
  ```tsx
  // lecture-visibility-toggle.tsx — атомарная миграция
  import { useEffect, useRef, useState } from "react";
  import { Form, Select } from "@/components/ui";
  // ...
  const [visibility, setVisibility] = useState(currentVisibility); // controlled
  const formRef = useRef<HTMLFormElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; } // пропустить initial
    formRef.current?.requestSubmit(); // value уже в скрытом input Select после коммита
  }, [visibility]);
  // ...
  <Form ref={formRef} action={action} className="flex flex-col gap-1">
    <Select name="visibility" value={visibility} onValueChange={setVisibility} options={[…]} />
  </Form>
  ```
  Контролируемый `value` + сабмит в `useEffect` (после коммита, когда скрытый input Select уже обновлён) избегает гонки. Удалить прежний `autoSubmit(e: ChangeEvent)`.
  > Этот рецепт требует, чтобы `Form` форвардил ref. **Под-шаг 2a (один раз):** добавить `forwardRef` в `src/components/ui/form.tsx` — обернуть в `forwardRef<HTMLFormElement, FormProps>` и пробросить `ref` в `<BaseForm ref={ref} …>` (base-ui Form — forwardRef-компонент, ref доходит до нативного `<form>`). Это снимает file из «механического» списка Task 7.
- **⚠ `<label>` ОБОРАЧИВАЕТ `<select>` (`annotation-admin-filter-form.tsx:30`, аналогично `media-upload-form.tsx`).** Нативная неявная ассоциация label↔select. kit-`Select` рендерит base-ui trigger `<button>` (не нативный контрол) — неявная связь хрупкая. Рецепт: распаковать `<label>{text}<select/></label>` в `<Label>{text}</Label>` рядом + дать `Select` `aria-label={text}` (или связать через `id`), чтобы доступное имя сохранилось явно. Не полагаться на label-обёртку вокруг trigger-кнопки.

- [ ] **Step 3: Прогнать тесты затронутых фич**

Run: `pnpm vitest run src/features/documents src/features/forms src/features/annotations src/features/trails src/features/lectures src/features/media`
Expected: PASS. Если тест выбирал `<option>`/`<select>` по роли — обновить на Base UI Select (роль `combobox`/кнопка-триггер с `aria-label` или текстом опции).

- [ ] **Step 4: Sanity-сборка фрагмента**

Run: `pnpm vitest run src/features` (быстрее полного билда для итерации).
Expected: PASS.

- [ ] **Step 5: Коммит**
```bash
git add src/features/documents/ui/document-create-form.tsx src/features/documents/ui/document-upload-form.tsx src/features/trails/ui/trail-create-form.tsx src/features/forms/ui/form-builder.tsx src/features/forms/ui/form-builder-field-row.tsx src/features/annotations/ui/annotation-admin-filter-form.tsx src/features/lectures/ui/lecture-visibility-toggle.tsx src/features/media/ui/media-upload-form.tsx
git commit -m "refactor(ui): нативные select → kit Select (9 форм)"
```

---

### Task 7: Миграция нативных `<form>` → `Form`

**Files (modify):** ~14 файлов с нативным `<form>` (КРОМЕ `global-error.tsx` — там формы нет; `form-builder.tsx:43` — это комментарий, не элемент):
- `src/app/admin/comments/page.tsx:44` (`method="get"`)
- `src/features/comments/ui/comment-search.tsx:38`
- `src/features/share-links/ui/share-lookup-form.tsx:51`
- `src/features/share-links/ui/share-button.tsx:81` (`action=`)
- `src/features/canvas/ui/canvas-visibility-button.tsx:43` (`action=`)
- `src/features/canvas/ui/canvas-search.tsx:29`
- `src/features/search/ui/search-input.tsx:60,115`
- `src/features/audit/ui/audit-filter-form.tsx:62`
- `src/features/glossary/ui/glossary-search-form.tsx:32`
- ~~`src/features/lectures/ui/lecture-visibility-toggle.tsx:30`~~ — УЖЕ мигрирован атомарно в Task 6 (select+form+autosubmit). Здесь пропустить.
- `src/features/lectures/ui/lecture-search-form.tsx:43`
- `src/features/tokens/ui/tokens-manager.tsx:85` (`action=`, см. Task 9)
- `src/features/media/ui/media-upload-form.tsx:61`

**Interfaces:**
- Consumes: `Form` из `@/components/ui` (существует): `Omit<ComponentProps<BaseForm>, "children"|"errors"> & { errors?: Record<string,string>, className?, children }`. Спредит `...rest` → `onSubmit`/`action`/`method` доходят до нативного `<form>`. Base UI Form ставит `noValidate` и валидирует только зарегистрированные base-ui `Field`; нативные инпуты не блокируются (см. spec «Находка о сабмите»).

- [ ] **Step 1: Worked example — `comment-search.tsx`**

`src/features/comments/ui/comment-search.tsx:38` — заменить `<form onSubmit={onSubmit} className="flex items-end gap-2">` на `<Form onSubmit={onSubmit} className="flex items-end gap-2">` и закрывающий `</form>` → `</Form>`; добавить `Form` в импорт `@/components/ui`. Обработчик `onSubmit` уже делает `e.preventDefault()` — поведение идентично.

- [ ] **Step 2: Применить к остальным**

Механически `<form …>`→`<Form …>`, `</form>`→`</Form>`, `Form` в импорт. Сохранить все пропсы (`onSubmit`/`action`/`method`/`className`). Подтипы:
- **`onSubmit`+`preventDefault`** (search/filter формы) — без изменений поведения.
- **`action={serverAction}`** (share-button, canvas-visibility-button, lecture-visibility-toggle, tokens-manager) — Base UI не preventDefault'ит, React обрабатывает `action` (тот же паттерн, что уже в kit-формах).
- **`method="get"`** (admin/comments) — нативная GET-навигация сохраняется.

- [ ] **Step 3: Прогнать тесты затронутых фич**

Run: `pnpm vitest run src/features/comments src/features/share-links src/features/canvas src/features/search src/features/audit src/features/glossary src/features/lectures src/features/media`
Expected: PASS. Тесты, ищущие форму, продолжают работать — Base UI Form рендерит нативный `<form>` (роль `form` при наличии доступного имени).

- [ ] **Step 4: Коммит**
```bash
git add src/app/admin/comments/page.tsx src/features/comments/ui/comment-search.tsx src/features/share-links/ui/share-lookup-form.tsx src/features/share-links/ui/share-button.tsx src/features/canvas/ui/canvas-visibility-button.tsx src/features/canvas/ui/canvas-search.tsx src/features/search/ui/search-input.tsx src/features/audit/ui/audit-filter-form.tsx src/features/glossary/ui/glossary-search-form.tsx src/features/lectures/ui/lecture-visibility-toggle.tsx src/features/lectures/ui/lecture-search-form.tsx src/features/media/ui/media-upload-form.tsx
git commit -m "refactor(ui): нативные form → kit Form (features/app)"
```

---

### Task 8: Миграция нативных `<button>` → `Button`/`IconButton` (features/app)

**Files (modify):** нативные кнопки вне ast-editor и вне исключений. Исключение `global-error.tsx:68` НЕ трогаем (см. Phase 4). Файлы:
- `src/features/comments/ui/comment-reactions.tsx:129`
- `src/features/search/ui/search-input.tsx:130,142,173`
- `src/features/notifications/ui/notification-bell.tsx:94`
- `src/features/notifications/ui/notification-item.tsx:46`
- `src/components/ast-merge/ast-merge-view.tsx:136`
- `src/components/app/update-prompt.tsx:15`
- `src/components/app/install-banner.tsx:17`
- `src/components/shared/go-back.tsx:15`
- `src/components/attachments/attachments-panel.tsx:56,102,117,132`

**Interfaces:**
- Consumes: `Button` (`ButtonHTMLAttributes & { variant?, size? }`, default `variant="primary" size="md" type="button"`) и `IconButton` (`ButtonHTMLAttributes & { variant?, "aria-label": string }`, иконочная 9×9) из `@/components/ui`.

- [ ] **Step 1: Правило выбора компонента**

- Иконочная кнопка без текста (есть `aria-label`, внутри только иконка) → `IconButton` (`variant` по вкусу: `ghost` по умолчанию).
- Кнопка с текстом/основное действие → `Button` (подобрать `variant`: `primary` основное, `secondary`/`ghost` второстепенное, `danger` деструктивное).
- Сохранить `onClick`, `disabled`, `aria-*`, `type`. Удалить ручные классы, дублирующие дефолт обёртки (фон/радиус/focus); оставить только позиционные/размерные отличия в `className`.

- [ ] **Step 2: Worked example — `go-back.tsx`**

`src/components/shared/go-back.tsx:15` рендерит `<button onClick={() => { router.back(); }} className={cn("underline text-2xl cursor-pointer", className)}>{children ?? t("back")}</button>` → `<Button variant="ghost" onClick={() => router.back()} className={cn("underline text-2xl cursor-pointer", className)}>{children ?? t("back")}</Button>`; импорт `Button` из `@/components/ui`. (Содержимое — `{children ?? t("back")}`, НЕ литерал; `cn(..., className)`-проброс сохранить.)

- [ ] **Step 3: Применить к остальным файлам**

Пройти список. ⚠ `search-input.tsx` — НЕ «submit/clear/icon»; clear-кнопки в файле НЕТ. Реальные 3 нативные кнопки: `:130` **submit-иконка** (`type="submit"`, только `<SearchIcon/>`), `:142` open-trigger-иконка (`type="button"`), `:173` fallback-иконка (`type="button"`, `disabled`). Для submit-иконки ОБЯЗАТЕЛЬНО явно задать `type="submit"` (и `Button`, и `IconButton` дефолтят `type="button"` → без явного type форма поиска перестанет сабмититься). Иконочные → `IconButton aria-label`, но submit-иконке — `<IconButton type="submit" aria-label=…>`. В `attachments-panel.tsx` (4 кнопки) — разобрать по тексту/иконке. `notification-*`, `comment-reactions` — иконочные/тогглы → `IconButton`/`Button variant="ghost"`.

- [ ] **Step 4: Прогнать тесты**

Run: `pnpm vitest run src/features/comments src/features/search src/features/notifications src/components/ast-merge src/components/app src/components/shared src/components/attachments`
Expected: PASS. `getByRole("button", { name })` продолжает работать (обёртки рендерят нативный `<button>` с тем же accessible name).

- [ ] **Step 5: Коммит**
```bash
git add src/features/comments/ui/comment-reactions.tsx src/features/search/ui/search-input.tsx src/features/notifications/ui/notification-bell.tsx src/features/notifications/ui/notification-item.tsx src/components/ast-merge/ast-merge-view.tsx src/components/app/update-prompt.tsx src/components/app/install-banner.tsx src/components/shared/go-back.tsx src/components/attachments/attachments-panel.tsx
git commit -m "refactor(ui): нативные button → kit Button/IconButton (features/app)"
```

---

### Task 9: `<fieldset>`/`<legend>` → `Fieldset`, standalone `<label>` → `Label`

**Files (modify):**
- `src/features/forms/ui/form-builder-field-row.tsx:44` (fieldset без legend)
- `src/features/annotations/ui/annotation-visibility-field.tsx:16-17` (fieldset+legend)
- `src/components/ast-editor/pickers/media-picker.tsx:20-21` (fieldset+legend) — **в Phase 3** (ast-editor), здесь пропустить.
- Standalone `<label>` (не внутри `FormField`): по списку из spec-разведки — мигрировать в `Label`, либо, где label оборачивает контрол с ошибкой/именем, свернуть в `FormField`. Файлы со standalone label вне UI-kit и вне ast-editor: `form-builder.tsx`, `form-builder-field-row.tsx`, `canvas/ui/editor-inspector.tsx`, `tokens-manager.tsx`, `media-upload-form.tsx`, `lectures/ui/lecture-cover-form.tsx`, `forms/ui/form-field-input.tsx`, `annotation-visibility-field.tsx`, `tags/ui/lecture-tags-form.tsx`, `share-links/ui/{share-lookup-form,share-button}.tsx`, `lectures/ui/lecture-visibility-toggle.tsx`, `events/ui/{event-edit-form,event-create-form}.tsx`, `canvas/ui/entity-ref-dialog.tsx`, `banners/ui/{banner-edit-form,banner-create-form}.tsx`, `audit/ui/audit-filter-form.tsx`, `annotation-admin-filter-form.tsx`, `app/me/settings/{locale-settings,appearance/appearance-settings}.tsx`, `admin/comments/page.tsx`.

**Interfaces:**
- Consumes: `Fieldset` ({legend?, className?, children}) и `Label` (LabelHTMLAttributes) из Task 1/2.

- [ ] **Step 1: Worked example — fieldset с legend**

`src/features/annotations/ui/annotation-visibility-field.tsx:16-17`:
```tsx
<fieldset className="flex flex-col gap-1 text-sm">
  <legend className="text-(--color-fg-muted)">{t("visibilityLegend")}</legend>
```
→
```tsx
<Fieldset legend={t("visibilityLegend")} className="text-sm">
```
(дефолт `flex flex-col gap-1` уже в обёртке — оставить в className только `text-sm`; закрывающий `</fieldset>` → `</Fieldset>`); импорт `Fieldset`.

- [ ] **Step 2: Worked example — fieldset без legend**

`src/features/forms/ui/form-builder-field-row.tsx:44`: `<fieldset className="flex flex-col gap-3 rounded border border-(--color-border) p-3">` → `<Fieldset className="gap-3 rounded border border-(--color-border) p-3">` (убрать дублирующий `flex flex-col`, оставить отличия), `</fieldset>`→`</Fieldset>`.

- [ ] **Step 3: Standalone `<label>` → `Label` / `FormField`**

Для каждого файла из списка: если `<label>` подписывает контрол внутри `Form` и у поля есть `name`/возможна ошибка — предпочесть свёртку в `FormField name=… label=…`. Иначе (label вне Form-контекста, тоггл настроек, фильтр) — заменить `<label className=…>` на `<Label className=…>`, `</label>`→`</Label>`, импорт `Label`. НЕ трогать `<label>`, уже находящиеся внутри `FormField`/`Field.Label` (их нет в списке — они идут через FormField).
> Если в файле label обёрнут вокруг `<input>` (deferred) — мигрируем только сам `<label>`→`<Label>`, `<input>` оставляем как есть (input — отдельный фоллоу-ап).

- [ ] **Step 4: Прогнать тесты**

Run: `pnpm vitest run src/features src/app`
Expected: PASS. `getByLabelText`/`getByText` по тексту легенды/лейбла продолжают работать.

- [ ] **Step 5: Коммит**
```bash
git add src/features/forms/ui/form-builder-field-row.tsx src/features/annotations/ui/annotation-visibility-field.tsx <остальные изменённые файлы по имени>
git commit -m "refactor(ui): нативные fieldset/legend → Fieldset, standalone label → Label"
```

---

### Task 10: Проставить `required` обязательным полям (звёздочка + валидация)

**Files (modify):** формы, затронутые в Tasks 6–9, у которых есть `FormField`-поля. Источник истины — `src/features/<entity>/schemas.ts`.

**Interfaces:**
- Consumes: `FormField` (рендерит `*` при `required`) + контрол с атрибутом `required` (base-ui `Field` даёт клиентскую валидацию).

- [ ] **Step 1: Свести обязательность по схемам**

Для каждой фичи с формой открыть `schemas.ts`, выписать поля, которые НЕ `.optional()`/`.nullish()` и без дефолта = обязательные. Пример (share-links): `resource_type`, `resource_id` — обязательны; `expires_at` — нет.

- [ ] **Step 2: Проставить `required`**

На соответствующих `FormField` добавить проп `required` (звёздочка) И на сам контрол (`TextInput`/`Select`/…) добавить `required` (клиентская валидация). Закрывает кейс `tokens-manager` (нативный `<input required>` внутри `action`-формы): обернуть поле в `FormField required` + оставить `required` на контроле.

- [ ] **Step 3: Прогнать тесты + проверить звёздочку**

Run: `pnpm vitest run src/features`
Expected: PASS. Где есть тест на конкретную форму — при желании добавить assert наличия `*` у обязательного `FormField` (опционально).

- [ ] **Step 4: Коммит**
```bash
git add <изменённые формы по имени>
git commit -m "feat(forms): required-звёздочка + клиентская валидация обязательным полям (по Zod-схемам)"
```

---

## Phase 3 — Миграция сложных base-ui (ast-editor, app-header, dev/ui)

### Task 11: ast-editor — Toolbar/Popover/native buttons → kit

**Files (modify):**
- `src/components/ast-editor/toolbar/toolbar.tsx` (Toolbar.Root/Separator)
- `src/components/ast-editor/toolbar/buttons/inline-marks.tsx` (Toolbar.Group/Button)
- `src/components/ast-editor/toolbar/buttons/block-buttons.tsx` (Toolbar)
- `src/components/ast-editor/toolbar/buttons/list-buttons.tsx` (Toolbar.Group/Button)
- `src/components/ast-editor/toolbar/buttons/image-button.tsx` (Toolbar.Button + Popover)
- `src/components/ast-editor/toolbar/buttons/link-popover.tsx` (Toolbar + Popover + native buttons :121,:129)
- `src/components/ast-editor/toolbar/buttons/ref-popover.tsx` (Toolbar + Popover)
- `src/components/ast-editor/toolbar/slash-menu.tsx` (native buttons :211,:226)
- `src/components/ast-editor/pickers/async-combobox.tsx` (native buttons :127,:132)
- `src/components/ast-editor/pickers/comment-2stage-picker.tsx` (native button :28)
- `src/components/ast-editor/pickers/media-picker.tsx` (fieldset/legend :20-21)
- `src/components/ast-editor/toolbar/toolbar.test.tsx` (мок `@/components/ui` — дополнить `Toolbar`, см. Step 5)
- `src/components/ast-editor/toolbar/buttons/image-button.test.tsx` (мок `@/components/ui` — дополнить `Toolbar`/`Button`, см. Step 5)

> NB: `heading-select.tsx` НЕ в списке — он base-ui не использует (импортирует kit `Select` через `@/components/ui/select`, base-ui-работы нет; ревью подтвердил). Этот deep-import в `@/components/ui` лентом разрешён (DEEP_IMPORT_PATTERN таргетит только `@/features/*`), трогать файл не нужно.

**Interfaces:**
- Consumes: `Toolbar`, `Popover`, `Button`, `IconButton`, `Fieldset` из `@/components/ui`.

- [ ] **Step 1: Заменить импорты Toolbar/Popover**

В каждом editor-файле: `import { Toolbar } from "@base-ui/react/toolbar";` → `import { Toolbar } from "@/components/ui";` (и `Popover` аналогично). Можно объединять: `import { Toolbar, Popover } from "@/components/ui";`. JSX-композиция (`Toolbar.Root/Group/Button/Separator`, `Popover.Root/Trigger/Portal/Positioner/Popup/Arrow`) остаётся дословно — namespace-API совпадает.

- [ ] **Step 2: Снять дублирующие классы под дефолты обёрток**

Где call-site задавал классы, теперь покрытые дефолтом обёртки:
- `toolbar.tsx:68` `<Toolbar.Root className="flex items-center gap-1 p-1">` → `<Toolbar.Root>` (дефолт совпадает).
- `inline-marks.tsx:27` `<Toolbar.Group className="flex items-center gap-1">` → `<Toolbar.Group>`.
- `link-popover.tsx`/`ref-popover.tsx` Popup: убрать `bg-(--color-surface) border border-(--color-border) rounded shadow-lg` (дефолт `Popover.Popup`), оставить `p-3` и `initialFocus`. Arrow: `<Popover.Arrow />` (дефолт fill/stroke совпадает) — снять `className="fill-(--color-surface) stroke-(--color-border)"`.
> `Toolbar.Button` в редакторе сейчас БЕЗ className (см. Task 4 — кнопки нестилизованы) → чистить нечего; после миграции они получают новый дефолтный вид обёртки. Если у конкретной кнопки появится особый класс — он мёржится поверх дефолта.

- [ ] **Step 3: Нативные кнопки редактора → `Button`/`IconButton`**

- `link-popover.tsx:121` (remove-link, текст) → `<Button variant="ghost" size="sm" onClick={handleRemove}>{t("linkRemove")}</Button>`; `:129` (apply, основное) → `<Button size="sm" onClick={onApply} disabled={!href.trim()}>{t("linkApply")}</Button>`. Снять дублирующие классы.
- `slash-menu.tsx:211,:226`, `async-combobox.tsx:127,:132`, `comment-2stage-picker.tsx:28` → `Button`/`IconButton` по правилу Task 8 (текст→Button, иконка→IconButton).

- [ ] **Step 4: media-picker fieldset/legend → `Fieldset`**

`media-picker.tsx:20-21`: `<fieldset><legend>{t("mediaTypeLabel")}</legend>…` → `<Fieldset legend={t("mediaTypeLabel")}>…</Fieldset>`.

- [ ] **Step 5: Починить моки `@/components/ui` в editor-тестах**

КРИТИЧНО (ревью подтвердил краш): `toolbar.test.tsx:15-17` и `image-button.test.tsx:18-20` делают `vi.mock("@/components/ui", () => ({ useToast: ... }))`, экспортируя ТОЛЬКО `useToast`. После Step 1 `toolbar.tsx`/`image-button.tsx` импортируют `Toolbar` из `@/components/ui` → в моке `Toolbar === undefined` → `Cannot read properties of undefined (reading 'Root'/'Button')`. (Диагностика «если мокал путь `@base-ui/react/...`» НЕВЕРНА — моки мокают `@/components/ui`, не base-ui-путь.) Починить оба мока, дополнив их реальными частями:
```tsx
vi.mock("@/components/ui", async (importActual) => ({
  ...(await importActual<typeof import("@/components/ui")>()),
  useToast: () => ({ add: vi.fn() }),
}));
```
(либо точечно добавить `Toolbar`, `Button`, `IconButton`, `Fieldset` к мок-объекту, если полный `importActual` тянет лишнее в jsdom).

- [ ] **Step 6: Прогнать тесты редактора + ручная проверка эталона кнопки**

Run: `pnpm vitest run src/components/ast-editor`
Expected: PASS (включая починенные `toolbar.test.tsx`/`image-button.test.tsx`).
Затем `pnpm build` и ручная проверка в реальном редакторе: тулбар/поповеры открываются, и кнопки тулбара СООТВЕТСТВУЮТ ЭТАЛОНУ состояний из Task 4 (default/hover/pressed/disabled/focus) — это НЕ «паритет со старым видом» (старые кнопки были нестилизованы), а валидация намеренно нового единого вида. Главный риск задачи.

- [ ] **Step 7: Коммит**
```bash
git add src/components/ast-editor/toolbar src/components/ast-editor/pickers
git commit -m "refactor(ast-editor): Toolbar/Popover/кнопки/fieldset → kit UI (ноль прямых base-ui)"
```

---

### Task 12: app-header — NavigationMenu → kit

**Files (modify):** `src/components/app/app-header/app-header.tsx`

**Interfaces:**
- Consumes: `NavigationMenu` из `@/components/ui` (Task 5) — namespace-API идентичен base-ui.

- [ ] **Step 1: Заменить импорт**

`src/components/app/app-header/app-header.tsx:1` `import { NavigationMenu } from "@base-ui/react/navigation-menu";` → добавить `NavigationMenu` в существующий `import { RouterLink } from "@/components/ui";` → `import { NavigationMenu, RouterLink } from "@/components/ui";`. JSX (`NavigationMenu.Root/List/Item/Portal/Positioner/Popup/Arrow/Viewport`) и все bespoke-классы остаются дословно.

- [ ] **Step 2: Прогнать тесты + сборка**

Run: `pnpm vitest run src/components/app && pnpm build`
Expected: PASS. Ручная проверка хедера (дропдаун-навигация).

- [ ] **Step 3: Коммит**
```bash
git add src/components/app/app-header/app-header.tsx
git commit -m "refactor(app-header): NavigationMenu → kit (ноль прямых base-ui)"
```

---

### Task 13: dev/ui showcase — снять прямой `Field`

**Files (modify):** `src/app/dev/ui/page.tsx`

**Interfaces:**
- Consumes: `FormField` (обёртка над base-ui `Field`) из `@/components/ui`.

- [ ] **Step 1: Заменить сырой `Field`**

`src/app/dev/ui/page.tsx:2` убрать `import { Field } from "@base-ui/react/field";`. В файле НЕТ сырого `Field.Root` — есть только три `<Field.Control render={<TextInput/>}/>` / `<Field.Control render={<Textarea/>}/>` (строки ~49, 56, 95), все уже внутри kit-`<FormField>`. Переписать их так, чтобы контрол передавался БЕЗ сырого `Field.Control` — `FormField` уже рендерит children внутри `Field.Root`, поэтому достаточно `<FormField name=… label=…><TextInput name=…/></FormField>` (ровно как делают боевые формы, напр. document-create-form). Это smoke-showcase kit — сырой Field тут не нужен.

- [ ] **Step 2: Сборка**

Run: `pnpm build`
Expected: PASS, страница `/dev/ui` компилируется без прямого base-ui.

- [ ] **Step 3: Коммит**
```bash
git add src/app/dev/ui/page.tsx
git commit -m "refactor(dev/ui): showcase без прямого base-ui Field — через FormField"
```

---

## Phase 4 — ESLint enforcement

### Task 14: Гарды — запрет `@base-ui/react` вне kit + запрет нативных тегов

**Files (modify):**
- `eslint.config.mjs`
- `src/app/global-error.tsx` (добавить eslint-disable к нативной кнопке-исключению)
- `src/features/canvas/ui/editor-text-overlay.tsx` (eslint-disable к нативному textarea-исключению)

**Interfaces:**
- Consumes: существующий блок Guardrail 6 (`no-restricted-syntax`, `files: ["src/**"]`, селекторы rich/markup). Flat-config НЕ мержит опции одного правила → последний матчнувший блок перезатирает. Поэтому добавляем ВТОРОЙ блок `no-restricted-syntax` со scope `src/**` минус `src/components/ui/**` минус `src/**/*.test.{ts,tsx}`, в котором ПОВТОРЯЕМ rich/markup + добавляем base-ui-import + нативные теги. Для прикладных файлов он матчит последним и применяет полный набор; для `ui/` проигнорен (последним остаётся G6 rich/markup); тесты исключены (mock-стабы/харнессы легитимно рендерят нативные теги).
- Consumes: исправленный esquery-селектор base-ui (`/^@base-ui/react/` — слеш через `/`, иначе `pnpm lint` падает с исключением; см. коммент блока).

- [ ] **Step 1: Добавить блок гардов в `eslint.config.mjs`**

Вставить НОВЫЙ блок СРАЗУ ПОСЛЕ существующего блока Guardrail 6 (после строки 201, закрывающей его `},`), ДО блока Guardrail 1:
```js
  // Guardrail 7: ноль прямых @base-ui/react вне UI-kit + ноль нативных
  // интерактивных тегов вне kit. Flat-config НЕ мержит no-restricted-syntax →
  // последний матчнувший блок перезатирает; этот блок матчит src/** КРОМЕ
  // src/components/ui/** и КРОМЕ *.test.{ts,tsx} последним, поэтому ПОВТОРЯЕТ
  // rich/markup-селекторы G6 (иначе они слетели бы для прикладного кода).
  // Файлы в ui/ и тесты этот блок игнорит — для ui/ последним остаётся G6
  // (rich/markup), а base-ui/нативные теги там разрешены.
  // ВАЖНО (тесты исключены намеренно): mock-стабы kit-компонентов и тест-харнессы
  // легитимно рендерят нативные <button>/<form> и импортируют @base-ui/react
  // (напр. image-button.test.tsx) — гард на них не распространяется. Подтверждённый
  // ревью список таких файлов: save-offline-button.test, appearance-provider.test,
  // ast-merge-view.test, document-edit-form-conflict.test (и smoke-тесты обёрток в ui/).
  // <input> в гард НЕ включён — отдельный фоллоу-ап (нужны новые примитивы).
  // Исключения в ПРОДАКШН-коде (построчный eslint-disable + комментарий):
  // global-error.tsx (критический root error-boundary на inline-style),
  // canvas editor-text-overlay (абсолютно-позиционированный inline-style textarea).
  // КРИТИЧНО про base-ui-селектор: литеральный «/» внутри тела regex обрывает
  // regex-литерал в грамматике esquery (и /^@base-ui\/react/, и /^@base-ui/react/
  // РУШАТ eslint с «Invalid regular expression»). Слеш кодируем через / —
  // проверено сквозным Linter.verify (esquery 1.6.0 / eslint 9.29.0): матчит
  // @base-ui/react и подпути, пропускает @/components/ui и @base-ui-*.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**", "src/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='rich']",
          message:
            "t.rich(...) запрещён: каталог сообщений держит простое подмножество ICU ради дешёвого свопа i18n-библиотеки за фасадом @/i18n (см. docs/frontend-i18n.md). Используй plain t(key, params).",
        },
        {
          selector: "CallExpression[callee.property.name='markup']",
          message:
            "t.markup(...) запрещён: каталог сообщений держит простое подмножество ICU ради дешёвого свопа i18n-библиотеки за фасадом @/i18n (см. docs/frontend-i18n.md). Используй plain t(key, params).",
        },
        {
          // / === "/"; литеральный слеш в теле esquery-regex рушит парсер (см. коммент выше)
          selector: "ImportDeclaration[source.value=/^@base-ui\\u002freact/]",
          message:
            "Прямой импорт @base-ui/react вне src/components/ui запрещён. Используй обёртку из @/components/ui (новый примитив — добавь обёртку в UI-kit).",
        },
        {
          selector: "JSXOpeningElement[name.name='button']",
          message: "Нативный <button> запрещён вне UI-kit. Используй Button/IconButton из @/components/ui.",
        },
        {
          selector: "JSXOpeningElement[name.name='select']",
          message: "Нативный <select> запрещён вне UI-kit. Используй Select из @/components/ui.",
        },
        {
          selector: "JSXOpeningElement[name.name='form']",
          message: "Нативный <form> запрещён вне UI-kit. Используй Form из @/components/ui.",
        },
        {
          selector: "JSXOpeningElement[name.name='fieldset']",
          message: "Нативный <fieldset> запрещён вне UI-kit. Используй Fieldset из @/components/ui.",
        },
        {
          selector: "JSXOpeningElement[name.name='legend']",
          message: "Нативный <legend> запрещён вне UI-kit. Используй Fieldset (legend-проп) из @/components/ui.",
        },
        {
          selector: "JSXOpeningElement[name.name='textarea']",
          message: "Нативный <textarea> запрещён вне UI-kit. Используй Textarea из @/components/ui.",
        },
      ],
    },
  },
```
> Тестовые файлы (`*.test.tsx`) исключены из гарда через `ignores` (см. блок) — mock-стабы kit-компонентов и харнессы легитимно рендерят нативные `<button>/<form>` и импортируют `@base-ui/react`. Ревью подтвердил 4 таких не-ui файла (`save-offline-button.test`, `appearance-provider.test`, `ast-merge-view.test`, `document-edit-form-conflict.test`) + smoke-тесты обёрток в `ui/`; с `ignores` они НЕ требуют построчных disable. Проверить, что после Task 11 моки этих тестов всё ещё валидны (см. Task 11 Step 5 про `@/components/ui`-мок).

- [ ] **Step 2: Добавить disable к двум исключениям**

`src/app/global-error.tsx` перед `<button` (строка 68):
```tsx
          {/* eslint-disable-next-line no-restricted-syntax -- критический root error-boundary: inline-style ради надёжности при несработавшем CSS, kit-Button недоступен (нет провайдеров) */}
          <button
```
`src/features/canvas/ui/editor-text-overlay.tsx` перед `<textarea` (строка 36):
```tsx
    {/* eslint-disable-next-line no-restricted-syntax -- абсолютно-позиционированный inline-редактор узла канваса, не форм-контрол; shell-стиль Textarea мешает позиционированию */}
    <textarea
```

- [ ] **Step 3: Проверить base-ui-селектор через esquery ДО lint (страховка от мис-копирования)**

Литеральный `/` в теле esquery-regex рушит весь `pnpm lint` с исключением. Перед запуском lint убедиться, что селектор парсится:

```bash
node -e 'require("esquery").parse("ImportDeclaration[source.value=/^@base-ui\\u002freact/]"); console.log("esquery OK")'
```

Expected: `esquery OK` (без исключения). Если бросает «Invalid regular expression» — значит слеш записан литералом/неверно экранирован; исправить на `/` (в JS-исходнике `eslint.config.mjs` — `\\u002f`).

- [ ] **Step 4: Запустить lint — убедиться, что зелёный**

Run: `pnpm lint`
Expected: PASS (0 ошибок). Если всплыли остаточные нативные теги/прямые base-ui — значит миграция Phase 2/3 неполна: вернуться и домигрировать конкретный файл (НЕ глушить disable'ом без обоснования).

- [ ] **Step 5: Коммит**
```bash
git add eslint.config.mjs src/app/global-error.tsx src/features/canvas/ui/editor-text-overlay.tsx
git commit -m "feat(eslint): Guardrail 7 — запрет прямого base-ui и нативных тегов вне UI-kit"
```

---

## Phase 5 — Финальный гейт

### Task 15: Полный гейт lint/test/build

**Files:** —

- [ ] **Step 1: Полный прогон**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное.

- [ ] **Step 2: Перепроверка инварианта «ноль прямых base-ui вне kit»**

Run: `grep -rl "@base-ui/react" src --include="*.tsx" --include="*.ts" | grep -v "src/components/ui/"`
Expected: пустой вывод (ни одного файла).

- [ ] **Step 3: Перепроверка «нет нативных тегов вне kit» (sanity)**

Run: `grep -rEn "<(button|select|form|fieldset|legend|textarea)[ >/]" src --include="*.tsx" | grep -v "src/components/ui/" | grep -v "\.test\."`
Expected: только две задокументированные строки (global-error button, canvas textarea) с соседним eslint-disable.

- [ ] **Step 4: Финальный коммит (если были правки на шагах 1-3)**
```bash
git add <изменённые файлы по имени>
git commit -m "chore(ui): финальный гейт — lint/test/build зелёные, ноль прямых base-ui вне kit"
```

---

## Self-Review (выполнено при написании плана)

**Spec coverage:** все секции spec покрыты — новые обёртки (Tasks 1-5), миграция select/form/button/fieldset/legend/label (Tasks 6-9), required по Zod (Task 10), ast-editor/app-header/dev-ui (Tasks 11-13), ESLint base-ui+native-tag гарды с двумя исключениями (Task 14), находка о сабмите учтена в Task 7 + Task 10 (tokens-manager), финальный гейт (Task 15).

**Placeholder scan:** код обёрток, тестов и ESLint-блока приведён полностью; миграции даны рецептом + worked example + точным списком файлов с номерами строк (мигрируется однотипно — полный дамп 35 файлов раздул бы план без пользы).

**Type/наименование consistency:** `Fieldset({legend?,className?,children})`, `Label(LabelProps)`, `Popover/Toolbar/NavigationMenu` namespace-объекты — имена частей совпадают с base-ui и с использованием в Tasks 11-12. Экспорты в `index.ts` согласованы с импортами потребителей.

## Hardening по многоагентному ревью (2026-06-21)

План прогнан через 7-осевой ревью со сверкой по коду + адверсариальной верификацией (workflow `wx513axba`, 17 агентов). Подтверждённые находки внесены:

- **CRITICAL** — esquery-селектор base-ui (`/^@base-ui\/react/`) рушил `pnpm lint` с исключением → заменён на unicode-escaped (`/`), проверен сквозным `Linter.verify`; добавлен esquery pre-check (Task 14 Step 3).
- **HIGH** — Guardrail 7 ловил 4 не-ui тест-файла (mock-стабы) → в `ignores` добавлен `src/**/*.test.{ts,tsx}`.
- **HIGH** — base-ui `Fieldset.Legend` рендерит `<div>` → форс `render={<legend/>}` + осмысленный тест (Task 1).
- **HIGH** — `lecture-visibility-toggle` авто-сабмит ломался (kit Select без DOM-события) → атомарный рецепт (controlled + `useEffect`+`requestSubmit`) + `forwardRef` на `Form` (Task 6).
- **HIGH** — `toolbar.test`/`image-button.test` мокают `@/components/ui` без `Toolbar` → шаг починки моков (Task 11 Step 5).
- **HIGH** — дефолт `Toolbar.Button` не «вынесен», а введён заново → переформулировано как редизайн-дельта; критерий приёмки — эталон состояний, не «паритет» (Task 4/11, spec).
- **LOW/MEDIUM** — убран heading-select из Task 11; уточнён Task 13 (нет `Field.Root`); исправлен worked-example go-back; добавлены ref-тесты (Popover/Toolbar); поправлен fail-first текст (Vite resolve, не «Cannot find module»); зафиксировано осознанное `no-restricted-syntax` вместо `no-restricted-imports`; уточнено описание search-input (нет clear-кнопки; submit-иконке нужен явный `type="submit"`).

Опровергнутые верификацией (НЕ внесены как баги): «type=submit теряется» (Step 3 уже задаёт `type="submit"`); «план противоречит спеке по no-restricted-imports» (выбор обоснован — flat-config не мержит). Эмпирически подтверждено: все 5 smoke-тестов обёрток зелёные в jsdom против реального base-ui.
