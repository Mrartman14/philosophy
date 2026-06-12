# preferences-push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Покрыть фронтендом preferences/push-домены бекенда: страница `/settings` (настройки + push-подписка), админ-рассылка `/admin/push`, и переподключение push-инфраструктуры с env-заглушки на реальные `/api/push/*`.

**Architecture:** Новый слайс `src/features/preferences/` (kebab-case, по доменному имени бекенда `preference`; push-подписка — пользовательская настройка уведомлений, живёт в том же слайсе). SSR-first: server components фетчат `getPreferences`/`getVapidKey` и пробрасывают данные пропами; мутации — server actions (`createFormAction`/`createAction`); браузерная Push API-логика — целиком в client-компоненте слайса `ui/push-subscription-toggle.tsx`, замороженные `src/services/push-service` и `src/hooks/use-push-subscription` в части A не трогаются и удаляются в части B (foundation-touch батч волны 1).

**Tech Stack:** Next 16 (App Router, server actions), React 19 (`useActionState`), Zod 4, openapi-fetch (`@/api/client`), Base UI через `@/components/ui`, Vitest.

---

## Контекст и факты (сверено с бекендом `/Users/alexander.borisenko/Documents/philosophy-api`)

### Эндпоинты

| Эндпоинт | Auth | Тело / ответ | Источник |
| --- | --- | --- | --- |
| `GET /api/me/preferences` | required (RequireActor) | 200 → `{ data: { reading_mode } }` | `internal/preference/handler.go` |
| `PATCH /api/me/preferences` | required (RequireMutator — suspended → 403 `SUSPENDED`) | partial JSON, merge-семантика; 200 → полные prefs; 422 `VALIDATION_ERROR` при невалидном `reading_mode` | `internal/preference/service.go` |
| `GET /api/push/vapid-key` | **public** | 200 → `{ data: { publicKey } }`; **503 `NOT_CONFIGURED`**, если VAPID-ключи не сконфигурированы | `internal/push/handler.go:96`, `cmd/server/main.go:1036` |
| `POST /api/push/subscribe` | required (RequireMutator) | `{ endpoint, keys: { p256dh, auth } }` → 201 `{ data: push.Subscription }`; upsert по endpoint | `internal/push/handler.go:31`, `service.go:39` |
| `DELETE /api/push/subscribe` | required (RequireMutator) | `{ endpoint }` → 204; delete by owner+endpoint | `internal/push/handler.go:68` |
| `POST /api/admin/push/send` | required + `requireCap(push.send)` | `{ title (req), body?, url? }` → **202 Accepted** (рассылка асинхронная, через worker) | `internal/push/handler.go:119`, `cmd/server/main.go:1136` |

### Preferences-домен

Единственное поле — `reading_mode: "full" | "focused"`, дефолт `"full"` (`internal/preference/model.go`). PATCH мержит partial JSON поверх текущих и валидирует. **В `schema.ts` PATCH-body типизирован как `Record<string, never>`** (swagger не описывает partial-формат) — в `actions.ts` нужен cast `as never` с комментарием (по образцу `blocks: ... as never` в glossary; регенерация schema.ts запрещена).

### Push-домен

- Бекенд шлёт payload `{ title, body, url }` (`internal/push/webpush_sender.go:25`) — **уже совместимо** с push-обработчиком в `public/sw.js:147-160` (`data.title`, `data.body`, `data.url`, icon — fallback на `/logo.png`). **`public/sw.js` менять не нужно.**
- Незакоммиченный diff в `public/sw.js` — это авто-бамп `SW_VERSION` скриптом `scripts/generate-sw-assets.mjs`, который запускается из `npm run build` (см. `package.json: "build"`). Это билд-артефакт: **`public/sw.js` не добавлять в коммиты** (`git add` только своих файлов по имени).
- Мёртвые подписки бекенд чистит сам (fail_count ≥ 3 или HTTP 410 от push-провайдера, `internal/push/service.go:100-119`) — фронту не нужно гарантировать доставку DELETE.
- SW регистрируется глобально через `useRegisterSW` в `src/components/app/update-prompt.tsx` (root layout) — слайсу регистрировать SW не нужно, только `navigator.serviceWorker.ready`.

### RBAC — сверка имён capabilities (выполнена)

- Бекенд: `CapPushSend = "push.send"` (`internal/rbac/capabilities.go:29`), только у роли `admin`.
- Фронт: `"push.send"` уже есть в union `Capability` (`src/utils/permissions.ts`) — **касание не нужно**.
- Sidebar: пункт `/admin/push` уже capability-gated `can(me, "push.send")` (`src/app/admin/layout.tsx:44-46`) — **касание не нужно**. Имя совпадает с бекендом.

### Коды ошибок бекенда (httputil/apperror)

`{ error: string, code: string }`: `FORBIDDEN` (403), `SUSPENDED` (403, suspended-мутатор), `NOT_CONFIGURED` (503, push не настроен), `VALIDATION_ERROR` (422), `UNAUTHORIZED` (401).

---

## Ключевые решения

