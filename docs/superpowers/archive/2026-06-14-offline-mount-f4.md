# Offline Mount (F4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** «Смонтировать» ядро offline foundation (план 1 + F3): composition root `app/_offline/` с реестром дескрипторов, generic **save-flow** (server-экшен `assembleOfflineBundle` + client-оркестратор `saveOffline`: снимок→IndexedDB + картинки→Cache Storage), generic **write-path** (route handler `POST /api/offline/[entity]` через `descriptor.write`), concrete **транспорт** синка и **привязку драйвера** к событиям браузера. После F4 слайсы L/A сводятся к «дескриптор + view».

**Architecture:** Composition root (`src/app/_offline/`) — единственный легальный по ESLint канал «фича → foundation» (D12): он импортирует дескрипторы фич в реестр и передаёт `resolveDescriptor` (тип `DescriptorResolver` из F3) в generic-логику. Вся тестируемая логика — чистые функции с инъекцией резолвера (`assembleBundle`, `runOfflineWrite`), а Next-связанные обёртки (server action, route handler) — тонкие адаптеры. Транспорт мапит HTTP↔`SyncSendResult`; sync-хук вешает `drainOutbox` на `online`/`visibilitychange`. Read-сторона (репозиторий из F3) подключит `resolveDescriptor` в server-адаптер (это делает слайс/страница, не F4).

**Tech Stack:** Next.js 16 App Router (route handlers: `ctx.params` — Promise; server actions через `@/utils/create-action`; `getMe`/`requireCapability` — внутри `descriptor.write`, не в F4). TypeScript 6 strict; vitest 4 (`globals:false`) + `fake-indexeddb`; lint `tseslint strictTypeChecked`.

**Контекст проекта (важно для исполнителя):**

- pnpm (НЕ npm). Зависимости стоят. Alias `@/` → `src/`. Тесты co-located, импорт vitest явный.
- **`git add` — только свои файлы по имени, без `git add -A`/`git add .`.** Никаких `git stash/reset/checkout/clean/rebase`/деструктива. Не трогать `public/sw.js`, `.env.development.local` (в `git status` — чужие незакоммиченные). Не пушить. Передать это всем суб-субагентам.
- **`src/app/*` — НЕ заморожённая зона** (заморожены конкретные shell-файлы: `app/layout.tsx`, `app/admin/*`, `app/globals.css`). Новые `app/_offline/*` и `app/api/offline/*` — наш код, создаём свободно. **НЕ трогаем** существующие route-handler'ы и shell.
- **Готово и используем как есть:** F3 — `@/services/offline/contract/descriptor` (тип `OfflineDescriptor`), `@/services/offline/repository` (тип `DescriptorResolver`, `createServerRepository`/`createIndexedDbRepository`), `@/services/offline/sync/transport` (типы `SyncTransport`/`SyncSendResult`), `@/services/offline/sync/drain` (`drainOutbox`); план 1 — `@/services/offline/store/saved-bundles` (`putSavedBundle`/`updateSavedBundle`/`getSavedBundle`), `@/services/offline/store/images` (`cacheImage`), `@/services/offline/store/persistence` (`requestPersistentStorage`), `@/services/offline/contract/storage` (`OutboxCommand`).
- `@/utils/create-action`: `createAction<TInput,TOutput>(fn)` → `(input) => Promise<ActionResult<TOutput>>`. `ActionResult<T>` = `{success:true;data:T}` | `{success:false;error;code:"forbidden"}` | `{success:false;error;code:"validation";fieldErrors}` | `{success:false;error;code?:undefined}`.
- **Конвенции (из разведки):** route handler — `export async function POST(request: NextRequest, ctx: { params: Promise<{ entity: string }> }): Promise<NextResponse>`, распаковка `const { entity } = await ctx.params`, тело `await request.json()`, ответ `NextResponse.json(body, { status })`. Server action — файл с `"use server"`, экспорт = результат `createAction(...)`. Client-хук — `"use client"` + `useEffect(()=>…return cleanup, [])` + `addEventListener`/`removeEventListener` (эталон `src/hooks/use-register-sw.ts`). Тесты — `vi.mock(...)` (можно ссылаться на внешние `const`-моки, как в `src/features/auth/actions.test.ts`), `vi.stubGlobal("fetch", …)`. `next.config` БЕЗ rewrites — `/api/offline/*` обслуживает наш route handler (не проксируется на бэкенд).
- **Strict-грабли:** `require-await` (async без await — error: либо await, либо не-async + `Promise.resolve`); `no-unnecessary-condition` (только реально-опциональное); `no-floating-promises` (плавающий промис гасить `void`); `exactOptionalPropertyTypes` (не присваивать явный `undefined` в `field?:T` — условный spread); `no-non-null-assertion`; `no-empty` (пустой `catch{}` с комментарием — ок). **Урок:** между parent- и sibling-import-группами — ПУСТАЯ строка (`import/order` `newlines-between:always`); в конце задачи `pnpm exec eslint <свои файлы> --fix` ДО `pnpm lint`.

---

## File Structure

| Файл | Ответственность |
|---|---|
| `src/app/_offline/registry.ts` | Composition root: `OFFLINE_REGISTRY` (пуст; слайсы L/A добавляют дескрипторы) + `resolveDescriptor: DescriptorResolver`. |
| `src/app/_offline/offline-read.ts` | Pure `assembleBundle(resolve, entity, id)` → `{snapshot, imageKeys}｜null`. Server-importable, без Next-связей. |
| `src/app/_offline/offline-write.ts` | Pure `runOfflineWrite(resolve, entity, rawBody)` → `{status, body}`: валидация тела, `descriptor.write`, маппинг `ActionResult`→HTTP. |
| `src/app/api/offline/[entity]/route.ts` | Тонкий `POST`-адаптер: `await ctx.params`, `request.json()`, `runOfflineWrite(resolveDescriptor,…)`, `NextResponse.json`. Логика — в offline-write (там и тесты). |
| `src/app/_offline/save-offline-action.ts` | `"use server"`: `assembleOfflineBundle = createAction(...)` — тонкая обёртка над `assembleBundle(resolveDescriptor,…)`. |
| `src/app/_offline/save-offline.ts` | `"use client"`: оркестратор `saveOffline(entity,id)` — экшен → `putSavedBundle(saving)` → `persist` → `cacheImage` per key → `updateSavedBundle(complete｜error)`. |
| `src/app/_offline/transport.ts` | Client `offlineTransport: SyncTransport` — `POST /api/offline/{entity}` + маппинг HTTP→`SyncSendResult`. |
| `src/app/_offline/use-offline-sync.ts` | `"use client"`: pure `startOfflineSync(send?)` (вешает `drainOutbox` на online/visibilitychange, возвращает cleanup) + тонкий хук `useOfflineSync()`. |
| `*.test.ts` | Co-located тесты для pure-логики и оркестраторов. |

