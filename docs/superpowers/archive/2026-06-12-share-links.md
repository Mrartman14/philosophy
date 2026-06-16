# Share-links — план реализации

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ САБ-СКИЛЛ: используй superpowers:subagent-driven-development (рекомендуется) или superpowers:executing-plans для пошагового исполнения. Шаги размечены чекбоксами (`- [x]`).

**Goal:** Дать пользователям возможность выпускать токенизированные ссылки на приватные ресурсы (lecture / document / trail / media / form), управлять ими (список+revoke), а держателям ссылок — открывать приватный ресурс через `?token=`; админам — модерировать чужие ссылки.

**Architecture:** Новый слайс `src/features/share-links/` по канону `_template` (api / actions / permissions / schemas / types / ui). Share-кнопка — клиентский компонент слайса, встраивается в detail-страницы document/media/form/lecture/trail. Consumption-flow (viewer): detail-страница читает `?token=` из своих `searchParams` и прокидывает в свой fetcher как опциональный query-параметр — это требует **обратно совместимых точечных правок чужих api.ts** (документы/медиа/лекции/формы/трейлы), которые делает ТОЛЬКО эта ветка (мержится последней в волне 3, конфликтов нет). Управление ссылками — per-resource (бек не отдаёт глобального списка «все мои ссылки»), поэтому страницы `/share-links` и `/admin/share-links` — инструменты поиска по `resource_type`+`resource_id`.

**Tech Stack:** Next 16 App Router (server components + server actions), openapi-fetch (`createApiClient`), Zod через `parseFormData`, Base UI (`Dialog`, `Button`, `useToast` из `@/components/ui`), vitest + jsdom, RBAC (`can` / `requireCapability` / доменные хелперы).

---

## 0. Контекст из бекенда (источник истины — `/Users/alexander.borisenko/Documents/philosophy-api`)

Прочитано и зафиксировано Plan-агентом. Исполнителю перечитывать не обязательно — всё нужное ниже.

**Эндпоинты (cmd/server/main.go:1208-1214):**
- `POST /api/share-links` — `requiredAuth`, тело `sharelink.CreateRequest` `{ resource_type, resource_id, expires_at? }`, ответ 201 `{ data: ShareLink }`.
- `GET /api/share-links?resource_type=&resource_id=` — `requiredAuth`, **оба query обязательны**, ответ `{ data: ShareLink[] }`. Гейт сервиса (service.go:154-174): только владелец ресурса **или** `share_link.moderate`. Чужому/несуществующему → **404** (secure-by-default).
- `DELETE /api/share-links/{token}` — `requiredAuth`, ответ 204. Гейт (service.go:111-151): создатель ссылки **или** `share_link.moderate`. Чужой токен без капы → 404. Повторный revoke — no-op (idempotent).
- `GET /api/admin/share-links?resource_type=&resource_id=` — `requiredAuth` + `requireCap(share_link.moderate)`, **оба query обязательны**, ответ `{ data: ShareLink[] }` (без ownership-чека).
- `DELETE /api/admin/share-links/{token}` — `requiredAuth` + `requireCap(share_link.moderate)`, 204. (Хендлер вызывает тот же `service.Revoke`.)

**Бизнес-правила Create (service.go:41-96):**
- `resource_type` должен быть валиден (`lecture|document|trail|media|form|canvas`), иначе **422** validation.
- Ресурс должен существовать и принадлежать актору (`ownerID == actor.UserID`), иначе **404** (`apperror.NotFound("resource")` — НЕ 403!). То есть «создать ссылку может только владелец», и отказ маскируется под 404.
- Ресурс должен быть `visibility == "private"`, иначе **422** `RESOURCE_NOT_PRIVATE` («share links can only be created for private resources»).
- `expires_at` (если задан) должен быть в будущем, иначе **422** validation.
- Капа на создание НЕ требуется — чистый ownership-чек (service.go не зовёт `HasCapability` в Create).

**Каскад (service.go:188-198):** при смене видимости/удалении ресурса бек сам ревокает/удаляет ссылки (`RevokeByResource`/`DeleteByResource`). Фронту делать нечего — но после собственного revoke надо ревалидировать.

**ResourceType (model.go):** `lecture|document|trail|media|form|canvas`. **canvas вне скоупа волны** (§4 спеки) — в UI создания НЕ предлагаем, но в типах слайса оставляем полный union (бек так отдаёт; admin-модерация может встретить canvas-ссылку).

**Capability:** `share_link.moderate` (rbac/capabilities.go:52). **ВАЖНО:** этой капы НЕТ в union `Capability` (`src/utils/permissions.ts`) — файл заморожен (foundation-зона). Поэтому в `permissions.ts` слайса делаем локальный чек по `me.capabilities.includes("share_link.moderate")` с комментарием-ссылкой; добавление в union — пункт foundation-touch (§ниже, НЕ в ветке).

**Viewer-роуты (shareTokenMW в main.go) — точный список GET, принимающих `?token=`:**
- `GET /api/lectures/{id}` (910), `/api/lectures/{id}/documents` (916), `/api/lectures/{id}/media` (936)
- `GET /api/documents/{document_id}` (929), `GET /api/blocks/{block_id}` (935)
- `GET /api/media/{media_id}` (944)
- `GET /api/forms/{id}` (961), `POST /api/forms/{id}/submissions` (964)
- `GET /api/trails/{id}` (1198)
- `GET /api/canvases/{id}` (+revisions) (978-980) — вне скоупа
- annotations list (1085, 1090, 1095), document/annotation revisions (1263-1266), attachments list (1129-1131)

**Семантика токена (integration_test.go):** токен открывает РОВНО тот ресурс, на который выпущен. Lecture-токен открывает лекцию и её **публичные** документы/медиа, но НЕ приватные вложенные. Значит для каждой detail-страницы прокидываем токен в её собственный fetcher; «наследование» периметра — забота бека, фронт просто шлёт `?token=` на GET.

**Что НЕ так в spec/schema.ts (§10.5):** schema.ts не объявляет `?token=` ни на одном из перечисленных GET. Это ожидаемо (swagger не размечает middleware-параметры). Фронт добавляет `token` в `params.query` вручную; openapi-fetch на лишний query не ругается рантайм-ошибкой, но TS-типы query у этих путей — `never`/узкие. Решение по типам — см. Task 7 (cast через `as never` на query-объект, по образцу `preferences/actions.ts` где PATCH-body кастуется из-за расхождения schema.ts).

---

## 1. File Structure

**Новый слайс `src/features/share-links/`:**
- `types.ts` — сужения из `@/api/schema`: `ShareLink`, `ResourceType`. Список `SHARE_RESOURCE_TYPES` (для UI создания: без canvas) и `ALL_RESOURCE_TYPES` (с canvas, для admin/lookup-валидации).
- `schemas.ts` — Zod: `ShareLinkCreateSchema` (FormData create), `ShareLinkLookupSchema` (resource_type+resource_id для страниц-инструментов), `RevokeTokenSchema`.
- `permissions.ts` — `canCreateShareLink(me, resource)` (ownership + private), `canModerateShareLinks(me)` (локальный чек `share_link.moderate`), `canManageOwnLinks(me)` (любой active).
- `api.ts` — fetchers: `getShareLinksFor(resourceType, resourceId)` (GET /api/share-links), `getAdminShareLinksFor(resourceType, resourceId)` (GET /api/admin/share-links).
- `actions.ts` — `createShareLink` (createFormAction), `revokeShareLink` (createAction), `adminRevokeShareLink` (createAction).
- `share-url.ts` — чистая утилита `buildShareUrl(resourceType, resourceId, token)` → абсолютный URL detail-страницы с `?token=` (client-safe, читает `NEXT_PUBLIC_BASE_URL`/`NEXT_PUBLIC_BASE_PATH`).
- `index.ts` — public API.
- `ui/share-button.tsx` — клиентский компонент: триггер + Dialog (создать ссылку, показать URL, копировать, список существующих, revoke).
- `ui/share-link-list.tsx` — клиентский список ссылок ресурса с revoke (переиспользуется в dialog и на страницах).
- `ui/share-lookup-form.tsx` — клиентская форма поиска по resource_type+resource_id (для `/share-links` и `/admin/share-links`).
- `ui/copy-button.tsx` — клиентская кнопка «копировать» (navigator.clipboard + toast).
- `permissions.test.ts`, `schemas.test.ts`, `share-url.test.ts`.

**Новые страницы (app/):**
- `src/app/share-links/page.tsx` — «Мои ссылки»: lookup-инструмент (resource_type+resource_id → список своих ссылок + revoke). Authed.
- `src/app/admin/share-links/page.tsx` — admin-модерация: lookup-инструмент (то же, но через admin-эндпоинт + admin-revoke). Layer-3 гейт `share_link.moderate`.

**Точечные обратно совместимые правки чужих api.ts (делает ТОЛЬКО эта ветка — см. §«Интеграция кнопки и viewer»):**
- `src/features/documents/api.ts` — `getDocumentById(id, token?)`.
- `src/features/media/api.ts` — `getMediaById(id, token?)`.
- `src/features/lectures/api.ts` — `getLectureById(id, token?)`.
- `src/features/forms/api.ts` — fetcher одиночной формы + опциональный `token?` (имя fetcher уточнить при исполнении — слайс `forms` смержен раньше).
- `src/features/trails/api.ts` — fetcher одиночного трейла + опциональный `token?`.

**Точечные правки detail-страниц (встраивание кнопки + чтение token):**
- `src/app/documents/[id]/page.tsx`, `src/app/media/[id]/page.tsx`, `src/app/lectures/[id]/page.tsx`, `src/app/forms/[id]/page.tsx`, `src/app/trails/[id]/page.tsx`.

**Реестр тегов:**
- `src/api/tags.ts` — добавить `SHARE_LINKS: "share-links"` (append-only, алфавитный порядок: между `PREFERENCES` и `TAGS`).

---

## 2. Parallel-safety contract

