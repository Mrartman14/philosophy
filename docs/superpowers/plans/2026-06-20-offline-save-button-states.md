# Stateful entity-agnostic save-offline button — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Кнопка офлайн-сохранения на странице лекции отражает реальное состояние копии (нет / сохранено / доступно обновление) и даёт обновить и удалить копию — оставаясь полностью entity-agnostic.

**Architecture:** Свежесть копии считается одним источником истины — обобщённой `revalidateSavedBundle(entity, id)` (manifest-проба по `freshnessToken`/ETag с fallback на `updated_at`-маркер). Логика свежести выносится в шов дескриптора (`OfflineDescriptor.freshness`) + generic server-action `probe-bundle-action`. Кнопка читает состояние из IndexedDB на маунте, прогоняет ревалидацию и рендерит state-machine.

**Tech Stack:** Next.js (App Router, server actions), React client components, TypeScript (strict, `exactOptionalPropertyTypes`), IndexedDB (через `idb`), Vitest + Testing Library, next-intl (фасад `@/i18n`).

## Global Constraints

- Пакетный менеджер — **pnpm** (не npm). Проверки: `pnpm lint && pnpm test && pnpm build`.
- Именование файлов в `src/` — **kebab-case**.
- UI-тексты — на русском; новые ключи добавляются в **оба** каталога `src/i18n/messages/ru/pages.ts` и `src/i18n/messages/en/pages.ts` (иначе падает `icu-parity.test.ts` / `messages.test.ts`).
- `git add` — только по именам своих файлов. **Запрещены** `git add -A`/`git add .`, `git stash/reset/checkout .`/`clean`.
- Каждое сообщение коммита заканчивается строкой:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- `exactOptionalPropertyTypes` включён: нельзя присваивать optional-полю значение `undefined`; для optional-полей в литералах использовать **условный spread** `...(x ? { x } : {})`.
- Изменение контракта `OfflineDescriptor` (`src/services/offline/contract`) — единственное намеренное касание foundation-зоны, разрешено в рамках этой работы. Остальной код — в `src/app/_offline/*` (редактируемый композиционный корень) и UI-странице.
- Не трогать: `src/app/lectures/[id]/page.tsx` (кнопка получает те же пропы `{entity,id}`), примитивы хранилища (`saved-bundles.ts` уже всё предоставляет, включая `deleteSavedBundle`), UI-kit.

**Спека:** [docs/superpowers/specs/2026-06-20-offline-save-button-states-design.md](../specs/2026-06-20-offline-save-button-states-design.md)

---

## Файловая карта

**Создаются:**
- `src/app/_offline/probe-bundle-action.ts` — generic server-action: `probeBundleFreshness` (ревалидация) + `captureFreshnessToken` (захват токена при сохранении). Тип `BundleProbe`.
- `src/app/_offline/freshness/snapshot-markers.ts` — client-safe per-entity извлечение legacy-маркера (`updated_at`) из снимка.
- `src/app/_offline/revalidate-saved-bundle.ts` — entity-agnostic оркестратор ревалидации (заменяет `revalidate-saved-lecture.ts`).
- `src/app/_offline/revalidate-saved-bundle.test.ts` — тесты оркестратора (порт из `revalidate-saved-lecture.test.ts`).

**Изменяются:**
- `src/services/offline/contract/descriptor.ts` — добавить `freshness?` + типы `ManifestProbe`, `MarkerProbe`.
- `src/app/_offline/probe-lecture-manifest-action.ts` — импортировать `ManifestProbe` из контракта (убрать локальный дубль типа).
- `src/app/_offline/descriptors/lecture-descriptor.ts` — добавить `freshness` (обёртки над существующими lecture-пробами).
- `src/app/_offline/save-offline.ts` — заменить lecture-gated захват токена на generic `captureFreshnessToken`.
- `src/app/_offline/save-offline.test.ts` — замокать `captureFreshnessToken`.
- `src/app/saved/saved-lecture-view.tsx` — перейти на `revalidateSavedBundle("lectures", id)`.
- `src/app/saved/saved-lecture-view.test.tsx` — мок `revalidate-saved-bundle` вместо `revalidate-saved-lecture`.
- `src/app/_offline/save-offline-button.tsx` — полный rewrite в stateful state-machine.
- `src/app/_offline/save-offline-button.test.tsx` — rewrite под новые состояния.
- `src/i18n/messages/ru/pages.ts`, `src/i18n/messages/en/pages.ts` — новые ключи.

**Удаляются:**
- `src/app/_offline/revalidate-saved-lecture.ts`
- `src/app/_offline/revalidate-saved-lecture.test.ts`

**Остаются как есть (вызываются теперь через дескриптор):**
- `src/app/_offline/probe-lecture-manifest-action.ts` (кроме переноса типа), `src/app/_offline/probe-lecture-action.ts` и их тесты.

---

## Task 1: Generic freshness orchestration

Ядро: обобщить свежесть в шов дескриптора и собрать entity-agnostic `revalidateSavedBundle`. Поведение и покрытие — паритет с текущим `revalidateSavedLecture`.

**Files:**
- Modify: `src/services/offline/contract/descriptor.ts`
- Modify: `src/app/_offline/probe-lecture-manifest-action.ts`
- Create: `src/app/_offline/probe-bundle-action.ts`
- Create: `src/app/_offline/freshness/snapshot-markers.ts`
- Create: `src/app/_offline/revalidate-saved-bundle.ts`
- Modify: `src/app/_offline/descriptors/lecture-descriptor.ts`
- Test: `src/app/_offline/revalidate-saved-bundle.test.ts`

> **Отличие от спеки (намеренное, отмечено в ревью):** спека перечисляла `snapshotUpdatedAt` как поле `descriptor.freshness`. Здесь извлечение маркера из снимка вынесено в **client-safe** `SNAPSHOT_MARKERS` (Step 5), а на дескрипторе (`server-only`) остаются только сетевые пробы (`probeManifest`/`probeMarker`). Причина: дескриптор `server-only` и не импортируем в client-оркестратор, а marker-сравнение читает локальный снимок и обязано выполняться на клиенте. Поведение идентично спеке.

