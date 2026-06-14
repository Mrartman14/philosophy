# Offline Persistence Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> ⚠️ **СТАТУС: подлежит регенерации.** Этот план написан под lecture-specific модель. После перехода на **generic foundation** (см. `docs/superpowers/specs/2026-06-14-offline-mode-design.md` v2) типы обобщаются: `SavedLectureRecord` → `SavedBundleRecord` (key = `${entity}:${id}`, `snapshot: TSnapshot`), а `outbox` — entity-agnostic команда (`{clientId, entity, op, payload}`, индексы `by-status`/`by-entity`). Структура задач и TDD-подход сохраняются; план будет перегенерирован из спека v2 перед исполнением.

**Goal:** Построить изолированный, полностью покрытый unit-тестами слой персистентности офлайна (`src/services/offline/`): типизированный контракт, IndexedDB-хранилище (saved-lectures + outbox), кэш картинок в Cache Storage и обёртки persistent-storage.

**Architecture:** Слой не знает про UI и про источник данных. Чистые типы в `contract.ts` (изоморфны, без рантайма); browser-only CRUD-модули поверх `idb` и Cache Storage в `store/*`. Это фундамент для client-адаптера Репозитория (чтение) и драйвера синка (запись), которые идут отдельными планами.

**Tech Stack:** TypeScript 6, `idb` (обёртка IndexedDB), Cache Storage API, `navigator.storage`; тесты — vitest 4 (jsdom, `globals:false`) + `fake-indexeddb`.

**Контекст проекта (важно для исполнителя):**
- pnpm 8.14.3 — ставить **только** `pnpm add`, не `npm` (ломает тулчейн).
- Alias `@/` → `src/`. Тесты co-located: `foo.ts` → `foo.test.ts` рядом. В тестах импорт хелперов явный: `import { describe, it, expect } from "vitest"` (globals выключены).
- `src/services/*` — foundation/запретная зона по `CLAUDE.md`: это координированный foundation-PR, не фича-слайс. Добавлять в git **только свои файлы по имени**, без `git add -A`. Не трогать `public/sw.js` и `.env.development.local` (чужие незакоммиченные изменения).
- `vitest.config.ts` НЕ трогаем (frozen) — `fake-indexeddb` подключаем импортом `"fake-indexeddb/auto"` прямо в тест-файлах.
- Модули `store/*` — **browser-only** (используют `indexedDB`/`caches`/`navigator.storage`); импортировать их можно только из клиентского кода. `contract.ts` — изоморфен (только типы/константы).
- Перед коммитом каждой задачи: `pnpm test` зелёный; в конце плана — `pnpm lint && pnpm typecheck && pnpm test`.

---

## File Structure

| Файл | Ответственность |
|---|---|
| `src/services/offline/contract.ts` | Чистые типы + константы (имя/версия БД, имя кэша). Без рантайм-зависимостей. |
| `src/services/offline/store/db.ts` | `openOfflineDb()` — открытие IndexedDB, схема стора + индексы, миграции. |
| `src/services/offline/store/saved-lectures.ts` | CRUD сохранённых лекций (put/get/list/delete/setStatus). |
| `src/services/offline/store/outbox.ts` | Очередь записей: enqueue, выборки по статусу/родителю, update, delete. |
| `src/services/offline/store/images.ts` | Кэш картинок в Cache Storage (cache/has/match). |
| `src/services/offline/store/persistence.ts` | `requestPersistentStorage`/`isStoragePersisted`/`getStorageEstimate`. |
| `*.test.ts` | Co-located unit-тесты для каждого модуля (кроме `contract.ts` — type-only). |

---

## Task 1: Зависимости + контракт типов

**Files:**
- Modify: `package.json` (добавить `idb`, `fake-indexeddb`)
- Create: `src/services/offline/contract.ts`

- [ ] **Step 1: Поставить зависимости**

