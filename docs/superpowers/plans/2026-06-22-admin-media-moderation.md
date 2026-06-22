# Admin Media Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать админу (capability `media.delete_any`) страницу `/admin/media` для модерации неприватных медиа всех владельцев: список с фильтром по автору, пагинация, удаление нарушающего файла — поверх НОВОЙ ручки `GET /api/admin/media`, переиспользуя существующий `deleteMedia` (отдельной admin-DELETE-ручки нет).

**Architecture:** Зеркало паттерна `src/app/admin/annotations/`. Слайс `src/features/media/` получает `canModerateMedia` (permission), `getAdminMedia` (server-only API через `createApiClient` + `unwrapList`), `MediaAdminRow` (async server-компонент строки, переиспользует `MediaDeleteButton` с `isAdminDelete`) и `MediaAdminFilterForm` (client URL-фильтр по `owner_id`). Маршрут `src/app/admin/media/page.tsx` — Layer-3 gate (`getMe()` + `canModerateMedia()` + `forbidden()`), парсинг `offset`/`owner_id`, фетч, список + `Pagination`. Nav-итем в `buildNavItems` (единственное admin-shell-смежное касание). i18n — namespace `admin` (ru+en) + один ключ в `media`.

**Tech Stack:** Next.js App Router, TypeScript, openapi-fetch, React `cache`, next-intl (`getT`/`useT`), vitest + @testing-library/react, pnpm.

**Спека:** [docs/superpowers/specs/2026-06-22-admin-media-moderation-design.md](../specs/2026-06-22-admin-media-moderation-design.md)

## Global Constraints
- pnpm only; green `pnpm lint && pnpm test && pnpm build` before PR.
- kebab-case filenames in src/.
- git add ONLY named files; no add -A/. , no stash/reset/checkout ./clean; don't touch others' changes.
- Each commit ends with: Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
- RBAC: server actions use requireCapability; UI uses canX(). Layer-3 admin gate: getMe()+canX()+forbidden().

### Дополнительные инварианты этого PR
- **Контракт:** `DELETE /api/admin/media/{id}` НЕ существует. Admin-удаление = существующий `deleteMedia(id)` (owner-or-`media.delete_any`, `src/features/media/actions.ts:46-59`). Новый action НЕ писать.
- **Запретные/координируемые зоны** (касаем минимально и осознанно): `src/app/admin/admin-access.ts` (только `buildNavItems` — capability-точка расширения; сам `admin-sidebar.tsx` НЕ трогаем), `src/i18n/messages/*` (только добавляем ключи). Параллельные агенты пишут в `messages/*/admin.ts` — коммитить через `git add <file> && git commit --only <file>`, сверяясь с `git status` (memory «Parallel commit hot-files»).
- **Тип результата** admin-списка — существующий `MyMediaResult` (`{ items: Media[]; total; offset; limit }`), не плодить близнеца.

---

## File Structure

**Создаём:**
- `src/features/media/ui/media-admin-row.tsx` — async server-строка модерации.
- `src/features/media/ui/media-admin-row.test.tsx` — тест строки.
- `src/features/media/ui/media-admin-filter-form.tsx` — client URL-фильтр по `owner_id`.
- `src/app/admin/media/page.tsx` — страница + Layer-3 gate.

**Изменяем:**
- `src/features/media/permissions.ts` (+ `permissions.test.ts`) — `canModerateMedia`.
- `src/features/media/api.ts` (+ `api.test.ts`) — `getAdminMedia`.
- `src/features/media/index.ts` — экспорты `getAdminMedia`, `canModerateMedia`, `MediaAdminRow`, `MediaAdminFilterForm`.
- `src/app/admin/admin-access.ts` (+ `admin-access.test.ts`) — nav-итем `/admin/media`.
- `src/i18n/messages/ru/admin.ts`, `src/i18n/messages/en/admin.ts` — ключи admin-страницы.
- `src/i18n/messages/ru/media.ts`, `src/i18n/messages/en/media.ts` — `api.loadAdminFailed`.

---

### Task 1: Permission `canModerateMedia`

**Files:**
- Modify: `src/features/media/permissions.ts`
- Test: `src/features/media/permissions.test.ts` (дополнить)

**Interfaces:**
- Consumes: `can` (`@/utils/permissions`), `MaybeMe` (`@/utils/me`).
- Produces: `canModerateMedia(me: MaybeMe): boolean` = `can(me, "media.delete_any")`. Зеркало `canModerateAnnotations`; читается как «доступ к admin-списку», гейтит страницу и nav.

- [ ] **Step 1: Написать падающий тест**

Добавить в конец `src/features/media/permissions.test.ts` (импорт уже тянет из `./permissions` — расширить именованный импорт `canModerateMedia`):

```ts
// добавить canModerateMedia в существующий import-блок из "./permissions":
//   import { canCreateMedia, canDeleteAnyMedia, canDeleteMedia,
//            canChangeMediaVisibility, canModerateMedia } from "./permissions";

describe("canModerateMedia (доступ к admin-списку медиа = media.delete_any)", () => {
  it("гость → false", () => { expect(canModerateMedia(guest)).toBe(false); });
  it("обычный user без delete_any → false", () =>
    { expect(canModerateMedia(owner)).toBe(false); });
  it("admin с media.delete_any → true", () =>
    { expect(canModerateMedia(admin)).toBe(true); });
  it("suspended admin → false", () =>
    { expect(canModerateMedia(suspendedAdmin)).toBe(false); });
});
```

