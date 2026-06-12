# Auth Register (страница регистрации) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-service регистрация: страница `/register` (username + password + подтверждение), `registerAction` поверх `POST /api/auth/register`, после успеха — редирект на `/login` с сообщением «Регистрация прошла успешно», перекрёстные ссылки login ↔ register.

**Architecture:** Расширение существующего слайса `src/features/auth/` строго по его собственным паттернам (auth — инфраструктурный flow без доменной сущности: `fetch` прямо в `actions.ts`, семантический `AuthError(kind)` вместо расширения `ActionResult`, без `permissions.ts`/`api.ts`/`revalidateEntity`). `registerAction` — зеркало `loginAction`, но бек на 201 возвращает `user.User` **без токена** (проверено: `philosophy-api/internal/user/handler.go:31-45`, `service.go:33-57`), поэтому автологина нет — редирект на `/login?registered=1&next=…` через `safeNextPath`.

**Tech Stack:** Next.js server actions (`createFormAction` + `parseFormData`), Zod v4 (`superRefine` для подтверждения пароля), Base UI Form-обёртки из `@/components/ui`, vitest.

---

## Контракт бекенда (проверено по коду philosophy-api, не только schema.ts)

`POST /api/auth/register` — публичный, без auth (`cmd/server/main.go:1039`), под login-rate-limiter'ом 10 req/min (`main.go:863` → 429 при превышении).

Request (`internal/user/request.go:6-9`):

```json
{ "username": "<3..30 символов, required>", "password": "<min 6, required>" }
```

Ответы:

| Код | Когда | Что делает фронт |
| --- | --- | --- |
| 201 | создан; `data` = `user.User` (role=`user`, status=`active`), **токена нет** | redirect на `/login?registered=1&next=…` |
| 400 | битый JSON | `invalid_input` |
| 409 | username занят (`apperror.Conflict("username already exists")`, `service.go:37`) | `username_taken` |
| 413 | body > лимита (на практике недостижимо с нашей формой) | `service_unavailable` (ветка `!res.ok`) |
| 422 | валидация бека (front-схема зеркалит правила, в норме недостижимо) | `invalid_input` |
| 429 | rate limit | `too_many_requests` |
| 5xx / network | — | `service_unavailable` |

Capabilities: эндпоинт публичный, capability-чеков нет ни на беке, ни на фронте — `permissions.ts` не нужен (как и для login, см. `docs/superpowers/specs/2026-05-16-auth-feature-design.md` §4).

Доп. факт: bcrypt (`GenerateFromPassword`) ограничен 72 байтами пароля — больше 72 даст 500 от бека, поэтому front-схема ставит `max(72)` на пароль.

---

## Parallel-safety contract

Этот план выполняется в собственном worktree параллельно с другими фичами волны 1. Файлы, которых касается ТОЛЬКО этот план:

- Создаёт (новые файлы — collision невозможен):
  - `src/app/register/page.tsx`
  - `src/features/auth/ui/register-form.tsx`
- Модифицирует:
  - `src/features/auth/schemas.ts` — добавляет `RegisterSchema`.
  - `src/features/auth/schemas.test.ts` — тесты `RegisterSchema`.
  - `src/features/auth/actions.ts` — расширяет union `AuthError`, добавляет `registerAction`.
  - `src/features/auth/actions.test.ts` — тесты `registerAction`.
  - `src/features/auth/index.ts` — экспорт `RegisterForm`.
  - `src/app/login/page.tsx` — ссылка «Нет аккаунта?» + notice `registered=1`.

**Резервирует за собой** (другие фичи волны 1 эти пути не трогают):

- `src/features/auth/**` — целиком.
- `src/app/login/**`
- `src/app/register/**`

**НЕ трогает:**

- `src/components/app/app-header/app-header.tsx` — ссылка `/register` в шапке (если будет решена) — батч foundation-touch волны 1, не этот план.
- `src/proxy.ts`, `src/utils/*` (включая `create-action.ts`, `me.ts`), `src/api/*` — не требуются.

**Frozen zones** (по `CLAUDE.md`): `src/api/schema.ts`, `src/app/layout.tsx`, `src/components/ui/*`, `src/utils/*`, `package.json`, `eslint.config.mjs` — не трогать.

**Параллельная работа агентов** (CLAUDE.md, передавать всем субагентам дословно): запрещены `git stash` / `git reset` / `git checkout .` / `git clean` и прочие деструктивные git-операции; запрещён `git add -A` / `git add .` — только `git add` своих файлов по имени; не откатывать и не перезаписывать чужие изменения.

---

## Файловая структура после плана

