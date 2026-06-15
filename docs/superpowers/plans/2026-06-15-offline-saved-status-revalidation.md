# Offline Saved-Status Revalidation (SWR) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** При открытии сохранённой офлайн-лекции показывать копию мгновенно и в фоне сверять её статус с платформой (stale-while-revalidate, ленивый вариант), помечая «устарела»/«удалена», но НИКОГДА не стирая копию.

**Architecture:** Лёгкий server-action probe тянет только лекцию (`getLectureById`) → клиентский оркестратор `revalidateSavedLecture` сравнивает `updated_at` и проставляет служебную пометку `remoteStatus` в `SavedBundleRecord` → `SavedLectureView` запускает сверку в фоне после показа снимка и рендерит неразрушающую плашку. Без `If-None-Match`/304 (ETag для лекций не выкачен; `lecture.Lecture` имеет только `updated_at`, без `version`).

**Tech Stack:** Next.js (App Router, server actions), TypeScript, IndexedDB (idb), Vitest + @testing-library/react + fake-indexeddb.

**Spec:** [docs/superpowers/specs/2026-06-15-offline-saved-status-revalidation-design.md](../specs/2026-06-15-offline-saved-status-revalidation-design.md)

**Git-политика (важно):** в репозитории параллельно работают другие агенты (в т.ч. волна 2 optlock в `src/features/{annotations,events,banners}`). В каждом коммите делать `git add` ТОЛЬКО перечисленных файлов по имени — НИКОГДА `git add -A`/`git add .`. Не делать `git stash`/`reset`/`checkout .`/`clean`. Коммитить только с согласия пользователя (решается на этапе execution).

---

### Task 1: Поле `remoteStatus` в `SavedBundleRecord`

**Files:**
- Modify: `src/services/offline/contract/storage.ts:54` (после `error?: string;`)

- [ ] **Step 1: Добавить опциональное поле в интерфейс**

В `src/services/offline/contract/storage.ts`, в интерфейсе `SavedBundleRecord`, сразу после строки `error?: string;` вставить:

```ts
  /**
   * Результат последней фоновой сверки с платформой (SWR-ревалидация): помечает
   * изменённый/удалённый на платформе снимок. Отсутствует = свежо или ещё не
   * сверяли. Снимок при этом НЕ стирается — пометка чисто информационная.
   */
  remoteStatus?: "stale" | "gone";
```

(`SavedBundlePatch = Partial<Omit<SavedBundleRecord, "key" | "entity" | "id">>` подхватит поле автоматически — отдельная правка не нужна. Бамп `OFFLINE_SCHEMA_VERSION` НЕ требуется: добавление опционального служебного поля обратносовместимо.)

- [ ] **Step 2: Проверить, что typecheck зелёный**

Run: `pnpm typecheck`
Expected: PASS (0 ошибок; новое поле опционально, ничего не ломает).

- [ ] **Step 3: Commit**

```bash
git add src/services/offline/contract/storage.ts
git commit -m "feat(offline): remoteStatus field on SavedBundleRecord for SWR"
```

---

### Task 2: Probe server-action `probeLectureForOffline`

Лёгкая сверка статуса лекции: тянет ТОЛЬКО лекцию (без tags/documents/комментов/картинок), в отличие от тяжёлого `assembleOfflineBundle`.

**Files:**
- Create: `src/app/_offline/probe-lecture-action.ts`
- Test: `src/app/_offline/probe-lecture-action.test.ts`

- [ ] **Step 1: Написать падающий тест**

Create `src/app/_offline/probe-lecture-action.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

// vi.hoisted: фабрика vi.mock хойстится выше const'ов.
const getLectureByIdMock = vi.hoisted(() => vi.fn());
vi.mock("@/features/lectures", () => ({ getLectureById: getLectureByIdMock }));

import { probeLectureForOffline } from "./probe-lecture-action";

beforeEach(() => {
  getLectureByIdMock.mockReset();
});

describe("probeLectureForOffline", () => {
  it("лекция есть → success, data: present + updatedAt", async () => {
    getLectureByIdMock.mockResolvedValue({
      id: "l1",
      updated_at: "2026-06-10T00:00:00Z",
    });
    const res = await probeLectureForOffline({ id: "l1" });
    expect(res).toEqual({
      success: true,
      data: { status: "present", updatedAt: "2026-06-10T00:00:00Z" },
    });
  });

  it("404 (getLectureById → null) → success, data: gone", async () => {
    getLectureByIdMock.mockResolvedValue(null);
    const res = await probeLectureForOffline({ id: "l1" });
    expect(res).toEqual({ success: true, data: { status: "gone" } });
  });

  it("сетевой/5xx сбой (throw) → success: false", async () => {
    getLectureByIdMock.mockRejectedValue(new Error("network down"));
    const res = await probeLectureForOffline({ id: "l1" });
    expect(res.success).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm test src/app/_offline/probe-lecture-action.test.ts`
