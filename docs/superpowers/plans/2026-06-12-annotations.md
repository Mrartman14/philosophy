# Annotations — план реализации фичи

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ САБ-СКИЛЛ: используйте superpowers:subagent-driven-development (рекомендуется) или superpowers:executing-plans для пошагового выполнения. Шаги отмечены чекбоксами (`- [ ]`).
>
> **Правила параллельной работы (передавать дословно каждому субагенту):** НЕ делать `git stash` / `git reset` / `git checkout .` / `git clean`; `git add` — только своих файлов по имени (НЕ `git add -A` / `git add .`); не откатывать и не перезаписывать чужие изменения; передавать эти правила своим субагентам.

**Goal:** Слайс `src/features/annotations/` — создание, просмотр, редактирование, удаление пользовательских аннотаций (заметок с AST-телом и якорем) на сущностях document / glossary / media / comment, агрегированный просмотр на странице лекции, страница «Мои аннотации», ревизии, выгрузки .md/.txt и admin-модерация публичных аннотаций.

**Architecture:** SSR-first слайс по конвенциям `docs/frontend-conventions.md`. Server-only fetchers (`api.ts`) с `React.cache` + `unstable_cache`/тег `annotations`; мутации через `createAction`/`createFormAction` с `requireCapability`. Видимость аннотации **фиксируется при создании** и не меняется (§6.8). Удаление: автор (own) или админ через `annotation.delete_any` — **только public** (§6.2). Ревизии — через готовый generic `src/components/revision-history/` (порядок ASC→reverse, как в events). Реальные роуты создания/списков — **пер-сущностные** (`POST/GET /api/{documents|comments|glossary|media}/{id}/annotations`); generic-роут `/api/entities/{type}/{id}/annotations` в schema.ts — фикция (§10.1), пер-сущностные GET в schema.ts отсутствуют (§10.2) — оба типизируем вручную поверх типов schema.ts с комментарием-ссылкой на спеку.

**Tech Stack:** Next.js 16 (App Router, server components + server actions), TypeScript (`exactOptionalPropertyTypes`), openapi-fetch + `@/api/schema`, Zod, Base UI Form (`@/components/ui`), `@/components/ast-editor` (entityContext `"annotation"`), `@/components/ast-render`, `@/components/revision-history`, Vitest (jsdom).

---

## Parallel-safety contract

Перед запуском волны менеджер сверяет этот контракт с контрактами других планов волны 2 (`documents`, `media`, `comments`). Пересечения по `create`/`modify` запрещены (кроме append-only `src/api/tags.ts`).

### CREATE (файлы, которые создаёт только эта ветка)

```
src/features/annotations/index.ts
src/features/annotations/types.ts
src/features/annotations/api.ts
src/features/annotations/actions.ts
src/features/annotations/permissions.ts
src/features/annotations/schemas.ts
src/features/annotations/anchor.ts
src/features/annotations/permissions.test.ts
src/features/annotations/schemas.test.ts
src/features/annotations/anchor.test.ts
src/features/annotations/ui/annotation-card.tsx
src/features/annotations/ui/annotation-list.tsx
src/features/annotations/ui/annotation-create-form.tsx
src/features/annotations/ui/annotation-edit-form.tsx
src/features/annotations/ui/annotation-delete-button.tsx
src/features/annotations/ui/annotation-visibility-field.tsx
src/features/annotations/ui/annotation-export-links.tsx
src/features/annotations/ui/annotation-revisions.tsx
src/features/annotations/ui/annotation-anchor-context.tsx
src/features/annotations/ui/annotation-admin-row.tsx
src/features/annotations/ui/annotation-admin-filter-form.tsx
src/features/annotations/ui/annotation-pagination.tsx
src/features/annotations/ui/annotations-section.tsx

src/app/me/annotations/page.tsx
src/app/annotations/[id]/export/route.ts
src/app/admin/annotations/page.tsx
src/app/lectures/[id]/annotations/page.tsx
```

### MODIFY (общие файлы — этой ветке нужно касание)

```
src/api/tags.ts            # append-only: добавить ANNOTATIONS: "annotations" (alphabetical). Конфликт тривиален (спека §5 п.6).
src/app/glossary/[id]/page.tsx   # follow-up интеграция секции аннотаций (глоссарий стабилен после волны 1; в волне 2 никто, кроме этой ветки, его не трогает)
```

### RESERVE (НЕ трогаем — чужие зоны / follow-up)

```
src/app/documents/[id]/page.tsx  # создаёт ветка documents → интеграция follow-up-коммитом ПОСЛЕ её мержа
src/app/media/[id]/page.tsx      # создаёт ветка media → follow-up (если media не смержена к старту)
src/app/lectures/[id]/page.tsx   # резервирует comments → аннотации лекции живут на ОТДЕЛЬНОЙ странице src/app/lectures/[id]/annotations/page.tsx, файл comments не трогаем
src/app/admin/layout.tsx         # пункт /admin/annotations УЖЕ есть (гейт annotation.delete_any) — НЕ трогаем
src/utils/permissions.ts         # frozen; annotation.create в union ОТСУТСТВУЕТ — используем локальный чек (см. Task 3)
src/api/schema.ts                # frozen; недостающие пер-сущностные роуты типизируем вручную в слайсе (§10.1/§10.2)
src/components/ui/*, src/components/revision-history/*, src/components/ast-editor/*, src/components/ast-render/*  # переиспользуем как есть
```

---

## Зависимости и follow-up интеграции

Порядок мержей волны 2: `comments` (на лекцию) → `documents` → `media` → **`annotations`**. На момент старта этой ветки в `main` уже смержены `documents` (и, возможно, `media`/`comments`). Ветка annotations стартует от `main` с `documents`.

| Поверхность | Кто владеет страницей | Статус в этой ветке | Действие |
| --- | --- | --- | --- |
| Страница глоссария `src/app/glossary/[id]/page.tsx` | стабильна (волна 1) | **в ветке** (Task 16) | Добавить `<AnnotationsSection parentEntityType="glossary" parentId={id} />` в page (НЕ в `GlossaryDetail` — cross-feature import запрещён, композиция в page). |
| Страница документа `src/app/documents/[id]/page.tsx` | ветка `documents` | **follow-up** | После мержа `documents` — отдельный коммит: вставить `<AnnotationsSection parentEntityType="document" parentId={id} />` в page документа. Task 17 описывает точный код; выполнять ПОСЛЕ того как файл появится в main. |
| Страница медиа `src/app/media/[id]/page.tsx` | ветка `media` | **follow-up / условно в ветке** | Если `media` смержена к старту — интегрировать в ветке (Task 18, медиа-якорь по времени). Иначе — follow-up после мержа `media`. Решение фиксирует исполнитель в начале (проверка `ls src/app/media`). |
| Аннотации на комментариях | ветка `comments` (дерево на странице лекции) | **follow-up** | Comments резервирует `src/app/lectures/[id]/page.tsx`. Создание/просмотр аннотаций на конкретном комментарии — follow-up-коммит после мержа `comments`: comments-компонент комментария принимает slot-проп, куда монтируется `<AnnotationsSection parentEntityType="comment" parentId={commentId} />`. В ЭТОЙ ветке поддержку `comment` как parent-типа закладываем в api/actions/типах (Task 6), но UI-точку монтирования оставляем follow-up. |
| Агрегированный просмотр аннотаций лекции | `src/app/lectures/[id]/page.tsx` резервирует comments | **в ветке, отдельная страница** | Создаём `src/app/lectures/[id]/annotations/page.tsx` (Task 15) — НЕ трогаем `page.tsx`. Это только просмотр (на лекцию аннотация не создаётся). |

**Канонический интеграционный сниппет** (для glossary в ветке и для documents/media/comments follow-up) — Task 14 определяет `<AnnotationsSection>`; интеграция = один import + один JSX-узел в page.

---

## Известные расхождения schema.ts ↔ бекенд (§10 спеки) — как обходим

1. **Создание (§10.1):** реальные роуты `POST /api/{documents|comments|glossary|media}/{id}/annotations`; в schema.ts только generic `POST /api/entities/{type}/{id}/annotations`. openapi-fetch не знает реальных путей → используем **прямой fetch через `createApiClient`-токен** или typed-обёртку. Решение: ручной fetch с токеном из cookie (как `export/route.ts`), типизированный нашими ручными типами. Тело — `annotation.CreateRequest` из schema.ts (этот тип валиден).
2. **Пер-сущностные GET (§10.2):** `GET /api/{entity}/{id}/annotations` отсутствуют в schema.ts → ручной fetch + ручной тип ответа (`{ data: Annotation[]; pagination: {...} }`).
3. **Агрегация лекции:** `GET /api/lectures/{id}/annotations` — **есть** в schema.ts (строка 8129), зовём через openapi-fetch.
4. **`/me/annotations`, `/admin/annotations`, `GET/PUT/DELETE /api/annotations/{id}`, ревизии, `/admin/annotations/{id}` DELETE** — **есть** в schema.ts, зовём через openapi-fetch.
5. **`annotation.create`** отсутствует в `Capability`-union `src/utils/permissions.ts` (frozen) → локальный чек через `isMutationAllowed(me) && me.capabilities.includes("annotation.create")` (Task 3).
6. **`GET /api/blocks/{block_id}`** есть (строка 4047), но `data` типизирован как `unknown` (generic `httputil.Response`) → для резолва контекста якоря типизируем вручную (Task 13).

---

## Бизнес-правила (из бекенда — источник истины)

- **Capability создания:** `annotation.create` (есть у роли `user`, и у `admin`). Бек: `internal/rbac/capabilities.go`.
- **Capability admin-удаления:** `annotation.delete_any` (есть у `admin`).
- **Видимость фиксируется при создании** (§6.8): `CreateRequest.visibility` (`private` default | `public`); `UpdateRequest` НЕ содержит visibility — менять нельзя.
- **Удаление:** автор удаляет свою (любой видимости) через `DELETE /api/annotations/{id}`; админ удаляет **только public** через `DELETE /api/admin/annotations/{id}` (private → 404, секьюр-by-default). `annotation.delete_any` для annotation действует ТОЛЬКО на public (§6.2).
- **Редактирование:** только автор (`PUT /api/annotations/{id}`, `blocks` + опц. `anchor`); чужую private → 404, чужую public → 403.
- **Видимость private-аннотации:** видна только автору. List для anonymous → только public; для актора → свои (любые) + чужие public.
- **Якорь (`anchor`)** — value-object `anchor.Position` (бек `internal/anchor/position.go`): взаимоисключающие text-range (`start_block_id`, `end_block_id`, `start_char`, `end_char`, `exact`, `prefix`, `suffix`) ИЛИ media-interval (`start_sec`, опц. `end_sec`). Для document/glossary/comment — text-kind (нужны `start_block_id`, `end_block_id`, `exact`). Для media — media-kind (`start_sec >= 0`, `end_sec > start_sec` если задан). Якорь опционален при создании; если задан — валидируется на беке (422 `ANCHOR_INVALID`).
- **Блоки:** AST entityContext `annotation` (бек `internal/ast/schema.go`: block-level limit 200), min 1 блок. Невалидные → 422 `BLOCKS_INVALID` / `BLOCKS_EMPTY`.
- **Suspended-юзер** читает, не пишет → 403 `SUSPENDED` (branded-текст).
- **403 forbidden** → «У вас нет прав на <действие>.»; 404 — secure-by-default.
- Аннотации на banner/event UI не покрываем (§4) — `banner`/`event` не включаем в UI-выбор parent-типа (хотя бек их поддерживает).

---

## Маппинг файлов и ответственностей

