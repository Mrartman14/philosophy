# RTL Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать кодовую базу полностью готовой к RTL-языкам (как если бы был арабский/фарси): направление выводится из локали на `<html dir>` + Base UI `DirectionProvider`, все физические direction-стили мигрированы на логические, ESLint-гард держит дисциплину, спец-поверхности (3D, код, иконки) изолированы.

**Architecture:** `dir` — свойство языка, выводится из резолвнутой локали чистой функцией `dirForLocale`. Один источник на `<html dir>`; параллельно тем же значением кормится Base UI `DirectionProvider`, чтобы все его компоненты зеркалились сами. Весь UI стоит на логических CSS-свойствах → зеркалирование автоматическое; `[dir="rtl"]`-селекторы и `dir="ltr"`-изоляция используются только для того, что логические свойства не выражают (флип иконок, 3D-координаты, always-LTR код).

**Tech Stack:** Next.js (App Router, RSC), TypeScript, Tailwind v4 (логические утилиты `ms/me/ps/pe/start/end/border-s/border-e/text-start/text-end`), `@base-ui/react@^1.4.1` (`DirectionProvider`), next-intl (за фасадом `@/i18n`), Vitest + Testing Library, ESLint flat-config (`no-restricted-syntax`).

## Global Constraints

- Пакетный менеджер — **pnpm**. Никогда не `npm install`. Проверки: `pnpm lint`, `pnpm test`, `pnpm build`.
- Параллельные агенты: НЕ делать `git stash/reset/checkout ./clean`, НЕ `git add -A`/`git add .`. Добавлять только свои файлы по имени: `git add <path1> <path2> && git commit --only <те же пути>`.
- Это **foundation-update PR** — намеренно трогает заморожённые зоны (`src/app/layout.tsx`, `src/app/globals.css`, `src/components/ui/*`, `eslint.config.mjs`). Это санкционировано спекой, не нарушение.
- Именование файлов/папок в `src/` — kebab-case.
- Логические утилиты Tailwind v4: `left-*→start-*`, `right-*→end-*`, `ml→ms`, `mr→me`, `pl→ps`, `pr→pe`, `border-l→border-s`, `border-r→border-e`, `text-left→text-start`, `text-right→text-end`, `float-left→float-start`, `float-right→float-end`. Negative: `-ml→-ms`, `-mr→-me`, `-right→-end` и т.п.
- **Ложные срабатывания — НЕ трогать:** `rounded-lg`/`rounded-md`/`rounded-sm`/`rounded-xl`/`rounded-full` (размер скругления, не `rounded-l`); строковый литерал `"left-aligned"`.
- **Exempt (физические, остаются + позже закрываются `eslint-disable` в Task 11):** companions, привязанные к Base UI `data-[side=left/right]`; геометрическое центрирование `left-1/2 -translate-x-1/2`; inline-координаты canvas (`left: screen.x`); `collisionPadding={{left,right}}` (API Base UI).
- Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.

---

## File Structure

- `src/i18n/locales.ts` — добавить `RTL_LOCALES`, `Direction`, `dirForLocale`. (Task 1)
- `src/i18n/direction.test.ts` — новый тест для `dirForLocale`. (Task 1)
- `src/app/layout.tsx` — `dir={dirForLocale(locale)}` на `<html>` + `<DirectionProvider>` + конверсия собственных классов. (Task 2)
- `src/app/globals.css` — логическая конверсия + утилита `.rtl-flip`. (Task 3)
- Свип-файлы (Tasks 4–6) — по списку ниже.
- 3D-рендереры — `dir="ltr"` изоляция canvas. (Task 7)
- always-LTR контент — `dir="ltr"`/`<bdi>`. (Task 8)
- `eslint.config.mjs` + фикстура — гард. (Task 11)
- `docs/frontend-conventions.md` — раздел про RTL. (Task 12)

---

## Task 1: i18n — источник направления `dirForLocale`

**Files:**
- Modify: `src/i18n/locales.ts`
- Test: `src/i18n/direction.test.ts` (create)

**Interfaces:**
- Produces:
  - `export const RTL_LOCALES = ["ar", "fa", "he", "ur"] as const;`
  - `export type Direction = "ltr" | "rtl";`
  - `export function dirForLocale(locale: string): Direction`

- [ ] **Step 1: Написать падающий тест**