Expected: FAIL — `Failed to resolve import "./probe-lecture-action"` (файла ещё нет).

- [ ] **Step 3: Реализовать probe-action**

Create `src/app/_offline/probe-lecture-action.ts`:

```ts
// src/app/_offline/probe-lecture-action.ts
"use server";

import "server-only";

import { getLectureById } from "@/features/lectures";
import { createAction } from "@/utils/create-action";

/** Лёгкая сверка статуса лекции для офлайн-ревалидации. */
export type LectureProbe =
  | { status: "present"; updatedAt: string }
  | { status: "gone" };

/**
 * server-only: тянет ТОЛЬКО лекцию (не полный снимок). RBAC/доступ — внутри
 * `getLectureById` (тот же путь, что и `assembleOfflineBundle` при сохранении,
 * значит токен/доступ обрабатываются одинаково).
 *
 * - лекция → `{ status: "present", updatedAt }`
 * - 404 → `getLectureById` вернёт `null` → `{ status: "gone" }`
 * - сетевой/5xx сбой → бросок → `createAction` вернёт `{ success: false }`,
 *   вызыватель трактует как «пропустить» (best-effort).
 */
export const probeLectureForOffline = createAction(
  async (input: { id: string }): Promise<LectureProbe> => {
    const lecture = await getLectureById(input.id);
    if (!lecture) return { status: "gone" };
    // updated_at — required string в схеме; строгий eslint (no-unnecessary-
    // condition) запрещает мёртвую защиту `?? null`. Если бэк когда-то сделает
    // поле опциональным — реген + typecheck/lint заставят обновить здесь.
    return { status: "present", updatedAt: lecture.updated_at };
  },
);
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm test src/app/_offline/probe-lecture-action.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/app/_offline/probe-lecture-action.ts src/app/_offline/probe-lecture-action.test.ts
git commit -m "feat(offline): lightweight lecture probe action for SWR"
```

---

### Task 3: Клиентский оркестратор `revalidateSavedLecture`

**Files:**
- Create: `src/app/_offline/revalidate-saved-lecture.ts`
- Test: `src/app/_offline/revalidate-saved-lecture.test.ts`

- [ ] **Step 1: Написать падающий тест**

Create `src/app/_offline/revalidate-saved-lecture.test.ts`:

