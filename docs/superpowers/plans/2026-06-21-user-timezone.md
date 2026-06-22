# User Timezone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать пользователю выбор таймзоны отображения дат (преференс на бэке), сделав часовой пояс явным централизованным параметром слоя форматтера и попутно устранив hydration mismatch и dev/prod-дрейф.

**Architecture:** TZ едет по тем же рельсам, что `locale`/`appearance`: cookie `tz` (JSON `{pref, resolved}`) для синхронного SSR + синк в `/api/me/preferences`. Форматтер `getFmt(locale, timeZone)` подмешивает зону в дефолтные опции; `getServerFmt()`/`useFmt()` поставляют её из cookie (сервер) и из `TimezoneProvider` (клиент). `system` резолвится на клиенте (`Intl`), сервер до этого рендерит фолбэком `Europe/Moscow`; первый клиентский рендер совпадает с SSR → mismatch не возникает.

**Tech Stack:** Next.js App Router, TypeScript, next-intl, `Intl.DateTimeFormat`, openapi-fetch, Zod, vitest + @testing-library/react, pnpm.

**Спека:** [docs/superpowers/specs/2026-06-21-user-timezone-design.md](../specs/2026-06-21-user-timezone-design.md)

## Global Constraints

- Пакетный менеджер — **pnpm** (никогда npm). Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.
- Имена файлов в `src/` — **kebab-case**.
- Это **foundation-update PR**: касание `src/i18n/*`, `src/app/layout.tsx`, `src/utils/*` допустимо (для feature-слайсов запрещено). Не смешивать с прочими фичами.
- `git add` — **только перечисленные файлы по имени**. Запрещены `git add -A/.`, `git stash/reset/checkout .//clean`. Не трогать чужие изменения.
- Фолбэк-зона для `system` на сервере — **`Europe/Moscow`**.
- Правило дат: **таймстемп** (RFC3339 со временем, даже если выводится одной датой) → зона преференса; **чистая дата** (нет времени в данных: `all_day`-события, синтетическая метка месяца, календарная сетка) → всегда `timeZone:"UTC"`.
- Баннеры и **timed-события** — дисплей **оставляем UTC** (связаны с `datetime-local`-формами, вне объёма; иначе админ вводит 19:00, а видит сдвиг). Менять их в этом PR нельзя.
- Бэкенд-контракт: `preference.Preferences.timezone: string` (IANA либо `"system"`, поле всегда есть, дефолт `"system"`); неизвестная зона при PATCH → 422.
- Каждый commit заканчивается строкой: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

**Создаём:**
- `src/utils/timezone.ts` — client-safe модель cookie: типы, константы, parse/serialize, валидность зоны.
- `src/utils/timezone-server.ts` — server-only резолв: `getStoredTzPref()`, `getServerTz()`.
- `src/i18n/persist-timezone.ts` — server action PATCH `timezone`.
- `src/components/timezone/timezone-provider.tsx` — `TimezoneProvider` + `useTz()` + коррекция `system` на mount.
- `src/components/timezone/index.ts` — публичный barrel.
- `src/app/me/settings/timezone-settings.tsx` — UI-селектор зоны.
- Тесты: `*.test.ts(x)` рядом с каждым новым модулем.

**Изменяем:**
- `src/i18n/format.ts` — `getFmt(locale, timeZone?)`.
- `src/i18n/index.ts` — `getServerFmt()` подставляет tz.
- `src/i18n/client.tsx` — `useFmt()` через `useTz()`.
- `src/app/layout.tsx` — seed + монтаж `TimezoneProvider`.
- `src/app/me/settings/page.tsx` — секция настроек.
- `src/i18n/messages/ru/settings.ts`, `src/i18n/messages/en/settings.ts` — строки.
- `src/components/revision-history/revision-history.tsx`, `src/app/saved/saved-lecture-view.tsx` — снять `timeZone:"UTC"` (таймстемпы).
- `src/features/comments/comment-format.ts` + цепочка вызывающих — добавить tz-параметр.

---

### Task 1: Cookie-модель таймзоны (`timezone.ts`)

**Files:**
- Create: `src/utils/timezone.ts`
- Test: `src/utils/timezone.test.ts`

**Interfaces:**
- Produces:
  - `TZ_COOKIE: "tz"`, `DEFAULT_TZ_PREF: "system"`, `FALLBACK_ZONE: "Europe/Moscow"`
  - `type TzPref = "system" | string` (IANA), `interface TzCookie { pref: TzPref; resolved: string }`
  - `isValidZone(z: unknown): z is string`
  - `normalizeTzPref(raw: unknown): TzPref` — валидная зона или `"system"`
  - `parseTzCookie(raw: string | undefined): TzCookie`
  - `serializeTzCookie(v: TzCookie): string`

- [ ] **Step 1: Написать падающий тест**