Create `src/i18n/direction.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dirForLocale, RTL_LOCALES } from "./locales";

describe("dirForLocale", () => {
  it("текущие проектные локали — ltr", () => {
    expect(dirForLocale("ru")).toBe("ltr");
    expect(dirForLocale("en")).toBe("ltr");
  });

  it("RTL-языки — rtl", () => {
    for (const l of RTL_LOCALES) expect(dirForLocale(l)).toBe("rtl");
    expect(dirForLocale("ar")).toBe("rtl");
    expect(dirForLocale("fa")).toBe("rtl");
  });

  it("primary-subtag извлекается из BCP-47 тега", () => {
    expect(dirForLocale("ar-EG")).toBe("rtl");
    expect(dirForLocale("en-US")).toBe("ltr");
  });

  it("неизвестное/мусор → ltr (безопасный дефолт)", () => {
    expect(dirForLocale("")).toBe("ltr");
    expect(dirForLocale("xx")).toBe("ltr");
    expect(dirForLocale("system")).toBe("ltr");
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm test -- src/i18n/direction.test.ts`
Expected: FAIL — `dirForLocale`/`RTL_LOCALES` не экспортированы.

- [ ] **Step 3: Реализовать в `src/i18n/locales.ts`**

Добавить в конец файла:

```ts
/** Языки с письмом справа налево (как данные — не обязаны быть в RESOLVED_LOCALES). */
export const RTL_LOCALES = ["ar", "fa", "he", "ur"] as const;

/** Направление письма для <html dir> и Base UI DirectionProvider. */
export type Direction = "ltr" | "rtl";

/** Направление по локали/BCP-47 тегу. Неизвестное → "ltr" (безопасный дефолт). */
export function dirForLocale(locale: string): Direction {
  const primary = locale.toLowerCase().split("-")[0];
  return (RTL_LOCALES as readonly string[]).includes(primary) ? "rtl" : "ltr";
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm test -- src/i18n/direction.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Коммит**

```bash
git add src/i18n/locales.ts src/i18n/direction.test.ts
git commit --only src/i18n/locales.ts src/i18n/direction.test.ts -m "feat(i18n): dirForLocale + RTL_LOCALES — источник направления письма

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Прокидка направления — `<html dir>` + Base UI DirectionProvider

**Files:**
- Modify: `src/app/layout.tsx` (строки ~108–144)
- Test: `src/app/layout-direction.test.tsx` (create)

**Interfaces:**
- Consumes: `dirForLocale` (Task 1), `DirectionProvider` из `@base-ui/react/direction-provider` (`direction?: "ltr" | "rtl"`).
- Produces: `<html dir>` корректно проставлен; все Base UI компоненты получают направление через `DirectionProvider`.

**Контекст:** [src/app/layout.tsx:114](../../../src/app/layout.tsx) сейчас: `<html lang={locale} {...dataAttrs} style={{...}}>`. На [строке 144](../../../src/app/layout.tsx) у `<html>`-потомка (или соседнего узла) есть симметричные `border-l border-r` — схлопнуть в `border-x` (направление-нейтрально). `I18nProvider` — на [строке 135](../../../src/app/layout.tsx).

- [ ] **Step 1: Написать падающий тест (интеграция с Base UI)**

Create `src/app/layout-direction.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { dirForLocale } from "@/i18n/locales";

// Гарантия: DirectionProvider принимает значение dirForLocale и проставляет контекст.
// Base UI прокидывает направление в свои компоненты; здесь проверяем сам контракт обёртки.
describe("RTL wiring", () => {
  it("dirForLocale кормит DirectionProvider значением rtl для арабского", () => {
    const dir = dirForLocale("ar");
    const { container } = render(
      <DirectionProvider direction={dir}>
        <span data-testid="child">x</span>
      </DirectionProvider>,
    );
    expect(dir).toBe("rtl");
    expect(container.querySelector('[data-testid="child"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что компилится и проходит после импорта**

Run: `pnpm test -- src/app/layout-direction.test.tsx`
Expected: PASS (тест самодостаточен — проверяет контракт обёртки и значение `dirForLocale`). Если `@testing-library/react` не настроен в этом файле — свериться с соседним рендер-тестом (напр. `src/components/ui/idempotency-field.test.tsx`) и выровнять импорты/`jsdom`-окружение.

- [ ] **Step 3: Прокинуть `dir` и `DirectionProvider` в `src/app/layout.tsx`**

Добавить импорты:

```tsx
import { dirForLocale } from "@/i18n/locales";
import { DirectionProvider } from "@base-ui/react/direction-provider";
```

Изменить `<html>` (строка ~114):

```tsx
<html lang={locale} dir={dirForLocale(locale)} {...dataAttrs} style={{ ...style, colorScheme }}>
```

Обернуть поддерево с `I18nProvider` (строка ~135) в `DirectionProvider` тем же значением. `DirectionProvider` — client-компонент, но рендерится из server-layout с сериализуемым строковым пропом — допустимо:

```tsx
<DirectionProvider direction={dirForLocale(locale)}>
  <I18nProvider locale={locale} messages={messages}>
    {/* …существующие потомки без изменений… */}
  </I18nProvider>
