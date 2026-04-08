# Full Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Реализовать все фичи бэкенда на фронте: авторизацию, комментарии, аннотации, поиск, админ-панель.

**Architecture:** Feature-based структура (`src/features/*`), полностью серверная авторизация (Server Actions + httpOnly cookie + middleware), типизированный API-клиент через openapi-fetch, обёртка `createAction` для всех server actions.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5 (strict), openapi-fetch, Tailwind CSS 4, Framer Motion.

**Worktree Strategy:** Foundation (Task 1) делается на main. Затем Tasks 2-5 запускаются параллельно в отдельных worktrees. Task 6 (Admin) запускается после мержа Task 2 (Auth).

---

## Task 1: Foundation (на main, блокирует всё остальное)

### Цель
Установить openapi-fetch, создать типизированный API-клиент, утилиту `createAction`, хелпер `getUser()`, реорганизовать существующий код в `features/`.

### Files
- Create: `src/api/client.ts`
- Create: `src/utils/create-action.ts`
- Create: `src/utils/get-user.ts`
- Modify: `package.json` (добавить openapi-fetch)
- Modify: `src/api/lecture-api.ts` → переместить в `src/features/lectures/api.ts`
- Move: `src/components/app/video-player/*` → `src/features/player/*`
- Move: `src/components/app/video/*` → `src/features/transcript/*`
- Move: `src/hooks/use-video-player.ts` → `src/features/player/use-video-player.ts`
- Move: `src/hooks/use-synced-player.ts` → `src/features/player/use-synced-player.ts`
- Update: все импорты в затронутых файлах

### Step 1: Установить openapi-fetch

```bash
npm install openapi-fetch
```

### Step 2: Создать типизированный API-клиент

`src/api/client.ts`:
```typescript
import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { cookies } from "next/headers";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

/** Серверный клиент — автоматически прикладывает JWT из cookie */
export async function createApiClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  return createClient<paths>({
    baseUrl: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** Публичный клиент без токена — для открытых эндпоинтов */
export function createPublicApiClient() {
  return createClient<paths>({
    baseUrl: API_URL,
  });
}
```

### Step 3: Обновить скрипт generate-types

В `package.json` заменить скрипт `generate-types`:
```json
"generate:api": "npx swagger2openapi ${SWAGGER_URL:-../philosophy-api/docs/swagger/swagger.json} -o /tmp/openapi3.json && openapi-typescript /tmp/openapi3.json -o src/api/schema.ts"
```

### Step 4: Создать обёртку createAction

`src/utils/create-action.ts`:
```typescript
"use server";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

type ActionFn<TInput, TOutput> = (input: TInput) => Promise<TOutput>;

export function createAction<TInput, TOutput>(
  fn: ActionFn<TInput, TOutput>
): (input: TInput) => Promise<ActionResult<TOutput>> {
  return async (input: TInput) => {
    try {
      const data = await fn(input);
      return { success: true, data };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Неизвестная ошибка";
      // TODO: логирование
      return { success: false, error: message };
    }
  };
}
```

### Step 5: Создать хелпер getUser

`src/utils/get-user.ts`:
```typescript
import { cookies } from "next/headers";

export interface AuthUser {
  id: string;
  role: "user" | "moderator" | "admin";
  status: "active" | "suspended" | "banned";
}

interface JwtPayload {
  user_id: string;
  role: string;
  status: string;
  exp: number;
}

/** Читает JWT из cookie и возвращает данные пользователя или null */
export async function getUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1]!, "base64").toString()
    ) as JwtPayload;

    if (payload.exp * 1000 < Date.now()) return null;

    return {
      id: payload.user_id,
      role: payload.role as AuthUser["role"],
      status: payload.status as AuthUser["status"],
    };
  } catch {
    return null;
  }
}
```

### Step 6: Реорганизовать файлы в feature-based структуру

Переместить существующие файлы:

```
src/components/app/video-player/*  → src/features/player/*
src/components/app/video/*         → src/features/transcript/*
src/hooks/use-video-player.ts      → src/features/player/use-video-player.ts
src/hooks/use-synced-player.ts     → src/features/player/use-synced-player.ts
src/api/lecture-api.ts             → src/features/lectures/api.ts
src/app/lectures/[id]/lecture-sync.tsx → src/features/lectures/lecture-sync.tsx
```

