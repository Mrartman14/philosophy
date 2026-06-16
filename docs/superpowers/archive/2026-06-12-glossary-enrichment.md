# Glossary Enrichment (ревизии терминов + .md/.txt-выгрузки) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дополнить СУЩЕСТВУЮЩИЙ слайс `src/features/glossary/` покрытием оставшихся glossary-эндпоинтов бекенда: просмотр ревизий термина (`GET /api/glossary/{id}/revisions` и `…/{revisionID}`) на admin-странице редактирования через generic-компонент `src/components/revision-history/`, плюс ссылки на публичные `.md`/`.txt`-выгрузки (списка и термина) на публичных страницах глоссария.

**Architecture:** Это НЕ новый слайс — расширение `src/features/glossary/` в его собственном стиле (server fetchers через `React.cache`, 404 → null, `data?.data`-разворачивание). Новые мутации, Zod-схемы и permissions НЕ добавляются: все новые эндпоинты — публичные GETы. Ревизии рендерятся через `RevisionHistory` из `src/components/revision-history/` (владелец — ветка `events`, мержится раньше; контракт берём as-is) с мостиком-server-компонентом `GlossaryRevisions` внутри слайса; выбор ревизии — searchParams `?revision=` на edit-странице (conventions §3.5). `.md`/`.txt` рендерит бек; эндпоинты публичные (проверено по `cmd/server/main.go` — только rate-limit, БЕЗ auth-middleware), поэтому прокси-роут (как у events) НЕ нужен — простые `<a href>` на URL бекенда.

**Tech Stack:** Next.js 16 (App Router, server components), openapi-fetch (`@/api/client`), `@/components/revision-history` (контракт из плана events), `@/components/ast-render`, Vitest.

---

## Обязательные правила для исполнителя (и всех его субагентов — передавать дословно)

- НЕ делать `git stash`, `git reset`, `git checkout .`, `git clean` и прочие деструктивные git-операции.
- НЕ откатывать и не перезаписывать изменения других агентов.
- `git add` — только свои файлы по имени, никаких `git add -A` / `git add .`.
- Передавать эти правила всем создаваемым субагентам.
- Перед стартом прочитать `docs/frontend-conventions.md` и `CLAUDE.md`.
- Работать в изолированном worktree (skill `superpowers:using-git-worktrees`).

---

## Зависимость от ветки events (КРИТИЧНО)

Этот план использует `src/components/revision-history/` (компонент `RevisionHistory`, типы `RevisionListItem`/`RevisionHistoryProps`), который создаёт ветка `events` (план `docs/superpowers/plans/2026-06-12-events.md`, Task 8). По протоколу волны 1 events мержится в локальный `main` РАНЬШЕ glossary-enrichment.

- **Worktree этой фичи создавать от `main`, в котором events уже вмержен.** Проверка — Task 1 Step 1.
- Если events ещё не вмержен — НЕ стартовать выполнение; НЕ создавать свою копию revision-history; сообщить менеджеру и ждать.
- Контракт компонента (props) зафиксирован в плане events (секция «Контракт generic-компонента») и повторён здесь в Task 5 — использовать as-is, файлы `src/components/revision-history/*` НЕ менять.

---

## Сверка с бекендом (источник истины — `/Users/alexander.borisenko/Documents/philosophy-api`)

Проверено по коду бекенда (не только schema.ts):

- **Все новые эндпоинты — публичные, прокси НЕ нужен** (в отличие от admin-эндпоинтов events, требующих Bearer):
  - `GET /api/glossary.md` / `GET /api/glossary.txt` — `cmd/server/main.go:993-994`, только `publicRL.Middleware` (rate-limit), без `requiredAuth`/`optionalAuth`;
  - `GET /api/glossary/{id}` + `.md`/`.txt` через `httputil.DispatchBySuffix` — `cmd/server/main.go:1021-1026`, тоже только rate-limit;
  - `GET /api/glossary/{id}/revisions` и `GET /api/glossary/{id}/revisions/{revisionID}` — `cmd/server/main.go:1251-1252`, только rate-limit. Капабилити-гейтов нет вовсе.
