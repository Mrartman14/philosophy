# Аннотации документов на публичной странице лекции — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** На публичной `/lectures/[id]` рендерить документы лекции инлайн (URL-driven выбор `?doc=`, ленивость) в общем `.page-grid`-лейауте и подключить аннотации активного документа в правом поле — переиспользуя `DocumentAnnotations` как на `/documents/[id]`.

**Architecture:** Страница (app) — единственное место кросс-фичевой композиции (ESLint запрещает `@/features/*` внутри слайса): она резолвит активный документ (`resolveActiveDocId`), фетчит его тело (`getDocumentById`) в хребет в `<div data-ast-root>`, и монтирует `DocumentAnnotations` в `MarginNote` (правое поле). Слайс `lectures` даёт чистый хелпер выбора + презентационный селектор-ссылки. Активен ровно один документ → ровно один `data-ast-root` → инвариант движка маргиналий соблюдён.

**Tech Stack:** Next.js App Router (RSC, searchParams-driven), маргиналии-грид (`.page-grid`/`MarginNote`), движок аннотаций (`@/components/annotation-layer` + `DocumentAnnotations`), next-intl, Vitest + Testing Library.

## Global Constraints

- pnpm-тулчейн (НЕ npm). Гейт: `pnpm lint && pnpm test && pnpm build` зелёные.
- Имена файлов в `src/` — kebab-case. Общение/комментарии — на русском.
- Параллельные агенты: НЕ `git stash/reset/checkout .`/`clean`; НЕ `git add -A`/`.` — добавлять только свои файлы по имени; общие hot-файлы (`src/features/lectures/index.ts`, `src/i18n/messages/*/*.ts`, страница) — `git commit --only <свои файлы>`.
- ESLint cross-feature: внутри `src/features/*/**` ЗАПРЕЩЁН импорт `@/features/*`. Поэтому фетч тела документа + `DocumentDetail` + `DocumentAnnotations` — ТОЛЬКО на странице `src/app/**` (там разрешено), не в слайсе.
- Аннотации привязаны к ДОКУМЕНТУ (`getAnnotationsFor("document", id)`) — общие с `/documents/[id]`. `DocumentAnnotations` переиспользуется БЕЗ изменений.
- Дефолт активного документа — СТОПГАП «первый по sort_order»; станет мейн-документом, когда бэк добавит `is_primary` (одна строка в `resolveActiveDocId`).
- Коммит-сообщения заканчивать строкой: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Спека: [docs/superpowers/specs/2026-06-25-lecture-public-document-annotations-design.md](../specs/2026-06-25-lecture-public-document-annotations-design.md).

---

### Task 1: `getLectureDocuments` — проброс share-token

**Files:**
- Modify: `src/features/lectures/api.ts` (функция `getLectureDocuments`)

**Interfaces:**
- Produces: `getLectureDocuments(id: string, token?: string): Promise<LectureDocument[]>` — при `token` добавляет `query: { token }` (эндпойнт `/api/lectures/{id}/documents` его поддерживает в схеме). Сигнатура `getLectureMedia` НЕ меняется.

> Эти cache()-обёрнутые api-функции в проекте юнит-тестами не покрываются (нет `lectures/api.test.ts`); проброс query типобезопасен (схема объявляет `query.token`). Верификация — `pnpm lint && pnpm build` (typecheck) + потребитель (Task 5).

- [ ] **Step 1: Реализация** — в `src/features/lectures/api.ts` заменить тело `getLectureDocuments`:

```ts
/** GET /api/lectures/{id}/documents — документы лекции (по sort_order). 404 → [].
 *  token (?token=) пробрасывается для приватных лекций через share-link. */
export const getLectureDocuments = cache(
  async (id: string, token?: string): Promise<LectureDocument[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/lectures/{id}/documents", {
      params: { path: { id }, ...(token ? { query: { token } } : {}) },
    });
    if (response.status === 404) return [];
    if (error) throw new Error(error.error ?? (await getT("lectures"))("api.loadDocumentsFailed"));
    return unwrap(data) ?? [];
  },
);
```

- [ ] **Step 2: Линт + сборка**

Run: `pnpm lint && pnpm build`
Expected: PASS (тип `query.token` совпадает со схемой; каста не требуется).

