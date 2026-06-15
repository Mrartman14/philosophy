# Banned-user forced logout + local wipe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** При бане пользователя реактивно разлогинить его, полностью стереть локальный сторадж (localStorage + IndexedDB + Cache Storage) и httpOnly-cookie `token`, показав брендированный экран «аккаунт заблокирован».

**Architecture:** Реактивный детект в двух уже существующих точках (без middleware, без heartbeat): `getMe()` на навигации (новый `getBanSignal()`) и слой `createAction`/`api-error` на мутации (новый `BannedError`). Оба маршрутизируют браузер на единый route handler `/auth/forced-logout`, который чистит cookie + ставит `Clear-Site-Data` и редиректит на `/login?blocked=1`, где клиентский `ForcedLogoutCleanup` добивает локальные сторы.

**Tech Stack:** Next.js App Router (RSC + server actions + route handlers), TypeScript, Vitest + @testing-library/react (jsdom), pnpm.

**Дизайн-спека:** [docs/superpowers/specs/2026-06-15-banned-user-forced-logout-design.md](../specs/2026-06-15-banned-user-forced-logout-design.md). Scope — **только `banned`** (`suspended` не трогаем).

---

## Файловая структура

| Файл | Действие | Ответственность |
|---|---|---|
| `src/utils/permissions.ts` | modify | новый класс `BannedError` |
| `src/utils/api-error.ts` | modify | `BANNED` → `BannedError` (отделить от `SUSPENDED`) |
| `src/utils/api-error.test.ts` | modify | обновить тест BANNED |
| `src/utils/create-action.ts` | modify | catch `BannedError` → `redirect("/auth/forced-logout")` |
| `src/utils/create-action.test.ts` | modify | тесты banned-redirect |
| `src/utils/me.ts` | modify | `getAuthState()` + `getBanSignal()`; `getMe` контракт цел |
| `src/utils/me.test.ts` | create | покрытие `getMe`/`getBanSignal` |
| `src/services/offline/owner.ts` | modify | `clearOfflineOwner()` |
| `src/services/offline/owner.test.ts` | modify | тест `clearOfflineOwner` |
| `src/services/offline/forced-logout-cleanup.tsx` | create | клиентская зачистка на mount |
| `src/services/offline/forced-logout-cleanup.test.tsx` | create | тест компонента |
| `src/app/auth/forced-logout/route.ts` | create | route handler: cookie + Clear-Site-Data + 303 |
| `src/app/auth/forced-logout/route.test.ts` | create | тест route handler |
| `src/app/layout.tsx` | modify | `getBanSignal()` → `redirect` (wiring) |
| `src/app/login/page.tsx` | modify | `blocked=1` notice + mount cleanup (wiring) |

Порядок задач: сначала «листовые» модули с юнит-тестами (Tasks 1–6), затем wiring server-компонентов (Tasks 7–8), затем общий гейт (Task 9).

---

### Task 1: `BannedError` + маппинг `BANNED` в api-error

**Files:**
- Modify: `src/utils/permissions.ts` (после класса `ForbiddenError`, ~строка 83)
- Modify: `src/utils/api-error.ts:33-36, 74-90`
- Test: `src/utils/api-error.test.ts:42-46`

- [ ] **Step 1: Обновить тест на BANNED (красный)**

В `src/utils/api-error.test.ts` заменить существующий блок (строки 42-46):

```ts
  it("BANNED → BannedError", () => {
    const err = caught(() => rethrowApiError({ code: "BANNED" }));
    expect(err).toBeInstanceOf(BannedError);
  });
```

И добавить импорт в шапку файла (рядом со строкой `import { ForbiddenError } from "./permissions";`):

```ts
import { BannedError, ForbiddenError } from "./permissions";
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm vitest run src/utils/api-error.test.ts`
Expected: FAIL — `BannedError` не экспортируется (ошибка импорта/типов).

- [ ] **Step 3: Добавить класс `BannedError` в permissions.ts**

После класса `ForbiddenError` (после строки 83) вставить:

