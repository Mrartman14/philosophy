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
import { handleCommonApiError } from "@/utils/api-error";
import { revalidateEntity } from "@/utils/revalidate";
import { getMe } from "@/utils/me";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { canCreateComment } from "./permissions";
import { CommentCreateSchema } from "./schemas";

export const createComment = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canCreateComment);        // гейт ДО парсинга (capability-only)
  const input = parseFormData(CommentCreateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/comments", { body: input });
  if (error) handleCommonApiError(error);         // FORBIDDEN/SUSPENDED/fallback
  revalidateEntity(Tags.COMMENTS);                // тег из реестра, не литерал
  return data;
});
```

`createFormAction` ловит `ForbiddenError` и `ZodValidationError`, превращая
их в `ActionResult { success: false, code: "forbidden" | "validation", … }`.
Внутренние ошибки Next.js (`redirect()`, `notFound()`, `forbidden()`)
пробрасываются дальше.

**Порядок гейта и парсинга (канон).** Для **capability-only** мутаций
ставь `requireCapability(me, canX)` / `requireActive(me)` ДО `parseFormData`
(отказ дешевле без траты на парсинг). Для **owner-aware** мутаций сначала
`parseFormData` (нужен `id` из формы), затем загрузка сущности и
`requireCapability(me, () => canEditX(me, entity))`.

**Обработка ошибок бека.** Общие коды (`FORBIDDEN`/`SUSPENDED`) и fallback —
через `handleCommonApiError(error, fallback?)` из `@/utils/api-error`; доменные
коды слайс обрабатывает в своём `switch` ДО вызова хелпера. Тип `code` —
сгенерированный union `ApiErrorCode` (drift-guard).

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

**Cross-field ошибки.** Если Zod-схема использует `.refine()` / `.superRefine()`
без явного `path`, ошибка приходит с пустым путём. `parseFormData` маршрутит
такие ошибки в ключ `_form`. Рендерь их отдельным баннером:

```tsx
{state.success === false && state.code === "validation" && state.fieldErrors._form && (
  <p role="alert">{state.fieldErrors._form}</p>
)}
```

**`<ConfirmDialog>` не surface'ит ошибки `onConfirm`.** Если action может
упасть — оборачивай в try/catch и показывай тост сам:

```tsx
<ConfirmDialog
  trigger={<Button variant="danger">Удалить</Button>}
  title="Удалить?"
  onConfirm={async () => {
    const result = await deleteEntity(formData);
    if (!result.success) toast.add({ title: "Ошибка", description: result.error });
  }}
/>
```

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
  `Me` и `MaybeMe` (из `@/utils/me`) — server-only типы; в client-компоненты
  передавай только готовые булевы / примитивы, не сам объект `me`.
- **В client UI:** показывай `result.code === "forbidden"` бренд-текстом
  «У вас нет прав на <действие>», не raw `result.error`.
- **Layer-3 гейт** на `src/app/admin/*/page.tsx` — доменный `canX` раздела:
  ```ts
  const me = await getMe();
  if (!canListAdminDocuments(me)) forbidden();
  ```
  **Admin-граница (Layer-1)** в `src/app/admin/layout.tsx` — `canAccessAdmin(me)`
  из `src/app/admin/admin-access.ts` («есть хотя бы один admin-нав-итем»).
  Отдельной capability `admin.access` НЕТ (была фантомом, удалена при переходе
  `Capability` на сгенерированный `rbac.Capability`).
- `can()` уже учитывает `status === "active"`, дублировать в доменных
  хелперах не нужно (для owner-aware — `isMutationAllowed` / `ownerOrCap`).

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
pnpm lint && pnpm test && pnpm build
```

Если красное — фикси, не комментируй и не отключай правила.
