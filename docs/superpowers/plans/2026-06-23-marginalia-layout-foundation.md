# Marginalia Layout Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переделать глобальный лейаут на узкий центрированный «хребет» (~720px) с опциональными полями-маргиналиями по бокам на широких экранах, сохранив непрерывные бордеры и sticky-хедер.

**Architecture:** Один full-width CSS-грид с именованными линиями в корневом `<main>`: `bleed | margin | content(хребет) | margin | bleed`. Дефолт — всё в хребте (обратная совместимость). Опт-ин в поля/full-bleed — через kit-примитивы `MarginNote` / `FullBleed` / `WideShell` (прямые потомки грида). Оси логические → RTL-зеркалирование бесплатно. Полный SSR, ноль клиентского JS.

**Tech Stack:** Next.js App Router (server components), Tailwind CSS v4 (`@theme`, arbitrary values), CSS Grid (named lines, `:where()`, logical props), Vitest + Testing Library, pnpm.

**Spec:** [docs/superpowers/specs/2026-06-23-marginalia-layout-foundation-design.md](../specs/2026-06-23-marginalia-layout-foundation-design.md)

## Global Constraints

- **Менеджер пакетов — только pnpm.** `npm install` ломает тулчейн. Тесты: `pnpm exec vitest run <path>`; линт: `pnpm lint`; билд: `pnpm build`.
- **Гейт перед мержем:** `pnpm lint && pnpm test && pnpm build` — всё зелёное.
- **Общение и UI-копирайт — на русском** (плюс EN-зеркало для i18n-ключей).
- **kit-only (ESLint Guardrail 7):** никаких нативных интерактивных тегов и прямого `base-ui` вне `src/components/ui/`. Новые примитивы — в `src/components/ui/`, экспорт через `src/components/ui/index.ts`.
- **Логические свойства (ESLint Guardrail 10):** запрещены физические `left/right`, `border-l/r`, `ml-/mr-`. Использовать `inset-inline`, `border-inline`, `margin-inline`, `start/end`, именованные грид-линии `*-start/*-end`.
- **Структурные kit-примитивы** (Stack/Inline/MarginNote/FullBleed/WideShell) принимают `className` (раскладка, не вид контрола) — в отличие от leaf-контролов. Для тестируемости класс-строки выносятся в экспортируемые константы (паттерн `STACK_CLASS`).
- **Git (AGENTS.md):** НЕ делать `git add -A`/`.`, НЕ `stash`/`reset`/`checkout .`/`clean`. Коммитить ТОЛЬКО свои файлы по имени: `git add <files> && git commit --only <files>`. Перед коммитом hot-файлов (`globals.css`, `layout.tsx`, `i18n/messages/*`) — `git status`, убедиться что не тянешь чужое.
- **Каждое сообщение коммита** заканчивать строкой:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Foundation-PR:** касание `layout.tsx`, `globals.css`, `src/components/ui/*`, секционных шеллов — здесь легитимно (это и есть foundation-update PR). НЕ пушить без явной просьбы пользователя.
- **Замороженные зоны не расширять:** не трогать `src/api/schema.ts`, `package.json`, `eslint.config.mjs`, `vitest.config.ts`.

---

### Task 1: Layout engine — `layout.css` (токены + грид + классы размещения)

Движок системы: CSS-переменные ширины, грид с именованными линиями, дефолт-колонка, декоративный бордер хребта, классы для примитивов. Токены — hand-authored (как `--header-height` в `globals.css`), НЕ через генератор токенов.

**Files:**
- Create: `src/styles/layout.css`
- Create (test): `src/styles/layout.test.ts`
- Modify: `src/app/globals.css:1-4` (добавить `@import`)

**Interfaces:**
- Produces (CSS-контракт, потребляется Tasks 2–6):
  - Класс `page-grid` — грид-контейнер (на `<main>`).
  - Класс `spine-frame` — декоративный бордер хребта.
  - Классы размещения: `col-margin-start`, `col-margin-end`, `col-bleed`.
  - Классы collapse: `margin-note--inline`, `margin-note--hidden`.
  - CSS-vars: `--layout-spine` (45rem), `--layout-margin` (0 → 14rem на ≥1280px), `--layout-gutter` (2rem).

- [ ] **Step 1: Написать падающий тест на содержимое CSS**

`src/styles/layout.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/styles/layout.css"), "utf-8");
const globals = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf-8");

describe("layout.css", () => {
  it("определяет токены ширины хребта/полей/зазора", () => {
    expect(css).toContain("--layout-spine: 45rem");
    expect(css).toContain("--layout-margin: 0px");
    expect(css).toContain("--layout-gutter: 2rem");
  });

  it("раскрывает поля только на >= 1280px", () => {
    expect(css).toMatch(/@media \(min-width:\s*1280px\)[\s\S]*--layout-margin:\s*14rem/);
  });

  it("грид page-grid использует именованные логические линии", () => {
    expect(css).toContain(".page-grid");
    expect(css).toContain("[content-start]");
    expect(css).toContain("[content-end]");
    expect(css).toContain("[margin-start]");
    expect(css).toContain("[margin-end]");
    expect(css).toContain("[bleed-start]");
    expect(css).toContain("[bleed-end]");
    expect(css).toContain("align-content: start");
  });

  it("дефолт-потомок едет в хребет через :where() (нулевая специфичность)", () => {
    expect(css).toMatch(/:where\(\.page-grid > \*:not\(\.spine-frame\)\)/);
  });

  it("классы размещения и collapse определены логически", () => {
    expect(css).toContain(".col-margin-start");
    expect(css).toContain(".col-margin-end");
    expect(css).toContain(".col-bleed");
    expect(css).toContain(".margin-note--inline");
    expect(css).toContain(".margin-note--hidden");
  });

  it("бордер хребта логический (border-inline) и только md+", () => {
    expect(css).toMatch(/@media \(min-width:\s*768px\)[\s\S]*border-inline/);
  });

  it("spine-frame держит непрерывность бордера (§5): inset-block/центрирование/ширина", () => {
    expect(css).toMatch(/\.spine-frame[\s\S]*inset-block:\s*0/);
    expect(css).toMatch(/\.spine-frame[\s\S]*margin-inline:\s*auto/);
    expect(css).toMatch(/\.spine-frame[\s\S]*inline-size:\s*min\(\s*var\(--layout-spine\)/);
  });

  it("в app/wide-режиме (есть .col-bleed) хребет-бордер гасится (§6)", () => {
    expect(css).toMatch(/\.page-grid:has\(>\s*\.col-bleed\)[\s\S]*\.spine-frame[\s\S]*display:\s*none/);
  });

  it("CSS на логических осях — нет физических left/right свойств", () => {
    expect(css).not.toMatch(/(^|[\s;{])(margin|padding|border|inset)-(left|right)/);
    expect(css).not.toMatch(/[\s;{](left|right)\s*:/);
  });

  it("globals.css импортирует layout.css", () => {
    expect(globals).toContain('@import "../styles/layout.css"');
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/styles/layout.test.ts`
Expected: FAIL — `ENOENT: ... layout.css` (файл ещё не создан).