**Ветка `share-links` мержится ПОСЛЕДНЕЙ в волне 3** (после forms/trails/search/lecture-enrichment). На момент мержа все целевые detail-страницы и api.ts слайсов document/media/lecture/form/trail уже существуют в `main`. Конфликтов с параллельными ветками нет — но контракт фиксируем строго.

**CREATE (только эта ветка создаёт):**
```
src/features/share-links/types.ts
src/features/share-links/schemas.ts
src/features/share-links/permissions.ts
src/features/share-links/api.ts
src/features/share-links/actions.ts
src/features/share-links/share-url.ts
src/features/share-links/index.ts
src/features/share-links/ui/share-button.tsx
src/features/share-links/ui/share-link-list.tsx
src/features/share-links/ui/share-lookup-form.tsx
src/features/share-links/ui/copy-button.tsx
src/features/share-links/permissions.test.ts
src/features/share-links/schemas.test.ts
src/features/share-links/share-url.test.ts
src/app/share-links/page.tsx
src/app/admin/share-links/page.tsx
```

**MODIFY (эта ветка — единственный модификатор в волне для этих файлов; правки точечные, обратно совместимые):**
```
src/api/tags.ts                       # append-only: + SHARE_LINKS
src/features/documents/api.ts         # getDocumentById: + опц. token?
src/features/media/api.ts             # getMediaById: + опц. token?
src/features/lectures/api.ts          # getLectureById: + опц. token?
src/features/forms/api.ts             # одиночный-form fetcher: + опц. token?
src/features/trails/api.ts            # одиночный-trail fetcher: + опц. token?
src/app/documents/[id]/page.tsx       # читать ?token=, прокинуть в fetcher; вставить ShareButton
src/app/media/[id]/page.tsx           # ditto
src/app/lectures/[id]/page.tsx        # ditto
src/app/forms/[id]/page.tsx           # ditto
src/app/trails/[id]/page.tsx          # ditto
```

**RESERVE (НЕ трогаем — foundation-touch, отдельный PR после мержа фич волны):**
```
src/utils/permissions.ts              # + "share_link.moderate" в union Capability
src/app/admin/admin-sidebar.tsx       # пункт «Ссылки» (share_link.moderate)
src/app/admin/layout.tsx
src/app/layout.tsx                    # header «Мои ссылки» (опц.)
```

**Правила для каждого исполнителя и его субагентов (передавать дословно):**
- НИКАКИХ `git stash` / `git reset` / `git checkout .` / `git clean`.
- `git add` — ТОЛЬКО свои файлы по имени; НЕ `git add -A` / `git add .`.
- НЕ откатывать и не перезаписывать чужие изменения.
- Передавать эти правила всем создаваемым субагентам.

---

## 3. Интеграция кнопки и viewer — СТРАТЕГИЯ (ключевое решение)

### 3.1. Управление ссылками — per-resource (НЕ глобальный список)

Бек НЕ предоставляет «список всех моих ссылок». `GET /api/share-links` требует `resource_type`+`resource_id` и возвращает ссылки одного ресурса. Поэтому:
- **Основной UX** — inline в `ShareButton` на detail-странице: открыл диалог → видишь существующие ссылки ресурса + кнопку «создать новую» + revoke у каждой.
- **Страница `/share-links`** («Мои ссылки») — инструмент: выбираешь тип ресурса + вставляешь его ID → получаешь список своих ссылок этого ресурса + revoke. (Не «лента всех ссылок» — её на беке нет; зафиксировано в рисках.)
- **Страница `/admin/share-links`** — тот же инструмент, но через admin-эндпоинт (видит чужие ссылки) + admin-revoke. Layer-3 гейт `share_link.moderate`.

### 3.2. Viewer / consumption (`?token=`) — выбранная стратегия

**Решение: «страница читает `?token=` и прокидывает в свой fetcher».** Отдельный viewer-роут НЕ создаём (дублировал бы рендер каждой detail-страницы и логику аннотаций/комментов). Минимально-инвазивный путь:

1. Detail-страница добавляет `token?: string` в свой `searchParams`-тип, читает его.
2. Прокидывает `token` в свой fetcher: `getDocumentById(id, token)`.
3. Fetcher получает **опциональный** `token?: string` и, если задан, кладёт его в `params.query.token` запроса к беку. Без токена поведение байт-в-байт прежнее (обратная совместимость).
4. Бек (shareTokenMW) валидирует токен и открывает приватный ресурс держателю.

**Почему правки чужих api.ts неизбежны и безопасны:** fetcher — единственное место, где формируется запрос к GET-роуту с shareTokenMW. Добавить `?token=` иначе нельзя (клиент серверный, токен приходит из URL страницы). Правки строго аддитивны (новый опциональный параметр, новая ветка query), мерж последним => без конфликтов. Каждая правка покрыта в Task 7-11 полным кодом.

**Граница token-проброса:** прокидываем токен ТОЛЬКО в основной fetcher ресурса страницы (document/media/lecture/form/trail). Дочерние секции (annotations, comments, attachments, revisions, lecture→documents/media) в этой ветке token-aware НЕ делаем — это раздуло бы скоуп и затронуло бы ещё больше чужих слайсов. Держатель ссылки видит сам ресурс; приватные дочерние сущности останутся скрыты (что согласуется с семантикой бека: токен открывает ровно свой ресурс). Зафиксировано в рисках как осознанное ограничение MVP.

**Формы — submit по токену:** `POST /api/forms/{id}/submissions` тоже под shareTokenMW (бек позволяет держателю отправить отклик в приватную форму). Это зона слайса `forms` (его actions). В ЭТОЙ ветке мы доводим только GET-форму по токену (просмотр). Submit-by-token — если слайс forms его уже поддерживает, не трогаем; если нет — это его доработка, НЕ share-links (зафиксировано в рисках, чтобы не лезть в чужие actions).

---

## 4. Foundation-touch (НЕ в этой ветке — отдельный PR после мержа фич волны 3)

Перечислено для менеджера, исполнитель share-links это НЕ делает:
1. `src/utils/permissions.ts` — добавить `| "share_link.moderate"` в union `Capability` (алфавитно). После этого `permissions.ts` слайса можно упростить с локального `includes` на `can(me, "share_link.moderate")` — но это тоже foundation-follow-up, в ветке оставляем локальный чек.
2. `src/app/admin/admin-sidebar.tsx` — пункт «Ссылки» → `/admin/share-links`, gated на `share_link.moderate`.
3. `src/app/layout.tsx` (header) — опциональный пункт «Мои ссылки» → `/share-links` для authed.

---

## Task 1: Скелет слайса + types.ts

**Files:**
- Create: `src/features/share-links/types.ts`

- [x] **Step 1: Скопировать шаблон слайса**

```bash
cp -r src/features/_template src/features/share-links
rm -f src/features/share-links/ui/.gitkeep
git add src/features/share-links
git commit -m "chore(share-links): scaffold slice from _template"
```

- [x] **Step 2: Написать types.ts**

Заменить содержимое `src/features/share-links/types.ts`:

```ts
// src/features/share-links/types.ts
import type { components } from "@/api/schema";

/** Модель share-ссылки: GET/POST /api/share-links → data[]. */
export type ShareLink = components["schemas"]["sharelink.ShareLink"];

/** Тип ресурса, поддерживаемый бекендом (model.go: ResourceType). */
export type ResourceType = components["schemas"]["sharelink.ResourceType"];

/**
 * Типы ресурсов, для которых фронт ПРЕДЛАГАЕТ создать ссылку.
 * canvas исключён: фича canvas вне скоупа (spec §4). Бек принял бы canvas,
 * но UI его не показывает.
 */
export const SHARE_RESOURCE_TYPES = [
  "lecture",
  "document",
  "trail",
  "media",
  "form",
] as const satisfies readonly ResourceType[];

/**
 * Все типы, которые может вернуть бек (включая canvas) — для валидации
 * lookup-форм и admin-модерации, где может встретиться canvas-ссылка.
 */
export const ALL_RESOURCE_TYPES = [
  "lecture",
  "document",
  "trail",
  "media",
  "form",
  "canvas",
] as const satisfies readonly ResourceType[];

/** Человекочитаемые подписи типов ресурсов (ru) для UI. */
export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  lecture: "Лекция",
  document: "Документ",
  trail: "Трейл",
  media: "Медиа",
  form: "Форма",
  canvas: "Канвас",
};
```

- [x] **Step 3: Проверить компиляцию типов**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "share-links/types" || echo "OK: no type errors in types.ts"`
Expected: `OK: no type errors in types.ts`

- [x] **Step 4: Commit**

```bash
git add src/features/share-links/types.ts
git commit -m "feat(share-links): types — ShareLink, ResourceType, resource-type lists"
```

---

## Task 2: schemas.ts + тесты

**Files:**
- Create: `src/features/share-links/schemas.ts`
- Test: `src/features/share-links/schemas.test.ts`

- [x] **Step 1: Написать failing-тест schemas.test.ts**

Заменить содержимое `src/features/share-links/schemas.test.ts`:

```ts
// src/features/share-links/schemas.test.ts
import { describe, expect, it } from "vitest";
import {
  ShareLinkCreateSchema,
  ShareLinkLookupSchema,
  RevokeTokenSchema,
} from "./schemas";

