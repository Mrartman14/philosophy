# RTL Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Ревизия 2 (2026-06-22):** план переработан после мульти-агентного ревью (покрытие/корректность/консистентность). Изменения: грепы переписаны под ugrep-окружение (B1); Task 7 (3D) переписан под реальную per-feature структуру без несуществующей «базы» (B2/B3); добавлена Task 9 — направление-агностичные стрелки навигации (M1/M2, решение пользователя «заменить стрелки»); Task 12 (ESLint) переписан под реальный `Linter`-харнесс + esquery + scope на `src/**` (M3); починен `transition: left` (M4); добавлены hot-file `git status`-чеки (M5); enumerated отброшенные файлы (M6); закалены тесты от ложно-зелёного.

**Goal:** Сделать кодовую базу полностью готовой к RTL-языкам (как если бы был арабский/фарси): направление выводится из локали на `<html dir>` + Base UI `DirectionProvider`, все физические direction-стили мигрированы на логические, ESLint-гард держит дисциплину, спец-поверхности (3D, код, иконки, стрелки навигации) изолированы или сделаны направление-агностичными.

**Architecture:** `dir` — свойство языка, выводится из резолвнутой локали чистой функцией `dirForLocale`. Один источник на `<html dir>`; тем же значением кормится Base UI `DirectionProvider` (его компоненты зеркалятся сами, `data-side` он выдаёт уже пост-RTL-флип → физические companions остаются физическими). Весь UI на логических CSS-свойствах → зеркалирование автоматическое; `[dir="rtl"]`-флип и `dir="ltr"`-изоляция — только для невыразимого логическими свойствами (флип иконок-стрелок, 3D-координаты, always-LTR код).

**Tech Stack:** Next.js (App Router, RSC), TypeScript, Tailwind v4.1.10 (логические утилиты `ms/me/ps/pe/start/end/border-s/border-e/text-start/text-end`, негатив `-end-*`), `@base-ui/react@^1.4.1` (`DirectionProvider`), next-intl (за фасадом `@/i18n`), Vitest + Testing Library (jsdom, `globals: false` — импортировать `{ describe, it, expect }` из `vitest`, ручной `afterEach(cleanup)`), ESLint flat-config (`no-restricted-syntax`, esquery-селекторы; фикстура — standalone `node eslint.config.test.mjs` на `Linter`).

## Global Constraints

- Пакетный менеджер — **pnpm**. Никогда не `npm install`. Проверки: `pnpm lint`, `pnpm test`, `pnpm build`. `pnpm test` = `node eslint.config.test.mjs && vitest run` (ESLint-фикстура гоняется тут, НЕ в `pnpm lint`). Для обновления снапшотов — `pnpm exec vitest run -u` (НЕ `pnpm test -- -u`).
- **Грепы — ugrep-safe.** В окружении `grep` проксирует в **ugrep `-G`**, который падает на `\b` внутри альтернации и на пустых под-выражениях (`(\b|...)`). Во всех verify/audit-шагах НЕ использовать `\b` в альтернации; границы задавать символьными классами (`token([^a-z]|$)`) или литеральными токенами. Где удобно — предпочесть `rg` (ripgrep, поддерживает `\b`).
- **Параллельные агенты + hot-файлы.** НЕ `git stash/reset/checkout ./clean`, НЕ `git add -A`/`.`. Только свои файлы: `git add <пути> && git commit --only <те же пути>`. **Перед коммитом hot/foundation-файла** (`src/app/layout.tsx`, `src/app/globals.css`, `eslint.config.mjs`, `src/i18n/messages/**`, shell-файлы) сделать `git status <путь>` — если в нём есть чужие незакоммиченные правки, `--only` утянет их под твоё сообщение → скоординироваться, не коммитить вслепую.
- Это **foundation-update PR** — намеренно трогает заморожённые зоны. Санкционировано спекой.
- Именование файлов/папок в `src/` — kebab-case.
- Логические утилиты (проверено компиляцией Tailwind v4.1.10): `left-*→start-*`, `right-*→end-*`, `ml→ms`, `mr→me`, `pl→ps`, `pr→pe`, `border-l→border-s`, `border-r→border-e`, `text-left→text-start`, `text-right→text-end`, `float-left→float-start`, `float-right→float-end`, негатив `-right-*→-end-*` и т.п. Симметричные пары схлопывать: `pl-N pr-N→px-N`, `border-l border-r→border-x`.
- **Ложные срабатывания — НЕ трогать:** `rounded-lg/md/sm/xl/full` (размер, не `rounded-l`); строковый литерал `"left-aligned"` (`slash-menu.tsx:22`).
- **Exempt (физические, остаются + закрываются `eslint-disable` в Task 12):** companions Base UI `data-[side=left/right]:…(left|right)…`; центрирование `left-1/2 -translate-x-1/2`; inline-координаты canvas (`left: screen.x`); `collisionPadding={{left,right}}`.
- Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.

---

## File Structure

- `src/i18n/locales.ts` — `RTL_LOCALES`, `Direction`, `dirForLocale`. (Task 1)
- `src/i18n/direction.test.ts` — тест. (Task 1)
- `src/app/layout.tsx` — `dir` + `DirectionProvider` + своя конверсия. (Task 2)
- `src/app/globals.css` — логическая конверсия + `transition: inset-inline-start` + `.rtl-flip`. (Task 3)
- Свип-файлы. (Tasks 4–6)
- `semantic-map-view.tsx`, `graph-view.tsx` — `dir="ltr"`-изоляция canvas+labels. (Task 7)
- `ast-render/*`, `tokens/*` — bidi `dir="ltr"`. (Task 8)
- `src/assets/icons/chevron-icon.tsx` (новый) + `pagination.tsx`, `calendar-view.tsx`, прочие nav-компоненты + i18n-каталоги — направление-агностичные стрелки. (Task 9)
- `eslint.config.mjs` + `eslint.config.test.mjs` — Guardrail 9. (Task 12)
- `docs/frontend-conventions.md`. (Task 13)

**Отброшены из спек-списка (~36) как чистые/ложные — НЕ входят в свип (M6):** `saved-lecture-view.tsx`, `ast-editor.tsx`, `slash-menu.tsx`, `lecture-detail.tsx`, `search-results.tsx`, `search-results-skeleton.tsx`, `tokens-manager.tsx`, `usage-tracking-toggle.tsx`, `connect-instructions.tsx` (в нём только `rounded-lg`; bidi-обёртка curl — отдельно в Task 8). Все они содержат лишь `rounded-lg`/комментарий `left-aligned`.

