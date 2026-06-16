# Offline Slice L1 — сборка и сохранение офлайн-снимка лекции (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать пользователю сохранить лекцию офлайн: серверная сборка снимка (`lectureDescriptor.assemble`) + извлечение ключей картинок (`extractImageKeys`) в композиционном корне `app/_offline`, регистрация в реестре, кнопка «Сохранить офлайн» на странице лекции. (Просмотр сохранённого — слайс **L2**.)

**Architecture:** Снимок лекции кросс-фичевый (lectures + tags + comments), поэтому дескриптор живёт в `src/app/_offline/descriptors/` (композиционный корень — единственный ESLint-легальный канал, где можно импортировать несколько `@/features/*`; в `src/features/lectures/*` это был бы запрещённый cross-feature импорт — D12). `assemble` оркестрирует существующие server-фетчеры (auth по cookie через `createApiClient`); generic `saveOffline`/`assembleOfflineBundle`/route уже готовы (F4). Кнопка — generic `SaveOfflineButton({entity,id})` в `app/_offline`, переиспользуема для будущих сущностей.

**Tech Stack:** Next 16 App Router (server components + server actions), React 19, TypeScript 6 strict, vitest 4 + @testing-library/react (jsdom, globals:false) + `vi.hoisted` mocks.

---

## Контекст и текущее состояние (прочитать перед стартом)

**Что уже готово (НЕ переписывать):**
- F4 generic write/read: `assembleBundle(resolve, entity, id)` (`src/app/_offline/offline-read.ts`), server-action `assembleOfflineBundle` (`save-offline-action.ts`), client-оркестратор `saveOffline(entity, id): Promise<{ok, error?}>` (`save-offline.ts`: вызывает action → `putSavedBundle("saving")` → `requestPersistentStorage()` → `cacheImage(resolveStorageUrl(key))` по каждому `imageKey` → `updateSavedBundle("complete"|"error")`), route `POST /api/offline/[entity]`.
- Реестр `src/app/_offline/registry.ts`: `OFFLINE_REGISTRY: Record<string, OfflineDescriptor> = {}` (пуст) + `resolveDescriptor`. Импортируется ТОЛЬКО серверными (`save-offline-action.ts` с `"use server"`+`import "server-only"`, `route.ts`) — клиентских импортёров НЕТ.
- Контракт `OfflineDescriptor<TSnapshot, TWritePayload>` (`src/services/offline/contract/descriptor.ts`): `entity` (ОБЯЗАН быть значением `Tags.*`), `pathSegment`, `assemble(id)=>Promise<TSnapshot|null>`, `extractImageKeys(snapshot)=>string[]`, опц. `write`.
- F2: `CommentTreeView`/`CommentNodeView` экспортированы из `@/features/comments` (для L2-рендера; в L1 НЕ используются).

**Фетчеры для assemble (факты разведки):**
- `getLectureById(id, token?): Promise<Lecture|null>` (`@/features/lectures`) — `createApiClient` читает cookie `token` сам; 404→null. (Share-link token не нужен — assemble под cookie-auth пользователя.)
- `getLectureTags(id): Promise<Tag[]>` (`@/features/tags`) — бросает на ошибке (нет 404-обработки).
- `getLectureDocuments(id): Promise<LectureDocument[]>` (`@/features/lectures`) — 404→`[]`.
- `getLectureComments(id, opts?): Promise<CommentListResult>` (`@/features/comments`), `CommentListResult = { subtrees: RootSubtree[]; total; offset; limit }` — бросает на ошибке. **В снимок класть `.subtrees`.**