(`guest`, `owner`, `admin`, `suspendedAdmin` уже определены в файле — `permissions.test.ts:14-41`.)

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/features/media/permissions.test.ts`
Expected: FAIL — `canModerateMedia` не экспортируется (`"canModerateMedia" is not exported by "./permissions"` / `canModerateMedia is not a function`).

- [ ] **Step 3: Реализовать**

В `src/features/media/permissions.ts` добавить после `canModerateMedia`-соседей (например, после `canDeleteAnyMedia`):

```ts
/**
 * Доступ к admin-списку неприватных медиа (GET /api/admin/media). Гейт
 * media.delete_any. Зеркало canModerateAnnotations: используется Layer-3-гейтом
 * страницы /admin/media и nav-итемом. Семантически совпадает с canDeleteAnyMedia,
 * но имя выражает намерение «модерация/доступ к списку», а не «может удалить любое».
 */
export function canModerateMedia(me: MaybeMe): boolean {
  return can(me, "media.delete_any");
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/media/permissions.test.ts`
Expected: PASS (все блоки, включая 4 новых теста `canModerateMedia`).

- [ ] **Step 5: Commit**

```bash
git add src/features/media/permissions.ts src/features/media/permissions.test.ts
git commit -m "feat(media): canModerateMedia — гейт admin-списка медиа

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: API `getAdminMedia`

**Files:**
- Modify: `src/features/media/api.ts`
- Modify: `src/i18n/messages/ru/media.ts`, `src/i18n/messages/en/media.ts` (ключ `api.loadAdminFailed`)
- Test: `src/features/media/api.test.ts` (дополнить)

**Interfaces:**
- Consumes: `createApiClient` (`@/api/client`), `getT` (`@/i18n`), `unwrapList` (`@/utils/api-unwrap`), `MyMediaResult` (этот же файл), `cache` (`react`).
- Produces:
  - `getAdminMedia(filter?: { owner_id?: string; offset?: number; limit?: number }): Promise<MyMediaResult>` — GET `/api/admin/media`, `owner_id` пробрасывается только если непустой; throw при error-ответе.

- [ ] **Step 1: Написать падающий тест**

Добавить в `src/features/media/api.test.ts`. Импорт расширить: `import { getAdminMedia, getMediaById, getMediaContainers, getMyMedia } from "./api";`. Хелперы `getMock`, `apiResult`, `beforeEach` уже в файле.

```ts
// ---------------------------------------------------------------------------
// getAdminMedia — admin-список (GET /api/admin/media)
// ---------------------------------------------------------------------------
describe("getAdminMedia — admin-список", () => {
  it("пробрасывает offset/limit и owner_id в query, когда owner_id задан", async () => {
    getMock.mockResolvedValue(
      apiResult({ data: { data: [], pagination: { total: 0, offset: 0, limit: 20 } } }),
    );

    await getAdminMedia({ offset: 0, limit: 20, owner_id: "u-7" });

    expect(getMock).toHaveBeenCalledWith("/api/admin/media", {
      params: { query: { offset: 0, limit: 20, owner_id: "u-7" } },
    });
  });

  it("НЕ пробрасывает owner_id, когда он пустой/не задан", async () => {
    getMock.mockResolvedValue(
      apiResult({ data: { data: [], pagination: { total: 0, offset: 0, limit: 20 } } }),
    );

    await getAdminMedia({ offset: 0, limit: 20 });

    expect(getMock).toHaveBeenCalledWith("/api/admin/media", {
      params: { query: { offset: 0, limit: 20 } },
    });
  });

  it("использует дефолты offset=0, limit=20 без filter", async () => {
    getMock.mockResolvedValue(apiResult({ data: { data: [], pagination: null } }));

    const result = await getAdminMedia();

    expect(result.offset).toBe(0);
    expect(result.limit).toBe(20);
    expect(result.items).toEqual([]);
  });

  it("разворачивает items/total через unwrapList", async () => {
    const media = { id: "m-1", filename: "a.mp4", type: "video", owner_id: "u-1", visibility: "public", created_at: "2026-06-01T00:00:00Z" };
    getMock.mockResolvedValue(
      apiResult({ data: { data: [media], pagination: { total: 5, offset: 0, limit: 20 } } }),
    );

    const result = await getAdminMedia({ offset: 0, limit: 20 });

    expect(result.items).toEqual([media]);
    expect(result.total).toBe(5);
  });

  it("бросает при error-ответе (403/401 не деградируем)", async () => {
    getMock.mockResolvedValue(
      apiResult({ error: { error: "forbidden" }, status: 403 }),
    );

    await expect(getAdminMedia()).rejects.toThrow("forbidden");
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/features/media/api.test.ts`
Expected: FAIL — `getAdminMedia` не экспортируется (`"getAdminMedia" is not exported by "./api"`).

- [ ] **Step 3: Реализовать API + i18n-ключ ошибки**

В `src/features/media/api.ts` добавить (после `getMyMedia`, до `getMediaById` — рядом с прочими `cache`-функциями):

```ts
/**
 * GET /api/admin/media — admin-список неприватных медиа всех владельцев
 * (модерация, гейт media.delete_any). Приватные бек не листит. Возвращает тот
 * же MyMediaResult, что и getMyMedia. Per-actor → только React.cache, без
 * unstable_cache (как getMyMedia).
 */
export const getAdminMedia = cache(
  async (
    filter: { owner_id?: string; offset?: number; limit?: number } = {},
  ): Promise<MyMediaResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const { data, error } = await api.GET("/api/admin/media", {
      params: {
        query: {
          offset,
          limit,
          ...(filter.owner_id ? { owner_id: filter.owner_id } : {}),
        },
      },
    });
    if (error) {
      throw new Error(error.error ?? (await getT("media"))("api.loadAdminFailed"));
    }
    return unwrapList(data, { offset, limit });
  },
);
```

В `src/i18n/messages/ru/media.ts` — в блок `api`:

```ts
  api: {
    loadMyFailed: "Не удалось загрузить медиа",
    loadItemFailed: "Не удалось загрузить медиа",
    loadContainersFailed: "Не удалось загрузить контейнеры",
    loadAdminFailed: "Не удалось загрузить список медиа",
  },
```

В `src/i18n/messages/en/media.ts` — в блок `api`:

```ts
  api: {
    loadMyFailed: "Failed to load media",
    loadItemFailed: "Failed to load media",
    loadContainersFailed: "Failed to load containers",
    loadAdminFailed: "Failed to load media list",
  },
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/media/api.test.ts`
Expected: PASS (новый блок `getAdminMedia` + старые).

- [ ] **Step 5: Commit**

```bash
git add src/features/media/api.ts src/i18n/messages/ru/media.ts src/i18n/messages/en/media.ts src/features/media/api.test.ts
git commit -m "feat(media): getAdminMedia — GET /api/admin/media + ключ ошибки

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: UI `MediaAdminRow` (строка модерации)

**Files:**
- Create: `src/features/media/ui/media-admin-row.tsx`
- Test: `src/features/media/ui/media-admin-row.test.tsx`

**Interfaces:**
- Consumes: `getT` (`@/i18n`), `getServerFmt` (`@/i18n`), `Media` (`../types`), `MediaDeleteButton` (`./media-delete-button`, props `{ id: string; isAdminDelete?: boolean }`).
- Produces: `async function MediaAdminRow({ media }: { media: Media }): Promise<JSX.Element>` — строка: владелец (`owner_id`), filename, локализованный тип, бейдж visibility, created_at (зона пользователя), `MediaDeleteButton` с `isAdminDelete`.

- [ ] **Step 1: Написать падающий тест**

```tsx
// src/features/media/ui/media-admin-row.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { Media } from "../types";

import { MediaAdminRow } from "./media-admin-row";

// getT/getServerFmt — серверные i18n-хелперы. Стабим детерминированно.
vi.mock("@/i18n", () => ({
  getT: () =>
    Promise.resolve((key: string) => {
      const dict: Record<string, string> = {
        typeVideo: "Видео",
        typeAudio: "Аудио",
        statusPublic: "Опубликовано",
        statusPrivate: "Приватно",
        mediaOwnerLabel: "Автор",
      };
      return dict[key] ?? key;
    }),
  getServerFmt: () =>
    Promise.resolve({ dateTime: () => "01.06.2026" }),
}));

// MediaDeleteButton — client-компонент с зависимостями (toast/router). Стабим.
vi.mock("./media-delete-button", () => ({
  MediaDeleteButton: ({ id, isAdminDelete }: { id: string; isAdminDelete?: boolean }) => (
    <button data-testid="del" data-id={id} data-admin={String(!!isAdminDelete)}>
      del
    </button>
  ),
}));

const media: Media = {
  id: "m-1",
  filename: "lecture-intro.mp4",
  type: "video",
  owner_id: "owner-uuid-7",
  visibility: "public",
  created_at: "2026-06-01T10:00:00Z",
};

describe("MediaAdminRow", () => {
  it("показывает filename, владельца, тип, visibility и кнопку admin-удаления", async () => {
    render(await MediaAdminRow({ media }));

    expect(screen.getByText("lecture-intro.mp4")).toBeInTheDocument();
    expect(screen.getByText(/owner-uuid-7/)).toBeInTheDocument();
    expect(screen.getByText("Видео")).toBeInTheDocument();
    expect(screen.getByText("Опубликовано")).toBeInTheDocument();

    const btn = screen.getByTestId("del");
    expect(btn).toHaveAttribute("data-id", "m-1");
    expect(btn).toHaveAttribute("data-admin", "true");
  });

  it("приватное медиа → бейдж 'Приватно'", async () => {
    render(await MediaAdminRow({ media: { ...media, visibility: "private" } }));
    expect(screen.getByText("Приватно")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/features/media/ui/media-admin-row.test.tsx`
Expected: FAIL — `Cannot find module "./media-admin-row"`.

- [ ] **Step 3: Реализовать компонент**

```tsx
// src/features/media/ui/media-admin-row.tsx
import { getServerFmt, getT } from "@/i18n";

import type { Media } from "../types";

import { MediaDeleteButton } from "./media-delete-button";

interface Props {
  media: Media;
}

/**
 * Строка admin-списка медиа (модерация). Показывает владельца, имя файла, тип,
 * видимость и дату создания, плюс admin-удаление через переиспользуемый
 * MediaDeleteButton (isAdminDelete → admin-текст подтверждения, action
 * deleteMedia owner-or-media.delete_any). На этой странице актор всегда админ с
 * media.delete_any, листинг неприватный → кнопка показывается для каждого id.
 */
export async function MediaAdminRow({ media }: Props) {
  const [t, fmt] = await Promise.all([getT("media"), getServerFmt()]);
  const typeLabel: Record<string, string> = {
    video: t("typeVideo"),
    audio: t("typeAudio"),
  };
  const isPublic = media.visibility === "public";

  return (
    <article className="flex flex-col gap-2 rounded border border-(--color-border) p-3">
      <header className="flex items-center justify-between gap-2 text-xs text-(--color-fg-muted)">
        <span className="truncate font-semibold text-(--color-fg)" title={media.filename}>
          {media.filename}
        </span>
        {media.created_at && <span>{fmt.dateTime(media.created_at, { dateStyle: "short", timeStyle: "short" })}</span>}
      </header>
      <div className="flex flex-wrap items-center gap-2 text-xs text-(--color-fg-muted)">
        <span className="rounded bg-(--color-surface-subtle) px-2 py-0.5">
          {typeLabel[media.type] ?? media.type}
        </span>
        {media.visibility && (
          <span
            className={
              isPublic
                ? "rounded px-2 py-0.5 text-(--color-success)"
                : "rounded px-2 py-0.5 text-(--color-fg-muted)"
            }
          >
            {isPublic ? t("statusPublic") : t("statusPrivate")}
          </span>
        )}
        <span title={media.owner_id}>
          {/* owner_id — сырой UUID: backend-ask на человекочитаемое имя автора (см. спеку Ask 1). */}
          {media.owner_id ?? "—"}
        </span>
      </div>
      {media.id && (
        <div>
          <MediaDeleteButton id={media.id} isAdminDelete />
        </div>
      )}
    </article>
  );
}
```

> Примечание о тесте: метка «Автор» (`mediaOwnerLabel`) в текущей разметке не
> выводится отдельным префиксом (owner_id показан как есть). Тест ассертит
> наличие `owner-uuid-7` в документе — это устойчиво к решению, выводить ли
> префикс. Если на ревью решат добавить видимую метку «Автор: <id>» —
> добавить `{t("mediaOwnerLabel")}: ` перед `owner_id` (ключ уже заведён в Task 5).

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/media/ui/media-admin-row.test.tsx`
Expected: PASS (2 теста).

- [ ] **Step 5: Commit**

```bash
git add src/features/media/ui/media-admin-row.tsx src/features/media/ui/media-admin-row.test.tsx
git commit -m "feat(media): MediaAdminRow — строка admin-модерации медиа

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Экспорты слайса + страница `/admin/media` с Layer-3 gate

**Files:**
- Modify: `src/features/media/index.ts`
- Create: `src/app/admin/media/page.tsx`
- Modify: `src/i18n/messages/ru/admin.ts`, `src/i18n/messages/en/admin.ts` (ключи страницы — см. Task 5 для полного списка; здесь добавляем те, что нужны странице)

> Порядок: i18n-ключи страницы (`mediaTitle`/`mediaDescription`/`mediaEmpty`/`mediaTotal`/`mediaMetaTitle`) добавляем здесь (странице они нужны для `pnpm build`), а nav-ключ `nav.media` — в Task 5 вместе с самим nav-итемом. Чтобы не дублировать, ВСЕ admin-ключи перечислены целиком в Task 5 Step 1; в этой задаче добавить из них подмножество, нужное `page.tsx` (всё, кроме `nav.media`). Если удобнее — добавить сразу полный набор из Task 5 и в Task 5 только ассерт обновить.

**Interfaces:**
- Consumes: `getAdminMedia`, `canModerateMedia`, `MediaAdminRow`, `MediaAdminFilterForm` (Task 6 — на момент Task 4 ещё нет; см. ниже), `Pagination` (`@/components/ui`), `getPaginationLabels` (`@/components/ui/pagination.server`), `getT` (`@/i18n`), `getMe` (`@/utils/me`), `parseNonNegativeInt` (`@/utils/paging`), `forbidden` (`next/navigation`).
- Produces: страница `/admin/media` (default export async server-компонент) + `generateMetadata`.

> Зависимость на `MediaAdminFilterForm` (Task 6) разрешается так: в Task 4
> страница рендерит список БЕЗ фильтр-формы (фильтр читается из searchParams,
> но UI-формы пока нет — `owner_id` можно задать только вручную в URL). В Task 6
> добавляем форму и вставляем её в страницу. Это держит каждую задачу
> независимо собираемой. index.ts в Task 4 экспортирует то, что уже есть
> (`getAdminMedia`, `canModerateMedia`, `MediaAdminRow`); экспорт
> `MediaAdminFilterForm` добавляется в Task 6.

- [ ] **Step 1: Расширить экспорты слайса**

В `src/features/media/index.ts`:

```ts
export {
  getMyMedia,
  getMediaById,
  getMediaContainers,
  getAdminMedia,
} from "./api";
export type { MyMediaFilter, MyMediaResult } from "./api";

export { deleteMedia, setMediaVisibility } from "./actions";
export { uploadMedia } from "./upload-media";

export {
  canCreateMedia,
  canDeleteAnyMedia,
  canDeleteMedia,
  canChangeMediaVisibility,
  canModerateMedia,
} from "./permissions";

export { MediaGrid } from "./ui/media-grid";
export { MediaCard } from "./ui/media-card";
export { MediaUploadForm } from "./ui/media-upload-form";
export { MediaDetail } from "./ui/media-detail";
export { MediaPlayer } from "./ui/media-player";
export { MediaAdminRow } from "./ui/media-admin-row";

export type { Media, MediaSummary, FileType, Visibility, MediaAttachment } from "./types";
```

- [ ] **Step 2: Добавить admin-i18n-ключи (ru), нужные странице**

В `src/i18n/messages/ru/admin.ts`. В блок `nav` (после `annotations`):

```ts
    annotations: "Аннотации",
    media: "Медиа",
    users: "Пользователи",
```

И секцию строк страницы (после блока «--- аннотации ---»):

```ts
  // --- медиа (модерация) ---
  mediaTitle: "Модерация медиа",
  mediaDescription: "Неприватные медиа всех пользователей. Удаление необратимо.",
  mediaEmpty: "Ничего не найдено.",
  mediaTotal: "Всего: {total}",
  mediaOwnerLabel: "Автор",
  mediaFilterOwnerLabel: "ID автора",
  mediaFilterApply: "Показать",
  mediaFilterClear: "Сбросить",
```

И в блок «SEO-мета»:

```ts
  mediaMetaTitle: "Медиа — модерация",
```

- [ ] **Step 3: Добавить те же admin-i18n-ключи (en)**

В `src/i18n/messages/en/admin.ts`. В блок `nav` (после `annotations`):

```ts
    annotations: "Annotations",
    media: "Media",
    users: "Users",
```

Секция строк (после «--- аннотации ---»):

```ts
  // --- media (moderation) ---
  mediaTitle: "Media moderation",
  mediaDescription: "Non-private media from all users. Deletion is irreversible.",
  mediaEmpty: "Nothing found.",
  mediaTotal: "Total: {total}",
  mediaOwnerLabel: "Author",
  mediaFilterOwnerLabel: "Author ID",
  mediaFilterApply: "Show",
  mediaFilterClear: "Reset",
```

Блок «SEO meta»:

```ts
  mediaMetaTitle: "Media — moderation",
```

- [ ] **Step 4: Реализовать страницу (без фильтр-формы — добавится в Task 6)**

```tsx
// src/app/admin/media/page.tsx
import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { Pagination } from "@/components/ui";
import { getPaginationLabels } from "@/components/ui/pagination.server";
import { getAdminMedia, canModerateMedia, MediaAdminRow } from "@/features/media";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("mediaMetaTitle") };
}

interface Props {
  searchParams: Promise<{
    owner_id?: string;
    offset?: string;
  }>;
}

const LIMIT = 20;

export default async function AdminMediaPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canModerateMedia(me)) forbidden();

  const sp = await searchParams;
  const offset = parseNonNegativeInt(sp.offset, 0);
  const { items, total } = await getAdminMedia({
    offset,
    limit: LIMIT,
    ...(sp.owner_id ? { owner_id: sp.owner_id } : {}),
  });

  const t = await getT("admin");
  const paginationLabels = await getPaginationLabels();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("mediaTitle")}</h1>
      <p className="text-sm text-(--color-fg-muted)">{t("mediaDescription")}</p>
      <p className="text-sm text-(--color-fg-muted)">{t("mediaTotal", { total })}</p>
      {items.length === 0 ? (
        <p className="text-sm text-(--color-fg-muted)">{t("mediaEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((m) => (
            <li key={m.id}>
              <MediaAdminRow media={m} />
            </li>
          ))}
        </ul>
      )}
      <Pagination
        basePath="/admin/media"
        offset={offset}
        limit={LIMIT}
        total={total}
        searchParams={sp}
        labels={paginationLabels}
      />
    </section>
  );
}
```

- [ ] **Step 5: Проверить сборку и тесты i18n**

Run: `pnpm exec vitest run src/i18n`
Expected: PASS (ключ-parity ru↔en для новых admin-ключей не ломает ICU-parity тест, если он есть).

Run: `pnpm build`
Expected: успешная сборка — `getT("admin")` видит новые ключи в обоих языках (`satisfies Messages` зелёный), Layer-3 gate типобезопасен, пропсы `Pagination`/`MediaAdminRow` сходятся.

- [ ] **Step 6: Commit**

```bash
git add src/features/media/index.ts src/app/admin/media/page.tsx
# admin-сообщения — hot-файлы (параллельные агенты): коммитим ТОЛЬКО свои ключи через --only
git add src/i18n/messages/ru/admin.ts src/i18n/messages/en/admin.ts
git commit --only src/features/media/index.ts src/app/admin/media/page.tsx src/i18n/messages/ru/admin.ts src/i18n/messages/en/admin.ts -m "feat(admin): страница /admin/media с Layer-3 gate + i18n

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> Перед коммитом `admin.ts` — `git status`: если файл уже изменён другим
> агентом, `--only` зафиксирует чужое содержимое. Свериться, что diff содержит
> только media-ключи; иначе скоординировать.

