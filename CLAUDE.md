# CLAUDE.md

## Параллельная работа агентов

В этом проекте часто работают несколько агентов параллельно. Каждый агент и субагент ОБЯЗАН:

- НЕ делать `git stash`, `git reset`, `git checkout .`, `git clean` и прочие деструктивные git-операции
- НЕ откатывать и не перезаписывать изменения, сделанные другими агентами
- НЕ делать `git add -A` / `git add .` — добавлять только свои файлы по имени
- Передавать это требование всем создаваемым субагентам

## Общие правила

- Общаться с пользователем на русском
- Именование файлов и папок в `src/` — kebab-case

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