**Решение по тестируемости (как в F3):** вся логика — pure-функции с инъекцией (`resolve`/`send`); Next-связанные файлы (`route.ts`, `save-offline-action.ts`) — тонкие адаптеры, передающие РЕАЛЬНЫЙ `resolveDescriptor`. Их логика покрыта тестами pure-функций (`offline-write.test.ts`/`offline-read.test.ts`); сами адаптеры — verified by typecheck. `route.ts` НЕ юнит-тестируем (потребовал бы Next route-runtime) — это осознанно (см. Task 4).

**Решение по реестру:** `OFFLINE_REGISTRY` стартует ПУСТЫМ — F4 строит generic-машинерию, слайсы L/A её наполняют. Generic-логика валидируется фикстур-резолверами (DI). Это НЕ «абстракция без потребителя»: потребители (слайсы) — следующие планы.

**Решение по маппингу `ActionResult`→HTTP→`SyncSendResult`:** `success`→200 `{data:{id}}`; `forbidden`→403; `validation`→422; generic (code undefined)→**500**. Транспорт мапит 2xx→`ok`, 4xx→`retriable:false` (`failed`), 5xx/сетевой throw→`retriable:true`. **Downstream-контракт (для слайса A):** `descriptor.write` ОБЯЗАН возвращать ПЕРМАНЕНТНЫЕ/клиентские ошибки как `code:"validation"`/`"forbidden"` (→4xx→не ретраится), а generic (500→retriable) оставлять только для подлинно-временных — иначе перманентная ошибка встанет head-of-line (см. F3 transport.ts). RBAC/forward в `philosophy-api` (с `Idempotency-Key: clientId`) — внутри `descriptor.write` (слайс A), НЕ в F4.

---

## Task 1: Реестр (composition root)

**Files:**
- Create: `src/app/_offline/registry.ts`
- Test: `src/app/_offline/registry.test.ts`

- [ ] **Step 1: Написать падающий тест**

Create `src/app/_offline/registry.test.ts`:

```ts
// src/app/_offline/registry.test.ts
import { describe, it, expect } from "vitest";

import { OFFLINE_REGISTRY, resolveDescriptor } from "./registry";

describe("offline registry", () => {
  it("стартует пустым (слайсы добавят дескрипторы)", () => {
    expect(Object.keys(OFFLINE_REGISTRY)).toEqual([]);
  });

  it("resolveDescriptor → undefined для незарегистрированной сущности", () => {
    expect(resolveDescriptor("lectures")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/app/_offline/registry.test.ts`
Expected: FAIL — модуль `./registry` не найден.

- [ ] **Step 3: Реализовать registry.ts**

Create `src/app/_offline/registry.ts`:

```ts
// src/app/_offline/registry.ts
// Composition root offline foundation: единственный легальный по ESLint канал
// «фича → foundation» (D12). Слайсы L (lectures) и A (annotations) добавят сюда
// свои дескрипторы; ядро (repository/route handler/save action) получает только
// resolveDescriptor и остаётся entity-agnostic.
import type { OfflineDescriptor } from "@/services/offline/contract/descriptor";
import type { DescriptorResolver } from "@/services/offline/repository";

export const OFFLINE_REGISTRY: Record<string, OfflineDescriptor> = {
  // Слайс L добавит: [Tags.LECTURES]: lectureDescriptor
  // Слайс A добавит: [Tags.ANNOTATIONS]: annotationDescriptor
};

export const resolveDescriptor: DescriptorResolver = (entity) =>
  OFFLINE_REGISTRY[entity];
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/app/_offline/registry.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 5: Lint + typecheck + commit**

```bash
pnpm exec eslint src/app/_offline/registry.ts src/app/_offline/registry.test.ts --fix
pnpm lint && pnpm typecheck
```

Expected: 0 ошибок.

```bash
git add src/app/_offline/registry.ts src/app/_offline/registry.test.ts
git commit -m "feat(offline): composition-root registry + resolveDescriptor"
```

---

## Task 2: Сборка снимка (pure `assembleBundle`)

**Files:**
- Create: `src/app/_offline/offline-read.ts`
- Test: `src/app/_offline/offline-read.test.ts`

> Pure-логика save-flow (read-сторона): резолвит дескриптор, зовёт `assemble`, извлекает `imageKeys`. Инъекция резолвера → тестируемо без реестра/Next.

- [ ] **Step 1: Написать падающий тест**

Create `src/app/_offline/offline-read.test.ts`:

```ts
// src/app/_offline/offline-read.test.ts
import { describe, it, expect } from "vitest";

import type { OfflineDescriptor } from "@/services/offline/contract/descriptor";
import type { DescriptorResolver } from "@/services/offline/repository";

import { assembleBundle } from "./offline-read";

const SNAPSHOT = { title: "L1", imageKeys: ["sha-a", "sha-b"] };

const descriptor: OfflineDescriptor = {
  entity: "lectures",
  pathSegment: "lectures",
  assemble: (id) => Promise.resolve(id === "l1" ? SNAPSHOT : null),
  extractImageKeys: (snapshot) =>
    (snapshot as { imageKeys: string[] }).imageKeys,
};

const resolve: DescriptorResolver = (entity) =>
  entity === "lectures" ? descriptor : undefined;