**Interfaces:**
- Consumes: `getSavedBundle/putSavedBundle/updateSavedBundle` ([src/services/offline/store/saved-bundles.ts](../../../src/services/offline/store/saved-bundles.ts)), `resolveDescriptor` ([src/app/_offline/registry.ts](../../../src/app/_offline/registry.ts)), `probeLectureManifest` ([src/app/_offline/probe-lecture-manifest-action.ts](../../../src/app/_offline/probe-lecture-manifest-action.ts)), `probeLectureForOffline` ([src/app/_offline/probe-lecture-action.ts](../../../src/app/_offline/probe-lecture-action.ts)), `Tags` (`@/api/tags`).
- Produces:
  - `type ManifestProbe = { status:"fresh" } | { status:"stale"; freshnessToken:string } | { status:"gone" } | { status:"skip" }` (в контракте)
  - `type MarkerProbe = { status:"present"; marker:string } | { status:"gone" } | { status:"skip" }` (в контракте)
  - `OfflineDescriptor.freshness?: { probeManifest:(id:string, token:string|undefined)=>Promise<ManifestProbe>; probeMarker?:(id:string)=>Promise<MarkerProbe> }`
  - `type BundleProbe = ManifestProbe | { status:"marker"; marker:string }` (в `probe-bundle-action.ts`)
  - `probeBundleFreshness(entity:string, id:string, token:string|undefined): Promise<BundleProbe>` (server-action)
  - `captureFreshnessToken(entity:string, id:string): Promise<string | null>` (server-action)
  - `SNAPSHOT_MARKERS: Record<string, (snapshot:unknown)=>string|null>` (client-safe)
  - `revalidateSavedBundle(entity:string, id:string): Promise<"fresh"|"stale"|"gone"|"skip">` (client)

- [ ] **Step 1: Добавить типы и `freshness` в контракт дескриптора**

В [src/services/offline/contract/descriptor.ts](../../../src/services/offline/contract/descriptor.ts) добавить перед `export interface OfflineDescriptor`:

```ts
/** Результат лёгкой manifest-пробы свежести (ETag/version, If-None-Match). */
export type ManifestProbe =
  | { status: "fresh" }
  | { status: "stale"; freshnessToken: string }
  | { status: "gone" }
  | { status: "skip" };

/** Результат legacy-пробы маркера (напр. updated_at) для бандлов без freshnessToken. */
export type MarkerProbe =
  | { status: "present"; marker: string }
  | { status: "gone" }
  | { status: "skip" };
```

Внутри `OfflineDescriptor` добавить (после `write?`):

```ts
  // ── СВЕЖЕСТЬ (опционально; lectures сейчас, documents позже) ──
  /**
   * server-only пробы свежести сохранённой копии. Нет capability → ревалидация
   * для сущности no-op (кнопка живёт в режиме saved/not-saved).
   */
  freshness?: {
    /** Дешёвая manifest-проба по If-None-Match (типизированный openapi-путь внутри). */
    probeManifest: (id: string, token: string | undefined) => Promise<ManifestProbe>;
    /** legacy-fallback для бандлов без freshnessToken; необязателен для новых сущностей. */
    probeMarker?: (id: string) => Promise<MarkerProbe>;
  };
```

- [ ] **Step 2: Переключить `probe-lecture-manifest-action.ts` на тип из контракта**

В [src/app/_offline/probe-lecture-manifest-action.ts](../../../src/app/_offline/probe-lecture-manifest-action.ts) удалить локальное определение `export type ManifestProbe = …` (строки 8–13) и импортировать из контракта. Добавить к импортам:

```ts
import type { ManifestProbe } from "@/services/offline/contract/descriptor";
```

Тело функции не меняется (возвращаемый union идентичен).

- [ ] **Step 3: Написать падающий тест оркестратора**

Создать `src/app/_offline/revalidate-saved-bundle.test.ts`:

```ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach, vi } from "vitest";

const probeMock = vi.hoisted(() => vi.fn());
vi.mock("./probe-bundle-action", () => ({ probeBundleFreshness: probeMock }));

import { OFFLINE_SCHEMA_VERSION } from "@/services/offline/contract/storage";
import {
  getSavedBundle,
  putSavedBundle,
} from "@/services/offline/store/saved-bundles";

import { revalidateSavedBundle } from "./revalidate-saved-bundle";

const snap = (updatedAt: string): unknown => ({
  lecture: { id: "l1", title: "t", updated_at: updatedAt },
  tags: [],
  documents: [],
  comments: [],
});

function seed(opts: {
  status?: "complete" | "saving";
  updatedAt?: string;
  remoteStatus?: "stale" | "gone";
  freshnessToken?: string;
}) {
  const {
    status = "complete",
    updatedAt = "2026-06-10T00:00:00Z",
    remoteStatus,
    freshnessToken,
  } = opts;
  return putSavedBundle({
    entity: "lectures",
    id: "l1",
    savedAt: "2026-06-10T00:00:00.000Z",
    schemaVersion: OFFLINE_SCHEMA_VERSION,
    status,
    snapshot: snap(updatedAt),
    imageKeys: [],
    ...(remoteStatus ? { remoteStatus } : {}),
    ...(freshnessToken ? { freshnessToken } : {}),
  });
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  probeMock.mockReset();
});

describe("revalidateSavedBundle", () => {
  it("нет записи → skip, проба не зовётся", async () => {
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("skip");
    expect(probeMock).not.toHaveBeenCalled();
  });

  it("incomplete-запись → skip, проба не зовётся", async () => {
    await seed({ status: "saving" });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("skip");
    expect(probeMock).not.toHaveBeenCalled();
  });

  it("проба skip → skip, запись не тронута", async () => {
    await seed({});
    probeMock.mockResolvedValue({ status: "skip" });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("skip");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBeUndefined();
  });

  it("проба skip при существующей пометке → пометка сохраняется", async () => {
    await seed({ remoteStatus: "stale" });
    probeMock.mockResolvedValue({ status: "skip" });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("skip");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBe("stale");
  });

  it("проба fresh → fresh, снимает прежнюю пометку", async () => {
    await seed({ remoteStatus: "stale", freshnessToken: '"v1"' });
    probeMock.mockResolvedValue({ status: "fresh" });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("fresh");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBeUndefined();
  });

  it("проба stale(token) → stale + новый freshnessToken", async () => {
    await seed({ freshnessToken: '"v1"' });
    probeMock.mockResolvedValue({ status: "stale", freshnessToken: '"v2"' });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("stale");
    const rec = await getSavedBundle("lectures", "l1");
    expect(rec?.remoteStatus).toBe("stale");
    expect(rec?.freshnessToken).toBe('"v2"');
  });

  it("проба gone → gone, снимок цел", async () => {
    await seed({});
    probeMock.mockResolvedValue({ status: "gone" });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("gone");
    const rec = await getSavedBundle("lectures", "l1");
    expect(rec?.remoteStatus).toBe("gone");
    expect(rec?.snapshot).toBeTruthy();
  });

  it("проба marker + изменённый маркер → stale", async () => {
    await seed({ updatedAt: "2026-06-10T00:00:00Z" });
    probeMock.mockResolvedValue({ status: "marker", marker: "2026-06-12T00:00:00Z" });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("stale");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBe("stale");
  });

  it("проба marker + тот же маркер → fresh, снимает пометку", async () => {
    await seed({ updatedAt: "2026-06-10T00:00:00Z", remoteStatus: "stale" });
    probeMock.mockResolvedValue({ status: "marker", marker: "2026-06-10T00:00:00Z" });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("fresh");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBeUndefined();
  });

  it("CAS: снимок обновлён во время пробы → marker не штампует stale", async () => {
    await seed({ updatedAt: "2026-06-10T00:00:00Z" });
    probeMock.mockImplementation(async () => {
      await putSavedBundle({
        entity: "lectures",
        id: "l1",
        savedAt: "2026-06-12T00:00:00.000Z",
        schemaVersion: OFFLINE_SCHEMA_VERSION,
        status: "complete",
        snapshot: snap("2026-06-12T00:00:00Z"),
        imageKeys: [],
      });
      return { status: "marker", marker: "2026-06-12T00:00:00Z" };
    });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("skip");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBeUndefined();
  });

  it("проба бросает → skip (best-effort, не пробрасывает)", async () => {
    await seed({});
    probeMock.mockRejectedValue(new Error("boom"));
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("skip");
  });

  it("marker, но в снимке нет updated_at → fresh (не штампует ложный stale)", async () => {
    await putSavedBundle({
      entity: "lectures",
      id: "l1",
      savedAt: "2026-06-10T00:00:00.000Z",
      schemaVersion: OFFLINE_SCHEMA_VERSION,
      status: "complete",
      snapshot: { lecture: { id: "l1", title: "t" }, tags: [], documents: [], comments: [] },
      imageKeys: [],
    });
    probeMock.mockResolvedValue({ status: "marker", marker: "2026-06-12T00:00:00Z" });
    expect(await revalidateSavedBundle("lectures", "l1")).toBe("fresh");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBeUndefined();
  });
});
```

