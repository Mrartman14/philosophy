# In-app уведомления + подписки на документы — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать фронтенд для нового бэкенд-функционала — лента in-app уведомлений (колокольчик + счётчики + страница) и подписки на изменения документов — новым слайсом `src/features/notifications/`.

**Architecture:** Один feature-слайс владеет обоими доменами (`notification.*` на беке связан причинно). Server-fetchers на `React.cache` (per-request); клиентские островки опрашивают серверные read-actions для live-бейджа и подгрузки ленты; мутации — `createAction` + оптимистичный UI + `router.refresh()`. Web-push (транспорт доставки) уже реализован в слайсе `preferences` — **вне скоупа**.

**Tech Stack:** Next.js App Router (RSC + server actions), openapi-fetch (`@/api/client`), Vitest/jsdom, Tailwind v4 (CSS-переменные), Base UI (для UI-kit; колокольчик — самодостаточный dropdown без новых примитивов).

**Спека:** [docs/superpowers/specs/2026-06-16-notifications-subscriptions-design.md](../specs/2026-06-16-notifications-subscriptions-design.md)

---

## Важные решения (уточнения к спеке)

1. **Без `unstable_cache`/тегов.** Данные уведомлений и подписок — per-user и волатильны: `unstable_cache` (кросс-реквест, общий) тут некорректен. Используем только `React.cache` (дедуп в рамках запроса). Свежесть после мутаций даёт `router.refresh()` (re-run server-компонентов) + оптимистичный клиентский апдейт. Поэтому `revalidateEntity`/новые теги в `src/api/tags.ts` **не нужны** (отклонение от §3 спеки — осознанное).
2. **Колокольчик — самодостаточный dropdown** (кнопка + абсолютная панель + click-outside/Escape), без Base UI Popover (его API не верифицирован) и без новых UI-kit примитивов (`components/ui/*` заморожены).
3. **Семантика счётчиков:** бейдж = `unseen`; открытие поповера → `markAllSeen()` гасит бейдж; «прочитано» (`read_at`) — отдельно, per-item клик / «Прочитать все».
4. **Гейты:** чтение (read-actions) — нужен залогиненный (`canUseNotifications`); мутации (mark/subscribe) — залогинен + active (`requireActive`). 403/BANNED централизованно ловит `rethrowApiError`/`createAction`.
5. **Инвариант идемпотентности `read-all`/`seen-all`.** Поповер вызывает `markAllSeen()` на КАЖДОМ открытии (и dev-StrictMode прогонит эффект дважды) — это безопасно при условии, что бэк трактует повторный `seen-all`/`read-all` как no-op (повторная установка `seen_at`/`read_at` на уже отмеченных). Считаем это контрактом; если бэк не идемпотентен — поднять в backend-ask (Task 16) и добавить guard «уже гасили в этой сессии бейджа».
6. **Принцип обработки ошибок (симметрия осознанная).** Фоновые некритичные мутации (`markRead` per-item при клике, `markAllSeen` при открытии) — ошибка проглатывается тихо (повторится на следующем тике/открытии, тост был бы шумом). Явные пользовательские действия (кнопки «Прочитать все», subscribe/unsubscribe) — ошибка показывается тостом + откат оптимизма. Это не недосмотр, а правило.

---

## Карта файлов

**Новый слайс `src/features/notifications/`:**

| Файл | Ответственность |
|---|---|
| `types.ts` | Нормализованные типы `AppNotification`, `NotificationCounts`, `DocumentSubscription` + DTO-алиасы |
| `notification-content.ts` | Чистый резистентный рендерер `renderNotification` (client-safe) |
| `notification-content.test.ts` | Юнит-тесты рендерера |
| `permissions.ts` | `canUseNotifications`, `canManageSubscriptions` (server-only) |
| `permissions.test.ts` | Юнит-тесты гейтов |
| `api.ts` | Server-fetchers + нормализаторы (server-only) |
| `actions.ts` | Мутации + read-actions (`"use server"`) |
| `index.ts` | Server-вход (api/actions/permissions/UI/типы) |
| `client.ts` | Client-safe вход (рендерер + типы) |
| `ui/bell-icon.tsx` | Inline SVG колокольчика |
| `ui/notification-item.tsx` | Один элемент (client; рендерер + read-on-click) |
| `ui/notification-popover.tsx` | Панель ленты (client; load + seen-all on open) |
| `ui/notification-bell.tsx` | Островок хедера (client; badge + polling + dropdown) |
| `ui/notification-list-actions.tsx` | Бар «Прочитать все / просмотреть» для страницы (client) |
| `ui/document-subscribe-button.tsx` | Toggle подписки на документ (client) |
| `ui/subscription-row.tsx` | Строка подписки с «Отписаться» (client) |
| `ui/subscriptions-section.tsx` | Секция «Мои подписки» для /settings (server) |

**Изменяемые существующие файлы:**

| Файл | Изменение |
|---|---|
| `src/components/app/app-header/app-header.tsx` | Монтаж `<NotificationBell>` + `getNotificationCounts()` (**заморожен** — только это) |
| `src/app/documents/[id]/page.tsx` | Кнопка подписки + `getDocumentSubscription` |
| `src/app/settings/page.tsx` | Секция «Подписки на документы» |
| `src/app/notifications/page.tsx` | **Новый** маршрут — полная лента |

**Не трогаем:** `src/api/schema.ts`, `globals.css`, `components/ui/*`, `package.json`, `eslint.config.mjs`.

---

## Цветовые токены (Tailwind, из globals.css)

`--color-background`, `--color-border`, `--color-description`, `--color-foreground`, `--color-link`, `--color-primary`, `--color-text-pane`. Hover-фон по конвенции: `hover:bg-(--color-text-pane)`. Других не выдумывать.

---

# Фаза 1 — Слой данных (без UI)

### Task 1: Типы слайса

