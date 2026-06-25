# Унификация страницы лекции (документы+аннотации+медиа, edit-affordance) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать `/lectures/[id]` единственной страницей лекции: общий `.page-grid`-лейаут, инлайн-документы (URL-driven `?doc=`, ленивость) с аннотациями активного документа в правом поле, медиа-плееры, ссылка «Редактировать» по capability; удалить admin-карточку `/admin/lectures/[id]` и перенаправить ссылки на неё.

**Architecture:** Страница (app) — единственное место кросс-фичевой композиции (ESLint запрещает `@/features/*` внутри слайса): резолвит активный документ (`resolveActiveDocId`), фетчит его тело (`getDocumentById`) в хребет в `<div data-ast-root>`, монтирует `DocumentAnnotations` в `MarginNote`, рендерит медиа `MediaPlayer`. Слайс `lectures` даёт чистый хелпер выбора + презентационный селектор. Активен ровно один документ → ровно один `data-ast-root` → инвариант движка маргиналий соблюдён.

**Tech Stack:** Next.js App Router (RSC, searchParams-driven), маргиналии-грид (`MarginNote`), движок аннотаций (`DocumentAnnotations`), `MediaPlayer`, next-intl, Vitest + Testing Library.

## Global Constraints

- pnpm-тулчейн (НЕ npm). Гейт: `pnpm lint && pnpm test && pnpm build` зелёные.
- Имена файлов — kebab-case. Комментарии — на русском.
- Параллельные агенты: НЕ `git stash/reset/checkout .`/`clean`; НЕ `git add -A`/`.` — только свои файлы по имени; hot-файлы (`src/features/lectures/index.ts`, `src/i18n/messages/*/*.ts`, страницы) — `git commit --only <свои файлы>`.
- ESLint cross-feature: внутри `src/features/*/**` импорт `@/features/*` ЗАПРЕЩЁН → фетч тела документа/медиа + `DocumentDetail`/`DocumentAnnotations`/`MediaPlayer` ТОЛЬКО на странице (`src/app/**`).
- Аннотации привязаны к ДОКУМЕНТУ → общие с `/documents/[id]`. `DocumentAnnotations`/`MediaPlayer` переиспользуются БЕЗ изменений.
- Дефолт активного документа — СТОПГАП «первый по sort_order»; → мейн-документ, когда бэк добавит `is_primary`.
- Коммит-сообщения заканчивать: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Спека: [docs/superpowers/specs/2026-06-25-lecture-public-document-annotations-design.md](../specs/2026-06-25-lecture-public-document-annotations-design.md).

---

### Task 1: проброс share-token в `getLectureDocuments` и `getLectureMedia`

**Files:**
- Modify: `src/features/lectures/api.ts`

**Interfaces:**
- Produces: `getLectureDocuments(id, token?)`, `getLectureMedia(id, token?)` — при `token` добавляют `query: { token }` (оба эндпойнта поддерживают `token` в схеме).

> cache()-обёрнутые api-функции в проекте юнит-тестами не покрыты; проброс query типобезопасен. Верификация — `pnpm lint && pnpm build` + потребитель (Task 5).

- [ ] **Step 1: Реализация** — в `src/features/lectures/api.ts` заменить тела:

```ts
/** GET /api/lectures/{id}/documents — документы лекции (по sort_order). 404 → [].
 *  token (?token=) для приватных лекций через share-link. */
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

/** GET /api/lectures/{id}/media — медиа лекции (по sort_order). 404 → [].
 *  token (?token=) для приватных лекций через share-link. */
export const getLectureMedia = cache(
  async (id: string, token?: string): Promise<LectureMediaItem[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/lectures/{id}/media", {
      params: { path: { id }, ...(token ? { query: { token } } : {}) },
    });
    if (response.status === 404) return [];
    if (error) throw new Error(error.error ?? (await getT("lectures"))("api.loadMediaFailed"));
    return unwrap(data) ?? [];
  },
);
```