```ts
// src/utils/timezone.test.ts
import { describe, it, expect } from "vitest";

import {
  parseTzCookie,
  serializeTzCookie,
  normalizeTzPref,
  isValidZone,
  FALLBACK_ZONE,
} from "./timezone";

describe("timezone cookie model", () => {
  it("validates IANA zones", () => {
    expect(isValidZone("Europe/Moscow")).toBe(true);
    expect(isValidZone("Mars/Phobos")).toBe(false);
    expect(isValidZone(42)).toBe(false);
  });

  it("normalizes preference: valid zone kept, junk → system", () => {
    expect(normalizeTzPref("Europe/Moscow")).toBe("Europe/Moscow");
    expect(normalizeTzPref("system")).toBe("system");
    expect(normalizeTzPref("garbage")).toBe("system");
    expect(normalizeTzPref(undefined)).toBe("system");
  });

  it("parses missing/invalid cookie to system + fallback", () => {
    expect(parseTzCookie(undefined)).toEqual({ pref: "system", resolved: FALLBACK_ZONE });
    expect(parseTzCookie("not-json")).toEqual({ pref: "system", resolved: FALLBACK_ZONE });
  });

  it("parses concrete zone: resolved forced to equal pref", () => {
    const raw = serializeTzCookie({ pref: "Asia/Tokyo", resolved: "Asia/Tokyo" });
    expect(parseTzCookie(raw)).toEqual({ pref: "Asia/Tokyo", resolved: "Asia/Tokyo" });
  });

  it("parses system: keeps a valid resolved zone, repairs invalid one to fallback", () => {
    const ok = serializeTzCookie({ pref: "system", resolved: "America/New_York" });
    expect(parseTzCookie(ok)).toEqual({ pref: "system", resolved: "America/New_York" });

    const bad = JSON.stringify({ pref: "system", resolved: "garbage" });
    expect(parseTzCookie(bad)).toEqual({ pref: "system", resolved: FALLBACK_ZONE });
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/utils/timezone.test.ts`
Expected: FAIL — `Cannot find module "./timezone"`.

- [ ] **Step 3: Реализовать модуль**

```ts
// src/utils/timezone.ts
// Client-safe модель оси таймзоны (без server-only / next). Зеркало locales.ts +
// appearance-cookie.ts. Cookie хранит JSON { pref, resolved }: pref — выбор
// пользователя (system|IANA, зеркалит бэк, рулит Select); resolved — конкретная
// IANA-зона для форматтера.

export const TZ_COOKIE = "tz";
/** Серверный фолбэк для `system`, пока клиент не определил браузерную зону. */
export const FALLBACK_ZONE = "Europe/Moscow";
export const DEFAULT_TZ_PREF: TzPref = "system";

/** Хранимое предпочтение: "system" либо валидная IANA-зона. */
export type TzPref = "system" | string;

export interface TzCookie {
  pref: TzPref;
  /** Всегда валидная IANA-зона — то, что уходит в Intl.DateTimeFormat. */
  resolved: string;
}

/** Принимает ли среда зону (валидная IANA). Работает и на сервере, и в браузере. */
export function isValidZone(z: unknown): z is string {
  if (typeof z !== "string" || z.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: z });
    return true;
  } catch {
    return false;
  }
}

/** Сырое значение → TzPref: валидная зона остаётся, всё прочее → "system". */
export function normalizeTzPref(raw: unknown): TzPref {
  if (raw === "system") return "system";
  return isValidZone(raw) ? raw : "system";
}

export function serializeTzCookie(v: TzCookie): string {
  return JSON.stringify(v);
}

/** Сырое cookie → нормализованный TzCookie (никогда не бросает). */
export function parseTzCookie(raw: string | undefined): TzCookie {
  if (!raw) return { pref: "system", resolved: FALLBACK_ZONE };
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { pref: "system", resolved: FALLBACK_ZONE };
  }
  const pref = normalizeTzPref(o.pref);
  if (pref !== "system") {
    // Конкретная зона — resolved всегда совпадает с pref.
    return { pref, resolved: pref };
  }
  const resolved = isValidZone(o.resolved) ? (o.resolved as string) : FALLBACK_ZONE;
  return { pref: "system", resolved };
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/utils/timezone.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/utils/timezone.ts src/utils/timezone.test.ts
git commit -m "feat(timezone): cookie-модель оси таймзоны (pref/resolved)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Серверный резолв таймзоны (`timezone-server.ts`)

**Files:**
- Create: `src/utils/timezone-server.ts`
- Test: `src/utils/timezone-server.test.ts`

**Interfaces:**
- Consumes: `parseTzCookie`, `normalizeTzPref`, `isValidZone`, `TZ_COOKIE`, `FALLBACK_ZONE`, `DEFAULT_TZ_PREF`, `TzPref` (Task 1); `getMe` (`@/utils/me`); `getPreferences` (`@/features/preferences`).
- Produces:
  - `getStoredTzPref(): Promise<TzPref>` — cookie-first, backend-seed для авторизованных.
  - `getServerTz(): Promise<string>` — конкретная IANA для форматтера.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/utils/timezone-server.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: cookieGet }),
}));
const getMe = vi.fn();
vi.mock("@/utils/me", () => ({ getMe: () => getMe() }));
const getPreferences = vi.fn();
vi.mock("@/features/preferences", () => ({ getPreferences: () => getPreferences() }));

import { getStoredTzPref, getServerTz } from "./timezone-server";

beforeEach(() => {
  vi.clearAllMocks();
  cookieGet.mockReturnValue(undefined);
  getMe.mockResolvedValue(null);
});

describe("getServerTz", () => {
  it("cookie с конкретной зоной → она же", async () => {
    cookieGet.mockReturnValue({ value: JSON.stringify({ pref: "Asia/Tokyo", resolved: "Asia/Tokyo" }) });
    expect(await getServerTz()).toBe("Asia/Tokyo");
  });

  it("cookie system + resolved → resolved", async () => {
    cookieGet.mockReturnValue({ value: JSON.stringify({ pref: "system", resolved: "America/New_York" }) });
    expect(await getServerTz()).toBe("America/New_York");
  });

  it("нет cookie, гость → фолбэк Europe/Moscow", async () => {
    expect(await getServerTz()).toBe("Europe/Moscow");
  });

  it("нет cookie, авторизован, бэк отдал зону → она", async () => {
    getMe.mockResolvedValue({ id: "u1" });
    getPreferences.mockResolvedValue({ timezone: "Europe/Berlin" });
    expect(await getServerTz()).toBe("Europe/Berlin");
  });

  it("нет cookie, авторизован, бэк отдал system → фолбэк", async () => {
    getMe.mockResolvedValue({ id: "u1" });
    getPreferences.mockResolvedValue({ timezone: "system" });
    expect(await getServerTz()).toBe("Europe/Moscow");
  });
});

describe("getStoredTzPref", () => {
  it("нет cookie, бэк отдал зону → зона", async () => {
    getMe.mockResolvedValue({ id: "u1" });
    getPreferences.mockResolvedValue({ timezone: "Europe/Berlin" });
    expect(await getStoredTzPref()).toBe("Europe/Berlin");
  });

  it("бэк упал → DEFAULT_TZ_PREF (system)", async () => {
    getMe.mockResolvedValue({ id: "u1" });
    getPreferences.mockRejectedValue(new Error("boom"));
    expect(await getStoredTzPref()).toBe("system");
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/utils/timezone-server.test.ts`
Expected: FAIL — `Cannot find module "./timezone-server"`.