**Files:**
- Create: `src/features/notifications/types.ts`

- [ ] **Step 1: Написать `types.ts`**

```ts
// src/features/notifications/types.ts
import type { components } from "@/api/schema";

/** Сырые DTO из сгенерированной схемы (для нормализаторов в api.ts). */
export type NotificationDTO = components["schemas"]["notification.Notification"];
export type SubscriptionDTO = components["schemas"]["notification.Subscription"];

/** Нормализованное уведомление: optional-поля DTO сведены к не-optional с дефолтами. */
export interface AppNotification {
  id: string;
  type: string;
  reason: string;
  actorId: string | null;
  targetId: string | null;
  targetType: string | null;
  targetVersion: number | null;
  groupCount: number;
  readAt: string | null;
  seenAt: string | null;
  createdAt: string | null;
}

export interface NotificationCounts {
  unread: number;
  unseen: number;
}

export interface DocumentSubscription {
  id: string;
  targetId: string;
  targetType: string;
  createdAt: string | null;
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `pnpm typecheck`
Expected: PASS (нет ошибок; новый файл изолирован).

- [ ] **Step 3: Commit**

```bash
git add src/features/notifications/types.ts
git commit -m "feat(notifications): app-level types"
```

---

### Task 2: Резистентный рендерер (TDD)

**Files:**
- Create: `src/features/notifications/notification-content.ts`
- Test: `src/features/notifications/notification-content.test.ts`

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/notifications/notification-content.test.ts
import { describe, expect, it } from "vitest";

import { renderNotification } from "./notification-content";
import type { AppNotification } from "./types";

function make(p: Partial<AppNotification>): AppNotification {
  return {
    id: "n1", type: "", reason: "", actorId: null, targetId: null,
    targetType: null, targetVersion: null, groupCount: 1,
    readAt: null, seenAt: null, createdAt: null, ...p,
  };
}

describe("renderNotification", () => {
  it("известный тип → шаблонный текст", () => {
    expect(renderNotification(make({ type: "document.updated" })).text).toBe(
      "Документ, на который вы подписаны, обновлён",
    );
  });
  it("ссылка по target_type=document", () => {
    expect(
      renderNotification(make({ type: "document.updated", targetType: "document", targetId: "d1" })).href,
    ).toBe("/documents/d1");
  });
  it("неизвестный тип → fallback на reason", () => {
    expect(renderNotification(make({ type: "weird.new", reason: "Что-то произошло" })).text).toBe(
      "Что-то произошло",
    );
  });
  it("неизвестный тип без reason → нейтральный текст", () => {
    expect(renderNotification(make({ type: "x" })).text).toBe("Новое уведомление");
  });
  it("группировка comment.created", () => {
    expect(renderNotification(make({ type: "comment.created", groupCount: 3 })).text).toBe(
      "Новые комментарии (3)",
    );
  });
  it("неизвестный тип с группой → суффикс (N)", () => {
    expect(renderNotification(make({ type: "x", reason: "Событие", groupCount: 2 })).text).toBe(
      "Событие (2)",
    );
  });
  it("нет targetId → href null", () => {
    expect(renderNotification(make({ type: "document.updated", targetType: "document" })).href).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test src/features/notifications/notification-content.test.ts`
Expected: FAIL («renderNotification is not a function» / модуль не найден).

- [ ] **Step 3: Написать рендерер**

