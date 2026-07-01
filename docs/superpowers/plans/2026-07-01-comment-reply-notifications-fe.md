# Comment-Reply Notifications (FE) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать фронту два новых capability бэка — глобальный тумблер уведомлений об ответах на комментарии (`notify_on_comment_reply`) и рендер уведомления `comment.replied` в инбоксе со ссылкой на сам ответ.

**Architecture:** Часть A — instant-toggle на kit `Checkbox` в секции «Подписки» настроек, патчит существующий `PATCH /api/me/preferences` (partial-patch, экшен в слайсе `preferences`). Часть B — сервер обогащает каждое `comment.replied`-уведомление хост-лекцией через `GET /api/comments/{id}` (обязательное `lecture_id`), затем чистый дескриптор строит deep-link `/lectures/{lectureId}#comment-{replyId}` поверх существующего SSR-контракта `id=comment-<id>`.

**Tech Stack:** Next.js App Router (server components + server actions), openapi-fetch typed client (`@/api/client`), Zod, Vitest + Testing Library, next-intl за фасадом `@/i18n`.

## Global Constraints

- Общаться в комментариях/копирайтинге на русском; UI-строки — только через `@/i18n` (Guardrail 5/6), НЕ литералы. Ключ добавляется во ВСЕ локали `ru/en/ar/zh` в одном коммите (guard-тест паритета каталогов).
- Именование файлов в `src/` — kebab-case.
- Запретные зоны НЕ трогаем: `src/api/schema.ts` (уже перегенерирован координированно — только читаем), `src/components/ui/*`, `src/app/layout.tsx`, инфраструктура. `src/app/me/settings/page.tsx` — обычная страница фичи, править можно.
- Каждый агент/субагент: НЕ `git add -A`/`git add .` — добавлять только свои файлы по имени; НЕ `git stash`/`reset`/`checkout .`/`clean`. Передать это требование всем субагентам.
- RBAC: в server actions — `requireCapability(me, canUpdatePreferences)`; в UI — boolean-проп `canManage` из server component.
- Партиал-патч `/api/me/preferences` — штатный паттерн (appearance/locale/reading_mode патчатся независимо). Слать ТОЛЬКО `notify_on_comment_reply`.
- Перед завершением ветки зелёные: `pnpm lint && pnpm test && pnpm build`.
- Модель субагентов — Opus (не haiku), включая механику.

---

## File Structure

**Часть A (preferences slice):**
- Modify `src/features/preferences/actions.ts` — новый экшен `setNotifyOnCommentReply`.
- Create `src/features/preferences/notify-comment-reply.test.ts` — тест экшена.
- Create `src/features/preferences/ui/comment-reply-notify-toggle.tsx` — instant-toggle.
- Create `src/features/preferences/ui/comment-reply-notify-toggle.test.tsx` — тест компонента.
- Modify `src/features/preferences/index.ts` — экспорт компонента.
- Modify `src/i18n/messages/{ru,en,ar,zh}/preferences.ts` — 3 ключа.
- Modify `src/app/me/settings/page.tsx` — рендер тумблера в секции «Подписки».

**Часть B (notifications slice):**
- Modify `src/features/notifications/types.ts` — поле `commentLectureId`.
- Modify `src/features/notifications/api.ts` — хелпер `getCommentLectureId` + обогащение в `getNotifications`.
- Modify `src/features/notifications/api.test.ts` — тесты обогащения.
- Modify `src/features/notifications/notification-content.ts` — дескриптор `commentReplied`.
- Modify `src/features/notifications/notification-content.test.ts` — тесты дескриптора.
- Modify `src/features/notifications/ui/notification-item.tsx` — ветка рендера.
- Modify `src/i18n/messages/{ru,en,ar,zh}/notifications.ts` — ключ `commentReplied`.

---

## Task 1: Preferences action `setNotifyOnCommentReply`

Серверный экшен, патчащий `notify_on_comment_reply`. Клиентский островок зовёт его с типизированным boolean; на runtime-границе валидируем через `z.boolean()` (паттерн `setHistoryTracking`).

**Files:**
- Modify: `src/features/preferences/actions.ts`
- Test: `src/features/preferences/notify-comment-reply.test.ts` (create)

