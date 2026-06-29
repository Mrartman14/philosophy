# Forms as Shared-Content + Survey Results — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать формам поверхность результатов (агрегат + атрибутированные ответы) и привести их подачу к модели shared-content с двумя осями видимости.

**Architecture:** Архитектура A — отдельные роуты. Расширяем gateway `/forms/[id]`; добавляем `/forms/[id]/results` (агрегат) и `/forms/[id]/fields/[fieldId]` (колонка ответов поля); добавляем ось `submission_visibility` в создание. Индекс `/forms` — отдельная фаза, блокирована новой бэк-ручкой `GET /api/forms`. Всё — server components + server actions, read-контракт бэка готов.

**Tech Stack:** Next 16 (App Router, RSC), TypeScript, openapi-fetch (`createApiClient`), Zod, vitest + @testing-library/react (jsdom), pnpm. i18n через `@/i18n` (server) / `@/i18n/client`.

## Global Constraints

- Слайс-структура и паттерны — `docs/frontend-conventions.md`; запретные зоны — `AGENTS.md` (НЕ трогать `src/api/schema.ts`, ui-kit, shell-layout’ы и пр.).
- Параллельные агенты: НЕ `git stash/reset/checkout./clean`, НЕ `git add -A`; добавлять только свои файлы по имени. Коммит: `git add <свои> && git commit --only <те же>`.
- Атрибуция результатов **обязательна** (Принцип 6 бэка: «анонимности нет — есть только приватность»). Анонимизация запрещена.
- `% по опции = count / FieldStats.answered` (НЕ `total_submissions`). multi_choice: сумма count может быть >100%.
- CSP: НЕ инлайн-`style` с динамикой. Бары — inline-SVG (атрибуты геометрии).
- Чтения форм пробрасывают `?token=` во все эндпоинты результатов.
- Гейт перед PR: `pnpm lint && pnpm test && pnpm build` — зелёные.
- Субагенты-имплементеры/ревьюеры — на Opus.
- Стат-фетчи — `React.cache` (как остальной `forms/api.ts`), без `unstable_cache`/тегов; результаты свежие на каждый запрос.

---

## File Structure

**Phase 1 — данные/типы/права**
- Modify `src/features/forms/types.ts` — type-алиасы статистики.
- Create `src/features/forms/answer-read.ts` (+ `.test.ts`) — `readAnswerValue`.
- Modify `src/features/forms/api.ts` — `getFormStats`, `getFieldAnswers`.
- Modify `src/features/forms/permissions.ts` (+ `permissions.test.ts`) — `canViewFormResults`.
- Modify `src/features/forms/index.ts` — экспорты.

**Phase 2 — /results**
- Create `src/features/forms/ui/choice-bars.tsx` (+ `.test.tsx`).
- Create `src/features/forms/ui/number-summary.tsx`, `date-summary.tsx`, `text-answers-preview.tsx`.
- Create `src/features/forms/ui/field-stats-card.tsx` — диспетчер по типу.
- Create `src/features/forms/ui/form-results-view.tsx` — шапка + карточки.
- Create `src/app/forms/[id]/results/page.tsx`.
- Modify `src/i18n/messages/{ru,en}/forms.ts` (+ ar/zh плумбинг).

**Phase 3 — gateway**
- Create `src/features/forms/ui/form-visibility-badges.tsx` (+ `.test.tsx`).
- Modify `src/features/forms/ui/form-fill.tsx` — консент при public.
- Modify `src/app/forms/[id]/page.tsx` — бейджи + вход «Результаты».

**Phase 4 — колонка поля**
- Create `src/features/forms/ui/field-answers-column.tsx` (+ `.test.tsx`).
- Create `src/app/forms/[id]/fields/[fieldId]/page.tsx`.

**Phase 5 — submission_visibility в создании**
- Modify `src/api/enums.ts` — `FORM_SUBMISSION_VISIBILITY`.
- Modify `src/features/forms/schemas.ts` — поле + create-инвариант.
- Modify `src/features/forms/ui/form-builder.tsx` — селектор (create).
- Modify `src/features/forms/actions.ts` — тело create.

**Phase 6 — индекс /forms (БЛОКИРОВАНО бэком)** — см. конец плана.

---

## Phase 1 — Данные, типы, права

### Task 1: Type-алиасы статистики

**Files:**
- Modify: `src/features/forms/types.ts`

**Interfaces:**
- Produces: типы `FormStats, FieldStats, OptionStat, NumberStats, DateStats, FieldAnswerItem, AnswerValue, SubmissionVisibility`.

- [ ] **Step 1: Добавить алиасы** в конец `src/features/forms/types.ts`:

```ts
/** Агрегат по форме (GET /api/forms/{id}/stats). */
export type FormStats = components["schemas"]["form.FormStats"];

/** Агрегат по одному полю. */
export type FieldStats = components["schemas"]["form.FieldStats"];

/** Счётчик одной опции choice-поля. */
export type OptionStat = components["schemas"]["form.OptionStat"];

/** Числовая сводка (number-поле). */
export type NumberStats = components["schemas"]["form.NumberStats"];

/** Сводка дат (date-поле). */
export type DateStats = components["schemas"]["form.DateStats"];

/** Один ответ в колоночном просмотре поля (GET /api/forms/{id}/fields/{fieldId}/answers). */
export type FieldAnswerItem = components["schemas"]["form.FieldAnswerItem"];

/** Типизированное значение ответа по типу поля. */
export type AnswerValue = components["schemas"]["form.AnswerValue"];

/** Видимость результатов: private | public. */
export type SubmissionVisibility = components["schemas"]["form.SubmissionVisibility"];
```

- [ ] **Step 2: Проверить компиляцию**

Run: `pnpm exec tsc --noEmit`
Expected: без ошибок (импорт `components` уже есть в файле).

- [ ] **Step 3: Commit**

```bash
git add src/features/forms/types.ts
git commit -m "feat(forms): type-алиасы статистики результатов"
```

---

### Task 2: `readAnswerValue` — типобезопасное сужение AnswerValue

**Files:**
- Create: `src/features/forms/answer-read.ts`
- Test: `src/features/forms/answer-read.test.ts`

**Interfaces:**
- Consumes: `FieldType`, `AnswerValue` (Task 1).
- Produces: `readAnswerValue(type: FieldType, value: AnswerValue | undefined): ReadValue` где
  `ReadValue = { kind: "text"; text: string } | { kind: "number"; number: number } | { kind: "date"; date: string } | { kind: "single"; optionId: string } | { kind: "multi"; optionIds: string[] } | { kind: "empty" }`.

- [ ] **Step 1: Написать падающий тест** `src/features/forms/answer-read.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import { readAnswerValue } from "./answer-read";

describe("readAnswerValue", () => {
  it("text/long_text → kind text", () => {
    expect(readAnswerValue("text", { text: "hi" })).toEqual({ kind: "text", text: "hi" });
    expect(readAnswerValue("long_text", { text: "x" })).toEqual({ kind: "text", text: "x" });
  });
  it("number → kind number", () => {
    expect(readAnswerValue("number", { number: 42 })).toEqual({ kind: "number", number: 42 });
  });
  it("date → kind date", () => {
    expect(readAnswerValue("date", { date: "2026-06-29" })).toEqual({ kind: "date", date: "2026-06-29" });
  });
  it("single_choice → kind single", () => {
    expect(readAnswerValue("single_choice", { option_id: "o1" })).toEqual({ kind: "single", optionId: "o1" });
  });
  it("multi_choice → kind multi", () => {
    expect(readAnswerValue("multi_choice", { option_ids: ["a", "b"] })).toEqual({ kind: "multi", optionIds: ["a", "b"] });
  });
  it("отсутствующее значение → kind empty", () => {
    expect(readAnswerValue("text", undefined)).toEqual({ kind: "empty" });
    expect(readAnswerValue("number", {})).toEqual({ kind: "empty" });
    expect(readAnswerValue("multi_choice", { option_ids: [] })).toEqual({ kind: "empty" });
  });
});
```

