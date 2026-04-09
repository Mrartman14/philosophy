# Platform Bugfix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to dispatch each Group as a fresh subagent with code review between groups.

**Goal:** Исправить все фронт-баги ревью [docs/reviews/2026-04-09-platform-review.md](../reviews/2026-04-09-platform-review.md), выгрузив бэкенд-зависимые баги в отдельный файл для бэкенд-агента.

**Architecture:** Task 0 создаёт backend-bugs файл (без изменений в коде). Task 1 — pre-step (алиасы типов в `src/api/types.ts`). Tasks 2–9 — 8 параллельных групп субагентов с непересекающимися файловыми зонами. Task 10 — финальная верификация.

**Tech Stack:** Next.js 16, React 19, TypeScript 5. Тестов в проекте нет — TDD не применяется. Верификация — через `tsc --noEmit` + `eslint`.

**Источник:** Все ссылки P0/P1/P2/P3 ниже — на пункты ревью [docs/reviews/2026-04-09-platform-review.md](../reviews/2026-04-09-platform-review.md).

---

## Disciplina всех субагентов (общая)

КАЖДЫЙ субагент получает в промпте этот блок:

> **Параллельная работа.** В этом проекте параллельно работают другие агенты. ОБЯЗАТЕЛЬНО:
> - НЕ делать `git stash`, `git reset`, `git checkout .`, `git clean` и прочие деструктивные git-операции.
> - НЕ откатывать и не перезаписывать чужие изменения.
> - НЕ делать `git add -A` / `git add .` — добавлять только свои файлы по имени (если потребуется добавлять).
> - **Не делать коммитов** — коммиты делает основная сессия после ревью.
> - Не трогать файлы вне своей зоны ответственности.
> - Передавать это требование всем создаваемым субагентам.
>
> **Бэкенд-зависимые баги** (P0-#1, P0-#15, P1-#4, P1-#5) — НЕ ТРОГАТЬ. Они в `docs/plans/2026-04-09-backend-bugs.md`.
>
> **Финальная верификация перед сдачей работы:**
> 1. `npx tsc --noEmit` — без ошибок.
> 2. `npx eslint <свои файлы>` — без ошибок.

---

## Task 0: Создать backend-bugs файл

**Тип:** Делает основная сессия. Без субагента.

**Files:**
- Create: `docs/plans/2026-04-09-backend-bugs.md`

**Содержание файла:**

````markdown
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
````

**Verify:**

Команда: `ls docs/plans/2026-04-09-backend-bugs.md`
Expected: файл существует.

**Commit:**

```bash
git add docs/plans/2026-04-09-backend-bugs.md
git commit -m "docs(plans): backend bugs spec for 2026-04-09 review"
```

---

## Task 1: Pre-step — алиасы типов в `src/api/types.ts`

**Тип:** Делает основная сессия. Без субагента (одна правка, нужна для следующих групп).

**Files:**
- Modify: `src/api/types.ts`

**Step 1: Добавить два экспорта в конец секции `--- Users ---` и новую секцию `--- Moderation ---`**

Откройте `src/api/types.ts`. После строки 48 (`UserUpdateStatusRequest`) добавьте:

```ts
export type UserStatus = UserUpdateStatusRequest["status"];
```

После последнего экспорта (`SearchMatch` на строке 58) добавьте:

```ts

// --- Moderation ---
export type ModerationStatus =
  Schemas["github_com_Mrartman14_philosophy-api_internal_moderation.ModerationStatus"];
```

**Точное имя схемы проверено** через `grep` в `src/api/schema.ts:1848` — запись валидна.

**Step 2: Verify**

Команда: `npx tsc --noEmit`
Expected: чисто, без новых ошибок.

**Step 3: Commit**

```bash
git add src/api/types.ts
git commit -m "feat(api): add ModerationStatus and UserStatus type aliases

Pre-step for review-bugfix groups D and E (P2-#22, P2-#23)."
```

---

## Task 2: Группа A — Аннотации UI

**Тип:** Субагент (general-purpose).

**Зона ответственности (только эти файлы):**
- `src/features/annotations/annotation-list.tsx`
- `src/features/annotations/annotation-highlight.tsx`

**Что починить:**

### P0-#2: Нет UI редактирования/удаления аннотаций

`src/features/annotations/annotation-list.tsx:74-80` — рендерится пустой div с `data-can-edit`/`data-can-delete`. Внутри должны быть кнопки.

**Что сделать:** Изучить `src/features/comments/comment-item-actions.tsx` как референс. В `annotation-list.tsx` внутри `(canEdit || canDelete) && (...)` отрендерить две кнопки:
- «Изменить» → открывает форму редактирования (или вызывает существующий action `updateAnnotation` через `useActionState`).
- «Удалить» → вызывает `deleteAnnotation` через form action или confirm-диалог.

Использовать существующие server actions из `src/features/annotations/actions.ts` (есть `updateAnnotation`, `deleteAnnotation` — проверить).

### P0-#3: Дублирующий рендер при активном фильтре

`src/features/annotations/annotation-highlight.tsx:197-220` — при `activeSegmentId` рендерит свой собственный `<ul>`, который не имеет UI редактирования и не показывает статус.

**Что сделать:** Не рендерить свой `<ul>`. Передать `activeFilter` (или эквивалентный пропс) в `<AnnotationList>` и фильтровать уже там. Одна точка рендеринга.

Возможно, понадобится в `AnnotationList` принять опциональный `filterSegmentId?: number` и применить `.filter(a => filterSegmentId == null || a.segment_id === filterSegmentId)` перед рендером.

### P3-#14: Alt+click UX для выбора сегмента

`src/features/annotations/annotation-highlight.tsx:75-76` — Alt+click и Alt+Shift+click. На мобильных не работает; на тачпаде неинтуитивно.

**Что сделать:** Добавить режим выделения. Кнопка «Создать аннотацию» (или иконка в углу) → переводит компонент в `selectionMode`. В этом режиме обычный клик по сегменту начинает выбор, второй клик заканчивает диапазон. Кнопка «Готово» / «Отменить». Alt+click оставить как ярлык.

**Не выходить за зону.** Если решение требует изменений в `AnnotationCreateForm` или actions — задокументировать в комментарии и оставить TODO; это уже отдельная группа.

**Verify:**

```bash
npx tsc --noEmit
npx eslint src/features/annotations/annotation-list.tsx src/features/annotations/annotation-highlight.tsx
```

Expected: чисто.

**No commit.** Отчитаться основной сессии о законченной работе.

---

## Task 3: Группа B — Transcript editor

**Тип:** Субагент.

**Зона ответственности:**
- `src/features/admin/lectures/transcript-editor.tsx` (основной)
- `src/features/admin/actions.ts` — **только** добавление `revalidatePath` в transcript-actions, если потребуется. Никаких других изменений в `actions.ts`. Группа D также трогает этот файл (другие места), поэтому работаем строго в transcript-секции.

**Что починить:**

### P0-#16: `defaultValue` + клиентский стейт = рассинхрон

`src/features/admin/lectures/transcript-editor.tsx:36, :218-270` — компонент держит `useState<Segment[]>(initialSegments)`, но инпуты используют `defaultValue={segment.x}`. После `setSegments(...)` инпуты не обновляются.

**Решение (рекомендую вариант «проще»):**

Убрать `useState<Segment[]>`. Перейти на RSC + `revalidatePath` + `router.refresh()`. Логика:

1. Серверный родитель (`src/app/admin/lectures/[id]/page.tsx` или эквивалент) передаёт `initialSegments` напрямую.
2. После каждого server action компонент вызывает `router.refresh()`.
3. В transcript-actions внутри `src/features/admin/actions.ts` после успешного `createSegment`/`updateSegment`/`deleteSegment` добавить `revalidatePath` на родительскую страницу лекции.

Альтернатива (если упирается в архитектуру): `useOptimistic` на массиве сегментов с контролируемыми инпутами.

### P1-#18: Success-сообщение показывается как ошибка

`src/features/admin/lectures/transcript-editor.tsx:70-71, :108-112`:
```ts
setError("Сегмент добавлен. Обновите страницу, чтобы увидеть его.");
```

**Что сделать:** Завести отдельный `useState<string | null>(null)` для `successMessage`. Рендерить его в `<p className="text-xs text-green-600" role="status">`. После перехода на `router.refresh()` (P0-#16) сообщение «обновите страницу» удалить вообще — оно станет неактуальным.

### P3-#28: onBlur-сейв без подтверждения

`src/features/admin/lectures/transcript-editor.tsx:219-268` — каждое поле сохраняется при `onBlur`, нет индикатора.

**Что сделать:** Добавить минимальный индикатор «✓» рядом с полем после успешного `update`. Использовать локальный per-row state `lastSavedAt` или `isSaving`. Простая иконка, исчезающая через 2 секунды.

**Verify:**

```bash
npx tsc --noEmit
npx eslint src/features/admin/lectures/transcript-editor.tsx src/features/admin/actions.ts
```

Expected: чисто.

**No commit.**

---

## Task 4: Группа C — Admin/comment forms (initialState + UX)

**Тип:** Субагент.

**Зона ответственности:**
- `src/features/admin/push/push-sender.tsx`
- `src/features/admin/lectures/lecture-editor.tsx`
- `src/features/admin/lectures/lecture-create-form.tsx`
- `src/features/comments/comment-form.tsx`

**Что починить:**

### P1-#17: `type="url"` не принимает относительные пути

`src/features/admin/push/push-sender.tsx:39-43` — браузерная валидация требует абсолютный URL, а placeholder показывает `/lectures/...`.

**Что сделать:** Заменить `type="url"` на `type="text"`. Сохранить placeholder. Валидацию (если нужна) перенести в server action `sendPush` — например, `if (url.startsWith("/") || url.startsWith("https://"))`.

### P1-#19: Фейковый `initialState: {success: true}`

`src/features/admin/lectures/lecture-editor.tsx:12, :75-79` и `src/features/admin/push/push-sender.tsx:7, :54-58`:

```ts
const initialState: ActionResult<void> = { success: true, data: undefined };
```

→ `state.success === true` сразу при монтировании. Надпись «Готово к сохранению» висит вечно.

**Что сделать:**
1. Поменять `initialState` на `null` (тип `ActionResult<void> | null`).
2. Показывать success-индикатор только когда `state?.success === true` И только что произошёл переход `pending → !pending`. Простейшая реализация — `useEffect`, который при `state?.success` ставит `justSaved=true` на 2 секунды через `setTimeout`.
3. Тексты «Готово к сохранению» / «Готово к отправке» заменить на «Сохранено» / «Отправлено».

### P2-#11: Странный `initialState` в comment-form

`src/features/comments/comment-form.tsx:21`:
```ts
const [state, formAction] = useActionState(createComment, {
  success: false,
  error: "",
});
```

**Что сделать:** Привести к общему соглашению. После решения P1-#19 — использовать тот же стиль (`null` или `{success: false, error: ""}`). Общее соглашение в проекте — `null` (предложение). Обе формы должны быть консистентны.

### P2-#10: `eslint-disable-next-line react-hooks/exhaustive-deps` в comment-form

`src/features/comments/comment-form.tsx:47-48` — подавление правила без объяснения.

**Что сделать:** Прочитать окружающий `useEffect`. Понять, какие зависимости пропущены и почему. Если можно безопасно добавить — добавить. Если нельзя (например, форма должна сбрасываться только при смене `lectureId`) — оставить disable, но добавить выше комментарий с обоснованием. Не молчаливое подавление.

### P2-#24: `defaultValue={undefined}`

`src/features/admin/lectures/lecture-editor.tsx:62`:
```tsx
<textarea name="description" ... defaultValue={lecture.description} />
```

**Что сделать:** `defaultValue={lecture.description ?? ""}`.

### P2-#25: Фейковый `initialState` в lecture-create-form

`src/features/admin/lectures/lecture-create-form.tsx:7-10` — `{success: true, data: {id: ""}}`.

**Что сделать:** Привести к тому же `null` или `{success: false, error: ""}`. Поскольку `createLecture` редиректит при успехе — состояние обычно остаётся в `initialState` до редиректа. Корректное `null` явно показывает «ничего ещё не происходило».

**Verify:**

```bash
npx tsc --noEmit
npx eslint \
  src/features/admin/push/push-sender.tsx \
  src/features/admin/lectures/lecture-editor.tsx \
  src/features/admin/lectures/lecture-create-form.tsx \
  src/features/comments/comment-form.tsx
```

Expected: чисто.

**No commit.**

---

## Task 5: Группа D — Moderation UI + ModerationStatus

**Тип:** Субагент.

**Зависимость:** Требует завершённый Task 1 (alias `ModerationStatus` в `src/api/types.ts`).

**Зона ответственности:**
- `src/features/admin/comments/comment-moderation.tsx`
- `src/features/admin/annotations/annotation-moderation.tsx`
- `src/app/admin/comments/page.tsx`
- `src/app/admin/annotations/page.tsx`
- `src/features/admin/actions.ts` — **только** удалить локальный `type ModerationStatus = ...` (строка 18) и заменить импорт. Никаких других изменений в `actions.ts`. Группа B также трогает этот файл (transcript-секция), поэтому НЕ заходить туда.

**Что починить:**

### P1-#20: Не показан текущий статус карточки

`src/features/admin/comments/comment-moderation.tsx:99-108`, `src/features/admin/annotations/annotation-moderation.tsx:100-109` — у комментария/аннотации в схеме есть `status: "published" | "hidden" | "pending"`, но в UI он не показан.

**Что сделать:**
1. В `<header>` карточки добавить бейдж статуса (текстовый span с цветом по статусу: published — зелёный, pending — жёлтый, hidden — серый).
2. Кнопки действий (`Published`/`Hidden`/`Pending`) — выделять активную (текущий статус) другим стилем, например `aria-pressed="true"` + класс `bg-(--color-primary)/10`.

### P2-#27: Модерация грузит максимум 100 элементов

`src/app/admin/comments/page.tsx:28` и `src/app/admin/annotations/page.tsx:28` — `getComments(lectureId, 0, 100)` без пагинации.

**Что сделать:** Скопировать паттерн пагинации с `src/app/admin/lectures/page.tsx` (offset через searchParams). Внизу страницы — кнопки `← Previous` / `Next →`. Если эндпоинт возвращает `total` — показывать «Показано N из M». Если нет — показывать кнопку только если результат содержит `limit` элементов.

### P2-#22: Хардкод `ModerationStatus` в трёх местах

- `src/features/admin/actions.ts:18` — **удалить**, заменить на `import type { ModerationStatus } from "@/api/types"`.
- `src/features/admin/comments/comment-moderation.tsx:15` — то же.
- `src/features/admin/annotations/annotation-moderation.tsx:15` — то же.

`ModerationStatus` уже добавлен в `src/api/types.ts` Task 1.

**Verify:**

```bash
npx tsc --noEmit
npx eslint \
  src/features/admin/comments/comment-moderation.tsx \
  src/features/admin/annotations/annotation-moderation.tsx \
  src/app/admin/comments/page.tsx \
  src/app/admin/annotations/page.tsx \
  src/features/admin/actions.ts
```

Expected: чисто.

**No commit.**

---

## Task 6: Группа E — Users (rename + UserStatus)

**Тип:** Субагент.

**Зависимость:** Требует завершённый Task 1 (alias `UserStatus`).

**Зона ответственности:**
- `src/features/admin/users/user-table.tsx` → переименовать в `user-status-form.tsx`
- `src/app/admin/users/page.tsx` — обновить импорт

**Что починить:**

### P2-#21: `user-table.tsx` называется table, но содержит форму

**Что сделать:**
1. Переименовать файл `src/features/admin/users/user-table.tsx` → `src/features/admin/users/user-status-form.tsx` (использовать `git mv`, чтобы сохранить историю).
2. В `src/app/admin/users/page.tsx` обновить импорт.

### P2-#23: Хардкод `UserStatus`

`src/features/admin/users/user-table.tsx:6` — `type UserStatus = "active" | "suspended" | "banned"` локально.

**Что сделать:** Удалить локальный type. `import type { UserStatus } from "@/api/types"`.

**Verify:**

```bash
npx tsc --noEmit
npx eslint \
  src/features/admin/users/user-status-form.tsx \
  src/app/admin/users/page.tsx
```

Expected: чисто. В частности — в `app/admin/users/page.tsx` не должно остаться импорта из `./user-table`.

**No commit.**

---

## Task 7: Группа F — Routes loading/error

**Тип:** Субагент.

**Зона ответственности (только эти файлы — все новые):**
- `src/app/login/loading.tsx` (новый)
- `src/app/login/error.tsx` (новый)
- `src/app/register/loading.tsx` (новый)
- `src/app/register/error.tsx` (новый)
- `src/app/search/loading.tsx` (новый)
- `src/app/search/error.tsx` (новый)

**Что починить:**

### P2-#8: Нет `loading.tsx` / `error.tsx` для `/login`, `/register`, `/search`

**Что сделать:** Скопировать паттерн из `src/app/admin/lectures/loading.tsx` и `src/app/admin/lectures/error.tsx` (или другого admin-маршрута). Использовать общий компонент `SkeletonTextLine`. Для `error.tsx` обязательно `"use client"` + `error: Error & { digest?: string }` + `reset: () => void`.

Минимальный шаблон `loading.tsx`:
```tsx
import { SkeletonTextLine } from "@/features/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-2 p-4">
      <SkeletonTextLine />
      <SkeletonTextLine />
      <SkeletonTextLine />
    </div>
  );
}
```

Минимальный шаблон `error.tsx`:
```tsx
"use client";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="p-4">
      <p>Что-то пошло не так.</p>
      <button onClick={reset}>Попробовать снова</button>
    </div>
  );
}
```

**Перед началом:** проверить точный путь и имя `SkeletonTextLine` в проекте. Если иначе — использовать существующий компонент.

**Verify:**

```bash
npx tsc --noEmit
npx eslint src/app/login/ src/app/register/ src/app/search/
```

Expected: чисто. Все 6 новых файлов существуют.

**No commit.**

---

## Task 8: Группа G — Build/lint hygiene + CSS

**Тип:** Субагент.

**Зона ответственности:**
- `package.json`
- `src/features/player/use-video-player.ts`
- `src/middleware.ts` → переименовать в `src/proxy.ts` (если Next 16 поддерживает)
- `src/features/auth/login-form.tsx`
- `src/features/auth/register-form.tsx`
- `src/features/search/search-results.tsx`

**Что починить:**

### P2-#9: `npm run lint` сломан

`package.json:10` — `"lint": "next lint"`. В Next 16 `next lint` deprecated/удалён. Скрипт `npm run lint` всё равно красный.

**Что сделать:** Заменить на:
```json
"lint": "eslint src/"
```

Проверить, что `eslint` есть в `devDependencies` (он есть — `eslint: ^9` и `eslint-config-next`).

### P1-#7: react-hooks/refs warning в use-video-player

`src/features/player/use-video-player.ts:22` — "Cannot update ref during render".

**Что сделать:** Прочитать функцию. Если ref устанавливается прямо в теле компонента/хука вне `useEffect` — перенести установку в `useEffect`. Если это особенность инициализации — использовать `useRef(initialValue)` или `useLayoutEffect`. Не подавлять правило.

Это pre-existing баг, не связанный с ревью. Чинить аккуратно — не сломать видеоплеер.

### P2-#12: middleware → proxy (deprecation warning Next 16)

`src/middleware.ts` — Next 16 переименовывает middleware в proxy.

**Что сделать:**
1. Сначала проверить в `node_modules/next/dist/...`, что в Next 16 действительно ожидается `src/proxy.ts` (или `src/middleware.ts` ещё работает с warning).
2. Если переименование поддержано: `git mv src/middleware.ts src/proxy.ts`. Проверить, что экспорт остался тот же (`export function middleware` или нужно переименовать в `export function proxy`).
3. Запустить `npm run build` — warning должен исчезнуть.
4. Если переименование ломает что-то — откатить, оставить TODO в файле, заметить в отчёте основной сессии.

### P1-#6: Несуществующая CSS-переменная `--color-text`

Файлы и строки:
- `src/features/auth/login-form.tsx:25, :36` — `text-(--color-text)`
- `src/features/auth/register-form.tsx:26, :38`
- `src/features/search/search-results.tsx:68`

В `src/app/globals.css` нет `--color-text`. Доступны: `--color-primary`, `--color-background`, `--color-border`, `--color-link`, `--color-description`, `--color-text-pane`.

**Что сделать:** Открыть `src/app/globals.css`, посмотреть на используемые переменные. Заменить `text-(--color-text)` на наиболее подходящую. Кандидаты:
- Если это label/description — `text-(--color-description)`.
- Если это основной текст в карточке — оставить без класса (наследовать `currentColor` от родителя).

Решение принимать по контексту каждого использования. Не добавлять новую переменную в globals.css — это вне зоны.

**Verify:**

```bash
npx tsc --noEmit
npm run lint            # после фикса P2-#9 должен работать
npm run build           # после фикса P2-#12 без middleware warning
```

Expected:
- `tsc` — чисто.
- `lint` — чисто или с одной известной ошибкой P1-#7 (если не получилось починить).
- `build` — без warning о middleware.

**No commit.**

---

## Task 9: Группа H — Dashboard

**Тип:** Субагент.

**Зона ответственности:**
- `src/app/admin/page.tsx`

**Что починить:**

### P2-#26: Dashboard пустой — одна метрика вместо нескольких

`src/app/admin/page.tsx:25-27` — единственная карточка `StatCard` «Лекций». Нет счётчиков пользователей, комментариев, аннотаций, push-подписок.

**Что сделать:**
1. **Сначала** проверить через `grep` и чтение `src/api/schema.ts`/`src/features/admin/actions.ts`, какие список-эндпоинты возвращают `total`. Известно: `getAdminLectures` возвращает `total`. Проверить:
   - есть ли `getComments` / `getAnnotations` без `lecture_id` или admin-эндпоинт со счётчиком?
   - есть ли список push-подписок?
   - **Backend-gap**: `GET /api/admin/users` отсутствует (отмечено в backend-bugs.md).
2. Параллельный `Promise.all` по доступным эндпоинтам.
3. Карточки `StatCard` для каждой доступной метрики.
4. Для недоступных метрик — карточка с TODO-текстом «Бэкенд не отдаёт» (или вообще не показывать).

**Не выходить за зону.** Если нужно создать новые server-actions — задокументировать как TODO в комментарии и не делать.

**Verify:**

```bash
npx tsc --noEmit
npx eslint src/app/admin/page.tsx
```

Expected: чисто.

**No commit.**

---

## Task 10: Финальная верификация и коммит

**Тип:** Делает основная сессия после всех групп.

**Step 1: Проверка типов**

```bash
npx tsc --noEmit
```

Expected: чисто.

**Step 2: Lint**

```bash
npm run lint
```

Expected: чисто (после Группы G).

**Step 3: Build**

```bash
npm run build
```

Expected: успешно, без warning о middleware/proxy.

**Step 4: Ручной обзор diff**

```bash
git status
git diff --stat
```

Убедиться, что:
- Только файлы из 8 зон + `src/api/types.ts` + `docs/plans/2026-04-09-backend-bugs.md`.
- Никаких неожиданных файлов.
- В `src/middleware.ts` либо удалён (rename), либо без изменений (если не получилось).

**Step 5: Серия коммитов по группам**

Один коммит на группу для удобства ревью:

```bash
# Группа A
git add src/features/annotations/annotation-list.tsx src/features/annotations/annotation-highlight.tsx
git commit -m "fix(annotations): edit/delete UI, render dedup, selection mode (P0-#2, P0-#3, P3-#14)"

# Группа B
git add src/features/admin/lectures/transcript-editor.tsx
# (если actions.ts затронут — добавить отдельным `git add` только нужные строки через `git add -p`)
git commit -m "fix(admin/transcript): RSC refactor, success state, save indicator (P0-#16, P1-#18, P3-#28)"

# Группа C
git add src/features/admin/push/push-sender.tsx src/features/admin/lectures/lecture-editor.tsx src/features/admin/lectures/lecture-create-form.tsx src/features/comments/comment-form.tsx
git commit -m "fix(admin/forms): initialState convention, push url, defaults (P1-#17, P1-#19, P2-#10, P2-#11, P2-#24, P2-#25)"

# Группа D
git add src/features/admin/comments/comment-moderation.tsx src/features/admin/annotations/annotation-moderation.tsx src/app/admin/comments/page.tsx src/app/admin/annotations/page.tsx src/features/admin/actions.ts
git commit -m "fix(admin/moderation): status badge, pagination, ModerationStatus alias (P1-#20, P2-#22, P2-#27)"

# Группа E
git add src/features/admin/users/user-status-form.tsx src/app/admin/users/page.tsx
git commit -m "refactor(admin/users): rename to user-status-form, use UserStatus alias (P2-#21, P2-#23)"

# Группа F
git add src/app/login/loading.tsx src/app/login/error.tsx src/app/register/loading.tsx src/app/register/error.tsx src/app/search/loading.tsx src/app/search/error.tsx
git commit -m "feat(routes): loading/error for login, register, search (P2-#8)"

# Группа G
git add package.json src/features/player/use-video-player.ts src/features/auth/login-form.tsx src/features/auth/register-form.tsx src/features/search/search-results.tsx
# proxy.ts/middleware.ts добавить отдельно если переименовали
git commit -m "chore: lint script, video ref, css var, proxy rename (P1-#6, P1-#7, P2-#9, P2-#12)"

# Группа H
git add src/app/admin/page.tsx
git commit -m "feat(admin/dashboard): expanded metrics (P2-#26)"

# Pre-step (если ещё не закоммичен)
git add src/api/types.ts
git commit -m "feat(api): ModerationStatus and UserStatus aliases"
```

**Не использовать `git add -A` / `git add .`.**

**Step 6: Финальная проверка**

```bash
git log --oneline -12
git status
```

Expected: чистое рабочее дерево, последние коммиты — список выше.

---

## Что НЕ делается

- Бэкенд-зависимые баги (P0-#1, P0-#15, P1-#4, P1-#5) — в `docs/plans/2026-04-09-backend-bugs.md`.
- Тесты — в проекте нет тестового харнеса.
- Любая работа сверх зон ответственности групп.
- Изменения в `src/api/schema.ts` — генерируется автоматически.