**Interfaces:**
- Consumes: `createApiClient`, `getMe`, `requireCapability`, `canUpdatePreferences`, `rethrowApiError`, `revalidateEntity`, `Tags.PREFERENCES` (все уже импортированы в actions.ts, кроме `z`).
- Produces: `setNotifyOnCommentReply(next: boolean) => Promise<ActionResult<void>>` — server action; Task 2 (тумблер) зовёт его и читает `result.success`.

- [ ] **Step 1: Write the failing test**

Create `src/features/preferences/notify-comment-reply.test.ts`:

```ts
/**
 * Тесты setNotifyOnCommentReply (preferences/actions.ts).
 * Патчит /api/me/preferences ТОЛЬКО полем notify_on_comment_reply (partial-patch).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as revalidateModule from "@/utils/revalidate";

const patch = vi.fn();
vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ PATCH: patch }),
}));

const getMeImpl = vi.fn();
vi.mock("@/utils/me", () => ({ getMe: () => getMeImpl() as unknown }));

vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

// Импорт ПОСЛЕ vi.mock (hoisting)
import { setNotifyOnCommentReply } from "./actions";

function activeMe() {
  return {
    id: "u-1",
    username: "active",
    role: "user" as const,
    status: "active" as const,
    capabilities: [] as string[],
  };
}

function revalidateSpy() {
  return vi.mocked(revalidateModule.revalidateEntity);
}

beforeEach(() => {
  patch.mockReset();
  getMeImpl.mockReset();
  revalidateSpy().mockReset();
  getMeImpl.mockResolvedValue(activeMe());
  patch.mockResolvedValue({ data: { data: {} }, error: undefined });
});

describe("setNotifyOnCommentReply — happy path", () => {
  it("PATCHes /api/me/preferences с { notify_on_comment_reply: true }", async () => {
    const result = await setNotifyOnCommentReply(true);

    expect(result).toMatchObject({ success: true });
    expect(patch).toHaveBeenCalledOnce();
    const [path, opts] = patch.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/me/preferences");
    expect(opts.body).toEqual({ notify_on_comment_reply: true });
    expect(revalidateSpy()).toHaveBeenCalledOnce();
  });

  it("передаёт false без примеси других полей (partial-patch)", async () => {
    await setNotifyOnCommentReply(false);
    const [, opts] = patch.mock.calls[0] as [string, Record<string, unknown>];
    expect(opts.body).toEqual({ notify_on_comment_reply: false });
  });
});

describe("setNotifyOnCommentReply — backend error mapping", () => {
  it("маппит ошибку бэка в { success: false } и НЕ ревалидирует", async () => {
    patch.mockResolvedValue({
      data: undefined,
      error: { code: "SUSPENDED", error: "suspended" },
    });
    const result = await setNotifyOnCommentReply(true);
    expect(result).toMatchObject({ success: false });
    expect(revalidateSpy()).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/features/preferences/notify-comment-reply.test.ts`
Expected: FAIL — `setNotifyOnCommentReply` is not exported from `./actions`.

- [ ] **Step 3: Add the action**

In `src/features/preferences/actions.ts` add `import { z } from "zod";` at the top of the import block (после `"server-only"`), and append the action after `unsubscribePush`/existing actions:

```ts
/**
 * Глобальный тумблер уведомлений об ответах на комментарии
 * (preference.notify_on_comment_reply, default true на бэке). Partial-patch —
 * шлём ТОЛЬКО это поле. Зовётся из comment-reply-notify-toggle (клиент) с
 * типизированным boolean; z.boolean() валидирует runtime-границу.
 */
export const setNotifyOnCommentReply = createAction(async (raw: unknown) => {
  const me = await getMe();
  requireCapability(me, canUpdatePreferences);
  const enabled = z.boolean().parse(raw);
  const api = await createApiClient();
  const { error } = await api.PATCH("/api/me/preferences", {
    body: { notify_on_comment_reply: enabled },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.PREFERENCES);
  return undefined;
}, "setNotifyOnCommentReply");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/features/preferences/notify-comment-reply.test.ts`
Expected: PASS (5 assertions across 3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/preferences/actions.ts src/features/preferences/notify-comment-reply.test.ts
git commit -m "feat(preferences): экшен setNotifyOnCommentReply (partial-patch notify_on_comment_reply)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Toggle component `CommentReplyNotifyToggle` + i18n

Клиентский instant-toggle на kit `Checkbox`. Оптимистичный флип, тост на ошибку, `router.refresh()` на успех. Паттерн `HistoryTrackingToggle`, но БЕЗ confirm-диалога (недеструктивно).

**Files:**
- Create: `src/features/preferences/ui/comment-reply-notify-toggle.tsx`
- Test: `src/features/preferences/ui/comment-reply-notify-toggle.test.tsx` (create)
- Modify: `src/features/preferences/index.ts`
- Modify: `src/i18n/messages/ru/preferences.ts`, `.../en/preferences.ts`, `.../ar/preferences.ts`, `.../zh/preferences.ts`

**Interfaces:**
- Consumes: `setNotifyOnCommentReply` (Task 1); kit `Checkbox`, `useToast`; `useT`, `toastActionError`.
- Produces: `CommentReplyNotifyToggle({ initialEnabled: boolean, canManage: boolean })` — экспортируется из `@/features/preferences`; Task 3 рендерит его.

- [ ] **Step 1: Add i18n keys (all four locales)**

In `src/i18n/messages/ru/preferences.ts`, add inside the object (после блока `--- preferences-form ---`, перед `--- push-send-form ---`):

```ts
  // --- comment-reply-notify-toggle ---
  commentReplyNotifyLabel: "Уведомлять об ответах на мои комментарии",
  commentReplyNotifyDescription:
    "Когда кто-то отвечает на ваш комментарий, вы получаете уведомление.",
  commentReplyNotifySaved: "Настройка сохранена.",
```

In `src/i18n/messages/en/preferences.ts` (same location):

```ts
  // --- comment-reply-notify-toggle ---
  commentReplyNotifyLabel: "Notify me about replies to my comments",
  commentReplyNotifyDescription:
    "You get a notification when someone replies to your comment.",
  commentReplyNotifySaved: "Setting saved.",
```

In `src/i18n/messages/ar/preferences.ts` (same location):

```ts
  // --- comment-reply-notify-toggle ---
  commentReplyNotifyLabel: "أبلغني بالردود على تعليقاتي",
  commentReplyNotifyDescription:
    "تصلك إشعارات عندما يرد أحدهم على تعليقك.",
  commentReplyNotifySaved: "تم حفظ الإعداد.",
```

In `src/i18n/messages/zh/preferences.ts` (same location):

```ts
  // --- comment-reply-notify-toggle ---
  commentReplyNotifyLabel: "当有人回复我的评论时通知我",
  commentReplyNotifyDescription: "有人回复您的评论时，您会收到通知。",
  commentReplyNotifySaved: "设置已保存。",
```

- [ ] **Step 2: Write the failing component test**

Create `src/features/preferences/ui/comment-reply-notify-toggle.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { ToastProvider } from "@/components/ui";

import { CommentReplyNotifyToggle } from "./comment-reply-notify-toggle";

const { refreshMock, setMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  setMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("../actions", () => ({
  setNotifyOnCommentReply: setMock,
}));

vi.mock("@/i18n/client", async () => {
  const { default: preferences } = await import("@/i18n/messages/ru/preferences");
  const { default: errors } = await import("@/i18n/messages/ru/errors");
  return {
    useT: (ns: string) => {
      const catalog = ns === "preferences" ? preferences : ns === "errors" ? errors : {};
      return (key: string, params?: Record<string, unknown>) => {
        const parts = key.split(".");
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = catalog;
        for (const part of parts) val = val?.[part];
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        if (typeof val !== "string") return key;
        if (params) {
          return val.replace(/\{(\w+)\}/g, (_: string, k: string) => {
            const v = params[k];
            return typeof v === "string" || typeof v === "number" ? String(v) : `{${k}}`;
          });
        }
        return val;
      };
    },
  };
});

function renderToggle(props: { initialEnabled: boolean; canManage: boolean }) {
  return render(
    <ToastProvider>
      <CommentReplyNotifyToggle {...props} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  refreshMock.mockReset();
  setMock.mockReset();
  setMock.mockResolvedValue({ success: true });
});

afterEach(cleanup);

describe("CommentReplyNotifyToggle", () => {
  it("оптимистично флипает и зовёт экшен с новым значением", async () => {
    renderToggle({ initialEnabled: true, canManage: true });
    const box = screen.getByRole("checkbox");
    expect(box).toBeChecked();

    fireEvent.click(box);

    await waitFor(() => expect(setMock).toHaveBeenCalledWith(false));
    expect(box).not.toBeChecked();
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("откатывает состояние при ошибке экшена", async () => {
    setMock.mockResolvedValue({ success: false, code: "SUSPENDED" });
    renderToggle({ initialEnabled: false, canManage: true });
    const box = screen.getByRole("checkbox");

    fireEvent.click(box);

    await waitFor(() => expect(setMock).toHaveBeenCalledWith(true));
    // откат: значение вернулось к исходному false
    await waitFor(() => expect(box).not.toBeChecked());
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("disabled, когда canManage=false", () => {
    renderToggle({ initialEnabled: true, canManage: false });
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test src/features/preferences/ui/comment-reply-notify-toggle.test.tsx`
Expected: FAIL — module `./comment-reply-notify-toggle` not found.

- [ ] **Step 4: Implement the component**

Create `src/features/preferences/ui/comment-reply-notify-toggle.tsx`:

```tsx
"use client";
// src/features/preferences/ui/comment-reply-notify-toggle.tsx
// Instant-toggle глобального уведомления об ответах на комментарии
// (preference.notify_on_comment_reply). Оптимистичный флип + откат при ошибке;
// на успехе router.refresh() перечитывает getPreferences на странице. Паттерн —
// HistoryTrackingToggle, но недеструктивно (без ConfirmDialog).
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Checkbox, Label, Stack, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { setNotifyOnCommentReply } from "../actions";

interface Props {
  initialEnabled: boolean;
  /** canUpdatePreferences(me) со страницы (server component). */
  canManage: boolean;
}

export function CommentReplyNotifyToggle({ initialEnabled, canManage }: Props) {
  const router = useRouter();
  const toast = useToast();
  const t = useT("preferences");
  const tErrors = useT("errors");
  const id = useId();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);

  async function apply(next: boolean) {
    setPending(true);
    setEnabled(next); // оптимистично
    try {
      const result = await setNotifyOnCommentReply(next);
      if (!result.success) {
        setEnabled(!next); // откат
        toastActionError(toast, tErrors, result, { action: t("updateSettingsAction") });
        return;
      }
      toast.add({ title: t("commentReplyNotifySaved") });
      router.refresh();
    } catch {
      setEnabled(!next); // откат при сетевом сбое
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack>
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={enabled}
          disabled={pending || !canManage}
          onCheckedChange={(next) => {
            void apply(next);
          }}
        />
        <Label htmlFor={id}>{t("commentReplyNotifyLabel")}</Label>
      </div>
      <p className="text-sm text-(--color-fg-muted)">
        {t("commentReplyNotifyDescription")}
      </p>
    </Stack>
  );
}
```

> NB: если kit `Label`/`Stack` не экспортируются или `Label` не принимает `htmlFor` — свериться с `src/components/ui/index.ts` и заменить на доступную обёртку (`<label htmlFor>` внутри `<Field>` запрещён Guardrail 7; использовать kit `Label`). На момент плана `Label`, `Stack`, `Checkbox` экспортируются из `@/components/ui`.

- [ ] **Step 5: Run component test to verify it passes**

Run: `pnpm test src/features/preferences/ui/comment-reply-notify-toggle.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Export from feature barrel**

In `src/features/preferences/index.ts`, add to the UI-exports block:

```ts
export { CommentReplyNotifyToggle } from "./ui/comment-reply-notify-toggle";
```

- [ ] **Step 7: Verify i18n parity + lint**

Run: `pnpm test src/i18n && pnpm lint src/features/preferences`
Expected: PASS — каталог-паритет зелёный (ключ есть во всех 4 локалях), lint чистый.

- [ ] **Step 8: Commit**

```bash
git add src/features/preferences/ui/comment-reply-notify-toggle.tsx src/features/preferences/ui/comment-reply-notify-toggle.test.tsx src/features/preferences/index.ts src/i18n/messages/ru/preferences.ts src/i18n/messages/en/preferences.ts src/i18n/messages/ar/preferences.ts src/i18n/messages/zh/preferences.ts
git commit -m "feat(preferences): тумблер уведомлений об ответах на комменты + i18n

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Wire toggle into settings page

Рендер тумблера в секции «Подписки» настроек, начальное значение из `getPreferences()` (дефолт бэка `true`).

**Files:**
- Modify: `src/app/me/settings/page.tsx`

**Interfaces:**
- Consumes: `CommentReplyNotifyToggle` (Task 2), `getPreferences` + `canUpdatePreferences` (уже экспортируются из `@/features/preferences`), `me` из `requireUserOrRedirect`.
- Produces: (нет — терминальная интеграция; проверяется build + browser-QA).

- [ ] **Step 1: Import the toggle and permission helper**

In `src/app/me/settings/page.tsx`, extend the existing `@/features/preferences` import to add `CommentReplyNotifyToggle` and `canUpdatePreferences`:

```ts
import {
  CommentReplyNotifyToggle,
  PreferencesForm,
  PushSubscriptionToggle,
  canSubscribePush,
  canUpdatePreferences,
  getPreferences,
  getVapidKey,
  type ReadingMode,
} from "@/features/preferences";
```

- [ ] **Step 2: Render the toggle in the subscriptions section**

In the same file, inside the `sectionSubscriptions` `<section>`, render the toggle above `<SubscriptionsSection />`:

```tsx
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("sectionSubscriptions")}</h2>
        <CommentReplyNotifyToggle
          initialEnabled={prefs.notify_on_comment_reply ?? true}
          canManage={canUpdatePreferences(me)}
        />
        <SubscriptionsSection />
      </section>
```

> `prefs` уже получен через `getPreferences()` в существующем `Promise.all`. `notify_on_comment_reply` типизирован `boolean | undefined` в `preference.Preferences` (schema.ts), `?? true` = дефолт бэка.

- [ ] **Step 3: Typecheck + build the page**

Run: `pnpm build`
Expected: сборка проходит; страница `/me/settings` компилируется без type-ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/app/me/settings/page.tsx
git commit -m "feat(settings): тумблер уведомлений об ответах в секции «Подписки»

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `AppNotification.commentLectureId` + api enrichment

Сервер резолвит хост-лекцию для `comment.replied`-уведомлений через `GET /api/comments/{id}` (обязательное `lecture_id`), кладёт в новое поле. Мягкая деградация → `null` (карточка без ссылки).

**Files:**
- Modify: `src/features/notifications/types.ts`
- Modify: `src/features/notifications/api.ts`
- Test: `src/features/notifications/api.test.ts`

**Interfaces:**
- Consumes: `createApiClient` (уже импортирован в api.ts).
- Produces: `AppNotification.commentLectureId: string | null`; функция `getNotifications` теперь возвращает элементы с заполненным `commentLectureId` для `comment.replied`. Task 5 читает это поле в `describeNotification`.

- [ ] **Step 1: Add the field to the model**

In `src/features/notifications/types.ts`, add to `interface AppNotification` (после `createdAt`):

```ts
  /**
   * Резолвнутая хост-лекция для comment.replied (target=comment). Комментарий
   * не имеет своей страницы — живёт в /lectures/{id}; поле нужно для deep-link.
   * null — не comment-таргет ИЛИ резолв не удался (мягкая деградация). Бэк-ask:
   * положить lecture_id прямо в payload уведомления, тогда N+1 GET уйдёт.
   */
  commentLectureId: string | null;
```

- [ ] **Step 2: Write the failing enrichment tests**

In `src/features/notifications/api.test.ts`, the shared mock currently only stubs `GET`. Replace the mock so `GET` is reused for both notifications and the comment lookup (same `getMock`, dispatched by path), and add a describe block. First, update the existing mock block if needed — it already is `createApiClient: () => Promise.resolve({ GET: getMock })`, which covers `GET /api/comments/{id}` too. Add at the end of the file:

```ts
// ---------------------------------------------------------------------------
// getNotifications — обогащение comment.replied хост-лекцией
// ---------------------------------------------------------------------------
describe("getNotifications — commentLectureId enrichment", () => {
  it("резолвит lecture_id для comment.replied через GET /api/comments/{id}", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/me/notifications") {
        return Promise.resolve(
          apiResult({
            data: {
              data: [
                { id: "n-1", type: "comment.replied", target_type: "comment", target_id: "cmt-9" },
              ],
              pagination: { total: 1, offset: 0, limit: 20 },
            },
          }),
        );
      }
      // GET /api/comments/{id}
      return Promise.resolve(apiResult({ data: { data: { id: "cmt-9", lecture_id: "lec-42" } } }));
    });

    const { items } = await getNotifications();

    expect(items[0]).toMatchObject({ type: "comment.replied", commentLectureId: "lec-42" });
  });

  it("commentLectureId=null, если GET комментария вернул ошибку (мягкая деградация)", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/me/notifications") {
        return Promise.resolve(
          apiResult({
            data: {
              data: [
                { id: "n-2", type: "comment.replied", target_type: "comment", target_id: "cmt-gone" },
              ],
              pagination: { total: 1, offset: 0, limit: 20 },
            },
          }),
        );
      }
      return Promise.resolve(apiResult({ error: { error: "not found" }, status: 404 }));
    });

    const { items } = await getNotifications();

    expect(items[0].commentLectureId).toBeNull();
  });

  it("не дергает GET комментария для не-comment-типов (commentLectureId=null)", async () => {
    getMock.mockResolvedValue(
      apiResult({
        data: {
          data: [{ id: "n-3", type: "document.updated", target_type: "document", target_id: "doc-1" }],
          pagination: { total: 1, offset: 0, limit: 20 },
        },
      }),
    );

    const { items } = await getNotifications();

    expect(items[0].commentLectureId).toBeNull();
    // единственный GET — за уведомлениями; за комментом не ходили
    expect(getMock).toHaveBeenCalledOnce();
  });
});
```

Also update the existing normalization test (`нормализует DTO…`) `toMatchObject` — it uses `toMatchObject`, which ignores extra keys, so no change needed. Confirm it still passes after implementation.

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test src/features/notifications/api.test.ts`
Expected: FAIL — `commentLectureId` undefined / enrichment not implemented.

- [ ] **Step 4: Implement enrichment in api.ts**

In `src/features/notifications/api.ts`:

(a) In `normalizeNotification`, add the field default:

```ts
    createdAt: dto.created_at ?? null,
    commentLectureId: null,
```

(b) Add a cached resolver near the other `cache(...)` helpers:

```ts
/**
 * Хост-лекция комментария (для deep-link comment.replied). Комментарий несёт
 * обязательное lecture_id (comment.Comment). Мягкая деградация → null (карточка
 * без ссылки). N+1 бэк-ask: включить lecture_id в payload уведомления.
 */
const getCommentLectureId = cache(async (commentId: string): Promise<string | null> => {
  try {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/comments/{id}", {
      params: { path: { id: commentId } },
    });
    if (error) return null;
    return data.data?.lecture_id ?? null;
  } catch {
    return null;
  }
});
```

(c) In `getNotifications`, after mapping items, enrich the `comment.replied` ones in parallel before returning. Replace the current `return { items: (data.data ?? []).map(normalizeNotification), ... }` block with:

```ts
    const items = (data.data ?? []).map(normalizeNotification);
    await Promise.all(
      items.map(async (n) => {
        if (n.type === "comment.replied" && n.targetId) {
          n.commentLectureId = await getCommentLectureId(n.targetId);
        }
      }),
    );
    return {
      items,
      total: data.pagination?.total ?? 0,
      offset: data.pagination?.offset ?? offset,
      limit: data.pagination?.limit ?? limit,
    };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/features/notifications/api.test.ts`
Expected: PASS — все прежние + 3 новых теста.

- [ ] **Step 6: Commit**

```bash
git add src/features/notifications/types.ts src/features/notifications/api.ts src/features/notifications/api.test.ts
git commit -m "feat(notifications): резолв хост-лекции для comment.replied (deep-link)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `comment.replied` descriptor + item render + i18n