- [ ] **Step 3: Создать `src/styles/layout.css`**

```css
/* src/styles/layout.css
   Глобальная система лейаута: центрированный «хребет» (content) + поля
   (margin-start/-end) для маргиналий + full-bleed escape. Все оси ЛОГИЧЕСКИЕ
   (грид раскладывает колонки вдоль inline-оси → следует dir → RTL-зеркалирование
   бесплатно). Дизайн:
   docs/superpowers/specs/2026-06-23-marginalia-layout-foundation-design.md */

:root {
  --layout-spine: 45rem;   /* ~720px: читаемая ширина хребта */
  --layout-margin: 0px;    /* поля скрыты по умолчанию; раскрываются на >= xl */
  --layout-gutter: 2rem;   /* зазор хребет <-> поле */
}

/* Поля раскрываются только когда есть место (>= --breakpoint-xl = 1280px). */
@media (min-width: 1280px) {
  :root { --layout-margin: 14rem; }   /* ~224px = ширина нав-сайдбара (w-56) */
}

/* Грид корневого <main>. Именованные линии вдоль inline-оси:
   bleed(1fr) | margin | content(spine) | margin | bleed(1fr).
   column-gap (только на xl) рисует зазоры; ниже xl margin=0 и gap=0 →
   поля схлопываются, 1fr-края центрируют хребет (как сейчас). */
.page-grid {
  display: grid;
  inline-size: 100%;
  grid-template-columns:
    [bleed-start] minmax(0, 1fr)
    [margin-start] minmax(0, var(--layout-margin))
    [content-start] min(var(--layout-spine), 100%)
    [content-end] minmax(0, var(--layout-margin))
    [margin-end] minmax(0, 1fr)
    [bleed-end];
  column-gap: 0;
  align-content: start;   /* контент пакуется к верху — без растяжки по высоте */
  position: relative;     /* якорь containing-block для .spine-frame */
  isolation: isolate;     /* локальный stacking-context для z-index бордера */
}

@media (min-width: 1280px) {  /* = --breakpoint-xl, держать синхронно с tokens.generated.css (media не читает var()) */
  .page-grid { column-gap: var(--layout-gutter); }
}

/* Дефолт: любой прямой потомок (кроме декоративного бордера) едет в хребет.
   :where() → нулевая специфичность → классы размещения ниже легко перебивают.
   Обратная совместимость: старые страницы со своим mx-auto max-w-* авто-
   вписываются в content-колонку. */
:where(.page-grid > *:not(.spine-frame)) {
  grid-column: content-start / content-end;
}

/* Декоративный бордер хребта: непрерывная вертикаль во всю высоту main.
   Абсолют + центрирование во всю ширину main → не зависит от грид-строк
   контента. border-inline (логический) → корректно в RTL. Только md+. */
.spine-frame {
  position: absolute;
  inset-block: 0;
  inset-inline: 0;
  margin-inline: auto;
  inline-size: min(var(--layout-spine), 100%);
  pointer-events: none;
  z-index: -1;
}
@media (min-width: 768px) {  /* 768 = --breakpoint-md, держать синхронно с tokens.generated.css */
  .spine-frame { border-inline: 1px solid var(--color-border); }
}

/* App/wide-режим: страница использует FullBleed/WideShell (оба эмитят .col-bleed
   прямым потомком .page-grid) → хребет-бордер не нужен (спека §6: «секции теряют
   внешний хребет-бордер»). Без этого правила фантомная 720-линия просвечивала бы
   за широким контентом /me,/admin,/lectures,/canvases. :has() поддержан во всех
   актуальных браузерах, SSR/zero-JS-совместим. */
.page-grid:has(> .col-bleed) .spine-frame { display: none; }

/* ── Классы размещения (потребляются kit-примитивами; элемент ДОЛЖЕН быть
   ПРЯМЫМ потомком .page-grid — иначе grid-column не сошлётся на именованные линии
   грида; для эмиссии из глубины дерева — поднять во фрагмент (см. Task 6) или
   дождаться subgrid-обёртки (следующая итерация, спека §4)) ── */
.col-margin-start { grid-column: margin-start / content-start; }
.col-margin-end   { grid-column: content-end / margin-end; }
.col-bleed        { grid-column: bleed-start / bleed-end; }

/* Поведение маргиналий на узких экранах (< xl): inline втекает в хребет под
   своим местом; hidden прячется. */
@media (max-width: 1279.98px) {  /* < --breakpoint-xl (1280) */
  .margin-note--inline { grid-column: content-start / content-end; }
  .margin-note--hidden { display: none; }
}
```

- [ ] **Step 4: Подключить импорт в `globals.css`**

Изменить шапку `src/app/globals.css` (строки 1–4) — добавить импорт ПОСЛЕ `content.css`:

```css
@import "tailwindcss";

@import "../styles/tokens.generated.css";
@import "../styles/content.css";
@import "../styles/layout.css";
```

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/styles/layout.test.ts`
Expected: PASS (все кейсы зелёные).

- [ ] **Step 6: Линт**

Run: `pnpm lint`
Expected: без ошибок в `src/styles/layout.css` и `src/app/globals.css`.

- [ ] **Step 7: Коммит**

```bash
git status   # убедиться, что globals.css не несёт чужих правок
git add src/styles/layout.css src/styles/layout.test.ts src/app/globals.css
git commit --only src/styles/layout.css src/styles/layout.test.ts src/app/globals.css -m "$(cat <<'EOF'
feat(layout): движок грида хребет+поля (layout.css)

Именованный CSS-грид (bleed|margin|content|margin|bleed), токены ширины,
дефолт-колонка через :where(), декоративный бордер хребта, классы
размещения/collapse. Логические оси → RTL бесплатно. Пока не подключён к <main>.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Примитив `MarginNote`

Kit-компонент для контента в поле. Рендерит `<aside>` в нужную колонку; на `<xl` сворачивается по `collapse`.

**Files:**
- Create: `src/components/ui/margin-note.tsx`
- Create (test): `src/components/ui/margin-note.test.tsx`
- Modify: `src/components/ui/index.ts` (экспорт)

**Interfaces:**
- Consumes: классы `col-margin-start`/`col-margin-end`/`margin-note--inline`/`margin-note--hidden` из Task 1; `cn` из `./cn`.
- Produces: `MarginNote`, `type MarginNoteProps`, `MARGIN_NOTE_SIDE` (для тестов). Сигнатура: `({ side: "start" | "end", collapse?: "inline" | "hidden", className?, children }) => JSX`.

- [ ] **Step 1: Написать падающий тест**

`src/components/ui/margin-note.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarginNote, MARGIN_NOTE_SIDE } from "./margin-note";

afterEach(cleanup);

describe("MarginNote", () => {
  it("карта сторон использует логические колонки", () => {
    expect(MARGIN_NOTE_SIDE.start).toBe("col-margin-start");
    expect(MARGIN_NOTE_SIDE.end).toBe("col-margin-end");
  });

  it("рендерит <aside> (complementary) с классом стороны", () => {
    render(<MarginNote side="end">note</MarginNote>);
    const aside = screen.getByRole("complementary");
    expect(aside.tagName).toBe("ASIDE");
    expect(aside).toHaveClass("col-margin-end");
  });

  it("по умолчанию collapse=inline", () => {
    render(<MarginNote side="start">x</MarginNote>);
    expect(screen.getByRole("complementary")).toHaveClass("margin-note--inline");
  });

  it("collapse=hidden даёт класс скрытия", () => {
    render(<MarginNote side="start" collapse="hidden">x</MarginNote>);
    expect(screen.getByRole("complementary")).toHaveClass("margin-note--hidden");
  });

  it("прокидывает className и children (structural → className открыт)", () => {
    render(<MarginNote side="end" className="text-sm">payload</MarginNote>);
    const aside = screen.getByRole("complementary");
    expect(aside).toHaveClass("text-sm");
    expect(aside).toHaveTextContent("payload");
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/components/ui/margin-note.test.tsx`
Expected: FAIL — `Failed to resolve import "./margin-note"`.

- [ ] **Step 3: Реализовать компонент**

`src/components/ui/margin-note.tsx`:

```tsx
// src/components/ui/margin-note.tsx
import type { ReactNode } from "react";

import { cn } from "./cn";

/** Карта стороны → логическая грид-колонка (RTL-зеркалирование бесплатно). */
export const MARGIN_NOTE_SIDE = {
  start: "col-margin-start",
  end: "col-margin-end",
} as const;

/** Карта поведения на узких экранах (< xl). */
const COLLAPSE_CLASS = {
  inline: "margin-note--inline",
  hidden: "margin-note--hidden",
} as const;

export interface MarginNoteProps {
  /** Логическая сторона: start (инлайн-начало) | end (инлайн-конец). */
  side: keyof typeof MARGIN_NOTE_SIDE;
  /** Поведение на < xl (1280px): inline — втекает в поток (default); hidden — скрыт. */
  collapse?: keyof typeof COLLAPSE_CLASS;
  className?: string;
  children: ReactNode;
}

/**
 * Маргиналия: контент в поле слева/справа от хребта. Появляется только на >= xl
 * (1280px); ниже — по `collapse`. ДОЛЖЕН быть прямым потомком `.page-grid`
 * (страница возвращает фрагмент: контент-хребет + <MarginNote>). Server-rendered,
 * RTL — через логические грид-линии. Structural-примитив → className ОТКРЫТ.
 */
export function MarginNote({ side, collapse = "inline", className, children }: MarginNoteProps) {
  return (
    <aside className={cn(MARGIN_NOTE_SIDE[side], COLLAPSE_CLASS[collapse], className)}>
      {children}
    </aside>
  );
}
```

- [ ] **Step 4: Экспортировать из kit-индекса**

Добавить в `src/components/ui/index.ts` (рядом со Stack/Inline):

```ts
export { MarginNote, MARGIN_NOTE_SIDE, type MarginNoteProps } from "./margin-note";
```

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/components/ui/margin-note.test.tsx`
Expected: PASS.

- [ ] **Step 6: Коммит**

```bash
git add src/components/ui/margin-note.tsx src/components/ui/margin-note.test.tsx src/components/ui/index.ts
git commit --only src/components/ui/margin-note.tsx src/components/ui/margin-note.test.tsx src/components/ui/index.ts -m "$(cat <<'EOF'
feat(ui): примитив MarginNote (контент в поле хребта)

<aside> в логическую колонку margin-start/-end, collapse inline|hidden на <xl.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Примитивы `FullBleed` + `WideShell`

`FullBleed` — escape из хребта на всю ширину (карта/3D). `WideShell` — full-bleed + центрированный кап (app-секции: `/me`, `/admin`, широкие страницы).