---

## Task 1: i18n — источник направления `dirForLocale`

**Files:**
- Modify: `src/i18n/locales.ts`
- Test: `src/i18n/direction.test.ts` (create)

**Interfaces — Produces:**
- `export const RTL_LOCALES = ["ar", "fa", "he", "ur"] as const;`
- `export type Direction = "ltr" | "rtl";`
- `export function dirForLocale(locale: string): Direction`

- [ ] **Step 1: Падающий тест** — create `src/i18n/direction.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dirForLocale, RTL_LOCALES } from "./locales";

describe("dirForLocale", () => {
  it("проектные локали — ltr", () => {
    expect(dirForLocale("ru")).toBe("ltr");
    expect(dirForLocale("en")).toBe("ltr");
  });
  it("RTL-языки — rtl", () => {
    for (const l of RTL_LOCALES) expect(dirForLocale(l)).toBe("rtl");
    expect(dirForLocale("ar")).toBe("rtl");
    expect(dirForLocale("fa")).toBe("rtl");
  });
  it("primary-subtag из BCP-47", () => {
    expect(dirForLocale("ar-EG")).toBe("rtl");
    expect(dirForLocale("en-US")).toBe("ltr");
  });
  it("мусор → ltr", () => {
    expect(dirForLocale("")).toBe("ltr");
    expect(dirForLocale("xx")).toBe("ltr");
    expect(dirForLocale("system")).toBe("ltr");
  });
});
```

- [ ] **Step 2:** `pnpm test -- src/i18n/direction.test.ts` → FAIL (нет экспортов).
- [ ] **Step 3:** Добавить в конец `src/i18n/locales.ts`:

```ts
/** Языки с письмом справа налево (как данные — не обязаны быть в RESOLVED_LOCALES). */
export const RTL_LOCALES = ["ar", "fa", "he", "ur"] as const;

/** Направление письма для <html dir> и Base UI DirectionProvider. */
export type Direction = "ltr" | "rtl";

/** Направление по локали/BCP-47 тегу. Неизвестное → "ltr". */
export function dirForLocale(locale: string): Direction {
  const primary = locale.toLowerCase().split("-")[0];
  return (RTL_LOCALES as readonly string[]).includes(primary) ? "rtl" : "ltr";
}
```

- [ ] **Step 4:** `pnpm test -- src/i18n/direction.test.ts` → PASS (4 теста).
- [ ] **Step 5: Коммит**

```bash
git add src/i18n/locales.ts src/i18n/direction.test.ts
git commit --only src/i18n/locales.ts src/i18n/direction.test.ts -m "feat(i18n): dirForLocale + RTL_LOCALES

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Прокидка направления — `<html dir>` + Base UI DirectionProvider

**Files:**
- Modify: `src/app/layout.tsx`
- Test: `src/app/layout-direction.test.tsx` (create)

**Interfaces — Consumes:** `dirForLocale` (Task 1), `DirectionProvider` из `@base-ui/react/direction-provider` (`direction?: "ltr"|"rtl"`).

**Контекст:** `layout.tsx:114` — `<html lang={locale} {...dataAttrs} style={{...}}>`; `I18nProvider` на ~:135; на ~:144 у элемента симметричные `border-l border-r` → `border-x`.

- [ ] **Step 1: Smoke-тест контракта** (НЕ TDD-цикл — layout это async RSC, тяжело рендерить в jsdom; проверяем контракт обёртки и значение). Create `src/app/layout-direction.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { dirForLocale } from "@/i18n/locales";

afterEach(cleanup);

describe("RTL wiring (smoke)", () => {
  it("dirForLocale кормит DirectionProvider значением rtl для арабского", () => {
    const dir = dirForLocale("ar");
    expect(dir).toBe("rtl");
    const { getByTestId } = render(
      <DirectionProvider direction={dir}>
        <span data-testid="child">x</span>
      </DirectionProvider>,
    );
    expect(getByTestId("child")).toBeTruthy();
  });
});
```

- [ ] **Step 2:** `pnpm test -- src/app/layout-direction.test.tsx` → PASS (smoke; проверяет, что импорт `DirectionProvider`/`dirForLocale` валиден и контракт пропа совпадает). Если jsdom/Testing Library не подхватились — свериться с `src/components/ui/idempotency-field.test.tsx`.
- [ ] **Step 3:** В `src/app/layout.tsx` добавить импорты:

```tsx
import { dirForLocale } from "@/i18n/locales";
import { DirectionProvider } from "@base-ui/react/direction-provider";
```

`<html>` (~:114):

```tsx
<html lang={locale} dir={dirForLocale(locale)} {...dataAttrs} style={{ ...style, colorScheme }}>
```

Обернуть поддерево с `I18nProvider` в `DirectionProvider` (client-компонент с сериализуемым строковым пропом из server-layout — допустимо):

```tsx
<DirectionProvider direction={dirForLocale(locale)}>
  <I18nProvider locale={locale} messages={messages}>
    {/* …без изменений… */}
  </I18nProvider>
</DirectionProvider>
```

- [ ] **Step 4:** На ~:144 `border-l border-r` → `border-x` (если рядом симметричные `pl-N pr-N` → `px-N`). Иное не трогать.
- [ ] **Step 5:** `pnpm test -- src/app/layout-direction.test.tsx && pnpm build` → PASS + build OK.
- [ ] **Step 6: Коммит** (hot-файл — сначала `git status src/app/layout.tsx`, убедиться, что чужих незакоммиченных правок нет):

```bash
git status src/app/layout.tsx
git add src/app/layout.tsx src/app/layout-direction.test.tsx
git commit --only src/app/layout.tsx src/app/layout-direction.test.tsx -m "feat(rtl): <html dir> из локали + Base UI DirectionProvider

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: globals.css — логическая конверсия + `.rtl-flip`

**Files:**
- Modify: `src/app/globals.css`
- Test: `src/app/globals-rtl.test.ts` (create)

**Interfaces — Produces:** `.rtl-flip` (флип в RTL, потребитель появится в Task 9); физические `left:`/`right:` и сопутствующий `transition: left` → логические.

**Контекст:** 4× `left: calc(100% + Npx)` (стр. ~48, 54, 127, 145) + `transition: left 200ms` на `.fancy-link::after` (стр. ~49).

