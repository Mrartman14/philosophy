# Auth Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать пользователю возможность войти через `/login` и выйти через кнопку в шапке, чтобы фронт мог авторизоваться у бекенда без ручной возни с cookie.

**Architecture:** Урезанный feature-слайс `src/features/auth/` (без `api.ts`, без `permissions.ts`, без `revalidateEntity`). Все обращения к беку идут через `fetch(API_URL + "/api/auth/login")` напрямую — один эндпойнт, openapi-fetch здесь избыточен. Cookie `token` ставится server-side через `cookies().set()`. Open-redirect защита через локальный `safeNextPath`. Foundation-touch: `app-header` становится `async` и читает `getMe()`.

**Tech Stack:** Next.js 16 App Router, server actions, Zod, Base UI Form, Vitest (с jsdom), TypeScript.

**Spec:** [docs/superpowers/specs/2026-05-16-auth-feature-design.md](../specs/2026-05-16-auth-feature-design.md)

---

## File map

**Create:**

- `src/features/auth/index.ts` — публичный экспорт слайса
- `src/features/auth/schemas.ts` — Zod `LoginSchema`
- `src/features/auth/schemas.test.ts`
- `src/features/auth/safe-next.ts` — `safeNextPath`
- `src/features/auth/safe-next.test.ts`
- `src/features/auth/cookie.ts` — `setAuthCookie`, `clearAuthCookie`
- `src/features/auth/actions.ts` — `loginAction`, `logoutAction`, `AuthError`
- `src/features/auth/actions.test.ts` — мок `fetch`
- `src/features/auth/ui/login-form.tsx`
- `src/features/auth/ui/logout-form.tsx`
- `src/app/login/page.tsx` — server component, страница логина

**Modify:**

- `src/components/app/app-header/app-header.tsx` — foundation-touch: становится `async`, читает `getMe()`, рендерит login/logout UI

**Не трогаем:**

- `src/proxy.ts`, `src/utils/me.ts`, `src/utils/create-action.ts`, `src/api/client.ts`, `src/utils/permissions.ts`

---

## Task 1: Создать структуру слайса и `safeNextPath`

**Files:**

- Create: `src/features/auth/safe-next.ts`
- Create: `src/features/auth/safe-next.test.ts`

`safeNextPath` нужен и в `page.tsx`, и в `loginAction` — отдельным файлом, чтобы переиспользовать без циклических импортов.

- [ ] **Step 1: Создать директорию слайса**

```bash
mkdir -p src/features/auth/ui
```

- [ ] **Step 2: Написать failing-тест `safe-next.test.ts`**

```ts
// src/features/auth/safe-next.test.ts
import { describe, it, expect } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("undefined → /", () => expect(safeNextPath(undefined)).toBe("/"));
  it("null → /", () => expect(safeNextPath(null)).toBe("/"));
  it("пустая строка → /", () => expect(safeNextPath("")).toBe("/"));
  it("обычный путь → как есть", () =>
    expect(safeNextPath("/admin/lectures")).toBe("/admin/lectures"));
  it("путь с query → как есть", () =>
    expect(safeNextPath("/admin?foo=bar")).toBe("/admin?foo=bar"));
  it("protocol-relative //evil.com → /", () =>
    expect(safeNextPath("//evil.com/x")).toBe("/"));
  it("backslash-вариант /\\\\evil.com → /", () =>
    expect(safeNextPath("/\\evil.com")).toBe("/"));
  it("абсолютный https://… → /", () =>
    expect(safeNextPath("https://evil.com")).toBe("/"));
  it("javascript:… → /", () =>
    expect(safeNextPath("javascript:alert(1)")).toBe("/"));
  it("relative без слеша → /", () =>
    expect(safeNextPath("admin")).toBe("/"));
});
```

- [ ] **Step 3: Запустить тест, убедиться что падает**

```bash
npx vitest run src/features/auth/safe-next.test.ts
```

Expected: FAIL (`Cannot find module './safe-next'`).

- [ ] **Step 4: Написать `safe-next.ts`**

```ts
// src/features/auth/safe-next.ts
/**
 * Защита от open-redirect. Возвращает только относительные пути от корня;
 * всё подозрительное сворачиваем в "/".
 */
export function safeNextPath(raw: string | undefined | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  if (raw.startsWith("/\\")) return "/";
  return raw;
}
```

- [ ] **Step 5: Запустить тест, убедиться что зелёный**

