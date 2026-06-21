# AGENTS.md

## Параллельная работа агентов

В этом проекте часто работают несколько агентов параллельно. Каждый агент и субагент ОБЯЗАН:

- НЕ делать `git stash`, `git reset`, `git checkout .`, `git clean` и прочие деструктивные git-операции
- НЕ откатывать и не перезаписывать изменения, сделанные другими агентами
- НЕ делать `git add -A` / `git add .` — добавлять только свои файлы по имени
- Передавать это требование всем создаваемым субагентам

## Общие правила

- Общаться с пользователем на русском
- Именование файлов и папок в `src/` — kebab-case

## Дефекты бэкенда — флаговать корень, а не маскировать

Если на фронте всплывает недочёт **бэкенда** — несоответствие/дрейф типов в `src/api/schema.ts`, нелогичный или неполный контракт, странная семантика ответа, отсутствующее поле, рассинхрон между разными ручками — ОБЯЗАТЕЛЬНО сообщи об этом пользователю, чтобы он устранил **корень на бэкенде**, а не только проявление на фронте.

- FE-обход (cast, guard, skip, дефолт, локальное сужение типа) допустим лишь как временный стопгап, чтобы разблокировать сборку/работу. Он НЕ заменяет фикс на бэкенде.
- Во флаге укажи: что именно не так, где это видно (файл/ручка/контракт) и что нужно от бэка (какой тип / поле / семантику ожидает фронт). Это часть FE/BE-разделения: фронт ведёт UX и выдаёт бэку требования, реализацию решает бэк.
- Когда корень починен (бэк выровнял контракт, схема перегенерирована) — УБЕРИ временный обход на фронте.

## Frontend feature work

Перед стартом любой фичи (`src/features/<entity>/`):

- Прочитай [docs/frontend-conventions.md](docs/frontend-conventions.md) — единый референс по слайс-структуре, SSR-паттернам (server components + server actions), формам (Base UI Form + Zod через `parseFormData`), RBAC, инвалидации кеша через `revalidateEntity`, тестам.
- Скопируй [src/features/_template/](src/features/_template/) в `src/features/<entity>/` как стартовую точку. Чеклист готовности фичи — в [src/features/_template/README.md](src/features/_template/README.md).
- Дизайн-обоснование: [docs/superpowers/specs/2026-04-26-frontend-foundation-design.md](docs/superpowers/specs/2026-04-26-frontend-foundation-design.md).

**Запретные зоны** (любое касание = отдельный foundation-update PR, не в фиче):

- `src/api/schema.ts` — регенерация только координированно.
- `src/app/layout.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/admin-sidebar.tsx`, `src/app/globals.css` — root/admin shell.
- `src/components/ui/*` — UI-kit (новые примитивы — отдельным PR с обсуждением).
- `src/components/{shared, app, permission, …}` — заморожены.
- `src/utils/*`, `src/hooks/*`, `src/services/*` — общая инфраструктура.
- `package.json`, `package-lock.json`, `eslint.config.mjs`, `vitest.config.ts`.

ESLint-гарды форсят: запрет cross-feature импортов, deep-импортов в чужие фичи мимо `index.ts`, `react-dom/client` в server-only файлах слайса.

Перед PR должны быть зелёными: `pnpm lint && pnpm test && pnpm build`.

## RBAC

Проект использует единый server-side RBAC. Правило простое: **в server actions — `requireCapability`, в UI — `canX()`**.

- **Источник истины:** бэк. Фронт НЕ выводит права из роли локально. `getMe()` ([src/utils/me.ts](src/utils/me.ts)) возвращает `{ role, status, capabilities: string[] }` или `null`.
- **Базовые примитивы:** [src/utils/permissions.ts](src/utils/permissions.ts)
  - `can(me, "lecture.create")` — плоский capability-чек, учитывает `status === "active"`.
  - `requireCapability(me, canX)` — throw `ForbiddenError` при отказе, TS-сужение типа `me` через `asserts`.
  - `ForbiddenError` → ловится в `createAction`/`createFormAction` → `{ success: false, code: "forbidden" }`.
- **Доменные хелперы:** `src/features/*/permissions.ts`
  - Пример: `canDeleteComment(me, comment)` — owner-aware, проверяет `comment.user_id === me.id` или `comment.delete_any`.
  - В UI (server components) вызывать именно эти хелперы, пробрасывать `boolean` пропами в client components.
- **В server action:**

  ```ts
  const me = await getMe();
  requireCapability(me, canDeleteLecture);  // throw ForbiddenError при отказе
  // …
  ```

- **В client UI:** показывать `result.code === "forbidden"` branded-текстом «У вас нет прав на <действие>.», не raw `result.error`.
- **Layer-3 гейт** для `src/app/admin/*/page.tsx`: `const me = await getMe(); if (!canX(me)) forbidden();` (из `next/navigation`).
- **Не дублировать status-чек** в доменных хелперах — `can()` уже проверяет `status === "active"`.