**Files:**
- Create: `src/components/ui/full-bleed.tsx`
- Create (test): `src/components/ui/full-bleed.test.tsx`
- Create: `src/components/ui/wide-shell.tsx`
- Create (test): `src/components/ui/wide-shell.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Consumes: класс `col-bleed` из Task 1; `cn` из `./cn`.
- Produces:
  - `FullBleed`, `type FullBleedProps`, `FULL_BLEED_CLASS = "col-bleed"`. Сигнатура: `({ className?, children }) => JSX`.
  - `WideShell`, `type WideShellProps`, `WIDE_SHELL_INNER = "mx-auto w-full max-w-screen-lg"`. Сигнатура: `({ className?, children }) => JSX`.

- [ ] **Step 1: Написать падающие тесты**

`src/components/ui/full-bleed.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FullBleed, FULL_BLEED_CLASS } from "./full-bleed";

afterEach(cleanup);

describe("FullBleed", () => {
  it("FULL_BLEED_CLASS — логическая bleed-колонка", () => {
    expect(FULL_BLEED_CLASS).toBe("col-bleed");
  });
  it("рендерит детей в bleed-обёртке + прокидывает className", () => {
    render(<FullBleed className="h-[80vh]"><span>scene</span></FullBleed>);
    const el = screen.getByText("scene").parentElement!;
    expect(el).toHaveClass("col-bleed");
    expect(el).toHaveClass("h-[80vh]");
  });
});
```

`src/components/ui/wide-shell.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WideShell, WIDE_SHELL_INNER } from "./wide-shell";

afterEach(cleanup);

describe("WideShell", () => {
  it("внутренний контейнер центрирован и капнут до screen-lg", () => {
    expect(WIDE_SHELL_INNER).toContain("mx-auto");
    expect(WIDE_SHELL_INNER).toContain("max-w-screen-lg");
  });
  it("оборачивает детей в bleed → центрированный кап", () => {
    render(<WideShell><span>dash</span></WideShell>);
    const inner = screen.getByText("dash").parentElement!;
    expect(inner).toHaveClass("max-w-screen-lg");
    const bleed = inner.parentElement!;
    expect(bleed).toHaveClass("col-bleed");
  });
});
```

- [ ] **Step 2: Запустить тесты — убедиться, что падают**

Run: `pnpm exec vitest run src/components/ui/full-bleed.test.tsx src/components/ui/wide-shell.test.tsx`
Expected: FAIL — модули не резолвятся.

- [ ] **Step 3: Реализовать `FullBleed`**

`src/components/ui/full-bleed.tsx`:

```tsx
// src/components/ui/full-bleed.tsx
import type { ReactNode } from "react";

import { cn } from "./cn";

/** Логическая bleed-колонка грида (на всю ширину viewport). */
export const FULL_BLEED_CLASS = "col-bleed";

export interface FullBleedProps {
  className?: string;
  children: ReactNode;
}

/**
 * Full-bleed регион: escape из хребта на всю ширину. ДОЛЖЕН быть прямым потомком
 * `.page-grid`. Для широких app-страниц с капом ширины используй <WideShell>.
 * Structural-примитив → className ОТКРЫТ.
 */
export function FullBleed({ className, children }: FullBleedProps) {
  return <div className={cn(FULL_BLEED_CLASS, className)}>{children}</div>;
}
```

- [ ] **Step 4: Реализовать `WideShell`**

`src/components/ui/wide-shell.tsx`:

```tsx
// src/components/ui/wide-shell.tsx
import type { ReactNode } from "react";

import { cn } from "./cn";
import { FULL_BLEED_CLASS } from "./full-bleed";

/** Центрированный кап широкого шелла (= прежний max-w корневого main). */
export const WIDE_SHELL_INNER = "mx-auto w-full max-w-screen-lg";

export interface WideShellProps {
  className?: string;
  children: ReactNode;
}

/**
 * Широкий app-шелл: full-bleed escape + центрированный кап max-w-screen-lg.
 * Для дашбордов/гридов/секционных шеллов (/me, /admin) и страниц, которым тесен
 * 720-хребет и не нужны поля. ДОЛЖЕН быть прямым потомком `.page-grid`.
 */
export function WideShell({ className, children }: WideShellProps) {
  return (
    <div className={FULL_BLEED_CLASS}>
      <div className={cn(WIDE_SHELL_INNER, className)}>{children}</div>
    </div>
  );
}
```

- [ ] **Step 5: Экспортировать из kit-индекса**

Добавить в `src/components/ui/index.ts` непосредственно после строки `MarginNote` (Task 2), сохранив непрерывный блок structural-примитивов Stack → Inline → MarginNote → FullBleed → WideShell:

```ts
export { FullBleed, FULL_BLEED_CLASS, type FullBleedProps } from "./full-bleed";
export { WideShell, WIDE_SHELL_INNER, type WideShellProps } from "./wide-shell";
```

- [ ] **Step 6: Запустить тесты — убедиться, что проходят**

Run: `pnpm exec vitest run src/components/ui/full-bleed.test.tsx src/components/ui/wide-shell.test.tsx`
Expected: PASS.

- [ ] **Step 7: Коммит**

```bash
git add src/components/ui/full-bleed.tsx src/components/ui/full-bleed.test.tsx src/components/ui/wide-shell.tsx src/components/ui/wide-shell.test.tsx src/components/ui/index.ts
git commit --only src/components/ui/full-bleed.tsx src/components/ui/full-bleed.test.tsx src/components/ui/wide-shell.tsx src/components/ui/wide-shell.test.tsx src/components/ui/index.ts -m "$(cat <<'EOF'
feat(ui): примитивы FullBleed + WideShell (escape из хребта)

FullBleed — на всю ширину; WideShell — bleed + центр-кап max-w-screen-lg.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Подключить грид к корневому `<main>` + бордер хребта + ширина хедера

Первое видимое изменение: `<main>` становится `page-grid`, добавляется декоративный бордер, хедер сужается до ширины хребта. Существующие страницы авто-вписываются в 720-хребет.

**Files:**
- Modify: `src/app/layout.tsx:146-148` (элемент `<main>`)
- Modify: `src/components/app/app-header/app-header.tsx:19` (`NavigationMenu.Root`)

**Interfaces:**
- Consumes: классы `page-grid`, `spine-frame` (Task 1); CSS-var `--layout-spine`.