- [ ] **Step 1: Падающий тест** — create `src/app/globals-rtl.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("./globals.css", import.meta.url)), "utf8");

describe("globals.css — RTL-готовность", () => {
  it("нет физических left:/right: объявлений", () => {
    expect(/(^|[\s;{])left\s*:/m.test(css)).toBe(false);
    expect(/(^|[\s;{])right\s*:/m.test(css)).toBe(false);
  });
  it("нет transition по физическому left/right", () => {
    expect(/transition\s*:[^;}]*\b(left|right)\b/m.test(css)).toBe(false);
  });
  it("есть .rtl-flip с зеркалированием в [dir=rtl]", () => {
    expect(css).toMatch(/\[dir=["']?rtl["']?\][^{]*\.rtl-flip[^{]*\{[^}]*scaleX\(-1\)/s);
  });
});
```

- [ ] **Step 2:** `pnpm test -- src/app/globals-rtl.test.ts` → FAIL.
- [ ] **Step 3:** В `src/app/globals.css`:
  - каждое `left: calc(100% + Npx);` → `inset-inline-start: calc(100% + Npx);` (сверить `grep -nE "(^|[ ;{])left:" src/app/globals.css`);
  - `transition: left 200ms ease-in-out;` (стр. ~49) → `transition: inset-inline-start 200ms ease-in-out;`;
  - добавить утилиту:

```css
/* Горизонтальный флип направленных иконок (стрелки nav) в RTL. Потребитель — Task 9. */
[dir="rtl"] .rtl-flip { transform: scaleX(-1); }
```

- [ ] **Step 4:** `pnpm test -- src/app/globals-rtl.test.ts && pnpm build` → PASS + OK.
- [ ] **Step 5: Коммит** (hot-файл — `git status src/app/globals.css` сначала):

```bash
git status src/app/globals.css
git add src/app/globals.css src/app/globals-rtl.test.ts
git commit --only src/app/globals.css src/app/globals-rtl.test.ts -m "feat(rtl): logical inset + transition в globals.css + .rtl-flip

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Свип A — app-shell + ui-kit

**Files (Modify):** `src/app/admin/layout.tsx:29`, `src/components/app/app-header/app-header.tsx` (:18, :19 — конверсия; :73, :93–100 — EXEMPT), `src/components/app/update-prompt.tsx:14`, `src/components/ui/toaster.tsx:19`, `src/components/ui/form-field.tsx:36`, `src/components/ui/table.tsx:32`.

**Это механический рефактор. Верификация = ugrep-safe греп (ниже) + просмотр диффа. Зелёный `pnpm test` тут малоинформативен (поведение не меняется).**

| Файл:строка | Было → Стало | Прим. |
|---|---|---|
| admin/layout.tsx:29 | `border-r` → `border-e` | правая граница сайдбара = inline-end |
| app-header.tsx:18 | `before:left-0` → `before:start-0` | full-width backdrop |
| app-header.tsx:19 | `md:border-l md:border-r` → `md:border-x`; `pl-4 pr-4` → `px-4` | симметрично |
| update-prompt.tsx:14 | `left-4 right-4 md:left-auto md:right-4` → `start-4 end-4 md:start-auto md:end-4` | `bottom-4`/`rounded-lg` НЕ трогать |
| toaster.tsx:19 | `right-4` → `end-4` |  |
| form-field.tsx:36 | `ml-0.5` → `ms-0.5` |  |
| table.tsx:32 | `text-left` → `text-start` |  |

**EXEMPT в app-header (НЕ трогать):** `collisionPadding={{left,right}}` (:73) — API Base UI; `data-[side=left/right]:…` в `positionerClassName` (:94) и `arrowClassName` (:100) — парятся с физическим `data-side`, который Base UI выдаёт уже пост-RTL-флип (подтверждено: `useAnchorPositioning` → `getLogicalSide`). `dialog.tsx` НЕ входит (его `left-1/2` — exempt-центрирование).

- [ ] **Step 1:** Применить карту.
- [ ] **Step 2: Verify (ugrep-safe):**
```bash
grep -nE "border-r([^a-z]|$)|before:left-0|md:border-l|md:border-r|pl-4 pr-4|left-4|md:left-auto|md:right-4|right-4|ml-0\.5|text-left" src/app/admin/layout.tsx src/components/app/update-prompt.tsx src/components/ui/toaster.tsx src/components/ui/form-field.tsx src/components/ui/table.tsx
```
Expected: пусто.
- [ ] **Step 3:** `pnpm test && pnpm lint` → PASS (снапшоты, если упали из-за классов — НЕ обновлять здесь, это Task 10).
- [ ] **Step 4: Коммит** (app-header/admin — shell-файлы, `git status` сначала):
```bash
git status src/components/app/app-header/app-header.tsx src/app/admin/layout.tsx
git add src/app/admin/layout.tsx src/components/app/app-header/app-header.tsx src/components/app/update-prompt.tsx src/components/ui/toaster.tsx src/components/ui/form-field.tsx src/components/ui/table.tsx
git commit --only src/app/admin/layout.tsx src/components/app/app-header/app-header.tsx src/components/app/update-prompt.tsx src/components/ui/toaster.tsx src/components/ui/form-field.tsx src/components/ui/table.tsx -m "refactor(rtl): логические свойства — shell + ui-kit (свип A)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Свип B — comments + editor-кластер

**Files (Modify):** `ast-merge-view.tsx:202`, `attachments-panel.tsx:95`, `annotation-anchor-context.tsx:35`, `canvas-editor.tsx:417`, `canvas-my-list.tsx:27`, `editor-toolbar.tsx:60`, `comment-anchor-context.tsx:34`, `comment-node-view.tsx:95`, `comment-reply-form.tsx:46`, `comment-tree-view.tsx:33`, `comment-tree.tsx:22` (полные пути — в карте/командах ниже).

**Механический рефактор (верификация = греп + дифф).**