1. **Имя слайса — `preferences`** (kebab-case; домен бекенда `preference` + push-подписка как настройка уведомлений). Admin-рассылка тоже здесь: одна фича = один слайс, schemas/permissions общие.
2. **Push-подписка целиком в слайсе.** Client-логика (`navigator.serviceWorker` / `PushManager`, конвертация VAPID-ключа) пишется заново внутри `ui/push-subscription-toggle.tsx`. Замороженные `src/services/push-service/push-service.ts` и `src/hooks/use-push-subscription.ts` в части A **не трогаются и не импортируются**; в части B удаляются. Между мержами A и B на main существует мёртвый (неиспользуемый) старый код — осознанно, ничего не ломает.
3. **`/push` → redirect на `/settings` — в части A.** `src/app/push/page.tsx` не входит в запретные зоны; после замены на server-redirect он перестаёт импортировать замороженный хук, а target `/settings` появляется в той же ветке — main не ломается ни в один момент.
4. **VAPID-ключ — только с бекенда** (`GET /api/push/vapid-key`), фетчится server-фетчером и пробрасывается пропом. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` больше нигде не читается (его единственный читатель — push-service.ts, который удаляется в части B). При 503/ошибке — `null` → плашка «push временно недоступны», страница настроек продолжает работать.
5. **Preferences — пер-юзерные данные: НЕ оборачивать в `unstable_cache`** (cross-request кеш протёк бы между пользователями). Только `React.cache`. `revalidateEntity(Tags.PREFERENCES)` после мутации всё равно вызываем — это инвалидирует router cache и перерисовывает страницу.

---

## Parallel-safety contract

### Часть A — фичевая ветка `preferences-push`

**Создаёт (только новые файлы — collision невозможен):**

- `src/features/preferences/index.ts`
- `src/features/preferences/api.ts`
- `src/features/preferences/actions.ts`
- `src/features/preferences/permissions.ts`
- `src/features/preferences/permissions.test.ts`
- `src/features/preferences/schemas.ts`
- `src/features/preferences/schemas.test.ts`
- `src/features/preferences/types.ts`
- `src/features/preferences/ui/preferences-form.tsx`
- `src/features/preferences/ui/push-subscription-toggle.tsx`
- `src/features/preferences/ui/push-send-form.tsx`
- `src/app/settings/page.tsx`
- `src/app/admin/push/page.tsx`

**Модифицирует:**

- `src/api/tags.ts` — append-only, один ключ `PREFERENCES` в алфавитном порядке (разрешённое пересечение по протоколу мержа §5 спеки; конфликты тривиальны).
- `src/app/push/page.tsx` — полная замена содержимого на server-redirect (никакая другая фича волны 1 этот файл не трогает).

**НЕ трогает (резерв / запретные зоны):**

- `src/services/push-service/*`, `src/hooks/use-push-subscription.ts` — заморожены, удаляются в части B.
- `public/sw.js` — не нужен (push-обработчик уже совместим); билд-артефакт авто-бампа НЕ коммитить.
- `src/app/admin/layout.tsx`, `src/app/admin/admin-sidebar.tsx`, `src/app/layout.tsx`, `src/components/{app,ui,shared,permission}/*`, `src/utils/*`, `src/hooks/*`, `src/api/schema.ts`, `package.json`, `package-lock.json`, `eslint.config.mjs`, `vitest.config.ts`, `src/app/globals.css`.
- Файлы других фич волны 1 (`src/features/{tags,events,banners,...}`, `src/components/revision-history/`).

### Часть B — foundation-touch (батч волны 1, после мержа части A)

**Удаляет:**

- `src/services/push-service/push-service.ts` (директория `src/services/push-service/` станет пустой — удалить целиком).
- `src/hooks/use-push-subscription.ts`.

**Модифицирует:**

- `src/components/app/app-header/app-header.tsx` — ссылка «Настройки» для залогиненного пользователя (батчуется с остальными header-правками волны: `/calendar`, `/register`).

**НЕ трогает:**

- `public/sw.js` — изменений не требуется (проверено против `webpush_sender.go`).
- `src/hooks/use-register-sw.ts`, `src/hooks/use-install-prompt.ts` — не относятся к фиче.
- `src/utils/permissions.ts`, `src/app/admin/layout.tsx` — `push.send` уже на месте (сверено).

### Правила параллельной работы (передавать дословно всем субагентам)

> Никаких `git stash`, `git reset`, `git checkout .`, `git clean` и прочих деструктивных git-операций. Не откатывать и не перезаписывать изменения других агентов. `git add` — только своих файлов по имени, никогда `git add -A` / `git add .`. Не коммитить `public/sw.js` и `.env*`. Передавать эти правила всем создаваемым субагентам.

---

# Часть A — фичевая ветка

### Task 1: Каркас слайса, types.ts, реестр тегов

**Files:**
- Create: `src/features/preferences/` (копия `src/features/_template/`)
- Create: `src/features/preferences/types.ts` (перезапись шаблонного)
- Modify: `src/api/tags.ts`

- [ ] **Step 1: Скопировать шаблон и убрать README**

```bash
cp -R src/features/_template src/features/preferences
rm src/features/preferences/README.md
```

(`ui/.gitkeep` останется до Task 6, чтобы каталог не потерялся; удалим при добавлении первого ui-файла.)

- [ ] **Step 2: Написать `src/features/preferences/types.ts`** (полная замена шаблонного содержимого)

```ts
// src/features/preferences/types.ts
import type { components } from "@/api/schema";

/** GET/PATCH /api/me/preferences. Бекенд: internal/preference/model.go */
export type Preferences = components["schemas"]["preference.Preferences"];

/**
 * Допустимые значения reading_mode — зеркало validReadingModes бекенда
 * (internal/preference/model.go: ReadingModeFull / ReadingModeFocused).
 */
export const READING_MODES = ["full", "focused"] as const;
export type ReadingMode = (typeof READING_MODES)[number];
```

(Ответ `POST /api/push/subscribe` (`push.Subscription`) фронтом не используется — тип для него не заводим, YAGNI.)

- [ ] **Step 3: Дополнить `src/api/tags.ts`** — строго append-only

Существующие ключи НЕ переставлять (сейчас в файле `LECTURES, GLOSSARY` — менять их порядок нельзя: это увеличило бы конфликтную поверхность с другими ветками волны). Новый ключ `PREFERENCES` алфавитно последний — добавить одну строку в конец объекта:

```ts
export const Tags = {
  LECTURES: "lectures",
  GLOSSARY: "glossary",
  PREFERENCES: "preferences",
} as const;
```

(Остальной файл — без изменений.)

- [ ] **Step 4: Проверить, что ничего не сломалось**

Run: `npm run lint && npm test`
Expected: зелёные (шаблонные placeholder-тесты `canPlaceholder`/`PlaceholderSchema` проходят).

- [ ] **Step 5: Commit**

```bash
git add src/features/preferences src/api/tags.ts
git commit -m "feat(preferences): scaffold slice from template, add PREFERENCES tag"
```

---

### Task 2: permissions.ts (TDD)

**Files:**
- Modify: `src/features/preferences/permissions.ts` (полная замена шаблонного)
- Test: `src/features/preferences/permissions.test.ts` (полная замена шаблонного)

Бизнес-правила: изменение своих настроек и push-подписка — любой залогиненный **active**-пользователь без специальной capability (бекенд гейтит только RequireMutator); рассылка — capability `push.send`.

- [ ] **Step 1: Написать failing-тесты** — полная замена `src/features/preferences/permissions.test.ts`

```ts
// src/features/preferences/permissions.test.ts
import { describe, it, expect } from "vitest";
import type { Me } from "@/utils/me";
import {
  canSendPush,
  canSubscribePush,
  canUpdatePreferences,
} from "./permissions";