**Типы (из schema, дословно):**
- `Lecture` = `lecture.Lecture`: required `id, title, date, description (СТРОКА, не AST), owner_id, created_at, updated_at, visibility`; опц. `cover_image_key, cover_image_alt`.
- `LectureDocument` = `document.Document`: `blocks?: ast.Block[]`, `filename?`, `id?`, `owner_id?`, `visibility?`, `created_at?`, `updated_at?` (всё опц.).
- `ast.Block`: `{ attrs?: {[k]:unknown}; content?: ast.Node[]; id?; position?; text?; type? }`. Image-блок: `type==="image"`, `attrs.storage_key` (64-hex). Картинки могут быть вложены через `content` (списки) — обходить рекурсивно. Готового экстрактора в репо НЕТ.
- `RootSubtree` = `{ root?: Comment; descendants?: Comment[] }`; `Comment.blocks?: ast.Block[]`.

**RBAC:** сохранение офлайн доступно всякому, кто видит лекцию — assemble уже ходит под cookie-правами пользователя (бэк отдаёт только доступное; приватная чужая → 404→null→«недоступно для сохранения»). Отдельного `requireCapability` для read-сохранения НЕ нужно.

**Конвенции/заморозка:** kebab-case; запретные зоны НЕ трогать (`src/api/schema.ts`, `src/components/ui/*`, `eslint.config.mjs`, `vitest.config.ts`, `package.json`, `src/app/layout.tsx`). `src/app/lectures/[id]/page.tsx` — НЕ заморожен (правим). `src/api/schema.ts` сейчас изменён пользователем — НЕ трогать/не коммитить.

**Тест-окружение:** vitest `globals:false` → явный импорт `describe/it/expect/vi/beforeEach`; `server-only` застаблен (`vitest.config.ts` alias) — файл с `import "server-only"` тестируется; для моков модулей использовать `vi.hoisted(() => vi.fn())` + `vi.mock(path, factory)` (иначе TDZ при дереференсе в фабрике). RTL globals:false → `afterEach(cleanup)`.

**Параллельные агенты:** добавлять только свои файлы по имени (НЕ `git add -A`); перед правкой `registry.ts`/`page.tsx` сверить с ожидаемым содержимым, не перезаписывать чужое.

**Out of scope (→ L2 / позже):** `/saved` и `/saved/[id]` (SavedLectureView), подметание зависших `saving`, рендер снимка. Медиа лекции (`getLectureMedia`) в снимок НЕ кладём (на странице — лишь ссылки; YAGNI). Backend bundle-endpoint отсутствует — фронт-оркестрация (D14). Graceful-partial при сбое tags/comments — НЕ делаем: assemble all-or-nothing (как онлайн-страница, которая тоже падает при сбое tags).

---

## Файловая структура

- **Create:** `src/app/_offline/descriptors/lecture-descriptor.ts` (+ `.test.ts`) — `LectureSnapshot`, `extractImageKeysFromBlocks`, `lectureDescriptor`.
- **Modify:** `src/app/_offline/registry.ts` — регистрация `lectureDescriptor`.
- **Create:** `src/app/_offline/registry.test.ts` — резолв дескриптора.
- **Create:** `src/app/_offline/save-offline-button.tsx` (+ `.test.tsx`) — generic client-кнопка.
- **Modify:** `src/app/lectures/[id]/page.tsx` — встроить кнопку.

---

## Task 1: lectureDescriptor (assemble + extractImageKeys)

**Files:**
- Create: `src/app/_offline/descriptors/lecture-descriptor.ts`, `src/app/_offline/descriptors/lecture-descriptor.test.ts`

- [ ] **Step 1: Падающие тесты**

Создать `src/app/_offline/descriptors/lecture-descriptor.test.ts`:

```ts
// src/app/_offline/descriptors/lecture-descriptor.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  lectureDescriptor,
  extractImageKeysFromBlocks,
  type LectureSnapshot,
} from "./lecture-descriptor";

// vi.hoisted + vi.mock автоматически поднимаются vitest'ом ВЫШЕ статических импортов,
// поэтому моки применяются до загрузки lecture-descriptor (статический import, как
// в эталонах проекта save-offline.test.ts / image-button.test.tsx; без top-level await).
const getLectureById = vi.hoisted(() => vi.fn());
const getLectureDocuments = vi.hoisted(() => vi.fn());
const getLectureTags = vi.hoisted(() => vi.fn());
const getLectureComments = vi.hoisted(() => vi.fn());

vi.mock("@/features/lectures", () => ({ getLectureById, getLectureDocuments }));
vi.mock("@/features/tags", () => ({ getLectureTags }));
vi.mock("@/features/comments", () => ({ getLectureComments }));

const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);
const KEY_C = "c".repeat(64);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("extractImageKeysFromBlocks", () => {
  it("берёт storage_key из image-блока верхнего уровня", () => {
    expect(
      extractImageKeysFromBlocks([{ type: "image", attrs: { storage_key: KEY_A } }]),
    ).toEqual([KEY_A]);
  });
  it("рекурсивно обходит вложенные content", () => {
    expect(
      extractImageKeysFromBlocks([
        { type: "list", content: [{ type: "image", attrs: { storage_key: KEY_B } }] },
      ]),
    ).toEqual([KEY_B]);
  });
  it("игнорирует не-image и невалидные ключи", () => {
    expect(
      extractImageKeysFromBlocks([
        { type: "paragraph", text: "hi" },
        { type: "image", attrs: { storage_key: "not-a-hash" } },
        { type: "image", attrs: {} },
      ]),
    ).toEqual([]);
  });
});

describe("lectureDescriptor.entity/pathSegment", () => {
  it("entity === 'lectures' (значение Tags.LECTURES)", () => {
    expect(lectureDescriptor.entity).toBe("lectures");
    expect(lectureDescriptor.pathSegment).toBe("lectures");
  });
});

describe("lectureDescriptor.extractImageKeys", () => {
  it("собирает обложку + картинки документов/комментов, дедуп + валидация", () => {
    const snap: LectureSnapshot = {
      lecture: {
        id: "l1",
        title: "T",
        date: "2026-01-01",
        description: "desc",
        owner_id: "o",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        visibility: "public",
        cover_image_key: KEY_A,
      },
      tags: [],
      documents: [{ id: "d1", blocks: [{ type: "image", attrs: { storage_key: KEY_B } }] }],
      comments: [
        {
          root: {
            id: "c1",
            user_id: "u",
            lecture_id: "l1",
            type: "claim",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            blocks: [{ type: "image", attrs: { storage_key: KEY_C } }],
          },
          descendants: [],
        },
      ],
    };
    expect(lectureDescriptor.extractImageKeys(snap).sort()).toEqual(
      [KEY_A, KEY_B, KEY_C].sort(),
    );
  });

  it("дедуплицирует повторяющиеся ключи", () => {
    const snap: LectureSnapshot = {
      lecture: {
        id: "l1", title: "T", date: "d", description: "x", owner_id: "o",
        created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
        visibility: "public", cover_image_key: KEY_A,
      },
      tags: [],
      documents: [{ id: "d1", blocks: [{ type: "image", attrs: { storage_key: KEY_A } }] }],
      comments: [],
    };
    expect(lectureDescriptor.extractImageKeys(snap)).toEqual([KEY_A]);
  });
});

describe("lectureDescriptor.assemble", () => {
  it("null, если лекция недоступна (404→null), фетчеры не зовутся", async () => {
    getLectureById.mockResolvedValue(null);
    expect(await lectureDescriptor.assemble("missing")).toBeNull();
    expect(getLectureTags).not.toHaveBeenCalled();
    expect(getLectureComments).not.toHaveBeenCalled();
  });

  it("собирает снимок: lecture + tags + documents + comments (одна страница)", async () => {
    getLectureById.mockResolvedValue({ id: "l1", title: "T" });
    getLectureTags.mockResolvedValue([{ name: "math" }]);
    getLectureDocuments.mockResolvedValue([{ id: "d1", blocks: [] }]);
    getLectureComments.mockResolvedValue({
      subtrees: [{ root: { id: "c1" } }],
      total: 1,
      offset: 0,
      limit: 100,
    });

    const snap = await lectureDescriptor.assemble("l1");
    expect(snap).toEqual({
      lecture: { id: "l1", title: "T" },
      tags: [{ name: "math" }],
      documents: [{ id: "d1", blocks: [] }],
      comments: [{ root: { id: "c1" } }],
    });
    expect(getLectureComments).toHaveBeenCalledTimes(1);
  });

  it("склеивает ВСЕ страницы комментов до total (§225 — снимок не усекаем)", async () => {
    getLectureById.mockResolvedValue({ id: "l1" });
    getLectureTags.mockResolvedValue([]);
    getLectureDocuments.mockResolvedValue([]);
    // total=250 при page=100 → страницы offset 0,100,200 (3 вызова)
    getLectureComments.mockImplementation(
      (_id: string, opts: { offset?: number }) => {
        const offset = opts.offset ?? 0;
        return Promise.resolve({
          subtrees: [{ root: { id: `r-${offset}` } }],
          total: 250,
          offset,
          limit: 100,
        });
      },
    );

    const snap = await lectureDescriptor.assemble("l1");
    expect(getLectureComments).toHaveBeenCalledTimes(3);
    expect(snap?.comments).toEqual([
      { root: { id: "r-0" } },
      { root: { id: "r-100" } },
      { root: { id: "r-200" } },
    ]);
  });
});
```