| Файл:строка | Было → Стало |
|---|---|
| components/ast-merge/ast-merge-view.tsx:202 | `ml-auto` → `ms-auto` (**только :202; :196 — комментарий, не трогать текст**) |
| components/attachments/attachments-panel.tsx:95 | `ml-2` → `ms-2` |
| features/annotations/ui/annotation-anchor-context.tsx:35 | `border-l-2 pl-2` → `border-s-2 ps-2` |
| features/canvas/ui/canvas-editor.tsx:417 | `border-l` → `border-s` |
| features/canvas/ui/canvas-my-list.tsx:27 | `ml-2` → `ms-2` |
| features/canvas/ui/editor-toolbar.tsx:60 | `ml-auto` → `ms-auto` |
| features/comments/ui/comment-anchor-context.tsx:34 | `border-l-2 pl-2` → `border-s-2 ps-2` |
| features/comments/ui/comment-node-view.tsx:95 | `border-l-2 pl-2` → `border-s-2 ps-2` |
| features/comments/ui/comment-reply-form.tsx:46 | `border-l pl-3` → `border-s ps-3` |
| features/comments/ui/comment-tree-view.tsx:33 | `border-l ml-4 pl-3` → `border-s ms-4 ps-3` |
| features/comments/ui/comment-tree.tsx:22 | `border-l ml-4 pl-3` → `border-s ms-4 ps-3` |

- [ ] **Step 1:** Применить карту (в `ast-merge-view.tsx` править ТОЛЬКО :202; комментарий на :196 с текстом «ml-auto» оставить как есть).
- [ ] **Step 2: Verify (ugrep-safe):**
```bash
grep -rnE "ml-auto|ml-2|ml-4|border-l([^a-z]|$)|border-l-2|pl-2|pl-3" \
  src/components/attachments/attachments-panel.tsx \
  src/features/annotations/ui/annotation-anchor-context.tsx \
  src/features/canvas/ui/canvas-editor.tsx src/features/canvas/ui/canvas-my-list.tsx src/features/canvas/ui/editor-toolbar.tsx \
  src/features/comments/ui/comment-anchor-context.tsx src/features/comments/ui/comment-node-view.tsx src/features/comments/ui/comment-reply-form.tsx src/features/comments/ui/comment-tree-view.tsx src/features/comments/ui/comment-tree.tsx
# ast-merge-view проверить отдельно — допустимо ОДНО совпадение (комментарий :196):
grep -nE "ml-auto" src/components/ast-merge/ast-merge-view.tsx
```
Expected: первый — пусто; второй — только :196 (комментарий).
- [ ] **Step 3:** `pnpm test && pnpm lint` → PASS.
- [ ] **Step 4: Коммит:**
```bash
git add src/components/ast-merge/ast-merge-view.tsx src/components/attachments/attachments-panel.tsx src/features/annotations/ui/annotation-anchor-context.tsx src/features/canvas/ui/canvas-editor.tsx src/features/canvas/ui/canvas-my-list.tsx src/features/canvas/ui/editor-toolbar.tsx src/features/comments/ui/comment-anchor-context.tsx src/features/comments/ui/comment-node-view.tsx src/features/comments/ui/comment-reply-form.tsx src/features/comments/ui/comment-tree-view.tsx src/features/comments/ui/comment-tree.tsx
git commit --only src/components/ast-merge/ast-merge-view.tsx src/components/attachments/attachments-panel.tsx src/features/annotations/ui/annotation-anchor-context.tsx src/features/canvas/ui/canvas-editor.tsx src/features/canvas/ui/canvas-my-list.tsx src/features/canvas/ui/editor-toolbar.tsx src/features/comments/ui/comment-anchor-context.tsx src/features/comments/ui/comment-node-view.tsx src/features/comments/ui/comment-reply-form.tsx src/features/comments/ui/comment-tree-view.tsx src/features/comments/ui/comment-tree.tsx -m "refactor(rtl): логические свойства — comments + editor (свип B)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Свип C — notifications + tables + 3D-оверлей-панели

**Files (Modify):** `notification-bell.tsx:105`, `notification-item.tsx:50`, `notification-popover.tsx:46`, `users-table.tsx:62`, `production-stats-table.tsx:34-52`, `graph-view.tsx:141`, `map-point-panel.tsx:31`, `semantic-map-view.tsx:147`.

| Файл:строка | Было → Стало | Прим. |
|---|---|---|
| notifications/ui/notification-bell.tsx:105 | `-right-0.5` → `-end-0.5` | бейдж (негатив) |
| notifications/ui/notification-item.tsx:50 | `text-left` → `text-start` |  |
| notifications/ui/notification-popover.tsx:46 | `right-0` → `end-0` |  |
| users/ui/users-table.tsx:62 | `ml-1` → `ms-1` |  |
| statistics/ui/production-stats-table.tsx:34-52 | `text-right` (×9) → `text-end` | числовые колонки |
| reference-graph/ui/graph-view.tsx:141 | `right-3` → `end-3` | UI-оверлей НАД сценой |
| semantic-map/ui/map-point-panel.tsx:31 | `left-3` → `start-3` |  |
| semantic-map/ui/semantic-map-view.tsx:147 | `right-3` → `end-3` | UI-оверлей |

**Важно:** оверлей-панели графа/карты (`right-3`/`left-3`) — UI-хром, их зеркалить НУЖНО. Они должны остаться ВНЕ `dir="ltr"`-изоляции canvas (см. Task 7 — изоляция оборачивает только canvas+region-labels).

- [ ] **Step 1:** Применить карту.
- [ ] **Step 2: Verify (ugrep-safe):**
```bash
grep -rnE "\-right-0\.5|text-left|right-0([^a-z]|$)|ml-1|text-right|right-3|left-3" \
  src/features/notifications/ui/notification-bell.tsx src/features/notifications/ui/notification-item.tsx src/features/notifications/ui/notification-popover.tsx \
  src/features/users/ui/users-table.tsx src/features/statistics/ui/production-stats-table.tsx \
  src/features/reference-graph/ui/graph-view.tsx src/features/semantic-map/ui/map-point-panel.tsx src/features/semantic-map/ui/semantic-map-view.tsx
```
Expected: пусто.
- [ ] **Step 3:** `pnpm test && pnpm lint` → PASS.
- [ ] **Step 4: Коммит:**
```bash
git add src/features/notifications/ui/notification-bell.tsx src/features/notifications/ui/notification-item.tsx src/features/notifications/ui/notification-popover.tsx src/features/users/ui/users-table.tsx src/features/statistics/ui/production-stats-table.tsx src/features/reference-graph/ui/graph-view.tsx src/features/semantic-map/ui/map-point-panel.tsx src/features/semantic-map/ui/semantic-map-view.tsx
git commit --only src/features/notifications/ui/notification-bell.tsx src/features/notifications/ui/notification-item.tsx src/features/notifications/ui/notification-popover.tsx src/features/users/ui/users-table.tsx src/features/statistics/ui/production-stats-table.tsx src/features/reference-graph/ui/graph-view.tsx src/features/semantic-map/ui/map-point-panel.tsx src/features/semantic-map/ui/semantic-map-view.tsx -m "refactor(rtl): логические свойства — notifications + tables + 3D-оверлеи (свип C)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Изоляция 3D-сцен (`dir="ltr"` вокруг canvas + region-labels)

