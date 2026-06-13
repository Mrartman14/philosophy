# План реализации фичи `documents` (волна 2)

> **Для агентов-исполнителей:** ОБЯЗАТЕЛЬНЫЙ САБ-СКИЛЛ — `superpowers:subagent-driven-development` (рекомендуется) или `superpowers:executing-plans`. Выполняй план задача-за-задачей. Шаги размечены чекбоксами (`- [ ]`).
>
> **ПРАВИЛА ПАРАЛЛЕЛЬНОЙ РАБОТЫ (передавай ДОСЛОВНО каждому своему субагенту):**
> - НЕ делать `git stash`, `git reset`, `git checkout .`, `git clean` и прочие деструктивные git-операции.
> - НЕ откатывать и не перезаписывать изменения других агентов.
> - НЕ делать `git add -A` / `git add .` — добавлять только свои файлы по имени.
> - Push заблокирован. Работаем только локально, мержит менеджер.
> - Общение с пользователем — на русском. Файлы/папки в `src/` — kebab-case.

**Goal:** Реализовать слайс `src/features/documents/` (мои документы, страница документа, два пути создания, редактирование blocks/метаданных, видимость private→public, удаление, ревизии, список лекций-контейнеров, admin-список) и доменно-нейтральный generic-компонент `src/components/attachments/` (attach/detach/reorder сущности к лекции).

**Architecture:** SSR-first слайс по конвенциям `docs/frontend-conventions.md`: server-only `api.ts`/`actions.ts`/`permissions.ts`/`schemas.ts`, client-формы через `useActionState` + Base UI `Form` + Zod через `parseFormData`. AST-блоки редактируются готовым `@/components/ast-editor`, рендерятся `@/components/ast-render`, ревизии — через generic `@/components/revision-history`. Права: `requireCapability` в actions, `canX()` в server components, boolean-пропсы в client. `.md/.txt` выгрузки документа — через прокси-роут (как у events), потому что эндпоинты `optionalAuth` и для приватных документов владельца нужен токен из cookie. Generic `src/components/attachments/` — чисто презентационный: данные и actions приходят пропами, целевую сущность ищет через `AsyncCombobox` из `@/components/ast-editor/pickers/`.

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), TypeScript (`exactOptionalPropertyTypes`), Zod, `openapi-fetch` (`@/api/client`), Vitest + jsdom, Base UI (`@/components/ui`), TipTap-обёртка `@/components/ast-editor`.

---

## 0. Контекст и факты бекенда (прочитать ДО старта)

Источник истины — бекенд `/Users/alexander.borisenko/Documents/philosophy-api`. Ниже — сверенные с кодом факты (`internal/document/`, `internal/attachment/`, `internal/rbac/capabilities.go`, `cmd/server/main.go`). При расхождении со `schema.ts` верь бекенду (см. §10 спеки `docs/superpowers/specs/2026-06-12-backend-coverage-program-design.md`).

### 0.1. Capabilities (строго из `internal/rbac/capabilities.go`)

- `document.create` — есть у роли **user И admin**.
- `document.delete_any` — есть **только у admin**.
- `entity.attach` — есть у роли **user** (admin как супермножество тоже имеет, но практически attach мёртв — см. §10.4 спеки).

**ВАЖНО:** в `src/utils/permissions.ts` (запретная зона, foundation-touch) union `Capability` **НЕ содержит** `document.create`, `document.delete_any`, `entity.attach`. Поэтому в слайсе используем **локальный capability-чек** через узкий helper (паттерн волны 1 — не трогаем `permissions.ts`). См. Задачу 3 (`hasCap`). Миграция в union — отдельный foundation-touch (см. секцию «Foundation-touch» в конце).

### 0.2. Маршруты документов

| Метод | Путь | Auth | Capability | Ответ |
| --- | --- | --- | --- | --- |
| GET | `/api/documents` | requiredAuth | — | `document.DocumentSummary[]` (picker, `?q=` по filename) |
| GET | `/api/documents/{document_id}` | optionalAuth + shareToken | — | `document.Document` |
| GET | `/api/documents/{document_id}.md` / `.txt` | optionalAuth + shareToken | — | text (рендерит бек) |
| GET | `/api/documents/{id}/attachments` | optionalAuth + shareToken | — | `attachment.AttachmentDTO[]` (reverse: в каких лекциях документ) |
| GET | `/api/documents/{id}/revisions` | optionalAuth + shareToken | — | `revision.RevisionMeta[]` (только public-документы) |
| GET | `/api/documents/{id}/revisions/{revisionID}` | optionalAuth + shareToken | — | `revision.Revision` |
| GET | `/api/me/documents` | requiredAuth | — | `document.Document[]` (пагинация offset/limit, опц. `free_floating`) |
| POST | `/api/documents` | requiredAuth | document.create | `document.Document` (JSON create) |
| POST | `/api/documents/upload` | requiredAuth | document.create | `document.Document` (multipart `.md`) |
| PATCH | `/api/documents/{document_id}` | requiredAuth | — (owner-only) | `document.Document` (только `title`) |
| PUT | `/api/documents/{document_id}/blocks` | requiredAuth | — (owner-only) | `document.Document` |
| PATCH | `/api/documents/{document_id}/visibility` | requiredAuth | — (owner-only) | `document.Document` |
| DELETE | `/api/documents/{document_id}` | requiredAuth | — (owner ИЛИ delete_any) | 204 |
| GET | `/api/admin/documents` | requiredAuth | document.delete_any | `document.Document[]` (только НЕ-private; `?owner_id=`) |
| DELETE | `/api/admin/documents/{document_id}` | requiredAuth | document.delete_any | 204 (только НЕ-private) |

### 0.3. Гейты (verbatim из `internal/document/service.go`)

- **Update / Blocks / Visibility — owner-only:** `if doc.OwnerID != actor.UserID { if private → NotFound("document"); else Forbidden }`. Никакого admin-override. UI гейтит на `me.id === document.owner_id`.
- **Delete:** owner может удалить любой; admin с `document.delete_any` — **только НЕ-private** (private → 404). UI: кнопка delete на странице документа — owner-only; admin-delete — только в `/admin/documents` (список и так только public).
- **Visibility:** `if doc.Visibility == public && newVis == private → 422 PUBLIC_IMMUTABLE`. UI **не предлагает даунгрейд** — кнопка «Сделать публичным» показывается только для private-документа владельца.
- **Ревизии создаются только при мутации public-документа** (`if doc.Visibility == public`). Значит у private-документа список ревизий пуст — секцию ревизий показываем только для public-документов.

### 0.4. Формы запросов (verbatim)

- `CreateDocumentRequest`: `{ title: string (1..500, required), blocks: ast.Block[] (1..20000, required), visibility?: "private"|"public" }`. Дефолт visibility — private.
- multipart upload: поля `file` (обязательно, расширения `.md`/`.markdown`, ≤10MB), `visibility` (опц., "private"/"public"). Бек извлекает `filename` из загруженного файла.
- `UpdateDocumentRequest`: `{ title?: string (1..500) }`. **Только title.** (Внимание: ответ `document.Document` НЕ содержит поле `title` — там `filename`. См. §0.6.)
- `UpdateBlocksRequest`: `{ blocks: ast.Block[] (1..20000, required) }`. Семантика: пустой id → insert, существующий id → update, отсутствует в payload → delete.
- `SetVisibilityRequest`: `{ visibility: "private"|"public" (required) }`.

### 0.5. Коды ошибок (UPPER_SNAKE_CASE, verbatim)

- `DOCUMENT_REFERENCED` (409) — на документ ссылаются другие материалы (нельзя удалить).
- `BLOCK_REFERENCED` (409) — на блок ссылаются извне документа (нельзя удалить блок).
- `BLOCKS_HAVE_ANCHORS` (409) — у блока есть привязанные комментарии.
- `PUBLIC_IMMUTABLE` (422) — попытка public→private.
- `ALREADY_ATTACHED` (409) — сущность уже прикреплена к контейнеру.
- `BLOCKS_EMPTY`/`BLOCKS_INVALID`/`BLOCK_ID_UNKNOWN`/`DUPLICATE_BLOCK_ID`/`REF_NOT_FOUND`/`IMAGE_UNKNOWN_KEY` (422) — валидация blocks.
- `INVALID_ENTITY_TYPE` (422) — неизвестный entity_type при attach.

### 0.6. Формы ответов (`schema.ts`, сверено)

- `document.Document`: `{ blocks?, created_at?, filename?, id?, owner_id?, updated_at?, visibility? }`. **Нет `title`** — отображаемое имя берём из `filename`.
- `document.DocumentSummary`: `{ filename?, id?, owner_id?, updated_at?, visibility? }`. Без `blocks`/`created_at`.
- `access.Visibility` — строковый enum `"private" | "public"` (значение приходит как `components["schemas"]["access.Visibility"]`).
- `attachment.AttachmentDTO`: `{ attached_at?, container_id?, container_type?, entity_id?, entity_type?, sort_order? }`. Для reverse-lookup документа: `container_type === "lecture"`, `container_id` = id лекции, `entity_type === "document"`, `entity_id` = id документа.

### 0.7. Attachments (generic компонент)

- POST attach: `POST /api/lectures/{lectureID}/attachments`, body `attachment.CreateAttachmentRequest`: `{ entity_type: "document"|"media"|"canvas", entity_id: string, sort_order?: number }`. Гейт: `entity.attach` ∧ `lecture.owner_id === actor`. 409 `ALREADY_ATTACHED` при дубле.
- DELETE detach: `DELETE /api/lectures/{lectureID}/attachments/{entityType}/{entityID}`. Гейт: только `lecture.owner_id === actor` (без capability).
- PATCH reorder: `PATCH /api/lectures/{lectureID}/attachments/{entityType}/{entityID}`, body `{ sort_order: number }`. Гейт: только ownership.
- **На странице документа волны 2** показываем reverse-lookup (`GET /api/documents/{id}/attachments`) как **read-only список лекций-контейнеров**. Управление attach/detach/reorder с двух сторон — это `lecture-enrichment` (волна 3, страница лекции). Поэтому в волне 2: generic-компонент `src/components/attachments/` строится ПОЛНОСТЬЮ (props-контракт + UI), но на странице документа подключается только его **read-only-режим** (список без кнопок управления) — `attach`/`detach`/`reorder` actions со стороны документа не нужны (страница лекции — чужая зона `comments`/lecture-enrichment, см. Parallel-safety). Generic-компонент тестируется изолированно.

### 0.8. `.md`/`.txt` — решение: ПРОКСИ-РОУТ

Эндпоинты `GET /api/documents/{id}.md|.txt` — `optionalAuth + shareTokenMW`. Public-документ доступен анониму (прямая ссылка сработала бы), НО приватный документ владельца требует Bearer-токен, которого нет при браузерной навигации (auth-middleware бека cookie не читает). Страница документа показывает и private (владельцу), и public. Чтобы ссылки работали для ОБОИХ случаев — используем **прокси-роут** (паттерн `src/app/admin/events/[id]/export/route.ts`): `src/app/documents/[id]/export/route.ts` подкладывает токен из httpOnly-cookie. Для public-документов токен тоже не помешает (бек его примет). Это единообразно и безопасно.

---

## Структура файлов

**Создаём (слайс `src/features/documents/`):**
- `index.ts` — public API слайса.
- `types.ts` — сужения из `@/api/schema`.
- `api.ts` — server-only фетчеры.
- `actions.ts` — server actions (create JSON, create upload, patch title, put blocks, set visibility, delete, admin delete).
- `permissions.ts` — `canCreateDocument`, `canEditDocument(me, doc)`, `canDeleteDocument(me, doc)`, `canAdminDeleteDocument(me, doc)`, `canListAdminDocuments`, `canSeeRevisions(doc)`.
- `permissions.test.ts` — тесты прав.
- `schemas.ts` — Zod-схемы.
- `schemas.test.ts` — тесты схем.
- `export-urls.ts` + `export-urls.test.ts` — чистый helper путей прокси-ссылок.
- `ui/document-create-form.tsx` — создание JSON-документа (title + AstEditor + visibility).
- `ui/document-upload-form.tsx` — multipart upload `.md`.
- `ui/document-edit-form.tsx` — редактирование blocks (AstEditor, owner-only).
- `ui/document-meta-form.tsx` — PATCH title.
- `ui/document-visibility-button.tsx` — private→public.
- `ui/document-delete-button.tsx` — удаление (ConfirmDialog).
- `ui/document-detail.tsx` — AstRender тела документа.
- `ui/document-my-list.tsx` — список «Мои документы».
- `ui/document-admin-row.tsx` — строка admin-списка + admin delete.
- `ui/document-revisions.tsx` — server component поверх RevisionHistory.
- `ui/document-export-links.tsx` — ссылки на прокси .md/.txt.
- `ui/document-containers.tsx` — read-only список лекций-контейнеров (через generic attachments).