- **Ревизии** (`internal/revision`): список — `RevisionMeta { id, editor_id, created_at }`, отсортирован по **`created_at ASC` (старые первыми!)** с потолком `listCap = 200` (`internal/revision/repo.go:280,306`); в UI показываем новые первыми — переворачиваем на фронте. Одна ревизия — `Revision { id, entity_id, editor_id, blocks, created_at }`; хендлер проверяет принадлежность ревизии термину, иначе 404 (`internal/revision/handler.go`). Несуществующий термин → 404 (`glossaryRevAccess` → `glossarySvc.GetByID` → `apperror.NotFound`, `cmd/server/main.go:1225-1228`). Ревизия создаётся автоматически при каждом `PUT /api/admin/glossary/{id}/blocks` — отдельных мутаций для ревизий нет.
- **`editor_id` — UUID без username** — в `label` ревизии не показываем (то же решение, что в плане events).
- **`.md`-список пагинирован**: `httputil.ParsePagination(r, 20, 100)` — default 20, max 100 (`internal/glossary/handler_md.go:197`); бек сам вставляет в Markdown ссылку «следующая страница» (`handler_md.go:232-236`). Ссылка без параметров открывает первую страницу — этого достаточно, выгрузку рендерит бек (спека §4).
- **Ответы**: ревизии заворачиваются в `httputil.Response{Data: …}` (`internal/httputil/httputil.go:52-56`) — на фронте разворачиваем `data?.data`, как в остальном слайсе.
- **`POST /api/glossary/suggest`** — `requiredAuth` (`cmd/server/main.go:1043`) и по спеке (§3, волна 3) уходит в фичу `lecture-enrichment` — **вне скоупа этого плана**.
- **Capabilities**: новые НЕ нужны (все новые эндпоинты без гейтов). Существующие `glossary.create/update/delete` уже есть и в `internal/rbac/capabilities.go`, и в union `Capability` (`src/utils/permissions.ts`), и используются слайсом — ничего не меняем.
- **Foundation-touch: не требуется.** Пункт «Глоссарий» в admin-sidebar уже есть; новые страницы не создаются; `src/api/tags.ts` не меняется (тег `GLOSSARY` уже зарегистрирован, новых мутаций/кеш-тегов нет).

---

## Parallel-safety contract

План выполняется в собственном worktree параллельно с другими фичами волны 1 (`tags`, `banners`, `users-admin`, `audit`, `auth-register`, `preferences-push`, `ast-editor-phase-2`), но **строго после мержа `events`** (см. «Зависимость от ветки events»).

**Создаёт (только новые файлы — collision невозможен):**

- `src/features/glossary/export-urls.ts`
- `src/features/glossary/export-urls.test.ts`
- `src/features/glossary/ui/glossary-export-links.tsx`
- `src/features/glossary/ui/glossary-revisions.tsx`

**Модифицирует (файлы зарезервированы за этой веткой на волну 1 — другие ветки их не трогают):**

- `src/features/glossary/types.ts` — + типы `TermRevisionMeta`, `TermRevision`
- `src/features/glossary/api.ts` — + фетчеры `getTermRevisions`, `getTermRevision`
- `src/features/glossary/index.ts` — + экспорты новых UI-компонентов
- `src/app/glossary/page.tsx` — + ссылки на выгрузки списка
- `src/app/glossary/[id]/page.tsx` — + ссылки на выгрузки термина
- `src/app/admin/glossary/[id]/edit/page.tsx` — + секция ревизий (`?revision=`)

**НЕ трогает (резервируется за другими ветками / заморожено):**

- `src/components/revision-history/**` — владелец: ветка `events`; используем только публичный API (`RevisionHistory`, типы) — зависимость «merge after events».
- `src/api/tags.ts` — НЕ модифицируем (новый тег не нужен).
- `src/app/admin/layout.tsx`, `src/app/admin/admin-sidebar.tsx`, header — foundation-touch не требуется.
- `src/features/lectures/**` (ветка `tags`), `src/features/events/**`, `src/app/admin/events/**`, `src/app/calendar/**` (ветка `events`).
- `src/components/ast-editor/**`, `src/components/ast-render/**` — ветка `ast-editor-phase-2`; импортируем только публичные API.
- `public/sw.js` — незакоммиченный чужой diff, не трогать.