```
src/features/auth/
├── index.ts              # MODIFIED: + export RegisterForm
├── schemas.ts            # MODIFIED: + RegisterSchema
├── schemas.test.ts       # MODIFIED: + describe("RegisterSchema")
├── actions.ts            # MODIFIED: + registerAction, AuthError union расширен
├── actions.test.ts       # MODIFIED: + describe("registerAction")
├── cookie.ts             # не меняется
├── safe-next.ts          # не меняется (переиспользуется registerAction'ом)
├── safe-next.test.ts     # не меняется
└── ui/
    ├── login-form.tsx    # не меняется
    ├── logout-form.tsx   # не меняется
    └── register-form.tsx # NEW

src/app/
├── login/page.tsx        # MODIFIED: notice + кросс-ссылка
└── register/page.tsx     # NEW
```

---

## Task 1: RegisterSchema

**Files:**
- Modify: `src/features/auth/schemas.ts`
- Test: `src/features/auth/schemas.test.ts`

Схема зеркалит правила бека (`username` 3–30 после trim, `password` ≥ 6) + front-only ограничение `max(72)` (bcrypt-лимит бека) + front-only поле `password_confirm` с проверкой совпадения через `superRefine` с явным `path: ["password_confirm"]` (ошибка попадёт в `fieldErrors.password_confirm`, а не в `_form`).

- [x] **Step 1: Дописать failing-тесты в `schemas.test.ts`**

В конец файла `src/features/auth/schemas.test.ts` добавить блок (и расширить import в первой строке):

```ts
// Первая строка import меняется с:
//   import { LoginSchema } from "./schemas";
// на:
import { LoginSchema, RegisterSchema } from "./schemas";
```

```ts
describe("RegisterSchema", () => {
  const valid = {
    username: "alice",
    password: "secret1",
    password_confirm: "secret1",
  };

  it("принимает валидные данные с совпадающими паролями", () => {
    const r = RegisterSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("принимает next и trim'ит username", () => {
    const r = RegisterSchema.safeParse({
      ...valid,
      username: "  alice  ",
      next: "/admin",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.username).toBe("alice");
      expect(r.data.next).toBe("/admin");
    }
  });

  it("отклоняет username короче 3 символов", () => {
    const r = RegisterSchema.safeParse({ ...valid, username: "ab" });
    expect(r.success).toBe(false);
  });

  it("отклоняет username длиннее 30 символов", () => {
    const r = RegisterSchema.safeParse({ ...valid, username: "a".repeat(31) });
    expect(r.success).toBe(false);
  });

  it("отклоняет пароль короче 6 символов", () => {
    const r = RegisterSchema.safeParse({
      ...valid,
      password: "12345",
      password_confirm: "12345",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет пароль длиннее 72 символов", () => {
    const long = "a".repeat(73);
    const r = RegisterSchema.safeParse({
      ...valid,
      password: long,
      password_confirm: long,
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет несовпадающие пароли с ошибкой на password_confirm", () => {
    const r = RegisterSchema.safeParse({
      ...valid,
      password_confirm: "another7",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find(
        (i) => i.path.join(".") === "password_confirm"
      );
      expect(issue?.message).toBe("Пароли не совпадают");
    }
  });
});
```

- [x] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/features/auth/schemas.test.ts`
Expected: FAIL — `RegisterSchema` не экспортируется из `./schemas` (SyntaxError / undefined).

- [x] **Step 3: Реализовать `RegisterSchema`**

В конец `src/features/auth/schemas.ts` (после `LoginInput`) добавить:

```ts
export const RegisterSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Логин — минимум 3 символа")
      .max(30, "Логин — максимум 30 символов"),
    password: z
      .string()
      .min(6, "Пароль — минимум 6 символов")
      .max(72, "Слишком длинный пароль"),
    password_confirm: z.string(),
    next: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.password_confirm) {
      ctx.addIssue({
        code: "custom",
        path: ["password_confirm"],
        message: "Пароли не совпадают",
      });
    }
  });