- [ ] **Step 3: Коммит**

```bash
git add src/features/lectures/api.ts
git commit -m "feat(lectures): проброс share-token в getLectureDocuments"
```

---

### Task 2: чистый хелпер `resolveActiveDocId`

**Files:**
- Create: `src/features/lectures/active-document.ts`
- Create: `src/features/lectures/active-document.test.ts`
- Modify: `src/features/lectures/index.ts` (экспорт)

**Interfaces:**
- Produces: `resolveActiveDocId(documents: { id?: string }[], docParam: string | undefined): string | null` — возвращает `docParam`, если он среди id документов; иначе первый документ с id (СТОПГАП sort_order); иначе `null` (нет документов).

- [ ] **Step 1: Failing-тест** — `src/features/lectures/active-document.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { resolveActiveDocId } from "./active-document";

const DOCS = [{ id: "d1" }, { id: "d2" }, {}]; // третий без id — отсеивается

describe("resolveActiveDocId", () => {
  it("валидный ?doc выбирается", () => {
    expect(resolveActiveDocId(DOCS, "d2")).toBe("d2");
  });
  it("невалидный ?doc → первый по порядку (стопгап)", () => {
    expect(resolveActiveDocId(DOCS, "nope")).toBe("d1");
  });
  it("без ?doc → первый по порядку", () => {
    expect(resolveActiveDocId(DOCS, undefined)).toBe("d1");
  });
  it("нет документов → null", () => {
    expect(resolveActiveDocId([], "d1")).toBeNull();
  });
  it("документы без id отсеиваются", () => {
    expect(resolveActiveDocId([{}, { id: "d9" }], undefined)).toBe("d9");
  });
});
```

- [ ] **Step 2: Запустить — упадёт (нет модуля)**

Run: `pnpm test src/features/lectures/active-document.test.ts`
Expected: FAIL — `Cannot find module './active-document'`.

- [ ] **Step 3: Реализация** — `src/features/lectures/active-document.ts`

```ts
// src/features/lectures/active-document.ts

/**
 * Активный документ лекции для URL-driven просмотра (?doc=). Возвращает docParam,
 * если он среди id документов; иначе первый документ с id; иначе null.
 *
 * СТОПГАП: дефолт = первый по sort_order. Когда бэк добавит признак основного
 * документа (is_primary / primary_document_id), заменить дефолт на него.
 */
export function resolveActiveDocId(
  documents: { id?: string }[],
  docParam: string | undefined,
): string | null {
  const ids = documents
    .map((d) => d.id)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return null;
  if (docParam && ids.includes(docParam)) return docParam;
  return ids[0];
}
```

- [ ] **Step 4: Экспорт** — добавить в `src/features/lectures/index.ts` (рядом с `getLectureDocuments`):

```ts
export { resolveActiveDocId } from "./active-document";
```

- [ ] **Step 5: Запустить — зелено**

Run: `pnpm test src/features/lectures/active-document.test.ts`
Expected: PASS (5 кейсов).

- [ ] **Step 6: Коммит** (`index.ts` — hot-файл → `--only`)

```bash
git add src/features/lectures/active-document.ts src/features/lectures/active-document.test.ts src/features/lectures/index.ts
git commit --only src/features/lectures/active-document.ts src/features/lectures/active-document.test.ts src/features/lectures/index.ts -m "feat(lectures): resolveActiveDocId — выбор активного документа лекции по ?doc"
```

---

### Task 3: i18n-ключи селектора/фолбэка (namespace `pages`)

**Files:**
- Modify: `src/i18n/messages/ru/pages.ts`, `src/i18n/messages/en/pages.ts`, `src/i18n/messages/ar/pages.ts`, `src/i18n/messages/zh/pages.ts`

**Interfaces:**
- Produces (namespace `pages`): `lectureDocumentsNavLabel` (aria-label строки-селектора), `lectureDocumentUnavailable` (фолбэк, когда тело активного документа недоступно).

> Только добавление (паритет ru↔en↔ar↔zh). Мёртвые ключи старой секции удаляются в Task 5 (вместе с компонентом, который их ещё использует), не здесь.