**Frozen zones** (CLAUDE.md, полный список там): `src/api/schema.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/ui/*`, `src/components/{shared,app,permission,…}`, `src/utils/*`, `src/hooks/*`, `src/services/*`, `package.json`, `package-lock.json`, `eslint.config.mjs`, `vitest.config.ts` — не трогать.

---

## Вне скоупа

- **`POST /api/glossary/suggest`** — волна 3, фича `lecture-enrichment` (спека §3). Не реализуем и не типизируем.
- Аннотации на термины (`POST /api/glossary/{id}/annotations`) — волна 2, фича `annotations`.
- Ревизии на ПУБЛИЧНОЙ странице термина — спека размещает просмотр ревизий на admin-поверхности; публичную страницу не расширяем (хотя эндпоинт публичный — вернуться можно отдельной задачей).
- Прокси-роут для выгрузок — НЕ нужен (эндпоинты публичные, см. сверку с бекендом).

---

## Файловая структура

```
src/features/glossary/                    # СУЩЕСТВУЮЩИЙ слайс — расширяем
├── export-urls.ts                        # NEW: чистый helper URL-ов .md/.txt (тестируемый)
├── export-urls.test.ts                   # NEW: vitest для helper'а
├── types.ts                              # MOD: + TermRevisionMeta, TermRevision
├── api.ts                                # MOD: + getTermRevisions, getTermRevision
├── index.ts                              # MOD: + GlossaryExportLinks, GlossaryRevisions
└── ui/
    ├── glossary-export-links.tsx         # NEW: server-компонент ссылок .md/.txt
    └── glossary-revisions.tsx            # NEW: async server мостик → RevisionHistory

src/app/glossary/page.tsx                 # MOD: + <GlossaryExportLinks />
src/app/glossary/[id]/page.tsx            # MOD: + <GlossaryExportLinks termId={…} />
src/app/admin/glossary/[id]/edit/page.tsx # MOD: + searchParams ?revision= + <GlossaryRevisions />
```

Выбор UX для ревизий: **секцией на edit-странице** (`/admin/glossary/[id]/edit?revision=<rid>`), а не отдельной страницей `/admin/glossary/[id]/revisions` — тот же паттерн, что у events (Task 14 их плана): нет новой страницы, нет нового layer-3 гейта, выбор ревизии — навигация по ссылке без client-JS.

---

## Task 1: Проверка зависимости от events + типы ревизий

**Files:**
- Modify: `src/features/glossary/types.ts`

- [x] **Step 1: Убедиться, что revision-history уже в ветке (зависимость от events)**

Run: `ls /Users/alexander.borisenko/Documents/philosophy/src/components/revision-history/`
Expected: файлы `index.ts`, `types.ts`, `revision-history.tsx`, `revision-history.test.tsx`.

Если директории НЕТ — ветка events ещё не вмержена в main, от которого создан worktree. ОСТАНОВИТЬСЯ и сообщить менеджеру. НЕ создавать компонент самостоятельно.

- [x] **Step 2: Расширить types.ts (полное новое содержимое файла)**

```ts
// src/features/glossary/types.ts
import type { components } from "@/api/schema";

export type Term = components["schemas"]["glossary.Term"];

/** Мета ревизии термина (элемент списка GET /api/glossary/{id}/revisions). */
export type TermRevisionMeta = components["schemas"]["revision.RevisionMeta"];

/** Полная ревизия термина со снапшотом blocks. */
export type TermRevision = components["schemas"]["revision.Revision"];
```

- [x] **Step 3: Проверить типы**

Run: `npx tsc --noEmit`
Expected: без новых ошибок.

- [x] **Step 4: Commit**

```bash
git add src/features/glossary/types.ts
git commit -m "feat(glossary): add revision types for term revision history"
```

---

## Task 2: Чистый helper export-urls — TDD

**Files:**
- Create: `src/features/glossary/export-urls.test.ts`
- Create: `src/features/glossary/export-urls.ts`