```ts
/**
 * Бросается, когда бэк сообщил, что аккаунт ЗАБАНЕН (код `BANNED`). В отличие
 * от `ForbiddenError` (отказ в праве) это сигнал форс-логаута: ловится в
 * `createAction`/`createFormAction` и приводит к `redirect("/auth/forced-logout")`,
 * а не к `{ code: "forbidden" }`. `suspended` сюда НЕ относится — он остаётся
 * `ForbiddenError("status")`.
 */
export class BannedError extends Error {
  readonly code = "banned" as const;
  constructor(message = "Account banned") {
    super(message);
    this.name = "BannedError";
  }
}
```

- [ ] **Step 4: Развести `BANNED` и `SUSPENDED` в api-error.ts**

В `src/utils/api-error.ts`:

1. Импорт (строка 4) — добавить `BannedError`:

```ts
import { BannedError, ForbiddenError } from "./permissions";
```

2. Убрать `BANNED` из `STATUS_FORBIDDEN_CODES` (строки 33-36) — оставить только `SUSPENDED`:

```ts
const STATUS_FORBIDDEN_CODES: ReadonlySet<ApiErrorCode> = new Set([
  "SUSPENDED",
]);
```

3. В `rethrowApiError` (внутри `if (code) {`, ПЕРВОЙ проверкой, перед `ROLE_FORBIDDEN_CODES`) добавить:

```ts
    if (code === "BANNED") {
      throw new BannedError(err.error ?? "Account banned");
    }
```

- [ ] **Step 5: Запустить — зелёный**

Run: `pnpm vitest run src/utils/api-error.test.ts`
Expected: PASS (включая «SUSPENDED → ForbiddenError('status')», который не изменился).

- [ ] **Step 6: Commit**

```bash
git add src/utils/permissions.ts src/utils/api-error.ts src/utils/api-error.test.ts
git commit -m "feat(auth): BannedError, route BANNED separately from SUSPENDED"
```

---

### Task 2: `createAction`/`createFormAction` ловят `BannedError` → redirect

**Files:**
- Modify: `src/utils/create-action.ts:10-13, 68-100`
- Test: `src/utils/create-action.test.ts` (шапка + новый describe)

- [ ] **Step 1: Написать падающие тесты + мок next/navigation**

В шапке `src/utils/create-action.test.ts` (после строки `import { z } from "zod";`) добавить мок и обновить импорт ошибок:

```ts
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
}));
```

Поправить первую строку импорта vitest, чтобы был `vi`:

```ts
import { describe, it, expect, vi } from "vitest";
```

И импорт ошибок:

```ts
import { BannedError, ForbiddenError } from "./permissions";
```

Добавить новый describe в конец файла:

```ts
describe("forced logout on BannedError", () => {
  it("createFormAction: BannedError → redirect на /auth/forced-logout", async () => {
    const action = createFormAction(() => {
      throw new BannedError();
    });
    let digest: string | undefined;
    try {
      await action({ success: false, error: "" }, new FormData());
    } catch (e) {
      digest = (e as { digest?: string }).digest;
    }
    expect(digest).toBe("NEXT_REDIRECT;/auth/forced-logout");
  });

  it("createAction: BannedError → redirect на /auth/forced-logout", async () => {
    const action = createAction(() => {
      throw new BannedError();
    });
    let digest: string | undefined;
    try {
      await action(undefined);
    } catch (e) {
      digest = (e as { digest?: string }).digest;
    }
    expect(digest).toBe("NEXT_REDIRECT;/auth/forced-logout");
  });

  it("ForbiddenError по-прежнему → code=forbidden (не редиректит)", async () => {
    const action = createFormAction(() => {
      throw new ForbiddenError("role");
    });
    const result = await action({ success: false, error: "" }, new FormData());
    expect(result).toMatchObject({ success: false, code: "forbidden" });
  });
});
```

- [ ] **Step 2: Запустить — упасть**

