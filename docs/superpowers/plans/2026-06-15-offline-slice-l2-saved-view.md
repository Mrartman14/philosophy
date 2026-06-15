# Offline Slice L2 — просмотр сохранённой лекции офлайн (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Замкнуть офлайн-чтение лекции end-to-end: раздел `/saved` (список сохранённого) + `/saved/[id]` (`SavedLectureView` — рендер снимка из IndexedDB). Первая видимая офлайн-фича (сохранил в L1 → открыл `/saved` офлайн → читаешь).

**Architecture:** Client-компоненты в `src/app/saved/**` читают IndexedDB и рендерят снимок, переиспользуя изоморфные `AstRender` (документы) и `CommentTreeView` (комменты, из client-safe entry `@/features/comments/client` — foundation). Server-страницы — тонкие обёртки. Снимок хранится как `unknown`; вид валидирует его рантайм-гардом перед рендером (каст не защищает). Картинки офлайн отдаёт SW из `flbz-offline-images` (F1). На входе в `/saved` подметаются зависшие `saving`→error.

**Tech Stack:** Next 16 App Router (server page → client island), React 19 (`useState`+`useEffect`), TypeScript 6 strict, vitest 4 + @testing-library/react (jsdom, globals:false) + `fake-indexeddb`.

---

## Контекст и текущее состояние (прочитать перед стартом)

**Готово (переиспользуем, НЕ меняем):**
- **L1:** `lectureDescriptor` пишет снимок `LectureSnapshot { lecture: Lecture; tags: Tag[]; documents: LectureDocument[]; comments: RootSubtree[] }` (экспорт `type` из `src/app/_offline/descriptors/lecture-descriptor.ts`, файл `import "server-only"` — но `import type` стирается, см. ниже). Кнопка saveOffline на странице лекции.
- **F4 store** (`src/services/offline/store/saved-bundles.ts`, browser-only): `listSavedBundles()`, `listSavedBundlesByStatus(status)`, `getSavedBundle(entity,id)`, `updateSavedBundle(entity,id,patch)`. `SavedBundleRecord { key, entity, id, savedAt, schemaVersion, status:"saving"|"complete"|"error", error?, snapshot: unknown, imageKeys }`.
- **Foundation (client-safe entry):** `CommentTreeView({ subtrees: RootSubtree[] })` экспортирован из **`@/features/comments/client`** (НЕ из barrel `@/features/comments` — тот тащит server-only). Импорт из client-кода `@/features/comments/client` разрешён guardrail'ами. `AstRender({ blocks, ctx? })` из `@/components/ast-render` — изоморфен.
- **F1:** SW отдаёт `/static/files/*` из `flbz-offline-images` офлайн + дормантная app-shell-ветка `/saved*` оживёт с маршрутом.
- `resolveStorageUrl(key)` из `@/utils/storage-url` (утилита, БЕЗ barrel) — для обложки/картинок. `Skeleton({className})` из `@/components/ui`.

**Критические уроки ревью L2 (учтены в этом плане):**
1. **НЕ импортить из barrel'ов фич в client-компоненте** — `@/features/comments`/`@/features/lectures` тащат `server-only` → build падает. Брать `CommentTreeView` из `@/features/comments/client`; обложку — через `resolveStorageUrl` (`@/utils`, не `lectureCoverUrl` из barrel lectures).
2. **`import type { LectureSnapshot }`** из server-only дескриптора в "use client" — безопасно (тип стирается; нет рантайм-импорта). СТРОГО `import type`, не `import`.
3. **`cancelled`-guard** в `useEffect` ловится `@typescript-eslint/no-unnecessary-condition` (TS видит литерал) → нужен `// eslint-disable-next-line` (паттерн проекта — `lecture-description.tsx:36`).
4. **`Tag.name` — required string** → `key={t.name}` (НЕ `?? i` — иначе no-unnecessary-condition).
5. **Снимок в сторе — `unknown`; каст `as LectureSnapshot` рантайм НЕ защищает.** Битая/устаревшая (`schemaVersion`-дрейф) complete-запись без `lecture.title` валит весь `/saved`. **Нужны рантайм-гарды** (`toItem` тотальный + `isLectureSnapshot` перед рендером).