const guest = null;

const activeUser: Me = {
  id: "u1",
  username: "user",
  role: "user",
  status: "active",
  capabilities: ["document.create"],
};

const adminWithPush: Me = {
  id: "u2",
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: ["push.send", "user.list"],
};

const suspendedAdmin: Me = { ...adminWithPush, status: "suspended" };
const bannedUser: Me = { ...activeUser, status: "banned" };

describe("canUpdatePreferences", () => {
  it("гость → false", () => expect(canUpdatePreferences(guest)).toBe(false));
  it("active user → true", () =>
    expect(canUpdatePreferences(activeUser)).toBe(true));
  it("active admin → true", () =>
    expect(canUpdatePreferences(adminWithPush)).toBe(true));
  it("suspended → false", () =>
    expect(canUpdatePreferences(suspendedAdmin)).toBe(false));
  it("banned → false", () =>
    expect(canUpdatePreferences(bannedUser)).toBe(false));
});

describe("canSubscribePush", () => {
  it("гость → false", () => expect(canSubscribePush(guest)).toBe(false));
  it("active user → true", () =>
    expect(canSubscribePush(activeUser)).toBe(true));
  it("suspended → false", () =>
    expect(canSubscribePush(suspendedAdmin)).toBe(false));
  it("banned → false", () =>
    expect(canSubscribePush(bannedUser)).toBe(false));
});

