# Контракт-миграция — Plan A (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Привести общую инфраструктуру фронта к новому контракту бэка: refresh-токены с прозрачным обновлением сессии, мост серверных 422-ошибок к пофайловым ошибкам форм, унификация `Visibility`.

**Architecture:** Foundation-волна перед слайсами. Auth переходит на пару cookie (`token` access ≈15 мин + `refresh_token` 30 дней); новый `src/middleware.ts` прозрачно ротирует пару при истёкшем access. Серверный 422 `fields` вливается в уже существующий канал `ZodValidationError → {code:"validation", fieldErrors}`. Удалённые типы `*.Visibility` заменяются на `access.Visibility`.

**Tech Stack:** Next.js 16.1.4 (App Router, server actions, middleware), TypeScript, openapi-fetch, Zod, Base UI Form, vitest, pnpm.

## Global Constraints

- Менеджер пакетов — **pnpm** (никогда `npm`). Гейты перед закрытием волны: `pnpm lint && pnpm test && pnpm build` — все зелёные.
- Git: НЕ выполнять `git stash/reset/checkout .//clean`, НЕ делать `git add -A`/`git add .` — добавлять только перечисленные в шаге файлы по имени. Не трогать чужие незакоммиченные изменения. Не пушить.
- Общение и комментарии в коде — по-русски; именование файлов в `src/` — kebab-case.
- `src/api/schema.ts` уже регенерирован — НЕ редактировать.
- RBAC без изменений: в server actions — `requireCapability`/`requireActive`, форма результата `ActionResult` не меняется по контракту (только добавляем источник `fieldErrors`).
- Каждая задача завершается зелёными тестами и отдельным коммитом.

---

## Файловая структура

- Create: `src/features/auth/cookie-config.ts` — client-safe константы имён cookie, max-age и билдер опций (единый источник для `cookie.ts` и `middleware.ts`).
- Modify: `src/features/auth/cookie.ts` — пара access+refresh.
- Modify: `src/features/auth/actions.ts` — `loginAction` (сохранять refresh+expires_in), `logoutAction` (тело `{refresh_token}`), новый `logoutAllAction`.
- Modify: `src/features/auth/index.ts` — реэкспорт `logoutAllAction`.
- Create: `src/middleware.ts` — прозрачный refresh-on-demand.
- Create: `src/middleware.test.ts` — юнит-тесты middleware.
- Modify: `src/utils/api-error.ts` — поле `fields?` в `ApiError`, ветка `ZodValidationError`.
- Modify (callers): любые потребители удалённых `setAuthCookie`/`clearAuthCookie` и `*.Visibility` — найти grep'ом, поправить.

---

### Task 1: Cookie-конфиг и пара access+refresh

**Files:**
- Create: `src/features/auth/cookie-config.ts`
- Modify: `src/features/auth/cookie.ts`
- Test: `src/features/auth/cookie.test.ts` (создать, если нет)

**Interfaces:**
- Consumes: `next/headers` `cookies()`.
- Produces:
  - `cookie-config.ts`: `ACCESS_COOKIE = "token"`, `REFRESH_COOKIE = "refresh_token"`, `ACCESS_FALLBACK_MAX_AGE: number` (900), `REFRESH_MAX_AGE: number` (2592000), `authCookieOptions(maxAgeSeconds: number): { httpOnly: true; sameSite: "lax"; path: "/"; secure: boolean; maxAge: number }`.
  - `cookie.ts`: `setAuthCookies(t: { access: string; refresh: string; expiresIn?: number }): Promise<void>`, `clearAuthCookies(): Promise<void>`, `getAuthToken(): Promise<string | undefined>` (access), `getRefreshToken(): Promise<string | undefined>`.

- [ ] **Step 1: Создать client-safe конфиг cookie**

Create `src/features/auth/cookie-config.ts`:

```typescript
// Client-safe (без "server-only"): импортируется и из server-only cookie.ts,
// и из src/middleware.ts. Единый источник имён cookie и их max-age, чтобы
// actions и middleware не разъезжались.

/** Access-JWT (короткий, ≈ expires_in c бэка). */
export const ACCESS_COOKIE = "token";
/** Непрозрачный refresh-токен (длинный, ротируется). */
export const REFRESH_COOKIE = "refresh_token";

/** Фолбэк max-age access-cookie, если бэк не прислал expires_in (access TTL = 900с). */
export const ACCESS_FALLBACK_MAX_AGE = 15 * 60;
/** Max-age refresh-cookie ≈ refresh absolute TTL бэка (30 дней). */
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

export function authCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  };
}
```

- [ ] **Step 2: Написать падающий тест cookie.ts**

Create/replace `src/features/auth/cookie.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieSet = vi.fn();
const cookieDelete = vi.fn();
const cookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({ set: cookieSet, delete: cookieDelete, get: cookieGet }),
}));

import { setAuthCookies, clearAuthCookies, getAuthToken, getRefreshToken } from "./cookie";
import { ACCESS_COOKIE, REFRESH_COOKIE, ACCESS_FALLBACK_MAX_AGE, REFRESH_MAX_AGE } from "./cookie-config";

beforeEach(() => {
  cookieSet.mockReset();
  cookieDelete.mockReset();
  cookieGet.mockReset();
});

describe("setAuthCookies", () => {
  it("ставит обе cookie; access maxAge = expires_in, refresh = 30д", async () => {
    await setAuthCookies({ access: "acc", refresh: "ref", expiresIn: 900 });
    expect(cookieSet).toHaveBeenCalledWith(ACCESS_COOKIE, "acc", expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 900 }));
    expect(cookieSet).toHaveBeenCalledWith(REFRESH_COOKIE, "ref", expect.objectContaining({ maxAge: REFRESH_MAX_AGE }));
  });

  it("использует фолбэк maxAge, если expires_in отсутствует", async () => {
    await setAuthCookies({ access: "acc", refresh: "ref" });
    expect(cookieSet).toHaveBeenCalledWith(ACCESS_COOKIE, "acc", expect.objectContaining({ maxAge: ACCESS_FALLBACK_MAX_AGE }));
  });
});

describe("clearAuthCookies", () => {
  it("удаляет обе cookie", async () => {
    await clearAuthCookies();
    expect(cookieDelete).toHaveBeenCalledWith(ACCESS_COOKIE);
    expect(cookieDelete).toHaveBeenCalledWith(REFRESH_COOKIE);
  });
});

describe("getters", () => {
  it("getAuthToken читает access, getRefreshToken — refresh", async () => {
    cookieGet.mockImplementation((name: string) => (name === ACCESS_COOKIE ? { value: "acc" } : { value: "ref" }));
    expect(await getAuthToken()).toBe("acc");
    expect(await getRefreshToken()).toBe("ref");
  });
});
```

- [ ] **Step 3: Запустить тест — убедиться, что падает**

Run: `pnpm test src/features/auth/cookie.test.ts`
Expected: FAIL (`setAuthCookies`/`clearAuthCookies`/`getRefreshToken` не существуют).

- [ ] **Step 4: Переписать cookie.ts на пару токенов**

Replace `src/features/auth/cookie.ts` целиком:

```typescript
import "server-only";
import { cookies } from "next/headers";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_FALLBACK_MAX_AGE,
  REFRESH_MAX_AGE,
  authCookieOptions,
} from "./cookie-config";

/** Кладёт пару токенов в httpOnly-cookie. Access живёт ≈ expires_in (15 мин),
 * refresh — 30 дней. Обе ротируются на каждом refresh (см. middleware). */
export async function setAuthCookies(t: {
  access: string;
  refresh: string;
  expiresIn?: number;
}): Promise<void> {
  const store = await cookies();
  const accessMaxAge = t.expiresIn && t.expiresIn > 0 ? t.expiresIn : ACCESS_FALLBACK_MAX_AGE;
  store.set(ACCESS_COOKIE, t.access, authCookieOptions(accessMaxAge));
  store.set(REFRESH_COOKIE, t.refresh, authCookieOptions(REFRESH_MAX_AGE));
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function getAuthToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value;
}
```

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Run: `pnpm test src/features/auth/cookie.test.ts`
Expected: PASS.