---

### Task 5: Nav-итем `/admin/media` (admin-shell-смежное касание)

**Files:**
- Modify: `src/app/admin/admin-access.ts`
- Test: `src/app/admin/admin-access.test.ts` (обновить ассерт)

**Interfaces:**
- Consumes: `can` (`@/utils/permissions`), `MaybeMe` (`@/utils/me`).
- Produces: `buildNavItems` дополнительно пушит `{ href: "/admin/media", labelKey: "nav.media" }` когда `can(me, "media.delete_any")`. Позиция — после `annotations`, перед `users`.

> ⚠️ **Admin-shell-флаг.** `admin-sidebar.tsx` — frozen-зона. Мы НЕ трогаем
> сайдбар; меняем только `buildNavItems` — намеренную capability-точку
> расширения нав-итемов (сайдбар рендерит результат, резолвя `labelKey` в
> namespace `admin`). Ключ `nav.media` уже добавлен в Task 4 (оба языка).
> `media.delete_any` ∉ RoleUser → инвариант «нав-cap ∩ RoleUser = ∅»
> (`admin-access.test.ts:80-96`) остаётся зелёным.

- [ ] **Step 1: Обновить тест-ассерт (падающий)**

В `src/app/admin/admin-access.test.ts` в тесте «админ → полный набор пунктов»
(`admin-access.test.ts:59-77`) добавить `"/admin/media"` в ожидаемый массив
после `"/admin/annotations"`:

```ts
    expect(hrefs).toEqual([
      "/admin/lectures",
      "/admin/glossary",
      "/admin/tags",
      "/admin/events",
      "/admin/banners",
      "/admin/documents",
      "/admin/forms",
      "/admin/trails",
      "/admin/share-links",
      "/admin/comments",
      "/admin/annotations",
      "/admin/media",
      "/admin/users",
      "/admin/push",
      "/admin/audit",
    ]);
```

(`admin` фикстура уже содержит `media.delete_any` — `admin-access.test.ts:14`.)

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/app/admin/admin-access.test.ts`
Expected: FAIL — фактический список hrefs не содержит `/admin/media` (`expected [...] to deeply equal [...]`).

- [ ] **Step 3: Реализовать nav-итем**

В `src/app/admin/admin-access.ts` после annotations-ветки (`admin-access.ts:54-56`):

```ts
  if (can(me, "annotation.delete_any")) {
    items.push({ href: "/admin/annotations", labelKey: "nav.annotations" });
  }
  if (can(me, "media.delete_any")) {
    items.push({ href: "/admin/media", labelKey: "nav.media" });
  }
  if (can(me, "user.list")) {
    items.push({ href: "/admin/users", labelKey: "nav.users" });
  }
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/app/admin/admin-access.test.ts`
Expected: PASS (включая инвариант «нав-cap ∩ RoleUser = ∅» — `media.delete_any` не в RoleUser).

- [ ] **Step 5: Commit**

```bash
# admin-access.ts — координируемая зона; коммитим ТОЛЬКО свои файлы
git add src/app/admin/admin-access.ts src/app/admin/admin-access.test.ts
git commit --only src/app/admin/admin-access.ts src/app/admin/admin-access.test.ts -m "feat(admin): nav-итем /admin/media (гейт media.delete_any)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> Перед коммитом — `git status` на `admin-access.ts`: если файл уже тронут
> другим агентом, `--only` подхватит чужое; свериться, что diff — только
> media-ветка.