</DirectionProvider>
```

- [ ] **Step 4: Схлопнуть симметричные классы на строке ~144**

Найти `border-l border-r` (симметричная рамка) → заменить на `border-x`. (Если рядом `pl-* pr-*` с равными значениями — в `px-*`.) НЕ трогать прочее.

- [ ] **Step 5: Прогнать тест + сборку RSC**

Run: `pnpm test -- src/app/layout-direction.test.tsx && pnpm build`
Expected: тест PASS; build OK (layout остаётся валидным RSC, `dir` — строка).

- [ ] **Step 6: Коммит**

```bash
git add src/app/layout.tsx src/app/layout-direction.test.tsx
git commit --only src/app/layout.tsx src/app/layout-direction.test.tsx -m "feat(rtl): <html dir> из локали + Base UI DirectionProvider

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: globals.css — логическая конверсия + утилита `.rtl-flip`

**Files:**
- Modify: `src/app/globals.css` (строки ~48, 54, 127, 145)
- Test: `src/app/globals-rtl.test.ts` (create)

**Interfaces:**
- Produces: CSS-класс `.rtl-flip` (горизонтальный флип в RTL для направленных иконок); все физические `left:`/`right:` в globals → логические `inset-inline-start`/`inset-inline-end`.

**Контекст:** 4× `left: calc(100% + Npx)` (тултипы/поповеры, позиционируются «вправо от якоря» в LTR).

- [ ] **Step 1: Написать падающий тест**

Create `src/app/globals-rtl.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("./globals.css", import.meta.url)), "utf8");

describe("globals.css — RTL-готовность", () => {
  it("нет физических left:/right: объявлений (только логические inset-inline-*)", () => {
    // строки вида `left: ...;` / `right: ...;` как CSS-свойство (не часть имени свойства)
    expect(/(^|[\s;{])left\s*:/m.test(css)).toBe(false);
    expect(/(^|[\s;{])right\s*:/m.test(css)).toBe(false);
  });

  it("есть утилита .rtl-flip с зеркалированием в [dir=rtl]", () => {
    expect(css).toMatch(/\[dir=["']?rtl["']?\][^{]*\.rtl-flip[^{]*\{[^}]*scaleX\(-1\)/s);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test -- src/app/globals-rtl.test.ts`
Expected: FAIL — физические `left:` присутствуют; `.rtl-flip` отсутствует.

- [ ] **Step 3: Конверсия в `src/app/globals.css`**