> **Почему build + visual QA, а не unit-тест:** изменяется серверный async-`RootLayout` (зависит от `getMe`, `headers`, провайдеров) и computed-раскладка грида, которую jsdom не вычисляет. Корректность верифицируется билдом + браузерным QA по чеклисту (это устоявшаяся практика проекта для слоёв карты/3D/RTL). Поведение примитивов и движка уже покрыто Tasks 1–3.
>
> **⚠ Промежуточное состояние (коммит 4 → коммит 5):** после этого коммита и ДО Task 5 широкие страницы (/me, /admin, canvases, lectures, dev/ui) временно сжаты в 720-хребет, а map/graph несут вложенный `<main>` (двойной landmark) и сцену шириной хребта. Это приемлемо ТОЛЬКО потому, что Task 4 и Task 5 уходят в одном foundation-PR последовательными коммитами и НЕ пушатся/мержатся по-отдельности (Global Constraints: не пушить без явной просьбы). НЕ оценивать визуал на SHA между коммитами 4 и 5.

- [ ] **Step 1: Переписать `<main>` в `src/app/layout.tsx`**

Заменить строки 146–148:

```tsx
                  <main className="w-[100vw] max-w-[100vw] lg:w-full lg:max-w-screen-lg flex flex-col items-center md:border-x md:border-(--color-border)">
                    {children}
                  </main>
```

на:

```tsx
                  <main className="page-grid">
                    <div className="spine-frame" aria-hidden="true" />
                    {children}
                  </main>
```

- [ ] **Step 2: Сузить хедер до ширины хребта**

В `src/components/app/app-header/app-header.tsx` строка 19 — заменить `max-w-[100vw] lg:max-w-screen-lg` на `max-w-[var(--layout-spine)]` (бордеры хедера продолжат линию хребта):

```tsx
      <NavigationMenu.Root className="w-full max-w-[var(--layout-spine)] md:border-x border-(--color-border) bg-(--color-surface) px-4">
```

- [ ] **Step 3: Линт + типы + билд**

Run: `pnpm lint && pnpm build`
Expected: без ошибок. (Билд прогоняет `generate-tokens` + `next build`.)

- [ ] **Step 4: Прогнать весь тест-сьют (регрессий нет)**

Run: `pnpm test`
Expected: PASS (как минимум не хуже базы; layout-снапшотов на `<main>` нет — проверить, что красных нет).

- [ ] **Step 5: Браузерный QA-чеклист**

Run: `pnpm dev` → открыть `http://localhost:3001/` и любую контент-страницу (`/trails`). Проверить:
- **Десктоп ~1024px:** контент в центрированном ~720-хребте; вертикальные бордеры слева/справа от хребта непрерывны и совпадают с бордерами хедера (одна линия сверху вниз).
- **Широкий ~1440px:** хребет остаётся ~720 по центру; по бокам пустые поля (контента полей пока нет — это норма).
- **Планшет 768–1024:** хребет центрирован + бордеры; полей нет.
- **Мобайл 375px:** контент на всю ширину, без боковых бордеров; без горизонтального скролла.
- **Вертикаль:** короткая страница НЕ растягивает контент на всю высоту (флоу сверху вниз); фон добивает вьюпорт.
- **Ширина прозы:** существующие `max-w-3xl`(768)-страницы (документы/тропы/глоссарий) визуально сузятся до хребта 720 (~48px уже) — это **ожидаемо** (хребет = читаемая мера), НЕ баг.
- **Баннеры:** StatusBanner/ActiveBanners/InstallBanner — сиблинги `<main>`, остаются full-bleed (на всю ширину, только нижний бордер) — это намеренно (системный слой над листом, см. спека §5). Убедиться, что нижний бордер баннера не выглядит «оборванным» относительно боковых бордеров хребта.
- **RTL:** переключить локаль на язык с `dir=rtl` (или временно `<html dir="rtl">` в devtools) — хребет симметричен, бордеры на месте.

- [ ] **Step 6: Коммит**

```bash
git status   # layout.tsx / app-header.tsx — без чужих правок
git add src/app/layout.tsx src/components/app/app-header/app-header.tsx
git commit --only src/app/layout.tsx src/components/app/app-header/app-header.tsx -m "$(cat <<'EOF'
feat(layout): <main> на page-grid, хедер на ширину хребта

Узкий 720-хребет + декоративный бордер; хедер сужен до --layout-spine,
непрерывная вертикаль. Контент течёт сверху вниз без растяжки. Старые
страницы авто-вписываются в content-колонку.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Перевести широкие/full-bleed шеллы и страницы на escape из хребта

Страницы шире 720, которым тесен хребет: секционные шеллы (`/me`, `/admin`) и широкие/сценовые страницы (`map`, `graph`, `canvases/[id]`, список `lectures`). Без этого они сожмутся до 720 (регрессия). Карта/граф также чинят пре-existing вложенный `<main>`.

**Files:**
- Modify: `src/app/me/layout.tsx:27-38`
- Modify: `src/app/admin/layout.tsx:31-57`
- Modify: `src/app/map/page.tsx` (оба `return` с `<main className="h-[80vh] w-full">`, строки ~21-23 и ~44-46)
- Modify: `src/app/graph/page.tsx` (оба `return`, строки ~17-19 и ~27-29)
- Modify: `src/app/canvases/[id]/page.tsx:43`
- Modify: `src/app/canvases/[id]/edit/page.tsx` (корневой `<div className="flex flex-col">` без max-w — редактор канвы)
- Modify: `src/app/dev/ui/page.tsx` (корневой `<div className="flex flex-col gap-10 p-8">` без max-w — витрина дизайна)
- Modify: `src/app/lectures/page.tsx:48`
- Create (test): `src/app/map/single-main.test.ts`

**Interfaces:**
- Consumes: `WideShell`, `FullBleed` из `@/components/ui` (Task 3).

> **Verify:** build + visual QA (серверные шеллы/страницы; примитивы уже покрыты Task 3) + source-тест на единственность `<main>` (Step 7a).
>
> **Аудит ширины (обоснование охвата):** прогнан `find src/app -name page.tsx` на отсутствие корневого `max-w`. Регрессируют (шире 720, не под /me): `map`,`graph` (full-bleed-сцены), `canvases/[id]` (4xl), `canvases/[id]/edit` (редактор, без max-w), `dev/ui` (витрина, без max-w), `lectures` (5xl) → все в Task 5. `/saved` НЕ регрессирует (SavedList сам несёт `mx-auto max-w-3xl` — авто-вписывается, как ~24 прозовые страницы). Короткие auth/utility-страницы (login/register/push/offline/share-links/home) центрируются в хребте намеренно.

- [ ] **Step 1: `/me` layout — обернуть в `WideShell`**

В `src/app/me/layout.tsx` добавить импорт и обернуть возвращаемую разметку. Импорт:

```tsx
import { WideShell } from "@/components/ui";
```

`return` (строки 27–38) — обернуть существующий `<div className="flex flex-col lg:flex-row">…</div>` в `<WideShell>`:

```tsx
  return (
    <WideShell>
      <div className="flex flex-col lg:flex-row">
        <aside className="sticky top-(--header-height) z-10 border-b border-(--color-border) bg-(--color-surface) p-4 lg:w-56 lg:shrink-0 lg:self-start lg:border-b-0 lg:border-e">
          <NavRail
            items={items}
            ariaLabel={t("meNavAriaLabel")}
            orientation="responsive"
          />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </WideShell>
  );