---

### Task 6: Фильтр по автору (`MediaAdminFilterForm`) + вставка в страницу

**Files:**
- Create: `src/features/media/ui/media-admin-filter-form.tsx`
- Modify: `src/features/media/index.ts` (экспорт формы)
- Modify: `src/app/admin/media/page.tsx` (рендер формы)

**Interfaces:**
- Consumes: `usePathname`/`useRouter`/`useSearchParams` (`next/navigation`), `TextInput`/`Button`/`Label` (`@/components/ui`), `useT` (`@/i18n/client`).
- Produces: `MediaAdminFilterForm()` (client) — поле `owner_id` + «Показать»/«Сбросить»; on-submit пишет/чистит `owner_id` в URL и сбрасывает `offset` через `router.replace`.

> Фильтр — текстовый (а не Select), т.к. автор — UUID без конечного списка
> значений (зеркало `AnnotationAdminFilterForm` по механике URL, но input
> вместо select). Backend-ask Ask 1 (имя автора) расширит это до поиска по
> username, когда бэк отдаст имя.

- [ ] **Step 1: Написать падающий тест**

```tsx
// src/features/media/ui/media-admin-filter-form.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/admin/media",
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/i18n/client", () => ({
  useT: () => (key: string) => key,
}));

import { MediaAdminFilterForm } from "./media-admin-filter-form";

beforeEach(() => replace.mockClear());

describe("MediaAdminFilterForm", () => {
  it("submit с непустым owner_id → router.replace c ?owner_id и без offset", () => {
    render(<MediaAdminFilterForm />);
    const input = screen.getByLabelText("mediaFilterOwnerLabel");
    fireEvent.change(input, { target: { value: "u-42" } });
    fireEvent.click(screen.getByText("mediaFilterApply"));

    expect(replace).toHaveBeenCalledWith("/admin/media?owner_id=u-42");
  });

  it("сброс → router.replace на чистый путь (без query)", () => {
    render(<MediaAdminFilterForm />);
    fireEvent.click(screen.getByText("mediaFilterClear"));

    expect(replace).toHaveBeenCalledWith("/admin/media");
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/features/media/ui/media-admin-filter-form.test.tsx`
Expected: FAIL — `Cannot find module "./media-admin-filter-form"`.