- [ ] **Step 4: Запустить тест — убедиться, что падает**

Run: `pnpm vitest run src/app/_offline/revalidate-saved-bundle.test.ts`
Expected: FAIL — `Cannot find module './revalidate-saved-bundle'`.

- [ ] **Step 5: Создать client-safe реестр маркеров**

Создать `src/app/_offline/freshness/snapshot-markers.ts`:

```ts
// src/app/_offline/freshness/snapshot-markers.ts
// client-safe: чистое per-entity извлечение legacy-маркера свежести (updated_at)
// из сохранённого снимка. Нужен оркестратору ревалидации для marker-сравнения
// (бандлы без freshnessToken). Никаких server-only зависимостей — импортируется
// из client-компонентов и client-оркестратора.
import { Tags } from "@/api/tags";

/** Достаёт `snapshot.lecture.updated_at`; null, если формы нет. */
function lectureMarker(snapshot: unknown): string | null {
  if (typeof snapshot !== "object" || snapshot === null) return null;
  const lecture = (snapshot as { lecture?: unknown }).lecture;
  if (typeof lecture !== "object" || lecture === null) return null;
  const updatedAt = (lecture as { updated_at?: unknown }).updated_at;
  return typeof updatedAt === "string" ? updatedAt : null;
}

/** entity → извлекатель маркера. Сущности без legacy-пути сюда не попадают. */
export const SNAPSHOT_MARKERS: Record<string, (snapshot: unknown) => string | null> = {
  [Tags.LECTURES]: lectureMarker,
};
```

- [ ] **Step 6: Создать generic server-action `probe-bundle-action.ts`**

Создать `src/app/_offline/probe-bundle-action.ts`:

```ts
// src/app/_offline/probe-bundle-action.ts
"use server";

import "server-only";

import type { ManifestProbe } from "@/services/offline/contract/descriptor";

import { resolveDescriptor } from "./registry";

/** Унифицированный вердикт свежести для оркестратора. `marker` — legacy-ветка
 *  (сравнение делает клиент по своему снимку). */
export type BundleProbe = ManifestProbe | { status: "marker"; marker: string };

/**
 * Ревалидация: при наличии токена — manifest-проба (If-None-Match); skip/нет токена
 * → legacy-маркер. Резолвит дескриптор на сервере (клиент не импортит server-only
 * дескрипторы). Нет freshness → skip. Best-effort: любая ошибка → skip.
 */
export async function probeBundleFreshness(
  entity: string,
  id: string,
  token: string | undefined,
): Promise<BundleProbe> {
  try {
    const freshness = resolveDescriptor(entity)?.freshness;
    if (!freshness) return { status: "skip" };

    if (token !== undefined) {
      const m = await freshness.probeManifest(id, token);
      if (m.status !== "skip") return m; // fresh | stale | gone
    }

    if (!freshness.probeMarker) return { status: "skip" };
    const mk = await freshness.probeMarker(id);
    if (mk.status === "present") return { status: "marker", marker: mk.marker };
    if (mk.status === "gone") return { status: "gone" };
    return { status: "skip" };
  } catch {
    return { status: "skip" };
  }
}

/**
 * Захват стартового freshnessToken при сохранении: manifest-проба без If-None-Match
 * (200 → stale + токен). Возвращает токен или null. Best-effort, не бросает.
 */
export async function captureFreshnessToken(
  entity: string,
  id: string,
): Promise<string | null> {
  try {
    const freshness = resolveDescriptor(entity)?.freshness;
    if (!freshness) return null;
    const m = await freshness.probeManifest(id, undefined);
    return m.status === "stale" ? m.freshnessToken : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 7: Создать оркестратор `revalidate-saved-bundle.ts`**

Создать `src/app/_offline/revalidate-saved-bundle.ts`:

```ts
// src/app/_offline/revalidate-saved-bundle.ts
"use client";

import {
  getSavedBundle,
  putSavedBundle,
  updateSavedBundle,
} from "@/services/offline/store/saved-bundles";

import { SNAPSHOT_MARKERS } from "./freshness/snapshot-markers";
import { probeBundleFreshness } from "./probe-bundle-action";

export type RevalidateOutcome = "fresh" | "stale" | "gone" | "skip";

/** Снять remoteStatus: re-put записи без поля (update только мёржит; под
 *  exactOptionalPropertyTypes писать `{ remoteStatus: undefined }` нельзя). */
async function clearRemoteStatus(
  rec: NonNullable<Awaited<ReturnType<typeof getSavedBundle>>>,
): Promise<void> {
  if (rec.remoteStatus !== undefined) {
    const cleared = { ...rec };
    delete cleared.remoteStatus;
    await putSavedBundle(cleared);
  }
}

/**
 * Фоновая сверка статуса сохранённой копии (SWR), entity-agnostic. Единый источник
 * истины свежести для страницы сущности и /saved. Копию НИКОГДА не стирает — только
 * проставляет/снимает `remoteStatus`. Best-effort: любая ошибка → "skip". Не бросает.
 */
