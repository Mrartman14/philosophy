# План реализации фичи `lecture-enrichment` (волна 3)

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ САБ-СКИЛЛ — `superpowers:subagent-driven-development` (рекомендуется) или `superpowers:executing-plans`. Выполняй план задача-за-задачей. Шаги размечены чекбоксами (`- [ ]`).
>
> **ПРАВИЛА ПАРАЛЛЕЛЬНОЙ РАБОТЫ (передавай ДОСЛОВНО каждому своему субагенту):**
> - НЕ делать `git stash`, `git reset`, `git checkout .`, `git clean` и прочие деструктивные git-операции.
> - НЕ откатывать и не перезаписывать изменения других агентов.
> - НЕ делать `git add -A` / `git add .` — добавлять только свои файлы по имени.
> - Push заблокирован. Работаем только локально, мержит менеджер.
> - Общение с пользователем — на русском. Файлы/папки в `src/` — kebab-case.

**Goal:** Расширить существующий слайс `src/features/lectures/` функциями обогащения: обложка (cover) лекции в admin-форме и на публичной странице/карточке; управление attachments (document/media/canvas) на admin-странице лекции через generic `src/components/attachments/`; секции «Документы лекции» и «Медиа лекции» на публичной странице лекции; ссылки на `.md`/`.txt` выгрузки; подсветка терминов глоссария в описании лекции через `POST /api/glossary/suggest` (nice-to-have).

**Architecture:** Расширение существующего SSR-first слайса по `docs/frontend-conventions.md`. Cover грузится паттерном «upload-then-promote»: `uploadImage` (`@/components/ast-editor/upload/upload-image`, `POST /api/uploads/images`) → server action `setLectureCover` (`PUT /api/lectures/{id}/cover` с `{upload_id, alt_text}`). URL обложки строится из `cover_image_key` через `resolveStorageUrl`. Управление attachments — через готовый доменно-нейтральный `@/components/attachments` (props-контракт уже зафиксирован волной 2): новые server actions слайса `attachToLecture`/`detachFromLecture`/`reorderLectureAttachment` оборачиваются адаптером для панели. Блоки документов/медиа на публичной странице лекции — **композиция через страницу** `src/app/lectures/[id]/page.tsx` (страница импортирует компоненты `@/features/documents` и `@/features/media` — это НЕ cross-feature импорт, страница нейтральна), данные читаются новыми fetcher'ами слайса `lectures` (`getLectureDocuments`/`getLectureMedia`). `.md`/`.txt` — через прокси-роут (как у documents/events), т.к. эндпоинты `optionalAuth` и приватная лекция владельца требует токен. Glossary-suggest — отдельный server action + client-подсветка в описании (byte→UTF-16 конверсия offset).

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), TypeScript (`exactOptionalPropertyTypes`), Zod, `openapi-fetch` (`@/api/client`), Vitest + jsdom, Base UI (`@/components/ui`), `@/components/attachments`, `@/components/ast-editor/upload`.

---

## 0. Контекст и факты бекенда (прочитать ДО старта)

Источник истины — бекенд `/Users/alexander.borisenko/Documents/philosophy-api`. Ниже — факты, сверенные с кодом (`internal/lecture/`, `internal/attachment/`, `internal/glossary/`, `internal/rbac/capabilities.go`, `cmd/server/main.go`). При расхождении со `schema.ts` верь бекенду (см. §10 спеки `docs/superpowers/specs/2026-06-12-backend-coverage-program-design.md`). Это **расширение существующего слайса**, не новый слайс — `_template` не копируем.

### 0.1. Capabilities (строго из `internal/rbac/capabilities.go`)

- `lecture.create`, `lecture.delete` — **только admin**. (уже используются в слайсе)
- `entity.attach` — есть у роли **user** (admin как супермножество тоже имеет — см. ниже §0.7 про мёртвый attach).
- **Cover (SetCover/ClearCover) НЕ требует capability** — только ownership лекции (`lec.OwnerID == actor.UserID`). Cap `lecture.upload_files` существует в union, но cover-handler его НЕ проверяет — не использовать его для гейта cover.
- **Suggest НЕ требует capability** — только `requiredAuth` (любой залогиненный active-пользователь).

**ВАЖНО:** union `Capability` в `src/utils/permissions.ts` (запретная зона) УЖЕ содержит `"entity.attach"` (строка ~24) и `"lecture.upload_files"` (строка ~17). Поэтому в слайсе можно звать `can(me, "entity.attach")` напрямую — **локальный `hasCap`-костыль НЕ нужен** (в отличие от волны 2). `permissions.ts` НЕ трогаем.

### 0.2. Маршруты (сверено с `cmd/server/main.go`)

| Метод | Путь | Auth | Гейт | Тело / ответ |
| --- | --- | --- | --- | --- |
| PUT | `/api/lectures/{id}/cover` | requiredAuth | owner-only | `{upload_id, alt_text?}` → **204 No Content** |
| DELETE | `/api/lectures/{id}/cover` | requiredAuth | owner-only | → **204 No Content** |
| POST | `/api/lectures/{lectureID}/attachments` | requiredAuth | `entity.attach` ∧ owner | `{entity_id, entity_type, sort_order?}` → 201 `attachment.AttachmentDTO` |
| DELETE | `/api/lectures/{lectureID}/attachments/{entityType}/{entityID}` | requiredAuth | owner-only | → 204 |
| PATCH | `/api/lectures/{lectureID}/attachments/{entityType}/{entityID}` | requiredAuth | owner-only | `{sort_order}` → 204 |
| GET | `/api/lectures/{id}/documents` | optionalAuth | — | `document.Document[]` (упорядочены по `sort_order` attachment) |
| GET | `/api/lectures/{id}/media` | optionalAuth | — | `media.Media[]` (упорядочены по `sort_order`) |
| GET | `/api/lectures/{id}.md` / `.txt` | optionalAuth | — (private → нужен токен) | text (рендерит бек) |
| POST | `/api/glossary/suggest` | requiredAuth | — | `{blocks:[{block_id,text}]}` → `{suggestions:[{term_id,title,occurrences:[{block_id,offset,length}]}]}` |
| POST | `/api/uploads/images` | requiredAuth | — | multipart `file` → `{storage_key, upload_id}` (уже обёрнуто `uploadImage`) |

### 0.3. Cover — точная семантика (verbatim из `internal/lecture/service.go`)

- **SetCover** (`PUT /cover`): требует `actor != nil`, `lec.OwnerID == actor.UserID` (иначе FORBIDDEN); внутри зовёт `image.PromoteToCover(upload_id)` — апгрейд ранее загруженного через `/api/uploads/images` изображения в cover-слот. Возвращает **204 No Content** (НЕ обновлённую лекцию — фронт перечитывает через `revalidateEntity`).
- **ClearCover** (`DELETE /cover`): owner-only; чистит `cover_image_key`/`cover_image_alt` в NULL. **204**.
- Поля в `lecture.Lecture`: `cover_image_key?: string` (storage-key SHA256), `cover_image_alt?: string`. **Нет отдельного GET cover** — URL строится клиентом: `resolveStorageUrl(cover_image_key)` → `${NEXT_PUBLIC_STORAGE_URL ?? NEXT_PUBLIC_API_URL}/static/files/{key}`.
- **Коды:** `FORBIDDEN` (403, не owner), `NOT_FOUND`/`LECTURE_NOT_FOUND` (404), `UPLOAD_NOT_FOUND` (404, неизвестный upload_id), `UPLOAD_FOREIGN` (403, upload чужой), `VALIDATION_ERROR` (422, пустой upload_id), `REQUEST_BODY_TOO_LARGE` (413).
- **Flow двухшаговый:** (1) `uploadImage(FormData{file})` → `{upload_id}`; (2) `setLectureCover({id, upload_id, alt_text})`. Загрузка и промоут — два запроса.

### 0.4. Attachments — точная семантика (verbatim из `internal/attachment/service.go`)

- **Attach (POST):** `actor.HasCapability("entity.attach")` **И** `actor.UserID == lecture.OwnerID` — оба условия, иначе `ATTACH_FORBIDDEN` (403). UI-гейт: `can(me, "entity.attach") && me.id === lecture.owner_id`.
- **Detach (DELETE) и Reorder (PATCH):** **только ownership** (`ownerID == actor.UserID`), capability НЕ проверяется. UI-гейт: `me.id === lecture.owner_id`.
- `entity_type ∈ {document, media, canvas}` (validate `oneof=document media canvas`). **canvas валиден** на беке (можно attach), но визуального просмотра канваса в проекте нет (§4 спеки) → в списке прикреплений рендерим graceful-плашкой (это уже делает `AttachmentsPanel` при `entityType === "canvas"`).
- **Reorder** = абсолютный `sort_order` (НЕ swap; repository клампит в `[0, N-1]`). `UpdateAttachmentRequest{sort_order: int (gte=0)}`.
- **Коды:** `ALREADY_ATTACHED` (409), `INVALID_ENTITY_TYPE` (422), `ATTACH_FORBIDDEN`/`FORBIDDEN` (403), `NOT_FOUND`/`LECTURE_NOT_FOUND` (404), `REQUEST_BODY_TOO_LARGE` (413).

### 0.5. Списки документов/медиа лекции

- `GET /api/lectures/{id}/documents` → полные `document.Document[]`, упорядочены по `sort_order` attachment'а. `optionalAuth` — публично видны public-документы; приватные документы владельца видны только с его токеном (cookie httpOnly не уходит на бек автоматически — но `createApiClient` подкладывает Bearer из cookie на сервере, см. `@/api/client`).
- `GET /api/lectures/{id}/media` → полные `media.Media[]`, тот же порядок. `media.Media` содержит подписанный `url` для проигрывания.
- На странице лекции эти списки — **read-only** (плеер/ссылки). Управление (attach) — на admin-странице через `AttachmentsPanel`.

### 0.6. Exports `.md`/`.txt`

- `GET /api/lectures/{id}.md|.txt` — `optionalAuth` (как documents/events). Для **публичной** лекции токен не нужен, но страница показывает и приватные лекции владельцу → выбираем **прокси-роут** `/lectures/[id]/export?format=md|txt`, подкладывающий Bearer из cookie (паттерн `src/app/documents/[id]/export/route.ts` и `src/app/admin/events/[id]/export/route.ts`).

### 0.7. Suggest — точная семантика (verbatim из `internal/glossary/suggest/suggest.go`)

- Request: `{blocks: [{block_id: string, text: string}]}` (min 1, max 500 блоков; text max 50000).
- Response: `{suggestions: [{term_id, title, occurrences: [{block_id, offset, length}]}]}`.
- **`offset`/`length` — БАЙТОВЫЕ индексы в UTF-8** (Go string indexing). JavaScript-строки — UTF-16 code units. **Для подсветки в JS необходима конверсия byte-offset → UTF-16 code-unit-offset.** Это критичный нетривиальный шаг (см. Task 18, чистая функция `byteRangeToCodeUnits` с тестами на кириллицу/эмодзи).
- Гейт: `requiredAuth` (только залогиненные). Гостю suggest недоступен — подсветку показываем только авторизованным (server action вернёт forbidden → деградируем до plain-описания).

### 0.8. §10.4 спеки — attach де-факто мёртв

Лекции создаёт только admin (owner = admin), а реально нужны ОБА: `entity.attach` (есть у admin) И ownership. На практике admin-владелец оба условия удовлетворяет → **attach для admin-владельца РАБОТАЕТ** (это уточнение против §10.4, где сказано «admin attach не может» — там имелось в виду старое прочтение §6.3; по коду `internal/attachment/service.go` admin с `entity.attach`, будучи владельцем, проходит гейт). Строим UI по правилам бека: кнопка attach видна при `can(me, "entity.attach") && me.id === lecture.owner_id`. См. «Риски».

### 0.9. Уроки волн 1–2 (применять всюду)

- **UPPER_SNAKE_CASE-коды** бекенда маппим в `rethrowApiError` (паттерн `src/features/media/actions.ts`).
- **`exactOptionalPropertyTypes`** — опциональные поля добавляем через conditional spread (`...(x !== undefined && { x })`), не `x: x ?? undefined`.
- **Branded 403** — в client UI показываем «У вас нет прав на <действие>.», не raw `error`.
- **`import "server-only";`** — в `api.ts`/`actions.ts`/`permissions.ts`/`schemas.ts`.
- **Owner-aware RBAC** — мутации лекции (cover, attach/detach/reorder) гейтим на `me.id === lecture.owner_id`, НЕ на роль (§6.4 спеки).