Run:
```bash
pnpm add idb@^8.0.0
pnpm add -D fake-indexeddb@^6.0.0
```
Expected: `package.json` обновлён, `pnpm-lock.yaml` обновлён, установка завершилась кодом 0.

- [ ] **Step 2: Создать контракт типов**

Create `src/services/offline/contract.ts`:
```ts
// src/services/offline/contract.ts
// Чистые типы и константы слоя персистентности офлайна.
// Без рантайм/браузерных зависимостей — безопасно импортировать из client, server и тестов.
import type { components } from "@/api/schema";

export const OFFLINE_DB_NAME = "flbz-offline";
export const OFFLINE_DB_VERSION = 1;
export const OFFLINE_IMAGE_CACHE = "flbz-offline-images";

type Schemas = components["schemas"];

export type LectureMeta = Schemas["lecture.Lecture"];
export type LectureTag = Schemas["tag.Tag"];
export type CommentSubtree = Schemas["comment.RootSubtree"];
export type Annotation = Schemas["annotation.Annotation"];

/** Состояние сохранения лекции офлайн. */
export type SavedLectureStatus = "saving" | "complete" | "error";

/** Полный снимок лекции для офлайн-чтения. */
export interface OfflineLectureBundle {
  lectureId: string;
  savedAt: string; // ISO, проставляется на клиенте
  schemaVersion: number;
  lecture: LectureMeta;
  tags: LectureTag[];
  comments: CommentSubtree[]; // ВСЕ страницы
  annotations: Annotation[];
  imageKeys: string[]; // sha256-ключи картинок (cover + image-ноды)
}

/** Запись в IndexedDB store `saved-lectures` (keyPath: lectureId). */
export interface SavedLectureRecord extends OfflineLectureBundle {
  status: SavedLectureStatus;
  error?: string;
}

/** Статус операции в outbox. */
export type OutboxStatus = "pending" | "syncing" | "failed" | "done";

/** Родитель аннотации (lecture в parent-типы НЕ входит). */
export type AnnotationParentType = "document" | "comment" | "glossary" | "media";

/** Тело создания аннотации (адресация родителя + контент). */
export interface OutboxAnnotationPayload {
  parent_entity_type: AnnotationParentType;
  parent_entity_id: string;
  blocks: NonNullable<Annotation["blocks"]>;
  visibility: "private" | "public";
}

/** Запись в IndexedDB store `outbox` (keyPath: clientId). */
export interface OutboxEntry {
  clientId: string; // crypto.randomUUID(): temp-id == idempotency-key == reconcile-key
  type: "annotation.create";
  payload: OutboxAnnotationPayload;
  createdAt: string; // ISO
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  serverId?: string;
}

/** Вход для постановки в очередь; служебные поля проставляет enqueue. */
export type OutboxEnqueueInput = Pick<OutboxEntry, "type" | "payload"> & {
  clientId?: string; // по умолчанию crypto.randomUUID()
  createdAt?: string; // по умолчанию new Date().toISOString()
};
```

- [ ] **Step 3: Проверить типы**

Run: `pnpm typecheck`
Expected: PASS (нет ошибок; `contract.ts` компилируется, ключи схемы существуют).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/services/offline/contract.ts
git commit -m "feat(offline): add idb deps and persistence contract types"
```

---

## Task 2: Открытие IndexedDB-базы (схема + индексы)

**Files:**
- Create: `src/services/offline/store/db.ts`
- Test: `src/services/offline/store/db.test.ts`

- [ ] **Step 1: Написать падающий тест**

Create `src/services/offline/store/db.test.ts`:
```ts
// src/services/offline/store/db.test.ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach } from "vitest";

import { openOfflineDb } from "./db";

beforeEach(() => {
  // Свежая in-memory IndexedDB на каждый тест — изоляция.
  globalThis.indexedDB = new IDBFactory();
});

