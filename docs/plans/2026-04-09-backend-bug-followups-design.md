---
name: Backend bug follow-ups — 2026-04-09
description: Дизайн фронтенд-фоллоу-апов после фикса бэк-багов из docs/plans/2026-04-09-backend-bugs.md
date: 2026-04-09
---

# Дизайн: фронт-фоллоу-апы после фикса бэк-багов

Источник: [docs/plans/2026-04-09-backend-bugs.md](2026-04-09-backend-bugs.md)

## Контекст

Все 5 пунктов из `2026-04-09-backend-bugs.md` исправлены в `philosophy-api` и проверены в swagger:

| Бэк-фикс | Подтверждение |
|---|---|
| **P0-#1** JWT теперь несёт `status` | `philosophy-api/internal/user/service.go:69` — `"status": string(u.Status)` |
| **P0-#15** новые admin-эндпоинты (вариант 2 — отдельные admin-роуты) | `GET /api/admin/comments?lecture_id=&status=&offset=&limit=` и `GET /api/admin/annotations?...`. Возвращают плоский список (не nested). `status` — comma-separated, поддерживает `published,hidden,pending` |
| **P1-#4** `Comment.user_id` | `comment.Comment.user_id` (optional string) в swagger |
| **P1-#5** `Annotation.user_id` | `annotation.Annotation.user_id` (optional string) в swagger |
| **Backend-gap** | `GET /api/admin/users?offset=&limit=` (модератор+) |

Дополнительно: в рамках прошлой работы по type-safe swagger бэк перешёл на короткие имена схем (`comment.Comment` вместо `internal_comment.Comment`, `httputil.ListResponse` вместо `github_com_Mrartman14_philosophy-api_internal_httputil.ListResponse`). Это **каскадно затрагивает** `src/api/types.ts` — каждый реэкспорт нужно обновить. Проверено: `internal_*` встречается ТОЛЬКО в `src/api/schema.ts` и `src/api/types.ts` — за пределы этих двух файлов каскад не выходит.

## Скоуп

Закрывает все 5 пунктов из `backend-bugs.md`. Только фронт, бэк не трогается.

### Что входит

1. Реген `src/api/schema.ts` через `npm run generate:api` + полное переписывание `src/api/types.ts` под новые имена схем.
2. P0-#1: восстановление работы `isAuthorized = user.status === "active"` в `comment-list.tsx` (автоматически после регена и изменения JWT — никаких правок не требуется в `get-user.ts`).
3. P1-#4: замена костыля `canEdit` в `comment-list.tsx` на `comment.user_id === user.id`.
4. P1-#5: замена `canEdit` в `annotation-list.tsx` на `a.user_id === user.id`.
5. P0-#15: переключение `/admin/comments` и `/admin/annotations` на новые admin-эндпоинты, добавление вкладок статуса (single-select tabs, дефолт `Pending`).
6. Backend-gap: замена ручной формы в `/admin/users` на таблицу с пагинацией и inline-формой статуса.

### Что НЕ входит

- Никаких изменений в `philosophy-api/`.
- Никаких рефакторингов сверх перечисленного.
- Никаких изменений в `src/features/{comments,annotations}/api.ts` для публичных эндпоинтов — они работают и используются на лекциях.
- Никакого multi-select UI для статуса (бэк готов, но первая итерация — single-tab).
- Никаких новых тестов (в проекте нет тестового рантайма).
- Никаких бэкфиллов `comments.user_id`/`annotations.user_id` в БД.

## Подход

**Один последовательный sweep в отдельной сессии**, без параллельных агентов. Параллелить нечего: реген `schema.ts` + переписывание `types.ts` — общий ресурс, через который проходят все остальные работы.

Серия из 4 атомарных коммитов в одной сессии. Каждый коммит — самодостаточен (компилится, проходит lint).

## Распределение по коммитам

### Коммит 1 — `chore(api): regenerate schema, update types.ts to new short names`

**Что:**
1. `npm run generate:api` — перезаписывает `src/api/schema.ts`.
2. Полное переписывание `src/api/types.ts`. Все имена схем меняются с длинных на короткие:

