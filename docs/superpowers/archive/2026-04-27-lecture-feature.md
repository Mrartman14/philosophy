# Lecture feature — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Слайс `src/features/lectures/` — публичная витрина (list + detail), админ-CRUD, owner update + visibility toggle, по конвенциям `docs/frontend-conventions.md` и шаблону `src/features/_template/`.

**Architecture:** Feature slice "B+". Server-first: server components + server actions через `createFormAction`. Cover image — out of scope (бэк не отдаёт URL, FE-инфры нет). Permissions выровнены с бэком: `lecture.create` / `lecture.delete` (cap), update + visibility (owner-only).

**Tech Stack:** Next.js 16 (App Router) + React 19 + Base UI 1.x + openapi-fetch + Zod + Vitest. См. spec: [`../specs/2026-04-27-lecture-feature-design.md`](../specs/2026-04-27-lecture-feature-design.md).

**Pre-conditions:**
- `src/features/_template/` существует (шаблон).
- `src/utils/{permissions,me,create-action,revalidate}.ts` готовы.
- `src/components/ui/*` — все примитивы готовы (`Form`, `FormField`, `TextInput`, `Textarea`, `Select`, `Pagination`, `EmptyState`, `Table`, `ConfirmDialog`, `Button`, `SubmitButton`).
- `src/api/{schema,client,types,tags}.ts` готовы. `Lecture`, `LectureCreateRequest`, `LectureUpdateRequest` уже реэкспортированы из `@/api/types`.
- `src/app/admin/admin-sidebar.tsx` уже знает про `/admin/lectures` — **не трогаем**.

**Запретные зоны** (см. `CLAUDE.md`): не редактируем `src/api/schema.ts`, `src/app/layout.tsx`, `src/app/admin/{layout,admin-sidebar}.tsx`, `src/app/globals.css`, `src/components/ui/*`, `src/utils/*`, `src/components/{shared,app,permission,…}`. Только в `src/api/tags.ts` добавим константу `LECTURES`.

**Все коммиты делать с trailer'ом** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

**Не делать:** `git stash`, `git reset`, `git checkout .`, `git clean`, `git add -A`, `git add .` (только по имени файла).

---

## Phase 1: Scaffold slice + register tag

### Task 1: Скопировать шаблон, переименовать, зарегистрировать `LECTURES` тег

**Files:**

- Create: `src/features/lectures/{api.ts, actions.ts, permissions.ts, schemas.ts, types.ts, index.ts, permissions.test.ts, schemas.test.ts, ui/}` (копия `_template/`).
- Modify: `src/api/tags.ts`.

**Why:** Стартовая точка по конвенциям §2. Тег нужен сразу, чтобы `revalidateEntity("lectures")` в actions резолвил тот же литерал, что и `unstable_cache` (если будем добавлять).

- [ ] **Step 1: Скопировать шаблон**

```bash
cp -r src/features/_template src/features/lectures
```

- [ ] **Step 2: Удалить README.md из копии (он привязан к шаблону)**

```bash
rm src/features/lectures/README.md
```

- [ ] **Step 3: Заменить заглушку `types.ts` реальными сужениями**

Перезаписать `src/features/lectures/types.ts`:

```ts
// src/features/lectures/types.ts
import type { Lecture as LectureSchema } from "@/api/types";
import type { components } from "@/api/schema";

export type Lecture = LectureSchema;
export type LectureVisibility = components["schemas"]["lecture.Visibility"];
export type LectureListItem = Pick<
  Lecture,
  "id" | "owner_id" | "visibility" | "title" | "description" | "date" | "created_at" | "updated_at"
>;
```

- [ ] **Step 4: Зарегистрировать тег `LECTURES` в `src/api/tags.ts`**

В существующем объекте `Tags` заменить плейсхолдер на:

```ts
export const Tags = {
  LECTURES: "lectures",
} as const;
```

- [ ] **Step 5: Промежуточная проверка типов**

Run: `npm run lint -- --max-warnings=0 src/features/lectures src/api/tags.ts`
Expected: PASS (или предупреждения про неиспользуемые `_placeholder`-экспорты в скопированных файлах — это нормально, они уйдут в следующих тасках).

- [ ] **Step 6: Commit**

```bash
git add src/features/lectures src/api/tags.ts
git commit -m "$(cat <<'EOF'
feat(lectures): scaffold slice from template + register LECTURES tag

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Schemas (TDD)

### Task 2: Zod-схемы для FormData + тесты

**Files:**

- Modify: `src/features/lectures/schemas.ts`
- Modify: `src/features/lectures/schemas.test.ts`

**Why:** Schemas — единственная защита от мусора в FormData. Тесты по конвенциям §5: каждая схема → 1 success + ≥1 failure.

- [ ] **Step 1: Написать failing тесты в `schemas.test.ts`**

Перезаписать файл:

```ts
// src/features/lectures/schemas.test.ts
import { describe, it, expect } from "vitest";
import {
  LectureCreateSchema,
  LectureUpdateSchema,
  LectureVisibilitySchema,
  LectureIdSchema,
} from "./schemas";