**Тест-окружение:** vitest `globals:false` (явный импорт `describe/it/expect/beforeEach/afterEach`); RTL → `afterEach(cleanup)`; IndexedDB — `import "fake-indexeddb/auto"` + `beforeEach(() => { globalThis.indexedDB = new IDBFactory(); })`; сидинг через `putSavedBundle` (snapshot — `unknown`, фикстуры-литералы без обязательных полей). testing-library: только `screen`-queries (`findByRole("link").getAttribute("href")` ок; `.closest()` — нет). Без jest-dom (`toBe`/`toBeTruthy`/`toBeNull`).

**Размещение:** client-компоненты в `src/app/saved/` (co-located; не в frozen `components/*`). IDB только в `useEffect` (SSR рендерит loading). Навигация — `next/link`.

**Конвенции/заморозка:** kebab-case; НЕ трогать `src/api/schema.ts`/`public/sw.js`/`.env.development.local`/`src/app/layout.tsx`/`src/components/ui/*`/конфиги. `git add` по именам; параллельные агенты.

**Out of scope:** мультиэнтити `/saved` (v1 — `entity:"lectures"`); кнопка «удалить из сохранённого» (`deleteSavedBundle` есть, UI позже); индикатор офлайн/онлайн; ревизии; рендер медиа лекции. Inline ref-marks AST (glossary/lecture-ref) офлайн рендерятся как ссылки в никуда (AstRender не падает) — приемлемо v1.

---

## Файловая структура

- **Create:** `src/app/saved/page.tsx` — server-обёртка списка.
- **Create:** `src/app/saved/saved-list.tsx` (+ `.test.tsx`) — client-список + подметание `saving` + гард `toItem`.
- **Create:** `src/app/saved/[id]/page.tsx` — server-обёртка деталей (`await params`).
- **Create:** `src/app/saved/saved-lecture-view.tsx` (+ `.test.tsx`) — client-рендер снимка + гард формы.

---

## Task 1: `/saved` — список сохранённого + подметание + гард

**Files:**
- Create: `src/app/saved/saved-list.tsx`, `src/app/saved/saved-list.test.tsx`
- Create: `src/app/saved/page.tsx`

- [ ] **Step 1: Падающий тест**

Создать `src/app/saved/saved-list.test.tsx`:

```tsx
// src/app/saved/saved-list.test.tsx
import "fake-indexeddb/auto";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, it, expect } from "vitest";

import { putSavedBundle, getSavedBundle } from "@/services/offline/store/saved-bundles";

import { SavedList } from "./saved-list";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});
afterEach(cleanup);

function seed(id: string, status: "complete" | "saving", snapshot: unknown) {
  return putSavedBundle({
    entity: "lectures",
    id,
    savedAt: "2026-06-14T00:00:00.000Z",
    schemaVersion: 1,
    status,
    snapshot,
    imageKeys: [],
  });
}

describe("SavedList", () => {
  it("показывает complete-лекции со ссылкой на /saved/[id]", async () => {
    await seed("l1", "complete", { lecture: { title: "Лекция один" }, tags: [], documents: [], comments: [] });
    render(<SavedList />);
    const link = await screen.findByRole("link", { name: "Лекция один" });
    expect(link.getAttribute("href")).toBe("/saved/l1");
  });

  it("подметает зависшие saving→error и не показывает их", async () => {
    await seed("l2", "saving", { lecture: { title: "Недосохранённая" }, tags: [], documents: [], comments: [] });
    render(<SavedList />);
    await waitFor(async () => {
      const rec = await getSavedBundle("lectures", "l2");
      expect(rec?.status).toBe("error");
    });
    expect(screen.queryByText("Недосохранённая")).toBeNull();
  });

  it("битый complete-снимок (без lecture.title) не валит список", async () => {
    await seed("bad", "complete", { documents: [], comments: [] });
    await seed("ok", "complete", { lecture: { title: "Норм" }, tags: [], documents: [], comments: [] });
    render(<SavedList />);
    expect(await screen.findByText("Норм")).toBeTruthy();
  });

  it("пусто → подсказка", async () => {
    render(<SavedList />);
    expect(await screen.findByText(/Пока ничего не сохранено/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Прогон — падает**

Run: `pnpm exec vitest run src/app/saved/saved-list.test.tsx`
Expected: FAIL — модуль `./saved-list` не найден.

- [ ] **Step 3: Реализация `saved-list.tsx`**

Создать `src/app/saved/saved-list.tsx`:

```tsx
// src/app/saved/saved-list.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { LectureSnapshot } from "@/app/_offline/descriptors/lecture-descriptor";
import { Skeleton } from "@/components/ui";
import type { SavedBundleRecord } from "@/services/offline/contract/storage";
import {
  listSavedBundles,
  listSavedBundlesByStatus,
  updateSavedBundle,
} from "@/services/offline/store/saved-bundles";