- [ ] **Step 3: Реализовать форму**

```tsx
"use client";
// src/features/media/ui/media-admin-filter-form.tsx
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button, Label, TextInput } from "@/components/ui";
import { useT } from "@/i18n/client";

/**
 * URL-фильтр admin-списка медиа по автору (owner_id). Зеркало
 * AnnotationAdminFilterForm по механике (router.replace, сброс offset), но
 * текстовый ввод: автор — UUID без конечного списка. Backend-ask Ask 1 расширит
 * до поиска по имени, когда бек отдаст username.
 */
export function MediaAdminFilterForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useT("admin");
  const [value, setValue] = useState(searchParams.get("owner_id") ?? "");

  function apply(ownerId: string) {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = ownerId.trim();
    if (trimmed) params.set("owner_id", trimmed);
    else params.delete("owner_id");
    params.delete("offset");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    apply(value);
  }

  function onClear() {
    setValue("");
    apply("");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2 text-sm">
      <div className="flex flex-col gap-1">
        <Label htmlFor="media-owner-filter">{t("mediaFilterOwnerLabel")}</Label>
        <TextInput
          id="media-owner-filter"
          aria-label={t("mediaFilterOwnerLabel")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Button type="submit">{t("mediaFilterApply")}</Button>
      <Button type="button" tone="neutral" onClick={onClear}>
        {t("mediaFilterClear")}
      </Button>
    </form>
  );
}
```