describe("assembleBundle", () => {
  it("собирает {snapshot, imageKeys} для существующей сущности", async () => {
    expect(await assembleBundle(resolve, "lectures", "l1")).toEqual({
      snapshot: SNAPSHOT,
      imageKeys: ["sha-a", "sha-b"],
    });
  });

  it("null, если assemble вернул null", async () => {
    expect(await assembleBundle(resolve, "lectures", "missing")).toBeNull();
  });

  it("null, если нет дескриптора сущности", async () => {
    expect(await assembleBundle(resolve, "unknown", "l1")).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/app/_offline/offline-read.test.ts`
Expected: FAIL — модуль `./offline-read` не найден.

- [ ] **Step 3: Реализовать offline-read.ts**

Create `src/app/_offline/offline-read.ts`:

```ts
// src/app/_offline/offline-read.ts
// Pure save-flow (read): собрать офлайн-снимок сущности через её дескриптор.
// Резолвер инжектируется (тестируемо); реальный resolveDescriptor подставляет
// server-экшен. Снимок entity-agnostic (unknown) — его форму знает дескриптор/view.
import type { DescriptorResolver } from "@/services/offline/repository";

export interface OfflineBundleData {
  snapshot: unknown;
  imageKeys: string[];
}

export async function assembleBundle(
  resolve: DescriptorResolver,
  entity: string,
  id: string,
): Promise<OfflineBundleData | null> {
  const descriptor = resolve(entity);
  if (!descriptor) return null;
  const snapshot = await descriptor.assemble(id);
  if (snapshot === null) return null;
  return { snapshot, imageKeys: descriptor.extractImageKeys(snapshot) };
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/app/_offline/offline-read.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Lint + typecheck + commit**

```bash
pnpm exec eslint src/app/_offline/offline-read.ts src/app/_offline/offline-read.test.ts --fix
pnpm lint && pnpm typecheck
```

```bash
git add src/app/_offline/offline-read.ts src/app/_offline/offline-read.test.ts
git commit -m "feat(offline): assembleBundle (save-flow read logic)"
```

---

## Task 3: Write-логика (pure `runOfflineWrite`)

**Files:**
- Create: `src/app/_offline/offline-write.ts`
- Test: `src/app/_offline/offline-write.test.ts`

> Pure-логика write-path: валидирует тело `{clientId, op, payload}`, резолвит `descriptor.write`, мапит `ActionResult`→`{status, body}`. Маппинг кодов: success→200, forbidden→403, validation→422, generic→500, нет write→404, плохое тело→400.

- [ ] **Step 1: Написать падающий тест**

Create `src/app/_offline/offline-write.test.ts`:

```ts
// src/app/_offline/offline-write.test.ts
import { describe, it, expect } from "vitest";

import type { OfflineDescriptor } from "@/services/offline/contract/descriptor";
import type { DescriptorResolver } from "@/services/offline/repository";

import { runOfflineWrite } from "./offline-write";

type WriteFn = NonNullable<OfflineDescriptor["write"]>;

function makeResolver(write: WriteFn | null): DescriptorResolver {
  const descriptor: OfflineDescriptor = {
    entity: "annotations",
    pathSegment: "annotations",
    assemble: () => Promise.resolve(null),
    extractImageKeys: () => [],
    ...(write ? { write } : {}),
  };
  return (entity) => (entity === "annotations" ? descriptor : undefined);
}

const BODY = { clientId: "c1", op: "create", payload: { text: "x" } };

describe("runOfflineWrite", () => {
  it("успех write → 200 + {data:{id}}", async () => {
    const resolve = makeResolver(() =>
      Promise.resolve({ success: true, data: { id: "srv-1" } }),
    );
    expect(await runOfflineWrite(resolve, "annotations", BODY)).toEqual({
      status: 200,
      body: { data: { id: "srv-1" } },
    });
  });

  it("forbidden → 403", async () => {
    const resolve = makeResolver(() =>
      Promise.resolve({ success: false, error: "Нет прав", code: "forbidden" }),
    );
    expect(await runOfflineWrite(resolve, "annotations", BODY)).toEqual({
      status: 403,
      body: { error: "Нет прав" },
    });
  });

  it("validation → 422 + fieldErrors", async () => {
    const resolve = makeResolver(() =>
      Promise.resolve({
        success: false,
        error: "Ошибка валидации",
        code: "validation",
        fieldErrors: { text: "обязательно" },
      }),
    );
    expect(await runOfflineWrite(resolve, "annotations", BODY)).toEqual({
      status: 422,
      body: { error: "Ошибка валидации", fieldErrors: { text: "обязательно" } },
    });
  });

  it("generic error → 500 (retriable)", async () => {
    const resolve = makeResolver(() =>
      Promise.resolve({ success: false, error: "boom" }),
    );
    expect(await runOfflineWrite(resolve, "annotations", BODY)).toEqual({
      status: 500,
      body: { error: "boom" },
    });
  });

  it("нет дескриптора → 404", async () => {
    const resolve = makeResolver(() =>
      Promise.resolve({ success: true, data: { id: "x" } }),
    );
    expect(
      (await runOfflineWrite(resolve, "unknown", BODY)).status,
    ).toBe(404);
  });

  it("дескриптор без write → 404", async () => {
    expect(
      (await runOfflineWrite(makeResolver(null), "annotations", BODY)).status,
    ).toBe(404);
  });

  it("невалидное тело → 400", async () => {
    const resolve = makeResolver(() =>
      Promise.resolve({ success: true, data: { id: "x" } }),
    );
    expect(
      (await runOfflineWrite(resolve, "annotations", { op: "create" })).status,
    ).toBe(400);
  });

  it("неизвестный op (не create) → 400", async () => {
    const resolve = makeResolver(() =>
      Promise.resolve({ success: true, data: { id: "x" } }),
    );
    expect(
      (
        await runOfflineWrite(resolve, "annotations", {
          clientId: "c1",
          op: "delete",
          payload: {},
        })
      ).status,
    ).toBe(400);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/app/_offline/offline-write.test.ts`
Expected: FAIL — модуль `./offline-write` не найден.

- [ ] **Step 3: Реализовать offline-write.ts**

Create `src/app/_offline/offline-write.ts`:

```ts
// src/app/_offline/offline-write.ts
// Pure write-path: исполнить офлайн-команду через descriptor.write и смапить
// ActionResult в {status, body}. Резолвер инжектируется (тестируемо); реальный
// resolveDescriptor подставляет route handler. RBAC/forward — внутри write.
import type { DescriptorResolver } from "@/services/offline/repository";

export interface OfflineWriteResponse {
  status: number;
  body: unknown;
}

interface OfflineWriteBody {
  clientId: string;
  op: string;
  payload: unknown;
}

function isWriteBody(value: unknown): value is OfflineWriteBody {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.clientId === "string" &&
    record.op === "create" && // уровень 1: только create; уровень 2 (update/delete) расширит множество
    "payload" in record
  );
}

export async function runOfflineWrite(
  resolve: DescriptorResolver,
  entity: string,
  rawBody: unknown,
): Promise<OfflineWriteResponse> {
  if (!isWriteBody(rawBody)) {
    return { status: 400, body: { error: "Некорректное тело офлайн-команды" } };
  }
  const write = resolve(entity)?.write;
  if (!write) {
    return {
      status: 404,
      body: { error: `Нет офлайн-записи для сущности «${entity}»` },
    };
  }
  const result = await write(rawBody.payload, rawBody.clientId);
  if (result.success) {
    return { status: 200, body: { data: result.data } };
  }
  if (result.code === "forbidden") {
    return { status: 403, body: { error: result.error } };
  }
  if (result.code === "validation") {
    return {
      status: 422,
      body: { error: result.error, fieldErrors: result.fieldErrors },
    };
  }
  return { status: 500, body: { error: result.error } };
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/app/_offline/offline-write.test.ts`
Expected: PASS (8 тестов).

- [ ] **Step 5: Lint + typecheck + commit**

```bash
pnpm exec eslint src/app/_offline/offline-write.ts src/app/_offline/offline-write.test.ts --fix
pnpm lint && pnpm typecheck
```

```bash
git add src/app/_offline/offline-write.ts src/app/_offline/offline-write.test.ts
git commit -m "feat(offline): runOfflineWrite (write-path logic, ActionResult to HTTP)"
```

---

## Task 4: Route handler `POST /api/offline/[entity]`

**Files:**
- Create: `src/app/api/offline/[entity]/route.ts`

> Тонкий Next-адаптер над `runOfflineWrite` с РЕАЛЬНЫМ `resolveDescriptor`. **Юнит-теста нет осознанно:** логика маппинга полностью покрыта `offline-write.test.ts`; тест самого route handler потребовал бы Next route-runtime (вне vitest-юнитов). Единственная собственная ветка адаптера — `try { request.json() } catch → 400` (тело не JSON) — verified-by-inspection (не покрыта тестом pure-логики, где `rawBody` уже распарсен). Это первый POST route handler в проекте (существующие — GET-прокси); URL `/api/offline/*` обслуживается Next (rewrites в `next.config` отсутствуют, на бэкенд не проксируется).

- [ ] **Step 1: Реализовать route.ts**

Create `src/app/api/offline/[entity]/route.ts`:

```ts
// src/app/api/offline/[entity]/route.ts
// Единый стабильный путь офлайн-записи (D7): same-origin, replay-safe, SW-совместим.
// Тонкий адаптер — вся логика и её тесты в @/app/_offline/offline-write.
import { NextResponse, type NextRequest } from "next/server";

import { runOfflineWrite } from "@/app/_offline/offline-write";
import { resolveDescriptor } from "@/app/_offline/registry";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ entity: string }> },
): Promise<NextResponse> {
  const { entity } = await ctx.params;
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Тело запроса не является JSON" },
      { status: 400 },
    );
  }
  const { status, body } = await runOfflineWrite(
    resolveDescriptor,
    entity,
    rawBody,
  );
  return NextResponse.json(body, { status });
}
```

- [ ] **Step 2: Lint + typecheck**

```bash
pnpm exec eslint "src/app/api/offline/[entity]/route.ts" --fix
pnpm lint && pnpm typecheck
```

Expected: 0 ошибок. (Тестов нет — см. примечание выше; общий `pnpm test` в Task 7 подтвердит отсутствие регрессий.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/offline/[entity]/route.ts"
git commit -m "feat(offline): POST /api/offline/[entity] route handler (write path)"
```

---

## Task 5: Save-flow (server action + client-оркестратор)

**Files:**
- Create: `src/app/_offline/save-offline-action.ts`
- Create: `src/app/_offline/save-offline.ts`
- Test: `src/app/_offline/save-offline.test.ts`

> `assembleOfflineBundle` — тонкий `"use server"`-экшен (обёртка над `assembleBundle` с реальным резолвером; тесты — в `offline-read.test.ts`). `saveOffline` — client-оркестратор: экшен → запись снимка в IndexedDB → persist → докачка картинок в Cache Storage → финальный статус. Тестируется с моками экшена/картинок/persist + реальным `saved-bundles` (fake-indexeddb).

- [ ] **Step 1: Реализовать server action**

Create `src/app/_offline/save-offline-action.ts`:

```ts
// src/app/_offline/save-offline-action.ts
"use server";

import "server-only";

import { createAction } from "@/utils/create-action";

import { assembleBundle, type OfflineBundleData } from "./offline-read";
import { resolveDescriptor } from "./registry";

/** server-only: собрать офлайн-снимок сущности (RBAC/доступ — внутри descriptor.assemble). */
export const assembleOfflineBundle = createAction(
  (input: { entity: string; id: string }): Promise<OfflineBundleData | null> =>
    assembleBundle(resolveDescriptor, input.entity, input.id),
);
```

- [ ] **Step 2: Написать падающий тест оркестратора**

Create `src/app/_offline/save-offline.test.ts`:

```ts
// src/app/_offline/save-offline.test.ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach, vi } from "vitest";

// vi.hoisted: фабрика vi.mock хойстится выше const'ов; мок, разыменованный
// СРАЗУ в возвращаемом объекте фабрики, обязан быть создан через vi.hoisted,
// иначе TDZ «Cannot access before initialization» (проверено эмпирически).
const assembleMock = vi.hoisted(() => vi.fn());
vi.mock("./save-offline-action", () => ({
  assembleOfflineBundle: assembleMock,
}));

const cacheImageMock = vi.hoisted(() => vi.fn());
vi.mock("@/services/offline/store/images", () => ({
  cacheImage: cacheImageMock,
}));

vi.mock("@/services/offline/store/persistence", () => ({
  requestPersistentStorage: () => Promise.resolve(true),
}));

import { getSavedBundle } from "@/services/offline/store/saved-bundles";
import { resolveStorageUrl } from "@/utils/storage-url";

import { saveOffline } from "./save-offline";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  assembleMock.mockReset();
  cacheImageMock.mockReset();
});

describe("saveOffline", () => {
  it("успех: снимок в IDB, картинки в кэш, статус complete", async () => {
    assembleMock.mockResolvedValue({
      success: true,
      data: { snapshot: { t: 1 }, imageKeys: ["a", "b"] },
    });
    cacheImageMock.mockResolvedValue(true);

    const res = await saveOffline("lectures", "l1");

    expect(res).toEqual({ ok: true });
    expect(cacheImageMock).toHaveBeenCalledTimes(2);
    expect(cacheImageMock).toHaveBeenCalledWith(resolveStorageUrl("a"));
    const rec = await getSavedBundle("lectures", "l1");
    expect(rec?.status).toBe("complete");
    expect(rec?.snapshot).toEqual({ t: 1 });
  });

  it("частичный сбой картинок → статус error, ok:false", async () => {
    assembleMock.mockResolvedValue({
      success: true,
      data: { snapshot: {}, imageKeys: ["a", "b"] },
    });
    cacheImageMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const res = await saveOffline("lectures", "l1");

    expect(res.ok).toBe(false);
    expect((await getSavedBundle("lectures", "l1"))?.status).toBe("error");
  });

  it("сущность недоступна (data=null) → ok:false, ничего не пишем", async () => {
    assembleMock.mockResolvedValue({ success: true, data: null });

    const res = await saveOffline("lectures", "l1");

    expect(res.ok).toBe(false);
    expect(await getSavedBundle("lectures", "l1")).toBeUndefined();
  });

  it("ошибка экшена → ok:false с текстом ошибки", async () => {
    assembleMock.mockResolvedValue({ success: false, error: "boom" });

    const res = await saveOffline("lectures", "l1");

    expect(res).toEqual({ ok: false, error: "boom" });
  });
});
```

- [ ] **Step 3: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/app/_offline/save-offline.test.ts`
Expected: FAIL — модуль `./save-offline` не найден.

- [ ] **Step 4: Реализовать client-оркестратор**

Create `src/app/_offline/save-offline.ts`:

```ts
// src/app/_offline/save-offline.ts
"use client";

import { cacheImage } from "@/services/offline/store/images";
import { requestPersistentStorage } from "@/services/offline/store/persistence";
import {
  putSavedBundle,
  updateSavedBundle,
} from "@/services/offline/store/saved-bundles";
import { resolveStorageUrl } from "@/utils/storage-url";

import { assembleOfflineBundle } from "./save-offline-action";

export interface SaveOfflineResult {
  ok: boolean;
  error?: string;
}

const OFFLINE_SCHEMA_VERSION = 1;

/** Сохранить сущность офлайн: server-снимок → IndexedDB + картинки в Cache Storage. */
export async function saveOffline(
  entity: string,
  id: string,
): Promise<SaveOfflineResult> {
  const result = await assembleOfflineBundle({ entity, id });
  if (!result.success) return { ok: false, error: result.error };
  if (!result.data) {
    return { ok: false, error: "Сущность недоступна для сохранения." };
  }
  const { snapshot, imageKeys } = result.data;

  await requestPersistentStorage();
  await putSavedBundle({
    entity,
    id,
    savedAt: new Date().toISOString(),
    schemaVersion: OFFLINE_SCHEMA_VERSION,
    status: "saving",
    snapshot,
    imageKeys,
  });

  let failed = 0;
  for (const key of imageKeys) {
    // resolveStorageUrl — единая точка истины URL (та же, что рендерит view):
    // Cache Storage матчит по полному URL, поэтому хардкодить /static/files
    // нельзя — при NEXT_PUBLIC_STORAGE_URL (CDN) src разойдётся с кэшем.
    const cached = await cacheImage(resolveStorageUrl(key));
    if (!cached) failed++;
  }

  if (failed > 0) {
    await updateSavedBundle(entity, id, {
      status: "error",
      error: `Не сохранилось картинок: ${failed} из ${imageKeys.length}`,
    });
    return { ok: false, error: "Сохранено частично — часть картинок недоступна." };
  }
  await updateSavedBundle(entity, id, { status: "complete" });
  return { ok: true };
}
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/app/_offline/save-offline.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 6: Lint + typecheck + commit**

```bash
pnpm exec eslint src/app/_offline/save-offline-action.ts src/app/_offline/save-offline.ts src/app/_offline/save-offline.test.ts --fix
pnpm lint && pnpm typecheck
```

```bash
git add src/app/_offline/save-offline-action.ts src/app/_offline/save-offline.ts src/app/_offline/save-offline.test.ts
git commit -m "feat(offline): save-flow (assemble action + client orchestrator)"
```

---

## Task 6: Транспорт синка (`offlineTransport`)

**Files:**
- Create: `src/app/_offline/transport.ts`
- Test: `src/app/_offline/transport.test.ts`

> Concrete `SyncTransport`: `POST /api/offline/{entity}` (same-origin) + маппинг HTTP→`SyncSendResult`. 2xx+`{data:{id}}`→`{ok,serverId}`; 2xx без id→`retriable:false`; 4xx→`retriable:false`; 5xx→`retriable:true`. Сетевой throw драйвер `drainOutbox` ловит сам (как transient) — транспорт его не глотает.

- [ ] **Step 1: Написать падающий тест**

Create `src/app/_offline/transport.test.ts`:

```ts
// src/app/_offline/transport.test.ts
import { describe, it, expect, afterEach, vi } from "vitest";

import type { OutboxCommand } from "@/services/offline/contract/storage";

import { offlineTransport } from "./transport";

function command(): OutboxCommand {
  return {
    clientId: "c1",
    entity: "annotations",
    op: "create",
    payload: { text: "x" },
    createdAt: "2026-06-14T00:00:00.000Z",
    status: "syncing",
    attempts: 0,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("offlineTransport", () => {
  it("2xx + {data:{id}} → {ok:true, serverId}", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: { id: "srv-1" } }), {
            status: 200,
          }),
        ),
      ),
    );
    expect(await offlineTransport(command())).toEqual({
      ok: true,
      serverId: "srv-1",
    });
  });

  it("2xx без id → не-retriable отказ", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: {} }), { status: 200 }),
        ),
      ),
    );
    expect(await offlineTransport(command())).toMatchObject({
      ok: false,
      retriable: false,
    });
  });

  it("4xx → retriable:false + текст ошибки из тела", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: "Нет прав" }), { status: 403 }),
        ),
      ),
    );
    expect(await offlineTransport(command())).toMatchObject({
      ok: false,
      retriable: false,
      error: "Нет прав",
    });
  });

  it("5xx → retriable:true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("boom", { status: 503 }))),
    );
    expect(await offlineTransport(command())).toMatchObject({
      ok: false,
      retriable: true,
    });
  });

  it("2xx с не-JSON телом → не-retriable отказ (не вечный ретрай)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response("<html>login</html>", { status: 200 })),
      ),
    );
    expect(await offlineTransport(command())).toMatchObject({
      ok: false,
      retriable: false,
    });
  });

  it("шлёт POST на /api/offline/{entity} с телом команды и same-origin", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: { id: "x" } }), { status: 200 }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await offlineTransport(command());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/offline/annotations",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/app/_offline/transport.test.ts`
