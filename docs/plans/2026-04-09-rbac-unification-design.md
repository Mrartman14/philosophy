# Унификация RBAC и UX недоступных действий — дизайн

**Дата:** 2026-04-09
**Статус:** утверждён, готов к написанию плана имплементации

## Цели

1. Один источник истины для всех проверок «кому что можно» во фронте.
2. Согласованный UX для недоступных действий: пользователь видит, **что** ему недоступно и **почему**, до клика, а не после ошибки от бэка.
3. Защита в несколько слоёв: middleware → layout → server component → server action.

## Контекст и проблемы текущего состояния

- Роли: `user` / `moderator` / `admin`. Статусы: `active` / `suspended` / `banned`. Источник — JWT, читается через `src/utils/get-user.ts`.
- `src/proxy.ts` защищает только `/admin`, и только проверяет `role === "admin"`.
- Логика «что может пользователь» размазана по серверным компонентам ad-hoc: каждый раз вычисляются `canEdit`, `canDelete`, `canReact`, `isPrivileged` по-своему (`comment-list.tsx`, `annotation-list.tsx`).
- Server actions (`comments/actions.ts` и др.) вообще не проверяют права — слепо стучатся на бэк и оборачивают ошибку в `ActionResult.error`.
- UI-фидбек разнородный:
  - где-то форму скрывают и показывают CTA «Войдите, чтобы оставить комментарий»;
  - где-то кнопка просто `disabled` без объяснения (`reaction-button.tsx`);
  - где-то кнопка вообще не рендерится (`comment-item-actions.tsx`);
  - где-то клик → ошибка от бэка после `await` (`lecture-delete-button.tsx`).

## Ключевые архитектурные решения

1. **Источник истины — `GET /api/me`.** Работаем под предположением, что бэк отдаёт `{ id, username, role, status, capabilities[] }`. Фронт доверяет списку capabilities и не выводит права из роли локально.
2. **Полностью серверная модель.** Server components вычисляют `canX` через хелперы и пробрасывают в client как готовые boolean'ы / `DenyReason`. Никакого `<MeProvider>` / `useMe()` на клиенте.
3. **Per-feature permission модули.** Доменные хелперы лежат в `src/features/{name}/permissions.ts` рядом с `actions.ts` / `api.ts` фичи. Общая инфраструктура (`Capability` тип, `can`, `getMe`, `ForbiddenError`) — в `src/utils/`.
4. **Capability модель — плоский union строк** формата `<resource>.<action>`. Ownership-проверки не идут в capabilities, живут в доменных хелперах. `status` — глобальный гейт, не capability.
5. **UX гибрид по причине отказа:**
   - **Гость** → inline-CTA `<LoginCta>` или disabled+tooltip `<ActionTooltip reason="guest">`;
   - **Не хватает прав по роли** → полностью скрыто;
   - **Не owner** → полностью скрыто;
   - **Suspended/banned** → глобальный `<StatusBanner>` сверху + локально все мутации видны как `disabled` с tooltip.
6. **Defense in depth.** Server actions сами проверяют права через `getMe()` перед запросом на бэк и бросают `ForbiddenError`, который превращается в `ActionResult { code: "forbidden", error }`.

## Файловая структура

```
src/
├── utils/
│   ├── me.ts                          [нов.] Me, MaybeMe, getMe() с React.cache()
│   ├── permissions.ts                 [нов.] Capability, can, isMutationAllowed,
│   │                                          DenyReason, ForbiddenError
│   ├── get-user.ts                    [-]   удаляется
│   └── create-action.ts               [изм.] поддержка ForbiddenError + code в ActionResult
├── components/
│   └── permission/
│       ├── status-banner.tsx          [нов.] глобальный баннер для suspended/banned
│       ├── login-cta.tsx              [нов.] inline-CTA "Войдите, чтобы …"
│       └── action-tooltip.tsx         [нов.] обёртка для disabled-кнопок с пояснением
├── features/
│   ├── comments/permissions.ts        [нов.]
│   ├── annotations/permissions.ts     [нов.]
│   ├── lectures/permissions.ts        [нов.]
│   ├── transcript/permissions.ts     [нов.]
│   ├── admin/permissions.ts           [нов.]
│   └── push/permissions.ts            [нов.]
├── proxy.ts                           [изм.] упрощается до проверки наличия токена
└── app/
    ├── layout.tsx                     [изм.] получить me, отрисовать StatusBanner, AppHeader(me)
    └── admin/layout.tsx               [изм.] canAccessAdmin + forbidden() при отказе
```