| Файл | Ответственность |
| --- | --- |
| `types.ts` | Сужения из `@/api/schema`: `Annotation`, `AnnotationVisibility`, `Anchor`, `AnnotationCreateBody`, `AnnotationRevisionMeta`, `AnnotationRevision`; ручные типы списков пер-сущностных GET; `ParentEntityType` (union UI-подмножества). |
| `anchor.ts` | Pure-функции построения/нормализации `Anchor` для text/media + предикаты валидности (зеркало бекенда, чтобы не слать заведомо невалидное). |
| `api.ts` | Server-only fetchers: пер-сущностный список (ручной fetch), `getAnnotationById`, `getMyAnnotations`, `getLectureAnnotations`, `getAdminAnnotations`, ревизии, `getBlockContext`. |
| `actions.ts` | Мутации: `createAnnotation` (пер-сущностный POST, ручной fetch), `updateAnnotation`, `deleteAnnotation` (own), `adminDeleteAnnotation`. |
| `permissions.ts` | `canCreateAnnotation`, `canEditAnnotation` (owner), `canDeleteAnnotation` (owner), `canAdminDeleteAnnotation` (delete_any ∧ public), `canModerateAnnotations`. |
| `schemas.ts` | Zod: `AnnotationCreateSchema`, `AnnotationUpdateSchema`, `AnnotationIdSchema`, `AdminAnnotationFilterSchema`, `AnnotationOffsetSchema`. |
| `ui/*` | Карточка, список, формы (create с выбором visibility + AST-редактор, edit без visibility), кнопки удаления, секция-композитор, ревизии, экспорт-ссылки, контекст якоря, admin-строка/фильтр/пагинация. |

---

## Task 1: Каркас слайса (копия `_template`) + регистрация тега

**Files:**
- Create: вся папка `src/features/annotations/` из `src/features/_template/`
- Modify: `src/api/tags.ts`

- [ ] **Step 1: Скопировать шаблон**

```bash
cp -R src/features/_template src/features/annotations
rm -f src/features/annotations/ui/.gitkeep
```

- [ ] **Step 2: Добавить тег `ANNOTATIONS` (append-only, алфавитно)**

В `src/api/tags.ts` внутри объекта `Tags`, между `LECTURES` и `PREFERENCES`, добавить строку (соблюдая алфавитный порядок ключей — конфликт-мерж тривиален):

```ts
  LECTURES: "lectures",
  ANNOTATIONS: "annotations",
  PREFERENCES: "preferences",
```

(Итоговый порядок ключей не строго алфавитный в текущем файле — следуем существующему стилю «добавляй константу»; ключ `ANNOTATIONS` со значением `"annotations"`.)

- [ ] **Step 3: Проверить, что ничего не сломалось**

Run: `npm run lint`
Expected: PASS (шаблонные файлы валидны; `_template` уже линтится в проекте).

- [ ] **Step 4: Commit**

```bash
git add src/features/annotations src/api/tags.ts
git commit -m "chore(annotations): scaffold slice from template + register cache tag"
```

---

## Task 2: Типы слайса (`types.ts`)

**Files:**
- Create/Modify: `src/features/annotations/types.ts`

- [ ] **Step 1: Написать типы**

Полностью заменить содержимое `src/features/annotations/types.ts`:

```ts
// src/features/annotations/types.ts
import type { components } from "@/api/schema";

/** Аннотация (заметка пользователя с AST-телом и якорем). */
export type Annotation = components["schemas"]["annotation.Annotation"];

/** Видимость аннотации. Фиксируется при создании (спека §6.8). */
export type AnnotationVisibility =
  components["schemas"]["annotation.Visibility"];

/** Якорь — text-range или media-interval (взаимоисключающие). */
export type Anchor = components["schemas"]["annotation.Anchor"];

/** Тело POST-создания. Тип schema.ts валиден, хотя путь — фикция (§10.1). */
export type AnnotationCreateBody =
  components["schemas"]["annotation.CreateRequest"];

/** Тело PUT-редактирования (без visibility — она иммутабельна). */
export type AnnotationUpdateBody =
  components["schemas"]["annotation.UpdateRequest"];

/** AST-блок (тело аннотации). */
export type AnnotationBlock = components["schemas"]["ast.Block"];

/** Мета ревизии (элемент списка). */
export type AnnotationRevisionMeta =
  components["schemas"]["revision.RevisionMeta"];

/** Полная ревизия со снапшотом blocks. */
export type AnnotationRevision = components["schemas"]["revision.Revision"];

/**
 * Подмножество parent-типов, для которых строим UI создания/просмотра.
 * Бек поддерживает также banner/event/canvas, но UI для них не делаем (§4).
 */
export type ParentEntityType = "document" | "glossary" | "media" | "comment";

/**
 * Ответ пер-сущностного списка `GET /api/{entity}/{id}/annotations`.
 * Этих роутов НЕТ в schema.ts (§10.2) — типизируем вручную. Форма ответа —
 * стандартный httputil.ListResponse (data + pagination), как у лекционного
 * списка (schema.ts строка 8162).
 */
export interface AnnotationListResponse {
  data: Annotation[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
  };
}

/** Унифицированный результат списка для UI-компонентов. */
export interface AnnotationListResult {
  items: Annotation[];
  total: number;
  offset: number;
  limit: number;
}
```

- [ ] **Step 2: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (все ссылки на `components["schemas"]…` существуют в schema.ts — подтверждено в research: `annotation.Annotation`, `annotation.Visibility`, `annotation.Anchor`, `annotation.CreateRequest`, `annotation.UpdateRequest`, `revision.RevisionMeta`, `revision.Revision`, `ast.Block`).

- [ ] **Step 3: Commit**

```bash
git add src/features/annotations/types.ts
git commit -m "feat(annotations): slice types (manual list-response type for per-entity GET, §10.2)"
```

---

## Task 3: Permissions (`permissions.ts`) + тесты

**Files:**
- Create/Modify: `src/features/annotations/permissions.ts`
- Test: `src/features/annotations/permissions.test.ts`

- [ ] **Step 1: Написать failing-тест**

Полностью заменить `src/features/annotations/permissions.test.ts`:

```ts
// src/features/annotations/permissions.test.ts
import { describe, it, expect } from "vitest";
import type { Me } from "@/utils/me";
import {
  canCreateAnnotation,
  canEditAnnotation,
  canDeleteAnnotation,
  canAdminDeleteAnnotation,
  canModerateAnnotations,
} from "./permissions";
import type { Annotation } from "./types";

const guest = null;

const author: Me = {
  id: "u-author",
  username: "author",
  role: "user",
  status: "active",
  capabilities: ["annotation.create"],
};

const otherUser: Me = {
  id: "u-other",
  username: "other",
  role: "user",
  status: "active",
  capabilities: ["annotation.create"],
};

const userNoCap: Me = {
  id: "u-nocap",
  username: "nocap",
  role: "user",
  status: "active",
  capabilities: [],
};

const suspendedAuthor: Me = { ...author, status: "suspended" };

const admin: Me = {
  id: "u-admin",
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: ["annotation.create", "annotation.delete_any"],
};

function ann(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: "a-1",
    owner_id: "u-author",
    visibility: "private",
    parent_entity_type: "document",
    parent_entity_id: "d-1",
    blocks: [],
    ...overrides,
  };
}

describe("canCreateAnnotation", () => {
  it("гость → false", () => expect(canCreateAnnotation(guest)).toBe(false));
  it("active без cap → false", () =>
    expect(canCreateAnnotation(userNoCap)).toBe(false));
  it("suspended с cap → false", () =>
    expect(canCreateAnnotation(suspendedAuthor)).toBe(false));
  it("active с annotation.create → true", () =>
    expect(canCreateAnnotation(author)).toBe(true));
});

describe("canEditAnnotation", () => {
  it("гость → false", () =>
    expect(canEditAnnotation(guest, ann())).toBe(false));
  it("автор → true", () =>
    expect(canEditAnnotation(author, ann())).toBe(true));
  it("не автор → false", () =>
    expect(canEditAnnotation(otherUser, ann())).toBe(false));
  it("suspended автор → false", () =>
    expect(canEditAnnotation(suspendedAuthor, ann())).toBe(false));
  it("админ-не-автор → false (admin не правит чужой контент, §6.2)", () =>
    expect(canEditAnnotation(admin, ann())).toBe(false));
});

describe("canDeleteAnnotation", () => {
  it("гость → false", () =>
    expect(canDeleteAnnotation(guest, ann())).toBe(false));
  it("автор private → true", () =>
    expect(canDeleteAnnotation(author, ann())).toBe(true));
  it("автор public → true", () =>
    expect(canDeleteAnnotation(author, ann({ visibility: "public" }))).toBe(
      true,
    ));
  it("не автор → false", () =>
    expect(canDeleteAnnotation(otherUser, ann())).toBe(false));
  it("suspended автор → false", () =>
    expect(canDeleteAnnotation(suspendedAuthor, ann())).toBe(false));
});

describe("canAdminDeleteAnnotation", () => {
  it("админ + public → true", () =>
    expect(
      canAdminDeleteAnnotation(admin, ann({ visibility: "public" })),
    ).toBe(true));
  it("админ + private → false (delete_any только на public, §6.2)", () =>
    expect(
      canAdminDeleteAnnotation(admin, ann({ visibility: "private" })),
    ).toBe(false));
  it("не-админ + public → false", () =>
    expect(
      canAdminDeleteAnnotation(author, ann({ visibility: "public" })),
    ).toBe(false));
  it("гость → false", () =>
    expect(
      canAdminDeleteAnnotation(guest, ann({ visibility: "public" })),
    ).toBe(false));
});

describe("canModerateAnnotations", () => {
  it("админ с delete_any → true", () =>
    expect(canModerateAnnotations(admin)).toBe(true));
  it("обычный user → false", () =>
    expect(canModerateAnnotations(author)).toBe(false));
  it("гость → false", () =>
    expect(canModerateAnnotations(guest)).toBe(false));
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test -- src/features/annotations/permissions.test.ts`
Expected: FAIL (`permissions.ts` ещё шаблонный — функции не экспортируются).

- [ ] **Step 3: Написать реализацию**

Полностью заменить `src/features/annotations/permissions.ts`:

```ts
// src/features/annotations/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can, isMutationAllowed } from "@/utils/permissions";
import type { Annotation } from "./types";

/**
 * Создание аннотации. Бек требует capability `annotation.create`
 * (internal/rbac/capabilities.go: есть у роли user и admin). Эта капа НЕ
 * входит в union `Capability` из src/utils/permissions.ts (frozen-зона), и
 * `can()` её не примет — поэтому локальный чек: active-мутатор + членство
 * в capabilities. См. план §«Известные расхождения», п.5.
 */
export function canCreateAnnotation(me: MaybeMe): boolean {
  return isMutationAllowed(me) && me.capabilities.includes("annotation.create");
}

/**
 * Редактировать может ТОЛЬКО автор (бек: PUT /api/annotations/{id} — owner-only,
 * без admin-override). Status-гейт через isMutationAllowed.
 */
export function canEditAnnotation(me: MaybeMe, annotation: Annotation): boolean {
  return isMutationAllowed(me) && annotation.owner_id === me.id;
}

/**
 * Удалить свою (любой видимости) может только автор
 * (DELETE /api/annotations/{id}). Админское удаление — отдельный хелпер.
 */
export function canDeleteAnnotation(
  me: MaybeMe,
  annotation: Annotation,
): boolean {
  return isMutationAllowed(me) && annotation.owner_id === me.id;
}

/**
 * Admin-удаление через DELETE /api/admin/annotations/{id}. Капа
 * `annotation.delete_any` действует ТОЛЬКО на public (§6.2): для private бек
 * вернёт 404 (secure-by-default). UI прячем для private.
 */
export function canAdminDeleteAnnotation(
  me: MaybeMe,
  annotation: Annotation,
): boolean {
  return can(me, "annotation.delete_any") && annotation.visibility === "public";
}

/** Доступ к admin-списку публичных аннотаций (гейт annotation.delete_any). */
export function canModerateAnnotations(me: MaybeMe): boolean {
  return can(me, "annotation.delete_any");
}
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `npm test -- src/features/annotations/permissions.test.ts`
Expected: PASS (все describe-блоки зелёные).

- [ ] **Step 5: Commit**

```bash
git add src/features/annotations/permissions.ts src/features/annotations/permissions.test.ts
git commit -m "feat(annotations): permissions (owner-aware edit/delete; admin delete public-only); tests"
```

---

## Task 4: Anchor-хелперы (`anchor.ts`) + тесты

**Files:**
- Create: `src/features/annotations/anchor.ts`
- Test: `src/features/annotations/anchor.test.ts`

Зеркалим валидацию бекенда (`internal/anchor/validate.go`), чтобы фронт не слал заведомо невалидный якорь и мог построить корректный body. Чистые функции — без `server-only`, тестируются в jsdom.

- [ ] **Step 1: Написать failing-тест**

Create `src/features/annotations/anchor.test.ts`:

```ts
// src/features/annotations/anchor.test.ts
import { describe, it, expect } from "vitest";
import {
  buildTextAnchor,
  buildMediaAnchor,
  isValidTextAnchor,
  isValidMediaAnchor,
} from "./anchor";