- [x] **Step 1: Написать падающий тест**

```ts
// src/features/glossary/export-urls.test.ts
import { describe, it, expect } from "vitest";
import { glossaryExportUrls } from "./export-urls";

const BASE = "http://localhost:8090";

describe("glossaryExportUrls", () => {
  it("без termId — выгрузки списка: /api/glossary.md|.txt", () => {
    const urls = glossaryExportUrls(BASE);
    expect(urls.md).toBe("http://localhost:8090/api/glossary.md");
    expect(urls.txt).toBe("http://localhost:8090/api/glossary.txt");
  });

  it("с termId — выгрузки термина: /api/glossary/{id}.md|.txt", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const urls = glossaryExportUrls(BASE, id);
    expect(urls.md).toBe(`http://localhost:8090/api/glossary/${id}.md`);
    expect(urls.txt).toBe(`http://localhost:8090/api/glossary/${id}.txt`);
  });

  it("обрезает хвостовые слэши базового URL", () => {
    const urls = glossaryExportUrls("http://localhost:8090/");
    expect(urls.md).toBe("http://localhost:8090/api/glossary.md");
  });

  it("URL-кодирует termId", () => {
    const urls = glossaryExportUrls(BASE, "a/b c");
    expect(urls.md).toBe("http://localhost:8090/api/glossary/a%2Fb%20c.md");
    expect(urls.txt).toBe("http://localhost:8090/api/glossary/a%2Fb%20c.txt");
  });
});
```

- [x] **Step 2: Убедиться, что тест падает**

Run: `npx vitest run src/features/glossary/export-urls.test.ts`
Expected: FAIL — модуль `./export-urls` не существует (resolve error).

- [x] **Step 3: Реализовать**

```ts
// src/features/glossary/export-urls.ts
// Чистый helper построения ссылок на .md/.txt-выгрузки глоссария.
// Без "server-only": нужен тестам; никаких side effects и зависимостей
// (паттерн — src/features/events/calendar.ts).

export interface GlossaryExportUrls {
  md: string;
  txt: string;
}

/**
 * Строит абсолютные URL публичных выгрузок глоссария (контент рендерит бек):
 * - без termId — список: GET /api/glossary.md|.txt;
 * - с termId — термин: GET /api/glossary/{id}.md|.txt.
 *
 * Эндпоинты ПУБЛИЧНЫЕ (cmd/server/main.go:993-994, 1021-1026 — только
 * rate-limit, без auth-middleware), поэтому прокси-роут (как у admin-выгрузок
 * events) не нужен — ссылки ведут напрямую на бек.
 */
export function glossaryExportUrls(
  apiBase: string,
  termId?: string,
): GlossaryExportUrls {
  const base = apiBase.replace(/\/+$/, "");
  const path = termId
    ? `/api/glossary/${encodeURIComponent(termId)}`
    : "/api/glossary";
  return { md: `${base}${path}.md`, txt: `${base}${path}.txt` };
}
```

- [x] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/features/glossary/export-urls.test.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Commit**

```bash
git add src/features/glossary/export-urls.ts src/features/glossary/export-urls.test.ts
git commit -m "feat(glossary): add pure helper for public md/txt export URLs"
```

---

## Task 3: api.ts — фетчеры ревизий

**Files:**
- Modify: `src/features/glossary/api.ts`

Стиль — существующие фетчеры слайса: `React.cache`, `createApiClient`, 404 → null/пусто, `data?.data`. Эндпоинты публичные, но используем `createApiClient` для единообразия со слайсом (`getTerms`/`getTermById` тоже ходят им; лишний Bearer бек игнорирует).

- [x] **Step 1: Обновить импорт типов**

Заменить строку:

```ts
import type { Term } from "./types";
```

на:

```ts
import type { Term, TermRevision, TermRevisionMeta } from "./types";
```

- [x] **Step 2: Добавить фетчеры в конец файла**

```ts
/**
 * Список ревизий термина. Эндпоинт публичный (без капабилити-гейтов).
 * Бек отдаёт по created_at ASC (старые первыми) с потолком 200 записей
 * (internal/revision/repo.go) — порядок отображения решает UI.
 * 404 (термин не найден) → пустой список: страница уже отдала notFound()
 * по самому термину раньше, сюда 404 может прийти только в гонке удаления.
 */
