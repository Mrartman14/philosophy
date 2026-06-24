# Editor ref-picker на Base UI Combobox — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить ручной ref-пикер редактора на контекст-осознанную Base UI Combobox-композицию (категория-скоуп + drill-in лекции для комментариев), сконвергировав ручной `AsyncCombobox` на единый Base UI движок во всём проекте.

**Architecture:** Чистый хук `useAsyncComboboxItems` (серверный поиск: debounce + seq-token + пагинация) питает два UI-шелла: generic `AsyncCombobox` (drop-in для canvas/trails/attachments) и `RefPicker` (scoped combobox редактора — переключатель категорий + drill-in). Поверхности `@`-меню (anchor=каретка) и тулбар-кнопка (Trigger) рендерят `RefPicker`. Base UI Combobox обёрнут новым kit-примитивом `src/components/ui/combobox.tsx` (Guardrail 7).

**Tech Stack:** Next.js (React 19, "use client"), TypeScript, `@base-ui/react/combobox`, TipTap/ProseMirror, vitest + @testing-library/react, next-intl за фасадом `@/i18n`, pnpm.

## Review fixes (применено после мультиагентного ревью 2026-06-24)

5 параллельных ревьюеров (Base UI API / покрытие спеки / корректность кода / blast-radius / конвенции). Foundations подтверждены (Guardrail 7/8, frozen zones, i18n-процесс, en-XA авто-генерится через `pseudoizeCatalog`, a11y `role=group`+`aria-pressed` есть прецедент `scene-mode-toggle`, knip/kebab-case — всё PASS; все допущения Base UI Combobox эмпирически подтверждены в 1.4.1). Исправлено:

- **[BLOCKER] PRIMARY якорение подтверждено эмпирически** → Task 2 из открытого спайка превращён в смоук-подтверждение; Tasks 8–10 пишутся прямо под PRIMARY (combobox владеет попапом). FALLBACK не нужен.
- **[BLOCKER] RefPicker не владел попапом** (`open/anchor/trigger` игнорировались, Tasks 9/10 ломались) → Task 8 переписан: `RefPicker` сам рендерит `Combobox.Root` (controlled `open`/`onOpenChange`) + условно `Combobox.Trigger` (тулбар) ИЛИ `Portal/Positioner anchor /Popup` (каретка), тело — внутри `Popup`.
- **[BLOCKER] `DocumentSummary.title` не существует** (только `filename`) → Task 7 использует `d.filename`. ⚠️ Бэк-контракт: у документов нет человекочитаемого заголовка в summary — метка document_ref будет filename (как и в текущем document-picker; флаг бэку, не маскируем).
- **[BLOCKER] AtIcon SVG был геометрически неверным** (не «@») → Task 6 использует выверенный путь Lucide at-sign (stroke).
- **[MAJOR] Утечка состояния между scope в одном `Combobox.Root`** → `key={activeId + (parentId ?? "")}` форсит ремоунт на смене категории/drill-in.
- **[MAJOR] Task 5 недоохватывал тесты** → явный список файлов: `async-combobox.test`, `pickers.test` (+ удаление кейсов Comment2StagePicker), `at-menu.test`, `toolbar.test`, `attachments-panel.test`; `features/trails|lectures` пикер-тестов НЕ содержат.
- **[MINOR]** хук: усилён JSDoc (нестабильный fetcher = бесконечный цикл, не просто лишний фетч); `renderItem` 2-й арг (isActive) мёртв — убран из типа; точный список мёртвых i18n-ключей (`commentPickerStep2`, `commentPickerChangeLecture`); `parentLabelKey` убран из RefScope; добавлен апдейт `src/components/ast-editor/README.md`.

## Global Constraints

- Менеджер пакетов — **pnpm** (не npm). Гейт перед PR: `pnpm lint && pnpm test && pnpm build` зелёные.
- Параллельные агенты: коммитить только свои файлы по имени (`git add <files> && git commit --only <files>`), **без** `git add -A/.`, без `git stash/reset/checkout./clean`, без push (push заблокирован).
- Именование файлов в `src/` — kebab-case.
- **Guardrail 7**: прямой импорт `@base-ui/react` запрещён вне `src/components/ui/**`. Любое использование Base UI Combobox в прикладном коде — только через kit-обёртку `@/components/ui`.
- **Guardrail 5/6 (i18n)**: переводы только через фасад `@/i18n` (server) / `@/i18n/client` (client); строки — во все каталоги ru/en/ar/zh + псевдо en-XA, с тестами паритета.
- `src/components/ui/*` — **заморожённая зона**: добавление нового примитива (`combobox.tsx`) — это foundation-часть (см. Task 1; флаг пользователю).
- Бэкенд-контракт (НЕ менять): `*_ref`-марки несут только `id` (UUID, required). comment ищется по лекции (`/api/lectures/{id}/comments/search`), остальные — глобально. `annotation_ref` не существует — не добавляем.
- Субагенты-исполнители — на модели **opus** (не haiku).
- Спека: `docs/superpowers/specs/2026-06-24-editor-ref-picker-combobox-design.md`.

---

## File Structure

**Создаются:**
- `src/components/ui/combobox.tsx` — kit-обёртка над Base UI Combobox (compound passthrough + surface).
- `src/components/ast-editor/pickers/use-async-combobox-items.ts` — чистый хук серверного поиска.
- `src/components/ast-editor/pickers/use-async-combobox-items.test.ts` — тесты хука.
- `src/components/ast-editor/pickers/ref-types.ts` — FE-карта категорий (SOT контекст-зависимости).
- `src/components/ast-editor/pickers/ref-picker.tsx` — scoped-combobox оболочка редактора.
- `src/components/ast-editor/pickers/ref-picker.test.tsx` — тесты RefPicker.
- `src/assets/icons/at-icon.tsx` — иконка «@» для тулбара.

**Модифицируются:**
- `src/components/ui/index.ts` — экспорт `Combobox`.
- `src/components/ast-editor/pickers/async-combobox.tsx` — реимплементация на kit Combobox + хук (API сохраняется).
- `src/components/ast-editor/pickers/async-combobox.test.tsx` — переписать под новый DOM.
- `src/components/ast-editor/pickers/at-menu.tsx` + `at-menu.test.tsx` — на `RefPicker`.
- `src/components/ast-editor/toolbar/buttons/ref-popover.tsx` — на `RefPicker` + `AtIcon`.
- `src/components/ast-editor/toolbar/toolbar.test.tsx` — адаптировать defaultLectureId-тест.
- i18n каталоги `src/i18n/messages/{ru,en,ar,zh}/editor.ts` (+ псевдо генерится из en).
- Тесты потребителей при необходимости (селекторы): `features/canvas`, `features/trails`, `features/lectures`, `components/attachments`.

**Удаляются:**
- `src/components/ast-editor/pickers/ref-menu.tsx` + `ref-menu.test.tsx` (замещены RefPicker).
- `src/components/ast-editor/pickers/comment-2stage-picker.tsx` (+ его кейсы в `pickers.test.tsx`) — логика переехала в RefPicker; компонент больше не нужен (проверить, что вне редактора не используется — он не используется).
- `src/assets/icons/bookmark-icon.tsx` (используется только в ref-popover → станет dead).

**Остаются как есть (тонкие обёртки поверх нового AsyncCombobox, API не меняется):**
- `glossary-picker.tsx`, `document-picker.tsx`, `media-picker.tsx`, `lecture-picker.tsx`, `comment-picker.tsx`, `canvas-picker.tsx` (dormant) — нужны canvas/trails/attachments.

---

## Task 1: kit-обёртка `Combobox` (foundation, frozen-zone)

**Files:**
- Create: `src/components/ui/combobox.tsx`
- Modify: `src/components/ui/index.ts`
- Test: `src/components/ui/combobox.test.tsx`

**Interfaces:**
- Produces: `Combobox` — объект с полями `Root, Input, List, Item, Empty, Status, Positioner, Popup, Portal, Trigger, Group, GroupLabel, Collection, Value, Icon` (passthrough на `@base-ui/react/combobox`); `Popup` несёт surface-стиль `rounded border border-(--color-border) bg-(--color-surface) shadow-lg`.

- [ ] **Step 1: Написать рендер-тест (FAIL)**

`src/components/ui/combobox.test.tsx`:
```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Combobox } from "./combobox";

afterEach(cleanup);

describe("Combobox (compound)", () => {
  it("рендерит элементы и фильтрует по вводу (defaultOpen, inline items)", async () => {
    render(
      <Combobox.Root items={["alpha", "beta"]} defaultOpen filter={null}>
        <Combobox.Input />
        <Combobox.List>
          {(item: string) => (
            <Combobox.Item key={item} value={item}>{item}</Combobox.Item>
          )}
        </Combobox.List>
      </Combobox.Root>,
    );
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  it("Popup мёржит custom className поверх surface-дефолта", () => {
    render(
      <Combobox.Root items={[]} defaultOpen>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup className="p-1">контент</Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );
    const popup = screen.getByText("контент");
    expect(popup).toHaveClass("p-1");
    expect(popup).toHaveClass("shadow-lg");
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm vitest run src/components/ui/combobox.test.tsx`
Expected: FAIL — `Cannot find module './combobox'`.