export type RegisterInput = z.infer<typeof RegisterSchema>;
```

- [x] **Step 4: Убедиться, что тесты зелёные**

Run: `npx vitest run src/features/auth/schemas.test.ts`
Expected: PASS — все тесты `LoginSchema` и `RegisterSchema` зелёные.

- [x] **Step 5: Commit**

```bash
git add src/features/auth/schemas.ts src/features/auth/schemas.test.ts
git commit -m "feat(auth): add RegisterSchema with password confirmation"
```

---

## Task 2: registerAction

**Files:**
- Modify: `src/features/auth/actions.ts`
- Test: `src/features/auth/actions.test.ts`

По образцу `loginAction`: `parseFormData` → `fetch` → маппинг статусов в `AuthError(kind)`. Отличия: на 201 cookie **не ставим** (токена нет), редиректим на `/login?registered=1` с прокинутым `next` (через `safeNextPath`; дефолтный `/` в URL не дублируем).

- [x] **Step 1: Дописать failing-тесты в `actions.test.ts`**

В `src/features/auth/actions.test.ts` расширить import:

```ts
// Строка `import { loginAction } from "./actions";` меняется на:
import { loginAction, registerAction } from "./actions";
```

В конец файла добавить:

```ts
const validReg = {
  username: "alice",
  password: "secret1",
  password_confirm: "secret1",
};

