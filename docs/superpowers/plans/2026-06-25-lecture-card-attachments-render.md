# Lecture Card: управление + рендер вложений — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить отдельную страницу `/admin/lectures/[id]/attachments` на «карточку лекции» `/admin/lectures/[id]`, где вложениями управляют сверху, а документы/медиа рендерятся ниже (документы — вкладками с ленивой загрузкой тела по одному).

**Architecture:** Server-страница `page.tsx` гейтит owner, тянет списки документов/медиа (метаданные), server-side рендерит тело «основного» документа (первый по `sort_order`) и передаёт его как готовый узел в client-компонент вкладок `LectureDocumentTabs`. Неактивные вкладки подгружают тело лениво через inline-`"use server"` экшен страницы (cross-feature импорт `@/features/documents` запрещён в слайсе, но разрешён на странице). Новый kit-примитив `Tabs` оборачивает Base UI Tabs.

**Tech Stack:** Next.js App Router (RSC + server actions), Base UI (`@base-ui/react/tabs`), Tailwind v4 токены, next-intl (`@/i18n`), Vitest + Testing Library.

## Global Constraints

- pnpm-тулчейн (НЕ npm). Гейт перед готовностью: `pnpm lint && pnpm test && pnpm build` — зелёные.
- Именование файлов в `src/` — kebab-case.
- Общение/комментарии — на русском.
- Параллельные агенты: НЕ `git stash/reset/checkout .`/`clean`; НЕ `git add -A`/`.` — добавлять только свои файлы по имени; `git commit --only <свои файлы>`.
- RBAC: server — `requireCapability`/гейт; UI — `canX()`; Layer-3 гейт страницы `if (!canX(me)) forbidden();`.
- Kit (`src/components/ui/*`) — заморожённая зона; добавление примитива `Tabs` **явно санкционировано** пользователем для этой задачи (Guardrail 7/8: closed `className` на leaf, токены `--color-*`).
- «Основной» документ — стопгап: первый по `sort_order` (в контракте бэка нет `is_primary`). Помечать комментом со ссылкой на spec; снять, когда бэк добавит флаг.
- Спека: [docs/superpowers/specs/2026-06-25-lecture-card-attachments-render-design.md](../specs/2026-06-25-lecture-card-attachments-render-design.md).

---

### Task 1: Kit-примитив `Tabs` (Base UI)

**Files:**
- Create: `src/components/ui/tabs.tsx`
- Create: `src/components/ui/tabs.test.tsx`
- Modify: `src/components/ui/index.ts` (добавить экспорт)

**Interfaces:**
- Produces: `Tabs` — объект `{ Root, List, Tab, Panel }`.
  - `Tabs.Root({ value?, defaultValue?, onValueChange?(v: string), children })`
  - `Tabs.List({ children, "aria-label"? })`
  - `Tabs.Tab({ value: string, children })`
  - `Tabs.Panel({ value: string, children, keepMounted? })` — по умолчанию `keepMounted=false` (неактивная панель размонтируется → ленивый контент грузится только при активации).

- [ ] **Step 1: Failing-тест** — `src/components/ui/tabs.test.tsx`

```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Tabs } from "./tabs";

afterEach(cleanup);

function Fixture() {
  return (
    <Tabs.Root defaultValue="a">
      <Tabs.List aria-label="разделы">
        <Tabs.Tab value="a">Вкладка A</Tabs.Tab>
        <Tabs.Tab value="b">Вкладка B</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="a">Контент A</Tabs.Panel>
      <Tabs.Panel value="b">Контент B</Tabs.Panel>
    </Tabs.Root>
  );
}

describe("Tabs", () => {
  it("рендерит tablist с вкладками и активную панель по defaultValue", () => {
    render(<Fixture />);
    expect(screen.getByRole("tablist", { name: "разделы" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    // активная панель имеет роль tabpanel (a11y-контракт Base UI)
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    expect(screen.getByText("Контент A")).toBeInTheDocument();
    // keepMounted=false по умолчанию — неактивная панель не в DOM
    expect(screen.queryByText("Контент B")).not.toBeInTheDocument();
  });

  it("переключает активную панель по клику на вкладку", () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole("tab", { name: "Вкладка B" }));
    expect(screen.getByText("Контент B")).toBeInTheDocument();
    expect(screen.queryByText("Контент A")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Запустить — упадёт (нет файла)**

Run: `pnpm test src/components/ui/tabs.test.tsx`
Expected: FAIL — `Cannot find module './tabs'`.

- [ ] **Step 3: Реализация** — `src/components/ui/tabs.tsx`

```tsx
"use client";
// src/components/ui/tabs.tsx
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ReactNode } from "react";