export async function revalidateSavedBundle(
  entity: string,
  id: string,
): Promise<RevalidateOutcome> {
  try {
    const rec = await getSavedBundle(entity, id);
    if (rec?.status !== "complete") return "skip";

    const probe = await probeBundleFreshness(entity, id, rec.freshnessToken);

    if (probe.status === "fresh") {
      await clearRemoteStatus(rec);
      return "fresh";
    }
    if (probe.status === "stale") {
      await updateSavedBundle(entity, id, {
        remoteStatus: "stale",
        freshnessToken: probe.freshnessToken,
      });
      return "stale";
    }
    if (probe.status === "gone") {
      await updateSavedBundle(entity, id, { remoteStatus: "gone" });
      return "gone";
    }
    if (probe.status === "skip") return "skip";

    // probe.status === "marker": legacy-сравнение по снимку на клиенте.
    const readMarker = SNAPSHOT_MARKERS[entity];
    const savedMarker = readMarker ? readMarker(rec.snapshot) : null;
    if (savedMarker !== null && probe.marker !== savedMarker) {
      // CAS против гонки с ручным «Обновить»: если за время пробы снимок
      // перезаписали свежим — не штампуем ложный stale.
      const current = await getSavedBundle(entity, id);
      const currentMarker =
        readMarker && current ? readMarker(current.snapshot) : null;
      if (currentMarker !== savedMarker) return "skip";
      await updateSavedBundle(entity, id, { remoteStatus: "stale" });
      return "stale";
    }
    await clearRemoteStatus(rec);
    return "fresh";
  } catch {
    return "skip";
  }
}
```

- [ ] **Step 8: Подключить `freshness` в дескриптор лекции**

В [src/app/_offline/descriptors/lecture-descriptor.ts](../../../src/app/_offline/descriptors/lecture-descriptor.ts) добавить импорты под существующие:

```ts
import { probeLectureForOffline } from "../probe-lecture-action";
import { probeLectureManifest } from "../probe-lecture-manifest-action";
```

В объект `lectureDescriptor` добавить поле `freshness` (после `extractImageKeys`):

```ts
  freshness: {
    probeManifest: (id, token) => probeLectureManifest(id, token),
    probeMarker: async (id) => {
      const res = await probeLectureForOffline({ id });
      if (!res.success) return { status: "skip" };
      return res.data.status === "gone"
        ? { status: "gone" }
        : { status: "present", marker: res.data.updatedAt };
    },
  },
```

- [ ] **Step 9: Запустить тест оркестратора — убедиться, что проходит**

Run: `pnpm vitest run src/app/_offline/revalidate-saved-bundle.test.ts`
Expected: PASS (11 тестов).

- [ ] **Step 10: Прогнать typecheck/lint по затронутым файлам**

Run: `pnpm lint`
Expected: без ошибок (особенно проверить `descriptor.ts`, `probe-bundle-action.ts`, `revalidate-saved-bundle.ts`).

- [ ] **Step 11: Commit**

```bash
git add src/services/offline/contract/descriptor.ts \
  src/app/_offline/probe-lecture-manifest-action.ts \
  src/app/_offline/probe-bundle-action.ts \
  src/app/_offline/freshness/snapshot-markers.ts \
  src/app/_offline/revalidate-saved-bundle.ts \
  src/app/_offline/revalidate-saved-bundle.test.ts \
  src/app/_offline/descriptors/lecture-descriptor.ts
git commit -m "$(cat <<'EOF'
feat(offline): generic entity-agnostic freshness revalidation

revalidateSavedBundle(entity,id) + probe-bundle-action + descriptor.freshness;
свежесть вынесена в шов дескриптора, единый источник истины для всех сущностей.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1b: Unit tests for probe-bundle-action

`probe-bundle-action.ts` (Task 1) — самый логически плотный новый модуль (manifest-preferred → fallback на marker; `captureFreshnessToken`), а тест оркестратора (Task 1) мокает его целиком, поэтому его внутренняя логика без этого таска нигде не покрыта. Тесты характеризационные: модуль уже создан в Task 1, тут фиксируем его ветвление, мокая `./registry`.

**Files:**
- Test: `src/app/_offline/probe-bundle-action.test.ts`

**Interfaces:**
- Consumes: `probeBundleFreshness`, `captureFreshnessToken` (Task 1); `resolveDescriptor` (мокается).

- [ ] **Step 1: Написать тест**

Создать `src/app/_offline/probe-bundle-action.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const resolveDescriptor = vi.hoisted(() => vi.fn());
vi.mock("./registry", () => ({ resolveDescriptor }));

import { captureFreshnessToken, probeBundleFreshness } from "./probe-bundle-action";

const probeManifest = vi.fn();
const probeMarker = vi.fn();

beforeEach(() => {
  resolveDescriptor.mockReset();
  probeManifest.mockReset();
  probeMarker.mockReset();
  resolveDescriptor.mockReturnValue({ freshness: { probeManifest, probeMarker } });
});

describe("probeBundleFreshness", () => {
  it("нет дескриптора → skip", async () => {
    resolveDescriptor.mockReturnValue(undefined);
    expect(await probeBundleFreshness("x", "1", undefined)).toEqual({ status: "skip" });
  });

  it("нет freshness → skip", async () => {
    resolveDescriptor.mockReturnValue({});
    expect(await probeBundleFreshness("x", "1", undefined)).toEqual({ status: "skip" });
  });

  it("token + manifest != skip → результат manifest, probeMarker НЕ зовётся", async () => {
    probeManifest.mockResolvedValue({ status: "stale", freshnessToken: '"v2"' });
    expect(await probeBundleFreshness("lectures", "l1", '"v1"')).toEqual({
      status: "stale",
      freshnessToken: '"v2"',
    });
    expect(probeManifest).toHaveBeenCalledWith("l1", '"v1"');
    expect(probeMarker).not.toHaveBeenCalled();
  });

  it("token + manifest skip → fallback на probeMarker", async () => {
    probeManifest.mockResolvedValue({ status: "skip" });
    probeMarker.mockResolvedValue({ status: "present", marker: "2026-06-12" });
    expect(await probeBundleFreshness("lectures", "l1", '"v1"')).toEqual({
      status: "marker",
      marker: "2026-06-12",
    });
  });

  it("без token → manifest НЕ зовётся, сразу probeMarker", async () => {
    probeMarker.mockResolvedValue({ status: "present", marker: "2026-06-12" });
    expect(await probeBundleFreshness("lectures", "l1", undefined)).toEqual({
      status: "marker",
      marker: "2026-06-12",
    });
    expect(probeManifest).not.toHaveBeenCalled();
  });

  it("probeMarker gone → gone", async () => {
    probeMarker.mockResolvedValue({ status: "gone" });
    expect(await probeBundleFreshness("lectures", "l1", undefined)).toEqual({ status: "gone" });
  });

  it("нет probeMarker + manifest skip → skip", async () => {
    resolveDescriptor.mockReturnValue({ freshness: { probeManifest } });
    probeManifest.mockResolvedValue({ status: "skip" });
    expect(await probeBundleFreshness("lectures", "l1", '"v1"')).toEqual({ status: "skip" });
  });

  it("probeManifest бросает → skip (best-effort)", async () => {
    probeManifest.mockRejectedValue(new Error("x"));
    expect(await probeBundleFreshness("lectures", "l1", '"v1"')).toEqual({ status: "skip" });
  });
});

describe("captureFreshnessToken", () => {
  it("manifest stale → токен", async () => {
    probeManifest.mockResolvedValue({ status: "stale", freshnessToken: '"v1"' });
    expect(await captureFreshnessToken("lectures", "l1")).toBe('"v1"');
  });

  it("manifest fresh → null", async () => {
    probeManifest.mockResolvedValue({ status: "fresh" });
    expect(await captureFreshnessToken("lectures", "l1")).toBeNull();
  });

  it("нет freshness → null", async () => {
    resolveDescriptor.mockReturnValue({});
    expect(await captureFreshnessToken("lectures", "l1")).toBeNull();
  });

  it("бросает → null", async () => {
    probeManifest.mockRejectedValue(new Error("x"));
    expect(await captureFreshnessToken("lectures", "l1")).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить тест — PASS (модуль уже есть из Task 1)**

Run: `pnpm vitest run src/app/_offline/probe-bundle-action.test.ts`
Expected: PASS (12 тестов). Если какой-то падает — баг в `probe-bundle-action.ts` из Task 1, чинить там.

- [ ] **Step 3: Commit**

```bash
git add src/app/_offline/probe-bundle-action.test.ts
git commit -m "$(cat <<'EOF'
test(offline): unit tests for probe-bundle-action (manifest-preferred + capture)