## Контракт `/api/me`

```ts
// GET /api/me
// 200 OK при валидном токене
// 401 при отсутствии/невалидном — фронт интерпретирует как "гость"
type MeResponse = {
  id: string;
  username: string;
  role: "user" | "moderator" | "admin";
  status: "active" | "suspended" | "banned";
  capabilities: Capability[];
};
```

## `getMe()`

```ts
// src/utils/me.ts
import { cache } from "react";
import { cookies } from "next/headers";

export type Me = MeResponse;
export type MaybeMe = Me | null;

export const getMe = cache(async (): Promise<MaybeMe> => {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${process.env.API_URL}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 401) return null;
    if (!res.ok) return null; // деградируем до гостя при ошибках сети/5xx
    return (await res.json()) as Me;
  } catch {
    return null;
  }
});
```

- `React.cache()` дедуплицирует вызовы в рамках одного запроса.
- Деградация до гостя при ошибках, а не throw — лучше отрисовать страницу как гостю, чем уронить рендер.
- В layout вызывается один раз, во всех server components страницы — повторные вызовы бесплатны.

## Capability реестр и базовые хелперы

```ts
// src/utils/permissions.ts
import type { MaybeMe } from "./me";

export type Capability =
  | "lecture.create"
  | "lecture.update"
  | "lecture.delete"
  | "lecture.upload_files"
  | "comment.moderate"
  | "comment.delete_any"
  | "annotation.moderate"
  | "annotation.delete_any"
  | "transcript.edit"
  | "user.moderate"
  | "user.list"
  | "push.send"
  | "admin.access";

export function can(me: MaybeMe, cap: Capability): boolean {
  if (!me) return false;
  if (me.status !== "active") return false;
  return me.capabilities.includes(cap);
}

export function isMutationAllowed(me: MaybeMe): boolean {
  return me !== null && me.status === "active";
}

export type DenyReason = "guest" | "role" | "owner" | "status";

export class ForbiddenError extends Error {
  readonly code = "forbidden" as const;
  constructor(public readonly reason: DenyReason, message?: string) {
    super(message ?? `Forbidden: ${reason}`);
    this.name = "ForbiddenError";
  }
}
```

## Доменные хелперы — пример для комментариев

```ts
// src/features/comments/permissions.ts
import type { Comment } from "@/api/types";
import type { MaybeMe } from "@/utils/me";
import { can, isMutationAllowed, type DenyReason } from "@/utils/permissions";

export function canCreateComment(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}

export function canEditComment(me: MaybeMe, comment: Comment): boolean {
  if (!isMutationAllowed(me)) return false;
  if (comment.user_id === me!.id) return true;
  return can(me, "comment.delete_any");
}

export function canDeleteComment(me: MaybeMe, comment: Comment): boolean {
  return canEditComment(me, comment);
}

export function canReactToComment(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}

export function canModerateComments(me: MaybeMe): boolean {
  return can(me, "comment.moderate");
}

export function whyCannotCreateComment(me: MaybeMe): DenyReason | null {
  if (!me) return "guest";
  if (me.status !== "active") return "status";
  return null;
}

export function whyCannotEditComment(me: MaybeMe, comment: Comment): DenyReason | null {
  if (!me) return "guest";
  if (me.status !== "active") return "status";
  if (comment.user_id !== me.id && !can(me, "comment.delete_any")) return "owner";
  return null;
}
```

Принципы:
- Принимают `MaybeMe`, корректно обрабатывают `null`.
- `boolean`-функции для большинства мест, парные `whyCannot*` только там, где нужна причина для UI.
- Status-гейт встроен через `isMutationAllowed`, его нельзя забыть.
- Ownership-проверки внутри хелпера, а не в компоненте.