Run: `pnpm vitest run src/utils/create-action.test.ts`
Expected: FAIL — действие при `BannedError` возвращает `{ success:false, error:"Account banned" }` вместо throw NEXT_REDIRECT.

- [ ] **Step 3: Реализовать catch-ветку**

В `src/utils/create-action.ts`:

1. Импорты (строки 10-13) — добавить `redirect` и `BannedError`:

```ts
import { redirect } from "next/navigation";

import { readIdempotencyKey } from "./idempotency";
import { BannedError, ForbiddenError } from "./permissions";
```

2. В `createAction` — в `catch` (строки 74-78) ПЕРВОЙ строкой:

```ts
    } catch (error) {
      if (error instanceof BannedError) redirect("/auth/forced-logout");
      if (isNextInternalError(error)) throw error;
      return toResult<TOutput>(error);
    }
```

3. В `createFormAction` — в `catch` (строки 95-98) аналогично ПЕРВОЙ строкой:

```ts
    } catch (error) {
      if (error instanceof BannedError) redirect("/auth/forced-logout");
      if (isNextInternalError(error)) throw error;
      return toResult<TOutput>(error);
    }
```

- [ ] **Step 4: Запустить — зелёный**

Run: `pnpm vitest run src/utils/create-action.test.ts`
Expected: PASS (все прежние тесты + 3 новых).

- [ ] **Step 5: Commit**

```bash
git add src/utils/create-action.ts src/utils/create-action.test.ts
git commit -m "feat(auth): forced-logout redirect on BannedError in action wrappers"
```

---

### Task 3: `getMe` рефактор → `getAuthState` + `getBanSignal`

**Files:**
- Modify: `src/utils/me.ts` (целиком тело fetch-логики)
- Test: `src/utils/me.test.ts` (CREATE)

- [ ] **Step 1: Написать тест-файл `src/utils/me.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: cookieGet }),
}));
// React.cache в тестах вне рендер-скоупа — делаем passthrough для детерминизма.
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  return { ...actual, cache: <T,>(fn: T) => fn };
});

import { getMe, getBanSignal } from "./me";

const VALID_ME = {
  id: "u1",
  username: "alice",
  role: "user",
  status: "active",
  capabilities: [],
};

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(body), { status })),
    ),
  );
}

beforeEach(() => {
  cookieGet.mockReset();
  vi.unstubAllGlobals();
});

describe("getMe / getBanSignal", () => {
  it("нет токена → null, не забанен, fetch не вызван", async () => {
    cookieGet.mockReturnValue(undefined);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await getMe()).toBeNull();
    expect(await getBanSignal()).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("200 → Me, не забанен", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    stubFetch(200, { data: VALID_ME });
    expect(await getMe()).toMatchObject({ id: "u1", username: "alice" });
    expect(await getBanSignal()).toBe(false);
  });

  it("401 → null, не забанен", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    stubFetch(401, {});
    expect(await getMe()).toBeNull();
    expect(await getBanSignal()).toBe(false);
  });

  it("404 → null, не забанен", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    stubFetch(404, {});
    expect(await getMe()).toBeNull();
    expect(await getBanSignal()).toBe(false);
  });

  it("403 + code BANNED → null, ЗАБАНЕН", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    stubFetch(403, { code: "BANNED" });
    expect(await getMe()).toBeNull();
    expect(await getBanSignal()).toBe(true);
  });

  it("403 без BANNED → null, не забанен", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    stubFetch(403, { code: "FORBIDDEN" });
    expect(await getMe()).toBeNull();
    expect(await getBanSignal()).toBe(false);
  });

  it("500 → throw (инцидент, не гость)", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    stubFetch(500, {});
    await expect(getMe()).rejects.toThrow(/backend returned 500/);
  });
});
```

- [ ] **Step 2: Запустить — упасть**

Run: `pnpm vitest run src/utils/me.test.ts`
Expected: FAIL — `getBanSignal` не экспортируется.

- [ ] **Step 3: Рефактор `src/utils/me.ts`**

Заменить блок от `const API_URL` (строка 28) и весь `export const getMe = cache(...)` на:

