# Backend Bugs — 2026-04-09

Извлечено из ревью [../reviews/2026-04-09-platform-review.md](../reviews/2026-04-09-platform-review.md). Эти баги требуют изменений в `philosophy-api` (Go) и/или регенерации swagger; фронт ждёт.

## P0-#1 — JWT не содержит `status`

**Файл (бэк):** `philosophy-api/internal/user/service.go:66-70`

**Корень:** JWT-payload содержит только `user_id`, `role`, `exp`. Поле `status` отсутствует.

**Последствия (фронт):** `getUser()` в `src/utils/get-user.ts` читает `payload.status` как `undefined`. Проверка `user.status === "active"` в `src/features/comments/comment-list.tsx:24` всегда `false` → форма комментария **никогда** не показывается, кнопки реакций заблокированы. Фича комментариев функционально мертва для залогиненного пользователя.

**Решение (бэк):** добавить `status` в claims JWT (вместе с `user_id`, `role`).

**Follow-up на фронте после фикса бэка:**
1. `src/utils/get-user.ts` — `status: payload.status as AuthUser["status"]` начнёт возвращать реальное значение.
2. `src/features/comments/comment-list.tsx:24` — `isAuthorized` уже учитывает `status === "active"` корректно.
3. Регенерировать `src/api/schema.ts` через `npm run generate:api`, если изменился контракт `/auth/login`.

---

## P0-#15 — Хардкод `status='published'` в репозиториях ломает модерацию

**Файлы (бэк):**
- `philosophy-api/internal/comment/repo.go:47,56` — `WHERE lecture_id = ? AND parent_id IS NULL AND status = 'published'`
- `philosophy-api/internal/annotation/repo.go:99,101` — `a.is_private = 0 AND a.status = 'published'`

**Последствия (фронт):** Админ на `/admin/comments?lecture_id=X` и `/admin/annotations?lecture_id=X` видит **только опубликованные** элементы. Не может одобрить `pending`, не может вернуть `hidden` обратно. Весь модерационный пайплайн нерабочий.

**Решение (бэк) — два варианта на выбор:**
1. **Query-параметр** в существующих эндпоинтах: `GET /api/lectures/{id}/comments?status=all|published|hidden|pending`. Фильтр пропускается, если запрос идёт от админа (по `role` из контекста).
2. **Отдельные admin-эндпоинты:** `GET /api/admin/comments?lecture_id=X&status=...` и `GET /api/admin/annotations?lecture_id=X&status=...`, без фильтра по статусу, требуют роль `admin`.

Рекомендую вариант 2 — чище разделение и не нужно проверять роль внутри публичного эндпоинта.

**Follow-up на фронте после фикса бэка:**
1. Регенерировать `src/api/schema.ts` через `npm run generate:api`.
2. В `src/app/admin/comments/page.tsx` и `src/app/admin/annotations/page.tsx` переключить вызовы на новые эндпоинты.
3. Добавить вкладки `Все / Pending / Published / Hidden` (UI-компонент уже близко — после фикса P1-#20 будет бейдж статуса).
4. Экшены `getComments`/`getAnnotations` в `src/features/{comments,annotations}/api.ts` оставить для публичных страниц как есть; для админских использовать новые admin-функции.

---

## P1-#4 — В swagger-модели `Comment` отсутствует `user_id`

**Файлы (бэк):**
- `philosophy-api/internal/comment/model.go` (или эквивалент) — добавить поле `UserID` в DTO.
- swagger-аннотации → `philosophy-api/docs/swagger/swagger.json` после регена.

**Корень:** `internal_comment.Comment` в `src/api/schema.ts` имеет `author?.username`, но не имеет `user_id`. Фронт не может определить авторство комментария → `canEdit` выставляется в `true` для **любого** залогиненного на любом не-анонимном комментарии.

**Решение (бэк):** добавить `user_id` (uuid/int — что соответствует БД) в DTO `Comment`, обновить swagger.

**Follow-up на фронте:**
1. `npm run generate:api` — регенерация типов.
2. `src/features/comments/comment-list.tsx:51-62` — заменить логику `canEdit`:
   ```ts
   const canEdit = user != null && comment.user_id === user.id;
   const canDelete = canModerate || canEdit;
   ```
3. Удалить TODO-комментарий, объясняющий невозможность проверки авторства.

---

## P1-#5 — В swagger-модели `Annotation` отсутствует `user_id`

Симметрично P1-#4, но для аннотаций.

**Файлы (бэк):**
- `philosophy-api/internal/annotation/model.go` (или эквивалент)
- `philosophy-api/docs/swagger/swagger.json` после регена

**Follow-up на фронте:**
1. `npm run generate:api`.
2. `src/features/annotations/annotation-list.tsx:46` — заменить:
   ```ts
   const canEdit = canModerate || (user != null && annotation.user_id === user.id);
   ```

---

## Backend-gap (упоминается в P2-#21) — нет `GET /api/admin/users`

**Файлы (бэк):**
- `philosophy-api/internal/user/handler.go` — добавить хэндлер.
- `philosophy-api/internal/user/repo.go` — добавить запрос `ListUsers(offset, limit, total)`.
- `philosophy-api/cmd/api/main.go` (или routes) — зарегистрировать `GET /api/admin/users` с middleware admin-only.

**Последствия (фронт):** На `/admin/users` сейчас нет таблицы пользователей — только форма ручной правки статуса. Список невозможен, потому что бэк не отдаёт.

**Решение (бэк):** хэндлер с пагинацией: `GET /api/admin/users?offset=0&limit=20` → `{ items: User[], total: number }`. Аналогично существующему `GET /api/admin/lectures`.

**Follow-up на фронте после фикса бэка:**
1. `npm run generate:api`.
2. `src/app/admin/users/page.tsx` — добавить серверную загрузку списка с пагинацией.
3. `src/features/admin/users/user-status-form.tsx` (после переименования по P2-#21) — превратить в `user-table.tsx` с inline-формой статуса в строке.

---

## Приоритет

1. **P0-#1** — основа auth, без него комментарии мертвы.
2. **P0-#15** — без него модерация — декорация.
3. **P1-#4 / P1-#5** — устраняют UX-баги (кнопки edit/delete на чужих).
4. **Backend-gap** — некритично, но завершает админку.