Expected: FAIL — модуль `./transport` не найден.

- [ ] **Step 3: Реализовать transport.ts**

Create `src/app/_offline/transport.ts`:

```ts
// src/app/_offline/transport.ts
// Concrete транспорт синка: POST /api/offline/{entity} (same-origin) +
// маппинг HTTP → SyncSendResult. Инжектируется в drainOutbox (F3).
import type { OutboxCommand } from "@/services/offline/contract/storage";
import type {
  SyncSendResult,
  SyncTransport,
} from "@/services/offline/sync/transport";

export const offlineTransport: SyncTransport = async (
  command: OutboxCommand,
): Promise<SyncSendResult> => {
  const res = await fetch(`/api/offline/${command.entity}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      clientId: command.clientId,
      op: command.op,
      payload: command.payload,
    }),
  });

  if (res.ok) {
    let serverId: unknown;
    try {
      const json = (await res.json()) as { data?: { id?: string } };
      serverId = json.data?.id;
    } catch {
      // 2xx с не-JSON телом (напр. HTML логина после редиректа) —
      // детерминированный отказ, НЕ retriable (ретрай вернёт тот же ответ).
      return {
        ok: false,
        retriable: false,
        error: "Некорректный ответ офлайн-записи (не JSON)",
      };
    }
    if (typeof serverId !== "string") {
      return {
        ok: false,
        retriable: false,
        error: "Некорректный ответ офлайн-записи (нет id)",
      };
    }
    return { ok: true, serverId };
  }

  const retriable = res.status >= 500;
  let error = `Офлайн-запись не удалась (${res.status})`;
  try {
    const json = (await res.json()) as { error?: unknown };
    if (typeof json.error === "string") error = json.error;
  } catch {
    // тело не JSON — оставляем статус-сообщение
  }
  return { ok: false, retriable, error };
};
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/app/_offline/transport.test.ts`
Expected: PASS (6 тестов).

- [ ] **Step 5: Lint + typecheck + commit**

```bash
pnpm exec eslint src/app/_offline/transport.ts src/app/_offline/transport.test.ts --fix
pnpm lint && pnpm typecheck
```

```bash
git add src/app/_offline/transport.ts src/app/_offline/transport.test.ts
git commit -m "feat(offline): concrete sync transport (POST /api/offline/[entity])"
```

---

## Task 7: Привязка синка к событиям (`startOfflineSync` + `useOfflineSync`)

**Files:**
- Create: `src/app/_offline/use-offline-sync.ts`
- Test: `src/app/_offline/use-offline-sync.test.ts`

> Pure `startOfflineSync(send?)` вешает `drainOutbox` на `online` + `visibilitychange(visible)`, дренажит при старте, возвращает cleanup — тестируется в jsdom без React. Тонкий хук `useOfflineSync()` вызывает её в `useEffect` (эталон cleanup — `src/hooks/use-register-sw.ts`).

- [ ] **Step 1: Написать падающий тест**

Create `src/app/_offline/use-offline-sync.test.ts`:

```ts
// src/app/_offline/use-offline-sync.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