**Files:**
- Modify: `src/features/semantic-map/ui/semantic-map-view.tsx` (~:144–149), `src/features/reference-graph/ui/graph-view.tsx` (~:137–150)
- Test: `src/features/semantic-map/ui/semantic-map-direction.test.tsx` (create; по образцу `src/features/semantic-map/ui/semantic-map-view.test.tsx`)

**Контекст (реальная структура, подтверждено чтением):** общей React-обёртки canvas в `scene-3d/` НЕТ — `<canvas>` монтируется пофично. В `semantic-map-view.tsx`:

```tsx
<div ref={wrapRef} className="relative h-full w-full overflow-hidden">
  <canvas ref={canvasRef} className="block h-full w-full" />
  <MapRegionLabels labels={labels} />
  <div className="absolute end-3 top-3"><MapModeToggle .../></div>   {/* UI — зеркалится */}
  {/* empty-state, MapPointPanel — тоже UI */}
</div>
```

Цель: `dir="ltr"` накрывает ТОЛЬКО `<canvas>` + region-labels (их inline `left: l.x` — canvas-координаты), а оверлей-панели (toggle/point/empty) остаются СНАРУЖИ под направлением страницы. Решение — новая внутренняя обёртка `absolute inset-0` (тот же бокс, что `wrapRef`), чтобы не сломать позиционирование labels.

- [ ] **Step 1: Прочитать обе точки монтирования** (`semantic-map-view.tsx`, `graph-view.tsx`), убедиться в структуре (canvas + *RegionLabels сиблинги; toggle/панели — отдельные absolute-сиблинги).

- [ ] **Step 2: Падающий тест** — create `src/features/semantic-map/ui/semantic-map-direction.test.tsx` (моки renderer/данных — скопировать из существующего `semantic-map-view.test.tsx`):

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { SemanticMapView } from "./semantic-map-view";

afterEach(cleanup);

describe("3D-изоляция направления (карта)", () => {
  it("canvas+labels под dir=ltr, а оверлей-панель — снаружи (зеркалится)", () => {
    const { container } = render(
      <div dir="rtl" style={{ height: 400 }}>
        <SemanticMapView {/* минимальные пропсы/моки как в semantic-map-view.test.tsx */} />
      </div>,
    );
    const isolated = container.querySelector('[data-scene-canvas]');
    expect(isolated?.getAttribute("dir")).toBe("ltr");
    expect(isolated?.querySelector("canvas")).not.toBeNull();
    // НЕГАТИВ: оверлей-тогл НЕ должен сидеть внутри dir=ltr изоляции
    const toggleHost = container.querySelector(".end-3, [class*='end-3']");
    expect(toggleHost?.closest('[data-scene-canvas]')).toBeNull();
  });
});
```

- [ ] **Step 3:** `pnpm test -- src/features/semantic-map/ui/semantic-map-direction.test.tsx` → FAIL.

- [ ] **Step 4: Реализация в `semantic-map-view.tsx` и `graph-view.tsx`** — обернуть canvas + region-labels:

```tsx
<div ref={wrapRef} className="relative h-full w-full overflow-hidden">
  <div data-scene-canvas dir="ltr" className="absolute inset-0">
    <canvas ref={canvasRef} className="block h-full w-full" />
    <MapRegionLabels labels={labels} />
  </div>
  <div className="absolute end-3 top-3"><MapModeToggle .../></div>
  {/* empty-state, MapPointPanel — без изменений, остаются снаружи */}
</div>
```

(в `graph-view.tsx` — аналогично: `<canvas>` + `SceneRegionLabels` внутрь `data-scene-canvas dir="ltr"`, тогл-оверлей снаружи). Проверить, что renderer читает `canvasRef` напрямую (размер не пострадал — обёртка `absolute inset-0` совпадает с боксом `wrapRef`).

- [ ] **Step 5:** `pnpm test -- src/features/semantic-map/ui/semantic-map-direction.test.tsx && pnpm test && pnpm build` → PASS + OK.

- [ ] **Step 6: Коммит** (по имени):
```bash
git add src/features/semantic-map/ui/semantic-map-view.tsx src/features/reference-graph/ui/graph-view.tsx src/features/semantic-map/ui/semantic-map-direction.test.tsx
git commit --only src/features/semantic-map/ui/semantic-map-view.tsx src/features/reference-graph/ui/graph-view.tsx src/features/semantic-map/ui/semantic-map-direction.test.tsx -m "feat(rtl): dir=ltr изоляция 3D-canvas (карта/граф не зеркалятся, оверлеи — да)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: bidi-изоляция always-LTR контента (код / идентификаторы)

**Files:**
- Modify: `src/components/ast-render/block-renderer.tsx` (~:46 `<pre>`), `src/components/ast-render/inline-renderer.tsx` (~:53 `<code>`), `src/features/tokens/ui/connect-instructions.tsx` (curl-сниппет), `src/features/tokens/ui/token-list.tsx` (~:123 — ID/`token_hint` ячейки)
- Test: `src/components/ast-render/ast-render-bidi.test.tsx` (create)

**Контекст:** в RTL пунктуация/скобки кода и латинские ID рвутся bidi-алгоритмом без `dir="ltr"`. `BlockRenderer` принимает проп **`{ block, ctx }`** (НЕ `node`); code-узел рендерится как `<pre data-language=…><code>{text}</code></pre>` (текст из дочерних text-узлов). `token-list.tsx` ID-колонки латинские → bidi-изоляция ОБЯЗАТЕЛЬНА (не опционально).

- [ ] **Step 1: Прочитать рендереры** и реальную форму узла:
```bash
grep -nE "<pre|<code|block|ctx|token\.id|token_hint" src/components/ast-render/block-renderer.tsx src/components/ast-render/inline-renderer.tsx src/features/tokens/ui/connect-instructions.tsx src/features/tokens/ui/token-list.tsx
```