describe("openOfflineDb", () => {
  it("создаёт сторы saved-lectures и outbox", async () => {
    const db = await openOfflineDb();
    expect(Array.from(db.objectStoreNames).sort()).toEqual([
      "outbox",
      "saved-lectures",
    ]);
    db.close();
  });

  it("создаёт индексы by-status и by-parent на outbox", async () => {
    const db = await openOfflineDb();
    const tx = db.transaction("outbox", "readonly");
    expect(Array.from(tx.store.indexNames).sort()).toEqual([
      "by-parent",
      "by-status",
    ]);
    db.close();
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/services/offline/store/db.test.ts`
Expected: FAIL — `Cannot find module "./db"` / `openOfflineDb is not a function`.

- [ ] **Step 3: Реализовать db.ts**

Create `src/services/offline/store/db.ts`:
```ts
// src/services/offline/store/db.ts
// Browser-only: открывает IndexedDB-базу офлайна (использует глобальный indexedDB).
// Импортировать только из клиентского кода.
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  type SavedLectureRecord,
  type OutboxEntry,
  type OutboxStatus,
} from "../contract";

export interface OfflineDB extends DBSchema {
  "saved-lectures": {
    key: string;
    value: SavedLectureRecord;
  };
  outbox: {
    key: string;
    value: OutboxEntry;
    indexes: {
      "by-status": OutboxStatus;
      "by-parent": string;
    };
  };
}

export function openOfflineDb(): Promise<IDBPDatabase<OfflineDB>> {
  return openDB<OfflineDB>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("saved-lectures")) {
        db.createObjectStore("saved-lectures", { keyPath: "lectureId" });
      }
      if (!db.objectStoreNames.contains("outbox")) {
        const outbox = db.createObjectStore("outbox", { keyPath: "clientId" });
        outbox.createIndex("by-status", "status");
        outbox.createIndex("by-parent", "payload.parent_entity_id");
      }
    },
  });
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/services/offline/store/db.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 5: Commit**

```bash
git add src/services/offline/store/db.ts src/services/offline/store/db.test.ts
git commit -m "feat(offline): open IndexedDB with saved-lectures and outbox stores"
```

---

## Task 3: CRUD сохранённых лекций

**Files:**
- Create: `src/services/offline/store/saved-lectures.ts`
- Test: `src/services/offline/store/saved-lectures.test.ts`

- [ ] **Step 1: Написать падающий тест**

Create `src/services/offline/store/saved-lectures.test.ts`:
```ts
// src/services/offline/store/saved-lectures.test.ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach } from "vitest";

import {
  putSavedLecture,
  getSavedLecture,
  listSavedLectures,
  deleteSavedLecture,
  setSavedLectureStatus,
} from "./saved-lectures";
import type { SavedLectureRecord } from "../contract";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

function makeRecord(id: string): SavedLectureRecord {
  return {
    lectureId: id,
    savedAt: "2026-06-14T00:00:00.000Z",
    schemaVersion: 1,
    lecture: { id, title: "T", date: "2026-01-01" } as SavedLectureRecord["lecture"],
    tags: [],
    comments: [],
    annotations: [],
    imageKeys: [],
    status: "saving",
  };
}

describe("saved-lectures store", () => {
  it("put + get возвращает ту же запись", async () => {
    await putSavedLecture(makeRecord("l1"));
    const got = await getSavedLecture("l1");
    expect(got?.lectureId).toBe("l1");
    expect(got?.status).toBe("saving");
  });

  it("get несуществующей возвращает undefined", async () => {
    expect(await getSavedLecture("nope")).toBeUndefined();
  });

  it("list возвращает все сохранённые", async () => {
    await putSavedLecture(makeRecord("l1"));
    await putSavedLecture(makeRecord("l2"));
    const all = await listSavedLectures();
    expect(all.map((r) => r.lectureId).sort()).toEqual(["l1", "l2"]);
  });

  it("delete удаляет запись", async () => {
    await putSavedLecture(makeRecord("l1"));
    await deleteSavedLecture("l1");
    expect(await getSavedLecture("l1")).toBeUndefined();
  });

  it("setSavedLectureStatus меняет статус и пишет error", async () => {
    await putSavedLecture(makeRecord("l1"));
    await setSavedLectureStatus("l1", "error", "boom");
    const got = await getSavedLecture("l1");
    expect(got?.status).toBe("error");
    expect(got?.error).toBe("boom");
  });

  it("setSavedLectureStatus на несуществующей — no-op", async () => {
    await setSavedLectureStatus("nope", "complete");
    expect(await getSavedLecture("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/services/offline/store/saved-lectures.test.ts`