**Создаём (generic `src/components/attachments/`):**
- `index.ts` — экспорт компонента и типов.
- `types.ts` — props-контракт (`AttachmentItem`, `AttachmentsPanelProps`, `AttachTargetPickerProps`).
- `attachments-panel.tsx` — основной client-компонент (список + reorder + detach + attach-триггер).
- `attach-target-picker.tsx` — обёртка над `AsyncCombobox` для выбора целевой сущности.
- `attachments-panel.test.tsx` — тесты режимов (read-only, owner-with-attach, owner-without-attach).

**Создаём (роуты `src/app/`):**
- `src/app/documents/my/page.tsx` — мои документы (+ формы создания).
- `src/app/documents/[id]/page.tsx` — страница документа (detail, edit owner-only, ревизии, контейнеры, export, **слот для annotations** волны 3).
- `src/app/documents/[id]/export/route.ts` — прокси .md/.txt.
- `src/app/admin/documents/page.tsx` — admin-список (gate `document.delete_any`).

**Изменяем:**
- `src/api/tags.ts` — добавить `DOCUMENTS: "documents"` (append-only, алфавит). **ЕДИНСТВЕННЫЙ shared-файл.**

**НЕ трогаем** (Parallel-safety, см. секцию ниже): `src/app/lectures/[id]/page.tsx`, `src/utils/permissions.ts`, admin-layout, header, любые `@/features/*` кроме своего.

---

## Этапы и midpoint

- **Этап A (Задачи 1–7): фундамент слайса + generic attachments.** types, tags, permissions(+тесты), schemas(+тесты), export-urls(+тесты), api.ts, generic `src/components/attachments/`(+тесты). Завершается коммитом. **MIDPOINT здесь** — после Этапа A фичу можно отдать двум исполнителям: Исполнитель-1 берёт Этап B (actions + формы создания/редактирования/удаления), Исполнитель-2 берёт Этап C (страницы /my, /[id], /admin, export-route, detail/revisions/containers UI). Этапы B и C почти не пересекаются по файлам (B = `actions.ts` + `ui/*-form.tsx` + `ui/*-button.tsx`; C = `src/app/*` + `ui/document-detail|my-list|admin-row|revisions|export-links|containers.tsx`). Точка синхронизации — `index.ts` (оба дополняют экспорты; конфликт тривиален, резолвится склейкой).
- **Этап B (Задачи 8–14): мутации и формы.**
- **Этап C (Задачи 15–22): страницы, detail, ревизии, контейнеры, export, admin.**
- **Этап D (Задача 23): финальная сборка, self-review, чеклист.**

---

## Этап A — фундамент

### Task 1: Скопировать шаблон слайса и подготовить каркас

**Files:**
- Create: `src/features/documents/` (копия `src/features/_template/`)

- [ ] **Step 1: Скопировать шаблон**

```bash
cp -R src/features/_template src/features/documents
rm -f src/features/documents/ui/.gitkeep
```

- [ ] **Step 2: Убедиться, что старые файлы шаблона не мешают**

Шаблон содержит заглушки (`index.ts`, `api.ts`, `actions.ts`, `permissions.ts`, `schemas.ts`, `types.ts`, тесты). Их перезапишем в следующих задачах. README шаблона удалить (он про template):

```bash
rm -f src/features/documents/README.md
```

- [ ] **Step 3: Коммит каркаса**

```bash
git add src/features/documents
git commit -m "chore(documents): scaffold slice from _template"
```

---

### Task 2: Добавить тег кеша `DOCUMENTS`

**Files:**
- Modify: `src/api/tags.ts`

- [ ] **Step 1: Добавить ключ DOCUMENTS в алфавитном порядке**

Открой `src/api/tags.ts`. В объекте `Tags` между `BANNERS` и `EVENTS` вставь строку (append-only, алфавит — `DOCUMENTS` идёт после `BANNERS`):

```ts
export const Tags = {
  BANNERS: "banners",
  DOCUMENTS: "documents",
  EVENTS: "events",
  GLOSSARY: "glossary",
  LECTURES: "lectures",
  PREFERENCES: "preferences",
  TAGS: "tags",
  USERS: "users",
} as const;
```

- [ ] **Step 2: Коммит**

```bash
git add src/api/tags.ts
git commit -m "chore(documents): register DOCUMENTS cache tag"
```

---

### Task 3: `types.ts` слайса

**Files:**
- Create/overwrite: `src/features/documents/types.ts`

- [ ] **Step 1: Записать сужения типов**

```ts
// src/features/documents/types.ts
import type { components } from "@/api/schema";

/** Полный документ (GET /api/documents/{id}, /api/me/documents, admin). */
export type Document = components["schemas"]["document.Document"];

/** Лёгкая сводка (picker GET /api/documents). */
export type DocumentSummary = components["schemas"]["document.DocumentSummary"];

/** Видимость: "private" | "public". */
export type Visibility = components["schemas"]["access.Visibility"];

/** Мета-ревизии (элемент списка). */
export type DocumentRevisionMeta = components["schemas"]["revision.RevisionMeta"];

/** Полная ревизия со снапшотом blocks. */
export type DocumentRevision = components["schemas"]["revision.Revision"];

/** Один attachment (reverse-lookup лекций-контейнеров). */
export type AttachmentDTO = components["schemas"]["attachment.AttachmentDTO"];
```

- [ ] **Step 2: Проверить компиляцию типов**

Run: `npx tsc --noEmit 2>&1 | grep -i 'features/documents/types' || echo "types OK"`
Expected: `types OK`

- [ ] **Step 3: Коммит**

```bash
git add src/features/documents/types.ts
git commit -m "feat(documents): slice types from schema"
```

---

### Task 4: `permissions.ts` + тесты

`document.create`/`document.delete_any` отсутствуют в union `Capability`, поэтому используем локальный helper `hasCap` (не трогаем запретный `src/utils/permissions.ts`). Status-гейт делаем явно (как `can()`: `me.status === "active"`).

**Files:**
- Create/overwrite: `src/features/documents/permissions.ts`
- Create/overwrite: `src/features/documents/permissions.test.ts`

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/documents/permissions.test.ts
import { describe, expect, it } from "vitest";
import type { Me } from "@/utils/me";
import type { Document } from "./types";
import {
  canCreateDocument,
  canEditDocument,
  canDeleteDocument,
  canAdminDeleteDocument,
  canListAdminDocuments,
  canSeeRevisions,
} from "./permissions";

function makeMe(over: Partial<Me> = {}): Me {
  return {
    id: "u1",
    username: "alice",
    role: "user",
    status: "active",
    capabilities: [],
    ...over,
  };
}

const ownDoc: Document = { id: "d1", owner_id: "u1", visibility: "private" };
const otherDoc: Document = { id: "d2", owner_id: "u2", visibility: "public" };

describe("canCreateDocument", () => {
  it("гость → false", () => {
    expect(canCreateDocument(null)).toBe(false);
  });
  it("active с document.create → true", () => {
    expect(canCreateDocument(makeMe({ capabilities: ["document.create"] }))).toBe(true);
  });
  it("active без капы → false", () => {
    expect(canCreateDocument(makeMe())).toBe(false);
  });
  it("suspended с капой → false", () => {
    expect(
      canCreateDocument(makeMe({ status: "suspended", capabilities: ["document.create"] })),
    ).toBe(false);
  });
});

describe("canEditDocument (owner-only)", () => {
  it("гость → false", () => {
    expect(canEditDocument(null, ownDoc)).toBe(false);
  });
  it("владелец active → true", () => {
    expect(canEditDocument(makeMe(), ownDoc)).toBe(true);
  });
  it("не владелец → false (даже admin)", () => {
    expect(
      canEditDocument(makeMe({ role: "admin", capabilities: ["document.delete_any"] }), otherDoc),
    ).toBe(false);
  });
  it("владелец suspended → false", () => {
    expect(canEditDocument(makeMe({ status: "suspended" }), ownDoc)).toBe(false);
  });
});

describe("canDeleteDocument", () => {
  it("владелец → true (любая видимость)", () => {
    expect(canDeleteDocument(makeMe(), ownDoc)).toBe(true);
  });
  it("не владелец без delete_any → false", () => {
    expect(canDeleteDocument(makeMe(), otherDoc)).toBe(false);
  });
  it("admin delete_any на public → true", () => {
    expect(
      canDeleteDocument(
        makeMe({ id: "admin1", role: "admin", capabilities: ["document.delete_any"] }),
        otherDoc,
      ),
    ).toBe(true);
  });
  it("admin delete_any на чужой PRIVATE → false (бек вернёт 404)", () => {
    const privOther: Document = { id: "d3", owner_id: "u9", visibility: "private" };
    expect(
      canDeleteDocument(
        makeMe({ id: "admin1", role: "admin", capabilities: ["document.delete_any"] }),
        privOther,
      ),
    ).toBe(false);
  });
});

describe("canAdminDeleteDocument (admin-список, только public)", () => {
  it("admin delete_any на public → true", () => {
    expect(
      canAdminDeleteDocument(makeMe({ role: "admin", capabilities: ["document.delete_any"] }), otherDoc),
    ).toBe(true);
  });
  it("без капы → false", () => {
    expect(canAdminDeleteDocument(makeMe(), otherDoc)).toBe(false);
  });
  it("private → false", () => {
    const priv: Document = { id: "d4", owner_id: "u9", visibility: "private" };
    expect(
      canAdminDeleteDocument(makeMe({ role: "admin", capabilities: ["document.delete_any"] }), priv),
    ).toBe(false);
  });
});

describe("canListAdminDocuments", () => {
  it("с delete_any → true", () => {
    expect(canListAdminDocuments(makeMe({ capabilities: ["document.delete_any"] }))).toBe(true);
  });
  it("без капы → false", () => {
    expect(canListAdminDocuments(makeMe())).toBe(false);
  });
});

