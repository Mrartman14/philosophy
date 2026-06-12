# users-admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Админ-страница `/admin/users`: список пользователей (id, username, role, status, created_at) с пагинацией, смена роли и статуса через селекты, confirm-диалог для бана, понятные русские тексты для 409-гардов бекенда («не себя», «не последнего активного админа»).

**Architecture:** Стандартный слайс `src/features/users/` по шаблону `_template`: server fetcher `getUsers` (React.cache), server actions `setUserRole`/`setUserStatus` (createAction + requireCapability + Zod), маппинг ошибок бекенда в отдельном тестируемом модуле `errors.ts`. UI — server-component таблица + два маленьких client-контрола (Select + «Применить»), confirm только для перехода в `banned`. Страница `src/app/admin/users/page.tsx` с Layer-3 гейтом `getMe()` + `canListUsers` + `forbidden()`.

**Tech Stack:** Next.js 16 (server components + server actions), openapi-fetch (`createApiClient`), Zod v4, Base UI через `@/components/ui` (Select, ConfirmDialog, Table, Pagination, toast), Vitest.

---

## Проверенные факты бекенда (источник истины)

Сверено с репозиторием `/Users/alexander.borisenko/Documents/philosophy-api`:

| Факт | Где проверено |
| --- | --- |
| Capability `user.list` (список) и `user.moderate` (PUT role/status), обе только у роли `admin` | `internal/rbac/capabilities.go:26-27`, `roleCapabilities` |
| `GET /api/admin/users` гейтится `user.list`; `PUT …/{id}/role` и `PUT …/{id}/status` — `user.moderate` | `cmd/server/main.go:1173-1175` |
| 409-гарды возвращают код **`"CONFLICT"`** (один на все), различать по `error`-тексту | `internal/apperror/apperror.go` (`Conflict()`) |
| Текст: `cannot modify your own status` | `internal/user/service.go:138` |
| Текст: `cannot remove the last active admin` (status-гард) | `internal/user/service.go:153` |
| Текст: `cannot modify your own role` | `internal/user/service.go:189` |
| Текст: `cannot demote the last active admin` (role-гард) | `internal/user/service.go:202` |
| Повтор того же значения role/status — идемпотентный 200 без записи | `internal/user/service.go:142,191` |
| 403 от middleware/сервиса — код `"FORBIDDEN"`; banned-аккаунт — `"BANNED"` | `internal/middleware/auth.go:58,154`, `apperror.go` |
| 404 — код `"NOT_FOUND"`, `"user not found"` | `internal/user/service.go` (`GetByID`) |
| Body: `{role: "user"\|"admin"}` / `{status: "active"\|"suspended"\|"banned"}` (`oneof`-валидация) | `internal/user/request.go` |
| `user.User`: `id, username, role, status, created_at, updated_at` | `src/api/schema.ts:12731-12738` |
| Список: query `offset`/`limit`, ответ `{data: user.User[], pagination: {limit, offset, total}}` | `src/api/schema.ts:2981-3040` |

**Sidebar уже готов:** `src/app/admin/layout.tsx:41` гейтит пункт «Пользователи» на `can(me, "user.list")` — имя совпадает с бекендом. Union `Capability` в `src/utils/permissions.ts` уже содержит `"user.list"` и `"user.moderate"`. **Foundation-touch НЕ нужен** (Task 14 — read-only верификация).

---

## Parallel-safety contract

Этот план выполняется в собственном worktree параллельно с другими фичами волны 1 (`tags`, `events`, `banners`, `audit`, `auth-register`, `glossary-enrichment`, `preferences-push`, `ast-editor-phase-2`).

**Создаёт (только новые файлы — collision невозможен):**

- `src/features/users/index.ts`
- `src/features/users/api.ts`
- `src/features/users/actions.ts`
- `src/features/users/permissions.ts`
- `src/features/users/permissions.test.ts`
- `src/features/users/schemas.ts`
- `src/features/users/schemas.test.ts`
- `src/features/users/errors.ts`
- `src/features/users/errors.test.ts`
- `src/features/users/types.ts`
- `src/features/users/ui/users-table.tsx`
- `src/features/users/ui/user-role-control.tsx`
- `src/features/users/ui/user-status-control.tsx`
- `src/app/admin/users/page.tsx`

**Модифицирует (единственный shared-файл, особый режим):**

- `src/api/tags.ts` — **append-only**: одна строка `USERS: "users",` в конец объекта `Tags`. При merge-конфликте с другими ветками волны — оставить обе строки, новые ключи отсортировать по алфавиту. Других правок в файле не делать.

**НЕ трогает (резерв других фич / запретные зоны):**