```ts
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect, beforeEach, vi } from "vitest";

const probeMock = vi.hoisted(() => vi.fn());
vi.mock("./probe-lecture-action", () => ({ probeLectureForOffline: probeMock }));

import { OFFLINE_SCHEMA_VERSION } from "@/services/offline/contract/storage";
import {
  getSavedBundle,
  putSavedBundle,
} from "@/services/offline/store/saved-bundles";

import { revalidateSavedLecture } from "./revalidate-saved-lecture";

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
}) {
  const { status = "complete", updatedAt = "2026-06-10T00:00:00Z", remoteStatus } = opts;
  return putSavedBundle({
    entity: "lectures",
    id: "l1",
    savedAt: "2026-06-10T00:00:00.000Z",
    schemaVersion: OFFLINE_SCHEMA_VERSION,
    status,
    snapshot: snap(updatedAt),
    imageKeys: [],
    ...(remoteStatus ? { remoteStatus } : {}),
  });
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  probeMock.mockReset();
});

describe("revalidateSavedLecture", () => {
  it("нет записи → skip, probe не зовётся", async () => {
    expect(await revalidateSavedLecture("l1")).toBe("skip");
    expect(probeMock).not.toHaveBeenCalled();
  });

  it("incomplete-запись → skip, probe не зовётся", async () => {
    await seed({ status: "saving" });
    expect(await revalidateSavedLecture("l1")).toBe("skip");
    expect(probeMock).not.toHaveBeenCalled();
  });

  it("probe success:false (сеть) → skip, запись не тронута", async () => {
    await seed({});
    probeMock.mockResolvedValue({ success: false, error: "network" });
    expect(await revalidateSavedLecture("l1")).toBe("skip");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBeUndefined();
  });

  it("gone → пометка remoteStatus=gone, снимок цел", async () => {
    await seed({});
    probeMock.mockResolvedValue({ success: true, data: { status: "gone" } });
    expect(await revalidateSavedLecture("l1")).toBe("gone");
    const rec = await getSavedBundle("lectures", "l1");
    expect(rec?.remoteStatus).toBe("gone");
    expect(rec?.snapshot).toBeTruthy();
  });

  it("present + изменённый updated_at → stale", async () => {
    await seed({ updatedAt: "2026-06-10T00:00:00Z" });
    probeMock.mockResolvedValue({
      success: true,
      data: { status: "present", updatedAt: "2026-06-12T00:00:00Z" },
    });
    expect(await revalidateSavedLecture("l1")).toBe("stale");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBe("stale");
  });

  it("present + тот же updated_at → fresh, снимает прежнюю пометку", async () => {
    await seed({ updatedAt: "2026-06-10T00:00:00Z", remoteStatus: "stale" });
    probeMock.mockResolvedValue({
      success: true,
      data: { status: "present", updatedAt: "2026-06-10T00:00:00Z" },
    });
    expect(await revalidateSavedLecture("l1")).toBe("fresh");
    expect((await getSavedBundle("lectures", "l1"))?.remoteStatus).toBeUndefined();
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm test src/app/_offline/revalidate-saved-lecture.test.ts`
Expected: FAIL — `Failed to resolve import "./revalidate-saved-lecture"`.

- [ ] **Step 3: Реализовать оркестратор**

Create `src/app/_offline/revalidate-saved-lecture.ts`:

```ts
// src/app/_offline/revalidate-saved-lecture.ts
"use client";

import {
  getSavedBundle,
  putSavedBundle,
  updateSavedBundle,
} from "@/services/offline/store/saved-bundles";

import { probeLectureForOffline } from "./probe-lecture-action";

export type RevalidateOutcome = "fresh" | "stale" | "gone" | "skip";

/** Достаёт `snapshot.lecture.updated_at` из unknown-снимка; `null`, если формы нет. */
function snapshotUpdatedAt(snapshot: unknown): string | null {
  if (typeof snapshot !== "object" || snapshot === null) return null;
  const lecture = (snapshot as { lecture?: unknown }).lecture;
  if (typeof lecture !== "object" || lecture === null) return null;
  const updatedAt = (lecture as { updated_at?: unknown }).updated_at;
  return typeof updatedAt === "string" ? updatedAt : null;
}

/**
 * Фоновая сверка статуса сохранённой лекции (SWR, ленивый вариант).
 *
 * Копию НИКОГДА не стирает — только проставляет/снимает пометку `remoteStatus`.
 * Best-effort: любая сетевая/иная ошибка → `"skip"` (ничего не трогаем).
 * Никогда не бросает.
 */
export async function revalidateSavedLecture(
  id: string,
): Promise<RevalidateOutcome> {
  try {
    const rec = await getSavedBundle("lectures", id);
    if (!rec || rec.status !== "complete") return "skip";

    const res = await probeLectureForOffline({ id });
    if (!res.success) return "skip";

    if (res.data.status === "gone") {
      await updateSavedBundle("lectures", id, { remoteStatus: "gone" });
      return "gone";
    }

    const savedUpdatedAt = snapshotUpdatedAt(rec.snapshot);
    // Помечаем stale только когда дата снимка известна и отличается от текущей —
    // иначе не мусорим ложным сигналом (best-effort). res.data.updatedAt — string.
    if (savedUpdatedAt !== null && res.data.updatedAt !== savedUpdatedAt) {
      await updateSavedBundle("lectures", id, { remoteStatus: "stale" });
      return "stale";
    }

    // Снять прежнюю пометку: перезаписываем запись БЕЗ поля remoteStatus.
    // `updateSavedBundle` только мёржит (ключ не удаляет), а под
    // exactOptionalPropertyTypes писать `{ remoteStatus: undefined }` нельзя —
    // поэтому delete + putSavedBundle (re-put локальной записи, без сети).
    if (rec.remoteStatus !== undefined) {
      const cleared = { ...rec };
      delete cleared.remoteStatus;
      await putSavedBundle(cleared);
    }
    return "fresh";
  } catch {
    return "skip";
  }
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm test src/app/_offline/revalidate-saved-lecture.test.ts`
Expected: PASS (6 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/app/_offline/revalidate-saved-lecture.ts src/app/_offline/revalidate-saved-lecture.test.ts
git commit -m "feat(offline): revalidateSavedLecture orchestrator (gone/stale/fresh/skip)"
```

---

### Task 4: Встроить ревалидацию в `SavedLectureView` + плашки

**Files:**
- Modify: `src/app/saved/saved-lecture-view.tsx`
- Test: `src/app/saved/saved-lecture-view.test.tsx`

- [ ] **Step 1: Дополнить существующий тест-файл моками и новыми тестами**

В `src/app/saved/saved-lecture-view.test.tsx`:

(а) Добавить импорт `updateSavedBundle` — изменить строку 8 на:

```ts
import {
  putSavedBundle,
  updateSavedBundle,
} from "@/services/offline/store/saved-bundles";
```

(б) После мока `saveOffline` (строка 13) добавить мок оркестратора:

```ts
const revalidateMock = vi.hoisted(() => vi.fn());
vi.mock("@/app/_offline/revalidate-saved-lecture", () => ({
  revalidateSavedLecture: revalidateMock,
}));
```

(в) Заменить `beforeEach` (строки 15–18) на:

```ts
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  saveOfflineMock.mockReset().mockResolvedValue({ ok: true });
  // По умолчанию сверка ничего не меняет — старые тесты не затрагиваются.
  revalidateMock.mockReset().mockResolvedValue("skip");
  // jsdom по умолчанию online; фиксируем явно (один из тестов ставит false).
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});
```

(г) Добавить новые тесты в конец `describe("SavedLectureView", …)` (перед закрывающей `});`):

```ts
  it("снимок показывается до завершения сверки (сверка не блокирует показ)", async () => {
    await seed("l1", "complete", SNAPSHOT);
    // Управляемый deferred вместо вечного промиса: снимок обязан отрисоваться
    // ДО резолва сверки; release() в конце даёт эффекту завершиться чисто
    // (без act()-warning / висящего промиса при cleanup).
    let release!: () => void;
    revalidateMock.mockReturnValue(
      new Promise<"skip">((resolve) => {
        release = () => {
          resolve("skip");
        };
      }),
    );
    render(<SavedLectureView id="l1" />);
    expect(await screen.findByText("Заголовок лекции")).toBeTruthy();
    release();
  });

  it("сверка gone → плашка «удалена», кнопка «Обновить» скрыта, снимок цел", async () => {
    await seed("l1", "complete", SNAPSHOT);
    revalidateMock.mockImplementation(async () => {
      await updateSavedBundle("lectures", "l1", { remoteStatus: "gone" });
      return "gone";
    });
    render(<SavedLectureView id="l1" />);
    expect(await screen.findByText(/удалена с платформы/)).toBeTruthy();
    expect(screen.getByText("Заголовок лекции")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Обновить" })).toBeNull();
  });

  it("сверка stale → плашка «доступна обновлённая версия», кнопка видна", async () => {
    await seed("l1", "complete", SNAPSHOT);
    revalidateMock.mockImplementation(async () => {
      await updateSavedBundle("lectures", "l1", { remoteStatus: "stale" });
      return "stale";
    });
    render(<SavedLectureView id="l1" />);
    expect(await screen.findByText(/Доступна обновлённая версия/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Обновить" })).toBeTruthy();
  });

  it("офлайн → сверка не запускается", async () => {
    await seed("l1", "complete", SNAPSHOT);
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    render(<SavedLectureView id="l1" />);
    await screen.findByText("Заголовок лекции");
    expect(revalidateMock).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Запустить тесты — убедиться, что новые падают**

Run: `pnpm test src/app/saved/saved-lecture-view.test.tsx`
Expected: FAIL — новые тесты (`/удалена с платформы/`, `/Доступна обновлённая версия/` не находятся; `revalidateMock` не вызывается, т.к. view ещё не зовёт оркестратор).

- [ ] **Step 3: Добавить импорт оркестратора в view**

В `src/app/saved/saved-lecture-view.tsx`, после строки 7 (`import { saveOffline } from "@/app/_offline/save-offline";`) добавить:

```ts
import { revalidateSavedLecture } from "@/app/_offline/revalidate-saved-lecture";
```

- [ ] **Step 4: Расширить `LoadState.ready` и `loadState`**

Заменить вариант `ready` в `LoadState` (строка 21) на:

```ts
  | {
      kind: "ready";
      snapshot: LectureSnapshot;
      savedAt: string;
      remoteStatus?: "stale" | "gone";
    };
```

Заменить успешный `return` в `loadState` (строка 52) на:

```ts
  return {
    kind: "ready",
    snapshot: rec.snapshot,
    savedAt: rec.savedAt,
    // условный spread: под exactOptionalPropertyTypes нельзя присвоить
    // optional-полю значение, которое может быть undefined.
    ...(rec.remoteStatus ? { remoteStatus: rec.remoteStatus } : {}),
  };
```

- [ ] **Step 5: Запустить фоновую сверку в эффекте загрузки**

Заменить тело эффекта `useEffect` (строки 60–75) на:

```ts
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Не показываем снимок прежнего владельца до сверки личности (см. identity-gate).
      await whenIdentityReconciled();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- race guard, мутируется в cleanup
      if (cancelled) return;
      const next = await loadState(id);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- race guard, мутируется в cleanup
      if (cancelled) return;
      setState(next);
      // Фоновая ревалидация (SWR): снимок уже показан выше, сверка его не
      // блокирует. Один раз на id; офлайн — не сверяем (best-effort).
      if (next.kind === "ready" && navigator.onLine) {
        const outcome = await revalidateSavedLecture(id);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- race guard, мутируется в cleanup
        if (cancelled) return;
        if (outcome !== "skip") {
          // Перечитываем запись, чтобы отразить проставленную/снятую пометку.
          const refreshed = await loadState(id);
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- race guard, мутируется в cleanup
          if (cancelled) return;
          setState(refreshed);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);
```

- [ ] **Step 6: Отрисовать плашки и скрыть «Обновить» при gone**

В `ready`-ветке (строки 124–146) заменить начало `return (` и блок-заголовок. Заменить:

```tsx
  const { lecture, tags, documents, comments } = state.snapshot;
  const coverUrl = lecture.cover_image_key
    ? resolveStorageUrl(lecture.cover_image_key)
    : null;

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-(--color-description)">
          Сохранено офлайн:{" "}
          {new Date(state.savedAt).toLocaleDateString("ru-RU", {
            timeZone: "UTC",
          })}
        </span>
        <Button
          type="button"
          variant="secondary"
          disabled={refreshing}
          onClick={onRefresh}
        >
          {refreshing ? "Обновление…" : "Обновить"}
        </Button>
      </div>
```

на:

```tsx
  const { lecture, tags, documents, comments } = state.snapshot;
  const remoteStatus = state.remoteStatus;
  const coverUrl = lecture.cover_image_key
    ? resolveStorageUrl(lecture.cover_image_key)
    : null;

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      {remoteStatus === "gone" && (
        <p
          className="rounded-md border border-(--color-border) p-3 text-sm text-(--color-description)"
          role="status"
        >
          Эта лекция удалена с платформы. У вас осталась сохранённая копия.
        </p>
      )}
      {remoteStatus === "stale" && (
        <p
          className="rounded-md border border-(--color-border) p-3 text-sm text-(--color-description)"
          role="status"
        >
          Доступна обновлённая версия — нажмите «Обновить».
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-(--color-description)">
          Сохранено офлайн:{" "}
          {new Date(state.savedAt).toLocaleDateString("ru-RU", {
            timeZone: "UTC",
          })}
        </span>
        {remoteStatus !== "gone" && (
          <Button
            type="button"
            variant="secondary"
            disabled={refreshing}
            onClick={onRefresh}
          >
            {refreshing ? "Обновление…" : "Обновить"}
          </Button>
        )}
      </div>
```

(Остальной JSX — `refreshError`, `<header>`, секции документов и комментариев — без изменений.)

- [ ] **Step 7: Запустить тесты файла — убедиться, что все проходят**

Run: `pnpm test src/app/saved/saved-lecture-view.test.tsx`
Expected: PASS (исходные 8 + 4 новых = 12 тестов).

- [ ] **Step 8: Commit**

```bash
git add src/app/saved/saved-lecture-view.tsx src/app/saved/saved-lecture-view.test.tsx
git commit -m "feat(offline): background SWR revalidation + stale/gone notices in SavedLectureView"
```

---

### Task 5: Полный гейт

**Files:** none (верификация).

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: 0 ошибок/предупреждений по затронутым файлам (`src/app/_offline/probe-lecture-action.ts`, `revalidate-saved-lecture.ts`, их тесты, `src/app/saved/saved-lecture-view.tsx`, `src/services/offline/contract/storage.ts`).

- [ ] **Step 2: Tests**

Run: `pnpm test`
Expected: PASS, без регрессий (новые тесты Task 2/3/4 зелёные).

- [ ] **Step 3: Typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: PASS. (Примечание: если волна 2 optlock ещё не влита параллельным агентом, `typecheck`/`build` могут падать на `src/features/{annotations,events,banners}/actions.ts` — это НЕ относится к данному плану; дождаться зелёной волны 2.)

---

## Известные ограничения (осознанные, ленивый вариант)

- **Сверяется только `lecture.updated_at`.** Probe тянет лишь лекцию; изменения вложенных сущностей снимка (документы, теги, комментарии), если они НЕ двигают `updated_at` самой лекции, фоновая сверка не заметит → возможен «ложный fresh». Это плата за лёгкий probe; полное покрытие — вместе с ETag/version бэка (вне объёма). Не баг — ожидаемое поведение ленивого варианта.
- **Гонка с ручным «Обновить» (MINOR).** Если пользователь жмёт «Обновить» (полная перезапись снимка) ровно пока фоновая сверка в полёте, сверка может проставить `stale`/`gone` поверх свежеобновлённой записи и кратко показать неактуальную плашку. Окно узкое, данные не теряются, исправляется следующим открытием. Защита (generation-guard) не делается — не оправдана сложностью.
- **Двойной probe в dev (StrictMode).** `reactStrictMode: true` в dev монтирует эффект дважды → два probe-вызова и две идемпотентные записи пометки. Только dev (prod не дублирует), порчи данных нет.

## Self-Review

**Spec coverage:**
- «Показать копию немедленно» → Task 4 Step 5 (snapshot via `setState(next)` до await сверки) + тест «снимок показывается до завершения сверки».
- «Фоновая сверка, если онлайн» → Task 4 Step 5 (`navigator.onLine` гейт) + тест «офлайн → сверка не запускается».
- «200 + изменён → пометка stale, без авто-перекачки» → Task 3 (stale) + Task 4 плашка stale (кнопка «Обновить» остаётся ручной).
- «404/410 → пометить gone, копию не стирать» → Task 2 (gone из null), Task 3 (пометка, snapshot цел), Task 4 плашка + скрытие кнопки + тест «снимок цел».
- «Офлайн / ошибка → ничего» → Task 2 (`success:false` на throw), Task 3 (skip) + тест.
- «Снять пометку при возврате к свежему» → Task 3 (fresh clears) + тест.
- Модель данных `remoteStatus` → Task 1.
- Лёгкий probe (без полного снимка) → Task 2 (только `getLectureById`).

**Placeholder scan:** нет TBD/TODO; весь код приведён целиком.

**Type consistency:** `RevalidateOutcome = "fresh"|"stale"|"gone"|"skip"` (Task 3) согласован с использованием в Task 4 (`outcome !== "skip"`). `LectureProbe` (Task 2) `{status:"present";updatedAt:string}|{status:"gone"}` согласован с `res.data.status`/`res.data.updatedAt` в Task 3. `remoteStatus?: "stale"|"gone"` одинаков в storage.ts (Task 1), оркестраторе (Task 3) и `LoadState.ready` (Task 4). `probeLectureForOffline({ id })` — объектный аргумент — согласован между Task 2 (определение), Task 3 (вызов) и тестами. `getSavedBundle`/`updateSavedBundle`/`putSavedBundle` — существующие сигнатуры (`saved-bundles.ts`).