- [ ] **Step 2: Падающий тест** — create `src/components/ast-render/ast-render-bidi.test.tsx` (форму `block`/`ctx` взять из реального типа и существующего `ast-render.test.tsx`):

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { BlockRenderer } from "./block-renderer";

afterEach(cleanup);

describe("ast-render bidi-изоляция", () => {
  it("code-блок несёт dir=ltr на <pre>", () => {
    // block/ctx — собрать по реальным типам (см. ast-render.test.tsx); это code-блок
    const { container } = render(<BlockRenderer block={/* code-block */} ctx={/* ctx */} />);
    const pre = container.querySelector("pre");
    expect(pre?.getAttribute("dir")).toBe("ltr");
  });
});
```

- [ ] **Step 3:** `pnpm test -- src/components/ast-render/ast-render-bidi.test.tsx` → FAIL.

- [ ] **Step 4: Реализация** — `dir="ltr"` точечно:
  - `block-renderer.tsx`: `<pre dir="ltr" …>`
  - `inline-renderer.tsx`: `<code dir="ltr">…</code>`
  - `connect-instructions.tsx`: обёртка curl-сниппета `dir="ltr"`
  - `token-list.tsx`: ID/`token_hint` ячейки — `<span dir="ltr">{token.id}</span>` (или `<bdi>`)

- [ ] **Step 5:** `pnpm test -- src/components/ast-render/ast-render-bidi.test.tsx && pnpm test` → PASS.

- [ ] **Step 6: Коммит** (по имени):
```bash
git add src/components/ast-render/block-renderer.tsx src/components/ast-render/inline-renderer.tsx src/features/tokens/ui/connect-instructions.tsx src/features/tokens/ui/token-list.tsx src/components/ast-render/ast-render-bidi.test.tsx
git commit --only src/components/ast-render/block-renderer.tsx src/components/ast-render/inline-renderer.tsx src/features/tokens/ui/connect-instructions.tsx src/features/tokens/ui/token-list.tsx src/components/ast-render/ast-render-bidi.test.tsx -m "feat(rtl): bidi-изоляция кода/идентификаторов (dir=ltr)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Направление-агностичные стрелки навигации (потребитель `.rtl-flip`)

**Files:**
- Create: `src/assets/icons/chevron-icon.tsx`
- Modify (компоненты): `src/components/ui/pagination.tsx` (:44–45 defaults), `src/features/events/ui/calendar-view.tsx` (~:43,50 prev/next месяца), + компоненты, рендерящие «назад»/«вперёд»-лейблы (admin shell, canvas back, editor change-lecture, doc-edit back, settings-ссылки) — найти по ключам ниже
- Modify (i18n, ru+en — снять глиф из строк): `common.ts:38-39`, `events.ts:5-6`, `canvas.ts` (`back`), `editor.ts:103`, `pages.ts:161`, `admin.ts:7-8 / :53-54`, `settings.ts:10-11`

**Цель:** глиф направления убираем из ТЕКСТА (он становится направление-агностичным), а направленность выражаем иконкой-шевроном с `.rtl-flip`. Инструктивные `→` («затем/ведёт к») в `common.ts:17` и `tokens.ts:33` — НЕ навигация, оставить (bidi справляется).

- [ ] **Step 1: Найти все рендер-сайты лейблов:**
```bash
grep -rnE "paginationLabels|prev|next|prevMonth|nextMonth|shellBackToSite|documentEditBack|commentPickerChangeLecture" src/components src/features src/app --include="*.tsx" | grep -viE "\.test\."
```
Сопоставить с ключами i18n (`grep -rn "← \|→" src/i18n/messages --include="*.ts" | grep -v test`).

- [ ] **Step 2: Падающий тест** — create `src/assets/icons/chevron-icon.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ChevronIcon } from "./chevron-icon";

afterEach(cleanup);

describe("ChevronIcon", () => {
  it("рендерит svg и принимает className (для .rtl-flip)", () => {
    const { container } = render(<ChevronIcon className="rtl-flip" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("class")).toContain("rtl-flip");
  });
});
```

- [ ] **Step 3:** `pnpm test -- src/assets/icons/chevron-icon.test.tsx` → FAIL.

- [ ] **Step 4: Создать `chevron-icon.tsx`** (по образцу `src/assets/icons/dropdown-arrow-icon.tsx` — те же пропсы/размер; шеврон, указывающий в inline-end, т.е. «вправо» в LTR):

```tsx
// Горизонтальный шеврон. По умолчанию указывает в сторону чтения (inline-end).
// Для «назад»/prev — повернуть на 180°; для RTL — класс .rtl-flip зеркалит.
export function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden className={className}>
      <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

- [ ] **Step 5: Снять глифы из i18n-строк** (ru+en): `"← Назад"`→`"Назад"`, `"Вперёд →"`→`"Вперёд"`, `"← Предыдущий"`→`"Предыдущий"`, `"Следующий →"`→`"Следующий"`, `"← На сайт"`→`"На сайт"`, `"← Сменить лекцию"`→`"Сменить лекцию"`, `"← К документу"`→`"К документу"`, `"Посмотреть мою статистику →"`→`"Посмотреть мою статистику"`, `"Персональные токены доступа →"`→`"Персональные токены доступа"`, `"Управление документами и медиа лекции →"`→без `→`. EN-аналоги симметрично. (Сверить ICU-parity-тест не сломан.)

- [ ] **Step 6: Вставить шеврон в рендер-сайты** с `.rtl-flip`:
  - prev/«назад»: `<ChevronIcon className="rtl-flip rotate-180" /> {label}`
  - next/«вперёд»/affordance: `{label} <ChevronIcon className="rtl-flip" />`
  (в `pagination.tsx` дефолты :44–45 — убрать глиф из строк-дефолтов, рендерить иконку.)

- [ ] **Step 7:** `pnpm test && pnpm lint && pnpm build` → PASS (ICU-parity, существующие тесты лейблов — обновить осознанно, если ассертят старый текст с глифом).

- [ ] **Step 8: Коммит** (i18n — hot-файлы, `git status` сначала; пути выписать явно по результату Step 1):
```bash
git status src/i18n/messages/ru src/i18n/messages/en
git add src/assets/icons/chevron-icon.tsx src/assets/icons/chevron-icon.test.tsx <рендер-компоненты> <i18n-каталоги ru+en>
git commit --only <те же пути> -m "feat(rtl): направление-агностичные стрелки навигации (ChevronIcon + .rtl-flip)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Снять снапшот-долг (если есть)