- `src/app/admin/layout.tsx`, `src/app/admin/admin-sidebar.tsx` — пункт users уже capability-gated, касание не нужно.
- `src/utils/*` (в т.ч. `permissions.ts` — union уже содержит нужные capability), `src/hooks/*`, `src/services/*`.
- `src/api/schema.ts`, `src/api/client.ts`.
- `src/app/layout.tsx`, `src/app/globals.css`, `src/components/ui/*`, `src/components/{shared, app, permission}`.
- `package.json`, `package-lock.json`, `eslint.config.mjs`, `vitest.config.ts`.
- `public/sw.js` — там чужой незакоммиченный diff, не прикасаться.
- Файлы других слайсов: `src/features/{auth, glossary, lectures}/`, будущие `src/features/{tags, events, banners, audit}/`, `src/components/{ast-editor, ast-render, markdown-editor, revision-history}/` и их app-страницы.

**Правила параллельной работы (CLAUDE.md, передавать дословно всем субагентам):**

- НЕ делать `git stash`, `git reset`, `git checkout .`, `git clean` и прочие деструктивные git-операции.
- НЕ откатывать и не перезаписывать изменения, сделанные другими агентами.
- НЕ делать `git add -A` / `git add .` — добавлять только свои файлы по имени.
- Передавать это требование всем создаваемым субагентам.

---

## Файловая структура (создаётся этим планом)

```
src/features/users/
├── index.ts                      # public API слайса
├── api.ts                        # getUsers (React.cache)
├── actions.ts                    # setUserRole, setUserStatus ("use server")
├── permissions.ts                # canListUsers, canModerateUsers
├── permissions.test.ts
├── schemas.ts                    # UserRoleUpdateSchema, UserStatusUpdateSchema
├── schemas.test.ts
├── errors.ts                     # rethrowUserApiError: 409/403/404 → русские тексты
├── errors.test.ts
├── types.ts                      # AdminUser, UserRole, UserStatus из @/api/schema
└── ui/
    ├── users-table.tsx           # server component: таблица
    ├── user-role-control.tsx     # client: Select роли + «Применить»
    └── user-status-control.tsx   # client: Select статуса + confirm для ban

src/app/admin/users/
└── page.tsx                      # Layer-3 гейт + список + Pagination

src/api/tags.ts                   # MODIFIED: + USERS: "users"
```

---

## Task 1: Скаффолд слайса из шаблона

**Files:**
- Create: `src/features/users/*` (копия `src/features/_template/`)

- [x] **Step 1: Скопировать шаблон и убрать служебные файлы**

```bash
cp -R src/features/_template src/features/users
rm src/features/users/README.md
rm src/features/users/ui/.gitkeep
```

(`README.md` — чеклист, остаётся жить в `_template`; `.gitkeep` не нужен — реальные ui-файлы появятся в Tasks 9–11.)

- [x] **Step 2: Прогнать тесты слайса (placeholder-тесты шаблона должны пройти)**

Run: `npx vitest run src/features/users`
Expected: PASS — 2 файла (`permissions.test.ts`, `schemas.test.ts`), placeholder-тесты зелёные.

- [x] **Step 3: Commit**

```bash
git add src/features/users/index.ts src/features/users/api.ts src/features/users/actions.ts src/features/users/permissions.ts src/features/users/permissions.test.ts src/features/users/schemas.ts src/features/users/schemas.test.ts src/features/users/types.ts
git commit -m "chore(users): scaffold users slice from _template"
```

---

## Task 2: types.ts — сужения из schema.ts

**Files:**
- Modify: `src/features/users/types.ts` (полная замена содержимого)

- [x] **Step 1: Написать типы**

```ts
// src/features/users/types.ts
import type { components } from "@/api/schema";

/** Пользователь в админ-списке: id, username, role, status, created_at, updated_at. */
export type AdminUser = components["schemas"]["user.User"];

/** "user" | "admin" */
export type UserRole = components["schemas"]["rbac.Role"];

/** "active" | "suspended" | "banned" */
export type UserStatus = components["schemas"]["rbac.Status"];
```

- [x] **Step 2: Commit**

```bash
git add src/features/users/types.ts
git commit -m "feat(users): add AdminUser/UserRole/UserStatus types"
```

---

## Task 3: Реестр кеш-тегов — Tags.USERS

**Files:**
- Modify: `src/api/tags.ts` (append-only, см. Parallel-safety contract)

- [x] **Step 1: Добавить ключ USERS в конец объекта Tags**

Файл сейчас заканчивается так:

```ts
export const Tags = {
  LECTURES: "lectures",
  GLOSSARY: "glossary",
} as const;
```

Должно стать:

```ts
export const Tags = {
  LECTURES: "lectures",
  GLOSSARY: "glossary",
  USERS: "users",
} as const;
```

Ничего больше в файле не менять (append-only; при merge-конфликте — оставить обе добавленные строки, новые ключи по алфавиту).

- [x] **Step 2: Commit**

```bash
git add src/api/tags.ts
git commit -m "feat(users): register USERS cache tag"
```

---

## Task 4: permissions — canListUsers, canModerateUsers (TDD)

**Files:**
- Modify: `src/features/users/permissions.test.ts` (полная замена)
- Modify: `src/features/users/permissions.ts` (полная замена)

- [x] **Step 1: Написать падающие тесты**