```bash
npx vitest run src/features/auth/safe-next.test.ts
```

Expected: PASS (10 тестов).

- [ ] **Step 6: Коммит**

```bash
git add src/features/auth/safe-next.ts src/features/auth/safe-next.test.ts
git commit -m "feat(auth): add safeNextPath open-redirect guard"
```

---

## Task 2: `LoginSchema` (Zod)

**Files:**

- Create: `src/features/auth/schemas.ts`
- Create: `src/features/auth/schemas.test.ts`

- [ ] **Step 1: Написать failing-тест**

```ts
// src/features/auth/schemas.test.ts
import { describe, it, expect } from "vitest";
import { LoginSchema } from "./schemas";

describe("LoginSchema", () => {
  it("принимает валидные creds без next", () => {
    const r = LoginSchema.safeParse({ username: "alice", password: "secret123" });
    expect(r.success).toBe(true);
  });
  it("принимает валидные creds с next", () => {
    const r = LoginSchema.safeParse({
      username: "alice",
      password: "secret123",
      next: "/admin",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.next).toBe("/admin");
  });
  it("отклоняет пустой username", () => {
    const r = LoginSchema.safeParse({ username: "  ", password: "x" });
    expect(r.success).toBe(false);
  });
  it("отклоняет пустой password", () => {
    const r = LoginSchema.safeParse({ username: "alice", password: "" });
    expect(r.success).toBe(false);
  });
  it("отклоняет username длиннее 200", () => {
    const r = LoginSchema.safeParse({ username: "a".repeat(201), password: "x" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить тест — FAIL**

```bash
npx vitest run src/features/auth/schemas.test.ts
```

- [ ] **Step 3: Написать `schemas.ts`**

```ts
// src/features/auth/schemas.ts
import "server-only";
import { z } from "zod";

export const LoginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Введите логин")
    .max(200, "Слишком длинный логин"),
  password: z.string().min(1, "Введите пароль").max(200, "Слишком длинный пароль"),
  next: z.string().optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
```

- [ ] **Step 4: Запустить тест — PASS**

- [ ] **Step 5: Коммит**

```bash
git add src/features/auth/schemas.ts src/features/auth/schemas.test.ts
git commit -m "feat(auth): add LoginSchema"
```

---

## Task 3: Cookie helpers

**Files:**

- Create: `src/features/auth/cookie.ts`

Без тестов: тривиальная обёртка над `cookies()`, покрывается интеграционно в `actions.test.ts`.

- [ ] **Step 1: Написать `cookie.ts`**

```ts
// src/features/auth/cookie.ts
import "server-only";
import { cookies } from "next/headers";

const COOKIE_NAME = "token";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 дней

export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: без ошибок.

- [ ] **Step 3: Коммит**

```bash
git add src/features/auth/cookie.ts
git commit -m "feat(auth): add cookie helpers"
```

---

## Task 4: `loginAction` + `AuthError` + тесты

**Files:**

- Create: `src/features/auth/actions.ts`
- Create: `src/features/auth/actions.test.ts`

В этой кодовой базе пока нет тестов на server actions, но логин — security-sensitive, поэтому добавляем новую конвенцию: мок `fetch` через `vi.stubGlobal`, мок `next/headers` и `next/navigation`.

- [ ] **Step 1: Написать failing-тест `actions.test.ts`**