Чистый дескриптор строит deep-link `/lectures/{lectureId}#comment-{replyId}`; `notification-item` рендерит локализованный текст.

**Files:**
- Modify: `src/features/notifications/notification-content.ts`
- Test: `src/features/notifications/notification-content.test.ts`
- Modify: `src/features/notifications/ui/notification-item.tsx`
- Modify: `src/i18n/messages/{ru,en,ar,zh}/notifications.ts`

**Interfaces:**
- Consumes: `AppNotification.commentLectureId` (Task 4).
- Produces: descriptor variant `{ kind: "commentReplied"; count; href }`; i18n key `commentReplied`.

- [ ] **Step 1: Write the failing descriptor tests**

In `src/features/notifications/notification-content.test.ts`, add tests inside the `describe("describeNotification", …)` block, and fix the now-stale line about `comment` being off-contract:

```ts
  it("comment.replied → commentReplied + deep-link на ответ", () => {
    const d = describeNotification(
      make({ type: "comment.replied", targetType: "comment", targetId: "cmt-9", commentLectureId: "lec-42", groupCount: 2 }),
    );
    expect(d).toEqual({ kind: "commentReplied", count: 2, href: "/lectures/lec-42#comment-cmt-9" });
  });
  it("comment.replied без резолвнутой лекции → href null", () => {
    const d = describeNotification(
      make({ type: "comment.replied", targetType: "comment", targetId: "cmt-9", commentLectureId: null }),
    );
    expect(d).toEqual({ kind: "commentReplied", count: 1, href: null });
  });
```