- [ ] **Step 3: Создать kit-обёртку** (по образцу `popover.tsx`)

`src/components/ui/combobox.tsx`:
```tsx
"use client";
// src/components/ui/combobox.tsx
import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from "react";

import { cn } from "./cn";

/**
 * Compound-обёртка над Base UI Combobox. Большинство частей — прямой passthrough;
 * Popup несёт общий surface-стиль и мёржит className поверх (проектный cn — наивный
 * join, на call-site дублирующие surface-классы убираются). Guardrail 7: прикладной
 * код использует combobox только отсюда, не из @base-ui/react напрямую.
 */
const Popup = forwardRef<
  ComponentRef<typeof BaseCombobox.Popup>,
  ComponentPropsWithoutRef<typeof BaseCombobox.Popup>
>(function ComboboxPopup({ className, ...rest }, ref) {
  return (
    <BaseCombobox.Popup
      ref={ref}
      className={cn(
        "rounded border border-(--color-border) bg-(--color-surface) shadow-lg",
        className as string,
      )}
      {...rest}
    />
  );
});

export const Combobox = {
  Root: BaseCombobox.Root,
  Value: BaseCombobox.Value,
  Input: BaseCombobox.Input,
  Trigger: BaseCombobox.Trigger,
  Icon: BaseCombobox.Icon,
  Portal: BaseCombobox.Portal,
  Positioner: BaseCombobox.Positioner,
  Popup,
  List: BaseCombobox.List,
  Item: BaseCombobox.Item,
  Group: BaseCombobox.Group,
  GroupLabel: BaseCombobox.GroupLabel,
  Collection: BaseCombobox.Collection,
  Status: BaseCombobox.Status,
  Empty: BaseCombobox.Empty,
  Separator: BaseCombobox.Separator,
};
```

> ПРИМЕЧАНИЕ исполнителю: точный список частей и имена пропов сверь с `node_modules/@base-ui/react/esm/combobox/index.parts.d.ts`. Все части — passthrough; добавляй недостающие по мере нужды последующих тасков. Если какая-то часть отсутствует в установленной версии — убери её из объекта (не выдумывай).

- [ ] **Step 4: Экспортировать из kit-индекса**

В `src/components/ui/index.ts` после строки `export { Popover } from "./popover";` добавить:
```ts
export { Combobox } from "./combobox";
```

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Run: `pnpm vitest run src/components/ui/combobox.test.tsx`
Expected: PASS (оба кейса).

- [ ] **Step 6: Lint обёртки**

Run: `pnpm eslint src/components/ui/combobox.tsx src/components/ui/index.ts src/components/ui/combobox.test.tsx`
Expected: чисто (Guardrail 7 НЕ срабатывает внутри `ui/`).

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/combobox.tsx src/components/ui/combobox.test.tsx src/components/ui/index.ts
git commit -m "feat(ui-kit): добавить Combobox-обёртку над Base UI (Guardrail 7)"
```

---

## Task 2: Спайк — стратегия якорения (input-in-popup + caret/trigger anchor)

**Files:**
- Temp probe (удалить после): `src/components/ast-editor/__combobox-anchor-probe.test.tsx`
- Modify (документация решения): этот план — отметить выбор в конце Task 2.

**Цель:** Подтвердить, что kit `Combobox` умеет: (A) рендерить `Combobox.Input` ВНУТРИ `Combobox.Popup` (не как внешний trigger), и (B) якорить `Combobox.Positioner` к virtual-каретке (`anchor`) с контролируемым `open`, БЕЗ внешнего Input/Trigger. Это нужно для `@`-поверхности.

- [ ] **Step 1: Probe — input в попапе + anchor к каретке + контролируемый open**

`src/components/ast-editor/__combobox-anchor-probe.test.tsx`:
```tsx
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useEffect, useState } from "react";
import { describe, it, afterEach, expect } from "vitest";

import { Combobox } from "@/components/ui";

afterEach(cleanup);