- [ ] **Step 1:** `pnpm test` целиком.
- [ ] **Step 2:** Если упали снапшоты из-за переименованных классов (свипы 4–6) или иконок-стрелок (Task 9) — осознанно обновить `pnpm exec vitest run -u`; просмотреть дифф: меняются только имена классов / появление `<svg>`-шеврона, ничего структурного неожиданного.
- [ ] **Step 3:** `pnpm test` → зелёное.
- [ ] **Step 4: Коммит** обновлённых снапшотов по имени (если менялись). Иначе — пропустить задачу.

---

## Task 11: Финальный аудит свипа — нулевой остаток

- [ ] **Step 1: ugrep-safe аудит остатка** (исключая ложные/exempt):
```bash
grep -rnE "ml-[0-9]|mr-[0-9]|pl-[0-9]|pr-[0-9]|left-[0-9]|right-[0-9]|-ml-|-mr-|-left-|-right-|text-left|text-right|float-left|float-right|border-l([^a-z]|-[0-9])|border-r([^a-z]|-[0-9])" src --include="*.tsx" \
  | grep -vE "data-\[side=" \
  | grep -vE "left-1/2" \
  | grep -vE "ast-merge-view.tsx:196"
```
Expected: пусто. Любое совпадение — либо пропуск свипа (доделать), либо новый exempt (задокументировать).
- [ ] **Step 2:** Зафиксировать список exempt-строк для Task 12: app-header `data-[side]` (:94, :100) + `collisionPadding` (:73); `dialog.tsx:57` центрирование; inline `left: screen.x` в `scene-region-labels.tsx:20` и `editor-text-overlay.tsx:55`.
- [ ] **Step 3:** Чисто → коммита нет; передать список exempt в Task 12.

---

## Task 12: ESLint Guardrail 9 — запрет физических direction-классов

**Files:**
- Modify: `eslint.config.mjs` (новый отдельный блок), `eslint.config.test.mjs` (расширить массив `cases`)
- Modify (`eslint-disable` с обоснованием): exempt-строки из Task 11

**Контекст (реальный харнесс):** фикстура — это **standalone `node eslint.config.test.mjs`** на `Linter` + `node:assert` с массивом `cases` и `lintSnippet()`, прогон через синтетический путь `src/app/page.tsx` (type-aware projectService отвергает иной). НЕ `RuleTester`. `pnpm lint` (`eslint src/`) сам конфиг не линтит. flat-config **НЕ мержит** `no-restricted-syntax` между блоками (см. комментарии в конфиге, стр. ~211/236) → Guardrail 9 должен быть **отдельным блоком на весь `src/**/*.{ts,tsx}`** (включая `src/components/ui/**`, который свип трогал), со своим `no-restricted-syntax`.

**Должен идти ПОСЛЕ свипа (4–6), спец-поверхностей (7–8) и стрелок (9)** — иначе `pnpm lint` красный.

- [ ] **Step 1: Расширить `cases` в `eslint.config.test.mjs`** (по образцу существующих кейсов; включить реальные формы):

```
positive (флагается):
  className="ml-2"; className="text-right"; className="border-l"; className="-right-0.5";
  cn("border-l rounded", x);                      // токен внутри cn()-аргумента
  const c = "fixed left-0 right-0";               // вынесенная const-строка классов
  style={{ marginLeft: 4 }}
negative (НЕ флагается):
  className="ms-2"; className="text-end"; className="border-s"; className="-end-0.5";
  className="rounded-lg"; className="px-4"; className="border-x";
  "left-aligned";                                 // не класс (substring), не флагать
  style={{ marginInlineStart: 4 }}
  // exempt — закрыты eslint-disable отдельно, в фикстуре проверять, что БЕЗ disable они флагаются:
  "data-[side=left]:before:right-[-10px]"
```

- [ ] **Step 2:** Прогнать фикстуру (`node eslint.config.test.mjs`) → FAIL (правила нет).

- [ ] **Step 3: Добавить Guardrail 9 в `eslint.config.mjs`** — отдельный блок `files: ["src/**/*.{ts,tsx}"]`, селекторы по строковым литералам и template-частям (ловят и `cn()`-аргументы, и вынесенные const, т.к. это просто `Literal`/`TemplateElement`):