describe("LectureCreateSchema", () => {
  it("принимает валидные поля", () => {
    const r = LectureCreateSchema.safeParse({
      title: "Кант",
      description: "Введение в критику",
      date: "2026-04-27",
      visibility: "public",
    });
    expect(r.success).toBe(true);
  });

  it("принимает без description и без visibility", () => {
    const r = LectureCreateSchema.safeParse({
      title: "Кант",
      date: "2026-04-27",
    });
    expect(r.success).toBe(true);
  });

  it("отклоняет пустой title", () => {
    const r = LectureCreateSchema.safeParse({ title: "", date: "2026-04-27" });
    expect(r.success).toBe(false);
  });

  it("отклоняет title длиннее 200 символов", () => {
    const r = LectureCreateSchema.safeParse({
      title: "x".repeat(201),
      date: "2026-04-27",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет date в неверном формате", () => {
    const r = LectureCreateSchema.safeParse({
      title: "Кант",
      date: "27.04.2026",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет неизвестный visibility", () => {
    const r = LectureCreateSchema.safeParse({
      title: "Кант",
      date: "2026-04-27",
      visibility: "secret",
    });
    expect(r.success).toBe(false);
  });
});

describe("LectureUpdateSchema", () => {
  it("принимает валидные поля с id", () => {
    const r = LectureUpdateSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Кант",
      description: "",
      date: "2026-04-27",
    });
    expect(r.success).toBe(true);
  });

  it("отклоняет невалидный uuid", () => {
    const r = LectureUpdateSchema.safeParse({
      id: "not-a-uuid",
      title: "Кант",
      description: "",
      date: "2026-04-27",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет пустой title", () => {
    const r = LectureUpdateSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "",
      description: "",
      date: "2026-04-27",
    });
    expect(r.success).toBe(false);
  });
});

describe("LectureVisibilitySchema", () => {
  it("принимает валидную пару id+visibility", () => {
    const r = LectureVisibilitySchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      visibility: "private",
    });
    expect(r.success).toBe(true);
  });

  it("отклоняет невалидный uuid", () => {
    const r = LectureVisibilitySchema.safeParse({
      id: "x",
      visibility: "private",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет неизвестный visibility", () => {
    const r = LectureVisibilitySchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      visibility: "secret",
    });
    expect(r.success).toBe(false);
  });
});

