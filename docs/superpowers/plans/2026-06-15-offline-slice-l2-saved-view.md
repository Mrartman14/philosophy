# Offline Slice L2 — просмотр сохранённой лекции офлайн (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Замкнуть офлайн-чтение лекции end-to-end: раздел `/saved` (список сохранённого) + `/saved/[id]` (`SavedLectureView` — рендер снимка из IndexedDB: заголовок + описание + документы + комментарии). Это первая видимая офлайн-фича (сохранил лекцию в L1 → открыл `/saved` офлайн → читаешь).

**Architecture:** Client-компоненты в `src/app/saved/**` читают IndexedDB (`getSavedBundle`/`listSavedBundles` из foundation-стора) и рендерят снимок переиспользуя изоморфные `AstRender` (документы) и `CommentTreeView` (комменты, F2). Server-страницы — тонкие обёртки. Снимок хранится как `unknown` (generic `SavedBundleRecord`), вид кастит его к `LectureSnapshot` (тип из L1-дескриптора, `import type` — стирается, server-only не утекает). Картинки офлайн отдаёт SW из `flbz-offline-images` (F1). На входе в `/saved` подметаются зависшие `saving`→error.

**Tech Stack:** Next 16 App Router (server page → client island), React 19 (`useState`+`useEffect` для async-чтения IDB), TypeScript 6 strict, vitest 4 + @testing-library/react (jsdom, globals:false) + `fake-indexeddb`.

---

## Контекст и текущее состояние (прочитать перед стартом)

**Что готово (переиспользуем, НЕ меняем):**
- **L1:** `lectureDescriptor` пишет снимок `LectureSnapshot { lecture: Lecture; tags: Tag[]; documents: LectureDocument[]; comments: RootSubtree[] }` (экспортирован из `src/app/_offline/descriptors/lecture-descriptor.ts`, файл `import "server-only"`). Кнопка saveOffline уже на странице лекции.
- **F4 store** (`src/services/offline/store/saved-bundles.ts`, browser-only): `listSavedBundles(): Promise<SavedBundleRecord[]>`, `listSavedBundlesByStatus(status): Promise<SavedBundleRecord[]>`, `getSavedBundle(entity, id): Promise<SavedBundleRecord | undefined>`, `updateSavedBundle(entity, id, patch): Promise<void>`. `SavedBundleRecord { key, entity, id, savedAt, schemaVersion, status: "saving"|"complete"|"error", error?, snapshot: unknown, imageKeys }`.
- **F2:** `CommentTreeView({ subtrees: RootSubtree[] })` экспортирован из `@/features/comments` — чистый изоморфный read-only рендер комментов (якорь = статичный `anchor.exact`, реакции = read-only сводка). `AstRender({ blocks, ctx? })` из `@/components/ast-render` — изоморфен (уже в client-дереве).
- **F1:** SW отдаёт `/static/files/*` из `flbz-offline-images` офлайн + дормантная app-shell-ветка `/saved*` (network-first в `flbz-shell`) — оживёт с появлением маршрута.
- `lectureCoverUrl(coverImageKey: string|null|undefined): string|null` экспортирован из `@/features/lectures` (→ `resolveStorageUrl`). `Skeleton({className})` в `@/components/ui`.
- Тип `LectureSnapshot`: **`import type` из server-only дескриптора в "use client" безопасен** — тип стирается компилятором (нет рантайм-импорта `server-only`), eslint-правила против этого нет (разведка подтвердила).

**Маршруты:** `src/app/saved/` НЕ существует. Модель — `src/app/lectures/[id]/page.tsx`: `interface Props { params: Promise<{id:string}> }`, `const { id } = await params;`. Root-layout уже оборачивает `ToastProvider`/`Toaster`/header.

**Тест-окружение:** vitest `globals:false` (явный импорт `describe/it/expect/beforeEach/afterEach`); RTL → `afterEach(cleanup)`; IndexedDB — `import "fake-indexeddb/auto"` + `beforeEach(() => { globalThis.indexedDB = new IDBFactory(); })` (как `src/services/offline/store/saved-bundles.test.ts`); сидинг через `putSavedBundle`. **Снимок в сторе — `unknown`**, поэтому фикстуры-снимки в тестах — обычные литералы (НЕ требуют обязательных полей `Comment`/`Lecture`, в отличие от F2/L1-фикстур; компонент кастит `unknown`→`LectureSnapshot` в рантайме). testing-library: только `screen`-queries (no-container/no-node-access — error; `getAttribute` на элементе из `getByRole` допустим, `.closest()` — нет). Без jest-dom matchers (`toBeTruthy`/`toBeNull`/`toBe`).