## UX-паттерны и компоненты

**Сводная таблица:**

| reason   | UI-паттерн                                    | Компонент                          |
|----------|-----------------------------------------------|------------------------------------|
| `guest`  | Inline-CTA или disabled+tooltip               | `<LoginCta>` или `<ActionTooltip>` |
| `role`   | Полностью скрыто                              | (просто `if` в JSX)                |
| `owner`  | Полностью скрыто                              | (просто `if` в JSX)                |
| `status` | Глобальный баннер + локально disabled+tooltip | `<StatusBanner>` + `<ActionTooltip>` |

### `<StatusBanner>`

Глобальный баннер сверху страницы. Виден только при `status !== "active"`. Подключается в `src/app/layout.tsx` под `<AppHeader>`.

### `<LoginCta>`

Inline-блок, заменяет форму для гостя. Принимает `message` и `redirectTo` (для `?next=` параметра).

### `<ActionTooltip>`

Универсальная обёртка кнопки. Если `reason !== null` — клонирует child с `disabled` + `aria-disabled` + добавляет `title` с человекочитаемой причиной. `role` и `owner` сюда не доходят (они скрываются вообще).

```tsx
<ActionTooltip reason={canReact ? null : "guest"} action="поставить лайк">
  <ReactionButton ... />
</ActionTooltip>
```

## Server actions: канонический паттерн

```ts
// src/features/comments/actions.ts (после миграции)
"use server";

export const deleteComment = createAction<
  { commentId: string; lectureId: string },
  void
>(async ({ commentId, lectureId }) => {
  const me = await getMe();
  const comment = await getCommentById(commentId);
  if (!canDeleteComment(me, comment)) {
    throw new ForbiddenError(whyCannotEditComment(me, comment)!);
  }
  // ... обычная логика вызова бэка
});
```

`createAction` ловит `ForbiddenError` и возвращает `{ success: false, error, code: "forbidden" }`. В большинстве client component кода специальная обработка `forbidden` не нужна — кнопка не отрендерилась. Это fallback для редких race conditions.

## Обновление `ActionResult`

```ts
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: "forbidden" | "validation" | "network" };
```

Поле `code` опционально — старый код продолжает работать.

## Защита роутов

| Слой              | Что проверяет                          | Что делает при отказе              |
|-------------------|----------------------------------------|------------------------------------|
| `proxy.ts`        | Наличие токена (грубый гейт)           | Редирект на `/login?next=...`      |
| Layout роута      | `canAccessX(me)` через `getMe()`       | `forbidden()` → 403                |
| Server component  | `canX(me, resource)` перед рендером    | Не рендерит / скрывает кнопку       |
| Server action     | `canX(me, resource)` перед запросом    | `throw new ForbiddenError(reason)` |
| Бэкенд            | Своя RBAC                              | 401/403 (мы не доходим сюда)       |

`proxy.ts` работает в edge runtime и не может вызывать `getMe()` (нет fetch на наш Go-бэк, лишние сетапы). Поэтому он становится «грубым» гейтом — только проверка наличия токена. Полноценная проверка `canAccessAdmin` уезжает в server-side layout роута.

## Карта миграции

### Шаг 0 — Фундамент
Создать `me.ts`, `permissions.ts`, компоненты в `components/permission/`. Изменить `create-action.ts`, `app/layout.tsx`, `AppHeader`. Удалить `get-user.ts` и мигрировать все 9 его call-site'ов на `getMe()`.

### Шаг 1 — Комментарии
`features/comments/permissions.ts`. Обновить `actions.ts`, `comment-list.tsx`, `comment-item.tsx`, `comment-item-actions.tsx`. Добавить `getCommentById` в локальный `api.ts`.

### Шаг 2 — Аннотации
`features/annotations/permissions.ts`. Обновить `actions.ts`, `annotation-list.tsx`, `annotation-highlight.tsx`, `annotation-form.tsx`.

### Шаг 3 — Лекции (публичная часть)
`features/lectures/permissions.ts`. Применение, если на публичных страницах есть админские контролы.