interface SavedItem {
  id: string;
  title: string;
}

// Снимок в сторе — unknown; каст не защищает. Тотальный гард: невалидный → null (отфильтруем).
function toItem(rec: SavedBundleRecord): SavedItem | null {
  const snap = rec.snapshot as Partial<LectureSnapshot> | null;
  const title = snap?.lecture?.title;
  if (typeof title !== "string") return null;
  return { id: rec.id, title };
}

export function SavedList() {
  const [items, setItems] = useState<SavedItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Подмести зависшие "saving" (процесс умер между put и финальным update).
      const stale = await listSavedBundlesByStatus("saving");
      for (const rec of stale) {
        await updateSavedBundle(rec.entity, rec.id, {
          status: "error",
          error: "Сохранение прервано — откройте лекцию и сохраните заново.",
        });
      }
      const all = await listSavedBundles();
      const complete = all
        .filter((r) => r.status === "complete" && r.entity === "lectures")
        .map(toItem)
        .filter((it): it is SavedItem => it !== null);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- race guard, мутируется в cleanup
      if (!cancelled) setItems(complete);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Сохранённое офлайн</h1>
      {items.length === 0 ? (
        <p className="text-sm text-(--color-description)">
          Пока ничего не сохранено. Откройте лекцию и нажмите «Сохранить офлайн».
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={`/saved/${it.id}`}
                className="block rounded border border-(--color-border) p-3 hover:bg-(--color-text-pane)"
              >
                <span className="font-medium">{it.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Прогон — зелёный**

Run: `pnpm exec vitest run src/app/saved/saved-list.test.tsx`
Expected: PASS (4 теста).

- [ ] **Step 5: Server-страница `/saved`**

Создать `src/app/saved/page.tsx`:

```tsx
// src/app/saved/page.tsx
import { SavedList } from "./saved-list";

export const metadata = { title: "Сохранённое офлайн" };

export default function SavedListPage() {
  return <SavedList />;
}
```

- [ ] **Step 6: lint + typecheck + коммит**

Run: `pnpm lint && pnpm typecheck`
Expected: 0/0.

```bash
git add src/app/saved/saved-list.tsx src/app/saved/saved-list.test.tsx src/app/saved/page.tsx
git commit -m "feat(offline/saved): /saved list with stale-saving sweep + corrupt-snapshot guard (L2 task 1)"
```

---

## Task 2: `/saved/[id]` — SavedLectureView (рендер снимка + гард формы)

**Files:**
- Create: `src/app/saved/saved-lecture-view.tsx`, `src/app/saved/saved-lecture-view.test.tsx`
- Create: `src/app/saved/[id]/page.tsx`

- [ ] **Step 1: Падающий тест**

Создать `src/app/saved/saved-lecture-view.test.tsx`:

```tsx
// src/app/saved/saved-lecture-view.test.tsx
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, it, expect } from "vitest";

import { putSavedBundle } from "@/services/offline/store/saved-bundles";

import { SavedLectureView } from "./saved-lecture-view";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});
afterEach(cleanup);

// Снимок хранится как unknown → литерал не обязан удовлетворять полным типам.
const SNAPSHOT = {
  lecture: {
    id: "l1",
    title: "Заголовок лекции",
    date: "2026-01-01",
    description: "Описание лекции",
    owner_id: "o",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    visibility: "public",
  },
  tags: [{ name: "math" }],
  documents: [{ id: "d1", filename: "Документ 1", blocks: [] }],
  comments: [
    {
      root: {
        id: "c1",
        user_id: "u",
        lecture_id: "l1",
        type: "claim",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        author: { username: "alice" },
        blocks: [],
      },
      descendants: [],
    },
  ],
};

function seed(id: string, status: "complete" | "saving", snapshot: unknown) {
  return putSavedBundle({
    entity: "lectures",
    id,
    savedAt: "2026-06-14T00:00:00.000Z",
    schemaVersion: 1,
    status,
    snapshot,
    imageKeys: [],
  });
}

describe("SavedLectureView", () => {
  it("рендерит снимок: заголовок, описание, документ, комменты", async () => {
    await seed("l1", "complete", SNAPSHOT);
    render(<SavedLectureView id="l1" />);
    expect(await screen.findByText("Заголовок лекции")).toBeTruthy();
    expect(screen.getByText("Описание лекции")).toBeTruthy();
    expect(screen.getByText("Документ 1")).toBeTruthy();
    expect(screen.getByText("alice")).toBeTruthy(); // CommentTreeView → CommentNodeView
  });

  it("нет записи → «не сохранена»", async () => {
    render(<SavedLectureView id="missing" />);
    expect(await screen.findByText(/не сохранена офлайн/)).toBeTruthy();
  });

  it("status saving → «ещё сохраняется»", async () => {
    await seed("l2", "saving", SNAPSHOT);
    render(<SavedLectureView id="l2" />);
    expect(await screen.findByText(/ещё сохраняется/)).toBeTruthy();
  });

  it("битый complete-снимок → «повреждён», не падает", async () => {
    await seed("bad", "complete", { foo: 1 });
    render(<SavedLectureView id="bad" />);
    expect(await screen.findByText(/повреждён/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Прогон — падает**

Run: `pnpm exec vitest run src/app/saved/saved-lecture-view.test.tsx`
Expected: FAIL — модуль `./saved-lecture-view` не найден.

- [ ] **Step 3: Реализация `saved-lecture-view.tsx`**

Создать `src/app/saved/saved-lecture-view.tsx`:

```tsx
// src/app/saved/saved-lecture-view.tsx
"use client";

import { useEffect, useState } from "react";

import type { LectureSnapshot } from "@/app/_offline/descriptors/lecture-descriptor";
import { AstRender } from "@/components/ast-render";
import { Skeleton } from "@/components/ui";
import { CommentTreeView } from "@/features/comments/client";
import { getSavedBundle } from "@/services/offline/store/saved-bundles";
import { resolveStorageUrl } from "@/utils/storage-url";

type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "incomplete"; status: string; error: string | undefined }
  | { kind: "corrupt" }
  | { kind: "ready"; snapshot: LectureSnapshot };

// Снимок в сторе — unknown; рантайм-валидация минимальной формы перед рендером.
function isLectureSnapshot(s: unknown): s is LectureSnapshot {
  if (typeof s !== "object" || s === null) return false;
  const o = s as Record<string, unknown>;
  const lecture = o.lecture;
  return (
    typeof lecture === "object" &&
    lecture !== null &&
    typeof (lecture as Record<string, unknown>).title === "string" &&
    Array.isArray(o.tags) &&
    Array.isArray(o.documents) &&
    Array.isArray(o.comments)
  );
}

export function SavedLectureView({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rec = await getSavedBundle("lectures", id);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- race guard, мутируется в cleanup
      if (cancelled) return;
      if (!rec) {
        setState({ kind: "missing" });
      } else if (rec.status !== "complete") {
        setState({ kind: "incomplete", status: rec.status, error: rec.error });
      } else if (!isLectureSnapshot(rec.snapshot)) {
        setState({ kind: "corrupt" });
      } else {
        setState({ kind: "ready", snapshot: rec.snapshot });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.kind === "loading") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    );
  }
  if (state.kind === "missing") {
    return (
      <p className="mx-auto max-w-3xl p-6 text-sm text-(--color-description)">
        Эта лекция не сохранена офлайн.
      </p>
    );
  }
  if (state.kind === "incomplete") {
    return (
      <p className="mx-auto max-w-3xl p-6 text-sm text-(--color-description)">
        {state.status === "saving"
          ? "Лекция ещё сохраняется…"
          : `Сохранение не завершено: ${state.error ?? "ошибка"}.`}
      </p>
    );
  }
  if (state.kind === "corrupt") {
    return (
      <p className="mx-auto max-w-3xl p-6 text-sm text-(--color-description)">
        Сохранённый снимок повреждён или устарел — откройте лекцию онлайн и сохраните заново.
      </p>
    );
  }

  const { lecture, tags, documents, comments } = state.snapshot;
  const coverUrl = lecture.cover_image_key
    ? resolveStorageUrl(lecture.cover_image_key)
    : null;

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={lecture.cover_image_alt ?? ""}
            className="max-h-80 w-full rounded-lg object-cover"
          />
        )}
        <h1 className="text-3xl font-bold">{lecture.title}</h1>
        <p className="text-sm text-(--color-description)">{lecture.date}</p>
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <li
                key={t.name}
                className="rounded-full border border-(--color-border) px-2 py-0.5 text-xs text-(--color-description)"
              >
                {t.name}
              </li>
            ))}
          </ul>
        )}
        {lecture.description && (
          <div className="whitespace-pre-wrap text-base">{lecture.description}</div>
        )}
      </header>

      {documents.length > 0 && (
        <section className="flex flex-col gap-4">
          {documents.map((doc, i) => (
            <div key={doc.id ?? i} className="flex flex-col gap-2">
              {doc.filename && (
                <h2 className="text-xl font-semibold">{doc.filename}</h2>
              )}
              <div className="prose prose-sm max-w-none">
                <AstRender blocks={doc.blocks ?? []} />
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3" aria-label="Комментарии">
        <h2 className="text-xl font-semibold">Комментарии</h2>
        <CommentTreeView subtrees={comments} />
      </section>
    </article>
  );
}
```

> Сверки typecheck: `Tag.name` required (`key={t.name}` без `?? i`); `LectureDocument.id?`/`filename?`/`blocks?` опц. (`?? i`/`&&`/`?? []` осмысленны); `lecture.cover_image_key?`/`cover_image_alt?` опц. `import type { LectureSnapshot }` — СТРОГО `type` (иначе server-only утечёт). `CommentTreeView` — из `@/features/comments/client`, НЕ из barrel.

- [ ] **Step 4: Прогон — зелёный**

Run: `pnpm exec vitest run src/app/saved/saved-lecture-view.test.tsx`
Expected: PASS (4 теста).

- [ ] **Step 5: Server-страница `/saved/[id]`**

Создать `src/app/saved/[id]/page.tsx`:

```tsx
// src/app/saved/[id]/page.tsx
import { SavedLectureView } from "../saved-lecture-view";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SavedLecturePage({ params }: Props) {
  const { id } = await params;
  return <SavedLectureView id={id} />;
}
```

- [ ] **Step 6: lint + typecheck + коммит**

Run: `pnpm lint && pnpm typecheck && pnpm exec vitest run src/app/saved/`
Expected: lint 0, typecheck 0, тесты PASS (8).

```bash
git add src/app/saved/saved-lecture-view.tsx src/app/saved/saved-lecture-view.test.tsx "src/app/saved/[id]/page.tsx"
git commit -m "feat(offline/saved): /saved/[id] SavedLectureView renders snapshot with corrupt-guard (L2 task 2)"
```

---

## Финальная проверка (полный гейт)

- [ ] **Step 1: Прогон всего гейта**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected:
- `lint` 0, `typecheck` 0.
- `test` — все зелёные, +8 тестов (SavedList 4, SavedLectureView 4).
- `build` — **успешно**; критично: `CommentTreeView` из `@/features/comments/client` НЕ тянет server-only → нет ошибки «server-only cannot be imported from a Client Component» (это end-to-end build-верификация foundation). Маршруты `/saved` и `/saved/[id]` компилируются (client-острова, IDB в `useEffect`, SSR → loading).

- [ ] **Step 2: Смоук (если есть браузер; иначе зафиксировать как не прогнанное)**

Онлайн: сохранить лекцию (L1) → `/saved` → увидеть в списке → `/saved/[id]` → заголовок/описание/документы/комментарии/обложка. Затем Offline → перезагрузить `/saved/[id]` → SW отдаёт shell (F1, сначала зайти онлайн чтобы закешировать) + картинки из `flbz-offline-images`; вид читает снимок из IDB. Проверить подметание (прервать сохранение → `/saved` помечает error, не показывает).

---

## Self-Review (автор плана, после foundation + ревью L2)

**Покрытие L2:** `/saved` + подметание `saving` + гард `toItem` (Task 1) + `/saved/[id]` рендер снимка + гард формы (Task 2). Замыкает офлайн-чтение end-to-end (L1 пишет → L2 читает; F1 SW; F2/foundation рендерят комменты).

**Тип-консистентность:** `LectureSnapshot` (L1) — источник формы; гарды (`toItem`/`isLectureSnapshot`) валидируют `unknown`-снимок рантайм. `SavedLectureView({id})`, `CommentTreeView({subtrees})`, `AstRender({blocks})` совпадают с реализациями.

**Плейсхолдеры:** нет — код дословный, команды с ожидаемым выводом.

**Риски/допущения (учтены правки ревью):**
1. **Barrel→server-only (был Critical) — закрыт:** `CommentTreeView` из `@/features/comments/client` (foundation), обложка через `resolveStorageUrl` (`@/utils`, не barrel lectures). build не упадёт по server-only.
2. **`import type { LectureSnapshot }`** — строго type (стирается); в шаге сверки помечено.
3. **lint (были 2 блокера) — закрыты:** `cancelled`-guard с `eslint-disable` (паттерн проекта); `key={t.name}` (Tag.name required).
4. **Битый/устаревший снимок (был Critical) — закрыт:** `toItem` тотальный (невалидный → отфильтрован), `isLectureSnapshot` перед `ready` (иначе `corrupt`-состояние). Тесты на это добавлены (Task 1 «битый не валит список», Task 2 «повреждён»).
5. **`import/order`** реэкспорты/импорты: группы external→`@/`(alpha: app<components<features<services<utils)→sibling; сверено.
6. **testing-library:** `findByRole("link").getAttribute` — чтение атрибута, не traversal; `fake-indexeddb/auto`+`IDBFactory`. Без jest-dom.
7. **v1 — только lectures.** Удаление/индикатор офлайн/ревизии — отложены. error-запись остаётся в IDB (фантом до пересохранения) — приемлемо v1. Inline ref-marks офлайн = ссылки в никуда (не падают).
8. **Параллельные агенты:** `git add` по именам; не трогать schema.ts/sw.js/.env.