describe("registerAction", () => {
  it("201 + next → redirect на /login?registered=1&next=…, cookie не выставлена", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ data: { id: "u1", username: "alice" } }),
          { status: 201 }
        )
      )
    );
    let thrown: Error & { digest?: string } = new Error("not thrown");
    try {
      await registerAction(initial, fd({ ...validReg, next: "/admin" }));
    } catch (e) {
      thrown = e as Error & { digest?: string };
    }
    expect(thrown.digest).toBe(
      "NEXT_REDIRECT;/login?registered=1&next=%2Fadmin"
    );
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("201 без next → redirect на /login?registered=1", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ data: { id: "u1" } }), { status: 201 })
      )
    );
    let thrown: Error & { digest?: string } = new Error("not thrown");
    try {
      await registerAction(initial, fd(validReg));
    } catch (e) {
      thrown = e as Error & { digest?: string };
    }
    expect(thrown.digest).toBe("NEXT_REDIRECT;/login?registered=1");
  });

  it("201 + опасный next → next отбрасывается (redirect без next)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ data: { id: "u1" } }), { status: 201 })
      )
    );
    let thrown: Error & { digest?: string } = new Error("not thrown");
    try {
      await registerAction(initial, fd({ ...validReg, next: "//evil.com" }));
    } catch (e) {
      thrown = e as Error & { digest?: string };
    }
    expect(thrown.digest).toBe("NEXT_REDIRECT;/login?registered=1");
  });

  it("409 → username_taken", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 409 }))
    );
    const res = await registerAction(initial, fd(validReg));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("username_taken");
  });

  it("422 → invalid_input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 422 }))
    );
    const res = await registerAction(initial, fd(validReg));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("invalid_input");
  });

  it("429 → too_many_requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rate limit exceeded", { status: 429 }))
    );
    const res = await registerAction(initial, fd(validReg));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("too_many_requests");
  });

  it("500 → service_unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 500 }))
    );
    const res = await registerAction(initial, fd(validReg));
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
    const res = await registerAction(initial, fd(validReg));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("service_unavailable");
  });

  it("пароли не совпадают → validation, fetch не вызван", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await registerAction(
      initial,
      fd({ username: "alice", password: "secret1", password_confirm: "other77" })
    );
    expect(res.success).toBe(false);
    if (res.success || res.code !== "validation") {
      throw new Error("expected validation error");
    }
    expect(res.fieldErrors["password_confirm"]).toBe("Пароли не совпадают");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/features/auth/actions.test.ts`
Expected: FAIL — `registerAction` не экспортируется из `./actions`.

- [x] **Step 3: Реализовать `registerAction`**

В `src/features/auth/actions.ts`:

1. Расширить import схем:

```ts
// Строка `import { LoginSchema } from "./schemas";` меняется на:
import { LoginSchema, RegisterSchema } from "./schemas";
```

2. Расширить union `AuthError` (класс уже есть, меняется только сигнатура конструктора):

```ts
/**
 * Семантическая ошибка auth-flow. `message` — enum-ключ, UI мапит его в
 * брендированный текст. Не наружу слайса.
 */
class AuthError extends Error {
  constructor(kind:
    | "invalid_credentials"
    | "account_blocked"
    | "service_unavailable"
    | "username_taken"
    | "invalid_input"
    | "too_many_requests") {
    super(kind);
    this.name = "AuthError";
  }
}
```

3. Добавить action после `loginAction` (перед `logoutAction`):

```ts
/**
 * Регистрация. Бек на 201 возвращает user.User БЕЗ токена
 * (philosophy-api/internal/user/handler.go: Register → WriteJSON(201, u)),
 * поэтому автологина нет — редиректим на /login с success-флагом,
 * сохраняя next. 409 = username занят; 400/422 в норме недостижимы
 * (RegisterSchema зеркалит правила бека); 429 = login-rate-limiter.
 */
export const registerAction = createFormAction<void>(async (formData) => {
  const { username, password, next } = parseFormData(RegisterSchema, formData);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });
  } catch {
    throw new AuthError("service_unavailable");
  }

  if (res.status === 409) throw new AuthError("username_taken");
  if (res.status === 400 || res.status === 422) {
    throw new AuthError("invalid_input");
  }
  if (res.status === 429) throw new AuthError("too_many_requests");
  if (!res.ok) throw new AuthError("service_unavailable");

  const safeNext = safeNextPath(next);
  const loginUrl =
    safeNext === "/"
      ? "/login?registered=1"
      : `/login?registered=1&next=${encodeURIComponent(safeNext)}`;
  redirect(loginUrl);
});
```

- [x] **Step 4: Убедиться, что тесты зелёные**

Run: `npx vitest run src/features/auth/actions.test.ts`
Expected: PASS — все тесты `loginAction` и `registerAction` зелёные.

- [x] **Step 5: Commit**

```bash
git add src/features/auth/actions.ts src/features/auth/actions.test.ts
git commit -m "feat(auth): add registerAction (no auto-login, redirect to /login)"
```

---

## Task 3: RegisterForm + экспорт из слайса

**Files:**
- Create: `src/features/auth/ui/register-form.tsx`
- Modify: `src/features/auth/index.ts`

Client-компонент по образцу `ui/login-form.tsx`. Unit-тесты на UI-компоненты по конвенциям проекта не пишутся (`docs/frontend-conventions.md` §5) — поведение покрыто тестами action и схемы.

- [x] **Step 1: Создать `register-form.tsx`**

```tsx
// src/features/auth/ui/register-form.tsx
"use client";
import { useActionState } from "react";
import {
  Form,
  FormField,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { registerAction } from "../actions";

const initial: ActionResult<void> = { success: true, data: undefined };

const ERROR_TEXT: Record<string, string> = {
  username_taken: "Это имя пользователя уже занято.",
  invalid_input: "Проверьте правильность заполнения полей.",
  too_many_requests: "Слишком много попыток. Попробуйте позже.",
  service_unavailable: "Сервис временно недоступен. Попробуйте позже.",
};

interface RegisterFormProps {
  next: string;
}

export function RegisterForm({ next }: RegisterFormProps) {
  const [state, action] = useActionState(registerAction, initial);
  const fieldErrors: Record<string, string> =
    state.success === false && state.code === "validation"
      ? state.fieldErrors
      : {};

  const genericError =
    state.success === false && !state.code
      ? ERROR_TEXT[state.error] ?? "Не удалось зарегистрироваться."
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
          autoComplete="new-password"
        />
      </FormField>
      <FormField name="password_confirm" label="Повторите пароль" required>
        <TextInput
          name="password_confirm"
          type="password"
          required
          autoComplete="new-password"
        />
      </FormField>

      {genericError && <p className="text-sm text-red-600">{genericError}</p>}

      <div>
        <SubmitButton>Зарегистрироваться</SubmitButton>
      </div>
    </Form>
  );
}
```

- [x] **Step 2: Экспортировать из `index.ts`**

`src/features/auth/index.ts` целиком после правки:

```ts
// src/features/auth/index.ts
export { LoginForm } from "./ui/login-form";
export { LogoutForm } from "./ui/logout-form";
export { RegisterForm } from "./ui/register-form";
export { logoutAction } from "./actions";
export { safeNextPath } from "./safe-next";
```

`registerAction` наружу не экспортируется — он нужен только `RegisterForm` (как `loginAction` для `LoginForm`).

- [x] **Step 3: Проверить lint и тесты слайса**

Run: `npm run lint && npx vitest run src/features/auth`
Expected: lint без ошибок, все тесты слайса PASS.

- [x] **Step 4: Commit**

```bash
git add src/features/auth/ui/register-form.tsx src/features/auth/index.ts
git commit -m "feat(auth): add RegisterForm component"
```

---

## Task 4: страница /register

**Files:**
- Create: `src/app/register/page.tsx`

По образцу `src/app/login/page.tsx`: `next` через `safeNextPath`, залогиненных редиректим на target, плюс обратная ссылка на `/login` с сохранением `next`.

- [x] **Step 1: Создать страницу**

```tsx
// src/app/register/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm, safeNextPath } from "@/features/auth";
import { getMe } from "@/utils/me";