describe("canSendPush", () => {
  it("гость → false", () => expect(canSendPush(guest)).toBe(false));
  it("active без push.send → false", () =>
    expect(canSendPush(activeUser)).toBe(false));
  it("active с push.send → true", () =>
    expect(canSendPush(adminWithPush)).toBe(true));
  it("suspended с push.send → false", () =>
    expect(canSendPush(suspendedAdmin)).toBe(false));
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/features/preferences/permissions.test.ts`
Expected: FAIL — `canSendPush`/`canSubscribePush`/`canUpdatePreferences` не экспортируются.

- [ ] **Step 3: Реализовать** — полная замена `src/features/preferences/permissions.ts`

```ts
// src/features/preferences/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can, isMutationAllowed } from "@/utils/permissions";

/**
 * Изменение собственных настроек: любой залогиненный active-пользователь.
 * Бекенд гейтит только RequireMutator (suspended → 403 SUSPENDED),
 * специальной capability нет.
 */
export function canUpdatePreferences(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}

/** Подписка/отписка на push: любой залогиненный active-пользователь. */
export function canSubscribePush(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}

/**
 * Админская рассылка. Имя capability сверено с бекендом:
 * internal/rbac/capabilities.go:29 (CapPushSend = "push.send").
 */
export function canSendPush(me: MaybeMe): boolean {
  return can(me, "push.send");
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/features/preferences/permissions.test.ts`
Expected: PASS, 13 тестов.

- [ ] **Step 5: Commit**

```bash
git add src/features/preferences/permissions.ts src/features/preferences/permissions.test.ts
git commit -m "feat(preferences): permission helpers with tests"
```

---

### Task 3: schemas.ts (TDD)

**Files:**
- Modify: `src/features/preferences/schemas.ts` (полная замена шаблонного)
- Test: `src/features/preferences/schemas.test.ts` (полная замена шаблонного)

- [ ] **Step 1: Написать failing-тесты** — полная замена `src/features/preferences/schemas.test.ts`

```ts
// src/features/preferences/schemas.test.ts
import { describe, it, expect } from "vitest";
import {
  PreferencesUpdateSchema,
  PushSendSchema,
  PushSubscribeSchema,
  PushUnsubscribeSchema,
} from "./schemas";

describe("PreferencesUpdateSchema", () => {
  it("принимает reading_mode=full", () => {
    expect(
      PreferencesUpdateSchema.safeParse({ reading_mode: "full" }).success,
    ).toBe(true);
  });
  it("принимает reading_mode=focused", () => {
    expect(
      PreferencesUpdateSchema.safeParse({ reading_mode: "focused" }).success,
    ).toBe(true);
  });
  it("отклоняет неизвестный режим", () => {
    expect(
      PreferencesUpdateSchema.safeParse({ reading_mode: "compact" }).success,
    ).toBe(false);
  });
  it("отклоняет отсутствующее поле", () => {
    expect(PreferencesUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("PushSubscribeSchema", () => {
  const valid = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    keys: { p256dh: "BPk-key", auth: "auth-secret" },
  };
  it("принимает валидную подписку", () => {
    expect(PushSubscribeSchema.safeParse(valid).success).toBe(true);
  });
  it("отбрасывает лишние поля из PushSubscription.toJSON() (expirationTime)", () => {
    const r = PushSubscribeSchema.safeParse({ ...valid, expirationTime: null });
    expect(r.success).toBe(true);
    if (r.success) expect("expirationTime" in r.data).toBe(false);
  });
  it("отклоняет не-URL endpoint", () => {
    expect(
      PushSubscribeSchema.safeParse({ ...valid, endpoint: "not-a-url" })
        .success,
    ).toBe(false);
  });
  it("отклоняет пустой p256dh", () => {
    expect(
      PushSubscribeSchema.safeParse({
        ...valid,
        keys: { p256dh: "", auth: "x" },
      }).success,
    ).toBe(false);
  });
  it("отклоняет отсутствующие keys", () => {
    expect(
      PushSubscribeSchema.safeParse({ endpoint: valid.endpoint }).success,
    ).toBe(false);
  });
});

describe("PushUnsubscribeSchema", () => {
  it("принимает валидный endpoint", () => {
    expect(
      PushUnsubscribeSchema.safeParse({
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      }).success,
    ).toBe(true);
  });
  it("отклоняет не-URL endpoint", () => {
    expect(PushUnsubscribeSchema.safeParse({ endpoint: "abc" }).success).toBe(
      false,
    );
  });
});

describe("PushSendSchema", () => {
  it("принимает полный payload", () => {
    const r = PushSendSchema.safeParse({
      title: "Новая лекция",
      body: "Платон. Государство",
      url: "/lectures/abc",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({
        title: "Новая лекция",
        body: "Платон. Государство",
        url: "/lectures/abc",
      });
    }
  });
  it("превращает пустые body/url из FormData в undefined", () => {
    const r = PushSendSchema.safeParse({ title: "Заголовок", body: "", url: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.body).toBeUndefined();
      expect(r.data.url).toBeUndefined();
    }
  });
  it("принимает абсолютный https-URL", () => {
    expect(
      PushSendSchema.safeParse({ title: "t", url: "https://example.com/x" })
        .success,
    ).toBe(true);
  });
  it("отклоняет пустой title", () => {
    expect(PushSendSchema.safeParse({ title: "  " }).success).toBe(false);
  });
  it("отклоняет title длиннее 200", () => {
    expect(PushSendSchema.safeParse({ title: "a".repeat(201) }).success).toBe(
      false,
    );
  });
  it("отклоняет url-схему, отличную от пути или http(s)", () => {
    expect(
      PushSendSchema.safeParse({ title: "t", url: "javascript:alert(1)" })
        .success,
    ).toBe(false);
  });
  it("отклоняет body длиннее 1000", () => {
    expect(
      PushSendSchema.safeParse({ title: "t", body: "a".repeat(1001) }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx vitest run src/features/preferences/schemas.test.ts`
Expected: FAIL — схемы не экспортируются.

- [ ] **Step 3: Реализовать** — полная замена `src/features/preferences/schemas.ts`

Примечание: проект на Zod 4 — для URL используется топ-левел `z.url()` (`z.string().url()` в v4 deprecated).

```ts
// src/features/preferences/schemas.ts
import "server-only";
import { z } from "zod";
import { READING_MODES } from "./types";

/** PATCH /api/me/preferences — единственное поле reading_mode. */
export const PreferencesUpdateSchema = z.object({
  reading_mode: z.enum(READING_MODES),
});

/**
 * POST /api/push/subscribe — форма push.SubscribeRequest бекенда.
 * На вход подаётся PushSubscription.toJSON() из браузера; лишние поля
 * (expirationTime) Zod отбрасывает.
 */
export const PushSubscribeSchema = z.object({
  endpoint: z.url("Некорректный endpoint подписки"),
  keys: z.object({
    p256dh: z.string().min(1, "Пустой ключ p256dh"),
    auth: z.string().min(1, "Пустой ключ auth"),
  }),
});

/** DELETE /api/push/subscribe — форма push.UnsubscribeRequest. */
export const PushUnsubscribeSchema = z.object({
  endpoint: z.url("Некорректный endpoint подписки"),
});

/**
 * POST /api/admin/push/send — форма push.SendRequest (title обязателен).
 * Пустые строки из FormData превращаются в undefined, чтобы не слать
 * в бекенд пустые body/url.
 */
export const PushSendSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Введите заголовок")
    .max(200, "До 200 символов"),
  body: z
    .string()
    .trim()
    .max(1000, "До 1000 символов")
    .transform((s) => (s === "" ? undefined : s))
    .optional(),
  url: z
    .string()
    .trim()
    .refine(
      (s) => s === "" || s.startsWith("/") || /^https?:\/\//.test(s),
      "URL должен начинаться с «/» или «http(s)://»",
    )
    .transform((s) => (s === "" ? undefined : s))
    .optional(),
});

export type PreferencesUpdateInput = z.infer<typeof PreferencesUpdateSchema>;
export type PushSubscribeInput = z.infer<typeof PushSubscribeSchema>;
export type PushUnsubscribeInput = z.infer<typeof PushUnsubscribeSchema>;
export type PushSendInput = z.infer<typeof PushSendSchema>;
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `npx vitest run src/features/preferences/schemas.test.ts`
Expected: PASS, 18 тестов.

- [ ] **Step 5: Commit**

```bash
git add src/features/preferences/schemas.ts src/features/preferences/schemas.test.ts
git commit -m "feat(preferences): zod schemas with tests"
```

---

### Task 4: api.ts — server fetchers

**Files:**
- Modify: `src/features/preferences/api.ts` (полная замена шаблонного)

Тесты на fetchers по конвенции не пишутся (glossary их тоже не имеет); компиляцию проверит `npm run build` в Task 11.

- [ ] **Step 1: Реализовать** — полная замена `src/features/preferences/api.ts`

```ts
// src/features/preferences/api.ts
import "server-only";
import { cache } from "react";
import { createApiClient } from "@/api/client";
import type { Preferences } from "./types";

/**
 * Настройки текущего пользователя. Данные пер-юзерные — НЕ оборачивать в
 * unstable_cache: cross-request кеш протёк бы между пользователями.
 * React.cache дедуплицирует вызовы в рамках одного запроса.
 *
 * Вызывать только после проверки getMe() !== null (требует auth-токен).
 */
export const getPreferences = cache(async (): Promise<Preferences> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/me/preferences");
  if (error) {
    throw new Error(error.error ?? "Не удалось загрузить настройки");
  }
  return data?.data ?? {};
});

/**
 * Публичный VAPID-ключ с бекенда (НЕ из env — env-заглушка уходит вместе с
 * push-service в foundation-touch части B). Возвращает null, если push на
 * бекенде не сконфигурирован (503 NOT_CONFIGURED) или ключ пуст — страница
 * настроек должна работать и без push.
 */
export const getVapidKey = cache(async (): Promise<string | null> => {
  const api = await createApiClient();
  const { data, response } = await api.GET("/api/push/vapid-key");
  if (!response.ok) return null;
  return data?.data?.publicKey || null;
});
```

- [ ] **Step 2: Проверить типы и линт**

Run: `npx tsc --noEmit && npm run lint`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/features/preferences/api.ts
git commit -m "feat(preferences): server fetchers getPreferences/getVapidKey"
```

---

### Task 5: actions.ts — server actions

**Files:**
- Modify: `src/features/preferences/actions.ts` (полная замена шаблонного)

- [ ] **Step 1: Реализовать** — полная замена `src/features/preferences/actions.ts`

```ts
// src/features/preferences/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";
import { Tags } from "@/api/tags";
import {
  canSendPush,
  canSubscribePush,
  canUpdatePreferences,
} from "./permissions";
import {
  PreferencesUpdateSchema,
  PushSendSchema,
  PushSubscribeSchema,
  PushUnsubscribeSchema,
} from "./schemas";
import type { Preferences } from "./types";

type ApiError = { code?: string; error?: string };

/** Маппинг кодов httputil/apperror бекенда на доменные ошибки фронта. */
function rethrowApiError(err: ApiError | undefined): never {
  switch (err?.code) {
    case "FORBIDDEN":
      throw new ForbiddenError("role", err.error);
    case "SUSPENDED":
      throw new ForbiddenError("status", err.error);
    case "NOT_CONFIGURED":
      throw new Error("Push-уведомления не настроены на сервере.");
    case "VALIDATION_ERROR":
      throw new Error(err.error ?? "Сервер отклонил данные формы.");
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}

export const updatePreferences = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canUpdatePreferences);
  const input = parseFormData(PreferencesUpdateSchema, formData);
  const api = await createApiClient();
  // PATCH-body в schema.ts типизирован как Record<string, never> (swagger не
  // описывает partial-формат). Реальный формат — частичный
  // preference.Preferences (merge-семантика бекенда,
  // philosophy-api internal/preference/service.go). Регенерация schema.ts
  // запрещена (CLAUDE.md) — поэтому cast.
  const { data, error } = await api.PATCH("/api/me/preferences", {
    body: { reading_mode: input.reading_mode } as never,
  });
  if (error) rethrowApiError(error as ApiError);
  revalidateEntity(Tags.PREFERENCES);
  return (data?.data ?? null) as Preferences | null;
});

/**
 * Вызывается из push-subscription-toggle с результатом
 * PushSubscription.toJSON() — поэтому вход unknown + Zod-парсинг.
 */
export const subscribePush = createAction(async (rawSubscription: unknown) => {
  const me = await getMe();
  requireCapability(me, canSubscribePush);
  const input = PushSubscribeSchema.parse(rawSubscription);
  const api = await createApiClient();
  const { error } = await api.POST("/api/push/subscribe", { body: input });
  if (error) rethrowApiError(error as ApiError);
  return undefined;
});

export const unsubscribePush = createAction(async (rawEndpoint: string) => {
  const me = await getMe();
  requireCapability(me, canSubscribePush);
  const { endpoint } = PushUnsubscribeSchema.parse({ endpoint: rawEndpoint });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/push/subscribe", {
    body: { endpoint },
  });
  if (error) rethrowApiError(error as ApiError);
  return undefined;
});

export const sendPushBroadcast = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canSendPush);
  const input = parseFormData(PushSendSchema, formData);
  const api = await createApiClient();
  const { error } = await api.POST("/api/admin/push/send", {
    body: {
      title: input.title,
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.url !== undefined ? { url: input.url } : {}),
    },
  });
  if (error) rethrowApiError(error as ApiError);
  // Бекенд отвечает 202 Accepted — рассылка асинхронная.
  return true;
});
```

- [ ] **Step 2: Проверить типы и линт**

Run: `npx tsc --noEmit && npm run lint`
Expected: без ошибок. Если openapi-fetch ругается на `body` у `DELETE /api/push/subscribe` — проверить, что путь и метод совпадают со schema.ts (requestBody там объявлен, `schema.ts:10284-10296`).

- [ ] **Step 3: Commit**

```bash
git add src/features/preferences/actions.ts
git commit -m "feat(preferences): server actions for preferences and push"
```

---

### Task 6: ui/preferences-form.tsx

**Files:**
- Create: `src/features/preferences/ui/preferences-form.tsx`
- Delete: `src/features/preferences/ui/.gitkeep`

UI-компоненты тестами не покрываются (конвенция §5: не тестируем UI-примитивы; вся логика — в schemas/permissions, уже покрытых).

- [ ] **Step 1: Создать `src/features/preferences/ui/preferences-form.tsx`**

```tsx
"use client";
// src/features/preferences/ui/preferences-form.tsx
import { useActionState } from "react";
import { Form, FormField, Select, SubmitButton } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { updatePreferences } from "../actions";
import type { Preferences, ReadingMode } from "../types";

const initial: ActionResult<Preferences | null> = { success: true, data: null };

const READING_MODE_OPTIONS: { value: ReadingMode; label: string }[] = [
  { value: "full", label: "Полный" },
  { value: "focused", label: "Фокусированный" },
];

export function PreferencesForm({
  initialReadingMode,
}: {
  initialReadingMode: ReadingMode;
}) {
  const [state, action] = useActionState(updatePreferences, initial);
  const fieldErrors: Record<string, string> =
    state.success === false && state.code === "validation"
      ? state.fieldErrors
      : {};

  return (
    <Form
      action={action}
      errors={fieldErrors}
      className="flex max-w-xl flex-col gap-4"
    >
      <FormField
        name="reading_mode"
        label="Режим чтения"
        description="«Фокусированный» скрывает второстепенные элементы на странице лекции."
      >
        <Select
          name="reading_mode"
          defaultValue={initialReadingMode}
          options={READING_MODE_OPTIONS}
          aria-label="Режим чтения"
        />
      </FormField>

      {state.success === false && state.code === "forbidden" && (
        <p className="text-sm text-red-600">
          У вас нет прав на изменение настроек.
        </p>
      )}
      {state.success === false && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state.success && state.data !== null && (
        <p className="text-sm text-(--color-description)">Настройки сохранены.</p>
      )}

      <div>
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </Form>
  );
}
```

- [ ] **Step 2: Удалить gitkeep (он закоммичен в Task 1 — поэтому `git rm`, не `rm`), проверить линт**

```bash
git rm src/features/preferences/ui/.gitkeep
npm run lint
```

Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/features/preferences/ui/preferences-form.tsx
git commit -m "feat(preferences): preferences form (reading_mode)"
```

(Удаление `.gitkeep` уже застейджено шагом 2 и попадёт в этот же коммит.)

---

### Task 7: ui/push-subscription-toggle.tsx — client-логика Web Push

**Files:**
- Create: `src/features/preferences/ui/push-subscription-toggle.tsx`

Это замена замороженной паре `push-service.ts` + `use-push-subscription.ts`: вся браузерная логика — внутри слайса. Отличия от старого кода: VAPID-ключ приходит пропом с бекенда (не из env), подписка реально отправляется на бекенд server action'ом, отписка шлёт DELETE.

- [ ] **Step 1: Создать `src/features/preferences/ui/push-subscription-toggle.tsx`**

```tsx
"use client";
// src/features/preferences/ui/push-subscription-toggle.tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { subscribePush, unsubscribePush } from "../actions";

/** Конвертация base64url VAPID-ключа в Uint8Array для PushManager.subscribe. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type ToggleState =
  | { phase: "loading" }
  | { phase: "unsupported" }
  | { phase: "denied" }
  | { phase: "ready"; subscribed: boolean };

interface PushSubscriptionToggleProps {
  /** Публичный VAPID-ключ с бекенда; null — push не сконфигурирован. */
  vapidPublicKey: string | null;
  /** canSubscribePush(me) со страницы (server component). */
  canSubscribe: boolean;
}

export function PushSubscriptionToggle({
  vapidPublicKey,
  canSubscribe,
}: PushSubscriptionToggleProps) {
  const [state, setState] = useState<ToggleState>({ phase: "loading" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) {
      setState({ phase: "unsupported" });
      return;
    }
    if (Notification.permission === "denied") {
      setState({ phase: "denied" });
      return;
    }
    // SW регистрируется глобально в update-prompt.tsx (root layout) —
    // здесь только ждём готовности и читаем текущую подписку.
    let cancelled = false;
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (!cancelled) {
          setState({ phase: "ready", subscribed: subscription !== null });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ phase: "unsupported" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubscribe = async () => {
    if (!vapidPublicKey) return;
    setPending(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          vapidPublicKey,
        ) as BufferSource,
      });
      const result = await subscribePush(subscription.toJSON());
      if (!result.success) {
        // Бекенд не сохранил подписку — откатываем браузерную,
        // чтобы не осталось «полуподписанного» состояния.
        await subscription.unsubscribe();
        setError(
          result.code === "forbidden"
            ? "У вас нет прав на подписку на уведомления."
            : result.error,
        );
        return;
      }
      setState({ phase: "ready", subscribed: true });
    } catch {
      if (Notification.permission === "denied") {
        setState({ phase: "denied" });
      } else {
        setError("Не удалось оформить подписку. Попробуйте ещё раз.");
      }
    } finally {
      setPending(false);
    }
  };

  const handleUnsubscribe = async () => {
    setPending(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        const result = await unsubscribePush(endpoint);
        if (!result.success) {
          // Браузерная подписка уже снята; мёртвый endpoint бекенд зачистит
          // сам после неудачных доставок (fail_count / 410 Gone) —
          // пользователю это не показываем.
          console.error("[push] server unsubscribe failed:", result.error);
        }
      }
      setState({ phase: "ready", subscribed: false });
    } catch {
      setError("Не удалось отписаться. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  };

  if (state.phase === "loading") {
    return (
      <p className="text-sm text-(--color-description)">Проверяем подписку…</p>
    );
  }
  if (state.phase === "unsupported") {
    return (
      <p className="text-sm text-(--color-description)">
        Push-уведомления не поддерживаются в этом браузере.
      </p>
    );
  }
  if (state.phase === "denied") {
    return (
      <p className="text-sm text-(--color-description)">
        Уведомления заблокированы. Разрешите их в настройках браузера.
      </p>
    );
  }
  if (vapidPublicKey === null) {
    return (
      <p className="text-sm text-(--color-description)">
        Push-уведомления временно недоступны.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        {state.subscribed
          ? "Вы подписаны на уведомления."
          : "Вы не подписаны на уведомления."}
      </p>
      {state.subscribed ? (
        <Button
          variant="secondary"
          className="self-start"
          disabled={pending}
          onClick={handleUnsubscribe}
        >
          Отписаться
        </Button>
      ) : (
        <Button
          className="self-start"
          disabled={pending || !canSubscribe}
          onClick={handleSubscribe}
        >
          Подписаться
        </Button>
      )}
      {!canSubscribe && !state.subscribed && (
        <p className="text-sm text-(--color-description)">
          У вас нет прав на подписку на уведомления.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Проверить типы и линт**

Run: `npx tsc --noEmit && npm run lint`
Expected: без ошибок. (Если TS ругается на `applicationServerKey` — каст `as BufferSource` уже стоит; не менять lib в tsconfig.)

- [ ] **Step 3: Commit**

```bash
git add src/features/preferences/ui/push-subscription-toggle.tsx
git commit -m "feat(preferences): push subscription toggle wired to /api/push/*"
```

---

### Task 8: ui/push-send-form.tsx — админ-рассылка

**Files:**
- Create: `src/features/preferences/ui/push-send-form.tsx`

- [ ] **Step 1: Создать `src/features/preferences/ui/push-send-form.tsx`**

```tsx
"use client";
// src/features/preferences/ui/push-send-form.tsx
import { useActionState } from "react";
import {
  Form,
  FormField,
  SubmitButton,
  TextInput,
  Textarea,
} from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { sendPushBroadcast } from "../actions";

// data: false — начальное состояние; true — рассылка принята (202).
const initial: ActionResult<boolean> = { success: true, data: false };

export function PushSendForm() {
  const [state, action] = useActionState(sendPushBroadcast, initial);
  const fieldErrors: Record<string, string> =
    state.success === false && state.code === "validation"
      ? state.fieldErrors
      : {};

  return (
    <Form
      action={action}
      errors={fieldErrors}
      className="flex max-w-xl flex-col gap-4"
    >
      <FormField name="title" label="Заголовок" required>
        <TextInput
          name="title"
          required
          maxLength={200}
          placeholder="Например: «Новая лекция»"
        />
      </FormField>

      <FormField name="body" label="Текст">
        <Textarea name="body" maxLength={1000} rows={4} />
      </FormField>

      <FormField
        name="url"
        label="Ссылка"
        description="Откроется по клику на уведомление. Путь («/lectures/…») или полный http(s)-URL."
      >
        <TextInput name="url" placeholder="/lectures/…" />
      </FormField>

      {state.success === false && state.code === "forbidden" && (
        <p className="text-sm text-red-600">
          У вас нет прав на отправку push-уведомлений.
        </p>
      )}
      {state.success === false && !state.code && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state.success && state.data === true && (
        <p className="text-sm text-(--color-description)">
          Рассылка принята и будет доставлена подписчикам в фоне.
        </p>
      )}

      <div>
        <SubmitButton>Отправить</SubmitButton>
      </div>
    </Form>
  );
}
```

- [ ] **Step 2: Проверить линт**

Run: `npm run lint`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/features/preferences/ui/push-send-form.tsx
git commit -m "feat(preferences): admin push broadcast form"
```

---

### Task 9: index.ts — public API слайса

**Files:**
- Modify: `src/features/preferences/index.ts` (полная замена шаблонного)

Экспортируется только то, что нужно страницам в `app/` (deep-imports снаружи запрещены ESLint'ом). Server actions наружу не экспортируем — их используют только ui-компоненты слайса через относительные импорты (YAGNI).

- [ ] **Step 1: Реализовать** — полная замена `src/features/preferences/index.ts`

```ts
// src/features/preferences/index.ts
export { getPreferences, getVapidKey } from "./api";
export {
  canSendPush,
  canSubscribePush,
  canUpdatePreferences,
} from "./permissions";
export { PreferencesForm } from "./ui/preferences-form";
export { PushSubscriptionToggle } from "./ui/push-subscription-toggle";
export { PushSendForm } from "./ui/push-send-form";
export type { Preferences, ReadingMode } from "./types";
```

- [ ] **Step 2: Проверить линт и тесты**

Run: `npm run lint && npm test`
Expected: зелёные.

- [ ] **Step 3: Commit**

```bash
git add src/features/preferences/index.ts
git commit -m "feat(preferences): export public slice API"
```

---

### Task 10: Страница /settings

**Files:**
- Create: `src/app/settings/page.tsx`

Гейт: гостя редиректим на `/login?next=/settings` (паттерн `src/app/login/page.tsx` — login сам читает `next` через `safeNextPath`).

- [ ] **Step 1: Создать `src/app/settings/page.tsx`**

```tsx
// src/app/settings/page.tsx
import { redirect } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  PreferencesForm,
  PushSubscriptionToggle,
  canSubscribePush,
  getPreferences,
  getVapidKey,
  type ReadingMode,
} from "@/features/preferences";

export const metadata = { title: "Настройки" };

export default async function SettingsPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/settings");

  const [prefs, vapidPublicKey] = await Promise.all([
    getPreferences(),
    getVapidKey(),
  ]);
  // reading_mode в schema.ts — string|undefined; сужаем с фоллбеком на
  // дефолт бекенда (internal/preference/model.go: DefaultPreferences).
  const readingMode: ReadingMode =
    prefs.reading_mode === "focused" ? "focused" : "full";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4">
      <h1 className="text-2xl font-bold">Настройки</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Чтение</h2>
        <PreferencesForm initialReadingMode={readingMode} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Push-уведомления</h2>
        <PushSubscriptionToggle
          vapidPublicKey={vapidPublicKey}
          canSubscribe={canSubscribePush(me)}
        />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Проверить линт**

Run: `npm run lint`
Expected: без ошибок (импорт только через `@/features/preferences` — deep-import guard доволен).

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat(preferences): /settings page (auth-gated)"
```

---

### Task 11: Страница /admin/push

**Files:**
- Create: `src/app/admin/push/page.tsx`

Layer-3 гейт по конвенции (`forbidden()` из `next/navigation`). Пункт sidebar уже существует и гейтится `can(me, "push.send")` в `src/app/admin/layout.tsx` — НЕ трогать.

- [ ] **Step 1: Создать `src/app/admin/push/page.tsx`**

```tsx
// src/app/admin/push/page.tsx
import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import { PushSendForm, canSendPush } from "@/features/preferences";

export const metadata = { title: "Push-уведомления — админ" };

export default async function AdminPushPage() {
  const me = await getMe();
  if (!canSendPush(me)) forbidden();

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Push-уведомления</h1>
        <p className="text-sm text-(--color-description)">
          Рассылка уходит всем подписанным пользователям. Отправка асинхронная —
          доставка занимает время.
        </p>
      </header>
      <PushSendForm />
    </section>
  );
}
```

- [ ] **Step 2: Полная проверка с билдом**

Run: `npm run lint && npm test && npm run build`
Expected: всё зелёное. ВНИМАНИЕ: `npm run build` авто-бампнет `SW_VERSION` в `public/sw.js` — НЕ добавлять его в git.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/push/page.tsx
git commit -m "feat(preferences): /admin/push page with layer-3 gate"
```

---

### Task 12: /push → redirect на /settings

**Files:**
- Modify: `src/app/push/page.tsx` (полная замена)

Обоснование размещения в части A: файл не входит в запретные зоны; после замены он перестаёт импортировать замороженный `use-push-subscription`, а target `/settings` создан в этой же ветке — main работоспособен в любой точке между мержами. Замороженные hook/service после этого становятся мёртвым кодом и удаляются частью B.

- [ ] **Step 1: Заменить содержимое `src/app/push/page.tsx` целиком**

```tsx
// src/app/push/page.tsx
// Страница /push заменена настройками: push-подписка живёт на /settings
// (слайс src/features/preferences). Старая клиентская реализация
// (use-push-subscription + push-service) удаляется foundation-touch
// батчем волны 1.
import { redirect } from "next/navigation";

export default function PushRedirectPage() {
  redirect("/settings");
}
```

- [ ] **Step 2: Проверить, что замороженный хук больше никем не используется**

Run: `grep -rn "use-push-subscription\|push-service" src/ --include='*.ts' --include='*.tsx' | grep -v 'src/hooks/use-push-subscription.ts' | grep -v 'src/services/push-service/'`
Expected: пусто (единственным потребителем был старый `/push`).

- [ ] **Step 3: Линт и тесты**

Run: `npm run lint && npm test`
Expected: зелёные.

- [ ] **Step 4: Commit**

```bash
git add src/app/push/page.tsx
git commit -m "feat(preferences): redirect /push to /settings"
```

---

### Task 13: Чеклист готовности и финальная верификация

**Files:** — (только проверки)

- [ ] **Step 1: Пройти чеклист `src/features/_template/README.md`**

- `index.ts` экспортирует только нужное снаружи — да (Task 9).
- `api.ts`, `actions.ts`, `permissions.ts`, `schemas.ts` начинаются с `import "server-only";` — проверить глазами все четыре файла.
- Каждая `canXxx` покрыта тестом — 3 хелпера × 4-5 кейсов (Task 2).
- Каждая Zod-схема — минимум 1 success + 1 failure (Task 3: 4 схемы, 18 тестов).
- `createFormAction` + `parseFormData` + `requireCapability` + `revalidateEntity` — да (Task 5).
- Не импортит другие `@/features/*` — да (ESLint enforce).
- `ui/.gitkeep` удалён, реальные UI-файлы добавлены — да (Tasks 6-8).

- [ ] **Step 2: Финальная верификация**

Run: `npm run lint && npm test && npm run build`
Expected: всё зелёное. Перепроверить `git status`: `public/sw.js` (авто-бамп от build) — НЕ закоммичен; в ветке только файлы из Parallel-safety contract части A.

- [ ] **Step 3: Если что-то красное** — чинить (REQUIRED SUB-SKILL: superpowers:systematic-debugging), не отключать правила и не комментировать тесты.

---

# Часть B — foundation-touch (батч волны 1)

> Выполняется **выделенным foundation-агентом после мержа всех фич волны 1**, одним коммитом/серией вместе с остальным инвентарём волны (admin-sidebar: tags/events/banners/audit; header: /calendar, /settings, /register?; root layout: banners). Ниже — вклад фичи `preferences-push` в этот батч. Часть A к этому моменту в `main`.

### Task B1: Удалить устаревшую push-инфраструктуру

**Files:**
- Delete: `src/services/push-service/push-service.ts` (вместе с опустевшей директорией `src/services/push-service/`)
- Delete: `src/hooks/use-push-subscription.ts`

- [ ] **Step 1: Убедиться, что потребителей нет**

Run: `grep -rn "use-push-subscription\|push-service" src/ --include='*.ts' --include='*.tsx' | grep -v 'src/hooks/use-push-subscription.ts' | grep -v 'src/services/push-service/'`
Expected: пусто. Если не пусто — СТОП: появился новый потребитель, сначала переключить его на `@/features/preferences`.

- [ ] **Step 2: Удалить файлы (только по имени, без `git add -A`)**

```bash
git rm src/services/push-service/push-service.ts
git rm src/hooks/use-push-subscription.ts
```

(`src/services/` после этого может остаться пустой в git — это нормально: git пустые директории не хранит. Локальный `.DS_Store` не трогать.)

- [ ] **Step 3: Верификация**

Run: `npm run lint && npm test && npm run build`
Expected: зелёные. `public/sw.js` менять/коммитить не нужно: push-обработчик (`sw.js:147`) уже понимает payload бекенда `{title, body, url}` (`internal/push/webpush_sender.go:25`); diff `SW_VERSION` — артефакт `npm run build`.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(foundation): remove legacy push-service and use-push-subscription (superseded by preferences slice)"
```

### Task B2: Ссылка «Настройки» в header

**Files:**
- Modify: `src/components/app/app-header/app-header.tsx` (замороженный — правка разрешена только в этом foundation-батче; батчевать с /calendar и /register-ссылками других фич волны)

- [ ] **Step 1: Добавить ссылку для залогиненного пользователя**

В `src/components/app/app-header/app-header.tsx` заменить блок:

```tsx
            {me ? (
              <LogoutForm username={me.username} />
            ) : (
```

на:

```tsx
            {me ? (
              <>
                <Link
                  href="/settings"
                  className="text-sm text-(--color-description) hover:text-(--color-primary)"
                >
                  Настройки
                </Link>
                <LogoutForm username={me.username} />
              </>
            ) : (
```

(`Link` уже импортирован в файле. Гостю ссылку не показываем — /settings всё равно редиректит на /login.)

- [ ] **Step 2: Верификация**

Run: `npm run lint && npm test && npm run build`
Expected: зелёные.

- [ ] **Step 3: Commit (в составе батча волны)**

```bash
git add src/components/app/app-header/app-header.tsx
git commit -m "chore(foundation): wave-1 header links (settings)"
```

---

## Риски и допущения

1. **`public/sw.js` diff** — происхождение выяснено: `scripts/generate-sw-assets.mjs` в `npm run build` бампает `SW_VERSION`. Митигейшен: не коммитить этот файл ни в части A, ни в B; решение о коммите бампа — за менеджером волны.
2. **`schema.ts` PATCH-body `Record<string, never>`** — известное расхождение типизации (swagger). Cast `as never` с комментарием; источник истины — бекенд (`internal/preference/service.go`), спека §10/§2.
3. **Бекенд без VAPID-ключей** (dev-окружение) — `/api/push/vapid-key` отвечает 503; `getVapidKey()` возвращает `null`, toggle показывает «временно недоступны». Страница настроек работоспособна.
4. **`navigator.serviceWorker.ready` может «висеть»**, если SW не зарегистрирован (например, регистрация в `update-prompt` упала). Состояние toggle останется «Проверяем подписку…» — деградация мягкая, не блокирует остальную страницу.
5. **Тесты браузерного Push API не пишем** — по конвенции (§5: UI-примитивы не тестируем); вся проверяемая логика вынесена в schemas/permissions и покрыта.
6. **Суспендед-пользователь**: server actions вернут `code: "forbidden"` ещё до похода в бекенд (`isMutationAllowed`), UI показывает branded-текст; страница `/settings` при этом читается (бекенд GET для suspended отдаёт данные — RequireActor).
7. **Допущение:** `reading_mode` пока нигде не применяется на фронте (страница лекции его не читает) — фича покрывает API-поверхность; применение режима чтения — забота фичи `lecture-enrichment`/последующих волн.
8. **Между мержами A и B** на main лежит мёртвый код (`push-service.ts`, `use-push-subscription.ts`) — не используется ничем, удаляется в B. ESLint на мёртвые файлы не ругается.