- [ ] **Step 2: Линт + сборка**

Run: `pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 3: Коммит**

```bash
git add src/features/lectures/api.ts
git commit -m "feat(lectures): проброс share-token в getLectureDocuments/getLectureMedia"
```

---

### Task 2: чистый хелпер `resolveActiveDocId`

**Files:**
- Create: `src/features/lectures/active-document.ts`
- Create: `src/features/lectures/active-document.test.ts`
- Modify: `src/features/lectures/index.ts` (экспорт)

**Interfaces:**
- Produces: `resolveActiveDocId(documents: { id?: string }[], docParam: string | undefined): string | null`.

- [ ] **Step 1: Failing-тест** — `src/features/lectures/active-document.test.ts`

```ts
import { describe, expect, it } from "vitest";

import { resolveActiveDocId } from "./active-document";

const DOCS = [{ id: "d1" }, { id: "d2" }, {}];

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

- [ ] **Step 2: Запустить — упадёт**

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
  const ids = documents.map((d) => d.id).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return null;
  if (docParam && ids.includes(docParam)) return docParam;
  return ids[0];
}
```

- [ ] **Step 4: Экспорт** — в `src/features/lectures/index.ts` (рядом с `getLectureDocuments`):

```ts
export { resolveActiveDocId } from "./active-document";
```

- [ ] **Step 5: Запустить — зелено**

Run: `pnpm test src/features/lectures/active-document.test.ts`
Expected: PASS (5 кейсов).

- [ ] **Step 6: Коммит** (`index.ts` — hot → `--only`)

```bash
git add src/features/lectures/active-document.ts src/features/lectures/active-document.test.ts src/features/lectures/index.ts
git commit --only src/features/lectures/active-document.ts src/features/lectures/active-document.test.ts src/features/lectures/index.ts -m "feat(lectures): resolveActiveDocId — выбор активного документа по ?doc"
```

---

### Task 3: i18n-ключи страницы (namespace `pages`)

**Files:**
- Modify: `src/i18n/messages/{ru,en,ar,zh}/pages.ts`

**Interfaces:**
- Produces (namespace `pages`): `lectureEditLink`, `lectureDocumentsNavLabel`, `lectureDocumentUnavailable`, `lectureMediaHeading`, `lectureMediaUnavailable`.

> Только добавление (паритет). Мёртвые ключи удаляются в Task 5/6 (вместе с компонентами/карточкой).

- [ ] **Step 1: Добавить ключи** — в каждый `…/pages.ts` рядом с `lectureDefaultTitle`:

`ru/pages.ts`:
```ts
  lectureEditLink: "Редактировать лекцию",
  lectureDocumentsNavLabel: "Документы лекции",
  lectureDocumentUnavailable: "Документ недоступен.",
  lectureMediaHeading: "Медиа лекции",
  lectureMediaUnavailable: "Медиафайл недоступен.",
```
`en/pages.ts`:
```ts
  lectureEditLink: "Edit lecture",
  lectureDocumentsNavLabel: "Lecture documents",
  lectureDocumentUnavailable: "Document is unavailable.",
  lectureMediaHeading: "Lecture media",
  lectureMediaUnavailable: "Media file is unavailable.",
```
`ar/pages.ts`:
```ts
  lectureEditLink: "تعديل المحاضرة",
  lectureDocumentsNavLabel: "مستندات المحاضرة",
  lectureDocumentUnavailable: "المستند غير متاح.",
  lectureMediaHeading: "وسائط المحاضرة",
  lectureMediaUnavailable: "ملف الوسائط غير متاح.",
```
`zh/pages.ts`:
```ts
  lectureEditLink: "编辑讲座",
  lectureDocumentsNavLabel: "讲座文档",
  lectureDocumentUnavailable: "文档不可用。",
  lectureMediaHeading: "讲座媒体",
  lectureMediaUnavailable: "媒体文件不可用。",