```ts
const API_URL = process.env.API_URL ?? "http://localhost:8080";

interface AuthState {
  me: Me | null;
  /** true ТОЛЬКО когда бэк явно вернул 403 + code "BANNED". */
  banned: boolean;
}

const NO_AUTH: AuthState = { me: null, banned: false };

/**
 * Единый источник: один fetch `/api/me` на запрос (дедуп через React.cache),
 * из него выводятся и `getMe()`, и `getBanSignal()`.
 *
 * - нет токена → гость;
 * - 200 → Me;
 * - 403 + code "BANNED" → { me: null, banned: true } (форс-логаут);
 * - 401 / 404 / прочий 403 → гость (токен отозван/протух — тихая деградация);
 * - 5xx → throw (инцидент, не выгоняем реального пользователя в гостя).
 */
const getAuthState = cache(async (): Promise<AuthState> => {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return NO_AUTH;

  const res = await fetch(`${API_URL}/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 403) {
    let code: string | undefined;
    try {
      const body = (await res.json()) as { code?: string };
      code = body.code;
    } catch {
      // тело не JSON / пустое — трактуем как небанный 403 (обычный гость)
    }
    return { me: null, banned: code === "BANNED" };
  }
  if (res.status === 401 || res.status === 404) {
    return NO_AUTH;
  }
  if (!res.ok) {
    throw new Error(`getMe(): backend returned ${res.status}`);
  }

  const json: unknown = await res.json();
  const candidate =
    typeof json === "object" && json !== null && "data" in json
      ? (json as { data: unknown }).data
      : json;

  if (
    !candidate ||
    typeof candidate !== "object" ||
    !("id" in candidate) ||
    !("username" in candidate) ||
    !("role" in candidate) ||
    !("status" in candidate) ||
    !("capabilities" in candidate)
  ) {
    throw new Error("getMe(): backend returned malformed payload");
  }

  return { me: candidate as Me, banned: false };
});

/** Текущий пользователь или `null` (гость). Контракт не изменился. */
export const getMe = async (): Promise<MaybeMe> => (await getAuthState()).me;

/** `true`, только если бэк явно вернул бан (403 + code "BANNED") на этом запросе. */
export const getBanSignal = async (): Promise<boolean> =>
  (await getAuthState()).banned;
```

Импорты вверху файла (`"server-only"`, `cookies`, `cache`, `components`) и блоки `Me`/`MaybeMe` (строки 1-26) — **без изменений**.

- [ ] **Step 4: Запустить — зелёный**

Run: `pnpm vitest run src/utils/me.test.ts`
Expected: PASS (7 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/utils/me.ts src/utils/me.test.ts
git commit -m "feat(auth): getBanSignal via shared getAuthState; getMe contract intact"
```

---

### Task 4: `clearOfflineOwner()` в owner.ts

**Files:**
- Modify: `src/services/offline/owner.ts:14-20`
- Test: `src/services/offline/owner.test.ts` (новый describe)

- [ ] **Step 1: Написать падающий тест**

В конец `src/services/offline/owner.test.ts` добавить и обновить импорт:

```ts
import { reconcileOfflineOwner, getOfflineOwner, clearOfflineOwner } from "./owner";
```

```ts
describe("clearOfflineOwner", () => {
  it("удаляет маркер владельца из localStorage", () => {
    localStorage.setItem(OFFLINE_OWNER_KEY, "alice");
    clearOfflineOwner();
    expect(getOfflineOwner()).toBeNull();
  });

  it("не бросает, если маркера нет", () => {
    expect(() => clearOfflineOwner()).not.toThrow();
    expect(getOfflineOwner()).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — упасть**

Run: `pnpm vitest run src/services/offline/owner.test.ts`
Expected: FAIL — `clearOfflineOwner` не экспортируется.

- [ ] **Step 3: Реализовать**

В `src/services/offline/owner.ts` после функции `setOfflineOwner` (после строки 20) добавить:

```ts
/**
 * Полностью убирает маркер владельца — используется при форс-логауте по бану,
 * чтобы локально не осталось следов прежней личности. Best-effort, не бросает.
 */