```

> Внутренний `<main>` заменён на `<div>`: корневой layout.tsx уже несёт единственный landmark `<main className="page-grid">`, второй `<main>` внутри него — невалидный HTML / a11y-дефект (устранение пре-existing двойного landmark, тот же приём, что для map/graph ниже).

- [ ] **Step 2: `/admin` layout — обернуть в `WideShell`**

В `src/app/admin/layout.tsx` добавить `WideShell` в импорт из `@/components/ui` (строка 6 уже импортирует `RouterLink` — дописать):

```tsx
import { RouterLink, WideShell } from "@/components/ui";
```

`return` (строки 31–57) — обернуть `<div className="flex min-h-...">…</div>` в `<WideShell>`:

```tsx
  return (
    <WideShell>
      <div className="flex min-h-[calc(100vh-var(--header-height))] w-full">
        <aside className="w-56 shrink-0 border-e border-(--color-border) bg-(--color-surface-subtle) p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <RouterLink
              href="/"
              className="inline-flex items-center gap-1 text-xs text-(--color-fg-muted) hover:underline"
            >
              <ChevronIcon className="rtl-flip rotate-180" />
              {t("shellBackToSite")}
            </RouterLink>
            <h2 className="text-lg font-bold">{t("shellTitle")}</h2>
            {me && (
              <span className="text-xs text-(--color-fg-muted) break-all">
                {me.username}
              </span>
            )}
          </div>
          <NavRail
            items={navItems}
            ariaLabel={t("shellNavAriaLabel")}
            orientation="vertical"
          />
        </aside>
        <div className="flex-1 min-w-0 p-6">{children}</div>
      </div>
    </WideShell>
  );
```

> Внутренний `<main>` → `<div>` (как в /me Step 1): единственный landmark `<main>` — корневой.

- [ ] **Step 3: `map` — FullBleed + починить вложенный `<main>`**

В `src/app/map/page.tsx` добавить импорт:

```tsx
import { FullBleed } from "@/components/ui";
```

Оба места, где возвращается `<main className="h-[80vh] w-full">…</main>`, заменить на (вложенный `<main>` → `<div>`, обёрнутый в `FullBleed` — устраняет двойной `<main>` и даёт полную ширину сцены):

```tsx
    return (
      <FullBleed>
        <div className="h-[80vh] w-full">
          {/* …существующее содержимое… */}
        </div>
      </FullBleed>
    );
```

- [ ] **Step 4: `graph` — FullBleed + починить вложенный `<main>`**

В `src/app/graph/page.tsx` — аналогично Step 3: импорт `FullBleed`, оба `<main className="h-[80vh] w-full">` → `<FullBleed><div className="h-[80vh] w-full">…</div></FullBleed>`.

- [ ] **Step 5: `canvases/[id]` — обернуть в `WideShell`**

В `src/app/canvases/[id]/page.tsx` добавить `WideShell` в импорт из `@/components/ui`, обернуть корневой `<div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">…</div>` (строка 43) в `<WideShell>…</WideShell>` (внутренний `mx-auto max-w-4xl` оставить — он центрирует контент внутри 1024-капа, сохраняя прежнюю ~896 ширину).

- [ ] **Step 6: `lectures` список — обернуть в `WideShell`**

В `src/app/lectures/page.tsx` добавить `WideShell` в импорт из `@/components/ui`, обернуть корневой `<div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">…</div>` (строка 48) в `<WideShell>…</WideShell>`.

- [ ] **Step 6a: `canvases/[id]/edit` — обернуть в `WideShell`**

В `src/app/canvases/[id]/edit/page.tsx` корневой `<div className="flex flex-col">` (без max-w → сейчас занимает полный 1024-main, после Task 4 сжался бы до 720) обернуть в `<WideShell>` (импорт из `@/components/ui`). В QA (Step 8) проверить, что редактору канвы хватает ~1024; если визуальному холсту нужна ВСЯ ширина viewport — заменить `WideShell` на `FullBleed` (решение по результату QA).

- [ ] **Step 6b: `dev/ui` — обернуть в `WideShell`**

В `src/app/dev/ui/page.tsx` корневой `<div className="flex flex-col gap-10 p-8">` (без max-w, APCA-матрице/витрине нужна ширина) обернуть в `<WideShell>` (импорт из `@/components/ui`).

- [ ] **Step 7: Линт + билд**

Run: `pnpm lint && pnpm build`
Expected: без ошибок. (ESLint Guardrail на cross-feature/deep-импорты — импорт `@/components/ui` легален.)

- [ ] **Step 7a: Source-тест на единственность `<main>` (map/graph)**