```

- [ ] **Step 2: Паритет**

Run: `pnpm test src/i18n`
Expected: PASS.

- [ ] **Step 3: Коммит** (i18n hot → `--only`)

```bash
git add src/i18n/messages/ru/pages.ts src/i18n/messages/en/pages.ts src/i18n/messages/ar/pages.ts src/i18n/messages/zh/pages.ts
git commit --only src/i18n/messages/ru/pages.ts src/i18n/messages/en/pages.ts src/i18n/messages/ar/pages.ts src/i18n/messages/zh/pages.ts -m "i18n(pages): ключи единой страницы лекции (edit/документы/медиа, ru/en/ar/zh)"
```

---

### Task 4: презентационный `LectureDocumentSelector`

**Files:**
- Create: `src/features/lectures/ui/lecture-document-selector.tsx`
- Create: `src/features/lectures/ui/lecture-document-selector.test.tsx`
- Modify: `src/features/lectures/index.ts` (экспорт)

**Interfaces:**
- Consumes: `RouterLink` из `@/components/ui`; `LectureDocument` из `../types`.
- Produces: `LectureDocumentSelector({ documents, activeId, token?, navLabel })` — ссылки `?doc=<id>` (+token); активная `aria-current="page"` + акцентный стиль; ≤1 документа → `null`.

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

  it("один документ → null", () => {
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

- [ ] **Step 2: Запустить — упадёт**

Run: `pnpm test src/features/lectures/ui/lecture-document-selector.test.tsx`
Expected: FAIL — `Cannot find module './lecture-document-selector'`.

- [ ] **Step 3: Реализация** — `src/features/lectures/ui/lecture-document-selector.tsx`

```tsx
// src/features/lectures/ui/lecture-document-selector.tsx
import { RouterLink } from "@/components/ui";

import type { LectureDocument } from "../types";

interface Props {
  documents: Pick<LectureDocument, "id" | "filename">[];
  activeId: string;
  token?: string;
  navLabel: string;
}

const BASE =
  "-mb-px max-w-[14rem] truncate rounded-t border-b-2 px-3 py-1.5 text-sm transition-colors";
const ACTIVE =
  "border-(--color-accent) bg-(--color-surface-subtle) font-semibold text-(--color-fg)";
const INACTIVE =
  "border-transparent text-(--color-fg-muted) hover:text-(--color-fg)";

/**
 * Строка-селектор документов лекции (URL-driven просмотр). Каждый документ —
 * ссылка `?doc=<id>` (навигация, не ARIA-tablist). Активная подсвечена + несёт
 * aria-current. ≤1 документа → не рендерится.
 */