export const getTermRevisions = cache(
  async (id: string): Promise<TermRevisionMeta[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET(
      "/api/glossary/{id}/revisions",
      { params: { path: { id } } },
    );
    if (response.status === 404) return [];
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить ревизии термина");
    }
    return (data?.data ?? []) as TermRevisionMeta[];
  },
);

/**
 * Одна ревизия термина со снапшотом blocks. 404 (нет ревизии или она
 * принадлежит другому термину) и 400 (битый id из ?revision= в URL) → null —
 * секция ревизий просто не покажет панель снапшота.
 */
export const getTermRevision = cache(
  async (id: string, revisionId: string): Promise<TermRevision | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET(
      "/api/glossary/{id}/revisions/{revisionID}",
      { params: { path: { id, revisionID: revisionId } } },
    );
    if (response.status === 404 || response.status === 400) return null;
    if (error) {
      throw new Error(error.error ?? "Не удалось загрузить ревизию термина");
    }
    return (data?.data ?? null) as TermRevision | null;
  },
);
```

- [x] **Step 3: Проверить типы**

Run: `npx tsc --noEmit`
Expected: без новых ошибок.

- [x] **Step 4: Commit**

```bash
git add src/features/glossary/api.ts
git commit -m "feat(glossary): add getTermRevisions/getTermRevision fetchers"
```

---

## Task 4: UI — glossary-export-links

**Files:**
- Create: `src/features/glossary/ui/glossary-export-links.tsx`

UI-компоненты по конвенциям проекта не тестируем (`docs/frontend-conventions.md` §5); логика URL-ов уже покрыта тестами Task 2.

- [x] **Step 1: Реализовать**

```tsx
// src/features/glossary/ui/glossary-export-links.tsx
import { glossaryExportUrls } from "../export-urls";

// Тот же env и fallback, что в src/api/client.ts. Серверный компонент:
// process.env читается при SSR — рендерить ТОЛЬКО из server components
// (в client-дереве env недоступен).
const API_URL = process.env.API_URL ?? "http://localhost:8080";

interface Props {
  /** id термина — ссылки на выгрузки термина; без него — выгрузки списка. */
  termId?: string;
  className?: string;
}

/**
 * Ссылки на публичные .md/.txt-выгрузки глоссария. Контент рендерит бек;
 * эндпоинты публичные (только rate-limit) — прокси не нужен, прямые ссылки.
 */
export function GlossaryExportLinks({ termId, className }: Props) {
  const urls = glossaryExportUrls(API_URL, termId);
  return (
    <p
      className={
        className ?? "flex items-center gap-2 text-xs text-(--color-description)"
      }
    >
      Экспорт:
      <a href={urls.md} className="hover:underline" target="_blank" rel="noopener">
        .md
      </a>
      <a href={urls.txt} className="hover:underline" target="_blank" rel="noopener">
        .txt
      </a>
    </p>
  );
}
```

- [x] **Step 2: Проверить типы и линт**

Run: `npx tsc --noEmit && npx eslint src/features/glossary/ui/glossary-export-links.tsx`
Expected: чисто.

- [x] **Step 3: Commit**

```bash
git add src/features/glossary/ui/glossary-export-links.tsx
git commit -m "feat(glossary): add export links component for public md/txt dumps"
```

---

## Task 5: UI — glossary-revisions (мостик к RevisionHistory)

**Files:**
- Create: `src/features/glossary/ui/glossary-revisions.tsx`

Generic-компонент `RevisionHistory` (`src/components/revision-history/`, владелец — ветка events) принимает props-контракт (фиксирован планом events, повторён для справки — НЕ менять его файлы):

```ts
interface RevisionListItem {
  id: string;        // ключ списка и аргумент buildHref
  createdAt: string; // ISO-8601, рендерится локализованно (ru-RU, UTC)
  label?: string;    // опциональная подпись
}
interface RevisionHistoryProps {
  revisions: RevisionListItem[];            // в порядке отображения
  selectedId?: string;                       // из searchParams страницы
  buildHref: (revisionId: string) => string; // роутингом владеет слайс
  children?: ReactNode;                      // контент выбранной ревизии
  title?: string;                            // default «История ревизий»
  emptyText?: string;                        // default «Ревизий пока нет.»
  className?: string;
}
```

- [x] **Step 1: Реализовать**

```tsx
// src/features/glossary/ui/glossary-revisions.tsx
import { AstRender } from "@/components/ast-render";
import { RevisionHistory } from "@/components/revision-history";
import { getTermRevision, getTermRevisions } from "../api";