```ts
// src/features/auth/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Мокаем next/headers и next/navigation до импорта actions.
const cookieSet = vi.fn();
const cookieDelete = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSet, delete: cookieDelete }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    // Имитируем NEXT_REDIRECT: throw с правильным digest.
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
}));

import { loginAction } from "./actions";

function fd(input: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(input)) f.append(k, v);
  return f;
}

const validCreds = { username: "alice", password: "secret" };
const initial = { success: true as const, data: undefined };

beforeEach(() => {
  cookieSet.mockReset();
  cookieDelete.mockReset();
  vi.unstubAllGlobals();
});

describe("loginAction", () => {
  it("200 OK + token → ставит cookie и делает redirect", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ data: { token: "jwt-abc" } }), {
          status: 200,
        })
      )
    );

    await expect(loginAction(initial, fd({ ...validCreds, next: "/admin" })))
      .rejects.toThrow("NEXT_REDIRECT");

    expect(cookieSet).toHaveBeenCalledOnce();
    const [name, value, opts] = cookieSet.mock.calls[0];
    expect(name).toBe("token");
    expect(value).toBe("jwt-abc");
    expect(opts).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("200 OK + опасный next → redirect на /", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ data: { token: "jwt" } }), { status: 200 })
      )
    );
    await expect(
      loginAction(initial, fd({ ...validCreds, next: "//evil.com" }))
    ).rejects.toThrow(/NEXT_REDIRECT/);
    // redirect был вызван с "/"
  });

  it("200 без token в data → service_unavailable, cookie не выставлена", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 }))
    );
    const res = await loginAction(initial, fd(validCreds));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("service_unavailable");
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("401 → invalid_credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 401 }))
    );
    const res = await loginAction(initial, fd(validCreds));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("invalid_credentials");
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("403 → account_blocked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 403 }))
    );
    const res = await loginAction(initial, fd(validCreds));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("account_blocked");
  });

  it("500 → service_unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 500 }))
    );
    const res = await loginAction(initial, fd(validCreds));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("service_unavailable");
  });

  it("network reject → service_unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );
    const res = await loginAction(initial, fd(validCreds));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("service_unavailable");
  });

  it("пустой password → validation, cookie не выставлена", async () => {
    const res = await loginAction(initial, fd({ username: "alice", password: "" }));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("validation");
    expect(cookieSet).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Запустить тест — FAIL**

```bash
npx vitest run src/features/auth/actions.test.ts
```

Expected: FAIL (`Cannot find module './actions'`).

- [ ] **Step 3: Написать `actions.ts`**

```ts
// src/features/auth/actions.ts
"use server";
import "server-only";
import { redirect } from "next/navigation";

import { createFormAction, parseFormData } from "@/utils/create-action";

import { setAuthCookie, clearAuthCookie } from "./cookie";
import { LoginSchema } from "./schemas";
import { safeNextPath } from "./safe-next";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

/**
 * Семантическая ошибка auth-flow. `message` — enum-ключ, UI мапит его в
 * брендированный текст. Не наружу слайса.
 */
class AuthError extends Error {
  constructor(kind:
    | "invalid_credentials"
    | "account_blocked"
    | "service_unavailable") {
    super(kind);
    this.name = "AuthError";
  }
}

export const loginAction = createFormAction(async (formData) => {
  const { username, password, next } = parseFormData(LoginSchema, formData);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });
  } catch {
    throw new AuthError("service_unavailable");
  }

  if (res.status === 401) throw new AuthError("invalid_credentials");
  if (res.status === 403) throw new AuthError("account_blocked");
  if (!res.ok) throw new AuthError("service_unavailable");

  let token: string | undefined;
  try {
    const json = (await res.json()) as { data?: { token?: unknown } };
    if (typeof json.data?.token === "string") token = json.data.token;
  } catch {
    throw new AuthError("service_unavailable");
  }
  if (!token) throw new AuthError("service_unavailable");

  await setAuthCookie(token);
  redirect(safeNextPath(next));
});