Покрывает ветвление, которое тест оркестратора мокает целиком.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Migrate `/saved` to `revalidateSavedBundle`, remove lecture-specific revalidate

`/saved` переводится на обобщённую функцию; старый `revalidateSavedLecture` и его тест удаляются (единый источник истины).

**Files:**
- Modify: `src/app/saved/saved-lecture-view.tsx:7,91`
- Modify: `src/app/saved/saved-lecture-view.test.tsx:44-47`
- Delete: `src/app/_offline/revalidate-saved-lecture.ts`
- Delete: `src/app/_offline/revalidate-saved-lecture.test.ts`

**Interfaces:**
- Consumes: `revalidateSavedBundle` (Task 1).

- [ ] **Step 1: Обновить мок в тесте `/saved`**

В [src/app/saved/saved-lecture-view.test.tsx](../../../src/app/saved/saved-lecture-view.test.tsx) заменить блок мока (строки 44–47):

```ts
const revalidateMock = vi.hoisted(() => vi.fn());
vi.mock("@/app/_offline/revalidate-saved-bundle", () => ({
  revalidateSavedBundle: revalidateMock,
}));
```

(имя переменной `revalidateMock` и `.mockReset().mockResolvedValue("skip")` в `beforeEach` не меняются — меняется только путь модуля и имя экспортируемой функции.)

- [ ] **Step 2: Перевести view на новую функцию**

В [src/app/saved/saved-lecture-view.tsx](../../../src/app/saved/saved-lecture-view.tsx):

Заменить импорт (строка 7):

```ts
import { revalidateSavedBundle } from "@/app/_offline/revalidate-saved-bundle";
```

Заменить вызов (строка 91):

```ts
        const outcome = await revalidateSavedBundle("lectures", id);
```

- [ ] **Step 3: Удалить старый оркестратор и его тест**

```bash
git rm src/app/_offline/revalidate-saved-lecture.ts \
  src/app/_offline/revalidate-saved-lecture.test.ts
```

- [ ] **Step 4: Запустить тесты `/saved` и убедиться в зелёном**

Run: `pnpm vitest run src/app/saved/saved-lecture-view.test.tsx`
Expected: PASS (все существующие кейсы).

- [ ] **Step 5: Проверить отсутствие висячих импортов**

Run: `pnpm exec tsc --noEmit` (или `pnpm lint`)
Expected: нет ошибок «cannot find module './revalidate-saved-lecture'» нигде в репозитории.

- [ ] **Step 6: Commit**

```bash
git add src/app/saved/saved-lecture-view.tsx \
  src/app/saved/saved-lecture-view.test.tsx \
  src/app/_offline/revalidate-saved-lecture.ts \
  src/app/_offline/revalidate-saved-lecture.test.ts
git commit -m "$(cat <<'EOF'
refactor(offline): /saved uses revalidateSavedBundle, drop lecture-specific revalidate

Единый источник истины свежести; revalidateSavedLecture удалён (покрытие
перенесено в revalidate-saved-bundle.test.ts).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Generalize save-offline freshnessToken capture

Убрать lecture-захардкоженный захват токена в `saveOffline`, заменить на generic `captureFreshnessToken`.

**Files:**
- Modify: `src/app/_offline/save-offline.ts:13,106-117` (lecture-gated `if`-блок начинается на 106; 103-105 — комментарий)
- Modify: `src/app/_offline/save-offline.test.ts`

**Interfaces:**
- Consumes: `captureFreshnessToken` (Task 1).

- [ ] **Step 1: Замокать `captureFreshnessToken` в тесте save-offline**

В [src/app/_offline/save-offline.test.ts](../../../src/app/_offline/save-offline.test.ts) добавить мок рядом с прочими `vi.mock` (до `import { saveOffline }`):

```ts
vi.mock("./probe-bundle-action", () => ({
  captureFreshnessToken: vi.fn().mockResolvedValue(null),
}));
```

(Существующие кейсы не проверяют токен — мок лишь делает тест герметичным, без реального сетевого вызова.)

- [ ] **Step 2: Запустить тест — убедиться, что всё ещё зелёный (до правки модуля)**

Run: `pnpm vitest run src/app/_offline/save-offline.test.ts`
Expected: PASS (мок добавлен, модуль ещё импортит старое — но мок пути `./probe-bundle-action` пока не используется модулем; тест зелёный).

- [ ] **Step 3: Заменить захват токена в `save-offline.ts`**

В [src/app/_offline/save-offline.ts](../../../src/app/_offline/save-offline.ts) заменить импорт (строка 13):

```ts
import { captureFreshnessToken } from "./probe-bundle-action";
```

Заменить блок захвата токена (строки 103–117) на:

```ts
    // Best-effort захват freshnessToken для последующего If-None-Match
    // (304-fast-path). Generic: токен резолвится через freshness-capability
    // дескриптора. Бандл уже сохранён — ошибка/null здесь НЕ ломают результат.
    const token = await captureFreshnessToken(entity, id);
    if (token !== null) {
      await updateSavedBundle(entity, id, { freshnessToken: token });
    }
```

- [ ] **Step 4: Запустить тест save-offline — зелёный**

Run: `pnpm vitest run src/app/_offline/save-offline.test.ts`
Expected: PASS (все существующие кейсы; `captureFreshnessToken` замокан в null).

- [ ] **Step 5: Commit**

```bash
git add src/app/_offline/save-offline.ts src/app/_offline/save-offline.test.ts
git commit -m "$(cat <<'EOF'
refactor(offline): generic freshnessToken capture on save (drop lecture special-case)

saveOffline использует captureFreshnessToken(entity,id) вместо
entity==="lectures" + probeLectureManifest.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: i18n keys for new button states