Update the `make(...)` helper in this test file to include the new required field — add `commentLectureId: null,` to the defaults object:

```ts
    readAt: null, seenAt: null, createdAt: null, commentLectureId: null, ...p,
```

Replace the stale test `off-contract target_type → href null` (comment теперь валидный target) with a genuinely off-contract type:

```ts
  it("off-contract target_type → href null", () => {
    expect(describeNotification(make({ type: "document.updated", targetType: "media" as never, targetId: "x1" })).href).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/notifications/notification-content.test.ts`
Expected: FAIL — `commentReplied` kind не существует; `make` без `commentLectureId` — тип-ошибка.

- [ ] **Step 3: Implement the descriptor**

In `src/features/notifications/notification-content.ts`:

(a) Extend the descriptor union:

```ts
export type NotificationDescriptor =
  | { kind: "documentUpdated"; count: number; href: string | null }
  | { kind: "lectureUpdated"; count: number; href: string | null }
  | { kind: "canvasUpdated"; count: number; href: string | null }
  | { kind: "commentReplied"; count: number; href: string | null }
  | { kind: "raw"; count: number; href: string | null };
```

(b) In `describeNotification`, add the `comment.replied` case BEFORE `default`. Deep-link uses the stable `comment-<id>` DOM contract (see `thread-scroll.ts` / `comment-tree.tsx`):

