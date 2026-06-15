# User Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать залогиненному пользователю просмотр собственной статистики — производственной (инвентарь созданных сущностей) и просмотров (история), — с возможностью включать/выключать трекинг просмотров в личном кабинете.

**Architecture:** Новый фича-слайс `src/features/statistics/` по [docs/frontend-conventions.md](../../frontend-conventions.md): server-only fetchers на `React.cache`, один server action для тоггла, презентационные server-компоненты + один client-тоггл. Страница `/me/stats` показывает обе статистики; тоггл трекинга живёт на `/settings`. Синхронизация после мутации — через `router.refresh()` (данные пер-юзерные, `unstable_cache`/теги не применимы).

**Tech Stack:** Next.js (App Router, server components + server actions), TypeScript, Zod, openapi-fetch, Base UI, Tailwind v4, vitest + Testing Library.

**Спека:** [docs/superpowers/specs/2026-06-15-user-statistics-design.md](../specs/2026-06-15-user-statistics-design.md)

---

## Контракт с бекендом (готов, регенерация schema.ts НЕ требуется)

- `GET /api/me/production` → `productionstats.Inventory { by_type: EntityInventory[], totals: Totals }`
  - `EntityInventory { entity_type, total, public?, private? }` — `public/private` отсутствуют для `comment`.
  - порядок `by_type`: lecture, document, canvas, form, trail, media, annotation, comment.
- `GET /api/me/history/stats` → `history.Stats { total, count_by_type, top: StatItem[] }`
  - `StatItem { target_type, target_id, title?, available, count, last_viewed_at }`; `target_type ∈ lecture|document|trail|canvas|form`.
- `GET /api/me/history/settings` → `history.Settings { tracking_enabled? }`
- `PUT /api/me/history/settings` body `{ tracking_enabled }` → `history.Settings`
  - ⚠️ выключение трекинга на бэке безвозвратно удаляет всю историю просмотров.

## Карта файлов

Создаётся:
- `src/features/statistics/types.ts` — алиасы типов из `@/api/schema`.
- `src/features/statistics/permissions.ts` + `permissions.test.ts` — `canManageOwnHistory`.
- `src/features/statistics/schemas.ts` + `schemas.test.ts` — Zod-схема входа экшена.
- `src/features/statistics/api.ts` — fetchers.
- `src/features/statistics/actions.ts` — `setHistoryTracking`.
- `src/features/statistics/ui/production-stats-table.tsx` + `.test.tsx`.
- `src/features/statistics/ui/view-stats.tsx` + `.test.tsx`.
- `src/features/statistics/ui/history-tracking-toggle.tsx` + `.test.tsx`.
- `src/features/statistics/index.ts` — барьер слайса.
- `src/features/statistics/client.ts` — client-safe entry (пустой, для Guardrail 4).
- `src/app/me/stats/page.tsx` — страница «Моя статистика».

Изменяется:
- `src/app/settings/page.tsx` — секция «История просмотров» + ссылка на `/me/stats`.

НЕ трогается (запретные зоны): `src/api/schema.ts`, `src/api/tags.ts`, `src/app/layout.tsx`, `src/components/app/*` (шапка), `src/components/ui/*` (только импорт), `src/utils/*`.

---

## Task 1: Скаффолд слайса из `_template`

**Files:**
- Create: каталог `src/features/statistics/` (копия `src/features/_template/`)

- [ ] **Step 1: Скопировать шаблон**

```bash
cp -R src/features/_template src/features/statistics
```

- [ ] **Step 2: Проверить, что скопировалось**

Run: `ls src/features/statistics`
Expected: `actions.ts api.ts client.ts index.ts permissions.test.ts permissions.ts schemas.test.ts schemas.ts types.ts ui`

- [ ] **Step 3: Commit**

```bash
git add src/features/statistics
git commit -m "chore(statistics): скаффолд слайса из _template"
```

---

## Task 2: `types.ts` — алиасы типов контракта

**Files:**
- Modify: `src/features/statistics/types.ts`

- [ ] **Step 1: Заменить содержимое файла**

