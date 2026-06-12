# AST Editor — Phase 2b — Pickers + Nav-mark Insertion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать редактору способ вставлять navigation-marks (`lecture_ref`, `glossary_ref`, `document_ref`, `media_ref`, `canvas_ref`, `comment_ref`). Это включает: универсальный async-combobox с q-search и pagination, шесть пикеров (по одному на категорию), 2-stage picker для `comment_ref` (выбор лекции → выбор комментария), и ref-menu — gateway-Popover, который соединяет выделение в редакторе с пикерами и вставляет mark с UUID.

**Architecture:** AsyncCombobox — primitive над `@base-ui/react/popover` (Combobox в base-ui отсутствует, строим из popover+input+listbox). Каждый picker — обёртка с конкретным fetcher'ом и renderItem. RefMenu — Popover, открывается toolbar-кнопкой или `@`-trigger'ом (последний — Phase 2c). Insert mark выполняется через `editor.chain().focus().setMark(name, { id }).run()`. Сам editor этим планом НЕ модифицируется — RefMenu принимает `editor: Editor` пропом.

**Tech Stack:** `@base-ui/react/popover`, нативный input для q-search, server actions (`"use server"` + `createApiClient()` — конвенция проекта), `vi.mock` для подмены actions в тестах.

---

## Parallel-safety contract

Этот план собирается в собственном worktree параллельно с **2a (Image)** и **2c (Toolbar/Polish)**.

**Создаёт ТОЛЬКО новые файлы** (полное отсутствие file-collision):

```
src/components/ast-editor/
├── pickers/
│   ├── async-combobox.tsx
│   ├── async-combobox.test.tsx
│   ├── actions.ts                       # "use server" — server actions (search* per category)
│   ├── lecture-picker.tsx
│   ├── glossary-picker.tsx
│   ├── document-picker.tsx
│   ├── media-picker.tsx
│   ├── canvas-picker.tsx
│   ├── comment-picker.tsx
│   ├── comment-2stage-picker.tsx
│   ├── pickers.test.tsx                 # один файл с msw на все 6 пикеров
│   ├── ref-menu.tsx                     # gateway: editor + pickers
│   └── ref-menu.test.tsx
```

**НЕ модифицирует** ни одного существующего файла. Public API (`src/components/ast-editor/index.ts`) тоже не трогает (toolbar в 2c импортирует ref-menu по deep-path внутри слайса).

**Frozen zones** (CLAUDE.md): `src/api/schema.ts`, `src/utils/*`, `src/components/ui/*`, `package.json` — не трогать.

**Параллельная работа агентов** (CLAUDE.md): запрещены `git stash/reset/checkout./clean`, `git add -A/.`, перезапись чужих изменений. Все коммиты — `git add` по именам файлов.

---

## Контракт API

Все picker-эндпоинты совпадают по форме. Реальные типы из `src/api/schema.ts` (проверено):

| Категория | Endpoint | Query | Response data type | Поля для рендера |
|---|---|---|---|---|
| lecture    | `GET /api/lectures`                        | `q?, offset?, limit?, tag?`               | `lecture.Lecture[]`         | `title` |
| glossary   | `GET /api/glossary`                        | `q?, offset?, limit?`                      | `glossary.Term[]`           | `title` |
| document   | `GET /api/documents`                       | `q?, offset?, limit?`                      | `document.DocumentSummary[]`| `filename` |
| media      | `GET /api/media`                           | `q?, type?(video\|audio), offset?, limit?` | `media.MediaSummary[]`      | `filename` |
| canvas     | `GET /api/canvases`                        | `q?, offset?, limit?`                      | `canvas.CanvasSummary[]`    | `title` |
| comment    | `GET /api/lectures/{id}/comments/search`   | `q?, offset?, limit?`                      | `comment.CommentSummary[]`  | `snippet` |

**ВАЖНО:**

- `lecture.LectureSummary` и `glossary.GlossarySummary` **не существуют** в схеме. Использовать полные типы `lecture.Lecture` и `glossary.Term`.
- `httputil.ListResponse` имеет форму `{ data?, pagination?: { limit?, offset?, total? } }`. `total` лежит на `pagination.total`, **не** на верхнем уровне.
- `comment.CommentSummary` имеет поле `snippet` (не `excerpt`/`body`).
- `document.DocumentSummary` имеет только `filename` (без `title`).

---

## Task 1: AsyncCombobox primitive

**Files:**
- Create: `src/components/ast-editor/pickers/async-combobox.tsx`
- Test: `src/components/ast-editor/pickers/async-combobox.test.tsx`