function Probe() {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(true); }, []);
  const anchor = { getBoundingClientRect: () => new DOMRect(10, 20, 0, 18) };
  return (
    <Combobox.Root items={["one", "two"]} open={open} onOpenChange={setOpen} filter={null}>
      <Combobox.Portal>
        <Combobox.Positioner anchor={anchor} side="bottom" align="start">
          <Combobox.Popup>
            <Combobox.Input placeholder="поиск…" />
            <Combobox.List>
              {(it: string) => <Combobox.Item key={it} value={it}>{it}</Combobox.Item>}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

describe("PROBE combobox anchored, input-in-popup", () => {
  it("renders input and items in popup", async () => {
    render(<Probe />);
    expect(await screen.findByPlaceholderText("поиск…")).toBeInTheDocument();
    expect(screen.getByText("one")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Запустить probe**

Run: `pnpm vitest run src/components/ast-editor/__combobox-anchor-probe.test.tsx`

- [ ] **Step 3: Зафиксировать решение**

PRIMARY уже подтверждён мультиагентным ревью (эмпирическая проба на `@base-ui/react@1.4.1`: `Combobox.Input` внутри `Combobox.Popup` + `Positioner anchor={virtual}` + controlled `open` БЕЗ внешнего Input/Trigger — рендерится, клик и клавиатура (ArrowDown+Enter) выбирают, ARIA `combobox`/`option` присутствуют). Эта Task — лишь СМОУК-подтверждение, что то же держится в kit-обёртке (Task 1). **Путь зафиксирован: PRIMARY.** FALLBACK не нужен; Tasks 8–10 написаны под PRIMARY. Если смоук вдруг упадёт (маловероятно) — СТОП, вернуться к ревью Base UI и не продолжать вслепую.

- [ ] **Step 4: Удалить probe**

```bash
rm src/components/ast-editor/__combobox-anchor-probe.test.tsx
```

- [ ] **Step 5: Commit (только заметка плана)**

```bash
git add docs/superpowers/plans/2026-06-24-editor-ref-picker-combobox.md
git commit -m "docs(plan): зафиксировать стратегию якорения combobox (спайк)"
```

---

## Task 3: Хук `useAsyncComboboxItems` (серверный поиск)

**Files:**
- Create: `src/components/ast-editor/pickers/use-async-combobox-items.ts`
- Test: `src/components/ast-editor/pickers/use-async-combobox-items.test.ts`

**Interfaces:**
- Consumes: `Fetcher<T> = (q: string, offset: number, limit: number) => Promise<{ data: T[]; total: number | null }>`.
- Produces:
  ```ts
  type AsyncStatus = "loading" | "error" | "empty" | "ready";
  interface UseAsyncComboboxItems<T> {
    items: T[]; total: number | null; status: AsyncStatus; error: string | null;
    query: string; setQuery: (q: string) => void;
    loadMore: () => void; canLoadMore: boolean; reload: () => void;
  }
  function useAsyncComboboxItems<T>(fetcher: Fetcher<T>, pageSize?: number): UseAsyncComboboxItems<T>;
  ```
  Поведение: debounce `query` 200ms → fetch(offset 0); `loadMore` → fetch(offset=items.length) с append; sequence-token отбрасывает устаревшие ответы; `status="empty"` когда `!loading && items.length===0 && !error`; `reload` повторяет текущий запрос с offset 0; рефетч при смене identity `fetcher`. `pageSize` по умолчанию 20.

- [ ] **Step 1: Написать тесты (FAIL)**

`src/components/ast-editor/pickers/use-async-combobox-items.test.ts`:
```ts
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { useAsyncComboboxItems } from "./use-async-combobox-items";

const ok = (data: { id: string }[], total: number | null = data.length) =>
  () => Promise.resolve({ data, total });

describe("useAsyncComboboxItems", () => {
  it("делает первичный fetch(offset 0) и отдаёт items", async () => {
    const fetcher = vi.fn(ok([{ id: "a" }]));
    const { result } = renderHook(() => useAsyncComboboxItems(fetcher, 20));
    await waitFor(() => { expect(result.current.items).toHaveLength(1); });
    expect(fetcher).toHaveBeenCalledWith("", 0, 20);
    expect(result.current.status).toBe("ready");
  });

  it("debounce setQuery: фетч с последним значением", async () => {
    const fetcher = vi.fn(ok([{ id: "x" }]));
    const { result } = renderHook(() => useAsyncComboboxItems(fetcher, 20));
    act(() => { result.current.setQuery("ab"); });
    act(() => { result.current.setQuery("abc"); });
    await waitFor(() => { expect(fetcher).toHaveBeenCalledWith("abc", 0, 20); }, { timeout: 600 });
    expect(fetcher).not.toHaveBeenCalledWith("ab", 0, 20);
  });

  it("loadMore append со следующим offset", async () => {
    const fetcher = vi.fn((_q: string, offset: number) =>
      Promise.resolve({ data: [{ id: `${offset}` }], total: 2 }));
    const { result } = renderHook(() => useAsyncComboboxItems(fetcher, 1));
    await waitFor(() => { expect(result.current.items).toHaveLength(1); });
    expect(result.current.canLoadMore).toBe(true);
    act(() => { result.current.loadMore(); });
    await waitFor(() => { expect(result.current.items).toHaveLength(2); });
    expect(fetcher).toHaveBeenLastCalledWith("", 1, 1);
  });

  it("status=empty при пустом ответе", async () => {
    const { result } = renderHook(() => useAsyncComboboxItems(ok([], 0), 20));
    await waitFor(() => { expect(result.current.status).toBe("empty"); });
  });

  it("status=error + reload повторяет запрос", async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error("boom")));
    const { result } = renderHook(() => useAsyncComboboxItems(fetcher, 20));
    await waitFor(() => { expect(result.current.status).toBe("error"); });
    act(() => { result.current.reload(); });
    await waitFor(() => { expect(fetcher).toHaveBeenCalledTimes(2); });
  });

  it("отбрасывает устаревший ответ (resolve out of order)", async () => {
    let resolveOld!: (v: { data: { id: string }[]; total: number }) => void;
    let resolveNew!: (v: { data: { id: string }[]; total: number }) => void;
    const fOld = () => new Promise<{ data: { id: string }[]; total: number }>((r) => { resolveOld = r; });
    const fNew = () => new Promise<{ data: { id: string }[]; total: number }>((r) => { resolveNew = r; });
    const { result, rerender } = renderHook(({ f }) => useAsyncComboboxItems(f, 20), {
      initialProps: { f: fOld as typeof fOld },
    });
    rerender({ f: fNew as typeof fOld });
    resolveNew({ data: [{ id: "new" }], total: 1 });
    await waitFor(() => { expect(result.current.items[0]?.id).toBe("new"); });
    resolveOld({ data: [{ id: "old" }], total: 1 });
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.items[0]?.id).toBe("new");
  });
});
```

- [ ] **Step 2: Запустить — FAIL** (`Cannot find module './use-async-combobox-items'`).

Run: `pnpm vitest run src/components/ast-editor/pickers/use-async-combobox-items.test.ts`

- [ ] **Step 3: Реализовать хук** (логика портирована из текущего `async-combobox.tsx`)

`src/components/ast-editor/pickers/use-async-combobox-items.ts`:
```ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncStatus = "loading" | "error" | "empty" | "ready";

export type AsyncFetcher<T> = (
  q: string,
  offset: number,
  limit: number,
) => Promise<{ data: T[]; total: number | null }>;

export interface UseAsyncComboboxItems<T> {
  items: T[];
  total: number | null;
  status: AsyncStatus;
  error: string | null;
  query: string;
  setQuery: (q: string) => void;
  loadMore: () => void;
  canLoadMore: boolean;
  reload: () => void;
}

interface State<T> {
  items: T[];
  total: number | null;
  loading: boolean;
  error: string | null;
}

export function useAsyncComboboxItems<T>(
  fetcher: AsyncFetcher<T>,
  pageSize = 20,
): UseAsyncComboboxItems<T> {
  const [query, setQueryState] = useState("");
  const [s, setS] = useState<State<T>>({ items: [], total: null, loading: false, error: null });
  const seqRef = useRef(0);

  const debouncedQ = useDebounced(query, 200);

  const load = useCallback(
    async (qNow: string, offset: number) => {
      const seq = ++seqRef.current;
      setS((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { data, total } = await fetcher(qNow, offset, pageSize);
        if (seq !== seqRef.current) return;
        setS((prev) => ({
          items: offset === 0 ? data : prev.items.concat(data),
          total,
          loading: false,
          error: null,
        }));
      } catch (e) {
        if (seq !== seqRef.current) return;
        setS((prev) => ({ ...prev, loading: false, error: e instanceof Error ? e.message : "error" }));
      }
    },
    [fetcher, pageSize],
  );

  useEffect(() => { void load(debouncedQ, 0); }, [debouncedQ, load]);

  const loadMore = useCallback(() => { void load(debouncedQ, s.items.length); }, [load, debouncedQ, s.items.length]);
  const reload = useCallback(() => { void load(debouncedQ, 0); }, [load, debouncedQ]);

  const status: AsyncStatus = s.loading
    ? "loading"
    : s.error
      ? "error"
      : s.items.length === 0
        ? "empty"
        : "ready";

  const canLoadMore = s.total !== null && s.items.length < s.total && !s.loading;

  return {
    items: s.items,
    total: s.total,
    status,
    error: s.error,
    query,
    setQuery: setQueryState,
    loadMore,
    canLoadMore,
    reload,
  };
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => { setV(value); }, ms);
    return () => { clearTimeout(t); };
  }, [value, ms]);
  return v;
}
```

- [ ] **Step 4: Запустить — PASS**

Run: `pnpm vitest run src/components/ast-editor/pickers/use-async-combobox-items.test.ts`
Expected: PASS (6 кейсов).

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-editor/pickers/use-async-combobox-items.ts src/components/ast-editor/pickers/use-async-combobox-items.test.ts
git commit -m "feat(ast-editor): хук useAsyncComboboxItems (движок серверного поиска)"
```

---

## Task 4: Реимплементация `AsyncCombobox` на kit Combobox + хук

**Files:**
- Modify: `src/components/ast-editor/pickers/async-combobox.tsx`
- Modify (переписать): `src/components/ast-editor/pickers/async-combobox.test.tsx`

**Interfaces:**
- Consumes: `useAsyncComboboxItems` (Task 3), `Combobox` (Task 1).
- Produces (внешний API сохранён, кроме мёртвого 2-го арга `renderItem`): `AsyncCombobox<T>({ fetcher, renderItem, getKey, onSelect, onClose?, placeholder?, pageSize?, copy? })`. `renderItem(item)` (раньше был `(item, isActive)` — 2-й арг никем не использовался, убран; Base UI стилизует активный через `data-highlighted`), `onSelect(item)`. Поведение: ввод → серверный поиск; стрелки/Enter — выбор; Esc → `onClose?`; футер «загрузить ещё»; состояния loading/empty/error+retry. Рендерит self-contained combobox (inline-список, без собственного Portal — встраивается в родительский попап/диалог).

> ВАЖНО: внешний контракт сохраняем ради zero-change consumers (`attach-target-picker`, `glossary/document/media/comment/lecture-picker`). Меняются только внутренности (Base UI) и DOM-структура.

- [ ] **Step 1: Переписать тест под новый DOM (FAIL до реализации)**

Заменить содержимое `async-combobox.test.tsx`. Сохранить мок `@/i18n/client` (строки 6–21 текущего файла) и интерфейс `Item`. Кейсы (Base UI Combobox даёт `role="combobox"` на Input, `role="option"` на Item):
```tsx
// (шапка: те же импорты + мок i18n, что в текущем файле; afterEach(cleanup))
describe("AsyncCombobox", () => {
  it("debounce + рендер items", async () => {
    const fetcher = vi.fn((q: string) => Promise.resolve({
      data: [{ id: "1", name: `match-${q}` }, { id: "2", name: "other" }], total: 2 as number | null,
    }));
    render(<AsyncCombobox<Item> fetcher={fetcher} renderItem={(it) => <span>{it.name}</span>}
      getKey={(it) => it.id} onSelect={() => undefined} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "abc" } });
    await waitFor(() => { expect(fetcher).toHaveBeenCalledWith("abc", 0, 20); }, { timeout: 600 });
    expect(await screen.findByText("match-abc")).toBeInTheDocument();
  });

  it("клик по опции вызывает onSelect", async () => {
    const onSelect = vi.fn();
    const fetcher = vi.fn(() => Promise.resolve({ data: [{ id: "x", name: "X" }], total: 1 as number | null }));
    render(<AsyncCombobox<Item> fetcher={fetcher} renderItem={(it) => <span>{it.name}</span>}
      getKey={(it) => it.id} onSelect={onSelect} />);
    fireEvent.click(await screen.findByText("X"));
    expect(onSelect).toHaveBeenCalledWith({ id: "x", name: "X" });
  });

  it("empty state", async () => {
    render(<AsyncCombobox<Item> fetcher={() => Promise.resolve({ data: [], total: 0 })}
      renderItem={() => null} getKey={() => "k"} onSelect={() => undefined} />);
    expect(await screen.findByText(/ничего не найдено/i)).toBeInTheDocument();
  });

  it("error + retry", async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error("boom")));
    render(<AsyncCombobox<Item> fetcher={fetcher} renderItem={() => null} getKey={() => "k"} onSelect={() => undefined} />);
    expect(await screen.findByText(/ошибка/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /повторить/i }));
    await waitFor(() => { expect(fetcher).toHaveBeenCalledTimes(2); });
  });

  it("load more append", async () => {
    const fetcher = vi.fn((_q: string, offset: number) => Promise.resolve({
      data: [{ id: `${offset}-a`, name: `${offset}A` }], total: 2 as number | null }));
    render(<AsyncCombobox<Item> fetcher={fetcher} renderItem={(it) => <span>{it.name}</span>}
      getKey={(it) => it.id} onSelect={() => undefined} pageSize={1} />);
    await screen.findByText("0A");
    fireEvent.click(screen.getByRole("button", { name: /загрузить ещё/i }));
    await screen.findByText("1A");
  });

  it("Esc вызывает onClose", async () => {
    const onClose = vi.fn();
    render(<AsyncCombobox<Item> fetcher={() => Promise.resolve({ data: [], total: 0 })}
      renderItem={() => null} getKey={() => "k"} onSelect={() => undefined} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    await waitFor(() => { expect(onClose).toHaveBeenCalled(); });
  });

  it("рефетч при смене identity fetcher", async () => {
    const fA = vi.fn(() => Promise.resolve({ data: [{ id: "a", name: "A" }], total: 1 as number | null }));
    const fB = vi.fn(() => Promise.resolve({ data: [{ id: "b", name: "B" }], total: 1 as number | null }));
    const { rerender } = render(<AsyncCombobox<Item> fetcher={fA} renderItem={(it) => <span>{it.name}</span>}
      getKey={(it) => it.id} onSelect={() => undefined} />);
    await screen.findByText("A");
    rerender(<AsyncCombobox<Item> fetcher={fB} renderItem={(it) => <span>{it.name}</span>}
      getKey={(it) => it.id} onSelect={() => undefined} />);
    await screen.findByText("B");
  });
});
```

> ПРИМЕЧАНИЕ: точные ARIA-роли/поведение клавиатуры Base UI Combobox в jsdom сверь эмпирически (как делалось со spike). Если `role="combobox"` на Input не подхватывается без `Combobox.Trigger`, добавь minimal обвязку или используй `getByPlaceholderText`. Цель кейсов — поведение (поиск/выбор/empty/error/loadmore/esc), а не конкретный селектор; корректируй селекторы под фактический DOM, сохраняя смысл.

- [ ] **Step 2: Запустить — FAIL** (старый компонент даёт старый DOM/новые ожидания не совпадут или импорт хука отсутствует).

Run: `pnpm vitest run src/components/ast-editor/pickers/async-combobox.test.tsx`

- [ ] **Step 3: Реализовать `AsyncCombobox` на kit Combobox + хук**

Заменить содержимое `async-combobox.tsx`:
```tsx
"use client";
import { useId } from "react";

import { Button, Combobox } from "@/components/ui";
import { useT } from "@/i18n/client";

import { useAsyncComboboxItems, type AsyncFetcher } from "./use-async-combobox-items";

export interface AsyncComboboxProps<T> {
  /**
   * ОБЯЗАТЕЛЬНО стабильная ссылка (useCallback / module-const): смена identity =
   * рефетч. Нестабильный (инлайновый) fetcher → БЕСКОНЕЧНЫЙ цикл фетчей (не просто
   * лишний запрос): хук пересоздаёт load → effect → setState → ре-рендер → новый fetcher.
   */
  fetcher: AsyncFetcher<T>;
  renderItem: (item: T) => React.ReactNode;
  getKey: (item: T) => string;
  onSelect: (item: T) => void;
  /** Вызывается при Esc внутри combobox. */
  onClose?: () => void;
  placeholder?: string;
  pageSize?: number;
  copy?: { empty?: string; error?: string; loading?: string };
}

export function AsyncCombobox<T>(props: AsyncComboboxProps<T>) {
  const t = useT("editor");
  const pageSize = props.pageSize ?? 20;
  const empty = props.copy?.empty ?? t("comboboxEmpty");
  const errorCopy = props.copy?.error ?? t("comboboxError");
  const loadingCopy = props.copy?.loading ?? t("comboboxLoading");

  const listId = useId();
  const { items, status, query, setQuery, loadMore, canLoadMore, reload } =
    useAsyncComboboxItems<T>(props.fetcher, pageSize);

  return (
    <Combobox.Root
      items={items as readonly T[]}
      filter={null}
      inputValue={query}
      onInputValueChange={(v) => { setQuery(v); }}
      onValueChange={(value) => { if (value != null) props.onSelect(value as T); }}
      isItemEqualToValue={(a, b) => props.getKey(a as T) === props.getKey(b as T)}
      onOpenChange={(open, details) => {
        if (!open && details.reason === "escape-key") props.onClose?.();
      }}
    >
      <div className="async-combobox">
        <Combobox.Input placeholder={props.placeholder} />
        <Combobox.List id={listId}>
          {(item: T) => (
            <Combobox.Item key={props.getKey(item)} value={item}>
              {props.renderItem(item)}
            </Combobox.Item>
          )}
        </Combobox.List>
        {status === "empty" && <div role="presentation">{empty}</div>}
        {status === "loading" && <div role="presentation">{loadingCopy}</div>}
        {status === "error" && (
          <div role="presentation">
            {errorCopy}
            <Button tone="quiet" compact onClick={() => { reload(); }}>{t("comboboxRetry")}</Button>
          </div>
        )}
        {canLoadMore && (
          <div role="presentation">
            <Button tone="quiet" compact onClick={() => { loadMore(); }}>{t("comboboxLoadMore")}</Button>
          </div>
        )}
      </div>
    </Combobox.Root>
  );
}
```

> РЕАЛИЗАЦИОННЫЕ ЗАМЕТКИ (no-hacks, свериться с Base UI в процессе):
> - `filter={null}` — отключает клиентскую фильтрацию (поиск уже на сервере).
> - `inputValue`/`onInputValueChange` — контролируемый ввод → `setQuery` (хук дебаунсит и фетчит).
> - `onValueChange(value)` — выбранный item (объект); `isItemEqualToValue` сравнивает по `getKey`.
> - Esc-закрытие: `onOpenChange(false, {reason:"escape-key"})` → `onClose`.
> - Если для рендера List нужен render-prop иной формы или требуется `Combobox.Empty`/`Combobox.Status` вместо ручных div'ов — используй нативные части Base UI (предпочтительно). Ручные `role="presentation"`-блоки оставлены как минимальный безопасный дефолт; замени на `Combobox.Empty`/`Combobox.Status`, если они дают тот же текст и тесты зелёные.

- [ ] **Step 4: Запустить тест — PASS** (правь селекторы под фактический DOM, сохраняя смысл кейсов).

Run: `pnpm vitest run src/components/ast-editor/pickers/async-combobox.test.tsx`

- [ ] **Step 5: Lint**

Run: `pnpm eslint src/components/ast-editor/pickers/async-combobox.tsx src/components/ast-editor/pickers/async-combobox.test.tsx`
Expected: чисто (Guardrail 7 — combobox идёт через kit).

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-editor/pickers/async-combobox.tsx src/components/ast-editor/pickers/async-combobox.test.tsx
git commit -m "refactor(ast-editor): AsyncCombobox на Base UI Combobox + useAsyncComboboxItems (API сохранён)"
```

---

## Task 5: Регресс потребителей `AsyncCombobox`/пикеров

**Files (тесты, по необходимости — селекторы):**
- `src/components/ast-editor/pickers/pickers.test.tsx`
- `src/features/canvas/**` (entity-ref-dialog тесты)
- `src/features/trails/**` (trail-items-editor тесты)
- `src/features/lectures/**` (attachments-manager тесты)
- `src/components/attachments/**`

**Interfaces:** компонентный код пикеров и потребителей НЕ меняется (API `AsyncCombobox` сохранён). Меняются только тест-селекторы, завязанные на старый DOM.

- [ ] **Step 1: Прогнать тесты потребителей**

Реальные затронутые тест-файлы (по ревью blast-radius): `pickers.test.tsx` (7 пер-типовых пикеров; используют `fireEvent.mouseDown(getByText)` → под Base UI это клик по `role="option"`), `attachments-panel.test.tsx`, `features/canvas/ui/canvas-create-form.test.tsx` (если рендерит entity-ref-dialog). `features/trails` и `features/lectures` пикер-тестов НЕ содержат (только backend) — их можно не трогать. `async-combobox.test.tsx` уже переписан в Task 4.

Run:
```bash
pnpm vitest run src/components/ast-editor/pickers/pickers.test.tsx src/components/attachments src/features/canvas
```
Expected: часть кейсов падает из-за нового DOM Combobox (`role="listbox"`/ручной `role="option"`/`mouseDown` → `getByRole("combobox")` для ввода, клик/`getByRole("option")` по опциям).

- [ ] **Step 2: Починить упавшие селекторы**

Для каждого падения: заменить завязку на старую разметку (`role="listbox"`/ручной `role="option"`/`input role="combobox"`) на эквивалент под Base UI Combobox (`screen.getByRole("combobox")` для ввода, `screen.getByText(...)`/`getByRole("option")` для опций, клик по тексту опции). НЕ менять компонентный код — только тесты. Смысл кейсов сохранять.

- [ ] **Step 3: Перепрогнать — PASS**

Run: тот же набор, что в Step 1. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ast-editor/pickers/pickers.test.tsx src/features/canvas src/features/trails src/features/lectures src/components/attachments
git commit -m "test: адаптировать селекторы потребителей под Base UI Combobox DOM"
```

> Если какие-то из перечисленных путей не содержат затронутых тестов — пропустить их в `git add` (добавлять только реально изменённые файлы).

---

## Task 6: Иконка `AtIcon` + замена в тулбаре, удаление `BookmarkIcon`

**Files:**
- Create: `src/assets/icons/at-icon.tsx`
- Modify: `src/components/ast-editor/toolbar/buttons/ref-popover.tsx`
- Delete: `src/assets/icons/bookmark-icon.tsx`
- Test: `src/assets/icons/at-icon.test.tsx`

**Interfaces:**
- Produces: `AtIcon(props: SVGProps<SVGSVGElement>)` — inline-svg «@», `currentColor`, `1em`.

- [ ] **Step 1: Тест иконки (FAIL)**

`src/assets/icons/at-icon.test.tsx`:
```tsx
import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { AtIcon } from "./at-icon";

describe("AtIcon", () => {
  it("рендерит svg с currentColor", () => {
    const { container } = render(<AtIcon />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
  });
});
```

- [ ] **Step 2: FAIL** — Run: `pnpm vitest run src/assets/icons/at-icon.test.tsx`

- [ ] **Step 3: Создать иконку**

`src/assets/icons/at-icon.tsx` (выверенный путь Lucide `at-sign` — stroke, не fill; узнаваемый «@»):
```tsx
import { SVGProps } from "react";

export const AtIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
  </svg>
);
```
> ВАЖНО: остальные иконки проекта используют `fill="currentColor"` на заполненных путях, а Lucide at-sign — `stroke`. Это нормально (svg самодостаточен), но визуально свериться в браузере (Task 13 Step 6). НЕ изобретать путь «@» вручную — взять именно этот.

- [ ] **Step 4: PASS** — Run: `pnpm vitest run src/assets/icons/at-icon.test.tsx`

- [ ] **Step 5: Заменить иконку в тулбаре**

В `src/components/ast-editor/toolbar/buttons/ref-popover.tsx`:
- заменить импорт `import { BookmarkIcon } from "@/assets/icons/bookmark-icon";` → `import { AtIcon } from "@/assets/icons/at-icon";`
- заменить `<BookmarkIcon />` → `<AtIcon />`.

(Дальнейшая перестройка ref-popover на RefPicker — Task 10; здесь только иконка.)

- [ ] **Step 6: Удалить мёртвую иконку**

```bash
git rm src/assets/icons/bookmark-icon.tsx
```
Проверить отсутствие ссылок: `rg -n "BookmarkIcon|bookmark-icon" src` → пусто.

- [ ] **Step 7: Lint + тест**

Run: `pnpm eslint src/assets/icons/at-icon.tsx src/components/ast-editor/toolbar/buttons/ref-popover.tsx && pnpm vitest run src/assets/icons/at-icon.test.tsx`
Expected: чисто + PASS.

- [ ] **Step 8: Commit**

```bash
git add src/assets/icons/at-icon.tsx src/assets/icons/at-icon.test.tsx src/components/ast-editor/toolbar/buttons/ref-popover.tsx
git commit -m "feat(ast-editor): иконка @ в тулбаре ref-кнопки; удалить BookmarkIcon"
```

---

## Task 7: FE-карта `ref-types.ts`

**Files:**
- Create: `src/components/ast-editor/pickers/ref-types.ts`
- Test: `src/components/ast-editor/pickers/ref-types.test.tsx`

**Interfaces:**
- Consumes: actions `searchGlossary/searchDocuments/searchMedia/searchLectures/searchCommentsByLecture`, типы `GlossaryTerm/DocumentSummary/MediaSummary/Lecture/CommentSummary`.
- Produces:
  ```ts
  type RefScope =
    | { kind: "global" }
    | { kind: "parent"; parentPlaceholderKey: string; parentFetch: AsyncFetcher<Lecture>;
        parentRender: (l: Lecture) => React.ReactNode; parentKey: (l: Lecture) => string;
        childFetch: (parentId: string) => AsyncFetcher<CommentSummary>;
        crumbLabel: (l: Lecture) => string };

  interface RefTypeDef<T> {
    id: "glossary" | "document" | "media" | "comment";
    mark: "glossary_ref" | "document_ref" | "media_ref" | "comment_ref";
    labelKey: string;            // i18n key каталога editor
    placeholderKey: string;      // i18n key плейсхолдера
    scope: RefScope;
    fetch?: AsyncFetcher<T>;     // для scope.kind==="global"
    renderItem: (item: T) => React.ReactNode;
    getKey: (item: T) => string;
    getLabel: (item: T) => string; // текст метки для вставляемой ссылки
  }

  const REF_TYPES: RefTypeDef<unknown>[]; // порядок = порядок вкладок
  ```

- [ ] **Step 1: Тест карты (FAIL)**

`ref-types.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { REF_TYPES } from "./ref-types";

describe("REF_TYPES", () => {
  it("4 категории в порядке glossary/document/media/comment", () => {
    expect(REF_TYPES.map((r) => r.id)).toEqual(["glossary", "document", "media", "comment"]);
  });
  it("марки соответствуют ast.MarkType", () => {
    expect(REF_TYPES.map((r) => r.mark)).toEqual([
      "glossary_ref", "document_ref", "media_ref", "comment_ref",
    ]);
  });
  it("только comment имеет parent-scope (lecture), остальные global", () => {
    const byId = Object.fromEntries(REF_TYPES.map((r) => [r.id, r.scope.kind]));
    expect(byId).toEqual({ glossary: "global", document: "global", media: "global", comment: "parent" });
  });
});
```

- [ ] **Step 2: FAIL** — Run: `pnpm vitest run src/components/ast-editor/pickers/ref-types.test.tsx`

- [ ] **Step 3: Реализовать карту**

`ref-types.ts`:
```tsx
import {
  searchGlossary, searchDocuments, searchMedia, searchLectures, searchCommentsByLecture,
  type GlossaryTerm, type DocumentSummary, type MediaSummary, type Lecture, type CommentSummary,
} from "./actions";
import type { AsyncFetcher } from "./use-async-combobox-items";

export type RefMark = "glossary_ref" | "document_ref" | "media_ref" | "comment_ref";

export type RefScope =
  | { kind: "global" }
  | {
      kind: "parent";
      parentPlaceholderKey: string;
      parentFetch: AsyncFetcher<Lecture>;
      parentRender: (l: Lecture) => React.ReactNode;
      parentKey: (l: Lecture) => string;
      crumbLabel: (l: Lecture) => string;
      childFetch: (parentId: string) => AsyncFetcher<CommentSummary>;
    };

export interface RefTypeDef<T> {
  id: "glossary" | "document" | "media" | "comment";
  mark: RefMark;
  labelKey: string;
  placeholderKey: string;
  scope: RefScope;
  fetch?: AsyncFetcher<T>;
  renderItem: (item: T) => React.ReactNode;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
}

const glossary: RefTypeDef<GlossaryTerm> = {
  id: "glossary", mark: "glossary_ref", labelKey: "refCategoryGlossary",
  placeholderKey: "glossaryPlaceholder", scope: { kind: "global" }, fetch: searchGlossary,
  renderItem: (g) => g.title ?? "—", getKey: (g) => g.id ?? "", getLabel: (g) => g.title ?? g.id ?? "",
};
const document: RefTypeDef<DocumentSummary> = {
  id: "document", mark: "document_ref", labelKey: "refCategoryDocument",
  placeholderKey: "documentPlaceholder", scope: { kind: "global" }, fetch: searchDocuments,
  // DocumentSummary НЕ имеет title (только filename) — подтверждено по schema.ts.
  renderItem: (d) => d.filename ?? "—", getKey: (d) => d.id ?? "",
  getLabel: (d) => d.filename ?? d.id ?? "",
};
const media: RefTypeDef<MediaSummary> = {
  id: "media", mark: "media_ref", labelKey: "refCategoryMedia",
  placeholderKey: "mediaPlaceholder", scope: { kind: "global" },
  fetch: (q, o, l) => searchMedia(q, o, l),
  renderItem: (m) => m.filename ?? "—", getKey: (m) => m.id ?? "", getLabel: (m) => m.filename ?? m.id ?? "",
};
const comment: RefTypeDef<CommentSummary> = {
  id: "comment", mark: "comment_ref", labelKey: "refCategoryComment",
  placeholderKey: "commentPlaceholder",
  scope: {
    kind: "parent",
    parentPlaceholderKey: "lecturePlaceholder",
    parentFetch: searchLectures,
    parentRender: (l) => l.title ?? "—",
    parentKey: (l) => l.id ?? "",
    crumbLabel: (l) => l.title ?? l.id ?? "",
    childFetch: (parentId) => (q, o, l) => searchCommentsByLecture(parentId, q, o, l),
  },
  renderItem: (c) => c.snippet ?? "—", getKey: (c) => c.id ?? "", getLabel: (c) => c.snippet ?? c.id ?? "",
};

export const REF_TYPES: RefTypeDef<unknown>[] = [
  glossary as RefTypeDef<unknown>,
  document as RefTypeDef<unknown>,
  media as RefTypeDef<unknown>,
  comment as RefTypeDef<unknown>,
];
```

> ЗАМЕТКА: `DocumentSummary.title` — проверь по `src/api/schema.ts` (`document.DocumentSummary`); если поля `title` нет, используй `filename` (как сейчас в document-picker). Если у `searchDocuments`-результата только `filename` — убери `.title`. Свериться с фактической схемой; не выдумывать поля. Media-фасет (video/audio) в scoped-пикере НЕ переносим (плоский поиск по имени) — это намеренное упрощение из спеки §3.2.

- [ ] **Step 4: PASS** — Run: `pnpm vitest run src/components/ast-editor/pickers/ref-types.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-editor/pickers/ref-types.ts src/components/ast-editor/pickers/ref-types.test.tsx
git commit -m "feat(ast-editor): FE-карта ref-types (категории + scope контекста)"
```

---

## Task 8: `RefPicker` — scoped combobox

**Files:**
- Create: `src/components/ast-editor/pickers/ref-picker.tsx`
- Test: `src/components/ast-editor/pickers/ref-picker.test.tsx`

**Interfaces:**
- Consumes: `REF_TYPES` (Task 7), `useAsyncComboboxItems` (Task 3), `Combobox` (Task 1), kit `Button`, `useT("editor")`, TipTap `Editor`.
- Produces:
  ```ts
  interface RefPickerProps {
    editor: Editor;
    defaultLectureId?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** PRIMARY-путь: anchor каретки для @-поверхности (без trigger). */
    anchor?: { getBoundingClientRect: () => DOMRect };
    /** Тулбар: триггер-кнопка (Combobox.Trigger). */
    trigger?: React.ReactNode;
    /** Вызывается синхронно перед вставкой марки (AtMenu удаляет "@"-маркер). */
    onWillInsert?: () => void;
  }
  function RefPicker(props: RefPickerProps): JSX.Element;
  ```
  Поведение: заголовок-переключатель категорий (`REF_TYPES`, `aria-label` = `refCategoryAriaLabel`, kit-`Button` c `aria-pressed`); ниже combobox-поиск активной категории; для `comment` (scope.kind==="parent") при отсутствии `parentId` ищет лекции → выбор лекции ставит `parentId` (не вставляет, попап открыт) + крошка `refLectureCrumb`; затем ищет комментарии лекции; `defaultLectureId` префиллит `parentId`. Терминальный выбор сущности → `onWillInsert?.()` → вставка label-текста с `setMark(mark,{id})` (collapsed → `insertContent` с маркой; иначе `setMark`) → `onOpenChange(false)`.

- [ ] **Step 1: Тесты RefPicker (FAIL)**

`ref-picker.test.tsx` (мок `@/i18n/client` как в `at-menu.test.tsx`; мок `./actions` как в `at-menu.test.tsx`; editor через `buildExtensions`). Кейсы:
```tsx
// (шапка как в at-menu.test.tsx: мок i18n + мок ./actions с searchGlossary/searchLectures/searchCommentsByLecture/…;
//  makeEditor() из buildExtensions; afterEach cleanup+restore)

it("по умолчанию активна категория Термин и ищет глоссарий", async () => {
  mocked.searchGlossary.mockResolvedValue({ data: [{ id: "g1", title: "Бытие" }], total: 1 });
  const editor = makeEditor();
  render(<RefPicker editor={editor} open onOpenChange={() => undefined} />);
  expect(await screen.findByText("Бытие")).toBeInTheDocument();
  editor.destroy();
});

it("вставляет glossary_ref по выбору и зовёт onWillInsert", async () => {
  mocked.searchGlossary.mockResolvedValue({ data: [{ id: "g1", title: "Бытие" }], total: 1 });
  const onWillInsert = vi.fn();
  const editor = makeEditor();
  render(<RefPicker editor={editor} open onOpenChange={() => undefined} onWillInsert={onWillInsert} />);
  fireEvent.click(await screen.findByText("Бытие"));
  expect(onWillInsert).toHaveBeenCalled();
  const json = JSON.stringify(editor.getJSON());
  expect(json).toContain('"type":"glossary_ref"');
  expect(json).toContain('"id":"g1"');
  editor.destroy();
});

it("комментарий: сперва лекция, затем комментарий лекции (drill-in)", async () => {
  mocked.searchLectures.mockResolvedValue({ data: [{ id: "L1", title: "Онтология" }], total: 1 });
  mocked.searchCommentsByLecture.mockResolvedValue({ data: [{ id: "c1", snippet: "А что если" }], total: 1 });
  const editor = makeEditor();
  render(<RefPicker editor={editor} open onOpenChange={() => undefined} />);
  fireEvent.click(screen.getByRole("button", { name: "Комментарий" }));
  fireEvent.click(await screen.findByText("Онтология"));       // выбор лекции = drill-in
  expect(await screen.findByText(/Онтология/)).toBeInTheDocument(); // крошка
  fireEvent.click(await screen.findByText("А что если"));        // выбор комментария
  expect(JSON.stringify(editor.getJSON())).toContain('"type":"comment_ref"');
  expect(mocked.searchCommentsByLecture).toHaveBeenCalledWith("L1", "", 0, 20);
  editor.destroy();
});

it("defaultLectureId префиллит шаг 2 (сразу комментарии)", async () => {
  mocked.searchCommentsByLecture.mockResolvedValue({ data: [{ id: "c1", snippet: "Реплика" }], total: 1 });
  const editor = makeEditor();
  render(<RefPicker editor={editor} open onOpenChange={() => undefined} defaultLectureId="L9" />);
  fireEvent.click(screen.getByRole("button", { name: "Комментарий" }));
  expect(await screen.findByText("Реплика")).toBeInTheDocument();
  expect(mocked.searchCommentsByLecture).toHaveBeenCalledWith("L9", "", 0, 20);
  editor.destroy();
});
```

- [ ] **Step 2: FAIL** — Run: `pnpm vitest run src/components/ast-editor/pickers/ref-picker.test.tsx`

- [ ] **Step 3: Реализовать RefPicker (PRIMARY-путь)**

`ref-picker.tsx`:
```tsx
"use client";
import type { Editor } from "@tiptap/core";
import { useMemo, useState } from "react";

import { Button, Combobox } from "@/components/ui";
import { useT } from "@/i18n/client";

import { REF_TYPES, type RefTypeDef } from "./ref-types";
import { useAsyncComboboxItems, type AsyncFetcher } from "./use-async-combobox-items";

export interface RefPickerProps {
  editor: Editor;
  defaultLectureId?: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor?: { getBoundingClientRect: () => DOMRect } | undefined;
  trigger?: React.ReactNode;
  onWillInsert?: (() => void) | undefined;
}

export function RefPicker(props: RefPickerProps) {
  const t = useT("editor");
  const [activeId, setActiveId] = useState<RefTypeDef<unknown>["id"]>("glossary");
  const [parentId, setParentId] = useState<string | undefined>(props.defaultLectureId);
  const [parentLabel, setParentLabel] = useState<string | undefined>(undefined);

  const active = REF_TYPES.find((r) => r.id === activeId) ?? REF_TYPES[0];
  const inParentStep = active.scope.kind === "parent" && parentId === undefined;

  // Фетчер активного scope: либо global fetch, либо parent (лекции) / child (комменты).
  const fetcher: AsyncFetcher<unknown> = useMemo(() => {
    if (active.scope.kind === "parent") {
      return inParentStep
        ? (active.scope.parentFetch as AsyncFetcher<unknown>)
        : (active.scope.childFetch(parentId as string) as AsyncFetcher<unknown>);
    }
    return active.fetch as AsyncFetcher<unknown>;
  }, [active, inParentStep, parentId]);

  const list = useAsyncComboboxItems<unknown>(fetcher);

  const switchType = (id: RefTypeDef<unknown>["id"]) => {
    setActiveId(id);
    setParentId(id === "comment" ? props.defaultLectureId : undefined);
    setParentLabel(undefined);
    list.setQuery("");
  };

  const insertRef = (item: unknown) => {
    props.onWillInsert?.();
    const id = active.getKey(item);
    const label = active.getLabel(item);
    const editor = props.editor;
    if (editor.state.selection.empty) {
      editor.chain().focus().insertContent({
        type: "text", text: label, marks: [{ type: active.mark, attrs: { id } }],
      }).run();
    } else {
      editor.chain().focus().setMark(active.mark, { id }).run();
    }
    props.onOpenChange(false);
  };

  const onValueChange = (value: unknown) => {
    if (value == null) return;
    if (inParentStep && active.scope.kind === "parent") {
      setParentId(active.scope.parentKey(value));
      setParentLabel(active.scope.crumbLabel(value));
      list.setQuery("");
      return; // drill-in, не вставляем
    }
    insertRef(value);
  };

  const placeholder = inParentStep && active.scope.kind === "parent"
    ? t(active.scope.parentPlaceholderKey)
    : t(active.placeholderKey);

  const renderItem = (item: unknown): React.ReactNode =>
    inParentStep && active.scope.kind === "parent"
      ? active.scope.parentRender(item as never)
      : active.renderItem(item);
  const getKey = (item: unknown): string =>
    inParentStep && active.scope.kind === "parent"
      ? active.scope.parentKey(item as never)
      : active.getKey(item);

  // Ремоунт Combobox.Root на смене scope — иначе внутренняя selected-value/highlight
  // Base UI протекает между категориями (stale объект → getKey по чужой форме).
  const scopeKey = `${activeId}:${parentId ?? ""}`;

  // PRIMARY (подтверждён ревью): RefPicker САМ владеет попапом. Один Combobox.Root,
  // controlled open. Тулбар → Combobox.Trigger(props.trigger). "@" → Portal/Positioner
  // anchor={props.anchor}. Тело (категории + крошка + input + список) — внутри Popup.
  return (
    <Combobox.Root
      key={scopeKey}
      items={list.items as readonly unknown[]}
      filter={null}
      open={props.open}
      onOpenChange={(open) => { props.onOpenChange(open); }}
      inputValue={list.query}
      onInputValueChange={(v) => { list.setQuery(v); }}
      onValueChange={onValueChange}
      isItemEqualToValue={(a, b) => getKey(a) === getKey(b)}
    >
      {props.trigger ? <Combobox.Trigger render={props.trigger as React.ReactElement} /> : null}
      <Combobox.Portal>
        <Combobox.Positioner
          {...(props.anchor ? { anchor: props.anchor } : {})}
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <Combobox.Popup className="ref-picker p-1 min-w-[320px] max-w-[480px]">
            <div role="group" aria-label={t("refCategoryAriaLabel")} className="flex gap-1 p-1">
              {REF_TYPES.map((r) => (
                <Button key={r.id} type="button" aria-pressed={activeId === r.id}
                  tone={activeId === r.id ? "primary" : "neutral"}
                  onClick={() => { switchType(r.id); }}>
                  {t(r.labelKey)}
                </Button>
              ))}
            </div>
            {active.scope.kind === "parent" && parentId !== undefined && (
              <Button tone="quiet" compact
                onClick={() => { setParentId(undefined); setParentLabel(undefined); list.setQuery(""); }}>
                {t("refLectureCrumb", { title: parentLabel ?? "" })}
              </Button>
            )}
            <Combobox.Input placeholder={placeholder} />
            <Combobox.List>
              {(item: unknown) => (
                <Combobox.Item key={getKey(item)} value={item}>{renderItem(item)}</Combobox.Item>
              )}
            </Combobox.List>
            {list.status === "empty" && <div role="presentation">{t("comboboxEmpty")}</div>}
            {list.status === "loading" && <div role="presentation">{t("comboboxLoading")}</div>}
            {list.status === "error" && (
              <div role="presentation">{t("comboboxError")}
                <Button tone="quiet" compact onClick={() => { list.reload(); }}>{t("comboboxRetry")}</Button>
              </div>
            )}
            {list.canLoadMore && (
              <div role="presentation">
                <Button tone="quiet" compact onClick={() => { list.loadMore(); }}>{t("comboboxLoadMore")}</Button>
              </div>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
```

> ЗАМЕТКИ к PRIMARY:
> - Хук `useAsyncComboboxItems` живёт в теле RefPicker (НЕ внутри Combobox.Root) → переживает ремоунт по `key`, items не теряются.
> - `Combobox.Trigger render={element}` мёржит пропсы в переданный элемент (тулбарную кнопку). Для «@» trigger отсутствует — попап управляется `open` + якорится `anchor` (caret virtual element), как Popover без триггера (подтверждено ревью).
> - `onOpenChange` маршрутизирует Esc/клик-вне в `props.onOpenChange` (AtMenu закрывает плагин + фокус; RefPopover — useState).
> - Свериться эмпирически: клик по категории-кнопке внутри Popup не должен закрывать попап (она внутри, не outside-press) и не считается выбором item (не Combobox.Item). Если Base UI всё же закрывает — обернуть кнопки так, чтобы клик не всплывал как dismiss (или вынести ScopeBar над Positioner недопустимо для «1 попап» — тогда подавить dismiss по reason).

- [ ] **Step 4: PASS** — Run: `pnpm vitest run src/components/ast-editor/pickers/ref-picker.test.tsx` (правь селекторы под фактический DOM, сохраняя смысл).

- [ ] **Step 5: Lint** — Run: `pnpm eslint src/components/ast-editor/pickers/ref-picker.tsx src/components/ast-editor/pickers/ref-picker.test.tsx`

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-editor/pickers/ref-picker.tsx src/components/ast-editor/pickers/ref-picker.test.tsx
git commit -m "feat(ast-editor): RefPicker — scoped combobox (категории + drill-in лекции)"
```

---

## Task 9: Перевести `AtMenu` на `RefPicker`

**Files:**
- Modify: `src/components/ast-editor/pickers/at-menu.tsx`
- Modify: `src/components/ast-editor/pickers/at-menu.test.tsx`

**Interfaces:**
- Consumes: `RefPicker` (Task 8), `caretVirtualElement` (`../caret-anchor`), `atSuggestionKey/closeAtSuggestion/consumeAtMarker` (плагин).
- Produces: `AtMenu({ editor, defaultLectureId? })` — поведение как раньше (открытие по плагин-состоянию, anchor=каретка, вставка ссылки, удаление "@"-маркера, закрытие), но через `RefPicker`.

- [ ] **Step 1: Адаптировать тесты at-menu**

В `at-menu.test.tsx`:
- кейс «открывается по '@', вставляет glossary_ref и удаляет маркер» — оставить смысл: открыть, выбрать «Термин» уже активен по умолчанию → клик по найденному термину → проверить `glossary_ref` + `id` + удаление "@". (Категория Термин активна сразу, отдельного клика «Термин» не нужно.)
- кейс фокуса/Escape — адаптировать под Combobox/Popover поведение (Esc закрывает; фокус — внутрь поиска). Сохранить «coordsAtPos вызывается» (anchor каретки).

(Точный текст — по фактическому DOM RefPicker; смысл кейсов прежний.)

- [ ] **Step 2: FAIL** — Run: `pnpm vitest run src/components/ast-editor/pickers/at-menu.test.tsx`

- [ ] **Step 3: Реализовать AtMenu через RefPicker**

PRIMARY-путь — заменить тело рендера `at-menu.tsx` (сохранить transaction-listener для `state` и `anchor = useMemo(caretVirtualElement)`), отдав попап RefPicker'у:
```tsx
// ...верх файла как сейчас: state из плагина, anchor = useMemo(() => caretVirtualElement(editor, state.from), ...)
return (
  <RefPicker
    editor={editor}
    defaultLectureId={defaultLectureId}
    open={state.open}
    onOpenChange={(open) => { if (!open) { closeAtSuggestion(editor.view); editor.commands.focus(); } }}
    anchor={anchor}
    onWillInsert={() => { consumeAtMarker(editor.view, state.from); }}
  />
);
```
> `anchor`/`open` применяются ВНУТРИ RefPicker (PRIMARY: его `Combobox.Positioner anchor={anchor}` + controlled `open`). AtMenu лишь прокидывает props. Обеспечить: `@`-меню открывается по плагину, позиционируется под каретку, вставка ссылки удаляет "@" (`onWillInsert`), Esc/клик-вне закрывают через `onOpenChange`.

- [ ] **Step 4: PASS** — Run: `pnpm vitest run src/components/ast-editor/pickers/at-menu.test.tsx`

- [ ] **Step 5: Lint** — Run: `pnpm eslint src/components/ast-editor/pickers/at-menu.tsx src/components/ast-editor/pickers/at-menu.test.tsx`

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-editor/pickers/at-menu.tsx src/components/ast-editor/pickers/at-menu.test.tsx
git commit -m "refactor(ast-editor): AtMenu на RefPicker (scoped combobox)"
```

---

## Task 10: Перевести `RefPopover` (тулбар) на `RefPicker`

**Files:**
- Modify: `src/components/ast-editor/toolbar/buttons/ref-popover.tsx`
- Modify: `src/components/ast-editor/toolbar/toolbar.test.tsx`

**Interfaces:**
- Consumes: `RefPicker` (Task 8), kit `Toolbar`, `AtIcon` (Task 6), `useT`.
- Produces: `RefPopover({ editor, schema, defaultLectureId? })` — кнопка-закладка (иконка `@`) открывает `RefPicker`; gating `schema.marks.has("glossary_ref")` сохранить.

- [ ] **Step 1: Адаптировать toolbar-тест**

В `toolbar.test.tsx` кейс «прокидывает defaultLectureId до пикера (сразу шаг 2)» — адаптировать: открыть поповер, переключиться на «Комментарий», убедиться что сразу ищутся комментарии (`searchCommentsByLecture` с переданным lectureId), без шага выбора лекции.

- [ ] **Step 2: FAIL** — Run: `pnpm vitest run src/components/ast-editor/toolbar/toolbar.test.tsx`

- [ ] **Step 3: Реализовать RefPopover через RefPicker**

`ref-popover.tsx`:
```tsx
"use client";
import type { Editor } from "@tiptap/core";
import { useState } from "react";

import { AtIcon } from "@/assets/icons/at-icon";
import { Toolbar } from "@/components/ui";
import { useT } from "@/i18n/client";

import { RefPicker } from "../../pickers/ref-picker";
import type { SchemaSnapshot } from "../../types";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
  defaultLectureId?: string | undefined;
}

export function RefPopover({ editor, schema, defaultLectureId }: Props) {
  const t = useT("editor");
  const [open, setOpen] = useState(false);
  if (!schema.marks.has("glossary_ref")) return null;
  return (
    <RefPicker
      editor={editor}
      defaultLectureId={defaultLectureId}
      open={open}
      onOpenChange={setOpen}
      trigger={<Toolbar.Button aria-label={t("insertRefAriaLabel")}><AtIcon /></Toolbar.Button>}
    />
  );
}
```
> RefPicker применяет `trigger` как `Combobox.Trigger` (PRIMARY). Поведение: клик по кнопке-@ открывает scoped combobox; вставка ссылки закрывает (через `onOpenChange`).

- [ ] **Step 4: PASS** — Run: `pnpm vitest run src/components/ast-editor/toolbar/toolbar.test.tsx`

- [ ] **Step 5: Lint** — Run: `pnpm eslint src/components/ast-editor/toolbar/buttons/ref-popover.tsx src/components/ast-editor/toolbar/toolbar.test.tsx`

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-editor/toolbar/buttons/ref-popover.tsx src/components/ast-editor/toolbar/toolbar.test.tsx
git commit -m "refactor(ast-editor): RefPopover (тулбар) на RefPicker + иконка @"
```

---

## Task 11: Удалить старый `RefMenu` и `Comment2StagePicker`

**Files:**
- Delete: `src/components/ast-editor/pickers/ref-menu.tsx`, `ref-menu.test.tsx`
- Delete: `src/components/ast-editor/pickers/comment-2stage-picker.tsx`
- Modify: `src/components/ast-editor/pickers/pickers.test.tsx` (убрать кейсы Comment2StagePicker, если есть)

**Interfaces:** RefMenu/Comment2StagePicker больше не импортируются нигде (AtMenu/RefPopover на RefPicker).

- [ ] **Step 1: Проверить, что нет импортёров**

Run:
```bash
rg -n "ref-menu|RefMenu|Comment2StagePicker|comment-2stage-picker" src
```
Expected: только сами удаляемые файлы (или их тест-кейсы в pickers.test.tsx). Если есть внешние импортёры — починить их до удаления.

- [ ] **Step 2: Удалить файлы**

```bash
git rm src/components/ast-editor/pickers/ref-menu.tsx src/components/ast-editor/pickers/ref-menu.test.tsx src/components/ast-editor/pickers/comment-2stage-picker.tsx
```

- [ ] **Step 3: Вычистить pickers.test.tsx**

Удалить из `pickers.test.tsx` импорт и describe-блок Comment2StagePicker (если он там был). Остальные пер-типовые кейсы оставить (они валидны — пикеры живут).

- [ ] **Step 3b: Обновить README ast-editor**

`src/components/ast-editor/README.md` сейчас пишет «Pickers (Phase 2b): AsyncCombobox + 5 активных категорий + 2-stage comment picker». Обновить под новую архитектуру: `useAsyncComboboxItems` (движок) → `AsyncCombobox` (generic, на Base UI Combobox) + `RefPicker` (scoped: категории-переключатель + drill-in лекции через `ref-types`); RefMenu/Comment2StagePicker удалены; canvas dormant. Найти и поправить упоминания `RefMenu`/`AsyncCombobox` в README (`rg -n "RefMenu|AsyncCombobox|2-stage" src/components/ast-editor/README.md`).

- [ ] **Step 4: Прогнать ast-editor тесты**

Run: `pnpm vitest run src/components/ast-editor`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-editor/pickers/pickers.test.tsx src/components/ast-editor/README.md
git commit -m "chore(ast-editor): удалить RefMenu/Comment2StagePicker (замещены RefPicker) + README"
```

---

## Task 12: i18n — новые ключи во все каталоги

**Files:**
- Modify: `src/i18n/messages/ru/editor.ts`, `src/i18n/messages/en/editor.ts`, `src/i18n/messages/ar/editor.ts`, `src/i18n/messages/zh/editor.ts`
- Тесты паритета i18n (существующие) — должны проходить.

**Новые ключи** (значения ru/en даны; ar/zh — перевести по установленному процессу i18n проекта; en-XA генерится из en автоматически):

ru:
```ts
refCategoryAriaLabel: "Тип ссылки",
refLectureCrumb: "Лекция: {title}",
```
en:
```ts
refCategoryAriaLabel: "Reference type",
refLectureCrumb: "Lecture: {title}",
```
ar (перевод носителя; RTL): `refCategoryAriaLabel`, `refLectureCrumb: "محاضرة: {title}"` (выверить).
zh (简体): `refCategoryAriaLabel`, `refLectureCrumb: "讲座：{title}"` (выверить).

> **Мёртвые ключи после Task 11** (Comment2StagePicker удалён, `parentLabelKey` убран из scope): `commentPickerStep1`, `commentPickerStep2`, `commentPickerChangeLecture` — все три больше не используются. Удалить из ВСЕХ 4 каталогов (i18n parity требует синхронности). **НЕ удалять** `mediaType*` (нужны standalone `MediaPicker` в canvas/trails), все `*Placeholder` и `combobox*` (живут). Перед удалением подтвердить: `rg -n "commentPickerStep1|commentPickerStep2|commentPickerChangeLecture" src` → совпадения только в каталогах i18n (если где-то ещё используется — не удалять).

- [ ] **Step 1: Добавить ключи во все 4 каталога** (ru/en/ar/zh), в секцию ref-menu.

- [ ] **Step 2: Прогнать i18n parity + compile тесты**

Run: `pnpm vitest run src/i18n`
Expected: PASS (паритет ключей, ICU-аргумент `{title}` валиден во всех локалях).

- [ ] **Step 3: Удалить мёртвые ключи (если есть)** — по проверке `rg`, синхронно во всех каталогах. Перепрогнать `pnpm vitest run src/i18n`.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/messages/ru/editor.ts src/i18n/messages/en/editor.ts src/i18n/messages/ar/editor.ts src/i18n/messages/zh/editor.ts
git commit -m "i18n(editor): ключи refCategoryAriaLabel/refLectureCrumb (+ чистка мёртвых)"
```

---

## Task 13: Финальный гейт

**Files:** весь репозиторий (проверка, без новых правок кроме фиксов).

- [ ] **Step 1: Lint всего**

Run: `pnpm lint`
Expected: 0 ошибок (Guardrail 7 зелёный — нет прямых @base-ui вне ui/).

- [ ] **Step 2: Тесты всего**

Run: `pnpm test`
Expected: PASS (включая i18n parity, eslint-config test, все затронутые слайсы).

- [ ] **Step 3: knip (мёртвый код)**

Run: `pnpm knip` (если в проекте сконфигурирован; см. memory bundle-analysis). Убедиться, что `bookmark-icon`, `ref-menu`, `comment-2stage-picker` не висят как мёртвые экспорты и нет новых unused.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: успешная сборка.

- [ ] **Step 5: Commit фиксов (если были)**

```bash
git add <изменённые файлы>
git commit -m "chore(ast-editor): зелёный гейт ref-picker combobox (lint/test/build/knip)"
```

- [ ] **Step 6: Ручная браузер-приёмка (за пользователем)**

jsdom не проверяет лейаут/позиционирование/реальную клавиатуру. Проверить в браузере: `@`-меню под кареткой; переключение категорий; drill-in лекция→комментарий + крошка; вставка каждой из 4 ссылок; кнопка-@ в тулбаре; Esc/клик-вне; RTL (ar) и узкий вьюпорт.

---

## Self-Review (выполнено автором плана)

**Spec coverage:** §2 типы/annotation/поверхности/контекст → Tasks 7/8/9/10; §3.1 хук → Task 3; §3.2 AsyncCombobox → Task 4 (+ §5 конвергенция → Task 5); §3.3 refTypes → Task 7; §3.4 RefPicker drill-in → Task 8; §3.5 поверхности + спайк → Tasks 2/9/10; §4 иконка → Task 6; §5 удаление → Tasks 6/11; §6 kit Combobox → Task 1; §7 i18n/a11y → Task 12 (+ a11y нативно в Combobox); §8 тесты → в каждом таске; §9 параллельные агенты → Global Constraints. Покрыто.

**Placeholder scan:** код приведён для всех новых юнитов; для DOM-зависимых селекторов и финальной композиции попапа (зависит от спайка Task 2) даны явные инструкции с выбором пути — это осознанная зависимость от результата спайка, не placeholder.

**Type consistency:** `AsyncFetcher<T>` (Task 3) используется в Tasks 4/7/8; `RefTypeDef`/`REF_TYPES` (Task 7) — в Task 8; `RefPickerProps` (Task 8) — в Tasks 9/10; имена методов хука (`setQuery/loadMore/reload/canLoadMore/status`) согласованы между Tasks 3/4/8.

**Зависимость от спайка — СНЯТА:** мультиагентное ревью эмпирически подтвердило PRIMARY (input-in-popup + caret anchor + controlled open в `@base-ui/react@1.4.1`). Tasks 8–10 написаны под PRIMARY; Task 2 — смоук-подтверждение. См. «Review fixes» в шапке: исправлены 3 BLOCKER (RefPicker владеет попапом; `DocumentSummary.title`→`filename`; AtIcon-путь) + MAJOR (key на Combobox.Root против утечки scope; явный список тестов Task 5).