```ts
// src/features/statistics/types.ts
import type { components } from "@/api/schema";

/** GET /api/me/production. Бэк: internal/productionstats */
export type Inventory = components["schemas"]["productionstats.Inventory"];
export type EntityInventory =
  components["schemas"]["productionstats.EntityInventory"];

/** GET /api/me/history/stats. Бэк: internal/history */
export type ViewStats = components["schemas"]["history.Stats"];
export type ViewStatItem = components["schemas"]["history.StatItem"];

/** GET/PUT /api/me/history/settings. */
export type HistorySettings = components["schemas"]["history.Settings"];
```

- [ ] **Step 2: Проверить типы**

Run: `pnpm exec tsc --noEmit`
Expected: без ошибок в `src/features/statistics/types.ts` (могут быть ошибки в ещё не заполненных placeholder-файлах слайса — это ок до Task 9).

- [ ] **Step 3: Commit**

```bash
git add src/features/statistics/types.ts
git commit -m "feat(statistics): типы контракта статистики"
```

---

## Task 3: `permissions.ts` — RBAC-хелпер (TDD)

**Files:**
- Modify: `src/features/statistics/permissions.ts`
- Modify: `src/features/statistics/permissions.test.ts`

- [ ] **Step 1: Написать падающий тест**

Заменить содержимое `src/features/statistics/permissions.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import type { Me } from "@/utils/me";

import { canManageOwnHistory } from "./permissions";

const active: Me = {
  id: "u1",
  username: "alice",
  role: "user",
  status: "active",
  capabilities: [],
};

describe("canManageOwnHistory", () => {
  it("active-пользователь → true", () => {
    expect(canManageOwnHistory(active)).toBe(true);
  });
  it("suspended → false", () => {
    expect(canManageOwnHistory({ ...active, status: "suspended" })).toBe(false);
  });
  it("гость (null) → false", () => {
    expect(canManageOwnHistory(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm test -- src/features/statistics/permissions.test.ts`
Expected: FAIL — `canManageOwnHistory` не экспортируется (в шаблоне `canPlaceholder`).

- [ ] **Step 3: Реализовать**

Заменить содержимое `src/features/statistics/permissions.ts`:

```ts
// src/features/statistics/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { isMutationAllowed } from "@/utils/permissions";

/**
 * Изменение собственных настроек истории просмотров: любой залогиненный
 * active-пользователь. Бэк гейтит только RequireMutator (suspended → 403
 * SUSPENDED), специальной capability нет.
 */
export function canManageOwnHistory(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm test -- src/features/statistics/permissions.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/features/statistics/permissions.ts src/features/statistics/permissions.test.ts
git commit -m "feat(statistics): canManageOwnHistory + тест"
```

---

## Task 4: `schemas.ts` — Zod-схема входа экшена (TDD)

**Files:**
- Modify: `src/features/statistics/schemas.ts`
- Modify: `src/features/statistics/schemas.test.ts`

- [ ] **Step 1: Написать падающий тест**

Заменить содержимое `src/features/statistics/schemas.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import { HistoryTrackingSchema } from "./schemas";

describe("HistoryTrackingSchema", () => {
  it("принимает boolean", () => {
    expect(HistoryTrackingSchema.parse(true)).toBe(true);
    expect(HistoryTrackingSchema.parse(false)).toBe(false);
  });
  it("отклоняет не-boolean", () => {
    expect(() => HistoryTrackingSchema.parse("yes")).toThrow();
    expect(() => HistoryTrackingSchema.parse(1)).toThrow();
    expect(() => HistoryTrackingSchema.parse(null)).toThrow();
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm test -- src/features/statistics/schemas.test.ts`
Expected: FAIL — `HistoryTrackingSchema` не экспортируется (в шаблоне `PlaceholderSchema`).

- [ ] **Step 3: Реализовать**

Заменить содержимое `src/features/statistics/schemas.ts`:

```ts
// src/features/statistics/schemas.ts
import "server-only";
import { z } from "zod";

/** Вход server action `setHistoryTracking` — булев флаг трекинга. */
export const HistoryTrackingSchema = z.boolean();
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm test -- src/features/statistics/schemas.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 5: Commit**

```bash
git add src/features/statistics/schemas.ts src/features/statistics/schemas.test.ts
git commit -m "feat(statistics): HistoryTrackingSchema + тест"
```

---

## Task 5: `api.ts` — fetchers статистики и настроек

**Files:**
- Modify: `src/features/statistics/api.ts`

Юнит-теста нет (как у `preferences/api.ts`): fetcher — тонкая обёртка над openapi-fetch, проверяется типами и интеграцией страниц.

- [ ] **Step 1: Заменить содержимое файла**

```ts
// src/features/statistics/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";

import type { HistorySettings, Inventory, ViewStats } from "./types";

/**
 * Self-only статистика текущего пользователя. Данные пер-юзерные — НЕ
 * оборачивать в unstable_cache: cross-request кеш протёк бы между
 * пользователями. React.cache дедуплицирует вызовы в рамках запроса.
 * Вызывать только после getMe() !== null.
 */
export const getProductionStats = cache(async (): Promise<Inventory> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/me/production");
  if (error) {
    throw new Error(error.error ?? "Не удалось загрузить статистику.");
  }
  return data.data ?? {};
});

export const getViewStats = cache(async (): Promise<ViewStats> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/me/history/stats");
  if (error) {
    throw new Error(error.error ?? "Не удалось загрузить статистику просмотров.");
  }
  return data.data ?? {};
});

export const getHistorySettings = cache(async (): Promise<HistorySettings> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/me/history/settings");
  if (error) {
    throw new Error(error.error ?? "Не удалось загрузить настройки истории.");
  }
  return data.data ?? {};
});
```

- [ ] **Step 2: Проверить типы**

Run: `pnpm exec tsc --noEmit`
Expected: без ошибок в `api.ts` (placeholder-ошибки в `index.ts`/`actions.ts` допустимы до их заполнения).

- [ ] **Step 3: Commit**

```bash
git add src/features/statistics/api.ts
git commit -m "feat(statistics): fetchers статистики и настроек истории"
```

---

## Task 6: `actions.ts` — server action `setHistoryTracking`

**Files:**
- Modify: `src/features/statistics/actions.ts`

Юнит-теста нет (как у `preferences/actions.ts`): server action, покрывается через тест тоггла (Task 9) с моком экшена.

- [ ] **Step 1: Заменить содержимое файла**

```ts
// src/features/statistics/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { handleCommonApiError, type ApiError } from "@/utils/api-error";
import { createAction } from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireCapability } from "@/utils/permissions";

import { canManageOwnHistory } from "./permissions";
import { HistoryTrackingSchema } from "./schemas";
import type { HistorySettings } from "./types";

/** Маппинг кодов httputil/apperror бекенда на доменные ошибки фронта. */
function rethrowApiError(err: ApiError | undefined): never {
  switch (err?.code) {
    case "SUSPENDED":
      throw new ForbiddenError("status", err.error);
    case "BAD_REQUEST":
    case "VALIDATION_ERROR":
      throw new Error(err.error ?? "Сервер отклонил запрос.");
  }
  handleCommonApiError(err);
}

/**
 * Включает/выключает трекинг просмотров. Выключение на бэке безвозвратно
 * удаляет всю историю просмотров (DisableAndPurgeTx) — предупреждение в UI
 * (ConfirmDialog в history-tracking-toggle).
 */
export const setHistoryTracking = createAction(async (raw: unknown) => {
  const me = await getMe();
  requireCapability(me, canManageOwnHistory);
  const enabled = HistoryTrackingSchema.parse(raw);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/me/history/settings", {
    body: { tracking_enabled: enabled },
  });
  if (error) rethrowApiError(error as ApiError);
  return (data.data ?? null) as HistorySettings | null;
});
```

- [ ] **Step 2: Проверить типы**

Run: `pnpm exec tsc --noEmit`
Expected: без ошибок в `actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/features/statistics/actions.ts
git commit -m "feat(statistics): server action setHistoryTracking"
```

---

## Task 7: `ui/production-stats-table.tsx` — таблица инвентаря (TDD)

**Files:**
- Create: `src/features/statistics/ui/production-stats-table.tsx`
- Create: `src/features/statistics/ui/production-stats-table.test.tsx`

- [ ] **Step 1: Написать падающий тест**

Создать `src/features/statistics/ui/production-stats-table.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";