describe("buildTextAnchor", () => {
  it("строит text-range якорь с обязательными полями", () => {
    const a = buildTextAnchor({
      startBlockId: "b1",
      endBlockId: "b2",
      startChar: 0,
      endChar: 5,
      exact: "Кант",
      prefix: "до ",
      suffix: " после",
    });
    expect(a).toEqual({
      start_block_id: "b1",
      end_block_id: "b2",
      start_char: 0,
      end_char: 5,
      exact: "Кант",
      prefix: "до ",
      suffix: " после",
    });
  });

  it("опускает пустые prefix/suffix", () => {
    const a = buildTextAnchor({
      startBlockId: "b1",
      endBlockId: "b1",
      startChar: 0,
      endChar: 3,
      exact: "abc",
    });
    expect(a.prefix).toBeUndefined();
    expect(a.suffix).toBeUndefined();
    expect(a.start_block_id).toBe("b1");
  });
});

describe("isValidTextAnchor", () => {
  it("валиден: оба block_id + exact заданы", () =>
    expect(
      isValidTextAnchor({
        start_block_id: "b1",
        end_block_id: "b2",
        exact: "x",
      }),
    ).toBe(true));
  it("невалиден: нет exact", () =>
    expect(
      isValidTextAnchor({ start_block_id: "b1", end_block_id: "b2" }),
    ).toBe(false));
  it("невалиден: нет end_block_id", () =>
    expect(isValidTextAnchor({ start_block_id: "b1", exact: "x" })).toBe(
      false,
    ));
  it("невалиден: примешаны media-поля", () =>
    expect(
      isValidTextAnchor({
        start_block_id: "b1",
        end_block_id: "b2",
        exact: "x",
        start_sec: 5,
      }),
    ).toBe(false));
});

describe("buildMediaAnchor", () => {
  it("строит media-interval с start+end", () => {
    expect(buildMediaAnchor(10, 20)).toEqual({ start_sec: 10, end_sec: 20 });
  });
  it("строит точечный media-якорь без end", () => {
    expect(buildMediaAnchor(10)).toEqual({ start_sec: 10 });
  });
});

describe("isValidMediaAnchor", () => {
  it("валиден: start_sec >= 0", () =>
    expect(isValidMediaAnchor({ start_sec: 0 })).toBe(true));
  it("валиден: end_sec > start_sec", () =>
    expect(isValidMediaAnchor({ start_sec: 5, end_sec: 10 })).toBe(true));
  it("невалиден: end_sec <= start_sec", () =>
    expect(isValidMediaAnchor({ start_sec: 10, end_sec: 10 })).toBe(false));
  it("невалиден: отрицательный start_sec", () =>
    expect(isValidMediaAnchor({ start_sec: -1 })).toBe(false));
  it("невалиден: примешаны text-поля", () =>
    expect(
      isValidMediaAnchor({ start_sec: 5, start_block_id: "b1" }),
    ).toBe(false));
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test -- src/features/annotations/anchor.test.ts`
Expected: FAIL (модуль `./anchor` не существует).

- [ ] **Step 3: Написать реализацию**

Create `src/features/annotations/anchor.ts`:

```ts
// src/features/annotations/anchor.ts
import type { Anchor } from "./types";

/**
 * Хелперы построения/валидации якоря. Зеркалят инварианты бекенда
 * (philosophy-api internal/anchor/validate.go): text-range и media-interval
 * взаимоисключающи. Фронт-валидация — defensive, финальную проверку делает
 * бек (422 ANCHOR_INVALID).
 */

interface TextAnchorInput {
  startBlockId: string;
  endBlockId: string;
  startChar: number;
  endChar: number;
  exact: string;
  prefix?: string;
  suffix?: string;
}

/** Строит text-range якорь (document / glossary / comment). */
export function buildTextAnchor(input: TextAnchorInput): Anchor {
  const anchor: Anchor = {
    start_block_id: input.startBlockId,
    end_block_id: input.endBlockId,
    start_char: input.startChar,
    end_char: input.endChar,
    exact: input.exact,
  };
  if (input.prefix) anchor.prefix = input.prefix;
  if (input.suffix) anchor.suffix = input.suffix;
  return anchor;
}

/** Строит media-interval якорь (media). endSec опционален (точечный якорь). */
export function buildMediaAnchor(startSec: number, endSec?: number): Anchor {
  const anchor: Anchor = { start_sec: startSec };
  if (endSec !== undefined) anchor.end_sec = endSec;
  return anchor;
}

function hasAnyMedia(a: Anchor): boolean {
  return a.start_sec !== undefined || a.end_sec !== undefined;
}

function hasAnyText(a: Anchor): boolean {
  return (
    !!a.start_block_id ||
    !!a.end_block_id ||
    (a.start_char ?? 0) !== 0 ||
    (a.end_char ?? 0) !== 0 ||
    !!a.exact ||
    !!a.prefix ||
    !!a.suffix
  );
}

/** Text-range валиден: оба block_id + exact, без media-полей. */
export function isValidTextAnchor(a: Anchor): boolean {
  if (hasAnyMedia(a)) return false;
  return !!a.start_block_id && !!a.end_block_id && !!a.exact;
}

/** Media-interval валиден: start_sec >= 0, end_sec (если есть) > start, без text-полей. */
export function isValidMediaAnchor(a: Anchor): boolean {
  if (hasAnyText(a)) return false;
  if (a.start_sec === undefined || a.start_sec < 0) return false;
  if (a.end_sec !== undefined && a.end_sec <= a.start_sec) return false;
  return true;
}
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `npm test -- src/features/annotations/anchor.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/annotations/anchor.ts src/features/annotations/anchor.test.ts
git commit -m "feat(annotations): anchor build/validate helpers mirroring backend invariants; tests"
```

---

## Task 5: Zod-схемы (`schemas.ts`) + тесты

**Files:**
- Create/Modify: `src/features/annotations/schemas.ts`
- Test: `src/features/annotations/schemas.test.ts`

- [ ] **Step 1: Написать failing-тест**

Полностью заменить `src/features/annotations/schemas.test.ts`:

```ts
// src/features/annotations/schemas.test.ts
import { describe, it, expect } from "vitest";
import {
  AnnotationCreateSchema,
  AnnotationUpdateSchema,
  AnnotationIdSchema,
  AdminAnnotationFilterSchema,
  AnnotationOffsetSchema,
} from "./schemas";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const blocksJson = JSON.stringify([{ type: "paragraph", content: [] }]);

describe("AnnotationCreateSchema", () => {
  it("success: blocks + private + parent поля", () => {
    const r = AnnotationCreateSchema.safeParse({
      parent_entity_type: "document",
      parent_entity_id: UUID,
      visibility: "private",
      blocks: blocksJson,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.parent_entity_type).toBe("document");
      expect(Array.isArray(r.data.blocks)).toBe(true);
      expect(r.data.visibility).toBe("private");
    }
  });

  it("success: visibility по умолчанию private при отсутствии", () => {
    const r = AnnotationCreateSchema.safeParse({
      parent_entity_type: "glossary",
      parent_entity_id: UUID,
      blocks: blocksJson,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.visibility).toBe("private");
  });

  it("failure: неизвестный parent_entity_type", () => {
    const r = AnnotationCreateSchema.safeParse({
      parent_entity_type: "banner",
      parent_entity_id: UUID,
      blocks: blocksJson,
    });
    expect(r.success).toBe(false);
  });

  it("failure: пустые blocks (битый JSON)", () => {
    const r = AnnotationCreateSchema.safeParse({
      parent_entity_type: "document",
      parent_entity_id: UUID,
      blocks: "не json",
    });
    expect(r.success).toBe(false);
  });

  it("failure: blocks не массив", () => {
    const r = AnnotationCreateSchema.safeParse({
      parent_entity_type: "document",
      parent_entity_id: UUID,
      blocks: JSON.stringify({ type: "paragraph" }),
    });
    expect(r.success).toBe(false);
  });
});

describe("AnnotationUpdateSchema", () => {
  it("success: id + blocks", () => {
    const r = AnnotationUpdateSchema.safeParse({ id: UUID, blocks: blocksJson });
    expect(r.success).toBe(true);
  });
  it("failure: невалидный id", () => {
    const r = AnnotationUpdateSchema.safeParse({ id: "x", blocks: blocksJson });
    expect(r.success).toBe(false);
  });
  it("failure: visibility в апдейте игнорируется (иммутабельна)", () => {
    const r = AnnotationUpdateSchema.safeParse({
      id: UUID,
      blocks: blocksJson,
      visibility: "public",
    });
    expect(r.success).toBe(true);
    // даже если прислали — в выходной объект не просачивается
    if (r.success) expect("visibility" in r.data).toBe(false);
  });
});

describe("AnnotationIdSchema", () => {
  it("success: валидный uuid", () =>
    expect(AnnotationIdSchema.safeParse({ id: UUID }).success).toBe(true));
  it("failure: не uuid", () =>
    expect(AnnotationIdSchema.safeParse({ id: "nope" }).success).toBe(false));
});

describe("AnnotationOffsetSchema", () => {
  it("success: строку приводит к числу", () => {
    const r = AnnotationOffsetSchema.safeParse("40");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe(40);
  });
  it("failure: отрицательное", () =>
    expect(AnnotationOffsetSchema.safeParse("-1").success).toBe(false));
});

describe("AdminAnnotationFilterSchema", () => {
  it("success: полный набор фильтров", () => {
    const r = AdminAnnotationFilterSchema.parse({
      parent_entity_type: "document",
      parent_entity_id: UUID,
      author_id: UUID,
      offset: "20",
    });
    expect(r.parent_entity_type).toBe("document");
    expect(r.offset).toBe(20);
  });
  it("success: пустой объект → все undefined", () => {
    const r = AdminAnnotationFilterSchema.parse({});
    expect(r.parent_entity_type).toBeUndefined();
    expect(r.offset).toBeUndefined();
  });
  it("битые значения → undefined, parse не бросает", () => {
    const r = AdminAnnotationFilterSchema.parse({
      parent_entity_type: "bogus",
      author_id: "не-uuid",
      offset: "-5",
    });
    expect(r.parent_entity_type).toBeUndefined();
    expect(r.author_id).toBeUndefined();
    expect(r.offset).toBeUndefined();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test -- src/features/annotations/schemas.test.ts`
Expected: FAIL (схемы не экспортируются).

- [ ] **Step 3: Написать реализацию**

Полностью заменить `src/features/annotations/schemas.ts`:

```ts
// src/features/annotations/schemas.ts
import "server-only";
import { z } from "zod";

/**
 * JSON-строка AST-блоков из hidden-input формы (паттерн events:
 * BlocksJsonSchema). Парсит и проверяет, что результат — непустой массив.
 */
const BlocksJsonSchema = z
  .string()
  .min(1, "Тело аннотации не может быть пустым")
  .transform((s, ctx) => {
    try {
      const parsed: unknown = JSON.parse(s);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Тело должно быть непустым массивом блоков",
        });
        return z.NEVER;
      }
      return parsed as unknown[];
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Битый JSON в теле аннотации",
      });
      return z.NEVER;
    }
  });

/** Подмножество parent-типов с UI (banner/event/canvas не покрываем — §4). */
const ParentEntityTypeSchema = z.enum([
  "document",
  "glossary",
  "media",
  "comment",
]);

const VisibilitySchema = z.enum(["private", "public"]);

/**
 * Опциональный JSON-якорь (hidden-input). Парсится в объект; структурную
 * валидность под parent-тип проверяет бек (422 ANCHOR_INVALID) + наши
 * anchor.ts-предикаты на клиенте до сабмита.
 */
const AnchorJsonSchema = z
  .string()
  .optional()
  .transform((s, ctx) => {
    if (!s || s.trim() === "") return undefined;
    try {
      const parsed: unknown = JSON.parse(s);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Якорь должен быть объектом",
        });
        return z.NEVER;
      }
      return parsed as Record<string, unknown>;
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Битый JSON в якоре",
      });
      return z.NEVER;
    }
  });

export const AnnotationCreateSchema = z.object({
  parent_entity_type: ParentEntityTypeSchema,
  parent_entity_id: z.string().uuid("Некорректный id родительской сущности"),
  visibility: VisibilitySchema.optional().default("private"),
  blocks: BlocksJsonSchema,
  anchor: AnchorJsonSchema,
});

export const AnnotationUpdateSchema = z
  .object({
    id: z.string().uuid("Некорректный id аннотации"),
    blocks: BlocksJsonSchema,
    anchor: AnchorJsonSchema,
  })
  // visibility намеренно не входит в схему: иммутабельна (§6.8). Лишний ключ
  // в форме игнорируется (z.object strip по умолчанию).
  .transform((v) => ({
    id: v.id,
    blocks: v.blocks,
    ...(v.anchor !== undefined ? { anchor: v.anchor } : {}),
  }));

export const AnnotationIdSchema = z.object({
  id: z.string().uuid("Некорректный id аннотации"),
});

/** offset для локальной/серверной пагинации. */
export const AnnotationOffsetSchema = z.coerce
  .number()
  .int()
  .min(0, "offset >= 0");

/** Фильтр admin-списка. Битые значения → undefined (не бросаем). */
export const AdminAnnotationFilterSchema = z.object({
  parent_entity_type: z
    .enum(["document", "glossary", "media", "comment"])
    .optional()
    .catch(undefined),
  parent_entity_id: z
    .string()
    .uuid()
    .optional()
    .catch(undefined),
  author_id: z.string().uuid().optional().catch(undefined),
  offset: AnnotationOffsetSchema.optional().catch(undefined),
});

export type AnnotationCreateInput = z.infer<typeof AnnotationCreateSchema>;
export type AnnotationUpdateInput = z.infer<typeof AnnotationUpdateSchema>;
export type AnnotationIdInput = z.infer<typeof AnnotationIdSchema>;
export type AdminAnnotationFilterInput = z.infer<
  typeof AdminAnnotationFilterSchema
>;
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `npm test -- src/features/annotations/schemas.test.ts`
Expected: PASS.

> Заметка для исполнителя: если версия Zod в проекте — v4 (проверить `package.json`), и `z.ZodIssueCode.custom` / `z.coerce` отличаются — сверьтесь с уже работающими `src/features/events/schemas.ts` и `src/features/audit/schemas.ts` (они используют `z.ZodIssueCode.custom`, `z.coerce`, `.catch`) и повторите ровно их стиль. НЕ менять версию Zod.

- [ ] **Step 5: Commit**

```bash
git add src/features/annotations/schemas.ts src/features/annotations/schemas.test.ts
git commit -m "feat(annotations): Zod schemas (create/update/id/admin-filter; visibility immutable on update); tests"
```

---

## Task 6: API-фетчеры (`api.ts`)

**Files:**
- Create/Modify: `src/features/annotations/api.ts`

Содержит: пер-сущностный список (ручной fetch, §10.2), `getAnnotationById`, `getMyAnnotations`, `getLectureAnnotations`, `getAdminAnnotations`, ревизии. (`getBlockContext` — Task 13.)

- [ ] **Step 1: Написать реализацию**

Полностью заменить `src/features/annotations/api.ts`:

```ts
// src/features/annotations/api.ts
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createApiClient } from "@/api/client";
import type {
  Annotation,
  AnnotationListResponse,
  AnnotationListResult,
  AnnotationRevisionMeta,
  AnnotationRevision,
  ParentEntityType,
} from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

/** Реальный путь пер-сущностного списка (§10.1: documents/comments/glossary/media). */
const PER_ENTITY_PATH: Record<ParentEntityType, string> = {
  document: "documents",
  comment: "comments",
  glossary: "glossary",
  media: "media",
};

function toResult(
  resp: AnnotationListResponse | null,
  offset: number,
  limit: number,
): AnnotationListResult {
  return {
    items: resp?.data ?? [],
    total: resp?.pagination?.total ?? 0,
    offset: resp?.pagination?.offset ?? offset,
    limit: resp?.pagination?.limit ?? limit,
  };
}

/**
 * Список аннотаций на конкретной сущности. Роут `GET /api/{entity}/{id}/
 * annotations` НЕ описан в schema.ts (§10.2) — ручной fetch с токеном из
 * cookie (паттерн export/route.ts). Бек применяет матрицу видимости: аноним
 * видит только public, актор — свои (любые) + чужие public.
 */
export const getAnnotationsFor = cache(
  async (
    parentEntityType: ParentEntityType,
    parentId: string,
    offset = 0,
    limit = 20,
  ): Promise<AnnotationListResult> => {
    const token = (await cookies()).get("token")?.value;
    const seg = PER_ENTITY_PATH[parentEntityType];
    const url = new URL(
      `${API_URL}/api/${seg}/${encodeURIComponent(parentId)}/annotations`,
    );
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("limit", String(limit));
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    // 404 (parent невидим) → пустой список, не валим страницу.
    if (res.status === 404) return toResult(null, offset, limit);
    if (!res.ok) {
      throw new Error(`Не удалось загрузить аннотации (${res.status})`);
    }
    const json = (await res.json()) as AnnotationListResponse;
    return toResult(json, offset, limit);
  },
);

/** Одна аннотация по id (GET /api/annotations/{id} — optional-auth). */
export const getAnnotationById = cache(
  async (id: string): Promise<Annotation | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/annotations/{id}", {
      params: { path: { id } },
    });
    if (response.status === 404) return null;
    if (error) throw new Error("Не удалось загрузить аннотацию");
    return (data?.data ?? null) as Annotation | null;
  },
);