interface Props {
  termId: string;
  /** id выбранной ревизии из searchParams страницы (?revision=). */
  selectedRevisionId?: string;
}

/**
 * Async server component: фетчит ревизии термина через api.ts слайса и
 * рендерит generic RevisionHistory. Контент выбранной ревизии — AstRender
 * по снапшоту blocks. editor_id бекенда — UUID без username, label не
 * показываем (решение как в слайсе events).
 */
export async function GlossaryRevisions({ termId, selectedRevisionId }: Props) {
  const metas = await getTermRevisions(termId);
  const selected = selectedRevisionId
    ? await getTermRevision(termId, selectedRevisionId)
    : null;

  // Бек отдаёт ревизии по created_at ASC (старые первыми) — показываем
  // новые первыми, как принято в RevisionHistory-потребителях.
  const newestFirst = [...metas].reverse();

  return (
    <RevisionHistory
      revisions={newestFirst.flatMap((m) =>
        m.id ? [{ id: m.id, createdAt: m.created_at ?? "" }] : [],
      )}
      selectedId={selected?.id}
      buildHref={(rid) => `/admin/glossary/${termId}/edit?revision=${rid}`}
      title="История ревизий термина"
    >
      {selected && (
        <div className="prose">
          <AstRender blocks={selected.blocks ?? []} />
        </div>
      )}
    </RevisionHistory>
  );
}
```

- [x] **Step 2: Проверить типы и линт**

Run: `npx tsc --noEmit && npx eslint src/features/glossary/ui/glossary-revisions.tsx`
Expected: чисто.

- [x] **Step 3: Commit**

```bash
git add src/features/glossary/ui/glossary-revisions.tsx
git commit -m "feat(glossary): add revisions bridge component over generic RevisionHistory"
```

---

## Task 6: index.ts — публичный API слайса

**Files:**
- Modify: `src/features/glossary/index.ts`

Экспортируем только то, что нужно страницам: два новых компонента. Фетчеры ревизий и helper URL-ов используются только внутри слайса — наружу не выносим (conventions §1: index.ts — «реэкспорт того, что нужно снаружи»).

- [x] **Step 1: Полное новое содержимое файла**

```ts
// src/features/glossary/index.ts
export { getTerms, getTermById } from "./api";
export type { TermListFilter, TermListResult } from "./api";
export { createTerm, updateTermBlocks, deleteTerm } from "./actions";
export {
  canCreateTerm,
  canUpdateTerm,
  canDeleteTerm,
} from "./permissions";
export { GlossaryList } from "./ui/glossary-list";
export { GlossarySearchForm } from "./ui/glossary-search-form";
export { GlossaryDetail } from "./ui/glossary-detail";
export { GlossaryAdminRow } from "./ui/glossary-admin-row";
export { GlossaryCreateForm } from "./ui/glossary-create-form";
export { GlossaryEditForm } from "./ui/glossary-edit-form";
export { GlossaryDeleteButton } from "./ui/glossary-delete-button";
export { GlossaryExportLinks } from "./ui/glossary-export-links";
export { GlossaryRevisions } from "./ui/glossary-revisions";
export type { Term } from "./types";
```

- [x] **Step 2: Commit**

```bash
git add src/features/glossary/index.ts
git commit -m "feat(glossary): export GlossaryExportLinks and GlossaryRevisions"
```

---

## Task 7: публичные страницы — ссылки на выгрузки

**Files:**
- Modify: `src/app/glossary/page.tsx`
- Modify: `src/app/glossary/[id]/page.tsx`

- [x] **Step 1: `src/app/glossary/page.tsx` (полное новое содержимое)**

```tsx
import {
  getTerms,
  GlossaryExportLinks,
  GlossaryList,
  GlossarySearchForm,
} from "@/features/glossary";