- [ ] **Step 2: Прогон — падает**

Run: `pnpm exec vitest run src/app/_offline/descriptors/lecture-descriptor.test.ts`
Expected: FAIL — модуль `./lecture-descriptor` не найден.

- [ ] **Step 3: Реализация**

Создать `src/app/_offline/descriptors/lecture-descriptor.ts`:

```ts
// src/app/_offline/descriptors/lecture-descriptor.ts
// Дескриптор офлайн-снимка лекции. Живёт в композиционном корне app/_offline (НЕ в
// features/lectures): assemble кросс-фичевый (lectures+tags+comments), а ESLint запрещает
// cross-feature импорты внутри features/*. server-only: assemble зовёт server-фетчеры.
import "server-only";

import { Tags } from "@/api/tags";
import { getLectureComments, type RootSubtree } from "@/features/comments";
import {
  getLectureById,
  getLectureDocuments,
  type Lecture,
  type LectureDocument,
} from "@/features/lectures";
import { getLectureTags, type Tag } from "@/features/tags";
import type { OfflineDescriptor } from "@/services/offline/contract/descriptor";

/** Офлайн-снимок лекции (форма знает дескриптор + SavedLectureView из L2). */
export interface LectureSnapshot {
  lecture: Lecture;
  tags: Tag[];
  documents: LectureDocument[];
  comments: RootSubtree[];
}

/** Тип AST-блока выводим из документа — без угадывания пути импорта ast.Block. */
type SnapshotBlock = NonNullable<LectureDocument["blocks"]>[number];

const STORAGE_KEY_RE = /^[0-9a-f]{64}$/i;

/** Рекурсивно собрать валидные storage_key картинок из AST-блоков (вкл. вложенные content). */
export function extractImageKeysFromBlocks(
  blocks: readonly SnapshotBlock[],
): string[] {
  const acc: string[] = [];
  const walk = (nodes: readonly SnapshotBlock[]): void => {
    for (const b of nodes) {
      if (b.type === "image") {
        const k = b.attrs?.storage_key;
        if (typeof k === "string" && STORAGE_KEY_RE.test(k)) acc.push(k);
      }
      if (Array.isArray(b.content)) {
        walk(b.content as SnapshotBlock[]);
      }
    }
  };
  walk(blocks);
  return acc;
}

/** Бэк пагинирует комменты — тянем ВСЕ страницы (§225: офлайн-снимок не усекаем,
 *  в отличие от онлайн-CommentSection без «показать ещё»). all-or-nothing: сбой страницы → throw. */
const COMMENTS_PAGE = 100;
async function fetchAllComments(id: string): Promise<RootSubtree[]> {
  const first = await getLectureComments(id, { offset: 0, limit: COMMENTS_PAGE });
  const subtrees = [...first.subtrees];
  for (let off = COMMENTS_PAGE; off < first.total; off += COMMENTS_PAGE) {
    const page = await getLectureComments(id, { offset: off, limit: COMMENTS_PAGE });
    subtrees.push(...page.subtrees);
  }
  return subtrees;
}

export const lectureDescriptor: OfflineDescriptor<LectureSnapshot> = {
  entity: Tags.LECTURES,
  pathSegment: "lectures",

  assemble: async (id) => {
    const lecture = await getLectureById(id);
    if (!lecture) return null;
    const [tags, documents, comments] = await Promise.all([
      getLectureTags(id),
      getLectureDocuments(id),
      fetchAllComments(id),
    ]);
    return { lecture, tags, documents, comments };
  },

  extractImageKeys: (snap) => {
    const keys: string[] = [];
    if (snap.lecture.cover_image_key) keys.push(snap.lecture.cover_image_key);
    for (const doc of snap.documents) {
      keys.push(...extractImageKeysFromBlocks(doc.blocks ?? []));
    }
    for (const st of snap.comments) {
      keys.push(...extractImageKeysFromBlocks(st.root?.blocks ?? []));
      for (const d of st.descendants ?? []) {
        keys.push(...extractImageKeysFromBlocks(d.blocks ?? []));
      }
    }
    return [...new Set(keys)].filter((k) => STORAGE_KEY_RE.test(k));
  },
};
```