/** «Мои аннотации» (GET /api/me/annotations, требует auth). */
export const getMyAnnotations = cache(
  async (
    offset = 0,
    limit = 20,
    parentEntityType?: ParentEntityType,
  ): Promise<AnnotationListResult> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/me/annotations", {
      params: {
        query: {
          offset,
          limit,
          ...(parentEntityType ? { parent_entity_type: parentEntityType } : {}),
        },
      },
    });
    if (error) throw new Error("Не удалось загрузить мои аннотации");
    return {
      items: (data?.data ?? []) as Annotation[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);

/** Агрегация по лекции (GET /api/lectures/{id}/annotations — есть в schema.ts). */
export const getLectureAnnotations = cache(
  async (
    lectureId: string,
    offset = 0,
    limit = 20,
    parentEntityType?: "document" | "comment" | "media",
  ): Promise<AnnotationListResult> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/lectures/{id}/annotations", {
      params: {
        path: { id: lectureId },
        query: {
          offset,
          limit,
          ...(parentEntityType ? { parent_entity_type: parentEntityType } : {}),
        },
      },
    });
    if (error) throw new Error("Не удалось загрузить аннотации лекции");
    return {
      items: (data?.data ?? []) as Annotation[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);

/** Admin-список публичных аннотаций (GET /api/admin/annotations). */
export const getAdminAnnotations = cache(
  async (filter: {
    parent_entity_type?: string;
    parent_entity_id?: string;
    author_id?: string;
    offset?: number;
    limit?: number;
  }): Promise<AnnotationListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const { data, error } = await api.GET("/api/admin/annotations", {
      params: {
        query: {
          offset,
          limit,
          ...(filter.parent_entity_type
            ? { parent_entity_type: filter.parent_entity_type }
            : {}),
          ...(filter.parent_entity_id
            ? { parent_entity_id: filter.parent_entity_id }
            : {}),
          ...(filter.author_id ? { author_id: filter.author_id } : {}),
        },
      },
    });
    if (error) throw new Error("Не удалось загрузить список аннотаций");
    return {
      items: (data?.data ?? []) as Annotation[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);

/** Список ревизий аннотации (GET /api/annotations/{id}/revisions). */
export const getAnnotationRevisions = cache(
  async (id: string): Promise<AnnotationRevisionMeta[]> => {
    const api = await createApiClient();
    const { data, error } = await api.GET(
      "/api/annotations/{id}/revisions",
      { params: { path: { id } } },
    );
    if (error) throw new Error("Не удалось загрузить ревизии");
    return (data?.data ?? []) as AnnotationRevisionMeta[];
  },
);

/** Одна ревизия (GET /api/annotations/{id}/revisions/{revisionID}). */
export const getAnnotationRevision = cache(
  async (id: string, revisionId: string): Promise<AnnotationRevision | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET(
      "/api/annotations/{id}/revisions/{revisionID}",
      { params: { path: { id, revisionID: revisionId } } },
    );
    if (response.status === 404) return null;
    if (error) throw new Error("Не удалось загрузить ревизию");
    return (data?.data ?? null) as AnnotationRevision | null;
  },
);
```

- [ ] **Step 2: Проверить типы и линт**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. (Если openapi-fetch ругается на форму `query`-объекта для `/api/me/annotations` или `/api/lectures/{id}/annotations` из-за `exactOptionalPropertyTypes` — мы используем conditional-spread, поэтому необязательные ключи не появляются как `undefined`. `revisionID` — именно так названо в schema.ts path-param.)

- [ ] **Step 3: Commit**

```bash
git add src/features/annotations/api.ts
git commit -m "feat(annotations): api fetchers (per-entity list via manual fetch §10.2; me/lecture/admin/revisions via schema.ts)"
```

---

## Task 7: Server actions (`actions.ts`)

**Files:**
- Create/Modify: `src/features/annotations/actions.ts`

- [ ] **Step 1: Написать реализацию**

Полностью заменить `src/features/annotations/actions.ts`:

```ts
// src/features/annotations/actions.ts
"use server";
import "server-only";
import { cookies } from "next/headers";
import { createApiClient } from "@/api/client";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";
import { Tags } from "@/api/tags";
import {
  canCreateAnnotation,
  canDeleteAnnotation,
  canEditAnnotation,
  canAdminDeleteAnnotation,
} from "./permissions";
import {
  AnnotationCreateSchema,
  AnnotationUpdateSchema,
  AnnotationIdSchema,
} from "./schemas";
import { getAnnotationById } from "./api";
import type { Annotation, ParentEntityType } from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

const PER_ENTITY_PATH: Record<ParentEntityType, string> = {
  document: "documents",
  comment: "comments",
  glossary: "glossary",
  media: "media",
};

type ApiError = { code?: string; error?: string };

/** Маппинг UPPER_SNAKE-кодов бекенда на доменные ошибки фронта. */
function rethrowApiError(err: ApiError | undefined): never {
  switch (err?.code) {
    case "FORBIDDEN":
      throw new ForbiddenError("role", err.error);
    case "SUSPENDED":
      throw new ForbiddenError("status", err.error);
    case "BLOCKS_EMPTY":
      throw new Error("Тело аннотации не может быть пустым.");
    case "BLOCKS_INVALID":
      throw new Error("Тело аннотации не прошло валидацию AST.");
    case "ANCHOR_INVALID":
      throw new Error("Некорректная привязка (якорь) аннотации.");
    case "INVALID_PARENT_TYPE":
      throw new Error("Аннотации недоступны для этого типа сущности.");
    case "REF_NOT_FOUND":
      throw new Error("Одна из ссылок указывает на несуществующий объект.");
    case "REQUEST_BODY_TOO_LARGE":
      throw new Error("Аннотация слишком большая.");
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}

/**
 * Создание аннотации. Реальный роут — пер-сущностный POST
 * `/api/{entity}/{id}/annotations` (§10.1), которого нет в openapi-fetch
 * (там фикция /api/entities/{type}/{id}/annotations). Поэтому ручной fetch
 * с токеном из cookie. Тело — annotation.CreateRequest (тип валиден).
 * visibility ФИКСИРУЕТСЯ здесь и не меняется (§6.8).
 */
export const createAnnotation = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canCreateAnnotation);
  const input = parseFormData(AnnotationCreateSchema, formData);

  const token = (await cookies()).get("token")?.value;
  const seg = PER_ENTITY_PATH[input.parent_entity_type];
  const body: Record<string, unknown> = {
    blocks: input.blocks,
    visibility: input.visibility,
  };
  if (input.anchor !== undefined) body.anchor = input.anchor;

  const res = await fetch(
    `${API_URL}/api/${seg}/${encodeURIComponent(input.parent_entity_id)}/annotations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as ApiError;
    rethrowApiError(errBody);
  }
  const json = (await res.json()) as { data?: Annotation };
  revalidateEntity(Tags.ANNOTATIONS);
  return (json.data ?? null) as Annotation | null;
});

/**
 * Редактирование. Только автор (бек owner-only). blocks обязательны, anchor
 * опционален. visibility менять нельзя — её нет в UpdateRequest.
 */
export const updateAnnotation = createFormAction(async (formData) => {
  const me = await getMe();
  const input = parseFormData(AnnotationUpdateSchema, formData);

  // Defense-in-depth: грузим аннотацию, проверяем ownership.
  const existing = await getAnnotationById(input.id);
  if (!existing) throw new Error("Аннотация не найдена.");
  requireCapability(me, (m) => canEditAnnotation(m, existing));

  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/annotations/{id}", {
    params: { path: { id: input.id } },
    body: {
      blocks: input.blocks as never,
      ...(input.anchor !== undefined ? { anchor: input.anchor as never } : {}),
    },
  });
  if (error) rethrowApiError(error as ApiError);
  revalidateEntity(Tags.ANNOTATIONS, input.id);
  revalidateEntity(Tags.ANNOTATIONS);
  return (data?.data ?? null) as Annotation | null;
});

/** Удаление своей аннотации (DELETE /api/annotations/{id}). */
export const deleteAnnotation = createAction(async (rawId: string) => {
  const me = await getMe();
  const { id } = AnnotationIdSchema.parse({ id: rawId });
  const existing = await getAnnotationById(id);
  if (!existing) throw new Error("Аннотация не найдена.");
  requireCapability(me, (m) => canDeleteAnnotation(m, existing));

  const api = await createApiClient();
  const { error } = await api.DELETE("/api/annotations/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error as ApiError);
  revalidateEntity(Tags.ANNOTATIONS, id);
  revalidateEntity(Tags.ANNOTATIONS);
  return undefined;
});

/**
 * Admin-удаление публичной аннотации (DELETE /api/admin/annotations/{id}).
 * Капа annotation.delete_any + visibility === "public" (§6.2). Для private
 * бек вернёт 404 — UI кнопку для private не показывает.
 */
export const adminDeleteAnnotation = createAction(async (rawId: string) => {
  const me = await getMe();
  const { id } = AnnotationIdSchema.parse({ id: rawId });
  const existing = await getAnnotationById(id);
  if (!existing) throw new Error("Аннотация не найдена.");
  requireCapability(me, (m) => canAdminDeleteAnnotation(m, existing));

  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/annotations/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error as ApiError);
  revalidateEntity(Tags.ANNOTATIONS, id);
  revalidateEntity(Tags.ANNOTATIONS);
  return undefined;
});
```

- [ ] **Step 2: Проверить типы и линт**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. (Касты `as never` на `blocks`/`anchor` — повторяют паттерн events `actions.ts:85` `blocks: input.blocks as never`, т.к. `unknown[]` из Zod не совпадает с узким `ast.Block[]` schema.ts.)

- [ ] **Step 3: Commit**

```bash
git add src/features/annotations/actions.ts
git commit -m "feat(annotations): server actions (create per-entity §10.1; update/delete own; admin delete public-only)"
```

---

## Task 8: Карточка и список (`annotation-card.tsx`, `annotation-list.tsx`)

**Files:**
- Create: `src/features/annotations/ui/annotation-card.tsx`, `src/features/annotations/ui/annotation-list.tsx`

- [ ] **Step 1: Карточка аннотации**

Create `src/features/annotations/ui/annotation-card.tsx`:

```tsx
// src/features/annotations/ui/annotation-card.tsx
import { AstRender } from "@/components/ast-render";
import type { Annotation } from "../types";

interface Props {
  annotation: Annotation;
  /** Кнопки действий (edit/delete) — слот, заполняется server-компонентом-родителем. */
  actions?: React.ReactNode;
  /** Контекст якоря (цитата) — опциональный слот. */
  anchorContext?: React.ReactNode;
}

const visibilityLabel: Record<string, string> = {
  private: "приватная",
  public: "публичная",
};

/**
 * Server-компонент: рендерит одну аннотацию (AST-тело + мета). Доменно-чистый,
 * без client-JS. Действия и контекст якоря приходят слотами.
 */
export function AnnotationCard({ annotation, actions, anchorContext }: Props) {
  const updated = annotation.updated_at
    ? new Date(annotation.updated_at)
    : null;
  return (
    <article className="flex flex-col gap-2 rounded border border-(--color-border) p-3">
      <header className="flex items-center justify-between gap-2 text-xs text-(--color-description)">
        <span>
          {visibilityLabel[annotation.visibility ?? "private"] ?? "приватная"}
          {annotation.is_edited ? " · изменена" : ""}
        </span>
        {updated && <time>{updated.toLocaleDateString("ru-RU")}</time>}
      </header>
      {anchorContext}
      <div className="prose prose-sm">
        <AstRender blocks={annotation.blocks ?? []} />
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </article>
  );
}
```

- [ ] **Step 2: Список аннотаций**

Create `src/features/annotations/ui/annotation-list.tsx`:

```tsx
// src/features/annotations/ui/annotation-list.tsx
import type { Annotation } from "../types";
import { AnnotationCard } from "./annotation-card";

interface Props {
  annotations: Annotation[];
  /** Рендер действий для каждой аннотации (по id). */
  renderActions?: (annotation: Annotation) => React.ReactNode;
  emptyText?: string;
}

/** Server-компонент: список карточек аннотаций. */
export function AnnotationList({
  annotations,
  renderActions,
  emptyText = "Аннотаций пока нет.",
}: Props) {
  if (annotations.length === 0) {
    return <p className="text-sm text-(--color-description)">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {annotations.map((a) => (
        <li key={a.id}>
          <AnnotationCard
            annotation={a}
            actions={renderActions?.(a)}
          />
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Проверить типы и линт**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/annotations/ui/annotation-card.tsx src/features/annotations/ui/annotation-list.tsx
git commit -m "feat(annotations): annotation-card + annotation-list (server components, AstRender)"
```

---

## Task 9: Поле видимости + кнопка удаления + delete (client)

**Files:**
- Create: `src/features/annotations/ui/annotation-visibility-field.tsx`, `src/features/annotations/ui/annotation-delete-button.tsx`

- [ ] **Step 1: Поле выбора видимости (client)**

Create `src/features/annotations/ui/annotation-visibility-field.tsx`:

```tsx
"use client";
// src/features/annotations/ui/annotation-visibility-field.tsx
import { useState } from "react";

/**
 * Выбор видимости ПРИ создании. После создания видимость не меняется (§6.8) —
 * поэтому это поле есть только в create-форме, в edit-форме его нет.
 * Рендерит hidden-input name="visibility" для FormData.
 */
export function AnnotationVisibilityField() {
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  return (
    <fieldset className="flex flex-col gap-1 text-sm">
      <legend className="text-(--color-description)">Видимость</legend>
      <input type="hidden" name="visibility" value={visibility} />
      <label className="flex items-center gap-2">
        <input
          type="radio"
          name="visibility-radio"
          checked={visibility === "private"}
          onChange={() => setVisibility("private")}
        />
        Приватная (видна только мне)
      </label>
      <label className="flex items-center gap-2">
        <input
          type="radio"
          name="visibility-radio"
          checked={visibility === "public"}
          onChange={() => setVisibility("public")}
        />
        Публичная (видна всем, кто видит сущность)
      </label>
      <p className="text-xs text-(--color-description)">
        Видимость нельзя изменить после создания.
      </p>
    </fieldset>
  );
}
```

- [ ] **Step 2: Кнопка удаления (client, ConfirmDialog)**

Create `src/features/annotations/ui/annotation-delete-button.tsx`. API `ConfirmDialog` (`trigger`/`title`/`description`/`destructive`/`confirmLabel`/`onConfirm`) и ошибки через `useToast()` — точно как в `events/ui/event-delete-button.tsx`:

```tsx
"use client";
// src/features/annotations/ui/annotation-delete-button.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { deleteAnnotation, adminDeleteAnnotation } from "../actions";

interface Props {
  annotationId: string;
  /** true → admin-удаление (DELETE /api/admin/annotations/{id}); иначе own. */
  admin?: boolean;
}

/**
 * Кнопка удаления. ConfirmDialog не surface'ит ошибки onConfirm — ловим сами
 * (conventions §3.4) и показываем тостом. forbidden → branded-текст.
 * После успеха — router.refresh() (списки/секции перечитываются на сервере).
 */
export function AnnotationDeleteButton({ annotationId, admin = false }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">Удалить</Button>}
      title="Удалить аннотацию?"
      description="Действие необратимо."
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = admin
          ? await adminDeleteAnnotation(annotationId)
          : await deleteAnnotation(annotationId);
        if (!result.success) {
          toast.add(
            result.code === "forbidden"
              ? {
                  title: "Нет прав",
                  description: "У вас нет прав на удаление аннотации.",
                }
              : { title: "Ошибка", description: result.error },
          );
          return;
        }
        startTransition(() => router.refresh());
      }}
    />
  );
}
```

> Заметка исполнителю: `Button`, `ConfirmDialog`, `useToast` экспортируются из `@/components/ui` (подтверждено в index.ts). Проп `variant="danger"` и набор пропов `ConfirmDialog` (`description`/`destructive`/`confirmLabel`) — ровно как в `events/ui/event-delete-button.tsx`. `toast.add({ title, description })` — та же сигнатура.

- [ ] **Step 3: Проверить типы и линт**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/annotations/ui/annotation-visibility-field.tsx src/features/annotations/ui/annotation-delete-button.tsx
git commit -m "feat(annotations): visibility field (create-only, §6.8) + delete button (own/admin)"
```

---

## Task 10: Форма создания (`annotation-create-form.tsx`)

**Files:**
- Create: `src/features/annotations/ui/annotation-create-form.tsx`

- [ ] **Step 1: Реализация (client)**

Create `src/features/annotations/ui/annotation-create-form.tsx`:

```tsx
"use client";
// src/features/annotations/ui/annotation-create-form.tsx
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Form, FormField, SubmitButton } from "@/components/ui";
import { AstEditor } from "@/components/ast-editor";
import type { AstBlock } from "@/components/ast-editor";
import type { ActionResult } from "@/utils/create-action";
import { createAnnotation } from "../actions";
import type { Annotation, ParentEntityType } from "../types";
import { AnnotationVisibilityField } from "./annotation-visibility-field";

const initial: ActionResult<Annotation | null> = { success: true, data: null };

interface Props {
  parentEntityType: ParentEntityType;
  parentId: string;
}

/**
 * Форма создания аннотации. AST-тело (entityContext="annotation") + выбор
 * видимости (фиксируется навсегда). Должна быть смонтирована внутри
 * <SchemaContextProvider> родителем (AstEditor требует useSchema).
 * Якорь в MVP не задаётся из UI (текстовое выделение — отдельная фича); поле
 * anchor остаётся пустым → бек создаёт аннотацию без привязки.
 */
export function AnnotationCreateForm({ parentEntityType, parentId }: Props) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<AstBlock[]>([]);
  const [state, action] = useActionState(createAnnotation, initial);

  const fieldErrors: Record<string, string> =
    state.success === false && state.code === "validation"
      ? state.fieldErrors
      : {};

  useEffect(() => {
    if (state.success && state.data?.id) {
      // Перерисовать страницу со свежим списком.
      router.refresh();
    }
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-3">
      <input type="hidden" name="parent_entity_type" value={parentEntityType} />
      <input type="hidden" name="parent_entity_id" value={parentId} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />

      <FormField name="blocks" label="Текст аннотации">
        <AstEditor
          defaultValue={[]}
          entityContext="annotation"
          onChange={(next: AstBlock[]) => setBlocks(next)}
          ariaLabel="Текст аннотации"
        />
      </FormField>

      <AnnotationVisibilityField />

      {state.success === false && state.code === "forbidden" && (
        <p className="text-sm text-red-600">
          У вас нет прав на создание аннотации.
        </p>
      )}
      {state.success === false && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>Добавить аннотацию</SubmitButton>
      </div>
    </Form>
  );
}
```

- [ ] **Step 2: Проверить типы и линт**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. (`AstEditor` проп `ariaLabel` подтверждён в `AstEditorProps`.)

- [ ] **Step 3: Commit**

```bash
git add src/features/annotations/ui/annotation-create-form.tsx
git commit -m "feat(annotations): create form (AST body + visibility, mounts under SchemaContextProvider)"
```

---

## Task 11: Форма редактирования (`annotation-edit-form.tsx`)

**Files:**
- Create: `src/features/annotations/ui/annotation-edit-form.tsx`

- [ ] **Step 1: Реализация (client)**

Create `src/features/annotations/ui/annotation-edit-form.tsx`:

```tsx
"use client";
// src/features/annotations/ui/annotation-edit-form.tsx
import { useActionState, useState } from "react";
import { Form, FormField, SubmitButton } from "@/components/ui";
import { AstEditor } from "@/components/ast-editor";
import type { AstBlock } from "@/components/ast-editor";
import type { ActionResult } from "@/utils/create-action";
import { updateAnnotation } from "../actions";
import type { Annotation } from "../types";

const initial: ActionResult<Annotation | null> = { success: true, data: null };

interface Props {
  annotation: Annotation;
}

/**
 * Форма редактирования. Меняются только blocks (visibility иммутабельна —
 * её нет в форме, §6.8). Монтируется под <SchemaContextProvider>.
 */
export function AnnotationEditForm({ annotation }: Props) {
  const [blocks, setBlocks] = useState<AstBlock[]>(
    (annotation.blocks ?? []) as AstBlock[],
  );
  const [state, action] = useActionState(updateAnnotation, initial);

  const fieldErrors: Record<string, string> =
    state.success === false && state.code === "validation"
      ? state.fieldErrors
      : {};

  return (
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={annotation.id ?? ""} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />

      <FormField name="blocks" label="Текст аннотации">
        <AstEditor
          defaultValue={(annotation.blocks ?? []) as AstBlock[]}
          entityContext="annotation"
          onChange={(next: AstBlock[]) => setBlocks(next)}
          ariaLabel="Текст аннотации"
        />
      </FormField>

      {state.success && state.data && (
        <p className="text-sm text-(--color-description)">Сохранено.</p>
      )}
      {state.success === false && state.code === "forbidden" && (
        <p className="text-sm text-red-600">
          У вас нет прав на изменение аннотации.
        </p>
      )}
      {state.success === false && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </Form>
  );
}
```

- [ ] **Step 2: Проверить типы и линт**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/annotations/ui/annotation-edit-form.tsx
git commit -m "feat(annotations): edit form (blocks only; visibility immutable §6.8)"
```

---

## Task 12: Экспорт-ссылки + прокси-роут .md/.txt

**Files:**
- Create: `src/features/annotations/ui/annotation-export-links.tsx`, `src/app/annotations/[id]/export/route.ts`

Аннотации бывают private → их `.md/.txt` (`GET /api/annotations/{id}.md|.txt`, optional-auth) для автора требуют Bearer-токен, которого нет в браузерной ссылке. Поэтому **прокси** (паттерн events `export/route.ts`), а не прямые ссылки.

- [ ] **Step 1: Прокси-роут**

Create `src/app/annotations/[id]/export/route.ts`:

```ts
// src/app/annotations/[id]/export/route.ts
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

/**
 * Прокси .md/.txt выгрузок аннотации. Бек рендерит контент
 * (GET /api/annotations/{id}.md|.txt — optional-auth + shareTokenMW), но
 * private-аннотации требуют Bearer-токен, а браузерная ссылка его не несёт.
 * Роут подкладывает токен из httpOnly-cookie и возвращает ответ бека как есть
 * (включая 401/403/404). Паттерн — src/app/admin/events/[id]/export/route.ts.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const format =
    request.nextUrl.searchParams.get("format") === "txt" ? "txt" : "md";
  const token = (await cookies()).get("token")?.value;

  const upstream = await fetch(
    `${API_URL}/api/annotations/${encodeURIComponent(id)}.${format}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    },
  );

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") ?? "text/plain; charset=utf-8",
    },
  });
}
```

- [ ] **Step 2: Компонент ссылок**

Create `src/features/annotations/ui/annotation-export-links.tsx`:

```tsx
// src/features/annotations/ui/annotation-export-links.tsx
/**
 * Ссылки .md/.txt выгрузки аннотации через прокси-роут
 * /annotations/[id]/export (подкладывает токен — нужен для private).
 */