- [ ] **Step 2: Запустить — упадёт**

Run: `pnpm exec vitest run src/features/forms/answer-read.test.ts`
Expected: FAIL — "Cannot find module './answer-read'".

- [ ] **Step 3: Реализация** `src/features/forms/answer-read.ts`:

```ts
// src/features/forms/answer-read.ts
import type { AnswerValue, FieldType } from "./types";

export type ReadValue =
  | { kind: "text"; text: string }
  | { kind: "number"; number: number }
  | { kind: "date"; date: string }
  | { kind: "single"; optionId: string }
  | { kind: "multi"; optionIds: string[] }
  | { kind: "empty" };

/** Сужает opaque AnswerValue к варианту по типу поля. Пустое/несоответствующее → empty. */
export function readAnswerValue(type: FieldType, value: AnswerValue | undefined): ReadValue {
  const v = value ?? {};
  switch (type) {
    case "text":
    case "long_text":
      return v.text ? { kind: "text", text: v.text } : { kind: "empty" };
    case "number":
      return typeof v.number === "number" ? { kind: "number", number: v.number } : { kind: "empty" };
    case "date":
      return v.date ? { kind: "date", date: v.date } : { kind: "empty" };
    case "single_choice":
      return v.option_id ? { kind: "single", optionId: v.option_id } : { kind: "empty" };
    case "multi_choice":
      return v.option_ids && v.option_ids.length > 0
        ? { kind: "multi", optionIds: v.option_ids }
        : { kind: "empty" };
    default:
      return { kind: "empty" };
  }
}
```

- [ ] **Step 4: Запустить — пройдёт**