Закрепить устранение двойного landmark машинно (RTL-рендер этих server-страниц затруднён — проверяем исходник, как `layout.test.ts` проверяет CSS). Создать `src/app/map/single-main.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

// Единственный landmark <main> на странице — корневой (layout.tsx). map/graph
// после Task 5 НЕ должны рендерить собственный <main> (были вложенные → <div>).
describe("single <main> landmark", () => {
  for (const page of ["src/app/map/page.tsx", "src/app/graph/page.tsx"]) {
    it(`${page} не содержит <main>`, () => {
      const src = readFileSync(resolve(process.cwd(), page), "utf-8");
      expect(src).not.toMatch(/<main\b/);
    });
  }
});
```

Run: `pnpm exec vitest run src/app/map/single-main.test.ts`
Expected: PASS после правок map/graph (FAIL до них — на текущем `<main className="h-[80vh] w-full">`).

- [ ] **Step 8: Браузерный QA-чеклист**

Run: `pnpm dev`. Проверить (на ~1024 и ~1440):
- `/me/documents`: сайдбар + контент во флоу, общая ширина ~1024 (НЕ сжата до 720), сайдбар не уехал в поля. **Проскроллить длинный список — NavRail-сайдбар прилипает под хедером (sticky жив).**
- `/admin` (под админом): сайдбар + контент, ширина ~1024.
- `/map`, `/graph`: сцена на всю ширину viewport.
- `/canvases/<id>`, `/canvases/<id>/edit`, `/dev/ui`, `/lectures`: контент ~896/1024 как прежде, не сжат до 720.
- **DOM-инвариант:** `document.querySelectorAll('main').length === 1` на /me/*, /admin/*, /map, /graph, /canvases/[id], /canvases/[id]/edit, /lectures.
- **Хребет-бордер опт-аут (находка spine-frame):** на /me, /admin, /lectures, /canvases (≥1280px) НЕТ фантомной вертикальной 720-линии, просвечивающей сквозь широкий контент (правило `.page-grid:has(> .col-bleed) .spine-frame { display:none }` из Task 1).
- RTL: у `/me`,`/admin` сайдбар на инлайн-начале (зеркалится).

- [ ] **Step 9: Коммит**

```bash
git status
git add src/app/me/layout.tsx src/app/admin/layout.tsx src/app/map/page.tsx src/app/graph/page.tsx "src/app/canvases/[id]/page.tsx" "src/app/canvases/[id]/edit/page.tsx" src/app/dev/ui/page.tsx src/app/lectures/page.tsx src/app/map/single-main.test.ts
git commit --only src/app/me/layout.tsx src/app/admin/layout.tsx src/app/map/page.tsx src/app/graph/page.tsx "src/app/canvases/[id]/page.tsx" "src/app/canvases/[id]/edit/page.tsx" src/app/dev/ui/page.tsx src/app/lectures/page.tsx src/app/map/single-main.test.ts -m "$(cat <<'EOF'
feat(layout): широкие/full-bleed страницы escape из хребта

/me,/admin,canvases/[id],canvases/[id]/edit,dev/ui,lectures → WideShell
(кап ~1024); map,graph → FullBleed на всю ширину. Вложенный <main> → <div>
во всех (единственный landmark — корневой), source-тест на это.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Референс — прозовая страница на полный хребет + демо `MarginNote`

Доказать фундамент end-to-end на реальной странице: документ заполняет полный хребет (снят внутренний `max-w-3xl`) и эмитит демонстрационную маргиналию, которая на ≥xl видна в поле, на <xl втекает в поток, и присутствует в SSR-HTML.

**Files:**
- Modify: `src/app/documents/[id]/page.tsx:54-117`
- Modify: `src/i18n/messages/en/pages.ts` (новый ключ ~строка 165)
- Modify: `src/i18n/messages/ru/pages.ts` (новый ключ ~строка 165)

**Interfaces:**
- Consumes: `MarginNote` из `@/components/ui` (Task 2); i18n-ключ `documentMarginHint` namespace `pages`.

> **Verify:** build + visual QA + проверка SSR (текст маргиналии во view-source).

- [ ] **Step 1: Добавить i18n-ключ (EN)**

В `src/i18n/messages/en/pages.ts` рядом с document-ключами (после строки 165, перед следующей группой) добавить:

```ts
  documentMarginHint: "Notes in the margin appear here on wide screens.",
```

- [ ] **Step 2: Добавить i18n-ключ (RU)**

В `src/i18n/messages/ru/pages.ts` в том же месте добавить:

```ts
  documentMarginHint: "Заметки на полях появляются здесь на широких экранах.",
```

- [ ] **Step 3: Импортировать `MarginNote` в странице документа**

В `src/app/documents/[id]/page.tsx` строка 5 — дописать `MarginNote` в импорт из `@/components/ui`:

```tsx
import { MarginNote, RouterLink, Skeleton } from "@/components/ui";
```

- [ ] **Step 4: Обернуть return во фрагмент: контент-хребет + демо-маргиналия**

Заменить корневой `<div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">` (строка 55) и закрывающий `</div>` (строка 117) так, чтобы возвращался фрагмент с двумя прямыми потомками грида. Снять `mx-auto max-w-3xl` (контент теперь занимает полный хребет), сохранить вертикальный ритм/паддинг:

```tsx
  return (
    <>
      <div className="flex flex-col gap-8 p-6">
        <header className="flex items-center justify-between gap-4">
          {/* …существующее содержимое header… */}
        </header>

        <DocumentDetail document={document} />

        {/* DocumentContainers (Suspense); AnnotationsSection (Suspense, если document.id);
            DocumentRevisions (Suspense, если showRevisions && document.id);
            delete-блок (если canDelete && document.id) — все БЕЗ изменений */}
      </div>

      <MarginNote side="end" className="p-6">
        <p className="text-sm text-(--color-fg-muted)">{t("documentMarginHint")}</p>
      </MarginNote>
    </>
  );