import { cn, FOCUS_RING_CONTROL } from "./cn";

interface RootProps {
  /** Активная вкладка (controlled). */
  value?: string;
  /** Значение по умолчанию (uncontrolled). */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}

function Root({ value, defaultValue, onValueChange, children }: RootProps) {
  return (
    <BaseTabs.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={(v) => onValueChange?.(String(v))}
    >
      {children}
    </BaseTabs.Root>
  );
}

interface ListProps {
  children: ReactNode;
  "aria-label"?: string;
}

function List({ children, "aria-label": ariaLabel }: ListProps) {
  return (
    <BaseTabs.List
      aria-label={ariaLabel}
      className={cn("flex flex-wrap gap-1 border-b border-(--color-border)")}
    >
      {children}
    </BaseTabs.List>
  );
}

interface TabProps {
  value: string;
  children: ReactNode;
  /** Полный текст в title (для усечённых длинных имён файлов). */
  title?: string;
}

function Tab({ value, children, title }: TabProps) {
  return (
    <BaseTabs.Tab
      value={value}
      title={title}
      className={cn(
        "-mb-px max-w-[14rem] cursor-pointer truncate rounded-t border-b-2 border-transparent px-3 py-1.5 text-sm",
        "text-(--color-fg-muted) outline-none transition-colors",
        "hover:text-(--color-fg)",
        "data-[selected]:border-(--color-fg) data-[selected]:font-semibold data-[selected]:text-(--color-fg)",
        FOCUS_RING_CONTROL,
      )}
    >
      {children}
    </BaseTabs.Tab>
  );
}

interface PanelProps {
  value: string;
  children: ReactNode;
  /** false (по умолчанию) — неактивная панель размонтируется. */
  keepMounted?: boolean;
}

function Panel({ value, children, keepMounted }: PanelProps) {
  return (
    <BaseTabs.Panel
      value={value}
      keepMounted={keepMounted}
      className={cn("pt-4 outline-none")}
    >
      {children}
    </BaseTabs.Panel>
  );
}

export const Tabs = { Root, List, Tab, Panel };
```

- [ ] **Step 4: Экспорт из kit** — добавить в конец `src/components/ui/index.ts`:

```ts
export { Tabs } from "./tabs";
```

- [ ] **Step 5: Запустить — зелено**

Run: `pnpm test src/components/ui/tabs.test.tsx`
Expected: PASS (оба теста).

- [ ] **Step 6: Коммит**

`index.ts` кита — общий hot-файл; коммитим через `--only`.

```bash
git add src/components/ui/tabs.tsx src/components/ui/tabs.test.tsx src/components/ui/index.ts
git commit --only src/components/ui/tabs.tsx src/components/ui/tabs.test.tsx src/components/ui/index.ts -m "feat(ui-kit): Tabs-примитив на Base UI Tabs"
```

---

### Task 2: i18n-ключи карточки (admin + lectures, 4 локали)

**Files:**
- Modify: `src/i18n/messages/ru/admin.ts`, `src/i18n/messages/en/admin.ts`, `src/i18n/messages/ar/admin.ts`, `src/i18n/messages/zh/admin.ts`
- Modify: `src/i18n/messages/ru/lectures.ts`, `src/i18n/messages/en/lectures.ts`, `src/i18n/messages/ar/lectures.ts`, `src/i18n/messages/zh/lectures.ts`

**Interfaces:**
- Produces (namespace `admin`): `cardMetaTitle`, `cardEditLink`, `cardDocumentsHeading`, `cardMediaHeading`, `cardMediaUnavailable`.
- Produces (namespace `lectures`): `documentTabsAriaLabel`, `docTabLoading`, `docTabError`, `docTabEmpty`.
- Оставить: `attachmentsDocumentFallback`, `attachmentsDocsSectionTitle`, `attachmentsMediaSectionTitle` (используются менеджерами на карточке). Мёртвые ключи `attachmentsMetaTitle`/`attachmentsPageTitle` удаляются НЕ здесь, а в Task 4 — вместе со страницей, которая их ещё использует (иначе промежуточная сборка между Task 2 и Task 4 краснеет на типах ключей).

- [ ] **Step 1: admin — добавить ключи (все 4 локали)**

В каждом `…/admin.ts` рядом с блоком `attachments*` добавить ключи (только добавление, без удаления):

`ru/admin.ts`:
```ts
  // --- карточка лекции (/admin/lectures/[id]) ---
  cardMetaTitle: "Лекция",
  cardEditLink: "Редактировать лекцию",
  cardDocumentsHeading: "Документы",
  cardMediaHeading: "Медиа",
  cardMediaUnavailable: "Медиафайл недоступен.",