### Шаг 4 — Транскрипт
`features/transcript/permissions.ts`. Применение по необходимости.

### Шаг 5 — Админка
`features/admin/permissions.ts`. Упростить `proxy.ts`. Обновить `app/admin/layout.tsx` с `forbidden()`. Отфильтровать `admin-sidebar.tsx` по правам. Обновить все админские server actions и client components с обработкой `forbidden`-кода.

### Шаг 6 — Auth
`?next=` параметр в `login-form` / `register-form`. `revalidatePath` после login/logout, чтобы layout перечитал `me`.

### Шаг 7 — Финальная зачистка
Грепом убедиться, что `getUser`, ad-hoc `user.role === "..."` нигде не остались. Прогнать `npm run build` и `npm run lint`.

## Тестирование

В проекте нет тест-инфраструктуры (нет vitest/jest, нет `*.test.*`). Заводить её под эту задачу — раздувание скоупа.

### 1. Type-level через `tsc`
- `Capability` — узкий union, опечатки ловятся компилятором.
- `MaybeMe` принуждает явно обрабатывать гостя.
- `DenyReason` — exhaustive switch в `<ActionTooltip>`.
- Прогон `npm run build` — обязательный шаг плана.

### 2. Lint
- `npm run lint` обязателен.

### 3. Ручной QA-чеклист
Финальный чекпоинт плана. Сценарии в трёх (четырёх) профилях:

**A. Гость:**
- `/lectures/{id}` — комментарии: вместо формы `<LoginCta>`. Лайк — disabled с tooltip.
- Аннотации: «Создать аннотацию» либо скрыта, либо `<LoginCta>`.
- Чужие комменты/аннотации: нет «Редактировать»/«Удалить».
- `/admin` — редирект на `/login?next=/admin`.
- Никаких ошибок в консоли, никаких 403 после клика.

**B. Обычный user (active):**
- Комментирует, лайкает, создаёт аннотации без проблем.
- На своём контенте — Edit/Delete видны. На чужом — отсутствуют.
- Кнопок модерации нет нигде на публичной части.
- `/admin` — 403.

**C. Admin (active):**
- Все экраны админки работают.
- Sidebar показывает все доступные пункты (Push — если есть `push.send`).

**D. Suspended user:**
- Глобальный баннер на всех страницах.
- Все мутирующие кнопки видны, но `disabled` с tooltip про статус.
- Чтение работает.
- Прямой вызов server action через DevTools → `code: "forbidden"`, без краша.

### 4. Race-condition fallback
Для одного-двух мест проверить вручную: вызвать действие через DevTools на ресурсе, к которому нет прав → структурированный `forbidden`, UI не крашится.

### Что не тестируем
- Бэкенд RBAC (другой репо).
- Контракт `/api/me` (условились, что он есть).
- Edge-кейсы JWT — покрыты `getMe()` через try/catch.

## Альтернативы, которые отброшены

- **`/api/me` отсутствует, дублируем правила на фронте.** Получим drift между бэком и фронтом, придётся вручную синхронизировать. Решение: считаем, что бэк отдаёт `/api/me`.
- **`<MeProvider>` + `useMe()` на клиенте.** Фронт-side получение прав, мерцание «гость → юзер» при гидрации. Решение: только сервер, props вниз.
- **Ownership как отдельные capabilities `comment.edit_own`.** Усложняет реестр без выгоды. Решение: ownership в коде хелперов.
- **Capability как вложенный объект или bitset.** Хуже сериализация / читаемость. Решение: плоский union строк.
- **Возвращать `{ allowed, reason }` из всех хелперов.** Шум там, где причина не нужна. Решение: пара функций — `canX` (boolean) и `whyCannotX` (reason or null).
- **`<GuardedButton capability="...">` универсальный.** Должен знать, как рендерить любые типы кнопок проекта. Решение: `<ActionTooltip>` оборачивает любой child.
- **vitest/jest для unit-тестов хелперов.** Хелперы — `if/else` на 5 строк, ценность уже в типах. Решение: type-level + ручной QA-чеклист.
