# Lecture feature — design

**Status:** approved (brainstorm)
**Date:** 2026-04-27
**Slice:** `src/features/lectures/`
**Foundation reference:** `docs/superpowers/specs/2026-04-26-frontend-foundation-design.md`
**Conventions reference:** `docs/frontend-conventions.md`

## 1. Цель

Реализовать слайс `lectures` — единая фронт-точка работы с сущностью «лекция»:
публичная витрина (список + детальная), админ-CRUD, owner-управление
(редактирование + смена видимости). Слой соответствует
`src/features/_template/` и фундамент-конвенциям.

## 2. Скоуп

### 2.1. В скоупе

- **Публичные страницы:** `/lectures` (список с пагинацией и поиском), `/lectures/[id]` (детальная).
- **Админ-страницы:** `/admin/lectures` (список), `/admin/lectures/new` (создание), `/admin/lectures/[id]/edit` (редактирование + смена visibility + удаление).
- **Server fetchers:** `getLectures(filter)`, `getLectureById(id)`.
- **Server actions:** `createLecture`, `updateLecture`, `deleteLecture`, `setLectureVisibility`.
- **Permissions (доменные):** `canCreateLecture`, `canUpdateLecture`, `canDeleteLecture`, `canSetLectureVisibility`.
- **Schemas (Zod, для FormData):** `LectureCreateSchema`, `LectureUpdateSchema`, `LectureVisibilitySchema`, `LectureIdSchema`.
- **UI-компоненты:** список (server + client filters), карточка-превью, детальная (без обложки), формы create/edit, кнопка «Удалить» с `<ConfirmDialog>`, переключатель visibility.
- **Тесты:** `permissions.test.ts` + `schemas.test.ts` по чеклисту шаблона.

### 2.2. Вне скоупа (флаг)

| Фича | Почему вне | Кому отдать |
|------|------------|-------------|
| Загрузка обложки (`SetCover`/`ClearCover`) | Требует `image_uploads` инфры, которой на FE нет | Отдельный слайс `media` |
| Отображение обложки | Бэк отдаёт только `cover_image_key` без URL. Файлы доступны на `/static/files/{key}` **только в local-storage режиме**; в S3-режиме внешний URL не публикуется. До того, как бэк начнёт отдавать `cover_url` в payload (или появится прокси-эндпоинт), отрисовать обложку безопасно нельзя | Foundation/backend задача; затем `media` слайс |
| Tags (`/api/admin/lectures/{id}/tags`) | Сущность Tag — отдельная | Слайс `tags` |
| Attachments (`/api/lectures/{lectureID}/attachments`) | Сложная подсистема (documents, media, ordering) | Отдельный слайс / эпик |
| Документы / annotations / comments / transcripts | Самостоятельные фичи | Соответствующие слайсы |
| Поиск с автокомплитом / debounce | Нет инфры; URL-form достаточно | После | 

Capabilities `lecture.update` и `lecture.upload_files` объявлены в
`src/utils/permissions.ts`, но бэк их **не выдаёт** (см.
`internal/rbac/capabilities.go`: только `lecture.create`, `lecture.delete`).
В этом слайсе ими не пользуемся, оставляем как есть — чистка типа = отдельная задача
foundation-update.

## 3. Контракт API (как видит фронт)

Источник — `src/api/schema.ts` (генерится из OpenAPI). Используем `openapi-fetch` через `createApiClient()`.

| Метод | Путь | Назначение | Frontend permission |
|-------|------|------------|---------------------|
| GET | `/api/lectures` (q, tag, offset, limit) | Список лекций (видимость на бэке) | optional-auth |
| GET | `/api/lectures/{id}` | Детальная | optional-auth |
| POST | `/api/admin/lectures` | Создать | `lecture.create` |
| PUT | `/api/lectures/{id}` | Обновить (title/description/date) | owner |
| PATCH | `/api/lectures/{id}/visibility` | Сменить visibility | owner |
| DELETE | `/api/admin/lectures/{id}` | Удалить | `lecture.delete` |

**Дата:** бэк ожидает `YYYY-MM-DD` (см. `internal/lecture/service.go:102`).
В Zod-схеме валидируем regex `^\d{4}-\d{2}-\d{2}$` + парсинг `Date`.

## 4. Структура слайса