```ts
// src/features/notifications/notification-content.ts
// Чистый client-safe рендерер уведомлений. Без server-зависимостей.
import type { AppNotification } from "./types";

export interface RenderedNotification {
  text: string;
  /** Куда вести по клику; null — некуда (рендерим без ссылки). */
  href: string | null;
}

/** Fallback-ссылка на сущность по target_type. */
function entityHref(targetType: string | null, targetId: string | null): string | null {
  if (!targetId) return null;
  switch (targetType) {
    case "document":
      return `/documents/${targetId}`;
    case "lecture":
      return `/lectures/${targetId}`;
    case "annotation":
      return "/me/annotations"; // detail-страницы аннотации нет — ведём в список
    default:
      return null;
  }
}

/**
 * Provisional-реестр известных типов → текст.
 * TODO(backend-ask): сверить значения `type` с philosophy-api; пока значения —
 * правдоподобная заглушка, неизвестные типы деградируют через fallback ниже.
 */
const TEMPLATES: Record<string, (n: AppNotification) => string> = {
  "document.updated": () => "Документ, на который вы подписаны, обновлён",
  "comment.created": (n) =>
    n.groupCount > 1 ? `Новые комментарии (${n.groupCount})` : "Новый комментарий",
  "comment.reply": () => "Ответ на ваш комментарий",
  "annotation.created": () => "Новая аннотация",
  mention: () => "Вас упомянули",
};

export function renderNotification(n: AppNotification): RenderedNotification {
  const template = TEMPLATES[n.type];
  if (template) {
    return { text: template(n), href: entityHref(n.targetType, n.targetId) };
  }
  // fallback: текст из reason (или нейтральный) + суффикс группировки.
  const base = n.reason || "Новое уведомление";
  const text = n.groupCount > 1 ? `${base} (${n.groupCount})` : base;
  return { text, href: entityHref(n.targetType, n.targetId) };
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm test src/features/notifications/notification-content.test.ts`
Expected: PASS (7 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/notification-content.ts src/features/notifications/notification-content.test.ts
git commit -m "feat(notifications): resilient notification text renderer"
```

---

### Task 3: Permissions (TDD)

**Files:**
- Create: `src/features/notifications/permissions.ts`
- Test: `src/features/notifications/permissions.test.ts`

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/notifications/permissions.test.ts
import { describe, expect, it } from "vitest";

import type { Me } from "@/utils/me";

import { canManageSubscriptions, canUseNotifications } from "./permissions";

const active: Me = { id: "u1", username: "a", role: "user", status: "active", capabilities: [] };
const suspended: Me = { ...active, status: "suspended" };

describe("canUseNotifications", () => {
  it("гость → false", () => expect(canUseNotifications(null)).toBe(false));
  it("залогинен → true", () => expect(canUseNotifications(active)).toBe(true));
  it("suspended может читать → true", () => expect(canUseNotifications(suspended)).toBe(true));
});

describe("canManageSubscriptions", () => {
  it("гость → false", () => expect(canManageSubscriptions(null)).toBe(false));
  it("active → true", () => expect(canManageSubscriptions(active)).toBe(true));
  it("suspended → false", () => expect(canManageSubscriptions(suspended)).toBe(false));
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test src/features/notifications/permissions.test.ts`
Expected: FAIL (модуль/функции не найдены).

- [ ] **Step 3: Написать `permissions.ts`**

```ts
// src/features/notifications/permissions.ts
import "server-only";

import type { MaybeMe } from "@/utils/me";
import { isMutationAllowed } from "@/utils/permissions";

/** Чтение своих уведомлений: нужен залогиненный (active решает бек). */
export function canUseNotifications(me: MaybeMe): boolean {
  return me !== null;
}

/** Подписки и отметки прочтения: залогинен + active. */
export function canManageSubscriptions(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm test src/features/notifications/permissions.test.ts`
Expected: PASS (6 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/permissions.ts src/features/notifications/permissions.test.ts
git commit -m "feat(notifications): permission helpers"
```

---

### Task 4: Server-fetchers (`api.ts`)

**Files:**
- Create: `src/features/notifications/api.ts`

- [ ] **Step 1: Написать `api.ts`**

```ts
// src/features/notifications/api.ts
import "server-only";
import { cache } from "react";

import { createApiClient } from "@/api/client";

import type {
  AppNotification,
  DocumentSubscription,
  NotificationCounts,
  NotificationDTO,
  SubscriptionDTO,
} from "./types";

export interface NotificationListResult {
  items: AppNotification[];
  total: number;
  offset: number;
  limit: number;
}

export interface SubscriptionListResult {
  items: DocumentSubscription[];
  total: number;
  offset: number;
  limit: number;
}

function normalizeNotification(dto: NotificationDTO): AppNotification {
  return {
    id: dto.id ?? "",
    type: dto.type ?? "",
    reason: dto.reason ?? "",
    actorId: dto.actor_id ?? null,
    targetId: dto.target_id ?? null,
    targetType: dto.target_type ?? null,
    targetVersion: dto.target_version ?? null,
    groupCount: dto.group_count ?? 1,
    readAt: dto.read_at ?? null,
    seenAt: dto.seen_at ?? null,
    createdAt: dto.created_at ?? null,
  };
}

function normalizeSubscription(dto: SubscriptionDTO): DocumentSubscription {
  return {
    id: dto.id ?? "",
    targetId: dto.target_id ?? "",
    targetType: dto.target_type ?? "",
    createdAt: dto.created_at ?? null,
  };
}

/** Лента уведомлений (GET /api/me/notifications). */
export const getNotifications = cache(
  async (offset = 0, limit = 20): Promise<NotificationListResult> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/me/notifications", {
      params: { query: { offset, limit } },
    });
    if (error) throw new Error(error.error ?? "Не удалось загрузить уведомления");
    return {
      items: (data.data ?? []).map(normalizeNotification),
      total: data.pagination?.total ?? 0,
      offset: data.pagination?.offset ?? offset,
      limit: data.pagination?.limit ?? limit,
    };
  },
);

/** Счётчики (GET /api/me/notifications/counts). */
export const getNotificationCounts = cache(async (): Promise<NotificationCounts> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/me/notifications/counts", {});
  if (error) throw new Error(error.error ?? "Не удалось загрузить счётчики");
  return { unread: data.data?.unread ?? 0, unseen: data.data?.unseen ?? 0 };
});

/** Подписки текущего пользователя (GET /api/me/subscriptions). */
export const getSubscriptions = cache(
  async (offset = 0, limit = 50): Promise<SubscriptionListResult> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/me/subscriptions", {
      params: { query: { offset, limit } },
    });
    if (error) throw new Error(error.error ?? "Не удалось загрузить подписки");
    return {
      items: (data.data ?? []).map(normalizeSubscription),
      total: data.pagination?.total ?? 0,
      offset: data.pagination?.offset ?? offset,
      limit: data.pagination?.limit ?? limit,
    };
  },
);

/**
 * Подписан ли пользователь на документ. Interim: бэк не отдаёт `subscribed` в
 * detail документа — сканируем первую страницу подписок (limit 100). См.
 * backend-ask (Task 16): N+1 при большом числе подписок, деградирует мягко.
 */
export const getDocumentSubscription = cache(async (documentId: string): Promise<boolean> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/me/subscriptions", {
    params: { query: { offset: 0, limit: 100 } },
  });
  if (error) return false; // некритично: покажем «Подписаться»
  return (data.data ?? []).some(
    (s) => s.target_type === "document" && s.target_id === documentId,
  );
});
```

- [ ] **Step 2: Проверить типы**

Run: `pnpm typecheck`
Expected: PASS. (Если openapi-fetch ругается на `{}` во втором аргументе counts — это валидно для эндпоинта без параметров; при ошибке убрать `{}` и вызвать `api.GET("/api/me/notifications/counts")`.)

- [ ] **Step 3: Commit**

```bash
git add src/features/notifications/api.ts
git commit -m "feat(notifications): server fetchers (feed, counts, subscriptions)"
```

---

### Task 5: Server actions (`actions.ts`)

**Files:**
- Create: `src/features/notifications/actions.ts`

- [ ] **Step 1: Написать `actions.ts`**

```ts
// src/features/notifications/actions.ts
"use server";
import "server-only";