> Сверки при typecheck (правка минимальна, если что-то иначе): `@/features/lectures` экспортирует `getLectureById`/`getLectureDocuments`/`Lecture`/`LectureDocument`; `@/features/tags` — `getLectureTags`/`Tag`; `@/features/comments` — `getLectureComments`/`RootSubtree`; `@/api/tags` — `Tags.LECTURES === "lectures"`.

- [ ] **Step 4: Прогон — зелёный**

Run: `pnpm exec vitest run src/app/_offline/descriptors/lecture-descriptor.test.ts`
Expected: PASS (все describe-блоки).

- [ ] **Step 5: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 0/0. (Если `cover_image_key` опц.-типа даёт `no-unnecessary-condition` на `if (snap.lecture.cover_image_key)` — оставить как есть, поле реально опционально.)

- [ ] **Step 6: Коммит**

```bash
git add src/app/_offline/descriptors/lecture-descriptor.ts src/app/_offline/descriptors/lecture-descriptor.test.ts
git commit -m "feat(offline/lectures): lecture offline descriptor (assemble + extractImageKeys) (L1 task 1)"
```

---

## Task 2: Регистрация в OFFLINE_REGISTRY

> **ВНИМАНИЕ:** `registry.ts` И `registry.test.ts` УЖЕ существуют (созданы в F4). Тест сейчас утверждает «реестр пуст / `resolveDescriptor("lectures")`→undefined» — после регистрации эти ассерты СЛОМАЮТСЯ, поэтому их ОБНОВЛЯЕМ (Modify, не Create). Перед правкой сверь актуальное содержимое обоих файлов (параллельные агенты).

**Files:**
- Modify: `src/app/_offline/registry.ts`
- Modify: `src/app/_offline/registry.test.ts`

- [ ] **Step 1: Обновить существующий тест (TDD — станет красным)**

В `src/app/_offline/registry.test.ts` ЗАМЕНИТЬ два устаревших `it`-блока:

```ts
  it("стартует пустым (слайсы добавят дескрипторы)", () => {
    expect(Object.keys(OFFLINE_REGISTRY)).toEqual([]);
  });

  it("resolveDescriptor → undefined для незарегистрированной сущности", () => {
    expect(resolveDescriptor("lectures")).toBeUndefined();
  });
```

на:

```ts
  it("резолвит lectureDescriptor по 'lectures'", () => {
    const d = resolveDescriptor("lectures");
    expect(d).toBeDefined();
    expect(d?.entity).toBe("lectures");
    expect(typeof d?.assemble).toBe("function");
    expect(typeof d?.extractImageKeys).toBe("function");
    expect(Object.keys(OFFLINE_REGISTRY)).toContain("lectures");
  });

  it("resolveDescriptor → undefined для незарегистрированной сущности", () => {
    expect(resolveDescriptor("nope")).toBeUndefined();
  });
```

(Шапка теста — `import { describe, it, expect } from "vitest"` + `import { OFFLINE_REGISTRY, resolveDescriptor } from "./registry"` — без изменений.)

- [ ] **Step 2: Прогон — падает**

Run: `pnpm exec vitest run src/app/_offline/registry.test.ts`
Expected: FAIL — `resolveDescriptor("lectures")` undefined (дескриптор ещё не зарегистрирован).

- [ ] **Step 3: Зарегистрировать дескриптор (Edit, не перезапись всего файла)**

В `src/app/_offline/registry.ts` (текущие импорты — только `import type { OfflineDescriptor }` и `import type { DescriptorResolver }`):

(a) добавить два импорта — value-импорт `Tags` в группу `@/...` ПЕРЕД `@/services/...`, и sibling-импорт дескриптора отдельной группой:

```ts
import { Tags } from "@/api/tags";
import type { OfflineDescriptor } from "@/services/offline/contract/descriptor";
import type { DescriptorResolver } from "@/services/offline/repository";

import { lectureDescriptor } from "./descriptors/lecture-descriptor";
```

(b) заменить пустое тело `OFFLINE_REGISTRY` (комментарии-плейсхолдеры F4) на запись:

```ts
export const OFFLINE_REGISTRY: Record<string, OfflineDescriptor> = {
  // Типизированный дескриптор в generic-реестр через приведение (вариантность
  // extractImageKeys); рантайм-безопасно — assembleBundle всегда пары assemble+
  // extractImageKeys одного дескриптора. Слайс A добавит [Tags.ANNOTATIONS].
  [Tags.LECTURES]: lectureDescriptor as OfflineDescriptor,
};
```

(`resolveDescriptor` — без изменений.) Приведение `as OfflineDescriptor` достаточно (ревью подтвердило tsc-чистоту; `as unknown as` НЕ нужен).

- [ ] **Step 4: Прогон — зелёный + гейт**

Run: `pnpm exec vitest run src/app/_offline/registry.test.ts && pnpm lint && pnpm typecheck`
Expected: PASS, lint 0, typecheck 0.

- [ ] **Step 5: Коммит**

```bash
git add src/app/_offline/registry.ts src/app/_offline/registry.test.ts
git commit -m "feat(offline/lectures): register lectureDescriptor in OFFLINE_REGISTRY (L1 task 2)"
```

---

## Task 3: Кнопка «Сохранить офлайн» на странице лекции

Generic client-кнопка в `app/_offline` (переиспользуема), встроенная в server-страницу лекции.

**Files:**
- Create: `src/app/_offline/save-offline-button.tsx`, `src/app/_offline/save-offline-button.test.tsx`
- Modify: `src/app/lectures/[id]/page.tsx`

- [ ] **Step 1: Падающий тест**

Создать `src/app/_offline/save-offline-button.test.tsx`:

```tsx
// src/app/_offline/save-offline-button.test.tsx
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

const saveOffline = vi.hoisted(() => vi.fn());
const toastAdd = vi.hoisted(() => vi.fn());

vi.mock("./save-offline", () => ({ saveOffline }));
vi.mock("@/components/ui", () => ({
  Button: (props: Record<string, unknown>) => <button {...props} />,
  useToast: () => ({ add: toastAdd }),
}));

import { SaveOfflineButton } from "./save-offline-button";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SaveOfflineButton", () => {
  it("успех → показывает «Сохранено», тост-успех", async () => {
    saveOffline.mockResolvedValue({ ok: true });
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    fireEvent.click(screen.getByText("Сохранить офлайн"));
    await waitFor(() => {
      expect(screen.getByText(/Сохранено/)).toBeTruthy();
    });
    expect(saveOffline).toHaveBeenCalledWith("lectures", "l1");
  });

  it("ошибка → тост с описанием, кнопка снова активна", async () => {
    saveOffline.mockResolvedValue({ ok: false, error: "нет сети" });
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    fireEvent.click(screen.getByText("Сохранить офлайн"));
    await waitFor(() => {
      expect(toastAdd).toHaveBeenCalled();
    });
    expect(screen.getByText("Сохранить офлайн")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Прогон — падает**

Run: `pnpm exec vitest run src/app/_offline/save-offline-button.test.tsx`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализация кнопки**

Создать `src/app/_offline/save-offline-button.tsx`:

```tsx
// src/app/_offline/save-offline-button.tsx
"use client";

