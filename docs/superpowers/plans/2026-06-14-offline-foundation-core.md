# Offline Foundation Core (F3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить **entity-agnostic ядро** generic offline foundation поверх слоя персистентности (план 1): изоморфный контракт `OfflineDescriptor` (плаг сущности), read-репозиторий (ports-and-adapters: server-адаптер через `assemble` + IndexedDB-адаптер через `saved-bundles`) и generic foreground sync-драйвер для дренажа `outbox` (single-drain, атомарный claim, oldest-first, backoff, reconcile-порт).

**Architecture:** Ядро не знает ни про UI, ни про конкретную сущность, ни про сеть. Дескриптор — чистый тип (`contract/descriptor.ts`), который реализуют фичи. Репозиторий — один контракт `getSnapshot(entity, id)` с двумя адаптерами (онлайн/офлайн), тестируется **одним набором тестов**. Sync-драйвер `drainOutbox(deps)` принимает **порт-транспорт** (`send`) и **порт-reconcile** (`onSynced`) как зависимости — конкретный `fetch` к `POST /api/offline/{entity}` и привязка к событиям браузера живут в composition root (F4), конкретный reconcile снимка — в слайсе A. Это держит ядро чистым и полностью unit-тестируемым (см. `docs/superpowers/specs/2026-06-14-offline-mode-design.md` v2, §5–§8).