```ts
// src/features/users/permissions.test.ts
import { describe, it, expect } from "vitest";
import type { Me } from "@/utils/me";
import { canListUsers, canModerateUsers } from "./permissions";

const guest = null;

const adminFull: Me = {
  id: "u1",
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: ["user.list", "user.moderate"],
};

const userNoCap: Me = {
  id: "u2",
  username: "user",
  role: "user",
  status: "active",
  capabilities: [],
};

const suspendedAdmin: Me = {
  ...adminFull,
  status: "suspended",
};

const listOnly: Me = {
  ...adminFull,
  capabilities: ["user.list"],
};

describe("canListUsers", () => {
  it("гость → false", () => expect(canListUsers(guest)).toBe(false));
  it("active без cap → false", () => expect(canListUsers(userNoCap)).toBe(false));
  it("suspended с cap → false", () => expect(canListUsers(suspendedAdmin)).toBe(false));
  it("active с cap → true", () => expect(canListUsers(adminFull)).toBe(true));
});

describe("canModerateUsers", () => {
  it("гость → false", () => expect(canModerateUsers(guest)).toBe(false));
  it("active без cap → false", () => expect(canModerateUsers(userNoCap)).toBe(false));
  it("suspended с cap → false", () => expect(canModerateUsers(suspendedAdmin)).toBe(false));
  it("active с cap → true", () => expect(canModerateUsers(adminFull)).toBe(true));
  it("user.list не даёт user.moderate → false", () =>
    expect(canModerateUsers(listOnly)).toBe(false));
});
```

- [x] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/features/users/permissions.test.ts`
Expected: FAIL — модуль `./permissions` не экспортирует `canListUsers` / `canModerateUsers`.

- [x] **Step 3: Реализовать permissions.ts**

```ts
// src/features/users/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";

/**
 * Capability-имена строго из RBAC бекенда
 * (philosophy-api/internal/rbac/capabilities.go: user.list, user.moderate).
 * Status-чек (active) уже внутри can() — не дублировать.
 */

export function canListUsers(me: MaybeMe): boolean {
  return can(me, "user.list");
}

export function canModerateUsers(me: MaybeMe): boolean {
  return can(me, "user.moderate");
}
```

- [x] **Step 4: Убедиться, что тесты зелёные**

Run: `npx vitest run src/features/users/permissions.test.ts`
Expected: PASS — 9 тестов.

- [x] **Step 5: Commit**

```bash
git add src/features/users/permissions.ts src/features/users/permissions.test.ts
git commit -m "feat(users): add canListUsers/canModerateUsers permissions"
```

---

## Task 5: schemas — Zod-валидация role/status (TDD)

**Files:**
- Modify: `src/features/users/schemas.test.ts` (полная замена)
- Modify: `src/features/users/schemas.ts` (полная замена)

- [x] **Step 1: Написать падающие тесты**

```ts
// src/features/users/schemas.test.ts
import { describe, it, expect } from "vitest";
import { UserRoleUpdateSchema, UserStatusUpdateSchema } from "./schemas";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("UserRoleUpdateSchema", () => {
  it("принимает role=user", () => {
    const r = UserRoleUpdateSchema.safeParse({ id: UUID, role: "user" });
    expect(r.success).toBe(true);
  });
  it("принимает role=admin", () => {
    const r = UserRoleUpdateSchema.safeParse({ id: UUID, role: "admin" });
    expect(r.success).toBe(true);
  });
  it("отклоняет неизвестную роль", () => {
    const r = UserRoleUpdateSchema.safeParse({ id: UUID, role: "moderator" });
    expect(r.success).toBe(false);
  });
  it("отклоняет битый uuid", () => {
    const r = UserRoleUpdateSchema.safeParse({ id: "not-uuid", role: "admin" });
    expect(r.success).toBe(false);
  });
  it("отклоняет отсутствующую роль", () => {
    const r = UserRoleUpdateSchema.safeParse({ id: UUID });
    expect(r.success).toBe(false);
  });
});

describe("UserStatusUpdateSchema", () => {
  it("принимает status=active", () => {
    const r = UserStatusUpdateSchema.safeParse({ id: UUID, status: "active" });
    expect(r.success).toBe(true);
  });
  it("принимает status=suspended", () => {
    const r = UserStatusUpdateSchema.safeParse({ id: UUID, status: "suspended" });
    expect(r.success).toBe(true);
  });
  it("принимает status=banned", () => {
    const r = UserStatusUpdateSchema.safeParse({ id: UUID, status: "banned" });
    expect(r.success).toBe(true);
  });
  it("отклоняет неизвестный статус", () => {
    const r = UserStatusUpdateSchema.safeParse({ id: UUID, status: "deleted" });
    expect(r.success).toBe(false);
  });
  it("отклоняет битый uuid", () => {
    const r = UserStatusUpdateSchema.safeParse({ id: "x", status: "active" });
    expect(r.success).toBe(false);
  });
});
```

- [x] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/features/users/schemas.test.ts`
Expected: FAIL — модуль `./schemas` не экспортирует `UserRoleUpdateSchema` / `UserStatusUpdateSchema`.