describe("ShareLinkCreateSchema", () => {
  it("принимает валидный create без expires_at", () => {
    const r = ShareLinkCreateSchema.safeParse({
      resource_type: "document",
      resource_id: "doc-1",
    });
    expect(r.success).toBe(true);
  });

  it("принимает валидный create с будущим expires_at и нормализует в ISO", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
    const r = ShareLinkCreateSchema.safeParse({
      resource_type: "lecture",
      resource_id: "lec-1",
      expires_at: future,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.expires_at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    }
  });

  it("отклоняет неизвестный resource_type", () => {
    const r = ShareLinkCreateSchema.safeParse({
      resource_type: "banner",
      resource_id: "b-1",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет canvas в create (вне скоупа фронта)", () => {
    const r = ShareLinkCreateSchema.safeParse({
      resource_type: "canvas",
      resource_id: "c-1",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет пустой resource_id", () => {
    const r = ShareLinkCreateSchema.safeParse({
      resource_type: "media",
      resource_id: "",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет некорректную дату expires_at", () => {
    const r = ShareLinkCreateSchema.safeParse({
      resource_type: "form",
      resource_id: "f-1",
      expires_at: "не-дата",
    });
    expect(r.success).toBe(false);
  });
});

describe("ShareLinkLookupSchema", () => {
  it("принимает любой backend-тип, включая canvas", () => {
    expect(
      ShareLinkLookupSchema.safeParse({
        resource_type: "canvas",
        resource_id: "c-1",
      }).success,
    ).toBe(true);
  });

  it("отклоняет мусорный resource_type", () => {
    expect(
      ShareLinkLookupSchema.safeParse({
        resource_type: "xxx",
        resource_id: "id",
      }).success,
    ).toBe(false);
  });

  it("отклоняет пустой resource_id", () => {
    expect(
      ShareLinkLookupSchema.safeParse({
        resource_type: "document",
        resource_id: "   ",
      }).success,
    ).toBe(false);
  });
});

describe("RevokeTokenSchema", () => {
  it("принимает непустой токен", () => {
    expect(RevokeTokenSchema.safeParse({ token: "abc123" }).success).toBe(true);
  });

  it("отклоняет пустой токен", () => {
    expect(RevokeTokenSchema.safeParse({ token: "" }).success).toBe(false);
  });
});
```

- [x] **Step 2: Запустить тест — убедиться, что падает**

Run: `npm test -- src/features/share-links/schemas.test.ts`
Expected: FAIL — `Cannot find module './schemas'` (или resolve-ошибка).

- [x] **Step 3: Написать schemas.ts**

Заменить содержимое `src/features/share-links/schemas.ts`:

```ts
// src/features/share-links/schemas.ts
import "server-only";
import { z } from "zod";
import { SHARE_RESOURCE_TYPES, ALL_RESOURCE_TYPES } from "./types";

/**
 * Дата из <input type="datetime-local"> ("2026-06-13T13:45") или полный ISO.
 * Нормализуется в RFC3339 UTC (как ждёт POST /api/share-links). Проверку
 * «в будущем» делает бек (422); здесь — только формат, иначе UX-двойная
 * валидация рассинхронится с серверной TZ.
 */
const ExpiresAtSchema = z.string().transform((s, ctx) => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Некорректная дата" });
    return z.NEVER;
  }
  return d.toISOString();
});

/**
 * Создание ссылки из FormData. resource_type ограничен SHARE_RESOURCE_TYPES
 * (без canvas — фронт его не предлагает). expires_at опционален; пустая
 * строка из формы трактуется как «без срока».
 */
export const ShareLinkCreateSchema = z.object({
  resource_type: z.enum(SHARE_RESOURCE_TYPES),
  resource_id: z.string().trim().min(1, "Укажите ID ресурса").max(200),
  expires_at: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v : undefined))
    .pipe(ExpiresAtSchema.optional()),
});

export type ShareLinkCreateInput = z.infer<typeof ShareLinkCreateSchema>;

/**
 * Поиск ссылок по ресурсу (страницы /share-links и /admin/share-links).
 * Допускает все backend-типы, включая canvas (admin может встретить
 * canvas-ссылку). Используется и для парсинга searchParams: битый тип → fail,
 * страница покажет пустую форму.
 */
export const ShareLinkLookupSchema = z.object({
  resource_type: z.enum(ALL_RESOURCE_TYPES),
  resource_id: z.string().trim().min(1).max(200),
});

export type ShareLinkLookupInput = z.infer<typeof ShareLinkLookupSchema>;

/** Revoke по токену. */
export const RevokeTokenSchema = z.object({
  token: z.string().trim().min(1, "Токен обязателен"),
});

export type RevokeTokenInput = z.infer<typeof RevokeTokenSchema>;
```

- [x] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npm test -- src/features/share-links/schemas.test.ts`
Expected: PASS (все describe-блоки зелёные).

- [x] **Step 5: Commit**

```bash
git add src/features/share-links/schemas.ts src/features/share-links/schemas.test.ts
git commit -m "feat(share-links): Zod schemas (create/lookup/revoke) + tests"
```

---

## Task 3: permissions.ts + тесты

**Files:**
- Create: `src/features/share-links/permissions.ts`
- Test: `src/features/share-links/permissions.test.ts`

- [x] **Step 1: Написать failing-тест permissions.test.ts**

Заменить содержимое `src/features/share-links/permissions.test.ts`:

```ts
// src/features/share-links/permissions.test.ts
import { describe, expect, it } from "vitest";
import type { Me } from "@/utils/me";
import {
  canCreateShareLink,
  canModerateShareLinks,
  canManageOwnLinks,
} from "./permissions";

const owner: Me = {
  id: "u-owner",
  username: "owner",
  role: "user",
  status: "active",
  capabilities: ["share_link.moderate"], // намеренно: проверяем, что create НЕ зависит от капы
};

const stranger: Me = {
  id: "u-stranger",
  username: "stranger",
  role: "user",
  status: "active",
  capabilities: [],
};

const moderator: Me = {
  id: "u-mod",
  username: "mod",
  role: "admin",
  status: "active",
  capabilities: ["share_link.moderate"],
};

const suspended: Me = {
  id: "u-owner",
  username: "owner",
  role: "user",
  status: "suspended",
  capabilities: ["share_link.moderate"],
};

const privateResource = { owner_id: "u-owner", visibility: "private" as const };
const publicResource = { owner_id: "u-owner", visibility: "public" as const };

describe("canCreateShareLink", () => {
  it("гость → false", () => {
    expect(canCreateShareLink(null, privateResource)).toBe(false);
  });

  it("владелец приватного ресурса → true", () => {
    expect(canCreateShareLink(owner, privateResource)).toBe(true);
  });

  it("не-владелец → false (даже с capability)", () => {
    expect(canCreateShareLink(moderator, privateResource)).toBe(false);
  });

  it("владелец публичного ресурса → false (RESOURCE_NOT_PRIVATE)", () => {
    expect(canCreateShareLink(owner, publicResource)).toBe(false);
  });

  it("suspended-владелец → false", () => {
    expect(canCreateShareLink(suspended, privateResource)).toBe(false);
  });

  it("ресурс без owner_id → false", () => {
    expect(canCreateShareLink(owner, { visibility: "private" })).toBe(false);
  });
});

describe("canModerateShareLinks", () => {
  it("гость → false", () => {
    expect(canModerateShareLinks(null)).toBe(false);
  });

  it("active с share_link.moderate → true", () => {
    expect(canModerateShareLinks(moderator)).toBe(true);
  });

  it("active без капы → false", () => {
    expect(canModerateShareLinks(stranger)).toBe(false);
  });

  it("suspended с капой → false", () => {
    expect(canModerateShareLinks(suspended)).toBe(false);
  });
});

describe("canManageOwnLinks", () => {
  it("гость → false", () => {
    expect(canManageOwnLinks(null)).toBe(false);
  });

  it("любой active → true", () => {
    expect(canManageOwnLinks(stranger)).toBe(true);
  });

  it("suspended → false", () => {
    expect(canManageOwnLinks(suspended)).toBe(false);
  });
});
```

- [x] **Step 2: Запустить тест — убедиться, что падает**

Run: `npm test -- src/features/share-links/permissions.test.ts`
Expected: FAIL — `Cannot find module './permissions'` (или экспорты не найдены).

- [x] **Step 3: Написать permissions.ts**

Заменить содержимое `src/features/share-links/permissions.ts`:

```ts
// src/features/share-links/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { isMutationAllowed } from "@/utils/permissions";

/**
 * Минимальная форма ресурса для проверки права создать ссылку.
 * owner_id и visibility приходят в payload lecture/document/media/trail/form.
 */
export interface ShareableResource {
  owner_id?: string;
  visibility?: string;
}

/**
 * Создать ссылку может ТОЛЬКО владелец ПРИВАТНОГО ресурса.
 *
 * Сверено с philosophy-api internal/sharelink/service.go:41-96:
 * - capability НЕ требуется (Create не зовёт HasCapability);
 * - ownerID == actor.UserID, иначе бек вернёт 404 (NotFound("resource"));
 * - visibility == "private", иначе 422 RESOURCE_NOT_PRIVATE.
 * isMutationAllowed покрывает гостя и suspended/banned (status !== active).
 */
export function canCreateShareLink(
  me: MaybeMe,
  resource: ShareableResource,
): boolean {
  if (!isMutationAllowed(me)) return false;
  if (!resource.owner_id || resource.owner_id !== me.id) return false;
  return resource.visibility === "private";
}

/**
 * Модерация чужих ссылок (admin-страница, admin-revoke).
 *
 * Капа "share_link.moderate" (philosophy-api rbac/capabilities.go:52) НЕ входит
 * в union Capability (src/utils/permissions.ts заморожен — foundation-зона),
 * поэтому проверяем членство в capabilities напрямую. После foundation-touch,
 * добавляющего капу в union, этот хелпер можно заменить на can(me, ...).
 */
export function canModerateShareLinks(me: MaybeMe): boolean {
  if (!isMutationAllowed(me)) return false;
  return me.capabilities.includes("share_link.moderate");
}

/**
 * Управлять своими ссылками (список + revoke) может любой залогиненный
 * active-пользователь. Owner-чек самих ссылок делает бек (404 на чужие).
 */
export function canManageOwnLinks(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}
```

- [x] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npm test -- src/features/share-links/permissions.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/features/share-links/permissions.ts src/features/share-links/permissions.test.ts
git commit -m "feat(share-links): permissions (create/moderate/manage-own) + tests"
```

---

## Task 4: share-url.ts (чистая утилита) + тесты

**Files:**
- Create: `src/features/share-links/share-url.ts`
- Test: `src/features/share-links/share-url.test.ts`

Заметка: `NEXT_PUBLIC_BASE_URL` = `http://localhost:3000` (dev) / `https://mrartman14.github.io/philosophy` (prod), `NEXT_PUBLIC_BASE_PATH` = `""` (dev) / `/philosophy` (prod). Чтобы избежать двойного `/philosophy`, базу строим из `NEXT_PUBLIC_BASE_URL` (он уже содержит base-path в prod), а `NEXT_PUBLIC_BASE_PATH` не добавляем повторно. Это покрыто тестом.

- [x] **Step 1: Написать failing-тест share-url.test.ts**

Заменить содержимое `src/features/share-links/share-url.test.ts`:

```ts
// src/features/share-links/share-url.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildShareUrl } from "./share-url";

const ORIG = process.env.NEXT_PUBLIC_BASE_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_BASE_URL = ORIG;
});

describe("buildShareUrl", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://example.test/app";
  });

  it("строит URL документа с токеном", () => {
    expect(buildShareUrl("document", "doc-1", "tok-abc")).toBe(
      "https://example.test/app/documents/doc-1?token=tok-abc",
    );
  });

  it("строит URL лекции", () => {
    expect(buildShareUrl("lecture", "lec-9", "t")).toBe(
      "https://example.test/app/lectures/lec-9?token=t",
    );
  });

  it("строит URL медиа / трейла / формы по своим сегментам", () => {
    expect(buildShareUrl("media", "m1", "t")).toContain("/media/m1?token=t");
    expect(buildShareUrl("trail", "tr1", "t")).toContain("/trails/tr1?token=t");
    expect(buildShareUrl("form", "f1", "t")).toContain("/forms/f1?token=t");
  });

  it("экранирует токен и id", () => {
    expect(buildShareUrl("document", "a b", "x/y")).toBe(
      "https://example.test/app/documents/a%20b?token=x%2Fy",
    );
  });

  it("не дублирует base, если NEXT_PUBLIC_BASE_URL с завершающим слешем", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://example.test/app/";
    expect(buildShareUrl("document", "d", "t")).toBe(
      "https://example.test/app/documents/d?token=t",
    );
  });

  it("падает с понятной ошибкой на canvas (вне скоупа фронта)", () => {
    expect(() => buildShareUrl("canvas", "c1", "t")).toThrow(/canvas/i);
  });
});
```

- [x] **Step 2: Запустить тест — убедиться, что падает**

Run: `npm test -- src/features/share-links/share-url.test.ts`
Expected: FAIL — `Cannot find module './share-url'`.

- [x] **Step 3: Написать share-url.ts**

Создать `src/features/share-links/share-url.ts`:

```ts
// src/features/share-links/share-url.ts
// БЕЗ "server-only": используется в client-компоненте share-button.
import type { ResourceType } from "./types";

/**
 * Сегмент detail-страницы для каждого типа ресурса. canvas сюда не входит:
 * canvas-страниц на фронте нет (фича вне скоупа). Ключи — пути app-роутера.
 */
const RESOURCE_PATH_SEGMENT: Record<
  Exclude<ResourceType, "canvas">,
  string
> = {
  lecture: "lectures",
  document: "documents",
  trail: "trails",
  media: "media",
  form: "forms",
};

/**
 * Абсолютный URL detail-страницы ресурса с ?token=. База — из
 * NEXT_PUBLIC_BASE_URL (он уже содержит base-path в prod, напр.
 * https://mrartman14.github.io/philosophy — поэтому NEXT_PUBLIC_BASE_PATH
 * повторно НЕ добавляем). Завершающий слеш базы нормализуется.
 *
 * Бросает на canvas — для него detail-страницы и share-URL не существует.
 */
export function buildShareUrl(
  resourceType: ResourceType,
  resourceId: string,
  token: string,
): string {
  if (resourceType === "canvas") {
    throw new Error("buildShareUrl: canvas не поддерживается фронтендом");
  }
  const segment = RESOURCE_PATH_SEGMENT[resourceType];
  const rawBase =
    process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const base = rawBase.replace(/\/+$/, "");
  const path = `/${segment}/${encodeURIComponent(resourceId)}`;
  const query = `?token=${encodeURIComponent(token)}`;
  return `${base}${path}${query}`;
}
```

- [x] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npm test -- src/features/share-links/share-url.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/features/share-links/share-url.ts src/features/share-links/share-url.test.ts
git commit -m "feat(share-links): buildShareUrl util + tests"
```

---

## Task 5: api.ts (fetchers)

**Files:**
- Modify: `src/api/tags.ts` (append `SHARE_LINKS`)
- Create: `src/features/share-links/api.ts`

- [x] **Step 1: Добавить тег в реестр**

В `src/api/tags.ts`, в объекте `Tags`, между строкой `PREFERENCES: "preferences",` и `TAGS: "tags",` вставить:

```ts
  SHARE_LINKS: "share-links",
```

Итоговый фрагмент:
```ts
  PREFERENCES: "preferences",
  SHARE_LINKS: "share-links",
  TAGS: "tags",
```

- [x] **Step 2: Написать api.ts**

Заменить содержимое `src/features/share-links/api.ts`:

```ts
// src/features/share-links/api.ts
import "server-only";
import { cache } from "react";
import { createApiClient } from "@/api/client";
import type { ShareLink, ResourceType } from "./types";

/**
 * Ссылки одного ресурса (владелец или share_link.moderate).
 * GET /api/share-links?resource_type=&resource_id= — оба query обязательны.
 * Бек на чужой/несуществующий ресурс отдаёт 404 → возвращаем [] (страница
 * показывает «нет ссылок», не падает).
 *
 * НЕ оборачиваем в unstable_cache: данные пер-юзерные и редко читаются;
 * React.cache дедуплицирует в рамках одного запроса.
 */
export const getShareLinksFor = cache(
  async (
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<ShareLink[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/share-links", {
      params: {
        query: { resource_type: resourceType, resource_id: resourceId },
      },
    });
    if (response.status === 404) return [];
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить ссылки");
    }
    return (data?.data ?? []) as ShareLink[];
  },
);