**Размещение:** client-компоненты кладём в `src/app/saved/` (co-located с маршрутами; НЕ в `src/components/*` — частично заморожен). app-уровень: импорт `@/features/*` разрешён (cross-feature-гард только для `src/features/*`).

**Навигация:** `next/link` (внутренний `RouterLink` ещё не реализован — только спека).

**Конвенции/заморозка:** kebab-case; НЕ трогать `src/api/schema.ts` (правка пользователя), `public/sw.js` (артефакт билда), `.env.development.local`, `src/app/layout.tsx`, `src/components/ui/*`, конфиги. `git add` по именам; параллельные агенты.

**Out of scope (YAGNI / позже):** мультиэнтити `/saved` (v1 — только `entity:"lectures"`, route `/saved/[id]` подразумевает `"lectures"`); кнопка «удалить из сохранённого» (есть `deleteSavedBundle`, но UI — позже); «уже сохранено»-индикатор на кнопке лекции (L1-кнопка не читает IDB-статус); индикатор офлайн/онлайн; ревизии; рендер медиа лекции (в снимке их нет). Заголовок лекции офлайн — минимальный (без glossary-suggest `LectureDescription` и без tag-ссылок: офлайн они мертвы), `description` как plain-текст.

---

## Файловая структура

- **Create:** `src/app/saved/page.tsx` — server-обёртка списка.
- **Create:** `src/app/saved/saved-list.tsx` (+ `.test.tsx`) — client-список + подметание `saving`.
- **Create:** `src/app/saved/[id]/page.tsx` — server-обёртка деталей (`await params`).
- **Create:** `src/app/saved/saved-lecture-view.tsx` (+ `.test.tsx`) — client-рендер снимка.

---

## Task 1: `/saved` — список сохранённого + подметание `saving`

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

function seed(id: string, status: "complete" | "saving", title: string) {
  return putSavedBundle({
    entity: "lectures",
    id,
    savedAt: "2026-06-14T00:00:00.000Z",
    schemaVersion: 1,
    status,
    snapshot: { lecture: { title }, tags: [], documents: [], comments: [] },
    imageKeys: [],
  });
}

