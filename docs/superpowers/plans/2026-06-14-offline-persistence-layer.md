# Offline Persistence Layer (generic) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить изолированный, полностью покрытый unit-тестами **entity-agnostic** слой персистентности офлайна (`src/services/offline/`): generic-контракт хранилища, IndexedDB (`saved-bundles` по ключу `${entity}:${id}` + `outbox` как очередь команд), кэш картинок в Cache Storage и обёртки persistent-storage.

**Architecture:** Слой не знает ни про UI, ни про конкретную сущность, ни про источник данных. Чистые типы/константы в `contract/storage.ts` (изоморфны); browser-only CRUD-модули поверх `idb` и Cache Storage в `store/*`. Это фундамент generic offline foundation (см. `docs/superpowers/specs/2026-06-14-offline-mode-design.md` v2): поверх него встанут `OfflineDescriptor`/registry, репозиторий-контракт и sync-драйвер (отдельные планы).

**Tech Stack:** TypeScript 6 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `idb`, Cache Storage API, `navigator.storage`; тесты — vitest 4 (jsdom, `globals:false`) + `fake-indexeddb`; lint — `tseslint.configs.strictTypeChecked` (в т.ч. `no-non-null-assertion`, `no-unnecessary-condition` = error, действуют и на тесты).

**Контекст проекта (важно для исполнителя):**