Новые ключи в namespace `pages` (ru + en). Должны идти парами, иначе падает `icu-parity.test.ts`/`messages.test.ts`.

**Files:**
- Modify: `src/i18n/messages/ru/pages.ts` (блок `_offline/save-offline-button`)
- Modify: `src/i18n/messages/en/pages.ts` (тот же блок)

- [ ] **Step 1: Добавить ключи в ru/pages.ts**

В [src/i18n/messages/ru/pages.ts](../../../src/i18n/messages/ru/pages.ts), в блок `// ─── _offline/save-offline-button ───`, после `saveOfflineFailTitle`:

```ts
  saveOfflineUpdateAvailable: "Доступно обновление",
  saveOfflineUpdate: "Обновить",
  saveOfflineUpdating: "Обновление…",
  saveOfflineRemove: "Удалить копию",
  saveOfflineRemoving: "Удаление…",
  saveOfflineRemoveConfirmTitle: "Удалить офлайн-копию?",
  saveOfflineRemoveConfirmBody:
    "Копия будет удалена с устройства. Восстановить её можно только онлайн — сохранив лекцию заново.",
  saveOfflineRemoveConfirmAction: "Удалить",
  saveOfflineRemovedToast: "Офлайн-копия удалена",
```

- [ ] **Step 2: Добавить те же ключи в en/pages.ts**

В [src/i18n/messages/en/pages.ts](../../../src/i18n/messages/en/pages.ts), в тот же блок, после `saveOfflineFailTitle`:

```ts
  saveOfflineUpdateAvailable: "Update available",
  saveOfflineUpdate: "Update",
  saveOfflineUpdating: "Updating…",
  saveOfflineRemove: "Remove copy",
  saveOfflineRemoving: "Removing…",
  saveOfflineRemoveConfirmTitle: "Remove offline copy?",
  saveOfflineRemoveConfirmBody:
    "The copy will be deleted from this device. You can restore it only online by saving the lecture again.",
  saveOfflineRemoveConfirmAction: "Remove",
  saveOfflineRemovedToast: "Offline copy removed",
```

- [ ] **Step 3: Прогнать i18n-тесты**

Run: `pnpm vitest run src/i18n/messages/icu-parity.test.ts src/i18n/messages/messages.test.ts`
Expected: PASS (ключи ru/en в паритете, плейсхолдеров нет).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/messages/ru/pages.ts src/i18n/messages/en/pages.ts
git commit -m "$(cat <<'EOF'
feat(i18n): keys for stateful save-offline button (update/remove/confirm)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Stateful entity-agnostic button

Полный rewrite `SaveOfflineButton` в state-machine: читает состояние из IDB на маунте, прогоняет ревалидацию, рендерит save/saved/stale + обновление + удаление с confirm.

**Files:**
- Modify: `src/app/_offline/save-offline-button.tsx` (полная замена)
- Modify: `src/app/_offline/save-offline-button.test.tsx` (полная замена)

**Interfaces:**
- Consumes: `getSavedBundle`, `deleteSavedBundle` ([src/services/offline/store/saved-bundles.ts](../../../src/services/offline/store/saved-bundles.ts)); `whenIdentityReconciled` ([src/services/offline/identity-gate.ts](../../../src/services/offline/identity-gate.ts)); `revalidateSavedBundle` (Task 1); `saveOffline` ([src/app/_offline/save-offline.ts](../../../src/app/_offline/save-offline.ts)); `Button`, `ConfirmDialog`, `useToast` (`@/components/ui`); ключи из Task 4.

- [ ] **Step 1: Написать падающий тест кнопки**

Полностью заменить `src/app/_offline/save-offline-button.test.tsx`:

```tsx
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, it, expect, vi } from "vitest";

import { OFFLINE_SCHEMA_VERSION } from "@/services/offline/contract/storage";

const saveOffline = vi.hoisted(() => vi.fn());
const revalidate = vi.hoisted(() => vi.fn());
const getSavedBundle = vi.hoisted(() => vi.fn());
const deleteSavedBundle = vi.hoisted(() => vi.fn());
const toastAdd = vi.hoisted(() => vi.fn());

vi.mock("./save-offline", () => ({ saveOffline }));
vi.mock("./revalidate-saved-bundle", () => ({ revalidateSavedBundle: revalidate }));
vi.mock("@/services/offline/store/saved-bundles", () => ({
  getSavedBundle,
  deleteSavedBundle,
}));
vi.mock("@/services/offline/identity-gate", () => ({
  whenIdentityReconciled: () => Promise.resolve(),
}));
vi.mock("@/components/ui", () => ({
  Button: (props: Record<string, unknown>) => <button {...props} />,
  useToast: () => ({ add: toastAdd }),
  ConfirmDialog: ({
    trigger,
    onConfirm,
  }: {
    trigger: ReactNode;
    onConfirm: () => void | Promise<void>;
  }) => (
    <>
      {trigger}
      <button data-testid="confirm-remove" onClick={() => void onConfirm()}>
        confirm
      </button>
    </>
  ),
}));
vi.mock("@/i18n/client", async () => {
  const { default: pages } = await import("@/i18n/messages/ru/pages");
  return {
    useT: (ns: string) => {
      const catalog = ns === "pages" ? pages : {};
      return (key: string, params?: Record<string, unknown>) => {
        const parts = key.split(".");
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = catalog;
        for (const part of parts) val = val?.[part];
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        if (typeof val !== "string") return key;
        if (!params) return val;
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        return val.replace(/\{(\w+)\}/g, (_: string, k: string) => String(params[k] ?? k));
      };
    },
  };
});

import { SaveOfflineButton } from "./save-offline-button";

const complete = (over: Record<string, unknown> = {}) => ({
  entity: "lectures",
  id: "l1",
  key: "lectures:l1",
  savedAt: "2026-06-10T00:00:00.000Z",
  schemaVersion: OFFLINE_SCHEMA_VERSION,
  status: "complete",
  snapshot: {},
  imageKeys: [],
  ...over,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});

describe("SaveOfflineButton", () => {
  it("нет копии → «Сохранить офлайн», ревалидация не зовётся", async () => {
    getSavedBundle.mockResolvedValue(undefined);
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    await waitFor(() => expect(screen.getByText("Сохранить офлайн")).toBeTruthy());
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("есть свежая копия → бейдж «Сохранено» + «Удалить копию»", async () => {
    getSavedBundle.mockResolvedValue(complete());
    revalidate.mockResolvedValue("fresh");
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    await waitFor(() => expect(screen.getByText(/Сохранено офлайн/)).toBeTruthy());
    expect(screen.getByText("Удалить копию")).toBeTruthy();
  });

  it("ревалидация → stale: «Доступно обновление» + «Обновить»", async () => {
    getSavedBundle
      .mockResolvedValueOnce(complete())
      .mockResolvedValueOnce(complete({ remoteStatus: "stale" }));
    revalidate.mockResolvedValue("stale");
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    await waitFor(() => expect(screen.getByText("Доступно обновление")).toBeTruthy());
    expect(screen.getByText("Обновить")).toBeTruthy();
  });

  it("клик «Сохранить офлайн» → saveOffline, затем бейдж", async () => {
    getSavedBundle.mockResolvedValue(undefined);
    saveOffline.mockResolvedValue({ ok: true });
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    await waitFor(() => expect(screen.getByText("Сохранить офлайн")).toBeTruthy());
    fireEvent.click(screen.getByText("Сохранить офлайн"));
    await waitFor(() => expect(screen.getByText(/Сохранено офлайн/)).toBeTruthy());
    expect(saveOffline).toHaveBeenCalledWith("lectures", "l1");
  });

  it("клик «Обновить» → saveOffline, затем свежий бейдж", async () => {
    getSavedBundle
      .mockResolvedValueOnce(complete())
      .mockResolvedValueOnce(complete({ remoteStatus: "stale" }));
    revalidate.mockResolvedValue("stale");
    saveOffline.mockResolvedValue({ ok: true });
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    await waitFor(() => expect(screen.getByText("Обновить")).toBeTruthy());
    fireEvent.click(screen.getByText("Обновить"));
    await waitFor(() => expect(screen.getByText(/Сохранено офлайн/)).toBeTruthy());
    expect(saveOffline).toHaveBeenCalledWith("lectures", "l1");
  });

  it("удаление → deleteSavedBundle, возврат к «Сохранить офлайн»", async () => {
    getSavedBundle.mockResolvedValue(complete());
    revalidate.mockResolvedValue("fresh");
    deleteSavedBundle.mockResolvedValue(undefined);
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    await waitFor(() => expect(screen.getByText("Удалить копию")).toBeTruthy());
    fireEvent.click(screen.getByTestId("confirm-remove"));
    await waitFor(() => expect(screen.getByText("Сохранить офлайн")).toBeTruthy());
    expect(deleteSavedBundle).toHaveBeenCalledWith("lectures", "l1");
  });

  it("оффлайн → ревалидация не зовётся, показывает последний статус", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    getSavedBundle.mockResolvedValue(complete({ remoteStatus: "stale" }));
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    await waitFor(() => expect(screen.getByText("Доступно обновление")).toBeTruthy());
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("ошибка сохранения → тост, кнопка снова «Сохранить офлайн»", async () => {
    getSavedBundle.mockResolvedValue(undefined);
    saveOffline.mockResolvedValue({ ok: false, error: "нет сети" });
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    await waitFor(() => expect(screen.getByText("Сохранить офлайн")).toBeTruthy());
    fireEvent.click(screen.getByText("Сохранить офлайн"));
    await waitFor(() => expect(toastAdd).toHaveBeenCalled());
    expect(screen.getByText("Сохранить офлайн")).toBeTruthy();
  });

  it("ревалидация → gone: бейдж «Сохранено» (копия цела), не падает", async () => {
    getSavedBundle
      .mockResolvedValueOnce(complete())
      .mockResolvedValueOnce(complete({ remoteStatus: "gone" }));
    revalidate.mockResolvedValue("gone");
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    await waitFor(() => expect(screen.getByText(/Сохранено офлайн/)).toBeTruthy());
    expect(screen.getByText("Удалить копию")).toBeTruthy();
  });

  it("сбой «Обновить» → откат в stale, кнопка «Обновить» остаётся", async () => {
    getSavedBundle
      .mockResolvedValueOnce(complete())
      .mockResolvedValueOnce(complete({ remoteStatus: "stale" }));
    revalidate.mockResolvedValue("stale");
    saveOffline.mockResolvedValue({ ok: false, error: "нет сети" });
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    await waitFor(() => expect(screen.getByText("Обновить")).toBeTruthy());
    fireEvent.click(screen.getByText("Обновить"));
    await waitFor(() => expect(toastAdd).toHaveBeenCalled());
    expect(screen.getByText("Обновить")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm vitest run src/app/_offline/save-offline-button.test.tsx`
Expected: FAIL (старая реализация не читает IDB / нет «Удалить копию» / нет revalidate).

- [ ] **Step 3: Переписать компонент**

Полностью заменить `src/app/_offline/save-offline-button.tsx`:

```tsx
// src/app/_offline/save-offline-button.tsx
"use client";

import { useEffect, useState } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { whenIdentityReconciled } from "@/services/offline/identity-gate";
import {
  deleteSavedBundle,
  getSavedBundle,
} from "@/services/offline/store/saved-bundles";

import { revalidateSavedBundle } from "./revalidate-saved-bundle";
import { saveOffline } from "./save-offline";

type ViewState =
  | { kind: "unknown" }
  | { kind: "not-saved" }
  | { kind: "saving" }
  | { kind: "saved"; stale: boolean }
  | { kind: "updating" }
  | { kind: "removing" };

/** Generic stateful-кнопка офлайн-сохранения для любой сущности из OFFLINE_REGISTRY. */
export function SaveOfflineButton({
  entity,
  id,
}: {
  entity: string;
  id: string;
}) {
  const [state, setState] = useState<ViewState>({ kind: "unknown" });
  const toast = useToast();
  const t = useT("pages");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Не показываем чужое сохранённое состояние до сверки личности.
      await whenIdentityReconciled();
      if (cancelled) return;
      const rec = await getSavedBundle(entity, id);
      if (cancelled) return;
      if (rec?.status !== "complete") {
        setState({ kind: "not-saved" });
        return;
      }
      setState({ kind: "saved", stale: rec.remoteStatus === "stale" });
      // Фоновая сверка свежести (SWR); офлайн — пропускаем (best-effort).
      if (navigator.onLine) {
        const outcome = await revalidateSavedBundle(entity, id);
        if (cancelled) return;
        if (outcome !== "skip") {
          const refreshed = await getSavedBundle(entity, id);
          if (cancelled) return;
          setState(
            refreshed?.status === "complete"
              ? { kind: "saved", stale: refreshed.remoteStatus === "stale" }
              : { kind: "not-saved" },
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entity, id]);

  // saving — из not-saved; updating — из saved-stale («Обновить»).
  const doSave = (transient: "saving" | "updating"): void => {
    setState({ kind: transient });
    void saveOffline(entity, id).then((result) => {
      if (result.ok) {
        setState({ kind: "saved", stale: false });
        toast.add({
          title: t("saveOfflineSuccessTitle"),
          description: result.warning,
        });
      } else {
        // Откат: из save → not-saved; из update → копия осталась устаревшей.
        setState(
          transient === "saving"
            ? { kind: "not-saved" }
            : { kind: "saved", stale: true },
        );
        toast.add({
          title: t("saveOfflineFailTitle"),
          description: result.error,
        });
      }
    });
  };

  const doRemove = async (): Promise<void> => {
    setState({ kind: "removing" });
    await deleteSavedBundle(entity, id);
    setState({ kind: "not-saved" });
    toast.add({ title: t("saveOfflineRemovedToast") });
  };

  const removeButton = (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="ghost">
          {t("saveOfflineRemove")}
        </Button>
      }
      title={t("saveOfflineRemoveConfirmTitle")}
      description={t("saveOfflineRemoveConfirmBody")}
      confirmLabel={t("saveOfflineRemoveConfirmAction")}
      destructive
      onConfirm={doRemove}
    />
  );

  if (state.kind === "unknown") {
    return (
      <Button type="button" variant="secondary" disabled>
        {t("saveOfflineButton")}
      </Button>
    );
  }
  if (state.kind === "not-saved") {
    return (
      <Button type="button" variant="secondary" onClick={() => doSave("saving")}>
        {t("saveOfflineButton")}
      </Button>
    );
  }
  if (state.kind === "saving") {
    return (
      <Button type="button" variant="secondary" disabled>
        {t("saveOfflineSaving")}
      </Button>
    );
  }
  if (state.kind === "updating") {
    return (
      <Button type="button" variant="secondary" disabled>
        {t("saveOfflineUpdating")}
      </Button>
    );
  }
  if (state.kind === "removing") {
    return (
      <Button type="button" variant="ghost" disabled>
        {t("saveOfflineRemoving")}
      </Button>
    );
  }
  // state.kind === "saved"
  return (
    <div className="flex items-center gap-3">
      {state.stale ? (
        <>
          <span className="text-sm text-(--color-fg-muted)">
            {t("saveOfflineUpdateAvailable")}
          </span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => doSave("updating")}
          >
            {t("saveOfflineUpdate")}
          </Button>
        </>
      ) : (
        <span className="text-sm text-(--color-fg-muted)">
          {t("savedLectureSavedBadge")}
        </span>
      )}
      {removeButton}
    </div>
  );
}
```