- [ ] **Step 6: Найти и обновить вызовы старых имён**

Run: `git grep -n "setAuthCookie\b\|clearAuthCookie\b" -- 'src/**/*.ts' 'src/**/*.tsx'`
Ожидаемые потребители: `src/features/auth/actions.ts` (Task 2/3 их перепишет), возможно `src/app/auth/forced-logout/*`.
Для каждого НЕ-actions потребителя заменить `clearAuthCookie()` → `clearAuthCookies()` (импорт из `./cookie` или `@/features/auth/...`). Если потребителей вне auth-слайса нет — пропустить шаг.

- [ ] **Step 7: Коммит**

```bash
git add src/features/auth/cookie-config.ts src/features/auth/cookie.ts src/features/auth/cookie.test.ts
git commit -m "feat(auth): пара access+refresh cookie вместо одиночного token"
```

---

### Task 2: loginAction сохраняет refresh + expires_in

**Files:**
- Modify: `src/features/auth/actions.ts:loginAction`
- Test: `src/features/auth/actions.test.ts`

**Interfaces:**
- Consumes: `setAuthCookies` из `./cookie` (Task 1).
- Produces: `loginAction` (без изменения сигнатуры; внутренне читает `access_token`, `refresh_token`, `expires_in`).

- [ ] **Step 1: Обновить тест логина (падающий)**

В `src/features/auth/actions.test.ts` заменить мок `next/headers` на пару из Task 1 и обновить кейс логина. Добавить/заменить тест:

```typescript
// (мок next/headers — как в cookie.test.ts: cookieSet/cookieDelete/cookieGet)
it("200 OK + access+refresh → ставит обе cookie и редиректит", async () => {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve(new Response(
      JSON.stringify({ data: { access_token: "acc", refresh_token: "ref", expires_in: 900 } }),
      { status: 200 },
    )),
  ));
  await expect(loginAction(initial, fd({ username: "alice", password: "secret", next: "/admin" })))
    .rejects.toThrow("NEXT_REDIRECT");
  expect(cookieSet).toHaveBeenCalledWith("token", "acc", expect.objectContaining({ maxAge: 900 }));
  expect(cookieSet).toHaveBeenCalledWith("refresh_token", "ref", expect.any(Object));
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test src/features/auth/actions.test.ts -t "access+refresh"`
Expected: FAIL (сейчас сохраняется только access через старый `setAuthCookie`).

- [ ] **Step 3: Обновить loginAction**

В `src/features/auth/actions.ts`:
- заменить импорт: `import { setAuthCookies, clearAuthCookies, getAuthToken, getRefreshToken } from "./cookie";`
- заменить блок парсинга и установки cookie:

```typescript
  let tokens: { access?: string; refresh?: string; expiresIn?: number } = {};
  try {
    const json = (await res.json()) as {
      data?: { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown };
    };
    const d = json.data ?? {};
    tokens = {
      access: typeof d.access_token === "string" ? d.access_token : undefined,
      refresh: typeof d.refresh_token === "string" ? d.refresh_token : undefined,
      expiresIn: typeof d.expires_in === "number" ? d.expires_in : undefined,
    };
  } catch {
    throw new AuthError("service_unavailable");
  }
  if (!tokens.access || !tokens.refresh) throw new AuthError("service_unavailable");

  await setAuthCookies({ access: tokens.access, refresh: tokens.refresh, expiresIn: tokens.expiresIn });
  redirect(safeNextPath(next));
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm test src/features/auth/actions.test.ts`
Expected: PASS (все login-кейсы).

- [ ] **Step 5: Коммит**

```bash
git add src/features/auth/actions.ts src/features/auth/actions.test.ts
git commit -m "feat(auth): loginAction сохраняет refresh_token и expires_in"
```

---

### Task 3: logoutAction (тело refresh) + logoutAllAction

