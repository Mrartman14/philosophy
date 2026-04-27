# Frontend conventions

Этот документ — единая точка входа для агента, начинающего новую фичу.
Архитектура, шаблон слайса, SSR-first паттерны, RBAC, тесты, запретные зоны.

Связанные документы:
- Дизайн фундамента: `docs/superpowers/specs/2026-04-26-frontend-foundation-design.md`
- Общие правила проекта: `CLAUDE.md` (русский язык, kebab-case, нет деструктивных git-операций)

---

## 1. Архитектура

Каждая сущность живёт в собственном слайсе `src/features/<entity>/`:

```
src/features/<entity>/
  index.ts          # public API: реэкспорт того, что нужно снаружи
  api.ts            # server-only fetchers (React.cache, опционально unstable_cache)
  actions.ts        # "use server" + server-only — мутации
  permissions.ts    # доменные can*-хелперы (server-only)
  schemas.ts        # Zod-схемы для FormData (server-only)
  types.ts          # сужения из @/api/schema
  ui/               # client- и server-компоненты слайса
  *.test.ts         # vitest: permissions.test.ts, schemas.test.ts
```

Жёсткие правила (enforced ESLint'ом, см. `eslint.config.mjs`):

- **Cross-feature импорты запрещены.** Один слайс не импортит другой.
  Общий код — в `@/components`, `@/utils`, `@/hooks`. Данные между слайсами
  ходят только через бекенд.
- **Deep-imports запрещены.** Снаружи слайс импортится только через
  `@/features/<entity>` (его `index.ts`).
- **`react-dom/client` не должен встречаться в server-only файлах слайса**
  (`api.ts`, `actions.ts`, `permissions.ts`, `schemas.ts`).

---

## 2. Шаблон слайса

Не пиши с нуля. Скопируй `src/features/_template/` в
`src/features/<entity>/`, переименуй и наполни. Чеклист — в
`src/features/_template/README.md`.

---

## 3. Паттерны

### 3.1. Server fetcher

```ts
// src/features/comments/api.ts
import "server-only";
import { cache } from "react";
import { createApiClient } from "@/api/client";

export const getComments = cache(async (lectureId: string) => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/comments", {
    params: { query: { lecture_id: lectureId } },
  });
  if (error) throw new Error(error.message);
  return data;
});
```

`React.cache()` дедуплицирует вызовы внутри одного запроса. Для cross-request
кеширования можно обернуть в `unstable_cache` с тегом из `@/api/tags`:

```ts
import { unstable_cache } from "next/cache";

export const getCommentsCached = unstable_cache(
  async (lectureId: string) => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/comments", { params: { query: { lecture_id: lectureId } } });
    if (error) throw new Error(error.message);
    return data;
  },
  ["comments-by-lecture"],
  { tags: ["comments"] }
);
```

Сигнатура `unstable_cache(cb, keyParts?, options?)` подтверждена в Next 16
(`next/dist/server/web/spec-extension/unstable-cache.d.ts`). API стабильно,
но семантика требует осознанности — заворачивай только то, что реально стабильно.

### 3.2. Инвалидация кеша

Никогда не вызывай `revalidateTag` напрямую — в Next 16 он требует второй
аргумент `profile` (`string | CacheLifeConfig`). Используй обёртку
`revalidateEntity` из `@/utils/revalidate`, она передаёт `"default"` под капотом:

```ts
import { revalidateEntity } from "@/utils/revalidate";

revalidateEntity("comments");           // сбрасывает тег "comments"
revalidateEntity("comments", "abc-123"); // плюс "comments:abc-123"
```

Конвенция тегов: `<entity>` для list, `<entity>:<id>` для item. Реестр — в
`src/api/tags.ts`, дополняй при создании `api.ts` слайса.

### 3.3. Server action

```ts
// src/features/comments/actions.ts
"use server";
import "server-only";
import { createFormAction, parseFormData } from "@/utils/create-action";
import { requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";
import { getMe } from "@/utils/me";
import { createApiClient } from "@/api/client";
import { canCreateComment } from "./permissions";
import { CommentCreateSchema } from "./schemas";

export const createComment = createFormAction(async (formData) => {
  const me = await getMe();
  const input = parseFormData(CommentCreateSchema, formData);
  requireCapability(me, canCreateComment);
  const api = await createApiClient();
  const { data, error } = await api.POST("/comments", { body: input });
  if (error) throw new Error(error.message);
  revalidateEntity("comments");
  return data;
});
```

`createFormAction` ловит `ForbiddenError` и `ZodValidationError`, превращая
их в `ActionResult { success: false, code: "forbidden" | "validation", … }`.
Внутренние ошибки Next.js (`redirect()`, `notFound()`, `forbidden()`)
пробрасываются дальше.

### 3.4. Форма с `useActionState`

```tsx
"use client";
import { useActionState } from "react";
import { Form, FormField, SubmitButton } from "@/components/ui";
import { createComment } from "@/features/comments";

export function CreateCommentForm() {
  const [state, action] = useActionState(createComment, { success: true, data: undefined });
  const fieldErrors = state.success === false && state.code === "validation"
    ? state.fieldErrors
    : undefined;

  return (
    <Form action={action} errors={fieldErrors}>
      <FormField name="text" label="Комментарий" />
      <SubmitButton>Отправить</SubmitButton>
      {state.success === false && state.code === "forbidden" && (
        <p>У вас нет прав на это действие.</p>
      )}
    </Form>
  );
}
```

`Form` из `@/components/ui` оборачивает Base UI `Form` и принимает
`errors: Record<string, string>` (Base UI допускает `string | string[]`,
наш wrapper упрощает до `string`).

### 3.5. Filter / search через `searchParams`

Для списков используем server-side фильтрацию через URL. Page получает
`searchParams: Promise<Record<string, string | string[]>>`, парсит и передаёт
в fetcher. Client-компоненты обновляют URL через `useRouter().replace()` —
revalidation бесплатна, fetcher запускается заново.

---

## 4. RBAC

Источник истины — бэкенд. Фронт читает `getMe()` (`src/utils/me.ts`),
получает `{ role, status, capabilities: string[] }` или `null` (гость).

- **В server actions:** `requireCapability(me, canX)` — кидает
  `ForbiddenError`, ловится `createAction`/`createFormAction`.
- **В server-components:** вызывай доменные `canX(me, …)` из
  `features/<entity>/permissions.ts`, пробрасывай boolean пропами в client.
- **В client UI:** показывай `result.code === "forbidden"` бренд-текстом
  «У вас нет прав на <действие>», не raw `result.error`.
- **Layer-3 гейт** на `src/app/admin/*/page.tsx`:
  ```ts
  const me = await getMe();
  if (!can(me, "admin.access")) forbidden();
  ```
- `can()` уже учитывает `status === "active"`, дублировать в доменных
  хелперах не нужно.

---

## 5. Тесты

Vitest с `jsdom`. Конфиг — `vitest.config.ts`. `server-only` алиасится на
`src/test/server-only-stub.ts`, потому что Next отдаёт пакет внутри своего
бандла, а не как top-level зависимость — без алиаса import-analysis падает.

Что обязательно покрываем:
- **`permissions.ts`** — каждый `canX` хелпер: гость → false, owner → true,
  not-owner без `*.delete_any` → false, suspended → false.
- **`schemas.ts`** — каждая схема: минимум 1 success + 1 failure.
- **Утилиты** — purely functional (`format-time`, `dates`, `revalidate`,
  `create-action`).

Что НЕ пишем здесь: e2e, скриншот-тесты, тесты UI-примитивов
(они покрываются использованием в `/dev/ui` smoke-page).

`/dev/ui` (`src/app/dev/ui/page.tsx`) — визуальный smoke check для UI-kit.
Удалится, когда фичи покроют примитивы реальным использованием.

---

## 6. Что нельзя трогать

Список запретных зон. Если кажется, что нужно — сначала спроси.

- **`src/api/schema.ts`** — генерируется из OpenAPI. Не редактируй вручную.
- **`src/app/layout.tsx`** (root layout) — Toaster, ThemeProvider и т.п.
  уже подключены, добавление — отдельной задачей.
- **`src/app/admin/layout.tsx`** и `admin-sidebar.tsx` — capability-gated
  навигация, изменения — через RBAC-апдейт, не локальные хаки.
- **`src/app/globals.css`** — токены и темы. Цветовые правки —
  исключительно через CSS-переменные.
- **`src/components/ui/*`** — UI-kit над Base UI. Новые примитивы —
  отдельной фичей, не «по дороге».
- **`package.json`** / `package-lock.json` — без явной задачи не добавляй
  зависимости.
- **`eslint.config.mjs`** — guardrails (cross-feature, deep-imports,
  server-only) ослаблять нельзя.

См. также `CLAUDE.md`: запрет `git stash`, `git reset`, `git checkout .`,
`git clean`, `git add -A` / `git add .` (только по имени файла).

---

## 7. Чеклист агента

Перед открытием PR пройдись по `src/features/_template/README.md`. Локально
зелёные:

```bash
npm run lint && npm test && npm run build
```

Если красное — фикси, не комментируй и не отключай правила.