> Сверь props `TextInput`/`Button`/`Label` с `src/components/ui` на этапе
> реализации: `Label` принимает `htmlFor`, `TextInput` — `id`/`value`/`onChange`/
> `aria-label`, `Button` — `type`/`tone`/`onClick`. Если имя пропа `tone` для
> «нейтрального» отличается (`default`/`neutral`) — взять из `ButtonTone`
> (`button.tsx`). Тест мокает только `next/navigation` и `useT`, поэтому он
> устойчив к точному варианту `tone`; на расхождении пропа упадёт `pnpm build`,
> а не тест — поправить по сигнатуре kit.

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/media/ui/media-admin-filter-form.test.tsx`
Expected: PASS (2 теста).

- [ ] **Step 5: Экспорт + вставка в страницу**

В `src/features/media/index.ts` добавить рядом с `MediaAdminRow`:

```ts
export { MediaAdminRow } from "./ui/media-admin-row";
export { MediaAdminFilterForm } from "./ui/media-admin-filter-form";
```

В `src/app/admin/media/page.tsx` — расширить импорт и вставить форму между
описанием и списком:

```tsx
import { getAdminMedia, canModerateMedia, MediaAdminRow, MediaAdminFilterForm } from "@/features/media";
```

```tsx
      <p className="text-sm text-(--color-fg-muted)">{t("mediaDescription")}</p>
      <MediaAdminFilterForm />
      <p className="text-sm text-(--color-fg-muted)">{t("mediaTotal", { total })}</p>
```

- [ ] **Step 6: Проверить сборку**

Run: `pnpm exec vitest run src/features/media`
Expected: PASS (api + permissions + row + filter-form).

Run: `pnpm build`
Expected: успешно — `MediaAdminFilterForm` (client) корректно импортируется в server-страницу через `index.ts` (компонент `"use client"`; client-leaf в server-tree допустим, server-only утечки нет — форма не тянет `./api`/`./actions`).

- [ ] **Step 7: Commit**

```bash
git add src/features/media/ui/media-admin-filter-form.tsx src/features/media/ui/media-admin-filter-form.test.tsx src/features/media/index.ts src/app/admin/media/page.tsx
git commit -m "feat(admin): фильтр /admin/media по автору (owner_id)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Финальная верификация

**Files:**
- Modify: по факту падений (тест-ассерты, если что-то всплыло).

**Interfaces:**
- Consumes: всё выше.
- Produces: зелёные `pnpm lint && pnpm test && pnpm build`.