**Files:**
- Modify: `src/features/auth/actions.ts:logoutAction` (+ новый `logoutAllAction`)
- Modify: `src/features/auth/index.ts`
- Test: `src/features/auth/actions.test.ts`

**Interfaces:**
- Consumes: `getRefreshToken`, `getAuthToken`, `clearAuthCookies` (Task 1).
- Produces: `logoutAction(): Promise<void>` (per-device), `logoutAllAction(): Promise<void>` (все устройства). Обе best-effort + clear + redirect.

- [ ] **Step 1: Написать падающие тесты**

В `src/features/auth/actions.test.ts` добавить:

```typescript
import { loginAction, registerAction, logoutAction, logoutAllAction } from "./actions";

describe("logoutAction (per-device)", () => {
  it("шлёт refresh_token в теле и чистит обе cookie", async () => {
    cookieGet.mockImplementation((n: string) => (n === "refresh_token" ? { value: "ref" } : { value: "acc" }));
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT");
    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(opts.body))).toEqual({ refresh_token: "ref" });
    expect(cookieDelete).toHaveBeenCalledWith("token");
    expect(cookieDelete).toHaveBeenCalledWith("refresh_token");
  });
});

describe("logoutAllAction", () => {
  it("шлёт Bearer access на logout-all и чистит обе cookie", async () => {
    cookieGet.mockImplementation((n: string) => (n === "refresh_token" ? { value: "ref" } : { value: "acc" }));
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(logoutAllAction()).rejects.toThrow("NEXT_REDIRECT");
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/auth/logout-all");
    expect((opts.headers as Record<string, string>).Authorization).toBe("Bearer acc");
    expect(cookieDelete).toHaveBeenCalledWith("token");
    expect(cookieDelete).toHaveBeenCalledWith("refresh_token");
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test src/features/auth/actions.test.ts -t "logout"`
Expected: FAIL (`logoutAllAction` нет; `logoutAction` шлёт Bearer без тела).

- [ ] **Step 3: Переписать logoutAction и добавить logoutAllAction**

В `src/features/auth/actions.ts` заменить `logoutAction` целиком и добавить ниже `logoutAllAction`:

```typescript
const LOGOUT_TIMEOUT_MS = 3000;

/** Выход с текущего устройства: отзыв ТЕКУЩЕЙ refresh-сессии по токену из cookie.
 * Best-effort: локально разлогиниваем (чистим обе cookie) даже при сбое бэка. */
export async function logoutAction(): Promise<void> {
  const refresh = await getRefreshToken();
  if (refresh) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);
    try {
      await instrumentedFetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
        cache: "no-store",
        signal: controller.signal,
      }, { surface: "auth.logout" });
    } catch {
      // best-effort
    } finally {
      clearTimeout(timer);
    }
  }
  await clearAuthCookies();
  redirect("/");
}

/** Выход со всех устройств: бэк отзывает все сессии + бампит tokens_valid_after
 * (мгновенный kill всего access). Требует валидный access-токен. Best-effort. */
export async function logoutAllAction(): Promise<void> {
  const access = await getAuthToken();
  if (access) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);
    try {
      await instrumentedFetch(`${API_URL}/api/auth/logout-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access}` },
        cache: "no-store",
        signal: controller.signal,
      }, { surface: "auth.logout_all" });
    } catch {
      // best-effort
    } finally {
      clearTimeout(timer);
    }
  }
  await clearAuthCookies();
  redirect("/");
}
```

- [ ] **Step 4: Реэкспорт logoutAllAction**

В `src/features/auth/index.ts` добавить:

```typescript
export { logoutAction, logoutAllAction } from "./actions";
```
(заменив существующую строку `export { logoutAction } from "./actions";`).

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `pnpm test src/features/auth/actions.test.ts`
Expected: PASS.

- [ ] **Step 6: Коммит**

```bash
git add src/features/auth/actions.ts src/features/auth/index.ts src/features/auth/actions.test.ts
git commit -m "feat(auth): per-device logout (тело refresh) + logoutAllAction"
```