```
src/features/lectures/
  index.ts                           # публичный API
  api.ts                             # getLectures, getLectureById
  actions.ts                         # createLecture, updateLecture, deleteLecture, setLectureVisibility
  permissions.ts                     # canCreate/Update/Delete/SetVisibility
  schemas.ts                         # Zod-схемы
  types.ts                           # сужения из @/api/schema (Lecture, LectureListItem, Visibility)
  ui/
    lecture-list.tsx                 # server: рендер списка по filter (используется в /lectures и /admin/lectures)
    lecture-card.tsx                 # server: карточка-превью (заголовок, дата, превью описания)
    lecture-detail.tsx               # server: детальная (без CRUD-кнопок)
    lecture-search-form.tsx          # client: input + button → URL update
    lecture-create-form.tsx          # client: useActionState вокруг createLecture
    lecture-edit-form.tsx            # client: useActionState вокруг updateLecture
    lecture-visibility-toggle.tsx    # client: select + setLectureVisibility (owner-only, проп от server)
    lecture-delete-button.tsx        # client: ConfirmDialog + deleteLecture (cap-only, проп от server)
    lecture-admin-row.tsx            # server: строка таблицы админ-листа (включает edit-link, delete-button)
  permissions.test.ts
  schemas.test.ts
```

**`index.ts` экспортирует:**

- из `api.ts`: `getLectures`, `getLectureById`
- из `actions.ts`: `createLecture`, `updateLecture`, `deleteLecture`, `setLectureVisibility`
- из `permissions.ts`: `canCreateLecture`, `canUpdateLecture`, `canDeleteLecture`, `canSetLectureVisibility`
- из `ui/*`: `LectureList`, `LectureDetail`, `LectureCreateForm`, `LectureEditForm`, `LectureSearchForm`, `LectureAdminRow`, `LectureVisibilityToggle`, `LectureDeleteButton`
- из `types.ts`: `Lecture`, `LectureVisibility`

`schemas.ts` приватный (используется внутри actions). Если потребуется client-валидация — реэкспортируется явно отдельным PR.

## 5. Permissions — модель

Источник правды — бэк. Хелперы в `permissions.ts`:

```ts
export function canCreateLecture(me: MaybeMe): boolean {
  return can(me, "lecture.create");
}

export function canUpdateLecture(me: MaybeMe, lecture: { owner_id: string }): boolean {
  if (!isMutationAllowed(me)) return false;
  return lecture.owner_id === me.id;
}

export function canSetLectureVisibility(me: MaybeMe, lecture: { owner_id: string }): boolean {
  if (!isMutationAllowed(me)) return false;
  return lecture.owner_id === me.id;
}

export function canDeleteLecture(me: MaybeMe): boolean {
  return can(me, "lecture.delete");
}
```

`isMutationAllowed` (уже есть в `@/utils/permissions`) включает status-чек.
`can()` тоже включает status-чек. Дублировать не нужно.

**Тесты:** для каждого хелпера — guest=false, suspended=false, и положительный/негативный по содержанию правила.

## 6. Schemas — Zod

```ts
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const LectureCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional().default(""),
  date: z.string().regex(ISO_DATE, "Дата должна быть в формате ГГГГ-ММ-ДД"),
  visibility: z.enum(["private", "public"]).optional(),
});

export const LectureUpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).default(""),
  date: z.string().regex(ISO_DATE, "Дата должна быть в формате ГГГГ-ММ-ДД"),
});

export const LectureVisibilitySchema = z.object({
  id: z.string().uuid(),
  visibility: z.enum(["private", "public"]),
});

export const LectureIdSchema = z.object({
  id: z.string().uuid(),
});
```

`description.max(5000)` — фронтовая защита; бэк лимитирует на своей стороне (валидируем разумный максимум, чтобы не отправлять мегабайты).

**Тесты:** на каждую схему — 1 success + 1 failure (поле, regex, enum).

## 7. API tags / cache

Добавить в `src/api/tags.ts`:

```ts
export const Tags = {
  LECTURES: "lectures",
} as const;
```

Конвенция:
- `LECTURES` — список (used by `getLectures`).
- `lectures:${id}` — item (used by `getLectureById`).

`getLectures` оборачивается в `unstable_cache` с тегом `LECTURES` (key-parts включают `q`, `tag`, `offset`, `limit`). `getLectureById` — с тегом `lectures:${id}`.

После каждой мутации:
- create → `revalidateEntity("lectures")`
- update → `revalidateEntity("lectures", id)`
- setVisibility → `revalidateEntity("lectures", id)` (а заодно сбрасываем list, потому что видимость влияет на видимость в списке для других ролей) → `revalidateEntity("lectures")` + `revalidateEntity("lectures", id)`
- delete → `revalidateEntity("lectures")` (item уже не существует)

## 8. Server actions — поток

Все actions через `createFormAction` — единый стиль слайса (FormData + Zod). Базовый flow по конвенциям §3.3.

`createLecture`:

```ts
export const createLecture = createFormAction(async (formData) => {
  const me = await getMe();
  const input = parseFormData(LectureCreateSchema, formData);
  requireCapability(me, canCreateLecture);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/admin/lectures", { body: input });
  if (error) throw new Error(error.message ?? "Не удалось создать лекцию");
  revalidateEntity("lectures");
  return data?.data; // httputil.Response{ data: lecture }
});
```

`updateLecture`:

- `parseFormData(LectureUpdateSchema, formData)` — читает `id`, `title`, `description`, `date` (id — hidden input).
- **Не делаем pre-fetch для owner-чека.** Бэк сам enforce'ит owner: возвращает 403 (или 404 для private). Маппим:
  - `error.code === "forbidden"` → `throw new ForbiddenError("role")` → action отдаст `{ success: false, code: "forbidden" }`.
  - 404 → `throw new Error("Лекция не найдена")` → generic error в UI.
- На успехе: `revalidateEntity("lectures", id)` + `revalidateEntity("lectures")` (на случай, если изменился title — он влияет на список).
- Page-уровневый guard через `canUpdateLecture(me, lecture)` остаётся (defense-in-depth — UI не показывает форму чужому). Действие на бэке тоже проверяется.

`setLectureVisibility` — `createFormAction` (id + visibility из FormData):

- Hidden `<input name="id">` + `<select name="visibility" onChange={(e) => e.target.form.requestSubmit()}>`.
- Pre-check на бэке (owner-only); маппинг 403 → `ForbiddenError("role")`.
- `revalidateEntity("lectures", id)` + `revalidateEntity("lectures")`.

`deleteLecture` — `createFormAction` с hidden `id` (вызывается из `<LectureDeleteButton>` через `<form action={deleteLecture}>` внутри `ConfirmDialog.onConfirm`):

- `requireCapability(me, canDeleteLecture)` — это admin-cap, не owner-аware.
- DELETE `/api/admin/lectures/{id}`.
- На успехе: `revalidateEntity("lectures")` (список) + `redirect("/admin/lectures")` (если delete вызван со страницы редактирования).

**Маппинг ошибок API → ActionResult.** Бэк возвращает `httputil.ErrorResponse { code?, error? }`. Хелпер слайса (или inline-логика):

```ts
function rethrowApiError(err: { code?: string; error?: string } | undefined): never {
  if (err?.code === "forbidden") throw new ForbiddenError("role", err.error);
  throw new Error(err?.error ?? "Ошибка сервера");
}
```

**После создания.** `createLecture` возвращает `data` (созданную лекцию). Страница `/admin/lectures/new` использует `useActionState` + клиент-side `useEffect` на `state.success === true` → `router.push("/admin/lectures/" + state.data.id + "/edit")`. Альтернатива: `redirect()` внутри action — но это ломает `useActionState`-цикл (state не успевает обновиться, форма не показывает success-state). Идём через `useEffect` + `router.push`.

## 9. Routes

### Публичные

- `src/app/lectures/page.tsx` — server component:
  - `searchParams: Promise<{ q?, tag?, offset?, limit? }>`
  - Парсит, вызывает `getLectures({ q, tag, offset, limit })`.
  - Рендерит `<LectureSearchForm initial={…} />` и `<LectureList items={…} variant="public" />` + `<Pagination basePath="/lectures" …/>`.
- `src/app/lectures/[id]/page.tsx`:
  - `getLectureById(id)`; на 404 — `notFound()` (бэк уже скрывает private от не-owner через `notFound`).
  - Рендерит `<LectureDetail lecture={l} />`.

### Админ

- `src/app/admin/lectures/page.tsx`:
  - Layer-3 гейт: `if (!canCreateLecture(me) && !canDeleteLecture(me)) forbidden();`
    (любая admin-cap на лекции пускает; пункт меню гейтится в `admin-sidebar.tsx` уже корректно).
  - `getLectures(filter)`; рендерит таблицу с `<LectureAdminRow>` (содержит ссылку «Редактировать» если owner, и `<LectureDeleteButton>` если cap).
  - Кнопка «Создать» — если `canCreateLecture(me)`.
- `src/app/admin/lectures/new/page.tsx`:
  - `if (!canCreateLecture(me)) forbidden();`
  - Рендерит `<LectureCreateForm />`.
- `src/app/admin/lectures/[id]/edit/page.tsx`:
  - `getLectureById(id)`, `notFound()` если null.
  - `if (!canUpdateLecture(me, lecture)) forbidden();`
  - Рендерит `<LectureEditForm lecture={lecture} canDelete={canDeleteLecture(me)} canSetVisibility={canSetLectureVisibility(me, lecture)} />`.

### Sidebar