describe("canSeeRevisions", () => {
  it("public документ → true", () => {
    expect(canSeeRevisions(otherDoc)).toBe(true);
  });
  it("private документ → false (бек не пишет ревизии private)", () => {
    expect(canSeeRevisions(ownDoc)).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить — упадёт (нет реализации)**

Run: `npm test -- src/features/documents/permissions.test.ts`
Expected: FAIL (модуль `./permissions` не экспортирует функции).

- [ ] **Step 3: Реализовать `permissions.ts`**

```ts
// src/features/documents/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import type { Document } from "./types";

/**
 * Локальный capability-чек. `document.create`/`document.delete_any`/`entity.attach`
 * отсутствуют в union `Capability` (src/utils/permissions.ts — запретная зона).
 * Миграция в union — отдельный foundation-touch (см. план §Foundation-touch).
 * Логика повторяет can(): гость/не-active → false, иначе членство в списке.
 */
function hasCap(me: MaybeMe, cap: string): boolean {
  if (!me) return false;
  if (me.status !== "active") return false;
  return me.capabilities.includes(cap);
}

/** Создание документа (JSON и upload) — capability document.create. */
export function canCreateDocument(me: MaybeMe): boolean {
  return hasCap(me, "document.create");
}

/**
 * Редактирование (title, blocks, visibility) — OWNER-ONLY без admin-override.
 * Бек: doc.OwnerID == actor.UserID (service.go). Status-гейт обязателен.
 */
export function canEditDocument(me: MaybeMe, doc: Document): boolean {
  if (!me || me.status !== "active") return false;
  return doc.owner_id === me.id;
}

/**
 * Удаление со страницы документа. Владелец — любая видимость. Admin с
 * delete_any — только НЕ-private (private чужой → бек вернёт 404).
 */
export function canDeleteDocument(me: MaybeMe, doc: Document): boolean {
  if (!me || me.status !== "active") return false;
  if (doc.owner_id === me.id) return true;
  if (!me.capabilities.includes("document.delete_any")) return false;
  return doc.visibility !== "private";
}

/**
 * Удаление из admin-списка: только delete_any и только НЕ-private (§6.2 спеки).
 * Admin-список и так отдаёт только public-документы.
 */
export function canAdminDeleteDocument(me: MaybeMe, doc: Document): boolean {
  if (!hasCap(me, "document.delete_any")) return false;
  return doc.visibility !== "private";
}

/** Доступ к admin-списку документов. */
export function canListAdminDocuments(me: MaybeMe): boolean {
  return hasCap(me, "document.delete_any");
}

/**
 * Бек создаёт ревизии только при мутации public-документа. У private-документа
 * список ревизий всегда пуст — секцию ревизий показываем только для public.
 */
export function canSeeRevisions(doc: Document): boolean {
  return doc.visibility === "public";
}
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `npm test -- src/features/documents/permissions.test.ts`
Expected: PASS (все кейсы зелёные).

- [ ] **Step 5: Коммит**

```bash
git add src/features/documents/permissions.ts src/features/documents/permissions.test.ts
git commit -m "feat(documents): permission helpers (owner-only edit, delete_any public-only)"
```

---

### Task 5: `schemas.ts` + тесты

Формы используют FormData. AST-blocks приходят как JSON-строка в скрытом поле (паттерн `events`). Multipart upload отдельной формой (File не через `parseFormData`).

**Files:**
- Create/overwrite: `src/features/documents/schemas.ts`
- Create/overwrite: `src/features/documents/schemas.test.ts`

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/documents/schemas.test.ts
import { describe, expect, it } from "vitest";
import {
  DocumentCreateSchema,
  DocumentBlocksSchema,
  DocumentMetaSchema,
  DocumentVisibilitySchema,
  DocumentIdSchema,
} from "./schemas";

describe("DocumentCreateSchema", () => {
  it("success: title + валидный blocks JSON + visibility", () => {
    const r = DocumentCreateSchema.safeParse({
      title: "Мой документ",
      blocks: JSON.stringify([{ type: "paragraph" }]),
      visibility: "public",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.title).toBe("Мой документ");
      expect(Array.isArray(r.data.blocks)).toBe(true);
      expect(r.data.visibility).toBe("public");
    }
  });
  it("success: без visibility → undefined (бек дефолтит private)", () => {
    const r = DocumentCreateSchema.safeParse({
      title: "X",
      blocks: JSON.stringify([{ type: "paragraph" }]),
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.visibility).toBeUndefined();
  });
  it("failure: пустой title", () => {
    const r = DocumentCreateSchema.safeParse({
      title: "  ",
      blocks: JSON.stringify([{ type: "paragraph" }]),
    });
    expect(r.success).toBe(false);
  });
  it("failure: blocks не массив", () => {
    const r = DocumentCreateSchema.safeParse({
      title: "X",
      blocks: JSON.stringify({ not: "array" }),
    });
    expect(r.success).toBe(false);
  });
  it("failure: пустой массив blocks (бек требует min 1)", () => {
    const r = DocumentCreateSchema.safeParse({
      title: "X",
      blocks: JSON.stringify([]),
    });
    expect(r.success).toBe(false);
  });
  it("failure: невалидное visibility", () => {
    const r = DocumentCreateSchema.safeParse({
      title: "X",
      blocks: JSON.stringify([{ type: "paragraph" }]),
      visibility: "secret",
    });
    expect(r.success).toBe(false);
  });
});

describe("DocumentBlocksSchema", () => {
  it("success: id + валидный blocks", () => {
    const r = DocumentBlocksSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      blocks: JSON.stringify([{ type: "paragraph" }]),
    });
    expect(r.success).toBe(true);
  });
  it("failure: битый JSON", () => {
    const r = DocumentBlocksSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      blocks: "{not json",
    });
    expect(r.success).toBe(false);
  });
  it("failure: невалидный uuid", () => {
    const r = DocumentBlocksSchema.safeParse({
      id: "nope",
      blocks: JSON.stringify([{ type: "paragraph" }]),
    });
    expect(r.success).toBe(false);
  });
});

describe("DocumentMetaSchema", () => {
  it("success", () => {
    const r = DocumentMetaSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      title: "Новое имя",
    });
    expect(r.success).toBe(true);
  });
  it("failure: пустой title", () => {
    const r = DocumentMetaSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      title: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("DocumentVisibilitySchema", () => {
  it("success: public", () => {
    const r = DocumentVisibilitySchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      visibility: "public",
    });
    expect(r.success).toBe(true);
  });
  it("failure: невалидное значение", () => {
    const r = DocumentVisibilitySchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      visibility: "secret",
    });
    expect(r.success).toBe(false);
  });
});

describe("DocumentIdSchema", () => {
  it("success", () => {
    const r = DocumentIdSchema.safeParse({ id: "11111111-1111-1111-1111-111111111111" });
    expect(r.success).toBe(true);
  });
  it("failure: не uuid", () => {
    const r = DocumentIdSchema.safeParse({ id: "x" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить — упадёт**

Run: `npm test -- src/features/documents/schemas.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать `schemas.ts`**

```ts
// src/features/documents/schemas.ts
import "server-only";
import { z } from "zod";

/** Парсит JSON-строку blocks из скрытого поля формы в непустой массив. */
const BlocksJsonSchema = z
  .string()
  .min(1, "Тело документа не может быть пустым")
  .transform((s, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(s);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Битый JSON в теле документа" });
      return z.NEVER;
    }
    if (!Array.isArray(parsed)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Тело должно быть массивом блоков" });
      return z.NEVER;
    }
    if (parsed.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Добавьте хотя бы один блок" });
      return z.NEVER;
    }
    return parsed as unknown[];
  });

const TitleSchema = z
  .string()
  .trim()
  .min(1, "Введите название")
  .max(500, "До 500 символов");

const VisibilityEnum = z.enum(["private", "public"]);

/** POST /api/documents (JSON create). visibility опционально. */
export const DocumentCreateSchema = z.object({
  title: TitleSchema,
  blocks: BlocksJsonSchema,
  // Радио/select: ключ отсутствует, если не выбрано → бек дефолтит private.
  visibility: VisibilityEnum.optional(),
});

/** PUT /api/documents/{id}/blocks. */
export const DocumentBlocksSchema = z.object({
  id: z.string().uuid("Некорректный id документа"),
  blocks: BlocksJsonSchema,
});

/** PATCH /api/documents/{id} (метаданные — только title). */
export const DocumentMetaSchema = z.object({
  id: z.string().uuid("Некорректный id документа"),
  title: TitleSchema,
});

/** PATCH /api/documents/{id}/visibility. UI предлагает только private→public. */
export const DocumentVisibilitySchema = z.object({
  id: z.string().uuid("Некорректный id документа"),
  visibility: VisibilityEnum,
});

/** Для delete: только id. */
export const DocumentIdSchema = z.object({
  id: z.string().uuid("Некорректный id документа"),
});

export type DocumentCreateInput = z.infer<typeof DocumentCreateSchema>;
export type DocumentBlocksInput = z.infer<typeof DocumentBlocksSchema>;
export type DocumentMetaInput = z.infer<typeof DocumentMetaSchema>;
export type DocumentVisibilityInput = z.infer<typeof DocumentVisibilitySchema>;
export type DocumentIdInput = z.infer<typeof DocumentIdSchema>;
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `npm test -- src/features/documents/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/features/documents/schemas.ts src/features/documents/schemas.test.ts
git commit -m "feat(documents): zod schemas for create/blocks/meta/visibility"
```

---

### Task 6: `export-urls.ts` + тест (чистый helper путей прокси)

Прокси-ссылки на `.md/.txt` строятся на локальные роуты `/documents/{id}/export?format=...`. Helper чистый (без `server-only`, нужен тесту) — паттерн `events/calendar.ts`.

**Files:**
- Create: `src/features/documents/export-urls.ts`
- Create: `src/features/documents/export-urls.test.ts`

- [ ] **Step 1: Написать падающий тест**

```ts
// src/features/documents/export-urls.test.ts
import { describe, expect, it } from "vitest";
import { documentExportUrls } from "./export-urls";

describe("documentExportUrls", () => {
  it("строит прокси-пути с экранированием id", () => {
    const u = documentExportUrls("a b/c");
    expect(u.md).toBe("/documents/a%20b%2Fc/export?format=md");
    expect(u.txt).toBe("/documents/a%20b%2Fc/export?format=txt");
  });
  it("обычный uuid", () => {
    const u = documentExportUrls("11111111-1111-1111-1111-111111111111");
    expect(u.md).toBe("/documents/11111111-1111-1111-1111-111111111111/export?format=md");
    expect(u.txt).toBe("/documents/11111111-1111-1111-1111-111111111111/export?format=txt");
  });
});
```

- [ ] **Step 2: Запустить — упадёт**

Run: `npm test -- src/features/documents/export-urls.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать**

```ts
// src/features/documents/export-urls.ts
// Чистый helper построения ссылок на прокси-выгрузки документа.
// Без "server-only": нужен тестам. Паттерн — src/features/events/calendar.ts.

export interface DocumentExportUrls {
  md: string;
  txt: string;
}

/**
 * Ссылки на .md/.txt документа ведут на ЛОКАЛЬНЫЙ прокси-роут
 * /documents/{id}/export, который подкладывает Bearer-токен из httpOnly-cookie
 * (эндпоинты бека optionalAuth — приватный документ владельца без токена
 * получил бы 401 при браузерной навигации). Паттерн — events export route.
 */
export function documentExportUrls(id: string): DocumentExportUrls {
  const base = `/documents/${encodeURIComponent(id)}/export`;
  return { md: `${base}?format=md`, txt: `${base}?format=txt` };
}
```

- [ ] **Step 4: Запустить — пройдёт**

Run: `npm test -- src/features/documents/export-urls.test.ts`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/features/documents/export-urls.ts src/features/documents/export-urls.test.ts
git commit -m "feat(documents): export-urls helper for md/txt proxy links"
```

---

### Task 7: `api.ts` — server-only фетчеры

**Files:**
- Create/overwrite: `src/features/documents/api.ts`

- [ ] **Step 1: Реализовать api.ts**

```ts
// src/features/documents/api.ts
import "server-only";
import { cache } from "react";
import { createApiClient } from "@/api/client";
import type {
  AttachmentDTO,
  Document,
  DocumentRevision,
  DocumentRevisionMeta,
} from "./types";

export interface DocumentListFilter {
  offset?: number;
  limit?: number;
  freeFloating?: boolean;
}

export interface DocumentListResult {
  items: Document[];
  total: number;
  offset: number;
  limit: number;
}

export interface AdminDocumentListFilter {
  offset?: number;
  limit?: number;
  ownerId?: string;
}

/** Мои документы (GET /api/me/documents). Гейт — auth. */
export const getMyDocuments = cache(
  async (filter: DocumentListFilter = {}): Promise<DocumentListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const query: { offset: number; limit: number; free_floating?: boolean } = {
      offset,
      limit,
    };
    if (filter.freeFloating) query.free_floating = true;
    const { data, error } = await api.GET("/api/me/documents", { params: { query } });
    if (error) throw new Error(error.error ?? "Не удалось загрузить документы");
    return {
      items: (data?.data ?? []) as Document[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);

/** Документ по id (GET /api/documents/{id}). 404 → null. */
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

/** Лекции-контейнеры документа (reverse-lookup GET /api/documents/{id}/attachments). */
export const getDocumentContainers = cache(
  async (id: string): Promise<AttachmentDTO[]> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/documents/{id}/attachments", {
      params: { path: { id } },
    });
    if (error) throw new Error(error.error ?? "Не удалось загрузить привязки");
    return (data?.data ?? []) as AttachmentDTO[];
  },
);

/**
 * Список ревизий (GET /api/documents/{id}/revisions). Бек отдаёт created_at ASC
 * (старые первыми, потолок 200) — переворачивает мостик ui (см. document-revisions).
 * Существуют только у public-документов.
 */
export const getDocumentRevisions = cache(
  async (id: string): Promise<DocumentRevisionMeta[]> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/documents/{id}/revisions", {
      params: { path: { id } },
    });
    if (error) throw new Error(error.error ?? "Не удалось загрузить ревизии");
    return (data?.data ?? []) as DocumentRevisionMeta[];
  },
);

/** Одна ревизия (GET /api/documents/{id}/revisions/{revisionID}). 404 → null. */
export const getDocumentRevision = cache(
  async (id: string, revisionId: string): Promise<DocumentRevision | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET(
      "/api/documents/{id}/revisions/{revisionID}",
      { params: { path: { id, revisionID: revisionId } } },
    );
    if (response.status === 404) return null;
    if (error) throw new Error(error.error ?? "Не удалось загрузить ревизию");
    return (data?.data ?? null) as DocumentRevision | null;
  },
);