/**
 * Admin-вариант: ссылки любого ресурса без ownership-чека.
 * GET /api/admin/share-links?resource_type=&resource_id= (требует
 * share_link.moderate; гейт — на странице через Layer-3 forbidden()).
 */
export const getAdminShareLinksFor = cache(
  async (
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<ShareLink[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET(
      "/api/admin/share-links",
      {
        params: {
          query: { resource_type: resourceType, resource_id: resourceId },
        },
      },
    );
    if (response.status === 404) return [];
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить ссылки");
    }
    return (data?.data ?? []) as ShareLink[];
  },
);
```

- [x] **Step 3: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "share-links/api" || echo "OK"`
Expected: `OK`

- [x] **Step 4: Commit**

```bash
git add src/api/tags.ts src/features/share-links/api.ts
git commit -m "feat(share-links): fetchers getShareLinksFor / getAdminShareLinksFor + SHARE_LINKS tag"
```

---

## Task 6: actions.ts (create / revoke / admin-revoke)

**Files:**
- Create: `src/features/share-links/actions.ts`

- [x] **Step 1: Написать actions.ts**

Заменить содержимое `src/features/share-links/actions.ts`:

```ts
// src/features/share-links/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { createAction, createFormAction, parseFormData } from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";
import { Tags } from "@/api/tags";
import { canManageOwnLinks, canModerateShareLinks } from "./permissions";
import { ShareLinkCreateSchema, RevokeTokenSchema } from "./schemas";
import type { ShareLink } from "./types";

type ApiError = { code?: string; error?: string };

/** Маппинг кодов apperror бекенда на доменные ошибки фронта. */
function rethrowApiError(err: ApiError | undefined): never {
  switch (err?.code) {
    case "FORBIDDEN":
      throw new ForbiddenError("role", err.error);
    case "SUSPENDED":
      throw new ForbiddenError("status", err.error);
    case "NOT_FOUND":
      // Создать ссылку может только владелец; бек маскирует отказ под 404.
      throw new Error("Ресурс не найден или вы не его владелец.");
    case "RESOURCE_NOT_PRIVATE":
      throw new Error("Ссылку можно создать только для приватного ресурса.");
    case "VALIDATION_ERROR":
      throw new Error(err.error ?? "Сервер отклонил данные.");
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}

/**
 * Создать share-ссылку. Гейт ownership делает бек (404 на чужой/публичный),
 * фронт лишь проверяет «вообще может мутировать» (active). FormData:
 * resource_type, resource_id, expires_at?.
 */
export const createShareLink = createFormAction(async (formData) => {
  const me = await getMe();
  // Defense-in-depth: создание — только для active. Реальный ownership-гейт
  // на беке (canCreateShareLink в UI решает, показывать ли кнопку).
  if (!canManageOwnLinks(me)) {
    throw new ForbiddenError(me ? "status" : "guest");
  }
  const input = parseFormData(ShareLinkCreateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/share-links", {
    body: {
      resource_type: input.resource_type,
      resource_id: input.resource_id,
      ...(input.expires_at !== undefined ? { expires_at: input.expires_at } : {}),
    },
  });
  if (error) rethrowApiError(error as ApiError);
  revalidateEntity(Tags.SHARE_LINKS, input.resource_id);
  return (data?.data ?? null) as ShareLink | null;
});

/**
 * Revoke собственной ссылки (создатель). Бек idempotent: повторный revoke —
 * no-op 204. resourceId передаётся отдельно только для ревалидации.
 */
export const revokeShareLink = createAction(
  async (input: { token: string; resourceId: string }): Promise<true> => {
    const me = await getMe();
    if (!canManageOwnLinks(me)) {
      throw new ForbiddenError(me ? "status" : "guest");
    }
    const { token } = RevokeTokenSchema.parse({ token: input.token });
    const api = await createApiClient();
    const { error } = await api.DELETE("/api/share-links/{token}", {
      params: { path: { token } },
    });
    if (error) rethrowApiError(error as ApiError);
    revalidateEntity(Tags.SHARE_LINKS, input.resourceId);
    return true;
  },
);

/**
 * Admin-revoke чужой ссылки (требует share_link.moderate).
 * DELETE /api/admin/share-links/{token}.
 */
export const adminRevokeShareLink = createAction(
  async (input: { token: string; resourceId: string }): Promise<true> => {
    const me = await getMe();
    if (!canModerateShareLinks(me)) {
      throw new ForbiddenError(me ? "role" : "guest");
    }
    const { token } = RevokeTokenSchema.parse({ token: input.token });
    const api = await createApiClient();
    const { error } = await api.DELETE("/api/admin/share-links/{token}", {
      params: { path: { token } },
    });
    if (error) rethrowApiError(error as ApiError);
    revalidateEntity(Tags.SHARE_LINKS, input.resourceId);
    return true;
  },
);
```