---

## Структура файлов

**Модифицируем (существующий слайс — зарезервированы за этой фичей, см. Parallel-safety):**
- `src/features/lectures/api.ts` — +`getLectureDocuments`, `getLectureMedia`, `getLectureAttachments`.
- `src/features/lectures/actions.ts` — +`setLectureCover`, `clearLectureCover`, `attachToLecture`, `detachFromLecture`, `reorderLectureAttachment`, `suggestGlossaryTerms`.
- `src/features/lectures/permissions.ts` — +`canManageCover`, `canManageAttachments`, `canAttachToLecture`.
- `src/features/lectures/schemas.ts` — +cover/attach/detach/reorder/suggest Zod-схемы.
- `src/features/lectures/types.ts` — +`LectureDocument`, `LectureMediaItem`, `LectureAttachment`, suggest-типы.
- `src/features/lectures/index.ts` — реэкспорт нового.
- `src/features/lectures/permissions.test.ts` — +кейсы новых хелперов.
- `src/features/lectures/schemas.test.ts` — +кейсы новых схем.
- `src/features/lectures/ui/lecture-detail.tsx` — +cover-картинка, +ссылки экспорта, +подсветка терминов.
- `src/features/lectures/ui/lecture-card.tsx` — +cover-thumbnail.
- `src/features/lectures/ui/lecture-edit-form.tsx` — НЕ трогаем (cover отдельным компонентом ниже, компонуется страницей edit).

**Создаём (новые файлы слайса):**
- `src/features/lectures/cover-url.ts` (+`.test.ts`) — чистый helper URL обложки.
- `src/features/lectures/export-urls.ts` (+`.test.ts`) — чистый helper прокси-ссылок.
- `src/features/lectures/suggest-highlight.ts` (+`.test.ts`) — byte→UTF-16 конверсия + сегментация описания.
- `src/features/lectures/ui/lecture-cover-form.tsx` — client: upload+set+clear обложки (admin).
- `src/features/lectures/ui/lecture-export-links.tsx` — ссылки `.md`/`.txt`.
- `src/features/lectures/ui/lecture-attachments-manager.tsx` — client-адаптер `AttachmentsPanel` для admin.
- `src/features/lectures/ui/lecture-documents-section.tsx` — server: «Документы лекции» на публичной странице.
- `src/features/lectures/ui/lecture-media-section.tsx` — server: «Медиа лекции» на публичной странице.
- `src/features/lectures/ui/lecture-description.tsx` — client: описание с подсветкой терминов.

**Создаём (страницы — нейтральная зона):**
- `src/app/lectures/[id]/export/route.ts` — прокси `.md`/`.txt`.
- `src/app/admin/lectures/[id]/attachments/page.tsx` — admin-страница управления прикреплениями.

**Модифицируем (страницы — зарезервированы за этой фичей):**
- `src/app/lectures/[id]/page.tsx` — +секции документов/медиа (АККУРАТНО: тут дерево комментариев волны 2).
- `src/app/admin/lectures/[id]/edit/page.tsx` — +cover-форма + ссылка на attachments-страницу.

**Shared (единственная точка контакта):**
- `src/api/tags.ts` — НЕ модифицируем: `LECTURES` уже есть.

---

## Этап A — Cover (загрузка/удаление/отображение)

### Task 1: Типы lecture-enrichment

**Files:**
- Modify: `src/features/lectures/types.ts`

- [ ] **Step 1: Добавить типы**

Дописать в конец `src/features/lectures/types.ts`:

```ts
/** Документ, прикреплённый к лекции (GET /api/lectures/{id}/documents). */
export type LectureDocument = components["schemas"]["document.Document"];

/** Медиа, прикреплённое к лекции (GET /api/lectures/{id}/media). */
export type LectureMediaItem = components["schemas"]["media.Media"];

/** Элемент attachment-списка лекции (reverse — какие сущности прикреплены). */
export type LectureAttachment = components["schemas"]["attachment.AttachmentDTO"];

/** Тип прикрепляемой сущности. canvas валиден на беке, просмотра нет (§4 спеки). */
export type AttachmentEntityType = "document" | "media" | "canvas";

/** Один найденный термин глоссария (POST /api/glossary/suggest). */
export type GlossarySuggestion = components["schemas"]["suggest.Suggestion"];

/** Вхождение термина в блок текста (offset/length — БАЙТЫ UTF-8, см. §0.7). */
export type GlossaryOccurrence = components["schemas"]["suggest.Occurrence"];
```

- [ ] **Step 2: Проверить компиляцию типов**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (или те же ошибки, что были до правки — новые типы не должны добавить ошибок).

- [ ] **Step 3: Commit**

```bash
git add src/features/lectures/types.ts
git commit -m "feat(lectures): types for cover/attachments/suggest enrichment"
```

---

### Task 2: Helper URL обложки

**Files:**
- Create: `src/features/lectures/cover-url.ts`
- Test: `src/features/lectures/cover-url.test.ts`

- [ ] **Step 1: Написать падающий тест**

Create `src/features/lectures/cover-url.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { lectureCoverUrl } from "./cover-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("lectureCoverUrl", () => {
  it("undefined ключ → null", () => {
    expect(lectureCoverUrl(undefined)).toBeNull();
  });

  it("пустой ключ → null", () => {
    expect(lectureCoverUrl("")).toBeNull();
  });

  it("строит URL из NEXT_PUBLIC_STORAGE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_STORAGE_URL", "https://cdn.example");
    expect(lectureCoverUrl("abc123")).toBe("https://cdn.example/static/files/abc123");
  });

  it("фолбэк на NEXT_PUBLIC_API_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_STORAGE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example");
    expect(lectureCoverUrl("k")).toBe("https://api.example/static/files/k");
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/features/lectures/cover-url.test.ts`
Expected: FAIL (модуль `./cover-url` не найден).

- [ ] **Step 3: Реализация**

Create `src/features/lectures/cover-url.ts`:

```ts
// src/features/lectures/cover-url.ts
// Чистый helper URL обложки лекции. Без "server-only": нужен тестам и
// client-карточке. cover_image_key — SHA256-hex content-address (как
// resolveStorageUrl в ast-editor); раскрываем здесь, чтобы не тянуть
// deep-import ast-editor в слайс лекций.

/**
 * URL обложки лекции из cover_image_key (storage-key). null, если ключа нет.
 * База — NEXT_PUBLIC_STORAGE_URL, фолбэк — NEXT_PUBLIC_API_URL (как
 * src/components/ast-editor/upload/storage-url.ts).
 */
export function lectureCoverUrl(coverImageKey: string | undefined | null): string | null {
  if (!coverImageKey) return null;
  const base =
    process.env.NEXT_PUBLIC_STORAGE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";
  return `${base}/static/files/${coverImageKey}`;
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/features/lectures/cover-url.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add src/features/lectures/cover-url.ts src/features/lectures/cover-url.test.ts
git commit -m "feat(lectures): lectureCoverUrl helper (cover_image_key → /static/files URL)"
```

---

### Task 3: Cover-схемы (Zod)

**Files:**
- Modify: `src/features/lectures/schemas.ts`
- Test: `src/features/lectures/schemas.test.ts`

- [ ] **Step 1: Написать падающие тесты**

Дописать в `src/features/lectures/schemas.test.ts` (импорт схем добавить в существующий import-блок: `LectureCoverSchema`, `LectureCoverClearSchema`):

```ts
describe("LectureCoverSchema", () => {
  it("принимает id+upload_id (+опц. alt_text)", () => {
    const r = LectureCoverSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      upload_id: "11111111-1111-1111-1111-111111111111",
      alt_text: "Кант",
    });
    expect(r.success).toBe(true);
  });

  it("принимает без alt_text", () => {
    const r = LectureCoverSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      upload_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(r.success).toBe(true);
  });

  it("отклоняет пустой upload_id", () => {
    const r = LectureCoverSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      upload_id: "",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет невалидный id лекции", () => {
    const r = LectureCoverSchema.safeParse({ id: "x", upload_id: "u" });
    expect(r.success).toBe(false);
  });
});

describe("LectureCoverClearSchema", () => {
  it("принимает валидный uuid", () => {
    const r = LectureCoverClearSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(r.success).toBe(true);
  });

  it("отклоняет невалидный uuid", () => {
    const r = LectureCoverClearSchema.safeParse({ id: "x" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/features/lectures/schemas.test.ts`
Expected: FAIL (`LectureCoverSchema` не экспортирован).

- [ ] **Step 3: Реализация**

Дописать в `src/features/lectures/schemas.ts` (перед строкой `export type LectureCreateInput`):

```ts
export const LectureCoverSchema = z.object({
  id: z.string().uuid("Некорректный id лекции"),
  upload_id: z.string().min(1, "Не выбрано изображение"),
  alt_text: z.string().max(500, "До 500 символов").optional(),
});

export const LectureCoverClearSchema = z.object({
  id: z.string().uuid("Некорректный id лекции"),
});
```

И в блок `export type ...` дописать:

```ts
export type LectureCoverInput = z.infer<typeof LectureCoverSchema>;
export type LectureCoverClearInput = z.infer<typeof LectureCoverClearSchema>;
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/features/lectures/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/lectures/schemas.ts src/features/lectures/schemas.test.ts
git commit -m "feat(lectures): cover Zod schemas (set/clear) + tests"
```

---

### Task 4: Cover-permissions

**Files:**
- Modify: `src/features/lectures/permissions.ts`
- Test: `src/features/lectures/permissions.test.ts`

- [ ] **Step 1: Написать падающие тесты**

Дописать в `src/features/lectures/permissions.test.ts` (добавить `canManageCover` в import-блок):

```ts
describe("canManageCover", () => {
  it("owner active → true", () => {
    expect(canManageCover(activeUser, lecture)).toBe(true);
  });

  it("not-owner → false", () => {
    expect(canManageCover(activeUserNotOwner, lecture)).toBe(false);
  });

  it("гость → false", () => {
    expect(canManageCover(null, lecture)).toBe(false);
  });

  it("suspended owner → false", () => {
    const suspended: Me = { ...activeUser, status: "suspended" };
    expect(canManageCover(suspended, lecture)).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/features/lectures/permissions.test.ts`
Expected: FAIL (`canManageCover` не экспортирован).

- [ ] **Step 3: Реализация**

Дописать в `src/features/lectures/permissions.ts`:

```ts
/**
 * Управление обложкой (set/clear cover) — OWNER-ONLY без admin-override.
 * Бек (internal/lecture/service.go SetCover/ClearCover): lec.OwnerID ==
 * actor.UserID, никакой capability не проверяется. Status-гейт обязателен.
 */
export function canManageCover(
  me: MaybeMe,
  lecture: { owner_id: string },
): boolean {
  if (!isMutationAllowed(me)) return false;
  return lecture.owner_id === me.id;
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/features/lectures/permissions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/lectures/permissions.ts src/features/lectures/permissions.test.ts
git commit -m "feat(lectures): canManageCover (owner-only) + tests"
```

---

### Task 5: Cover server actions

**Files:**
- Modify: `src/features/lectures/actions.ts`

- [ ] **Step 1: Реализация actions**

Дописать в `src/features/lectures/actions.ts`. В шапку добавить импорты:

```ts
import { canManageCover } from "./permissions";
import { LectureCoverSchema, LectureCoverClearSchema } from "./schemas";
```

(объедини с существующими импортами `./permissions` и `./schemas` — не дублируй import-строки).

Обновить `rethrowApiError`, чтобы покрыть cover/attach-коды (заменить существующую функцию):

```ts
function rethrowApiError(err: ApiError | undefined): never {
  switch (err?.code) {
    case "forbidden":
    case "FORBIDDEN":
    case "ATTACH_FORBIDDEN":
    case "UPLOAD_FOREIGN":
      throw new ForbiddenError("role", err.error);
    case "SUSPENDED":
      throw new ForbiddenError("status", err.error);
    case "UPLOAD_NOT_FOUND":
      throw new Error("Загруженное изображение не найдено. Попробуйте ещё раз.");
    case "ALREADY_ATTACHED":
      throw new Error("Эта сущность уже прикреплена к лекции.");
    case "INVALID_ENTITY_TYPE":
      throw new Error("Недопустимый тип сущности.");
    case "NOT_FOUND":
    case "LECTURE_NOT_FOUND":
      throw new Error("Лекция не найдена.");
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}
```