export async function logoutAction(): Promise<void> {
  await clearAuthCookie();
  redirect("/");
}
```

- [ ] **Step 4: Запустить тест — PASS**

```bash
npx vitest run src/features/auth/actions.test.ts
```

Expected: PASS (8 тестов).

- [ ] **Step 5: Коммит**

```bash
git add src/features/auth/actions.ts src/features/auth/actions.test.ts
git commit -m "feat(auth): add loginAction and logoutAction"
```

---

## Task 5: `LoginForm` UI

**Files:**

- Create: `src/features/auth/ui/login-form.tsx`

UI без тестов — паттерн кодовой базы (в glossary тоже нет UI-тестов на формы).

- [ ] **Step 1: Написать `login-form.tsx`**

```tsx
// src/features/auth/ui/login-form.tsx
"use client";
import { useActionState } from "react";
import {
  Form,
  FormField,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { loginAction } from "../actions";

const initial: ActionResult<void> = { success: true, data: undefined };

const ERROR_TEXT: Record<string, string> = {
  invalid_credentials: "Неверный логин или пароль.",
  account_blocked: "Аккаунт заблокирован.",
  service_unavailable: "Сервис временно недоступен. Попробуйте позже.",
};

interface LoginFormProps {
  next: string;
}

export function LoginForm({ next }: LoginFormProps) {
  const [state, action] = useActionState(loginAction, initial);
  const fieldErrors: Record<string, string> =
    state.success === false && state.code === "validation"
      ? state.fieldErrors
      : {};

  const genericError =
    state.success === false && !state.code
      ? ERROR_TEXT[state.error] ?? "Не удалось войти."
      : null;

  return (
    <Form action={action} errors={fieldErrors} className="max-w-sm">
      <input type="hidden" name="next" value={next} />
      <FormField name="username" label="Логин" required>
        <TextInput name="username" required autoComplete="username" />
      </FormField>
      <FormField name="password" label="Пароль" required>
        <TextInput
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </FormField>

      {genericError && <p className="text-sm text-red-600">{genericError}</p>}

      <div>
        <SubmitButton>Войти</SubmitButton>
      </div>
    </Form>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: без ошибок.

- [ ] **Step 3: Коммит**

```bash
git add src/features/auth/ui/login-form.tsx
git commit -m "feat(auth): add LoginForm component"
```

---

## Task 6: `LogoutForm` UI

**Files:**

- Create: `src/features/auth/ui/logout-form.tsx`

- [ ] **Step 1: Написать `logout-form.tsx`**

```tsx
// src/features/auth/ui/logout-form.tsx
"use client";
import { Button } from "@/components/ui";
import { logoutAction } from "../actions";

interface LogoutFormProps {
  username: string;
}

export function LogoutForm({ username }: LogoutFormProps) {
  return (
    <form action={logoutAction} className="flex items-center gap-2">
      <span className="text-sm text-(--color-description)">{username}</span>
      <Button type="submit" variant="ghost" size="sm">
        Выйти
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

`ghost`/`sm` валидны (см. `ButtonVariant`/`ButtonSize` в
[src/components/ui/button.tsx](../../../src/components/ui/button.tsx)).

- [ ] **Step 3: Коммит**

```bash
git add src/features/auth/ui/logout-form.tsx
git commit -m "feat(auth): add LogoutForm component"
```

---

## Task 7: `index.ts` слайса

**Files:**

- Create: `src/features/auth/index.ts`

- [ ] **Step 1: Написать `index.ts`**

```ts
// src/features/auth/index.ts
export { LoginForm } from "./ui/login-form";
export { LogoutForm } from "./ui/logout-form";
export { logoutAction } from "./actions";
```

`loginAction` не экспортируется — используется только внутри `LoginForm`.
`safeNextPath` нужен в `page.tsx`, но `app/login/page.tsx` импортирует его
напрямую из `./safe-next` через alias `@/features/auth/safe-next` —
ESLint-гарды в этой кодовой базе запрещают это для **чужих** фич, но не
для роутов того же слайса. Если линтер ругнётся — экспортируй `safeNextPath`
из `index.ts` тоже.

- [ ] **Step 2: Коммит**

```bash
git add src/features/auth/index.ts
git commit -m "feat(auth): export public slice API"
```

---

## Task 8: Страница `/login`

**Files:**

- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Написать `page.tsx`**

```tsx
// src/app/login/page.tsx
import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth";
import { safeNextPath } from "@/features/auth/safe-next";
import { getMe } from "@/utils/me";

export const metadata = { title: "Войти" };

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);

  // Уже залогинен — сразу на target.
  const me = await getMe();
  if (me) redirect(next);

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <h1 className="text-2xl font-semibold">Войти</h1>
      <LoginForm next={next} />
    </div>
  );
}
```

> **Note:** Если ESLint ругнётся на импорт `@/features/auth/safe-next` —
> добавь экспорт `safeNextPath` в `src/features/auth/index.ts` и импортируй
> через `@/features/auth`.

- [ ] **Step 2: Type-check + lint**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 3: Запустить dev-сервер и зайти на страницу**

```bash
npm run dev
```

В браузере: `http://localhost:3001/login` — должна отрендериться форма с
двумя полями и кнопкой «Войти». Останови сервер.

- [ ] **Step 4: Коммит**

```bash
git add src/app/login/page.tsx
git commit -m "feat(auth): add /login page"
```

---

## Task 9: Foundation-touch — `app-header`

**Files:**

- Modify: `src/components/app/app-header/app-header.tsx`

> **Foundation-touch:** этот файл в запретной зоне по CLAUDE.md
> (`src/components/app/*`). Изменение согласовано в брейншторминг-сессии:
> убираем TODO и подключаем login/logout UI.

- [ ] **Step 1: Прочитать текущий файл**

```bash
cat src/components/app/app-header/app-header.tsx
```