describe("LectureIdSchema", () => {
  it("принимает валидный uuid", () => {
    const r = LectureIdSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(r.success).toBe(true);
  });

  it("отклоняет невалидный uuid", () => {
    const r = LectureIdSchema.safeParse({ id: "x" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Прогон — должны падать**

Run: `npx vitest run src/features/lectures/schemas.test.ts`
Expected: FAIL (схем ещё нет).

- [ ] **Step 3: Реализовать схемы в `schemas.ts`**

Перезаписать файл:

```ts
// src/features/lectures/schemas.ts
import "server-only";
import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const LectureCreateSchema = z.object({
  title: z.string().trim().min(1, "Введите название").max(200, "До 200 символов"),
  description: z.string().max(5000, "До 5000 символов").optional().default(""),
  date: z.string().regex(ISO_DATE, "Дата должна быть в формате ГГГГ-ММ-ДД"),
  visibility: z.enum(["private", "public"]).optional(),
});

export const LectureUpdateSchema = z.object({
  id: z.string().uuid("Некорректный id лекции"),
  title: z.string().trim().min(1, "Введите название").max(200, "До 200 символов"),
  description: z.string().max(5000, "До 5000 символов").default(""),
  date: z.string().regex(ISO_DATE, "Дата должна быть в формате ГГГГ-ММ-ДД"),
});

export const LectureVisibilitySchema = z.object({
  id: z.string().uuid("Некорректный id лекции"),
  visibility: z.enum(["private", "public"]),
});

export const LectureIdSchema = z.object({
  id: z.string().uuid("Некорректный id лекции"),
});

export type LectureCreateInput = z.infer<typeof LectureCreateSchema>;
export type LectureUpdateInput = z.infer<typeof LectureUpdateSchema>;
export type LectureVisibilityInput = z.infer<typeof LectureVisibilitySchema>;
export type LectureIdInput = z.infer<typeof LectureIdSchema>;
```

- [ ] **Step 4: Прогон — должны проходить**

Run: `npx vitest run src/features/lectures/schemas.test.ts`
Expected: PASS — все 13 тестов зелёные.

- [ ] **Step 5: Commit**

```bash
git add src/features/lectures/schemas.ts src/features/lectures/schemas.test.ts
git commit -m "$(cat <<'EOF'
feat(lectures): add Zod schemas for FormData with tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: Permissions (TDD)

### Task 3: Доменные permissions + тесты

**Files:**

- Modify: `src/features/lectures/permissions.ts`
- Modify: `src/features/lectures/permissions.test.ts`

**Why:** Бэк-источник правды по правам, фронт — лишь UI-гейтинг. Тесты по чеклисту шаблона: guest=false, suspended=false, owner-positive, non-owner-negative, capability-positive/negative.

- [ ] **Step 1: Написать failing тесты**

Перезаписать `src/features/lectures/permissions.test.ts`:

```ts
// src/features/lectures/permissions.test.ts
import { describe, it, expect } from "vitest";
import type { Me } from "@/utils/me";
import {
  canCreateLecture,
  canUpdateLecture,
  canDeleteLecture,
  canSetLectureVisibility,
} from "./permissions";

const owner = "00000000-0000-0000-0000-000000000001";
const stranger = "00000000-0000-0000-0000-000000000002";

const activeAdmin: Me = {
  id: owner,
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: ["lecture.create", "lecture.delete"],
};

const activeUser: Me = {
  id: owner,
  username: "user",
  role: "user",
  status: "active",
  capabilities: [],
};

const activeUserNotOwner: Me = { ...activeUser, id: stranger };

const suspendedAdmin: Me = { ...activeAdmin, status: "suspended" };

const lecture = { owner_id: owner };

describe("canCreateLecture", () => {
  it("гость → false", () => {
    expect(canCreateLecture(null)).toBe(false);
  });

  it("user без cap → false", () => {
    expect(canCreateLecture(activeUser)).toBe(false);
  });

  it("admin с lecture.create → true", () => {
    expect(canCreateLecture(activeAdmin)).toBe(true);
  });

  it("suspended admin → false", () => {
    expect(canCreateLecture(suspendedAdmin)).toBe(false);
  });
});

describe("canUpdateLecture", () => {
  it("гость → false", () => {
    expect(canUpdateLecture(null, lecture)).toBe(false);
  });

  it("owner active → true", () => {
    expect(canUpdateLecture(activeUser, lecture)).toBe(true);
  });

  it("not-owner → false", () => {
    expect(canUpdateLecture(activeUserNotOwner, lecture)).toBe(false);
  });

  it("suspended owner → false", () => {
    const suspended: Me = { ...activeUser, status: "suspended" };
    expect(canUpdateLecture(suspended, lecture)).toBe(false);
  });
});

describe("canSetLectureVisibility", () => {
  it("owner active → true", () => {
    expect(canSetLectureVisibility(activeUser, lecture)).toBe(true);
  });

  it("not-owner → false", () => {
    expect(canSetLectureVisibility(activeUserNotOwner, lecture)).toBe(false);
  });

  it("гость → false", () => {
    expect(canSetLectureVisibility(null, lecture)).toBe(false);
  });
});

describe("canDeleteLecture", () => {
  it("гость → false", () => {
    expect(canDeleteLecture(null)).toBe(false);
  });

  it("admin с lecture.delete → true", () => {
    expect(canDeleteLecture(activeAdmin)).toBe(true);
  });

  it("user без cap → false", () => {
    expect(canDeleteLecture(activeUser)).toBe(false);
  });

  it("suspended admin → false", () => {
    expect(canDeleteLecture(suspendedAdmin)).toBe(false);
  });
});
```

- [ ] **Step 2: Прогон — должны падать**

Run: `npx vitest run src/features/lectures/permissions.test.ts`
Expected: FAIL (хелперы ещё не реализованы).

- [ ] **Step 3: Реализовать `permissions.ts`**

Перезаписать:

```ts
// src/features/lectures/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can, isMutationAllowed } from "@/utils/permissions";

export function canCreateLecture(me: MaybeMe): boolean {
  return can(me, "lecture.create");
}

export function canUpdateLecture(
  me: MaybeMe,
  lecture: { owner_id: string },
): boolean {
  if (!isMutationAllowed(me)) return false;
  return lecture.owner_id === me.id;
}

export function canSetLectureVisibility(
  me: MaybeMe,
  lecture: { owner_id: string },
): boolean {
  if (!isMutationAllowed(me)) return false;
  return lecture.owner_id === me.id;
}

export function canDeleteLecture(me: MaybeMe): boolean {
  return can(me, "lecture.delete");
}
```

- [ ] **Step 4: Прогон — должны проходить**

Run: `npx vitest run src/features/lectures/permissions.test.ts`
Expected: PASS — все тесты зелёные.

- [ ] **Step 5: Commit**

```bash
git add src/features/lectures/permissions.ts src/features/lectures/permissions.test.ts
git commit -m "$(cat <<'EOF'
feat(lectures): add domain permission helpers with tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: API fetchers

### Task 4: `getLectures` + `getLectureById`

**Files:**

- Modify: `src/features/lectures/api.ts`

**Why:** Server fetchers — единая точка обращения к бэкенду из server components. `getLectureById` обязан **возвращать `null` на 404**, чтобы page-уровень мог сделать `notFound()` без `try/catch` гимнастики (бэк отдаёт 404 для несуществующих и для private не-owner — `internal/lecture/service.go:213`).

- [ ] **Step 1: Перезаписать `api.ts`**

```ts
// src/features/lectures/api.ts
import "server-only";
import { cache } from "react";
import { createApiClient } from "@/api/client";
import type { Lecture } from "./types";

export interface LectureListFilter {
  q?: string;
  tag?: string;
  offset?: number;
  limit?: number;
}

export interface LectureListResult {
  items: Lecture[];
  total: number;
  offset: number;
  limit: number;
}

export const getLectures = cache(
  async (filter: LectureListFilter = {}): Promise<LectureListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const query: { offset: number; limit: number; q?: string; tag?: string } = {
      offset,
      limit,
    };
    if (filter.q) query.q = filter.q;
    if (filter.tag) query.tag = filter.tag;

    const { data, error } = await api.GET("/api/lectures", { params: { query } });
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить лекции");
    }
    return {
      items: (data?.data ?? []) as Lecture[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);

export const getLectureById = cache(async (id: string): Promise<Lecture | null> => {
  const api = await createApiClient();
  const { data, error, response } = await api.GET("/api/lectures/{id}", {
    params: { path: { id } },
  });
  if (response.status === 404) return null;
  if (error) {
    throw new Error(error.error ?? "Не удалось загрузить лекцию");
  }
  const lecture = data?.data;
  return (lecture ?? null) as Lecture | null;
});
```

- [ ] **Step 2: Прогон — типы и lint**

Run: `npm run lint -- --max-warnings=0 src/features/lectures/api.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/lectures/api.ts
git commit -m "$(cat <<'EOF'
feat(lectures): add getLectures and getLectureById fetchers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5: Server actions

### Task 5: create/update/setVisibility/delete actions

**Files:**

- Modify: `src/features/lectures/actions.ts`

**Why:** 4 мутации по конвенциям §3.3. `createLecture`/`updateLecture`/`setLectureVisibility` через `createFormAction` + `parseFormData`. `deleteLecture` через `createAction(id)` — он вызывается из `<ConfirmDialog onConfirm={async () => …}>`, не из `<form action>` (см. конвенции §3.4: ConfirmDialog не surface'ит ошибки `onConfirm`, поэтому всё равно нужна обёртка с тостом, и `createAction` тут проще, чем строить FormData вручную).

- [ ] **Step 1: Перезаписать `actions.ts`**

```ts
// src/features/lectures/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";
import { canCreateLecture, canDeleteLecture } from "./permissions";
import {
  LectureCreateSchema,
  LectureIdSchema,
  LectureUpdateSchema,
  LectureVisibilitySchema,
} from "./schemas";
import type { Lecture } from "./types";

type ApiError = { code?: string; error?: string };

function rethrowApiError(err: ApiError | undefined): never {
  if (err?.code === "forbidden") {
    throw new ForbiddenError("role", err.error);
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}

export const createLecture = createFormAction(async (formData) => {
  const me = await getMe();
  const input = parseFormData(LectureCreateSchema, formData);
  requireCapability(me, canCreateLecture);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/admin/lectures", { body: input });
  if (error) rethrowApiError(error);
  revalidateEntity("lectures");
  return (data?.data ?? null) as Lecture | null;
});

export const updateLecture = createFormAction(async (formData) => {
  const input = parseFormData(LectureUpdateSchema, formData);
  // Owner-чек делает бэк (см. spec §8). Маппим 403/404 → ForbiddenError/Error.
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/lectures/{id}", {
    params: { path: { id: input.id } },
    body: { title: input.title, description: input.description, date: input.date },
  });
  if (error) rethrowApiError(error);
  revalidateEntity("lectures", input.id);
  revalidateEntity("lectures");
  return (data?.data ?? null) as Lecture | null;
});

export const setLectureVisibility = createFormAction(async (formData) => {
  const input = parseFormData(LectureVisibilitySchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/lectures/{id}/visibility", {
    params: { path: { id: input.id } },
    body: { visibility: input.visibility },
  });
  if (error) rethrowApiError(error);
  revalidateEntity("lectures", input.id);
  revalidateEntity("lectures");
  return (data?.data ?? null) as Lecture | null;
});

export const deleteLecture = createAction(async (rawId: string) => {
  const me = await getMe();
  const { id } = LectureIdSchema.parse({ id: rawId });
  requireCapability(me, canDeleteLecture);
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/lectures/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error);
  revalidateEntity("lectures");
  return undefined;
});
```

- [ ] **Step 2: Прогон**

Run: `npm run lint -- --max-warnings=0 src/features/lectures/actions.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/lectures/actions.ts
git commit -m "$(cat <<'EOF'
feat(lectures): add server actions (create/update/setVisibility/delete)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6: Public UI (server components + search)

### Task 6: `LectureCard`, `LectureList`, `LectureDetail`, `LectureSearchForm`

**Files:**

- Create: `src/features/lectures/ui/lecture-card.tsx`
- Create: `src/features/lectures/ui/lecture-list.tsx`
- Create: `src/features/lectures/ui/lecture-detail.tsx`
- Create: `src/features/lectures/ui/lecture-search-form.tsx`

**Why:** Server components переиспользуются на публичных и админ-страницах. Search-форма — единственный клиент-компонент в публичной части (просто URL-update).

- [ ] **Step 1: `lecture-card.tsx`**

```tsx
// src/features/lectures/ui/lecture-card.tsx
import Link from "next/link";
import type { Lecture } from "../types";

export function LectureCard({ lecture }: { lecture: Lecture }) {
  return (
    <article className="flex flex-col gap-2 rounded border border-(--color-border) p-4 transition hover:bg-(--color-text-pane)">
      <Link href={`/lectures/${lecture.id}`} className="text-base font-semibold hover:underline">
        {lecture.title}
      </Link>
      <p className="text-xs text-(--color-description)">{lecture.date}</p>
      {lecture.description && (
        <p className="line-clamp-3 text-sm text-(--color-description)">{lecture.description}</p>
      )}
    </article>
  );
}
```

- [ ] **Step 2: `lecture-list.tsx`**

```tsx
// src/features/lectures/ui/lecture-list.tsx
import { EmptyState } from "@/components/ui";
import type { Lecture } from "../types";
import { LectureCard } from "./lecture-card";

export function LectureList({ items }: { items: Lecture[] }) {
  if (items.length === 0) {
    return <EmptyState title="Лекций не найдено" description="Попробуйте изменить фильтры или поиск." />;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((lecture) => (
        <li key={lecture.id}>
          <LectureCard lecture={lecture} />
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: `lecture-detail.tsx`**

```tsx
// src/features/lectures/ui/lecture-detail.tsx
import type { Lecture } from "../types";

export function LectureDetail({ lecture }: { lecture: Lecture }) {
  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{lecture.title}</h1>
        <p className="text-sm text-(--color-description)">{lecture.date}</p>
      </header>
      {lecture.description && (
        <div className="whitespace-pre-wrap text-base">{lecture.description}</div>
      )}
    </article>
  );
}
```

- [ ] **Step 4: `lecture-search-form.tsx`** (client)

```tsx
// src/features/lectures/ui/lecture-search-form.tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { Button, TextInput } from "@/components/ui";

interface Props {
  basePath: string;
}

export function LectureSearchForm({ basePath }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const initialQ = params.get("q") ?? "";

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = String(fd.get("q") ?? "").trim();
    const next = new URLSearchParams(params.toString());
    if (q) next.set("q", q);
    else next.delete("q");
    next.delete("offset");
    startTransition(() => {
      router.replace(`${basePath}?${next.toString()}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <TextInput
        name="q"
        defaultValue={initialQ}
        placeholder="Поиск по названию или описанию"
        aria-label="Поиск лекций"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "Найти"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Прогон**

Run: `npm run lint -- --max-warnings=0 src/features/lectures/ui && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/lectures/ui/lecture-card.tsx src/features/lectures/ui/lecture-list.tsx src/features/lectures/ui/lecture-detail.tsx src/features/lectures/ui/lecture-search-form.tsx
git commit -m "$(cat <<'EOF'
feat(lectures): add public UI (card/list/detail/search-form)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7: Forms (create / edit / visibility / delete)

### Task 7: Create-форма + страница `/admin/lectures/new`

**Files:**

- Create: `src/features/lectures/ui/lecture-create-form.tsx`

**Why:** Standalone страница `/admin/lectures/new` — лучше UX для длинного description. После успешного create редирект через `useEffect` → `router.push` (см. spec §8 «После создания»).

- [ ] **Step 1: `lecture-create-form.tsx`**

```tsx
// src/features/lectures/ui/lecture-create-form.tsx
"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Form,
  FormField,
  Select,
  SubmitButton,
  TextInput,
  Textarea,
} from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { createLecture } from "../actions";
import type { Lecture } from "../types";

const initial: ActionResult<Lecture | null> = { success: true, data: null };

export function LectureCreateForm() {
  const router = useRouter();
  const [state, action] = useActionState(createLecture, initial);
  const fieldErrors =
    state.success === false && state.code === "validation" ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state.success && state.data) {
      router.push(`/admin/lectures/${state.data.id}/edit`);
    }
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors} className="max-w-xl">
      <FormField name="title" label="Название" required>
        <TextInput name="title" required maxLength={200} />
      </FormField>

      <FormField name="date" label="Дата" required description="Формат ГГГГ-ММ-ДД">
        <TextInput name="date" required placeholder="2026-04-27" />
      </FormField>

      <FormField name="description" label="Описание">
        <Textarea name="description" rows={6} maxLength={5000} />
      </FormField>

      <FormField name="visibility" label="Видимость">
        <Select
          name="visibility"
          defaultValue="private"
          options={[
            { value: "private", label: "Приватная" },
            { value: "public", label: "Публичная" },
          ]}
        />
      </FormField>

      {state.success === false && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на создание лекции.</p>
      )}
      {state.success === false && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>Создать</SubmitButton>
      </div>
    </Form>
  );
}
```

- [ ] **Step 2: Прогон**

Run: `npm run lint -- --max-warnings=0 src/features/lectures/ui/lecture-create-form.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/lectures/ui/lecture-create-form.tsx
git commit -m "$(cat <<'EOF'
feat(lectures): add LectureCreateForm

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 8: Edit-форма + visibility toggle + delete-кнопка

**Files:**

- Create: `src/features/lectures/ui/lecture-edit-form.tsx`
- Create: `src/features/lectures/ui/lecture-visibility-toggle.tsx`
- Create: `src/features/lectures/ui/lecture-delete-button.tsx`

**Why:** Edit-страница объединяет три действия. Visibility toggle — отдельная мини-форма с auto-submit; native `<select>` проще, чем `BaseSelect` для этого UX (нужен прямой `e.currentTarget.form.requestSubmit()`).

- [ ] **Step 1: `lecture-visibility-toggle.tsx`**

```tsx
// src/features/lectures/ui/lecture-visibility-toggle.tsx
"use client";
import { useActionState, type ChangeEvent } from "react";
import type { ActionResult } from "@/utils/create-action";
import { setLectureVisibility } from "../actions";
import type { Lecture } from "../types";

const initial: ActionResult<Lecture | null> = { success: true, data: null };

export function LectureVisibilityToggle({
  lecture,
}: {
  lecture: Pick<Lecture, "id" | "visibility">;
}) {
  // Браузер сохраняет выбранный пользователем option в DOM до перезагрузки.
  // Сервер revalidate'ит lectures-кеш в action — на следующей навигации
  // server-component получит свежие данные.
  const [state, action] = useActionState(setLectureVisibility, initial);

  function autoSubmit(e: ChangeEvent<HTMLSelectElement>) {
    e.currentTarget.form?.requestSubmit();
  }

  return (
    <form action={action} className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor="lecture-visibility">
        Видимость
      </label>
      <input type="hidden" name="id" value={lecture.id} />
      <select
        id="lecture-visibility"
        name="visibility"
        defaultValue={lecture.visibility}
        onChange={autoSubmit}
        className="h-10 rounded border border-(--color-border) bg-(--color-background) px-3 text-sm"
      >
        <option value="private">Приватная</option>
        <option value="public">Публичная</option>
      </select>
      {state.success === false && state.code === "forbidden" && (
        <p className="text-xs text-red-600">У вас нет прав на смену видимости.</p>
      )}
      {state.success === false && !state.code && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}
    </form>
  );
}
```

- [ ] **Step 2: `lecture-delete-button.tsx`**

```tsx
// src/features/lectures/ui/lecture-delete-button.tsx
"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { deleteLecture } from "../actions";

interface Props {
  lectureId: string;
  redirectTo?: string;
}

export function LectureDeleteButton({ lectureId, redirectTo }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">Удалить</Button>}
      title="Удалить лекцию?"
      description="Действие необратимо."
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = await deleteLecture(lectureId);
        if (!result.success) {
          if (result.code === "forbidden") {
            toast.add({ title: "Нет прав", description: "У вас нет прав на удаление лекции." });
          } else {
            toast.add({ title: "Ошибка", description: result.error });
          }
          return;
        }
        if (redirectTo) {
          startTransition(() => router.push(redirectTo));
        } else {
          startTransition(() => router.refresh());
        }
      }}
    />
  );
}
```

- [ ] **Step 3: `lecture-edit-form.tsx`**

```tsx
// src/features/lectures/ui/lecture-edit-form.tsx
"use client";
import { useActionState } from "react";
import {
  Form,
  FormField,
  SubmitButton,
  TextInput,
  Textarea,
} from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { updateLecture } from "../actions";
import type { Lecture } from "../types";
import { LectureDeleteButton } from "./lecture-delete-button";
import { LectureVisibilityToggle } from "./lecture-visibility-toggle";

const initial: ActionResult<Lecture | null> = { success: true, data: null };

interface Props {
  lecture: Lecture;
  canSetVisibility: boolean;
  canDelete: boolean;
}

export function LectureEditForm({ lecture, canSetVisibility, canDelete }: Props) {
  const [state, action] = useActionState(updateLecture, initial);
  const fieldErrors =
    state.success === false && state.code === "validation" ? state.fieldErrors : undefined;

  return (
    <div className="flex flex-col gap-6">
      <Form action={action} errors={fieldErrors} className="max-w-xl">
        <input type="hidden" name="id" value={lecture.id} />

        <FormField name="title" label="Название" required>
          <TextInput name="title" required maxLength={200} defaultValue={lecture.title} />
        </FormField>

        <FormField name="date" label="Дата" required description="Формат ГГГГ-ММ-ДД">
          <TextInput name="date" required defaultValue={lecture.date} />
        </FormField>

        <FormField name="description" label="Описание">
          <Textarea
            name="description"
            rows={6}
            maxLength={5000}
            defaultValue={lecture.description ?? ""}
          />
        </FormField>

        {state.success === false && state.code === "forbidden" && (
          <p className="text-sm text-red-600">У вас нет прав на редактирование.</p>
        )}
        {state.success === false && !state.code && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
        {state.success && state.data && (
          <p className="text-sm text-green-600">Сохранено.</p>
        )}

        <div>
          <SubmitButton>Сохранить</SubmitButton>
        </div>
      </Form>

      {canSetVisibility && (
        <div className="max-w-xs border-t border-(--color-border) pt-4">
          <LectureVisibilityToggle lecture={lecture} />
        </div>
      )}

      {canDelete && (
        <div className="border-t border-(--color-border) pt-4">
          <LectureDeleteButton lectureId={lecture.id} redirectTo="/admin/lectures" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Прогон**

Run: `npm run lint -- --max-warnings=0 src/features/lectures/ui && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/lectures/ui/lecture-edit-form.tsx src/features/lectures/ui/lecture-visibility-toggle.tsx src/features/lectures/ui/lecture-delete-button.tsx
git commit -m "$(cat <<'EOF'
feat(lectures): add edit form, visibility toggle, delete button

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 8: Admin row + index.ts public API

### Task 9: `LectureAdminRow` + `index.ts`

**Files:**

- Create: `src/features/lectures/ui/lecture-admin-row.tsx`
- Modify: `src/features/lectures/index.ts`

**Why:** Admin-list использует таблицу: одна строка = одна лекция + кнопки. Public API слайса фиксируем сразу — pages-таски ниже будут импортить только через `@/features/lectures`.

- [ ] **Step 1: `lecture-admin-row.tsx`**

```tsx
// src/features/lectures/ui/lecture-admin-row.tsx
import Link from "next/link";
import { Td, Tr } from "@/components/ui";
import type { Lecture } from "../types";
import { LectureDeleteButton } from "./lecture-delete-button";

interface Props {
  lecture: Lecture;
  canEdit: boolean;
  canDelete: boolean;
}

export function LectureAdminRow({ lecture, canEdit, canDelete }: Props) {
  return (
    <Tr>
      <Td className="font-medium">{lecture.title}</Td>
      <Td className="text-(--color-description)">{lecture.date}</Td>
      <Td>{lecture.visibility === "public" ? "Публичная" : "Приватная"}</Td>
      <Td>
        <div className="flex gap-2">
          {canEdit && (
            <Link
              href={`/admin/lectures/${lecture.id}/edit`}
              className="text-sm underline hover:no-underline"
            >
              Редактировать
            </Link>
          )}
          {canDelete && <LectureDeleteButton lectureId={lecture.id} />}
        </div>
      </Td>
    </Tr>
  );
}
```

- [ ] **Step 2: Перезаписать `src/features/lectures/index.ts`**

```ts
// src/features/lectures/index.ts
// Public API слайса.
export { getLectures, getLectureById } from "./api";
export type { LectureListFilter, LectureListResult } from "./api";
export {
  createLecture,
  updateLecture,
  deleteLecture,
  setLectureVisibility,
} from "./actions";
export {
  canCreateLecture,
  canUpdateLecture,
  canDeleteLecture,
  canSetLectureVisibility,
} from "./permissions";
export { LectureList } from "./ui/lecture-list";
export { LectureCard } from "./ui/lecture-card";
export { LectureDetail } from "./ui/lecture-detail";
export { LectureSearchForm } from "./ui/lecture-search-form";
export { LectureCreateForm } from "./ui/lecture-create-form";
export { LectureEditForm } from "./ui/lecture-edit-form";
export { LectureAdminRow } from "./ui/lecture-admin-row";
export type { Lecture, LectureListItem, LectureVisibility } from "./types";
```

- [ ] **Step 3: Прогон**

Run: `npm run lint -- --max-warnings=0 src/features/lectures && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/lectures/ui/lecture-admin-row.tsx src/features/lectures/index.ts
git commit -m "$(cat <<'EOF'
feat(lectures): add admin row + finalize public API (index.ts)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 9: Public routes

### Task 10: `/lectures` + `/lectures/[id]`

**Files:**

- Create: `src/app/lectures/page.tsx`
- Create: `src/app/lectures/[id]/page.tsx`

**Why:** Витрина для всех (бэк сам отсеивает private). Detail отдаёт `notFound()` если бэк вернул 404 (включая private лекцию для не-owner).

- [ ] **Step 1: `src/app/lectures/page.tsx`**

```tsx
// src/app/lectures/page.tsx
import { getLectures, LectureList, LectureSearchForm } from "@/features/lectures";
import { Pagination } from "@/components/ui";

export const metadata = { title: "Лекции" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function pickString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function pickInt(v: string | string[] | undefined): number | undefined {
  const s = pickString(v);
  if (!s) return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export default async function LecturesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = pickString(sp.q);
  const tag = pickString(sp.tag);
  const offset = pickInt(sp.offset) ?? 0;
  const limit = pickInt(sp.limit) ?? 20;

  const filter: Parameters<typeof getLectures>[0] = { offset, limit };
  if (q) filter.q = q;
  if (tag) filter.tag = tag;

  const { items, total } = await getLectures(filter);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">Лекции</h1>
      <LectureSearchForm basePath="/lectures" />
      <LectureList items={items} />
      {total > limit && (
        <Pagination basePath="/lectures" offset={offset} limit={limit} total={total} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: `src/app/lectures/[id]/page.tsx`**

```tsx
// src/app/lectures/[id]/page.tsx
import { notFound } from "next/navigation";
import { getLectureById, LectureDetail } from "@/features/lectures";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LecturePage({ params }: Props) {
  const { id } = await params;
  const lecture = await getLectureById(id);
  if (!lecture) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <LectureDetail lecture={lecture} />
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const lecture = await getLectureById(id);
  return { title: lecture?.title ?? "Лекция" };
}
```

- [ ] **Step 3: Прогон**

Run: `npm run lint -- --max-warnings=0 src/app/lectures && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/lectures
git commit -m "$(cat <<'EOF'
feat(lectures): add public routes /lectures and /lectures/[id]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 10: Admin routes

### Task 11: `/admin/lectures`, `/admin/lectures/new`, `/admin/lectures/[id]/edit`

**Files:**

- Create: `src/app/admin/lectures/page.tsx`
- Create: `src/app/admin/lectures/new/page.tsx`
- Create: `src/app/admin/lectures/[id]/edit/page.tsx`

**Why:** Каждая страница — Layer-3 гейт по `getMe()` + capability-чек. Layout `src/app/admin/layout.tsx` уже даёт Layer-1 (admin.access).

- [ ] **Step 1: `src/app/admin/lectures/page.tsx`**

```tsx
// src/app/admin/lectures/page.tsx
import Link from "next/link";
import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  Button,
  EmptyState,
  Pagination,
  Table,
  Tbody,
  Th,
  Thead,
  Tr,
} from "@/components/ui";
import {
  canCreateLecture,
  canDeleteLecture,
  canUpdateLecture,
  getLectures,
  LectureAdminRow,
} from "@/features/lectures";

export const metadata = { title: "Админ — лекции" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function pickInt(v: string | string[] | undefined): number | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export default async function AdminLecturesPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canCreateLecture(me) && !canDeleteLecture(me)) forbidden();

  const sp = await searchParams;
  const offset = pickInt(sp.offset) ?? 0;
  const limit = pickInt(sp.limit) ?? 20;

  const { items, total } = await getLectures({ offset, limit });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Лекции</h1>
        {canCreateLecture(me) && (
          <Link href="/admin/lectures/new">
            <Button>Создать</Button>
          </Link>
        )}
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="Лекций пока нет"
          description="Создайте первую."
          action={
            canCreateLecture(me) ? (
              <Link href="/admin/lectures/new">
                <Button>Создать</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <Table>
            <Thead>
              <Tr>
                <Th>Название</Th>
                <Th>Дата</Th>
                <Th>Видимость</Th>
                <Th>Действия</Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map((lecture) => (
                <LectureAdminRow
                  key={lecture.id}
                  lecture={lecture}
                  canEdit={canUpdateLecture(me, lecture)}
                  canDelete={canDeleteLecture(me)}
                />
              ))}
            </Tbody>
          </Table>
          {total > limit && (
            <Pagination basePath="/admin/lectures" offset={offset} limit={limit} total={total} />
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `src/app/admin/lectures/new/page.tsx`**

```tsx
// src/app/admin/lectures/new/page.tsx
import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import { canCreateLecture, LectureCreateForm } from "@/features/lectures";

export const metadata = { title: "Новая лекция" };

export default async function NewLecturePage() {
  const me = await getMe();
  if (!canCreateLecture(me)) forbidden();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Новая лекция</h1>
      <LectureCreateForm />
    </div>
  );
}
```

- [ ] **Step 3: `src/app/admin/lectures/[id]/edit/page.tsx`**

```tsx
// src/app/admin/lectures/[id]/edit/page.tsx
import { forbidden, notFound } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  canDeleteLecture,
  canSetLectureVisibility,
  canUpdateLecture,
  getLectureById,
  LectureEditForm,
} from "@/features/lectures";

export const metadata = { title: "Редактирование лекции" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditLecturePage({ params }: Props) {
  const { id } = await params;
  const me = await getMe();
  const lecture = await getLectureById(id);
  if (!lecture) notFound();
  if (!canUpdateLecture(me, lecture)) forbidden();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{lecture.title}</h1>
      <LectureEditForm
        lecture={lecture}
        canSetVisibility={canSetLectureVisibility(me, lecture)}
        canDelete={canDeleteLecture(me)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Прогон**

Run: `npm run lint -- --max-warnings=0 src/app/admin/lectures && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/lectures
git commit -m "$(cat <<'EOF'
feat(lectures): add admin routes (list/new/edit) with capability gates

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 11: Final green

### Task 12: lint + test + build, чистка _placeholder

**Files:**

- Возможны точечные правки `src/features/lectures/**` если что-то не зелёное.

**Why:** Чеклист `_template/README.md` требует зелёные `lint && test && build` локально. Заодно убедиться, что нигде не остались `_placeholder`-экспорты из шаблона (после Phase 1—8 они должны быть полностью замещены).

- [ ] **Step 1: Lint всего проекта**

Run: `npm run lint`
Expected: PASS, 0 ошибок, 0 предупреждений.

Если красное — починить, не отключать правила (см. конвенции §7).

- [ ] **Step 2: Прогон всех тестов**

Run: `npm test`
Expected: PASS (включая `src/features/lectures/{schemas,permissions}.test.ts`, плюс всё, что было).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS, без ошибок генерации страниц.

- [ ] **Step 4: Sanity grep — нет ли остатков шаблона**

Run: `grep -rn "_placeholder\|PlaceholderSchema\|canPlaceholder" src/features/lectures`
Expected: пусто.

Если что-то нашлось — удалить и закоммитить отдельно:

```bash
git add src/features/lectures
git commit -m "$(cat <<'EOF'
chore(lectures): remove leftover placeholder symbols from template

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Если в Step 1—3 были фиксы — отдельный коммит**

```bash
git add <конкретные файлы по именам>
git commit -m "$(cat <<'EOF'
chore(lectures): final lint/test/build green

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Сводный чеклист готовности

(Должен быть весь зелёным после Task 12.)

- [ ] `index.ts` экспортирует только `api`, `actions`, `permissions`, `ui`, `types` (без `schemas`).
- [ ] `api.ts`, `actions.ts`, `permissions.ts`, `schemas.ts` начинаются с `import "server-only";`.
- [ ] Каждая `canXxx` покрыта тестом (4 хелпера).
- [ ] Каждая Zod-схема — 1 success + ≥1 failure (4 схемы).
- [ ] Использует `createFormAction` + `parseFormData` + `requireCapability` + `revalidateEntity`.
- [ ] Не импортирует другие `@/features/*`.
- [ ] `Tags.LECTURES = "lectures"` зарегистрирован в `src/api/tags.ts`.
- [ ] Шаблонные `_placeholder`/`PlaceholderSchema`/`canPlaceholder` удалены.
- [ ] `src/app/admin/admin-sidebar.tsx` НЕ изменён.
- [ ] `npm run lint && npm test && npm run build` — зелёные.