- [ ] **Step 3: Реализовать модуль**

```ts
// src/utils/timezone-server.ts
import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { getPreferences } from "@/features/preferences";
import { getMe } from "@/utils/me";

import {
  TZ_COOKIE,
  FALLBACK_ZONE,
  DEFAULT_TZ_PREF,
  parseTzCookie,
  normalizeTzPref,
  isValidZone,
  type TzPref,
} from "./timezone";

/** Хранимое предпочтение (system|IANA): cookie-first, backend-seed для залогиненных. */
export const getStoredTzPref = cache(async (): Promise<TzPref> => {
  const store = await cookies();
  const raw = store.get(TZ_COOKIE)?.value;
  if (raw) return parseTzCookie(raw).pref;
  try {
    if (await getMe()) {
      const prefs = await getPreferences();
      return normalizeTzPref(prefs.timezone);
    }
  } catch {
    /* graceful: дефолт */
  }
  return DEFAULT_TZ_PREF;
});

/** Конкретная IANA-зона для форматтера. `system` → фолбэк, пока клиент не уточнил. */
export const getServerTz = cache(async (): Promise<string> => {
  const store = await cookies();
  const raw = store.get(TZ_COOKIE)?.value;
  if (raw) return parseTzCookie(raw).resolved;
  const pref = await getStoredTzPref();
  return pref !== "system" && isValidZone(pref) ? pref : FALLBACK_ZONE;
});
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/utils/timezone-server.test.ts`
Expected: PASS (7 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/utils/timezone-server.ts src/utils/timezone-server.test.ts
git commit -m "feat(timezone): серверный резолв зоны (cookie-first + backend seed)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Форматтер принимает таймзону (`getFmt(locale, timeZone)`)

**Files:**
- Modify: `src/i18n/format.ts:35-55`
- Modify: `src/i18n/index.ts:79-82`
- Test: `src/i18n/format.test.ts` (дополнить)

**Interfaces:**
- Consumes: `getServerTz` (Task 2), `getLocale` (`./locale.server`).
- Produces: `getFmt(locale?: ResolvedLocale, timeZone?: string): Formatters` — `dateTime` подмешивает `timeZone` в опции, **caller-override приоритетен**. `getServerFmt()` теперь = `getFmt(await getLocale(), await getServerTz())`.

- [ ] **Step 1: Дополнить тест (падающий)**

Добавить в `src/i18n/format.test.ts`:

```ts
describe("getFmt timeZone injection", () => {
  const iso = "2026-06-21T22:30:00Z";

  it("инъецирует timeZone в дефолтные опции", () => {
    const moscow = getFmt("ru", "Europe/Moscow").dateTime(iso, { timeStyle: "short", dateStyle: "short" });
    const tokyo = getFmt("ru", "Asia/Tokyo").dateTime(iso, { timeStyle: "short", dateStyle: "short" });
    expect(moscow).not.toBe(tokyo); // 01:30 МСК vs 07:30 JST
  });

  it("opts.timeZone переопределяет инъекцию (date-only остаётся UTC)", () => {
    const a = getFmt("ru", "Asia/Tokyo").dateTime(iso, { dateStyle: "short", timeZone: "UTC" });
    const b = getFmt("ru", "Europe/Moscow").dateTime(iso, { dateStyle: "short", timeZone: "UTC" });
    expect(a).toBe(b); // обе форсят UTC → одинаково
  });

  it("без timeZone-аргумента поведение прежнее (ambient)", () => {
    expect(typeof getFmt("ru").dateTime(iso, { dateStyle: "short" })).toBe("string");
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/i18n/format.test.ts`
Expected: FAIL — `getFmt("ru","Europe/Moscow")` возвращает то же, что Tokyo (зона игнорируется), assert `not.toBe` падает.

- [ ] **Step 3: Реализовать инъекцию**

В `src/i18n/format.ts` заменить сигнатуру и метод `dateTime`:

```ts
export function getFmt(
  locale: ResolvedLocale = DEFAULT_LOCALE,
  timeZone?: string,
): Formatters {
  const tag = BCP47[locale];
  return {
    dateTime(value, opts) {
      const d = toDate(value);
      if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "";
      // timeZone-дефолт подмешивается, но opts.timeZone (если задан) приоритетен.
      const merged = timeZone ? { timeZone, ...opts } : opts;
      return keyed(dtfCache, tag, merged, () => new Intl.DateTimeFormat(tag, merged)).format(d);
    },
    number(value, opts) {
      return keyed(nfCache, tag, opts, () => new Intl.NumberFormat(tag, opts)).format(value);
    },
    relativeTime(value, unit, opts) {
      return keyed(rtfCache, tag, opts, () => new Intl.RelativeTimeFormat(tag, opts)).format(
        value,
        unit,
      );
    },
  };
}
```

> Примечание: ключ кеша теперь строится из `merged` (включает зону) — коллизий между разными зонами нет.

В `src/i18n/index.ts` обновить `getServerFmt` и импорт:

```ts
import { getServerTz } from "@/utils/timezone-server";
// ...
/** Форматтеры для текущей серверной локали + таймзоны пользователя. */
export async function getServerFmt(): Promise<Formatters> {
  const [locale, tz] = await Promise.all([getLocale(), getServerTz()]);
  return getFmt(locale, tz);
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/i18n/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/format.ts src/i18n/index.ts src/i18n/format.test.ts
git commit -m "feat(i18n): getFmt принимает timeZone; getServerFmt отдаёт зону пользователя

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Клиентский провайдер таймзоны (`TimezoneProvider` + `useTz`)

**Files:**
- Create: `src/components/timezone/timezone-provider.tsx`
- Create: `src/components/timezone/index.ts`
- Test: `src/components/timezone/timezone-provider.test.tsx`

**Interfaces:**
- Consumes: `TZ_COOKIE`, `serializeTzCookie`, `isValidZone`, `type TzCookie` (Task 1).
- Produces:
  - `TimezoneProvider({ initial: TzCookie, children }): JSX` — держит `resolved` в state, на mount уточняет `system` из браузера.
  - `useTz(): string` — текущая resolved-зона из контекста (вне провайдера → `FALLBACK_ZONE`).

- [ ] **Step 1: Написать падающий тест**

```tsx
// src/components/timezone/timezone-provider.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

import { TimezoneProvider, useTz } from "./timezone-provider";

function Probe() {
  return <span data-testid="tz">{useTz()}</span>;
}

beforeEach(() => {
  Object.defineProperty(document, "cookie", { writable: true, value: "" });
});
afterEach(() => vi.restoreAllMocks());

describe("TimezoneProvider", () => {
  it("первый рендер использует серверный resolved (без коррекции для concrete pref)", () => {
    render(
      <TimezoneProvider initial={{ pref: "Asia/Tokyo", resolved: "Asia/Tokyo" }}>
        <Probe />
      </TimezoneProvider>,
    );
    expect(screen.getByTestId("tz").textContent).toBe("Asia/Tokyo");
  });

  it("system: после mount уточняет браузерную зону и пишет cookie", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () => ({ resolvedOptions: () => ({ timeZone: "America/New_York" }) }) as unknown as Intl.DateTimeFormat,
    );
    act(() => {
      render(
        <TimezoneProvider initial={{ pref: "system", resolved: "Europe/Moscow" }}>
          <Probe />
        </TimezoneProvider>,
      );
    });
    expect(screen.getByTestId("tz").textContent).toBe("America/New_York");
    expect(document.cookie).toContain("tz=");
  });

  it("system: браузерная зона совпала с resolved → cookie не пишется", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () => ({ resolvedOptions: () => ({ timeZone: "Europe/Moscow" }) }) as unknown as Intl.DateTimeFormat,
    );
    act(() => {
      render(
        <TimezoneProvider initial={{ pref: "system", resolved: "Europe/Moscow" }}>
          <Probe />
        </TimezoneProvider>,
      );
    });
    expect(screen.getByTestId("tz").textContent).toBe("Europe/Moscow");
    expect(document.cookie).toBe("");
  });

  it("useTz вне провайдера → фолбэк", () => {
    render(<Probe />);
    expect(screen.getByTestId("tz").textContent).toBe("Europe/Moscow");
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/components/timezone/timezone-provider.test.tsx`
Expected: FAIL — `Cannot find module "./timezone-provider"`.

- [ ] **Step 3: Реализовать провайдер**

```tsx
// src/components/timezone/timezone-provider.tsx
"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { TZ_COOKIE, FALLBACK_ZONE, serializeTzCookie, isValidZone, type TzCookie } from "@/utils/timezone";

const TzContext = createContext<string>(FALLBACK_ZONE);

/** Текущая resolved-зона (IANA). Вне провайдера — фолбэк. */
export function useTz(): string {
  return useContext(TzContext);
}

function writeCookie(c: TzCookie): void {
  document.cookie = `${TZ_COOKIE}=${encodeURIComponent(serializeTzCookie(c))}; path=/; max-age=31536000; samesite=lax; secure`;
}

/**
 * Держит resolved-зону. Первый рендер = серверное значение (совпадает с SSR →
 * без hydration mismatch). Если pref="system" — на mount уточняет браузерную
 * зону и, при отличии, обновляет состояние + пишет cookie (pref не трогает).
 */
export function TimezoneProvider({ initial, children }: { initial: TzCookie; children: ReactNode }) {
  const [resolved, setResolved] = useState(initial.resolved);
  const prefRef = useRef(initial.pref);

  useEffect(() => {
    if (prefRef.current !== "system") return;
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isValidZone(browser) && browser !== resolved) {
      setResolved(browser);
      writeCookie({ pref: "system", resolved: browser });
    }
  }, [resolved]);

  return <TzContext.Provider value={resolved}>{children}</TzContext.Provider>;
}
```

```ts
// src/components/timezone/index.ts
export { TimezoneProvider, useTz } from "./timezone-provider";
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/components/timezone/timezone-provider.test.tsx`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add src/components/timezone/timezone-provider.tsx src/components/timezone/index.ts src/components/timezone/timezone-provider.test.tsx
git commit -m "feat(timezone): TimezoneProvider + useTz с коррекцией system на клиенте

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Подключить `useFmt` к зоне и смонтировать провайдер

**Files:**
- Modify: `src/i18n/client.tsx:32-35`
- Modify: `src/app/layout.tsx:93-96` (seed) и `:120-121` (монтаж)

**Interfaces:**
- Consumes: `useTz` (Task 4), `getStoredTzPref`/`getServerTz` (Task 2).
- Produces: `useFmt()` теперь = `getFmt(useLocale(), useTz())`. `TimezoneProvider` обёрнут вокруг дерева внутри `I18nProvider`.

- [ ] **Step 1: Обновить `useFmt`**

В `src/i18n/client.tsx`:

```tsx
import { useTz } from "@/components/timezone";
// ...
/** Форматтеры для текущей клиентской локали + таймзоны пользователя. */
export function useFmt(): Formatters {
  return getFmt(useLocale(), useTz());
}
```

- [ ] **Step 2: Смонтировать провайдер в layout**

В `src/app/layout.tsx` добавить импорт и seed рядом со строкой 93-96:

```tsx
import { TimezoneProvider } from "@/components/timezone";
import { getStoredTzPref, getServerTz } from "@/utils/timezone-server";
// ... внутри компонента, рядом с getAppearance/getLocale:
const [tzPref, tzResolved] = await Promise.all([getStoredTzPref(), getServerTz()]);
```

Обернуть дерево: `TimezoneProvider` внутри `I18nProvider` (чтобы `useFmt` видел и locale, и зону), снаружи `AppearanceProvider`:

```tsx
<I18nProvider locale={locale} messages={messages}>
  <TimezoneProvider initial={{ pref: tzPref, resolved: tzResolved }}>
    <AppearanceProvider initial={appearance}>
      {/* ... существующее содержимое ... */}
    </AppearanceProvider>
  </TimezoneProvider>
</I18nProvider>
```

- [ ] **Step 3: Проверить сборку и существующие тесты (регрессия useFmt)**

Run: `pnpm exec vitest run src/features/tokens src/features/share-links src/app/saved`
Expected: PASS (компоненты, использующие `useFmt`, теперь тянут `useTz` — в тестах вне провайдера вернётся фолбэк; если какой-то тест ассертил конкретную строку даты — обновить в Task 10).

Run: `pnpm build`
Expected: успешная сборка (нет ошибок типов на изменённых сигнатурах).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/client.tsx src/app/layout.tsx
git commit -m "feat(i18n): useFmt отдаёт зону пользователя; монтаж TimezoneProvider

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Server action синка таймзоны (`persist-timezone.ts`)

**Files:**
- Create: `src/i18n/persist-timezone.ts`
- Test: `src/i18n/persist-timezone.test.ts`

**Interfaces:**
- Consumes: `createApiClient` (`@/api/client`), `getMe` (`@/utils/me`), `type TzPref` (Task 1).
- Produces: `persistTimezone(pref: TzPref): Promise<void>` — graceful PATCH `/api/me/preferences` с `{ timezone: pref }`; аноним → no-op.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/i18n/persist-timezone.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const patch = vi.fn();
vi.mock("@/api/client", () => ({ createApiClient: () => Promise.resolve({ PATCH: patch }) }));
const getMe = vi.fn();
vi.mock("@/utils/me", () => ({ getMe: () => getMe() }));

import { persistTimezone } from "./persist-timezone";

beforeEach(() => {
  vi.clearAllMocks();
  patch.mockResolvedValue({ data: {}, error: undefined });
});

describe("persistTimezone", () => {
  it("аноним → PATCH не вызывается", async () => {
    getMe.mockResolvedValue(null);
    await persistTimezone("Europe/Moscow");
    expect(patch).not.toHaveBeenCalled();
  });

  it("залогинен → PATCH с timezone", async () => {
    getMe.mockResolvedValue({ id: "u1" });
    await persistTimezone("Asia/Tokyo");
    expect(patch).toHaveBeenCalledWith("/api/me/preferences", { body: { timezone: "Asia/Tokyo" } });
  });

  it("ошибка бэка не пробрасывается (graceful)", async () => {
    getMe.mockResolvedValue({ id: "u1" });
    patch.mockRejectedValue(new Error("boom"));
    await expect(persistTimezone("system")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/i18n/persist-timezone.test.ts`
Expected: FAIL — `Cannot find module "./persist-timezone"`.

- [ ] **Step 3: Реализовать action**

```ts
// src/i18n/persist-timezone.ts
"use server";
import "server-only";

import { createApiClient } from "@/api/client";
import { getMe } from "@/utils/me";
import type { TzPref } from "@/utils/timezone";

/** Сохранить выбранную зону на бэк (cookie пишется на клиенте). Graceful. */
export async function persistTimezone(pref: TzPref): Promise<void> {
  try {
    const me = await getMe();
    if (!me) return; // аноним — только cookie
    const api = await createApiClient();
    await api.PATCH("/api/me/preferences", { body: { timezone: pref } });
  } catch {
    /* graceful */
  }
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/i18n/persist-timezone.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/persist-timezone.ts src/i18n/persist-timezone.test.ts
git commit -m "feat(timezone): persistTimezone — синк зоны в /api/me/preferences

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: UI-селектор зоны в настройках

**Files:**
- Create: `src/app/me/settings/timezone-settings.tsx`
- Modify: `src/app/me/settings/page.tsx:35-41` (Promise.all) и `:53-56` (секция)
- Modify: `src/i18n/messages/ru/settings.ts`, `src/i18n/messages/en/settings.ts`

**Interfaces:**
- Consumes: `persistTimezone` (Task 6), `getStoredTzPref` (Task 2), `TZ_COOKIE`, `serializeTzCookie`, `isValidZone`, `FALLBACK_ZONE`, `type TzPref` (Task 1).
- Produces: `<TimezoneSettings initial={TzPref} />`.

- [ ] **Step 1: Добавить строки в namespace `settings` (ru)**

В `src/i18n/messages/ru/settings.ts` рядом с блоком locale (после `localeEn`):

```ts
  timezoneLabelRow: "Часовой пояс",
  timezoneAriaLabel: "Выбор часового пояса",
  timezoneSystem: "Авто (как в браузере)",
```

И в `src/i18n/messages/en/settings.ts` (тот же набор ключей):

```ts
  timezoneLabelRow: "Time zone",
  timezoneAriaLabel: "Time zone selection",
  timezoneSystem: "Auto (from browser)",
```

- [ ] **Step 2: Реализовать компонент**

```tsx
// src/app/me/settings/timezone-settings.tsx
"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useTransition } from "react";

import { Select } from "@/components/ui";
import { useT } from "@/i18n/client";
import { persistTimezone } from "@/i18n/persist-timezone";
import {
  TZ_COOKIE,
  FALLBACK_ZONE,
  serializeTzCookie,
  isValidZone,
  type TzPref,
} from "@/utils/timezone";

/** Полный список IANA-зон среды; гарантированно валиден для бэка (no 422). */
function zoneOptions(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [FALLBACK_ZONE, "UTC"];
  }
}