```ts
    case "comment.replied": {
      const commentHref =
        n.commentLectureId && n.targetId
          ? `/lectures/${n.commentLectureId}#comment-${n.targetId}`
          : null;
      return { kind: "commentReplied", count, href: commentHref };
    }
```

> `entityHref` оставляем как есть — ветку `comment` там НЕ добавляем (href для коммента строится по-особому с фрагментом; `entityHref` вернул бы `null` для `comment`, что и нужно как fallback для прочих типов).

- [ ] **Step 4: Run descriptor tests to verify they pass**

Run: `pnpm test src/features/notifications/notification-content.test.ts`
Expected: PASS.

- [ ] **Step 5: Add i18n key (all four locales)**

In `src/i18n/messages/ru/notifications.ts`, add after `canvasUpdated`:

```ts
  commentReplied:
    "{count, plural, one{Новый ответ на ваш комментарий} few{# новых ответа на ваш комментарий} many{# новых ответов на ваш комментарий} other{# новых ответа на ваш комментарий}}",
```

In `src/i18n/messages/en/notifications.ts` (after `canvasUpdated`):

```ts
  commentReplied:
    "{count, plural, one{New reply to your comment} other{# new replies to your comment}}",
```

In `src/i18n/messages/ar/notifications.ts` (after `canvasUpdated`):

```ts
  commentReplied:
    "{count, plural, zero{رد جديد على تعليقك} one{رد جديد على تعليقك} two{ردّان جديدان على تعليقك} few{# ردود جديدة على تعليقك} many{# ردًّا جديدًا على تعليقك} other{# رد جديد على تعليقك}}",