**Behaviour:**
- Input для query, debounced 200мс.
- Под input — listbox с результатами. Каждый item рендерится через `renderItem`.
- Pagination: «Загрузить ещё» button в конце листа, если `total > loaded.length`.
- Состояния: loading (skeleton), empty («ничего не найдено»), error («ошибка загрузки», retry).
- Keyboard: ArrowDown / ArrowUp по items, Enter — `onSelect(item)`, Esc — onClose.
- Focus management: input autofocuses on mount, селект по item возвращает focus родителю через onSelect.

**Public surface:**

```ts
interface AsyncComboboxProps<T> {
  fetcher: (q: string, offset: number, limit: number) => Promise<{ data: T[]; total?: number }>;
  renderItem: (item: T, isActive: boolean) => React.ReactNode;
  getKey: (item: T) => string;
  onSelect: (item: T) => void;
  placeholder?: string;
  /** Default 20. */
  pageSize?: number;
  /** Override empty/error/loading copy. */
  copy?: { empty?: string; error?: string; loading?: string };
}
```

- [ ] **Step 1: Failing test (q-debounce + render)**

```tsx
// src/components/ast-editor/pickers/async-combobox.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen, waitFor, cleanup } from "@testing-library/react";
import { AsyncCombobox } from "./async-combobox";

afterEach(cleanup);

interface Item { id: string; name: string }

describe("AsyncCombobox", () => {
  it("debounces fetcher and renders items", async () => {
    const fetcher = vi.fn(async (q: string, offset: number, limit: number) => ({
      data: [{ id: "1", name: `match-${q}` }, { id: "2", name: "other" }],
      total: 2,
    }));
    render(
      <AsyncCombobox<Item>
        fetcher={fetcher}
        renderItem={(it) => <span>{it.name}</span>}
        getKey={(it) => it.id}
        onSelect={() => undefined}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "abc" } });
    // before debounce, no fetch
    expect(fetcher).not.toHaveBeenCalled();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1), { timeout: 400 });
    expect(fetcher.mock.calls[0]![0]).toBe("abc");
    expect(await screen.findByText("match-abc")).toBeInTheDocument();
  });

  it("Enter selects active item", async () => {
    const onSelect = vi.fn();
    const fetcher = async () => ({ data: [{ id: "x", name: "X" }], total: 1 });
    render(
      <AsyncCombobox<Item>
        fetcher={fetcher}
        renderItem={(it) => <span>{it.name}</span>}
        getKey={(it) => it.id}
        onSelect={onSelect}
      />,
    );
    await screen.findByText("X");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith({ id: "x", name: "X" });
  });

  it("shows empty state when fetcher returns no items", async () => {
    const fetcher = async () => ({ data: [] as Item[], total: 0 });
    render(
      <AsyncCombobox<Item>
        fetcher={fetcher}
        renderItem={() => null}
        getKey={() => "k"}
        onSelect={() => undefined}
      />,
    );
    expect(await screen.findByText(/ничего не найдено/i)).toBeInTheDocument();
  });

  it("error state shows retry", async () => {
    const fetcher = vi.fn(async () => { throw new Error("boom"); });
    render(
      <AsyncCombobox<Item>
        fetcher={fetcher}
        renderItem={() => null}
        getKey={() => "k"}
        onSelect={() => undefined}
      />,
    );
    expect(await screen.findByText(/ошибка/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /повторить/i }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it("Load more appends next page", async () => {
    const fetcher = vi.fn(async (q: string, offset: number) => ({
      data: [{ id: `${offset}-a`, name: `${offset}A` }, { id: `${offset}-b`, name: `${offset}B` }],
      total: 4,
    }));
    render(
      <AsyncCombobox<Item>
        fetcher={fetcher}
        renderItem={(it) => <span>{it.name}</span>}
        getKey={(it) => it.id}
        onSelect={() => undefined}
        pageSize={2}
      />,
    );
    await screen.findByText("0A");
    fireEvent.click(screen.getByRole("button", { name: /загрузить ещё/i }));
    await screen.findByText("2A");
    expect(fetcher.mock.calls[1]![1]).toBe(2);
  });
});
```

- [ ] **Step 2: Запустить тест — fail (нет компонента)**

Run: `npx vitest run src/components/ast-editor/pickers/async-combobox.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализация**

```tsx
// src/components/ast-editor/pickers/async-combobox.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export interface AsyncComboboxProps<T> {
  fetcher: (q: string, offset: number, limit: number) => Promise<{ data: T[]; total?: number }>;
  renderItem: (item: T, isActive: boolean) => React.ReactNode;
  getKey: (item: T) => string;
  onSelect: (item: T) => void;
  placeholder?: string;
  pageSize?: number;
  copy?: { empty?: string; error?: string; loading?: string };
}