import { createApiClient } from "@/api/client";
import { rethrowApiError, type ApiError } from "@/utils/api-error";
import { createAction } from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireActive } from "@/utils/permissions";

import {
  getNotifications,
  getNotificationCounts,
  type NotificationListResult,
} from "./api";
import { canUseNotifications } from "./permissions";
import type { NotificationCounts } from "./types";

// --- Мутации (залогинен + active) ---

export const markRead = createAction(async (id: string) => {
  const me = await getMe();
  requireActive(me);
  const api = await createApiClient();
  const { error } = await api.POST("/api/me/notifications/{id}/read", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error as ApiError);
  return undefined;
});

// ВАЖНО: для action'ов БЕЗ входа указываем дженерики `<void, TOutput>` явно.
// Без них `createAction(async () => …)` выводит `TInput = unknown`, и
// возвращаемая функция требует обязательный аргумент → `markAllSeen()` /
// `fetchCounts()` и передача в `run` (ждёт `() => …`) НЕ компилируются
// («Expected 1-2 arguments, but got 0»). `TInput = void` делает параметр
// опускаемым (правило void-параметров TS) и совместимым с `() => …`.
export const markAllRead = createAction<void, void>(async () => {
  const me = await getMe();
  requireActive(me);
  const api = await createApiClient();
  const { error } = await api.POST("/api/me/notifications/read-all", {});
  if (error) rethrowApiError(error as ApiError);
  return undefined;
});

export const markAllSeen = createAction<void, void>(async () => {
  const me = await getMe();
  requireActive(me);
  const api = await createApiClient();
  const { error } = await api.POST("/api/me/notifications/seen-all", {});
  if (error) rethrowApiError(error as ApiError);
  return undefined;
});

export const subscribeDocument = createAction(async (documentId: string) => {
  const me = await getMe();
  requireActive(me);
  const api = await createApiClient();
  const { error } = await api.POST("/api/documents/{id}/subscribe", {
    params: { path: { id: documentId } },
  });
  if (error) rethrowApiError(error as ApiError);
  return undefined;
});

export const unsubscribeDocument = createAction(async (documentId: string) => {
  const me = await getMe();
  requireActive(me);
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/documents/{id}/subscribe", {
    params: { path: { id: documentId } },
  });
  if (error) rethrowApiError(error as ApiError);
  return undefined;
});

// --- Read-actions для клиентских островков (нужен залогиненный) ---

export const fetchCounts = createAction<void, NotificationCounts>(async () => {
  const me = await getMe();
  if (!canUseNotifications(me)) throw new ForbiddenError("guest");
  return getNotificationCounts();
});

export const fetchNotifications = createAction(
  async (input: { offset: number; limit: number }): Promise<NotificationListResult> => {
    const me = await getMe();
    if (!canUseNotifications(me)) throw new ForbiddenError("guest");
    return getNotifications(input.offset, input.limit);
  },
);
```

- [ ] **Step 2: Проверить типы**

Run: `pnpm typecheck`
Expected: PASS. (Дженерики `<void, …>` у `markAllRead`/`markAllSeen`/`fetchCounts` обязательны — без них zero-arg вызовы не компилируются, см. комментарий в коде. Эндпоинты read-all/seen-all имеют `requestBody?: never` — пустой `{}` валиден.)

- [ ] **Step 3: Commit**

```bash
git add src/features/notifications/actions.ts
git commit -m "feat(notifications): server actions (mark read/seen, subscribe, read-actions)"
```

---

### Task 6: Публичные входы слайса (`index.ts`, `client.ts`)

**Files:**
- Create: `src/features/notifications/index.ts`
- Create: `src/features/notifications/client.ts`

> UI-компоненты ниже ещё не созданы — этот index ссылается на них вперёд. Создаём UI в фазах 2-3; чтобы `index.ts` компилировался сейчас, **временно** закомментируй UI-экспорты и раскомментируй их в Task 9/12/13/14. (Альтернатива: выполнить Task 6 после Task 14 — тогда раскомментировать всё сразу. План оставляет выбор исполнителю; ниже — финальный вид.)

- [ ] **Step 1: Написать `index.ts` (финальный вид; UI-строки раскомментировать по мере создания)**

```ts
// src/features/notifications/index.ts
// Public API слайса notifications.
export {
  getNotifications,
  getNotificationCounts,
  getSubscriptions,
  getDocumentSubscription,
} from "./api";
export {
  markRead,
  markAllRead,
  markAllSeen,
  subscribeDocument,
  unsubscribeDocument,
  fetchCounts,
  fetchNotifications,
} from "./actions";
export { canUseNotifications, canManageSubscriptions } from "./permissions";

// UI (создаются в фазах 2-3):
export { NotificationBell } from "./ui/notification-bell";
export { NotificationItem } from "./ui/notification-item";
export { NotificationListActions } from "./ui/notification-list-actions";
export { DocumentSubscribeButton } from "./ui/document-subscribe-button";
export { SubscriptionsSection } from "./ui/subscriptions-section";

export type {
  AppNotification,
  NotificationCounts,
  DocumentSubscription,
} from "./types";
```

- [ ] **Step 2: Написать `client.ts`**

```ts
// src/features/notifications/client.ts
// Client-safe entry: чистый рендерер + типы. НЕ реэкспортит api/actions/permissions.
export { renderNotification, type RenderedNotification } from "./notification-content";
export type {
  AppNotification,
  NotificationCounts,
  DocumentSubscription,
} from "./types";
```

- [ ] **Step 3: Зафиксировать фазу 1 — полный гейт**

Run: `pnpm lint && pnpm test && pnpm typecheck`
Expected: PASS (UI-экспорты в index.ts закомментированы, пока UI не создан — иначе `pnpm build` упадёт на отсутствующих модулях). Если выполняешь Task 6 последним — добавь сюда `pnpm build`.

- [ ] **Step 4: Commit**

```bash
git add src/features/notifications/index.ts src/features/notifications/client.ts
git commit -m "feat(notifications): public + client-safe slice entries"
```

---

# Фаза 2 — Инбокс (колокольчик + поповер + страница)

### Task 7: Иконка колокольчика

**Files:**
- Create: `src/features/notifications/ui/bell-icon.tsx`

- [ ] **Step 1: Написать `bell-icon.tsx`**

```tsx
// src/features/notifications/ui/bell-icon.tsx
interface BellIconProps {
  className?: string;
}