interface Props {
  id: string;
}

export function AnnotationExportLinks({ id }: Props) {
  return (
    <span className="flex items-center gap-2 text-xs">
      <a
        href={`/annotations/${id}/export?format=md`}
        className="hover:underline"
        target="_blank"
        rel="noopener"
      >
        .md
      </a>
      <a
        href={`/annotations/${id}/export?format=txt`}
        className="hover:underline"
        target="_blank"
        rel="noopener"
      >
        .txt
      </a>
    </span>
  );
}
```

- [ ] **Step 3: Проверить линт/типы/сборку роута**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/annotations/ui/annotation-export-links.tsx "src/app/annotations/[id]/export/route.ts"
git commit -m "feat(annotations): .md/.txt export links via token proxy route (private-safe)"
```

---

## Task 13: Контекст якоря (`annotation-anchor-context.tsx` + `getBlockContext`)

**Files:**
- Modify: `src/features/annotations/api.ts` (добавить `getBlockContext`)
- Create: `src/features/annotations/ui/annotation-anchor-context.tsx`

Если у аннотации есть text-якорь со `start_block_id`, показываем цитату/контекст. `GET /api/blocks/{block_id}` возвращает generic `httputil.Response` (data: unknown) — типизируем вручную и деградируем gracefully.

- [ ] **Step 1: Добавить fetcher в api.ts**