export const metadata = { title: "Регистрация" };

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const { next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);

  // Уже залогинен — сразу на target.
  const me = await getMe();
  if (me) redirect(next);

  const loginHref =
    next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <h1 className="text-2xl font-semibold">Регистрация</h1>
      <RegisterForm next={next} />
      <p className="text-sm text-(--color-description)">
        Уже есть аккаунт?{" "}
        <Link href={loginHref} className="underline">
          Войдите
        </Link>
      </p>
    </div>
  );
}
```

- [x] **Step 2: Проверить lint**

Run: `npm run lint`
Expected: без ошибок (импорт слайса только через `@/features/auth` — deep-import guard доволен).

- [x] **Step 3: Commit**

```bash
git add src/app/register/page.tsx
git commit -m "feat(auth): add /register page"
```

---

## Task 5: кросс-ссылка и success-notice на /login

**Files:**
- Modify: `src/app/login/page.tsx`

Два изменения: (1) ссылка «Нет аккаунта? Зарегистрируйтесь» с сохранением `next`; (2) при `?registered=1` — branded-сообщение об успешной регистрации (его ставит `registerAction`).

- [ ] **Step 1: Обновить страницу `/login`**

`src/app/login/page.tsx` целиком после правки:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm, safeNextPath } from "@/features/auth";
import { getMe } from "@/utils/me";

export const metadata = { title: "Войти" };

interface PageProps {
  searchParams: Promise<{ next?: string; registered?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { next: rawNext, registered } = await searchParams;
  const next = safeNextPath(rawNext);

  // Уже залогинен — сразу на target.
  const me = await getMe();
  if (me) redirect(next);

  const registerHref =
    next === "/" ? "/register" : `/register?next=${encodeURIComponent(next)}`;

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <h1 className="text-2xl font-semibold">Войти</h1>
      {registered === "1" && (
        <p role="status" className="text-sm text-green-600">
          Регистрация прошла успешно. Войдите с вашим логином и паролем.
        </p>
      )}
      <LoginForm next={next} />
      <p className="text-sm text-(--color-description)">
        Нет аккаунта?{" "}
        <Link href={registerHref} className="underline">
          Зарегистрируйтесь
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Проверить lint**

Run: `npm run lint`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(auth): cross-link login/register and registered notice"
```

---

## Task 6: финальная верификация

**Files:** нет новых изменений (если верификация ничего не выявит).

- [ ] **Step 1: Полный прогон**

Run: `npm run lint && npm test && npm run build`
Expected: все три команды зелёные. В `npm test` среди прочих:
- `src/features/auth/schemas.test.ts` — LoginSchema (5) + RegisterSchema (7);
- `src/features/auth/actions.test.ts` — loginAction (8) + registerAction (9);
- `src/features/auth/safe-next.test.ts` — без изменений.

В `npm run build` появляются маршруты `/register` (и прежний `/login`).

- [ ] **Step 2: Чеклист готовности фичи** (`src/features/_template/README.md`, с поправкой на стиль слайса auth)

- `index.ts` экспортирует только нужное снаружи (`RegisterForm` добавлен, `registerAction` — нет).
- `schemas.ts`, `actions.ts` начинаются с `import "server-only";` (уже так — файлы только дополнялись).
- `permissions.ts` отсутствует осознанно: register/login публичны, capability-чеков нет (auth-design §4).
- `RegisterSchema` — success + failure тесты есть.
- `createFormAction` + `parseFormData` используются; `requireCapability`/`revalidateEntity` не применимы (нет capability, нет кешируемой сущности).
- Нет импортов других `@/features/*`.
- UI-файл `ui/register-form.tsx` добавлен.

- [ ] **Step 3: Ручная проверка** (если поднят бек на `API_URL`)

1. `/register` → форма; регистрация нового username → редирект на `/login?registered=1`, зелёный notice, логин этими credentials работает.
2. Повторная регистрация того же username → «Это имя пользователя уже занято.»
3. Пароли не совпадают → ошибка у поля «Повторите пароль», запрос на бек не уходит.
4. `/register?next=/admin` → после регистрации и логина попадаем в `/admin`.
5. Залогиненным открыть `/register` → мгновенный редирект.

- [ ] **Step 4: Финальный коммит (только если были фиксы на шагах 1–3)**

```bash
git add <конкретные исправленные файлы по имени>
git commit -m "fix(auth): post-verification fixes for register flow"
```

---

## Отклонения от шаблона слайса (зафиксированы сознательно)

Слайс auth исторически (auth-design 2026-05-16 §4) не использует: `api.ts` (fetch в actions), `permissions.ts` (публичные flow), `types.ts`, `revalidateEntity` (нет сущности). Этот план следует стилю слайса, а не `_template`. `AuthError(kind)` — локальный контракт слайса: ключ уходит в `ActionResult.error`, UI мапит в брендированный русский текст.