Загрузчик лекции для owner-гейта (добавить):

```ts
import { getLectureById } from "./api";

/** Грузит лекцию для owner-aware гейта. 404 → ForbiddenError (secure). */
async function loadLectureForGate(id: string): Promise<Lecture> {
  const lecture = await getLectureById(id);
  if (!lecture) throw new ForbiddenError("owner", "Лекция не найдена");
  return lecture;
}
```

Сами actions:

```ts
/**
 * PUT /api/lectures/{id}/cover — промоут ранее загруженного изображения
 * (upload_id из POST /api/uploads/images) в cover-слот. Owner-only.
 * Бек отдаёт 204 — фронт инвалидирует кеш и перечитывает лекцию.
 */
export const setLectureCover = createAction(
  async (raw: { id: string; upload_id: string; alt_text?: string }) => {
    const me = await getMe();
    const input = LectureCoverSchema.parse(raw);
    const lecture = await loadLectureForGate(input.id);
    requireCapability(me, (m) => canManageCover(m, lecture));
    const api = await createApiClient();
    const { error } = await api.PUT("/api/lectures/{id}/cover", {
      params: { path: { id: input.id } },
      body: {
        upload_id: input.upload_id,
        ...(input.alt_text !== undefined && { alt_text: input.alt_text }),
      },
    });
    if (error) rethrowApiError(error as ApiError);
    revalidateEntity("lectures", input.id);
    revalidateEntity("lectures");
    return undefined;
  },
);

/** DELETE /api/lectures/{id}/cover — снять обложку. Owner-only. 204. */
export const clearLectureCover = createAction(async (rawId: string) => {
  const me = await getMe();
  const { id } = LectureCoverClearSchema.parse({ id: rawId });
  const lecture = await loadLectureForGate(id);
  requireCapability(me, (m) => canManageCover(m, lecture));
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/lectures/{id}/cover", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error as ApiError);
  revalidateEntity("lectures", id);
  revalidateEntity("lectures");
  return undefined;
});
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (нет новых ошибок).

- [ ] **Step 3: Commit**

```bash
git add src/features/lectures/actions.ts
git commit -m "feat(lectures): setLectureCover / clearLectureCover actions (owner-only, 204)"
```

---

### Task 6: Cover-форма (admin)

**Files:**
- Create: `src/features/lectures/ui/lecture-cover-form.tsx`

- [ ] **Step 1: Реализация**

Create `src/features/lectures/ui/lecture-cover-form.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { uploadImage } from "@/components/ast-editor/upload/upload-image";
import { setLectureCover, clearLectureCover } from "../actions";
import { lectureCoverUrl } from "../cover-url";

interface Props {
  lectureId: string;
  coverImageKey: string | null;
  coverImageAlt: string | null;
}

/**
 * Управление обложкой лекции (admin). Двухшаговый flow: (1) uploadImage
 * (POST /api/uploads/images) → upload_id; (2) setLectureCover (PUT cover).
 * Owner-only гейт — на странице (canManageCover); здесь только UI.
 */