| Старое | Новое |
|---|---|
| `internal_lecture.Lecture` | `lecture.Lecture` |
| `internal_lecture.CreateRequest` | `lecture.CreateRequest` |
| `internal_lecture.UpdateRequest` | `lecture.UpdateRequest` |
| `internal_transcript.*` | `transcript.*` |
| `internal_lecturefile.*` | `lecturefile.*` |
| `internal_comment.Comment` | `comment.Comment` (с новым `user_id?: string`) |
| `internal_comment.Author` | `comment.Author` |
| `internal_comment.CreateRequest` | `comment.CreateRequest` |
| `internal_comment.UpdateRequest` | `comment.UpdateRequest` |
| `internal_comment.ReactionSummary` | `comment.ReactionSummary` |
| `internal_comment.ReactionType` | `comment.ReactionType` |
| `internal_comment.AddReactionRequest` | `comment.AddReactionRequest` |
| `internal_annotation.Annotation` | `annotation.Annotation` (с новым `user_id?: string`) |
| `internal_annotation.*` | `annotation.*` |
| `internal_user.User` | `user.User` |
| `internal_user.RegisterRequest` | `user.RegisterRequest` |
| `internal_user.UpdateStatusRequest` | `user.UpdateStatusRequest` |
| `internal_push.*` | `push.*` |
| `internal_search.*` | `search.*` |
| `github_com_Mrartman14_philosophy-api_internal_moderation.ModerationStatus` | `moderation.ModerationStatus` |

**Артефакт:** `src/api/schema.ts` (полностью), `src/api/types.ts` (все exports переименованы).

**Верификация:** `npx tsc --noEmit` — должен быть зелёным. Потребители (`@/api/types`) не меняются.

**Риск:** если `openapi-typescript` использует другой разделитель (например, `comment_Comment` вместо `comment.Comment`), карту замен нужно скорректировать по факту. Митигация — `Grep` в новом `schema.ts` сразу после регена.

---

### Коммит 2 — `fix(comments,annotations): use real user_id and JWT status`

**Закрывает:** P0-#1, P1-#4, P1-#5.

**Файл 1: `src/features/comments/comment-list.tsx`**

Заменить блок `canEdit` (строки ~50–62):

```tsx
// БЫЛО:
const isAuthor =
  user !== null &&
  !comment.is_anonymous &&
  comment.author?.username !== undefined &&
  // username в JWT отсутствует — сравнение невозможно, полагаемся на роль.
  // Редактирование: только свой комментарий (бэкенд проверит автора).
  // Для упрощения UI — показываем кнопку edit только авторизованным;
  // неавторских комментариев по факту не отредактируешь.
  isAuthorized;
const canEdit = isAuthor;
const canDelete = isAuthor || isPrivileged;

// СТАЛО:
const canEdit = user !== null && comment.user_id === user.id;
const canDelete = canEdit || isPrivileged;
```

`isAuthorized = user !== null && user.status === "active"` (строка 24) **остаётся как есть** — после P0-#1 проверка автоматически начнёт работать корректно для активных пользователей.

**Файл 2: `src/features/annotations/annotation-list.tsx:76`**

```tsx
// БЫЛО:
const canEdit = canModerate || (user != null && !a.is_anonymous);
const canDelete = canEdit;

// СТАЛО:
const canEdit = canModerate || (user != null && a.user_id === user.id);
const canDelete = canEdit;
```

Условие `!a.is_anonymous` убирается — у анонимной аннотации `user_id` всё равно сохраняется в БД (это серверная информация), и автор имеет право редактировать свою анонимку.

**Что НЕ трогаем:**
- `src/utils/get-user.ts` — уже корректно читает `payload.status`.
- Server actions для `editComment`/`deleteComment` — авторизация на бэке.
- `CommentItem`, `AnnotationItem`, `AnnotationItemActions` — пропсы те же.

**Верификация:**
- `npx tsc --noEmit` — зелёный.
- Ручная: залогиниться обычным пользователем → видна форма комментария → кнопки реакций активны → edit/delete только на своих.

---

### Коммит 3 — `feat(admin/moderation): switch to admin endpoints with status filter`

**Закрывает:** P0-#15.

**Новые файлы:**

1. **`src/features/admin/comments/api.ts`**:

```ts
import { createApiClient } from "@/api/client";
import type { Comment, ModerationStatus } from "@/api/types";

export interface AdminCommentListResult {
  data: Comment[];
  offset: number;
  limit: number;
  total: number;
}

export async function getCommentsAdmin(
  lectureId: string,
  statuses: ModerationStatus[] = [],
  offset = 0,
  limit = 20
): Promise<AdminCommentListResult> {
  const client = await createApiClient();
  const { data, error } = await client.GET("/api/admin/comments", {
    params: {
      query: {
        lecture_id: lectureId,
        ...(statuses.length > 0 ? { status: statuses.join(",") } : {}),
        offset,
        limit,
      },
    },
  });
  if (error || !data) throw new Error("Ошибка загрузки комментариев");
  return {
    data: data.data ?? [],
    offset: data.pagination?.offset ?? offset,
    limit: data.pagination?.limit ?? limit,
    total: data.pagination?.total ?? 0,
  };
}
```

2. **`src/features/admin/annotations/api.ts`** — симметрично, `getAnnotationsAdmin()` → `/api/admin/annotations`.

3. **`src/features/admin/moderation/status-tabs.tsx`** — server-side компонент вкладок:

```tsx
import Link from "next/link";
import type { ModerationStatus } from "@/api/types";

export type Tab = ModerationStatus | "all";

const TABS: { value: Tab; label: string }[] = [
  { value: "pending", label: "На модерации" },
  { value: "published", label: "Опубликованные" },
  { value: "hidden", label: "Скрытые" },
  { value: "all", label: "Все" },
];

interface StatusTabsProps {
  baseHref: string;        // "/admin/comments"
  lectureId: string;       // обязателен
  current: Tab;            // дефолт "pending"
}

export function StatusTabs({ baseHref, lectureId, current }: StatusTabsProps) {
  const buildHref = (tab: Tab) => {
    const params = new URLSearchParams({ lecture_id: lectureId });
    if (tab !== "pending") params.set("status", tab);  // pending — дефолт, в URL не пишем
    return `${baseHref}?${params.toString()}`;
  };

  return (
    <nav className="flex gap-1 border-b border-(--color-border)" aria-label="Фильтр по статусу">
      {TABS.map((tab) => (
        <Link
          key={tab.value}
          href={buildHref(tab.value)}
          aria-current={current === tab.value ? "page" : undefined}
          className={[
            "px-3 py-1.5 text-sm border-b-2",
            current === tab.value
              ? "border-(--color-primary) font-semibold"
              : "border-transparent text-(--color-description)",
          ].join(" ")}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function parseStatusParam(raw: string | undefined): ModerationStatus[] {
  if (raw === undefined) return ["pending"];        // дефолт
  if (raw === "all") return [];                     // пусто = без фильтра
  const valid: ModerationStatus[] = ["published", "hidden", "pending"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ModerationStatus => valid.includes(s as ModerationStatus));
}

export function statusToTab(statuses: ModerationStatus[]): Tab {
  if (statuses.length === 0) return "all";
  if (statuses.length === 1) return statuses[0];
  return "all";  // multi UI не поддерживается
}
```

**Изменения в существующих файлах:**

4. **`src/app/admin/comments/page.tsx`**:
   - Импортировать `getCommentsAdmin` вместо `getComments`.
   - Импортировать `StatusTabs`, `parseStatusParam`, `statusToTab`.
   - Добавить `status?: string` в `searchParams`.
   - Парсить `statuses` через `parseStatusParam(statusStr)`.
   - Передавать `statuses` в `getCommentsAdmin(lectureId, statuses, offset, limit)`.
   - Рендерить `<StatusTabs baseHref="/admin/comments" lectureId={lectureId} current={currentTab} />` после `LectureSelector` (только если `lectureId` задан).
   - Обновить `buildHref` для пагинации — сохранять `status` в URL.

5. **`src/app/admin/annotations/page.tsx`** — симметрично.

**Что НЕ трогаем:**
- `comment-moderation.tsx`/`annotation-moderation.tsx` — рендеринг плоского списка корректный.
- `revalidatePath` в server actions — путь не меняется.
- Публичный `getComments` в `src/features/comments/api.ts` — нужен для лекций.

**Edge case — комментарий исчезает после смены статуса:**
После клика «Опубликовать» комментарий уходит из вкладки `Pending`. Это **корректное и желательное** поведение модератора (очередь уменьшается). В первой итерации — без анимации/индикатора, полагаемся на `revalidatePath` (YAGNI).

**Верификация:**
- `npx tsc --noEmit`
- Ручная: залогиниться админом → `/admin/comments?lecture_id=X` → дефолт `Pending` → клик «Все» → видны все статусы → клик «Опубликовать» на pending → элемент исчезает → клик `Pending` → подтверждается. То же для `/admin/annotations`.

---

### Коммит 4 — `feat(admin/users): paginated user table`

**Закрывает:** Backend-gap.

**Новые файлы:**

1. **`src/features/admin/users/api.ts`**:

```ts
import { createApiClient } from "@/api/client";
import type { User } from "@/api/types";

export interface AdminUserListResult {
  data: User[];
  offset: number;
  limit: number;
  total: number;
}

export async function getUsers(
  offset = 0,
  limit = 20
): Promise<AdminUserListResult> {
  const client = await createApiClient();
  const { data, error } = await client.GET("/api/admin/users", {
    params: { query: { offset, limit } },
  });
  if (error || !data) throw new Error("Ошибка загрузки пользователей");
  return {
    data: data.data ?? [],
    offset: data.pagination?.offset ?? offset,
    limit: data.pagination?.limit ?? limit,
    total: data.pagination?.total ?? 0,
  };
}
```

2. **`src/features/admin/users/user-table.tsx`** (server component) — таблица с колонками: Username, Роль, Статус, Создан, ID. В колонке «Статус» — `<UserStatusInline userId={u.id} currentStatus={u.status} />`.

3. **`src/features/admin/users/user-status-inline.tsx`** (client component):