- [x] **Step 3: Реализовать schemas.ts**

```ts
// src/features/users/schemas.ts
import "server-only";
import { z } from "zod";

/**
 * Enum-значения зеркалят бекенд (philosophy-api/internal/user/request.go:
 * oneof=user admin / oneof=active suspended banned) и schema.ts
 * (user.UpdateRoleRequest / user.UpdateStatusRequest).
 */

export const UserRoleUpdateSchema = z.object({
  id: z.string().uuid("Некорректный id пользователя"),
  role: z.enum(["user", "admin"]),
});

export const UserStatusUpdateSchema = z.object({
  id: z.string().uuid("Некорректный id пользователя"),
  status: z.enum(["active", "suspended", "banned"]),
});

export type UserRoleUpdateInput = z.infer<typeof UserRoleUpdateSchema>;
export type UserStatusUpdateInput = z.infer<typeof UserStatusUpdateSchema>;
```

- [x] **Step 4: Убедиться, что тесты зелёные**

Run: `npx vitest run src/features/users/schemas.test.ts`
Expected: PASS — 10 тестов.

- [x] **Step 5: Commit**

```bash
git add src/features/users/schemas.ts src/features/users/schemas.test.ts
git commit -m "feat(users): add role/status update Zod schemas"
```

---

## Task 6: errors.ts — маппинг ошибок бекенда в русские тексты (TDD)

Сердце требования «409 → понятный русский текст». Вынесен из `actions.ts` в отдельный модуль, потому что `"use server"`-файл может экспортировать только async-функции — а маппинг нужно тестировать синхронно.

**Files:**
- Create: `src/features/users/errors.test.ts`
- Create: `src/features/users/errors.ts`

- [x] **Step 1: Написать падающие тесты**

```ts
// src/features/users/errors.test.ts
import { describe, it, expect } from "vitest";
import { ForbiddenError } from "@/utils/permissions";
import { rethrowUserApiError } from "./errors";

describe("rethrowUserApiError", () => {
  it("FORBIDDEN → ForbiddenError (createAction вернёт code=forbidden)", () => {
    expect(() =>
      rethrowUserApiError({ code: "FORBIDDEN", error: "forbidden" }),
    ).toThrowError(ForbiddenError);
  });

  it("CONFLICT: cannot modify your own status → русский текст", () => {
    expect(() =>
      rethrowUserApiError({
        code: "CONFLICT",
        error: "cannot modify your own status",
      }),
    ).toThrowError("Нельзя изменить собственный статус.");
  });

  it("CONFLICT: cannot modify your own role → русский текст", () => {
    expect(() =>
      rethrowUserApiError({
        code: "CONFLICT",
        error: "cannot modify your own role",
      }),
    ).toThrowError("Нельзя изменить собственную роль.");
  });

  it("CONFLICT: cannot remove the last active admin → русский текст", () => {
    expect(() =>
      rethrowUserApiError({
        code: "CONFLICT",
        error: "cannot remove the last active admin",
      }),
    ).toThrowError(
      "Нельзя приостановить или заблокировать последнего активного администратора.",
    );
  });

  it("CONFLICT: cannot demote the last active admin → русский текст", () => {
    expect(() =>
      rethrowUserApiError({
        code: "CONFLICT",
        error: "cannot demote the last active admin",
      }),
    ).toThrowError(
      "Нельзя понизить роль последнего активного администратора.",
    );
  });

  it("CONFLICT с неизвестным текстом → общий фоллбек, не raw-текст", () => {
    expect(() =>
      rethrowUserApiError({ code: "CONFLICT", error: "something else" }),
    ).toThrowError("Операция отклонена сервером (конфликт).");
  });

  it("NOT_FOUND → «Пользователь не найден.»", () => {
    expect(() =>
      rethrowUserApiError({ code: "NOT_FOUND", error: "user not found" }),
    ).toThrowError("Пользователь не найден.");
  });

  it("SUSPENDED → понятный текст про ограниченный аккаунт", () => {
    expect(() =>
      rethrowUserApiError({ code: "SUSPENDED", error: "account suspended" }),
    ).toThrowError("Ваш аккаунт ограничен — действие недоступно.");
  });

  it("неизвестный код → пробрасывает error-текст", () => {
    expect(() =>
      rethrowUserApiError({ code: "INTERNAL", error: "internal server error" }),
    ).toThrowError("internal server error");
  });

  it("undefined → «Ошибка сервера»", () => {
    expect(() => rethrowUserApiError(undefined)).toThrowError("Ошибка сервера");
  });
});
```

- [x] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/features/users/errors.test.ts`
Expected: FAIL — модуль `./errors` не существует.

- [x] **Step 3: Реализовать errors.ts**

```ts
// src/features/users/errors.ts
import "server-only";
import { ForbiddenError } from "@/utils/permissions";