```
`en/admin.ts`:
```ts
  // --- lecture card (/admin/lectures/[id]) ---
  cardMetaTitle: "Lecture",
  cardEditLink: "Edit lecture",
  cardDocumentsHeading: "Documents",
  cardMediaHeading: "Media",
  cardMediaUnavailable: "Media file is unavailable.",
```
`ar/admin.ts`:
```ts
  // --- بطاقة المحاضرة (/admin/lectures/[id]) ---
  cardMetaTitle: "محاضرة",
  cardEditLink: "تعديل المحاضرة",
  cardDocumentsHeading: "المستندات",
  cardMediaHeading: "الوسائط",
  cardMediaUnavailable: "ملف الوسائط غير متاح.",
```
`zh/admin.ts`:
```ts
  // --- 讲座卡片 (/admin/lectures/[id]) ---
  cardMetaTitle: "讲座",
  cardEditLink: "编辑讲座",
  cardDocumentsHeading: "文档",
  cardMediaHeading: "媒体",
  cardMediaUnavailable: "媒体文件不可用。",
```

- [ ] **Step 2: lectures — добавить ключи (все 4 локали)**

На верхнем уровне объекта `lectures` (рядом с `visibilityPublic` и т.п.) добавить:

`ru/lectures.ts`:
```ts
  documentTabsAriaLabel: "Документы лекции",
  docTabLoading: "Загрузка документа…",
  docTabError: "Не удалось загрузить документ.",
  docTabEmpty: "Пустой документ.",
```
`en/lectures.ts`:
```ts
  documentTabsAriaLabel: "Lecture documents",
  docTabLoading: "Loading document…",
  docTabError: "Failed to load the document.",
  docTabEmpty: "Empty document.",
```
`ar/lectures.ts`:
```ts
  documentTabsAriaLabel: "مستندات المحاضرة",
  docTabLoading: "جارٍ تحميل المستند…",
  docTabError: "تعذّر تحميل المستند.",
  docTabEmpty: "مستند فارغ.",
```
`zh/lectures.ts`:
```ts
  documentTabsAriaLabel: "讲座文档",
  docTabLoading: "正在加载文档…",
  docTabError: "无法加载文档。",
  docTabEmpty: "空文档。",
```

- [ ] **Step 3: Прогнать i18n-паритет и типы**

Run: `pnpm test src/i18n`
Expected: PASS — все локали имеют одинаковый набор ключей (паритет), компиляция каталогов ок. (Добавление одних и тех же ключей во все 4 локали паритет сохраняет.)

- [ ] **Step 4: Коммит**

i18n-каталоги — общие hot-файлы (могут трогаться параллельными агентами): коммитим через `--only`, чтобы не утянуть чужой staged-контент.

```bash
git add src/i18n/messages/ru/admin.ts src/i18n/messages/en/admin.ts src/i18n/messages/ar/admin.ts src/i18n/messages/zh/admin.ts src/i18n/messages/ru/lectures.ts src/i18n/messages/en/lectures.ts src/i18n/messages/ar/lectures.ts src/i18n/messages/zh/lectures.ts
git commit --only src/i18n/messages/ru/admin.ts src/i18n/messages/en/admin.ts src/i18n/messages/ar/admin.ts src/i18n/messages/zh/admin.ts src/i18n/messages/ru/lectures.ts src/i18n/messages/en/lectures.ts src/i18n/messages/ar/lectures.ts src/i18n/messages/zh/lectures.ts -m "i18n(lectures): ключи карточки лекции (admin+lectures, ru/en/ar/zh)"
```

---

### Task 3: Client-компонент `LectureDocumentTabs` (ленивая загрузка + кэш)

**Files:**
- Create: `src/features/lectures/ui/lecture-document-tabs.tsx`
- Create: `src/features/lectures/ui/lecture-document-tabs.test.tsx`
- Modify: `src/features/lectures/index.ts` (экспорт компонента + типа)

**Interfaces:**
- Consumes: `Tabs` из `@/components/ui` (Task 1); `AstRender`, `AstBlock` из `@/components/ast-render`; `ActionResult` из `@/utils/create-action`.
- Produces:
  - `interface DocTabMeta { id: string; label: string }`
  - `LectureDocumentTabs({ docs: DocTabMeta[], primaryId: string, primaryPanel: ReactNode, loadBlocks: (docId: string) => Promise<ActionResult<AstBlock[]>> })`
  - Инвариант: на старте рендерится только `primaryPanel`; тело неосновной вкладки грузится через `loadBlocks` при первой активации, кэшируется (повторное открытие — без запроса).

- [ ] **Step 1: Failing-тест** — `src/features/lectures/ui/lecture-document-tabs.test.tsx`

```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// useT("lectures") → реальный ru-каталог (как в соседних обёртках)
vi.mock("@/i18n/client", async () => {
  const lectures = (await import("@/i18n/messages/ru/lectures")).default;
  const useT = () => (key: string) =>
    (key.split(".").reduce<unknown>(
      (acc, k) => (acc as Record<string, unknown> | undefined)?.[k],
      lectures,
    ) ?? key) as string;
  return { useT };
});