- [ ] **Step 1: Полный прогон**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное. Возможные точки внимания:
- ESLint feature-гарды: `media-admin-filter-form.tsx` — `"use client"`, не импортирует `./api`/`./actions` (только UI-kit + navigation + i18n/client) → guard «react-dom/client / server-only в client-слайсе» не срабатывает.
- `MediaDeleteButton` уже `"use client"` и уже в слайсе → переиспользование без изменений.
- i18n parity ru↔en по новым ключам admin/media.

- [ ] **Step 2: Починить всплывшее (если есть)**

Для каждого падения — минимальная правка по корню (сигнатура пропа kit,
имя ключа i18n, позиция href в ассерте). Date-форматирование в `MediaAdminRow`
идёт через `getServerFmt` (зона пользователя) — если какой-то снапшот-тест
ассертит конкретную строку даты, это не наш файл (наш тест мокает `getServerFmt`).

- [ ] **Step 3: Финальный commit (если были правки)**

```bash
git add <перечислить реально изменённые файлы по имени>
git commit -m "test(admin): добор-фиксы верификации /admin/media

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (каждое требование спеки → задача):**
- `canModerateMedia` (permission, зеркало `canModerateAnnotations`) → Task 1. ✔
- `getAdminMedia(filter)` (server-only, GET `/api/admin/media`, `unwrapList`, `MyMediaResult`) → Task 2. ✔
- `MediaAdminRow` (async server, owner/filename/type/visibility/created_at + `MediaDeleteButton` с `isAdminDelete` → `deleteMedia`) → Task 3. ✔
- Переиспользование `deleteMedia` (нет admin-DELETE-ручки) → Task 3 (через `MediaDeleteButton`), факт зафиксирован в Global Constraints. ✔
- `index.ts` экспорты (`getAdminMedia`, `canModerateMedia`, `MediaAdminRow`, `MediaAdminFilterForm`) → Tasks 4, 6. ✔
- Страница `/admin/media` + Layer-3 gate (`getMe`+`canModerateMedia`+`forbidden`), offset/owner_id парсинг, `Pagination` с пробросом searchParams, empty-state → Task 4. ✔
- Nav-итем (admin-shell-флаг, capability-точка) → Task 5. ✔
- i18n ru+en (`nav.media`, `mediaTitle`, `mediaTotal`, `mediaEmpty`, `mediaDescription`, row/filter-метки, `mediaMetaTitle`, `media.api.loadAdminFailed`) → Tasks 2, 4. ✔
- Фильтр по `owner_id` (client-форма) → Task 6. ✔
- Backend-asks (UUID-автор, полнота полей, лимит/сортировка) → спека §FE/BE-split; на FE отражены graceful-обработкой в Task 3 (owner_id/visibility опциональны → дефис/скрытие). ✔

**2. Placeholder scan:** все шаги содержат реальный код (тесты + реализацию).
Единственные «решения по факту» — сверка пропов UI-kit (`Button.tone`,
`TextInput`/`Label`) в Task 6 Step 3 (явная инструкция брать из `button.tsx`/
`@/components/ui`, тест устойчив) и опциональная метка «Автор» в Task 3
(ключ заведён, тест ассертит сам UUID). Нет «TBD»/«similar to Task N» — код повторён. ✔

**3. Type consistency (имена/сигнатуры сквозь задачи):**
- `canModerateMedia(me: MaybeMe): boolean` — Task 1, потреблён Tasks 4 (page), 5 (nav). ✔
- `getAdminMedia(filter?: { owner_id?; offset?; limit? }): Promise<MyMediaResult>` — Task 2, потреблён Task 4. `MyMediaResult` — существующий (`{ items: Media[]; total; offset; limit }`). ✔
- `MediaAdminRow({ media: Media })` — Task 3, потреблён Task 4. ✔
- `MediaAdminFilterForm()` (client) — Task 6, потреблён Task 4/6 (вставка). ✔
- `MediaDeleteButton({ id: string; isAdminDelete?: boolean })` — существующий, потреблён Task 3 как `<MediaDeleteButton id={media.id} isAdminDelete />`. ✔
- i18n-ключи: `nav.media`, `mediaTitle`, `mediaDescription`, `mediaEmpty`, `mediaTotal`, `mediaOwnerLabel`, `mediaFilterOwnerLabel`, `mediaFilterApply`, `mediaFilterClear`, `mediaMetaTitle` (namespace `admin`), `api.loadAdminFailed` (namespace `media`) — согласованы ru↔en, заведены до первого использования (Task 2 для media-ключа, Task 4 для admin-ключей, до Task 5/6, где они потребляются). ✔

**4. Параллельная безопасность:** hot-файлы `admin.ts` (Task 4) и
`admin-access.ts` (Task 5) коммитятся через `git commit --only <свои файлы>`
с предварительным `git status`. `index.ts` слайса — наш, не hot. ✔

**Зависимость от бэка:** ручка `GET /api/admin/media` и тип `media.Media` уже в
`src/api/schema.ts` (`:2836-2903`, `:16165-16173`) — реген НЕ требуется.
Backend-asks (имя автора вместо UUID; подтверждение `owner_id`/`visibility` в
ответе; max-limit/сортировка) — для пользователя, не блокируют реализацию.