export function LectureDocumentSelector({ documents, activeId, token, navLabel }: Props) {
  const docs = documents.filter(
    (d): d is Pick<LectureDocument, "filename"> & { id: string } => Boolean(d.id),
  );
  if (docs.length <= 1) return null;
  return (
    <nav aria-label={navLabel} className="flex flex-wrap gap-1 border-b border-(--color-border)">
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

- [ ] **Step 4: Экспорт** — в `src/features/lectures/index.ts` (рядом с `LectureMediaSection`):

```ts
export { LectureDocumentSelector } from "./ui/lecture-document-selector";
```

- [ ] **Step 5: Запустить — зелено**

Run: `pnpm test src/features/lectures/ui/lecture-document-selector.test.tsx`
Expected: PASS (2 кейса).

- [ ] **Step 6: Коммит** (`index.ts` hot → `--only`)

```bash
git add src/features/lectures/ui/lecture-document-selector.tsx src/features/lectures/ui/lecture-document-selector.test.tsx src/features/lectures/index.ts
git commit --only src/features/lectures/ui/lecture-document-selector.tsx src/features/lectures/ui/lecture-document-selector.test.tsx src/features/lectures/index.ts -m "feat(lectures): LectureDocumentSelector — строка-ссылки документов лекции"
```

---

### Task 5: единая страница лекции (грид + edit-link + документы+аннотации + медиа-плееры)

**Files:**
- Modify: `src/app/lectures/[id]/page.tsx`
- Delete: `src/features/lectures/ui/lecture-documents-section.tsx`, `src/features/lectures/ui/lecture-media-section.tsx`
- Modify: `src/features/lectures/index.ts` (убрать экспорты `LectureDocumentsSection`, `LectureMediaSection`)
- Modify: `src/i18n/messages/{ru,en,ar,zh}/lectures.ts` (удалить мёртвые `documentsSectionLabel`, `documentsSectionHeading`, `mediaSectionLabel`, `mediaSectionHeading`)

**Interfaces:**
- Consumes: `resolveActiveDocId`, `LectureDocumentSelector`, `canUpdateLecture`, `getLectureById`, `getLectureDocuments`, `getLectureMedia`, `LectureDetail`, `LectureExportLinks`, `lectureCoverUrl` из `@/features/lectures`; `getDocumentById`, `DocumentDetail` из `@/features/documents`; `DocumentAnnotations` из `@/features/annotations`; `getMediaById`, `MediaPlayer` из `@/features/media`; `MarginNote`, `RouterLink`, `Skeleton` из `@/components/ui`; i18n `pages`.

> Страница юнит-тестами не покрывается. Верификация — `pnpm lint && pnpm test && pnpm build` + ручной приём.

- [ ] **Step 1: Переписать страницу** — `src/app/lectures/[id]/page.tsx`:

```tsx
// src/app/lectures/[id]/page.tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SaveOfflineButton } from "@/app/_offline/save-offline-button";
import { MarginNote, RouterLink, Skeleton } from "@/components/ui";
import { DocumentAnnotations } from "@/features/annotations";
import { CommentSection } from "@/features/comments";
import { DocumentDetail, getDocumentById } from "@/features/documents";
import {
  canUpdateLecture,
  getLectureById,
  getLectureDocuments,
  getLectureMedia,
  lectureCoverUrl,
  LectureDetail,
  LectureDocumentSelector,
  LectureExportLinks,
  resolveActiveDocId,
} from "@/features/lectures";
import { getMediaById, MediaPlayer } from "@/features/media";
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
  const [me, lecture, tags, documents, media] = await Promise.all([
    getMe(),
    getLectureById(id, token),
    getLectureTags(id),
    getLectureDocuments(id, token),
    getLectureMedia(id, token),
  ]);
  if (!lecture) notFound();

  // URL-driven активный документ (?doc=); тело — только активного (ленивость).
  const activeId = resolveActiveDocId(documents, doc);
  const activeDoc = activeId ? await getDocumentById(activeId, token) : null;

  // Медиа-плееры: url в списке опционален → добираем getMediaById только когда пуст.
  const mediaWithUrl = await Promise.all(
    media.map(async (m) => (m.url ? m : ((await getMediaById(m.id)) ?? m))),
  );

  const canShare = canCreateShareLink(me, lecture);
  const canEdit = canUpdateLecture(me, lecture);
  const [subscribed, shareLinks, t] = await Promise.all([
    me && lecture.id ? getLectureSubscription(lecture.id) : Promise.resolve(false),
    canShare ? getShareLinksFor("lecture", lecture.id) : Promise.resolve([]),
    getT("pages"),
  ]);

  return (
    <>
      <div className="flex flex-col gap-8 p-4">
        {/* Admin-affordance: правка лекции (по canUpdateLecture). */}
        {canEdit && (
          <div className="flex justify-end">
            <RouterLink
              href={`/admin/lectures/${id}/edit`}
              className="text-sm text-(--color-link)"
            >
              {t("lectureEditLink")}
            </RouterLink>
          </div>
        )}

        <LectureDetail lecture={lecture} tags={tags} />
        <LectureExportLinks id={id} />

        {/* Документы — инлайн активный (URL-driven ?doc=); один data-ast-root. */}
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

        {/* Медиа — плееры (audio/video). */}
        {mediaWithUrl.length > 0 && (
          <section className="flex flex-col gap-3" aria-label={t("lectureMediaHeading")}>
            <h2 className="text-lg font-semibold">{t("lectureMediaHeading")}</h2>
            <ul className="flex flex-col gap-6">
              {mediaWithUrl.map((m) => (
                <li key={m.id}>
                  {m.url ? (
                    <MediaPlayer url={m.url} type={m.type} filename={m.filename} mediaId={m.id} />
                  ) : (
                    <p className="text-sm text-(--color-fg-muted)">{t("lectureMediaUnavailable")}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

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

      {/* Аннотации активного документа — правое поле грида (как /documents/[id]). */}
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

(Против прежней версии: убрана `mx-auto max-w-3xl` обёртка → фрагмент + `MarginNote`; убраны `LectureDocumentsSection`/`LectureMediaSection`; добавлены edit-link, селектор+активный документ, медиа-плееры, аннотации; `searchParams` получил `doc`.)

- [ ] **Step 2: Удалить заменённые секции-ссылки**

```bash
git rm src/features/lectures/ui/lecture-documents-section.tsx src/features/lectures/ui/lecture-media-section.tsx
```
И убрать их экспорты из `src/features/lectures/index.ts` (строки `export { LectureDocumentsSection } …` и `export { LectureMediaSection } …`).

- [ ] **Step 3: Удалить мёртвые i18n-ключи** — из ВСЕХ четырёх `…/lectures.ts` удалить `documentsSectionLabel`, `documentsSectionHeading`, `mediaSectionLabel`, `mediaSectionHeading` (использовались только удалёнными секциями; вне них в `src/` не встречаются — проверить grep'ом).

- [ ] **Step 4: Гейт**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS. Линт: страница (`src/app/**`) вправе импортировать `@/features/*`. i18n-паритет цел. Маршрут `/lectures/[id]` собирается.

- [ ] **Step 5: Ручной приём (желательно)**

Стенд `:3001`. Лекция с ≥2 документами `http://localhost:3001/lectures/<id>`: селектор + инлайн-документ; клик → `?doc=` грузит один; выделение → создание аннотации (если есть права); аннотации = `/documents/<id>`; медиа-плееры; залогиненный owner видит «Редактировать»; общий грид.

- [ ] **Step 6: Коммит** (страница + `index.ts` + i18n — hot → `--only`; удаления застейджены `git rm`)

```bash
git add "src/app/lectures/[id]/page.tsx" src/features/lectures/index.ts src/i18n/messages/ru/lectures.ts src/i18n/messages/en/lectures.ts src/i18n/messages/ar/lectures.ts src/i18n/messages/zh/lectures.ts
git commit --only "src/app/lectures/[id]/page.tsx" src/features/lectures/ui/lecture-documents-section.tsx src/features/lectures/ui/lecture-media-section.tsx src/features/lectures/index.ts src/i18n/messages/ru/lectures.ts src/i18n/messages/en/lectures.ts src/i18n/messages/ar/lectures.ts src/i18n/messages/zh/lectures.ts -m "feat(lectures): единая страница лекции — документы+аннотации+медиа+edit-link (общий грид, URL-driven ?doc)"
```

---

### Task 6: удалить admin-карточку + перенаправить ссылки

**Files:**
- Delete: `src/app/admin/lectures/[id]/page.tsx`
- Modify: `src/features/lectures/ui/lecture-admin-row.tsx` (заголовок → `/lectures/[id]`)
- Modify: `src/features/lectures/ui/lecture-create-form.tsx` (редирект → `/lectures/[id]`)
- Modify: `src/i18n/messages/{ru,en,ar,zh}/admin.ts` (удалить мёртвые `cardMetaTitle`, `cardMediaHeading`, `cardMediaUnavailable`)

**Interfaces:** —

- [ ] **Step 1: Удалить admin-карточку**

```bash
git rm "src/app/admin/lectures/[id]/page.tsx"
```

- [ ] **Step 2: admin-строка → общая страница** — в `src/features/lectures/ui/lecture-admin-row.tsx` заменить href заголовка `/admin/lectures/${lecture.id}` → `/lectures/${lecture.id}`:

```tsx
      <Td className="font-medium">
        {canEdit ? (
          <RouterLink href={`/lectures/${lecture.id}`} className="hover:underline">
            {lecture.title}
          </RouterLink>
        ) : (
          lecture.title
        )}
      </Td>
```
(Ссылка «Редактировать» в той же строке — `/admin/lectures/${lecture.id}/edit` — НЕ трогаем.)

- [ ] **Step 3: редирект формы создания → общая страница** — в `src/features/lectures/ui/lecture-create-form.tsx` (~стр. 42-46) ветку при выбранных документах:

```tsx
  // При выборе документов ведём на страницу лекции (там документы + edit-link),
  // иначе — на редактирование.
  useActionRedirect(state, (data) =>
    docs.length > 0
      ? `/lectures/${data.id}`
      : `/admin/lectures/${data.id}/edit`,
  );
```
(было `…/admin/lectures/${data.id}` — удалённая карточка.)

- [ ] **Step 4: Удалить мёртвые admin-ключи** — из ВСЕХ четырёх `…/admin.ts` удалить `cardMetaTitle`, `cardMediaHeading`, `cardMediaUnavailable` (использовались только удалённой карточкой; вне неё в `src/` не встречаются — проверить grep'ом).

- [ ] **Step 5: Проверка отсутствия висящих ссылок + гейт**

Run:
```bash
grep -rn "admin/lectures/\${[^}]*}\`" src/ | grep -v "/edit\|/new"
```
Expected: пусто (роут-ссылок на удалённую карточку не осталось).
Run: `pnpm lint && pnpm test && pnpm build`
Expected: PASS.

- [ ] **Step 6: Коммит** (admin-row/create-form/index — hot → `--only`; удаление застейджено `git rm`)

```bash
git add src/features/lectures/ui/lecture-admin-row.tsx src/features/lectures/ui/lecture-create-form.tsx src/i18n/messages/ru/admin.ts src/i18n/messages/en/admin.ts src/i18n/messages/ar/admin.ts src/i18n/messages/zh/admin.ts
git commit --only "src/app/admin/lectures/[id]/page.tsx" src/features/lectures/ui/lecture-admin-row.tsx src/features/lectures/ui/lecture-create-form.tsx src/i18n/messages/ru/admin.ts src/i18n/messages/en/admin.ts src/i18n/messages/ar/admin.ts src/i18n/messages/zh/admin.ts -m "refactor(lectures): удалить admin-карточку — ссылки ведут на единую /lectures/[id]"
```

---

## Финальная проверка готовности

- [ ] `pnpm lint && pnpm test && pnpm build` — зелёное.
- [ ] Ручной приём: `/lectures/[id]` — селектор + инлайн-документ + ленивое `?doc` + аннотации в поле + медиа-плееры; owner видит «Редактировать» → `/edit`; `/admin/lectures/[id]` → 404; admin-строка и редирект формы создания ведут на `/lectures/[id]`.

## Открытые вопросы / флаги бэку

- **Видимость документов/медиа лекции (КРИТИЧНО):** подтвердить фильтрацию по видимости для зрителя на `/api/lectures/{id}/documents`, `/media`, `/api/documents/{id}` — приватные не должны утечь на публичную страницу.
- **Мейн-документ (`is_primary`):** заменить дефолт в `resolveActiveDocId` (первый по sort_order → мейн-док), когда бэк добавит.
- **Токен и аннотации/медиа:** `DocumentAnnotations` без share-token (как на `/documents/[id]`).
- **ar/zh вычитка** новых строк.