interface Props {
  searchParams: Promise<{ q?: string; offset?: string }>;
}

export default async function GlossaryIndexPage({ searchParams }: Props) {
  const { q, offset } = await searchParams;
  const result = await getTerms({
    ...(q ? { q } : {}),
    offset: offset ? Number(offset) : 0,
    limit: 50,
  });
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">Глоссарий</h1>
      <GlossarySearchForm defaultQ={q ?? ""} />
      <GlossaryList items={result.items} total={result.total} />
      <GlossaryExportLinks />
    </main>
  );
}

export const metadata = { title: "Глоссарий" };
```

- [x] **Step 2: `src/app/glossary/[id]/page.tsx` (полное новое содержимое)**

```tsx
import { notFound } from "next/navigation";
import {
  getTermById,
  GlossaryDetail,
  GlossaryExportLinks,
} from "@/features/glossary";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GlossaryTermPage({ params }: Props) {
  const { id } = await params;
  const term = await getTermById(id);
  if (!term) notFound();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <GlossaryDetail term={term} />
      {term.id && <GlossaryExportLinks termId={term.id} />}
    </main>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const term = await getTermById(id);
  return { title: term?.title ?? "Термин" };
}
```

- [x] **Step 3: Проверить типы и линт**

Run: `npx tsc --noEmit && npx eslint src/app/glossary`
Expected: чисто.

- [x] **Step 4: Commit**

```bash
git add src/app/glossary/page.tsx "src/app/glossary/[id]/page.tsx"
git commit -m "feat(glossary): add md/txt export links to public glossary pages"
```

---

## Task 8: admin edit-страница — секция ревизий

**Files:**
- Modify: `src/app/admin/glossary/[id]/edit/page.tsx`

Гейт страницы не меняем (`canUpdate || canDelete`, иначе `forbidden()`). Эндпоинты ревизий на беке без капабилити-гейтов, поэтому отдельного чека для секции не нужно — она видна всем, кто прошёл существующий гейт страницы. Выбор ревизии — `?revision=<id>` (searchParams-паттерн, conventions §3.5).

- [x] **Step 1: Полное новое содержимое файла**

```tsx
import { forbidden, notFound } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  canUpdateTerm,
  canDeleteTerm,
  getTermById,
  GlossaryEditForm,
  GlossaryDeleteButton,
  GlossaryRevisions,
} from "@/features/glossary";
import { SchemaContextProvider } from "@/components/ast-editor";

export const metadata = { title: "Глоссарий — редактирование термина" };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string }>;
}

