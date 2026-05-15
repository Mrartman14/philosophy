# Auth feature — login & logout (frontend)

**Дата:** 2026-05-16
**Автор:** brainstorming-сессия (Claude + alexander.borisenko)
**Статус:** Design — ожидает review

## 1. Проблема

На фронте сейчас нет UI для логина и logout. Бекенд отдаёт JWT через
`POST /api/auth/login`, фронт читает токен из cookie `token`
([src/api/client.ts:8](../../../src/api/client.ts#L8),
[src/utils/me.ts:44](../../../src/utils/me.ts#L44)), но получить cookie
обычным способом из браузера нельзя — нет страницы логина.

[src/proxy.ts:24](../../../src/proxy.ts#L24) уже редиректит неавторизованных
с `/admin/*` на `/login?next=...`, но эта страница ещё не существует — гости
получают 404. В шапке ([src/components/app/app-header/app-header.tsx:22](../../../src/components/app/app-header/app-header.tsx#L22))
стоит TODO о возврате login/logout UI после восстановления фичи `auth`.

## 2. Цели итерации

1. Пользователь может войти через `/login` (форма username/password), JWT
   попадает в cookie, происходит redirect на `next` (или `/`).
2. Пользователь может выйти через кнопку в шапке — cookie удаляется,
   редирект на `/`.
3. Ошибки логина показываются понятным брендированным текстом, не raw
   бэк-сообщением.

## 3. Вне скоупа

- **Регистрация в UI.** Создание пользователей — отдельной итерацией или
  вручную через `POST /api/auth/register` / БД.
- **«Забыли пароль» / смена пароля.** Нет соответствующих эндпойнтов на
  беке в нужном виде, обсуждается отдельно.
- **OAuth / SSO.** Не нужно.
- **«Запомнить меня» как опция.** Cookie всегда `maxAge: 30 дней`.
- **Logout-кнопка в admin-sidebar.** Только в шапке (видна и публично, и в
  `/admin`).

## 4. Архитектурное решение

Урезанный feature-слайс `src/features/auth/`. Шаблон
[src/features/_template/](../../../src/features/_template/) служит ориентиром
по структуре, но не натягивается дословно: auth — инфраструктурный flow без
доменной сущности и без CRUD.

Опущены относительно шаблона:

- `api.ts` — один эндпойнт, `fetch` живёт прямо в `actions.ts`.
- `permissions.ts` — login и logout доступны всем по определению, нет
  capability-чека.
- `revalidateEntity` — нет сущности для инвалидации кеша.

Структура слайса:

```text
src/features/auth/
├── index.ts              # publicly exported: LoginForm, LogoutForm, logoutAction
├── schemas.ts            # Zod LoginSchema
├── schemas.test.ts
├── actions.ts            # loginAction, logoutAction (server-only)
├── actions.test.ts       # fetch mocks для 200/401/403/5xx
├── cookie.ts             # setAuthCookie, clearAuthCookie (server-only)
├── safe-next.ts          # safeNextPath: защита от open redirect
├── safe-next.test.ts
└── ui/
    ├── login-form.tsx    # client component
    └── logout-form.tsx   # client component (одна кнопка, server action)
```

`safe-next.ts` лежит внутри слайса — он нужен только странице `/login`.

## 5. Поток логина

1. `GET /login?next=/admin/lectures` → server component
   [src/app/login/page.tsx](../../../src/app/login/page.tsx) (новый):
   - читает `searchParams.next`, прогоняет через `safeNextPath`;
   - если пользователь уже залогинен (`getMe()` вернул not-null) — `redirect(next ?? "/")`;
   - иначе рендерит `<LoginForm next={safeNext} />`.
2. Submit формы → `loginAction(prevState, formData)` (server action, обёрнут
   `createFormAction`):
   - `parseFormData(formData, LoginSchema)` → `{ username, password, next }`,
     где `next` — hidden field, опциональная строка в схеме
     (`z.string().optional()`), потом пропускается через `safeNextPath`;
   - `fetch(${API_URL}/api/auth/login, { method: "POST", body: JSON, headers })`;
   - на 200 + валидный `data.token`: `setAuthCookie(token)` → `redirect(safeNextPath(next))`;
   - на 400 (валидация бека) → throw → код `validation_failed`;
   - на 401 → throw → код `invalid_credentials`;
   - на 403 → throw → код `account_blocked`;
   - на 5xx / network → throw → код `service_unavailable`.

Коды передаются через `ActionResult.code` (расширяем существующий union в
[src/utils/create-action.ts:14](../../../src/utils/create-action.ts#L14) — добавляем
`"invalid_credentials" | "account_blocked" | "service_unavailable"`, либо
используем существующий fallback `code?: undefined` + `error` как строку-маркер).

**Решение:** не трогать общий `ActionResult` — оборачиваем неуспех бека в
кастомный `AuthError` с полем `kind`, его ловит `createFormAction` через
`code?: undefined`, а UI читает `error` как ключ i18n. Это минимальная
правка, без расширения union в core-утилите.

`AuthError extends Error` локально в `actions.ts`, его `message` — это
семантический ключ (`"invalid_credentials"`, `"account_blocked"`,
`"service_unavailable"`, `"validation_failed"`). `createFormAction` положит
этот ключ в `ActionResult.error`. UI читает `result.error` как enum-ключ и
мапит в брендированный текст. Это локальный контракт слайса auth — наружу
утечь не может, потому что `loginAction` экспортируется только из
`src/features/auth/`.

## 6. Поток logout

`<LogoutForm />` — client component с одной кнопкой `Войти`/`Выйти` (видна
только когда `me !== null`, иначе вместо неё `<Link href="/login">Войти</Link>`):

```tsx
<form action={logoutAction}>
  <Button type="submit">Выйти</Button>
</form>
```

`logoutAction` — server action: `clearAuthCookie()` → `redirect("/")`.
Никаких `createAction` обёрток не нужно, всё успешное; `redirect` бросает
NEXT_REDIRECT, который Next.js обрабатывает сам.

## 7. Cookie

[src/features/auth/cookie.ts](../../../src/features/auth/cookie.ts) (новый):

```ts
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

`httpOnly: true` — JS на странице не должен иметь доступ к токену.
`sameSite: "lax"` — стандарт для auth cookie, защищает от CSRF без поломок
обычных переходов. `secure: prod` — в dev по http через localhost
работает, в prod форсим https. `maxAge: 30 дней` — фронт не знает реальный
TTL JWT, бек сам отклонит истёкший токен через 401 на `/api/me`, тогда
`getMe()` вернёт `null` и UI перейдёт в режим гостя.

## 8. Защита `next` от open redirect

[src/features/auth/safe-next.ts](../../../src/features/auth/safe-next.ts) (новый):

```ts
export function safeNextPath(raw: string | undefined | null): string {
  if (!raw) return "/";
  // Только относительные пути от корня.
  if (!raw.startsWith("/")) return "/";
  // Защита от protocol-relative URL: //evil.com/...
  if (raw.startsWith("//")) return "/";
  // Защита от backslash-варианта: /\evil.com
  if (raw.startsWith("/\\")) return "/";
  return raw;
}
```

Тест-кейсы (`safe-next.test.ts`):

- `undefined` / `null` / `""` → `/`
- `/admin/lectures` → `/admin/lectures`
- `/admin?foo=bar` → `/admin?foo=bar`
- `//evil.com/x` → `/`
- `/\\evil.com` → `/`
- `https://evil.com` → `/`
- `javascript:alert(1)` → `/`
- `admin` (без слеша) → `/`

## 9. Touch app-header (foundation)

[src/components/app/app-header/app-header.tsx](../../../src/components/app/app-header/app-header.tsx)
— заморожен по CLAUDE.md. Эта итерация делает foundation-touch (согласовано
явно при брейншторминге): убирает TODO, добавляет login/logout UI.

Шапка — уже server component (нет `"use client"`), но синхронная. Делаем
её async, чтобы дёрнуть `getMe()`:

```tsx
const me = await getMe();
// ...
{me ? <LogoutForm username={me.username} /> : <Link href="/login">Войти</Link>}
```

`LogoutForm` показывает имя пользователя + кнопку «Выйти». Стилистика —
существующие примитивы UI-kit, отдельных дизайн-решений нет.

## 10. Тесты

- `schemas.test.ts` — `LoginSchema`: success (валидные creds + `next`),
  failure (пустой `username`, пустой `password`, слишком длинные значения).
- `safe-next.test.ts` — 8 кейсов из §8.
- `actions.test.ts` — мок `fetch`:
  - 200 + `{data:{token:"xxx"}}` → cookie выставлена, `redirect` вызван с
    safe-`next`;
  - 200 без `token` в `data` → throw `service_unavailable`;
  - 401 → `invalid_credentials`, cookie не трогаем;
  - 403 → `account_blocked`;
  - 500 → `service_unavailable`;
  - network reject → `service_unavailable`.

`getMe()` мокать не нужно — оно используется только в `page.tsx`, его
поведение покрыто отдельно.

## 11. Запретные зоны и риски

| Файл | Тип |
| --- | --- |
| `src/components/app/app-header/app-header.tsx` | foundation-touch (явно согласован) |
| `src/proxy.ts` | не трогаем, уже корректный |
| `src/utils/create-action.ts` | не трогаем (вариант с `AuthError` это позволяет) |
| `src/utils/me.ts` | не трогаем |
| `src/api/client.ts` | не трогаем |

Риски:

- **Истёкший JWT.** Покрыто: `getMe()` вернёт `null`, шапка покажет «Войти».
  Если страница уже отрисована — следующий action упадёт с 401 от бека,
  пользователь увидит generic ошибку. Принимаемо для итерации.
- **Race между двумя вкладками (logout в одной, действие в другой).** Та же
  ситуация что и с истёкшим токеном. Не решаем здесь.
- **CSRF.** Next.js server actions защищены same-origin Origin header
  check. `sameSite: "lax"` дополнительно блокирует cross-site POST. Доп.
  мер не нужно.

## 12. Чеклист готовности

- [ ] Структура `src/features/auth/` создана из `_template`, лишнее удалено.
- [ ] Все `*.ts` в слайсе начинаются с `import "server-only";` (кроме
      `ui/*.tsx` — client components).
- [ ] `index.ts` экспортирует только `LoginForm`, `LogoutForm`, `logoutAction`.
- [ ] `safeNextPath` покрыт 8 тестами.
- [ ] `LoginSchema` имеет success + failure тесты.
- [ ] `loginAction` покрыт 6 тестами на коды бека.
- [ ] `/login` redirect-ит залогиненных на `safeNext`.
- [ ] `app-header` показывает «Войти» / «Выйти, `<username>`» в зависимости
      от `getMe()`.
- [ ] `npm run lint && npm test && npm run build` зелёные.
- [ ] Ручная проверка: логин с корректными creds → попадаем в `/admin`;
      логин с неверным паролем → видим брендированную ошибку; logout →
      cookie удалена, шапка показывает «Войти».