export function clearOfflineOwner(): void {
  try {
    localStorage.removeItem(OFFLINE_OWNER_KEY);
  } catch {
    // приватный режим / нет доступа к localStorage
  }
}
```

- [ ] **Step 4: Запустить — зелёный**

Run: `pnpm vitest run src/services/offline/owner.test.ts`
Expected: PASS (прежние + 2 новых).

- [ ] **Step 5: Commit**

```bash
git add src/services/offline/owner.ts src/services/offline/owner.test.ts
git commit -m "feat(offline): clearOfflineOwner for forced-logout wipe"
```

---

### Task 5: `ForcedLogoutCleanup` — клиентская зачистка на mount

**Files:**
- Create: `src/services/offline/forced-logout-cleanup.tsx`
- Test: `src/services/offline/forced-logout-cleanup.test.tsx`

- [ ] **Step 1: Написать падающий тест**

`src/services/offline/forced-logout-cleanup.test.tsx`:

```tsx
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

const { wipeMock, clearOwnerMock } = vi.hoisted(() => ({
  wipeMock: vi.fn(),
  clearOwnerMock: vi.fn(),
}));
vi.mock("./wipe", () => ({ wipeOfflineData: wipeMock }));
vi.mock("./owner", () => ({ clearOfflineOwner: clearOwnerMock }));

import { ForcedLogoutCleanup } from "./forced-logout-cleanup";

beforeEach(() => {
  wipeMock.mockReset().mockResolvedValue(true);
  clearOwnerMock.mockReset();
});
afterEach(cleanup);