- [x] **Step 2: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "share-links/actions" || echo "OK"`
Expected: `OK`

Если TS ругается на `params.path.token` или body-поля — сверить с `src/api/schema.ts` пути `/api/share-links/{token}` и `/api/admin/share-links/{token}` (они задокументированы, path-param `token` есть; см. §0).

- [x] **Step 3: Commit**

```bash
git add src/features/share-links/actions.ts
git commit -m "feat(share-links): server actions create/revoke/adminRevoke"
```

---

## Task 7: ui/copy-button.tsx (клиент)

**Files:**
- Create: `src/features/share-links/ui/copy-button.tsx`

- [x] **Step 1: Написать copy-button.tsx**

Создать `src/features/share-links/ui/copy-button.tsx`:

```tsx
"use client";
// src/features/share-links/ui/copy-button.tsx
import { useState } from "react";
import { Button, useToast } from "@/components/ui";

interface Props {
  value: string;
  label?: string;
}

/**
 * Кнопка «копировать» с фолбэком: navigator.clipboard может быть недоступен
 * (http без localhost, старый браузер) — тогда показываем toast с просьбой
 * скопировать вручную, не роняя UI.
 */
export function CopyButton({ value, label = "Копировать" }: Props) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      if (!navigator.clipboard) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.add({ title: "Скопировано" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.add({
        title: "Не удалось скопировать",
        description: "Выделите ссылку и скопируйте вручную.",
      });
    }
  }

  return (
    <Button type="button" variant="ghost" onClick={onCopy}>
      {copied ? "Скопировано ✓" : label}
    </Button>
  );
}
```

- [x] **Step 2: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "copy-button" || echo "OK"`
Expected: `OK`

Заметка: если `Button` не принимает `variant="ghost"` — проверить тип `ButtonProps` в `src/components/ui/button.tsx` и подставить существующий вариант (audit-filter-form использует `variant="ghost"`, значит вариант есть).

- [x] **Step 3: Commit**

```bash
git add src/features/share-links/ui/copy-button.tsx
git commit -m "feat(share-links): CopyButton with clipboard fallback"
```

---

## Task 8: ui/share-link-list.tsx (клиент, список + revoke)

**Files:**
- Create: `src/features/share-links/ui/share-link-list.tsx`

Заметка: компонент клиентский (нужны `onClick`-revoke и `useTransition`). Получает данные пропами из server-компонентов; action и флаг admin прокидываются пропами, чтобы один список работал и для своих ссылок, и для admin-модерации.

- [x] **Step 1: Написать share-link-list.tsx**

Создать `src/features/share-links/ui/share-link-list.tsx`:

```tsx
"use client";
// src/features/share-links/ui/share-link-list.tsx
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, Table, Tbody, Td, Th, Thead, Tr, useToast } from "@/components/ui";
import { revokeShareLink, adminRevokeShareLink } from "../actions";
import { buildShareUrl } from "../share-url";
import { CopyButton } from "./copy-button";
import type { ShareLink, ResourceType } from "../types";

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
});

function fmt(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFormat.format(d);
}

function statusLabel(link: ShareLink): string {
  if (link.revoked_at) return "Отозвана";
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return "Истекла";
  }
  return "Активна";
}

interface Props {
  links: ShareLink[];
  resourceType: ResourceType;
  resourceId: string;
  /** true → admin-revoke (DELETE /api/admin/...); иначе owner-revoke. */
  admin?: boolean;
  /** Показывать ли копируемый URL (для своих ссылок — да; admin URL не нужен). */
  showUrl?: boolean;
}

export function ShareLinkList({
  links,
  resourceType,
  resourceId,
  admin = false,
  showUrl = true,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function onRevoke(token: string) {
    startTransition(async () => {
      const action = admin ? adminRevokeShareLink : revokeShareLink;
      const result = await action({ token, resourceId });
      if (result.success) {
        toast.add({ title: "Ссылка отозвана" });
        router.refresh();
      } else {
        const msg =
          result.code === "forbidden"
            ? "У вас нет прав на отзыв ссылки."
            : result.error;
        toast.add({ title: "Ошибка", description: msg });
      }
    });
  }

  if (links.length === 0) {
    return <EmptyState title="Ссылок нет" description="Для этого ресурса ещё не выпущено ни одной ссылки." />;
  }

  // canvas-ссылки в admin-модерации: URL построить нельзя (нет страницы) —
  // показываем токен без копируемого URL.
  const canBuildUrl = showUrl && resourceType !== "canvas";

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Статус</Th>
          {canBuildUrl && <Th>Ссылка</Th>}
          <Th>Токен</Th>
          <Th>Создана</Th>
          <Th>Истекает</Th>
          <Th>Действие</Th>
        </Tr>
      </Thead>
      <Tbody>
        {links.map((link) => {
          const token = link.token ?? "";
          const revoked = Boolean(link.revoked_at);
          const url = canBuildUrl && token ? buildShareUrl(resourceType, resourceId, token) : null;
          return (
            <Tr key={token}>
              <Td>{statusLabel(link)}</Td>
              {canBuildUrl && (
                <Td>
                  {url && !revoked ? (
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={url}
                        className="w-64 rounded border border-(--color-border) bg-(--color-text-pane) px-2 py-1 text-xs"
                        aria-label="URL ссылки"
                      />
                      <CopyButton value={url} />
                    </div>
                  ) : (
                    "—"
                  )}
                </Td>
              )}
              <Td>
                <code className="text-xs" title={token}>
                  {token ? `${token.slice(0, 12)}…` : "—"}
                </code>
              </Td>
              <Td className="whitespace-nowrap">{fmt(link.created_at)}</Td>
              <Td className="whitespace-nowrap">{fmt(link.expires_at)}</Td>
              <Td>
                {revoked ? (
                  <span className="text-xs text-(--color-description)">—</span>
                ) : (
                  <Button
                    type="button"
                    variant="danger"
                    disabled={pending || !token}
                    onClick={() => onRevoke(token)}
                  >
                    Отозвать
                  </Button>
                )}
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
}
```

- [x] **Step 2: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "share-link-list" || echo "OK"`
Expected: `OK`

Заметка: если `Button` не знает `variant="danger"` — сверить варианты в `button.tsx` (confirm-dialog/frontend-conventions используют `variant="danger"`, значит есть).

- [x] **Step 3: Commit**

```bash
git add src/features/share-links/ui/share-link-list.tsx
git commit -m "feat(share-links): ShareLinkList (owner/admin revoke + copyable URL)"
```

---

## Task 9: ui/share-button.tsx (клиент, главный компонент-кнопка)

**Files:**
- Create: `src/features/share-links/ui/share-button.tsx`

Заметка по контракту: компонент **клиентский**, получает уже посчитанный `canCreate: boolean` пропом из server-компонента страницы (по конвенции `me` в клиент не передаём). Существующие ссылки фетчатся на сервере и тоже передаются пропом `initialLinks`. После создания/отзыва — `router.refresh()` подтянет свежие.

- [x] **Step 1: Написать share-button.tsx**

Создать `src/features/share-links/ui/share-button.tsx`:

```tsx
"use client";
// src/features/share-links/ui/share-button.tsx
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, TextInput, useToast } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { createShareLink } from "../actions";
import { ShareLinkList } from "./share-link-list";
import { RESOURCE_TYPE_LABELS } from "../types";
import type { ShareLink, ResourceType } from "../types";

interface Props {
  resourceType: ResourceType;
  resourceId: string;
  /** Владелец приватного ресурса? Считается на сервере (canCreateShareLink). */
  canCreate: boolean;
  /** Уже выпущенные ссылки ресурса (server fetch). */
  initialLinks: ShareLink[];
}

const initialState: ActionResult<ShareLink | null> = {
  success: true,
  data: null,
};

/**
 * Кнопка «Поделиться» для detail-страниц. Открывает Dialog со списком
 * существующих ссылок ресурса и формой создания новой. Показывается только
 * владельцу приватного ресурса (canCreate). Создание — server action
 * createShareLink; после успеха router.refresh() обновляет список.
 */
export function ShareButton({
  resourceType,
  resourceId,
  canCreate,
  initialLinks,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createShareLink,
    initialState,
  );

  useEffect(() => {
    if (state.success && state.data) {
      toast.add({ title: "Ссылка создана" });
      router.refresh();
    } else if (!state.success) {
      const msg =
        state.code === "forbidden"
          ? "У вас нет прав на создание ссылки."
          : state.error;
      toast.add({ title: "Ошибка", description: msg });
    }
    // state — единственный триггер; toast/router стабильны
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!canCreate) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button type="button" variant="ghost">Поделиться</Button>}
      title={`Поделиться: ${RESOURCE_TYPE_LABELS[resourceType]}`}
      description="Ссылка открывает приватный ресурс держателю без входа."
    >
      <div className="flex flex-col gap-4">
        <form action={formAction} className="flex items-end gap-2">
          <input type="hidden" name="resource_type" value={resourceType} />
          <input type="hidden" name="resource_id" value={resourceId} />
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs text-(--color-description)">
              Срок действия (необязательно)
            </span>
            <TextInput type="datetime-local" name="expires_at" />
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? "…" : "Создать ссылку"}
          </Button>
        </form>

        <ShareLinkList
          links={initialLinks}
          resourceType={resourceType}
          resourceId={resourceId}
        />
      </div>
    </Dialog>
  );
}
```

- [x] **Step 2: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "share-button" || echo "OK"`
Expected: `OK`