describe("SavedList", () => {
  it("показывает complete-лекции со ссылкой на /saved/[id]", async () => {
    await seed("l1", "complete", "Лекция один");
    render(<SavedList />);
    const link = await screen.findByRole("link", { name: "Лекция один" });
    expect(link.getAttribute("href")).toBe("/saved/l1");
  });

  it("подметает зависшие saving→error и не показывает их", async () => {
    await seed("l2", "saving", "Недосохранённая");
    render(<SavedList />);
    await waitFor(async () => {
      const rec = await getSavedBundle("lectures", "l2");
      expect(rec?.status).toBe("error");
    });
    expect(screen.queryByText("Недосохранённая")).toBeNull();
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

function toItem(rec: SavedBundleRecord): SavedItem {
  const snap = rec.snapshot as LectureSnapshot;
  return { id: rec.id, title: snap.lecture.title };
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
        .map(toItem);
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
Expected: PASS (3 теста).

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
git commit -m "feat(offline/saved): /saved list with stale-saving sweep (L2 task 1)"
```

---

## Task 2: `/saved/[id]` — SavedLectureView (рендер снимка)

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
import { CommentTreeView } from "@/features/comments";
import { lectureCoverUrl } from "@/features/lectures";
import { getSavedBundle } from "@/services/offline/store/saved-bundles";

type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "incomplete"; status: string; error: string | undefined }
  | { kind: "ready"; snapshot: LectureSnapshot };

export function SavedLectureView({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rec = await getSavedBundle("lectures", id);
      if (cancelled) return;
      if (!rec) {
        setState({ kind: "missing" });
      } else if (rec.status !== "complete") {
        setState({ kind: "incomplete", status: rec.status, error: rec.error });
      } else {
        setState({ kind: "ready", snapshot: rec.snapshot as LectureSnapshot });
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

  const { lecture, tags, documents, comments } = state.snapshot;
  const coverUrl = lectureCoverUrl(lecture.cover_image_key ?? null);

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
            {tags.map((t, i) => (
              <li
                key={t.name ?? i}
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

> Сверки typecheck: `Tag.name` (используется как ключ/текст — в `LectureDetail` так же), `LectureDocument.filename?`/`blocks?`, `lecture.cover_image_alt?`/`description`. Если `tags`/`description` дадут `no-unnecessary-condition` — поле опционально/строка может быть пустой, условие осмысленно (правило не сработает).

- [ ] **Step 4: Прогон — зелёный**

Run: `pnpm exec vitest run src/app/saved/saved-lecture-view.test.tsx`
Expected: PASS (3 теста).

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
Expected: lint 0, typecheck 0, тесты PASS (6).

```bash
git add src/app/saved/saved-lecture-view.tsx src/app/saved/saved-lecture-view.test.tsx "src/app/saved/[id]/page.tsx"
git commit -m "feat(offline/saved): /saved/[id] SavedLectureView renders snapshot (L2 task 2)"
```

---

## Финальная проверка (полный гейт)

- [ ] **Step 1: Прогон всего гейта**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected:
- `lint` 0, `typecheck` 0.
- `test` — все зелёные, +6 тестов (SavedList 3, SavedLectureView 3).
- `build` — успешно; маршруты `/saved` и `/saved/[id]` компилируются (client-острова в server-обёртках; чтение IDB только в `useEffect`, SSR рендерит loading).

- [ ] **Step 2: Смоук (если есть браузер; иначе зафиксировать как не прогнанное)**

Онлайн: сохранить лекцию (кнопка L1) → перейти на `/saved` → увидеть её в списке → открыть `/saved/[id]` → заголовок/описание/документы/комментарии/обложка отрендерены. Затем DevTools → Network → Offline → перезагрузить `/saved/[id]` → SW отдаёт shell + картинки из `flbz-offline-images` (F1), вид читает снимок из IndexedDB. Проверить подметание: прервать сохранение (оставить `saving`), зайти на `/saved` → запись помечается error и не показывается.

---

## Self-Review (автор плана)

**Покрытие L2:** список `/saved` + подметание `saving` (Task 1) + `/saved/[id]` рендер снимка (Task 2). Замыкает офлайн-чтение лекции end-to-end (L1 пишет → L2 читает; F1 SW отдаёт картинки/shell; F2 рендерит комменты).

**Тип-консистентность:** `LectureSnapshot` (из L1) — единый источник формы; `SavedList`/`SavedLectureView` кастят `rec.snapshot as LectureSnapshot`; пропсы `SavedLectureView({id})`, `CommentTreeView({subtrees})`, `AstRender({blocks})` совпадают с реализациями.

**Плейсхолдеры:** нет — код дословный, команды с ожидаемым выводом.

**Риски/допущения:**
1. **`import type { LectureSnapshot }` из server-only дескриптора в "use client"** — безопасно (тип стирается, нет рантайм-импорта `server-only`; eslint-правила нет; разведка подтвердила). Если сборка неожиданно потащит модуль — фолбэк: вынести интерфейс в `src/services/offline/contract/lecture-snapshot.ts` (без server-only) и импортировать оттуда и в дескрипторе, и здесь.
2. **Снимок в сторе — `unknown`** → тест-фикстуры это обычные литералы (НЕ нужны обязательные поля `Comment`/`Lecture`, в отличие от F2/L1); каст `unknown→LectureSnapshot` в компоненте. F2-граблей с required-полями здесь НЕТ.
3. **Чтение IDB в client + SSR:** стор-функции вызываются только в `useEffect` (клиент); SSR рендерит loading-Skeleton (на сервере IDB нет). Импорт `idb`-стора на сервере безопасен (вызов — только в эффекте). Офлайн `/saved*` отдаёт SW-shell (F1, дормантная ветка оживает).
4. **testing-library:** только `screen`-queries; `findByRole("link").getAttribute("href")` — чтение атрибута на queried-элементе (НЕ node-traversal, no-node-access не сработает); без jest-dom (`toBe`/`toBeTruthy`/`toBeNull`). Сидинг — `fake-indexeddb/auto` + `new IDBFactory()` в beforeEach (образец `saved-bundles.test.ts`).
5. **Заголовок офлайн — минимальный** (не `LectureDetail`): без glossary-suggest (server-action, офлайн мёртв) и без tag-ссылок (навигация на `/lectures` офлайн мертва). `description` — plain-текст. Осознанный read-only-вид (как F2 для комментов).
6. **v1 — только lectures:** `/saved/[id]` подразумевает `entity:"lectures"`; список фильтрует `entity==="lectures"`. Мультиэнтити — будущее (route `/saved/[entity]/[id]`).
7. **Параллельные агенты:** `git add` по именам; `src/api/schema.ts`/`public/sw.js`/`.env.development.local` НЕ трогать; `public/sw.js` бампится билдом — не коммитить как часть L2.
8. **`Tag.name`/`doc.id` как key:** `key={t.name ?? i}` / `key={doc.id ?? i}` — фолбэк на индекс, если поле опционально.