export function LectureCoverForm({ lectureId, coverImageKey, coverImageAlt }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currentKey, setCurrentKey] = useState<string | null>(coverImageKey);
  const [alt, setAlt] = useState(coverImageAlt ?? "");
  const previewUrl = lectureCoverUrl(currentKey);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const up = await uploadImage(fd);
      if (!up.success) {
        setError(up.error);
        return;
      }
      const res = await setLectureCover({
        id: lectureId,
        upload_id: up.data.upload_id,
        ...(alt ? { alt_text: alt } : {}),
      });
      if (!res.success) {
        setError(
          res.code === "forbidden"
            ? "У вас нет прав на изменение обложки."
            : res.error,
        );
        return;
      }
      setCurrentKey(up.data.storage_key);
    });
  }

  function onClear() {
    setError(null);
    startTransition(async () => {
      const res = await clearLectureCover(lectureId);
      if (!res.success) {
        setError(
          res.code === "forbidden"
            ? "У вас нет прав на изменение обложки."
            : res.error,
        );
        return;
      }
      setCurrentKey(null);
    });
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Обложка лекции">
      <h2 className="text-lg font-semibold">Обложка</h2>
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={alt || "Обложка лекции"}
          className="max-h-48 w-auto rounded border border-(--color-border) object-cover"
        />
      ) : (
        <p className="text-sm text-(--color-description)">Обложка не задана.</p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Alt-текст (для доступности)
        <input
          type="text"
          value={alt}
          maxLength={500}
          onChange={(e) => setAlt(e.target.value)}
          className="rounded border border-(--color-border) px-2 py-1"
        />
      </label>

      <div className="flex items-center gap-2">
        <label className="cursor-pointer rounded border border-(--color-border) px-3 py-1.5 text-sm hover:bg-(--color-text-pane)">
          {currentKey ? "Заменить обложку" : "Загрузить обложку"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={pending}
            onChange={onFile}
          />
        </label>
        {currentKey && (
          <Button variant="danger" disabled={pending} onClick={onClear}>
            Удалить обложку
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
```

> **Заметка для исполнителя:** перед написанием проверь `src/components/ui/index.ts` — реальный API `Button` (есть ли `variant="danger"`). Если нет — используй имеющийся вариант. Перед `uploadImage` проверь точный экспорт-путь (`src/components/ast-editor/upload/upload-image.ts` — файл существует, дефолтный путь deep-import в `@/components` легален). НЕ модифицируй `src/components/ui` и `src/components/ast-editor` (запретные зоны).

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/lectures/ui/lecture-cover-form.tsx
git commit -m "feat(lectures): LectureCoverForm (upload-then-promote + clear)"
```

---

### Task 7: Cover на карточке и детали лекции

**Files:**
- Modify: `src/features/lectures/ui/lecture-card.tsx`
- Modify: `src/features/lectures/ui/lecture-detail.tsx`

- [ ] **Step 1: Добавить thumbnail в карточку**

В `src/features/lectures/ui/lecture-card.tsx` импортировать helper и вставить картинку первым потомком `<article>`:

```tsx
import { lectureCoverUrl } from "../cover-url";
```

Внутри `LectureCard`, перед `return`, вычислить:

```tsx
const coverUrl = lectureCoverUrl(lecture.cover_image_key ?? null);
```

И первым ребёнком `<article>` (до `<Link>`):

```tsx
{coverUrl && (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={coverUrl}
    alt={lecture.cover_image_alt ?? ""}
    className="mb-2 h-32 w-full rounded object-cover"
  />
)}
```

- [ ] **Step 2: Добавить cover в LectureDetail**

В `src/features/lectures/ui/lecture-detail.tsx` импортировать helper и вставить картинку в начало `<article>` (перед `<header>`):

```tsx
import { lectureCoverUrl } from "../cover-url";
```

Перед `return` (внутри `LectureDetail`):

```tsx
const coverUrl = lectureCoverUrl(lecture.cover_image_key ?? null);
```

Первым ребёнком `<article>`:

```tsx
{coverUrl && (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={coverUrl}
    alt={lecture.cover_image_alt ?? ""}
    className="max-h-80 w-full rounded-lg object-cover"
  />
)}
```

- [ ] **Step 3: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/lectures/ui/lecture-card.tsx src/features/lectures/ui/lecture-detail.tsx
git commit -m "feat(lectures): render cover on lecture card and detail"
```

---

### Task 8: Подключить cover-форму на admin-странице edit + реэкспорты

**Files:**
- Modify: `src/features/lectures/index.ts`
- Modify: `src/app/admin/lectures/[id]/edit/page.tsx`

- [ ] **Step 1: Реэкспорты**

Дописать в `src/features/lectures/index.ts`:

```ts
export { lectureCoverUrl } from "./cover-url";
export { LectureCoverForm } from "./ui/lecture-cover-form";
export { canManageCover } from "./permissions";
export { setLectureCover, clearLectureCover } from "./actions";
```

- [ ] **Step 2: Подключить на странице edit**

В `src/app/admin/lectures/[id]/edit/page.tsx`:
- В import из `@/features/lectures` добавить `canManageCover`, `LectureCoverForm`.
- После блока `{canUpdate && (<LectureEditForm .../>)}` (но внутри того же контейнера) добавить cover-секцию и ссылку на attachments:

```tsx
{canManageCover(me, lecture) && (
  <section className="max-w-xl border-t border-(--color-border) pt-4">
    <LectureCoverForm
      lectureId={lecture.id}
      coverImageKey={lecture.cover_image_key ?? null}
      coverImageAlt={lecture.cover_image_alt ?? null}
    />
  </section>
)}

{canManageCover(me, lecture) && (
  <section className="max-w-xl border-t border-(--color-border) pt-4">
    <h2 className="mb-2 text-lg font-semibold">Прикрепления</h2>
    <a
      href={`/admin/lectures/${lecture.id}/attachments`}
      className="text-sm underline hover:no-underline"
    >
      Управление документами и медиа лекции →
    </a>
  </section>
)}
```

> **Заметка:** `canManageCover` и `canManageAttachments` (Task 11) семантически одинаковы (owner-only). Для ссылки на attachments-страницу используем `canManageCover` здесь только потому, что `canManageAttachments` появится в Task 11 — после Task 11 при желании можно заменить, но обе дают тот же результат (owner-only). Чтобы не плодить порядковую зависимость, в этой задаче гейтим ссылку через `canManageCover` (идентичный предикат).

- [ ] **Step 3: Проверить компиляцию и сборку**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/lectures/index.ts "src/app/admin/lectures/[id]/edit/page.tsx"
git commit -m "feat(lectures): wire cover form + attachments link into admin edit page"
```

---

## Этап B — Attachments management (admin)

### Task 9: Fetcher attachments/documents/media лекции

**Files:**
- Modify: `src/features/lectures/api.ts`

- [ ] **Step 1: Реализация**

Дописать в `src/features/lectures/api.ts`. Импорт типов расширить:

```ts
import type {
  Lecture,
  LectureDocument,
  LectureMediaItem,
  LectureAttachment,
} from "./types";
```

Fetcher'ы:

```ts
/** GET /api/lectures/{id}/documents — документы лекции (по sort_order). 404 → []. */
export const getLectureDocuments = cache(
  async (id: string): Promise<LectureDocument[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/lectures/{id}/documents", {
      params: { path: { id } },
    });
    if (response.status === 404) return [];
    if (error) throw new Error(error.error ?? "Не удалось загрузить документы лекции");
    return (data?.data ?? []) as LectureDocument[];
  },
);

/** GET /api/lectures/{id}/media — медиа лекции (по sort_order). 404 → []. */
export const getLectureMedia = cache(
  async (id: string): Promise<LectureMediaItem[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/lectures/{id}/media", {
      params: { path: { id } },
    });
    if (response.status === 404) return [];
    if (error) throw new Error(error.error ?? "Не удалось загрузить медиа лекции");
    return (data?.data ?? []) as LectureMediaItem[];
  },
);
```

> **Заметка:** отдельного `GET /api/lectures/{id}/attachments` (плоский DTO-список) на беке нет — список прикреплений для admin-панели собираем из `getLectureDocuments` + `getLectureMedia` (см. Task 12). Canvas-прикрепления в этих двух эндпоинтах не вернутся (они отдают только document/media). Поэтому управлять canvas-прикреплениями из UI нельзя — это согласуется с §4 спеки (canvas вне скоупа), плашку canvas рисуем, только если бы такой DTO пришёл (не придёт). `LectureAttachment` тип оставлен для симметрии и возможного будущего reverse-эндпоинта.

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/lectures/api.ts
git commit -m "feat(lectures): getLectureDocuments / getLectureMedia fetchers"
```

---

### Task 10: Attach/detach/reorder схемы

**Files:**
- Modify: `src/features/lectures/schemas.ts`
- Test: `src/features/lectures/schemas.test.ts`

- [ ] **Step 1: Написать падающие тесты**

Дописать в `src/features/lectures/schemas.test.ts` (добавить в import: `LectureAttachSchema`, `LectureDetachSchema`, `LectureReorderSchema`):

```ts
describe("LectureAttachSchema", () => {
  it("принимает document/media/canvas", () => {
    for (const t of ["document", "media", "canvas"] as const) {
      const r = LectureAttachSchema.safeParse({
        lecture_id: "550e8400-e29b-41d4-a716-446655440000",
        entity_id: "11111111-1111-1111-1111-111111111111",
        entity_type: t,
      });
      expect(r.success).toBe(true);
    }
  });

  it("отклоняет неизвестный entity_type", () => {
    const r = LectureAttachSchema.safeParse({
      lecture_id: "550e8400-e29b-41d4-a716-446655440000",
      entity_id: "11111111-1111-1111-1111-111111111111",
      entity_type: "banner",
    });
    expect(r.success).toBe(false);
  });

  it("отклоняет невалидный lecture_id", () => {
    const r = LectureAttachSchema.safeParse({
      lecture_id: "x",
      entity_id: "y",
      entity_type: "document",
    });
    expect(r.success).toBe(false);
  });
});

describe("LectureDetachSchema", () => {
  it("принимает валидную тройку", () => {
    const r = LectureDetachSchema.safeParse({
      lecture_id: "550e8400-e29b-41d4-a716-446655440000",
      entity_id: "11111111-1111-1111-1111-111111111111",
      entity_type: "media",
    });
    expect(r.success).toBe(true);
  });

  it("отклоняет неизвестный entity_type", () => {
    const r = LectureDetachSchema.safeParse({
      lecture_id: "550e8400-e29b-41d4-a716-446655440000",
      entity_id: "11111111-1111-1111-1111-111111111111",
      entity_type: "zzz",
    });
    expect(r.success).toBe(false);
  });
});

describe("LectureReorderSchema", () => {
  it("принимает sort_order >= 0", () => {
    const r = LectureReorderSchema.safeParse({
      lecture_id: "550e8400-e29b-41d4-a716-446655440000",
      entity_id: "11111111-1111-1111-1111-111111111111",
      entity_type: "document",
      sort_order: 0,
    });
    expect(r.success).toBe(true);
  });

  it("отклоняет отрицательный sort_order", () => {
    const r = LectureReorderSchema.safeParse({
      lecture_id: "550e8400-e29b-41d4-a716-446655440000",
      entity_id: "11111111-1111-1111-1111-111111111111",
      entity_type: "document",
      sort_order: -1,
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/features/lectures/schemas.test.ts`
Expected: FAIL (схемы не экспортированы).

- [ ] **Step 3: Реализация**

Дописать в `src/features/lectures/schemas.ts`:

```ts
const ENTITY_TYPE = z.enum(["document", "media", "canvas"]);

export const LectureAttachSchema = z.object({
  lecture_id: z.string().uuid("Некорректный id лекции"),
  entity_id: z.string().min(1, "Не выбрана сущность"),
  entity_type: ENTITY_TYPE,
  sort_order: z.number().int().gte(0).optional(),
});

export const LectureDetachSchema = z.object({
  lecture_id: z.string().uuid("Некорректный id лекции"),
  entity_id: z.string().min(1),
  entity_type: ENTITY_TYPE,
});

export const LectureReorderSchema = z.object({
  lecture_id: z.string().uuid("Некорректный id лекции"),
  entity_id: z.string().min(1),
  entity_type: ENTITY_TYPE,
  sort_order: z.number().int().gte(0),
});
```

И в типы:

```ts
export type LectureAttachInput = z.infer<typeof LectureAttachSchema>;
export type LectureDetachInput = z.infer<typeof LectureDetachSchema>;
export type LectureReorderInput = z.infer<typeof LectureReorderSchema>;
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/features/lectures/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/lectures/schemas.ts src/features/lectures/schemas.test.ts
git commit -m "feat(lectures): attach/detach/reorder Zod schemas + tests"
```

---

### Task 11: Attachments permissions

**Files:**
- Modify: `src/features/lectures/permissions.ts`
- Test: `src/features/lectures/permissions.test.ts`

- [ ] **Step 1: Написать падающие тесты**

Дописать в `src/features/lectures/permissions.test.ts` (добавить в import: `canManageAttachments`, `canAttachToLecture`). Заметь — нужен `me` c `entity.attach`:

```ts
const ownerWithAttach: Me = {
  ...activeUser,
  capabilities: ["entity.attach"],
};

describe("canManageAttachments", () => {
  it("owner active → true (detach/reorder — только ownership)", () => {
    expect(canManageAttachments(activeUser, lecture)).toBe(true);
  });

  it("not-owner → false", () => {
    expect(canManageAttachments(activeUserNotOwner, lecture)).toBe(false);
  });

  it("гость → false", () => {
    expect(canManageAttachments(null, lecture)).toBe(false);
  });

  it("suspended owner → false", () => {
    const suspended: Me = { ...activeUser, status: "suspended" };
    expect(canManageAttachments(suspended, lecture)).toBe(false);
  });
});

describe("canAttachToLecture", () => {
  it("owner + entity.attach → true", () => {
    expect(canAttachToLecture(ownerWithAttach, lecture)).toBe(true);
  });

  it("owner без entity.attach → false", () => {
    expect(canAttachToLecture(activeUser, lecture)).toBe(false);
  });

  it("entity.attach но не owner → false", () => {
    const stranger: Me = { ...ownerWithAttach, id: "00000000-0000-0000-0000-000000000002" };
    expect(canAttachToLecture(stranger, lecture)).toBe(false);
  });

  it("гость → false", () => {
    expect(canAttachToLecture(null, lecture)).toBe(false);
  });

  it("suspended owner с cap → false", () => {
    const suspended: Me = { ...ownerWithAttach, status: "suspended" };
    expect(canAttachToLecture(suspended, lecture)).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/features/lectures/permissions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализация**

Дописать в `src/features/lectures/permissions.ts` (добавить `can` уже импортирован):

```ts
/**
 * Detach/reorder прикреплений — OWNER-ONLY (бек: только ownership лекции,
 * capability НЕ проверяется — internal/attachment/service.go).
 */
export function canManageAttachments(
  me: MaybeMe,
  lecture: { owner_id: string },
): boolean {
  if (!isMutationAllowed(me)) return false;
  return lecture.owner_id === me.id;
}

/**
 * Attach (POST) — capability entity.attach И ownership лекции (оба условия,
 * §6.3 спеки; бек internal/attachment/service.go). can() уже проверяет
 * status==active.
 */
export function canAttachToLecture(
  me: MaybeMe,
  lecture: { owner_id: string },
): boolean {
  if (!can(me, "entity.attach")) return false;
  return lecture.owner_id === me.id;
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/features/lectures/permissions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/lectures/permissions.ts src/features/lectures/permissions.test.ts
git commit -m "feat(lectures): canManageAttachments / canAttachToLecture + tests"
```

---

### Task 12: Attach/detach/reorder server actions

**Files:**
- Modify: `src/features/lectures/actions.ts`

- [ ] **Step 1: Реализация**

Дописать в `src/features/lectures/actions.ts`. Импорты схем/permissions объединить с существующими:

```ts
import {
  canAttachToLecture,
  canManageAttachments,
} from "./permissions";
import {
  LectureAttachSchema,
  LectureDetachSchema,
  LectureReorderSchema,
} from "./schemas";
```

Actions:

```ts
/**
 * POST /api/lectures/{lectureID}/attachments — прикрепить document|media|canvas.
 * Гейт: entity.attach ∧ ownership (§6.3). 201 → AttachmentDTO (нам не нужен, void).
 */
export const attachToLecture = createAction(
  async (raw: {
    lecture_id: string;
    entity_id: string;
    entity_type: "document" | "media" | "canvas";
    sort_order?: number;
  }) => {
    const me = await getMe();
    const input = LectureAttachSchema.parse(raw);
    const lecture = await loadLectureForGate(input.lecture_id);
    requireCapability(me, (m) => canAttachToLecture(m, lecture));
    const api = await createApiClient();
    const { error } = await api.POST("/api/lectures/{lectureID}/attachments", {
      params: { path: { lectureID: input.lecture_id } },
      body: {
        entity_id: input.entity_id,
        entity_type: input.entity_type,
        ...(input.sort_order !== undefined && { sort_order: input.sort_order }),
      },
    });
    if (error) rethrowApiError(error as ApiError);
    revalidateEntity("lectures", input.lecture_id);
    return undefined;
  },
);

/**
 * DELETE /api/lectures/{lectureID}/attachments/{entityType}/{entityID}.
 * Гейт: ownership лекции (без capability). 204.
 */
export const detachFromLecture = createAction(
  async (raw: {
    lecture_id: string;
    entity_id: string;
    entity_type: "document" | "media" | "canvas";
  }) => {
    const me = await getMe();
    const input = LectureDetachSchema.parse(raw);
    const lecture = await loadLectureForGate(input.lecture_id);
    requireCapability(me, (m) => canManageAttachments(m, lecture));
    const api = await createApiClient();
    const { error } = await api.DELETE(
      "/api/lectures/{lectureID}/attachments/{entityType}/{entityID}",
      {
        params: {
          path: {
            lectureID: input.lecture_id,
            entityType: input.entity_type,
            entityID: input.entity_id,
          },
        },
      },
    );
    if (error) rethrowApiError(error as ApiError);
    revalidateEntity("lectures", input.lecture_id);
    return undefined;
  },
);

/**
 * PATCH /api/lectures/{lectureID}/attachments/{entityType}/{entityID}.
 * Абсолютный sort_order (не swap, бек клампит). Гейт: ownership. 204.
 */
export const reorderLectureAttachment = createAction(
  async (raw: {
    lecture_id: string;
    entity_id: string;
    entity_type: "document" | "media" | "canvas";
    sort_order: number;
  }) => {
    const me = await getMe();
    const input = LectureReorderSchema.parse(raw);
    const lecture = await loadLectureForGate(input.lecture_id);
    requireCapability(me, (m) => canManageAttachments(m, lecture));
    const api = await createApiClient();
    const { error } = await api.PATCH(
      "/api/lectures/{lectureID}/attachments/{entityType}/{entityID}",
      {
        params: {
          path: {
            lectureID: input.lecture_id,
            entityType: input.entity_type,
            entityID: input.entity_id,
          },
        },
        body: { sort_order: input.sort_order },
      },
    );
    if (error) rethrowApiError(error as ApiError);
    revalidateEntity("lectures", input.lecture_id);
    return undefined;
  },
);
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/lectures/actions.ts
git commit -m "feat(lectures): attach/detach/reorder attachment actions (owner gates)"
```

---

### Task 13: Attachments-manager (client-адаптер AttachmentsPanel) + admin-страница

**Files:**
- Create: `src/features/lectures/ui/lecture-attachments-manager.tsx`
- Modify: `src/features/lectures/index.ts`
- Create: `src/app/admin/lectures/[id]/attachments/page.tsx`

- [ ] **Step 1: Реализация client-адаптера**

Create `src/features/lectures/ui/lecture-attachments-manager.tsx`:

```tsx
"use client";
import { useCallback } from "react";
import {
  AttachmentsPanel,
  AttachTargetPicker,
} from "@/components/attachments";
import type {
  AttachmentItem,
  AttachmentActionResult,
} from "@/components/attachments";
import {
  attachToLecture,
  detachFromLecture,
  reorderLectureAttachment,
} from "../actions";

/** Минимальная форма прикреплённой сущности для панели (id+label+type). */
export interface ManagedAttachment {
  entityId: string;
  entityType: "document" | "media" | "canvas";
  label: string;
  sortOrder: number;
}

interface Props {
  lectureId: string;
  /** Уже прикреплённые document+media (собраны на сервере из списков). */
  attachments: ManagedAttachment[];
  /** entity.attach ∧ ownership (вычислено на сервере). */
  canAttach: boolean;
  /** Тип прикрепляемых сущностей для пикера (документы или медиа). */
  pickerEntityType: "document" | "media";
  /** Fetcher целей для AsyncCombobox (server action, переданный страницей). */
  targetFetcher: (
    q: string,
    offset: number,
    limit: number,
  ) => Promise<{ data: { id: string; label: string }[]; total: number | null }>;
  title: string;
}

/**
 * Адаптер generic-панели прикреплений (@/components/attachments) под лекцию.
 * Маппит ManagedAttachment → AttachmentItem, оборачивает server actions в
 * { ok } -контракт панели (с branded-текстом для forbidden). detach/reorder —
 * по ownership (canManage всегда true на admin-странице, гейт выше); attach —
 * по canAttach. entity_type=canvas рендерит плашку сама панель.
 */
export function LectureAttachmentsManager({
  lectureId,
  attachments,
  canAttach,
  pickerEntityType,
  targetFetcher,
  title,
}: Props) {
  const items: AttachmentItem[] = attachments.map((a) => ({
    id: `${a.entityType}:${a.entityId}`,
    label: a.label,
    sortOrder: a.sortOrder,
    href:
      a.entityType === "document"
        ? `/documents/${a.entityId}`
        : a.entityType === "media"
          ? `/media/${a.entityId}`
          : undefined,
    entityType: a.entityType,
  }));

  // Восстанавливаем entityType/entityId из составного id панели.
  function split(id: string): { entityType: "document" | "media" | "canvas"; entityId: string } {
    const idx = id.indexOf(":");
    return {
      entityType: id.slice(0, idx) as "document" | "media" | "canvas",
      entityId: id.slice(idx + 1),
    };
  }

  const onDetach = useCallback(
    async (item: AttachmentItem): Promise<AttachmentActionResult> => {
      const { entityType, entityId } = split(item.id);
      const r = await detachFromLecture({
        lecture_id: lectureId,
        entity_id: entityId,
        entity_type: entityType,
      });
      if (r.success) return { ok: true };
      return {
        ok: false,
        error:
          r.code === "forbidden"
            ? "У вас нет прав на открепление."
            : r.error,
      };
    },
    [lectureId],
  );

  const onReorder = useCallback(
    async (
      item: AttachmentItem,
      newSortOrder: number,
    ): Promise<AttachmentActionResult> => {
      const { entityType, entityId } = split(item.id);
      const r = await reorderLectureAttachment({
        lecture_id: lectureId,
        entity_id: entityId,
        entity_type: entityType,
        sort_order: newSortOrder,
      });
      if (r.success) return { ok: true };
      return {
        ok: false,
        error:
          r.code === "forbidden" ? "У вас нет прав на изменение порядка." : r.error,
      };
    },
    [lectureId],
  );

  const onAttach = useCallback(
    async (targetId: string): Promise<AttachmentActionResult> => {
      const r = await attachToLecture({
        lecture_id: lectureId,
        entity_id: targetId,
        entity_type: pickerEntityType,
      });
      if (r.success) return { ok: true };
      return {
        ok: false,
        error:
          r.code === "forbidden" ? "У вас нет прав на прикрепление." : r.error,
      };
    },
    [lectureId, pickerEntityType],
  );

  return (
    <AttachmentsPanel
      title={title}
      items={items}
      canManage
      canAttach={canAttach}
      onDetach={onDetach}
      onReorder={onReorder}
      onAttach={onAttach}
      renderTargetPicker={({ onSelect, onClose }) => (
        <AttachTargetPicker
          fetcher={targetFetcher}
          onSelect={onSelect}
          onClose={onClose}
          placeholder={
            pickerEntityType === "document" ? "Поиск документа…" : "Поиск медиа…"
          }
        />
      )}
      emptyText="Пока ничего не прикреплено."
    />
  );
}
```

> **Заметка для исполнителя:** picker-fetcher (`targetFetcher`) — это server action, который ищет документы/медиа пользователя (например через `GET /api/documents?q=` picker или `GET /api/me/documents`). Поскольку cross-feature импорт запрещён, фетчеры документов/медиа из их слайсов нельзя дёрнуть напрямую внутри слайса lectures. Решение: страница (`page.tsx`, нейтральная зона) импортирует picker-фетчер из `@/features/documents`/`@/features/media`, если такой экспортирован, ИЛИ объявляет тонкий server action прямо в слайсе lectures, зовущий `GET /api/documents`/`GET /api/media` через `@/api/client` (это НЕ cross-feature — это прямой вызов API). См. Task 13 Step 3 — фетчер объявляем как server action в `actions.ts` слайса lectures (`searchDocumentsForAttach`, `searchMediaForAttach`).

- [ ] **Step 2: Picker-фетчеры (server actions в actions.ts)**

Дописать в `src/features/lectures/actions.ts`:

```ts
/**
 * Поиск документов для attach-пикера (GET /api/documents — picker, requiredAuth).
 * Возвращает {data:[{id,label}], total}. Прямой вызов API (НЕ cross-feature
 * импорт слайса documents — слайс lectures зовёт публичный API напрямую).
 */
export const searchDocumentsForAttach = createAction(
  async (raw: { q: string; offset: number; limit: number }) => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/documents", {
      params: { query: { q: raw.q || undefined, offset: raw.offset, limit: raw.limit } },
    });
    if (error) throw new Error(error.error ?? "Ошибка поиска документов");
    const items = (data?.data ?? []) as { id?: string; filename?: string }[];
    return {
      data: items
        .filter((d): d is { id: string; filename?: string } => Boolean(d.id))
        .map((d) => ({ id: d.id, label: d.filename ?? d.id })),
      total: data?.pagination?.total ?? null,
    };
  },
);

/** Поиск медиа для attach-пикера (GET /api/media — picker, requiredAuth). */
export const searchMediaForAttach = createAction(
  async (raw: { q: string; offset: number; limit: number }) => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/media", {
      params: { query: { q: raw.q || undefined, offset: raw.offset, limit: raw.limit } },
    });
    if (error) throw new Error(error.error ?? "Ошибка поиска медиа");
    const items = (data?.data ?? []) as { id?: string; filename?: string }[];
    return {
      data: items
        .filter((m): m is { id: string; filename?: string } => Boolean(m.id))
        .map((m) => ({ id: m.id, label: m.filename ?? m.id })),
      total: data?.pagination?.total ?? null,
    };
  },
);
```

> **Заметка:** проверь сигнатуру `GET /api/documents` и `GET /api/media` в `schema.ts` — точные имена query-параметров (`q`/`offset`/`limit`). Picker возвращает `DocumentSummary`/`MediaSummary` (поля `id`, `filename`). `createAction` возвращает `ActionResult` — на client (`async-combobox` ждёт `{data,total}`), поэтому на странице оборачиваем: client-фетчер развернёт `result.success ? result.data : {data:[],total:null}` (см. Step 3).

- [ ] **Step 3: Admin-страница attachments**

Create `src/app/admin/lectures/[id]/attachments/page.tsx`:

```tsx
import { forbidden, notFound } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  canAttachToLecture,
  canManageAttachments,
  getLectureById,
  getLectureDocuments,
  getLectureMedia,
  LectureAttachmentsManager,
  searchDocumentsForAttach,
  searchMediaForAttach,
} from "@/features/lectures";
import type { ManagedAttachment } from "@/features/lectures";

export const metadata = { title: "Прикрепления лекции" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LectureAttachmentsPage({ params }: Props) {
  const { id } = await params;
  const me = await getMe();
  const lecture = await getLectureById(id);
  if (!lecture) notFound();
  if (!canManageAttachments(me, lecture)) forbidden();

  const [docs, media] = await Promise.all([
    getLectureDocuments(id),
    getLectureMedia(id),
  ]);

  const canAttach = canAttachToLecture(me, lecture);

  const docItems: ManagedAttachment[] = docs.map((d, i) => ({
    entityId: d.id ?? "",
    entityType: "document",
    label: d.filename ?? d.id ?? "Документ",
    sortOrder: i,
  }));
  const mediaItems: ManagedAttachment[] = media.map((m, i) => ({
    entityId: m.id ?? "",
    entityType: "media",
    label: m.filename ?? m.id ?? "Медиа",
    sortOrder: i,
  }));

  async function docFetcher(q: string, offset: number, limit: number) {
    "use server";
    const r = await searchDocumentsForAttach({ q, offset, limit });
    return r.success ? r.data : { data: [], total: null };
  }
  async function mediaFetcher(q: string, offset: number, limit: number) {
    "use server";
    const r = await searchMediaForAttach({ q, offset, limit });
    return r.success ? r.data : { data: [], total: null };
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{lecture.title}: прикрепления</h1>
      <LectureAttachmentsManager
        lectureId={id}
        attachments={docItems}
        canAttach={canAttach}
        pickerEntityType="document"
        targetFetcher={docFetcher}
        title="Документы лекции"
      />
      <LectureAttachmentsManager
        lectureId={id}
        attachments={mediaItems}
        canAttach={canAttach}
        pickerEntityType="media"
        targetFetcher={mediaFetcher}
        title="Медиа лекции"
      />
    </div>
  );
}
```

> **Заметка:** `sortOrder` = индекс в списке (бек уже отдал по порядку). После reorder/detach `revalidateEntity("lectures", id)` перечитает списки. `id ?? ""` — `document.Document.id` опционален в типах schema.ts; пустая строка не выберется (бек вернёт 404/400 — обработано). reorder через панель присваивает абсолютный sort_order соседа (см. §0.4 — бек клампит).

- [ ] **Step 4: Реэкспорты**

Дописать в `src/features/lectures/index.ts`:

```ts
export { getLectureDocuments, getLectureMedia } from "./api";
export {
  attachToLecture,
  detachFromLecture,
  reorderLectureAttachment,
  searchDocumentsForAttach,
  searchMediaForAttach,
} from "./actions";
export { canManageAttachments, canAttachToLecture } from "./permissions";
export { LectureAttachmentsManager } from "./ui/lecture-attachments-manager";
export type { ManagedAttachment } from "./ui/lecture-attachments-manager";
export type {
  LectureDocument,
  LectureMediaItem,
  LectureAttachment,
  AttachmentEntityType,
} from "./types";
```

- [ ] **Step 5: Проверить компиляцию и тесты**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run src/features/lectures`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/lectures/ui/lecture-attachments-manager.tsx src/features/lectures/actions.ts src/features/lectures/index.ts "src/app/admin/lectures/[id]/attachments/page.tsx"
git commit -m "feat(lectures): attachments management admin page + AttachmentsPanel adapter"
```

---

## === MIDPOINT (после Task 13) ===

После Task 13 готово ядро: cover (загрузка/удаление/отображение) + полное управление attachments на admin-странице. Здесь — контрольная точка для ревью менеджером:

- [ ] `npm run lint && npm test && npm run build` — зелёные.
- [ ] Cover показывается на карточке/детали; admin может загрузить/заменить/удалить.
- [ ] Admin-страница `/admin/lectures/[id]/attachments` управляет прикреплениями (attach виден только при `entity.attach ∧ owner`, detach/reorder — по ownership).
- [ ] Страница лекции `src/app/lectures/[id]/page.tsx` ЕЩЁ НЕ ТРОНУТА (дерево комментариев волны 2 цело). Этапы C–D ниже добавляют секции аккуратно.

---

## Этап C — Публичная страница лекции: секции документов/медиа + exports

### Task 14: Helper прокси-ссылок exports

**Files:**
- Create: `src/features/lectures/export-urls.ts`
- Test: `src/features/lectures/export-urls.test.ts`

- [ ] **Step 1: Написать падающий тест**

Create `src/features/lectures/export-urls.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { lectureExportUrls } from "./export-urls";

describe("lectureExportUrls", () => {
  it("строит прокси-пути с экранированием id", () => {
    const u = lectureExportUrls("a b/c");
    expect(u.md).toBe("/lectures/a%20b%2Fc/export?format=md");
    expect(u.txt).toBe("/lectures/a%20b%2Fc/export?format=txt");
  });

  it("обычный uuid", () => {
    const u = lectureExportUrls("11111111-1111-1111-1111-111111111111");
    expect(u.md).toBe("/lectures/11111111-1111-1111-1111-111111111111/export?format=md");
    expect(u.txt).toBe("/lectures/11111111-1111-1111-1111-111111111111/export?format=txt");
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/features/lectures/export-urls.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализация**

Create `src/features/lectures/export-urls.ts`:

```ts
// src/features/lectures/export-urls.ts
// Чистый helper ссылок на прокси-выгрузки лекции. Без "server-only" — нужен
// тестам. Паттерн — src/features/documents/export-urls.ts.

export interface LectureExportUrls {
  md: string;
  txt: string;
}

/**
 * Ссылки на .md/.txt лекции ведут на ЛОКАЛЬНЫЙ прокси-роут
 * /lectures/{id}/export, который подкладывает Bearer из httpOnly-cookie.
 * Эндпоинты бека (GET /api/lectures/{id}.md|.txt) — optionalAuth: публичная
 * лекция доступна без токена, но приватная лекция владельца при браузерной
 * навигации без токена вернула бы 401. Прокси решает оба случая.
 */
export function lectureExportUrls(id: string): LectureExportUrls {
  const base = `/lectures/${encodeURIComponent(id)}/export`;
  return { md: `${base}?format=md`, txt: `${base}?format=txt` };
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/features/lectures/export-urls.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/lectures/export-urls.ts src/features/lectures/export-urls.test.ts
git commit -m "feat(lectures): lectureExportUrls proxy-link helper + tests"
```

---

### Task 15: Прокси-роут exports

**Files:**
- Create: `src/app/lectures/[id]/export/route.ts`

- [ ] **Step 1: Реализация**

Create `src/app/lectures/[id]/export/route.ts`:

```ts
// src/app/lectures/[id]/export/route.ts
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

/**
 * Прокси для .md/.txt выгрузок лекции. Контент рендерит бек
 * (GET /api/lectures/{id}.md|.txt — optionalAuth). Для приватной лекции
 * владельца нужен Bearer-токен, которого нет при браузерной навигации
 * (auth-middleware бека cookie не читает). Роут подкладывает токен из
 * httpOnly-cookie и возвращает ответ бека как есть (включая 401/403/404).
 * Паттерн — src/app/documents/[id]/export/route.ts.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const format = request.nextUrl.searchParams.get("format") === "txt" ? "txt" : "md";
  const token = (await cookies()).get("token")?.value;

  const upstream = await fetch(
    `${API_URL}/api/lectures/${encodeURIComponent(id)}.${format}`,
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

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/lectures/[id]/export/route.ts"
git commit -m "feat(lectures): .md/.txt export proxy route (bearer from cookie)"
```

---

### Task 16: Компонент ссылок exports + секции документов/медиа

**Files:**
- Create: `src/features/lectures/ui/lecture-export-links.tsx`
- Create: `src/features/lectures/ui/lecture-documents-section.tsx`
- Create: `src/features/lectures/ui/lecture-media-section.tsx`
- Modify: `src/features/lectures/index.ts`

- [ ] **Step 1: Ссылки экспорта**

Create `src/features/lectures/ui/lecture-export-links.tsx`:

```tsx
import { lectureExportUrls } from "../export-urls";

interface Props {
  id: string;
  className?: string;
}

/**
 * Ссылки .md/.txt лекции (через локальный прокси /lectures/[id]/export).
 * Паттерн — DocumentExportLinks.
 */
export function LectureExportLinks({ id, className }: Props) {
  const urls = lectureExportUrls(id);
  return (
    <span className={className ?? "flex items-center gap-2 text-xs text-(--color-description)"}>
      <a href={urls.md} className="hover:underline" target="_blank" rel="noopener">
        .md
      </a>
      <a href={urls.txt} className="hover:underline" target="_blank" rel="noopener">
        .txt
      </a>
    </span>
  );
}
```

- [ ] **Step 2: Секция документов**

Create `src/features/lectures/ui/lecture-documents-section.tsx`:

```tsx
import Link from "next/link";
import { getLectureDocuments } from "../api";

interface Props {
  lectureId: string;
}

/**
 * Секция «Документы лекции» на публичной странице (read-only список со
 * ссылками на /documents/{id}). Данные — GET /api/lectures/{id}/documents
 * (по sort_order). Композиция через страницу; рендер тела документа — на его
 * собственной странице.
 */
export async function LectureDocumentsSection({ lectureId }: Props) {
  const docs = await getLectureDocuments(lectureId);
  if (docs.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-label="Документы лекции">
      <h2 className="text-lg font-semibold">Документы лекции</h2>
      <ul className="flex flex-col gap-1">
        {docs.map((d) => (
          <li key={d.id}>
            <Link
              href={`/documents/${d.id}`}
              className="text-sm underline hover:no-underline"
            >
              {d.filename ?? d.id}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Секция медиа**

Create `src/features/lectures/ui/lecture-media-section.tsx`:

```tsx
import Link from "next/link";
import { getLectureMedia } from "../api";

interface Props {
  lectureId: string;
}

/**
 * Секция «Медиа лекции» на публичной странице (read-only список со ссылками
 * на /media/{id}). Данные — GET /api/lectures/{id}/media (по sort_order).
 * Плеер живёт на странице медиа; здесь — навигационный список (composition
 * через страницу, рендер плеера — слайс media на своей странице).
 */
export async function LectureMediaSection({ lectureId }: Props) {
  const items = await getLectureMedia(lectureId);
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-label="Медиа лекции">
      <h2 className="text-lg font-semibold">Медиа лекции</h2>
      <ul className="flex flex-col gap-1">
        {items.map((m) => (
          <li key={m.id}>
            <Link
              href={`/media/${m.id}`}
              className="text-sm underline hover:no-underline"
            >
              {m.filename ?? m.id}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

> **Заметка:** секции — навигационные списки (ссылки), а НЕ инлайн-плеер/рендер. Это держит композицию простой и избегает cross-feature рендера тяжёлых компонентов на странице лекции. Если потом захотят инлайн-плеер — страница (нейтральная зона) сможет импортировать `MediaPlayer` из `@/features/media` follow-up'ом. Для текущего скоупа достаточно навигации.

- [ ] **Step 4: Реэкспорты**

Дописать в `src/features/lectures/index.ts`:

```ts
export { lectureExportUrls } from "./export-urls";
export type { LectureExportUrls } from "./export-urls";
export { LectureExportLinks } from "./ui/lecture-export-links";
export { LectureDocumentsSection } from "./ui/lecture-documents-section";
export { LectureMediaSection } from "./ui/lecture-media-section";
```

- [ ] **Step 5: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/lectures/ui/lecture-export-links.tsx src/features/lectures/ui/lecture-documents-section.tsx src/features/lectures/ui/lecture-media-section.tsx src/features/lectures/index.ts
git commit -m "feat(lectures): export links + documents/media sections components"
```

---

### Task 17: Встроить секции и exports в публичную страницу лекции (АККУРАТНО)

**Files:**
- Modify: `src/app/lectures/[id]/page.tsx`

- [ ] **Step 1: Прочитать текущую страницу целиком**

Run: `cat src/app/lectures/[id]/page.tsx`
Expected: текущий код — `LectureDetail` + `CommentSection` (волна 2). **Дерево комментариев не трогаем.**

- [ ] **Step 2: Добавить секции и ссылки экспорта (НЕ удаляя комментарии)**

Заменить тело компонента `LecturePage`. Новый файл:

```tsx
// src/app/lectures/[id]/page.tsx
import { notFound } from "next/navigation";
import {
  getLectureById,
  LectureDetail,
  LectureDocumentsSection,
  LectureExportLinks,
  LectureMediaSection,
} from "@/features/lectures";
import { getLectureTags } from "@/features/tags";
import { CommentSection } from "@/features/comments";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cq?: string }>;
}

export default async function LecturePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { cq } = await searchParams;
  const [lecture, tags] = await Promise.all([
    getLectureById(id),
    getLectureTags(id),
  ]);
  if (!lecture) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <LectureDetail lecture={lecture} tags={tags} />
      <LectureExportLinks id={id} />
      {/* Секции документов/медиа лекции (lecture-enrichment, волна 3).
          Каждая сама возвращает null, если список пуст. */}
      <LectureDocumentsSection lectureId={id} />
      <LectureMediaSection lectureId={id} />
      {/* === slot: share-кнопка (share-links, волна 3, follow-up ПОСЛЕ) === */}
      <CommentSection lectureId={id} query={cq} />
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const lecture = await getLectureById(id);
  return { title: lecture?.title ?? "Лекция" };
}
```

> **КРИТИЧНО:** сохранить `CommentSection lectureId={id} query={cq}` и `searchParams: Promise<{ cq?: string }>` без изменений — это волна 2. Добавлены только три компонента (`LectureExportLinks`, `LectureDocumentsSection`, `LectureMediaSection`) и slot-комментарий для share-links. НЕ менять сигнатуру/порядок параметров комментариев.

- [ ] **Step 3: Проверить компиляцию и сборку**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/lectures/[id]/page.tsx"
git commit -m "feat(lectures): add documents/media sections + export links to lecture page (comments preserved)"
```

---

## Этап D — Glossary suggest (nice-to-have, можно отложить)

> **Замечание о приоритете (§3 спеки):** этот этап — nice-to-have. Если возникнут сложности (byte↔UTF-16, перекрытия вхождений, гость без auth), оформи его отдельной задачей-follow-up и пометь «можно отложить» — ядро (cover + attachments + секции + exports) уже даёт законченную фичу после Этапа C.

### Task 18: Чистая функция byte→UTF-16 + сегментация описания

**Files:**
- Create: `src/features/lectures/suggest-highlight.ts`
- Test: `src/features/lectures/suggest-highlight.test.ts`

- [ ] **Step 1: Написать падающие тесты**

Create `src/features/lectures/suggest-highlight.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  byteRangeToCodeUnits,
  segmentWithHighlights,
  type HighlightRange,
} from "./suggest-highlight";

describe("byteRangeToCodeUnits", () => {
  it("ASCII: байты == code units", () => {
    // "hello", термин "ell" = байты [1,4)
    expect(byteRangeToCodeUnits("hello", 1, 3)).toEqual({ start: 1, end: 4 });
  });

  it("кириллица: 'Кант' — каждая буква 2 байта UTF-8, 1 code unit", () => {
    // "Кант философ", термин "Кант" = байты [0,8) (4 буквы × 2 байта)
    const text = "Кант философ";
    expect(byteRangeToCodeUnits(text, 0, 8)).toEqual({ start: 0, end: 4 });
  });

  it("кириллица со смещением: термин 'философ' в 'Кант философ'", () => {
    // "Кант " = 4×2 + 1 = 9 байт; "философ" = 7×2 = 14 байт → [9,23)
    const text = "Кант философ";
    expect(byteRangeToCodeUnits(text, 9, 14)).toEqual({ start: 5, end: 12 });
  });

  it("эмодзи (4 байта UTF-8, 2 UTF-16 code units) после термина не ломает индекс", () => {
    // "🜂Кант": эмодзи 4 байта/2 cu; "Кант" = байты [4,12) → cu [2,6)
    const text = "🜂Кант";
    expect(byteRangeToCodeUnits(text, 4, 8)).toEqual({ start: 2, end: 6 });
  });

  it("offset за пределами строки → клампится", () => {
    const r = byteRangeToCodeUnits("hi", 100, 5);
    expect(r.start).toBeLessThanOrEqual(2);
    expect(r.end).toBeLessThanOrEqual(2);
  });
});

describe("segmentWithHighlights", () => {
  it("без вхождений → один plain-сегмент", () => {
    const segs = segmentWithHighlights("hello", []);
    expect(segs).toEqual([{ text: "hello", highlight: null }]);
  });

  it("одно вхождение в середине", () => {
    const ranges: HighlightRange[] = [{ start: 1, end: 4, termId: "t1", title: "ell" }];
    const segs = segmentWithHighlights("hello", ranges);
    expect(segs).toEqual([
      { text: "h", highlight: null },
      { text: "ell", highlight: { termId: "t1", title: "ell" } },
      { text: "o", highlight: null },
    ]);
  });

  it("перекрывающиеся вхождения: берём первое, пропускаем вложенное", () => {
    const ranges: HighlightRange[] = [
      { start: 0, end: 5, termId: "a", title: "hello" },
      { start: 1, end: 3, termId: "b", title: "el" },
    ];
    const segs = segmentWithHighlights("hello", ranges);
    expect(segs).toEqual([
      { text: "hello", highlight: { termId: "a", title: "hello" } },
    ]);
  });

  it("несколько непересекающихся вхождений по порядку", () => {
    const ranges: HighlightRange[] = [
      { start: 6, end: 11, termId: "b", title: "world" },
      { start: 0, end: 5, termId: "a", title: "hello" },
    ];
    const segs = segmentWithHighlights("hello world", ranges);
    expect(segs).toEqual([
      { text: "hello", highlight: { termId: "a", title: "hello" } },
      { text: " ", highlight: null },
      { text: "world", highlight: { termId: "b", title: "world" } },
    ]);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/features/lectures/suggest-highlight.test.ts`
Expected: FAIL (модуль не найден).

- [ ] **Step 3: Реализация**

Create `src/features/lectures/suggest-highlight.ts`:

```ts
// src/features/lectures/suggest-highlight.ts
// Чистые функции подсветки терминов глоссария в тексте. Без "server-only":
// используются client-компонентом и тестами.
//
// КРИТИЧНО: бек (POST /api/glossary/suggest) отдаёт offset/length в БАЙТАХ
// UTF-8 (Go string indexing). JavaScript-строки индексируются по UTF-16
// code units. Здесь — конверсия byte-range → code-unit-range.

export interface CodeUnitRange {
  start: number;
  end: number;
}

export interface HighlightRange {
  /** Code-unit start (после конверсии). */
  start: number;
  /** Code-unit end (exclusive). */
  end: number;
  termId: string;
  title: string;
}

export interface Segment {
  text: string;
  highlight: { termId: string; title: string } | null;
}

/**
 * Конвертирует байтовый диапазон UTF-8 [byteOffset, byteOffset+byteLength) в
 * диапазон UTF-16 code units строки JS. Проходит строку по code points,
 * считая байты UTF-8 каждого, и фиксирует code-unit-позиции на границах.
 * Вне диапазона — клампится к длине строки.
 */
export function byteRangeToCodeUnits(
  text: string,
  byteOffset: number,
  byteLength: number,
): CodeUnitRange {
  const byteEnd = byteOffset + byteLength;
  let bytes = 0;
  let startCU: number | null = null;
  let endCU: number | null = null;

  // Итерация по code points (for..of даёт code points, не code units).
  let cu = 0; // текущая позиция в code units
  for (const ch of text) {
    if (bytes === byteOffset && startCU === null) startCU = cu;
    if (bytes === byteEnd && endCU === null) endCU = cu;
    bytes += utf8Len(ch.codePointAt(0)!);
    cu += ch.length; // 1 для BMP, 2 для суррогатных пар
    if (bytes > byteOffset && startCU === null) startCU = cu - ch.length;
  }
  if (bytes === byteOffset && startCU === null) startCU = cu;
  if (bytes === byteEnd && endCU === null) endCU = cu;

  const total = text.length;
  const start = Math.min(startCU ?? total, total);
  const end = Math.min(endCU ?? total, total);
  return { start, end: Math.max(start, end) };
}

/** Число байт UTF-8 для code point. */
function utf8Len(cp: number): number {
  if (cp <= 0x7f) return 1;
  if (cp <= 0x7ff) return 2;
  if (cp <= 0xffff) return 3;
  return 4;
}

/**
 * Разбивает text на сегменты (plain / highlight). ranges — в code units.
 * Перекрывающиеся диапазоны: берём первый по start, вложенные/пересекающиеся
 * пропускаем (бек может вернуть пересечения — не валим рендер). Сортирует по
 * start. Гарантирует покрытие всей строки.
 */
export function segmentWithHighlights(
  text: string,
  ranges: HighlightRange[],
): Segment[] {
  const sorted = [...ranges]
    .filter((r) => r.start < r.end && r.start >= 0 && r.end <= text.length)
    .sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const r of sorted) {
    if (r.start < cursor) continue; // перекрытие — пропускаем
    if (r.start > cursor) {
      segments.push({ text: text.slice(cursor, r.start), highlight: null });
    }
    segments.push({
      text: text.slice(r.start, r.end),
      highlight: { termId: r.termId, title: r.title },
    });
    cursor = r.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlight: null });
  }
  if (segments.length === 0) {
    segments.push({ text, highlight: null });
  }
  return segments;
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/features/lectures/suggest-highlight.test.ts`
Expected: PASS (все кейсы).

> **Заметка для исполнителя:** byte→code-unit конверсия тонкая. Если какой-то тест падает на граничном кейсе (эмодзи/смещение) — это нормально для TDD: правь `byteRangeToCodeUnits` пока зелёное, НЕ ослабляя тесты. Логика: пройти строку по code points, на границе нужного байтового offset зафиксировать текущую code-unit-позицию.

- [ ] **Step 5: Commit**

```bash
git add src/features/lectures/suggest-highlight.ts src/features/lectures/suggest-highlight.test.ts
git commit -m "feat(lectures): byte→UTF-16 highlight conversion + segmentation (suggest)"
```

---

### Task 19: Suggest server action + suggest-схема

**Files:**
- Modify: `src/features/lectures/schemas.ts`
- Modify: `src/features/lectures/schemas.test.ts`
- Modify: `src/features/lectures/actions.ts`

- [ ] **Step 1: Написать падающий тест схемы**

Дописать в `src/features/lectures/schemas.test.ts` (импорт `LectureSuggestSchema`):

```ts
describe("LectureSuggestSchema", () => {
  it("принимает непустые блоки", () => {
    const r = LectureSuggestSchema.safeParse({
      blocks: [{ block_id: "b1", text: "Кант философ" }],
    });
    expect(r.success).toBe(true);
  });

  it("отклоняет пустой список блоков", () => {
    const r = LectureSuggestSchema.safeParse({ blocks: [] });
    expect(r.success).toBe(false);
  });

  it("отклоняет блок без block_id", () => {
    const r = LectureSuggestSchema.safeParse({
      blocks: [{ block_id: "", text: "x" }],
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run src/features/lectures/schemas.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализация схемы**

Дописать в `src/features/lectures/schemas.ts`:

```ts
export const LectureSuggestSchema = z.object({
  blocks: z
    .array(
      z.object({
        block_id: z.string().min(1),
        text: z.string().max(50000),
      }),
    )
    .min(1, "Нужен хотя бы один блок")
    .max(500),
});

export type LectureSuggestInput = z.infer<typeof LectureSuggestSchema>;
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run src/features/lectures/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Реализация action**

Дописать в `src/features/lectures/actions.ts` (импорт `LectureSuggestSchema`):

```ts
/**
 * POST /api/glossary/suggest — найти термины глоссария в блоках текста.
 * requiredAuth (гость → бек 401 → ForbiddenError → forbidden-код; вызывающий
 * деградирует до plain-текста). offset/length в ответе — БАЙТЫ (см.
 * suggest-highlight.ts конверсию). Возвращаем suggestions как есть.
 */
export const suggestGlossaryTerms = createAction(
  async (raw: { blocks: { block_id: string; text: string }[] }) => {
    const input = LectureSuggestSchema.parse(raw);
    const api = await createApiClient();
    const { data, error } = await api.POST("/api/glossary/suggest", {
      body: { blocks: input.blocks },
    });
    if (error) rethrowApiError(error as ApiError);
    return data?.data?.suggestions ?? [];
  },
);
```

- [ ] **Step 6: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/lectures/schemas.ts src/features/lectures/schemas.test.ts src/features/lectures/actions.ts
git commit -m "feat(lectures): suggestGlossaryTerms action + suggest schema"
```

---

### Task 20: Описание с подсветкой терминов + интеграция в LectureDetail

**Files:**
- Create: `src/features/lectures/ui/lecture-description.tsx`
- Modify: `src/features/lectures/ui/lecture-detail.tsx`
- Modify: `src/features/lectures/index.ts`

- [ ] **Step 1: Client-компонент описания**

Create `src/features/lectures/ui/lecture-description.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { suggestGlossaryTerms } from "../actions";
import {
  byteRangeToCodeUnits,
  segmentWithHighlights,
  type HighlightRange,
} from "../suggest-highlight";

interface Props {
  description: string;
  /** Стабильный id блока описания для запроса suggest. */
  blockId?: string;
}

/**
 * Описание лекции с подсветкой терминов глоссария. Грузит suggest на клиенте
 * (requiredAuth — гостю вернётся forbidden, тихо показываем plain-текст).
 * Конвертирует байтовые offset бека → UTF-16 (suggest-highlight.ts).
 * Прогрессивное улучшение: до ответа и при ошибке — обычный текст.
 */
export function LectureDescription({ description, blockId = "lecture-description" }: Props) {
  const [ranges, setRanges] = useState<HighlightRange[]>([]);

  useEffect(() => {
    if (!description) return;
    let cancelled = false;
    (async () => {
      const r = await suggestGlossaryTerms({
        blocks: [{ block_id: blockId, text: description }],
      });
      if (cancelled || !r.success) return;
      const next: HighlightRange[] = [];
      for (const sug of r.data) {
        for (const occ of sug.occurrences ?? []) {
          if (occ.block_id !== blockId) continue;
          if (typeof occ.offset !== "number" || typeof occ.length !== "number") continue;
          const { start, end } = byteRangeToCodeUnits(description, occ.offset, occ.length);
          if (start < end) {
            next.push({
              start,
              end,
              termId: sug.term_id ?? "",
              title: sug.title ?? "",
            });
          }
        }
      }
      setRanges(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [description, blockId]);

  const segments = segmentWithHighlights(description, ranges);

  return (
    <div className="whitespace-pre-wrap text-base">
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark
            key={i}
            title={seg.highlight.title}
            data-term-id={seg.highlight.termId}
            className="rounded bg-(--color-text-pane) px-0.5"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </div>
  );
}
```

- [ ] **Step 2: Подключить в LectureDetail**

В `src/features/lectures/ui/lecture-detail.tsx` заменить блок описания. Импорт:

```tsx
import { LectureDescription } from "./lecture-description";
```

Заменить:

```tsx
{lecture.description && (
  <div className="whitespace-pre-wrap text-base">{lecture.description}</div>
)}
```

на:

```tsx
{lecture.description && <LectureDescription description={lecture.description} />}
```

- [ ] **Step 3: Реэкспорты**

Дописать в `src/features/lectures/index.ts`:

```ts
export { suggestGlossaryTerms } from "./actions";
export { LectureDescription } from "./ui/lecture-description";
export {
  byteRangeToCodeUnits,
  segmentWithHighlights,
} from "./suggest-highlight";
export type {
  HighlightRange,
  Segment,
  CodeUnitRange,
} from "./suggest-highlight";
export type {
  GlossarySuggestion,
  GlossaryOccurrence,
} from "./types";
```

- [ ] **Step 4: Проверить компиляцию и тесты**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run src/features/lectures`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/lectures/ui/lecture-description.tsx src/features/lectures/ui/lecture-detail.tsx src/features/lectures/index.ts
git commit -m "feat(lectures): glossary term highlighting in lecture description (nice-to-have)"
```

---

## Финал

### Task 21: Полный прогон + self-review

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: PASS (без отключений ESLint-правил; cross-feature/deep-import гарды зелёные).

- [ ] **Step 2: Тесты**

Run: `npm test`
Expected: PASS (включая новые permissions/schemas/cover-url/export-urls/suggest-highlight).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Self-review по чеклисту**

- [ ] Cover: загрузка/замена/удаление в admin-форме (owner-only); показ на карточке и детали. ✓
- [ ] Attachments: admin-страница; attach виден при `entity.attach ∧ owner`; detach/reorder по ownership; canvas-плашка (если придёт). ✓
- [ ] Секции «Документы лекции»/«Медиа лекции» на публичной странице; дерево комментариев волны 2 цело. ✓
- [ ] `.md/.txt` — прокси-роут + ссылки. ✓
- [ ] Glossary suggest — подсветка (byte→UTF-16), деградация для гостя. ✓
- [ ] Тесты: permissions (canManageCover, canManageAttachments, canAttachToLecture — 4+ кейса каждый), schemas (cover/attach/detach/reorder/suggest — success+failure), чистые helpers (cover-url, export-urls, suggest-highlight). ✓
- [ ] `import "server-only"` в api/actions/permissions/schemas. ✓
- [ ] UPPER_SNAKE-коды (rethrowApiError), exactOptionalPropertyTypes (conditional spread), branded 403. ✓

- [ ] **Step 5: Финальный commit (если остались несохранённые правки)**

```bash
git add src/features/lectures src/app/lectures src/app/admin/lectures
git commit -m "chore(lectures): lecture-enrichment wave-3 final pass (lint/test/build green)"
```

---

## Parallel-safety contract

Параллельно в волне 3 работают: `forms`, `trails`, `share-links`, `search`. Эта фича (`lecture-enrichment`) — **расширение существующего слайса `src/features/lectures`** и зон страниц лекции.

**CREATE (новые файлы — конфликтов быть не может):**
- `src/features/lectures/cover-url.ts` (+`.test.ts`)
- `src/features/lectures/export-urls.ts` (+`.test.ts`)
- `src/features/lectures/suggest-highlight.ts` (+`.test.ts`)
- `src/features/lectures/ui/lecture-cover-form.tsx`
- `src/features/lectures/ui/lecture-attachments-manager.tsx`
- `src/features/lectures/ui/lecture-export-links.tsx`
- `src/features/lectures/ui/lecture-documents-section.tsx`
- `src/features/lectures/ui/lecture-media-section.tsx`
- `src/features/lectures/ui/lecture-description.tsx`
- `src/app/lectures/[id]/export/route.ts`
- `src/app/admin/lectures/[id]/attachments/page.tsx`

**MODIFY (существующие файлы слайса lectures и страниц лекции — ЗАРЕЗЕРВИРОВАНЫ за этой фичей):**
- `src/features/lectures/api.ts`
- `src/features/lectures/actions.ts`
- `src/features/lectures/permissions.ts` (+`.test.ts`)
- `src/features/lectures/schemas.ts` (+`.test.ts`)
- `src/features/lectures/types.ts`
- `src/features/lectures/index.ts`
- `src/features/lectures/ui/lecture-card.tsx`
- `src/features/lectures/ui/lecture-detail.tsx`
- `src/app/lectures/[id]/page.tsx` — **критично**: содержит дерево комментариев волны 2 (`CommentSection`). Только ДОБАВЛЯЕМ секции и ссылки, ничего не удаляем (см. Task 17). Менеджер: эта фича — единственная в волне 3, кто трогает страницу лекции (forms/trails/search её НЕ трогают). **share-links** добавит share-кнопку на эту страницу follow-up'ом ПОСЛЕ мержа lecture-enrichment — для этого в Task 17 Step 2 оставлен размеченный slot-комментарий `{/* === slot: share-кнопка ... === */}`.
- `src/app/admin/lectures/[id]/edit/page.tsx` — содержит `LectureEditForm` + `LectureTagsForm` (волна 1). Только ДОБАВЛЯЕМ cover-секцию и ссылку на attachments (Task 8), ничего не удаляем.

**RESERVE (НЕ ТРОГАЕМ — чужие/запретные зоны):**
- `src/utils/permissions.ts` — запретная зона. `entity.attach` и `lecture.upload_files` УЖЕ в union — добавлять ничего не нужно, читаем как есть.
- `src/api/schema.ts` — запретная зона. Все нужные пути/схемы уже сгенерированы (cover/attachments/documents/media/tags/suggest есть — сверено).
- `src/api/tags.ts` — НЕ модифицируем (`LECTURES` уже есть).
- `src/components/attachments/*` — generic-компонент (владелец — documents, волна 2). **Только импортируем** через `@/components/attachments`, контракт не меняем.
- `src/components/ast-editor/*` — импортируем `uploadImage` (deep-import в `@/components` легален), НЕ модифицируем.
- `src/components/ui/*` — UI-kit, запретная зона.
- `src/app/admin/layout.tsx`, `src/app/admin/admin-sidebar.tsx`, header, `src/app/layout.tsx` — запретные зоны. Foundation-touch для волны 3 (trails/forms/share-links/search) делает выделенный агент; **для lecture-enrichment foundation-touch НЕ требуется** (пункты лекций в sidebar/header уже есть — §3 спеки).
- `src/features/documents/*`, `src/features/media/*`, `src/features/glossary/*`, `src/features/tags/*`, `src/features/comments/*` — чужие слайсы. ESLint запрещает cross-feature импорт. Композиция документов/медиа на странице лекции — через `page.tsx` (нейтральная зона импортирует их публичные компоненты/fetchers, если нужно). В этой фиче страница лекции импортирует ТОЛЬКО компоненты слайса lectures (`LectureDocumentsSection`/`LectureMediaSection`), которые сами читают `GET /api/lectures/{id}/documents|media` — кросс-слайсовая зависимость не нужна.

**Слот для share-links (волна 3, follow-up):** в `src/app/lectures/[id]/page.tsx` (Task 17) размечен slot-комментарий перед `<CommentSection>`. Агент share-links добавит туда share-кнопку из своего слайса follow-up-коммитом ПОСЛЕ мержа lecture-enrichment. Менеджер фиксирует порядок мержа: lecture-enrichment → share-links (для страницы лекции).

---

## Foundation-touch

**Для `lecture-enrichment` foundation-touch НЕ требуется** (§3 спеки, раздел волны 3: «lecture-пункты в sidebar уже есть»). Никаких касаний запретных зон в этой фиче нет. `entity.attach`/`lecture.upload_files` уже в union `Capability` (волна 2 foundation-touch добавила их) — миграция не нужна.

---

## Контракт для других Plan-агентов волны 3

**share-links:** на страницу лекции `src/app/lectures/[id]/page.tsx` НЕ заходить до мержа lecture-enrichment. После мержа — добавить share-кнопку в размеченный slot (перед `<CommentSection>`), импортируя её из своего слайса (композиция через страницу). Сигнатуру `LecturePage`/`CommentSection` не менять.

**forms / trails / search:** страницу лекции и слайс `src/features/lectures` НЕ трогают вовсе.

---

## Риски

1. **Cover-upload двухшаговый, частичный сбой.** `uploadImage` может пройти, а `setLectureCover` — упасть (например `UPLOAD_NOT_FOUND` если upload истёк, или 403). Митигейшен: `LectureCoverForm` показывает ошибку и НЕ обновляет превью при сбое второго шага; пользователь повторяет загрузку. Загруженный, но не промоутнутый upload остаётся orphan на беке (его GC — забота бека). Риск UX — низкий. **Проверь на dev-беке:** что `PromoteToCover` принимает свежий `upload_id` сразу после `/api/uploads/images` (нет ли требования к MIME/размеру cover отдельно от image-upload). Если cover-валидация строже image-upload — добавь маппинг кода в `rethrowApiError`.

2. **Cover отдаёт 204, не лекцию.** Фронт не получает обновлённый `cover_image_key` из ответа PUT — полагается на `revalidateEntity` + перечитку. В `LectureCoverForm` оптимистично ставим `up.data.storage_key` локально (он совпадает с тем, что бек запишет в `cover_image_key`). Риск: если бек преобразует ключ (вряд ли — cover_image_key = storage_key промоутнутого upload). **Проверь:** что `cover_image_key` лекции после PUT == `storage_key` из ответа `/api/uploads/images`. Если нет — убрать оптимистику, полагаться только на revalidate (превью обновится после навигации/refresh).

3. **`<img>` вместо `next/image`.** Используем сырой `<img>` (с `eslint-disable @next/next/no-img-element`), т.к. storage-домен не сконфигурирован в `next.config` (запретная зона — `package.json`/конфиги не трогаем). Тот же подход, что у ast-editor image. Риск: нет оптимизации картинок — приемлемо. НЕ добавлять домены в `next.config` без отдельной задачи.

4. **§10.4 «attach мёртв».** По коду бека (`internal/attachment/service.go`) attach требует `entity.attach` ∧ ownership; admin-владелец оба условия имеет → attach для него РАБОТАЕТ (в отличие от формулировки §10.4, которая предполагала, что у admin нет `entity.attach` — но по `capabilities.go` он есть). Поэтому кнопка attach на admin-странице покажется admin-владельцу лекции. Если на реальном беке поведение иное (например admin реально не проходит) — UI просто покажет forbidden-текст при попытке, ничего не сломается. **Согласовано:** строим по коду бека, не по §10.4.

5. **Glossary suggest: byte↔UTF-16 (Task 18).** Самый хрупкий участок. offset/length бека — байты UTF-8; описания лекций по-русски (кириллица 2 байта/символ) → без конверсии подсветка сместится. `byteRangeToCodeUnits` покрыт тестами на ASCII/кириллицу/эмодзи. Риск: если бек на самом деле отдаёт rune-индексы (не байты) — подсветка сместится. **Проверь на dev-беке:** отправь suggest с кириллическим текстом, где термин не в начале, сверь offset с байтовым vs rune-индексом. Если rune — заменить `utf8Len`-логику на code-point-индексацию (тривиально). Этот этап — nice-to-have: при сомнениях оформить follow-up и отложить (см. примечание Этапа D).

6. **Suggest требует auth — гость.** `POST /api/glossary/suggest` — `requiredAuth`. Гость получит 401 → `ForbiddenError` → `suggestGlossaryTerms` вернёт `{success:false, code:"forbidden"}` → `LectureDescription` тихо покажет plain-текст (прогрессивное улучшение). Не показываем гостю ошибку. Корректно.

7. **Picker-фетчеры (`searchDocumentsForAttach`/`searchMediaForAttach`) через `GET /api/documents`/`/api/media`.** Проверь точные query-параметры picker-эндпоинтов в `schema.ts` (имена `q`/`offset`/`limit`; формат ответа `DocumentSummary`/`MediaSummary` с полями `id`,`filename`). Если picker media использует другое имя поля (не `filename`) — поправь маппинг label. Эти фетчеры зовут публичный API напрямую из слайса lectures (НЕ cross-feature импорт слайсов documents/media — ESLint это разрешает, т.к. импортируется только `@/api/client`).

8. **Секции документов/медиа — навигационные списки, не инлайн-рендер.** Сознательное решение: показываем ссылки на `/documents/{id}` и `/media/{id}`, а не инлайним `DocumentDetail`/`MediaPlayer` (избегаем тяжёлой композиции и cross-feature связности). Если потребуется инлайн-плеер — страница (нейтральная зона) сможет импортировать `MediaPlayer` из `@/features/media` follow-up'ом. Для текущего скоупа спеки («блоки документов/медиа на странице лекции») навигационные секции достаточны; при ревью уточнить, нужен ли инлайн-рендер — тогда добавить отдельной задачей.

9. **`reorder` не атомарный swap.** `AttachmentsPanel` присваивает абсолютный `sort_order` соседа (не обменивает). Бек клампит в `[0,N-1]`. После каждого reorder `revalidateEntity` перечитывает порядок. Возможны кратковременные коллизии sort_order при быстрых кликах — бек разрулит при следующей перечитке. Риск низкий (admin-операция, редкая).

10. **`document.Document`/`media.Media` поля опциональны в schema.ts (`id?`, `filename?`).** Везде используем `?? id ?? "fallback"` и фильтруем пустые. Риск рантайм-undefined закрыт guard'ами.

---

## Чеклист соответствия спеке (self-review)

- Cover в admin-форме лекции (multipart-flow upload→promote, owner-only) — Task 5/6/8 ✓
- Cover на странице/карточке (URL из cover_image_key) — Task 2/7 ✓
- Attachments management через `@/components/attachments` (attach-гейт `entity.attach ∧ owner`, detach/reorder ownership-only, §6.3) — Task 11/12/13 ✓
- `entity_type=canvas` graceful-плашка (§4) — делает `AttachmentsPanel` (entityType==="canvas"); из document/media-эндпоинтов canvas не придёт — Task 13 заметка ✓
- Фетч GET /api/lectures/{id}/documents|media — Task 9 ✓
- Блоки документов/медиа на публичной странице (композиция через страницу, НЕ cross-feature) — Task 16/17 ✓
- Дерево комментариев волны 2 сохранено — Task 17 (критическая заметка) ✓
- `.md/.txt` лекций — прокси (optionalAuth, private→token) — Task 14/15/16/17 ✓
- glossary suggest (nice-to-have, в конце) — Этап D (Task 18–20), помечен «можно отложить» ✓
- Уроки волн 1-2 (UPPER_SNAKE, exactOptionalPropertyTypes, branded 403, server-only, owner-aware RBAC — мутации лекции owner-only без admin-override §6.4) — всюду ✓
- Foundation-touch не требуется (§3 спеки) — зафиксировано ✓
- Тесты: permissions 3 новых хелпера (4+ кейса), schemas 6 схем (success+failure), 3 чистых helper-модуля — Task 2/3/4/10/11/14/18/19 ✓
- Parallel-safety contract (резерв lectures/* + страницы лекции; slot для share-links) — ✓
- Midpoint (после Task 13) — ✓