Run: `pnpm exec vitest run src/features/forms/answer-read.test.ts`
Expected: PASS (6 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/features/forms/answer-read.ts src/features/forms/answer-read.test.ts
git commit -m "feat(forms): readAnswerValue — сужение AnswerValue по типу поля"
```

---

### Task 3: API — `getFormStats`, `getFieldAnswers`

**Files:**
- Modify: `src/features/forms/api.ts`

**Interfaces:**
- Consumes: `FormStats`, `FieldAnswerItem` (Task 1); `createApiClient`, `unwrap`, `unwrapList`, `getT`, `cache` (существующие).
- Produces:
  - `getFormStats(id: string, token?: string): Promise<FormStats | null>` (403/404 → null).
  - `getFieldAnswers(id: string, fieldId: string, opts?: { token?: string; offset?: number; limit?: number }): Promise<{ items: FieldAnswerItem[]; total: number; offset: number; limit: number } | null>` (403/404 → null).

- [ ] **Step 1: Добавить импорт типов** в шапку `src/features/forms/api.ts` (в существующий `import type { ... } from "./types"`): дописать `FormStats, FieldAnswerItem`.

- [ ] **Step 2: Добавить fetchers** в конец `src/features/forms/api.ts`:

```ts
/**
 * Агрегат результатов формы (GET /api/forms/{id}/stats). Периметр результатов
 * (владелец ∨ публичные результаты); 403/404 → null, чтобы роут отдал forbidden/404.
 * token (?token=) — для приватной формы через share-link.
 */
export const getFormStats = cache(
  async (id: string, token?: string): Promise<FormStats | null> => {
    const api = await createApiClient();
    const query: { token?: string } = {};
    if (token) query.token = token;
    const { data, error, response } = await api.GET("/api/forms/{id}/stats", {
      params: { path: { id }, query },
    });
    if (response.status === 403 || response.status === 404) return null;
    if (error) throw new Error(error.error ?? (await getT("forms"))("api.loadStatsFailed"));
    return unwrap(data);
  },
);

/**
 * Колоночный просмотр ответов одного поля (GET /api/forms/{id}/fields/{fieldId}/answers).
 * Пагинация, тот же периметр, что и stats. 403/404 → null.
 */
export const getFieldAnswers = cache(
  async (
    id: string,
    fieldId: string,
    opts: { token?: string; offset?: number; limit?: number } = {},
  ): Promise<{ items: FieldAnswerItem[]; total: number; offset: number; limit: number } | null> => {
    const api = await createApiClient();
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? 20;
    const query: { token?: string; offset: number; limit: number } = { offset, limit };
    if (opts.token) query.token = opts.token;
    const { data, error, response } = await api.GET(
      "/api/forms/{id}/fields/{fieldId}/answers",
      { params: { path: { id, fieldId }, query } },
    );
    if (response.status === 403 || response.status === 404) return null;
    if (error) throw new Error(error.error ?? (await getT("forms"))("api.loadFieldAnswersFailed"));
    return unwrapList(data, { offset, limit });
  },
);
```

- [ ] **Step 3: Добавить i18n-ключи** `api.loadStatsFailed`, `api.loadFieldAnswersFailed` в `src/i18n/messages/ru/forms.ts` и `src/i18n/messages/en/forms.ts` (внутрь объекта `api`):

```ts
// ru/forms.ts → api: { ... добавить:
    loadStatsFailed: "Не удалось загрузить статистику формы",
    loadFieldAnswersFailed: "Не удалось загрузить ответы на поле",
// en/forms.ts → api: { ...
    loadStatsFailed: "Failed to load form statistics",
    loadFieldAnswersFailed: "Failed to load field answers",
```

- [ ] **Step 4: Проверить компиляцию и i18n-полноту**

Run: `pnpm exec tsc --noEmit && pnpm test -- src/i18n`
Expected: tsc без ошибок; i18n-тесты (паритет каталогов) зелёные.

- [ ] **Step 5: Commit**

```bash
git add src/features/forms/api.ts src/i18n/messages/ru/forms.ts src/i18n/messages/en/forms.ts
git commit -m "feat(forms): getFormStats + getFieldAnswers fetchers"
```

---

### Task 4: Право `canViewFormResults`

**Files:**
- Modify: `src/features/forms/permissions.ts`
- Test: `src/features/forms/permissions.test.ts`

**Interfaces:**
- Produces: `canViewFormResults(me: MaybeMe, form: Form): boolean`.

- [ ] **Step 1: Дописать падающие тесты** в `src/features/forms/permissions.test.ts` (новый `describe`):

```ts
describe("canViewFormResults", () => {
  const me = (over: Partial<{ id: string; status: string }> = {}) =>
    ({ id: "u1", status: "active", role: "user", capabilities: [] } as never as MaybeMe & object) &&
    ({ id: "u1", status: "active", ...over } as unknown as NonNullable<MaybeMe>);

  it("владелец видит результаты приватной формы", () => {
    const form = { owner: { id: "u1" }, submission_visibility: "private" } as Form;
    expect(canViewFormResults(me(), form)).toBe(true);
  });
  it("suspended-владелец всё ещё видит (чтение, без status-гейта)", () => {
    const form = { owner: { id: "u1" }, submission_visibility: "private" } as Form;
    expect(canViewFormResults(me({ status: "suspended" }), form)).toBe(true);
  });
  it("не-владелец видит публичные результаты", () => {
    const form = { owner: { id: "owner" }, submission_visibility: "public" } as Form;
    expect(canViewFormResults(me(), form)).toBe(true);
  });
  it("не-владелец НЕ видит приватные результаты", () => {
    const form = { owner: { id: "owner" }, submission_visibility: "private" } as Form;
    expect(canViewFormResults(me(), form)).toBe(false);
  });
  it("аноним (me=null) → false", () => {
    const form = { owner: { id: "owner" }, submission_visibility: "public" } as Form;
    expect(canViewFormResults(null, form)).toBe(false);
  });
});
```

(Если в файле ещё нет импортов `Form`/`MaybeMe` — они уже импортированы для соседних тестов; при необходимости добавить `import { canViewFormResults } from "./permissions";` к существующему импорту.)

- [ ] **Step 2: Запустить — упадёт**

Run: `pnpm exec vitest run src/features/forms/permissions.test.ts -t canViewFormResults`
Expected: FAIL — "canViewFormResults is not a function".

- [ ] **Step 3: Реализация** — добавить в `src/features/forms/permissions.ts`:

```ts
/**
 * Просмотр результатов формы — владелец ∨ публичные результаты.
 * CanSee(form) уже гарантирован тем, что getFormById вернул объект (incl. ?token).
 * Это ЧТЕНИЕ — без status-гейта: suspended-владелец сохраняет доступ к чтению.
 */
export function canViewFormResults(me: MaybeMe, form: Form): boolean {
  if (!me) return false;
  if (form.owner?.id === me.id) return true;
  return form.submission_visibility === "public";
}
```

- [ ] **Step 4: Запустить — пройдёт**

Run: `pnpm exec vitest run src/features/forms/permissions.test.ts`
Expected: PASS (новые 5 + существующие).

- [ ] **Step 5: Commit**

```bash
git add src/features/forms/permissions.ts src/features/forms/permissions.test.ts
git commit -m "feat(forms): canViewFormResults (owner ∨ public, без status-гейта)"
```

---

### Task 5: Публичный экспорт слайса

**Files:**
- Modify: `src/features/forms/index.ts`

**Interfaces:**
- Produces: реэкспорт всех новых символов из `index.ts`.

- [ ] **Step 1: Дописать экспорты** в `src/features/forms/index.ts`:

```ts
// типы (в существующий export type { ... } from "./types")
//   добавить: FormStats, FieldStats, OptionStat, NumberStats, DateStats,
//             FieldAnswerItem, AnswerValue, SubmissionVisibility
// права (в существующий export { ... } from "./permissions")
//   добавить: canViewFormResults
// api (в существующий export { ... } from "./api")
//   добавить: getFormStats, getFieldAnswers
export { readAnswerValue } from "./answer-read";
export type { ReadValue } from "./answer-read";
```

- [ ] **Step 2: Проверить**

Run: `pnpm exec tsc --noEmit && pnpm lint -- src/features/forms`
Expected: без ошибок (ESLint-гарды cross-feature не нарушены).

- [ ] **Step 3: Commit**

```bash
git add src/features/forms/index.ts
git commit -m "chore(forms): экспорт статистики/прав/readAnswerValue"
```

---

## Phase 2 — Страница результатов `/forms/[id]/results`

### Task 6: `ChoiceBars` — SVG-бары распределения

**Files:**
- Create: `src/features/forms/ui/choice-bars.tsx`
- Test: `src/features/forms/ui/choice-bars.test.tsx`

**Interfaces:**
- Consumes: `OptionStat` (Task 1).
- Produces: `ChoiceBars({ options, answered, multi })` — server component (async, использует `getT("forms")`).

- [ ] **Step 1: Падающий тест** `src/features/forms/ui/choice-bars.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

vi.mock("@/i18n", async () => {
  const { default: forms } = await import("@/i18n/messages/ru/forms");
  return {
    getT: (_ns: string) =>
      Promise.resolve((key: string) => {
        const parts = key.split(".");
        /* eslint-disable */
        let val: any = forms;
        for (const p of parts) val = val?.[p];
        /* eslint-enable */
        return typeof val === "string" ? val : key;
      }),
  };
});

import { ChoiceBars } from "./choice-bars";

afterEach(cleanup);

describe("ChoiceBars", () => {
  const options = [
    { option_id: "o1", label: "Философия", count: 7 },
    { option_id: "o2", label: "История", count: 3 },
  ];

  it("показывает лейблы, счётчики и проценты (база = answered)", async () => {
    render(await ChoiceBars({ options, answered: 12, multi: false }));
    expect(screen.getByText("Философия")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("58%")).toBeTruthy(); // 7/12
    expect(screen.getByText("25%")).toBeTruthy(); // 3/12
  });

  it("answered=0 → 0% без деления на ноль", async () => {
    render(await ChoiceBars({ options: [{ option_id: "o", label: "X", count: 0 }], answered: 0, multi: false }));
    expect(screen.getByText("0%")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Запустить — упадёт**

Run: `pnpm exec vitest run src/features/forms/ui/choice-bars.test.tsx`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализация** `src/features/forms/ui/choice-bars.tsx`:

```tsx
// src/features/forms/ui/choice-bars.tsx
import { getT } from "@/i18n";

import type { OptionStat } from "../types";

interface Props {
  options: OptionStat[];
  /** База процента — число заполнивших поле. */
  answered: number;
  /** multi_choice: сумма может быть >100%. */
  multi: boolean;
}

function pct(count: number, answered: number): number {
  if (answered <= 0) return 0;
  return Math.round((count / answered) * 100);
}

export async function ChoiceBars({ options, answered, multi }: Props) {
  const t = await getT("forms");
  return (
    <div className="flex flex-col gap-2">
      {multi && (
        <p className="text-xs text-(--color-fg-muted)">{t("results.multiHint")}</p>
      )}
      <ul className="flex flex-col gap-1.5">
        {options.map((o) => {
          const p = pct(o.count ?? 0, answered);
          return (
            <li key={o.option_id} className="flex items-center gap-2 text-sm">
              <span className="w-40 shrink-0 truncate">{o.label}</span>
              {/* CSP-safe: ширина бара через SVG-геометрию (атрибут), не inline-style. */}
              <svg
                viewBox="0 0 100 8"
                preserveAspectRatio="none"
                className="h-2 flex-1"
                role="presentation"
                aria-hidden="true"
              >
                <rect x="0" y="0" width="100" height="8" className="fill-(--color-bg-muted)" />
                <rect x="0" y="0" width={p} height="8" className="fill-(--color-accent)" />
              </svg>
              <span className="w-8 shrink-0 text-right tabular-nums">{o.count ?? 0}</span>
              <span className="w-10 shrink-0 text-right tabular-nums text-(--color-fg-muted)">{p}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Запустить — пройдёт**

Run: `pnpm exec vitest run src/features/forms/ui/choice-bars.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/forms/ui/choice-bars.tsx src/features/forms/ui/choice-bars.test.tsx
git commit -m "feat(forms): ChoiceBars — SVG-бары распределения (CSP-safe)"
```

---

### Task 7: `NumberSummary` и `DateSummary`

**Files:**
- Create: `src/features/forms/ui/number-summary.tsx`
- Create: `src/features/forms/ui/date-summary.tsx`

**Interfaces:**
- Consumes: `NumberStats`, `DateStats` (Task 1); `getServerFmt`, `getT`.
- Produces: `NumberSummary({ stats })`, `DateSummary({ stats })` — async server components.

- [ ] **Step 1: Реализация** `src/features/forms/ui/number-summary.tsx`:

```tsx
// src/features/forms/ui/number-summary.tsx
import { getServerFmt, getT } from "@/i18n";

import type { NumberStats } from "../types";

export async function NumberSummary({ stats }: { stats: NumberStats }) {
  const [t, fmt] = await Promise.all([getT("forms"), getServerFmt()]);
  const n = (v: number | undefined) => (typeof v === "number" ? fmt.number(v) : "—");
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      <div><dt className="inline text-(--color-fg-muted)">{t("results.min")}: </dt><dd className="inline tabular-nums">{n(stats.min)}</dd></div>
      <div><dt className="inline text-(--color-fg-muted)">{t("results.max")}: </dt><dd className="inline tabular-nums">{n(stats.max)}</dd></div>
      <div><dt className="inline text-(--color-fg-muted)">{t("results.avg")}: </dt><dd className="inline tabular-nums">{n(stats.avg)}</dd></div>
      <div><dt className="inline text-(--color-fg-muted)">{t("results.sum")}: </dt><dd className="inline tabular-nums">{n(stats.sum)}</dd></div>
    </dl>
  );
}
```

- [ ] **Step 2: Реализация** `src/features/forms/ui/date-summary.tsx`:

```tsx
// src/features/forms/ui/date-summary.tsx
import { getServerFmt, getT } from "@/i18n";

import type { DateStats } from "../types";

export async function DateSummary({ stats }: { stats: DateStats }) {
  const [t, fmt] = await Promise.all([getT("forms"), getServerFmt()]);
  // Чистая дата YYYY-MM-DD → форматируем как UTC-дату (не подмешивать таймзону пользователя).
  const d = (v: string | undefined) =>
    v ? fmt.dateTime(`${v}T00:00:00Z`, { dateStyle: "medium", timeZone: "UTC" }) : "—";
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      <div><dt className="inline text-(--color-fg-muted)">{t("results.min")}: </dt><dd className="inline">{d(stats.min)}</dd></div>
      <div><dt className="inline text-(--color-fg-muted)">{t("results.max")}: </dt><dd className="inline">{d(stats.max)}</dd></div>
    </dl>
  );
}
```

- [ ] **Step 3: Проверить компиляцию**

Run: `pnpm exec tsc --noEmit`
Expected: без ошибок (ключи `results.min/max/avg/sum` добавятся в Task 10; до тех пор `t(...)` вернёт ключ — компиляции не мешает).

- [ ] **Step 4: Commit**

```bash
git add src/features/forms/ui/number-summary.tsx src/features/forms/ui/date-summary.tsx
git commit -m "feat(forms): NumberSummary + DateSummary"
```

---

### Task 8: `TextAnswersPreview` — превью атрибутированных текстовых ответов

**Files:**
- Create: `src/features/forms/ui/text-answers-preview.tsx`

**Interfaces:**
- Consumes: `FieldAnswerItem` (Task 1); `getFieldAnswers` (Task 3); `readAnswerValue` (Task 2); `UserView` (`@/components/shared/user-view`); `RouterLink` (`@/components/ui`); `getServerFmt`, `getT`.
- Produces: `TextAnswersPreview({ formId, fieldId, fieldType, token, total })` — async server component; грузит первую страницу (limit 20) и показывает «Все ответы →».

- [ ] **Step 1: Реализация** `src/features/forms/ui/text-answers-preview.tsx`:

```tsx
// src/features/forms/ui/text-answers-preview.tsx
import { RouterLink } from "@/components/ui";
import { UserView } from "@/components/shared/user-view";
import { getServerFmt, getT } from "@/i18n";

import { getFieldAnswers } from "../api";
import { readAnswerValue } from "../answer-read";
import type { FieldType } from "../types";

interface Props {
  formId: string;
  fieldId: string;
  fieldType: FieldType;
  token?: string;
  /** answered — число заполнивших; решает, рисовать ли «Все ответы →». */
  answered: number;
}

const PREVIEW = 20;

export async function TextAnswersPreview({ formId, fieldId, fieldType, token, answered }: Props) {
  const [t, fmt] = await Promise.all([getT("forms"), getServerFmt()]);
  const page = await getFieldAnswers(formId, fieldId, { token, offset: 0, limit: PREVIEW });
  if (!page || page.items.length === 0) {
    return <p className="text-sm text-(--color-fg-muted)">{t("results.noTextAnswers")}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {page.items.map((a) => {
          const rv = readAnswerValue(fieldType, a.value);
          return (
            <li key={a.submission_id} className="flex flex-col gap-0.5 border-s-2 border-(--color-border) ps-3">
              <div className="flex items-center gap-2 text-xs text-(--color-fg-muted)">
                <UserView user={a.user} />
                <span>{a.submitted_at ? fmt.dateTime(a.submitted_at) : ""}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{rv.kind === "text" ? rv.text : ""}</p>
            </li>
          );
        })}
      </ul>
      {answered > PREVIEW && (
        <RouterLink
          href={`/forms/${formId}/fields/${fieldId}${token ? `?token=${encodeURIComponent(token)}` : ""}`}
          className="self-start text-sm text-(--color-link) hover:underline"
        >
          {t("results.allAnswers")}
        </RouterLink>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `pnpm exec tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/features/forms/ui/text-answers-preview.tsx
git commit -m "feat(forms): TextAnswersPreview — превью атрибутированных ответов"
```

---

### Task 9: `FieldStatsCard` (диспетчер) + `FormResultsView`

**Files:**
- Create: `src/features/forms/ui/field-stats-card.tsx`
- Create: `src/features/forms/ui/form-results-view.tsx`

**Interfaces:**
- Consumes: `FormStats`, `FieldStats`, `Form`, `FormField` (Task 1/types); `ChoiceBars`, `NumberSummary`, `DateSummary`, `TextAnswersPreview` (Tasks 6-8); `FormVisibilityBadges` — **из Task 12**; `getT`, `getServerFmt`; рендер AST prompt через существующий `@/components/ast-render` (как в форме).
- Produces: `FieldStatsCard({ field, stats, formId, token })`; `FormResultsView({ form, stats, token })`.

> Зависимость: `FormResultsView` использует `FormVisibilityBadges` (Task 12). Реализовать Task 12 до этого шага **или** временно не подключать бейджи (раскомментировать в Task 12). Для линейного исполнения: сделать Task 12 перед Task 9 — порядок задач допускает это (Task 12 не зависит от Task 9).

- [ ] **Step 1: Реализация** `src/features/forms/ui/field-stats-card.tsx`:

```tsx
// src/features/forms/ui/field-stats-card.tsx
import { getT } from "@/i18n";

import type { FieldStats, FormField } from "../types";

import { ChoiceBars } from "./choice-bars";
import { DateSummary } from "./date-summary";
import { NumberSummary } from "./number-summary";
import { TextAnswersPreview } from "./text-answers-preview";

interface Props {
  field: FormField;
  stats: FieldStats | undefined;
  formId: string;
  token?: string;
}

export async function FieldStatsCard({ field, stats, formId, token }: Props) {
  const t = await getT("forms");
  const type = field.type ?? "text";
  const answered = stats?.answered ?? 0;
  // prompt поля — AST-блоки; берём первый текстовый узел через существующий рендер.
  const promptText = field.prompt; // ast.Block[]; ниже рендерим через PlainBlocks

  return (
    <section className="flex flex-col gap-3 border-b border-(--color-border) pb-4">
      <header className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold">
          {/* Рендер промпта: используем тот же примитив, что и форма (см. blocks-text). */}
          {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */}
          <PromptInline blocks={promptText} />
        </h2>
        <p className="text-xs text-(--color-fg-muted)">
          {t(`results.fieldType.${type}`)} · {t("results.answered", { n: answered })}
        </p>
      </header>
      {(type === "single_choice" || type === "multi_choice") && (
        <ChoiceBars options={stats?.options ?? []} answered={answered} multi={type === "multi_choice"} />
      )}
      {type === "number" && stats?.number && <NumberSummary stats={stats.number} />}
      {type === "date" && stats?.date && <DateSummary stats={stats.date} />}
      {(type === "text" || type === "long_text") && (
        <TextAnswersPreview formId={formId} fieldId={field.id ?? ""} fieldType={type} token={token} answered={answered} />
      )}
    </section>
  );
}
```

> **PromptInline:** в слайсе уже есть `ui/blocks-text.ts` (`blocksToPlainText`) — используем его вместо нового компонента. Заменить `<PromptInline blocks={promptText} />` на `{blocksToPlainText(field.prompt)}` и добавить импорт `import { blocksToPlainText } from "./blocks-text";`. Убрать заглушку `PromptInline` и неиспользуемую `promptText`-переменную.

- [ ] **Step 2: Реализация** `src/features/forms/ui/form-results-view.tsx`:

```tsx
// src/features/forms/ui/form-results-view.tsx
import { getT } from "@/i18n";

import type { Form, FormStats } from "../types";

import { FieldStatsCard } from "./field-stats-card";
import { FormVisibilityBadges } from "./form-visibility-badges";

interface Props {
  form: Form;
  stats: FormStats;
  token?: string;
}

export async function FormResultsView({ form, stats, token }: Props) {
  const t = await getT("forms");
  const fields = (form.fields ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const byField = new Map((stats.fields ?? []).map((s) => [s.field_id, s]));
  const total = stats.total_submissions ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-semibold">{form.title}</h1>
          <span className="text-sm text-(--color-fg-muted)">{t("results.totalSubmissions", { n: total })}</span>
        </div>
        <FormVisibilityBadges form={form} />
      </header>
      {total === 0 ? (
        <p className="text-sm text-(--color-fg-muted)">{t("results.empty")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {fields.map((f) => (
            <FieldStatsCard key={f.id} field={f} stats={byField.get(f.id)} formId={form.id ?? ""} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Проверить компиляцию**

Run: `pnpm exec tsc --noEmit`
Expected: без ошибок (требует Task 12 `FormVisibilityBadges`).

- [ ] **Step 4: Commit**

```bash
git add src/features/forms/ui/field-stats-card.tsx src/features/forms/ui/form-results-view.tsx
git commit -m "feat(forms): FieldStatsCard диспетчер + FormResultsView"
```

---

### Task 10: Роут `/forms/[id]/results` + i18n-ключи

**Files:**
- Create: `src/app/forms/[id]/results/page.tsx`
- Modify: `src/i18n/messages/ru/forms.ts`, `src/i18n/messages/en/forms.ts`

**Interfaces:**
- Consumes: `getFormById`, `getFormStats`, `canViewFormResults`, `FormResultsView`; `getMe`; `notFound`, `forbidden` (`next/navigation`).

- [ ] **Step 1: Добавить ключи** `results.*` в `src/i18n/messages/ru/forms.ts` (новый под-объект `results`) и зеркально в `en/forms.ts`:

```ts
// ru/forms.ts → добавить в корень объекта:
  results: {
    totalSubmissions: "{n, plural, one {# отклик} few {# отклика} many {# откликов} other {# отклика}}",
    answered: "{n, plural, one {# ответил} few {# ответили} many {# ответили} other {# ответили}}",
    multiHint: "возможно несколько вариантов",
    min: "мин", max: "макс", avg: "сред", sum: "сумма",
    empty: "Пока нет откликов",
    noTextAnswers: "Нет ответов",
    allAnswers: "Все ответы →",
    forbidden: "Результаты этой формы закрыты",
    fieldType: {
      text: "текст", long_text: "текст", single_choice: "одиночный выбор",
      multi_choice: "множественный выбор", number: "число", date: "дата",
    },
  },
// en/forms.ts → results: { totalSubmissions: "{n, plural, one {# response} other {# responses}}",
//   answered: "{n, plural, one {# answered} other {# answered}}", multiHint: "multiple choices allowed",
//   min:"min", max:"max", avg:"avg", sum:"sum", empty:"No responses yet", noTextAnswers:"No answers",
//   allAnswers:"All answers →", forbidden:"This form's results are private",
//   fieldType:{ text:"text", long_text:"text", single_choice:"single choice",
//     multi_choice:"multiple choice", number:"number", date:"date" } }
```

(ar/zh: добавить тот же ключ-каркас — плумбинг без перевода, по конвенции i18n-паритета.)

- [ ] **Step 2: Реализация** `src/app/forms/[id]/results/page.tsx`:

```tsx
// src/app/forms/[id]/results/page.tsx
import { forbidden, notFound } from "next/navigation";

import { getFormById, getFormStats, canViewFormResults, FormResultsView } from "@/features/forms";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function FormResultsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  const [me, form] = await Promise.all([getMe(), getFormById(id, token)]);
  if (!form) notFound();
  if (!canViewFormResults(me, form)) forbidden();

  const stats = await getFormStats(id, token);
  if (!stats) forbidden(); // видимая форма, но результаты закрыты (бек 403) — страховка от гонки

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <FormResultsView form={form} stats={stats} {...(token ? { token } : {})} />
    </div>
  );
}

export async function generateMetadata({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  const [form, t] = await Promise.all([getFormById(id, token), getT("forms")]);
  return { title: form ? `${form.title} — ${t("results.titleSuffix")}` : t("results.titleSuffix") };
}
```

(Добавить ключ `results.titleSuffix`: ru «Результаты», en «Results».)

- [ ] **Step 3: Проверить i18n + типы + сборку**

Run: `pnpm test -- src/i18n && pnpm exec tsc --noEmit`
Expected: i18n-паритет зелёный, типы ок.

- [ ] **Step 4: Commit**

```bash
git add src/app/forms/[id]/results/page.tsx src/i18n/messages
git commit -m "feat(forms): роут /forms/[id]/results + i18n результатов"
```

---

## Phase 3 — Gateway `/forms/[id]`

### Task 11: `FormVisibilityBadges`

**Files:**
- Create: `src/features/forms/ui/form-visibility-badges.tsx`
- Test: `src/features/forms/ui/form-visibility-badges.test.tsx`

> **Порядок:** выполнить ДО Task 9 (там используется). Номер условный; зависимостей от Task 9/10 нет.

**Interfaces:**
- Consumes: `Form` (types); `getT`; kit `Badge` (если есть) или `<span>`-чип.
- Produces: `FormVisibilityBadges({ form })` — async server component.

- [ ] **Step 1: Падающий тест** `src/features/forms/ui/form-visibility-badges.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

vi.mock("@/i18n", async () => {
  const { default: forms } = await import("@/i18n/messages/ru/forms");
  return {
    getT: (_ns: string) =>
      Promise.resolve((key: string) => {
        const parts = key.split(".");
        /* eslint-disable */ let v: any = forms; for (const p of parts) v = v?.[p]; /* eslint-enable */
        return typeof v === "string" ? v : key;
      }),
  };
});

import { FormVisibilityBadges } from "./form-visibility-badges";

afterEach(cleanup);

describe("FormVisibilityBadges", () => {
  it("публичная форма + публичные результаты + immutable", async () => {
    render(await FormVisibilityBadges({ form: { visibility: "public", submission_visibility: "public", submission_mode: "immutable" } as never }));
    expect(screen.getByText("Форма: публичная")).toBeTruthy();
    expect(screen.getByText("Результаты: публичные")).toBeTruthy();
    expect(screen.getByText("Режим: фиксированный")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Запустить — упадёт**

Run: `pnpm exec vitest run src/features/forms/ui/form-visibility-badges.test.tsx`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализация** `src/features/forms/ui/form-visibility-badges.tsx`:

```tsx
// src/features/forms/ui/form-visibility-badges.tsx
import { getT } from "@/i18n";

import type { Form } from "../types";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-(--color-border) px-2 py-0.5 text-xs text-(--color-fg-muted)">
      {children}
    </span>
  );
}

export async function FormVisibilityBadges({ form }: { form: Form }) {
  const t = await getT("forms");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip>{t(`badges.form.${form.visibility ?? "private"}`)}</Chip>
      <Chip>{t(`badges.results.${form.submission_visibility ?? "private"}`)}</Chip>
      <Chip>{t(`badges.mode.${form.submission_mode ?? "editable"}`)}</Chip>
    </div>
  );
}
```

- [ ] **Step 4: Добавить ключи** `badges.*` в `ru/forms.ts` и `en/forms.ts`:

```ts
// ru: badges: { form: { private: "Форма: приватная", public: "Форма: публичная" },
//   results: { private: "Результаты: приватные", public: "Результаты: публичные" },
//   mode: { editable: "Режим: редактируемый", immutable: "Режим: фиксированный" } }
// en: badges: { form:{private:"Form: private",public:"Form: public"},
//   results:{private:"Results: private",public:"Results: public"},
//   mode:{editable:"Mode: editable",immutable:"Mode: fixed"} }
```

- [ ] **Step 5: Запустить — пройдёт**

Run: `pnpm exec vitest run src/features/forms/ui/form-visibility-badges.test.tsx && pnpm test -- src/i18n`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/forms/ui/form-visibility-badges.tsx src/features/forms/ui/form-visibility-badges.test.tsx src/i18n/messages
git commit -m "feat(forms): FormVisibilityBadges — чипы двух осей видимости + режима"
```

---

### Task 12: Консент-нотис в `FormFill` (public-результаты)

**Files:**
- Modify: `src/features/forms/ui/form-fill.tsx`

**Interfaces:**
- Consumes: `Form.submission_visibility`; `useT("forms")`.
- Produces: видимый нотис над кнопкой submit при `form.submission_visibility === "public"`.

- [ ] **Step 1: Добавить нотис** в `src/features/forms/ui/form-fill.tsx` — перед блоком с кнопкой submit (в обоих return-ветках до `done` не нужно; только в основной форме):

```tsx
      {form.submission_visibility === "public" && (
        <p className="rounded border border-(--color-border) bg-(--color-bg-muted) p-3 text-xs text-(--color-fg-muted)">
          {t("publicVoteConsent")}
        </p>
      )}
```

(Разместить непосредственно перед `<div>` с `<Button ... onClick={onSubmit}>`.)

- [ ] **Step 2: Ключ** `publicVoteConsent` в `ru/forms.ts` / `en/forms.ts`:

```ts
// ru: publicVoteConsent: "Это публичный опрос: твой ответ будет виден всем, кто видит эту форму, с указанием авторства."
// en: publicVoteConsent: "This is a public poll: your answer will be visible to everyone who can see this form, attributed to you."
```

- [ ] **Step 3: Проверить**

Run: `pnpm exec tsc --noEmit && pnpm test -- src/i18n`
Expected: ок.

- [ ] **Step 4: Commit**

```bash
git add src/features/forms/ui/form-fill.tsx src/i18n/messages
git commit -m "feat(forms): консент-нотис при публичных результатах в FormFill"
```

---

### Task 13: Gateway — бейджи + вход «Результаты →»

**Files:**
- Modify: `src/app/forms/[id]/page.tsx`

**Interfaces:**
- Consumes: `canViewFormResults`, `FormVisibilityBadges` (`@/features/forms`).

- [ ] **Step 1: Импорты** — в существующий импорт из `@/features/forms` дописать `canViewFormResults, FormVisibilityBadges`.

- [ ] **Step 2: Вычислить право** — рядом с другими `const can... =`:

```tsx
  const canSeeResults = canViewFormResults(me, form);
```

- [ ] **Step 3: Бейджи** — внутри `<FormDetail form={form} />`-шапки, сразу после `<FormDetail .../>`:

```tsx
        <FormVisibilityBadges form={form} />
```

- [ ] **Step 4: Ссылка** — в actions-слот (`<div className="flex flex-wrap items-center gap-2">`), рядом с submissions-link:

```tsx
          {canSeeResults && form.id && (
            <RouterLink
              href={`/forms/${form.id}/results${token ? `?token=${encodeURIComponent(token)}` : ""}`}
              className="text-sm text-(--color-link) hover:underline"
            >
              {t("formResultsLink")}
            </RouterLink>
          )}
```

- [ ] **Step 5: Ключ** `formResultsLink` в неймспейсе `pages` (`src/i18n/messages/{ru,en}/pages.ts`): ru «Результаты», en «Results».

- [ ] **Step 6: Проверить + сборка**

Run: `pnpm exec tsc --noEmit && pnpm test -- src/i18n && pnpm build`
Expected: всё зелёное; роуты `/forms/[id]`, `/forms/[id]/results` собираются.

- [ ] **Step 7: Commit**

```bash
git add src/app/forms/[id]/page.tsx src/i18n/messages
git commit -m "feat(forms): gateway — бейджи видимости + вход в результаты"
```

---

## Phase 4 — Колонка ответов поля `/forms/[id]/fields/[fieldId]`

### Task 14: `FieldAnswersColumn`

**Files:**
- Create: `src/features/forms/ui/field-answers-column.tsx`
- Test: `src/features/forms/ui/field-answers-column.test.tsx`

**Interfaces:**
- Consumes: `FieldAnswerItem`, `FieldType` (types); `readAnswerValue`; `UserView`; `getServerFmt`, `getT`.
- Produces: `FieldAnswersColumn({ field, page, formId, offset, limit, total, token })` — рендерит атрибутированные ответы + пагинацию ссылками `?p`. Маппинг option_id→label берётся из `field.options`.

- [ ] **Step 1: Падающий тест** `src/features/forms/ui/field-answers-column.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

vi.mock("@/i18n", async () => {
  const { default: forms } = await import("@/i18n/messages/ru/forms");
  return {
    getT: (_ns: string) => Promise.resolve((k: string) => k),
    getServerFmt: () => Promise.resolve({ dateTime: (v: string) => v, number: (n: number) => String(n), relativeTime: () => "" }),
  };
});

import { FieldAnswersColumn } from "./field-answers-column";

afterEach(cleanup);

const field = { id: "f1", type: "single_choice", options: [{ id: "o1", label: "Да" }, { id: "o2", label: "Нет" }] } as never;

describe("FieldAnswersColumn", () => {
  it("choice: показывает лейбл выбранной опции и автора", async () => {
    const page = { items: [{ submission_id: "s1", submitted_at: "2026-06-29T00:00:00Z", user: { username: "ivan" }, value: { option_id: "o1" } }], total: 1, offset: 0, limit: 20 };
    render(await FieldAnswersColumn({ field, page, formId: "form1", token: undefined }));
    expect(screen.getByText("Да")).toBeTruthy();
    expect(screen.getByText("ivan")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Запустить — упадёт**

Run: `pnpm exec vitest run src/features/forms/ui/field-answers-column.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализация** `src/features/forms/ui/field-answers-column.tsx`:

```tsx
// src/features/forms/ui/field-answers-column.tsx
import { RouterLink } from "@/components/ui";
import { UserView } from "@/components/shared/user-view";
import { getServerFmt, getT } from "@/i18n";

import { readAnswerValue } from "../answer-read";
import type { FieldAnswerItem, FormField } from "../types";

interface Page {
  items: FieldAnswerItem[];
  total: number;
  offset: number;
  limit: number;
}
interface Props {
  field: FormField;
  page: Page;
  formId: string;
  token?: string;
}

export async function FieldAnswersColumn({ field, page, formId, token }: Props) {
  const [t, fmt] = await Promise.all([getT("forms"), getServerFmt()]);
  const type = field.type ?? "text";
  const labels = new Map((field.options ?? []).map((o) => [o.id, o.label]));

  function render(value: FieldAnswerItem["value"]): string {
    const rv = readAnswerValue(type, value);
    switch (rv.kind) {
      case "text": return rv.text;
      case "number": return fmt.number(rv.number);
      case "date": return rv.date;
      case "single": return labels.get(rv.optionId) ?? rv.optionId;
      case "multi": return rv.optionIds.map((id) => labels.get(id) ?? id).join(", ");
      default: return "—";
    }
  }

  const tokenQs = token ? `&token=${encodeURIComponent(token)}` : "";
  const prev = page.offset - page.limit;
  const next = page.offset + page.limit;
  const base = `/forms/${formId}/fields/${field.id ?? ""}`;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-(--color-border)">
        {page.items.map((a) => (
          <li key={a.submission_id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="whitespace-pre-wrap">{render(a.value)}</span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-(--color-fg-muted)">
              <UserView user={a.user} />
              {a.submitted_at ? fmt.dateTime(a.submitted_at) : ""}
            </span>
          </li>
        ))}
      </ul>
      <nav className="flex items-center gap-4 text-sm">
        {prev >= 0 && <RouterLink href={`${base}?p=${prev / page.limit}${tokenQs}`}>{t("results.prevPage")}</RouterLink>}
        {next < page.total && <RouterLink href={`${base}?p=${next / page.limit}${tokenQs}`}>{t("results.nextPage")}</RouterLink>}
      </nav>
    </div>
  );
}
```

- [ ] **Step 4: Ключи** `results.prevPage`/`results.nextPage` (ru «← Назад»/«Вперёд →», en «← Prev»/«Next →»).

- [ ] **Step 5: Запустить — пройдёт**

Run: `pnpm exec vitest run src/features/forms/ui/field-answers-column.test.tsx && pnpm test -- src/i18n`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/forms/ui/field-answers-column.tsx src/features/forms/ui/field-answers-column.test.tsx src/i18n/messages
git commit -m "feat(forms): FieldAnswersColumn — пагинированная колонка ответов поля"
```

---

### Task 15: Роут `/forms/[id]/fields/[fieldId]`

**Files:**
- Create: `src/app/forms/[id]/fields/[fieldId]/page.tsx`

**Interfaces:**
- Consumes: `getFormById`, `getFieldAnswers`, `canViewFormResults`, `FieldAnswersColumn`; `getMe`; `notFound`, `forbidden`.
- Экспортировать `FieldAnswersColumn` из `index.ts` (дописать в Task 5-список или здесь).

- [ ] **Step 1: Экспорт** — добавить в `src/features/forms/index.ts`: `export { FieldAnswersColumn } from "./ui/field-answers-column";` (и `FormResultsView`, `FormVisibilityBadges`, если ещё не добавлены — для симметрии с остальными UI-экспортами).

- [ ] **Step 2: Реализация** `src/app/forms/[id]/fields/[fieldId]/page.tsx`:

```tsx
// src/app/forms/[id]/fields/[fieldId]/page.tsx
import { forbidden, notFound } from "next/navigation";

import { getFormById, getFieldAnswers, canViewFormResults, FieldAnswersColumn } from "@/features/forms";
import { getMe } from "@/utils/me";

interface Props {
  params: Promise<{ id: string; fieldId: string }>;
  searchParams: Promise<{ token?: string; p?: string }>;
}

const LIMIT = 20;

export default async function FieldAnswersPage({ params, searchParams }: Props) {
  const { id, fieldId } = await params;
  const { token, p } = await searchParams;
  const [me, form] = await Promise.all([getMe(), getFormById(id, token)]);
  if (!form) notFound();
  if (!canViewFormResults(me, form)) forbidden();

  const field = (form.fields ?? []).find((f) => f.id === fieldId);
  if (!field) notFound();

  const pageNum = Math.max(0, Number.parseInt(p ?? "0", 10) || 0);
  const page = await getFieldAnswers(id, fieldId, { token, offset: pageNum * LIMIT, limit: LIMIT });
  if (!page) forbidden();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-lg font-semibold">{form.title}</h1>
      <FieldAnswersColumn field={field} page={page} formId={id} {...(token ? { token } : {})} />
    </div>
  );
}
```

- [ ] **Step 3: Проверить + сборка**

Run: `pnpm exec tsc --noEmit && pnpm build`
Expected: роут собирается.

- [ ] **Step 4: Commit**

```bash
git add src/app/forms/[id]/fields/[fieldId]/page.tsx src/features/forms/index.ts
git commit -m "feat(forms): роут колонки ответов поля /forms/[id]/fields/[fieldId]"
```

---

## Phase 5 — `submission_visibility` при создании

### Task 16: Enum `FORM_SUBMISSION_VISIBILITY`

**Files:**
- Modify: `src/api/enums.ts`

**Interfaces:**
- Produces: `FORM_SUBMISSION_VISIBILITY` (`readonly ["private","public"]`, типизирован против `S["form.SubmissionVisibility"]`).

- [ ] **Step 1: Добавить** рядом с `FORM_SUBMISSION_MODES`:

```ts
export const FORM_SUBMISSION_VISIBILITY = enumValues<S["form.SubmissionVisibility"]>()("private", "public");
```

- [ ] **Step 2: Проверить**

Run: `pnpm exec tsc --noEmit`
Expected: ок.

- [ ] **Step 3: Commit**

```bash
git add src/api/enums.ts
git commit -m "feat(api): enum FORM_SUBMISSION_VISIBILITY"
```

---

### Task 17: Zod — `submission_visibility` в payload + create-инвариант

**Files:**
- Modify: `src/features/forms/schemas.ts`
- Test: `src/features/forms/schemas.test.ts`

**Interfaces:**
- Produces: `FormPayloadInput.submission_visibility?: "private" | "public"`; `makeFormCreateSchema` требует `submission_visibility` при create.

- [ ] **Step 1: Падающий тест** — дописать в `src/features/forms/schemas.test.ts`:

```ts
it("create требует submission_visibility", () => {
  const t = ((k: string) => k) as never;
  const fd = new FormData();
  fd.set("payload", JSON.stringify({
    title: "T", visibility: "private", submission_mode: "editable",
    fields: [{ type: "text", prompt: "Q", required: false, sort_order: 0 }],
  }));
  const schema = makeFormCreateSchema(t);
  const r = schema.safeParse(Object.fromEntries(fd));
  expect(r.success).toBe(false); // нет submission_visibility
});
```

(импорт `makeFormCreateSchema` уже есть в файле.)

- [ ] **Step 2: Запустить — упадёт**

Run: `pnpm exec vitest run src/features/forms/schemas.test.ts -t "submission_visibility"`
Expected: FAIL (схема пока принимает).

- [ ] **Step 3: Изменения** в `src/features/forms/schemas.ts`:

а) импорт: `import { VISIBILITY, FORM_SUBMISSION_MODES, FORM_FIELD_TYPES, FORM_SUBMISSION_VISIBILITY } from "@/api/enums";` и `const SubVisEnum = z.enum(FORM_SUBMISSION_VISIBILITY);`

б) в `makeFormPayloadShape` объект — добавить поле: `submission_visibility: SubVisEnum.optional(),`

в) в `makeFormCreateSchema` superRefine — добавить:

```ts
      if (!p.submission_visibility) {
        ctx.addIssue({ code: "custom", message: t("forms.submissionVisibilityRequired"), path: ["submission_visibility"] });
      }
```

- [ ] **Step 4: Ключ** `forms.submissionVisibilityRequired` в `ru/validation.ts`/`en/validation.ts`: ru «Укажите видимость результатов», en «Results visibility is required».

- [ ] **Step 5: Запустить — пройдёт**

Run: `pnpm exec vitest run src/features/forms/schemas.test.ts && pnpm test -- src/i18n`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/forms/schemas.ts src/features/forms/schemas.test.ts src/i18n/messages
git commit -m "feat(forms): submission_visibility в payload-схеме + create-инвариант"
```

---

### Task 18: FormBuilder — селектор `submission_visibility` (create)

**Files:**
- Modify: `src/features/forms/ui/form-builder.tsx`

**Interfaces:**
- Consumes: `SubmissionVisibility` (types).
- Produces: селектор в create-режиме; `submission_visibility` в сериализуемом payload.

- [ ] **Step 1: Импорт типа** — в `import type { FieldType, SubmissionMode, Visibility } from "../types";` дописать `SubmissionVisibility`.

- [ ] **Step 2: В `BuilderInitial`** добавить `submission_visibility: SubmissionVisibility;`; в `DEFAULT_INITIAL` — `submission_visibility: "private",`.

- [ ] **Step 3: State** — рядом с `visibility`: `const [submissionVisibility, setSubmissionVisibility] = useState<SubmissionVisibility>(init.submission_visibility);`

- [ ] **Step 4: payload** — в `payloadObj` в `create`-ветке spread дописать `submission_visibility: submissionVisibility`:

```tsx
    ...(mode === "create" ? { visibility, submission_mode: submissionMode, submission_visibility: submissionVisibility } : {}),
```

- [ ] **Step 5: Селектор** — внутри `{mode === "create" && (...)}` после блока submission_mode добавить:

```tsx
          <div className="flex flex-col gap-1 text-sm">
            <Label>{t("builder.submissionVisibilityLabel")}</Label>
            <Select
              aria-label={t("builder.submissionVisibilityLabel")}
              value={submissionVisibility}
              disabled={disabled}
              onValueChange={(v) => { setSubmissionVisibility(v as SubmissionVisibility); }}
              options={[
                { value: "private", label: t("builder.submissionVisibilityPrivate") },
                { value: "public", label: t("builder.submissionVisibilityPublic") },
              ]}
            />
            <p className="text-xs text-(--color-fg-muted)">{t("builder.submissionVisibilityHint")}</p>
          </div>
```

- [ ] **Step 6: Ключи** `builder.submissionVisibilityLabel/Private/Public/Hint` в `ru/forms.ts`/`en/forms.ts`:

```ts
// ru: submissionVisibilityLabel:"Видимость результатов",
//   submissionVisibilityPrivate:"Приватные (видит только владелец)",
//   submissionVisibilityPublic:"Публичные (атрибутированные голоса видны периметру)",
//   submissionVisibilityHint:"После создания изменить нельзя.",
// en: submissionVisibilityLabel:"Results visibility",
//   submissionVisibilityPrivate:"Private (owner only)",
//   submissionVisibilityPublic:"Public (attributed votes visible to the form's audience)",
//   submissionVisibilityHint:"Cannot be changed after creation.",
```

- [ ] **Step 7: Проверить + сборка + гейт**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное.

- [ ] **Step 8: Commit**

```bash
git add src/features/forms/ui/form-builder.tsx src/i18n/messages
git commit -m "feat(forms): селектор submission_visibility в конструкторе (create)"
```

---

### Task 19: Action `createForm` — передать `submission_visibility`

**Files:**
- Modify: `src/features/forms/actions.ts`

**Interfaces:**
- Consumes: `input.submission_visibility` (Task 17).

- [ ] **Step 1: Тело POST** — в `createForm`, в объект `body:` добавить (после `visibility: input.visibility,`):

```ts
      ...(input.submission_visibility ? { submission_visibility: input.submission_visibility } : {}),
```

- [ ] **Step 2: Инвариант** — расширить guard (опционально, для громкого слома): оставить как есть (`!input.submission_mode || !input.visibility`) — `submission_visibility` уже гарантирован superRefine; явный guard не обязателен. Не менять.

- [ ] **Step 3: Проверить + гейт**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: зелёное. Ручная проверка (browser-QA отдельно): создание формы с public-результатами → на `/forms/[id]` бейдж «Результаты: публичные».

- [ ] **Step 4: Commit**

```bash
git add src/features/forms/actions.ts
git commit -m "feat(forms): createForm передаёт submission_visibility"
```

---

## Phase 6 — Индекс публичных форм `/forms` (БЛОКИРОВАНО бэком)

> **НЕ начинать, пока нет бэк-ручки.** Требование к бэку (FE→BE): **`GET /api/forms`** — список публичных форм (`visibility=public`), пагинация (`offset/limit`), опц. сортировка (новые/популярные) и `mine`-флаг, конверт `ListResponse{data: FormListItem[]}`. После реализации + регена `src/api/schema.ts` появится типизированный путь — тогда задачи ниже становятся исполнимы.

Высокоуровневые задачи (детализировать в отдельном план-апдейте после регена, по фактической сигнатуре ручки):

- **T20:** `getPublicForms(filter)` в `forms/api.ts` (зеркало `getAdminForms`: `unwrapList`, `cache`, пагинация).
- **T21:** `src/features/forms/ui/forms-index-list.tsx` (+ тест) — список карточек публичных форм с `FormVisibilityBadges`.
- **T22:** `src/app/forms/page.tsx` — SSR-страница с `searchParams` пагинацией; auth-гейт (`requireUserOrRedirect("/forms")`).
- **T23:** Навигационная ссылка на `/forms` (где разместить — решить при реализации; не трогать замороженные shell-layout’ы без отдельного PR).
- **T24:** i18n-ключи индекса; гейт `pnpm lint && pnpm test && pnpm build`.

---

## Self-Review

**1. Spec coverage** (сверка с `2026-06-29-forms-shared-content-and-results-design.md`):
- IA-карта → Tasks 10/13/15 (роуты), Phase 6 (индекс). ✔
- `canViewFormResults` → Task 4. ✔
- Gateway бейджи/консент/вход → Tasks 11/12/13. ✔
- `/results` + карточки (choice/number/date/text) → Tasks 6-10. ✔
- `/fields/[fieldId]` → Tasks 14-15. ✔
- `submission_visibility` в создании → Tasks 16-19. ✔
- Слой данных (`getFormStats`/`getFieldAnswers`/`readAnswerValue`/типы/экспорты) → Tasks 1-5. ✔
- CSP-бары → Task 6 (SVG, без nonce — refinement спеки, SVG там допускался). ✔
- i18n/тесты → распределены по задачам. ✔
- Атрибуция (Принцип 6) → Tasks 8/14 (UserView, без анонимизации). ✔
- Вне скоупа (анонимизация, тумблер видимости, CSV, чарт-либа) → не реализуется. ✔

**2. Placeholder scan:** в коде задач нет TODO/«handle errors»/«similar to»; каждый код-шаг содержит реальный код. Phase 6 намеренно высокоуровневая — блокирована несуществующей ручкой (писать код против неё = спекуляция). ✔

**3. Type consistency:** `getFieldAnswers` возвращает `{ items, total, offset, limit } | null` — потребляется в Task 8 (страница превью) и Task 15 (передаёт `page` в `FieldAnswersColumn`, чей `Page`-интерфейс совпадает). `canViewFormResults(me, form)` — единая сигнатура в Tasks 4/10/13/15. `readAnswerValue(type, value)` → `ReadValue` — Tasks 8/14. `FormStats.total_submissions`/`FieldStats.answered/options/number/date` — из схемы (Task 1). ✔

**Зависимость порядка:** Task 9 (`FormResultsView`) использует `FormVisibilityBadges` (Task 11) → исполнять Task 11 до Task 9. Помечено в обеих задачах.