Заметка: `useActionState` в React 19 возвращает `[state, action, isPending]` — третий элемент `pending` есть. Если версия React в проекте отдаёт двойной кортеж, убрать `pending` и вычислять через `useTransition` (сверить версию react в package.json при исполнении).

- [x] **Step 3: Commit**

```bash
git add src/features/share-links/ui/share-button.tsx
git commit -m "feat(share-links): ShareButton dialog (create + list)"
```

---

## Task 10: ui/share-lookup-form.tsx + index.ts

**Files:**
- Create: `src/features/share-links/ui/share-lookup-form.tsx`
- Modify (replace): `src/features/share-links/index.ts`

- [x] **Step 1: Написать share-lookup-form.tsx**

Создать `src/features/share-links/ui/share-lookup-form.tsx`:

```tsx
"use client";
// src/features/share-links/ui/share-lookup-form.tsx
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { Button, Select, TextInput } from "@/components/ui";
import { SHARE_RESOURCE_TYPES, ALL_RESOURCE_TYPES, RESOURCE_TYPE_LABELS } from "../types";

interface Props {
  /** admin-инструмент допускает canvas (admin может искать canvas-ссылки). */
  admin?: boolean;
}

/**
 * Форма поиска ссылок по ресурсу. Кладёт resource_type + resource_id в URL
 * (server-side фильтрация — страница перечитает fetcher). Бек не отдаёт
 * глобальный «список всех моих ссылок», поэтому управление — per-resource.
 */
export function ShareLookupForm({ admin = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const types = admin ? ALL_RESOURCE_TYPES : SHARE_RESOURCE_TYPES;
  const options = types.map((t) => ({ value: t, label: RESOURCE_TYPE_LABELS[t] }));

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rt = String(fd.get("resource_type") ?? "").trim();
    const rid = String(fd.get("resource_id") ?? "").trim();
    const params = new URLSearchParams();
    if (rt) params.set("resource_type", rt);
    if (rid) params.set("resource_id", rid);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-(--color-description)">Тип ресурса</span>
        <Select
          name="resource_type"
          defaultValue={searchParams.get("resource_type") ?? types[0]}
          options={options}
          aria-label="Тип ресурса"
        />
      </label>
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs text-(--color-description)">ID ресурса</span>
        <TextInput
          name="resource_id"
          defaultValue={searchParams.get("resource_id") ?? ""}
          placeholder="UUID ресурса"
        />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "Показать ссылки"}
      </Button>
    </form>
  );
}
```

- [x] **Step 2: Написать index.ts (public API слайса)**

Заменить содержимое `src/features/share-links/index.ts`:

```ts
// src/features/share-links/index.ts
// Public API слайса share-links. Снаружи слайс импортируется только отсюда.

export { getShareLinksFor, getAdminShareLinksFor } from "./api";
export {
  canCreateShareLink,
  canModerateShareLinks,
  canManageOwnLinks,
  type ShareableResource,
} from "./permissions";
export { buildShareUrl } from "./share-url";
export {
  type ShareLink,
  type ResourceType,
  SHARE_RESOURCE_TYPES,
  ALL_RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
} from "./types";
export { ShareLinkLookupSchema, type ShareLinkLookupInput } from "./schemas";
export { ShareButton } from "./ui/share-button";
export { ShareLinkList } from "./ui/share-link-list";
export { ShareLookupForm } from "./ui/share-lookup-form";
```

- [x] **Step 3: Проверить типы и линт слайса**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "share-links" || echo "OK"`
Expected: `OK`

- [x] **Step 4: Commit**

```bash
git add src/features/share-links/ui/share-lookup-form.tsx src/features/share-links/index.ts
git commit -m "feat(share-links): ShareLookupForm + slice public API (index.ts)"
```

---

## Task 11: Страница /share-links («Мои ссылки»)

**Files:**
- Create: `src/app/share-links/page.tsx`

- [x] **Step 1: Написать страницу**

Создать `src/app/share-links/page.tsx`:

```tsx
// src/app/share-links/page.tsx
import { redirect } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  ShareLookupForm,
  ShareLinkList,
  getShareLinksFor,
  ShareLinkLookupSchema,
} from "@/features/share-links";

interface Props {
  searchParams: Promise<{ resource_type?: string; resource_id?: string }>;
}

export default async function MyShareLinksPage({ searchParams }: Props) {
  const me = await getMe();
  if (!me || me.status !== "active") {
    redirect("/login?next=/share-links");
  }

  const raw = await searchParams;
  const parsed = ShareLinkLookupSchema.safeParse(raw);

  return (
    <section className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Мои ссылки</h1>
        <p className="text-sm text-(--color-description)">
          Управление share-ссылками. Выберите тип ресурса и укажите его ID,
          чтобы увидеть выпущенные ссылки.
        </p>
      </header>

      <ShareLookupForm />

      {parsed.success ? (
        <ShareLinkList
          links={await getShareLinksFor(
            parsed.data.resource_type,
            parsed.data.resource_id,
          )}
          resourceType={parsed.data.resource_type}
          resourceId={parsed.data.resource_id}
        />
      ) : (
        <p className="text-sm text-(--color-description)">
          Укажите тип и ID ресурса выше.
        </p>
      )}
    </section>
  );
}

export const metadata = { title: "Мои ссылки" };
```

- [x] **Step 2: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "app/share-links" || echo "OK"`
Expected: `OK`

- [x] **Step 3: Commit**

```bash
git add src/app/share-links/page.tsx
git commit -m "feat(share-links): /share-links page (my links lookup + revoke)"
```

---

## Task 12: Страница /admin/share-links (модерация)

**Files:**
- Create: `src/app/admin/share-links/page.tsx`

- [x] **Step 1: Написать страницу**

Создать `src/app/admin/share-links/page.tsx`:

```tsx
// src/app/admin/share-links/page.tsx
import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  ShareLookupForm,
  ShareLinkList,
  getAdminShareLinksFor,
  canModerateShareLinks,
  ShareLinkLookupSchema,
} from "@/features/share-links";

interface Props {
  searchParams: Promise<{ resource_type?: string; resource_id?: string }>;
}

export default async function AdminShareLinksPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canModerateShareLinks(me)) forbidden();

  const raw = await searchParams;
  const parsed = ShareLinkLookupSchema.safeParse(raw);

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Модерация ссылок</h1>
        <p className="text-sm text-(--color-description)">
          Просмотр и отзыв любых share-ссылок. Укажите тип ресурса и его ID.
        </p>
      </header>

      <ShareLookupForm admin />

      {parsed.success ? (
        <ShareLinkList
          links={await getAdminShareLinksFor(
            parsed.data.resource_type,
            parsed.data.resource_id,
          )}
          resourceType={parsed.data.resource_type}
          resourceId={parsed.data.resource_id}
          admin
          showUrl={false}
        />
      ) : (
        <p className="text-sm text-(--color-description)">
          Укажите тип и ID ресурса выше.
        </p>
      )}
    </section>
  );
}

export const metadata = { title: "Модерация ссылок — админ" };
```

- [x] **Step 2: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "admin/share-links" || echo "OK"`
Expected: `OK`

- [x] **Step 3: Commit**

```bash
git add src/app/admin/share-links/page.tsx
git commit -m "feat(share-links): /admin/share-links moderation page"
```

---

## Task 13: Viewer-проброс token в documents (api.ts + страница) + кнопка

**Files:**
- Modify: `src/features/documents/api.ts`
- Modify: `src/app/documents/[id]/page.tsx`

Заметка по типам token-query: пути в schema.ts НЕ объявляют `token` в query (см. §0/§10.5). openapi-fetch типизирует query этих путей узко. Чтобы добавить `token`, формируем объект params и кастуем query через `as never` (по образцу `preferences/actions.ts`, где body кастуется из-за расхождения schema.ts). Это локально, с комментарием-ссылкой на §10.5.

- [x] **Step 1: Доработать getDocumentById (обратно совместимо)**

В `src/features/documents/api.ts` заменить тело `getDocumentById`. Текущая форма:

```ts
export const getDocumentById = cache(
  async (id: string): Promise<Document | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/documents/{document_id}", {
      params: { path: { document_id: id } },
    });
    if (response.status === 404) return null;
    if (error) throw new Error(error.error ?? "Не удалось загрузить документ");
    return (data?.data ?? null) as Document | null;
  },
);
```

Заменить на (добавлен опциональный `token`):

```ts
export const getDocumentById = cache(
  async (id: string, token?: string): Promise<Document | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/documents/{document_id}", {
      params: {
        path: { document_id: id },
        // shareTokenMW (philosophy-api cmd/server/main.go:929) принимает
        // ?token=, но schema.ts его не объявляет (§10.5) — поэтому cast.
        ...(token ? { query: { token } as never } : {}),
      },
    });
    if (response.status === 404) return null;
    if (error) throw new Error(error.error ?? "Не удалось загрузить документ");
    return (data?.data ?? null) as Document | null;
  },
);
```

Заметка: если фактическая сигнатура/имя в `documents/api.ts` отличается (слайс смержен раньше), исполнитель адаптирует точечно: добавить второй опциональный параметр `token?: string` и тот же `...(token ? { query: { token } as never } : {})` в `params`. Прочие fetchers НЕ трогать.

- [x] **Step 2: Встроить чтение token + ShareButton в страницу документа**

В `src/app/documents/[id]/page.tsx`:

(a) Добавить `token` в тип `searchParams` (там уже есть `revision`):

```ts
  searchParams: Promise<{ revision?: string; token?: string }>;