```tsx
"use client";

import { useState, useTransition } from "react";
import type { UserStatus } from "@/api/types";
import { updateUserStatus } from "@/features/admin/actions";

interface UserStatusInlineProps {
  userId: string;
  currentStatus: UserStatus;
}

export const UserStatusInline: React.FC<UserStatusInlineProps> = ({
  userId,
  currentStatus,
}) => {
  const [status, setStatus] = useState<UserStatus>(currentStatus);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleChange = (next: UserStatus) => {
    setStatus(next);
    setError(null);
    startTransition(async () => {
      const result = await updateUserStatus({ userId, status: next });
      if (!result.success) {
        setError(result.error);
        setStatus(currentStatus);  // откат при ошибке
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value as UserStatus)}
        disabled={pending}
        className="px-2 py-1 border border-(--color-border) rounded bg-transparent text-xs disabled:opacity-50"
      >
        <option value="active">active</option>
        <option value="suspended">suspended</option>
        <option value="banned">banned</option>
      </select>
      {error && (
        <span className="text-xs text-red-500" title={error}>!</span>
      )}
    </div>
  );
};
```

Без кнопки «сохранить» — статус меняется сразу при выборе. Существующий server action `updateUserStatus` уже делает `revalidatePath("/admin/users")`.

**Изменения в существующих файлах:**

4. **`src/app/admin/users/page.tsx`** — заменить ручную форму на серверную загрузку списка через `getUsers(offset, limit)`, рендер `<UserTable users={users} />`, пагинация ссылками `?offset=...`.

5. **`src/features/admin/users/user-status-form.tsx`** — **удалить файл** (`git rm`). Inline-форма в таблице покрывает функциональность.

**Edge case — админ деактивирует сам себя:**
JWT не пересоздаётся, разлогин не происходит до следующего входа. Это поведение бэка, не баг этой задачи. Отметить в `todo.md` при необходимости. Не блокирует.

**Верификация:**
- `npx tsc --noEmit`
- Ручная: `/admin/users` → видна таблица → меняешь статус через `<select>` → revalidatePath перезагружает страницу → новый статус сохранён.

---

## Финальная верификация (после всех 4 коммитов)

```bash
npx tsc --noEmit          # зелёный
npm run lint              # eslint src/ — без warning/error
npm run build             # next build — успешен
```

Ручная проверка end-to-end:

1. **Авторизованный пользователь** (`role=user`, `status=active`):
   - Открыть лекцию → видна форма комментария, кнопки реакций активны.
   - Создать комментарий → появляется → edit/delete только на нём.
   - Чужой комментарий → нет edit/delete.
2. **Админ:**
   - `/admin/comments?lecture_id=X` → дефолт `Pending`, видны вкладки.
   - Клик «Все» → видны все статусы.
   - Клик «Опубликовать» на pending → элемент уходит из вкладки.
   - То же для `/admin/annotations`.
   - `/admin/users` → таблица с пагинацией → смена статуса через `<select>` работает.

## Риски и митигация

1. **Имена схем после `openapi-typescript`.** Если генератор использует другой разделитель (`comment_Comment` вместо `comment.Comment`) — карту замен в коммите 1 скорректировать. Митигация: `Grep` имени `Comment` в новом `schema.ts` сразу после регена.

2. **`comment.user_id` приходит `undefined` для старых комментариев.** Если бэк не бэкфилнул `user_id` для существующих анонимных, `canEdit` будет всегда `false` — поведение деградирует до «не могу редактировать своё анонимное». Митигация: проверить через бэкенд (`SELECT COUNT(*) FROM comments WHERE user_id IS NULL`). Не блокирует — отдельная задача на бэк-бэкфилл при необходимости.

3. **Анонимные с `user_id`.** Аноним всё ещё имеет `user_id` в БД (`is_anonymous=true` плюс серверная инфа). Логика `comment.user_id === user.id` корректна — автор анонимки видит свои edit/delete, другие — нет. UI показывает «Аноним» как имя автора. ✓

4. **Регенерация `schema.ts` локально требует `../philosophy-api/docs/swagger/swagger.json`.** Файл существует и свежий. Fallback — `SWAGGER_URL` env var.

## Чеклист (для исполняющей сессии)

| # | Что | Проверка |
|---|---|---|
| C1 | Реген + `types.ts` | `tsc --noEmit` зелёный, ноль изменений в `src/features/`/`src/app/` |
| C2 | comment-list + annotation-list | `tsc` зелёный, кнопки edit/delete только на своих |
| C3 | admin/comments + admin/annotations + StatusTabs | `tsc` зелёный, дефолт «Pending», вкладки переключаются |
| C4 | admin/users таблица | `tsc` зелёный, `user-status-form.tsx` удалён |
| F1 | `npm run lint` | чисто |
| F2 | `npm run build` | успешен |
| F3 | Ручная проверка | пройдена |