- pnpm 8.14.3 — ставить только `pnpm add`, не `npm`.
- Alias `@/` → `src/`. Тесты co-located. В тестах импорт явный: `import { describe, it, expect } from "vitest"` (globals выключены).
- `src/services/*` — foundation/запретная зона по `CLAUDE.md`: координированный foundation-PR. `git add` — только свои файлы по имени, без `git add -A`. Не трогать `public/sw.js` и `.env.development.local`.
- `vitest.config.ts` НЕ трогаем (frozen) — `fake-indexeddb` подключаем импортом `"fake-indexeddb/auto"` в тест-файлах.
- Модули `store/*` — browser-only (используют `indexedDB`/`caches`/`navigator.storage`); импортировать только из клиентского кода. `contract/storage.ts` — изоморфен (только типы/константы/чистая `bundleKey`).
- **Strict-флаги, на которых легко споткнуться** (учтены в коде ниже): `noUncheckedIndexedAccess` (индексный доступ `arr[0]` → `T | undefined`, использовать `?.`); `exactOptionalPropertyTypes` (нельзя присваивать `undefined` в `field?: T` — патчи собирать через `Partial<…>`-spread, не передавать явный `undefined`); `no-non-null-assertion` (никаких `x!` — нарраивать guard'ом); `no-unnecessary-condition` (feature-detection web-API — через локальный тип с optional-методами, см. Task 6).
- Перед коммитом каждой задачи: `pnpm test` зелёный; в конце — `pnpm lint && pnpm typecheck && pnpm test`.

---

## File Structure

| Файл | Ответственность |
|---|---|
| `src/services/offline/contract/storage.ts` | Generic типы (`SavedBundleRecord<T>`, `OutboxCommand<T>`), статусы, константы БД/кэша, чистая `bundleKey`. Без рантайма. |
| `src/services/offline/store/db.ts` | `openOfflineDb()` — IndexedDB, сторы + индексы, миграции. |
| `src/services/offline/store/saved-bundles.ts` | CRUD снимков (put/get/list/listByEntity/listByStatus/update/delete), ключ из `entity`+`id`. |
| `src/services/offline/store/outbox.ts` | Generic очередь команд: enqueue, list (all/by-status/by-entity), update, delete. |
| `src/services/offline/store/images.ts` | Кэш картинок в Cache Storage (cache/has/match). |
| `src/services/offline/store/persistence.ts` | `requestPersistentStorage`/`isStoragePersisted`/`getStorageEstimate`. |
| `*.test.ts` | Co-located unit-тесты (кроме `contract/storage.ts` type-only — проверяется typecheck). |

**Решение по дженерикам:** функции стора оперируют `snapshot`/`payload` как `unknown` (стор домен не интерпретирует); типизация снимка/payload — ответственность слоя дескриптора/view выше. Тип-параметры `SavedBundleRecord<T>`/`OutboxCommand<T>` нужны вызывающим коду для построения типизированных записей (`T` ⊂ `unknown` присваивается стору без касты).

**Решение по транзакциям:** каждая функция стора = одна короткоживущая транзакция (open → op → close в `finally`). Атомарные **мульти-шаговые** операции (single-drain claim «pending→syncing», reconcile snapshot за один tx) — НЕ задача этого слоя; их строит sync-слой напрямую через `openOfflineDb()` своей `readwrite`-транзакцией. См. Self-Review.

---

## Task 1: Зависимости + generic-контракт хранилища

**Files:**
- Modify: `package.json`
- Create: `src/services/offline/contract/storage.ts`

> Примечание: `idb` добавляется именно здесь (в store-слое, который его использует), НЕ в SW-PR (F1). Спек v2 §11 согласован соответственно.

- [ ] **Step 1: Поставить зависимости**

Run:

```bash
pnpm add idb@^8.0.0
pnpm add -D fake-indexeddb@^6.0.0
```

Expected: `package.json` + `pnpm-lock.yaml` обновлены, установка кодом 0. (Если ругается на `unrs-resolver` postinstall — известная вещь, см. `pnpm.neverBuiltDependencies`; установка проходит.)

- [ ] **Step 2: Создать контракт**

Create `src/services/offline/contract/storage.ts`:

```ts
// src/services/offline/contract/storage.ts
// Generic типы и константы слоя персистентности офлайна (entity-agnostic).
// Без рантайм/браузерных зависимостей — безопасно импортировать откуда угодно.

export const OFFLINE_DB_NAME = "flbz-offline";
export const OFFLINE_DB_VERSION = 1;
export const OFFLINE_IMAGE_CACHE = "flbz-offline-images";

/** Ключ снимка в сторе saved-bundles. */
export function bundleKey(entity: string, id: string): string {
  return `${entity}:${id}`;
}

export type SavedBundleStatus = "saving" | "complete" | "error";

/**
 * Generic офлайн-снимок любой сущности.
 * `snapshot` — entity-specific (форму знает дескриптор сущности / её view),
 * слой персистентности её не интерпретирует.
 */
export interface SavedBundleRecord<TSnapshot = unknown> {
  key: string; // bundleKey(entity, id) — keyPath стора, выводится слоем
  entity: string; // === Tags.* (@/api/tags), напр. "lectures"
  id: string;
  savedAt: string; // ISO, проставляется на клиенте
  schemaVersion: number;
  status: SavedBundleStatus;
  error?: string;
  snapshot: TSnapshot;
  imageKeys: string[]; // sha256-ключи картинок для Cache Storage
}

/** Патч записи снимка (служебные ключи менять нельзя). */
export type SavedBundlePatch = Partial<
  Omit<SavedBundleRecord, "key" | "entity" | "id">
>;

export type OutboxStatus = "pending" | "syncing" | "failed" | "done";

/** Сейчас только create; update/delete — позже (уровень 2, нужен version-токен). */
export type OutboxOp = "create";

/**
 * Generic команда офлайн-записи. `payload` — entity-specific
 * (форму знает descriptor.write соответствующей сущности).
 */
export interface OutboxCommand<TPayload = unknown> {
  clientId: string; // crypto.randomUUID(): temp-id == idempotency-key == reconcile-key
  entity: string; // "annotation"
  op: OutboxOp;
  payload: TPayload;
  createdAt: string; // ISO
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  serverId?: string;
}

/** Патч команды (clientId неизменяем). */
export type OutboxPatch = Partial<Omit<OutboxCommand, "clientId">>;

/** Вход для постановки в очередь; служебные поля проставляет enqueue. */
export type OutboxEnqueueInput<TPayload = unknown> = Pick<
  OutboxCommand<TPayload>,
  "entity" | "op" | "payload"
> & {
  clientId?: string; // по умолчанию crypto.randomUUID()
  createdAt?: string; // по умолчанию new Date().toISOString()
};
```

- [ ] **Step 3: Проверить типы**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/services/offline/contract/storage.ts
git commit -m "feat(offline): add idb deps and generic persistence contract"
```

---

## Task 2: Открытие IndexedDB (сторы + индексы)

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
  globalThis.indexedDB = new IDBFactory();
});

describe("openOfflineDb", () => {
  it("создаёт сторы saved-bundles и outbox", async () => {
    const db = await openOfflineDb();
    expect(Array.from(db.objectStoreNames).sort()).toEqual([
      "outbox",
      "saved-bundles",
    ]);
    db.close();
  });

  it("создаёт индексы by-entity и by-status на saved-bundles", async () => {
    const db = await openOfflineDb();
    const tx = db.transaction("saved-bundles", "readonly");
    expect(Array.from(tx.store.indexNames).sort()).toEqual([
      "by-entity",
      "by-status",
    ]);
    db.close();
  });

  it("создаёт индексы by-entity и by-status на outbox", async () => {
    const db = await openOfflineDb();
    const tx = db.transaction("outbox", "readonly");
    expect(Array.from(tx.store.indexNames).sort()).toEqual([
      "by-entity",
      "by-status",
    ]);
    db.close();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/services/offline/store/db.test.ts`
Expected: FAIL — `Cannot find module "./db"`.

- [ ] **Step 3: Реализовать db.ts**

Create `src/services/offline/store/db.ts`:

```ts
// src/services/offline/store/db.ts
// Browser-only: открывает IndexedDB-базу офлайна (глобальный indexedDB).
// Импортировать только из клиентского кода.
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  type SavedBundleRecord,
  type SavedBundleStatus,
  type OutboxCommand,
  type OutboxStatus,
} from "../contract/storage";

export interface OfflineDB extends DBSchema {
  "saved-bundles": {
    key: string;
    value: SavedBundleRecord;
    indexes: { "by-entity": string; "by-status": SavedBundleStatus };
  };
  outbox: {
    key: string;
    value: OutboxCommand;
    indexes: { "by-status": OutboxStatus; "by-entity": string };
  };
}

export function openOfflineDb(): Promise<IDBPDatabase<OfflineDB>> {
  return openDB<OfflineDB>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("saved-bundles")) {
        const bundles = db.createObjectStore("saved-bundles", {
          keyPath: "key",
        });
        bundles.createIndex("by-entity", "entity");
        bundles.createIndex("by-status", "status");
      }
      if (!db.objectStoreNames.contains("outbox")) {
        const outbox = db.createObjectStore("outbox", { keyPath: "clientId" });
        outbox.createIndex("by-status", "status");
        outbox.createIndex("by-entity", "entity");
      }
    },
  });
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/services/offline/store/db.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/services/offline/store/db.ts src/services/offline/store/db.test.ts
git commit -m "feat(offline): open IndexedDB with saved-bundles and outbox stores"
```

---

## Task 3: CRUD снимков (saved-bundles)

**Files:**
- Create: `src/services/offline/store/saved-bundles.ts`
- Test: `src/services/offline/store/saved-bundles.test.ts`

- [ ] **Step 1: Написать падающий тест**

Create `src/services/offline/store/saved-bundles.test.ts`:

```ts
// src/services/offline/store/saved-bundles.test.ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach } from "vitest";

import {
  putSavedBundle,
  getSavedBundle,
  listSavedBundles,
  listSavedBundlesByEntity,
  listSavedBundlesByStatus,
  updateSavedBundle,
  deleteSavedBundle,
} from "./saved-bundles";
import type { SavedBundleRecord } from "../contract/storage";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

function makeInput(
  entity: string,
  id: string,
): Omit<SavedBundleRecord, "key"> {
  return {
    entity,
    id,
    savedAt: "2026-06-14T00:00:00.000Z",
    schemaVersion: 1,
    status: "saving",
    snapshot: { hello: "world" },
    imageKeys: [],
  };
}

describe("saved-bundles store", () => {
  it("put выводит key из entity+id; get возвращает запись", async () => {
    await putSavedBundle(makeInput("lectures", "l1"));
    const got = await getSavedBundle("lectures", "l1");
    expect(got?.key).toBe("lectures:l1");
    expect(got?.status).toBe("saving");
  });

  it("get несуществующей → undefined", async () => {
    expect(await getSavedBundle("lectures", "nope")).toBeUndefined();
  });

  it("list возвращает все; listByEntity фильтрует", async () => {
    await putSavedBundle(makeInput("lectures", "l1"));
    await putSavedBundle(makeInput("lectures", "l2"));
    await putSavedBundle(makeInput("documents", "d1"));
    expect((await listSavedBundles()).length).toBe(3);
    const lectures = await listSavedBundlesByEntity("lectures");
    expect(lectures.map((r) => r.id).sort()).toEqual(["l1", "l2"]);
  });

  it("listByStatus фильтрует по статусу (recovery зависших saving)", async () => {
    await putSavedBundle(makeInput("lectures", "l1")); // saving
    await putSavedBundle({ ...makeInput("lectures", "l2"), status: "complete" });
    expect((await listSavedBundlesByStatus("saving")).map((r) => r.id)).toEqual([
      "l1",
    ]);
    expect(
      (await listSavedBundlesByStatus("complete")).map((r) => r.id),
    ).toEqual(["l2"]);
  });

  it("delete удаляет по entity+id", async () => {
    await putSavedBundle(makeInput("lectures", "l1"));
    await deleteSavedBundle("lectures", "l1");
    expect(await getSavedBundle("lectures", "l1")).toBeUndefined();
  });

  it("update мёржит patch (status, error, snapshot — для reconcile)", async () => {
    await putSavedBundle(makeInput("lectures", "l1"));
    await updateSavedBundle("lectures", "l1", {
      status: "error",
      error: "boom",
      snapshot: { reconciled: true },
    });
    const got = await getSavedBundle("lectures", "l1");
    expect(got?.status).toBe("error");
    expect(got?.error).toBe("boom");
    expect(got?.snapshot).toEqual({ reconciled: true });
  });

  it("update на несуществующей — no-op", async () => {
    await updateSavedBundle("lectures", "nope", { status: "complete" });
    expect(await getSavedBundle("lectures", "nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/services/offline/store/saved-bundles.test.ts`
Expected: FAIL — модуль `./saved-bundles` не найден.

- [ ] **Step 3: Реализовать saved-bundles.ts**

Create `src/services/offline/store/saved-bundles.ts`:

```ts
// src/services/offline/store/saved-bundles.ts
// Browser-only CRUD офлайн-снимков. Ключ выводится из entity+id.
import { openOfflineDb } from "./db";
import {
  bundleKey,
  type SavedBundleRecord,
  type SavedBundlePatch,
  type SavedBundleStatus,
} from "../contract/storage";

export async function putSavedBundle(
  record: Omit<SavedBundleRecord, "key">,
): Promise<void> {
  const db = await openOfflineDb();
  try {
    await db.put("saved-bundles", {
      ...record,
      key: bundleKey(record.entity, record.id),
    });
  } finally {
    db.close();
  }
}

export async function getSavedBundle(
  entity: string,
  id: string,
): Promise<SavedBundleRecord | undefined> {
  const db = await openOfflineDb();
  try {
    return await db.get("saved-bundles", bundleKey(entity, id));
  } finally {
    db.close();
  }
}

export async function listSavedBundles(): Promise<SavedBundleRecord[]> {
  const db = await openOfflineDb();
  try {
    return await db.getAll("saved-bundles");
  } finally {
    db.close();
  }
}

export async function listSavedBundlesByEntity(
  entity: string,
): Promise<SavedBundleRecord[]> {
  const db = await openOfflineDb();
  try {
    return await db.getAllFromIndex("saved-bundles", "by-entity", entity);
  } finally {
    db.close();
  }
}

export async function listSavedBundlesByStatus(
  status: SavedBundleStatus,
): Promise<SavedBundleRecord[]> {
  const db = await openOfflineDb();
  try {
    return await db.getAllFromIndex("saved-bundles", "by-status", status);
  } finally {
    db.close();
  }
}

/** Мёрж patch в запись (status/error/snapshot/…). No-op, если записи нет. */
export async function updateSavedBundle(
  entity: string,
  id: string,
  patch: SavedBundlePatch,
): Promise<void> {
  const db = await openOfflineDb();
  try {
    const existing = await db.get("saved-bundles", bundleKey(entity, id));
    if (existing) {
      await db.put("saved-bundles", { ...existing, ...patch });
    }
  } finally {
    db.close();
  }
}

export async function deleteSavedBundle(
  entity: string,
  id: string,
): Promise<void> {
  const db = await openOfflineDb();
  try {
    await db.delete("saved-bundles", bundleKey(entity, id));
  } finally {
    db.close();
  }
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/services/offline/store/saved-bundles.test.ts`
Expected: PASS (7 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/services/offline/store/saved-bundles.ts src/services/offline/store/saved-bundles.test.ts
git commit -m "feat(offline): generic saved-bundles CRUD store"
```

---

## Task 4: Generic очередь outbox

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
  getOutboxCommand,
  listOutbox,
  listOutboxByStatus,
  listOutboxByEntity,
  updateOutboxCommand,
  deleteOutboxCommand,
} from "./outbox";
import type { OutboxEnqueueInput } from "../contract/storage";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

function makeInput(entity: string): OutboxEnqueueInput {
  return { entity, op: "create", payload: { foo: entity } };
}

describe("outbox store", () => {
  it("enqueue проставляет clientId, createdAt, status=pending, attempts=0", async () => {
    const cmd = await enqueueOutbox(makeInput("annotation"));
    expect(cmd.clientId).toMatch(/[0-9a-f-]{36}/);
    expect(cmd.status).toBe("pending");
    expect(cmd.attempts).toBe(0);
    expect(typeof cmd.createdAt).toBe("string");
    expect(await getOutboxCommand(cmd.clientId)).toMatchObject({
      clientId: cmd.clientId,
      status: "pending",
    });
  });

  it("enqueue уважает переданный clientId (идемпотентность)", async () => {
    const cmd = await enqueueOutbox({
      ...makeInput("annotation"),
      clientId: "fixed-id",
    });
    expect(cmd.clientId).toBe("fixed-id");
  });

  it("listOutbox возвращает все команды", async () => {
    await enqueueOutbox(makeInput("annotation"));
    await enqueueOutbox(makeInput("comment"));
    expect(await listOutbox()).toHaveLength(2);
  });

  it("listOutboxByStatus фильтрует по статусу", async () => {
    const a = await enqueueOutbox(makeInput("annotation"));
    await enqueueOutbox(makeInput("annotation"));
    await updateOutboxCommand(a.clientId, { status: "done" });
    expect(await listOutboxByStatus("pending")).toHaveLength(1);
    const done = await listOutboxByStatus("done");
    expect(done).toHaveLength(1);
    expect(done[0]?.clientId).toBe(a.clientId);
  });

  it("listOutboxByEntity фильтрует по сущности", async () => {
    await enqueueOutbox(makeInput("annotation"));
    await enqueueOutbox(makeInput("annotation"));
    await enqueueOutbox(makeInput("comment"));
    expect(await listOutboxByEntity("annotation")).toHaveLength(2);
    expect(await listOutboxByEntity("comment")).toHaveLength(1);
  });

  it("updateOutboxCommand мёржит patch (serverId, attempts, lastError)", async () => {
    const c = await enqueueOutbox(makeInput("annotation"));
    await updateOutboxCommand(c.clientId, {
      status: "failed",
      attempts: 2,
      lastError: "forbidden",
      serverId: "srv-1",
    });
    expect(await getOutboxCommand(c.clientId)).toMatchObject({
      status: "failed",
      attempts: 2,
      lastError: "forbidden",
      serverId: "srv-1",
    });
  });

  it("deleteOutboxCommand удаляет запись", async () => {
    const c = await enqueueOutbox(makeInput("annotation"));
    await deleteOutboxCommand(c.clientId);
    expect(await getOutboxCommand(c.clientId)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/services/offline/store/outbox.test.ts`
Expected: FAIL — модуль `./outbox` не найден.

- [ ] **Step 3: Реализовать outbox.ts**

Create `src/services/offline/store/outbox.ts`:

```ts
// src/services/offline/store/outbox.ts
// Browser-only: generic персистентная очередь отложенных записей.
// ВНИМАНИЕ: атомарный claim "pending→syncing" (single-drain) НЕ здесь —
// его строит sync-слой напрямую через openOfflineDb() readwrite-транзакцией.
import { openOfflineDb } from "./db";
import {
  type OutboxCommand,
  type OutboxEnqueueInput,
  type OutboxPatch,
  type OutboxStatus,
} from "../contract/storage";

export async function enqueueOutbox(
  input: OutboxEnqueueInput,
): Promise<OutboxCommand> {
  const command: OutboxCommand = {
    clientId: input.clientId ?? crypto.randomUUID(),
    entity: input.entity,
    op: input.op,
    payload: input.payload,
    createdAt: input.createdAt ?? new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
  const db = await openOfflineDb();
  try {
    await db.put("outbox", command);
  } finally {
    db.close();
  }
  return command;
}

export async function getOutboxCommand(
  clientId: string,
): Promise<OutboxCommand | undefined> {
  const db = await openOfflineDb();
  try {
    return await db.get("outbox", clientId);
  } finally {
    db.close();
  }
}

export async function listOutbox(): Promise<OutboxCommand[]> {
  const db = await openOfflineDb();
  try {
    return await db.getAll("outbox");
  } finally {
    db.close();
  }
}

export async function listOutboxByStatus(
  status: OutboxStatus,
): Promise<OutboxCommand[]> {
  const db = await openOfflineDb();
  try {
    return await db.getAllFromIndex("outbox", "by-status", status);
  } finally {
    db.close();
  }
}

export async function listOutboxByEntity(
  entity: string,
): Promise<OutboxCommand[]> {
  const db = await openOfflineDb();
  try {
    return await db.getAllFromIndex("outbox", "by-entity", entity);
  } finally {
    db.close();
  }
}

export async function updateOutboxCommand(
  clientId: string,
  patch: OutboxPatch,
): Promise<void> {
  const db = await openOfflineDb();
  try {
    const existing = await db.get("outbox", clientId);
    if (existing) {
      await db.put("outbox", { ...existing, ...patch });
    }
  } finally {
    db.close();
  }
}

export async function deleteOutboxCommand(clientId: string): Promise<void> {
  const db = await openOfflineDb();
  try {
    await db.delete("outbox", clientId);
  } finally {
    db.close();
  }
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/services/offline/store/outbox.test.ts`
Expected: PASS (7 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/services/offline/store/outbox.ts src/services/offline/store/outbox.test.ts
git commit -m "feat(offline): generic outbox command queue (by-status/by-entity)"
```

---

## Task 5: Кэш картинок в Cache Storage

**Files:**
- Create: `src/services/offline/store/images.ts`
- Test: `src/services/offline/store/images.test.ts`

> Шов: записи хранят `imageKeys` (sha256), а `cacheImage(url)` принимает URL. Мост `key → /static/files/{key}` строит слой докачки выше (дескриптор/save-flow), не этот модуль.

- [ ] **Step 1: Написать падающий тест**

Create `src/services/offline/store/images.test.ts`:

```ts
// src/services/offline/store/images.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { cacheImage, hasCachedImage, matchCachedImage } from "./images";

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
  it("cacheImage кладёт ответ в кэш при 200 → true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("img-bytes", { status: 200 })),
    );
    expect(await cacheImage("/static/files/abc")).toBe(true);
    expect(await hasCachedImage("/static/files/abc")).toBe(true);
  });

  it("cacheImage НЕ кэширует при не-ok → false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 404 })),
    );
    expect(await cacheImage("/static/files/missing")).toBe(false);
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
    if (!res) throw new Error("ожидали Response из кэша");
    expect(await res.text()).toBe("img-bytes");
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/services/offline/store/images.test.ts`
Expected: FAIL — модуль `./images` не найден.

- [ ] **Step 3: Реализовать images.ts**

Create `src/services/offline/store/images.ts`:

```ts
// src/services/offline/store/images.ts
// Browser-only: кэш картинок офлайна в Cache Storage.
// `<img src="/static/files/{key}">` отдаётся прозрачно из кэша через SW.
import { OFFLINE_IMAGE_CACHE } from "../contract/storage";

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

export async function matchCachedImage(
  url: string,
): Promise<Response | undefined> {
  const cache = await caches.open(OFFLINE_IMAGE_CACHE);
  return cache.match(url);
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

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

> Feature-detection web-API сделан через локальный тип `MaybeStorageManager` с **опциональными** методами + приведение `navigator.storage` к `… | undefined`. Это разрывает «всегда-истинность» гарда (lib.dom типизирует `storage` и методы как всегда-определённые), иначе `@typescript-eslint/no-unnecessary-condition` (error) отвергнет код, хотя рантайм-гард реально нужен (старые браузеры/SSR).

- [ ] **Step 1: Написать падающий тест**

Create `src/services/offline/store/persistence.test.ts`:

```ts
// src/services/offline/store/persistence.test.ts
import { describe, it, expect, afterEach, vi } from "vitest";

import {
  requestPersistentStorage,
  isStoragePersisted,
  getStorageEstimate,
} from "./persistence";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("persistence", () => {
  it("requestPersistentStorage проксирует navigator.storage.persist", async () => {
    vi.stubGlobal("navigator", {
      storage: { persist: vi.fn().mockResolvedValue(true) },
    });
    expect(await requestPersistentStorage()).toBe(true);
  });

  it("requestPersistentStorage → false если API недоступен", async () => {
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

  it("getStorageEstimate → нули если API недоступен", async () => {
    vi.stubGlobal("navigator", { storage: {} });
    expect(await getStorageEstimate()).toEqual({ usage: 0, quota: 0 });
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/services/offline/store/persistence.test.ts`
Expected: FAIL — модуль `./persistence` не найден.

- [ ] **Step 3: Реализовать persistence.ts**

Create `src/services/offline/store/persistence.ts`:

```ts
// src/services/offline/store/persistence.ts
// Browser-only: защита явно сохранённого контента от LRU-вытеснения origin'а.
// Feature-detection через тип с опциональными методами — иначе lib.dom считает
// navigator.storage и его методы всегда-определёнными и no-unnecessary-condition
// отвергнет рантайм-гард (нужный для старых браузеров/SSR).
export interface OfflineStorageEstimate {
  usage: number;
  quota: number;
}

interface MaybeStorageManager {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
  estimate?: () => Promise<StorageEstimate>;
}

function offlineStorage(): MaybeStorageManager | undefined {
  return navigator.storage as MaybeStorageManager | undefined;
}

export async function requestPersistentStorage(): Promise<boolean> {
  const storage = offlineStorage();
  if (!storage || typeof storage.persist !== "function") return false;
  return storage.persist();
}

export async function isStoragePersisted(): Promise<boolean> {
  const storage = offlineStorage();
  if (!storage || typeof storage.persisted !== "function") return false;
  return storage.persisted();
}

export async function getStorageEstimate(): Promise<OfflineStorageEstimate> {
  const storage = offlineStorage();
  if (!storage || typeof storage.estimate !== "function") {
    return { usage: 0, quota: 0 };
  }
  const estimate = await storage.estimate();
  return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/services/offline/store/persistence.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 5: Финальная проверка + commit**

Run:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Expected: всё PASS (lint чистый, типы под strict ок, существующие тесты не сломаны).

```bash
git add src/services/offline/store/persistence.ts src/services/offline/store/persistence.test.ts
git commit -m "feat(offline): persistent-storage and quota-estimate helpers"
```

---

## Self-Review

**Покрытие спека v2 (§9 хранилище):**

- `saved-bundles` (key `${entity}:${id}`, `snapshot`, `imageKeys`, `status`) + индексы `by-entity`/`by-status` — Task 2,3. ✓
- `outbox` generic (`{clientId, entity, op, payload, status, attempts}`) + индексы `by-status`/`by-entity` — Task 2,4. ✓
- `clientId` = UUID = temp-id = idempotency-key = reconcile-key — Task 1, Task 4. ✓
- Cache Storage `flbz-offline-images` — Task 5. ✓
- `persist()` + `estimate()` — Task 6. ✓
- Entity-agnostic: слой оперирует `entity`/`snapshot`/`payload` как данными. ✓

**Симметрия API (закрыто после ревью):**

- `saved-bundles` и `outbox` теперь оба имеют: `list`(all), `listBy-status`, `listBy-entity`, `get`, generic `update(patch)`, `delete`. Узкий `setSavedBundleStatus` заменён на общий `updateSavedBundle(entity,id,patch)` — симметрично `updateOutboxCommand`.
- `by-status` добавлен и в `saved-bundles` → recovery «зависших `saving`» через `listSavedBundlesByStatus` (раньше асимметрия с outbox).
- `updateSavedBundle` принимает `snapshot` в патче → **reconcile temp→server** реализуем (заменить tempId на serverId внутри снимка).
- Асимметрия create-моделей (`enqueueOutbox` генерит служебные поля vs `putSavedBundle` принимает готовую запись минус `key`) — оправдана: команда генерится клиентом, снимок собирается server-флоу.

**Незакрытые seam'ы — осознанно вне этого слоя (для sync-плана):**

- **Атомарный claim single-drain** («взять pending → пометить syncing» за один tx) и любые **мульти-record атомарные** операции НЕ строятся поверх self-closing helper'ов стора. Sync-слой делает это напрямую через `openOfflineDb()` своей `readwrite`-транзакцией. Межвкладочную гонку дополнительно добивает server-side idempotency (бэкенд-рычаг 3). Зафиксировано комментарием в `outbox.ts`.
- **Мост `imageKey (sha256) → /static/files/{key}`** строит слой докачки выше (комментарий в Task 5).

**Strict-флаги (исправлено после ревью):**

- `noUncheckedIndexedAccess`: индексные доступы в тестах через `?.` (`done[0]?.clientId`). ✓
- `exactOptionalPropertyTypes`: мутации через `Partial<…>`-патчи (`updateSavedBundle`/`updateOutboxCommand`), без присваивания явного `undefined`. ✓
- `no-non-null-assertion`: тест images нарраивает через `if (!res) throw` вместо `res!`. ✓
- `no-unnecessary-condition`: feature-detection в `persistence.ts` через `MaybeStorageManager`-тип с optional-методами. ✓
- `db.close()` в `finally` во всех функциях стора (нет утечки соединения при исключении). ✓

**Решение по дженерикам:** функции стора работают с `unknown` snapshot/payload (типизация — на слое дескриптора); тип-параметры `<T>` в контракте служат вызывающим коду. Это не недосмотр, а граница ответственности.

**Вне скоупа этого плана (следующие планы под спек v2):** `OfflineDescriptor`/registry (F3-контракт) + composition root (F4); репозиторий-контракт (server/IndexedDB-адаптеры); generic sync-драйвер (+ атомарный claim) + route handler `POST /api/offline/[entity]`; lecture-дескриптор + `/saved` + `SavedLectureView` (слайс L); annotation-дескриптор + офлайн-create + reconcile (слайс A); правки SW (F1: cache `/static/files/*`, app-shell `/saved*`); вынос shared-хелперов + рефактор CommentNode (F2).

**Плейсхолдеры:** нет. **Согласованность типов/имён:** проверена между контрактом, реализацией и тестами (`SavedBundlePatch`/`OutboxPatch`/`updateSavedBundle`/`listOutbox`/`listSavedBundlesByStatus`/`MaybeStorageManager` и пр.).