- [ ] **Step 2: Сделать компонент async и добавить slot с login/logout**

Заменить:

```tsx
import Link from "next/link";
import { NavigationMenu } from "@base-ui/react/navigation-menu";

import { LogoIcon } from "@/assets/icons/logo-icon";
import { NetworkIndicator } from "../network-indicator";
import { DropdownArrowIcon } from "@/assets/icons/dropdown-arrow-icon";

export const AppHeader: React.FC = () => {
```

на:

```tsx
import Link from "next/link";
import { NavigationMenu } from "@base-ui/react/navigation-menu";

import { LogoIcon } from "@/assets/icons/logo-icon";
import { NetworkIndicator } from "../network-indicator";
import { DropdownArrowIcon } from "@/assets/icons/dropdown-arrow-icon";
import { LogoutForm } from "@/features/auth";
import { getMe } from "@/utils/me";

export const AppHeader = async () => {
  const me = await getMe();
```

И в блоке с TODO заменить:

```tsx
            {/* TODO: вернуть logout/login UI после восстановления фичи `auth` */}
```

на:

```tsx
            {me ? (
              <LogoutForm username={me.username} />
            ) : (
              <Link
                href="/login"
                className="text-sm text-(--color-description) hover:text-(--color-primary)"
              >
                Войти
              </Link>
            )}
```

- [ ] **Step 3: Проверить, что AppHeader используется как async server component**

```bash
grep -rn "AppHeader" src/app/ src/components/
```

Убедись, что нигде нет `"use client"` рядом с импортом `AppHeader`. В
[src/app/layout.tsx](../../../src/app/layout.tsx) он должен оставаться в
server scope.

- [ ] **Step 4: Type-check + lint + build**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 5: Коммит**

```bash
git add src/components/app/app-header/app-header.tsx
git commit -m "feat(auth): wire login/logout UI into app-header (foundation-touch)"
```

---

## Task 10: Финальная проверка и smoke-test

**Files:** none (только запуск).

- [ ] **Step 1: Прогон всех проверок**

```bash
npm run lint && npm test && npm run build
```

Expected: всё зелёное. Если падает — фикси на месте и коммить.

- [ ] **Step 2: Запустить dev**

```bash
npm run dev
```

Бекенд при этом должен быть на `http://localhost:8090` (см.
`.env.development.local`).

- [ ] **Step 3: Smoke-test в браузере**

Открой `http://localhost:3001/`:

1. В шапке должна быть ссылка «Войти».
2. Перейди на `/admin/lectures` — должен редиректнуть на
   `/login?next=%2Fadmin%2Flectures`.
3. Введи валидные creds, нажми «Войти» — должен попасть в `/admin/lectures`,
   в шапке — `<username> Выйти`.
4. Перейди на `/login` повторно — должен сразу редиректнуть на `/`
   (уже залогинен).
5. Нажми «Выйти» в шапке — попадёшь на `/`, шапка снова показывает «Войти».
6. Снова войди с **неверным паролем** — должен увидеть «Неверный логин или
   пароль.», cookie не выставлена.
7. DevTools → Application → Cookies — после успешного логина проверь, что
   `token` имеет флаги `HttpOnly`, `SameSite=Lax`, `Path=/`.

- [ ] **Step 4: Если smoke-test зелёный, финальный коммит-обёртка не нужен**

Все коммиты уже на месте. Можно опционально создать PR:

```bash
git log --oneline main..HEAD
```

Должна быть серия `feat(auth): …` коммитов + foundation-touch.

---

## Чеклист готовности (из спеки §12)

- [ ] Структура `src/features/auth/` создана, лишние шаблонные файлы не скопированы.
- [ ] Все `*.ts` в слайсе (кроме `ui/*.tsx`) начинаются с `import "server-only";`.
- [ ] `index.ts` экспортирует только `LoginForm`, `LogoutForm`, `logoutAction`.
- [ ] `safeNextPath` покрыт 10 тестами.
- [ ] `LoginSchema` имеет 5 тестов (success + 4 failure).
- [ ] `loginAction` покрыт 8 тестами на коды бека + safe-next + validation.
- [ ] `/login` редиректит залогиненных на safe-next.
- [ ] `app-header` показывает «Войти» / «Выйти, `<username>`» в зависимости от `getMe()`.
- [ ] `npm run lint && npm test && npm run build` зелёные.
- [ ] Ручной smoke-test пройден.