```

In `src/i18n/messages/zh/notifications.ts` (after `canvasUpdated`):

```ts
  commentReplied: "{count, plural, other{您的评论有 # 条新回复}}",
```

- [ ] **Step 6: Render the branch in notification-item**

In `src/features/notifications/ui/notification-item.tsx`, the text-building block currently handles `raw` vs the updated-kinds via `t(d.kind, { count })`. Since `commentReplied` is also a plain ICU-count key, the existing `else` branch (`text = t(d.kind, { count: d.count })`) already covers it — `d.kind === "commentReplied"` resolves `t("commentReplied", { count })`. Verify no code change is needed by re-reading the block; the only requirement is that `d.kind` for commentReplied is a valid catalog key (Step 5 added it). No edit unless the block enumerates kinds explicitly — it does not.

> If the block DOES enumerate kinds (it does not at plan time — it branches only on `d.kind === "raw"`), add `commentReplied` alongside the updated-kinds. Otherwise leave untouched.

- [ ] **Step 7: Full gate**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное. Особо: i18n-паритет `commentReplied` по 4 локалям, notification-content + api тесты.

- [ ] **Step 8: Commit**

```bash
git add src/features/notifications/notification-content.ts src/features/notifications/notification-content.test.ts src/features/notifications/ui/notification-item.tsx src/i18n/messages/ru/notifications.ts src/i18n/messages/en/notifications.ts src/i18n/messages/ar/notifications.ts src/i18n/messages/zh/notifications.ts
git commit -m "feat(notifications): рендер comment.replied в инбоксе + deep-link к ответу

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Post-implementation