---

### Task 4: Прозрачный refresh — `src/middleware.ts`

**Files:**
- Create: `src/middleware.ts`
- Test: `src/middleware.test.ts`

**Interfaces:**
- Consumes: `ACCESS_COOKIE`, `REFRESH_COOKIE`, `ACCESS_FALLBACK_MAX_AGE`, `REFRESH_MAX_AGE`, `authCookieOptions` из `@/features/auth/cookie-config` (Task 1).
- Produces: `default async function middleware(request: NextRequest): Promise<NextResponse>` + `export const config = { matcher: [...] }`.

**Поведение:** access-cookie есть → пропуск. Нет, refresh есть → `POST {API_URL}/api/auth/refresh {refresh_token}`; 200 → выставить ротированную пару на ответе И в `request.cookies` (чтобы текущий рендер увидел новый access) → пропуск; 4xx/сеть → удалить обе cookie → пропуск как гость. refresh нет → пропуск.

- [ ] **Step 1: Написать падающий тест middleware**

Create `src/middleware.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import middleware from "./middleware";

function req(cookies: Record<string, string>): NextRequest {
  const r = new NextRequest("https://app.test/lectures");
  for (const [k, v] of Object.entries(cookies)) r.cookies.set(k, v);
  return r;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("middleware — прозрачный refresh", () => {
  it("access есть → не зовёт бэк", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await middleware(req({ token: "acc", refresh_token: "ref" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("access нет, refresh есть → рефреш и Set-Cookie новой пары", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(
      JSON.stringify({ data: { access_token: "acc2", refresh_token: "ref2", expires_in: 900 } }),
      { status: 200 },
    )));
    vi.stubGlobal("fetch", fetchMock);
    const res = await middleware(req({ refresh_token: "ref" }));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(res.cookies.get("token")?.value).toBe("acc2");
    expect(res.cookies.get("refresh_token")?.value).toBe("ref2");
  });

  it("refresh протух (401) → чистит обе cookie", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))));
    const res = await middleware(req({ refresh_token: "bad" }));
    expect(res.cookies.get("token")?.value).toBe("");
    expect(res.cookies.get("refresh_token")?.value).toBe("");
  });

  it("нет ни access, ни refresh → пропуск без вызова бэка", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await middleware(req({}));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test src/middleware.test.ts`
Expected: FAIL (`./middleware` не существует).

- [ ] **Step 3: Реализовать middleware**

Create `src/middleware.ts`:

```typescript
import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_FALLBACK_MAX_AGE,
  REFRESH_MAX_AGE,
  authCookieOptions,
} from "@/features/auth/cookie-config";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

/**
 * Прозрачный refresh-on-demand. Server components не умеют Set-Cookie в рендере,
 * поэтому ротация живёт здесь. Безопасность держит data-layer (getMe()→бэк на
 * каждый запрос): обход middleware = «refresh не случился» → гость, не дыра.
 * Коалесинг параллельных refresh не делаем — серверный grace-window (10с) уже
 * гасит мультитаб-гонку.
 */
export default async function middleware(request: NextRequest): Promise<NextResponse> {
  const hasAccess = Boolean(request.cookies.get(ACCESS_COOKIE)?.value);
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  if (hasAccess || !refresh) {
    return NextResponse.next();
  }

  let rotated: { access?: string; refresh?: string; expiresIn?: number } | null = null;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as {
        data?: { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown };
      };
      const d = json.data ?? {};
      if (typeof d.access_token === "string" && typeof d.refresh_token === "string") {
        rotated = {
          access: d.access_token,
          refresh: d.refresh_token,
          expiresIn: typeof d.expires_in === "number" ? d.expires_in : undefined,
        };
      }
    }
  } catch {
    // сеть недоступна — деградируем как гость
  }

  if (!rotated?.access || !rotated.refresh) {
    // refresh невалиден/протух/сбой → чистим обе cookie, рендерим гостя
    const res = NextResponse.next();
    res.cookies.delete(ACCESS_COOKIE);
    res.cookies.delete(REFRESH_COOKIE);
    return res;
  }

  const accessMaxAge = rotated.expiresIn && rotated.expiresIn > 0 ? rotated.expiresIn : ACCESS_FALLBACK_MAX_AGE;

  // 1) текущий рендер должен увидеть новый access → мутируем request.cookies
  request.cookies.set(ACCESS_COOKIE, rotated.access);
  request.cookies.set(REFRESH_COOKIE, rotated.refresh);

  // 2) браузер должен сохранить ротированную пару → Set-Cookie на ответе
  const res = NextResponse.next({ request });
  res.cookies.set(ACCESS_COOKIE, rotated.access, authCookieOptions(accessMaxAge));
  res.cookies.set(REFRESH_COOKIE, rotated.refresh, authCookieOptions(REFRESH_MAX_AGE));
  return res;
}

export const config = {
  // Исключаем статику/ассеты/изображения и сам API-роут (если есть).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|gif|css|js|woff2?)$).*)"],
};
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm test src/middleware.test.ts`
Expected: PASS (4 кейса).