Заменить каждое `left: calc(100% + Npx);` на `inset-inline-start: calc(100% + Npx);` (строки ~48, 54, 127, 145 — сверить grep'ом `grep -nE "(^|[ ;{])left:" src/app/globals.css`). Если встретится `right:` — `inset-inline-end:`.

Добавить утилиту (рядом с прочими base-слоями):

```css
/* Горизонтальный флип направленных иконок (next/prev, стрелки навигации) в RTL. */
.rtl-flip { /* по умолчанию без трансформации */ }
[dir="rtl"] .rtl-flip { transform: scaleX(-1); }
```

- [ ] **Step 4: Запустить тест + сборку CSS**

Run: `pnpm test -- src/app/globals-rtl.test.ts && pnpm build`
Expected: тест PASS; build OK.

- [ ] **Step 5: Коммит**

```bash
git add src/app/globals.css src/app/globals-rtl.test.ts
git commit --only src/app/globals.css src/app/globals-rtl.test.ts -m "feat(rtl): logical inset в globals.css + утилита .rtl-flip

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Свип A — app-shell + ui-kit

**Files (Modify):**
- `src/app/admin/layout.tsx:29`
- `src/components/app/app-header/app-header.tsx` (строки 18, 19 — конверсия; строки 73, 93–100 — EXEMPT, не трогать)
- `src/components/app/update-prompt.tsx:14`
- `src/components/ui/toaster.tsx:19`
- `src/components/ui/form-field.tsx:36`
- `src/components/ui/table.tsx:32`

**Refactor (без изменения поведения) — проверяется существующими тестами + grep.** TDD не применяется (нет нового поведения).

Точная карта конверсии:

| Файл:строка | Было → Стало | Прим. |
|---|---|---|
| admin/layout.tsx:29 | `border-r` → `border-e` | правая рамка сайдбара = inline-end |
| app-header.tsx:18 | `before:left-0` → `before:start-0` | full-width backdrop |
| app-header.tsx:19 | `md:border-l md:border-r` → `md:border-x`; `pl-4 pr-4` → `px-4` | симметрично |
| update-prompt.tsx:14 | `left-4 right-4 md:left-auto md:right-4` → `start-4 end-4 md:start-auto md:end-4` | `rounded-lg`/`bottom-4` НЕ трогать |
| toaster.tsx:19 | `right-4` → `end-4` |  |
| form-field.tsx:36 | `ml-0.5` → `ms-0.5` | отступ обязательной звёздочки |
| table.tsx:32 | `text-left` → `text-start` | th-выравнивание |

**EXEMPT в app-header (НЕ трогать, обоснование):** `collisionPadding={{left,right}}` (:73) — API Base UI; `data-[side=left/right]:…(left|right)…` в `positionerClassName` (:93–94) и `arrowClassName` (:99–100) — парятся с физическим `data-side`, который Base UI вычисляет уже с учётом направления (через `DirectionProvider` из Task 2). Конверсия рассинхронит их с `data-side`.

- [ ] **Step 1:** Применить карту конверсии к каждому файлу. `dialog.tsx` НЕ входит (его `left-1/2` центрирование — exempt, остаётся).
- [ ] **Step 2:** Verify — grep не находит сконвертированных физических токенов (кроме exempt):

Run:
```bash
grep -nE "\b(border-r\b|before:left-0|md:border-l|md:border-r|pl-4 pr-4|left-4|md:left-auto|md:right-4|right-4|ml-0\.5|text-left)\b" src/app/admin/layout.tsx src/components/app/update-prompt.tsx src/components/ui/toaster.tsx src/components/ui/form-field.tsx src/components/ui/table.tsx
```
Expected: пусто (для app-header допустимы только `data-[side=...]`-companions).

- [ ] **Step 3:** `pnpm test && pnpm lint`
Expected: PASS (поведенческих изменений нет; снапшоты, если есть, обновить осознанно — классы поменялись).

- [ ] **Step 4: Коммит**
```bash
git add src/app/admin/layout.tsx src/components/app/app-header/app-header.tsx src/components/app/update-prompt.tsx src/components/ui/toaster.tsx src/components/ui/form-field.tsx src/components/ui/table.tsx
git commit --only src/app/admin/layout.tsx src/components/app/app-header/app-header.tsx src/components/app/update-prompt.tsx src/components/ui/toaster.tsx src/components/ui/form-field.tsx src/components/ui/table.tsx -m "refactor(rtl): логические свойства — shell + ui-kit (свип A)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Свип B — comments + editor-кластер

**Files (Modify):**
- `src/components/ast-merge/ast-merge-view.tsx:196,202`
- `src/components/attachments/attachments-panel.tsx:95`
- `src/features/annotations/ui/annotation-anchor-context.tsx:35`
- `src/features/canvas/ui/canvas-editor.tsx:417`
- `src/features/canvas/ui/canvas-my-list.tsx:27`
- `src/features/canvas/ui/editor-toolbar.tsx:60`
- `src/features/comments/ui/comment-anchor-context.tsx:34`
- `src/features/comments/ui/comment-node-view.tsx:95`
- `src/features/comments/ui/comment-reply-form.tsx:46`
- `src/features/comments/ui/comment-tree-view.tsx:33`
- `src/features/comments/ui/comment-tree.tsx:22`

Карта конверсии:

| Файл:строка | Было → Стало |
|---|---|
| ast-merge-view.tsx:196,202 | `ml-auto` → `ms-auto` (оба) |
| attachments-panel.tsx:95 | `ml-2` → `ms-2` |
| annotation-anchor-context.tsx:35 | `border-l-2 pl-2` → `border-s-2 ps-2` |
| canvas-editor.tsx:417 | `border-l` → `border-s` |
| canvas-my-list.tsx:27 | `ml-2` → `ms-2` |
| editor-toolbar.tsx:60 | `ml-auto` → `ms-auto` |
| comment-anchor-context.tsx:34 | `border-l-2 pl-2` → `border-s-2 ps-2` |
| comment-node-view.tsx:95 | `border-l-2 pl-2` → `border-s-2 ps-2` |
| comment-reply-form.tsx:46 | `border-l pl-3` → `border-s ps-3` |
| comment-tree-view.tsx:33 | `border-l ml-4 pl-3` → `border-s ms-4 ps-3` |
| comment-tree.tsx:22 | `border-l ml-4 pl-3` → `border-s ms-4 ps-3` |

- [ ] **Step 1:** Применить карту.
- [ ] **Step 2:** Verify:
```bash
grep -rnE "\b(ml-auto|ml-2|ml-4|border-l\b|border-l-2|pl-2|pl-3)\b" src/components/ast-merge/ast-merge-view.tsx src/components/attachments/attachments-panel.tsx src/features/annotations/ui/annotation-anchor-context.tsx src/features/canvas/ui/canvas-editor.tsx src/features/canvas/ui/canvas-my-list.tsx src/features/canvas/ui/editor-toolbar.tsx src/features/comments/ui/comment-anchor-context.tsx src/features/comments/ui/comment-node-view.tsx src/features/comments/ui/comment-reply-form.tsx src/features/comments/ui/comment-tree-view.tsx src/features/comments/ui/comment-tree.tsx
```
Expected: пусто.
- [ ] **Step 3:** `pnpm test && pnpm lint` → PASS.
- [ ] **Step 4: Коммит** (добавить все 11 файлов по имени, `--only` те же).
```bash
git commit --only <11 путей> -m "refactor(rtl): логические свойства — comments + editor (свип B)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Свип C — notifications + tables + 3D-оверлей-панели

**Files (Modify):**
- `src/features/notifications/ui/notification-bell.tsx:105`
- `src/features/notifications/ui/notification-item.tsx:50`
- `src/features/notifications/ui/notification-popover.tsx:46`
- `src/features/users/ui/users-table.tsx:62`
- `src/features/statistics/ui/production-stats-table.tsx:34-52`
- `src/features/reference-graph/ui/graph-view.tsx:141`
- `src/features/semantic-map/ui/map-point-panel.tsx:31`
- `src/features/semantic-map/ui/semantic-map-view.tsx:147`

Карта конверсии:

| Файл:строка | Было → Стало | Прим. |
|---|---|---|
| notification-bell.tsx:105 | `-right-0.5` → `-end-0.5` | бейдж-счётчик (negative) |
| notification-item.tsx:50 | `text-left` → `text-start` |  |
| notification-popover.tsx:46 | `right-0` → `end-0` | поповер |
| users-table.tsx:62 | `ml-1` → `ms-1` |  |
| production-stats-table.tsx:34-52 | `text-right` (×9) → `text-end` | числовые колонки |
| graph-view.tsx:141 | `right-3` → `end-3` | UI-оверлей НАД сценой (не canvas) |
| map-point-panel.tsx:31 | `left-3` → `start-3` | UI-панель точки |
| semantic-map-view.tsx:147 | `right-3` → `end-3` | UI-оверлей переключателя |

**Важно:** оверлей-панели (graph-view/map) — это UI-хром поверх 3D, их зеркалить НУЖНО (в RTL уезжают на другую сторону — корректно). Сам canvas изолируется отдельно в Task 7. Эти панели должны оставаться ВНЕ `dir="ltr"`-изоляции canvas (см. Task 7).

- [ ] **Step 1:** Применить карту.
- [ ] **Step 2:** Verify:
```bash
grep -rnE "\b(-right-0\.5|text-left|right-0\b|ml-1|text-right|right-3|left-3)\b" src/features/notifications/ui/notification-bell.tsx src/features/notifications/ui/notification-item.tsx src/features/notifications/ui/notification-popover.tsx src/features/users/ui/users-table.tsx src/features/statistics/ui/production-stats-table.tsx src/features/reference-graph/ui/graph-view.tsx src/features/semantic-map/ui/map-point-panel.tsx src/features/semantic-map/ui/semantic-map-view.tsx
```
Expected: пусто.
- [ ] **Step 3:** `pnpm test && pnpm lint` → PASS.
- [ ] **Step 4: Коммит** (8 файлов по имени).
```bash
git commit --only <8 путей> -m "refactor(rtl): логические свойства — notifications + tables + 3D-оверлеи (свип C)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Изоляция 3D-сцен (`dir="ltr"` на canvas-контейнере)

**Files:**
- Modify: рендерер-контейнеры canvas в `src/components/scene-3d/` (база), `src/features/semantic-map/ui/`, `src/features/reference-graph/ui/`
- Test: `src/components/scene-3d/ui/scene-direction.test.tsx` (create) — или дополнить существующий рендер-тест сцены

**Interfaces:**
- Produces: WebGL-canvas (и его координатные оверлеи region-labels) рендерится под `dir="ltr"` независимо от направления страницы; UI-панели (toggle/point/state) остаются под направлением страницы.

**Контекст:** базовый рендерер — `src/components/scene-3d/` (`ThreeSceneRenderer` + UI-шеллы), карта в подклассе. Region-labels позиционируются inline-координатами (`left: l.x`) — это canvas-пространство, должно жить под `dir="ltr"` (и остаётся exempt от свипа). Точку вставки `dir="ltr"` определить по факту: обёртка непосредственно вокруг `<canvas>`/renderer-mount, НЕ вокруг оверлей-панелей из Task 6.

- [ ] **Step 1: Найти точку монтирования canvas**
```bash
grep -rnE "<canvas|canvasRef|mountRef|renderer\.domElement|ThreeSceneRenderer" src/components/scene-3d src/features/semantic-map src/features/reference-graph --include="*.tsx"
```
Прочитать найденный контейнер; убедиться, что `dir="ltr"` встаёт на элемент-обёртку самого canvas, а оверлей-панели — снаружи.

- [ ] **Step 2: Написать падающий тест**

Create `src/components/scene-3d/ui/scene-direction.test.tsx` (адаптировать рендер-утилиты под существующий паттерн сцен-тестов — см. `scene-state-panel.test.tsx`):

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
// импортировать реальный компонент-обёртку canvas сцены (имя — по факту из Step 1)
import { SceneCanvas } from "./<canvas-wrapper>";

describe("3D-изоляция направления", () => {
  it("canvas-контейнер несёт dir=ltr даже под RTL-страницей", () => {
    const { container } = render(
      <div dir="rtl">
        <SceneCanvas {/* минимальные пропсы / моки renderer */} />
      </div>,
    );
    const canvasWrap = container.querySelector('[data-scene-canvas]');
    expect(canvasWrap?.getAttribute("dir")).toBe("ltr");
  });
});
```

- [ ] **Step 3:** Запустить — FAIL (нет `dir="ltr"`/маркера).
Run: `pnpm test -- src/components/scene-3d/ui/scene-direction.test.tsx`

- [ ] **Step 4: Реализация** — на обёртке canvas добавить `dir="ltr"` и маркер `data-scene-canvas`:
```tsx
<div data-scene-canvas dir="ltr" className="…">
  {/* renderer mount / <canvas> */}
</div>
```
Применить в базе scene-3d (наследуется картой) и, при отдельных mount-точках, в reference-graph.

- [ ] **Step 5:** Запустить — PASS. Затем `pnpm test && pnpm build`.

- [ ] **Step 6: Коммит** (изменённые рендереры + тест, по имени).
```bash
git commit --only <пути> -m "feat(rtl): dir=ltr изоляция 3D-canvas (сцена/карта/граф не зеркалятся)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: bidi-изоляция always-LTR контента (код / идентификаторы)

**Files:**
- Modify: `src/components/ast-render/block-renderer.tsx` (code-блок), `src/components/ast-render/inline-renderer.tsx` (инлайн-код), `src/features/tokens/ui/connect-instructions.tsx` (curl-сниппет)
- Test: `src/components/ast-render/ast-render-bidi.test.tsx` (create) — или дополнить `ast-render.test.tsx`

**Interfaces:**
- Produces: элементы с кодом/латинскими идентификаторами несут `dir="ltr"`, чтобы порядок символов не рвался в RTL-контексте.

**Контекст:** в RTL пунктуация/скобки в коде ломаются bidi-алгоритмом без явного `dir="ltr"`. Цель — обернуть code-узлы. Кандидаты подтвердить чтением; при наличии ID-колонок в `audit-table.tsx`/`users-table.tsx`/`token-list.tsx` обернуть ID-ячейки `<bdi>` (опционально, если значения латинские).

- [ ] **Step 1: Прочитать рендереры**
```bash
grep -nE "<pre|<code|code|font-mono" src/components/ast-render/block-renderer.tsx src/components/ast-render/inline-renderer.tsx src/features/tokens/ui/connect-instructions.tsx
```

- [ ] **Step 2: Написать падающий тест**

Create `src/components/ast-render/ast-render-bidi.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BlockRenderer } from "./block-renderer"; // имя/экспорт — по факту

describe("ast-render bidi-изоляция", () => {
  it("code-блок изолирован dir=ltr", () => {
    const node = { type: "code", text: "const x = (a) => a[0];" } as const; // форму узла взять из реальных типов
    const { container } = render(<BlockRenderer node={node} />);
    const pre = container.querySelector("pre, code");
    expect(pre?.closest('[dir="ltr"]') ?? pre?.getAttribute("dir")).toBeTruthy();
  });
});
```

- [ ] **Step 3:** Запустить — FAIL. Run: `pnpm test -- src/components/ast-render/ast-render-bidi.test.tsx`

- [ ] **Step 4: Реализация** — на code-обёртках добавить `dir="ltr"`:
```tsx
<pre dir="ltr" className="…"><code>…</code></pre>
```
Инлайн-код — `<code dir="ltr">…</code>`. В `connect-instructions.tsx` — обернуть curl-сниппет `dir="ltr"`.

- [ ] **Step 5:** Запустить — PASS. Затем `pnpm test`.

- [ ] **Step 6: Коммит** (по имени).
```bash
git commit --only <пути> -m "feat(rtl): bidi-изоляция кода/идентификаторов (dir=ltr)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Снять снапшот-долг свипа (если есть)

**Files:** обновлённые `*.test.tsx` снапшоты, затронутые сменой классов в Tasks 4–6.

- [ ] **Step 1:** `pnpm test` целиком.
- [ ] **Step 2:** Если упали снапшоты из-за переименованных классов (`ml-→ms-` и т.п.) — осознанно обновить: `pnpm test -- -u` (или проектный аналог). Просмотреть дифф снапшотов: меняются ТОЛЬКО имена классов, ничего структурного.
- [ ] **Step 3:** `pnpm test` → всё зелёное.
- [ ] **Step 4: Коммит** обновлённых снапшотов по имени (если менялись). Если снапшотов нет/не упали — задачу пропустить.

---

## Task 10: Финальный аудит свипа — нулевой остаток

**Files:** нет (проверочная задача).

- [ ] **Step 1:** Полный grep остаточных физических классов (исключая ложные/exempt):
```bash
grep -rnE "\b(ml-[0-9]|mr-[0-9]|pl-[0-9]|pr-[0-9]|left-[0-9]|right-[0-9]|-ml-|-mr-|-left-|-right-|text-left|text-right|float-left|float-right|border-l(\b|-[0-9])|border-r(\b|-[0-9]))" src --include="*.tsx" \
  | grep -vE "data-\[side=" \
  | grep -vE "left-1/2"
```
Expected: пусто. Любое совпадение — либо пропущенный свип (доделать в соответствующей Task), либо новый exempt (задокументировать причину).
- [ ] **Step 2:** Зафиксировать список оставшихся exempt-строк (для Task 11): app-header `data-[side]` companions, `dialog.tsx:57` центрирование, inline `left: screen.x` в 3D-оверлеях, `collisionPadding`.
- [ ] **Step 3:** Если всё чисто — коммита нет; передать список exempt в Task 11.

---

## Task 11: ESLint-гард от физических direction-классов

**Files:**
- Modify: `eslint.config.mjs`
- Modify (добавить `eslint-disable` с обоснованием): exempt-строки из Task 10 — `src/components/app/app-header/app-header.tsx` (:73, :93–100), `src/components/ui/dialog.tsx:57`, `src/components/scene-3d/ui/scene-region-labels.tsx:20`, `src/features/canvas/ui/editor-text-overlay.tsx:55`
- Test: `eslint.config.test.mjs`/фикстура — по образцу существующих Guardrail-тестов

**Interfaces:**
- Consumes: завершённый свип (Tasks 4–6) — иначе правило сделает `pnpm lint` красным.
- Produces: новое правило `no-restricted-syntax` (Guardrail 9), ловящее физические классы в строковых литералах и физические свойства в `style={{}}`.

**Контекст:** правило ДОЛЖНО идти после свипа. `eslint.config.mjs` уже использует `no-restricted-syntax` (Guardrail 1–8) — расширить тем же паттерном.

- [ ] **Step 1: Написать падающую фикстуру-тест**

Сверить с существующим тестом конфига (`grep -rln "RuleTester\|Linter\|eslint" *.mjs *.test.* 2>/dev/null`); по его образцу создать кейсы:

```js
// positive (должны флагаться):
//   className="ml-2"  className="text-right"  className="border-l"  style={{ marginLeft: 4 }}
// negative (НЕ флагаться):
//   className="ms-2"  className="text-end"  className="border-s"  className="rounded-lg"  className="px-4"
//   style={{ marginInlineStart: 4 }}
```

- [ ] **Step 2:** Запустить фикстуру — FAIL (правила ещё нет).

- [ ] **Step 3: Добавить Guardrail 9 в `eslint.config.mjs`**

Регэксп должен ловить физические токены, НО НЕ ложные (`rounded-lg` и пр.). Опорные паттерны:

```js
// Физические классы в строковых литералах className:
//   \b(ml|mr|pl|pr)-                     → ms/me/ps/pe
//   (^|[\s"'`:])(left|right)-            → start/end (inset)
//   \b-(ml|mr)-                          → -ms/-me
//   \btext-(left|right)\b                → text-start/text-end
//   \bfloat-(left|right)\b               → float-start/float-end
//   \bborder-[lr](?![a-z])               → border-s/border-e  (исключает border-lg? — такого нет; исключает rounded-lg т.к. префикс border-, не rounded-)
//   \brounded-[lr](?![a-z])              → rounded-s/rounded-e (исключает rounded-lg: после -l идёт буква g)
// Физические свойства в style={{}} (Property с key marginLeft/marginRight/paddingLeft/paddingRight/left/right/textAlign:'left'|'right'/borderLeft/borderRight)
```

Сообщение: «Используй логические свойства (ms/me/ps/pe/start/end/border-s/border-e/text-start/text-end). Физические — только для exempt-кейсов с `eslint-disable` и обоснованием.»

- [ ] **Step 4:** Запустить фикстуру — PASS (positive флагаются, negative — нет, особенно `rounded-lg`/`px-4`/`ms-2`).

- [ ] **Step 5: Закрыть exempt-строки** узким `eslint-disable-next-line no-restricted-syntax -- <причина>`:
  - app-header :73 `collisionPadding` — `-- Base UI API: collisionPadding физический по контракту`
  - app-header positioner/arrow const (:93/:99) — `-- парятся с физическим data-side Base UI (RTL учтён DirectionProvider)`
  - dialog.tsx:57 — `-- геометрическое центрирование, направление-нейтрально`
  - scene-region-labels.tsx:20, editor-text-overlay.tsx:55 — `-- inline-координаты canvas, не layout-направление`

- [ ] **Step 6:** `pnpm lint` целиком → PASS (ни ложных срабатываний, ни незакрытых exempt). `pnpm test`.

- [ ] **Step 7: Коммит** (config + фикстура + файлы с disable, по имени).
```bash
git commit --only eslint.config.mjs <фикстура> <exempt-файлы> -m "feat(rtl): ESLint Guardrail 9 — запрет физических direction-классов

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Документация — раздел RTL в frontend-conventions

**Files:**
- Modify: `docs/frontend-conventions.md`

- [ ] **Step 1:** Добавить раздел «RTL / направление письма»:
  - Логические свойства обязательны (`ms/me/ps/pe/start/end/border-s/border-e/text-start/text-end`); физические запрещены гардом (Guardrail 9).
  - Направление выводится из локали через `dirForLocale` (`src/i18n/locales.ts`), проставляется на `<html dir>` и в Base UI `DirectionProvider` (layout). НЕ настройка пользователя, НЕ ось appearance.
  - Base UI компоненты зеркалятся автоматически через `DirectionProvider`; их `data-[side=left/right]` companions остаются физическими (Base UI вычисляет сторону с учётом направления).
  - Спец-поверхности: 3D-canvas изолируется `dir="ltr"` (`data-scene-canvas`); always-LTR код/идентификаторы — `dir="ltr"`/`<bdi>`; направленные иконки — класс `.rtl-flip`.
  - Exempt-кейсы требуют `eslint-disable` с обоснованием.
  - **Аудит-находки (зафиксировать как известные ограничения):** горизонтально-направленных иконок-компонентов в наборе нет (`dropdown-arrow` — вертикальная); утилита `.rtl-flip` предоставлена под будущих потребителей. Текстовые глифы-стрелки `→` и гильметы `«»` в `layout.tsx`, `saved-lecture-view.tsx`, `global-error.tsx` — контентные строки (не инфраструктура); bidi-алгоритм обрабатывает гильметы; одиночные `→`-разделители — задокументированный follow-up уровня контента, вне объёма этого PR.
  - Проверка RTL без реального перевода: тесты на `dir="rtl"` + временно вручную `document.documentElement.dir = "rtl"` в dev.
- [ ] **Step 2: Коммит**
```bash
git add docs/frontend-conventions.md
git commit --only docs/frontend-conventions.md -m "docs(rtl): раздел про логические свойства и направление в frontend-conventions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Финальный гейт

**Files:** нет.

- [ ] **Step 1:** `pnpm lint` → PASS (включая Guardrail 9).
- [ ] **Step 2:** `pnpm test` → PASS (новые: dirForLocale, layout-direction, globals-rtl, scene-direction, ast-render-bidi, eslint-фикстура; существующие — зелёные).
- [ ] **Step 3:** `pnpm build` → OK.
- [ ] **Step 4:** Ручная проверка RTL (опционально, не блокирует): в dev выставить `document.documentElement.dir = "rtl"` в консоли, пройти ключевые экраны (header, админ-сайдбар, комментарии-дерево, диалог, тосты, карта/граф) — layout зеркалится, 3D-canvas и код остаются LTR.
- [ ] **Step 5:** Если что-то красное — вернуться в соответствующую Task, починить.

---

## Self-Review (выполнено при написании плана)

**Покрытие спеки:**
- §1 источник направления → Task 1 ✓
- §2 прокидка в DOM → Task 2 (+ Base UI DirectionProvider — добавлено по замечанию пользователя) ✓
- §3 полный свип (Tailwind + globals.css) → Tasks 3–6, аудит остатка Task 10 ✓
- §4 особые поверхности (3D / иконки / bidi) → Task 7 (3D), Task 3 (.rtl-flip) + Task 12 (аудит иконок), Task 8 (bidi) ✓
- §5 ESLint-гард → Task 11 ✓
- §6 тесты → в каждой задаче + Task 13 гейт ✓
- §7 док → Task 12 ✓

**Уточнения против спеки (зафиксированы в плане):**
- Base UI `DirectionProvider` — НЕ был в спеке, добавлен по замечанию пользователя (усиливает покрытие; компоненты Base UI зеркалятся сами).
- Свип сузился с «36 файлов» до 27 реальных: `rounded-lg` (×11) и `"left-aligned"` — ложные срабатывания, исключены.
- Расширен список exempt: companions Base UI `data-[side]` (app-header) — нельзя конвертировать, иначе рассинхрон с физическим `data-side`.
- Направленных иконок-компонентов в наборе нет — задача иконок свелась к утилите `.rtl-flip` + тест + документирование (Task 3 + Task 12).

**Плейсхолдеры:** имена компонентов/узлов в Tasks 7–8 («canvas-wrapper», форма узла code) помечены «по факту» — реальные имена читаются на Step 1 каждой задачи (внутренние детали чужих модулей, которые исполнитель видит при чтении файла). Это не дыры плана, а явная инструкция свериться с кодом перед правкой.

**Согласованность типов:** `dirForLocale(locale: string): Direction` / `Direction = "ltr"|"rtl"` — едины в Tasks 1, 2, 12. `DirectionProvider` prop `direction` — совпадает с `Direction`.
