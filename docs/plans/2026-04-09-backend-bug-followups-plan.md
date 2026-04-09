# Backend Bug Follow-ups Implementation Plan — 2026-04-09

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Закрыть все 5 фронт-фоллоу-апов после фикса бэк-багов из [docs/plans/2026-04-09-backend-bugs.md](2026-04-09-backend-bugs.md): регенерация схемы API, восстановление авторства и статуса в комментариях/аннотациях, переключение страниц модерации на новые admin-эндпоинты с фильтром по статусу, добавление таблицы пользователей.

**Architecture:** Один последовательный sweep в одной сессии без параллельных агентов. Серия из 4 атомарных коммитов: каждый коммит самодостаточен (компилится, проходит lint). Параллелить нельзя — `src/api/types.ts` общий ресурс, через который проходят все правки.

**Tech Stack:** Next.js 16, React 19 (server components + client components), TypeScript, openapi-fetch, openapi-typescript, Tailwind v4.

**Источник дизайна:** [2026-04-09-backend-bug-followups-design.md](2026-04-09-backend-bug-followups-design.md)

---

## Правила для исполняющего агента (КРИТИЧНО)

Из [CLAUDE.md](../../CLAUDE.md):

- **НЕ** делать `git stash`, `git reset`, `git checkout .`, `git clean`, `git restore`.
- **НЕ** делать `git add -A` / `git add .` — добавлять только свои файлы по имени.
- **НЕ** откатывать изменения, сделанные другими агентами.
- Общаться с пользователем на русском.
- Файлы и папки в `src/` — kebab-case.
- Между шагами одного коммита — НЕ коммитить промежуточные состояния. Один коммит = одна задача из плана.
- В случае ошибки `tsc`/`lint` — НЕ обходить через `// @ts-ignore` или `// eslint-disable`. Чинить корень.

---

## Контекст для агента, который это будет исполнять

Перед началом прочитай:
1. [docs/plans/2026-04-09-backend-bug-followups-design.md](2026-04-09-backend-bug-followups-design.md) — полный дизайн.
2. [docs/plans/2026-04-09-backend-bugs.md](2026-04-09-backend-bugs.md) — список бэк-багов и фоллоу-апов.

Все 5 пунктов из `backend-bugs.md` уже исправлены в `philosophy-api`. Убедиться можно через:
- `Grep "user_id" /Users/alexander.borisenko/Documents/philosophy-api/docs/swagger/swagger.json`
- `Grep "/api/admin/comments" /Users/alexander.borisenko/Documents/philosophy-api/docs/swagger/swagger.json`
- `Grep "/api/admin/users" /Users/alexander.borisenko/Documents/philosophy-api/docs/swagger/swagger.json`

Бэк перешёл на короткие имена схем (`comment.Comment` вместо `internal_comment.Comment`). После регена `src/api/schema.ts` все имена изменятся, и потребуется полное переписывание `src/api/types.ts`.

Проверено: `internal_*` и `github_com_Mrartman14_*` встречаются ТОЛЬКО в `src/api/schema.ts` и `src/api/types.ts`. Каскад обновления контейнится в эти два файла. Все потребители (`Comment`, `Annotation`, `User` и т.д.) импортируют через `@/api/types` и не пострадают.

---

## Task 1: Регенерация схемы и переписывание `src/api/types.ts`

**Цель:** Получить актуальный `src/api/schema.ts` с новыми эндпоинтами и полями `user_id`, переписать `src/api/types.ts` под новые короткие имена схем.

**Files:**
- Modify: `src/api/schema.ts` (полная перезапись через `npm run generate:api`)
- Modify: `src/api/types.ts` (все exports переименовать)

### Step 1.1: Регенерировать схему

Run:
```bash
cd /Users/alexander.borisenko/Documents/philosophy && npm run generate:api
```

Expected: команда успешна, `src/api/schema.ts` перезаписан. Никаких ошибок про отсутствие swagger.json.

### Step 1.2: Проверить новые имена схем

Использовать `Grep` (не bash):

```
Grep pattern: "^        \"(comment|annotation|user|lecture|transcript|moderation|httputil|push|search|lecturefile|rbac|apperror)\\.[A-Z]"
path: src/api/schema.ts
output_mode: content
-n: true
head_limit: 50
```