export function BellIcon({ className }: BellIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/notifications/ui/bell-icon.tsx
git commit -m "feat(notifications): bell icon"
```

---

### Task 8: Элемент уведомления

**Files:**
- Create: `src/features/notifications/ui/notification-item.tsx`

- [ ] **Step 1: Написать `notification-item.tsx`**

```tsx
"use client";
// src/features/notifications/ui/notification-item.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";

import { markRead } from "../actions";
import { renderNotification } from "../notification-content";
import type { AppNotification } from "../types";

interface NotificationItemProps {
  notification: AppNotification;
  /** Вызывается перед переходом (напр. закрыть поповер). */
  onNavigate?: () => void;
}

export function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  const router = useRouter();
  const [read, setRead] = useState(notification.readAt !== null);
  const { text, href } = renderNotification(notification);

  async function handleClick() {
    if (!read) {
      setRead(true); // оптимистично
      void markRead(notification.id); // ошибку игнорируем — некритично
    }
    onNavigate?.();
    if (href) router.push(href);
  }

  return (
    <button
      type="button"
      onClick={() => {
        void handleClick();
      }}
      className={`flex w-full items-start gap-2 rounded px-3 py-2 text-left text-sm hover:bg-(--color-text-pane) ${
        read ? "text-(--color-description)" : "font-medium"
      }`}
    >
      {!read && (
        <span
          className="mt-1.5 size-2 shrink-0 rounded-full bg-(--color-primary)"
          aria-hidden="true"
        />
      )}
      <span>{text}</span>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/notifications/ui/notification-item.tsx
git commit -m "feat(notifications): notification item (read-on-click)"
```

---

### Task 9: Поповер ленты

**Files:**
- Create: `src/features/notifications/ui/notification-popover.tsx`

- [ ] **Step 1: Написать `notification-popover.tsx`**

```tsx
"use client";
// src/features/notifications/ui/notification-popover.tsx
import { useEffect, useState } from "react";

import { RouterLink } from "@/components/ui";

import { fetchNotifications, markAllSeen } from "../actions";
import type { AppNotification } from "../types";
import { NotificationItem } from "./notification-item";

interface NotificationPopoverProps {
  onClose: () => void;
  /** Вызывается после успешного markAllSeen — родитель гасит бейдж. */
  onSeen: () => void;
}

export function NotificationPopover({ onClose, onSeen }: NotificationPopoverProps) {
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await fetchNotifications({ offset: 0, limit: 10 });
      if (cancelled) return;
      if (!result.success) {
        setError(true);
        return;
      }
      setItems(result.data.items);
      // Гасим бейдж: помечаем всё просмотренным при открытии.
      void markAllSeen().then(() => {
        if (!cancelled) onSeen();
      });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [onSeen]);

  return (
    <div className="absolute right-0 top-full z-50 mt-2 flex w-80 max-w-[90vw] flex-col rounded border border-(--color-border) bg-(--color-background) shadow-lg">
      <div className="flex items-center justify-between border-b border-(--color-border) px-3 py-2">
        <span className="text-sm font-semibold">Уведомления</span>
        <RouterLink
          href="/notifications"
          className="text-xs text-(--color-link)"
          onClick={onClose}
        >
          Все
        </RouterLink>
      </div>
      <div className="flex max-h-96 flex-col overflow-y-auto p-1">
        {items === null && !error && (
          <p className="px-3 py-4 text-sm text-(--color-description)">Загрузка…</p>
        )}
        {error && (
          <p className="px-3 py-4 text-sm text-(--color-description)">
            Не удалось загрузить уведомления.
          </p>
        )}
        {items !== null && items.length === 0 && (
          <p className="px-3 py-4 text-sm text-(--color-description)">
            Пока нет уведомлений.
          </p>
        )}
        {items?.map((n) => (
          <NotificationItem key={n.id} notification={n} onNavigate={onClose} />
        ))}
      </div>
    </div>
  );
}
```

> **Важно:** `onSeen` стоит в зависимостях эффекта — родитель (Task 10) обязан передавать его через `useCallback` со стабильной идентичностью, иначе эффект зациклится (повторная загрузка + seen-all).

- [ ] **Step 2: Commit**

```bash
git add src/features/notifications/ui/notification-popover.tsx
git commit -m "feat(notifications): feed popover (load + mark-all-seen on open)"
```

---

### Task 10: Колокольчик (островок хедера)

**Files:**
- Create: `src/features/notifications/ui/notification-bell.tsx`

- [ ] **Step 1: Написать `notification-bell.tsx`**

```tsx
"use client";
// src/features/notifications/ui/notification-bell.tsx
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchCounts } from "../actions";
import type { NotificationCounts } from "../types";
import { BellIcon } from "./bell-icon";
import { NotificationPopover } from "./notification-popover";

/** Интервал опроса счётчиков (мс). <60с → кэш Anthropic не при чём; это сетевой poll. */
const POLL_MS = 50_000;

interface NotificationBellProps {
  initialCounts: NotificationCounts;
}