```

(b) В теле читать токен и прокинуть в fetcher. Было:
```ts
  const { revision } = await searchParams;
  ...
  const document = await getDocumentById(id);
```
Стало:
```ts
  const { revision, token } = await searchParams;
  ...
  const document = await getDocumentById(id, token);
```

(c) Импортировать share-links API (рядом с прочими импортами):

```ts
import {
  ShareButton,
  canCreateShareLink,
  getShareLinksFor,
} from "@/features/share-links";
```

(d) После загрузки документа и `me` посчитать пропсы кнопки (рядом с существующими `canEdit`/`canDelete`):

```ts
  const canShare = canCreateShareLink(me, document);
  const shareLinks = canShare ? await getShareLinksFor("document", document.id ?? id) : [];
```

(e) Вставить кнопку рядом с заголовком/действиями документа (там, где `canEdit`-кнопки; точное место — рядом с блоком действий detail-страницы):

```tsx
{document.id && (
  <ShareButton
    resourceType="document"
    resourceId={document.id}
    canCreate={canShare}
    initialLinks={shareLinks}
  />
)}
```

- [x] **Step 3: Проверить типы и сборку страницы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "documents/api|documents/\[id\]" || echo "OK"`
Expected: `OK`

- [x] **Step 4: Commit**

```bash
git add src/features/documents/api.ts "src/app/documents/[id]/page.tsx"
git commit -m "feat(share-links): document page — token viewer + ShareButton"
```

---

## Task 14: Viewer-проброс token в media (api.ts + страница) + кнопка

**Files:**
- Modify: `src/features/media/api.ts`
- Modify: `src/app/media/[id]/page.tsx`

Заметка: `getMediaById` обёрнут в `unstable_cache` с ключом `["media-by-id", id]`. Токен НЕ должен попадать в cache-ключ как cross-request-разделитель пер-юзера — приватный ответ протёк бы между держателями. Решение: при наличии токена обходим `unstable_cache` (прямой fetch), без токена — поведение прежнее.

- [x] **Step 1: Доработать getMediaById**

В `src/features/media/api.ts` заменить `getMediaById`. Текущая форма:

```ts
export const getMediaById = cache(
  async (id: string): Promise<Media | null> => {
    const fetcher = unstable_cache(
      async (mediaId: string): Promise<Media | null> => {
        const api = await createApiClient();
        const { data, error, response } = await api.GET(
          "/api/media/{media_id}",
          { params: { path: { media_id: mediaId } } },
        );
        if (response.status === 404) return null;
        if (error) throw new Error(error.error ?? "Не удалось загрузить медиа");
        return (data?.data ?? null) as Media | null;
      },
      ["media-by-id", id],
      { tags: [`${Tags.MEDIA}:${id}`] },
    );
    return fetcher(id);
  },
);
```

Заменить на:

```ts
export const getMediaById = cache(
  async (id: string, token?: string): Promise<Media | null> => {
    // С токеном (viewer share-link) обходим cross-request unstable_cache:
    // приватный ответ не должен кешироваться между держателями ссылок.
    if (token) {
      const api = await createApiClient();
      const { data, error, response } = await api.GET("/api/media/{media_id}", {
        params: {
          path: { media_id: id },
          // shareTokenMW (main.go:944) принимает ?token=, schema.ts не
          // объявляет (§10.5) → cast.
          query: { token } as never,
        },
      });
      if (response.status === 404) return null;
      if (error) throw new Error(error.error ?? "Не удалось загрузить медиа");
      return (data?.data ?? null) as Media | null;
    }
    const fetcher = unstable_cache(
      async (mediaId: string): Promise<Media | null> => {
        const api = await createApiClient();
        const { data, error, response } = await api.GET(
          "/api/media/{media_id}",
          { params: { path: { media_id: mediaId } } },
        );
        if (response.status === 404) return null;
        if (error) throw new Error(error.error ?? "Не удалось загрузить медиа");
        return (data?.data ?? null) as Media | null;
      },
      ["media-by-id", id],
      { tags: [`${Tags.MEDIA}:${id}`] },
    );
    return fetcher(id);
  },
);
```

- [x] **Step 2: Встроить чтение token + ShareButton в страницу медиа**

В `src/app/media/[id]/page.tsx`:

(a) Добавить `searchParams` в Props (сейчас их нет):

```ts
interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}
```

(b) В сигнатуре функции принять `searchParams`, прочитать token, прокинуть в fetcher:

```ts
export default async function MediaPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  ...
  const media = await getMediaById(id, token);
```

(c) Импорт + пропсы кнопки (рядом с `getMe()` / другими can*):

```ts
import {
  ShareButton,
  canCreateShareLink,
  getShareLinksFor,
} from "@/features/share-links";
```
```ts
  const canShare = canCreateShareLink(me, media);
  const shareLinks = canShare ? await getShareLinksFor("media", media.id) : [];
```

(d) Вставить кнопку рядом с блоком действий медиа:

```tsx
{media.id && (
  <ShareButton
    resourceType="media"
    resourceId={media.id}
    canCreate={canShare}
    initialLinks={shareLinks}
  />
)}
```

Заметка: если на странице медиа `me` ещё не загружается — добавить `const me = await getMe();` (импорт `getMe` из `@/utils/me`), как в документе.

- [x] **Step 3: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "media/api|media/\[id\]" || echo "OK"`
Expected: `OK`

- [x] **Step 4: Commit**

```bash
git add src/features/media/api.ts "src/app/media/[id]/page.tsx"
git commit -m "feat(share-links): media page — token viewer + ShareButton"
```

---

## Task 15: Viewer-проброс token в lectures (api.ts + страница) + кнопка

**Files:**
- Modify: `src/features/lectures/api.ts`
- Modify: `src/app/lectures/[id]/page.tsx`

- [x] **Step 1: Доработать getLectureById**

В `src/features/lectures/api.ts` заменить `getLectureById`. Текущая форма:

```ts
export const getLectureById = cache(async (id: string): Promise<Lecture | null> => {
  const api = await createApiClient();
  const { data, error, response } = await api.GET("/api/lectures/{id}", {
    params: { path: { id } },
  });
  if (response.status === 404) return null;
  if (error) throw new Error(error.error ?? "Не удалось загрузить лекцию");
  const lecture = data?.data;
  return (lecture ?? null) as Lecture | null;
});
```

Заменить на:

```ts
export const getLectureById = cache(
  async (id: string, token?: string): Promise<Lecture | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/lectures/{id}", {
      params: {
        path: { id },
        // shareTokenMW (main.go:910) принимает ?token=, schema.ts не
        // объявляет (§10.5) → cast.
        ...(token ? { query: { token } as never } : {}),
      },
    });
    if (response.status === 404) return null;
    if (error) throw new Error(error.error ?? "Не удалось загрузить лекцию");
    const lecture = data?.data;
    return (lecture ?? null) as Lecture | null;
  },
);
```

- [x] **Step 2: Встроить чтение token + ShareButton в страницу лекции**

В `src/app/lectures/[id]/page.tsx`:

(a) Добавить `token` в searchParams-тип (там уже `cq`):

```ts
  searchParams: Promise<{ cq?: string; token?: string }>;
```

(b) Прочитать token и прокинуть:

```ts
  const { cq, token } = await searchParams;
  ...
  const lecture = await getLectureById(id, token);
```

(c) Импорт + пропсы (нужен `me`; если страница ещё не зовёт `getMe`, добавить):

```ts
import {
  ShareButton,
  canCreateShareLink,
  getShareLinksFor,
} from "@/features/share-links";
```
```ts
  const canShare = canCreateShareLink(me, lecture);
  const shareLinks = canShare ? await getShareLinksFor("lecture", lecture.id) : [];
```

(d) Вставить кнопку рядом с заголовком/действиями лекции:

```tsx
<ShareButton
  resourceType="lecture"
  resourceId={lecture.id}
  canCreate={canShare}
  initialLinks={shareLinks}
/>
```

- [x] **Step 3: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "lectures/api|lectures/\[id\]" || echo "OK"`
Expected: `OK`

- [x] **Step 4: Commit**

```bash
git add src/features/lectures/api.ts "src/app/lectures/[id]/page.tsx"
git commit -m "feat(share-links): lecture page — token viewer + ShareButton"
```

---

## Task 16: Viewer-проброс token в forms (api.ts + страница) + кнопка

**Files:**
- Modify: `src/features/forms/api.ts`
- Modify: `src/app/forms/[id]/page.tsx`

Заметка: слайс `forms` смержен раньше в волне 3. Исполнитель сначала ЧИТАЕТ `src/features/forms/api.ts` и `src/app/forms/[id]/page.tsx`, находит fetcher одиночной формы (вероятно `getFormById` / `getForm`) и сигнатуру страницы, затем применяет тот же паттерн. Ниже — обобщённый шаблон; имена адаптировать к фактическим.

- [x] **Step 1: Прочитать текущий код**

Run: `sed -n '1,80p' src/features/forms/api.ts && echo "=== page ===" && sed -n '1,60p' "src/app/forms/[id]/page.tsx"`
Зафиксировать: имя fetcher одиночной формы, имя поля владельца (`owner_id`) и `visibility` в типе формы, тип searchParams страницы.

- [x] **Step 2: Доработать fetcher формы (обратно совместимо)**

Добавить второй опциональный параметр `token?: string` в fetcher одиночной формы и прокинуть в query (по образцу Task 13/15):

```ts
// внутри params:
...(token ? { query: { token } as never } : {}),
```
Сигнатуру изменить с `(id: string)` на `(id: string, token?: string)`. Эндпоинт — `GET /api/forms/{id}` (shareTokenMW, main.go:961).

- [x] **Step 3: Встроить token + ShareButton в страницу формы**