**Tech Stack:** TypeScript 6 (strict: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `idb`, Cache Storage API; тесты — vitest 4 (jsdom, `globals:false`) + `fake-indexeddb`; lint — `tseslint.configs.strictTypeChecked` (в т.ч. `no-non-null-assertion`, `no-unnecessary-condition`, `require-await`, `import/order` = error, действуют и на тесты).

**Контекст проекта (важно для исполнителя):**

- pnpm 8.14.3 — только `pnpm add`/`pnpm exec`, не `npm`. Зависимости (`idb`, `fake-indexeddb`) уже стоят (план 1) — ставить ничего не нужно.
- Alias `@/` → `src/`. Тесты co-located. В тестах импорт явный: `import { describe, it, expect } from "vitest"` (globals выключены).
- `src/services/*` — foundation/запретная зона по `CLAUDE.md`: координированный foundation-PR. **`git add` — только свои файлы по имени, без `git add -A`/`git add .`.** Не трогать `public/sw.js` и `.env.development.local`. Никаких деструктивных git-операций. Передать это требование всем субагентам.
- `vitest.config.ts` НЕ трогаем (frozen) — `fake-indexeddb` подключаем импортом `"fake-indexeddb/auto"` в тест-файлах.
- Модули `repository.ts`, `sync/*` — browser-only там, где касаются IndexedDB (`store/*`); `contract/descriptor.ts` — изоморфен (тип-only).
- **Уже реализовано планом 1** (используем как есть, НЕ меняем):
  - `src/services/offline/contract/storage.ts`: типы `SavedBundleRecord`, `OutboxCommand`, `OutboxStatus`, `OutboxPatch`, `OutboxEnqueueInput`, `bundleKey`, `OFFLINE_DB_NAME`/`OFFLINE_DB_VERSION`.
  - `src/services/offline/store/db.ts`: `openOfflineDb(): Promise<IDBPDatabase<OfflineDB>>` (сторы `saved-bundles` keyPath `key`, `outbox` keyPath `clientId`, индексы `by-status`/`by-entity` на обоих).
  - `src/services/offline/store/saved-bundles.ts`: `getSavedBundle(entity,id)`, `putSavedBundle(record)`, …
  - `src/services/offline/store/outbox.ts`: `enqueueOutbox(input)`, `getOutboxCommand(clientId)`, `listOutbox()`, `listOutboxByStatus(status)`, `listOutboxByEntity(entity)`, `updateOutboxCommand(clientId, patch)`, `deleteOutboxCommand(clientId)`.
- `ActionResult<T>` из `@/utils/create-action`: дискриминированный union, успех = `{ success: true; data: T }`; неуспех = `{ success: false; error: string; code?: "forbidden" | "validation" | undefined; … }`.
- **Strict-флаги, на которых легко споткнуться:** `require-await` (async-функция БЕЗ `await` внутри — error: либо добавь `await`, либо сделай функцию не-async и возвращай `Promise.resolve(...)`); `no-unnecessary-condition` (проверять можно только реально-опциональное — `optional?` поля, `T | undefined`); `noUncheckedIndexedAccess` (`arr[0]` → `T | undefined`, через `?.`); `exactOptionalPropertyTypes` (не присваивать явный `undefined` в `field?: T` — патчи через `Partial`-spread); `no-non-null-assertion` (никаких `x!`); `no-empty` (пустой `catch {}` запрещён, НО блок **с комментарием** считается непустым — ок).
- **Урок плана 1 (import/order — частая ловушка):** parent-импорт (`../contract/...`, `../store/...`) идёт **перед** sibling (`./drain`, `./transport`); внутри группы — по алфавиту пути. **В конце каждой задачи прогонять `pnpm exec eslint <свои файлы> --fix` ДО `pnpm lint`** — автофикс разрулит порядок импортов. Перед коммитом каждой задачи: `pnpm lint && pnpm typecheck` чистые + `pnpm test` зелёный.

---

## File Structure

| Файл | Ответственность |
|---|---|
| `src/services/offline/contract/descriptor.ts` | Изоморфный тип `OfflineDescriptor<TSnapshot, TWritePayload>` (плаг сущности): `entity`, `pathSegment`, `assemble`, `extractImageKeys`, опц. `write`. Тип-only, без рантайма. |
| `src/services/offline/repository.ts` | Read-контракт `OfflineRepository` + два адаптера: `createServerRepository(resolve)` (онлайн, через `descriptor.assemble`), `createIndexedDbRepository()` (офлайн, через `getSavedBundle`). |
| `src/services/offline/sync/transport.ts` | Порт-типы sync-слоя: `SyncSendResult`, `SyncTransport`, `ReconcileHook`, `DrainDeps`, `DrainResult`. Тип-only. |
| `src/services/offline/sync/drain.ts` | Generic foreground-драйвер `drainOutbox(deps)` (recovery осиротевших syncing, single-drain, oldest-first, backoff на transient, reconcile-порт) + экспортируемый атомарный `claimPending` (pending→syncing, для прицельного теста). |
| `*.test.ts` | Co-located unit-тесты (кроме тип-only `descriptor.ts`/`transport.ts` — проверяются typecheck'ом и косвенно тестами потребителей). |

**Решение по портам (ключевое):** sync-драйвер НЕ делает `fetch` и НЕ переписывает снимок сам. Он принимает `send: SyncTransport` (что делать с командой → результат) и опц. `onSynced: ReconcileHook` (что сделать после успеха). Конкретный транспорт `POST /api/offline/{entity}` + маппинг HTTP-кодов в `SyncSendResult` + привязка к `online`/`visibilitychange` — это **F4** (composition root). Конкретный reconcile снимка (temp clientId → serverId в `saved-bundles`) или render-time merge кэш+pending — это **слайс A**. Так ядро остаётся entity-agnostic и сетенезависимым, а тесты — детерминированными.

**Решение по reconcile (разрешение неоднозначности спека §8 vs §9):** ядро F3 на успехе помечает команду `done` + `serverId` и вызывает порт `onSynced(command, serverId)`. Само переписывание снимка/мердж pending-аннотаций — НЕ в ядре (зависит от формы снимка → слайс A). Для create-only это корректно: при следующем онлайн-re-assemble снимок естественно подтянет созданную сущность; `done`-команды чистятся слайсом после refresh. `onSynced` — минимальный generic шов под это, тестируем «вызван с (command, serverId)».

**Решение по атомарности:** `claimPending` (pending→syncing за один `readwrite`-tx через `openOfflineDb()`) строится в sync-слое напрямую (как и зафиксировано в Self-Review плана 1), а НЕ поверх self-closing helper'ов стора. Межвкладочную гонку дополнительно добивает server-side idempotency (бэкенд-рычаг 3).

---

## Task 1: Контракт дескриптора (`OfflineDescriptor`)

**Files:**
- Create: `src/services/offline/contract/descriptor.ts`
- Test: `src/services/offline/contract/descriptor.test.ts`

> `descriptor.ts` — тип-only (только `export interface`/`export type`). «Тест» — это компиляция конформного фикстур-дескриптора + рантайм-проверки его полей: typecheck гарантирует форму, vitest гарантирует, что фикстура реально вызывается.

- [ ] **Step 1: Написать падающий тест**

Create `src/services/offline/contract/descriptor.test.ts`:

```ts
// src/services/offline/contract/descriptor.test.ts
import { describe, it, expect } from "vitest";

import type { OfflineDescriptor } from "./descriptor";

interface DemoSnapshot {
  id: string;
  imageKeys: string[];
}
interface DemoPayload {
  text: string;
}

// Конформный дескриптор: компилируется ⇒ форма контракта верна.
const demo: OfflineDescriptor<DemoSnapshot, DemoPayload> = {
  entity: "demo",
  pathSegment: "demos",
  assemble: (id) => Promise.resolve({ id, imageKeys: ["sha-1"] }),
  extractImageKeys: (snap) => snap.imageKeys,
  write: (payload, key) =>
    Promise.resolve({ success: true, data: { id: `${key}:${payload.text}` } }),
};

describe("OfflineDescriptor contract", () => {
  it("assemble возвращает типизированный снимок", async () => {
    const snap = await demo.assemble("d1");
    expect(snap).toEqual({ id: "d1", imageKeys: ["sha-1"] });
  });

  it("extractImageKeys читает sha-ключи из снимка", () => {
    expect(demo.extractImageKeys({ id: "d1", imageKeys: ["a", "b"] })).toEqual([
      "a",
      "b",
    ]);
  });

  it("write опционален и возвращает ActionResult<{id}>", async () => {
    expect(demo.write).toBeDefined();
    if (!demo.write) throw new Error("ожидали write у фикстуры");
    expect(await demo.write({ text: "x" }, "key-1")).toEqual({
      success: true,
      data: { id: "key-1:x" },
    });
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/services/offline/contract/descriptor.test.ts`
Expected: FAIL — `Cannot find module "./descriptor"`.

- [ ] **Step 3: Реализовать descriptor.ts**

Create `src/services/offline/contract/descriptor.ts`:

```ts
// src/services/offline/contract/descriptor.ts
// Изоморфный контракт «плага» сущности для offline foundation.
// Тип-only: фичи реализуют дескриптор, app/_offline собирает реестр (F4).
// Ядро (repository/sync) зависит ТОЛЬКО от этого типа, не от фич.
import type { ActionResult } from "@/utils/create-action";

export interface OfflineDescriptor<TSnapshot = unknown, TWritePayload = unknown> {
  /**
   * Стабильный ключ сущности. ОБЯЗАН быть значением из `Tags` (@/api/tags),
   * напр. `Tags.LECTURES` === "lectures", `Tags.ANNOTATIONS` === "annotations"
   * (мн. ч.!) — НЕ имя сущности в ед. числе. По нему резолвится дескриптор и
   * строится `POST /api/offline/{entity}`; рассинхрон молча вернёт null.
   */
  entity: string;
  /** Path-сегмент для ключей IDB / SW-match (потребляется в F1/слайсах; в F3 не читается). Напр. "lectures". */
  pathSegment: string;

  // ── ЧТЕНИЕ ──
  /** server-only: собрать офлайн-снимок (фронт-оркестрация сейчас, бэк-bundle потом). null = нет/нет доступа. */
  assemble: (id: string) => Promise<TSnapshot | null>;
  /** Извлечь sha256-ключи всех картинок снимка (для докачки в Cache Storage). */
  extractImageKeys: (snapshot: TSnapshot) => string[];

  // ── ЗАПИСЬ (опционально; сейчас только annotation) ──
  /** server-only: создать сущность из payload (RBAC + форвард в API + Idempotency-Key). */
  write?: (
    payload: TWritePayload,
    idempotencyKey: string,
  ) => Promise<ActionResult<{ id: string }>>;
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/services/offline/contract/descriptor.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Lint + typecheck + commit**

Run:

```bash
pnpm exec eslint src/services/offline/contract/descriptor.ts src/services/offline/contract/descriptor.test.ts --fix
pnpm lint && pnpm typecheck
```

Expected: 0 ошибок.

```bash
git add src/services/offline/contract/descriptor.ts src/services/offline/contract/descriptor.test.ts
git commit -m "feat(offline): OfflineDescriptor entity-plug contract"
```

---

## Task 2: Read-репозиторий (server + IndexedDB адаптеры)

**Files:**
- Create: `src/services/offline/repository.ts`
- Test: `src/services/offline/repository.test.ts`

> Один контракт `getSnapshot(entity, id): Promise<unknown>` (resolves в снимок или `null`, если его нет). Два адаптера, **один набор контракт-тестов** против обоих (`describe.each`) — спек §13. Server-адаптер берёт снимок свежим через `descriptor.assemble`; IndexedDB-адаптер — из сохранённого `saved-bundles`. View зависит от снимка, не от источника.

- [ ] **Step 1: Написать падающий тест**

Create `src/services/offline/repository.test.ts`:

```ts
// src/services/offline/repository.test.ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach } from "vitest";

import type { OfflineDescriptor } from "./contract/descriptor";
import {
  createServerRepository,
  createIndexedDbRepository,
  type OfflineRepository,
} from "./repository";
import { putSavedBundle } from "./store/saved-bundles";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

const SNAPSHOT = { title: "Lecture 1", blocks: [], imageKeys: ["sha-a"] };

// Каждая фабрика строит репозиторий, предзаполненный SNAPSHOT для ("lectures","l1").
const factories: { name: string; build: () => Promise<OfflineRepository> }[] = [
  {
    name: "server adapter",
    build: () => {
      const descriptor: OfflineDescriptor = {
        entity: "lectures",
        pathSegment: "lectures",
        assemble: (id) => Promise.resolve(id === "l1" ? SNAPSHOT : null),
        extractImageKeys: () => [],
      };
      return Promise.resolve(
        createServerRepository((entity) =>
          entity === "lectures" ? descriptor : undefined,
        ),
      );
    },
  },
  {
    name: "indexeddb adapter",
    build: async () => {
      await putSavedBundle({
        entity: "lectures",
        id: "l1",
        savedAt: "2026-06-14T00:00:00.000Z",
        schemaVersion: 1,
        status: "complete",
        snapshot: SNAPSHOT,
        imageKeys: ["sha-a"],
      });
      return createIndexedDbRepository();
    },
  },
];

describe.each(factories)("OfflineRepository contract — $name", ({ build }) => {
  it("возвращает снимок для существующих entity+id", async () => {
    const repo = await build();
    expect(await repo.getSnapshot("lectures", "l1")).toEqual(SNAPSHOT);
  });

  it("возвращает null для несуществующего id", async () => {
    const repo = await build();
    expect(await repo.getSnapshot("lectures", "missing")).toBeNull();
  });

  it("возвращает null для неизвестной сущности", async () => {
    const repo = await build();
    expect(await repo.getSnapshot("unknown", "l1")).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/services/offline/repository.test.ts`
Expected: FAIL — модуль `./repository` не найден.

- [ ] **Step 3: Реализовать repository.ts**

Create `src/services/offline/repository.ts`:

```ts
// src/services/offline/repository.ts
// Read-сторона foundation (ports-and-adapters). Один контракт getSnapshot,
// два адаптера: server (свежий assemble) и IndexedDB (сохранённый снимок).
// View зависит от снимка, не от источника. Снимок entity-agnostic (unknown);
// его форму знает дескриптор/view выше.
import type { OfflineDescriptor } from "./contract/descriptor";
import { getSavedBundle } from "./store/saved-bundles";

/** Резолвер дескриптора по ключу сущности (реестр собирает app/_offline в F4). */
export type DescriptorResolver = (
  entity: string,
) => OfflineDescriptor | undefined;

export interface OfflineRepository {
  /**
   * Снимок сущности или null, если его нет/нет доступа.
   * Может reject при сбое источника (сеть в `assemble`, повреждённая IDB);
   * null — ТОЛЬКО для отсутствия, не для ошибки.
   */
  getSnapshot(entity: string, id: string): Promise<unknown>;
}

/** Онлайн-адаптер: собирает снимок свежим через дескриптор сущности. */
export function createServerRepository(
  resolve: DescriptorResolver,
): OfflineRepository {
  return {
    async getSnapshot(entity, id) {
      const descriptor = resolve(entity);
      return descriptor ? await descriptor.assemble(id) : null;
    },
  };
}

/** Офлайн-адаптер: отдаёт ранее сохранённый снимок из saved-bundles. */
export function createIndexedDbRepository(): OfflineRepository {
  return {
    async getSnapshot(entity, id) {
      const record = await getSavedBundle(entity, id);
      // Различаем «нет записи» (null) от записи с любым (в т.ч. falsy) снимком.
      return record ? record.snapshot : null;
    },
  };
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/services/offline/repository.test.ts`
Expected: PASS (6 тестов — 3 кейса × 2 адаптера).

- [ ] **Step 5: Lint + typecheck + commit**

Run:

```bash
pnpm exec eslint src/services/offline/repository.ts src/services/offline/repository.test.ts --fix
pnpm lint && pnpm typecheck
```

Expected: 0 ошибок.

```bash
git add src/services/offline/repository.ts src/services/offline/repository.test.ts
git commit -m "feat(offline): read repository with server and IndexedDB adapters"
```

---

## Task 3: Generic sync-драйвер (`drainOutbox`)

**Files:**
- Create: `src/services/offline/sync/transport.ts`
- Create: `src/services/offline/sync/drain.ts`
- Test: `src/services/offline/sync/drain.test.ts`

> Драйвер entity-agnostic и сетенезависим: дренирует `outbox` через инжектируемый `send`. На старте — **recovery-проход**: осиротевшие `syncing` (умерший прошлый drain) возвращаются в `pending`. Single-drain (module-level lock), oldest-first (по `createdAt`, tie-break по `clientId`), атомарный claim `pending→syncing` (экспортируется для прицельного теста). 2xx → `done`+`serverId`+`onSynced`; не-retriable (4xx) → `failed`, продолжаем; retriable (сеть/5xx, в т.ч. брошенное исключение транспорта) → откат в `pending`+`attempts++` и **стоп дренажа** (backoff/офлайн). Брошенное `send`-исключение трактуется как transient. `onSynced` получает ВЕСЬ `OutboxCommand` (не голый serverId) — слайс A достанет parent-координаты из `command.payload`.

- [ ] **Step 1: Создать порт-типы transport.ts**

Create `src/services/offline/sync/transport.ts`:

```ts
// src/services/offline/sync/transport.ts
// Порт-типы sync-слоя. Конкретные реализации (fetch к /api/offline/{entity},
// reconcile снимка) инжектируются из F4/слайса A — ядро их не знает.
import type { OutboxCommand } from "../contract/storage";

/**
 * Результат отправки одной команды.
 * `retriable: true` — ТОЛЬКО для подлинно временных сбоев (офлайн/сеть/5xx):
 * драйвер вернёт команду в pending и остановит проход (backoff).
 * `retriable: false` — для детерминированных/клиентских отказов (4xx): команда
 * уходит в `failed` и НЕ блокирует очередь. КОНТРАКТ транспорта: детерминированную
 * ошибку (невалидный payload и т.п.) обязан маппить в `retriable: false`, иначе
 * она навсегда встанет головой очереди (см. head-of-line в Self-Review).
 */
export type SyncSendResult =
  | { ok: true; serverId: string }
  | { ok: false; retriable: boolean; error: string };

/** Транспорт: исполнить команду (обычно POST /api/offline/{entity}) → результат. */
export type SyncTransport = (command: OutboxCommand) => Promise<SyncSendResult>;

/** Хук пост-успеха (reconcile снимка / инвалидация). Best-effort. */
export type ReconcileHook = (
  command: OutboxCommand,
  serverId: string,
) => Promise<void>;

export interface DrainDeps {
  send: SyncTransport;
  onSynced?: ReconcileHook;
}

export interface DrainResult {
  /** true, если дренаж уже шёл (single-drain) и вызов проигнорирован. */
  skipped: boolean;
  attempted: number;
  done: number;
  failed: number;
  deferred: number;
}
```

- [ ] **Step 2: Написать падающий тест**

Create `src/services/offline/sync/drain.test.ts`:

```ts
// src/services/offline/sync/drain.test.ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach } from "vitest";

import {
  enqueueOutbox,
  getOutboxCommand,
  updateOutboxCommand,
} from "../store/outbox";

import { claimPending, drainOutbox } from "./drain";
import type { DrainResult, SyncTransport } from "./transport";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe("drainOutbox", () => {
  it("на 2xx помечает команду done + serverId", async () => {
    const cmd = await enqueueOutbox({
      entity: "annotations",
      op: "create",
      payload: { text: "x" },
    });
    const send: SyncTransport = () =>
      Promise.resolve({ ok: true, serverId: "srv-1" });

    const result = await drainOutbox({ send });

    expect(result).toMatchObject({
      skipped: false,
      attempted: 1,
      done: 1,
      failed: 0,
      deferred: 0,
    });
    expect(await getOutboxCommand(cmd.clientId)).toMatchObject({
      status: "done",
      serverId: "srv-1",
    });
  });

  it("обрабатывает команды oldest-first (по createdAt, НЕ по clientId)", async () => {
    // clientId намеренно в ОБРАТНОМ лексикографическом порядке к createdAt:
    // если убрать сортировку по createdAt, индекс отдаст по clientId (a-new < z-old)
    // и тест упадёт — значит он реально проверяет сортировку, а не порядок ключей.
    await enqueueOutbox({
      entity: "a",
      op: "create",
      payload: {},
      clientId: "z-old",
      createdAt: "2026-06-14T00:00:01.000Z",
    });
    await enqueueOutbox({
      entity: "a",
      op: "create",
      payload: {},
      clientId: "a-new",
      createdAt: "2026-06-14T00:00:02.000Z",
    });
    const seen: string[] = [];
    const send: SyncTransport = (command) => {
      seen.push(command.clientId);
      return Promise.resolve({ ok: true, serverId: `srv-${command.clientId}` });
    };

    await drainOutbox({ send });

    expect(seen).toEqual(["z-old", "a-new"]);
  });

  it("вызывает onSynced с (command, serverId) на успехе", async () => {
    const cmd = await enqueueOutbox({
      entity: "annotations",
      op: "create",
      payload: {},
    });
    const calls: { clientId: string; serverId: string }[] = [];

    await drainOutbox({
      send: () => Promise.resolve({ ok: true, serverId: "srv-9" }),
      onSynced: (command, serverId) => {
        calls.push({ clientId: command.clientId, serverId });
        return Promise.resolve();
      },
    });

    expect(calls).toEqual([{ clientId: cmd.clientId, serverId: "srv-9" }]);
  });

  it("на не-retriable (4xx) помечает failed и продолжает к следующей", async () => {
    await enqueueOutbox({
      entity: "a",
      op: "create",
      payload: {},
      clientId: "bad",
      createdAt: "2026-06-14T00:00:01.000Z",
    });
    await enqueueOutbox({
      entity: "a",
      op: "create",
      payload: {},
      clientId: "good",
      createdAt: "2026-06-14T00:00:02.000Z",
    });
    const send: SyncTransport = (command) =>
      Promise.resolve(
        command.clientId === "bad"
          ? { ok: false, retriable: false, error: "forbidden" }
          : { ok: true, serverId: "srv" },
      );

    const result = await drainOutbox({ send });

    expect(result).toMatchObject({ attempted: 2, done: 1, failed: 1 });
    expect(await getOutboxCommand("bad")).toMatchObject({
      status: "failed",
      lastError: "forbidden",
      attempts: 1,
    });
    expect(await getOutboxCommand("good")).toMatchObject({ status: "done" });
  });

  it("на retriable оставляет pending, инкрементит attempts и стопит дренаж", async () => {
    await enqueueOutbox({
      entity: "a",
      op: "create",
      payload: {},
      clientId: "net",
      createdAt: "2026-06-14T00:00:01.000Z",
    });
    await enqueueOutbox({
      entity: "a",
      op: "create",
      payload: {},
      clientId: "later",
      createdAt: "2026-06-14T00:00:02.000Z",
    });
    const seen: string[] = [];
    const send: SyncTransport = (command) => {
      seen.push(command.clientId);
      return Promise.resolve({ ok: false, retriable: true, error: "offline" });
    };

    const result = await drainOutbox({ send });

    expect(seen).toEqual(["net"]); // остановились до "later"
    expect(result).toMatchObject({ attempted: 1, deferred: 1, done: 0 });
    expect(await getOutboxCommand("net")).toMatchObject({
      status: "pending",
      attempts: 1,
      lastError: "offline",
    });
    expect(await getOutboxCommand("later")).toMatchObject({
      status: "pending",
      attempts: 0,
    });
  });

  it("брошенное транспортом исключение трактуется как transient", async () => {
    const cmd = await enqueueOutbox({ entity: "a", op: "create", payload: {} });
    const send: SyncTransport = () => Promise.reject(new Error("boom"));

    const result = await drainOutbox({ send });

    expect(result).toMatchObject({ attempted: 1, deferred: 1 });
    expect(await getOutboxCommand(cmd.clientId)).toMatchObject({
      status: "pending",
      attempts: 1,
      lastError: "boom",
    });
  });

  it("реклеймит осиротевшие syncing-команды и синкает их (recovery)", async () => {
    // Симулируем оборванный предыдущий drain: команда застряла в syncing.
    const cmd = await enqueueOutbox({ entity: "a", op: "create", payload: {} });
    await updateOutboxCommand(cmd.clientId, { status: "syncing" });
    let calls = 0;
    const send: SyncTransport = () => {
      calls++;
      return Promise.resolve({ ok: true, serverId: "srv" });
    };

    const result = await drainOutbox({ send });

    expect(calls).toBe(1);
    expect(result).toMatchObject({ skipped: false, attempted: 1, done: 1 });
    expect(await getOutboxCommand(cmd.clientId)).toMatchObject({
      status: "done",
      serverId: "srv",
    });
  });

  it("single-drain: повторный вызов во время дренажа возвращает skipped", async () => {
    await enqueueOutbox({ entity: "a", op: "create", payload: {} });
    let reentrant: DrainResult | undefined;
    const send: SyncTransport = async () => {
      reentrant = await drainOutbox({
        send: () => Promise.resolve({ ok: true, serverId: "inner" }),
      });
      return { ok: true, serverId: "outer" };
    };

    await drainOutbox({ send });

    expect(reentrant?.skipped).toBe(true);
    expect(reentrant?.attempted).toBe(0);
  });
});

describe("claimPending", () => {
  it("переводит pending→syncing и возвращает команду", async () => {
    const cmd = await enqueueOutbox({ entity: "a", op: "create", payload: {} });
    const claimed = await claimPending(cmd.clientId);
    expect(claimed?.status).toBe("syncing");
    expect(await getOutboxCommand(cmd.clientId)).toMatchObject({
      status: "syncing",
    });
  });

  it("возвращает null для уже заклеймленной (не-pending) команды", async () => {
    const cmd = await enqueueOutbox({ entity: "a", op: "create", payload: {} });
    await claimPending(cmd.clientId);
    expect(await claimPending(cmd.clientId)).toBeNull();
  });

  it("возвращает null для несуществующей команды", async () => {
    expect(await claimPending("nope")).toBeNull();
  });
});
```

- [ ] **Step 3: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/services/offline/sync/drain.test.ts`
Expected: FAIL — модуль `./drain` не найден.

- [ ] **Step 4: Реализовать drain.ts**

Create `src/services/offline/sync/drain.ts`:

```ts
// src/services/offline/sync/drain.ts
// Browser-only generic foreground-драйвер дренажа outbox. Entity-agnostic
// и сетенезависим: исполняет команды через инжектируемый транспорт.
// Конкретный транспорт (POST /api/offline/{entity}) и reconcile снимка —
// в composition root (F4) / слайсе A, вне ядра (для тестируемости).
import type { OutboxCommand } from "../contract/storage";
import { openOfflineDb } from "../store/db";
import { listOutboxByStatus, updateOutboxCommand } from "../store/outbox";

import type { DrainDeps, DrainResult, SyncSendResult } from "./transport";

let draining = false;

/**
 * Атомарно переводит команду pending→syncing за один readwrite-tx.
 * Возвращает null, если её уже забрали (status !== "pending") —
 * защита от двойной обработки (в т.ч. межвкладочной гонки).
 */
export async function claimPending(
  clientId: string,
): Promise<OutboxCommand | null> {
  const db = await openOfflineDb();
  try {
    const tx = db.transaction("outbox", "readwrite");
    const existing = await tx.store.get(clientId);
    if (!existing || existing.status !== "pending") {
      await tx.done;
      return null;
    }
    const claimed: OutboxCommand = { ...existing, status: "syncing" };
    await tx.store.put(claimed);
    await tx.done;
    return claimed;
  } finally {
    db.close();
  }
}

export async function drainOutbox(deps: DrainDeps): Promise<DrainResult> {
  if (draining) {
    return { skipped: true, attempted: 0, done: 0, failed: 0, deferred: 0 };
  }
  draining = true;
  let attempted = 0;
  let done = 0;
  let failed = 0;
  let deferred = 0;
  try {
    // Recovery: вернуть «осиротевшие» syncing-команды (предыдущий drain умер в
    // середине send — вкладка закрыта/краш) в pending, иначе они навсегда
    // выпадут из выборки. Безопасно для create-only: server-side idempotency
    // (Idempotency-Key=clientId) дедупит команду, если она всё же дошла.
    for (const orphan of await listOutboxByStatus("syncing")) {
      await updateOutboxCommand(orphan.clientId, { status: "pending" });
    }
    const pending = (await listOutboxByStatus("pending")).sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) ||
        a.clientId.localeCompare(b.clientId),
    );
    for (const queued of pending) {
      const claimed = await claimPending(queued.clientId);
      if (!claimed) continue;
      attempted++;

      let outcome: SyncSendResult;
      try {
        outcome = await deps.send(claimed);
      } catch (error) {
        outcome = {
          ok: false,
          retriable: true,
          error: error instanceof Error ? error.message : "send failed",
        };
      }

      if (outcome.ok) {
        await updateOutboxCommand(claimed.clientId, {
          status: "done",
          serverId: outcome.serverId,
        });
        if (deps.onSynced) {
          try {
            await deps.onSynced(claimed, outcome.serverId);
          } catch {
            // reconcile best-effort — команда уже зафиксирована на сервере
          }
        }
        done++;
      } else if (outcome.retriable) {
        await updateOutboxCommand(claimed.clientId, {
          status: "pending",
          attempts: claimed.attempts + 1,
          lastError: outcome.error,
        });
        deferred++;
        // backoff: стоп на первом transient-сбое (доминирующий кейс — офлайн,
        // где упадут и все следующие). Цена — head-of-line при «ядовитой»
        // retriable-команде; контракт транспорта (см. transport.ts) обязывает
        // маппить детерминированные ошибки в retriable:false, чтобы не блокировать.
        break;
      } else {
        await updateOutboxCommand(claimed.clientId, {
          status: "failed",
          attempts: claimed.attempts + 1,
          lastError: outcome.error,
        });
        failed++;
      }
    }
  } finally {
    draining = false;
  }
  return { skipped: false, attempted, done, failed, deferred };
}
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/services/offline/sync/drain.test.ts`
Expected: PASS (11 тестов — 8 в `drainOutbox` + 3 в `claimPending`).

- [ ] **Step 6: Финальная проверка + commit**

Run:

```bash
pnpm exec eslint src/services/offline/sync/transport.ts src/services/offline/sync/drain.ts src/services/offline/sync/drain.test.ts --fix
pnpm lint && pnpm typecheck && pnpm test
```

Expected: всё PASS (lint 0, типы под strict ок, существующие тесты не сломаны).

```bash
git add src/services/offline/sync/transport.ts src/services/offline/sync/drain.ts src/services/offline/sync/drain.test.ts
git commit -m "feat(offline): generic foreground outbox sync driver"
```

---

## Self-Review

**Покрытие спека v2:**

- §6 контракт дескриптора (`entity`/`pathSegment`/`assemble`/`extractImageKeys`/`write?`) — Task 1. ✓
- §7 Репозиторий (ports-and-adapters, `getSnapshot`, server + IndexedDB адаптеры, один набор тестов) — Task 2. ✓
- §8 generic sync (single-drain, oldest-first, 2xx→done/reconcile, 4xx→failed, сеть/5xx→pending+backoff) — Task 3. ✓
- §13 тесты: контракт репозитория одним набором против обоих адаптеров (`describe.each`); sync-редьюсер (статусы/backoff/single-drain); claim. ✓ (reconcile temp→server — порт `onSynced`, конкретика в слайсе A.)
- §12 «over-abstraction — главный риск»: ядро НЕ содержит ни одной сущности; порты `send`/`onSynced` имеют ясных будущих потребителей (F4/слайс A), а не введены «на всякий случай». ✓

**Разрешённые неоднозначности (зафиксированы явно):**

- **reconcile-в-снимке (спек §8) vs render-merge (§9):** ядро F3 делает `done`+`serverId`+`onSynced(...)`; переписывание снимка/мердж pending — слайс A. Для create-only это корректно (re-assemble подтянет созданное). `onSynced` — generic шов, тестируется фактом вызова.
- **транспорт и привязка к событиям:** инжектируются (`send`) / живут в F4 (online/visibilitychange/таймер-backoff). Ядро — один проход дренажа; тайминг ретраев не его забота. `attempts` персистится для будущих backoff-решений в F4.
- **offline-gating:** отдельной проверки `navigator.onLine` в ядре нет — transient-сбой первой команды и так стопит дренаж; вызывать `drainOutbox` при офлайне нет смысла (это решает F4-триггер).
- **`break` на transient:** один transient-сбой останавливает весь проход (консервативно: офлайн — доминирующий кейс, серийная oldest-first очередь). Документировано в коде.

**Strict-флаги (учтено в коде):**

- `require-await`: server/IndexedDB-адаптеры — `async` С `await`; не-async фикстуры/транспорты возвращают `Promise.resolve(...)`/`Promise.reject(...)`. ✓
- `no-unnecessary-condition`: проверяются только реально-опциональные (`descriptor` из резолвера `| undefined`, `record?.snapshot`, `deps.onSynced?`, `existing`/`claimed` `| undefined`). ✓
- `no-non-null-assertion`: нет `x!`; тест дескриптора нарраивает `if (!demo.write) throw`. ✓
- `no-empty`: пустой `catch {}` reconcile — с комментарием внутри (ESLint считает блок с комментарием непустым). ✓
- `exactOptionalPropertyTypes`: патчи `updateOutboxCommand` передают конкретные значения (`serverId`/`lastError`: string, `attempts`: number), не `undefined`. ✓
- `import/order`: между parent- и sibling-группой стоит пустая строка (`newlines-between: always`); каждая задача гоняет `eslint --fix` ДО `pnpm lint` (урок плана 1: parent перед sibling). ✓

**Учтено по адверсариальному ревью (5 агентов: логика/конкурентность, strict-lint, симметрия, архитектура, эмпирический прогон vitest+fake-indexeddb с мутационным тестированием):**

- **[было Critical] Recovery осиротевших `syncing`:** при крахе/закрытии вкладки в середине `send` команда оставалась бы в `syncing` навсегда (drain берёт только `pending`) → тихая потеря create. Добавлен reclaim-проход `syncing→pending` в начале `drainOutbox`; безопасен благодаря server-side idempotency. Покрыт тестом (прежний тест «не трогает syncing» заменён — его семантика была неверной: осиротевшие syncing мы как раз ДОЛЖНЫ восстанавливать).
- **[было Critical/lint] `import/order` `newlines-between: always`:** в дословных блоках `drain.ts`/`drain.test.ts` не было пустой строки между parent- и sibling-импортами (рецидив урока плана 1, поймано эмпирически). Пустые строки добавлены в код.
- **[было Important] Тавтологичный oldest-first тест:** `clientId` (`c1`/`c2`) случайно совпадал с порядком `createdAt` — тест проходил и БЕЗ `.sort()` (подтверждено мутацией). Переписан на `clientId` в ОБРАТНОМ порядке (`z-old`/`a-new`); добавлен tie-break по `clientId` при равных `createdAt`.
- **[было Important] Непокрытый guard `claimPending`:** мутация status-проверки оставляла все тесты зелёными. `claimPending` экспортирован, добавлен прицельный набор (claim pending→syncing; повторный → null; несуществующая → null).
- **[было Important] `entity` ед./мн. число:** тест-литералы `"annotation"` → `"annotations"`; в контракте усилен комментарий `entity` (ОБЯЗАН быть значением `Tags.*` — резолв/URL молча вернут null при рассинхроне).
- **[было Minor] IndexedDB-адаптер `record?.snapshot ?? null`:** коллапсировал «нет записи» и «falsy-снимок». Заменён на `record ? record.snapshot : null`; JSDoc контракта: `getSnapshot` может reject, `null` — только отсутствие.
- **[было Minor] `onSynced` достаточность:** порт получает ВЕСЬ `OutboxCommand` — слайс A достаёт parent-координаты из `command.payload`; ядро agnostic, сигнатуру порта менять НЕ потребуется (зафиксировано в blurb Task 3).

**Известное ограничение (осознанно оставлено, НЕ баг F3): head-of-line.** `break` на первом transient-сбое: «ядовитая» вечно-retriable команда головой очереди задержит остальные. Митигируется контрактом транспорта (детерминированные/клиентские ошибки → `retriable:false` → `failed`, не блокируют — закреплено в JSDoc `SyncSendResult`) и backoff/attempt-cap на уровне F4. В F3 `attempts` копится без потолка осознанно: cap на уровне ядра ошибочно «завалил» бы команды при долгом офлайне (при `break` attempts растёт только у головы очереди). Различение «офлайн vs серверная ошибка» — при необходимости в F4, без правок контракта ядра.

**Согласованность типов/имён:** `OfflineDescriptor`/`OfflineRepository`/`DescriptorResolver`/`SyncTransport`/`SyncSendResult`/`ReconcileHook`/`DrainDeps`/`DrainResult`/`drainOutbox`/`claimPending` — единообразны между файлами и тестами. Store-API (`getSavedBundle`/`enqueueOutbox`/`getOutboxCommand`/`listOutboxByStatus`/`updateOutboxCommand`) и типы (`OutboxCommand`/`SavedBundleRecord`) совпадают с реализованным планом 1. `ActionResult<{id}>` — точная форма из `@/utils/create-action`. **Плейсхолдеры:** нет.

**Вне скоупа этого плана (следующие планы под спек v2):**

- **F4** — composition root `app/_offline/registry.ts` (`OFFLINE_REGISTRY` + `satisfies` drift-guard), generic `saveOffline(entity, id)` action, конкретный транспорт `POST /api/offline/[entity]` (маппинг HTTP→`SyncSendResult`, форвард в `philosophy-api` с `Idempotency-Key: clientId`), привязка `drainOutbox` к событиям (online/visibilitychange) + backoff-тайминг.
- **F1** — SW: cache `/static/files/*` + app-shell `/saved*`; развязать bucket-seam (`flbz-offline-images` vs `flbz-images-${SW_VERSION}`).
- **F2** — вынос shared render-хелперов + рефактор `CommentNode` → контейнер/view.
- **Слайс L** — lecture-дескриптор (`assemble`+`extractImageKeys`) + `/saved` + `SavedLectureView`.
- **Слайс A** — annotation-дескриптор (`write`) + офлайн-create-форма + render-merge pending + конкретный `onSynced`-reconcile.
```