// vi.hoisted — мок разыменовывается сразу в фабрике vi.mock (TDZ-фикс, см.
// save-offline.test.ts).
const drainMock = vi.hoisted(() =>
  vi.fn(() =>
    Promise.resolve({
      skipped: false,
      attempted: 0,
      done: 0,
      failed: 0,
      deferred: 0,
    }),
  ),
);
vi.mock("@/services/offline/sync/drain", () => ({ drainOutbox: drainMock }));

import { startOfflineSync } from "./use-offline-sync";

beforeEach(() => {
  drainMock.mockClear();
});

describe("startOfflineSync", () => {
  it("дренажит при старте", () => {
    const stop = startOfflineSync();
    expect(drainMock).toHaveBeenCalledTimes(1);
    stop();
  });

  it("дренажит на событие online", () => {
    const stop = startOfflineSync();
    drainMock.mockClear();
    window.dispatchEvent(new Event("online"));
    expect(drainMock).toHaveBeenCalledTimes(1);
    stop();
  });

  it("дренажит на visibilitychange когда документ видим", () => {
    const stop = startOfflineSync();
    drainMock.mockClear();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(drainMock).toHaveBeenCalledTimes(1); // jsdom: visibilityState='visible'
    stop();
  });

  it("после cleanup больше не реагирует на события", () => {
    const stop = startOfflineSync();
    stop();
    drainMock.mockClear();
    window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(drainMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/app/_offline/use-offline-sync.test.ts`
Expected: FAIL — модуль `./use-offline-sync` не найден.

- [ ] **Step 3: Реализовать use-offline-sync.ts**

Create `src/app/_offline/use-offline-sync.ts`:

```ts
// src/app/_offline/use-offline-sync.ts
"use client";

import { useEffect } from "react";

import { drainOutbox } from "@/services/offline/sync/drain";
import type { SyncTransport } from "@/services/offline/sync/transport";

import { offlineTransport } from "./transport";

/**
 * Вешает foreground-дренаж outbox на online/visibilitychange, дренажит при
 * старте и возвращает cleanup. Pure (без React) — тестируется в jsdom.
 */
export function startOfflineSync(
  send: SyncTransport = offlineTransport,
): () => void {
  const run = (): void => {
    void drainOutbox({ send });
  };
  const onVisible = (): void => {
    if (document.visibilityState === "visible") run();
  };
  run();
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.removeEventListener("online", run);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/** Хук-обёртка: подключает синк на время жизни смонтировавшего компонента. */
export function useOfflineSync(): void {
  useEffect(() => startOfflineSync(), []);
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/app/_offline/use-offline-sync.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Финальная проверка + commit**

```bash
pnpm exec eslint src/app/_offline/use-offline-sync.ts src/app/_offline/use-offline-sync.test.ts --fix
pnpm lint && pnpm typecheck && pnpm test
```

Expected: всё PASS (lint 0, типы ок, существующие тесты не сломаны).

```bash
git add src/app/_offline/use-offline-sync.ts src/app/_offline/use-offline-sync.test.ts
git commit -m "feat(offline): wire foreground sync to online/visibilitychange"
```

---

## Self-Review

**Покрытие спека v2:**

- §5 composition root (`app/_offline`, реестр через инверсию зависимости, D12) — Task 1. ✓
- §7 save-flow (`saveOffline` server→client: `assemble`→IndexedDB(`saving`)→`persist()`→картинки→`complete`) — Tasks 2,5. ✓
- §8 единый стабильный route handler `POST /api/offline/[entity]` (D7) + foreground-драйвер на триггерах online/visibilitychange/старт — Tasks 3,4,6,7. ✓
- §8 idempotency: route handler передаёт `clientId` как `idempotencyKey` в `descriptor.write` (форвард с `Idempotency-Key` — внутри write, слайс A). ✓
- D3 same-origin (`credentials:"same-origin"`), httpOnly не трогаем — Task 6. ✓

**Разрешённые/зафиксированные решения:**

- **Реестр стартует пустым** — F4 строит generic-машинерию, валидирует фикстур-резолверами (DI); слайсы L/A наполняют. Не «абстракция без потребителя» (потребители — следующие планы).
- **Pure-логика + тонкие адаптеры:** `assembleBundle`/`runOfflineWrite`/`startOfflineSync` тестируются через инъекцию; `route.ts`/`save-offline-action.ts` — тонкие обёртки с реальным `resolveDescriptor`, покрыты тестами pure-логики + typecheck. `route.ts` без юнит-теста осознанно (потребовал бы Next route-runtime).
- **Маппинг ActionResult→HTTP→SyncSendResult:** success→200, forbidden→403, validation→422, generic→500, нет write→404, плохое тело→400; транспорт: 2xx→ok, 4xx→retriable:false, 5xx/throw→retriable:true. **Downstream-контракт слайса A:** перманентные ошибки `descriptor.write` обязан кодировать как `validation`/`forbidden` (4xx, не ретраится); generic(500/retriable) — только для временных, иначе head-of-line (см. F3 transport.ts JSDoc).
- **RBAC/forward — внутри `descriptor.write`** (CLAUDE.md: «в server actions — requireCapability»), НЕ в route handler. Route handler не делает отдельный auth-чек: `descriptor.write` вернёт `forbidden`→403.
- **Read-репозиторий (F3) в F4 НЕ инстанцируется** — `createServerRepository(resolveDescriptor)`/`createIndexedDbRepository()` подключит view/страница в слайсе L (там есть реальный дескриптор и UI). F4 даёт лишь `resolveDescriptor`.
- **`/api/offline/*` не конфликтует:** в `next.config` нет rewrites; первый POST route handler в проекте (прецедент формы — GET-прокси `export/route.ts`).

**Strict-флаги (учтено в коде):**

- `require-await`: транспорт/saveOffline — async С await; фикстуры write — не-async `Promise.resolve`. ✓
- `no-unnecessary-condition`: `if (!descriptor)`, `resolve(entity)?.write`, `if (!write)`, `snapshot === null`, `typeof value !== "object" || value === null`, `result.code === …`, `typeof serverId !== "string"`, `if (!cached)`, `visibilityState === "visible"` — все реально-нетривиальны. ✓
- `no-floating-promises`: `void drainOutbox(...)`. ✓
- `exactOptionalPropertyTypes`: фикстура дескриптора с условным `...(write ? { write } : {})`; патчи `updateSavedBundle` — конкретные значения. ✓
- `no-empty`: `catch {}` в транспорте — с комментарием. ✓
- `no-non-null-assertion`: нет `x!` (везде `?.`/guard). ✓
- `import/order`: пустая строка между parent (`@/…`) и sibling (`./…`) группами; `eslint --fix` в каждой задаче. ✓
- Каст `unknown`→typed через `as { … }` (как в существующем `createAnnotation`: `(await res.json()) as { data?: … }`) — без `any`, member-access безопасен после каста. ✓

**Учтено по адверсариальному ревью (5 агентов: логика, strict-lint, симметрия, архитектура, эмпирический прогон в worktree — реальный lint/typecheck/test + мутации):**

- **[было Critical, эмпирически подтверждён баг] `vi.mock` TDZ-хойстинг:** фабрики `save-offline.test.ts`/`use-offline-sync.test.ts` разыменовывают мок СРАЗУ в возвращаемом объекте → `Cannot access … before initialization` (vitest хойстит `vi.mock` выше `const`). Эталон auth-теста читает мок ЛЕНИВО внутри вложенной функции, потому работает. Фикс: моки через `vi.hoisted(() => vi.fn())`. Эмпирик подтвердил: после фикса 25/25 зелёные.
- **[было Critical] Транспорт 2xx с не-JSON телом:** `await res.json()` в 2xx-ветке не был обёрнут (в отличие от 4xx) → `SyntaxError` пробрасывался в `drainOutbox` как transient → вечный retriable head-of-line. Обёрнут try/catch → `retriable:false`; добавлен тест.
- **[было Critical] Хардкод URL картинки:** `saveOffline` кэшировал `/static/files/${key}`, а view рендерит `resolveStorageUrl(key)` (= `${NEXT_PUBLIC_STORAGE_URL||…}/static/files/{key}`). Cache Storage матчит по полному URL → при CDN-base картинки молча не отдавались бы офлайн (тест мокает `cacheImage`, не ловит). Заменён на `resolveStorageUrl(key)` — единая точка истины; тест сверяет против неё.
- **[было Important] `op` валидировался как `string`, но не использовался:** route handler — публичный same-origin POST; `isWriteBody` теперь требует `op === "create"` (явный 400 на неизвестный op; уровень 2 расширит). Добавлен тест.
- **[было Minor] `save-offline-action.ts` без `import "server-only"`:** добавлен (100% server-action-файлов фич его дублируют после `"use server"`; vitest стабит).
- **Подтверждено эмпирически (НЕ требует правок):** дословный код проходит `pnpm lint` БЕЗ `--fix` (import/order чист — рецидива нет) и `pnpm typecheck` (0); все 8 мутаций (forbidden/isWriteBody/generic-500/cacheImage/partial-fail/5xx-retriable/start-drain/cleanup) пойманы — тесты честные. `no-empty` в конфиге вообще не активен (catch-комментарий не нужен, но безвреден).

**Известные ограничения / downstream-контракты (зафиксированы, НЕ баги F4):**

- **Зависшие `"saving"` saved-bundles (recovery):** если процесс умрёт между `putSavedBundle("saving")` и финальным `updateSavedBundle`, запись зависнет в `"saving"`. Это read-cache (НЕ потеря данных, в отличие от outbox-`syncing`). Примитив готов: `listSavedBundlesByStatus("saving")` (план 1). **Контракт слайса L:** при входе в `/saved` подмести зависшие `"saving"`→`"error"` (или показать как failed + предложить пересохранить).
- **Чтение по статусу:** IndexedDB-репозиторий status-agnostic (отдаёт `snapshot` при любом статусе). **Контракт слайса L:** `SavedLectureView` ОБЯЗАН показывать/использовать только записи `status==="complete"` (или явно помечать `saving`/`error`), иначе пользователь увидит снимок с недокачанными картинками.
- **Снимок = plain-JSON:** server-action `assembleOfflineBundle` гонит снимок server→client через RSC-сериализацию, далее в IndexedDB через structured-clone. **Контракт слайса L:** `descriptor.assemble` ОБЯЗАН возвращать JSON-значение (без функций/классов/Map/Date-зависимых форм), иначе server- и IndexedDB-адаптеры репозитория разъедутся по типам. Объём тяжёлого снимка едет через action целиком (bundle-endpoint рычага 1 это не уменьшит, лишь соберёт за 1 round-trip).
- **`Idempotency-Key` ставит слайс A:** F4 прокидывает `clientId` сквозь весь путь (тело команды → `descriptor.write(payload, clientId)`); сам заголовок `Idempotency-Key: clientId` при форварде в `philosophy-api` ставит `descriptor.write` (слайс A). **Контракт слайса A:** `write` ОБЯЗАН проставить заголовок, иначе at-least-once даст дубли (F4 это не ловит). Готовность к рычагу 3 — полная.
- **Семантика «успех ⟺ `data.id:string`» не масштабируется на уровень 2:** транспорт трактует 2xx без `id` как не-retriable отказ; `delete` (уровень 2) может легитимно вернуть 2xx без `id`. Уровень 2 потребует правки семантики успеха транспорта + сигнатуры `descriptor.write` (принять `op`) — отложено с D15.

**Согласованность типов/имён:** `DescriptorResolver`/`OfflineDescriptor`/`SyncTransport`/`SyncSendResult`/`OutboxCommand`/`drainOutbox`/`OfflineBundleData`/`OfflineWriteResponse`/`SaveOfflineResult` — единообразны между файлами и с F3/планом-1. Store-API (`putSavedBundle`/`updateSavedBundle`/`getSavedBundle`/`cacheImage`/`requestPersistentStorage`) — точные сигнатуры плана 1. `createAction`/`ActionResult` — точная форма `@/utils/create-action`. Route-handler-сигнатура — конвенция Next 16 (`params: Promise<…>`). **Плейсхолдеры:** нет.

**Вне скоупа (следующие планы):**

- **F1** — SW: cache `/static/files/*` + app-shell `/saved*`; bucket-seam `flbz-offline-images` (нужно для офлайн-показа сохранённых картинок; F4 их уже кладёт в этот bucket через `cacheImage`).
- **F2** — вынос shared render-хелперов + рефактор `CommentNode`→контейнер/view (prereq для `SavedLectureView`).
- **Слайс L** — `lectureDescriptor` (`assemble`+`extractImageKeys`) → регистрация в `OFFLINE_REGISTRY`; раздел `/saved` (читает через `createIndexedDbRepository`); кнопка «Сохранить» → `saveOffline("lectures", id)`; `SavedLectureView`; монтаж `useOfflineSync()` в shell `/saved`.
- **Слайс A** — `annotationDescriptor.write` (RBAC + форвард в `philosophy-api` с `Idempotency-Key: clientId`; перманентные ошибки → `validation`/`forbidden`); офлайн-create-форма (пишет в outbox через `enqueueOutbox`); render-merge pending; `onSynced`-reconcile из `command.payload`.
```