- [ ] **Step 1: Добавить ключи** — в каждый `…/pages.ts` рядом с `lectureDefaultTitle`:

`ru/pages.ts`:
```ts
  lectureDocumentsNavLabel: "Документы лекции",
  lectureDocumentUnavailable: "Документ недоступен.",
```
`en/pages.ts`:
```ts
  lectureDocumentsNavLabel: "Lecture documents",
  lectureDocumentUnavailable: "Document is unavailable.",
```
`ar/pages.ts`:
```ts
  lectureDocumentsNavLabel: "مستندات المحاضرة",
  lectureDocumentUnavailable: "المستند غير متاح.",
```
`zh/pages.ts`:
```ts
  lectureDocumentsNavLabel: "讲座文档",
  lectureDocumentUnavailable: "文档不可用。",
```

- [ ] **Step 2: Паритет + типы**

Run: `pnpm test src/i18n`
Expected: PASS (одинаковый набор ключей во всех 4 локалях).

- [ ] **Step 3: Коммит** (i18n-каталоги — hot → `--only`)

```bash
git add src/i18n/messages/ru/pages.ts src/i18n/messages/en/pages.ts src/i18n/messages/ar/pages.ts src/i18n/messages/zh/pages.ts
git commit --only src/i18n/messages/ru/pages.ts src/i18n/messages/en/pages.ts src/i18n/messages/ar/pages.ts src/i18n/messages/zh/pages.ts -m "i18n(pages): ключи селектора документов лекции (ru/en/ar/zh)"
```

---

### Task 4: презентационный `LectureDocumentSelector`

**Files:**
- Create: `src/features/lectures/ui/lecture-document-selector.tsx`
- Create: `src/features/lectures/ui/lecture-document-selector.test.tsx`
- Modify: `src/features/lectures/index.ts` (экспорт)

**Interfaces:**
- Consumes: `RouterLink` из `@/components/ui`; `LectureDocument` из `../types`.
- Produces: `LectureDocumentSelector({ documents, activeId, token?, navLabel })` — строка ссылок `?doc=<id>` (с токеном, если задан); активная несёт `aria-current="page"` + акцентный стиль; ≤1 документа → `null`. `navLabel` (string) локализует вызывающий — компонент презентационный (без `getT`).

- [ ] **Step 1: Failing-тест** — `src/features/lectures/ui/lecture-document-selector.test.tsx`

```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LectureDocumentSelector } from "./lecture-document-selector";

afterEach(cleanup);

describe("LectureDocumentSelector", () => {
  it("ссылки на документы; активная — aria-current + токен в href", () => {
    render(
      <LectureDocumentSelector
        documents={[
          { id: "d1", filename: "Первый" },
          { id: "d2", filename: "Второй" },
        ]}
        activeId="d1"
        token="TOK"
        navLabel="Документы лекции"
      />,
    );
    expect(screen.getByRole("navigation", { name: "Документы лекции" })).toBeInTheDocument();
    const first = screen.getByRole("link", { name: "Первый" });
    const second = screen.getByRole("link", { name: "Второй" });
    expect(first).toHaveAttribute("aria-current", "page");
    expect(second).not.toHaveAttribute("aria-current");
    expect(first.getAttribute("href")).toContain("doc=d1");
    expect(first.getAttribute("href")).toContain("token=TOK");
    expect(second.getAttribute("href")).toContain("doc=d2");
  });

  it("один документ → null (селектор не нужен)", () => {
    const { container } = render(
      <LectureDocumentSelector
        documents={[{ id: "d1", filename: "Один" }]}
        activeId="d1"
        navLabel="Документы лекции"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Запустить — упадёт (нет модуля)**

Run: `pnpm test src/features/lectures/ui/lecture-document-selector.test.tsx`
Expected: FAIL — `Cannot find module './lecture-document-selector'`.

- [ ] **Step 3: Реализация** — `src/features/lectures/ui/lecture-document-selector.tsx`

```tsx
// src/features/lectures/ui/lecture-document-selector.tsx
import { RouterLink } from "@/components/ui";

import type { LectureDocument } from "../types";