В `src/features/annotations/api.ts` добавить в конец:

```ts
/**
 * Контекст блока для резолва text-якоря. `GET /api/blocks/{block_id}` есть в
 * schema.ts (строка 4047), но data типизирован как unknown (§10, generic
 * httputil.Response) — ручной разбор. Возвращает блок или null (graceful).
 */
export const getBlockContext = cache(
  async (blockId: string): Promise<{ exact?: string } | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/blocks/{block_id}", {
      params: { path: { block_id: blockId } },
    });
    if (response.status === 404 || error) return null;
    const block = (data as { data?: unknown })?.data;
    if (!block || typeof block !== "object") return null;
    const text = (block as { text?: unknown }).text;
    return { exact: typeof text === "string" ? text : undefined };
  },
);
```

- [ ] **Step 2: Компонент контекста якоря (server)**

Create `src/features/annotations/ui/annotation-anchor-context.tsx`:

```tsx
// src/features/annotations/ui/annotation-anchor-context.tsx
import type { Anchor } from "../types";

interface Props {
  anchor?: Anchor;
}

/**
 * Показывает цитату из text-якоря (поле `exact` — W3C TextQuoteSelector,
 * сохранено самим беком в anchor). Для media-якоря — временной интервал.
 * Резолв блока через getBlockContext опционален и не нужен, пока exact есть
 * в самом anchor — показываем его напрямую (graceful). Без якоря — ничего.
 */
export function AnnotationAnchorContext({ anchor }: Props) {
  if (!anchor) return null;

  // Media-якорь.
  if (anchor.start_sec !== undefined) {
    const fmt = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${String(sec).padStart(2, "0")}`;
    };
    return (
      <p className="text-xs text-(--color-description)">
        ⏱ {fmt(anchor.start_sec)}
        {anchor.end_sec !== undefined ? `–${fmt(anchor.end_sec)}` : ""}
      </p>
    );
  }

  // Text-якорь — цитата.
  if (anchor.exact) {
    return (
      <blockquote className="border-l-2 border-(--color-border) pl-2 text-xs text-(--color-description)">
        «{anchor.prefix ?? ""}
        <mark>{anchor.exact}</mark>
        {anchor.suffix ?? ""}»
      </blockquote>
    );
  }

  return null;
}
```

- [ ] **Step 3: Проверить типы и линт**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/annotations/api.ts src/features/annotations/ui/annotation-anchor-context.tsx
git commit -m "feat(annotations): anchor context (exact quote / media timestamp); getBlockContext fetcher (§10)"
```

---

## Task 14: Композитор `AnnotationsSection` + ревизии

**Files:**
- Create: `src/features/annotations/ui/annotations-section.tsx`, `src/features/annotations/ui/annotation-revisions.tsx`

`AnnotationsSection` — единая точка интеграции в страницы сущностей (glossary в ветке; document/media/comment follow-up). Server component: фетчит список, рендерит список + (для авторизованного с capability) форму создания под `SchemaContextProvider`.

- [ ] **Step 1: Ревизии (как events)**

Create `src/features/annotations/ui/annotation-revisions.tsx`:

```tsx
// src/features/annotations/ui/annotation-revisions.tsx
import { AstRender } from "@/components/ast-render";
import { RevisionHistory } from "@/components/revision-history";
import { getAnnotationRevision, getAnnotationRevisions } from "../api";

interface Props {
  annotationId: string;
  /** id выбранной ревизии (?revision= из searchParams страницы). */
  selectedRevisionId?: string | undefined;
  /** База для buildHref (например /me/annotations/{id}). */
  basePath: string;
}

/**
 * Server-компонент ревизий аннотации. Бек отдаёт ASC (старые первыми) —
 * переворачиваем (паттерн events). Ревизии есть только у public-аннотаций
 * (бек снапшотит лишь public при Update) — для private список будет пуст.
 */
export async function AnnotationRevisions({
  annotationId,
  selectedRevisionId,
  basePath,
}: Props) {
  const metas = await getAnnotationRevisions(annotationId);
  const selected = selectedRevisionId
    ? await getAnnotationRevision(annotationId, selectedRevisionId)
    : null;

  return (
    <RevisionHistory
      revisions={[...metas]
        .reverse()
        .flatMap((m) =>
          m.id ? [{ id: m.id, createdAt: m.created_at ?? "" }] : [],
        )}
      selectedId={selected?.id}
      buildHref={(rid) => `${basePath}?revision=${rid}`}
    >
      {selected && (
        <div className="prose prose-sm">
          <AstRender blocks={selected.blocks ?? []} />
        </div>
      )}
    </RevisionHistory>
  );
}
```

- [ ] **Step 2: Композитор секции (server)**

Create `src/features/annotations/ui/annotations-section.tsx`:

```tsx
// src/features/annotations/ui/annotations-section.tsx
import { getMe } from "@/utils/me";
import { SchemaContextProvider } from "@/components/ast-editor";
import { getAnnotationsFor } from "../api";
import { canCreateAnnotation, canEditAnnotation } from "../permissions";
import type { ParentEntityType } from "../types";
import { AnnotationCard } from "./annotation-card";
import { AnnotationAnchorContext } from "./annotation-anchor-context";
import { AnnotationCreateForm } from "./annotation-create-form";
import { AnnotationDeleteButton } from "./annotation-delete-button";
import { AnnotationExportLinks } from "./annotation-export-links";

interface Props {
  parentEntityType: ParentEntityType;
  parentId: string;
}

/**
 * Единая секция аннотаций для страницы сущности. Server component:
 *  - фетчит видимые аннотации (бек применяет матрицу видимости);
 *  - рендерит карточки + действия (export/delete для автора);
 *  - под формой — SchemaContextProvider + AnnotationCreateForm (если есть
 *    capability annotation.create).
 *
 * Интегрируется в страницы document/glossary/media/comment одним JSX-узлом.
 */
export async function AnnotationsSection({ parentEntityType, parentId }: Props) {
  const me = await getMe();
  const { items } = await getAnnotationsFor(parentEntityType, parentId);
  const canCreate = canCreateAnnotation(me);

  return (
    <section className="flex flex-col gap-4" aria-label="Аннотации">
      <h2 className="text-lg font-semibold">Аннотации</h2>

      {items.length === 0 ? (
        <p className="text-sm text-(--color-description)">Аннотаций пока нет.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => {
            const ownEditable = canEditAnnotation(me, a);
            return (
              <li key={a.id}>
                <AnnotationCard
                  annotation={a}
                  anchorContext={<AnnotationAnchorContext anchor={a.anchor} />}
                  actions={
                    <>
                      {a.id && <AnnotationExportLinks id={a.id} />}
                      {ownEditable && a.id && (
                        <AnnotationDeleteButton annotationId={a.id} />
                      )}
                    </>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {canCreate && (
        <SchemaContextProvider fallback={<p className="text-sm">Загрузка редактора…</p>}>
          <AnnotationCreateForm
            parentEntityType={parentEntityType}
            parentId={parentId}
          />
        </SchemaContextProvider>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Проверить типы и линт**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/annotations/ui/annotations-section.tsx src/features/annotations/ui/annotation-revisions.tsx
git commit -m "feat(annotations): AnnotationsSection composer (list + create) + revisions (reverse, events-pattern)"
```