Expected: FAIL — модуль `./saved-lectures` не найден.

- [ ] **Step 3: Реализовать saved-lectures.ts**

Create `src/services/offline/store/saved-lectures.ts`:
```ts
// src/services/offline/store/saved-lectures.ts
// Browser-only CRUD сохранённых лекций.
import { openOfflineDb } from "./db";
import type { SavedLectureRecord, SavedLectureStatus } from "../contract";

export async function putSavedLecture(record: SavedLectureRecord): Promise<void> {
  const db = await openOfflineDb();
  await db.put("saved-lectures", record);
  db.close();
}

export async function getSavedLecture(
  lectureId: string,
): Promise<SavedLectureRecord | undefined> {
  const db = await openOfflineDb();
  const record = await db.get("saved-lectures", lectureId);
  db.close();
  return record;
}

export async function listSavedLectures(): Promise<SavedLectureRecord[]> {
  const db = await openOfflineDb();
  const all = await db.getAll("saved-lectures");
  db.close();
  return all;
}

export async function deleteSavedLecture(lectureId: string): Promise<void> {
  const db = await openOfflineDb();
  await db.delete("saved-lectures", lectureId);
  db.close();
}

export async function setSavedLectureStatus(
  lectureId: string,
  status: SavedLectureStatus,
  error?: string,
): Promise<void> {
  const db = await openOfflineDb();
  const existing = await db.get("saved-lectures", lectureId);
  if (existing) {
    await db.put("saved-lectures", { ...existing, status, error });
  }
  db.close();
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/services/offline/store/saved-lectures.test.ts`
Expected: PASS (6 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/services/offline/store/saved-lectures.ts src/services/offline/store/saved-lectures.test.ts
git commit -m "feat(offline): saved-lectures CRUD store"
```

---

## Task 4: Очередь outbox

**Files:**
- Create: `src/services/offline/store/outbox.ts`
- Test: `src/services/offline/store/outbox.test.ts`

- [ ] **Step 1: Написать падающий тест**

Create `src/services/offline/store/outbox.test.ts`:
```ts
// src/services/offline/store/outbox.test.ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach } from "vitest";

import {
  enqueueOutbox,
  getOutboxEntry,
  listOutboxByStatus,
  listOutboxByParent,
  updateOutboxEntry,
  deleteOutboxEntry,
} from "./outbox";
import type { OutboxEnqueueInput } from "../contract";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

function makeInput(parentId: string): OutboxEnqueueInput {
  return {
    type: "annotation.create",
    payload: {
      parent_entity_type: "document",
      parent_entity_id: parentId,
      blocks: [],
      visibility: "private",
    },
  };
}

describe("outbox store", () => {
  it("enqueue проставляет clientId, createdAt, status=pending, attempts=0", async () => {
    const entry = await enqueueOutbox(makeInput("doc-1"));
    expect(entry.clientId).toMatch(/[0-9a-f-]{36}/);
    expect(entry.status).toBe("pending");
    expect(entry.attempts).toBe(0);
    expect(typeof entry.createdAt).toBe("string");
    expect(await getOutboxEntry(entry.clientId)).toMatchObject({
      clientId: entry.clientId,
      status: "pending",
    });
  });

  it("enqueue уважает переданный clientId (идемпотентность)", async () => {
    const entry = await enqueueOutbox({ ...makeInput("doc-1"), clientId: "fixed-id" });
    expect(entry.clientId).toBe("fixed-id");
  });

  it("listOutboxByStatus фильтрует по статусу", async () => {
    const a = await enqueueOutbox(makeInput("doc-1"));
    await enqueueOutbox(makeInput("doc-2"));
    await updateOutboxEntry(a.clientId, { status: "done" });
    const pending = await listOutboxByStatus("pending");
    const done = await listOutboxByStatus("done");
    expect(pending).toHaveLength(1);
    expect(done).toHaveLength(1);
    expect(done[0].clientId).toBe(a.clientId);
  });

  it("listOutboxByParent находит записи по parent_entity_id", async () => {
    await enqueueOutbox(makeInput("doc-1"));
    await enqueueOutbox(makeInput("doc-1"));
    await enqueueOutbox(makeInput("doc-2"));
    expect(await listOutboxByParent("doc-1")).toHaveLength(2);
    expect(await listOutboxByParent("doc-2")).toHaveLength(1);
  });

  it("updateOutboxEntry мёржит patch (serverId, attempts, lastError)", async () => {
    const e = await enqueueOutbox(makeInput("doc-1"));
    await updateOutboxEntry(e.clientId, {
      status: "failed",
      attempts: 2,
      lastError: "forbidden",
      serverId: "srv-1",
    });
    const got = await getOutboxEntry(e.clientId);
    expect(got).toMatchObject({
      status: "failed",
      attempts: 2,
      lastError: "forbidden",
      serverId: "srv-1",
    });
  });

  it("deleteOutboxEntry удаляет запись", async () => {
    const e = await enqueueOutbox(makeInput("doc-1"));
    await deleteOutboxEntry(e.clientId);
    expect(await getOutboxEntry(e.clientId)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/services/offline/store/outbox.test.ts`
Expected: FAIL — модуль `./outbox` не найден.

- [ ] **Step 3: Реализовать outbox.ts**

Create `src/services/offline/store/outbox.ts`:
```ts
// src/services/offline/store/outbox.ts
// Browser-only: персистентная очередь отложенных записей (создание аннотаций).
import { openOfflineDb } from "./db";
import type { OutboxEntry, OutboxEnqueueInput, OutboxStatus } from "../contract";

export async function enqueueOutbox(input: OutboxEnqueueInput): Promise<OutboxEntry> {
  const entry: OutboxEntry = {
    clientId: input.clientId ?? crypto.randomUUID(),
    type: input.type,
    payload: input.payload,
    createdAt: input.createdAt ?? new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
  const db = await openOfflineDb();
  await db.put("outbox", entry);
  db.close();
  return entry;
}

export async function getOutboxEntry(
  clientId: string,
): Promise<OutboxEntry | undefined> {
  const db = await openOfflineDb();
  const entry = await db.get("outbox", clientId);
  db.close();
  return entry;
}

export async function listOutboxByStatus(
  status: OutboxStatus,
): Promise<OutboxEntry[]> {
  const db = await openOfflineDb();
  const list = await db.getAllFromIndex("outbox", "by-status", status);
  db.close();
  return list;
}

export async function listOutboxByParent(
  parentEntityId: string,
): Promise<OutboxEntry[]> {
  const db = await openOfflineDb();
  const list = await db.getAllFromIndex("outbox", "by-parent", parentEntityId);
  db.close();
  return list;
}

export async function updateOutboxEntry(
  clientId: string,
  patch: Partial<Omit<OutboxEntry, "clientId">>,
): Promise<void> {
  const db = await openOfflineDb();
  const existing = await db.get("outbox", clientId);
  if (existing) {
    await db.put("outbox", { ...existing, ...patch });
  }
  db.close();
}

export async function deleteOutboxEntry(clientId: string): Promise<void> {
  const db = await openOfflineDb();
  await db.delete("outbox", clientId);
  db.close();
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/services/offline/store/outbox.test.ts`
Expected: PASS (6 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/services/offline/store/outbox.ts src/services/offline/store/outbox.test.ts
git commit -m "feat(offline): outbox queue store with status/parent indexes"
```

---

## Task 5: Кэш картинок в Cache Storage

**Files:**
- Create: `src/services/offline/store/images.ts`
- Test: `src/services/offline/store/images.test.ts`

- [ ] **Step 1: Написать падающий тест**

Create `src/services/offline/store/images.test.ts`:
```ts
// src/services/offline/store/images.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import { cacheImage, hasCachedImage, matchCachedImage } from "./images";

// Минимальный in-memory фейк Cache Storage (jsdom его не предоставляет).
class FakeCache {
  store = new Map<string, Response>();
  async put(url: string, res: Response) {
    this.store.set(url, res);
  }
  async match(url: string) {
    return this.store.get(url);
  }
}

beforeEach(() => {
  const cache = new FakeCache();
  vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue(cache) });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("images cache", () => {
  it("cacheImage кладёт ответ в кэш при 200 и возвращает true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("img-bytes", { status: 200 })),
    );
    const ok = await cacheImage("/static/files/abc");
    expect(ok).toBe(true);
    expect(await hasCachedImage("/static/files/abc")).toBe(true);
  });

  it("cacheImage возвращает false и НЕ кэширует при не-ok ответе", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 404 })),
    );
    const ok = await cacheImage("/static/files/missing");
    expect(ok).toBe(false);
    expect(await hasCachedImage("/static/files/missing")).toBe(false);
  });

  it("matchCachedImage возвращает Response из кэша", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("img-bytes", { status: 200 })),
    );
    await cacheImage("/static/files/abc");
    const res = await matchCachedImage("/static/files/abc");
    expect(res).toBeInstanceOf(Response);
    expect(await res!.text()).toBe("img-bytes");
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/services/offline/store/images.test.ts`
Expected: FAIL — модуль `./images` не найден.

- [ ] **Step 3: Реализовать images.ts**

Create `src/services/offline/store/images.ts`:
```ts
// src/services/offline/store/images.ts
// Browser-only: кэш картинок офлайна в Cache Storage.
// `<img src="/static/files/{key}">` отдаётся прозрачно из кэша через SW.
import { OFFLINE_IMAGE_CACHE } from "../contract";

export async function cacheImage(url: string): Promise<boolean> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) return false;
  const cache = await caches.open(OFFLINE_IMAGE_CACHE);
  await cache.put(url, res);
  return true;
}

export async function hasCachedImage(url: string): Promise<boolean> {
  const cache = await caches.open(OFFLINE_IMAGE_CACHE);
  return (await cache.match(url)) !== undefined;
}

export async function matchCachedImage(url: string): Promise<Response | undefined> {
  const cache = await caches.open(OFFLINE_IMAGE_CACHE);
  return cache.match(url);
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/services/offline/store/images.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/services/offline/store/images.ts src/services/offline/store/images.test.ts
git commit -m "feat(offline): Cache Storage helper for offline images"
```

---

## Task 6: Persistent storage + estimate

**Files:**
- Create: `src/services/offline/store/persistence.ts`
- Test: `src/services/offline/store/persistence.test.ts`

- [ ] **Step 1: Написать падающий тест**

Create `src/services/offline/store/persistence.test.ts`:
```ts
// src/services/offline/store/persistence.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  requestPersistentStorage,
  isStoragePersisted,
  getStorageEstimate,
} from "./persistence";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("persistence", () => {
  it("requestPersistentStorage возвращает результат navigator.storage.persist", async () => {
    vi.stubGlobal("navigator", {
      storage: { persist: vi.fn().mockResolvedValue(true) },
    });
    expect(await requestPersistentStorage()).toBe(true);
  });

  it("requestPersistentStorage возвращает false если API недоступен", async () => {
    vi.stubGlobal("navigator", { storage: {} });
    expect(await requestPersistentStorage()).toBe(false);
  });

  it("isStoragePersisted проксирует navigator.storage.persisted", async () => {
    vi.stubGlobal("navigator", {
      storage: { persisted: vi.fn().mockResolvedValue(true) },
    });
    expect(await isStoragePersisted()).toBe(true);
  });

  it("getStorageEstimate нормализует usage/quota (undefined → 0)", async () => {
    vi.stubGlobal("navigator", {
      storage: { estimate: vi.fn().mockResolvedValue({ usage: 1024 }) },
    });
    expect(await getStorageEstimate()).toEqual({ usage: 1024, quota: 0 });
  });

  it("getStorageEstimate возвращает нули если API недоступен", async () => {
    vi.stubGlobal("navigator", { storage: {} });
    expect(await getStorageEstimate()).toEqual({ usage: 0, quota: 0 });
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/services/offline/store/persistence.test.ts`
Expected: FAIL — модуль `./persistence` не найден.

- [ ] **Step 3: Реализовать persistence.ts**

Create `src/services/offline/store/persistence.ts`:
```ts
// src/services/offline/store/persistence.ts
// Browser-only: защита явно сохранённого контента от LRU-вытеснения origin'а.
export interface OfflineStorageEstimate {
  usage: number;
  quota: number;
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export async function isStoragePersisted(): Promise<boolean> {
  if (!navigator.storage?.persisted) return false;
  return navigator.storage.persisted();
}

export async function getStorageEstimate(): Promise<OfflineStorageEstimate> {
  if (!navigator.storage?.estimate) return { usage: 0, quota: 0 };
  const estimate = await navigator.storage.estimate();
  return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/services/offline/store/persistence.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 5: Финальная проверка всего слоя + commit**

Run:
```bash
pnpm lint && pnpm typecheck && pnpm test
```
Expected: всё PASS (lint чистый, типы ок, все офлайн-тесты зелёные, существующие тесты не сломаны).

```bash
git add src/services/offline/store/persistence.ts src/services/offline/store/persistence.test.ts
git commit -m "feat(offline): persistent-storage and quota-estimate helpers"
```

---

## Self-Review

**Покрытие спека (§4, §6 дизайна):**
- IndexedDB stores `saved-lectures` + `outbox` с индексами — Task 2. ✓
- `OfflineLectureBundle` / `OutboxEntry` / `clientId` (UUID = temp-id = idempotency-key) — Task 1 (contract). ✓
- Cache Storage `flbz-offline-images` — Task 5. ✓
- `persist()` + `estimate()` — Task 6. ✓
- Домен-агностичность слоя (не знает про UI/источник) — обеспечена: модули принимают/отдают типы контракта, без зависимостей от фич. ✓

**Вне скоупа этого плана (следующие планы):** client-адаптер Репозитория и server-адаптер (чтение); сборка bundle (`getOfflineBundle` action, слайс A); route handler + foreground-драйвер синка + reconcile (слайс B); правки SW (cache `/static/files/*`, app-shell `/saved*`); UI раздела «Сохранённые» и индикатор места. Эти планы зависят от данного слоя.

**Плейсхолдеры:** нет — весь код приведён целиком, команды и ожидаемый вывод конкретны.

**Согласованность типов:** имена функций (`putSavedLecture`, `enqueueOutbox`, `listOutboxByStatus`, `updateOutboxEntry`, `cacheImage`, `requestPersistentStorage`, …) и типов (`SavedLectureRecord`, `OutboxEntry`, `OutboxEnqueueInput`, `OutboxStatus`, `OfflineStorageEstimate`) совпадают между тестами и реализацией. Индексы `by-status`/`by-parent` объявлены в `OfflineDB` (Task 2) и используются в Task 4. ✓

**Заметки для исполнителя:**
- `git add` — только перечисленные файлы по имени; `public/sw.js` и `.env.development.local` не трогать.
- Если `pnpm add` под `node-linker=hoisted` ругается на `unrs-resolver` postinstall — это известная вещь (см. `pnpm.neverBuiltDependencies` в package.json), установка всё равно проходит; не «чинить» обходными путями.