Expected: видны имена вида `"comment.Comment"`, `"annotation.Annotation"`, `"user.User"`, `"moderation.ModerationStatus"`, `"httputil.ListResponse"`, `"httputil.Pagination"` и т.д.

**Если имена другого формата** (например, `comment_Comment` или с разделителем `__`) — карту замен в Step 1.3 нужно скорректировать. Используй фактические имена из `schema.ts`.

### Step 1.3: Полностью переписать `src/api/types.ts`

Используй `Write` (не Edit — переписываем всё), новое содержимое:

```ts
/**
 * Плоские реэкспорты всех схем из `schema.ts`.
 *
 * Используй вместо `components["schemas"]["..."]`.
 *   import type { Lecture, Comment, Annotation } from "@/api/types";
 *
 * Файл поддерживается вручную. После обновления `schema.ts` (через `npm run generate:api`)
 * проверь, что здесь реэкспортированы все нужные схемы.
 */

import type { components } from "./schema";

type Schemas = components["schemas"];

// --- Lectures ---
export type Lecture = Schemas["lecture.Lecture"];
export type LectureCreateRequest = Schemas["lecture.CreateRequest"];
export type LectureUpdateRequest = Schemas["lecture.UpdateRequest"];

// --- Transcript ---
export type Transcript = Schemas["transcript.Transcript"];
export type Segment = Schemas["transcript.Segment"];
export type SegmentCreateRequest = Schemas["transcript.CreateSegmentRequest"];
export type SegmentUpdateRequest = Schemas["transcript.UpdateSegmentRequest"];

// --- Files ---
export type LectureFile = Schemas["lecturefile.LectureFile"];
export type FileType = Schemas["lecturefile.FileType"];

// --- Comments ---
export type Comment = Schemas["comment.Comment"];
export type CommentAuthor = Schemas["comment.Author"];
export type CommentCreateRequest = Schemas["comment.CreateRequest"];
export type CommentUpdateRequest = Schemas["comment.UpdateRequest"];
export type CommentReactionSummary = Schemas["comment.ReactionSummary"];
export type CommentReactionType = Schemas["comment.ReactionType"];
export type CommentAddReactionRequest = Schemas["comment.AddReactionRequest"];

// --- Annotations ---
export type Annotation = Schemas["annotation.Annotation"];
export type AnnotationAuthor = Schemas["annotation.Author"];
export type AnnotationCreateRequest = Schemas["annotation.CreateRequest"];
export type AnnotationUpdateRequest = Schemas["annotation.UpdateRequest"];

// --- Users ---
export type User = Schemas["user.User"];
export type UserRegisterRequest = Schemas["user.RegisterRequest"];
export type UserUpdateStatusRequest = Schemas["user.UpdateStatusRequest"];
export type UserStatus = UserUpdateStatusRequest["status"];

// --- Push ---
export type PushSubscribeRequest = Schemas["push.SubscribeRequest"];
export type PushUnsubscribeRequest = Schemas["push.UnsubscribeRequest"];
export type PushSendRequest = Schemas["push.SendRequest"];
export type PushSubscribeKeys = Schemas["push.SubscribeKeys"];

// --- Search ---
export type SearchLectureHit = Schemas["search.LectureHit"];
export type SearchMatch = Schemas["search.Match"];

// --- Moderation ---
export type ModerationStatus = Schemas["moderation.ModerationStatus"];
```

⚠️ Если на Step 1.2 имена оказались другими — соответствующим образом скорректируй ключи `Schemas["..."]`.

### Step 1.4: Проверить компиляцию

Run:
```bash
cd /Users/alexander.borisenko/Documents/philosophy && npx tsc --noEmit
```

Expected: ноль ошибок. Если есть ошибки — это значит:
- (a) В `types.ts` опечатка в имени схемы → найди правильное имя в `schema.ts` и поправь `types.ts`.
- (b) Какой-то потребитель напрямую импортирует `internal_*` → этого быть не должно (проверено), но если нашёлся — добавь в зону этого таска.

**НЕ** правь сами файлы потребителей `Comment`/`Annotation`/`User` в этом таске — это работа Task 2/3/4.

### Step 1.5: Проверить, что нигде не осталось старых имён