---

## Task 15: Страница «Мои аннотации» + агрегация лекции + admin-список

**Files:**
- Create: `src/features/annotations/ui/annotation-admin-row.tsx`, `annotation-admin-filter-form.tsx`, `annotation-pagination.tsx`
- Create: `src/app/me/annotations/page.tsx`, `src/app/lectures/[id]/annotations/page.tsx`, `src/app/admin/annotations/page.tsx`

- [ ] **Step 1: Локальная пагинация (client, паттерн audit)**

Create `src/features/annotations/ui/annotation-pagination.tsx`:

```tsx
"use client";
// src/features/annotations/ui/annotation-pagination.tsx
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface Props {
  offset: number;
  limit: number;
  total: number;
}

const linkCls =
  "rounded border border-(--color-border) px-3 py-1 hover:bg-(--color-text-pane)";
const disabledCls =
  "rounded border border-(--color-border) px-3 py-1 opacity-40";

/** Пагинация, сохраняющая прочие searchParams (паттерн audit-pagination). */
export function AnnotationPagination({ offset, limit, total }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function makeHref(nextOffset: number): string {
    const params = new URLSearchParams(searchParams.toString());
    if (nextOffset > 0) params.set("offset", String(nextOffset));
    else params.delete("offset");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <nav aria-label="Пагинация" className="flex items-center gap-2 text-sm">
      {hasPrev ? (
        <Link href={makeHref(Math.max(0, offset - limit))} className={linkCls}>
          ← Назад
        </Link>
      ) : (
        <span className={disabledCls}>← Назад</span>
      )}
      <span className="text-(--color-description)">
        {total === 0
          ? "0 из 0"
          : `${offset + 1}–${Math.min(offset + limit, total)} из ${total}`}
      </span>
      {hasNext ? (
        <Link href={makeHref(offset + limit)} className={linkCls}>
          Вперёд →
        </Link>
      ) : (
        <span className={disabledCls}>Вперёд →</span>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: Admin-строка**

Create `src/features/annotations/ui/annotation-admin-row.tsx`:

```tsx
// src/features/annotations/ui/annotation-admin-row.tsx
import { AstRender } from "@/components/ast-render";
import type { Annotation } from "../types";
import { AnnotationDeleteButton } from "./annotation-delete-button";

interface Props {
  annotation: Annotation;
  /** Можно ли админски удалить (delete_any ∧ public) — вычислено на сервере. */
  canAdminDelete: boolean;
}

/** Строка admin-списка публичных аннотаций. */
export function AnnotationAdminRow({ annotation, canAdminDelete }: Props) {
  return (
    <article className="flex flex-col gap-2 rounded border border-(--color-border) p-3">
      <header className="flex items-center justify-between gap-2 text-xs text-(--color-description)">
        <span>
          {annotation.parent_entity_type} · {annotation.parent_entity_id}
        </span>
        <span>автор: {annotation.owner_id}</span>
      </header>
      <div className="prose prose-sm">
        <AstRender blocks={annotation.blocks ?? []} />
      </div>
      {canAdminDelete && annotation.id && (
        <div>
          <AnnotationDeleteButton annotationId={annotation.id} admin />
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 3: Admin-фильтр (client)**

Create `src/features/annotations/ui/annotation-admin-filter-form.tsx`:

```tsx
"use client";
// src/features/annotations/ui/annotation-admin-filter-form.tsx
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const PARENT_TYPES = ["document", "glossary", "media", "comment"] as const;

/**
 * Фильтр admin-списка аннотаций по типу родительской сущности. Обновляет URL
 * (server-side фильтрация, conventions §3.5). Сбрасывает offset при смене.
 */
export function AnnotationAdminFilterForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("parent_entity_type") ?? "";

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("parent_entity_type", value);
    else params.delete("parent_entity_type");
    params.delete("offset");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      Тип сущности:
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-(--color-border) px-2 py-1"
      >
        <option value="">Все</option>
        {PARENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 4: Страница «Мои аннотации»**

Create `src/app/me/annotations/page.tsx`:

```tsx
// src/app/me/annotations/page.tsx
import { redirect } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  getMyAnnotations,
  AnnotationCard,
  AnnotationAnchorContext,
  AnnotationExportLinks,
  AnnotationDeleteButton,
  AnnotationPagination,
} from "@/features/annotations";

export const metadata = { title: "Мои аннотации" };

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

const LIMIT = 20;

export default async function MyAnnotationsPage({ searchParams }: Props) {
  const me = await getMe();
  if (!me) redirect("/login");

  const { offset: rawOffset } = await searchParams;
  const offset = Math.max(0, Number(rawOffset ?? 0) || 0);
  const { items, total } = await getMyAnnotations(offset, LIMIT);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Мои аннотации</h1>
      {items.length === 0 ? (
        <p className="text-sm text-(--color-description)">
          У вас пока нет аннотаций.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => (
            <li key={a.id}>
              <AnnotationCard
                annotation={a}
                anchorContext={<AnnotationAnchorContext anchor={a.anchor} />}
                actions={
                  <>
                    {a.id && <AnnotationExportLinks id={a.id} />}
                    {a.id && <AnnotationDeleteButton annotationId={a.id} />}
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}
      <AnnotationPagination offset={offset} limit={LIMIT} total={total} />
    </main>
  );
}
```

> Заметка исполнителю: проверьте, существует ли роут `/login` (как редирект для гостя). Если нет — посмотрите, как другие authed-страницы (например `/settings`) обрабатывают гостя, и повторите (возможно `redirect("/")` или `unauthorized()` из next/navigation).

- [ ] **Step 5: Страница агрегации аннотаций лекции (отдельная, НЕ трогаем page.tsx)**

Create `src/app/lectures/[id]/annotations/page.tsx`:

```tsx
// src/app/lectures/[id]/annotations/page.tsx
import {
  getLectureAnnotations,
  AnnotationCard,
  AnnotationAnchorContext,
  AnnotationExportLinks,
  AnnotationPagination,
} from "@/features/annotations";

export const metadata = { title: "Аннотации лекции" };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ offset?: string }>;
}

const LIMIT = 20;

/**
 * Агрегированный ПРОСМОТР аннотаций лекции (document/comment/media). На саму
 * лекцию аннотация не создаётся — только просмотр. Отдельная страница, чтобы
 * не трогать src/app/lectures/[id]/page.tsx (резервирует comments).
 */
export default async function LectureAnnotationsPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const { offset: rawOffset } = await searchParams;
  const offset = Math.max(0, Number(rawOffset ?? 0) || 0);
  const { items, total } = await getLectureAnnotations(id, offset, LIMIT);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Аннотации лекции</h1>
      {items.length === 0 ? (
        <p className="text-sm text-(--color-description)">
          К материалам этой лекции пока нет аннотаций.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => (
            <li key={a.id}>
              <AnnotationCard
                annotation={a}
                anchorContext={<AnnotationAnchorContext anchor={a.anchor} />}
                actions={a.id && <AnnotationExportLinks id={a.id} />}
              />
            </li>
          ))}
        </ul>
      )}
      <AnnotationPagination offset={offset} limit={LIMIT} total={total} />
    </main>
  );
}
```

- [ ] **Step 6: Admin-страница (Layer-3 гейт)**

Create `src/app/admin/annotations/page.tsx`:

```tsx
// src/app/admin/annotations/page.tsx
import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  getAdminAnnotations,
  canModerateAnnotations,
  canAdminDeleteAnnotation,
  AnnotationAdminRow,
  AnnotationAdminFilterForm,
  AnnotationPagination,
} from "@/features/annotations";

export const metadata = { title: "Аннотации — модерация" };

interface Props {
  searchParams: Promise<{
    parent_entity_type?: string;
    offset?: string;
  }>;
}

const LIMIT = 20;