`src/app/admin/admin-sidebar.tsx` уже содержит пункт «Лекции» — `buildNavItems` показывает его при `lecture.create || lecture.update || lecture.delete`. Это foundation-зона; **трогать не нужно**, ссылка `/admin/lectures` уже правильная.

## 10. Cover image (read-only)

В `<LectureDetail>` и `<LectureCard>`, если `lecture.cover_image_key` присутствует:
- собираем URL `${process.env.NEXT_PUBLIC_API_URL}/api/files/${cover_image_key}` **через хелпер слайса** `coverImageUrl(lecture)` в `ui/cover-image-url.ts` (server-only, читает env).
- alt — `lecture.cover_image_alt ?? lecture.title`.
- размеры hardcoded через Tailwind (например, `aspect-video w-full`).

⚠ Точное имя эндпоинта `/api/files/{key}` нужно подтвердить в plan-стадии (в `schema.ts` есть отдельный media-эндпоинт). Если на фронте нет публичного file-serve URL — fallback в plan-стадии. Если не будет ясности — в первой итерации **не отображаем cover** и оставляем TODO.

## 11. Error handling

- Server fetchers: `error → throw new Error(error.message)`. Дальше Next.js `error.tsx`.
  - **404 для `getLectureById`** возвращает `{ error: "lecture not found", … }` — fetcher проверяет статус и **возвращает `null`**, чтобы page-уровень мог сделать `notFound()`. Соответствует поведению бэка: private-лекции отдают 404 для не-owner (см. `internal/lecture/service.go:213`).
- Server actions: всё через `createFormAction` → `ActionResult`. Маппинг ошибок API:
  - `error.code === "forbidden"` → `throw new ForbiddenError("role", error.error)` → `{ success: false, code: "forbidden" }`.
  - 404 (delete/update удалённого) → generic `Error` → `{ success: false, error }`.
  - generic → `Error(error.error ?? "Ошибка сервера")`.
- На стороне UI:
  - `result.code === "validation"` → `<Form errors={result.fieldErrors}>`, плюс `_form` баннер если есть.
  - `result.code === "forbidden"` → текст «У вас нет прав на это действие».
  - generic error → `state.error` в красном баннере.
- `<ConfirmDialog>` (для delete): сами обернуть в try/catch и вызвать `useToast().add({ title: "Ошибка", description })` если `result.success === false` (см. конвенции §3.4).

## 12. Тесты

- `permissions.test.ts`: для каждого хелпера — guest, suspended, owner-positive, non-owner-negative, capability-positive/negative.
- `schemas.test.ts`: `LectureCreateSchema` (success + 4 failure: empty title, too-long title, bad date format, bad visibility), `LectureUpdateSchema` (success + 2 failure), `LectureVisibilitySchema` (success + 2 failure: bad uuid, bad visibility), `LectureIdSchema` (success + 1 failure).
- E2E / страницы — не пишем (см. §5 конвенций).

## 13. Чеклист готовности (см. `_template/README.md`)

- [ ] `index.ts` экспортирует только `api`, `actions`, `permissions`, `ui`, `types` (без `schemas`).
- [ ] Все server-only файлы начинаются с `import "server-only";`.
- [ ] Каждая `canXxx` покрыта тестом.
- [ ] Каждая Zod-схема — 1 success + ≥1 failure.
- [ ] Использует `createFormAction` + `parseFormData` + `requireCapability` + `revalidateEntity`.
- [ ] Не импортит другие `@/features/*`.
- [ ] `Tags.LECTURES` добавлен в `src/api/tags.ts`.
- [ ] Удалён `ui/.gitkeep` (если был).
- [ ] `npm run lint && npm run test && npm run build` зелёные.

## 14. Риски и допущения

- **Cover отключён в этой итерации.** Бэк не отдаёт URL для `cover_image_key`, а `/static/files/{key}` доступен только в local-storage режиме. Включается, когда бэк начнёт отдавать `cover_url` в payload (или появится прокси-эндпоинт). До тех пор поле в `lecture.Lecture` присутствует в типе, но игнорируется в UI.
- **Action не делает pre-check ownership через fetch** — полагаемся на бэк, маппим 403/404 в `ForbiddenError`/generic. Page-уровневый guard (через `canUpdateLecture(me, lecture)` в `/admin/lectures/[id]/edit`) обеспечивает корректный UX (форма не показывается чужому).
- **`Select` родом из Base UI рендерит hidden input** — это обеспечивает совместимость с FormData в `setLectureVisibility`. Подтверждено в `src/components/ui/select.tsx` (свойство `name` + Base UI Select).
- **Конкурентные правки** — оптимистичная стратегия, без version-check. Бэк не возвращает `If-Match`/etag, конфликт «last write wins».