export default async function AdminGlossaryEditPage({
  params,
  searchParams,
}: Props) {
  const me = await getMe();
  const canUpdate = canUpdateTerm(me);
  const canDelete = canDeleteTerm(me);
  if (!canUpdate && !canDelete) forbidden();

  const { id } = await params;
  const { revision } = await searchParams;
  const term = await getTermById(id);
  if (!term) notFound();

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{term.title}</h1>
        <p className="text-xs text-(--color-description)">
          Название термина нельзя изменить. Можно редактировать только тело.
        </p>
      </header>

      {canUpdate && (
        <SchemaContextProvider>
          <GlossaryEditForm term={term} />
        </SchemaContextProvider>
      )}

      {term.id && (
        <GlossaryRevisions termId={term.id} selectedRevisionId={revision} />
      )}

      {canDelete && term.id && (
        <div>
          <GlossaryDeleteButton id={term.id} />
        </div>
      )}
    </section>
  );
}
```

- [x] **Step 2: Проверить типы и линт**

Run: `npx tsc --noEmit && npx eslint "src/app/admin/glossary/[id]/edit/page.tsx"`
Expected: чисто.

- [x] **Step 3: Commit**

```bash
git add "src/app/admin/glossary/[id]/edit/page.tsx"
git commit -m "feat(glossary): show term revision history on admin edit page"
```

---

## Task 9: финальная верификация

- [x] **Step 1: Полный прогон**

Run: `npm run lint && npm test && npm run build`
Expected: всё зелёное. Если красное — фиксить, не отключая правила и не комментируя тесты.

- [x] **Step 2: Чеклист `src/features/_template/README.md` (применимые пункты для расширения слайса)**

- `index.ts` экспортирует только нужное снаружи — да (Task 6: фетчеры ревизий и helper остались внутренними).
- `api.ts` начинается с `import "server-only";` — не менялось, новые фетчеры в том же файле.
- Новые Zod-схемы/permissions НЕ добавлялись → новые тесты на них не требуются; существующие `permissions.test.ts` / `schemas.test.ts` не тронуты и зелёные.
- Чистый helper `export-urls.ts` покрыт тестами (4 кейса, Task 2).
- Нет импортов других `@/features/*` — слайс импортирует только `@/components/revision-history`, `@/components/ast-render`, `@/api/*` (ESLint enforced).
- Ревизии — только чтение: мутаций, `revalidateEntity` и новых кеш-тегов не появилось.
- lint/test/build зелёные — Step 1.

- [ ] **Step 3: Ручной smoke (если поднят бек)** — ПРОПУЩЕН: бек на `http://localhost:8090` не поднят на момент выполнения (curl → connection refused).

- `/glossary` — внизу «Экспорт: .md .txt», ссылки открывают выгрузки бека.
- `/glossary/<id>` — то же для термина.
- `/admin/glossary/<id>/edit` — секция «История ревизий термина»; после сохранения тела через форму появляется новая ревизия; клик по ревизии добавляет `?revision=` и показывает снапшот через AstRender.

- [x] **Step 4: Если что-то правилось — финальный коммит** — не потребовался: lint/test/build зелёные с первого прогона.

```bash
git add <только свои файлы по имени>
git commit -m "fix(glossary): address final lint/test/build findings"
```

---

## Foundation-touch

**Не требуется.** Пункт «Глоссарий» в admin-sidebar уже существует; новых страниц, capabilities и кеш-тегов фича не добавляет; запретные зоны не затрагиваются.

---

## Риски, допущения и отклонения (для менеджера)

1. **Прокси для выгрузок НЕ нужен** — главный вопрос спеки по этой фиче проверен по беку: `GET /api/glossary.md|.txt`, `GET /api/glossary/{id}.md|.txt`, `GET /api/glossary/{id}/revisions*` зарегистрированы только с `publicRL.Middleware` (rate-limit), без auth (`cmd/server/main.go:993-994, 1021-1026, 1251-1252`). Паттерн прокси-роута events здесь не повторяем — простые `<a href>` на бек.
2. **Допущение: `API_URL` достижим из браузера.** Прямые ссылки строятся от `process.env.API_URL` (dev: `http://localhost:8090` — достижим). Если в каком-то деплое `API_URL` станет внутренним адресом, ссылки сломаются — тогда понадобится `NEXT_PUBLIC_API_URL` или тонкий прокси (вопрос деплоя, эскалировать менеджеру; не решается в этой фиче).
3. **Порядок ревизий**: бек отдаёт `created_at ASC` (старые первыми) с потолком 200 (`internal/revision/repo.go`). UI переворачивает в «новые первыми». Замечание для менеджера: план events предполагал «бек отдаёт новые первыми» — их бриджу, возможно, нужен такой же reverse (не наша зона, сообщить при ревью волны).
4. **`.md`-выгрузка списка пагинирована** (default 20): ссылка без параметров открывает первую страницу, навигация дальше — ссылками, которые бек вставляет в сам Markdown. Сознательное упрощение (спека §4: выгрузки рендерит бек, фронт даёт только ссылки).
5. **`editor_id` в ревизиях — UUID без username** — `label` в `RevisionListItem` не заполняем (то же решение, что у events).
6. **Зависимость merge-порядка**: ветка стартует только после мержа events (наличие `src/components/revision-history/` проверяется в Task 1 Step 1).
7. **`POST /api/glossary/suggest` — вне скоупа** (волна 3, `lecture-enrichment`), на беке под `requiredAuth`.