export function TimezoneSettings({ initial }: { initial: TzPref }) {
  const t = useT("settings");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const options = useMemo(
    () => [
      { value: "system", label: t("timezoneSystem") },
      ...zoneOptions().map((z) => ({ value: z, label: z })),
    ],
    [t],
  );

  function onChange(v: string) {
    const pref: TzPref = v === "system" ? "system" : v;
    const resolved =
      pref !== "system"
        ? pref
        : isValidZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : FALLBACK_ZONE;
    document.cookie = `${TZ_COOKIE}=${encodeURIComponent(serializeTzCookie({ pref, resolved }))}; path=/; max-age=31536000; samesite=lax; secure`;
    void persistTimezone(pref);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Row label={t("timezoneLabelRow")}>
      <Select
        aria-label={t("timezoneAriaLabel")}
        options={options}
        value={initial}
        onValueChange={onChange}
        disabled={pending}
      />
    </Row>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}
```

> Если `Row` уже экспортируется из общего места — переиспользовать его вместо локального дубля. Сверься с `locale-settings.tsx` (там `Row` локальный) — допустимо повторить паттерн.

- [ ] **Step 3: Подключить в страницу настроек**

В `src/app/me/settings/page.tsx` добавить импорты `TimezoneSettings` и `getStoredTzPref`, расширить `Promise.all`:

```tsx
const [prefs, vapidPublicKey, historySettings, storedLocale, storedTimezone] =
  await Promise.all([
    getPreferences(),
    getVapidKey(),
    getHistorySettings(),
    getStoredLocale(),
    getStoredTzPref(),
  ]);
```

В секции языка (`sectionLanguage`) добавить селектор зоны под `LocaleSettings`:

```tsx
<section className="flex flex-col gap-3">
  <h2 className="text-lg font-semibold">{t("sectionLanguage")}</h2>
  <LocaleSettings initial={storedLocale} />
  <TimezoneSettings initial={storedTimezone} />
</section>
```

- [ ] **Step 4: Проверить сборку + типобезопасность ключей i18n**

Run: `pnpm build`
Expected: успешно (новые ключи `timezone*` присутствуют в ru и en → `tsc` по AppConfig не краснеет).

Run: `pnpm exec vitest run src/i18n`
Expected: PASS (включая ICU-parity тест ru/en, если он сверяет наборы ключей).

- [ ] **Step 5: Commit**

```bash
git add src/app/me/settings/timezone-settings.tsx src/app/me/settings/page.tsx src/i18n/messages/ru/settings.ts src/i18n/messages/en/settings.ts
git commit -m "feat(settings): селектор часового пояса (Авто + полный список IANA)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Снять `timeZone:"UTC"` с таймстемп-мест (наследуют зону пользователя)

**Files:**
- Modify: `src/components/revision-history/revision-history.tsx:7-14`
- Modify: `src/app/saved/saved-lecture-view.tsx:182-185`

**Interfaces:**
- Consumes: `getServerFmt`/`useFmt` уже отдают зону (Tasks 3, 5).
- Produces: `rev.createdAt` и `state.savedAt` рендерятся в зоне преференса.

Эти значения — настоящие инстанты (createdAt ревизии — серверный; savedAt — `toISOString()` момента сохранения), не form-entered → корректно показывать в зоне пользователя.

- [ ] **Step 1: revision-history — убрать UTC из `DATE_OPTS`**

В `src/components/revision-history/revision-history.tsx` убрать строку `timeZone: "UTC",` из `DATE_OPTS` (строки 7-14):

```tsx
const DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};
```

- [ ] **Step 2: saved-lecture-view — убрать UTC**

В `src/app/saved/saved-lecture-view.tsx` (строки 182-185):

```tsx
{fmt.dateTime(new Date(state.savedAt), {
  dateStyle: "short",
})}
```

- [ ] **Step 3: Проверить тесты этих модулей**

Run: `pnpm exec vitest run src/components/revision-history src/app/saved`
Expected: PASS (если есть снапшот/ассерт конкретной строки даты — обновить под зону теста; в юните без провайдера зона = ambient, поведение прежнее).

- [ ] **Step 4: Commit**

```bash
git add src/components/revision-history/revision-history.tsx src/app/saved/saved-lecture-view.tsx
git commit -m "fix(dates): ревизии и savedAt — в зоне пользователя, не UTC

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Комментарии в зоне пользователя (`formatCommentDate` + проброс tz)

**Files:**
- Modify: `src/features/comments/comment-format.ts:8-18`
- Modify: `src/features/comments/ui/admin-comment-row.tsx` (server, есть `getLocale`)
- Modify: `src/features/comments/ui/comment-node-view.tsx` (проп `locale` → добавить проп `tz`)
- Modify: контейнеры, прокидывающие проп (`comment-node`, `comment-tree-view` — найти grep'ом) + офлайн-путь `saved-lecture-view.tsx:249`
- Test: `src/features/comments/comment-format.test.ts` (если есть — дополнить; иначе создать)

**Interfaces:**
- Consumes: `getFmt` (Task 3, с tz), `getServerTz`/`useTz` для резолва зоны у вызывающих.
- Produces: `formatCommentDate(iso?, locale?, tz?)` — третий параметр `tz?: string` подмешивается в `getFmt`; дефолт сохраняет текущее поведение (UTC) для несмигрированных вызывающих.

`created_at` комментария — серверный инстант → показываем в зоне пользователя. Pure-функция используется и в офлайн-снимке, поэтому tz пробрасывается параметром (как `locale`), а не через хук.

- [ ] **Step 1: Дополнить/создать тест**

```ts
// src/features/comments/comment-format.test.ts
import { describe, it, expect } from "vitest";
import { formatCommentDate } from "./comment-format";

describe("formatCommentDate tz", () => {
  const iso = "2026-06-21T22:30:00Z";
  it("разные зоны дают разный результат", () => {
    expect(formatCommentDate(iso, "ru", "Europe/Moscow")).not.toBe(
      formatCommentDate(iso, "ru", "Asia/Tokyo"),
    );
  });
  it("без tz — обратная совместимость (UTC)", () => {
    expect(formatCommentDate(iso, "ru")).toBe(formatCommentDate(iso, "ru", "UTC"));
  });
  it("пустая строка → пусто", () => {
    expect(formatCommentDate(undefined, "ru", "Europe/Moscow")).toBe("");
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/features/comments/comment-format.test.ts`
Expected: FAIL — `formatCommentDate` игнорирует 3-й аргумент.

- [ ] **Step 3: Добавить tz-параметр в pure-функцию**

В `src/features/comments/comment-format.ts`:

```ts
import { getFmt } from "@/i18n/format";
import { DEFAULT_LOCALE, type ResolvedLocale } from "@/i18n/locales";

/** ISO → "дд.мм.гггг, чч:мм". Зона: tz (по умолчанию UTC — для обратной совместимости). */
export function formatCommentDate(
  iso?: string,
  locale: ResolvedLocale = DEFAULT_LOCALE,
  tz = "UTC",
): string {
  if (!iso) return "";
  return getFmt(locale, tz).dateTime(iso, {
    dateStyle: "short",
    timeStyle: "short",
  });
}
```

- [ ] **Step 4: Пробросить tz у вызывающих**

`src/features/comments/ui/admin-comment-row.tsx` (server) — добавить `getServerTz` в `Promise.all` и передать третьим аргументом:

```tsx
import { getServerTz } from "@/utils/timezone-server";
// ...
const [t, locale, tz] = await Promise.all([getT("comments"), getLocale(), getServerTz()]);
// ...
formatCommentDate(comment.created_at, locale, tz)
```

`src/features/comments/ui/comment-node-view.tsx` — добавить опциональный проп `tz?: string` рядом с `locale?` и передать в вызов `formatCommentDate(comment.created_at, locale, tz)`.

Прокинуть `tz` вниз по тем же контейнерам, что прокидывают `locale` (найти: `rg "locale=\{" src/features/comments/ui`):
- онлайн server-контейнер: резолвит `getServerTz()` и передаёт пропом;
- онлайн client-контейнер: `useTz()` и передаёт пропом;
- офлайн `src/app/saved/saved-lecture-view.tsx:249` — добавить `tz={useTz()}` рядом с `locale={locale}` (компонент уже client, импортировать `useTz` из `@/components/timezone`).

- [ ] **Step 5: Запустить тесты комментариев**

Run: `pnpm exec vitest run src/features/comments src/app/saved`
Expected: PASS.

Run: `pnpm build`
Expected: успешно (проп `tz` типобезопасно протянут по цепочке).

- [ ] **Step 6: Commit**

```bash
git add src/features/comments/comment-format.ts src/features/comments/comment-format.test.ts src/features/comments/ui/admin-comment-row.tsx src/features/comments/ui/comment-node-view.tsx src/app/saved/saved-lecture-view.tsx
# плюс прочие контейнеры, реально затронутые на шаге 4 — добавить по имени
git commit -m "feat(comments): даты комментариев в зоне пользователя

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Финальная верификация и регрессия снапшотов

**Files:**
- Modify: затронутые тест-файлы с ассертами конкретных строк дат (по факту падений).

**Interfaces:**
- Consumes: всё выше.
- Produces: зелёные `pnpm lint && pnpm test && pnpm build`.

- [ ] **Step 1: Прогнать полный тест-сьют, собрать падения**

Run: `pnpm test`
Expected: возможны падения в тестах, ассертивших дату в «плавающих» местах (audit/users/glossary/forms/submissions), которые теперь форматируются в зоне теста (ambient окружения), а не UTC. Это ожидаемо.

- [ ] **Step 2: Починить упавшие ассерты**

Для каждого упавшего теста привести ожидание в соответствие новому контракту: если тест проверяет конкретную строку — либо передавать фиксированную зону через провайдер/`getServerFmt`-мок, либо ассертить инвариант (непустая строка / соответствие зоне теста), а не хардкод UTC-времени. Date-only места (calendar grid, allDay-события, баннеры) обязаны остаться UTC — если их тест упал, это БАГ реализации, проверить, что `timeZone:"UTC"` сохранён.

- [ ] **Step 3: Подтвердить, что баннеры/timed-события не сменили зону**

Run: `pnpm exec vitest run src/features/banners src/features/events`
Expected: PASS без изменения ожиданий (их дисплей остаётся UTC — связаны с `datetime-local`-формами, вне объёма этого PR).

- [ ] **Step 4: Полная верификация**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное.

- [ ] **Step 5: Commit**

```bash
git add <перечислить реально изменённые тест-файлы по имени>
git commit -m "test(dates): актуализация ассертов под зону пользователя

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- Централизация TZ в форматтере → Tasks 3, 5. ✔
- Cookie-модель `{pref, resolved}` → Task 1. ✔
- Серверный резолв + backend seed → Task 2. ✔
- `system` резолв на клиенте без mismatch → Task 4 (первый рендер = серверный resolved; коррекция в `useEffect`). ✔
- Синк в `/api/me/preferences` → Task 6. ✔
- UI-селектор + строки → Task 7. ✔
- Правило дат (таймстемп→зона / чистая дата→UTC) → Tasks 8, 9 (миграция), 10 (защита date-only/grid). ✔
- Починка hydration-багов share-links/tokens → автоматически через Task 5 (useFmt тянет seeded-зону); проверка в Task 5 Step 3 и Task 10. ✔
- Баннеры/timed-события остаются UTC (форм-coupling) → Global Constraints + Task 10 Step 3. ✔
- Гость/no-JS/невалидная зона/422 → покрыто Tasks 1, 2, 7 (список из `supportedValuesOf` → 422 недостижим). ✔

**2. Placeholder scan:** в Task 9 Step 4 указание «найти контейнеры grep'ом» — это инструкция исполнителю на реальном дереве (цепочка проброса `locale` уже существует и зеркалится для `tz`); конкретные имена `admin-comment-row`/`comment-node-view`/`saved-lecture-view` даны. Прочие шаги содержат полный код. ✔

**3. Type consistency:** `TzPref`/`TzCookie`/`getStoredTzPref`/`getServerTz`/`persistTimezone`/`useTz`/`TimezoneProvider`/`getFmt(locale, timeZone)` — имена и сигнатуры согласованы между Tasks 1–9. ✔

**Зависимость от бэка:** типы `preference.Preferences.timezone` / `UpdatePreferencesRequest.timezone` уже в `src/api/schema.ts` (подтверждено) — регенерация схемы не требуется.