interface State<T> {
  items: T[];
  total: number | null;
  loading: boolean;
  error: string | null;
}

export function AsyncCombobox<T>(props: AsyncComboboxProps<T>) {
  const pageSize = props.pageSize ?? 20;
  const empty = props.copy?.empty ?? "Ничего не найдено";
  const errorCopy = props.copy?.error ?? "Ошибка загрузки";
  const loadingCopy = props.copy?.loading ?? "Загрузка…";

  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [s, setS] = useState<State<T>>({ items: [], total: null, loading: false, error: null });
  const inputRef = useRef<HTMLInputElement>(null);

  // debounce q
  const debouncedQ = useDebounced(q, 200);

  const load = async (qNow: string, offset: number) => {
    setS((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const { data, total } = await props.fetcher(qNow, offset, pageSize);
      setS((prev) => ({
        items: offset === 0 ? data : prev.items.concat(data),
        total: total ?? null,
        loading: false,
        error: null,
      }));
    } catch (e) {
      setS((prev) => ({ ...prev, loading: false, error: e instanceof Error ? e.message : errorCopy }));
    }
  };

  useEffect(() => {
    setActive(0);
    void load(debouncedQ, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, s.items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const item = s.items[active];
      if (item) props.onSelect(item);
    }
  };

  const canLoadMore = s.total !== null && s.items.length < s.total && !s.loading;

  return (
    <div className="async-combobox">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded
        aria-controls="async-combobox-list"
        type="text"
        value={q}
        placeholder={props.placeholder}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKey}
      />
      <ul id="async-combobox-list" role="listbox">
        {s.items.map((item, i) => (
          <li
            key={props.getKey(item)}
            role="option"
            aria-selected={active === i}
            onMouseDown={(e) => { e.preventDefault(); props.onSelect(item); }}
            onMouseEnter={() => setActive(i)}
          >
            {props.renderItem(item, active === i)}
          </li>
        ))}
        {!s.loading && s.items.length === 0 && !s.error && <li role="presentation">{empty}</li>}
        {s.loading && <li role="presentation">{loadingCopy}</li>}
        {s.error && (
          <li role="presentation">
            {errorCopy}
            <button type="button" onClick={() => void load(debouncedQ, 0)}>Повторить</button>
          </li>
        )}
        {canLoadMore && (
          <li role="presentation">
            <button type="button" onClick={() => void load(debouncedQ, s.items.length)}>
              Загрузить ещё
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
```

- [ ] **Step 4: Прогнать — все 5 тестов PASS**

Run: `npx vitest run src/components/ast-editor/pickers/async-combobox.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-editor/pickers/async-combobox.tsx src/components/ast-editor/pickers/async-combobox.test.tsx
git commit -m "feat(ast-editor): add AsyncCombobox primitive with q-debounce and pagination"
```

---

## Task 2: actions.ts — 6 server actions

**Files:**
- Create: `src/components/ast-editor/pickers/actions.ts`

**Why server actions, not client-side fetch:** конвенция проекта (см. [src/features/lectures/actions.ts](../../src/features/lectures/actions.ts)) — все API-вызовы идут через `"use server"` actions с `createApiClient()`, которая читает JWT из cookie через `next/headers`. Прямой client-side `openapi-fetch` не пройдёт авторизацию (cookie HttpOnly) и нарушит конвенцию. Pickers — client components — импортируют actions и зовут как обычные async-функции, Next.js делает RPC.

**Why one file:** все 6 actions — однотипные обёртки. DRY.

- [ ] **Step 1: Реализация**

```ts
// src/components/ast-editor/pickers/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import type { components } from "@/api/schema";

export type Lecture = components["schemas"]["lecture.Lecture"];
export type GlossaryTerm = components["schemas"]["glossary.Term"];
export type DocumentSummary = components["schemas"]["document.DocumentSummary"];
export type MediaSummary = components["schemas"]["media.MediaSummary"];
export type CanvasSummary = components["schemas"]["canvas.CanvasSummary"];
export type CommentSummary = components["schemas"]["comment.CommentSummary"];

export interface PickerPage<T> { data: T[]; total: number | null }

type ApiError = { error?: string };

export async function searchLectures(q: string, offset: number, limit: number): Promise<PickerPage<Lecture>> {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/lectures", { params: { query: { q, offset, limit } } });
  if (error) throw new Error((error as ApiError).error ?? "Ошибка загрузки лекций");
  return { data: data?.data ?? [], total: data?.pagination?.total ?? null };
}

export async function searchGlossary(q: string, offset: number, limit: number): Promise<PickerPage<GlossaryTerm>> {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/glossary", { params: { query: { q, offset, limit } } });
  if (error) throw new Error((error as ApiError).error ?? "Ошибка загрузки глоссария");
  return { data: data?.data ?? [], total: data?.pagination?.total ?? null };
}

export async function searchDocuments(q: string, offset: number, limit: number): Promise<PickerPage<DocumentSummary>> {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/documents", { params: { query: { q, offset, limit } } });
  if (error) throw new Error((error as ApiError).error ?? "Ошибка загрузки документов");
  return { data: data?.data ?? [], total: data?.pagination?.total ?? null };
}

export async function searchMedia(
  q: string,
  offset: number,
  limit: number,
  type?: "video" | "audio",
): Promise<PickerPage<MediaSummary>> {
  const api = await createApiClient();
  const query: { q: string; offset: number; limit: number; type?: string } = { q, offset, limit };
  if (type) query.type = type;
  const { data, error } = await api.GET("/api/media", { params: { query } });
  if (error) throw new Error((error as ApiError).error ?? "Ошибка загрузки медиа");
  return { data: data?.data ?? [], total: data?.pagination?.total ?? null };
}

export async function searchCanvases(q: string, offset: number, limit: number): Promise<PickerPage<CanvasSummary>> {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/canvases", { params: { query: { q, offset, limit } } });
  if (error) throw new Error((error as ApiError).error ?? "Ошибка загрузки canvas");
  return { data: data?.data ?? [], total: data?.pagination?.total ?? null };
}

export async function searchCommentsByLecture(
  lectureId: string,
  q: string,
  offset: number,
  limit: number,
): Promise<PickerPage<CommentSummary>> {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/lectures/{id}/comments/search", {
    params: { path: { id: lectureId }, query: { q, offset, limit } },
  });
  if (error) throw new Error((error as ApiError).error ?? "Ошибка загрузки комментариев");
  return { data: data?.data ?? [], total: data?.pagination?.total ?? null };
}
```

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/pickers/actions.ts
git commit -m "feat(ast-editor): add picker server actions for 6 nav-mark categories"
```

---

## Task 3: 5 простых picker-обёрток (lecture, glossary, document, media, canvas)

**Files:**
- Create: `src/components/ast-editor/pickers/lecture-picker.tsx`
- Create: `src/components/ast-editor/pickers/glossary-picker.tsx`
- Create: `src/components/ast-editor/pickers/document-picker.tsx`
- Create: `src/components/ast-editor/pickers/media-picker.tsx`
- Create: `src/components/ast-editor/pickers/canvas-picker.tsx`

**Контракт каждого picker'а:**

```ts
interface PickerProps {
  onSelect: (id: string) => void;
}
```

Каждый — обёртка `<AsyncCombobox fetcher={fetchX} renderItem={…} getKey={…} onSelect={(item) => onSelect(item.id)} />`. Только `MediaPicker` дополнительно — radio-фильтр type=video|audio|all.

- [ ] **Step 1: LecturePicker**

```tsx
// src/components/ast-editor/pickers/lecture-picker.tsx
"use client";
import { AsyncCombobox } from "./async-combobox";
import { searchLectures, type Lecture } from "./actions";

export interface LecturePickerProps { onSelect: (id: string) => void }

export function LecturePicker({ onSelect }: LecturePickerProps) {
  return (
    <AsyncCombobox<Lecture>
      fetcher={searchLectures}
      renderItem={(l) => <span>{l.title}</span>}
      getKey={(l) => l.id}
      onSelect={(l) => onSelect(l.id)}
      placeholder="Поиск лекции…"
    />
  );
}
```

- [ ] **Step 2: GlossaryPicker**

```tsx
// src/components/ast-editor/pickers/glossary-picker.tsx
"use client";
import { AsyncCombobox } from "./async-combobox";
import { searchGlossary, type GlossaryTerm } from "./actions";

export interface GlossaryPickerProps { onSelect: (id: string) => void }

export function GlossaryPicker({ onSelect }: GlossaryPickerProps) {
  return (
    <AsyncCombobox<GlossaryTerm>
      fetcher={searchGlossary}
      renderItem={(g) => <span>{g.title ?? "—"}</span>}
      getKey={(g) => g.id ?? ""}
      onSelect={(g) => g.id && onSelect(g.id)}
      placeholder="Поиск термина…"
    />
  );
}
```

- [ ] **Step 3: DocumentPicker**

```tsx
// src/components/ast-editor/pickers/document-picker.tsx
"use client";
import { AsyncCombobox } from "./async-combobox";
import { searchDocuments, type DocumentSummary } from "./actions";

export interface DocumentPickerProps { onSelect: (id: string) => void }

export function DocumentPicker({ onSelect }: DocumentPickerProps) {
  return (
    <AsyncCombobox<DocumentSummary>
      fetcher={searchDocuments}
      renderItem={(d) => <span>{d.filename ?? "—"}</span>}
      getKey={(d) => d.id ?? ""}
      onSelect={(d) => d.id && onSelect(d.id)}
      placeholder="Поиск документа…"
    />
  );
}
```

- [ ] **Step 4: MediaPicker (с type-фильтром)**

```tsx
// src/components/ast-editor/pickers/media-picker.tsx
"use client";
import { useState } from "react";
import { AsyncCombobox } from "./async-combobox";
import { searchMedia, type MediaSummary } from "./actions";

export interface MediaPickerProps { onSelect: (id: string) => void }

export function MediaPicker({ onSelect }: MediaPickerProps) {
  const [type, setType] = useState<"video" | "audio" | undefined>(undefined);
  const fetcher = (q: string, offset: number, limit: number) => searchMedia(q, offset, limit, type);
  return (
    <div>
      <fieldset>
        <legend>Тип</legend>
        <label><input type="radio" name="media-type" checked={type === undefined} onChange={() => setType(undefined)} /> все</label>
        <label><input type="radio" name="media-type" checked={type === "video"} onChange={() => setType("video")} /> видео</label>
        <label><input type="radio" name="media-type" checked={type === "audio"} onChange={() => setType("audio")} /> аудио</label>
      </fieldset>
      <AsyncCombobox<MediaSummary>
        fetcher={fetcher}
        renderItem={(m) => <span>{m.filename ?? "—"}</span>}
        getKey={(m) => m.id ?? ""}
        onSelect={(m) => m.id && onSelect(m.id)}
        placeholder="Поиск медиа…"
      />
    </div>
  );
}
```

- [ ] **Step 5: CanvasPicker**

```tsx
// src/components/ast-editor/pickers/canvas-picker.tsx
"use client";
import { AsyncCombobox } from "./async-combobox";
import { searchCanvases, type CanvasSummary } from "./actions";

export interface CanvasPickerProps { onSelect: (id: string) => void }

export function CanvasPicker({ onSelect }: CanvasPickerProps) {
  return (
    <AsyncCombobox<CanvasSummary>
      fetcher={searchCanvases}
      renderItem={(c) => <span>{c.title ?? "—"}</span>}
      getKey={(c) => c.id ?? ""}
      onSelect={(c) => c.id && onSelect(c.id)}
      placeholder="Поиск canvas…"
    />
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-editor/pickers/lecture-picker.tsx src/components/ast-editor/pickers/glossary-picker.tsx src/components/ast-editor/pickers/document-picker.tsx src/components/ast-editor/pickers/media-picker.tsx src/components/ast-editor/pickers/canvas-picker.tsx
git commit -m "feat(ast-editor): add 5 thin picker wrappers (lecture/glossary/document/media/canvas)"
```

---

## Task 4: CommentPicker + 2-stage orchestrator

**Files:**
- Create: `src/components/ast-editor/pickers/comment-picker.tsx`
- Create: `src/components/ast-editor/pickers/comment-2stage-picker.tsx`

**Comment picker (одноступенчатый, scoped к lectureId):**

```tsx
// src/components/ast-editor/pickers/comment-picker.tsx
"use client";
import { AsyncCombobox } from "./async-combobox";
import { searchCommentsByLecture, type CommentSummary } from "./actions";

export interface CommentPickerProps {
  lectureId: string;
  onSelect: (id: string) => void;
}

export function CommentPicker({ lectureId, onSelect }: CommentPickerProps) {
  const fetcher = (q: string, offset: number, limit: number) =>
    searchCommentsByLecture(lectureId, q, offset, limit);
  return (
    <AsyncCombobox<CommentSummary>
      fetcher={fetcher}
      renderItem={(c) => <span>{c.snippet ?? "—"}</span>}
      getKey={(c) => c.id ?? ""}
      onSelect={(c) => c.id && onSelect(c.id)}
      placeholder="Поиск комментария в выбранной лекции…"
    />
  );
}
```

**2-stage orchestrator** (см. design §6.4):

- Если `defaultLectureId` задан — стартуем со step 2, но даём `Сменить лекцию` для возврата на step 1.
- На step 1 — `LecturePicker`, на step 2 — `CommentPicker(lectureId=…)`.
- В mark пишется ТОЛЬКО `id` комментария (не лекции — см. design §6.4 «attrs»).

- [ ] **Step 1: Failing test**

```tsx
// дополнить позже в Task 5 (pickers.test.tsx).
```

- [ ] **Step 2: Реализация**

```tsx
// src/components/ast-editor/pickers/comment-2stage-picker.tsx
"use client";
import { useState } from "react";
import { LecturePicker } from "./lecture-picker";
import { CommentPicker } from "./comment-picker";

export interface Comment2StagePickerProps {
  defaultLectureId?: string | undefined;
  onSelect: (commentId: string) => void;
}

export function Comment2StagePicker({ defaultLectureId, onSelect }: Comment2StagePickerProps) {
  const [lectureId, setLectureId] = useState<string | undefined>(defaultLectureId);

  if (!lectureId) {
    return (
      <div>
        <p>Шаг 1: выберите лекцию</p>
        <LecturePicker onSelect={(id) => setLectureId(id)} />
      </div>
    );
  }
  return (
    <div>
      <button type="button" onClick={() => setLectureId(undefined)}>← Сменить лекцию</button>
      <p>Шаг 2: выберите комментарий</p>
      <CommentPicker lectureId={lectureId} onSelect={onSelect} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/pickers/comment-picker.tsx src/components/ast-editor/pickers/comment-2stage-picker.tsx
git commit -m "feat(ast-editor): add comment picker + 2-stage orchestrator (lecture → comment)"
```

---

## Task 5: Pickers integration test (vi.mock actions)

**Files:**
- Create: `src/components/ast-editor/pickers/pickers.test.tsx`

**Why vi.mock, not msw:** server actions зовут `createApiClient()` → `cookies()` из `next/headers`, что упадёт в jsdom без Next.js контекста. msw не помогает — он перехватывает HTTP, но проблема выше — на уровне `cookies()`. `vi.mock("./actions", ...)` подменяет модуль до резолва импортов в picker-компонентах. Это даёт чистые UI-тесты, а сами actions покрываются E2E (вне scope этого плана).

**Что покрываем:**
- LecturePicker: q-search → action вызывается с правильным q, рендер.
- MediaPicker: смена radio type → action вызывается с правильным `type`.
- Comment2StagePicker без defaultLectureId: видна step 1, после select — step 2; кнопка «Сменить лекцию» возвращает к step 1.
- Comment2StagePicker с defaultLectureId: сразу step 2.

- [ ] **Step 1: Тест**

```tsx
// src/components/ast-editor/pickers/pickers.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

vi.mock("./actions", () => ({
  searchLectures: vi.fn(),
  searchGlossary: vi.fn(),
  searchDocuments: vi.fn(),
  searchMedia: vi.fn(),
  searchCanvases: vi.fn(),
  searchCommentsByLecture: vi.fn(),
}));

import * as actions from "./actions";
import { LecturePicker } from "./lecture-picker";
import { MediaPicker } from "./media-picker";
import { Comment2StagePicker } from "./comment-2stage-picker";

const mocked = actions as unknown as {
  searchLectures: ReturnType<typeof vi.fn>;
  searchMedia: ReturnType<typeof vi.fn>;
  searchCommentsByLecture: ReturnType<typeof vi.fn>;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LecturePicker", () => {
  it("calls searchLectures with q and renders titles", async () => {
    mocked.searchLectures.mockResolvedValue({
      data: [{ id: "l1", title: "Античность" }],
      total: 1,
    });
    render(<LecturePicker onSelect={() => undefined} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Ан" } });
    await waitFor(() => expect(mocked.searchLectures).toHaveBeenCalled(), { timeout: 400 });
    const lastCall = mocked.searchLectures.mock.calls.at(-1)!;
    expect(lastCall[0]).toBe("Ан");
    expect(await screen.findByText("Античность")).toBeInTheDocument();
  });
});

describe("MediaPicker", () => {
  it("type=video radio triggers searchMedia with type=video", async () => {
    mocked.searchMedia.mockResolvedValue({
      data: [{ id: "m1", filename: "lecture.mp4" }],
      total: 1,
    });
    render(<MediaPicker onSelect={() => undefined} />);
    fireEvent.click(screen.getByLabelText(/видео/i));
    await waitFor(
      () => {
        const lastCall = mocked.searchMedia.mock.calls.at(-1);
        expect(lastCall?.[3]).toBe("video");
      },
      { timeout: 400 },
    );
  });
});

describe("Comment2StagePicker", () => {
  it("starts at step 1 without defaultLectureId, advances on select", async () => {
    mocked.searchLectures.mockResolvedValue({
      data: [{ id: "l1", title: "L1" }],
      total: 1,
    });
    mocked.searchCommentsByLecture.mockResolvedValue({
      data: [{ id: "c1", snippet: "hi" }],
      total: 1,
    });
    const onSelect = vi.fn();
    render(<Comment2StagePicker onSelect={onSelect} />);
    expect(screen.getByText(/шаг 1/i)).toBeInTheDocument();
    fireEvent.mouseDown(await screen.findByText("L1"));
    await screen.findByText(/шаг 2/i);
    fireEvent.mouseDown(await screen.findByText("hi"));
    expect(onSelect).toHaveBeenCalledWith("c1");
  });

  it("starts at step 2 with defaultLectureId, back returns to step 1", async () => {
    mocked.searchCommentsByLecture.mockResolvedValue({ data: [], total: 0 });
    mocked.searchLectures.mockResolvedValue({ data: [], total: 0 });
    render(<Comment2StagePicker defaultLectureId="L0" onSelect={() => undefined} />);
    await screen.findByText(/шаг 2/i);
    fireEvent.click(screen.getByRole("button", { name: /сменить лекцию/i }));
    expect(await screen.findByText(/шаг 1/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Прогнать — все тесты PASS**

Run: `npx vitest run src/components/ast-editor/pickers/pickers.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 3: Commit**

```bash
git add src/components/ast-editor/pickers/pickers.test.tsx
git commit -m "test(ast-editor): integration tests for pickers + 2-stage comment"
```

---

## Task 6: RefMenu — gateway picker → mark insert

**Files:**
- Create: `src/components/ast-editor/pickers/ref-menu.tsx`
- Test: `src/components/ast-editor/pickers/ref-menu.test.tsx`

**Behaviour:**
- Принимает `editor: Editor` и `defaultLectureId?: string`.
- Render: набор кнопок-категорий (lecture / glossary / document / media / canvas / comment) + active picker под ними.
- При выборе категории — render соответствующего picker'а.
- При `onSelect(id)` — `editor.chain().focus().setMark("<mark>", { id }).run()` и `props.onClose?.()`.
- `defaultLectureId` пробрасывается в Comment2StagePicker.

**Mark names** (соответствие категория → mark):
- lecture → `lecture_ref`
- glossary → `glossary_ref`
- document → `document_ref`
- media → `media_ref`
- canvas → `canvas_ref`
- comment → `comment_ref`

(имена точно совпадают с теми, что зарегистрированы в [extensions/marks/nav-ref.ts](../../src/components/ast-editor/extensions/marks/nav-ref.ts) — Phase 1).

- [ ] **Step 1: Failing test**

```tsx
// src/components/ast-editor/pickers/ref-menu.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("./actions", () => ({
  searchLectures: vi.fn(),
  searchGlossary: vi.fn(),
  searchDocuments: vi.fn(),
  searchMedia: vi.fn(),
  searchCanvases: vi.fn(),
  searchCommentsByLecture: vi.fn(),
}));

import { Editor } from "@tiptap/core";
import * as actions from "./actions";
import { RefMenu } from "./ref-menu";
import { buildExtensions } from "../extensions";
import type { SchemaSnapshot } from "../types";

const mocked = actions as unknown as { searchLectures: ReturnType<typeof vi.fn> };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const fullSnapshot: SchemaSnapshot = {
  blockLevels: { full: ["paragraph"] },
  entityBlockLimits: { full: 100 },
  entityContexts: { document: "full" },
  limits: { maxDepth: 32, maxTextLen: 100_000, maxContentItems: 1000, maxMarksPerNode: 100 },
  urlPolicy: { dangerousSchemes: ["javascript", "data", "vbscript"] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

function makeEditor() {
  const ed = new Editor({
    extensions: buildExtensions({ snapshot: fullSnapshot, context: "document" }),
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }] },
  });
  ed.commands.setTextSelection({ from: 1, to: 6 }); // select "hello"
  return ed;
}

describe("RefMenu", () => {
  it("inserts lecture_ref mark with selected id on lecture pick", async () => {
    mocked.searchLectures.mockResolvedValue({
      data: [{ id: "l1", title: "L1" }],
      total: 1,
    });
    const editor = makeEditor();
    const onClose = vi.fn();
    render(<RefMenu editor={editor} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /лекция/i }));
    fireEvent.mouseDown(await screen.findByText("L1"));
    const json = JSON.stringify(editor.getJSON());
    expect(json).toContain('"type":"lecture_ref"');
    expect(json).toContain('"id":"l1"');
    expect(onClose).toHaveBeenCalledOnce();
    editor.destroy();
  });
});
```

- [ ] **Step 2: Прогнать — fail (нет компонента)**

Run: `npx vitest run src/components/ast-editor/pickers/ref-menu.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализация**

```tsx
// src/components/ast-editor/pickers/ref-menu.tsx
"use client";
import { useState } from "react";
import type { Editor } from "@tiptap/core";
import { LecturePicker } from "./lecture-picker";
import { GlossaryPicker } from "./glossary-picker";
import { DocumentPicker } from "./document-picker";
import { MediaPicker } from "./media-picker";
import { CanvasPicker } from "./canvas-picker";
import { Comment2StagePicker } from "./comment-2stage-picker";

type Category = "lecture" | "glossary" | "document" | "media" | "canvas" | "comment";

const MARK_FOR: Record<Category, string> = {
  lecture: "lecture_ref",
  glossary: "glossary_ref",
  document: "document_ref",
  media: "media_ref",
  canvas: "canvas_ref",
  comment: "comment_ref",
};

export interface RefMenuProps {
  editor: Editor;
  defaultLectureId?: string | undefined;
  onClose?: () => void;
}

export function RefMenu({ editor, defaultLectureId, onClose }: RefMenuProps) {
  const [cat, setCat] = useState<Category | null>(null);

  const apply = (markName: string, id: string) => {
    editor.chain().focus().setMark(markName, { id }).run();
    onClose?.();
  };

  const onSelect = (id: string) => apply(MARK_FOR[cat!], id);

  return (
    <div className="ref-menu" role="dialog" aria-label="Вставить ссылку">
      <div className="ref-menu__cats">
        {(Object.keys(MARK_FOR) as Category[]).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cat === c}
            onClick={() => setCat(c)}
          >
            {labels[c]}
          </button>
        ))}
      </div>
      <div className="ref-menu__picker">
        {cat === "lecture" && <LecturePicker onSelect={onSelect} />}
        {cat === "glossary" && <GlossaryPicker onSelect={onSelect} />}
        {cat === "document" && <DocumentPicker onSelect={onSelect} />}
        {cat === "media" && <MediaPicker onSelect={onSelect} />}
        {cat === "canvas" && <CanvasPicker onSelect={onSelect} />}
        {cat === "comment" && (
          <Comment2StagePicker defaultLectureId={defaultLectureId} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
}

const labels: Record<Category, string> = {
  lecture: "Лекция",
  glossary: "Термин",
  document: "Документ",
  media: "Медиа",
  canvas: "Canvas",
  comment: "Комментарий",
};
```

- [ ] **Step 4: Прогнать тест — PASS**

Run: `npx vitest run src/components/ast-editor/pickers/ref-menu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-editor/pickers/ref-menu.tsx src/components/ast-editor/pickers/ref-menu.test.tsx
git commit -m "feat(ast-editor): add RefMenu gateway for nav-mark insertion via 6 pickers"
```

---

## Task 7: Final lint/test/build + PR

- [ ] **Step 1: Финальные гейты**

Run: `npm run lint && npm test -- --run && npm run build`
Expected: 3 зелёных.

- [ ] **Step 2: PR**

Title: `feat(ast-editor): Phase 2b — pickers + nav-mark insertion`.
PR body checklist:
- [ ] Покрыто тестами: AsyncCombobox (5), 6 pickers (4 кейса), RefMenu integration (1).
- [ ] Frozen zones не тронуты (`git diff --name-only main...HEAD` — только `src/components/ast-editor/pickers/*`).
- [ ] No-conflict с 2a: ни один файл не пересекается.
- [ ] No-conflict с 2c: ни один файл не пересекается; 2c будет импортировать `RefMenu` из `pickers/ref-menu.tsx` deep-import'ом (in-slice — разрешено ESLint-гардом).

---

## Self-review checklist

- [ ] `git diff --name-only main...HEAD` — только новые файлы в `src/components/ast-editor/pickers/`.
- [ ] Ни один picker не делает прямых HTTP-вызовов вне `actions.ts`.
- [ ] `actions.ts` — `"use server"` + `import "server-only"` + `createApiClient()` (конвенция проекта).
- [ ] `MARK_FOR` совпадает с именами в `extensions/marks/nav-ref.ts` (Phase 1).
- [ ] Comment2StagePicker НЕ пишет lectureId в mark — только commentId.
- [ ] Все доменные типы — из `@/api/schema` через `components["schemas"][…]`, не дублированы. Использованы РЕАЛЬНЫЕ имена: `lecture.Lecture`, `glossary.Term`, `document.DocumentSummary`, `media.MediaSummary`, `canvas.CanvasSummary`, `comment.CommentSummary`.
- [ ] `total` читается через `data?.pagination?.total` (а не `data?.total`).
- [ ] `renderItem` использует реальные поля: lecture/canvas/glossary → `title`, document/media → `filename`, comment → `snippet`.

## Что НЕ входит в этот план

- Toolbar-кнопка для открытия RefMenu → Phase 2c.
- `@`-trigger в редакторе (печать `@` открывает меню) → Phase 2c.
- Inline-citation attrs (start_block_id, exact, prefix, …) — design §6.1 явно говорит «MVP-picker только id».
- Edit existing nav-mark (открыть picker для уже стоящей mark) → future.
- Recent / pinned / suggested items → future.