/** Форма ошибки бекенда (httputil.ErrorResponse): { code?, error?, detail? }. */
export type UserApiError = { code?: string; error?: string };

/**
 * 409-гарды users-admin возвращают единый код "CONFLICT" — различаем по
 * точному message. Строки — из philosophy-api/internal/user/service.go
 * (строки 138, 153, 189, 202). При изменении текстов на беке сработает
 * общий фоллбек ниже — UX не сломается, но текст станет менее точным.
 */
const CONFLICT_MESSAGES: Record<string, string> = {
  "cannot modify your own status": "Нельзя изменить собственный статус.",
  "cannot modify your own role": "Нельзя изменить собственную роль.",
  "cannot remove the last active admin":
    "Нельзя приостановить или заблокировать последнего активного администратора.",
  "cannot demote the last active admin":
    "Нельзя понизить роль последнего активного администратора.",
};

/**
 * Переводит ошибку бекенда в throw с понятным русским текстом.
 * ForbiddenError ловится createAction → { success: false, code: "forbidden" },
 * клиент показывает branded-текст «У вас нет прав на …».
 */
export function rethrowUserApiError(err: UserApiError | undefined): never {
  if (err?.code === "FORBIDDEN") {
    throw new ForbiddenError("role", err.error);
  }
  if (err?.code === "SUSPENDED" || err?.code === "BANNED") {
    throw new Error("Ваш аккаунт ограничен — действие недоступно.");
  }
  if (err?.code === "CONFLICT") {
    const friendly = err.error ? CONFLICT_MESSAGES[err.error] : undefined;
    throw new Error(friendly ?? "Операция отклонена сервером (конфликт).");
  }
  if (err?.code === "NOT_FOUND") {
    throw new Error("Пользователь не найден.");
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}
```

- [x] **Step 4: Убедиться, что тесты зелёные**

Run: `npx vitest run src/features/users/errors.test.ts`
Expected: PASS — 10 тестов.

- [x] **Step 5: Commit**

```bash
git add src/features/users/errors.ts src/features/users/errors.test.ts
git commit -m "feat(users): map backend 409/403/404 errors to russian texts"
```

---

## Task 7: api.ts — getUsers

Серверные fetchers по конвенции проекта не покрываются юнит-тестами (как в `glossary`) — корректность проверяется типами openapi-fetch и build'ом.

**Files:**
- Modify: `src/features/users/api.ts` (полная замена)

- [x] **Step 1: Реализовать getUsers**

```ts
// src/features/users/api.ts
import "server-only";
import { cache } from "react";
import { createApiClient } from "@/api/client";
import type { AdminUser } from "./types";

export interface UserListFilter {
  offset?: number;
  limit?: number;
}

export interface UserListResult {
  items: AdminUser[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * GET /api/admin/users — список пользователей (offset/limit пагинация).
 * Гейтится на беке capability user.list. React.cache дедуплицирует в рамках
 * одного запроса; cross-request кеш не используем — админ-список должен быть
 * свежим. Тег Tags.USERS зарезервирован в src/api/tags.ts для инвалидации.
 */
export const getUsers = cache(
  async (filter: UserListFilter = {}): Promise<UserListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    const { data, error } = await api.GET("/api/admin/users", {
      params: { query: { offset, limit } },
    });
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить пользователей");
    }
    return {
      items: data?.data ?? [],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);
```

- [x] **Step 2: Проверить типы**

Run: `npx tsc --noEmit`
Expected: 0 ошибок.

- [x] **Step 3: Commit**

```bash
git add src/features/users/api.ts
git commit -m "feat(users): add getUsers fetcher"
```

---

## Task 8: actions.ts — setUserRole, setUserStatus

**Files:**
- Modify: `src/features/users/actions.ts` (полная замена)

- [x] **Step 1: Реализовать actions**

```ts
// src/features/users/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { createAction } from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";
import { Tags } from "@/api/tags";
import { rethrowUserApiError } from "./errors";
import { canModerateUsers } from "./permissions";
import { UserRoleUpdateSchema, UserStatusUpdateSchema } from "./schemas";
import type { AdminUser } from "./types";

/**
 * Смена роли пользователя. PUT /api/admin/users/{id}/role (user.moderate).
 * Гарды «не себя» / «не последнего активного админа» enforce'ит бекенд (409) —
 * переводятся в русские тексты в rethrowUserApiError.
 */
export const setUserRole = createAction(
  async (input: { id: string; role: string }): Promise<AdminUser | null> => {
    const me = await getMe();
    requireCapability(me, canModerateUsers);
    const parsed = UserRoleUpdateSchema.parse(input);
    const api = await createApiClient();
    const { data, error } = await api.PUT("/api/admin/users/{id}/role", {
      params: { path: { id: parsed.id } },
      body: { role: parsed.role },
    });
    if (error) rethrowUserApiError(error);
    revalidateEntity(Tags.USERS);
    return data?.data ?? null;
  },
);

/**
 * Смена статуса пользователя. PUT /api/admin/users/{id}/status (user.moderate).
 */
export const setUserStatus = createAction(
  async (input: { id: string; status: string }): Promise<AdminUser | null> => {
    const me = await getMe();
    requireCapability(me, canModerateUsers);
    const parsed = UserStatusUpdateSchema.parse(input);
    const api = await createApiClient();
    const { data, error } = await api.PUT("/api/admin/users/{id}/status", {
      params: { path: { id: parsed.id } },
      body: { status: parsed.status },
    });
    if (error) rethrowUserApiError(error);
    revalidateEntity(Tags.USERS);
    return data?.data ?? null;
  },
);
```

- [x] **Step 2: Проверить типы**

Run: `npx tsc --noEmit`
Expected: 0 ошибок.

- [x] **Step 3: Commit**

```bash
git add src/features/users/actions.ts
git commit -m "feat(users): add setUserRole/setUserStatus server actions"
```

---

## Task 9: UI — user-role-control (client)

**Files:**
- Create: `src/features/users/ui/user-role-control.tsx`

- [x] **Step 1: Реализовать контрол смены роли**

Паттерн: Select с локальным state; кнопка «Применить» появляется только когда значение отличается от текущего. Ошибки — тостом: `forbidden` → branded-текст, остальное — текст из action (уже русский после Task 6). После успеха — `router.refresh()`, серверный prop `current` обновится и кнопка исчезнет.

```tsx
"use client";
// src/features/users/ui/user-role-control.tsx
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Select, useToast } from "@/components/ui";
import { setUserRole } from "../actions";
import type { UserRole } from "../types";

const ROLE_OPTIONS = [
  { value: "user", label: "Пользователь" },
  { value: "admin", label: "Администратор" },
];

interface Props {
  userId: string;
  username: string;
  current: UserRole;
}

export function UserRoleControl({ userId, username, current }: Props) {
  const [value, setValue] = useState<string>(current);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const dirty = value !== current;

  async function apply() {
    const result = await setUserRole({ id: userId, role: value });
    if (!result.success) {
      toast.add({
        title: "Не удалось изменить роль",
        description:
          result.code === "forbidden"
            ? "У вас нет прав на изменение роли пользователя."
            : result.error,
      });
      return;
    }
    toast.add({ title: "Роль обновлена", description: username });
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label={`Роль пользователя ${username}`}
        options={ROLE_OPTIONS}
        value={value}
        onValueChange={setValue}
        disabled={isPending}
        className="w-44"
      />
      {dirty && (
        <Button size="sm" disabled={isPending} onClick={() => void apply()}>
          Применить
        </Button>
      )}
    </div>
  );
}
```

- [x] **Step 2: Проверить типы и lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 ошибок.

- [x] **Step 3: Commit**

```bash
git add src/features/users/ui/user-role-control.tsx
git commit -m "feat(users): add role select control"
```

---

## Task 10: UI — user-status-control с confirm для ban (client)

**Files:**
- Create: `src/features/users/ui/user-status-control.tsx`

- [x] **Step 1: Реализовать контрол смены статуса**

Деструктивный переход (выбран `banned`) — кнопка «Применить» оборачивается в `ConfirmDialog` (danger). Остальные переходы (`active`, `suspended`) — прямое применение. По конвенции (`docs/frontend-conventions.md` §3.4) `ConfirmDialog` не surface'ит ошибки `onConfirm` — поэтому `apply()` сам ловит неуспех в тост и возвращается нормально.

```tsx
"use client";
// src/features/users/ui/user-status-control.tsx
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, Select, useToast } from "@/components/ui";
import { setUserStatus } from "../actions";
import type { UserStatus } from "../types";

const STATUS_OPTIONS = [
  { value: "active", label: "Активен" },
  { value: "suspended", label: "Приостановлен" },
  { value: "banned", label: "Заблокирован" },
];

interface Props {
  userId: string;
  username: string;
  current: UserStatus;
}

export function UserStatusControl({ userId, username, current }: Props) {
  const [value, setValue] = useState<string>(current);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const dirty = value !== current;

  async function apply() {
    const result = await setUserStatus({ id: userId, status: value });
    if (!result.success) {
      toast.add({
        title: "Не удалось изменить статус",
        description:
          result.code === "forbidden"
            ? "У вас нет прав на изменение статуса пользователя."
            : result.error,
      });
      return;
    }
    toast.add({ title: "Статус обновлён", description: username });
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label={`Статус пользователя ${username}`}
        options={STATUS_OPTIONS}
        value={value}
        onValueChange={setValue}
        disabled={isPending}
        className="w-44"
      />
      {dirty && value === "banned" ? (
        <ConfirmDialog
          trigger={
            <Button size="sm" variant="danger" disabled={isPending}>
              Применить
            </Button>
          }
          title={`Заблокировать ${username}?`}
          description="Заблокированный пользователь не сможет войти в систему. Статус можно будет вернуть позже."
          destructive
          confirmLabel="Заблокировать"
          onConfirm={apply}
        />
      ) : dirty ? (
        <Button size="sm" disabled={isPending} onClick={() => void apply()}>
          Применить
        </Button>
      ) : null}
    </div>
  );
}
```

- [x] **Step 2: Проверить типы и lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 ошибок.

- [x] **Step 3: Commit**

```bash
git add src/features/users/ui/user-status-control.tsx
git commit -m "feat(users): add status select control with ban confirm"
```

---

## Task 11: UI — users-table (server component)

**Files:**
- Create: `src/features/users/ui/users-table.tsx`

- [x] **Step 1: Реализовать таблицу**

Контролы рендерятся только при `canModerate` и не для собственной строки (бек всё равно вернёт 409 «не себя» — но UI не предлагает заведомо запрещённое действие). Для своей строки и для читателей без `user.moderate` — текстовые лейблы.

```tsx
// src/features/users/ui/users-table.tsx
import { EmptyState, Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui";
import type { AdminUser } from "../types";
import { UserRoleControl } from "./user-role-control";
import { UserStatusControl } from "./user-status-control";

const ROLE_LABELS: Record<string, string> = {
  user: "Пользователь",
  admin: "Администратор",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Активен",
  suspended: "Приостановлен",
  banned: "Заблокирован",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

interface Props {
  users: AdminUser[];
  canModerate: boolean;
  /** id текущего пользователя: для своей строки контролы не показываем (бек вернёт 409). */
  meId: string;
}

export function UsersTable({ users, canModerate, meId }: Props) {
  if (users.length === 0) {
    return <EmptyState title="Пользователи не найдены" />;
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Имя</Th>
          <Th>Роль</Th>
          <Th>Статус</Th>
          <Th>Создан</Th>
          <Th>ID</Th>
        </Tr>
      </Thead>
      <Tbody>
        {users.map((u) => {
          const isSelf = u.id === meId;
          const editable = canModerate && !isSelf;
          return (
            <Tr key={u.id}>
              <Td>
                {u.username}
                {isSelf && (
                  <span className="ml-1 text-xs text-(--color-description)">
                    (вы)
                  </span>
                )}
              </Td>
              <Td>
                {editable ? (
                  <UserRoleControl
                    userId={u.id}
                    username={u.username}
                    current={u.role}
                  />
                ) : (
                  (ROLE_LABELS[u.role] ?? u.role)
                )}
              </Td>
              <Td>
                {editable ? (
                  <UserStatusControl
                    userId={u.id}
                    username={u.username}
                    current={u.status}
                  />
                ) : (
                  (STATUS_LABELS[u.status] ?? u.status)
                )}
              </Td>
              <Td>{formatDate(u.created_at)}</Td>
              <Td className="font-mono text-xs text-(--color-description)">
                {u.id}
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
}
```

- [x] **Step 2: Проверить типы и lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 ошибок.

- [x] **Step 3: Commit**

```bash
git add src/features/users/ui/users-table.tsx
git commit -m "feat(users): add users table"
```

---

## Task 12: index.ts — public API слайса

**Files:**
- Modify: `src/features/users/index.ts` (полная замена)

- [x] **Step 1: Экспортировать только то, что нужно странице**

`errors.ts`, `schemas.ts`, client-контролы — приватные (контролы рендерит `UsersTable` внутри слайса).

```ts
// src/features/users/index.ts
export { getUsers } from "./api";
export type { UserListFilter, UserListResult } from "./api";
export { setUserRole, setUserStatus } from "./actions";
export { canListUsers, canModerateUsers } from "./permissions";
export { UsersTable } from "./ui/users-table";
export type { AdminUser, UserRole, UserStatus } from "./types";
```

- [x] **Step 2: Проверить типы**

Run: `npx tsc --noEmit`
Expected: 0 ошибок.

- [x] **Step 3: Commit**

```bash
git add src/features/users/index.ts
git commit -m "feat(users): export public slice API"
```

---

## Task 13: Страница /admin/users (Layer-3 гейт)

**Files:**
- Create: `src/app/admin/users/page.tsx`

- [x] **Step 1: Реализовать страницу**

Layer-3 гейт по конвенции: `getMe()` + доменный `canListUsers` + `forbidden()` из `next/navigation`. `forbidden()` типизирован как `never` — после if `me` сужается до `Me`.

```tsx
// src/app/admin/users/page.tsx
import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import { Pagination } from "@/components/ui";
import {
  canListUsers,
  canModerateUsers,
  getUsers,
  UsersTable,
} from "@/features/users";

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

const PAGE_SIZE = 50;

export default async function AdminUsersPage({ searchParams }: Props) {
  const me = await getMe();
  if (!me || !canListUsers(me)) forbidden();

  const canModerate = canModerateUsers(me);

  const { offset } = await searchParams;
  const offsetNum = Number(offset);
  const safeOffset =
    Number.isFinite(offsetNum) && offsetNum > 0 ? Math.floor(offsetNum) : 0;

  const result = await getUsers({ offset: safeOffset, limit: PAGE_SIZE });

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Пользователи</h1>
        <p className="text-sm text-(--color-description)">
          Всего: {result.total}
        </p>
      </header>

      <UsersTable
        users={result.items}
        canModerate={canModerate}
        meId={me.id}
      />

      {result.total > result.limit && (
        <Pagination
          basePath="/admin/users"
          offset={result.offset}
          limit={result.limit}
          total={result.total}
        />
      )}
    </section>
  );
}

export const metadata = { title: "Пользователи — админ" };
```

- [x] **Step 2: Проверить типы и lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 ошибок.

- [x] **Step 3: Commit**

```bash
git add src/app/admin/users/page.tsx
git commit -m "feat(users): add /admin/users page with layer-3 gate"
```

---

## Task 14: Read-only верификация sidebar (Foundation-touch: НЕ нужен)

**Files:** нет изменений. Только чтение.

- [x] **Step 1: Проверить capability-гейт пункта users в admin layout**

Run: `grep -n "user.list" src/app/admin/layout.tsx src/utils/permissions.ts`

Expected:
- `src/app/admin/layout.tsx` — строка `if (can(me, "user.list"))` перед `items.push({ href: "/admin/users", label: "Пользователи" })`.
- `src/utils/permissions.ts` — `"user.list"` присутствует в union `Capability`.

Это имя сверено с бекендом (`philosophy-api/internal/rbac/capabilities.go:26` — `CapUserList Capability = "user.list"`). Совпадает → **в этой ветке `src/app/admin/layout.tsx` НЕ редактируется**.

- [x] **Step 2: Если grep вдруг показал расхождение** (не ожидается) — НЕ править layout. Записать заметку в секцию "Foundation-touch notes" в конце этого файла плана и сообщить менеджеру в финальном отчёте. Правка запретной зоны — отдельным foundation-update коммитом менеджера после мержа волны.

---

## Task 15: Финальная верификация

**Files:** нет новых файлов (фиксы по результатам — в уже созданных файлах плана).

- [x] **Step 1: Чеклист `src/features/_template/README.md`**

Пройти по пунктам:
- `index.ts` экспортирует только нужное снаружи — да (Task 12).
- `api.ts`, `actions.ts`, `permissions.ts`, `schemas.ts` начинаются с `import "server-only";` — да (`actions.ts` — после `"use server"`).
- Каждая `canXxx` покрыта тестом — да (Task 4).
- Каждая Zod-схема: ≥1 success + ≥1 failure — да (Task 5).
- `createFormAction`/`parseFormData` не используются — осознанно: формы здесь невозможны (Select + подтверждение), мутации идут через `createAction` с Zod `.parse` (паттерн `deleteTerm` из glossary). `requireCapability` + `revalidateEntity` — используются.
- Не импортит другие `@/features/*` — да.
- `ui/.gitkeep` удалён, реальные UI-файлы добавлены — да (Tasks 1, 9–11).

- [x] **Step 2: Полный прогон**

Run: `npm run lint && npm test && npm run build`
Expected: все три зелёные. Если красное — фиксить в файлах этого плана (не отключать правила), повторить прогон.

- [x] **Step 3: Проверить, что в ветке нет лишних файлов**

Run: `git status --short`
Expected: пусто (всё закоммичено), изменены только файлы из Parallel-safety contract. Незакоммиченный чужой diff в `public/sw.js` и `.env.development.local` (если виден в worktree) — НЕ добавлять и НЕ откатывать.

---

## Риски и допущения

1. **Матчинг 409 по английскому тексту** (`CONFLICT_MESSAGES` в `errors.ts`): код у всех гардов один — `"CONFLICT"`, различить можно только по `error`. Если бек переформулирует строки, сработает фоллбек «Операция отклонена сервером (конфликт).» — UX не ломается, но теряет точность. Кандидат на бекенд-улучшение: `ConflictWithCode` (уже существует в `apperror`) с кодами вида `SELF_MODIFICATION` / `LAST_ACTIVE_ADMIN` — занести в реестр вопросов к беку (§10 спеки) при ревью волны.
2. **`GET /api/admin/users` не имеет поиска/фильтров** на беке (только offset/limit) — страница не строит поиск; добавится, когда появится на беке.
3. **Идемпотентные переходы** (тот же статус/роль) бек принимает без записи — UI всё равно не даёт их отправить (кнопка «Применить» видна только при изменении значения).
4. **Свой аккаунт**: контролы скрыты для собственной строки (`isSelf`), но даже при гонке (например, два админа понизили друг друга между рендером и кликом) бек вернёт 409/403, и тост покажет русский текст — defense-in-depth.
5. **`forbidden()` как `never`**: сужение `me` после `if (!me || !canListUsers(me)) forbidden();` опирается на тип `(): never` из `next/navigation` — паттерн уже используется в `src/app/admin/layout.tsx`.

## Foundation-touch notes

(Заполняется исполнителем только если Task 14 выявит расхождение — не ожидается.)