(a) Добавить `token?: string` в searchParams-тип страницы (если searchParams нет — добавить `searchParams: Promise<{ token?: string }>`).
(b) Прочитать token, прокинуть в fetcher формы.
(c) Импорт:
```ts
import {
  ShareButton,
  canCreateShareLink,
  getShareLinksFor,
} from "@/features/share-links";
```
(d) Пропсы (нужен `me` — если страница его не грузит, добавить `getMe`):
```ts
  const canShare = canCreateShareLink(me, form);
  const shareLinks = canShare ? await getShareLinksFor("form", form.id) : [];
```
(e) Кнопка рядом с действиями формы:
```tsx
{form.id && (
  <ShareButton
    resourceType="form"
    resourceId={form.id}
    canCreate={canShare}
    initialLinks={shareLinks}
  />
)}
```

- [x] **Step 4: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "forms/api|forms/\[id\]" || echo "OK"`
Expected: `OK`

- [x] **Step 5: Commit**

```bash
git add src/features/forms/api.ts "src/app/forms/[id]/page.tsx"
git commit -m "feat(share-links): form page — token viewer + ShareButton"
```

---

## Task 17: Viewer-проброс token в trails (api.ts + страница) + кнопка

**Files:**
- Modify: `src/features/trails/api.ts`
- Modify: `src/app/trails/[id]/page.tsx`

Заметка: слайс `trails` смержен раньше. Тот же подход, что и forms (Task 16). Эндпоинт — `GET /api/trails/{id}` (shareTokenMW, main.go:1198).

- [x] **Step 1: Прочитать текущий код**

Run: `sed -n '1,80p' src/features/trails/api.ts && echo "=== page ===" && sed -n '1,60p' "src/app/trails/[id]/page.tsx"`
Зафиксировать: имя fetcher одиночного трейла, поля `owner_id`/`visibility` в типе Trail, тип searchParams страницы.

- [x] **Step 2: Доработать fetcher трейла**

Добавить `token?: string` и прокинуть в query (как Task 13/15):
```ts
...(token ? { query: { token } as never } : {}),
```

- [x] **Step 3: Встроить token + ShareButton в страницу трейла**

(a) `token?: string` в searchParams-тип (или добавить searchParams).
(b) Прочитать token, прокинуть в fetcher.
(c) Импорт:
```ts
import {
  ShareButton,
  canCreateShareLink,
  getShareLinksFor,
} from "@/features/share-links";
```
(d) Пропсы:
```ts
  const canShare = canCreateShareLink(me, trail);
  const shareLinks = canShare ? await getShareLinksFor("trail", trail.id) : [];
```
(e) Кнопка:
```tsx
{trail.id && (
  <ShareButton
    resourceType="trail"
    resourceId={trail.id}
    canCreate={canShare}
    initialLinks={shareLinks}
  />
)}
```

- [x] **Step 4: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "trails/api|trails/\[id\]" || echo "OK"`
Expected: `OK`

- [x] **Step 5: Commit**

```bash
git add src/features/trails/api.ts "src/app/trails/[id]/page.tsx"
git commit -m "feat(share-links): trail page — token viewer + ShareButton"
```

---

## Task 18: Финальная верификация

**Files:** —

- [x] **Step 1: Прогнать весь тест-набор слайса**

Run: `npm test -- src/features/share-links`
Expected: PASS — все три файла (`schemas.test.ts`, `permissions.test.ts`, `share-url.test.ts`).

- [x] **Step 2: Линт (ESLint-гарды изоляции слайсов)**

Run: `npm run lint`
Expected: без ошибок. Особое внимание: НЕТ cross-feature импортов из `@/features/*` внутри `src/features/share-links/*` (слайс ничего из других слайсов не импортит); НЕТ `react-dom/client` в server-only файлах; detail-страницы импортят share-links только через `@/features/share-links`.

- [x] **Step 3: Полный тест-набор**

Run: `npm test`
Expected: PASS (никакие чужие тесты не сломаны правками api.ts — параметр опциональный).

- [x] **Step 4: Сборка**

Run: `npm run build`
Expected: успешная сборка. Проверить, что новые роуты `/share-links` и `/admin/share-links` появились в выводе.

- [x] **Step 5: Финальный self-review по чеклисту `_template/README.md`**

- [x] `index.ts` экспортирует только нужное снаружи.
- [x] `api.ts`/`actions.ts`/`permissions.ts`/`schemas.ts` начинаются с `import "server-only";` (кроме `share-url.ts` — он client-safe, это осознанно).
- [x] Каждая `canXxx` покрыта тестом (3 хелпера — покрыты).
- [x] Каждая Zod-схема имеет success+failure тест (3 схемы — покрыты).
- [x] `createFormAction`/`parseFormData`/`revalidateEntity` использованы.
- [x] Слайс не импортит другие `@/features/*`.
- [x] Удалён `ui/.gitkeep`, добавлены реальные UI-файлы.
- [x] `npm run lint && npm test && npm run build` зелёные.

- [x] **Step 6: Commit (если self-review потребовал правок)**

```bash
git add src/features/share-links src/app/share-links src/app/admin/share-links
git commit -m "chore(share-links): self-review fixes"
```

---

## Риски и допущения

1. **Нет глобального «списка всех моих ссылок».** Бек отдаёт ссылки только per-resource (`resource_type`+`resource_id` обязательны). Поэтому `/share-links` и `/admin/share-links` — инструменты поиска по ресурсу, а основной UX — inline в `ShareButton`. Если позже бек добавит `GET /api/me/share-links`, добавится отдельный fetcher + лента (не в этой ветке).

2. **Viewer token прокидывается ТОЛЬКО в основной fetcher ресурса страницы.** Дочерние секции (annotations / comments / attachments / revisions / lecture→documents·media) НЕ token-aware в этом MVP — иначе пришлось бы трогать ещё больше чужих слайсов. Держатель ссылки видит сам ресурс; приватные дочерние сущности остаются скрыты (согласуется с семантикой бека: токен открывает ровно свой ресурс, integration_test.go подтверждает, что lecture-токен НЕ открывает приватные вложенные документы). Расширение — отдельной задачей.

3. **Submit формы по токену** (`POST /api/forms/{id}/submissions` под shareTokenMW) — зона слайса `forms`, НЕ share-links. В этой ветке доводим только GET формы по токену (просмотр). Если слайс forms ещё не шлёт токен в submit — это его доработка, не наша.

4. **`share_link.moderate` отсутствует в union `Capability`** (`src/utils/permissions.ts` заморожен). Слайс делает локальный `me.capabilities.includes("share_link.moderate")`. Добавление в union + замена на `can()` + пункт sidebar — foundation-touch после мержа фич волны (НЕ в ветке).

5. **token-query не объявлен в schema.ts** (§10.5). Прокидываем через `query: { token } as never`. Если регенерация schema.ts когда-нибудь добавит token в эти пути — cast можно снять. Бек принимает лишний query без ошибки.

6. **TZ для `expires_at`.** `datetime-local` без таймзоны интерпретируется в TZ браузера при `new Date(...)` в Zod-transform на сервере — фактически в TZ Next-процесса. Для share-links это приемлемо (грубая гранулярность срока); проверку «в будущем» делает бек (422). То же допущение, что в слайсе audit.

7. **`media` fetcher и unstable_cache.** При наличии токена обходим `unstable_cache`, чтобы приватный ответ не протёк между держателями ссылок через cross-request кеш. Без токена — поведение прежнее.

8. **Имена fetcher'ов forms/trails** уточняются при исполнении (слайсы смержены раньше) — Task 16/17 начинаются с чтения фактического кода. Паттерн правки идентичен documents/lectures.

9. **`useActionState` третий элемент (`pending`)** — зависит от версии React. Если двойной кортеж — заменить на `useTransition` (Task 9, заметка).

10. **Мерж последним = без конфликтов в shared-файлах.** Все MODIFY-файлы (чужие api.ts, detail-страницы, tags.ts) правит только эта ветка в волне; параллельных писателей нет.

---

## Self-review (выполнен Plan-агентом против спеки §3/§5/§6/§7/§10)

- **Share-кнопка для document/media/form/lecture/trail** — Tasks 13-17, компонент `ShareButton` слайса, без копий в других слайсах. ✔
- **canvas вне скоупа** — `SHARE_RESOURCE_TYPES` без canvas, `buildShareUrl` бросает на canvas. ✔
- **Гейт создания (ownership + private)** — `canCreateShareLink` сверен с service.go (capability НЕ нужна, owner+private), тесты 6 кейсов. ✔
- **Список своих ссылок + revoke** — `/share-links` + inline в кнопке; `revokeShareLink`. ✔
- **Admin-модерация + share_link.moderate** — `/admin/share-links`, `canModerateShareLinks`, `adminRevokeShareLink`. ✔
- **Consumption/viewer (§10.5)** — shareTokenMW сверен с main.go; viewer-роуты перечислены; стратегия проброса token в fetcher'ы зафиксирована (§3.2) и реализована Tasks 13-17. ✔
- **Уроки волн 1-2:** uppercase-коды (rethrowApiError по `FORBIDDEN`/`SUSPENDED`/`RESOURCE_NOT_PRIVATE`/`NOT_FOUND`) ✔; exactOptionalPropertyTypes (везде `...(x !== undefined ? {x} : {})`) ✔; branded 403 («У вас нет прав на …») ✔; server-only во всех серверных файлах ✔; локальная пагинация — N/A (списки short, per-resource; пагинации у share-links эндпоинтов нет) ✔; useToast ✔.
- **Тесты:** permissions 6+4+3 кейсов (≥4 ✔), schemas success+failure на каждую из 3 схем ✔.
- **Parallel-safety contract** — присутствует (§2), create/modify/reserve перечислены, правила для субагентов дословно. ✔
- **Foundation-touch** — выделен в §4, НЕ в ветке. ✔
- **Финал** — `npm run lint && npm test && npm run build` (Task 18). ✔

**Placeholder-скан:** код во всех шагах полный; в Tasks 16/17 шаблон обобщён осознанно (чужие слайсы forms/trails смержены раньше, имена уточняются чтением) — это не placeholder, а инструкция-адаптер с конкретным паттерном и точным кодом query-проброса.