import { LectureDocumentTabs } from "./lecture-document-tabs";

afterEach(cleanup);

const DOCS = [
  { id: "d1", label: "Первый" },
  { id: "d2", label: "Второй" },
];

describe("LectureDocumentTabs", () => {
  it("показывает основной документ и не грузит остальные на старте", () => {
    const loadBlocks = vi.fn();
    render(
      <LectureDocumentTabs
        docs={DOCS}
        primaryId="d1"
        primaryPanel={<div>ОСНОВНОЙ</div>}
        loadBlocks={loadBlocks}
      />,
    );
    expect(screen.getByText("ОСНОВНОЙ")).toBeInTheDocument();
    expect(loadBlocks).not.toHaveBeenCalled();
    // ленивая панель d2 не смонтирована (keepMounted=false) — её состояний нет в DOM
    expect(screen.queryByText("Загрузка документа…")).not.toBeInTheDocument();
  });

  it("лениво грузит тело второй вкладки и кэширует (без повторного запроса)", async () => {
    const loadBlocks = vi.fn().mockResolvedValue({
      success: true,
      data: [{ id: "p1", type: "paragraph", content: [{ type: "text", text: "ВТОРОЙ-ТЕЛО" }] }],
    });
    render(
      <LectureDocumentTabs
        docs={DOCS}
        primaryId="d1"
        primaryPanel={<div>ОСНОВНОЙ</div>}
        loadBlocks={loadBlocks}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Второй" }));
    await waitFor(() => expect(screen.getByText("ВТОРОЙ-ТЕЛО")).toBeInTheDocument());
    expect(loadBlocks).toHaveBeenCalledTimes(1);

    // назад на первую, затем снова на вторую — запрос не повторяется (кэш в родителе)
    fireEvent.click(screen.getByRole("tab", { name: "Первый" }));
    fireEvent.click(screen.getByRole("tab", { name: "Второй" }));
    await waitFor(() => expect(screen.getByText("ВТОРОЙ-ТЕЛО")).toBeInTheDocument());
    expect(loadBlocks).toHaveBeenCalledTimes(1);
  });

  it("ошибка загрузки → docTabError; результат не кэшируется (повторная активация грузит снова)", async () => {
    const loadBlocks = vi.fn().mockResolvedValue({ success: false, error: "boom" });
    render(
      <LectureDocumentTabs
        docs={DOCS}
        primaryId="d1"
        primaryPanel={<div>ОСНОВНОЙ</div>}
        loadBlocks={loadBlocks}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Второй" }));
    await waitFor(() =>
      expect(screen.getByText("Не удалось загрузить документ.")).toBeInTheDocument(),
    );
    expect(loadBlocks).toHaveBeenCalledTimes(1);

    // ошибка НЕ кэшируется (onLoaded не звался) — возврат и повторная активация грузят снова
    fireEvent.click(screen.getByRole("tab", { name: "Первый" }));
    fireEvent.click(screen.getByRole("tab", { name: "Второй" }));
    await waitFor(() => expect(loadBlocks).toHaveBeenCalledTimes(2));
  });
});
```

- [ ] **Step 2: Запустить — упадёт (нет файла)**

Run: `pnpm test src/features/lectures/ui/lecture-document-tabs.test.tsx`
Expected: FAIL — `Cannot find module './lecture-document-tabs'`.

- [ ] **Step 3: Реализация** — `src/features/lectures/ui/lecture-document-tabs.tsx`

```tsx
"use client";
// src/features/lectures/ui/lecture-document-tabs.tsx
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { AstRender } from "@/components/ast-render";
import type { AstBlock } from "@/components/ast-render";
import { Tabs } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

export interface DocTabMeta {
  id: string;
  label: string;
}

interface Props {
  docs: DocTabMeta[];
  /** id активной по умолчанию вкладки (основной документ). */
  primaryId: string;
  /** Серверно-отрисованное тело основного документа (без доп. запроса). */
  primaryPanel: ReactNode;
  /** Ленивая загрузка тела неосновного документа по id. */
  loadBlocks: (docId: string) => Promise<ActionResult<AstBlock[]>>;
}

/**
 * Вкладки документов лекции. Грузится тело только активного: основной отрисован
 * сервером (primaryPanel), остальные — лениво при первой активации, с кэшем тел
 * в состоянии родителя (переживает размонтирование панели при keepMounted=false).
 */
export function LectureDocumentTabs({ docs, primaryId, primaryPanel, loadBlocks }: Props) {
  const tL = useT("lectures");
  const [cache, setCache] = useState<Record<string, AstBlock[]>>({});

  return (
    <Tabs.Root defaultValue={primaryId}>
      <Tabs.List aria-label={tL("documentTabsAriaLabel")}>
        {docs.map((d) => (
          <Tabs.Tab key={d.id} value={d.id} title={d.label}>
            {d.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {docs.map((d) => (
        <Tabs.Panel key={d.id} value={d.id}>
          {d.id === primaryId ? (
            primaryPanel
          ) : (
            <LazyDocPanel
              docId={d.id}
              cached={cache[d.id]}
              loadBlocks={loadBlocks}
              onLoaded={(blocks) => setCache((c) => ({ ...c, [d.id]: blocks }))}
            />
          )}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; blocks: AstBlock[] }
  | { status: "error" };

function LazyDocPanel({
  docId,
  cached,
  loadBlocks,
  onLoaded,
}: {
  docId: string;
  cached: AstBlock[] | undefined;
  loadBlocks: (docId: string) => Promise<ActionResult<AstBlock[]>>;
  onLoaded: (blocks: AstBlock[]) => void;
}) {
  const tL = useT("lectures");
  const [state, setState] = useState<LoadState>(
    cached ? { status: "ready", blocks: cached } : { status: "loading" },
  );

  useEffect(() => {
    if (cached) {
      setState({ status: "ready", blocks: cached });
      return;
    }
    let alive = true;
    setState({ status: "loading" });
    void loadBlocks(docId).then((r) => {
      if (!alive) return;
      if (r.success) {
        setState({ status: "ready", blocks: r.data });
        onLoaded(r.data);
      } else {
        setState({ status: "error" });
      }
    });
    return () => {
      alive = false;
    };
    // onLoaded стабилен в рамках жизни родителя; реальные триггеры — docId/cached.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, cached]);

  // Состояния анонсируются скринридеру (role=status/alert), как form-feedback.tsx:
  // контент вкладки меняется асинхронно при активации.
  if (state.status === "loading") {
    return (
      <p role="status" className="text-sm text-(--color-fg-muted)">
        {tL("docTabLoading")}
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="text-sm text-(--color-danger-fg)">
        {tL("docTabError")}
      </p>
    );
  }
  return (
    <article className="content">
      {state.blocks.length === 0 ? (
        <p role="status" className="text-sm text-(--color-fg-muted)">
          {tL("docTabEmpty")}
        </p>
      ) : (
        <AstRender blocks={state.blocks} />
      )}
    </article>
  );
}
```

- [ ] **Step 4: Экспорт из слайса** — добавить в `src/features/lectures/index.ts` (рядом с секцией attachments):

```ts
export { LectureDocumentTabs } from "./ui/lecture-document-tabs";
export type { DocTabMeta } from "./ui/lecture-document-tabs";
```

- [ ] **Step 5: Запустить — зелено**

Run: `pnpm test src/features/lectures/ui/lecture-document-tabs.test.tsx`
Expected: PASS (оба теста; второй подтверждает один запрос + кэш).

- [ ] **Step 6: Коммит**

`src/features/lectures/index.ts` — общий hot-файл; коммитим через `--only`.

```bash
git add src/features/lectures/ui/lecture-document-tabs.tsx src/features/lectures/ui/lecture-document-tabs.test.tsx src/features/lectures/index.ts
git commit --only src/features/lectures/ui/lecture-document-tabs.tsx src/features/lectures/ui/lecture-document-tabs.test.tsx src/features/lectures/index.ts -m "feat(lectures): LectureDocumentTabs — вкладки документов с ленивой загрузкой тела"
```

---

### Task 4: Страница «карточка лекции» + удаление attachments-страницы

**Files:**
- Create: `src/app/admin/lectures/[id]/page.tsx`
- Delete: `src/app/admin/lectures/[id]/attachments/page.tsx` (и пустую папку `attachments/`)

**Interfaces:**
- Consumes: `@/features/lectures` (`getLectureById`, `getLectureDocuments`, `getLectureMedia`, `canManageAttachments`, `canAttachToLecture`, `LectureAttachmentsManager`, `ManagedAttachment`, `searchDocumentsForAttach`, `searchMediaForAttach`, `LectureDocumentTabs`); `@/features/documents` (`getDocumentById`, `DocumentDetail`); `@/features/media` (`getMediaById`, `MediaPlayer`); `AstBlock` из `@/components/ast-render`; `ActionResult` из `@/utils/create-action`; `RouterLink` из `@/components/ui`.
- Inline server action в странице: `loadDocBlocks(docId) => Promise<ActionResult<AstBlock[]>>` — оборачивает `getDocumentById` (cross-feature импорт разрешён на странице, в слайсе запрещён ESLint'ом).

> **Примечание (страницы здесь юнит-тестами не покрываются** — в `src/app/admin/lectures` тестов нет; inline-экшены `docFetcher`/`mediaFetcher` тоже без тестов). Логика вкладок покрыта Task 3. Верификация задачи — `pnpm build` + `pnpm lint`.

- [ ] **Step 1: Создать страницу** — `src/app/admin/lectures/[id]/page.tsx`

```tsx
import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";

import type { AstBlock } from "@/components/ast-render";
import { RouterLink } from "@/components/ui";
import { DocumentDetail, getDocumentById } from "@/features/documents";
import {
  canAttachToLecture,
  canManageAttachments,
  getLectureById,
  getLectureDocuments,
  getLectureMedia,
  LectureAttachmentsManager,
  LectureDocumentTabs,
  searchDocumentsForAttach,
  searchMediaForAttach,
} from "@/features/lectures";
import type { ManagedAttachment } from "@/features/lectures";
import { getMediaById, MediaPlayer } from "@/features/media";
import { getT } from "@/i18n";
import type { ActionResult } from "@/utils/create-action";
import { getMe } from "@/utils/me";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("cardMetaTitle") };
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LectureCardPage({ params }: Props) {
  const { id } = await params;
  const [me, lecture] = await Promise.all([getMe(), getLectureById(id)]);
  if (!lecture) notFound();
  if (!canManageAttachments(me, lecture)) forbidden();

  const [docs, media] = await Promise.all([
    getLectureDocuments(id),
    getLectureMedia(id),
  ]);
  const canAttach = canAttachToLecture(me, lecture);
  const t = await getT("admin");

  // — менеджеры (управление) —
  const docItems: ManagedAttachment[] = docs.map((d, i) => ({
    entityId: d.id ?? "",
    entityType: "document",
    label: d.filename ?? d.id ?? t("attachmentsDocumentFallback"),
    sortOrder: i,
  }));
  const mediaItems: ManagedAttachment[] = media.map((m, i) => ({
    entityId: m.id,
    entityType: "media",
    label: m.filename,
    sortOrder: i,
  }));

  async function docFetcher(q: string, offset: number, limit: number) {
    "use server";
    const r = await searchDocumentsForAttach({ q, offset, limit });
    return r.success ? r.data : { data: [], total: null };
  }
  async function mediaFetcher(q: string, offset: number, limit: number) {
    "use server";
    const r = await searchMediaForAttach({ q, offset, limit });
    return r.success ? r.data : { data: [], total: null };
  }

  // Ленивая подгрузка тела неосновного документа (inline server action: страница
  // вправе импортировать @/features/documents, слайс — нет, см. ESLint-гард).
  async function loadDocBlocks(docId: string): Promise<ActionResult<AstBlock[]>> {
    "use server";
    try {
      const doc = await getDocumentById(docId);
      // doc.blocks (ast.Block[]) ⟷ AstBlock[] — один и тот же тип, каста НЕ нужно
      // (no-unnecessary-type-assertion в strictTypeChecked иначе красит линт).
      return { success: true, data: doc?.blocks ?? [] };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "load failed" };
    }
  }

  // — рендер документов —
  // СТОПГАП: «основной» = первый по sort_order. В контракте бэка нет is_primary
  // (см. spec 2026-06-25-lecture-card-attachments-render-design.md). Снять, когда
  // бэк добавит явный флаг.
  const tabDocs = docs
    .filter((d): d is typeof d & { id: string } => Boolean(d.id))
    .map((d) => ({ id: d.id, label: d.filename ?? d.id }));
  const primaryId = tabDocs[0]?.id ?? null;
  const primaryDoc = primaryId ? await getDocumentById(primaryId) : null;

  // — рендер медиа — плееру нужен url; в списке media он опционален (media.Media.url?),
  // поэтому добираем getMediaById ТОЛЬКО когда url отсутствует (без N+1 в общем случае).
  const mediaWithUrl = await Promise.all(
    media.map(async (m) => (m.url ? m : ((await getMediaById(m.id)) ?? m))),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{lecture.title}</h1>
        <RouterLink
          href={`/admin/lectures/${lecture.id}/edit`}
          className="text-sm underline hover:no-underline"
        >
          {t("cardEditLink")}
        </RouterLink>
      </header>

      {/* Управление вложениями (сверху) */}
      <section className="flex flex-col gap-6">
        <LectureAttachmentsManager
          lectureId={id}
          attachments={docItems}
          canAttach={canAttach}
          pickerEntityType="document"
          targetFetcher={docFetcher}
          title={t("attachmentsDocsSectionTitle")}
        />
        <LectureAttachmentsManager
          lectureId={id}
          attachments={mediaItems}
          canAttach={canAttach}
          pickerEntityType="media"
          targetFetcher={mediaFetcher}
          title={t("attachmentsMediaSectionTitle")}
        />
      </section>

      {/* Рендер документов (ниже) */}
      {primaryDoc && primaryId && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("cardDocumentsHeading")}</h2>
          {tabDocs.length <= 1 ? (
            <DocumentDetail document={primaryDoc} />
          ) : (
            <LectureDocumentTabs
              docs={tabDocs}
              primaryId={primaryId}
              primaryPanel={<DocumentDetail document={primaryDoc} />}
              loadBlocks={loadDocBlocks}
            />
          )}
        </section>
      )}

      {/* Рендер медиа (превью-плееры) */}
      {mediaWithUrl.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("cardMediaHeading")}</h2>
          <ul className="flex flex-col gap-6">
            {mediaWithUrl.map((m) => (
              <li key={m.id}>
                {m.url ? (
                  <MediaPlayer url={m.url} type={m.type} filename={m.filename} mediaId={m.id} />
                ) : (
                  <p className="text-sm text-(--color-fg-muted)">{t("cardMediaUnavailable")}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Удалить attachments-страницу и её мёртвые i18n-ключи**

```bash
git rm "src/app/admin/lectures/[id]/attachments/page.tsx"
rmdir "src/app/admin/lectures/[id]/attachments" 2>/dev/null || true
```

Удалить ключи `attachmentsMetaTitle` и `attachmentsPageTitle` из ВСЕХ четырёх `…/admin.ts` (ru/en/ar/zh). Внимание: они могут лежать НЕ рядом с блоком `attachments*` (в `ru/admin.ts` `attachmentsMetaTitle` — отдельной строкой ниже, ~стр. 154). Удалять оба независимо от позиции; вне удаляемой страницы они нигде не используются. Удаление во всех 4 локалях сразу сохраняет i18n-паритет.

- [ ] **Step 3: Сборка + линт**

Run: `pnpm lint && pnpm build`
Expected: PASS. Линт не ругается на cross-feature (импорты `@/features/*` — со страницы, разрешены). `doc.blocks` (`ast.Block[]`) присваивается в `AstBlock[]` без каста — это тот же тип (как в `DocumentDetail`). Типы ключей выводятся из `ru`-каталога — убедись, что и страница, и ключи удалены согласованно (иначе `t("attachmentsMetaTitle")`/`t("attachmentsPageTitle")` не должны нигде остаться).

- [ ] **Step 4: Smoke в браузере (опц., но желательно)**

Стенд: бэк `:8090` (make run-local), фронт `pnpm dev` `:3001`, dev-админ `dev/admin12345`. Открыть
`http://localhost:3001/admin/lectures/4fc5b1d0-8628-4048-91f9-1544834c6b8d` — должны быть видны менеджеры сверху и отрисованный документ ниже; `…/attachments` → 404.

- [ ] **Step 5: Коммит**

`*/admin.ts` — общие hot-файлы; коммитим через `--only` (удаление страницы уже застейджено `git rm`, добавляем его путь в список).

```bash
git add "src/app/admin/lectures/[id]/page.tsx" src/i18n/messages/ru/admin.ts src/i18n/messages/en/admin.ts src/i18n/messages/ar/admin.ts src/i18n/messages/zh/admin.ts
git commit --only "src/app/admin/lectures/[id]/page.tsx" "src/app/admin/lectures/[id]/attachments/page.tsx" src/i18n/messages/ru/admin.ts src/i18n/messages/en/admin.ts src/i18n/messages/ar/admin.ts src/i18n/messages/zh/admin.ts -m "feat(lectures): карточка /admin/lectures/[id] — управление + рендер вложений; удалить attachments-страницу"
```

---

### Task 5: Перенаправить ссылки на карточку (edit-страница + admin-строка)

**Files:**
- Modify: `src/app/admin/lectures/[id]/edit/page.tsx` (секция attachments → ссылка на карточку)
- Modify: `src/features/lectures/ui/lecture-admin-row.tsx` (заголовок строки → ссылка на карточку)
- Modify: `src/features/lectures/ui/lecture-create-form.tsx` (редирект после создания → карточка, а не удалённый `…/attachments`)

**Interfaces:**
- Consumes: i18n-ключи (Task 2). Использует существующие `editLectureAttachmentsHeading`/`editLectureAttachmentsLink` (admin) и `RouterLink`.

- [ ] **Step 1: edit-страница — вести ссылку на карточку**

В `src/app/admin/lectures/[id]/edit/page.tsx` в секции attachments заменить `href`:

```tsx
          <a
            href={`/admin/lectures/${lecture.id}`}
            className="inline-flex items-center gap-1 text-sm underline hover:no-underline"
          >
            {t("editLectureAttachmentsLink")}
            <ChevronIcon className="rtl-flip" />
          </a>
```
(было `…/${lecture.id}/attachments`).

- [ ] **Step 2: admin-строка — заголовок ведёт на карточку**

В `src/features/lectures/ui/lecture-admin-row.tsx` обернуть заголовок в `RouterLink` на карточку (только если `canEdit`, иначе текст):

```tsx
      <Td className="font-medium">
        {canEdit ? (
          <RouterLink
            href={`/admin/lectures/${lecture.id}`}
            className="hover:underline"
          >
            {lecture.title}
          </RouterLink>
        ) : (
          lecture.title
        )}
      </Td>
```
(`RouterLink` уже импортирован в файле.)

- [ ] **Step 3: форма создания — редирект на карточку (а не на удалённый attachments)**

После создания лекции с выбранными документами форма редиректит на удалённый роут `…/attachments` → 404 (см. ревью, CRITICAL C1). В `src/features/lectures/ui/lecture-create-form.tsx` (~стр. 40-45) заменить ветку редиректа и комментарий:

```tsx
  // При выборе документов ведём на карточку лекции (там и управление вложениями,
  // и рендер), иначе — на редактирование.
  useActionRedirect(state, (data) =>
    docs.length > 0
      ? `/admin/lectures/${data.id}`
      : `/admin/lectures/${data.id}/edit`,
  );
```
(было `…/${data.id}/attachments`). Тесты не ломаются: `lecture-create-form.test.tsx` мокает `useActionRedirect` no-op'ом, а `create-lecture-attach.test.ts`/`actions-happy-path.test.ts` ассертят только API-путь `/api/lectures/.../attachments`, не route.

- [ ] **Step 4: Линт + сборка + тесты**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS. (Если есть снапшот/тест на `lecture-admin-row` — обновить под новую ссылку; на момент плана теста для строки нет.)

- [ ] **Step 5: Коммит**

```bash
git add "src/app/admin/lectures/[id]/edit/page.tsx" src/features/lectures/ui/lecture-admin-row.tsx src/features/lectures/ui/lecture-create-form.tsx
git commit --only "src/app/admin/lectures/[id]/edit/page.tsx" src/features/lectures/ui/lecture-admin-row.tsx src/features/lectures/ui/lecture-create-form.tsx -m "feat(lectures): ссылки на карточку лекции (edit + admin-строка + редирект формы создания)"
```

---

## Финальная проверка готовности

- [ ] `pnpm lint && pnpm test && pnpm build` — всё зелёное.
- [ ] Ручная браузер-приёмка: карточка открывается; управление документами/медиа работает (attach/detach/reorder → список вкладок/превью обновляется); основной документ отрисован сразу; переключение вкладок подгружает тело лениво (по одному) и кэширует; медиа-плееры на месте; `…/attachments` → 404; ссылки из edit-страницы и admin-строки ведут на карточку.

## Открытые вопросы / флаги бэку (после реализации)

- **`is_primary` для документа лекции** — выдать бэку требование (см. spec §«Бэкенд-флаг»). До этого активна первая вкладка по `sort_order` (стопгап в коде).
- **`url` в списке `GET /api/lectures/{id}/media`** — код уже добирает `getMediaById` ЛИШЬ когда `url` в списке пуст (без N+1 в общем случае). Проверить на лекции С медиа: если список всегда несёт `url`, fallback-ветку `getMediaById` можно удалить совсем (чистый `m.url`); если не несёт — текущий код корректен.
- **ar/zh вычитка** новых строк носителем (известный сквозной долг проекта).