describe("ForcedLogoutCleanup", () => {
  it("на mount стирает офлайн-данные и маркер владельца", async () => {
    const { container } = render(<ForcedLogoutCleanup />);
    await waitFor(() => expect(wipeMock).toHaveBeenCalledOnce());
    expect(clearOwnerMock).toHaveBeenCalledOnce();
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Запустить — упасть**

Run: `pnpm vitest run src/services/offline/forced-logout-cleanup.test.tsx`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать компонент**

`src/services/offline/forced-logout-cleanup.tsx`:

```tsx
"use client";
import { useEffect } from "react";

import { clearOfflineOwner } from "./owner";
import { wipeOfflineData } from "./wipe";

/**
 * Невидимый компонент: на `/login?blocked=1` один раз стирает все локальные
 * данные забаненного — IndexedDB + Cache Storage (`wipeOfflineData`) и маркер
 * владельца в localStorage (`clearOfflineOwner`). Это несущая, кросс-браузерно
 * надёжная зачистка; httpOnly-cookie и заголовок `Clear-Site-Data` отрабатывает
 * route handler `/auth/forced-logout`. Best-effort, не блокирует рендер.
 */
export function ForcedLogoutCleanup() {
  useEffect(() => {
    void (async () => {
      await wipeOfflineData();
      clearOfflineOwner();
    })();
  }, []);
  return null;
}
```

- [ ] **Step 4: Запустить — зелёный**

Run: `pnpm vitest run src/services/offline/forced-logout-cleanup.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/offline/forced-logout-cleanup.tsx src/services/offline/forced-logout-cleanup.test.tsx
git commit -m "feat(offline): ForcedLogoutCleanup client component"
```

---

### Task 6: Route handler `/auth/forced-logout`

**Files:**
- Create: `src/app/auth/forced-logout/route.ts`
- Test: `src/app/auth/forced-logout/route.test.ts`

- [ ] **Step 1: Написать падающий тест**

`src/app/auth/forced-logout/route.test.ts`:

```ts
import { NextRequest } from "next/server";
import { describe, it, expect } from "vitest";

import { GET } from "./route";

describe("GET /auth/forced-logout", () => {
  it("303 на /login?blocked=1, чистит token-cookie, ставит Clear-Site-Data", () => {
    const res = GET(new NextRequest("https://app.test/some/page"));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://app.test/login?blocked=1",
    );
    expect(res.headers.get("clear-site-data")).toBe('"cookies", "storage"');

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/token=/);
    expect(setCookie).toMatch(/Max-Age=0/i);
    expect(setCookie).toMatch(/Path=\//);
  });
});
```

- [ ] **Step 2: Запустить — упасть**

Run: `pnpm vitest run src/app/auth/forced-logout/route.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать route handler**

`src/app/auth/forced-logout/route.ts`:

```ts
// src/app/auth/forced-logout/route.ts
// Единая точка убийства сессии при бане. Сюда редиректят: root layout
// (детект на навигации через getBanSignal) и createAction/createFormAction
// (детект на мутации через BannedError). Чистит httpOnly-cookie токена,
// ставит Clear-Site-Data (defense-in-depth) и уводит на брендированный
// /login?blocked=1, где ForcedLogoutCleanup добивает локальные сторы.
import { NextResponse, type NextRequest } from "next/server";

// Источник истины имени cookie — features/auth/cookie.ts (COOKIE_NAME="token").
// Литерал продублирован намеренно: route handler в app/ не может делать
// deep-import во внутренности фичи (ESLint-гард), а barrel @/features/auth
// тянет server-only-модуль.
const TOKEN_COOKIE = "token";

export function GET(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(
    new URL("/login?blocked=1", request.url),
    { status: 303 },
  );
  response.cookies.set(TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
  response.headers.set("Clear-Site-Data", '"cookies", "storage"');
  return response;
}
```

- [ ] **Step 4: Запустить — зелёный**

Run: `pnpm vitest run src/app/auth/forced-logout/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/forced-logout/route.ts src/app/auth/forced-logout/route.test.ts
git commit -m "feat(auth): /auth/forced-logout route handler (cookie + Clear-Site-Data)"
```

---

### Task 7: Wiring — детект на навигации в root layout

**Files:**
- Modify: `src/app/layout.tsx:14, 42-47` (+ новый импорт `redirect`)

> Без юнит-теста: root layout — server component с множеством провайдеров, существующего теста у него нет, а вся тестируемая логика (`getBanSignal`) покрыта в Task 3. Проверяем сборкой + ручным смоуком.

- [ ] **Step 1: Добавить импорт `redirect` и `getBanSignal`**

Строка 14 — расширить импорт `me`:

```ts
import { getBanSignal, getMe, type MaybeMe } from "@/utils/me";
```

В начало файла добавить (рядом с прочими импортами `next`):

```ts
import { redirect } from "next/navigation";
```

- [ ] **Step 2: Считать бан рядом с `me` и редиректить**

Заменить блок строк 42-47:

```ts
  let me: MaybeMe = null;
  let banned = false;
  try {
    me = await getMe();
    banned = await getBanSignal();
  } catch {
    // допустимая деградация: header покажет «Войти», StatusBanner ничего не нарисует
  }
  // Бан ловим вне try: redirect() бросает NEXT_REDIRECT, его нельзя глотать.
  if (banned) redirect("/auth/forced-logout");
```

- [ ] **Step 3: Проверить сборку и линт**

Run: `pnpm lint && pnpm build`
Expected: без ошибок.

- [ ] **Step 4: Ручной смоук (описание для исполнителя)**

При забаненном пользователе любая страница должна редиректить на `/login?blocked=1`, cookie `token` — исчезнуть, в DevTools → Application: localStorage/IndexedDB/Cache Storage офлайна — пусто. (Требует забаненного аккаунта на бэке; если недоступно — отметить как непроверенное и оставить на ревью.)

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(auth): force logout banned users from root layout"
```

---

### Task 8: Wiring — брендированный `/login?blocked=1` + cleanup

**Files:**
- Modify: `src/app/login/page.tsx:1-14, 24-40`

> Без юнит-теста по той же причине (server component с `getMe`, существующего теста нет).

- [ ] **Step 1: Добавить импорт компонента зачистки**

После строки 5 (`import { getMe } from "@/utils/me";`) добавить:

```ts
import { ForcedLogoutCleanup } from "@/services/offline/forced-logout-cleanup";
```

- [ ] **Step 2: Расширить тип и чтение searchParams**

Строки 9-14 — добавить `blocked`:

```ts
interface PageProps {
  searchParams: Promise<{ next?: string; registered?: string; blocked?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { next: rawNext, registered, blocked } = await searchParams;
  const next = safeNextPath(rawNext);
```

- [ ] **Step 3: Отрисовать notice + смонтировать cleanup**

Внутри возвращаемого JSX, сразу после открывающего `<div className="flex flex-col items-center gap-6 py-12">` и `<h1>` (перед блоком `{registered === "1" && ...}`), добавить:

```tsx
      {blocked === "1" && (
        <>
          <p role="status" className="text-sm text-red-600">
            Ваш аккаунт заблокирован. Обратитесь в поддержку.
          </p>
          <ForcedLogoutCleanup />
        </>
      )}
```

- [ ] **Step 4: Проверить сборку и линт**

Run: `pnpm lint && pnpm build`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(auth): branded blocked notice + offline cleanup on /login?blocked=1"
```

---

### Task 9: Общий гейт

- [ ] **Step 1: Прогнать полный набор**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное.

- [ ] **Step 2: Финальный смоук-чеклист (ручной, если доступен забаненный аккаунт)**

1. Забаненный открывает любую страницу → `/login?blocked=1` с notice «Ваш аккаунт заблокирован».
2. Забаненный жмёт мутацию (напр. отправка комментария) сидя на странице → редирект на `/login?blocked=1`.
3. После редиректа: cookie `token` отсутствует; localStorage (`flbz-offline-owner`), IndexedDB (`flbz-offline`), Cache Storage офлайна — пусто.
4. `suspended`-пользователь НЕ затронут: видит branded «Аккаунт ограничен», сессия и офлайн-данные на месте.

- [ ] **Step 3: Финальный коммит (если остались несведённые правки)**

```bash
git add -- docs/superpowers/plans/2026-06-15-banned-user-forced-logout.md
git commit -m "docs(auth): implementation plan for banned-user forced logout"
```

---

## Self-Review

**Spec coverage:**
- Детект на навигации (B1) → Task 3 + Task 7. ✓
- Детект на действии (B2) → Task 1 + Task 2. ✓
- Route handler `/auth/forced-logout` + Clear-Site-Data (C) → Task 6. ✓
- Клиентская несущая зачистка `wipeOfflineData` + `clearOfflineOwner` (D) → Task 4 + Task 5. ✓
- Брендированный `/login?blocked=1` (E) → Task 8. ✓
- Scope banned-only, `SUSPENDED` не трогаем → Task 1 (Step 4 оставляет SUSPENDED в STATUS_FORBIDDEN_CODES) + регресс-тест в Task 2. ✓
- Тесты + зелёный `lint && test && build` → каждый Task + Task 9. ✓

**Placeholder scan:** код приведён целиком в каждом шаге; «TBD»/«handle edge cases» отсутствуют. Ручные смоуки в Task 7/9 помечены как опциональные при отсутствии забаненного аккаунта — это явная инструкция, не плейсхолдер.

**Type consistency:** `BannedError` (permissions.ts) ← throw в api-error.ts ← `instanceof` в create-action.ts — одно имя. `getBanSignal`/`getAuthState`/`AuthState` согласованы между me.ts и me.test.ts. `clearOfflineOwner` — owner.ts ↔ owner.test.ts ↔ forced-logout-cleanup.tsx. Путь `/auth/forced-logout` идентичен в create-action.ts, layout.tsx и тестах; `/login?blocked=1` — в route.ts и login/page.tsx. ✓

## Известные ограничения (перенесены из спеки)

- Idle-юзер разлогинивается на следующем запросе/действии (reactive-only — осознанно).
- Окно офлайн-`/saved` до ближайшего взаимодействия (свои данные; чужое устройство закрывает `OfflineIdentityGuard`).
- Без heartbeat/push.