- [ ] **Флаг бэк-аск пользователю (мягкий, не блокер):** payload `comment.replied` не несёт контекст родителя → фронт делает N+1 `GET /api/comments/{id}`. Попросить бэк включить `lecture_id` в уведомление; после регена — заменить FE-резолв на чтение поля, убрать `getCommentLectureId`.
- [ ] **Browser-QA (открыт, ручной):**
  - Тумблер в `/me/settings` → секция «Подписки»: флип сохраняется после reload; во всех локалях + RTL (ar).
  - Клик по `comment.replied` в инбоксе → переход на `/lectures/{id}#comment-{replyId}` и скролл к самому ответу. Если Next при client-nav НЕ доскроллил — добавить hash-scroll-on-load островок на странице лекции через существующий `useScrollToCommentThread` (`thread-scroll.ts`), читающий `location.hash` (это единственный возможный follow-up-таск, только при подтверждённой проблеме — YAGNI).
  - Удалённый коммент → карточка `comment.replied` без ссылки, без краша.

---

## Self-Review

**Spec coverage:**
- Часть A (тумблер): Task 1 (action) + Task 2 (компонент + i18n) + Task 3 (wiring). ✓
- Часть B (рендер): Task 4 (types + enrichment) + Task 5 (descriptor + item + i18n). ✓
- Deep-link через `GET /api/comments/{id}`→`lecture_id`: Task 4. ✓
- Скролл к `#comment-<id>`: опора на существующий контракт, follow-up только по QA — Post-implementation. ✓
- Бэк-аск №1 (N+1): Post-implementation. ✓
- Тесты (action/toggle/content/api/i18n-паритет): распределены по задачам. ✓
- YAGNI (нет per-comment subscribe-UI): не вводим новых ручек/компонентов сверх плана. ✓

**Placeholder scan:** плейсхолдеров нет — весь код и команды приведены.

**Type consistency:**
- `setNotifyOnCommentReply(next: boolean)` — определён Task 1, зовётся Task 2. ✓
- `AppNotification.commentLectureId: string | null` — Task 4 (тип + default в normalize + enrich), читается Task 5 (descriptor) и тест-хелпер `make` (Task 5 Step 1 обновляет defaults). ✓
- `CommentReplyNotifyToggle({ initialEnabled, canManage })` — Task 2 определяет, Task 3 рендерит с теми же пропами. ✓
- Descriptor `commentReplied` — Task 5 добавляет в union и в `describeNotification`; `notification-item` использует `t(d.kind)` без изменений. ✓
- i18n-ключи `commentReplyNotify*` (preferences) и `commentReplied` (notifications) — добавляются во все 4 локали в тех же задачах, что и потребители. ✓