- [ ] **Step 5: Проверить сборку (middleware подхватывается Next)**

Run: `pnpm build`
Expected: сборка зелёная; в выводе среди роутов появляется `Middleware`.

- [ ] **Step 6: Коммит**

```bash
git add src/middleware.ts src/middleware.test.ts
git commit -m "feat(auth): прозрачный refresh-on-demand в src/middleware.ts"
```

---

### Task 5: Мост серверного 422 → ошибки по полям

**Files:**
- Modify: `src/utils/api-error.ts`
- Test: `src/utils/api-error.test.ts` (создать, если нет)

**Interfaces:**
- Consumes: `ZodValidationError` из `@/utils/create-action` (уже ловится `toResult` → `{code:"validation", fieldErrors}`).
- Produces: расширенный `ApiError { code?; error?; fields?: Record<string, string> }`; `rethrowApiError` бросает `ZodValidationError(err.fields)` при непустом `fields`.

Примечание: проверяем отсутствие цикла импортов — `create-action.ts` НЕ импортирует `api-error.ts`, поэтому `api-error.ts → import { ZodValidationError } from "./create-action"` ацикличен.

- [ ] **Step 1: Написать падающий тест**

Create/append `src/utils/api-error.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { rethrowApiError } from "./api-error";
import { ZodValidationError } from "./create-action";

describe("rethrowApiError — серверный 422 fields", () => {
  it("бросает ZodValidationError с раскладкой по полям", () => {
    try {
      rethrowApiError({ code: "VALIDATION", error: "Проверьте поля", fields: { title: "Обязательно" } });
      throw new Error("должно было бросить");
    } catch (e) {
      expect(e).toBeInstanceOf(ZodValidationError);
      expect((e as ZodValidationError).fieldErrors).toEqual({ title: "Обязательно" });
    }
  });

  it("без fields ведёт себя как раньше (общий Error)", () => {
    expect(() => rethrowApiError({ code: "VERSION_MISMATCH", error: "x" }))
      .toThrow("Объект изменён в другом месте. Обновите страницу и повторите.");
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test src/utils/api-error.test.ts`
Expected: FAIL (поле `fields` не в типе; ветки нет → бросается общий Error, не `ZodValidationError`).

- [ ] **Step 3: Расширить ApiError и добавить ветку**

В `src/utils/api-error.ts`:
- добавить импорт: `import { ZodValidationError } from "./create-action";`
- расширить интерфейс:

```typescript
export interface ApiError {
  code?: ApiErrorCode;
  error?: string;
  /** Карта «поле → текст» из httputil.ValidationErrorResponse (422). */
  fields?: Record<string, string>;
}
```

- в начало тела `rethrowApiError`, ПЕРЕД чтением `code`, вставить:

```typescript
  // Серверная валидация (422): раскладка по полям имеет приоритет над общим
  // текстом, чтобы попасть в существующий канал {code:"validation", fieldErrors}.
  if (err?.fields && Object.keys(err.fields).length > 0) {
    throw new ZodValidationError(err.fields);
  }
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm test src/utils/api-error.test.ts`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/utils/api-error.ts src/utils/api-error.test.ts
git commit -m "feat(errors): мост серверного 422 fields → ошибки по полям форм"
```

---

### Task 6: Унификация Visibility → `access.Visibility`

**Files:**
- Modify: каждый файл, ссылающийся на удалённые `trail.Visibility` / `lecture.Visibility` / `annotation.Visibility` (определить grep'ом).
- Test: существующие тесты слайсов + `pnpm build` (tsc).

**Interfaces:**
- Produces: все ссылки на `*.Visibility` указывают на `components["schemas"]["access.Visibility"]` (= `"private" | "public"`).

- [ ] **Step 1: Найти все ссылки на удалённые типы**

Run: `git grep -nE 'schemas"\]\["(trail|lecture|annotation)\.Visibility"\]|TrailVisibility|LectureVisibility|AnnotationVisibility' -- 'src/**/*.ts' 'src/**/*.tsx'`
Записать список файлов. Ожидаемо: `src/features/trails/types.ts` (`TrailVisibility`) и, возможно, `lectures`/`annotations` `types.ts`.

- [ ] **Step 2: Заменить каждую ссылку на access.Visibility**

В каждом найденном файле заменить тип. Пример для `src/features/trails/types.ts`:

```typescript
// было: export type TrailVisibility = components["schemas"]["trail.Visibility"];
export type TrailVisibility = components["schemas"]["access.Visibility"];
```

Аналогично для lectures/annotations, если есть. Локальные алиасы-имена (`TrailVisibility` и т.п.) НЕ переименовывать — менять только правую часть на `access.Visibility`, чтобы не трогать потребителей.

- [ ] **Step 3: Проверить типы сборкой**

Run: `pnpm build`
Expected: НЕТ ошибок вида `Property 'trail.Visibility' does not exist`/`Type '"trail.Visibility"' ...`. Сборка зелёная.

- [ ] **Step 4: Прогнать тесты затронутых слайсов**

Run: `pnpm test src/features/trails src/features/lectures src/features/annotations`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add -- src/features/trails/types.ts
# + остальные файлы, найденные в Step 1, по имени
git commit -m "refactor(types): унификация Visibility на access.Visibility"
```

---

## Финальный гейт волны

- [ ] **Step 1: Полные гейты**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное.

- [ ] **Step 2: Дымовая проверка авторизации вручную (опционально, при наличии dev-стенда)**

С локальным бэком (`make run-local` на :8090) и `pnpm dev` на :3001: логин dev/admin12345 → дождаться истечения access (или сократить TTL на стенде) → навигация продолжает работать без перелогина (сработал прозрачный refresh); кнопка выхода чистит сессию.

---

## Self-Review (выполняется автором плана)

**Спек-покрытие (Plan A — секции Волны 0):**
- Auth cookie+refresh → Task 1; loginAction → Task 2; logout/logout-all actions → Task 3; `src/middleware.ts` → Task 4. ✓
- 422 ValidationErrorResponse + ошибки по полям → Task 5. ✓
- Унификация Visibility → Task 6. ✓
- Optlock-хелпер: НЕ в Plan A (уже существует `ifMatchHeader`; lectures/trails — в Plan B). ✓
- logout-all UI, lecture-subscribe, trail-документы, манифесты → Plan B/C (вне Plan A). ✓

**Скан плейсхолдеров:** нет TBD/«добавить обработку ошибок»/«аналогично Task N» — весь код приведён. ✓

**Согласованность типов:** `setAuthCookies`/`clearAuthCookies`/`getAuthToken`/`getRefreshToken` (Task 1) используются единообразно в Tasks 2–4; `ACCESS_COOKIE`/`REFRESH_COOKIE`/`authCookieOptions` — общие из `cookie-config`; `ZodValidationError.fieldErrors` совпадает с тем, что ловит `toResult`. ✓