export function NotificationBell({ initialCounts }: NotificationBellProps) {
  const [counts, setCounts] = useState(initialCounts);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  /** Момент последнего локального «всё просмотрено» — против гонки с poll'ом. */
  const lastSeenRef = useRef(0);

  // Polling счётчиков + рефреш при возврате фокуса/вкладки.
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const startedAt = Date.now();
      const result = await fetchCounts();
      if (cancelled || !result.success) return;
      setCounts((prev) => ({
        unread: result.data.unread,
        // Если пользователь погасил бейдж (markAllSeen) ПОКА летел этот запрос —
        // не поднимаем unseen обратно устаревшим ответом (бэк ещё не применил seen).
        unseen: lastSeenRef.current > startedAt ? prev.unseen : result.data.unseen,
      }));
    }
    const interval = setInterval(() => {
      void refresh();
    }, POLL_MS);
    function onVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Закрытие dropdown по клику вне и Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSeen = useCallback(() => {
    lastSeenRef.current = Date.now();
    setCounts((c) => ({ ...c, unseen: 0 }));
  }, []);

  const badge =
    counts.unseen > 0 ? (counts.unseen > 99 ? "99+" : String(counts.unseen)) : null;

  return (
    <div ref={rootRef} className="relative flex items-center">
      <button
        type="button"
        aria-label="Уведомления"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-8 items-center justify-center text-(--color-description) hover:text-(--color-primary)"
      >
        <BellIcon className="size-5" />
        {badge && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-(--color-primary) px-1 text-[10px] leading-4 text-(--color-background)">
            {badge}
          </span>
        )}
      </button>
      {open && (
        <NotificationPopover onClose={() => setOpen(false)} onSeen={handleSeen} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/notifications/ui/notification-bell.tsx
git commit -m "feat(notifications): header bell island (badge + polling + dropdown)"
```

---

### Task 11: Монтаж колокольчика в хедер (foundation-touch)

**Files:**
- Modify: `src/components/app/app-header/app-header.tsx`

> Заморожённая зона — изменение минимальное: импорт + один fetch + один монтаж.

**Trade-off (осознанный):** `getNotificationCounts()` добавляет один сетевой запрос в SSR-путь хедера для залогиненного на КАЖДОЙ странице (`React.cache` дедуплит в рамках запроса). Выбрано ради корректного бейджа без мерцания на первом пейнте — согласуется с SSR-first паттерном хедера (он уже `await getMe()`). `.catch` деградирует к `{0,0}` при ошибке. Эндпоинт counts дешёвый; если профилирование покажет проблему — альтернатива убрать SSR-инициализацию и положиться на первый клиентский `fetchCounts` (потребует немедленного refresh на mount в bell).

- [ ] **Step 1: Добавить импорт**

В блок импортов (после строки с `@/features/search`) добавить:

```tsx
import { NotificationBell, getNotificationCounts } from "@/features/notifications";
```

- [ ] **Step 2: Получить счётчики в компоненте**

Сразу после `const me = await getMe();` добавить:

```tsx
  const counts = me
    ? await getNotificationCounts().catch(() => ({ unread: 0, unseen: 0 }))
    : null;
```

- [ ] **Step 3: Смонтировать колокольчик**

Внутри ветки `{me ? (` первым элементом фрагмента (перед `<RouterLink href="/documents/my" …>`):

```tsx
                <NotificationBell initialCounts={counts ?? { unread: 0, unseen: 0 }} />
```

- [ ] **Step 4: Проверить сборку**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/app-header/app-header.tsx
git commit -m "feat(notifications): mount bell in app header"
```

---

### Task 12: Страница `/notifications` + бар действий

**Files:**
- Create: `src/features/notifications/ui/notification-list-actions.tsx`
- Create: `src/app/notifications/page.tsx`

- [ ] **Step 1: Написать `notification-list-actions.tsx`**

```tsx
"use client";
// src/features/notifications/ui/notification-list-actions.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, useToast } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";

import { markAllRead, markAllSeen } from "../actions";

export function NotificationListActions() {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<ActionResult<void>>, okMsg: string) {
    setPending(true);
    try {
      const result = await action();
      if (!result.success) {
        toast.add({
          title: "Ошибка",
          description: result.code === "forbidden" ? "У вас нет прав." : result.error,
        });
        return;
      }
      toast.add({ title: okMsg });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => {
          void run(markAllRead, "Все отмечены прочитанными");
        }}
      >
        Прочитать все
      </Button>
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() => {
          void run(markAllSeen, "Отмечены просмотренными");
        }}
      >
        Просмотреть все
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Написать страницу `src/app/notifications/page.tsx`**

```tsx
// src/app/notifications/page.tsx
import { redirect } from "next/navigation";

import { Pagination } from "@/components/ui";
import {
  getNotifications,
  NotificationItem,
  NotificationListActions,
} from "@/features/notifications";
import { getMe } from "@/utils/me";

export const metadata = { title: "Уведомления" };

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function NotificationsPage({ searchParams }: Props) {
  const me = await getMe();
  if (!me) redirect("/login?next=/notifications");

  const { offset: offsetParam } = await searchParams;
  const limit = 20;
  const offset = Math.max(0, Number.parseInt(offsetParam ?? "0", 10) || 0);
  const { items, total } = await getNotifications(offset, limit);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Уведомления</h1>
        <NotificationListActions />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-(--color-description)">Пока нет уведомлений.</p>
      ) : (
        <div className="flex flex-col divide-y divide-(--color-border)">
          {items.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </div>
      )}

      <Pagination basePath="/notifications" offset={offset} limit={limit} total={total} />
    </div>
  );
}
```

- [ ] **Step 3: Зафиксировать фазу 2 — полный гейт**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS. (`pnpm build` теперь проходит — все UI-экспорты в index.ts существуют.)

- [ ] **Step 4: Commit**

```bash
git add src/features/notifications/ui/notification-list-actions.tsx src/app/notifications/page.tsx
git commit -m "feat(notifications): /notifications page + mark-all bar"
```

---

# Фаза 3 — Подписки на документы

### Task 13: Кнопка подписки + монтаж на странице документа

**Files:**
- Create: `src/features/notifications/ui/document-subscribe-button.tsx`
- Modify: `src/app/documents/[id]/page.tsx`

- [ ] **Step 1: Написать `document-subscribe-button.tsx`**

```tsx
"use client";
// src/features/notifications/ui/document-subscribe-button.tsx
import { useState } from "react";

import { Button, useToast } from "@/components/ui";

import { subscribeDocument, unsubscribeDocument } from "../actions";

interface DocumentSubscribeButtonProps {
  documentId: string;
  initialSubscribed: boolean;
}

export function DocumentSubscribeButton({
  documentId,
  initialSubscribed,
}: DocumentSubscribeButtonProps) {
  const toast = useToast();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !subscribed;
    setPending(true);
    setSubscribed(next); // оптимистично
    try {
      const result = next
        ? await subscribeDocument(documentId)
        : await unsubscribeDocument(documentId);
      if (!result.success) {
        setSubscribed(!next); // откат
        toast.add({
          title: "Ошибка",
          description:
            result.code === "forbidden"
              ? "У вас нет прав на подписку."
              : result.error,
        });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant={subscribed ? "secondary" : undefined}
      disabled={pending}
      onClick={() => {
        void toggle();
      }}
    >
      {subscribed ? "Отписаться" : "Подписаться"}
    </Button>
  );
}
```

- [ ] **Step 2: Смонтировать на странице документа**

В `src/app/documents/[id]/page.tsx`:

(a) Добавить в импорт из `@/features/notifications` (новый импорт-блок рядом с другими фичами):

```tsx
import {
  DocumentSubscribeButton,
  getDocumentSubscription,
} from "@/features/notifications";
```

(b) Заменить существующее вычисление `shareLinks` (page.tsx, строки ~44-48: `const canShare = …` + `const shareLinks = canShare && document.id ? await getShareLinksFor(…) : [];`) на параллельную загрузку — `getShareLinksFor` и `getDocumentSubscription` независимы, последовательный `await` даёт лишний водопад:

```tsx
  const canShare = canCreateShareLink(me, document);
  const [shareLinks, subscribed] = await Promise.all([
    canShare && document.id
      ? getShareLinksFor("document", document.id)
      : Promise.resolve([]),
    me && document.id ? getDocumentSubscription(document.id) : Promise.resolve(false),
  ]);
```

(c) В `<div className="flex items-center gap-2">` (шапка, после `DocumentExportLinks`) добавить:

```tsx
          {me && document.id && (
            <DocumentSubscribeButton
              documentId={document.id}
              initialSubscribed={subscribed}
            />
          )}
```

- [ ] **Step 3: Проверить сборку**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/notifications/ui/document-subscribe-button.tsx src/app/documents/[id]/page.tsx
git commit -m "feat(notifications): document subscribe button"
```

---

### Task 14: Секция «Мои подписки» + монтаж в /settings

**Files:**
- Create: `src/features/notifications/ui/subscription-row.tsx`
- Create: `src/features/notifications/ui/subscriptions-section.tsx`
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Написать `subscription-row.tsx` (client)**

```tsx
"use client";
// src/features/notifications/ui/subscription-row.tsx
import { useState } from "react";

import { Button, RouterLink, useToast } from "@/components/ui";

import { unsubscribeDocument } from "../actions";
import type { DocumentSubscription } from "../types";

interface SubscriptionRowProps {
  subscription: DocumentSubscription;
}

export function SubscriptionRow({ subscription }: SubscriptionRowProps) {
  const toast = useToast();
  const [removed, setRemoved] = useState(false);
  const [pending, setPending] = useState(false);

  if (removed) return null;

  async function unsubscribe() {
    setPending(true);
    try {
      const result = await unsubscribeDocument(subscription.targetId);
      if (!result.success) {
        toast.add({
          title: "Ошибка",
          description: result.code === "forbidden" ? "У вас нет прав." : result.error,
        });
        return;
      }
      setRemoved(true);
    } finally {
      setPending(false);
    }
  }

  // Бэк отдаёт только target_id (без названия) — показываем ссылку с префиксом id.
  // TODO(backend-ask): добавить название цели в подписку (Task 16).
  const label = `Документ ${subscription.targetId.slice(0, 8)}`;

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      {subscription.targetType === "document" ? (
        <RouterLink
          href={`/documents/${subscription.targetId}`}
          className="text-sm text-(--color-link)"
        >
          {label}
        </RouterLink>
      ) : (
        <span className="text-sm">
          {subscription.targetType} {subscription.targetId.slice(0, 8)}
        </span>
      )}
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => {
          void unsubscribe();
        }}
      >
        Отписаться
      </Button>
    </li>
  );
}
```

- [ ] **Step 2: Написать `subscriptions-section.tsx` (server)**

```tsx
// src/features/notifications/ui/subscriptions-section.tsx
import { getSubscriptions } from "../api";
import { SubscriptionRow } from "./subscription-row";

export async function SubscriptionsSection() {
  const { items } = await getSubscriptions();

  if (items.length === 0) {
    return (
      <p className="text-sm text-(--color-description)">У вас нет активных подписок.</p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-(--color-border)">
      {items.map((s) => (
        <SubscriptionRow key={s.id} subscription={s} />
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Смонтировать в `src/app/settings/page.tsx`**

(a) Добавить импорт:

```tsx
import { SubscriptionsSection } from "@/features/notifications";
```

(b) После секции «Push-уведомления» (`</section>`) добавить новую секцию:

```tsx
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Подписки на документы</h2>
        <SubscriptionsSection />
      </section>
```

- [ ] **Step 4: Зафиксировать фазу 3 — полный гейт**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/ui/subscription-row.tsx src/features/notifications/ui/subscriptions-section.tsx src/app/settings/page.tsx
git commit -m "feat(notifications): my-subscriptions section in settings"
```

---

### Task 15: Финальная сверка слайса

**Files:** (нет изменений кода — проверка)

- [ ] **Step 1: Прогнать полный набор гейтов**

Run: `pnpm lint && pnpm test && pnpm typecheck && pnpm build`
Expected: всё PASS.

- [ ] **Step 2: Ручная проверка чеклиста `_template/README.md`**

Сверить: нет cross-feature импортов; client-код не импортит `index.ts` слайса; `react-dom/client` нет в server-only файлах; новые токены/зависимости не добавлены.

---

### Task 16: Backend-ask по подпискам

**Files:**
- Create: `docs/superpowers/specs/2026-06-16-document-subscriptions-backend-ask.md`

- [ ] **Step 1: Написать backend-ask (в стиле существующих ask-ов проекта)**

```markdown
# Backend-ask: дешёвое состояние подписки + название цели

**Дата:** 2026-06-16
**Кому:** philosophy-api (Go)
**Зачем фронту:** убрать N+1-скан `/api/me/subscriptions` ради двух вещей.

## Проблема

1. **Состояние кнопки «Подписаться» на странице документа.** Сейчас FE на каждый
   просмотр документа (залогиненным) сканирует первую страницу `/api/me/subscriptions`
   (limit 100), чтобы узнать, подписан ли пользователь. Ложный негатив при >100 подписок.
2. **Список «Мои подписки» в /settings показывает только `target_id`** (без названия) —
   рендерим «Документ {id8}». Чтобы показать имя, пришлось бы догружать каждый документ.

## Просьбы (минимальные рычаги)

- **(1)** Флаг `subscribed: bool` в detail-ответе `GET /api/documents/{id}` (для залогиненного).
  Тогда кнопка берёт состояние из уже загруженного документа — ноль доп. запросов.
  *Альтернатива:* дешёвый `HEAD /api/documents/{id}/subscribe` → 200/404.
- **(2)** Поле `target_title` (или вложенный минимальный объект цели) в
  `notification.Subscription` — чтобы список подписок показывал человекочитаемое имя.

## Приоритет

Низкий. Текущий interim деградирует мягко (кнопка/список работают, точность/UX чуть хуже).
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-16-document-subscriptions-backend-ask.md
git commit -m "docs(notifications): backend-ask — subscribed flag + subscription target title"
```

---

## Self-Review (выполнено автором плана)

**1. Покрытие спеки:**
- §1 границы (push вне скоупа) → учтено; слайс `notifications`. ✓
- §2 решения (polling/popover+page/generic/settings) → Task 10/12/2/14. ✓
- §2 семантика счётчиков (badge=unseen, seen-on-open) → Task 9/10. ✓
- §3 структура слайса → Task 1-6 + UI. ✓ (теги/`unstable_cache` сознательно опущены — см. «Важные решения».)
- §3.4 резистентный рендерер → Task 2 (+тесты). ✓
- §4 потоки данных (bell/popover/page/subscribe) → Task 7-14. ✓
- §5 RBAC → Task 3/5. ✓
- §6 foundation-touch (header/document/settings) → Task 11/13/14. ✓
- §6 backend-ask → Task 16. ✓
- §7 тесты (permissions + renderer) → Task 2/3. ✓

**2. Плейсхолдеры:** TODO в коде — только провизорные значения, явно помеченные и закрытые backend-ask (Task 16). Шагов без кода нет. ✓

**3. Консистентность типов:** `AppNotification`/`NotificationCounts`/`DocumentSubscription` (Task 1) единообразно используются в api/actions/UI; `fetchNotifications({offset,limit})` совпадает в actions (Task 5) и popover (Task 9); `ActionResult<void>` (Task 12) соответствует `createAction` (мутации возвращают `undefined`). ✓

**4. Известные риски исполнителю:**
- Base UI Popover не используется (намеренно) — dropdown самодостаточный.
- `onSeen` через `useCallback` (Task 10) — иначе эффект поповера зациклится.
- openapi-fetch no-body POST: `{}` — при ошибке типов см. примечания в Task 4/5.
- `index.ts` ссылается на UI вперёд — порядок Task 6 vs Task 9/12/13/14 описан в Task 6.

---

## Правки по ревью агентов (4 параллельных ревьюера)

Применено после аудита плана (конвенции/RBAC, контракт схемы, рантайм-баги, регрессии/симметрия):

1. **[было High] zero-arg `createAction` не компилировался.** `markAllRead`/`markAllSeen`/`fetchCounts` получили явные дженерики `createAction<void, …>` (Task 5) + комментарий-объяснение. Чинит и заявленный «typecheck PASS», и mismatch `ActionResult<void>` в `run` (Task 12).
2. **[было Medium] гонка polling vs локальный `unseen:0`** (Task 10): добавлен `lastSeenRef` (timestamp) — устаревший ответ poll'а не поднимает бейдж обратно после `markAllSeen`.
3. **[было Medium] водопад на странице документа** (Task 13): `getShareLinksFor` + `getDocumentSubscription` объединены в `Promise.all` (минус один RTT).
4. **Инварианты зафиксированы** (раздел «Важные решения» #5/#6): идемпотентность `seen-all`/`read-all` (поповер re-marks на каждом открытии + StrictMode); принцип «фоновые мутации — тихо, явные действия — тост».
5. **Trade-off SSR-await** в хедере (Task 11) задокументирован как осознанный выбор + альтернатива.

**Подтверждено корректным (правок не потребовало):** пути/path-параметры схемы (включая `id` ≠ `document_id` — не перепутано), поля DTO нормализаторов, `httputil.ListResponse.pagination`, RBAC-гейты и асимметрия read/mutation, ESLint-guardrails (cross-feature/deep-import/client.ts/server-only), сигнатуры `Button`/`Pagination`/`RouterLink`/`useToast`/`createAction`/`requireActive`/`rethrowApiError`, сериализация через RSC-границу, server/client-границы компонентов, no-body POST `{}`, оптимистичный toggle, разбор `offset` из searchParams.