/** Admin-список документов (GET /api/admin/documents — только НЕ-private). */
export const getAdminDocuments = cache(
  async (filter: AdminDocumentListFilter = {}): Promise<DocumentListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const query: { offset: number; limit: number; owner_id?: string } = { offset, limit };
    if (filter.ownerId) query.owner_id = filter.ownerId;
    const { data, error } = await api.GET("/api/admin/documents", { params: { query } });
    if (error) throw new Error(error.error ?? "Не удалось загрузить документы");
    return {
      items: (data?.data ?? []) as Document[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit 2>&1 | grep -i 'features/documents/api' || echo "api OK"`
Expected: `api OK`

- [ ] **Step 3: Коммит**

```bash
git add src/features/documents/api.ts
git commit -m "feat(documents): server-only fetchers (my/by-id/containers/revisions/admin)"
```

---

### Task 8: Generic `src/components/attachments/` — типы (props-контракт)

Это **зафиксированный контракт**, который переиспользуют `lecture-enrichment` и `media` (волна 3). Не меняй сигнатуры без согласования.

**Files:**
- Create: `src/components/attachments/types.ts`

- [ ] **Step 1: Записать контракт типов**

```ts
// src/components/attachments/types.ts
import type { ReactNode } from "react";

/**
 * Доменно-нейтральный элемент прикрепления. Слайс-потребитель мапит свой
 * attachment.AttachmentDTO в этот контракт. Доменных полей быть не должно.
 */
export interface AttachmentItem {
  /** Стабильный ключ строки (обычно entity_id или составной ключ). */
  id: string;
  /** Заголовок для показа (имя лекции-контейнера или имя сущности). */
  label: string;
  /** Порядковый номер (sort_order бекенда). Для сортировки и reorder. */
  sortOrder: number;
  /** Ссылка на элемент (опц.) — например на страницу лекции. */
  href?: string;
  /**
   * Тип сущности ("document" | "media" | "canvas" | …). Нужен для graceful
   * fallback-плашки (например canvas в волне 2 рендерим плашкой).
   */
  entityType?: string;
}

/**
 * Результат пользовательского действия. Потребитель оборачивает свой server
 * action и возвращает наружу `{ ok }` + опц. текст ошибки для тоста.
 */
export type AttachmentActionResult =
  | { ok: true }
  | { ok: false; error: string };

export interface AttachTargetPickerProps {
  /**
   * Фетчер целевых сущностей для AsyncCombobox. Стабильная ссылка
   * (useCallback) рекомендуется. Возвращает страницу результатов.
   */
  fetcher: (q: string, offset: number, limit: number) => Promise<{
    data: { id: string; label: string }[];
    total: number | null;
  }>;
  /** Вызывается при выборе цели. */
  onSelect: (id: string, label: string) => void;
  /** Закрытие пикера (Esc / отмена). */
  onClose?: () => void;
  placeholder?: string;
}

export interface AttachmentsPanelProps {
  /** Заголовок секции. */
  title?: string;
  /** Текущие прикрепления (в любом порядке — компонент сортирует по sortOrder). */
  items: AttachmentItem[];
  /** Текст при пустом списке. */
  emptyText?: string;
  className?: string;

  /**
   * Режим управления. Когда false (read-only) — рендерится только список,
   * без кнопок detach/reorder/attach. На странице документа волны 2 — false.
   */
  canManage?: boolean;

  /**
   * Можно ли прикреплять новые (attach). На беке = entity.attach ∧ ownership
   * лекции. Потребитель вычисляет boolean на сервере и передаёт сюда. Если
   * false — кнопка «Прикрепить» не рендерится (detach/reorder остаются по
   * canManage). См. §6.3 спеки.
   */
  canAttach?: boolean;

  /** Detach. Обязателен, если canManage. */
  onDetach?: (item: AttachmentItem) => Promise<AttachmentActionResult>;
  /**
   * Reorder: новое значение sortOrder для элемента. Обязателен, если canManage.
   * Компонент вызывает при «вверх/вниз», передавая целевой sortOrder.
   */
  onReorder?: (item: AttachmentItem, newSortOrder: number) => Promise<AttachmentActionResult>;
  /** Attach выбранной цели. Обязателен, если canAttach. */
  onAttach?: (targetId: string, targetLabel: string) => Promise<AttachmentActionResult>;

  /**
   * Рендер-проп пикера цели (для attach). Потребитель прокидывает свой
   * AttachTargetPicker, сконфигурированный нужным fetcher'ом. Компонент
   * передаёт onSelect/onClose. Обязателен, если canAttach.
   */
  renderTargetPicker?: (props: {
    onSelect: (id: string, label: string) => void;
    onClose: () => void;
  }) => ReactNode;

  /**
   * Сообщение об ошибке action'а показывается локально под списком. Если
   * потребитель предпочитает тост — может игнорировать встроенный показ
   * (компонент всё равно вернёт результат в onX).
   */
}
```

- [ ] **Step 2: Коммит**

```bash
git add src/components/attachments/types.ts
git commit -m "feat(attachments): props contract (AttachmentItem, AttachmentsPanelProps)"
```

---

### Task 9: Generic `attach-target-picker.tsx`

Тонкая обёртка над `AsyncCombobox` (deep-import в `@/components` легален). Адаптирует `{id,label}`-fetcher к combobox.

**Files:**
- Create: `src/components/attachments/attach-target-picker.tsx`

- [ ] **Step 1: Реализовать**

```tsx
// src/components/attachments/attach-target-picker.tsx
"use client";
import { AsyncCombobox } from "@/components/ast-editor/pickers/async-combobox";
import type { AttachTargetPickerProps } from "./types";

interface Target {
  id: string;
  label: string;
}

/**
 * Пикер целевой сущности для attach. Использует AsyncCombobox из ast-editor
 * (deep-import в @/components легален). Доменно-нейтрален: fetcher отдаёт
 * {id, label}; потребитель конфигурирует его под свой эндпоинт.
 */
export function AttachTargetPicker({
  fetcher,
  onSelect,
  onClose,
  placeholder,
}: AttachTargetPickerProps) {
  return (
    <AsyncCombobox<Target>
      fetcher={fetcher}
      renderItem={(t) => <span>{t.label}</span>}
      getKey={(t) => t.id}
      onSelect={(t) => onSelect(t.id, t.label)}
      {...(onClose ? { onClose } : {})}
      placeholder={placeholder ?? "Поиск…"}
    />
  );
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit 2>&1 | grep -i 'attachments/attach-target-picker' || echo "picker OK"`
Expected: `picker OK`

- [ ] **Step 3: Коммит**

```bash
git add src/components/attachments/attach-target-picker.tsx
git commit -m "feat(attachments): AttachTargetPicker over AsyncCombobox"
```

---

### Task 10: Generic `attachments-panel.tsx` + тесты

**Files:**
- Create: `src/components/attachments/attachments-panel.tsx`
- Create: `src/components/attachments/attachments-panel.test.tsx`
- Create: `src/components/attachments/index.ts`

- [ ] **Step 1: Написать падающий тест**

```tsx
// src/components/attachments/attachments-panel.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AttachmentsPanel } from "./attachments-panel";
import type { AttachmentItem } from "./types";

const items: AttachmentItem[] = [
  { id: "a", label: "Лекция B", sortOrder: 1, entityType: "document" },
  { id: "b", label: "Лекция A", sortOrder: 0, entityType: "document" },
];

describe("AttachmentsPanel", () => {
  it("read-only: показывает элементы по возрастанию sortOrder, без кнопок управления", () => {
    render(<AttachmentsPanel items={items} title="Привязки" />);
    const labels = screen.getAllByTestId("attachment-label").map((n) => n.textContent);
    expect(labels).toEqual(["Лекция A", "Лекция B"]);
    expect(screen.queryByRole("button", { name: /Открепить/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Прикрепить/ })).toBeNull();
  });

  it("пустой список → emptyText", () => {
    render(<AttachmentsPanel items={[]} emptyText="Пусто" />);
    expect(screen.getByText("Пусто")).toBeTruthy();
  });

  it("canManage: рендерит detach и вызывает onDetach", async () => {
    const onDetach = vi.fn().mockResolvedValue({ ok: true });
    render(
      <AttachmentsPanel
        items={items}
        canManage
        onDetach={onDetach}
        onReorder={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /Открепить/ });
    expect(buttons.length).toBe(2);
    fireEvent.click(buttons[0]!);
    await waitFor(() => expect(onDetach).toHaveBeenCalledTimes(1));
  });

  it("canManage без canAttach: кнопки «Прикрепить» нет", () => {
    render(
      <AttachmentsPanel
        items={items}
        canManage
        onDetach={vi.fn()}
        onReorder={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Прикрепить/ })).toBeNull();
  });

  it("canAttach: показывает кнопку «Прикрепить», открывает пикер", () => {
    render(
      <AttachmentsPanel
        items={items}
        canManage
        canAttach
        onDetach={vi.fn()}
        onReorder={vi.fn()}
        onAttach={vi.fn().mockResolvedValue({ ok: true })}
        renderTargetPicker={() => <div data-testid="picker">picker</div>}
      />,
    );
    const attachBtn = screen.getByRole("button", { name: /Прикрепить/ });
    fireEvent.click(attachBtn);
    expect(screen.getByTestId("picker")).toBeTruthy();
  });

  it("detach с ошибкой показывает сообщение", async () => {
    const onDetach = vi.fn().mockResolvedValue({ ok: false, error: "Нельзя открепить" });
    render(
      <AttachmentsPanel items={items} canManage onDetach={onDetach} onReorder={vi.fn()} />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /Открепить/ })[0]!);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Нельзя открепить"));
  });
});
```

- [ ] **Step 2: Запустить — упадёт**

Run: `npm test -- src/components/attachments/attachments-panel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализовать `attachments-panel.tsx`**

```tsx
// src/components/attachments/attachments-panel.tsx
"use client";
import { useMemo, useState, useTransition } from "react";
import type { AttachmentItem, AttachmentsPanelProps } from "./types";

/**
 * Доменно-нейтральная панель прикреплений: список (сортировка по sortOrder),
 * detach, reorder (вверх/вниз обменом sortOrder с соседом), attach через
 * рендер-проп пикера. Все данные и actions — пропами. Не знает о документах /
 * медиа / лекциях. Переиспользуется documents (read-only), lecture-enrichment
 * и media (волна 3).
 */
export function AttachmentsPanel({
  title = "Прикрепления",
  items,
  emptyText = "Пока ничего не прикреплено.",
  className,
  canManage = false,
  canAttach = false,
  onDetach,
  onReorder,
  onAttach,
  renderTargetPicker,
}: AttachmentsPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder),
    [items],
  );

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Ошибка операции");
    });
  }

  const showAttach = canManage && canAttach && Boolean(onAttach) && Boolean(renderTargetPicker);

  return (
    <section className={className} aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {showAttach && (
          <button
            type="button"
            className="rounded border border-(--color-border) px-2 py-1 text-sm hover:bg-(--color-text-pane)"
            onClick={() => setPickerOpen((v) => !v)}
            disabled={pending}
          >
            Прикрепить
          </button>
        )}
      </div>

      {pickerOpen && showAttach && renderTargetPicker && (
        <div className="mt-2">
          {renderTargetPicker({
            onSelect: (id, label) => {
              setPickerOpen(false);
              if (onAttach) run(() => onAttach(id, label));
            },
            onClose: () => setPickerOpen(false),
          })}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="mt-2 text-sm text-(--color-description)">{emptyText}</p>
      ) : (
        <ol className="mt-2 flex flex-col divide-y divide-(--color-border)">
          {sorted.map((item, i) => (
            <li key={item.id} className="flex items-center justify-between gap-2 py-1.5">
              <span data-testid="attachment-label" className="text-sm">
                {item.href ? (
                  <a href={item.href} className="hover:underline">
                    {item.label}
                  </a>
                ) : (
                  item.label
                )}
                {item.entityType === "canvas" && (
                  <span className="ml-2 text-xs text-(--color-description)">
                    (canvas — просмотр недоступен)
                  </span>
                )}
              </span>
              {canManage && (
                <span className="flex items-center gap-1">
                  {onReorder && i > 0 && (
                    <button
                      type="button"
                      aria-label="Выше"
                      className="rounded px-1 text-sm hover:bg-(--color-text-pane)"
                      disabled={pending}
                      onClick={() => {
                        const prev = sorted[i - 1]!;
                        run(() => onReorder(item, prev.sortOrder));
                      }}
                    >
                      ↑
                    </button>
                  )}
                  {onReorder && i < sorted.length - 1 && (
                    <button
                      type="button"
                      aria-label="Ниже"
                      className="rounded px-1 text-sm hover:bg-(--color-text-pane)"
                      disabled={pending}
                      onClick={() => {
                        const next = sorted[i + 1]!;
                        run(() => onReorder(item, next.sortOrder));
                      }}
                    >
                      ↓
                    </button>
                  )}
                  {onDetach && (
                    <button
                      type="button"
                      className="rounded border border-(--color-border) px-2 py-0.5 text-sm hover:bg-(--color-text-pane)"
                      disabled={pending}
                      onClick={() => run(() => onDetach(item))}
                    >
                      Открепить
                    </button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
```

> **Заметка по reorder:** «вверх» присваивает элементу sortOrder соседа сверху; бек PATCH перезаписывает позицию. Это не атомарный swap (соседу значение не меняем), но для MVP read-only-страницы документа reorder вообще не используется — функция отрабатывает на странице лекции (волна 3). Если в волне 3 понадобится строгий swap — потребитель сделает два вызова onReorder; контракт это допускает.

- [ ] **Step 4: Создать `index.ts`**

```ts
// src/components/attachments/index.ts
export { AttachmentsPanel } from "./attachments-panel";
export { AttachTargetPicker } from "./attach-target-picker";
export type {
  AttachmentItem,
  AttachmentsPanelProps,
  AttachTargetPickerProps,
  AttachmentActionResult,
} from "./types";
```

- [ ] **Step 5: Запустить — пройдёт**

Run: `npm test -- src/components/attachments/attachments-panel.test.tsx`
Expected: PASS.

- [ ] **Step 6: Коммит**

```bash
git add src/components/attachments/attachments-panel.tsx src/components/attachments/attachments-panel.test.tsx src/components/attachments/index.ts
git commit -m "feat(attachments): generic AttachmentsPanel (read-only/manage/attach modes)"
```

---

### Task 11: Промежуточный `index.ts` слайса (Этап A экспорты)

**Files:**
- Create/overwrite: `src/features/documents/index.ts`

- [ ] **Step 1: Записать экспорты, известные на конец Этапа A**

```ts
// src/features/documents/index.ts
export {
  getMyDocuments,
  getDocumentById,
  getDocumentContainers,
  getDocumentRevisions,
  getDocumentRevision,
  getAdminDocuments,
} from "./api";
export type {
  DocumentListFilter,
  DocumentListResult,
  AdminDocumentListFilter,
} from "./api";
export {
  canCreateDocument,
  canEditDocument,
  canDeleteDocument,
  canAdminDeleteDocument,
  canListAdminDocuments,
  canSeeRevisions,
} from "./permissions";
export { documentExportUrls } from "./export-urls";
export type { DocumentExportUrls } from "./export-urls";
export type {
  Document,
  DocumentSummary,
  Visibility,
  DocumentRevision,
  DocumentRevisionMeta,
  AttachmentDTO,
} from "./types";
// UI-экспорты добавляются в Этапах B и C (см. задачи 8–22).
```

- [ ] **Step 2: lint + tsc + relevant tests**

Run: `npm run lint && npx tsc --noEmit && npm test -- src/features/documents src/components/attachments`
Expected: всё зелёное.

- [ ] **Step 3: Коммит (конец Этапа A — MIDPOINT)**

```bash
git add src/features/documents/index.ts
git commit -m "feat(documents): slice public API (stage A: api/permissions/types)"
```

> **=== MIDPOINT ===** После этого коммита фичу можно разделить на двух исполнителей: Исполнитель-1 → Этап B (Задачи 12–17), Исполнитель-2 → Этап C (Задачи 18–22). Оба дополняют `index.ts` — конфликт в нём резолвится склейкой экспортов.

---

## Этап B — мутации и формы

### Task 12: `actions.ts` — мутации (create JSON, blocks, meta, visibility, delete, admin delete) + upload

**Files:**
- Create/overwrite: `src/features/documents/actions.ts`

- [ ] **Step 1: Реализовать actions.ts**

```ts
// src/features/documents/actions.ts
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
import { canCreateDocument } from "./permissions";
import {
  DocumentCreateSchema,
  DocumentBlocksSchema,
  DocumentMetaSchema,
  DocumentVisibilitySchema,
  DocumentIdSchema,
} from "./schemas";
import type { Document } from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

type ApiError = { code?: string; error?: string };

/** Маппинг UPPER_SNAKE_CASE кодов бека в понятный русский текст. */
function rethrowApiError(err: ApiError | undefined): never {
  switch (err?.code) {
    case "FORBIDDEN":
      throw new ForbiddenError("role", err.error);
    case "PUBLIC_IMMUTABLE":
      throw new Error("Публичный документ нельзя сделать приватным.");
    case "DOCUMENT_REFERENCED":
      throw new Error(
        "На документ ссылаются другие материалы. Удалите ссылки, затем повторите.",
      );
    case "BLOCK_REFERENCED":
      throw new Error(
        "На блок документа ссылаются извне. Удалите ссылки или оставьте блок.",
      );
    case "BLOCKS_HAVE_ANCHORS":
      throw new Error(
        "Нельзя удалить блок с привязанными комментариями. Сначала удалите комментарии.",
      );
    case "BLOCKS_EMPTY":
      throw new Error("Документ должен содержать хотя бы один блок.");
    case "BLOCKS_INVALID":
    case "DUPLICATE_BLOCK_ID":
    case "BLOCK_ID_UNKNOWN":
      throw new Error("Тело документа не прошло валидацию AST.");
    case "REF_NOT_FOUND":
      throw new Error("Одна из ссылок указывает на несуществующий объект.");
    case "IMAGE_UNKNOWN_KEY":
      throw new Error("В документе есть изображение с неизвестным ключом.");
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}

/** POST /api/documents (JSON). Гейт — document.create. */
export const createDocument = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canCreateDocument);
  const input = parseFormData(DocumentCreateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/documents", {
    body: {
      title: input.title,
      blocks: input.blocks as never,
      ...(input.visibility ? { visibility: input.visibility } : {}),
    },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.DOCUMENTS);
  return (data?.data ?? null) as Document | null;
});

/**
 * POST /api/documents/upload (multipart). FormData с File нельзя гнать через
 * parseFormData — отправляем напрямую fetch'ем с Bearer-токеном (паттерн
 * src/components/ast-editor/upload/upload-image.ts). Поля: file (.md/.markdown),
 * visibility (опц.).
 */
export const uploadDocument = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canCreateDocument);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Выберите файл .md для загрузки.");
  }
  const token = (await cookies()).get("token")?.value;
  // Пересобираем FormData: только разрешённые бекендом поля.
  const upstream = new FormData();
  upstream.set("file", file);
  const vis = formData.get("visibility");
  if (vis === "public" || vis === "private") upstream.set("visibility", vis);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/documents/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: upstream,
    });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Сетевая ошибка при загрузке");
  }
  if (res.status === 401 || res.status === 403) {
    throw new ForbiddenError("role");
  }
  if (res.status !== 201 && res.status !== 200) {
    let body: ApiError = {};
    try {
      body = (await res.json()) as ApiError;
    } catch {
      /* non-JSON */
    }
    rethrowApiError(body.code ? body : { error: `Ошибка загрузки: ${res.status}` });
  }
  const json = (await res.json()) as { data?: Document };
  revalidateEntity(Tags.DOCUMENTS);
  return json.data ?? null;
});

/** PATCH /api/documents/{id} (метаданные — title). Owner-only enforce'ит бек. */
export const updateDocumentMeta = createFormAction(async (formData) => {
  const me = await getMe();
  if (!me || me.status !== "active") throw new ForbiddenError(me ? "status" : "guest");
  const input = parseFormData(DocumentMetaSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/documents/{document_id}", {
    params: { path: { document_id: input.id } },
    body: { title: input.title },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.DOCUMENTS, input.id);
  revalidateEntity(Tags.DOCUMENTS);
  return (data?.data ?? null) as Document | null;
});

/** PUT /api/documents/{id}/blocks. Owner-only enforce'ит бек. */
export const updateDocumentBlocks = createFormAction(async (formData) => {
  const me = await getMe();
  if (!me || me.status !== "active") throw new ForbiddenError(me ? "status" : "guest");
  const input = parseFormData(DocumentBlocksSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/documents/{document_id}/blocks", {
    params: { path: { document_id: input.id } },
    body: { blocks: input.blocks as never },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.DOCUMENTS, input.id);
  revalidateEntity(Tags.DOCUMENTS);
  return (data?.data ?? null) as Document | null;
});

/** PATCH /api/documents/{id}/visibility. UI шлёт только private→public. */
export const setDocumentVisibility = createFormAction(async (formData) => {
  const me = await getMe();
  if (!me || me.status !== "active") throw new ForbiddenError(me ? "status" : "guest");
  const input = parseFormData(DocumentVisibilitySchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/documents/{document_id}/visibility", {
    params: { path: { document_id: input.id } },
    body: { visibility: input.visibility },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.DOCUMENTS, input.id);
  revalidateEntity(Tags.DOCUMENTS);
  return (data?.data ?? null) as Document | null;
});

/** DELETE /api/documents/{id}. Owner или admin (delete_any, не-private) — enforce'ит бек. */
export const deleteDocument = createAction(async (rawId: string) => {
  const me = await getMe();
  if (!me || me.status !== "active") throw new ForbiddenError(me ? "status" : "guest");
  const { id } = DocumentIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/documents/{document_id}", {
    params: { path: { document_id: id } },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.DOCUMENTS);
  return undefined;
});

/** DELETE /api/admin/documents/{id}. Гейт — document.delete_any (только public). */
export const adminDeleteDocument = createAction(async (rawId: string) => {
  const me = await getMe();
  if (!me || me.status !== "active" || !me.capabilities.includes("document.delete_any")) {
    throw new ForbiddenError(me ? (me.status !== "active" ? "status" : "role") : "guest");
  }
  const { id } = DocumentIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/documents/{document_id}", {
    params: { path: { document_id: id } },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.DOCUMENTS);
  return undefined;
});
```

- [ ] **Step 2: tsc**

Run: `npx tsc --noEmit 2>&1 | grep -i 'features/documents/actions' || echo "actions OK"`
Expected: `actions OK`

- [ ] **Step 3: Коммит**

```bash
git add src/features/documents/actions.ts
git commit -m "feat(documents): server actions (create/upload/blocks/meta/visibility/delete)"
```

---

### Task 13: `document-create-form.tsx` (JSON create) + `document-upload-form.tsx`

**Files:**
- Create: `src/features/documents/ui/document-create-form.tsx`
- Create: `src/features/documents/ui/document-upload-form.tsx`

- [ ] **Step 1: `document-create-form.tsx`**

```tsx
"use client";
// src/features/documents/ui/document-create-form.tsx
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Form, FormField, SubmitButton, TextInput } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { AstEditor } from "@/components/ast-editor";
import type { AstBlock } from "@/components/ast-editor";
import { createDocument } from "../actions";
import type { Document } from "../types";

const initial: ActionResult<Document | null> = { success: true, data: null };

export function DocumentCreateForm() {
  const router = useRouter();
  const [blocks, setBlocks] = useState<AstBlock[]>([]);
  const [state, action] = useActionState(createDocument, initial);

  const fieldErrors: Record<string, string> =
    state.success === false && state.code === "validation" ? state.fieldErrors : {};

  useEffect(() => {
    if (state.success && state.data?.id) {
      router.push(`/documents/${state.data.id}`);
    }
  }, [state, router]);

  return (
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-4">
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />

      <FormField name="title" label="Название" required>
        <TextInput name="title" required maxLength={500} placeholder="Название документа" />
      </FormField>

      <FormField name="visibility" label="Видимость">
        <select
          name="visibility"
          defaultValue="private"
          className="rounded border border-(--color-border) px-2 py-1 text-sm"
        >
          <option value="private">Приватный</option>
          <option value="public">Публичный</option>
        </select>
      </FormField>
      <p className="text-xs text-(--color-description)">
        Публичный документ нельзя будет вернуть в приватный — только удалить.
      </p>

      <FormField name="blocks" label="Содержимое">
        <AstEditor
          defaultValue={[]}
          entityContext="document"
          onChange={(next: AstBlock[]) => setBlocks(next)}
        />
      </FormField>

      {state.success === false && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на создание документа.</p>
      )}
      {state.success === false && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>Создать</SubmitButton>
      </div>
    </Form>
  );
}
```

- [ ] **Step 2: `document-upload-form.tsx`**

```tsx
"use client";
// src/features/documents/ui/document-upload-form.tsx
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Form, FormField, SubmitButton } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { uploadDocument } from "../actions";
import type { Document } from "../types";

const initial: ActionResult<Document | null> = { success: true, data: null };

export function DocumentUploadForm() {
  const router = useRouter();
  const [state, action] = useActionState(uploadDocument, initial);

  useEffect(() => {
    if (state.success && state.data?.id) {
      router.push(`/documents/${state.data.id}`);
    }
  }, [state, router]);

  return (
    <Form action={action} className="flex flex-col gap-4">
      <FormField name="file" label="Файл Markdown (.md)" required>
        <input
          type="file"
          name="file"
          accept=".md,.markdown,text/markdown"
          required
          className="text-sm"
        />
      </FormField>

      <FormField name="visibility" label="Видимость">
        <select
          name="visibility"
          defaultValue="private"
          className="rounded border border-(--color-border) px-2 py-1 text-sm"
        >
          <option value="private">Приватный</option>
          <option value="public">Публичный</option>
        </select>
      </FormField>

      {state.success === false && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на загрузку документа.</p>
      )}
      {state.success === false && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>Загрузить</SubmitButton>
      </div>
    </Form>
  );
}
```

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit 2>&1 | grep -iE 'document-create-form|document-upload-form' || echo "forms OK"`
Expected: `forms OK`

- [ ] **Step 4: Коммит**

```bash
git add src/features/documents/ui/document-create-form.tsx src/features/documents/ui/document-upload-form.tsx
git commit -m "feat(documents): create form (JSON + AstEditor) and upload form (multipart)"
```

---

### Task 14: `document-edit-form.tsx` (blocks) + `document-meta-form.tsx` (title)

**Files:**
- Create: `src/features/documents/ui/document-edit-form.tsx`
- Create: `src/features/documents/ui/document-meta-form.tsx`

- [ ] **Step 1: `document-edit-form.tsx`**

```tsx
"use client";
// src/features/documents/ui/document-edit-form.tsx
import { useActionState, useState } from "react";
import { Form, FormField, SubmitButton } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { AstEditor } from "@/components/ast-editor";
import type { AstBlock } from "@/components/ast-editor";
import { updateDocumentBlocks } from "../actions";
import type { Document } from "../types";

const initial: ActionResult<Document | null> = { success: true, data: null };

interface Props {
  document: Document;
}

export function DocumentEditForm({ document }: Props) {
  const [blocks, setBlocks] = useState<AstBlock[]>(document.blocks ?? []);
  const [state, action] = useActionState(updateDocumentBlocks, initial);

  return (
    <Form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={document.id ?? ""} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />

      <FormField name="blocks" label="Содержимое">
        <AstEditor
          defaultValue={document.blocks ?? []}
          entityContext="document"
          onChange={(next: AstBlock[]) => setBlocks(next)}
        />
      </FormField>

      {state.success && state.data && (
        <p className="text-sm text-(--color-description)">Сохранено.</p>
      )}
      {state.success === false && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на изменение документа.</p>
      )}
      {state.success === false && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div>
        <SubmitButton>Сохранить содержимое</SubmitButton>
      </div>
    </Form>
  );
}
```

- [ ] **Step 2: `document-meta-form.tsx`**

```tsx
"use client";
// src/features/documents/ui/document-meta-form.tsx
import { useActionState } from "react";
import { Form, FormField, SubmitButton, TextInput } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { updateDocumentMeta } from "../actions";
import type { Document } from "../types";

const initial: ActionResult<Document | null> = { success: true, data: null };

interface Props {
  document: Document;
}

export function DocumentMetaForm({ document }: Props) {
  const [state, action] = useActionState(updateDocumentMeta, initial);
  const fieldErrors: Record<string, string> =
    state.success === false && state.code === "validation" ? state.fieldErrors : {};

  return (
    <Form action={action} errors={fieldErrors} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={document.id ?? ""} />
      <FormField name="title" label="Название" required>
        <TextInput
          name="title"
          defaultValue={document.filename ?? ""}
          required
          maxLength={500}
        />
      </FormField>
      {state.success && state.data && (
        <p className="text-sm text-(--color-description)">Сохранено.</p>
      )}
      {state.success === false && state.code === "forbidden" && (
        <p className="text-sm text-red-600">У вас нет прав на изменение документа.</p>
      )}
      {state.success === false && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      <div>
        <SubmitButton>Сохранить название</SubmitButton>
      </div>
    </Form>
  );
}
```

> Примечание: ответ бека не содержит `title`, отображаемое имя — `filename`. Поле формы предзаполняем `filename`; PATCH меняет именно отображаемое имя документа.

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit 2>&1 | grep -iE 'document-edit-form|document-meta-form' || echo "edit forms OK"`
Expected: `edit forms OK`

- [ ] **Step 4: Коммит**

```bash
git add src/features/documents/ui/document-edit-form.tsx src/features/documents/ui/document-meta-form.tsx
git commit -m "feat(documents): blocks edit form and title meta form"
```

---

### Task 15: `document-visibility-button.tsx` + `document-delete-button.tsx`

**Files:**
- Create: `src/features/documents/ui/document-visibility-button.tsx`
- Create: `src/features/documents/ui/document-delete-button.tsx`

- [ ] **Step 1: `document-visibility-button.tsx`** (только private→public)

```tsx
"use client";
// src/features/documents/ui/document-visibility-button.tsx
import { useActionState } from "react";
import { Form, SubmitButton } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { setDocumentVisibility } from "../actions";
import type { Document } from "../types";

const initial: ActionResult<Document | null> = { success: true, data: null };

interface Props {
  id: string;
}

/**
 * Кнопка «Сделать публичным». Рендерится потребителем ТОЛЬКО для private-документа
 * владельца (даунгрейд UI не предлагает — бек вернул бы 422 PUBLIC_IMMUTABLE).
 */
export function DocumentVisibilityButton({ id }: Props) {
  const [state, action] = useActionState(setDocumentVisibility, initial);
  return (
    <Form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="visibility" value="public" />
      <SubmitButton>Сделать публичным</SubmitButton>
      {state.success === false && state.code === "forbidden" && (
        <span className="text-sm text-red-600">У вас нет прав на изменение видимости.</span>
      )}
      {state.success === false && !state.code && (
        <span className="text-sm text-red-600">{state.error}</span>
      )}
    </Form>
  );
}
```

- [ ] **Step 2: `document-delete-button.tsx`** (ConfirmDialog + try/catch + тост)

```tsx
"use client";
// src/features/documents/ui/document-delete-button.tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { deleteDocument, adminDeleteDocument } from "../actions";

interface Props {
  id: string;
  /** Куда вернуть после удаления. По умолчанию — мои документы. */
  redirectTo?: string;
  /** true → admin-эндпоинт. По умолчанию — обычный delete. */
  admin?: boolean;
  /** Текст триггера. */
  label?: string;
}

export function DocumentDeleteButton({
  id,
  redirectTo = "/documents/my",
  admin = false,
  label = "Удалить",
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">{label}</Button>}
      title="Удалить документ?"
      description="Действие необратимо. Если на документ ссылаются материалы — удаление будет отклонено."
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = admin ? await adminDeleteDocument(id) : await deleteDocument(id);
        if (!result.success) {
          if (result.code === "forbidden") {
            toast.add({
              title: "Нет прав",
              description: "У вас нет прав на удаление документа.",
            });
          } else {
            toast.add({ title: "Ошибка", description: result.error });
          }
          return;
        }
        startTransition(() => router.push(redirectTo));
      }}
    />
  );
}
```

> Паттерн скопирован с `src/features/glossary/ui/glossary-delete-button.tsx`: `useToast()` (НЕ `toast`-импорт — его в ui-kit нет), `ConfirmDialog` принимает `destructive` и `confirmLabel`. `toast.add({ title, description })`. Перед Task 15 сверь сигнатуру `ConfirmDialog` в `src/components/ui/confirm-dialog.tsx`.

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit 2>&1 | grep -iE 'visibility-button|delete-button' || echo "buttons OK"`
Expected: `buttons OK`

- [ ] **Step 4: Коммит**

```bash
git add src/features/documents/ui/document-visibility-button.tsx src/features/documents/ui/document-delete-button.tsx
git commit -m "feat(documents): visibility (private->public) and delete buttons"
```

---

### Task 16: Дополнить `index.ts` экспортами Этапа B

**Files:**
- Modify: `src/features/documents/index.ts`

- [ ] **Step 1: Добавить экспорты actions и форм**

В конец `src/features/documents/index.ts` (перед/после существующих, сохраняя сортировку логически — actions, затем UI) добавь:

```ts
export {
  createDocument,
  uploadDocument,
  updateDocumentMeta,
  updateDocumentBlocks,
  setDocumentVisibility,
  deleteDocument,
  adminDeleteDocument,
} from "./actions";
export { DocumentCreateForm } from "./ui/document-create-form";
export { DocumentUploadForm } from "./ui/document-upload-form";
export { DocumentEditForm } from "./ui/document-edit-form";
export { DocumentMetaForm } from "./ui/document-meta-form";
export { DocumentVisibilityButton } from "./ui/document-visibility-button";
export { DocumentDeleteButton } from "./ui/document-delete-button";
```

> **Конфликт-нотация:** если Этап C уже добавил свои UI-экспорты — НЕ удаляй их, просто допиши свои строки. Резолв тривиален.

- [ ] **Step 2: lint + tsc + tests Этапа B**

Run: `npm run lint && npx tsc --noEmit && npm test -- src/features/documents`
Expected: зелёное.

- [ ] **Step 3: Коммит**

```bash
git add src/features/documents/index.ts
git commit -m "feat(documents): export stage-B actions and forms"
```

---

### Task 17: Smoke-проверка Этапа B (сборка)

- [ ] **Step 1: build**

Run: `npm run build 2>&1 | tail -20`
Expected: сборка без ошибок (страницы появятся в Этапе C, но слайс должен компилироваться).

> Если build падает из-за того, что роуты ещё не созданы — это нормально только если ошибка не в `src/features/documents`. Любую ошибку внутри слайса фикси здесь.

- [ ] **Step 2: Коммит (если были фиксы)**

```bash
git add src/features/documents
git commit -m "fix(documents): stage-B build green" || echo "нечего коммитить"
```

---

## Этап C — страницы, detail, ревизии, контейнеры, export, admin

### Task 18: `document-detail.tsx`, `document-export-links.tsx`, `document-my-list.tsx`

**Files:**
- Create: `src/features/documents/ui/document-detail.tsx`
- Create: `src/features/documents/ui/document-export-links.tsx`
- Create: `src/features/documents/ui/document-my-list.tsx`

- [ ] **Step 1: `document-detail.tsx`** (server component, AstRender)

```tsx
// src/features/documents/ui/document-detail.tsx
import { AstRender } from "@/components/ast-render";
import type { Document } from "../types";

interface Props {
  document: Document;
}

export function DocumentDetail({ document }: Props) {
  const blocks = document.blocks ?? [];
  return (
    <article className="prose max-w-none">
      {blocks.length === 0 ? (
        <p className="text-sm text-(--color-description)">Документ пуст.</p>
      ) : (
        <AstRender blocks={blocks} />
      )}
    </article>
  );
}
```

- [ ] **Step 2: `document-export-links.tsx`**

```tsx
// src/features/documents/ui/document-export-links.tsx
import { documentExportUrls } from "../export-urls";

interface Props {
  id: string;
  className?: string;
}

/**
 * Ссылки на .md/.txt выгрузки документа. Ведут на локальный прокси-роут
 * /documents/[id]/export (см. export-urls.ts) — он подкладывает токен из cookie.
 */
export function DocumentExportLinks({ id, className }: Props) {
  const urls = documentExportUrls(id);
  return (
    <span className={className ?? "flex items-center gap-2 text-xs"}>
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

- [ ] **Step 3: `document-my-list.tsx`** (server component списка)

```tsx
// src/features/documents/ui/document-my-list.tsx
import Link from "next/link";
import type { Document } from "../types";

interface Props {
  documents: Document[];
}

const visibilityLabel: Record<string, string> = {
  private: "приватный",
  public: "публичный",
};

export function DocumentMyList({ documents }: Props) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-(--color-description)">
        У вас пока нет документов.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-(--color-border)">
      {documents.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between gap-2 py-2">
          <Link href={`/documents/${doc.id}`} className="text-sm hover:underline">
            {doc.filename || "Без названия"}
          </Link>
          <span className="text-xs text-(--color-description)">
            {visibilityLabel[doc.visibility ?? "private"] ?? doc.visibility}
          </span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: tsc**

Run: `npx tsc --noEmit 2>&1 | grep -iE 'document-detail|document-export-links|document-my-list' || echo "detail UI OK"`
Expected: `detail UI OK`

- [ ] **Step 5: Коммит**

```bash
git add src/features/documents/ui/document-detail.tsx src/features/documents/ui/document-export-links.tsx src/features/documents/ui/document-my-list.tsx
git commit -m "feat(documents): detail render, export links, my-list"
```

---

### Task 19: `document-revisions.tsx` + `document-containers.tsx`

**Files:**
- Create: `src/features/documents/ui/document-revisions.tsx`
- Create: `src/features/documents/ui/document-containers.tsx`

- [ ] **Step 1: `document-revisions.tsx`** (мостик к generic RevisionHistory, reverse)

```tsx
// src/features/documents/ui/document-revisions.tsx
import { AstRender } from "@/components/ast-render";
import { RevisionHistory } from "@/components/revision-history";
import { getDocumentRevision, getDocumentRevisions } from "../api";

interface Props {
  documentId: string;
  /** id выбранной ревизии из ?revision= страницы. */
  selectedRevisionId?: string | undefined;
}

/**
 * Server component: фетчит ревизии документа и рендерит generic RevisionHistory.
 * Показывается только для public-документов (private ревизий не имеют — гейт в
 * странице через canSeeRevisions). Бек отдаёт created_at ASC — переворачиваем.
 */
export async function DocumentRevisions({ documentId, selectedRevisionId }: Props) {
  const metas = await getDocumentRevisions(documentId);
  const selected = selectedRevisionId
    ? await getDocumentRevision(documentId, selectedRevisionId)
    : null;

  return (
    <RevisionHistory
      revisions={[...metas]
        .reverse()
        .flatMap((m) => (m.id ? [{ id: m.id, createdAt: m.created_at ?? "" }] : []))}
      selectedId={selected?.id}
      buildHref={(rid) => `/documents/${documentId}?revision=${rid}`}
    >
      {selected && (
        <div className="prose max-w-none">
          <AstRender blocks={selected.blocks ?? []} />
        </div>
      )}
    </RevisionHistory>
  );
}
```

- [ ] **Step 2: `document-containers.tsx`** (read-only список лекций-контейнеров через generic AttachmentsPanel)

```tsx
// src/features/documents/ui/document-containers.tsx
import { AttachmentsPanel } from "@/components/attachments";
import type { AttachmentItem } from "@/components/attachments";
import { getDocumentContainers } from "../api";

interface Props {
  documentId: string;
}

/**
 * Read-only список лекций, в которые включён документ (reverse-lookup
 * GET /api/documents/{id}/attachments). Управление attach/detach/reorder — на
 * странице лекции (lecture-enrichment, волна 3); здесь только просмотр
 * (canManage не передаём). Имя лекции бек в DTO не отдаёт — показываем id-плашку
 * со ссылкой на лекцию.
 */
export async function DocumentContainers({ documentId }: Props) {
  const dtos = await getDocumentContainers(documentId);
  const items: AttachmentItem[] = dtos.flatMap((d) =>
    d.container_id
      ? [
          {
            id: d.container_id,
            label: `Лекция ${d.container_id}`,
            sortOrder: d.sort_order ?? 0,
            href: `/lectures/${d.container_id}`,
            ...(d.entity_type ? { entityType: d.entity_type } : {}),
          },
        ]
      : [],
  );

  return (
    <AttachmentsPanel
      title="Включён в лекции"
      items={items}
      emptyText="Документ не включён ни в одну лекцию."
    />
  );
}
```

> **Заметка:** AttachmentDTO не содержит названия лекции (только `container_id`). В волне 2 показываем «Лекция {id}» со ссылкой. Если в волне 3 понадобится имя — оно резолвится на стороне страницы лекции, контракт generic-компонента (label-проп) это уже поддерживает.

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit 2>&1 | grep -iE 'document-revisions|document-containers' || echo "rev/cont OK"`
Expected: `rev/cont OK`

- [ ] **Step 4: Коммит**

```bash
git add src/features/documents/ui/document-revisions.tsx src/features/documents/ui/document-containers.tsx
git commit -m "feat(documents): revisions bridge and read-only containers list"
```

---

### Task 20: `document-admin-row.tsx` + дополнить `index.ts` (Этап C UI)

**Files:**
- Create: `src/features/documents/ui/document-admin-row.tsx`
- Modify: `src/features/documents/index.ts`

- [ ] **Step 1: `document-admin-row.tsx`**

```tsx
// src/features/documents/ui/document-admin-row.tsx
import Link from "next/link";
import { DocumentDeleteButton } from "./document-delete-button";
import type { Document } from "../types";

interface Props {
  document: Document;
  /** Можно ли admin-удалить (delete_any и не-private). */
  canDelete: boolean;
}

export function DocumentAdminRow({ document, canDelete }: Props) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="flex flex-col">
        <Link href={`/documents/${document.id}`} className="text-sm hover:underline">
          {document.filename || "Без названия"}
        </Link>
        <span className="text-xs text-(--color-description)">
          {document.visibility} · автор {document.owner_id}
        </span>
      </div>
      {canDelete && document.id && (
        <DocumentDeleteButton id={document.id} admin redirectTo="/admin/documents" />
      )}
    </li>
  );
}
```

- [ ] **Step 2: Дополнить `index.ts` UI-экспортами Этапа C**

Добавь в `src/features/documents/index.ts`:

```ts
export { DocumentDetail } from "./ui/document-detail";
export { DocumentExportLinks } from "./ui/document-export-links";
export { DocumentMyList } from "./ui/document-my-list";
export { DocumentRevisions } from "./ui/document-revisions";
export { DocumentContainers } from "./ui/document-containers";
export { DocumentAdminRow } from "./ui/document-admin-row";
```

- [ ] **Step 3: lint + tsc**

Run: `npm run lint && npx tsc --noEmit 2>&1 | grep -iE 'features/documents' || echo "slice OK"`
Expected: `slice OK`

- [ ] **Step 4: Коммит**

```bash
git add src/features/documents/ui/document-admin-row.tsx src/features/documents/index.ts
git commit -m "feat(documents): admin row and stage-C UI exports"
```

---

### Task 21: Страницы `/documents/my`, `/documents/[id]`, прокси-роут export

**Files:**
- Create: `src/app/documents/my/page.tsx`
- Create: `src/app/documents/[id]/page.tsx`
- Create: `src/app/documents/[id]/export/route.ts`

- [ ] **Step 1: `/documents/my/page.tsx`**

```tsx
// src/app/documents/my/page.tsx
import { redirect } from "next/navigation";
import { getMe } from "@/utils/me";
import { SchemaContextProvider } from "@/components/ast-editor";
import {
  canCreateDocument,
  getMyDocuments,
  DocumentCreateForm,
  DocumentUploadForm,
  DocumentMyList,
} from "@/features/documents";

export const metadata = { title: "Мои документы" };

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function MyDocumentsPage({ searchParams }: Props) {
  const me = await getMe();
  // Документы — приватная зона: гостя отправляем на логин.
  if (!me || me.status !== "active") redirect("/login");

  const { offset } = await searchParams;
  const result = await getMyDocuments({ offset: offset ? Number(offset) : 0, limit: 20 });
  const canCreate = canCreateDocument(me);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-bold">Мои документы</h1>
        <p className="text-sm text-(--color-description)">Всего: {result.total}</p>
      </header>

      {canCreate && (
        <section className="flex flex-col gap-6">
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              Создать документ
            </summary>
            <div className="mt-3">
              <SchemaContextProvider>
                <DocumentCreateForm />
              </SchemaContextProvider>
            </div>
          </details>
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              Загрузить .md
            </summary>
            <div className="mt-3">
              <DocumentUploadForm />
            </div>
          </details>
        </section>
      )}

      <DocumentMyList documents={result.items} />
    </main>
  );
}
```

> Проверь, что роут `/login` существует (слайс `auth`). Если он называется иначе — используй фактический путь логина. Гость не должен видеть «мои документы».

- [ ] **Step 2: `/documents/[id]/page.tsx`**

```tsx
// src/app/documents/[id]/page.tsx
import { notFound } from "next/navigation";
import { getMe } from "@/utils/me";
import { SchemaContextProvider } from "@/components/ast-editor";
import {
  canEditDocument,
  canDeleteDocument,
  canSeeRevisions,
  getDocumentById,
  DocumentDetail,
  DocumentMetaForm,
  DocumentEditForm,
  DocumentVisibilityButton,
  DocumentDeleteButton,
  DocumentExportLinks,
  DocumentRevisions,
  DocumentContainers,
} from "@/features/documents";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string }>;
}

export default async function DocumentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { revision } = await searchParams;
  const me = await getMe();
  const document = await getDocumentById(id);
  if (!document) notFound();

  const canEdit = canEditDocument(me, document);
  const canDelete = canDeleteDocument(me, document);
  const showRevisions = canSeeRevisions(document);
  const isPrivateOwned = canEdit && document.visibility === "private";

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{document.filename || "Документ"}</h1>
        {document.id && <DocumentExportLinks id={document.id} />}
      </header>

      <DocumentDetail document={document} />

      <DocumentContainers documentId={id} />

      {/* === СЛОТ ДЛЯ ANNOTATIONS (волна 3) ===
          annotations встраивается follow-up-коммитом ПОСЛЕ мержа documents.
          Точка композиции: здесь, под телом документа. Исполнитель annotations
          добавит <DocumentAnnotations documentId={id} entityType="document" />
          или аналог из своего слайса. Ничего другого менять не нужно. */}

      {canEdit && (
        <section className="flex flex-col gap-6 rounded border border-(--color-border) p-4">
          <h2 className="text-lg font-semibold">Редактирование</h2>
          <DocumentMetaForm document={document} />
          <SchemaContextProvider>
            <DocumentEditForm document={document} />
          </SchemaContextProvider>
          {isPrivateOwned && document.id && (
            <DocumentVisibilityButton id={document.id} />
          )}
        </section>
      )}

      {showRevisions && document.id && (
        <DocumentRevisions documentId={document.id} selectedRevisionId={revision} />
      )}

      {canDelete && document.id && (
        <div>
          <DocumentDeleteButton id={document.id} />
        </div>
      )}
    </main>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const document = await getDocumentById(id);
  return { title: document?.filename ?? "Документ" };
}
```

- [ ] **Step 3: `/documents/[id]/export/route.ts`** (прокси, паттерн events)

```ts
// src/app/documents/[id]/export/route.ts
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

/**
 * Прокси для .md/.txt выгрузок документа. Контент рендерит бек
 * (GET /api/documents/{id}.md|.txt — optionalAuth). Для приватного документа
 * владельца нужен Bearer-токен, которого нет при браузерной навигации
 * (auth-middleware бека cookie не читает). Роут подкладывает токен из
 * httpOnly-cookie и возвращает ответ бека как есть (включая 401/403/404).
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const format = request.nextUrl.searchParams.get("format") === "txt" ? "txt" : "md";
  const token = (await cookies()).get("token")?.value;

  const upstream = await fetch(
    `${API_URL}/api/documents/${encodeURIComponent(id)}.${format}`,
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

- [ ] **Step 4: tsc + lint**

Run: `npm run lint && npx tsc --noEmit 2>&1 | grep -iE 'app/documents' || echo "pages OK"`
Expected: `pages OK`

- [ ] **Step 5: Коммит**

```bash
git add src/app/documents
git commit -m "feat(documents): /documents/my, /documents/[id], md/txt export proxy"
```

---

### Task 22: Admin-страница `/admin/documents`

**Files:**
- Create: `src/app/admin/documents/page.tsx`

- [ ] **Step 1: Реализовать**

```tsx
// src/app/admin/documents/page.tsx
import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import { Pagination } from "@/components/ui";
import {
  canListAdminDocuments,
  canAdminDeleteDocument,
  getAdminDocuments,
  DocumentAdminRow,
} from "@/features/documents";

export const metadata = { title: "Документы — админ" };

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function AdminDocumentsPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canListAdminDocuments(me)) forbidden();

  const { offset } = await searchParams;
  const result = await getAdminDocuments({ offset: offset ? Number(offset) : 0, limit: 20 });

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Документы</h1>
        <p className="text-sm text-(--color-description)">
          Публичные документы. Всего: {result.total}
        </p>
      </header>

      <ul className="flex flex-col divide-y divide-(--color-border)">
        {result.items.map((doc) => (
          <DocumentAdminRow
            key={doc.id}
            document={doc}
            canDelete={canAdminDeleteDocument(me, doc)}
          />
        ))}
      </ul>

      <Pagination
        basePath="/admin/documents"
        offset={result.offset}
        limit={result.limit}
        total={result.total}
      />
    </section>
  );
}
```

> Пункт sidebar «Документы» в admin-layout НЕ добавляем (запретная зона — foundation-touch). До foundation-touch страница доступна по прямому URL `/admin/documents` (gate работает). См. секцию Foundation-touch.

- [ ] **Step 2: lint + tsc + build**

Run: `npm run lint && npx tsc --noEmit && npm run build 2>&1 | tail -15`
Expected: всё зелёное, страница `/admin/documents` в выводе сборки.

- [ ] **Step 3: Коммит**

```bash
git add src/app/admin/documents
git commit -m "feat(documents): admin list page (gate document.delete_any, public-only delete)"
```

---

## Этап D — финал

### Task 23: Финальная сборка, self-review, чеклист `_template/README.md`

- [ ] **Step 1: Полный прогон**

Run: `npm run lint && npm test && npm run build`
Expected: всё зелёное. Если красное — фикси, НЕ отключай правила.

- [ ] **Step 2: Self-review по чеклисту `src/features/_template/README.md`**

Проверь вручную:
- `index.ts` экспортирует только нужное снаружи. ✓ (см. задачи 11/16/20)
- `api.ts`, `actions.ts`, `permissions.ts`, `schemas.ts` начинаются с `import "server-only";`. ✓
- Каждая `canXxx` покрыта тестом. ✓ (permissions.test.ts — 6 групп)
- Каждая Zod-схема имеет success + failure тест. ✓ (schemas.test.ts — 5 схем)
- Использует `createFormAction`/`createAction` + `parseFormData` + `requireCapability`/локальный гейт + `revalidateEntity`. ✓
- Не импортит другие `@/features/*`. ✓ (только `@/components`, `@/utils`, `@/api`)
- `ui/.gitkeep` удалён, есть реальные UI-файлы. ✓
- exactOptionalPropertyTypes: опц. поля прокидываются conditional-spread'ом (`...(x ? {x} : {})`). Проверь, что нигде не передаётся `prop={undefined}` напрямую в типизированный optional.

- [ ] **Step 3: Финальный self-review коммит (если фиксы)**

```bash
git add src/features/documents src/components/attachments src/app/documents src/app/admin/documents src/api/tags.ts
git commit -m "chore(documents): final self-review fixes" || echo "нечего коммитить"
```

---

## Parallel-safety contract

Параллельно в волне 2 работают: `comments`, `media`, `annotations`. Порядок мержа: **documents → annotations** (annotations встраивается в страницу документа follow-up-коммитом ПОСЛЕ мержа documents). `documents` мержится ПЕРВЫМ и владеет `src/components/attachments/`.

**CREATE (новые файлы — конфликтов быть не может):**
- Весь `src/features/documents/**`
- Весь `src/components/attachments/**`
- `src/app/documents/my/page.tsx`
- `src/app/documents/[id]/page.tsx`
- `src/app/documents/[id]/export/route.ts`
- `src/app/admin/documents/page.tsx`

**MODIFY (shared — единственная точка контакта):**
- `src/api/tags.ts` — append-only, ключи в алфавите (`DOCUMENTS`). Другие фичи волны тоже могут дописывать свои теги — конфликт тривиален, резолвится механической склейкой (см. §5 спеки, протокол мержа п.6).

**RESERVE (НЕ ТРОГАЕМ — чужие зоны):**
- `src/app/lectures/[id]/page.tsx` — **резервирует `comments`**. Документ НЕ трогает страницу лекции. Управление attach со стороны лекции — `lecture-enrichment` (волна 3).
- `src/utils/permissions.ts` — запретная зона. `document.create`/`document.delete_any`/`entity.attach` НЕ добавляем в union — используем локальный `hasCap` (см. Task 4). Миграция — foundation-touch.
- `src/app/admin/layout.tsx`, `src/app/admin/admin-sidebar.tsx` — запретная зона. Пункт «Документы» НЕ добавляем — foundation-touch.
- `src/app/layout.tsx`, header — запретная зона. Пункт «Мои документы» НЕ добавляем — foundation-touch.
- `src/components/ui/*`, `src/components/ast-editor/*`, `src/components/ast-render/*`, `src/components/revision-history/*` — НЕ модифицируем (только импортируем; deep-import в `@/components/ast-editor/pickers/async-combobox` легален).
- Любые `@/features/*` кроме `documents` — ESLint запрещает cross-feature импорты.

**Слот для annotations (волна 3 / follow-up):** в `src/app/documents/[id]/page.tsx` оставлен размеченный комментарием слот под телом документа (см. Task 21 Step 2). Исполнитель annotations добавит туда свой компонент из слайса `annotations` follow-up-коммитом после мержа documents. Композиция через страницу (не cross-feature импорт): страница — нейтральная зона, оба слайса экспортируют свои компоненты через `index.ts`.

---

## Foundation-touch (НЕ в этой ветке — отдельный батч после мержа волны 2)

Эти касания запретных зон выполняет выделенный foundation-touch-агент ПОСЛЕ мержа фич волны 2 (см. §5 спеки):

1. **`src/utils/permissions.ts`** — добавить в union `Capability`: `"document.create"`, `"document.delete_any"`, `"entity.attach"` (а также `media.*`, `annotation.*`, `comment.*` от соседних фич волны 2). После этого слайс может заменить локальный `hasCap` на `can()` — но это уже отдельный рефактор, в волне 2 живём с `hasCap`.
2. **`src/app/admin/layout.tsx`** — добавить пункт sidebar «Документы» с гейтом `can(me, "document.delete_any")`:
   ```ts
   if (can(me, "document.delete_any")) {
     items.push({ href: "/admin/documents", label: "Документы" });
   }
   ```
   (media — пункта НЕ будет, admin-списка нет; см. §5 спеки.)
3. **Header (`src/app/layout.tsx` или header-компонент)** — добавить ссылку «Мои документы» (`/documents/my`) для авторизованных. Точное место — на усмотрение foundation-агента (там, где живут /calendar, /settings).

Эти пункты в волне 2 **не реализуем** — только фиксируем здесь как инвентарь.

---

## Контракт `src/components/attachments/` (для других Plan-агентов)

Generic-компонент, владелец — `documents`. Переиспользуют `lecture-enrichment` и `media` (волна 3). Импорт: `import { AttachmentsPanel, AttachTargetPicker } from "@/components/attachments"`.

**`AttachmentItem`** (доменно-нейтральный элемент):
```ts
{ id: string; label: string; sortOrder: number; href?: string; entityType?: string }
```

**`AttachmentsPanelProps`** (ключевые поля):
- `items: AttachmentItem[]` — сортируются по `sortOrder` внутри.
- `canManage?: boolean` — false (default) = read-only список; true = detach/reorder-кнопки.
- `canAttach?: boolean` — показывать ли кнопку «Прикрепить» (на беке = `entity.attach` ∧ ownership лекции — потребитель вычисляет на сервере, передаёт boolean).
- `onDetach?(item) => Promise<{ok}|{ok:false,error}>` — обязателен при `canManage`.
- `onReorder?(item, newSortOrder) => Promise<...>` — обязателен при `canManage`.
- `onAttach?(targetId, targetLabel) => Promise<...>` — обязателен при `canAttach`.
- `renderTargetPicker?({onSelect, onClose}) => ReactNode` — рендер-проп пикера цели (потребитель оборачивает `AttachTargetPicker` со своим fetcher'ом).
- `title?`, `emptyText?`, `className?`.

**`AttachmentActionResult`**: `{ ok: true } | { ok: false; error: string }` — потребитель оборачивает свой server action и нормализует результат (включая branded-текст для forbidden).

**`AttachTargetPicker`** (обёртка над `AsyncCombobox`):
```ts
{ fetcher: (q, offset, limit) => Promise<{ data: {id,label}[]; total: number|null }>;
  onSelect: (id, label) => void; onClose?: () => void; placeholder?: string }
```

**Гейтинг attach (§6.3 спеки, передать потребителям):** attach-кнопку показывать только при `can(me, "entity.attach") && me.id === lecture.owner_id`. На практике (§10.4 спеки) attach сейчас мёртв (лекции создают админы, у админа `entity.attach` де-факто не приводит к ownership), кнопка почти всегда скрыта — но строим по правилам. detach/reorder — только ownership лекции (без capability).

---

## Риски

1. **`document.Document` не содержит `title`** — отображаемое имя берём из `filename`. PATCH принимает `title`, но ответ возвращает `filename`. После PATCH делаем `revalidateEntity` — страница перечитает обновлённый `filename`. Риск: если бек не обновляет `filename` при PATCH title — отображение не изменится. Митигейшен: проверить поведение на dev-беке вручную; контракт PATCH тела (`{title}`) сверен с `request.go`.
2. **`.md/.txt` через прокси** — выбран прокси (не прямые ссылки), т.к. страница показывает и private-документы владельца. Для public-документа прокси тоже работает. Риск минимален (паттерн проверен на events).
3. **Ревизии только у public** — секцию ревизий гейтим `canSeeRevisions(doc)` (visibility === "public"). Если бек вернёт ревизии и для private (изменение поведения) — секция не покажется, но это не баг (просто консервативно). 
4. **`hasCap` дублирует логику `can()`** — осознанный временный костыль (union `Capability` — запретная зона). Тесты покрывают status-гейт. Митигейшен в foundation-touch.
5. **attach де-факто мёртв (§10.4)** — generic-компонент строим полностью, но на странице документа волны 2 используем только read-only. Реальный attach-flow появится в волне 3 (страница лекции). Риск: контракт `AttachmentsPanelProps` может потребовать доработки под нужды волны 3 — поэтому он задокументирован максимально полно и протестирован изолированно.
6. **`@/components/ui` экспорты** (`toast`, `ConfirmDialog`, `Button`, `select`-обёртки) — план опирается на API из образцов конвенций. Если фактический API отличается (например `toast` называется иначе) — исполнитель адаптирует под реальный ui-kit, НЕ меняя `src/components/ui` (запретная зона). Перед Task 15 проверь `src/components/ui/index.ts`.
7. **`/login` путь** — страница `/documents/my` редиректит гостя на `/login`. Если auth-слайс использует другой путь — поправить. Перед Task 21 проверь роуты `src/app/(auth)` / `src/app/login`.
8. **multipart upload через ручной fetch** — `parseFormData` не умеет File, поэтому upload идёт прямым fetch'ем (паттерн `upload-image.ts`). Пересобираем FormData с whitelisted-полями (`file`, `visibility`), чтобы не протекли лишние поля. Размер/тип валидирует бек (≤10MB, .md/.markdown) — UX-ошибки маппим из кода/статуса.
9. **Reorder не атомарный swap** — generic-панель присваивает sortOrder соседа без обмена. На странице документа reorder не используется (read-only). Для волны 3 контракт допускает два вызова `onReorder` для строгого swap. Зафиксировано в коде-заметке Task 10.

---

## Чеклист соответствия спеке (self-review)

- `/documents/my` (GET /api/me/documents) — Task 21 ✓
- Страница `/documents/[id]` (AstRender) — Task 18/21 ✓
- Share-токен viewer (волна 3) — НЕ делаем (только прокси токеном владельца) ✓
- Создание двумя путями (JSON + upload multipart) — Task 13 ✓
- Редактирование blocks через AstEditor (owner-only) — Task 14 + гейт `canEditDocument` ✓
- PATCH метаданных (title) — Task 14 (description нет в API — не делаем) ✓
- Видимость private→public ONLY (422 PUBLIC_IMMUTABLE, UI без даунгрейда) — Task 15 ✓
- Удаление (owner; 409 DOCUMENT_REFERENCED → текст) — Task 12/15 ✓
- Ревизии (revision-history, reverse) — Task 19 ✓
- Список лекций-контейнеров (GET /api/documents/{id}/attachments) — Task 19 ✓
- admin /admin/documents + delete_any только public (§6.2) — Task 20/22 ✓
- `src/components/attachments/` generic (props-контракт, AsyncCombobox-пикер, §6.3 гейты) — Task 8–10 ✓
- .md/.txt — прокси (optionalAuth) — Task 6/18/21 ✓
- Уроки волны 1: uppercase-коды (rethrowApiError), exactOptionalPropertyTypes (conditional spread), branded 403 (тексты «У вас нет прав…»), server-only (api/actions/permissions/schemas), локальная пагинация (используем ui-kit Pagination на admin/my — фильтров нет, потери query не критичны; если появятся фильтры — взять audit-pattern) ✓
- Foundation-touch секция (sidebar «Документы», header «Мои документы», union миграция) — ✓
- Тесты: permissions 6 групп (4+ кейса), schemas 5 схем (success+failure) — ✓
- Parallel-safety contract — ✓
- Midpoint — конец Этапа A (Task 11) ✓
```