export default async function AdminAnnotationsPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canModerateAnnotations(me)) forbidden();

  const sp = await searchParams;
  const offset = Math.max(0, Number(sp.offset ?? 0) || 0);
  const { items, total } = await getAdminAnnotations({
    offset,
    limit: LIMIT,
    ...(sp.parent_entity_type
      ? { parent_entity_type: sp.parent_entity_type }
      : {}),
  });

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Аннотации (публичные)</h1>
      <p className="text-sm text-(--color-description)">
        Видны только публичные аннотации. Удаление доступно для публичных
        (приватные модерации недоступны).
      </p>
      <AnnotationAdminFilterForm />
      {items.length === 0 ? (
        <p className="text-sm text-(--color-description)">Ничего не найдено.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => (
            <li key={a.id}>
              <AnnotationAdminRow
                annotation={a}
                canAdminDelete={canAdminDeleteAnnotation(me, a)}
              />
            </li>
          ))}
        </ul>
      )}
      <AnnotationPagination offset={offset} limit={LIMIT} total={total} />
    </section>
  );
}
```

- [ ] **Step 7: Проверить типы и линт**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. (Все импорты из `@/features/annotations` появятся в index.ts в Task 16 — этот шаг может временно падать на разрешении импортов; если так, выполняйте Task 16 перед финальной проверкой.)

- [ ] **Step 8: Commit**

```bash
git add src/features/annotations/ui/annotation-admin-row.tsx src/features/annotations/ui/annotation-admin-filter-form.tsx src/features/annotations/ui/annotation-pagination.tsx "src/app/me/annotations/page.tsx" "src/app/lectures/[id]/annotations/page.tsx" "src/app/admin/annotations/page.tsx"
git commit -m "feat(annotations): pages (my / lecture-aggregate / admin moderation) + admin row/filter/pagination"
```

---

## Task 16: Public API (`index.ts`) + интеграция в страницу глоссария

**Files:**
- Create/Modify: `src/features/annotations/index.ts`
- Modify: `src/app/glossary/[id]/page.tsx`

- [ ] **Step 1: Заполнить index.ts**

Полностью заменить `src/features/annotations/index.ts`:

```ts
// src/features/annotations/index.ts
export {
  getAnnotationsFor,
  getAnnotationById,
  getMyAnnotations,
  getLectureAnnotations,
  getAdminAnnotations,
  getAnnotationRevisions,
  getAnnotationRevision,
  getBlockContext,
} from "./api";
export {
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  adminDeleteAnnotation,
} from "./actions";
export {
  canCreateAnnotation,
  canEditAnnotation,
  canDeleteAnnotation,
  canAdminDeleteAnnotation,
  canModerateAnnotations,
} from "./permissions";
export {
  buildTextAnchor,
  buildMediaAnchor,
  isValidTextAnchor,
  isValidMediaAnchor,
} from "./anchor";
export { AnnotationsSection } from "./ui/annotations-section";
export { AnnotationCard } from "./ui/annotation-card";
export { AnnotationList } from "./ui/annotation-list";
export { AnnotationCreateForm } from "./ui/annotation-create-form";
export { AnnotationEditForm } from "./ui/annotation-edit-form";
export { AnnotationDeleteButton } from "./ui/annotation-delete-button";
export { AnnotationVisibilityField } from "./ui/annotation-visibility-field";
export { AnnotationExportLinks } from "./ui/annotation-export-links";
export { AnnotationRevisions } from "./ui/annotation-revisions";
export { AnnotationAnchorContext } from "./ui/annotation-anchor-context";
export { AnnotationAdminRow } from "./ui/annotation-admin-row";
export { AnnotationAdminFilterForm } from "./ui/annotation-admin-filter-form";
export { AnnotationPagination } from "./ui/annotation-pagination";
export type {
  Annotation,
  AnnotationVisibility,
  Anchor,
  ParentEntityType,
  AnnotationListResult,
} from "./types";
```

- [ ] **Step 2: Интегрировать секцию в страницу глоссария**

В `src/app/glossary/[id]/page.tsx` добавить импорт и JSX-узел. Изменить import-блок и `return`:

```tsx
import { notFound } from "next/navigation";
import {
  getTermById,
  GlossaryDetail,
  GlossaryExportLinks,
} from "@/features/glossary";
import { AnnotationsSection } from "@/features/annotations";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GlossaryTermPage({ params }: Props) {
  const { id } = await params;
  const term = await getTermById(id);
  if (!term) notFound();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <GlossaryDetail term={term} />
      {term.id && <GlossaryExportLinks termId={term.id} />}
      {term.id && (
        <AnnotationsSection parentEntityType="glossary" parentId={term.id} />
      )}
    </main>
  );
}
```

(`generateMetadata` остаётся без изменений.)

- [ ] **Step 3: Проверить весь слайс**

Run: `npm run lint && npm test && npm run build`
Expected: PASS (все тесты слайса зелёные; сборка проходит; ESLint-гарды изоляции не сработали — `AnnotationsSection` импортится через `@/features/annotations`, не deep-import).

- [ ] **Step 4: Commit**

```bash
git add src/features/annotations/index.ts "src/app/glossary/[id]/page.tsx"
git commit -m "feat(annotations): public index + integrate AnnotationsSection into glossary page"
```

---

## Task 17 (follow-up, ПОСЛЕ мержа `documents`): интеграция в страницу документа

> Выполнять ТОЛЬКО когда `src/app/documents/[id]/page.tsx` присутствует в `main` (ветка documents смержена). Это отдельный коммит на ветке annotations (или follow-up-PR). НЕ блокирует мерж основного слайса.

**Files:**
- Modify: `src/app/documents/[id]/page.tsx`

- [ ] **Step 1: Проверить наличие страницы**

Run: `ls src/app/documents/[id]/page.tsx`
Expected: файл существует. Если нет — задача откладывается.

- [ ] **Step 2: Прочитать страницу и добавить секцию**

Прочитать `src/app/documents/[id]/page.tsx`, найти точку после рендера тела документа, добавить импорт и узел:

```tsx
import { AnnotationsSection } from "@/features/annotations";
// …внутри return, после основного контента документа, где `doc.id` доступен:
{doc.id && (
  <AnnotationsSection parentEntityType="document" parentId={doc.id} />
)}
```

(Имя переменной документа — взять из существующего кода страницы; здесь `doc` — плейсхолдер под фактическую переменную.)

- [ ] **Step 3: Проверка и commit**

```bash
npm run lint && npm run build
git add "src/app/documents/[id]/page.tsx"
git commit -m "feat(annotations): integrate AnnotationsSection into document page (follow-up after documents merge)"
```

---

## Task 18 (follow-up / условно в ветке): интеграция в страницу медиа

> Если `src/app/media/[id]/page.tsx` присутствует к старту ветки — выполнить в ветке. Иначе — follow-up после мержа `media`. Медиа использует media-якорь (по времени), но в MVP UI создаёт аннотацию без явного якоря (как glossary) — секция переиспользуется как есть.

**Files:**
- Modify: `src/app/media/[id]/page.tsx`

- [ ] **Step 1: Проверить наличие**

Run: `ls src/app/media/[id]/page.tsx`
Expected: существует → интегрируем; нет → откладываем.

- [ ] **Step 2: Добавить секцию**

```tsx
import { AnnotationsSection } from "@/features/annotations";
// …после рендера медиа, где доступен `media.id`:
{media.id && (
  <AnnotationsSection parentEntityType="media" parentId={media.id} />
)}
```

- [ ] **Step 3: Проверка и commit**

```bash
npm run lint && npm run build
git add "src/app/media/[id]/page.tsx"
git commit -m "feat(annotations): integrate AnnotationsSection into media page"
```

---

## Task 19 (follow-up, ПОСЛЕ мержа `comments`): аннотации на комментариях

> Comments резервирует `src/app/lectures/[id]/page.tsx` и владеет рендером дерева комментариев. Точка монтирования аннотаций под комментарием — slot-проп, который предоставит comments-компонент (договорённость между ветками на уровне менеджера). Поддержка `comment` как parent-типа уже заложена в api/actions/типах этой ветки.

**Files:** определяются после мержа comments (точка монтирования внутри comments-UI или отдельный disclosure под комментарием).

- [ ] **Step 1:** Согласовать с владельцем `comments` slot-проп (например `<Comment renderAnnotations={(commentId) => <AnnotationsSection parentEntityType="comment" parentId={commentId} />} />`).
- [ ] **Step 2:** Реализовать монтирование, проверить `npm run lint && npm run build`, commit.

(Конкретный код зависит от API comments-компонента — фиксируется на этапе follow-up; основной слайс annotations от этого не зависит.)

---

## Финальная проверка слайса (перед мержем основной ветки — БЕЗ follow-up Task 17-19)

- [ ] **Step 1: Чеклист `_template/README.md`**
  - [ ] `index.ts` экспортирует только нужное снаружи.
  - [ ] `api.ts`, `actions.ts`, `permissions.ts`, `schemas.ts` начинаются с `import "server-only";` (anchor.ts — pure, без server-only, тестируется в jsdom).
  - [ ] Каждая `canXxx` покрыта тестом (5 функций — Task 3).
  - [ ] Каждая Zod-схема: success + failure (Task 5).
  - [ ] Используются `createFormAction`/`createAction` + `parseFormData` + `requireCapability` + `revalidateEntity`.
  - [ ] Нет импортов других `@/features/*`.
  - [ ] `ui/.gitkeep` удалён, реальные UI-файлы добавлены.

- [ ] **Step 2: Полный прогон**

Run: `npm run lint && npm test && npm run build`
Expected: всё зелёное.

- [ ] **Step 3: Self-check бизнес-правил**
  - [ ] Visibility выбирается только в create-форме, в edit-форме отсутствует (§6.8). ✓ Task 10/11.
  - [ ] Admin-удаление показывается только для public (`canAdminDeleteAnnotation`). ✓ Task 3/15.
  - [ ] forbidden → branded-текст «У вас нет прав на …». ✓ Task 9/10/11.
  - [ ] Создание зовёт пер-сущностный POST (§10.1), список — пер-сущностный GET (§10.2). ✓ Task 6/7.
  - [ ] `annotation.create` — локальный чек (frozen union). ✓ Task 3.
  - [ ] `/admin/annotations` nav-пункт уже есть (annotation.delete_any) — layout не трогали. ✓.

- [ ] **Step 4: Code-review-субагент** по диффу ветки (skill requesting-code-review) — bug/нарушение-конвенций фиксируются до мержа.

---

## Self-review (проверка плана против спеки)

**1. Покрытие скоупа фичи (спека §3 волна 2, строка `annotations`):**

| Требование спеки | Task |
| --- | --- |
| Создание на document/glossary/media/comment (пер-сущностный POST, §10.1) | 6, 7 |
| Выбор видимости при создании, потом не меняется (§6.8) | 9, 10, 11 |
| Просмотр на страницах document/glossary/media (пер-сущностный GET, §10.2) | 6, 14, 16, 17, 18 |
| Агрегированный просмотр на странице лекции (только просмотр) | 6, 15 |
| Редактирование своих (blocks, is_edited) | 7, 11 |
| Удаление (owner / admin delete_any только public §6.2) | 3, 7, 9, 15 |
| /me/annotations | 6, 15 |
| Ревизии (revision-history, reverse) | 6, 14 |
| admin /admin/annotations (public + delete_any) | 6, 15 |
| .md/.txt (прокси для private) | 12 |
| anchor: структура start_block_id и т.п., контекст | 4, 13 |
| Интеграция glossary (в ветке) | 16 |
| Интеграция document/media/comment (follow-up) | 17, 18, 19 |
| Лекция отдельной страницей без касания comments-файла | 15 |
| Sidebar-пункт annotation.delete_any (touch не нужен) | подтверждено, не трогаем |
| Уроки волны 1 (uppercase-коды, exactOptionalPropertyTypes, branded 403, server-only, локальная пагинация) | 5, 6, 7, 9, 15 |

**2. Placeholder-скан:** в плане нет «TBD/TODO/как-нибудь»; весь код приведён. Плейсхолдер `doc`/`media` в Task 17/18 — явно помечен как «фактическая переменная страницы» (страницы создаёт чужая ветка, точное имя неизвестно до мержа — это корректно для follow-up).

**3. Консистентность типов/имён:** `getAnnotationsFor` (api) ↔ используется в `AnnotationsSection` (Task 14) и actions (`PER_ENTITY_PATH` — идентичная мапа в api.ts и actions.ts, дублирование осознанное: cross-file внутри слайса допустимо, но если ESLint потребует — вынести в types.ts константой). `Tags.ANNOTATIONS` (Task 1) ↔ `revalidateEntity(Tags.ANNOTATIONS, …)` (Task 7). `canCreateAnnotation/canEditAnnotation/canDeleteAnnotation/canAdminDeleteAnnotation/canModerateAnnotations` — единые имена в permissions/tests/UI/pages. `AnnotationListResult` — единый тип результата во всех fetcher'ах.

**4. Замечание по дублированию `PER_ENTITY_PATH`:** мапа объявлена в `api.ts` и `actions.ts`. Если ревьюер/линт отметит — вынести в `types.ts` как `export const PER_ENTITY_PATH` и импортировать в обоих. Оставлено локально для читаемости; не критично.

---

## Риски

1. **§10.1/§10.2 — ручные fetch вместо openapi-fetch:** пер-сущностные POST/GET обходят типизацию openapi-fetch. Митигейшен: тело POST — валидный тип `annotation.CreateRequest`; ответ list типизирован вручную (`AnnotationListResponse`) по образцу лекционного списка; комментарии-ссылки на §10 в коде. Если бек изменит форму ответа — наш ручной тип разойдётся молча (нет compile-time гарантии). Покрытие — рантайм-гварды (`?? []`, `?? 0`).
2. **`annotation.create` не в union `Capability`:** локальный `me.capabilities.includes("annotation.create")`. Если foundation позже добавит капу в union — заменить на `can(me, "annotation.create")` (одна строка). Риск рассинхрона минимален: строковый литерал совпадает с беком.
3. **Якорь из UI не задаётся (MVP):** create-форма не строит anchor (нет текстового выделения). Аннотации создаются без привязки. `anchor.ts` и контекст-компонент готовы к якорям, приходящим с бэка (например созданным в будущем выделением). Риск: пользователь не может «привязать» заметку к фрагменту в этой итерации — это сознательное MVP-упрощение, согласуется со спекой («anchor: изучи структуру… при наличии резолва покажи контекст»).
4. **Ревизии только у public-аннотаций:** бек снапшотит revision лишь при public-Update. Для private список ревизий всегда пуст — UI покажет «Ревизий пока нет». Не баг, отражает бек.
5. **Follow-up зависимости (documents/media/comments):** основной слайс самодостаточен и мержится без них; интеграции 17-19 — отдельные коммиты после мержа соответствующих веток. Если порядок мержей волны изменится — follow-up'ы просто откладываются, слайс не ломается.
6. **`SchemaContextProvider` — client-загрузка схемы:** create/edit-формы требуют AST-схему (fetch `/api/ast/schema`). На странице сущности это добавляет client-fetch; fallback показывает «Загрузка редактора…». Гость/без-капы форму не видит — провайдер не монтируется.
7. **Дублирование `PER_ENTITY_PATH`** (см. self-review п.4) — мелкий долг, легко устраняется.
8. **`/login` редирект в `/me/annotations`** — зависит от наличия роута; исполнитель сверяет с другими authed-страницами (заметка в Task 15).