Обновить ВСЕ импорты во всех затронутых файлах:
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/lectures/[id]/page.tsx`
- Все файлы внутри перемещённых папок (внутренние импорты)

### Step 7: Проверить сборку

```bash
npm run build
```

Ожидание: сборка проходит без ошибок.

### Step 8: Коммит

```bash
git add src/api/client.ts src/utils/create-action.ts src/utils/get-user.ts src/features/ package.json package-lock.json
git add -u  # обновлённые/удалённые файлы
git commit -m "feat: foundation — API client, createAction, getUser, feature-based structure"
```

---

## Task 2: Auth (worktree: `worktrees/auth`, branch: `feat/auth`)

### Цель
Серверная авторизация: middleware, login/register формы и server actions.

### Dependencies
- Task 1 (Foundation) merged to main

### Files
- Create: `src/middleware.ts`
- Create: `src/features/auth/actions.ts` (server actions: login, register, logout)
- Create: `src/features/auth/login-form.tsx` (client component — форма)
- Create: `src/features/auth/register-form.tsx` (client component — форма)
- Create: `src/app/login/page.tsx`
- Create: `src/app/register/page.tsx`
- Modify: `src/app/layout.tsx` (добавить ссылку на логин в хедер)
- Modify: `src/components/app/app-header/app-header.tsx` (отобразить имя юзера или ссылку на логин)

### Step 1: Создать middleware

`src/middleware.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  // Админские роуты — требуют токен с ролью admin
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1]!, "base64").toString()
      );
      if (payload.role !== "admin") {
        return NextResponse.redirect(new URL("/", request.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

### Step 2: Создать server actions для auth

`src/features/auth/actions.ts`:
```typescript
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAction } from "@/utils/create-action";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

export const login = createAction(async (formData: FormData) => {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Ошибка входа");
  }

  const { token } = await res.json();
  const cookieStore = await cookies();
  cookieStore.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24h
    path: "/",
  });

  redirect("/");
});

export const register = createAction(async (formData: FormData) => {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Ошибка регистрации");
  }

  redirect("/login");
});

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("token");
  redirect("/");
}
```

### Step 3: Создать формы логина и регистрации

`src/features/auth/login-form.tsx` — клиентский компонент с `useActionState` для отображения ошибок. Форма: username, password, кнопка "Войти".

`src/features/auth/register-form.tsx` — аналогично. Форма: username, password, кнопка "Зарегистрироваться".

### Step 4: Создать страницы

`src/app/login/page.tsx` — серверный компонент, рендерит `LoginForm`.
`src/app/register/page.tsx` — серверный компонент, рендерит `RegisterForm`.

### Step 5: Обновить хедер

В `src/components/app/app-header/app-header.tsx`:
- Вызвать `getUser()` (хедер рендерится на сервере)
- Если юзер есть — показать имя/роль и кнопку "Выйти" (вызывает `logout` action)
- Если нет — показать ссылку "Войти"

### Step 6: Проверить сборку и вручную

```bash
npm run build
```

### Step 7: Коммит

```bash
git add src/middleware.ts src/features/auth/ src/app/login/ src/app/register/
git add -u
git commit -m "feat(auth): server-side auth with middleware, login/register"
```

---

## Task 3: Comments (worktree: `worktrees/comments`, branch: `feat/comments`)

### Цель
Комментарии к лекциям: список, создание (вкл. анонимное), редактирование, удаление, реакции.

### Dependencies
- Task 1 (Foundation) merged to main

### Files
- Create: `src/features/comments/api.ts`
- Create: `src/features/comments/actions.ts` (server actions)
- Create: `src/features/comments/comment-list.tsx` (server component)
- Create: `src/features/comments/comment-item.tsx` (server component)
- Create: `src/features/comments/comment-form.tsx` (client component)
- Create: `src/features/comments/reaction-button.tsx` (client component)
- Modify: `src/app/lectures/[id]/page.tsx` (добавить секцию комментариев)

### Step 1: Создать API-функции

`src/features/comments/api.ts`:
```typescript
import { createApiClient, createPublicApiClient } from "@/api/client";

export async function getComments(lectureId: string, page = 1, limit = 20) {
  const client = createPublicApiClient();
  const { data, error } = await client.GET("/api/lectures/{id}/comments", {
    params: { path: { id: lectureId }, query: { page, limit } },
  });
  if (error) throw new Error("Ошибка загрузки комментариев");
  return data;
}
```

### Step 2: Создать server actions

`src/features/comments/actions.ts`:
- `createComment` — POST `/api/lectures/{id}/comments` (body, is_anonymous)
- `editComment` — PUT `/api/comments/{id}` (body)
- `deleteComment` — DELETE `/api/comments/{id}`
- `addReaction` — POST `/api/comments/{id}/reactions`
- `removeReaction` — DELETE `/api/comments/{id}/reactions`

Все через `createAction`, все используют `createApiClient()` для авторизованных запросов.
После мутации — `revalidatePath(\`/lectures/${lectureId}\`)`.

### Step 3: Создать компоненты

**`comment-list.tsx`** (server component):
- Получает `lectureId`
- Вызывает `getComments()` и `getUser()`
- Рендерит список `CommentItem` + `CommentForm`
- Передаёт в каждый `CommentItem` флаги `canEdit`, `canDelete` (определяются на сервере)

**`comment-item.tsx`** (server component):
- Отображает: автор (или "Аноним"), текст, дата, отметка "изменено"
- Если `canEdit` — рендерит кнопку редактирования
- Если `canDelete` — рендерит кнопку удаления
- Рендерит `ReactionButton` с текущим количеством лайков

**`comment-form.tsx`** (client component):
- Текстовое поле + чекбокс "Анонимно" (отображается если юзер авторизован, пропс с сервера)
- `useActionState` для отображения ошибок
- Вызывает `createComment` server action

**`reaction-button.tsx`** (client component):
- Optimistic update через `useOptimistic`
- Вызывает `addReaction` / `removeReaction`

### Step 4: Интегрировать в страницу лекции

В `src/app/lectures/[id]/page.tsx` добавить `<CommentList lectureId={id} />` под видео/транскриптом.

### Step 5: Проверить сборку

```bash
npm run build
```

### Step 6: Коммит

```bash
git add src/features/comments/ -u
git commit -m "feat(comments): comments with reactions, anonymous support"
```

---

## Task 4: Annotations (worktree: `worktrees/annotations`, branch: `feat/annotations`)

### Цель
Аннотации привязанные к сегментам транскрипта: создание, выделение сегментов, подсветка, приватные/анонимные.

### Dependencies
- Task 1 (Foundation) merged to main

### Files
- Create: `src/features/annotations/api.ts`
- Create: `src/features/annotations/actions.ts`
- Create: `src/features/annotations/annotation-list.tsx` (server component)
- Create: `src/features/annotations/annotation-form.tsx` (client component)
- Create: `src/features/annotations/annotation-highlight.tsx` (client component)
- Modify: `src/features/transcript/transcript-panel.tsx` (добавить маркеры аннотаций)
- Modify: `src/app/lectures/[id]/page.tsx` (прокинуть аннотации)

### Step 1: Создать API-функции

`src/features/annotations/api.ts`:
```typescript
import { createApiClient, createPublicApiClient } from "@/api/client";

export async function getAnnotations(lectureId: string, page = 1, limit = 100) {
  const client = createPublicApiClient();
  const { data, error } = await client.GET("/api/lectures/{id}/annotations", {
    params: { path: { id: lectureId }, query: { page, limit } },
  });
  if (error) throw new Error("Ошибка загрузки аннотаций");
  return data;
}
```

### Step 2: Создать server actions

`src/features/annotations/actions.ts`:
- `createAnnotation` — POST `/api/lectures/{id}/annotations` (body, segment_ids, is_anonymous, is_private)
- `editAnnotation` — PUT `/api/annotations/{id}`
- `deleteAnnotation` — DELETE `/api/annotations/{id}`

Все через `createAction` + `createApiClient()`.
После мутации — `revalidatePath`.

### Step 3: Создать компоненты

**`annotation-highlight.tsx`** (client component):
- Оборачивает транскрипт
- Подсвечивает сегменты у которых есть аннотации (маркер сбоку, фоновый цвет)
- Позволяет выделить сегменты (клик — один, shift+клик — диапазон)
- При выделении показывает кнопку "Добавить аннотацию"
- При клике на маркер — показывает панель с аннотациями к этим сегментам

**`annotation-list.tsx`** (server component):
- Получает список аннотаций для лекции
- Определяет права (canEdit, canDelete) через `getUser()`
- Рендерит каждую аннотацию с текстом, автором, привязанными сегментами

**`annotation-form.tsx`** (client component):
- Текстовое поле
- Чекбоксы "Приватная", "Анонимно"
- Принимает `selectedSegmentIds` как проп
- `useActionState` для ошибок

### Step 4: Интеграция

В `src/app/lectures/[id]/page.tsx`:
- Загрузить аннотации через `getAnnotations(id)`
- Передать данные аннотаций в `LectureSync`
- В `LectureSync` обернуть транскрипт в `AnnotationHighlight`

### Step 5: Проверить сборку

```bash
npm run build
```

### Step 6: Коммит

```bash
git add src/features/annotations/ -u
git commit -m "feat(annotations): annotations linked to transcript segments"
```

---

## Task 5: Search (worktree: `worktrees/search`, branch: `feat/search`)

### Цель
Полнотекстовый поиск: инпут в хедере, страница результатов с группировкой по типу.

### Dependencies
- Task 1 (Foundation) merged to main

### Files
- Create: `src/features/search/api.ts`
- Create: `src/features/search/search-input.tsx` (client component)
- Create: `src/features/search/search-results.tsx` (server component)
- Create: `src/app/search/page.tsx`
- Modify: `src/components/app/app-header/app-header.tsx` (добавить SearchInput)

### Step 1: Создать API-функцию

`src/features/search/api.ts`:
```typescript
import { createPublicApiClient } from "@/api/client";

export async function search(q: string, limit = 20, offset = 0) {
  const client = createPublicApiClient();
  const { data, error } = await client.GET("/api/search", {
    params: { query: { q, limit, offset } },
  });
  if (error) throw new Error("Ошибка поиска");
  return data;
}
```

### Step 2: Создать компоненты

**`search-input.tsx`** (client component):
- Иконка поиска в хедере, по клику раскрывается текстовое поле
- По Enter — навигация на `/search?q=...` через `router.push`
- Минимальный JS, основная работа на сервере

**`search-results.tsx`** (server component):
- Получает `q` из searchParams
- Вызывает `search(q)`
- Группирует результаты по типу (лекции, транскрипты, комментарии, аннотации)
- Каждый результат — ссылка на источник

### Step 3: Создать страницу

`src/app/search/page.tsx`:
```typescript
import { search } from "@/features/search/api";
import { SearchResults } from "@/features/search/search-results";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;

  if (!q) {
    return <div className="p-4">Введите поисковый запрос</div>;
  }

  const results = await search(q);

  return (
    <div className="w-full p-4">
      <h1 className="text-xl font-bold mb-4">Результаты: «{q}»</h1>
      <SearchResults results={results} />
    </div>
  );
}
```

### Step 4: Добавить SearchInput в хедер

В `src/components/app/app-header/app-header.tsx` добавить `<SearchInput />`.

### Step 5: Проверить сборку

```bash
npm run build
```

### Step 6: Коммит

```bash
git add src/features/search/ src/app/search/ -u
git commit -m "feat(search): full-text search with grouped results"
```

---

## Task 6: Admin Panel (worktree: `worktrees/admin`, branch: `feat/admin`)

### Цель
Админ-панель: CRUD лекций, редактор транскриптов, файл-менеджер, управление пользователями, модерация, push.

### Dependencies
- Task 1 (Foundation) merged to main
- Task 2 (Auth) merged to main (нужен middleware + getUser)

### Files
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx` (дашборд)
- Create: `src/app/admin/lectures/page.tsx`
- Create: `src/app/admin/lectures/[id]/page.tsx`
- Create: `src/app/admin/users/page.tsx`
- Create: `src/app/admin/comments/page.tsx`
- Create: `src/app/admin/annotations/page.tsx`
- Create: `src/app/admin/push/page.tsx`
- Create: `src/features/admin/actions.ts` (все admin server actions)
- Create: `src/features/admin/lectures/lecture-table.tsx`
- Create: `src/features/admin/lectures/lecture-editor.tsx`
- Create: `src/features/admin/lectures/transcript-editor.tsx`
- Create: `src/features/admin/lectures/file-manager.tsx`
- Create: `src/features/admin/users/user-table.tsx`
- Create: `src/features/admin/comments/comment-moderation.tsx`
- Create: `src/features/admin/annotations/annotation-moderation.tsx`
- Create: `src/features/admin/push/push-sender.tsx`

### Step 1: Создать admin layout

`src/app/admin/layout.tsx`:
- Боковое меню: Дашборд, Лекции, Пользователи, Комментарии, Аннотации, Push
- Активный пункт подсвечен
- `getUser()` для отображения имени админа
- Middleware уже защищает `/admin/*` (из Task 2)

### Step 2: Создать admin server actions

`src/features/admin/actions.ts`:

**Лекции:**
- `createLecture` — POST `/api/admin/lectures`
- `updateLecture` — PUT `/api/admin/lectures/{id}`
- `deleteLecture` — DELETE `/api/admin/lectures/{id}`

**Транскрипты:**
- `upsertTranscript` — POST `/api/admin/lectures/{id}/transcript`
- `addSegment` — POST `/api/admin/lectures/{id}/transcript/segments`
- `updateSegment` — PUT `/api/admin/lectures/{id}/transcript/segments/{segmentId}`
- `deleteSegment` — DELETE `/api/admin/lectures/{id}/transcript/segments/{segmentId}`

**Файлы:**
- `uploadFile` — POST `/api/admin/lectures/{id}/files` (FormData)
- `deleteFile` — DELETE `/api/admin/lectures/{id}/files/{fileId}`

**Пользователи:**
- `updateUserStatus` — PUT `/api/admin/users/{id}/status`

**Модерация:**
- `deleteCommentAdmin` — DELETE `/api/admin/comments/{id}`
- `updateCommentStatus` — PUT `/api/admin/comments/{id}/status`
- `deleteAnnotationAdmin` — DELETE `/api/admin/annotations/{id}`
- `updateAnnotationStatus` — PUT `/api/admin/annotations/{id}/status`

**Push:**
- `sendPush` — POST `/api/admin/push/send`

Все через `createAction` + `createApiClient()`.

### Step 3: Дашборд

`src/app/admin/page.tsx`:
- Server component
- Показывает счётчики: кол-во лекций, пользователей (из API)
- Простые карточки со статистикой

### Step 4: CRUD лекций

**`src/app/admin/lectures/page.tsx`:**
- Таблица всех лекций (title, date, actions)
- Кнопка "Создать лекцию" → модалка или отдельная форма
- Кнопки: редактировать (→ `/admin/lectures/[id]`), удалить

**`src/features/admin/lectures/lecture-table.tsx`** (server component):
- Рендерит таблицу
- Кнопки удаления вызывают server action

**`src/app/admin/lectures/[id]/page.tsx`:**
- Форма редактирования метаданных (title, description, date)
- Файл-менеджер
- Редактор транскрипта

### Step 5: Файл-менеджер

**`src/features/admin/lectures/file-manager.tsx`** (client component):
- Список файлов лекции (type, filename)
- `<input type="file">` + select type (video/notes/image) + upload button
- Server action для загрузки (FormData)
- Кнопка удаления для каждого файла

### Step 6: Редактор транскрипта

**`src/features/admin/lectures/transcript-editor.tsx`** (client component):
- Таблица сегментов: position, start_time, end_time, speaker, text
- Inline-editing (клик по ячейке → инпут)
- Кнопки: добавить сегмент, удалить сегмент
- Сохранение через server actions (updateSegment, addSegment, deleteSegment)
- Кнопка "Загрузить весь транскрипт" — upsertTranscript (полная замена)

### Step 7: Управление пользователями

**`src/app/admin/users/page.tsx`** + **`user-table.tsx`**:
- Таблица: username, role, status, created_at
- Dropdown для смены статуса (active/suspended/banned)
- Server action `updateUserStatus`

### Step 8: Модерация комментариев

**`src/app/admin/comments/page.tsx`** + **`comment-moderation.tsx`**:
- Список всех комментариев
- Кнопки: скрыть/опубликовать (updateCommentStatus), удалить
- Фильтр по лекции (опционально)

### Step 9: Модерация аннотаций

**`src/app/admin/annotations/page.tsx`** + **`annotation-moderation.tsx`**:
- Аналогично комментариям

### Step 10: Push

**`src/app/admin/push/page.tsx`** + **`push-sender.tsx`**:
- Форма: title, body, url
- Server action `sendPush`
- Сообщение об успехе/ошибке

### Step 11: Проверить сборку

```bash
npm run build
```

### Step 12: Коммит

```bash
git add src/app/admin/ src/features/admin/ -u
git commit -m "feat(admin): full admin panel with CRUD, moderation, push"
```

---

## Execution Order & Parallelization

```
                    ┌─────────────┐
                    │  Task 1:    │
                    │  Foundation │
                    │  (on main)  │
                    └──────┬──────┘
                           │
              merge to main│
                           │
          ┌────────┬───────┼────────┬─────────┐
          │        │       │        │         │
          ▼        ▼       ▼        ▼         │
     ┌────────┐┌───────┐┌──────┐┌───────┐    │
     │ Task 2 ││Task 3 ││Task 4││Task 5 │    │
     │ Auth   ││Comment││Annot.││Search │    │
     │worktree││worktr.││worktr││worktr.│    │
     └───┬────┘└───────┘└──────┘└───────┘    │
         │                                    │
         │ merge to main                      │
         │                                    │
         └────────────────────────────────────┤
                                              │
                                              ▼
                                        ┌──────────┐
                                        │  Task 6: │
                                        │  Admin   │
                                        │ worktree │
                                        └──────────┘
```

- **Task 1** — на main, блокирует все остальные
- **Tasks 2, 3, 4, 5** — параллельно в отдельных worktrees после мержа Task 1
- **Task 6** — после мержа Task 1 + Task 2 (нужен middleware и auth)