```

> Внутренности `<div>` (header, DocumentDetail, Suspense-блоки, delete-кнопка) переносятся БЕЗ изменений — меняется только корневая обёртка (фрагмент + класс div) и добавляется `<MarginNote>` последним прямым потомком.

- [ ] **Step 5: Линт + билд**

Run: `pnpm lint && pnpm build`
Expected: без ошибок. Structural key-parity тест `src/i18n/messages/messages.test.ts` (set-equality ключей ru/en) останется зелёным — `documentMarginHint` добавлен в ОБЕ локали (Step 1/2), иначе тест красный. Namespace `pages` клиент-безопасен (НЕ в `SERVER_ONLY_NAMESPACES`).

- [ ] **Step 6: Прогнать тесты**

Run: `pnpm test`
Expected: PASS (i18n key-parity между en/ru не нарушен).

- [ ] **Step 7: Браузерный QA + проверка SSR**

Run: `pnpm dev`. Открыть страницу документа `http://localhost:3001/documents/<id>`:
- **≥1280px:** текст-подсказка виден в правом поле (инлайн-конец), справа от хребта; контент документа заполняет полный 720-хребет (не уже).
- **<1280px (напр. 1024):** подсказка втекает в поток под контентом (collapse=inline), поля нет.
- **RTL:** подсказка появляется на инлайн-конце (слева в RTL).
- **SSR:** view-source страницы (Ctrl+U) содержит текст подсказки → контент поля отрендерен на сервере (не клиентский портал).

- [ ] **Step 8: Коммит**

```bash
git status   # i18n messages — без чужих правок (common.ts трогает другой агент, не наш)
git add src/app/documents/[id]/page.tsx src/i18n/messages/en/pages.ts src/i18n/messages/ru/pages.ts
git commit --only src/app/documents/[id]/page.tsx src/i18n/messages/en/pages.ts src/i18n/messages/ru/pages.ts -m "$(cat <<'EOF'
feat(layout): документ на полный хребет + демо MarginNote

Снят внутренний max-w-3xl (контент заполняет хребет); демо-маргиналия в
правом поле (≥xl) / инлайн (<xl), SSR-rendered. Референс фундамента.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- §2 модель трёх зон → Task 1 (грид с именованными линиями). ✓
- §3 токены → Task 1 (`--layout-spine/-margin/-gutter`). ✓
- §4 механизм + примитивы → Tasks 2 (`MarginNote`), 3 (`FullBleed`/`WideShell`); дефолт-колонка + collapse → Task 1. ✓
- §5 хедер ширины хребта + бордер → Task 4. ✓
- §6 два режима (reading/app) → Task 4 (reading дефолт) + Task 5 (app/wide). ✓
- §7 вертикальный флоу (`align-content: start`, без растяжки) → Task 1 (CSS) + Task 4 (снят `items-center`). ✓
- §8 адаптив (поля ≥xl, collapse) → Task 1 (media queries). ✓
- §9 обратная совместимость (`:where()` дефолт) + охват миграции → Task 1 + Tasks 4–6. ✓
- §10 замороженные зоны → Global Constraints. ✓
- §11 (RTL логические оси) → пронизывает Tasks 1–6 (именованные линии, `border-inline`, `MARGIN_NOTE_SIDE`). ✓
- Якорные сноски (§4, «позже») — намеренно НЕ в этом PR (foundation = скелет зон). Subgrid для глубокой эмиссии — follow-up. ✓ (осознанный gap)

**1a. Правки по мультиагент-ревью (2026-06-23, 22/25 находок подтверждено):**
- **major** Фантомный хребет-бордер за широким контентом → Task 1 правило `.page-grid:has(> .col-bleed) .spine-frame { display:none }` + тест + QA-пункт. ✓
- **major** Двойной landmark `<main>` в /me,/admin (непоследовательность с map/graph) → Task 5 Step 1/2 внутренний `<main>`→`<div>`; source-тест единственности `<main>` (Step 7a); QA-инвариант `querySelectorAll('main').length===1`. ✓
- **major** Регрессия ширины не покрытых страниц → аудит `find src/app -name page.tsx`; добавлены `canvases/[id]/edit`, `dev/ui` в Task 5; `/saved` исключён (авто-вписывается). ✓
- **minor** Сужение прозы 768→720 — зафиксировано как ожидаемое (Task 4 QA). ✓
- **minor** RTL-гард CSS — общий негативный паттерн физических осей в `layout.test.ts`. ✓
- **minor** Непрерывность spine-frame (§5) — ассерты `inset-block/margin-inline/inline-size`. ✓
- **minor** Баннеры full-bleed vs хедер — зафиксировано как намеренное + QA-пункт. ✓
- **minor/nit** justify-content drift, magic-1280, экспорт-порядок, i18n-формулировка, demo-padding, sticky-QA, доки direct-child — закрыты комментариями/уточнениями.
- **3 опровергнуто** (ложные тревоги, отсеяны верификаторами): MarginNote НЕ падает под весь документ (сидит в строке 1 сбоку); demo-padding выравнивание НЕ ломается; Task 6-плейсхолдер достаточен. Действий не требуют.

**2. Placeholder scan:** все шаги содержат реальный код/команды/ожидаемый вывод. В Task 5/6 фразы «существующее содержимое» сопровождены явным указанием, что переносится без изменений и какие именно строки — это не TODO, а инструкция сохранения. ✓

**3. Type/name consistency:** `page-grid`, `spine-frame`, `col-margin-start/-end`, `col-bleed`, `margin-note--inline/--hidden`, `--layout-spine/-margin/-gutter` — единообразны между Task 1 (определение) и Tasks 2–6 (потребление). Экспортируемые константы: `MARGIN_NOTE_SIDE`, `FULL_BLEED_CLASS`, `WIDE_SHELL_INNER` — совпадают в реализации и тестах. ✓

## Открытые тюнинги (не блокеры, §12 спеки)
- Точное число `--layout-spine` (45rem) и порог раскрытия полей (1280px) — могут потребовать подгонки по браузерному QA (в полосе 1280–1360px поля у края viewport).
- Subgrid-обёртка для эмиссии маргиналий из глубины дерева (якорные сноски) — следующая итерация.