- [ ] **Step 4: Запустить тест кнопки — убедиться, что проходит**

Run: `pnpm vitest run src/app/_offline/save-offline-button.test.tsx`
Expected: PASS (8 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/app/_offline/save-offline-button.tsx \
  src/app/_offline/save-offline-button.test.tsx
git commit -m "$(cat <<'EOF'
feat(offline): stateful save-offline button (saved/update/remove)

Кнопка читает состояние копии из IDB на маунте, прогоняет revalidateSavedBundle,
рендерит not-saved/saved/stale + обновление + удаление с confirm. Entity-agnostic.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Full verification

- [ ] **Step 1: Полный lint**

Run: `pnpm lint`
Expected: 0 ошибок.

- [ ] **Step 2: Полный тест-ран**

Run: `pnpm test`
Expected: все сьюты зелёные (новые + затронутые: revalidate-saved-bundle, save-offline, save-offline-button, saved-lecture-view, icu-parity, messages).

- [ ] **Step 3: Сборка**

Run: `pnpm build`
Expected: успешная сборка без ошибок типов.

- [ ] **Step 4 (manual, опц.): дымовая проверка**

Запустить локальный стек (бэк :8090, фронт :3001), открыть лекцию: убедиться, что кнопка показывает «Сохранить офлайн» → после сохранения «Сохранено офлайн ✓» + «Удалить копию»; изменить лекцию на бэке → перезагрузить страницу → «Доступно обновление» + «Обновить»; «Обновить» возвращает к бейджу; «Удалить копию» (с подтверждением) → «Сохранить офлайн».

---

## Follow-up (вне объёма этого плана)

- **De-action lecture-проб.** После рефактора `probe-lecture-manifest-action.ts` и
  `probe-lecture-action.ts` вызываются только server→server (из дескриптора внутри
  `probeBundleFreshness`), а не как RPC с клиента. Можно конвертировать их из
  `"use server"` в обычные `server-only`-функции (и снять суффикс `-action`), убрав
  мёртвую Server-Action-поверхность из бандл-манифеста. Не блокер: оставлять `"use server"`
  корректно (вызов в процессе — обычная функция). Отдельным мелким PR.
- **MINOR (принято как косметика):** при удалении `doRemove` синхронно переключает кнопку
  в `removing`, из-за чего `ConfirmDialog` размонтируется до своего `setOpen(false)`. В
  React 18/19 это без варнинга; теряется лишь анимация закрытия/возврат фокуса. Если
  захочется идеально — отдать индикацию удаления собственному `pending` диалога вместо
  отдельного `removing`.

## Self-Review

**1. Spec coverage:**
- Состояния `not-saved/saved-fresh/saved-stale` + transient → Task 5 (state-machine). ✓
- `gone` не обрабатываем на странице → Task 5 (нет ветки gone; revalidate→gone приведёт к re-read записи с `remoteStatus:"gone"`, которая в кнопке трактуется как `saved`+`stale:false` = бейдж «Сохранено», копия цела — соответствует §«Краевые случаи»). ✓
- Один источник истины свежести (revalidate, manifest-preferred) → Task 1 + Task 2. ✓
- Entity-agnostic + обобщение свежести сейчас → Task 1 (descriptor.freshness, generic actions, markers). ✓
- Пропы кнопки `{entity,id}`, страница лекции не меняется → подтверждено (page.tsx не в файловой карте). ✓
- Удаление через `deleteSavedBundle` + confirm → Task 5 (ConfirmDialog). ✓
- Оффлайн-скип ревалидации, гидратация `unknown`, best-effort → Task 5. ✓
- Захват токена generic (без `entity==="lectures"`) → Task 3. ✓
- i18n ru+en → Task 4. ✓
- Тесты (button, revalidate-saved-bundle, /saved, save-offline) → Tasks 1,2,3,5. ✓
- Foundation-touch только контракт дескриптора → Task 1, отмечено в Global Constraints. ✓

**2. Placeholder scan:** Код приведён целиком в каждом шаге; «TBD/TODO/handle edge cases» отсутствуют. ✓

**3. Type consistency:**
- `ManifestProbe`/`MarkerProbe` определены в контракте (Task 1 Step 1), импортируются в `probe-lecture-manifest-action.ts` (Step 2), `probe-bundle-action.ts` (Step 6) и используются дескриптором (Step 8). ✓
- `BundleProbe` (Task 1 Step 6) — то, что разбирает `revalidateSavedBundle` (Step 7): ветки `fresh/stale/gone/skip/marker` покрыты. ✓
- `revalidateSavedBundle(entity, id)` — сигнатура совпадает в Task 1 (производит), Task 2 (`/saved`), Task 5 (кнопка). ✓
- `captureFreshnessToken(entity, id): Promise<string|null>` — Task 1 (производит), Task 3 (`save-offline` проверяет `!== null`). ✓
- `SNAPSHOT_MARKERS[entity]` — ключ `Tags.LECTURES` (=== "lectures"), оркестратор передаёт `entity` строкой. ✓
- `ViewState` (Task 5) — `unknown/not-saved/saving/saved/updating/removing`; рендер покрывает все ветки, `saved` — последняя. ✓

Замечаний нет.