import { useState } from "react";

import { Button, useToast } from "@/components/ui";

import { saveOffline } from "./save-offline";

/** Generic-кнопка «Сохранить офлайн» для любой сущности из OFFLINE_REGISTRY. */
export function SaveOfflineButton({
  entity,
  id,
}: {
  entity: string;
  id: string;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const toast = useToast();

  if (saved) {
    return (
      <span className="text-sm text-(--color-description)">Сохранено офлайн ✓</span>
    );
  }

  const onClick = (): void => {
    setSaving(true);
    void saveOffline(entity, id).then((result) => {
      setSaving(false);
      if (result.ok) {
        setSaved(true);
        toast.add({ title: "Сохранено для офлайна" });
      } else {
        toast.add({
          title: "Не удалось сохранить офлайн",
          description: result.error,
        });
      }
    });
  };

  return (
    <Button type="button" variant="secondary" disabled={saving} onClick={onClick}>
      {saving ? "Сохранение…" : "Сохранить офлайн"}
    </Button>
  );
}
```

- [ ] **Step 4: Прогон — зелёный**

Run: `pnpm exec vitest run src/app/_offline/save-offline-button.test.tsx`
Expected: PASS.

- [ ] **Step 5: Встроить кнопку в страницу лекции**

В `src/app/lectures/[id]/page.tsx` добавить импорт (в группу `@/...`):

```tsx
import { SaveOfflineButton } from "@/app/_offline/save-offline-button";
```

И вставить кнопку отдельной секцией — сразу ПОСЛЕ `<LectureMediaSection lectureId={id} />` и ПЕРЕД блоком `{canShare && (...)}`:

```tsx
      <div className="flex justify-end">
        <SaveOfflineButton entity="lectures" id={id} />
      </div>
```

(`entity="lectures"` === `Tags.LECTURES` — ключ дескриптора в реестре.)

- [ ] **Step 6: Гейт**

Run: `pnpm lint && pnpm typecheck && pnpm exec vitest run src/app/_offline/`
Expected: lint 0, typecheck 0, тесты PASS.

- [ ] **Step 7: Коммит**

```bash
git add src/app/_offline/save-offline-button.tsx src/app/_offline/save-offline-button.test.tsx src/app/lectures/[id]/page.tsx
git commit -m "feat(offline/lectures): SaveOfflineButton on lecture page (L1 task 3)"
```

---

## Финальная проверка (полный гейт)

- [ ] **Step 1: Прогон всего гейта**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected:
- `lint` 0, `typecheck` 0.
- `test` — все зелёные, +~11 тестов (descriptor 9: blocks 3 + entity 1 + extractImageKeys 2 + assemble 3; button 2; registry-тесты ОБНОВЛЯЮТСЯ, не добавляются).
- `build` — успешно; страница `/lectures/[id]` компилируется с кнопкой; `app/_offline` не тянет server-only в client (кнопка — отдельный `"use client"`-модуль, дескриптор — server-only, импортируется только серверным реестром).

- [ ] **Step 2: Смоук (если есть браузер; иначе зафиксировать как не прогнанное)**

Открыть `/lectures/[id]`, нажать «Сохранить офлайн» → тост успеха, кнопка → «Сохранено офлайн ✓». В DevTools → Application → IndexedDB `flbz-offline` → стор `saved-bundles` → запись `lectures:<id>` со `status:"complete"`, `snapshot` (lecture/tags/documents/comments), `imageKeys`; Cache Storage `flbz-offline-images` содержит картинки. (Просмотр снимка — L2.)

---

## Self-Review (автор плана)

**Покрытие L1:** assemble (Task 1) + extractImageKeys (Task 1) + регистрация (Task 2) + кнопка/страница (Task 3). Просмотр (`/saved`) сознательно отложен в L2.

**Тип-консистентность:** `LectureSnapshot { lecture, tags, documents, comments: RootSubtree[] }` — едина в дескрипторе и тестах; `extractImageKeysFromBlocks` экспортирована и тестируется отдельно; `SaveOfflineButton({entity,id})` — пропсы совпадают между тестом, реализацией и страницей.

**Плейсхолдеры:** нет — код дословный, команды с ожидаемым выводом.

**Риски/допущения:**
1. **Экспорты фич:** план полагается, что `@/features/lectures` экспортирует `getLectureById`/`getLectureDocuments`/`Lecture`/`LectureDocument`, `@/features/tags` — `getLectureTags`/`Tag`, `@/features/comments` — `getLectureComments`/`RootSubtree`. Если имя/наличие иное — typecheck (Task 1 Step 5) укажет; поправить импорт.
2. **`as OfflineDescriptor`** при регистрации — необходимое приведение типизированного дескриптора в generic-реестр (вариантность `extractImageKeys(snapshot)`); рантайм-безопасно (assembleBundle пары assemble+extractImageKeys одного дескриптора). Фолбэк `as unknown as OfflineDescriptor`.
3. **server-only дескриптор + реестр:** `registry.ts` импортирует server-only `lecture-descriptor` → реестр становится server-only; импортёры реестра (`save-offline-action.ts`, `route.ts`) — серверные, клиентских нет (разведка подтвердила). Если появится клиентский импорт реестра — сломается; в L1 такого нет.
4. **Пагинация комментов (§225) — РЕАЛИЗОВАНА:** `fetchAllComments` тянет ВСЕ страницы до `total` (снимок не усекаем, в отличие от онлайн-`CommentSection` без «показать ещё»; закрывает downstream-контракт F2 и анти-паттерн §225). all-or-nothing: сбой любой страницы/фетчера (`getLectureTags`/`getLectureComments` бросают) → assemble пробросит → `createAction` поймает в try/catch → `{ok:false}` (ревью подтвердило: кнопка получает resolved-промис, не reject). Graceful-partial — будущее улучшение.
5. **Моки в тесте дескриптора:** статический import тестируемого модуля + `vi.hoisted` mock-фабрики + `vi.mock` (vitest поднимает hoisted/mock ВЫШЕ статических импортов → моки применяются до загрузки). Эталоны проекта — `save-offline.test.ts`, `image-button.test.tsx` (статический import, без top-level await).
6. **Кнопка в `app/_offline` (не в фиче):** избегаем feature→app импорта; кнопка generic и переиспользуема. Страница лекции (app) импортирует app/_offline (app→app, чисто).
7. **Параллельные агенты:** `git add` только по именам; `registry.ts`/`page.tsx` — сверить перед правкой; `src/api/schema.ts` (изменён пользователем) НЕ трогать.
8. **build меняет `public/sw.js`** (bump SW_VERSION) — это существующее поведение, к L1 не относится; не коммитить как часть L1.
9. **Ревизии (revisions) в снимок НЕ кладём** — осознанно, как медиа/аннотации: онлайн-страница лекции их списком не грузит; для read-снимка не нужны.
10. **Кнопка на `useState`** не читает фактический статус из IndexedDB: после перемонтирования/повторного захода покажет «Сохранить офлайн» снова (даже если уже сохранено). Приемлемо для L1; «уже сохранено»-индикатор — после L2 (есть `getSavedBundle`).