interface Props {
  /** Документы лекции (нужны только id + filename). */
  documents: Pick<LectureDocument, "id" | "filename">[];
  /** id активного документа (резолвится вызывающим). */
  activeId: string;
  /** Share-token — сохраняем в ссылках переключения, если задан. */
  token?: string;
  /** aria-label навигации (локализован вызывающим). */
  navLabel: string;
}

const BASE =
  "-mb-px max-w-[14rem] truncate rounded-t border-b-2 px-3 py-1.5 text-sm transition-colors";
const ACTIVE =
  "border-(--color-accent) bg-(--color-surface-subtle) font-semibold text-(--color-fg)";
const INACTIVE =
  "border-transparent text-(--color-fg-muted) hover:text-(--color-fg)";

/**
 * Строка-селектор документов лекции для URL-driven просмотра. Каждый документ —
 * ссылка `?doc=<id>` (навигация, не ARIA-tablist: у каждого свой URL). Активная
 * подсвечена и несёт aria-current. ≤1 документа → не рендерится.
 */
export function LectureDocumentSelector({ documents, activeId, token, navLabel }: Props) {
  const docs = documents.filter(
    (d): d is Pick<LectureDocument, "filename"> & { id: string } => Boolean(d.id),
  );
  if (docs.length <= 1) return null;
  return (
    <nav
      aria-label={navLabel}
      className="flex flex-wrap gap-1 border-b border-(--color-border)"
    >
      {docs.map((d) => {
        const active = d.id === activeId;
        const href = token
          ? `?doc=${encodeURIComponent(d.id)}&token=${encodeURIComponent(token)}`
          : `?doc=${encodeURIComponent(d.id)}`;
        return (
          <RouterLink
            key={d.id}
            href={href}
            title={d.filename ?? d.id}
            aria-current={active ? "page" : undefined}
            className={`${BASE} ${active ? ACTIVE : INACTIVE}`}
          >
            {d.filename ?? d.id}
          </RouterLink>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Экспорт** — добавить в `src/features/lectures/index.ts` (рядом с `LectureMediaSection`):

```ts
export { LectureDocumentSelector } from "./ui/lecture-document-selector";
```

- [ ] **Step 5: Запустить — зелено**

Run: `pnpm test src/features/lectures/ui/lecture-document-selector.test.tsx`
Expected: PASS (2 кейса).

- [ ] **Step 6: Коммит** (`index.ts` — hot → `--only`)

```bash
git add src/features/lectures/ui/lecture-document-selector.tsx src/features/lectures/ui/lecture-document-selector.test.tsx src/features/lectures/index.ts
git commit --only src/features/lectures/ui/lecture-document-selector.tsx src/features/lectures/ui/lecture-document-selector.test.tsx src/features/lectures/index.ts -m "feat(lectures): LectureDocumentSelector — строка-ссылки документов лекции"
```

---

### Task 5: страница лекции — общий грид + инлайн-документ + аннотации

**Files:**
- Modify: `src/app/lectures/[id]/page.tsx` (грид-рестрактур + документ-секция + аннотации в поле + token)
- Delete: `src/features/lectures/ui/lecture-documents-section.tsx`
- Modify: `src/features/lectures/index.ts` (убрать экспорт `LectureDocumentsSection`)
- Modify: `src/i18n/messages/{ru,en,ar,zh}/lectures.ts` (удалить мёртвые `documentsSectionLabel`, `documentsSectionHeading`)

**Interfaces:**
- Consumes: `resolveActiveDocId`, `LectureDocumentSelector`, `getLectureDocuments`, `getLectureById`, `LectureDetail`, `LectureExportLinks`, `LectureMediaSection`, `lectureCoverUrl` из `@/features/lectures`; `getDocumentById`, `DocumentDetail` из `@/features/documents`; `DocumentAnnotations` из `@/features/annotations`; `MarginNote`, `Skeleton` из `@/components/ui`; i18n `pages` (`lectureDocumentsNavLabel`, `lectureDocumentUnavailable`).

> Страница юнит-тестами не покрывается (норма проекта; `LectureDocumentsSection` теста не имеет). Верификация — `pnpm lint && pnpm test && pnpm build` + ручной приём.

- [ ] **Step 1: Переписать страницу** — `src/app/lectures/[id]/page.tsx`:

```tsx
// src/app/lectures/[id]/page.tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SaveOfflineButton } from "@/app/_offline/save-offline-button";
import { MarginNote, Skeleton } from "@/components/ui";
import { DocumentAnnotations } from "@/features/annotations";
import { CommentSection } from "@/features/comments";
import { DocumentDetail, getDocumentById } from "@/features/documents";
import {
  getLectureById,
  getLectureDocuments,
  lectureCoverUrl,
  LectureDetail,
  LectureDocumentSelector,
  LectureExportLinks,
  LectureMediaSection,
  resolveActiveDocId,
} from "@/features/lectures";
import {
  getLectureSubscription,
  LectureSubscribeButton,
} from "@/features/notifications";
import {
  ShareButton,
  canCreateShareLink,
  getShareLinksFor,
} from "@/features/share-links";
import { getLectureTags } from "@/features/tags";
import { getLocale, getT } from "@/i18n";
import { buildPageMetadata, ogLocale } from "@/seo/page-metadata";
import { getMe } from "@/utils/me";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cq?: string; token?: string; doc?: string }>;
}

export default async function LecturePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { cq, token, doc } = await searchParams;
  const [me, lecture, tags, documents] = await Promise.all([
    getMe(),
    getLectureById(id, token),
    getLectureTags(id),
    getLectureDocuments(id, token),
  ]);
  if (!lecture) notFound();

  // URL-driven активный документ (?doc=); тело — только активного (ленивость).
  const activeId = resolveActiveDocId(documents, doc);
  const activeDoc = activeId ? await getDocumentById(activeId, token) : null;

  const canShare = canCreateShareLink(me, lecture);
  const [subscribed, shareLinks, t] = await Promise.all([
    me && lecture.id ? getLectureSubscription(lecture.id) : Promise.resolve(false),
    canShare ? getShareLinksFor("lecture", lecture.id) : Promise.resolve([]),
    getT("pages"),
  ]);

  return (
    <>
      <div className="flex flex-col gap-8 p-4">
        <LectureDetail lecture={lecture} tags={tags} />
        <LectureExportLinks id={id} />

        {/* Документы лекции — инлайн-рендер активного документа (URL-driven ?doc=).
            В DOM ровно один data-ast-root → инвариант движка аннотаций. */}
        {activeId && (
          <section className="flex flex-col gap-3">
            <LectureDocumentSelector
              documents={documents}
              activeId={activeId}
              token={token}
              navLabel={t("lectureDocumentsNavLabel")}
            />
            <div data-ast-root>
              {activeDoc ? (
                <DocumentDetail document={activeDoc} />
              ) : (
                <p className="text-sm text-(--color-fg-muted)">
                  {t("lectureDocumentUnavailable")}
                </p>
              )}
            </div>
          </section>
        )}

        <Suspense fallback={null}>
          <LectureMediaSection lectureId={id} />
        </Suspense>
        <div className="flex justify-end">
          <SaveOfflineButton entity="lectures" id={id} />
        </div>
        {me && lecture.id && (
          <div className="flex justify-end">
            <LectureSubscribeButton lectureId={lecture.id} initialSubscribed={subscribed} />
          </div>
        )}
        {canShare && (
          <div className="flex justify-end">
            <ShareButton
              resourceType="lecture"
              resourceId={lecture.id}
              canCreate={canShare}
              initialLinks={shareLinks}
            />
          </div>
        )}
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <CommentSection lectureId={id} query={cq} />
        </Suspense>
      </div>

      {/* Аннотации активного документа — правое поле грида (как /documents/[id]).
          Привязка к документу → те же, что на /documents/[id]. */}
      {activeDoc && activeId && (
        <MarginNote side="end" grow className="p-4 xl:ps-0">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <DocumentAnnotations parentId={activeId} />
          </Suspense>
        </MarginNote>
      )}
    </>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const [lecture, t, tMeta, locale] = await Promise.all([
    getLectureById(id),
    getT("pages"),
    getT("metadata"),
    getLocale(),
  ]);
  return buildPageMetadata({
    title: lecture?.title ?? t("lectureDefaultTitle"),
    siteName: tMeta("appTitle"),
    description: lecture?.description,
    image: lectureCoverUrl(lecture?.cover_image_key),
    imageAlt: lecture?.cover_image_alt,
    locale: ogLocale(locale),
    publishedTime: lecture?.created_at,
    path: `/lectures/${id}`,
  });
}
```

(Изменения против прежней версии: убрана обёртка `mx-auto max-w-3xl` → фрагмент с хребет-контентом + `MarginNote`; убран импорт/использование `LectureDocumentsSection`; добавлены `getLectureDocuments(id, token)`, `resolveActiveDocId`, `getDocumentById`, `DocumentDetail`, `LectureDocumentSelector`, `DocumentAnnotations`, `MarginNote`; `searchParams` получил `doc`.)

- [ ] **Step 2: Удалить старую секцию-ссылки**

```bash
git rm src/features/lectures/ui/lecture-documents-section.tsx
```
И убрать её экспорт из `src/features/lectures/index.ts` (строку `export { LectureDocumentsSection } from "./ui/lecture-documents-section";`).

- [ ] **Step 3: Удалить мёртвые i18n-ключи** — из ВСЕХ четырёх `…/lectures.ts` удалить `documentsSectionLabel` и `documentsSectionHeading` (использовались только удалённой секцией; вне неё в `src/` не встречаются).

- [ ] **Step 4: Гейт**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS. Линт: страница в `src/app/**` вправе импортировать `@/features/{documents,annotations,lectures}`. i18n-паритет цел (удалили 2 ключа во всех 4 локалях). Сборка: маршрут `/lectures/[id]` собирается.

- [ ] **Step 5: Ручной приём (желательно)**

Стенд: бэк `:8090` (make run-local), фронт `pnpm dev` `:3001`. Открыть лекцию с ≥2 документами `http://localhost:3001/lectures/<id>`:
- видна строка-селектор + активный документ инлайн;
- клик по другому документу → `?doc=<id>`, грузится только он;
- выделение текста в документе → создание аннотации (если залогинен с правами);
- аннотации совпадают с `/documents/<id>`;
- общий грид-лейаут, аннотации в правом поле.

- [ ] **Step 6: Коммит** (страница + `index.ts` + i18n — hot → `--only`; удаление секции уже застейджено `git rm`)

```bash
git add "src/app/lectures/[id]/page.tsx" src/features/lectures/index.ts src/i18n/messages/ru/lectures.ts src/i18n/messages/en/lectures.ts src/i18n/messages/ar/lectures.ts src/i18n/messages/zh/lectures.ts
git commit --only "src/app/lectures/[id]/page.tsx" "src/features/lectures/ui/lecture-documents-section.tsx" src/features/lectures/index.ts src/i18n/messages/ru/lectures.ts src/i18n/messages/en/lectures.ts src/i18n/messages/ar/lectures.ts src/i18n/messages/zh/lectures.ts -m "feat(lectures): инлайн-рендер документов лекции + аннотации на публичной странице (общий грид, URL-driven ?doc)"
```

---

## Финальная проверка готовности

- [ ] `pnpm lint && pnpm test && pnpm build` — всё зелёное.
- [ ] Ручной браузер-приём (Task 5 Step 5): селектор + инлайн-документ + ленивое переключение `?doc` + создание/просмотр аннотаций в правом поле; общий грид-лейаут; приватные документы не видны анониму.

## Открытые вопросы / флаги бэку

- **Видимость документов лекции (КРИТИЧНО):** подтвердить, что `GET /api/lectures/{id}/documents` и `GET /api/documents/{id}` гейтят по видимости для зрителя (аноним/не-владелец) — приватные документы НЕ должны утечь на публичную страницу. FE прячет `getDocumentById → null`, но источник истины — бэк.
- **Мейн-документ (`is_primary`)** — когда бэк добавит, заменить дефолт в `resolveActiveDocId` (первый по sort_order → мейн-док). Тот же аск, что у admin-карточки.
- **Токен и аннотации:** `DocumentAnnotations` не получает share-token (как и на `/documents/[id]`) — для приватной-через-токен лекции аннотации могут не грузиться; поведение совпадает со страницей документа. При необходимости — отдельная итерация.
- **ar/zh вычитка** новых строк носителем (сквозной долг).