```
Grep pattern: "internal_(comment|annotation|user|lecture|transcript|moderation|push|search|lecturefile)|github_com_Mrartman14"
path: src
output_mode: files_with_matches
```

Expected: ноль файлов в результате (или только `src/api/schema.ts`, если `openapi-typescript` оставил какие-то имена с `internal_` в комментариях/неактивных типах).

### Step 1.6: Коммит

```bash
cd /Users/alexander.borisenko/Documents/philosophy && git add src/api/schema.ts src/api/types.ts && git commit -m "$(cat <<'EOF'
chore(api): regenerate schema, update types.ts to new short names

Бэк перешёл на короткие имена схем (comment.Comment вместо
internal_comment.Comment, httputil.ListResponse вместо
github_com_Mrartman14_philosophy-api_internal_httputil.ListResponse).
После регена swagger переименованы все реэкспорты в types.ts.

Новые поля comment.user_id и annotation.user_id уже видны в schema.ts —
будут использованы в следующих коммитах (P1-#4, P1-#5).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

Expected: один коммит создан, `tsc` остаётся зелёным.

---

## Task 2: Восстановить авторство и статус в `comment-list.tsx` + `annotation-list.tsx`

**Цель:** Закрыть P0-#1, P1-#4, P1-#5. После Task 1 поля `user.status` (через JWT) и `comment.user_id`/`annotation.user_id` (через swagger) уже доступны — нужно ими воспользоваться.

**Files:**
- Modify: `src/features/comments/comment-list.tsx:50-62`
- Modify: `src/features/annotations/annotation-list.tsx:76`

### Step 2.1: Прочитать текущий `comment-list.tsx`

```
Read: src/features/comments/comment-list.tsx
```

Убедись, что блок `canEdit` совпадает с тем, что в дизайне (строки ~50–62). Если уже изменён кем-то — STOP и попроси подтверждения у пользователя.

### Step 2.2: Заменить блок `canEdit` в `comment-list.tsx`

Используй `Edit`, заменяй блок целиком (8 строк → 2):

old_string:
```tsx
        {comments.map((comment) => {
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
```

new_string:
```tsx
        {comments.map((comment) => {
          const canEdit = user !== null && comment.user_id === user.id;
          const canDelete = canEdit || isPrivileged;
```

⚠️ Не трогай строку 24 (`isAuthorized = user !== null && user.status === "active"`) — она автоматически начнёт работать после Task 1 благодаря JWT-фиксу P0-#1.

### Step 2.3: Прочитать `annotation-list.tsx`

```
Read: src/features/annotations/annotation-list.tsx
```

Найди строку 76 — блок `canEdit`.

### Step 2.4: Заменить блок `canEdit` в `annotation-list.tsx`

old_string:
```tsx
        const canEdit = canModerate || (user != null && !a.is_anonymous);
        const canDelete = canEdit;
```

new_string:
```tsx
        const canEdit = canModerate || (user != null && a.user_id === user.id);
        const canDelete = canEdit;
```

### Step 2.5: Проверить компиляцию

Run:
```bash
cd /Users/alexander.borisenko/Documents/philosophy && npx tsc --noEmit
```

Expected: зелёный.

Если ошибка `Property 'user_id' does not exist on type 'Comment'` — значит Task 1 не довёл реген до конца. Вернуться к Task 1.2 и проверить новый `schema.ts`.

### Step 2.6: Коммит

```bash
cd /Users/alexander.borisenko/Documents/philosophy && git add src/features/comments/comment-list.tsx src/features/annotations/annotation-list.tsx && git commit -m "$(cat <<'EOF'
fix(comments,annotations): use real user_id and JWT status

- comment-list.tsx: canEdit теперь сравнивает comment.user_id с user.id
  (вместо костыля «полагаемся на роль»). Удалён TODO-комментарий.
- annotation-list.tsx: canEdit учитывает annotation.user_id вместо
  !is_anonymous. Автор анонимной аннотации теперь может её редактировать.
- isAuthorized = user.status === "active" в comment-list.tsx остаётся
  как был — после фикса P0-#1 на бэке (JWT теперь несёт status) проверка
  начала работать корректно для активных пользователей.

Закрывает P0-#1, P1-#4, P1-#5 из 2026-04-09-backend-bugs.md.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Переключить `/admin/comments` и `/admin/annotations` на admin-эндпоинты со вкладками статуса

**Цель:** Закрыть P0-#15. Создать admin-API функции, server-side компонент вкладок, обновить две страницы модерации.

**Files:**
- Create: `src/features/admin/comments/api.ts`
- Create: `src/features/admin/annotations/api.ts`
- Create: `src/features/admin/moderation/status-tabs.tsx`
- Modify: `src/app/admin/comments/page.tsx`
- Modify: `src/app/admin/annotations/page.tsx`

### Step 3.1: Создать `src/features/admin/comments/api.ts`

```
Write: src/features/admin/comments/api.ts
```

content:
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

### Step 3.2: Создать `src/features/admin/annotations/api.ts`

```
Write: src/features/admin/annotations/api.ts
```

content:
```ts
import { createApiClient } from "@/api/client";
import type { Annotation, ModerationStatus } from "@/api/types";

export interface AdminAnnotationListResult {
  data: Annotation[];
  offset: number;
  limit: number;
  total: number;
}

export async function getAnnotationsAdmin(
  lectureId: string,
  statuses: ModerationStatus[] = [],
  offset = 0,
  limit = 20
): Promise<AdminAnnotationListResult> {
  const client = await createApiClient();
  const { data, error } = await client.GET("/api/admin/annotations", {
    params: {
      query: {
        lecture_id: lectureId,
        ...(statuses.length > 0 ? { status: statuses.join(",") } : {}),
        offset,
        limit,
      },
    },
  });
  if (error || !data) throw new Error("Ошибка загрузки аннотаций");
  return {
    data: data.data ?? [],
    offset: data.pagination?.offset ?? offset,
    limit: data.pagination?.limit ?? limit,
    total: data.pagination?.total ?? 0,
  };
}
```

### Step 3.3: Создать `src/features/admin/moderation/status-tabs.tsx`

```
Write: src/features/admin/moderation/status-tabs.tsx
```

content:
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
  baseHref: string;
  lectureId: string;
  current: Tab;
}

export function StatusTabs({ baseHref, lectureId, current }: StatusTabsProps) {
  const buildHref = (tab: Tab) => {
    const params = new URLSearchParams({ lecture_id: lectureId });
    if (tab !== "pending") params.set("status", tab);
    return `${baseHref}?${params.toString()}`;
  };

  return (
    <nav
      className="flex gap-1 border-b border-(--color-border)"
      aria-label="Фильтр по статусу"
    >
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

export function parseStatusParam(
  raw: string | undefined
): ModerationStatus[] {
  if (raw === undefined) return ["pending"];
  if (raw === "all") return [];
  const valid: ModerationStatus[] = ["published", "hidden", "pending"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ModerationStatus =>
      valid.includes(s as ModerationStatus)
    );
}

export function statusToTab(statuses: ModerationStatus[]): Tab {
  if (statuses.length === 0) return "all";
  if (statuses.length === 1) return statuses[0];
  return "all";
}
```

### Step 3.4: Обновить `src/app/admin/comments/page.tsx`

```
Read: src/app/admin/comments/page.tsx
```

Затем `Write` целиком (это меньше 50 строк, легче переписать целиком):

content:
```tsx
import Link from "next/link";
import { getLectures } from "@/features/lectures/api";
import { getCommentsAdmin } from "@/features/admin/comments/api";
import { CommentModeration } from "@/features/admin/comments/comment-moderation";
import { LectureSelector } from "@/features/admin/moderation/lecture-selector";
import {
  StatusTabs,
  parseStatusParam,
  statusToTab,
} from "@/features/admin/moderation/status-tabs";
import type { Comment, Lecture } from "@/api/types";

export const metadata = { title: "Модерация комментариев — Админ" };

interface PageProps {
  searchParams: Promise<{
    lecture_id?: string;
    offset?: string;
    status?: string;
  }>;
}

export default async function AdminCommentsPage({ searchParams }: PageProps) {
  const {
    lecture_id: lectureId,
    offset: offsetStr,
    status: statusStr,
  } = await searchParams;
  const offset = Number(offsetStr ?? 0) || 0;
  const limit = 20;
  const statuses = parseStatusParam(statusStr);
  const currentTab = statusToTab(statuses);

  let lectures: Lecture[] = [];
  try {
    const result = await getLectures(0, 100);
    lectures = result.data;
  } catch {
    // покажем пустой список
  }

  let comments: Comment[] = [];
  let total = 0;
  let loadError = false;
  if (lectureId) {
    try {
      const result = await getCommentsAdmin(lectureId, statuses, offset, limit);
      comments = result.data;
      total = result.total;
    } catch {
      loadError = true;
    }
  }

  const hasPrev = offset > 0;
  const hasNext = lectureId
    ? total > 0
      ? offset + limit < total
      : comments.length === limit
    : false;

  const buildHref = (nextOffset: number) => {
    const params = new URLSearchParams();
    if (lectureId) params.set("lecture_id", lectureId);
    if (statusStr) params.set("status", statusStr);
    if (nextOffset > 0) params.set("offset", String(nextOffset));
    const qs = params.toString();
    return qs ? `/admin/comments?${qs}` : "/admin/comments";
  };

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <h1 className="text-2xl font-bold">Модерация комментариев</h1>

      <LectureSelector
        lectures={lectures}
        selectedId={lectureId}
        baseHref="/admin/comments"
        paramName="lecture_id"
      />

      {lectureId && (
        <StatusTabs
          baseHref="/admin/comments"
          lectureId={lectureId}
          current={currentTab}
        />
      )}

      {!lectureId && (
        <p className="text-sm text-(--color-description)">
          Выберите лекцию, чтобы увидеть комментарии.
        </p>
      )}

      {loadError && (
        <p className="text-sm text-red-500" role="alert">
          Не удалось загрузить комментарии.
        </p>
      )}

      {lectureId && !loadError && (
        <>
          {total > 0 && (
            <p className="text-sm text-(--color-description)">
              Показано {comments.length} из {total}
            </p>
          )}
          <CommentModeration comments={comments} lectureId={lectureId} />
          <div className="flex items-center gap-2">
            {hasPrev && (
              <Link
                href={buildHref(Math.max(0, offset - limit))}
                className="px-3 py-1 border border-(--color-border) rounded text-sm"
              >
                ← Назад
              </Link>
            )}
            {hasNext && (
              <Link
                href={buildHref(offset + limit)}
                className="px-3 py-1 border border-(--color-border) rounded text-sm"
              >
                Вперёд →
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

### Step 3.5: Обновить `src/app/admin/annotations/page.tsx`

```
Read: src/app/admin/annotations/page.tsx
```

Затем `Write` целиком:

content:
```tsx
import Link from "next/link";
import { getLectures } from "@/features/lectures/api";
import { getAnnotationsAdmin } from "@/features/admin/annotations/api";
import { AnnotationModeration } from "@/features/admin/annotations/annotation-moderation";
import { LectureSelector } from "@/features/admin/moderation/lecture-selector";
import {
  StatusTabs,
  parseStatusParam,
  statusToTab,
} from "@/features/admin/moderation/status-tabs";
import type { Annotation, Lecture } from "@/api/types";

export const metadata = { title: "Модерация аннотаций — Админ" };

interface PageProps {
  searchParams: Promise<{
    lecture_id?: string;
    offset?: string;
    status?: string;
  }>;
}

export default async function AdminAnnotationsPage({ searchParams }: PageProps) {
  const {
    lecture_id: lectureId,
    offset: offsetStr,
    status: statusStr,
  } = await searchParams;
  const offset = Number(offsetStr ?? 0) || 0;
  const limit = 20;
  const statuses = parseStatusParam(statusStr);
  const currentTab = statusToTab(statuses);

  let lectures: Lecture[] = [];
  try {
    const result = await getLectures(0, 100);
    lectures = result.data;
  } catch {
    // empty list
  }

  let annotations: Annotation[] = [];
  let total = 0;
  let loadError = false;
  if (lectureId) {
    try {
      const result = await getAnnotationsAdmin(
        lectureId,
        statuses,
        offset,
        limit
      );
      annotations = result.data;
      total = result.total;
    } catch {
      loadError = true;
    }
  }

  const hasPrev = offset > 0;
  const hasNext = lectureId
    ? total > 0
      ? offset + limit < total
      : annotations.length === limit
    : false;

  const buildHref = (nextOffset: number) => {
    const params = new URLSearchParams();
    if (lectureId) params.set("lecture_id", lectureId);
    if (statusStr) params.set("status", statusStr);
    if (nextOffset > 0) params.set("offset", String(nextOffset));
    const qs = params.toString();
    return qs ? `/admin/annotations?${qs}` : "/admin/annotations";
  };

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <h1 className="text-2xl font-bold">Модерация аннотаций</h1>

      <LectureSelector
        lectures={lectures}
        selectedId={lectureId}
        baseHref="/admin/annotations"
        paramName="lecture_id"
      />

      {lectureId && (
        <StatusTabs
          baseHref="/admin/annotations"
          lectureId={lectureId}
          current={currentTab}
        />
      )}

      {!lectureId && (
        <p className="text-sm text-(--color-description)">
          Выберите лекцию, чтобы увидеть аннотации.
        </p>
      )}

      {loadError && (
        <p className="text-sm text-red-500" role="alert">
          Не удалось загрузить аннотации.
        </p>
      )}

      {lectureId && !loadError && (
        <>
          {total > 0 && (
            <p className="text-sm text-(--color-description)">
              Показано {annotations.length} из {total}
            </p>
          )}
          <AnnotationModeration
            annotations={annotations}
            lectureId={lectureId}
          />
          <div className="flex items-center gap-2">
            {hasPrev && (
              <Link
                href={buildHref(Math.max(0, offset - limit))}
                className="px-3 py-1 border border-(--color-border) rounded text-sm"
              >
                ← Назад
              </Link>
            )}
            {hasNext && (
              <Link
                href={buildHref(offset + limit)}
                className="px-3 py-1 border border-(--color-border) rounded text-sm"
              >
                Вперёд →
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

### Step 3.6: Проверить компиляцию

Run:
```bash
cd /Users/alexander.borisenko/Documents/philosophy && npx tsc --noEmit
```

Expected: зелёный.

Если ошибка `'/api/admin/comments'` not found in paths — значит Task 1 не сгенерировал свежий schema. Вернись к Task 1.

### Step 3.7: Коммит

```bash
cd /Users/alexander.borisenko/Documents/philosophy && git add src/features/admin/comments/api.ts src/features/admin/annotations/api.ts src/features/admin/moderation/status-tabs.tsx src/app/admin/comments/page.tsx src/app/admin/annotations/page.tsx && git commit -m "$(cat <<'EOF'
feat(admin/moderation): switch to admin endpoints with status filter

- Новые api-функции getCommentsAdmin/getAnnotationsAdmin вызывают
  /api/admin/comments и /api/admin/annotations соответственно. Они
  возвращают плоский список с опциональным фильтром по статусам.
- Новый компонент StatusTabs (server-side) с вкладками
  Pending | Published | Hidden | Все. Дефолт — Pending (рабочая
  очередь модератора). Pending в URL не пишется, остальные — да.
- /admin/comments и /admin/annotations переключены на новые
  эндпоинты, добавлены вкладки. Пагинация сохраняет фильтр в URL.

Закрывает P0-#15 из 2026-04-09-backend-bugs.md.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Таблица пользователей в `/admin/users`

**Цель:** Закрыть Backend-gap. Заменить ручную форму на серверную таблицу с пагинацией и inline-формой статуса.

**Files:**
- Create: `src/features/admin/users/api.ts`
- Create: `src/features/admin/users/user-status-inline.tsx`
- Create: `src/features/admin/users/user-table.tsx`
- Modify: `src/app/admin/users/page.tsx`
- Delete: `src/features/admin/users/user-status-form.tsx`

### Step 4.1: Создать `src/features/admin/users/api.ts`

```
Write: src/features/admin/users/api.ts
```

content:
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

### Step 4.2: Создать `src/features/admin/users/user-status-inline.tsx`

```
Write: src/features/admin/users/user-status-inline.tsx
```

content:
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
        setStatus(currentStatus);
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
        <span className="text-xs text-red-500" title={error}>
          !
        </span>
      )}
    </div>
  );
};
```

### Step 4.3: Создать `src/features/admin/users/user-table.tsx`

```
Write: src/features/admin/users/user-table.tsx
```

content:
```tsx
import type { User } from "@/api/types";
import { UserStatusInline } from "./user-status-inline";

interface UserTableProps {
  users: User[];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function UserTable({ users }: UserTableProps) {
  if (users.length === 0) {
    return (
      <p className="text-sm text-(--color-description)">Пользователей нет.</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-(--color-border)">
            <th className="py-2 pr-3">Username</th>
            <th className="py-2 pr-3">Роль</th>
            <th className="py-2 pr-3">Статус</th>
            <th className="py-2 pr-3">Создан</th>
            <th className="py-2 pr-3">ID</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-(--color-border)">
              <td className="py-2 pr-3 font-medium">{u.username}</td>
              <td className="py-2 pr-3">{u.role}</td>
              <td className="py-2 pr-3">
                <UserStatusInline userId={u.id} currentStatus={u.status} />
              </td>
              <td className="py-2 pr-3 text-(--color-description)">
                {formatDate(u.created_at)}
              </td>
              <td className="py-2 pr-3 text-xs text-(--color-description) font-mono">
                {u.id}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Step 4.4: Обновить `src/app/admin/users/page.tsx`

```
Read: src/app/admin/users/page.tsx
```

Затем `Write` целиком:

content:
```tsx
import Link from "next/link";
import { getUsers } from "@/features/admin/users/api";
import { UserTable } from "@/features/admin/users/user-table";
import type { User } from "@/api/types";

export const metadata = { title: "Пользователи — Админ" };

interface PageProps {
  searchParams: Promise<{ offset?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const { offset: offsetStr } = await searchParams;
  const offset = Number(offsetStr ?? 0) || 0;
  const limit = 20;

  let users: User[] = [];
  let total = 0;
  let loadError = false;
  try {
    const result = await getUsers(offset, limit);
    users = result.data;
    total = result.total;
  } catch {
    loadError = true;
  }

  const hasPrev = offset > 0;
  const hasNext = total > 0 ? offset + limit < total : users.length === limit;
  const buildHref = (next: number) =>
    next > 0 ? `/admin/users?offset=${next}` : "/admin/users";

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <h1 className="text-2xl font-bold">Пользователи</h1>

      {loadError && (
        <p className="text-sm text-red-500" role="alert">
          Не удалось загрузить пользователей.
        </p>
      )}

      {!loadError && (
        <>
          {total > 0 && (
            <p className="text-sm text-(--color-description)">
              Показано {users.length} из {total}
            </p>
          )}
          <UserTable users={users} />
          <div className="flex items-center gap-2">
            {hasPrev && (
              <Link
                href={buildHref(Math.max(0, offset - limit))}
                className="px-3 py-1 border border-(--color-border) rounded text-sm"
              >
                ← Назад
              </Link>
            )}
            {hasNext && (
              <Link
                href={buildHref(offset + limit)}
                className="px-3 py-1 border border-(--color-border) rounded text-sm"
              >
                Вперёд →
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

### Step 4.5: Удалить `src/features/admin/users/user-status-form.tsx`

```bash
cd /Users/alexander.borisenko/Documents/philosophy && git rm src/features/admin/users/user-status-form.tsx
```

Expected: файл удалён, в индексе.

### Step 4.6: Проверить, что нигде не остался импорт удалённого файла

```
Grep pattern: "user-status-form|UserStatusForm"
path: src
output_mode: files_with_matches
```

Expected: ноль файлов в результате.

Если что-то нашлось — это значит, кто-то ещё импортировал старый компонент. Удали импорт и его использование в найденном файле — это допустимо в рамках Task 4 (cleanup сопутствующего удалению).

### Step 4.7: Проверить компиляцию

Run:
```bash
cd /Users/alexander.borisenko/Documents/philosophy && npx tsc --noEmit
```

Expected: зелёный.

### Step 4.8: Коммит

```bash
cd /Users/alexander.borisenko/Documents/philosophy && git add src/features/admin/users/api.ts src/features/admin/users/user-status-inline.tsx src/features/admin/users/user-table.tsx src/app/admin/users/page.tsx src/features/admin/users/user-status-form.tsx && git commit -m "$(cat <<'EOF'
feat(admin/users): paginated user table

- Новый api getUsers (offset, limit) → /api/admin/users.
- UserTable (server) — таблица username/role/status/created/id.
- UserStatusInline (client) — селект статуса прямо в строке;
  меняется без отдельной кнопки, ошибка откатывает значение.
- /admin/users теперь грузит список с пагинацией; ручная форма
  user-status-form.tsx удалена, её функцию покрывает inline.

Закрывает Backend-gap из 2026-04-09-backend-bugs.md.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

Note: `git add` для удалённого файла нужен — это фиксирует его удаление в коммите (`git rm` уже добавил его в индекс на Step 4.5, но повторный `git add` безопасен).

---

## Task 5: Финальная верификация

**Цель:** Убедиться что весь sweep компилится, проходит lint, билдится, и end-to-end проверка работает.

### Step 5.1: TypeScript

Run:
```bash
cd /Users/alexander.borisenko/Documents/philosophy && npx tsc --noEmit
```

Expected: ноль ошибок.

### Step 5.2: Lint

Run:
```bash
cd /Users/alexander.borisenko/Documents/philosophy && npm run lint
```

Expected: ноль warning/error.

Если есть warning о неиспользуемых импортах — они НЕ должны быть в файлах этого таска. Если есть — найди оставшиеся импорты `getComments`/`getAnnotations` (публичные api, которые должны были быть заменены на admin) или `UserStatusForm` (удалённый компонент).

### Step 5.3: Build

Run:
```bash
cd /Users/alexander.borisenko/Documents/philosophy && npm run build
```

Expected: успех. Скрипт выполняет `node scripts/generate-sw-assets.mjs && next build`. Возможны warning от Next.js про PWA — это норм и не блокирует.

### Step 5.4: Ручная проверка (опционально, но рекомендуется)

Если есть запущенный бэк (`philosophy-api`) и `npm run dev` фронта:

1. **Авторизованный пользователь** (роль `user`, статус `active`):
   - Открыть лекцию → видна форма комментария, кнопки реакций активны.
   - Создать комментарий → появляется → edit/delete только на нём.
   - Чужой комментарий → нет edit/delete.
2. **Админ:**
   - `/admin/comments?lecture_id=X` → дефолт `Pending`, видны вкладки.
   - Клик «Все» → видны все статусы.
   - Клик «Опубликовать» на pending → элемент уходит из вкладки.
   - То же для `/admin/annotations`.
   - `/admin/users` → таблица с пагинацией → смена статуса через `<select>` работает.

### Step 5.5: Доложить пользователю

Сообщить:
- Сколько коммитов создано (ожидается **4**).
- Каждый коммит — короткое имя и hash (получить через `git log --oneline -5`).
- Результат `tsc`, `lint`, `build`.
- Если ручная проверка проведена — её итоги.

---

## Чеклист для агента

| # | Шаг | Verified |
|---|---|---|
| T1 | Реген + types.ts + commit 1 | tsc зелёный |
| T2 | comment-list + annotation-list + commit 2 | tsc зелёный |
| T3 | admin api + StatusTabs + страницы + commit 3 | tsc зелёный |
| T4 | users api + table + inline + page + commit 4 | tsc зелёный, старый файл удалён |
| T5 | tsc + lint + build | всё зелёное |

## Risks & Recovery

1. **Step 1.3: имена схем не совпадают с картой** — проверь через `Grep` фактические имена в новом `schema.ts` и адаптируй ключи в `types.ts`. НЕ откатывай Step 1.1.

2. **Step 2.5: `Property 'user_id' does not exist on type 'Comment'`** — Task 1 не довёл реген до конца. Вернись к Task 1, проверь что `schema.ts` действительно содержит новое поле через `Grep "user_id" src/api/schema.ts`.

3. **Step 3.6: `'/api/admin/comments'` not found** — Task 1 не сгенерировал свежий schema, или `schema.ts` старый. Проверь через `Grep "/api/admin/comments" src/api/schema.ts` (должно найти).

4. **Step 5.2: lint падает на новых файлах** — НЕ обходи через `// eslint-disable`. Найди корень: возможно неиспользуемый импорт, неиспользуемый параметр, missing key в map. Поправь.

5. **Step 5.3: build падает** — это серьёзно. Сообщи пользователю с полным выводом ошибки. НЕ коммить «фикс» без согласования.

6. **Между Tasks обнаружен конфликт с другим агентом** — STOP. Согласно [CLAUDE.md](../../CLAUDE.md) НЕ откатывай чужие изменения. Сообщи пользователю.