import type { Inventory } from "../types";
import { ProductionStatsTable } from "./production-stats-table";

afterEach(cleanup);

const inventory: Inventory = {
  by_type: [
    { entity_type: "lecture", total: 5, public: 3, private: 2 },
    { entity_type: "comment", total: 7 },
  ],
  totals: { total: 12, public: 3, private: 2 },
};

describe("ProductionStatsTable", () => {
  it("рендерит строки с локализованными подписями и итоги", () => {
    render(<ProductionStatsTable inventory={inventory} />);
    expect(screen.getByText("Лекции")).toBeTruthy();
    expect(screen.getByText("Комментарии")).toBeTruthy();
    expect(screen.getByText("Итого")).toBeTruthy();
  });

  it("для comment показывает «—» в колонках публичных/приватных", () => {
    render(<ProductionStatsTable inventory={inventory} />);
    // у comment public/private отсутствуют → две ячейки с «—»
    expect(screen.getAllByText("—").length).toBe(2);
  });

  it("пустой инвентарь → EmptyState", () => {
    render(
      <ProductionStatsTable
        inventory={{ by_type: [], totals: { total: 0, public: 0, private: 0 } }}
      />,
    );
    expect(screen.getByText("Вы пока ничего не создали")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm test -- src/features/statistics/ui/production-stats-table.test.tsx`
Expected: FAIL — модуль `./production-stats-table` не найден.

- [ ] **Step 3: Реализовать компонент**

Создать `src/features/statistics/ui/production-stats-table.tsx`:

```tsx
// src/features/statistics/ui/production-stats-table.tsx
import { EmptyState, Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui";

import type { Inventory } from "../types";

const LABELS: Record<string, string> = {
  lecture: "Лекции",
  document: "Документы",
  canvas: "Канвасы",
  form: "Формы",
  trail: "Маршруты",
  media: "Медиа",
  annotation: "Аннотации",
  comment: "Комментарии",
};

/** number → строка; null/undefined (нет видимости, напр. comment) → «—». */
function fmt(n: number | undefined): string {
  return n === undefined || n === null ? "—" : String(n);
}

export function ProductionStatsTable({ inventory }: { inventory: Inventory }) {
  const rows = inventory.by_type ?? [];
  const totals = inventory.totals;

  if ((totals?.total ?? 0) === 0) {
    return (
      <EmptyState
        title="Вы пока ничего не создали"
        description="Здесь появится статистика по вашим лекциям, документам и другим материалам."
      />
    );
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Тип</Th>
          <Th className="text-right">Всего</Th>
          <Th className="text-right">Публичных</Th>
          <Th className="text-right">Приватных</Th>
        </Tr>
      </Thead>
      <Tbody>
        {rows.map((row) => (
          <Tr key={row.entity_type}>
            <Td>{LABELS[row.entity_type ?? ""] ?? row.entity_type}</Td>
            <Td className="text-right">{fmt(row.total)}</Td>
            <Td className="text-right">{fmt(row.public)}</Td>
            <Td className="text-right">{fmt(row.private)}</Td>
          </Tr>
        ))}
        <Tr className="font-semibold">
          <Td>Итого</Td>
          <Td className="text-right">{fmt(totals?.total)}</Td>
          <Td className="text-right">{fmt(totals?.public)}</Td>
          <Td className="text-right">{fmt(totals?.private)}</Td>
        </Tr>
      </Tbody>
    </Table>
  );
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm test -- src/features/statistics/ui/production-stats-table.test.tsx`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/features/statistics/ui/production-stats-table.tsx src/features/statistics/ui/production-stats-table.test.tsx
git commit -m "feat(statistics): таблица производственной статистики + тест"
```

---

## Task 8: `ui/view-stats.tsx` — статистика просмотров (TDD)

**Files:**
- Create: `src/features/statistics/ui/view-stats.tsx`
- Create: `src/features/statistics/ui/view-stats.test.tsx`

- [ ] **Step 1: Написать падающий тест**

Создать `src/features/statistics/ui/view-stats.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";

import type { ViewStats as ViewStatsData } from "../types";
import { ViewStats } from "./view-stats";

afterEach(cleanup);

describe("ViewStats", () => {
  it("трекинг выключен → подсказка со ссылкой в настройки", () => {
    render(<ViewStats stats={{}} trackingEnabled={false} />);
    expect(screen.getByText("Трекинг просмотров выключен")).toBeTruthy();
    const link = screen.getByRole("link", { name: /настройк/i });
    expect(link.getAttribute("href")).toBe("/settings");
  });

  it("трекинг включён, но пусто → соответствующий EmptyState", () => {
    render(<ViewStats stats={{ total: 0, top: [] }} trackingEnabled />);
    expect(screen.getByText("Вы пока ничего не просматривали")).toBeTruthy();
  });

  it("рендерит total, разбивку и топ; доступные цели — ссылки, недоступные — текст", () => {
    const stats: ViewStatsData = {
      total: 4,
      count_by_type: { lecture: 3, document: 1 },
      top: [
        {
          target_type: "lecture",
          target_id: "L1",
          title: "Платон",
          available: true,
          count: 3,
          last_viewed_at: "2026-06-01T10:00:00Z",
        },
        {
          target_type: "document",
          target_id: "D9",
          available: false,
          count: 1,
          last_viewed_at: "2026-05-01T10:00:00Z",
        },
      ],
    };
    render(<ViewStats stats={stats} trackingEnabled />);
    // доступная цель — ссылка на /lectures/L1
    const link = screen.getByRole("link", { name: "Платон" });
    expect(link.getAttribute("href")).toBe("/lectures/L1");
    // недоступная цель — текст «Недоступно», без ссылки
    expect(screen.getByText("Недоступно")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /D9/ })).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm test -- src/features/statistics/ui/view-stats.test.tsx`
Expected: FAIL — модуль `./view-stats` не найден.

- [ ] **Step 3: Реализовать компонент**

Создать `src/features/statistics/ui/view-stats.tsx`:

```tsx
// src/features/statistics/ui/view-stats.tsx
import { EmptyState, RouterLink } from "@/components/ui";

import type { ViewStatItem, ViewStats as ViewStatsData } from "../types";

const LABELS: Record<string, string> = {
  lecture: "Лекции",
  document: "Документы",
  trail: "Маршруты",
  canvas: "Канвасы",
  form: "Формы",
};

const BASE_PATH: Record<string, string> = {
  lecture: "/lectures",
  document: "/documents",
  trail: "/trails",
  canvas: "/canvases",
  form: "/forms",
};

/** Путь на цель просмотра или null, если тип/ид неизвестны. */
function targetHref(item: ViewStatItem): string | null {
  const base = BASE_PATH[item.target_type ?? ""];
  if (!base || !item.target_id) return null;
  return `${base}/${item.target_id}`;
}

export function ViewStats({
  stats,
  trackingEnabled,
}: {
  stats: ViewStatsData;
  trackingEnabled: boolean;
}) {
  if (!trackingEnabled) {
    return (
      <EmptyState
        title="Трекинг просмотров выключен"
        description="Включите его в настройках, чтобы видеть статистику просмотров."
        action={<RouterLink href="/settings">Перейти в настройки</RouterLink>}
      />
    );
  }

  if ((stats.total ?? 0) === 0) {
    return (
      <EmptyState
        title="Вы пока ничего не просматривали"
        description="Статистика появится после первых просмотров материалов."
      />
    );
  }

  const byType = stats.count_by_type ?? {};
  const top = stats.top ?? [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        Всего просмотров: <strong>{stats.total}</strong>
      </p>

      {Object.keys(byType).length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-(--color-description)">
          {Object.entries(byType).map(([type, count]) => (
            <li key={type}>
              {LABELS[type] ?? type}: {count}
            </li>
          ))}
        </ul>
      )}

      <ul className="flex flex-col gap-2">
        {top.map((item) => {
          const href = item.available ? targetHref(item) : null;
          return (
            <li
              key={`${item.target_type}:${item.target_id}`}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate">
                {href ? (
                  <RouterLink href={href}>{item.title ?? "Без названия"}</RouterLink>
                ) : (
                  <span className="text-(--color-description)">Недоступно</span>
                )}
              </span>
              <span className="shrink-0 text-(--color-description)">
                {item.count} просм.
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm test -- src/features/statistics/ui/view-stats.test.tsx`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/features/statistics/ui/view-stats.tsx src/features/statistics/ui/view-stats.test.tsx
git commit -m "feat(statistics): компонент статистики просмотров + тест"
```

---

## Task 9: `ui/history-tracking-toggle.tsx` — тоггл трекинга (TDD)

**Files:**
- Create: `src/features/statistics/ui/history-tracking-toggle.tsx`
- Create: `src/features/statistics/ui/history-tracking-toggle.test.tsx`

- [ ] **Step 1: Написать падающий тест**

Создать `src/features/statistics/ui/history-tracking-toggle.test.tsx`:

```tsx
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { ToastProvider } from "@/components/ui";

import { HistoryTrackingToggle } from "./history-tracking-toggle";

const { refreshMock, setTrackingMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  setTrackingMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("../actions", () => ({
  setHistoryTracking: setTrackingMock,
}));

function renderToggle(props: { initialEnabled: boolean; canManage: boolean }) {
  return render(
    <ToastProvider>
      <HistoryTrackingToggle {...props} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  refreshMock.mockReset();
  setTrackingMock.mockReset();
});
afterEach(cleanup);

describe("HistoryTrackingToggle", () => {
  it("выключенный трекинг → кнопка «Включить»", () => {
    renderToggle({ initialEnabled: false, canManage: true });
    expect(screen.getByText("Трекинг просмотров выключен.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Включить" })).toBeTruthy();
  });

  it("включённый трекинг → кнопка «Выключить» и статус", () => {
    renderToggle({ initialEnabled: true, canManage: true });
    expect(screen.getByText("Трекинг просмотров включён.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Выключить" })).toBeTruthy();
  });

  it("клик «Включить» → вызывает экшен с true, обновляет состояние и refresh", async () => {
    setTrackingMock.mockResolvedValue({
      success: true,
      data: { tracking_enabled: true },
    });
    const user = userEvent.setup();
    renderToggle({ initialEnabled: false, canManage: true });

    await user.click(screen.getByRole("button", { name: "Включить" }));

    expect(setTrackingMock).toHaveBeenCalledWith(true);
    await waitFor(() => {
      expect(screen.getByText("Трекинг просмотров включён.")).toBeTruthy();
    });
    expect(refreshMock).toHaveBeenCalled();
  });

  it("forbidden → состояние не меняется, refresh не вызывается", async () => {
    setTrackingMock.mockResolvedValue({
      success: false,
      code: "forbidden",
      error: "forbidden",
    });
    const user = userEvent.setup();
    renderToggle({ initialEnabled: false, canManage: true });

    await user.click(screen.getByRole("button", { name: "Включить" }));

    await waitFor(() => {
      expect(setTrackingMock).toHaveBeenCalledWith(true);
    });
    expect(screen.getByText("Трекинг просмотров выключен.")).toBeTruthy();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("canManage=false → кнопка «Включить» задизейблена", () => {
    renderToggle({ initialEnabled: false, canManage: false });
    expect(
      screen.getByRole("button", { name: "Включить" }).hasAttribute("disabled"),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm test -- src/features/statistics/ui/history-tracking-toggle.test.tsx`
Expected: FAIL — модуль `./history-tracking-toggle` не найден.

- [ ] **Step 3: Реализовать компонент**

Создать `src/features/statistics/ui/history-tracking-toggle.tsx`:

```tsx
"use client";
// src/features/statistics/ui/history-tracking-toggle.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";

import { setHistoryTracking } from "../actions";

interface Props {
  initialEnabled: boolean;
  /** canManageOwnHistory(me) со страницы (server component). */
  canManage: boolean;
}

export function HistoryTrackingToggle({ initialEnabled, canManage }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);

  async function apply(next: boolean) {
    setPending(true);
    try {
      const result = await setHistoryTracking(next);
      if (!result.success) {
        toast.add({
          title: result.code === "forbidden" ? "Нет прав" : "Ошибка",
          description:
            result.code === "forbidden"
              ? "У вас нет прав на изменение настроек."
              : result.error,
        });
        return;
      }
      setEnabled(next);
      toast.add({
        title: "Сохранено",
        description: next
          ? "Трекинг просмотров включён."
          : "Трекинг выключен, история удалена.",
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (enabled) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">Трекинг просмотров включён.</p>
        <ConfirmDialog
          trigger={
            <Button
              variant="secondary"
              className="self-start"
              disabled={pending || !canManage}
            >
              Выключить
            </Button>
          }
          title="Выключить трекинг?"
          description="Вся история просмотров будет удалена безвозвратно."
          destructive
          confirmLabel="Выключить"
          onConfirm={() => apply(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">Трекинг просмотров выключен.</p>
      <Button
        className="self-start"
        disabled={pending || !canManage}
        onClick={() => {
          void apply(true);
        }}
      >
        Включить
      </Button>
      {!canManage && (
        <p className="text-sm text-(--color-description)">
          У вас нет прав на изменение настроек.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm test -- src/features/statistics/ui/history-tracking-toggle.test.tsx`
Expected: PASS (5 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/features/statistics/ui/history-tracking-toggle.tsx src/features/statistics/ui/history-tracking-toggle.test.tsx
git commit -m "feat(statistics): тоггл трекинга истории + тест"
```

---

## Task 10: `index.ts` — публичный барьер слайса

**Files:**
- Modify: `src/features/statistics/index.ts`

- [ ] **Step 1: Заменить содержимое файла**

```ts
// src/features/statistics/index.ts
export { getHistorySettings, getProductionStats, getViewStats } from "./api";
export { setHistoryTracking } from "./actions";
export { canManageOwnHistory } from "./permissions";
export { ProductionStatsTable } from "./ui/production-stats-table";
export { ViewStats } from "./ui/view-stats";
export { HistoryTrackingToggle } from "./ui/history-tracking-toggle";
export type {
  EntityInventory,
  HistorySettings,
  Inventory,
  ViewStatItem,
} from "./types";
```

- [ ] **Step 2: Проверить типы и линт слайса**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: без ошибок. (`client.ts` остаётся пустым `export {}` из шаблона — это валидно.)

- [ ] **Step 3: Commit**

```bash
git add src/features/statistics/index.ts
git commit -m "feat(statistics): публичный барьер слайса"
```

---

## Task 11: Страница `/me/stats`

**Files:**
- Create: `src/app/me/stats/page.tsx`

- [ ] **Step 1: Создать страницу**

Создать `src/app/me/stats/page.tsx`:

```tsx
// src/app/me/stats/page.tsx
import { redirect } from "next/navigation";

import {
  ProductionStatsTable,
  ViewStats,
  getHistorySettings,
  getProductionStats,
  getViewStats,
} from "@/features/statistics";
import { getMe } from "@/utils/me";

export const metadata = { title: "Моя статистика" };

export default async function MyStatsPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/me/stats");

  const [inventory, viewStats, settings] = await Promise.all([
    getProductionStats(),
    getViewStats(),
    getHistorySettings(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4">
      <h1 className="text-2xl font-bold">Моя статистика</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Что я создал</h2>
        <ProductionStatsTable inventory={inventory} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Мои просмотры</h2>
        <ViewStats
          stats={viewStats}
          trackingEnabled={settings.tracking_enabled ?? false}
        />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Проверить типы и линт**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/app/me/stats/page.tsx
git commit -m "feat(statistics): страница /me/stats"
```

---

## Task 12: Секция «История просмотров» на `/settings`

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Заменить содержимое файла**

```tsx
// src/app/settings/page.tsx
import { redirect } from "next/navigation";

import { RouterLink } from "@/components/ui";
import {
  PreferencesForm,
  PushSubscriptionToggle,
  canSubscribePush,
  getPreferences,
  getVapidKey,
  type ReadingMode,
} from "@/features/preferences";
import {
  HistoryTrackingToggle,
  canManageOwnHistory,
  getHistorySettings,
} from "@/features/statistics";
import { getMe } from "@/utils/me";

export const metadata = { title: "Настройки" };

export default async function SettingsPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/settings");

  const [prefs, vapidPublicKey, historySettings] = await Promise.all([
    getPreferences(),
    getVapidKey(),
    getHistorySettings(),
  ]);
  // reading_mode в schema.ts — string|undefined; сужаем с фоллбеком на
  // дефолт бекенда (internal/preference/model.go: DefaultPreferences).
  const readingMode: ReadingMode =
    prefs.reading_mode === "focused" ? "focused" : "full";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4">
      <h1 className="text-2xl font-bold">Настройки</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Чтение</h2>
        <PreferencesForm initialReadingMode={readingMode} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Push-уведомления</h2>
        <PushSubscriptionToggle
          vapidPublicKey={vapidPublicKey}
          canSubscribe={canSubscribePush(me)}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">История просмотров</h2>
        <HistoryTrackingToggle
          initialEnabled={historySettings.tracking_enabled ?? false}
          canManage={canManageOwnHistory(me)}
        />
        <RouterLink href="/me/stats" className="text-sm">
          Посмотреть мою статистику →
        </RouterLink>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Проверить типы и линт**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat(statistics): тоггл трекинга и ссылка на статистику в настройках"
```

---

## Task 13: Финальная верификация

**Files:** —

- [ ] **Step 1: Прогнать тесты слайса**

Run: `pnpm test -- src/features/statistics`
Expected: PASS — все тесты слайса (permissions 3, schemas 2, production-table 3, view-stats 3, toggle 5).

- [ ] **Step 2: Полная верификация перед PR**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: все три зелёные (требование CLAUDE.md перед PR).

- [ ] **Step 3: Финальный коммит (если что-то поправлено линтером/форматтером)**

```bash
git add -u src/features/statistics src/app/me/stats src/app/settings
git commit -m "chore(statistics): финальная верификация (lint/test/build)" || echo "нечего коммитить"
```

---

## Self-Review (выполнено при написании плана)

**Spec coverage:**
- Производственная статистика (просмотр) → Task 5 (fetcher) + Task 7 (таблица) + Task 11 (страница). ✓
- Статистика просмотров (просмотр) → Task 5 + Task 8 + Task 11. ✓
- Регулирование трекинга в личном кабинете → Task 6 (action) + Task 9 (тоггл) + Task 12 (/settings). ✓
- ConfirmDialog при выключении (безвозвратное удаление истории) → Task 9. ✓
- RBAC self-only → Task 3 (`canManageOwnHistory`) + `requireCapability` в Task 6 + Layer-3 redirect в Task 11. ✓
- Empty-states (новый юзер / трекинг выкл) → Task 7, Task 8. ✓
- Доступные/недоступные цели в топе → Task 8. ✓
- Не трогаем запретные зоны (шапка, schema.ts, tags.ts, UI-kit) → ссылка на статистику размещена на /settings, а не в шапке. ✓

**Type consistency:** `Inventory`/`EntityInventory`/`ViewStats`/`ViewStatItem`/`HistorySettings` определены в Task 2 и используются единообразно. `setHistoryTracking(boolean)` — сигнатура согласована между Task 6 (реализация), Task 9 (вызов и мок теста). `canManageOwnHistory(MaybeMe)` — Task 3/6/12. ✓

**Placeholder scan:** плейсхолдеров/«TODO» в шагах нет; весь код приведён целиком. ✓

## Замечания для исполнителя

- Команды тестов используют `pnpm test -- <path>` (проект на pnpm — npm ломает тулчейн). При иной конфигурации vitest допустимо `pnpm exec vitest run <path>`.
- При параллельной работе агентов: коммитить только свои файлы по имени, без `git add -A`/`git add .` (CLAUDE.md).
- Если ESLint потребует иной порядок импортов — применить `pnpm lint --fix` для затронутых файлов слайса (только своих).
- `client.ts` слайса остаётся пустым (`export {}`) — у фичи нет client-видимых реэкспортов; Guardrail 4 это устраивает.