```js
{
  files: ["src/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-syntax": [
      "error",
      // Физические direction-классы в строковых литералах (className, cn()-аргументы, const-строки).
      // Границы — символьные классы (без \b, ESLint-regex это ок, но держим единообразно).
      { selector: "Literal[value=/(^|[\\s\"'`:])(ml|mr|pl|pr)-[0-9]/]", message: "RTL: используй логические ms/me/ps/pe." },
      { selector: "Literal[value=/(^|[\\s\"'`:])-?(left|right)-/]", message: "RTL: используй логические start/end (inset)." },
      { selector: "Literal[value=/(^|[\\s\"'`:])-(ml|mr)-/]", message: "RTL: используй -ms/-me." },
      { selector: "Literal[value=/(^|[\\s\"'`:])text-(left|right)([^a-z]|$)/]", message: "RTL: text-start/text-end." },
      { selector: "Literal[value=/(^|[\\s\"'`:])float-(left|right)([^a-z]|$)/]", message: "RTL: float-start/float-end." },
      { selector: "Literal[value=/(^|[\\s\"'`:])border-[lr]([^a-z]|-[0-9])/]", message: "RTL: border-s/border-e." },
      { selector: "Literal[value=/(^|[\\s\"'`:])rounded-[lr]([^a-z]|-)/]", message: "RTL: rounded-s/rounded-e." },
      // Физические свойства в style-объектах:
      { selector: "Property[key.name=/^(marginLeft|marginRight|paddingLeft|paddingRight|left|right|borderLeft|borderRight)$/]", message: "RTL: используй *Inline*/inset-inline свойства." },
      { selector: "Property[key.name='textAlign'][value.value=/^(left|right)$/]", message: "RTL: textAlign start/end." },
    ],
  },
},
```

Регэкспы проверены: `border-[lr]([^a-z]|-[0-9])` ловит `border-l`/`border-l-2`, НЕ `border-lg`(такого нет)/`border-s`; `rounded-[lr]([^a-z]|-)` ловит `rounded-l`/`rounded-l-lg`, НЕ `rounded-lg`. **Внимание (ловушка проекта):** ESLint-regex со слешем `/` в значении ломает парсер селектора — слешей в паттернах НЕТ, ок. Если ложно срабатывает на не-className строках (напр. данные) — сузить до `JSXAttribute[name.name='className'] Literal` + отдельный селектор для `cn(` через `CallExpression[callee.name='cn'] Literal`. Решение зафиксировать тестом Step 4.

- [ ] **Step 4:** `node eslint.config.test.mjs` → PASS (positive флагаются, negative — нет, особенно `rounded-lg`/`px-4`/`-end-0.5`/`"left-aligned"`).

- [ ] **Step 5: Закрыть exempt** узким `// eslint-disable-next-line no-restricted-syntax -- <причина>`:
  - app-header :73 — `Base UI API: collisionPadding физический по контракту`
  - app-header :94 (positioner) / :100 (arrow) — `парятся с физическим data-side Base UI (RTL учтён DirectionProvider)`
  - dialog.tsx:57 — `геометрическое центрирование, направление-нейтрально`
  - scene-region-labels.tsx:20, editor-text-overlay.tsx:55 — `inline-координаты canvas, не layout`

- [ ] **Step 6:** `pnpm lint && pnpm test` → PASS (ни ложных, ни незакрытых exempt).

- [ ] **Step 7: Коммит** (`eslint.config.mjs` — hot, `git status` сначала):
```bash
git status eslint.config.mjs
git add eslint.config.mjs eslint.config.test.mjs src/components/app/app-header/app-header.tsx src/components/ui/dialog.tsx src/components/scene-3d/ui/scene-region-labels.tsx src/features/canvas/ui/editor-text-overlay.tsx
git commit --only eslint.config.mjs eslint.config.test.mjs src/components/app/app-header/app-header.tsx src/components/ui/dialog.tsx src/components/scene-3d/ui/scene-region-labels.tsx src/features/canvas/ui/editor-text-overlay.tsx -m "feat(rtl): ESLint Guardrail 9 — запрет физических direction-классов

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Документация — раздел RTL

**Files:** Modify `docs/frontend-conventions.md`

- [ ] **Step 1:** Добавить раздел «RTL / направление письма»:
  - Логические свойства обязательны (`ms/me/ps/pe/start/end/border-s/border-e/text-start/text-end`); физические запрещены Guardrail 9.
  - Направление из локали (`dirForLocale`, `src/i18n/locales.ts`) → `<html dir>` + Base UI `DirectionProvider`. НЕ настройка, НЕ ось appearance.
  - Base UI зеркалится через `DirectionProvider`; `data-[side=left/right]` companions остаются физическими (Base UI выдаёт `data-side` пост-RTL-флип).
  - Спец-поверхности: 3D-canvas изолируется `dir="ltr"` (обёртка `data-scene-canvas` вокруг canvas+region-labels, оверлеи — снаружи); код/идентификаторы — `dir="ltr"`/`<bdi>`; направленные стрелки навигации — `ChevronIcon` + `.rtl-flip` (глиф НЕ в тексте лейбла).
  - Exempt требует `eslint-disable` с обоснованием.
  - **Известные ограничения / follow-up (ПРАВИЛЬНАЯ атрибуция):** инструктивные `→` («затем/ведёт к») в `common.ts:17` (PWA-инструкция) и `tokens.ts:33` (Settings → Connectors) оставлены как контент — это не навигация, bidi-алгоритм их обрабатывает. Глиф `→` в `.fancy-link::after` (globals.css) — декоративный, не флипается (MINOR). Гильметы `«»` — пунктуация, обрабатывается bidi.
  - Проверка RTL без перевода: тесты на `dir="rtl"` + временно `document.documentElement.dir = "rtl"` в dev.
- [ ] **Step 2: Коммит:**
```bash
git add docs/frontend-conventions.md
git commit --only docs/frontend-conventions.md -m "docs(rtl): раздел про логические свойства и направление

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Финальный гейт

- [ ] **Step 1:** `pnpm lint` → PASS (вкл. Guardrail 9).
- [ ] **Step 2:** `pnpm test` → PASS (новые: direction, layout-direction, globals-rtl, semantic-map-direction, ast-render-bidi, chevron-icon, eslint-фикстура; существующие — зелёные).
- [ ] **Step 3:** `pnpm build` → OK.
- [ ] **Step 4:** Ручная проверка (опц., не блокирует): в dev `document.documentElement.dir = "rtl"` → пройти header, админ-сайдбар, дерево комментариев, диалог, тосты, пагинацию/календарь (стрелки смотрят верно), карту/граф (canvas + labels НЕ зеркалятся, оверлеи — да), code-блоки (остаются LTR).
- [ ] **Step 5:** Красное → вернуться в соответствующую Task.

---

## Self-Review v2 (после мульти-агентного ревью)

**Покрытие спеки:** §1→T1; §2→T2 (+DirectionProvider); §3→T3–T6, аудит T11; §4 (3D→T7, код→T8, иконки/стрелки→T3+T9); §5→T12; §6→тесты в каждой + T14; §7→T13. ✓

**Закрытые находки ревью:** B1 (ugrep-грепы) — все verify/audit переписаны без `\b`-в-альтернации. B2/B3 (3D) — T7 переписан под per-feature структуру, обёртка вокруг canvas+labels, негатив-ассерт. M1/M2 (стрелки/`.rtl-flip`) — T9 даёт `.rtl-flip` потребителя, контент направление-агностичен. M3 (ESLint) — T12 под `Linter`-харнесс + esquery + блок на `src/**` + негатив-инсеты + синтетический путь. M4 (`transition: left`) — T3. M5 (hot-файлы) — `git status`-чек в T2/T3/T9/T12 + Global Constraints. M6 (отброшенные файлы) — перечислены в File Structure.

**Подтверждено корректным (ревью):** Tailwind v4 логические утилиты валидны (вкл. `-end-*`, `border-x`); Base UI `data-side` физический пост-флип → exempt верен; регэксп `rounded-[lr](?![a-z])`/`border-[lr]` корректны; карта свипа точна; клавнавигация вертикальная; нет `dangerouslySetInnerHTML`.

**Остаточные осознанные ограничения:** инструктивные `→` (PWA/tokens), `→` в `.fancy-link::after`, гильметы `«»` — контент/декор, не инфраструктура (задокументировано в T13). Ручной WebGL-приём RTL карты/графа — в T14 Step 4 (не блокирует).
