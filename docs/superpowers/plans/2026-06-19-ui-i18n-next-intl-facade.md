# UI-only i18n (next-intl за фасадом @/i18n) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заложить инфраструктуру интернационализации UI (chrome) на next-intl, спрятанную за тонким фасадом `@/i18n`, так чтобы саму библиотеку можно было заменить переписыванием одного модуля; провести пилотную миграцию одного слайса (notifications) и форматтеров.

**Architecture:** next-intl подключается без URL-роутинга — локаль берётся из cookie `locale` (по образцу `appearance`-cookie), резолвится server-side в `ru|en` и кладётся в `getRequestConfig`. Весь прикладной код обращается к i18n ТОЛЬКО через `@/i18n` (server) и `@/i18n/client` (client); прямой импорт `next-intl` запрещён ESLint-гардом везде, кроме `src/i18n/**`. Сообщения хранятся в каталогах `ru.ts`/`en.ts` в **простом подмножестве ICU** (интерполяция `{var}` + `{count, plural, …}`) — это держит контент переносимым и делает будущую замену библиотеки дешёвой. Форматирование дат/чисел вынесено в чистый seam `getFmt(locale)` поверх нативного `Intl.*` (не зависит от next-intl).

**Tech Stack:** Next.js 16.1.4 (App Router, RSC, server actions), React 19.2.3 (reactCompiler infer), TypeScript 6, next-intl ^4.13, Zod 4, Tailwind 4, Vitest 4, pnpm 8.

## Global Constraints

- **Менеджер пакетов — ТОЛЬКО pnpm.** `npm install` ломает тулчейн и даёт ложные падения lint/test.
- **Параллельные агенты:** НЕ `git stash/reset/checkout .//clean`; НЕ `git add -A`/`git add .` — добавлять только свои файлы по имени; не трогать чужие изменения. Передавать это всем субагентам.
- **Фасад — единственная точка next-intl.** Прямой импорт `next-intl`/`next-intl/*` разрешён ТОЛЬКО в `src/i18n/**`. Прикладной код импортирует `@/i18n` (server) или `@/i18n/client` (client).
- **Сообщения — только простое подмножество ICU:** `{var}`-интерполяция и `{count, plural, one{…} few{…} many{…} other{…}}`. БЕЗ `select`, `selectordinal`, rich-тегов, date/number-skeleton внутри строк (это сохраняет переносимость и дешёвую замену).
- **Значения локали:** `system | ru | en`, дефолт `ru`. `system` резолвится в `ru|en` ДО передачи в любой `Intl.*`/next-intl API (строка `system` невалидна как BCP-47).
- **Cookie-first:** фича работает БЕЗ бэкенда (cookie самодостаточен). Бэк-синхронизация `locale` — аддитивна и gated (Task 12), как уже отложенный appearance Task 21.
- **Scope — UI-only:** переводим chrome интерфейса; контент (лекции/глоссарий) остаётся русским. RTL/logical-CSS вне scope (нет RTL-языков).
- **Frozen-зоны касаем осознанно (это санкционированный foundation-PR):** `package.json`, `next.config.ts`, `src/app/layout.tsx`, `eslint.config.mjs`. Прочие frozen-зоны не трогаем.
- **Перед PR зелёные:** `pnpm lint && pnpm test && pnpm build`.
- **Сообщения коммитов** завершать строкой: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Не пушить (push заблокирован) — только локальные коммиты.
- **Тесты:** Vitest с `globals: false` → импортировать `{ describe, it, expect, vi, beforeEach }` из `"vitest"` явно. `server-only` мокается через `vi.mock("server-only", () => ({}))` (alias-стаб настроен в vitest.config.ts).

---

### Task 1: Модель локали (константы + чистый резолвер)

Чистый, client-safe фундамент без внешних зависимостей. Полностью TDD.

**Files:**
- Create: `src/i18n/locales.ts`
- Create: `src/i18n/resolve.ts`
- Test: `src/i18n/resolve.test.ts`

**Interfaces:**
- Produces:
  - `LOCALES = ["system","ru","en"] as const`, `RESOLVED_LOCALES = ["ru","en"] as const`
  - `type Locale = "system"|"ru"|"en"`, `type ResolvedLocale = "ru"|"en"`
  - `DEFAULT_LOCALE: ResolvedLocale = "ru"`, `LOCALE_COOKIE = "locale"`
  - `isLocale(v): v is Locale`, `isResolvedLocale(v): v is ResolvedLocale`
  - `parseStoredLocale(raw: string|undefined): Locale`
  - `detectFromAcceptLanguage(header: string|null|undefined): ResolvedLocale`
  - `resolveLocale(stored: Locale, acceptLanguage?: string|null): ResolvedLocale`

- [ ] **Step 1: Write the failing test**

```ts
// src/i18n/resolve.test.ts
import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE } from "./locales";
import { detectFromAcceptLanguage, parseStoredLocale, resolveLocale } from "./resolve";

describe("parseStoredLocale", () => {
  it("принимает валидные значения", () => {
    expect(parseStoredLocale("ru")).toBe("ru");
    expect(parseStoredLocale("en")).toBe("en");
    expect(parseStoredLocale("system")).toBe("system");
  });
  it("невалидное/пустое → system", () => {
    expect(parseStoredLocale("de")).toBe("system");
    expect(parseStoredLocale(undefined)).toBe("system");
  });
});

describe("detectFromAcceptLanguage", () => {
  it("выбирает поддерживаемый primary subtag", () => {
    expect(detectFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
    expect(detectFromAcceptLanguage("ru-RU,ru;q=0.8")).toBe("ru");
  });
  it("неизвестный/пустой → DEFAULT_LOCALE", () => {
    expect(detectFromAcceptLanguage("fr-FR,de;q=0.5")).toBe(DEFAULT_LOCALE);
    expect(detectFromAcceptLanguage(null)).toBe(DEFAULT_LOCALE);
    expect(detectFromAcceptLanguage("")).toBe(DEFAULT_LOCALE);
  });
});

describe("resolveLocale", () => {
  it("явный ru/en возвращается как есть", () => {
    expect(resolveLocale("ru", "en-US")).toBe("ru");
    expect(resolveLocale("en", "ru-RU")).toBe("en");
  });
  it("system → детект из Accept-Language", () => {
    expect(resolveLocale("system", "en-GB")).toBe("en");
    expect(resolveLocale("system", null)).toBe(DEFAULT_LOCALE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/i18n/resolve.test.ts`
Expected: FAIL — `Cannot find module './locales'` / `'./resolve'`.

- [ ] **Step 3: Write `src/i18n/locales.ts`**

```ts
// src/i18n/locales.ts
// Единый источник значений оси локали. Client-safe (без server-only / next).
export const LOCALES = ["system", "ru", "en"] as const;
export const RESOLVED_LOCALES = ["ru", "en"] as const;

/** Хранимое значение предпочтения (в cookie / preferences). */
export type Locale = (typeof LOCALES)[number];
/** Конкретная UI-локаль после резолва `system`. */
export type ResolvedLocale = (typeof RESOLVED_LOCALES)[number];

export const DEFAULT_LOCALE: ResolvedLocale = "ru";
export const LOCALE_COOKIE = "locale";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
export function isResolvedLocale(v: unknown): v is ResolvedLocale {
  return typeof v === "string" && (RESOLVED_LOCALES as readonly string[]).includes(v);
}
```

- [ ] **Step 4: Write `src/i18n/resolve.ts`**

```ts
// src/i18n/resolve.ts
// Чистые функции резолва локали. Client-safe, без next/server зависимостей.
import {
  DEFAULT_LOCALE,
  isLocale,
  isResolvedLocale,
  type Locale,
  type ResolvedLocale,
} from "./locales";

/** Сырое значение cookie → Locale (невалидное → "system"). */
export function parseStoredLocale(raw: string | undefined): Locale {
  return isLocale(raw) ? raw : "system";
}

/** Первый поддерживаемый язык из Accept-Language; иначе DEFAULT_LOCALE. */
export function detectFromAcceptLanguage(
  header: string | null | undefined,
): ResolvedLocale {
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase();
    if (!tag) continue;
    const primary = tag.split("-")[0];
    if (isResolvedLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

/** Хранимое предпочтение (+подсказки запроса) → конкретная UI-локаль. */
export function resolveLocale(
  stored: Locale,
  acceptLanguage?: string | null,
): ResolvedLocale {
  return stored === "system" ? detectFromAcceptLanguage(acceptLanguage) : stored;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/i18n/resolve.test.ts`
Expected: PASS (все кейсы).

- [ ] **Step 6: Commit**

```bash
git add src/i18n/locales.ts src/i18n/resolve.ts src/i18n/resolve.test.ts
git commit -m "feat(i18n): locale model + pure resolver

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Форматтеры (seam над Intl.*)

Чистый seam форматирования, НЕ зависящий от next-intl (его внутренности можно сохранить даже при замене библиотеки). Полностью TDD.

**Files:**
- Create: `src/i18n/format.ts`
- Test: `src/i18n/format.test.ts`

**Interfaces:**
- Consumes: `ResolvedLocale`, `DEFAULT_LOCALE` (Task 1).
- Produces:
  - `interface Formatters { dateTime(value, opts?): string; number(value, opts?): string; relativeTime(value, unit, opts?): string }`
  - `getFmt(locale?: ResolvedLocale): Formatters` — кэширует `Intl`-инстансы по ключу.

- [ ] **Step 1: Write the failing test**

```ts
// src/i18n/format.test.ts
import { describe, expect, it } from "vitest";

import { getFmt } from "./format";

describe("getFmt.dateTime", () => {
  const iso = "2026-06-14T10:30:00Z";
  it("ru даёт дд.мм.гггг", () => {
    expect(
      getFmt("ru").dateTime(iso, { dateStyle: "short", timeZone: "UTC" }),
    ).toBe("14.06.2026");
  });
  it("en отличается от ru", () => {
    const ru = getFmt("ru").dateTime(iso, { dateStyle: "short", timeZone: "UTC" });
    const en = getFmt("en").dateTime(iso, { dateStyle: "short", timeZone: "UTC" });
    expect(en).not.toBe(ru);
  });
  it("невалидная дата → исходная строка", () => {
    expect(getFmt("ru").dateTime("not-a-date")).toBe("not-a-date");
  });
});

describe("getFmt.number", () => {
  it("ru группирует разряды неразрывным пробелом", () => {
    expect(getFmt("ru").number(12345)).toContain("12");
    expect(getFmt("ru").number(12345)).toContain("345");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/i18n/format.test.ts`
Expected: FAIL — `Cannot find module './format'`.

- [ ] **Step 3: Write `src/i18n/format.ts`**

```ts
// src/i18n/format.ts
// Локале-зависимое форматирование поверх нативного Intl.*. Client-safe.
// НЕ зависит от next-intl: остаётся стабильным при замене i18n-библиотеки.
import { DEFAULT_LOCALE, type ResolvedLocale } from "./locales";

const BCP47: Record<ResolvedLocale, string> = { ru: "ru-RU", en: "en-US" };

export interface Formatters {
  dateTime(value: string | number | Date, opts?: Intl.DateTimeFormatOptions): string;
  number(value: number, opts?: Intl.NumberFormatOptions): string;
  relativeTime(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    opts?: Intl.RelativeTimeFormatOptions,
  ): string;
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();
const nfCache = new Map<string, Intl.NumberFormat>();
const rtfCache = new Map<string, Intl.RelativeTimeFormat>();

function keyed<T>(cache: Map<string, T>, tag: string, opts: unknown, make: () => T): T {
  const k = `${tag}|${JSON.stringify(opts ?? {})}`;
  let v = cache.get(k);
  if (!v) {
    v = make();
    cache.set(k, v);
  }
  return v;
}

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function getFmt(locale: ResolvedLocale = DEFAULT_LOCALE): Formatters {
  const tag = BCP47[locale];
  return {
    dateTime(value, opts) {
      const d = toDate(value);
      if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "";
      return keyed(dtfCache, tag, opts, () => new Intl.DateTimeFormat(tag, opts)).format(d);
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/i18n/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/format.ts src/i18n/format.test.ts
git commit -m "feat(i18n): Intl-based formatter seam (getFmt)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Установка next-intl + серверное чтение локали + request config

Подключаем библиотеку и плагин (frozen: `package.json`, `next.config.ts`), пишем server-резолв локали и `getRequestConfig`. Проверка — сборка.

**Files:**
- Modify: `package.json` (через `pnpm add`)
- Modify: `next.config.ts:1-20`
- Create: `src/i18n/locale.server.ts`
- Create: `src/i18n/request.ts`
- Create: `src/i18n/messages/index.ts` (временный стаб каталога — наполняется в Task 4)
- Create: `src/i18n/messages/ru.ts` (временный минимум — расширяется в Task 4)
- Create: `src/i18n/messages/en.ts` (временный минимум — расширяется в Task 4)

**Interfaces:**
- Consumes: `LOCALE_COOKIE`, `Locale`, `ResolvedLocale`, `parseStoredLocale`, `resolveLocale` (Task 1).
- Produces:
  - `getStoredLocale(): Promise<Locale>` (cached, server-only)
  - `getLocale(): Promise<ResolvedLocale>` (cached, server-only)
  - `loadMessages(locale: ResolvedLocale)` — каталог сообщений
  - default-export `getRequestConfig` в `src/i18n/request.ts`

- [ ] **Step 1: Install next-intl**

Run: `pnpm add next-intl@^4.13.0`
Expected: добавляется в `dependencies`, `pnpm-lock.yaml` обновляется, exit 0.

- [ ] **Step 2: Verify next-intl public API against installed version**

Run: `cat node_modules/next-intl/package.json | grep '"version"'` и `ls node_modules/next-intl/dist/types/src`
Expected: версия `4.x`. Подтвердить наличие типа `AppConfig` (для Task 4) и серверных экспортов `getRequestConfig`, `getTranslations`, `getMessages`, `getLocale`:
Run: `grep -rl "AppConfig" node_modules/next-intl/dist/types && grep -rl "getRequestConfig" node_modules/next-intl/dist/types`
Expected: непустой вывод. Если имена отличаются (мажор сменился) — сверить с актуальными доками и скорректировать Task 3–5 точечно.

- [ ] **Step 3: Create temporary message catalogs (расширяются в Task 4)**

```ts
// src/i18n/messages/ru.ts
const ru = {} as const;
export default ru;
export type Messages = typeof ru;
```

```ts
// src/i18n/messages/en.ts
import type { Messages } from "./ru";

const en = {} satisfies Messages;
export default en;
```

```ts
// src/i18n/messages/index.ts
import type { ResolvedLocale } from "../locales";

import en from "./en";
import ru from "./ru";

const CATALOG = { ru, en } as const;

export function loadMessages(locale: ResolvedLocale) {
  return CATALOG[locale];
}
```

- [ ] **Step 4: Create `src/i18n/locale.server.ts`**

```ts
// src/i18n/locale.server.ts
import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";

import { LOCALE_COOKIE, type Locale, type ResolvedLocale } from "./locales";
import { parseStoredLocale, resolveLocale } from "./resolve";

/** Сырое хранимое предпочтение (system|ru|en) из cookie. Дедуп per-request. */
export const getStoredLocale = cache(async (): Promise<Locale> => {
  const store = await cookies();
  return parseStoredLocale(store.get(LOCALE_COOKIE)?.value);
});

/** Конкретная UI-локаль (ru|en): cookie, с резолвом `system` через Accept-Language. */
export const getLocale = cache(async (): Promise<ResolvedLocale> => {
  const stored = await getStoredLocale();
  if (stored !== "system") return stored;
  const h = await headers();
  return resolveLocale(stored, h.get("accept-language"));
});
```

- [ ] **Step 5: Create `src/i18n/request.ts`**

```ts
// src/i18n/request.ts
// next-intl request config БЕЗ i18n-роутинга: локаль берётся из cookie (getLocale).
import { getRequestConfig } from "next-intl/server";

import { getLocale } from "./locale.server";
import { loadMessages } from "./messages";

export default getRequestConfig(async () => {
  const locale = await getLocale();
  return { locale, messages: loadMessages(locale) };
});
```

- [ ] **Step 6: Wire the plugin in `next.config.ts`**

Заменить содержимое `next.config.ts` на:

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // React Compiler (Next 16, режим infer). Next прогоняет babel-plugin-react-compiler
  // через SWC-оптимизацию только по релевантным файлам — Turbopack/SWC сохраняются
  // (.babelrc намеренно НЕ добавляем). Рантайм компилятора встроен в React 19.2.
  reactCompiler: true,
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    // Включает forbidden() / unauthorized() из next/navigation.
    // Используется в src/app/admin/layout.tsx для гейта по canAccessAdmin.
    // По состоянию на Next 16.1.4 — всё ещё experimental.
    authInterrupts: true,
  },
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 7: Verify build (compat-проверка: reactCompiler × next-intl, cookie в getRequestConfig)**

Run: `pnpm build`
Expected: успешная сборка без ошибок и без новых ворнингов про i18n/react-compiler. (Cookie делает layout динамическим — это ожидаемо; статической оптимизации этих маршрутов мы и так не получаем.) Если сборка падает на конфликте с react-compiler — зафиксировать ошибку и эскалировать перед продолжением (это и есть ключевая compat-проверка из обсуждения).

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml next.config.ts src/i18n/locale.server.ts src/i18n/request.ts src/i18n/messages/ru.ts src/i18n/messages/en.ts src/i18n/messages/index.ts
git commit -m "feat(i18n): wire next-intl without routing (cookie-driven locale)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Каталоги сообщений + типобезопасность + ICU-плюрализация

Наполняем каталоги пространством `notifications`, добавляем глобальную типизацию ключей (AppConfig) и тесты: паритет ключей ru/en и корректность русских плюралов через ICU.

**Files:**
- Modify: `src/i18n/messages/ru.ts`
- Modify: `src/i18n/messages/en.ts`
- Create: `src/i18n/next-intl.d.ts`
- Test: `src/i18n/messages/messages.test.ts`

**Interfaces:**
- Consumes: `ResolvedLocale` (Task 1).
- Produces:
  - `ru`/`en` default-экспорты с пространством `notifications` (ключи: `documentUpdated`, `commentCreated` (ICU plural по `count`), `commentReply`, `annotationCreated`, `mention`, `fallback`).
  - `type Messages = typeof ru` (контракт формы каталога).
  - Глобальная аугментация `next-intl` → `AppConfig { Locale; Messages }` (типобезопасные ключи `useT`/`getT`).

- [ ] **Step 1: Write the failing test**

```ts
// src/i18n/messages/messages.test.ts
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "./en";
import ru from "./ru";

function flatKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object"
      ? flatKeys(v as Record<string, unknown>, path)
      : [path];
  });
}

describe("каталоги ru/en", () => {
  it("совпадают по набору ключей", () => {
    expect(new Set(flatKeys(en))).toEqual(new Set(flatKeys(ru)));
  });
});

describe("ru ICU-плюрализация (commentCreated)", () => {
  const t = createTranslator({ locale: "ru", messages: ru, namespace: "notifications" });
  it("1 → форма one", () => {
    expect(t("commentCreated", { count: 1 })).toBe("1 новый комментарий");
  });
  it("2 → форма few", () => {
    expect(t("commentCreated", { count: 2 })).toBe("2 новых комментария");
  });
  it("5 → форма many", () => {
    expect(t("commentCreated", { count: 5 })).toBe("5 новых комментариев");
  });
  it("21 → форма one (CLDR)", () => {
    expect(t("commentCreated", { count: 21 })).toBe("21 новый комментарий");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/i18n/messages/messages.test.ts`
Expected: FAIL — пустые каталоги, `t("commentCreated")` не находит ключ / паритет не сходится.

- [ ] **Step 3: Fill `src/i18n/messages/ru.ts`**

```ts
// src/i18n/messages/ru.ts
// Источник истины формы каталога (Messages = typeof ru). Подмножество ICU:
// только {var} и {count, plural, …}. Никаких select/rich-тегов.
const ru = {
  notifications: {
    documentUpdated: "Документ, на который вы подписаны, обновлён",
    commentCreated:
      "{count, plural, one{# новый комментарий} few{# новых комментария} many{# новых комментариев} other{# новых комментариев}}",
    commentReply: "Ответ на ваш комментарий",
    annotationCreated: "Новая аннотация",
    mention: "Вас упомянули",
    fallback: "Новое уведомление",
  },
} as const;

export default ru;
export type Messages = typeof ru;
```

- [ ] **Step 4: Fill `src/i18n/messages/en.ts`**

```ts
// src/i18n/messages/en.ts
import type { Messages } from "./ru";

const en = {
  notifications: {
    documentUpdated: "A document you follow was updated",
    commentCreated: "{count, plural, one{# new comment} other{# new comments}}",
    commentReply: "A reply to your comment",
    annotationCreated: "New annotation",
    mention: "You were mentioned",
    fallback: "New notification",
  },
} satisfies Messages;

export default en;
```

- [ ] **Step 5: Create `src/i18n/next-intl.d.ts` (типобезопасность ключей)**

```ts
// src/i18n/next-intl.d.ts
// Глобальная типизация next-intl: ключи сообщений и набор локалей проверяются tsc.
import type { ResolvedLocale } from "./locales";
import type { Messages } from "./messages/ru";

declare module "next-intl" {
  interface AppConfig {
    Locale: ResolvedLocale;
    Messages: Messages;
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run src/i18n/messages/messages.test.ts`
Expected: PASS (паритет + 4 формы русского плюрала).

- [ ] **Step 7: Verify typecheck picks up augmentation**

Run: `pnpm typecheck`
Expected: без ошибок. (Если `AppConfig` не распознан — сверить имя интерфейса с `node_modules/next-intl` из Task 3 Step 2 и поправить `next-intl.d.ts`.)

- [ ] **Step 8: Commit**

```bash
git add src/i18n/messages/ru.ts src/i18n/messages/en.ts src/i18n/next-intl.d.ts src/i18n/messages/messages.test.ts
git commit -m "feat(i18n): notifications catalog + key-safety + ru ICU plurals

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Фасад @/i18n (server) и @/i18n/client (client)

Тонкие обёртки — единственная публичная поверхность i18n для прикладного кода. Проверка — typecheck/build (обёртки тривиальны; реальное использование тестируется в Task 8–10).

**Files:**
- Create: `src/i18n/index.ts` (server entry)
- Create: `src/i18n/client.tsx` (client entry)

**Interfaces:**
- Consumes: `getLocale`, `getStoredLocale` (Task 3); `getFmt`, `Formatters` (Task 2); `ResolvedLocale` (Task 1); next-intl/server (`getTranslations`, `getMessages`); next-intl (`useTranslations`, `useLocale`, `NextIntlClientProvider`).
- Produces:
  - Server `@/i18n`: `getT`, `getLocale`, `getStoredLocale`, `getMessages`, `getServerFmt`.
  - Client `@/i18n/client`: `useT`, `useLocale`, `useFmt`, `I18nProvider`.

- [ ] **Step 1: Create `src/i18n/index.ts`**

```ts
// src/i18n/index.ts
// СЕРВЕРНЫЙ фасад i18n. Прикладной server-код импортирует ТОЛЬКО отсюда.
import "server-only";

import { getMessages as getIntlMessages, getTranslations } from "next-intl/server";

import { getFmt, type Formatters } from "./format";
import { getLocale, getStoredLocale } from "./locale.server";

export { getLocale, getStoredLocale };

/** Серверный переводчик (RSC / server actions). Ключи типизированы через AppConfig. */
export function getT(namespace?: Parameters<typeof getTranslations>[0]) {
  return getTranslations(namespace);
}

/** Сообщения текущего запроса (для передачи в I18nProvider из layout). */
export function getMessages() {
  return getIntlMessages();
}

/** Форматтеры для текущей серверной локали. */
export async function getServerFmt(): Promise<Formatters> {
  return getFmt(await getLocale());
}
```

- [ ] **Step 2: Create `src/i18n/client.tsx`**

```tsx
// src/i18n/client.tsx
"use client";
// КЛИЕНТСКИЙ фасад i18n. Прикладной "use client"-код импортирует ТОЛЬКО отсюда.
import { NextIntlClientProvider, useLocale as useIntlLocale, useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { getFmt, type Formatters } from "./format";
import type { ResolvedLocale } from "./locales";

/** Обёртка-провайдер next-intl (монтируется в layout). */
export function I18nProvider(props: ComponentProps<typeof NextIntlClientProvider>) {
  return <NextIntlClientProvider {...props} />;
}

/** Клиентский переводчик. Ключи типизированы через AppConfig. */
export const useT = useTranslations;

/** Текущая UI-локаль (ru|en). */
export function useLocale(): ResolvedLocale {
  return useIntlLocale();
}

/** Форматтеры для текущей клиентской локали. */
export function useFmt(): Formatters {
  return getFmt(useLocale());
}
```

- [ ] **Step 3: Verify typecheck/build**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/index.ts src/i18n/client.tsx
git commit -m "feat(i18n): @/i18n server + client facade

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Монтаж I18nProvider в root layout

Оборачиваем дерево провайдером и проставляем `<html lang>` по локали (frozen: `src/app/layout.tsx`).

**Files:**
- Modify: `src/app/layout.tsx:18-19,66-70,91,108`

**Interfaces:**
- Consumes: `getLocale`, `getMessages` (Task 5, `@/i18n`); `I18nProvider` (Task 5, `@/i18n/client`).

- [ ] **Step 1: Add imports**

В `src/app/layout.tsx` добавить (в группе internal-импортов, с соблюдением `import/order` — алфавитный порядок):

```ts
import { getLocale, getMessages } from "@/i18n";
import { I18nProvider } from "@/i18n/client";
```

- [ ] **Step 2: Resolve locale + messages in RootLayout**

После `const appearance = await getAppearance();` (строка ~66) добавить:

```ts
  const locale = await getLocale();
  const messages = await getMessages();
```

- [ ] **Step 3: Use locale in `<html lang>`**

Заменить `<html lang="ru" {...dataAttrs} ...>` на:

```tsx
    <html lang={locale} {...dataAttrs} style={{ ...style, colorScheme }}>
```

- [ ] **Step 4: Wrap body tree with I18nProvider**

Обернуть существующий `<AppearanceProvider …>…</AppearanceProvider>` внутри `<body>` в провайдер:

```tsx
        <I18nProvider locale={locale} messages={messages}>
          <AppearanceProvider initial={appearance}>
            {/* существующее содержимое без изменений */}
          </AppearanceProvider>
        </I18nProvider>
```

- [ ] **Step 5: Verify provider covers all rendered subtrees**

Run: `find src/app -name layout.tsx`
Expected: убедиться, что любой дополнительный `layout.tsx` (напр. `src/app/admin/layout.tsx`) рендерится ВНУТРИ root layout (как его children) — тогда I18nProvider покрывает и его. Если найдётся изолированный layout со своим `<html>` вне root-дерева — туда тоже нужен I18nProvider, иначе `useT`/`useLocale` там кинут at runtime.

- [ ] **Step 6: Verify build + lint**

Run: `pnpm build && pnpm lint`
Expected: успешная сборка; `<html lang>` теперь динамический; lint без ошибок.

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(i18n): mount I18nProvider + locale-driven <html lang>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: ESLint Guardrail 5 — запрет прямого импорта next-intl

Гард форсит фасад: `next-intl` импортируется только из `src/i18n/**`. Требует инъекции паттерна во ВСЕ блоки `no-restricted-imports` (flat-config НЕ мержит опции одного правила — последний матчнувший блок перезаписывает; см. комментарий Guardrail 4). Frozen: `eslint.config.mjs`.

**Files:**
- Modify: `eslint.config.mjs:9,156-241` (+ новый блок-исключение для `src/i18n/**`)

**Interfaces:** —

- [ ] **Step 1: Объявить общие паттерны в module scope (ДО `const eslintConfig = [`)**

flat-config НЕ мержит опции одного правила (последний матчнувший блок перезаписывает целиком — см. комментарий Guardrail 4), поэтому каждый блок `no-restricted-imports` должен нести полный набор паттернов. Выносим в константы для переиспользования. Вставить ОДИН блок — сразу после импортов, перед строкой `const eslintConfig = [`:

```js
// Общие паттерны no-restricted-imports (flat-config перезаписывает, не мержит опции
// правила → каждый матчнувший блок должен нести нужные паттерны целиком).
const DEEP_IMPORT_PATTERN = {
  group: ["@/features/*/!(index)", "@/features/*/*/**"],
  message: "Импортируй фичу через её index.ts (@/features/<entity>).",
};
const NO_NEXT_INTL_PATTERN = {
  group: ["next-intl", "next-intl/*"],
  message:
    "next-intl — только через фасад @/i18n (server) / @/i18n/client (Guardrail 5). Прямой импорт запрещён.",
};
```

(Никаких вставок внутрь массива `eslintConfig` на этом шаге — только объявление констант выше него.)

- [ ] **Step 2: Update Guardrail 1 to use the constant + ban next-intl**

Заменить блок Guardrail 1 (`// Guardrail 1: deep-imports …`) на:

```js
  // Guardrail 1: deep-imports into other features must go through their index.ts
  // + Guardrail 5: прямой импорт next-intl запрещён (кроме src/i18n/** — см. ниже)
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/features/*/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [DEEP_IMPORT_PATTERN, NO_NEXT_INTL_PATTERN] },
      ],
    },
  },
  // Guardrail 5 exemption: src/i18n — ЕДИНСТВЕННАЯ точка прямого импорта next-intl.
  // Должен идти ПОСЛЕ Guardrail 1 (перезаписывает его no-restricted-imports для src/i18n),
  // сохраняя при этом запрет deep-import.
  {
    files: ["src/i18n/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [DEEP_IMPORT_PATTERN] }],
    },
  },
```

- [ ] **Step 3: Add next-intl ban to Guardrail 2 (feature files)**

В блоке Guardrail 2 (`files: ["src/features/*/**"]`) добавить `NO_NEXT_INTL_PATTERN` в массив `patterns` (рядом с существующим cross-feature паттерном):

```js
          patterns: [
            {
              group: ["@/features/*"],
              message:
                "Cross-feature импорты запрещены. Данные ходят через бекенд, общий код — через @/components, @/utils, @/hooks.",
            },
            NO_NEXT_INTL_PATTERN,
          ],
```

- [ ] **Step 4: Add next-intl ban to Guardrail 3 (feature server files)**

В блоке Guardrail 3 (`files: [api.ts, actions.ts, permissions.ts, schemas.ts]`) добавить `patterns` рядом с существующим `paths`:

```js
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-dom/client",
              message: "Этот файл server-only. Используй import \"server-only\" в начале файла.",
            },
          ],
          patterns: [NO_NEXT_INTL_PATTERN],
        },
      ],
```

- [ ] **Step 5: Add next-intl ban to Guardrail 4 (client.ts)**

В блоке Guardrail 4 (`files: ["src/features/*/client.ts"]`) добавить `NO_NEXT_INTL_PATTERN` в массив `patterns` (после существующих двух паттернов).

- [ ] **Step 6: Verify lint passes and ban actually fires**

Run: `pnpm lint`
Expected: PASS (фасад в `src/i18n` импортирует next-intl легально; прикладной код пока его не импортирует).

Негативная проверка — временно добавить в любой не-i18n файл `import { useTranslations } from "next-intl";`, прогнать `pnpm lint`, убедиться в ошибке Guardrail 5, затем откатить строку:

Run: `grep -rn 'from "next-intl' src | grep -v 'src/i18n/'`
Expected: пусто (никто вне `src/i18n` не импортирует next-intl напрямую).

- [ ] **Step 7: Commit**

```bash
git add eslint.config.mjs
git commit -m "feat(i18n): Guardrail 5 — next-intl only via @/i18n facade

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Пилотная миграция — notifications (ICU-плюрализация через фасад)

Заменяем захардкоженные шаблоны и тернарную плюрализацию на каталог + `useT`. Чистое ядро (`describeNotification`) остаётся тестируемым; рендер текста — в client-компоненте через `useT`.

**Files:**
- Modify: `src/features/notifications/notification-content.ts`
- Modify: `src/features/notifications/notification-content.test.ts`
- Modify: `src/features/notifications/ui/notification-item.tsx:7,19,44`
- Modify: `src/features/notifications/client.ts:3`

**Interfaces:**
- Consumes: `useT` (`@/i18n/client`); `AppNotification` (slice types).
- Produces:
  - `type NotificationDescriptor` (discriminated union по `kind`).
  - `describeNotification(n: AppNotification): NotificationDescriptor` (чистая, без i18n).
  - `notification-item.tsx` рендерит текст по дескриптору через `useT("notifications")`.

- [ ] **Step 1: Rewrite the test (describeNotification)**

```ts
// src/features/notifications/notification-content.test.ts
import { describe, expect, it } from "vitest";

import { describeNotification } from "./notification-content";
import type { AppNotification } from "./types";

function make(p: Partial<AppNotification>): AppNotification {
  return {
    id: "n1", type: "", reason: "", actorId: null, targetId: null,
    targetType: null, targetVersion: null, groupCount: 1,
    readAt: null, seenAt: null, createdAt: null, ...p,
  };
}

describe("describeNotification", () => {
  it("известный тип → kind + href", () => {
    const d = describeNotification(make({ type: "document.updated", targetType: "document", targetId: "d1" }));
    expect(d).toEqual({ kind: "documentUpdated", href: "/documents/d1" });
  });
  it("comment.created → kind commentCreated с count", () => {
    const d = describeNotification(make({ type: "comment.created", groupCount: 3 }));
    expect(d).toEqual({ kind: "commentCreated", count: 3, href: null });
  });
  it("неизвестный тип → kind raw (reason + count)", () => {
    const d = describeNotification(make({ type: "weird.new", reason: "Что-то произошло", groupCount: 2 }));
    expect(d).toEqual({ kind: "raw", text: "Что-то произошло", count: 2, href: null });
  });
  it("неизвестный тип без reason → raw c пустым text", () => {
    const d = describeNotification(make({ type: "x" }));
    expect(d).toEqual({ kind: "raw", text: "", count: 1, href: null });
  });
  it("href по target_type=lecture", () => {
    expect(describeNotification(make({ type: "document.updated", targetType: "lecture", targetId: "l1" })).href).toBe("/lectures/l1");
  });
  it("target_type=annotation игнорирует targetId", () => {
    expect(describeNotification(make({ type: "document.updated", targetType: "annotation", targetId: "a1" })).href).toBe("/me/annotations");
  });
  it("нет targetId → href null", () => {
    expect(describeNotification(make({ type: "document.updated", targetType: "document" })).href).toBeNull();
  });
  it("неизвестный target_type → href null", () => {
    expect(describeNotification(make({ type: "document.updated", targetType: "comment", targetId: "c1" })).href).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/notifications/notification-content.test.ts`
Expected: FAIL — `describeNotification` не экспортируется.

- [ ] **Step 3: Rewrite `notification-content.ts`**

```ts
// src/features/notifications/notification-content.ts
// Чистый client-safe дескриптор уведомления. Текст рендерится в компоненте через @/i18n.
import type { AppNotification } from "./types";

/** Дискриминированный дескриптор: какой ключ каталога рендерить + куда вести. */
export type NotificationDescriptor =
  | { kind: "documentUpdated"; href: string | null }
  | { kind: "commentCreated"; count: number; href: string | null }
  | { kind: "commentReply"; href: string | null }
  | { kind: "annotationCreated"; href: string | null }
  | { kind: "mention"; href: string | null }
  | { kind: "raw"; text: string; count: number; href: string | null };

/** Fallback-ссылка на сущность по target_type. */
function entityHref(targetType: string | null, targetId: string | null): string | null {
  if (!targetId) return null;
  switch (targetType) {
    case "document":
      return `/documents/${targetId}`;
    case "lecture":
      return `/lectures/${targetId}`;
    case "annotation":
      return "/me/annotations"; // detail-страницы аннотации нет — ведём в список
    default:
      return null;
  }
}

/**
 * Маппинг type → дескриптор. Тексты НЕ здесь (они в каталоге @/i18n).
 * TODO(backend-ask): сверить значения `type` с philosophy-api.
 */
export function describeNotification(n: AppNotification): NotificationDescriptor {
  const href = entityHref(n.targetType, n.targetId);
  switch (n.type) {
    case "document.updated":
      return { kind: "documentUpdated", href };
    case "comment.created":
      return { kind: "commentCreated", count: n.groupCount, href };
    case "comment.reply":
      return { kind: "commentReply", href };
    case "annotation.created":
      return { kind: "annotationCreated", href };
    case "mention":
      return { kind: "mention", href };
    default:
      return { kind: "raw", text: n.reason, count: n.groupCount, href };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/notifications/notification-content.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `notification-item.tsx` to render via useT**

Заменить импорт строки 7 и использование строки 19, плюс рендер `<span>{text}</span>` (строка 44):

```tsx
"use client";
// src/features/notifications/ui/notification-item.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useT } from "@/i18n/client";

import { markRead } from "../actions";
import { describeNotification } from "../notification-content";
import type { AppNotification } from "../types";

interface NotificationItemProps {
  notification: AppNotification;
  /** Вызывается перед переходом (напр. закрыть поповер). */
  onNavigate?: () => void;
}

export function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  const router = useRouter();
  const t = useT("notifications");
  const [read, setRead] = useState(notification.readAt !== null);
  const d = describeNotification(notification);
  const href = d.href;

  let text: string;
  if (d.kind === "raw") {
    const base = d.text || t("fallback");
    text = d.count > 1 ? `${base} (${d.count})` : base;
  } else if (d.kind === "commentCreated") {
    text = t("commentCreated", { count: d.count });
  } else {
    // documentUpdated | commentReply | annotationCreated | mention
    text = t(d.kind);
  }

  function handleClick() {
    if (!read) {
      setRead(true); // оптимистично
      void markRead(notification.id); // ошибку игнорируем — некритично
    }
    onNavigate?.();
    if (href) router.push(href);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full items-start gap-2 rounded px-3 py-2 text-left text-sm hover:bg-(--color-surface-subtle) ${
        read ? "text-(--color-fg-muted)" : "font-medium"
      }`}
    >
      {!read && (
        <span
          className="mt-1.5 size-2 shrink-0 rounded-full bg-(--color-accent)"
          aria-hidden="true"
        />
      )}
      <span>{text}</span>
    </button>
  );
}
```

- [ ] **Step 6: Update client.ts re-export**

Заменить строку 3 в `src/features/notifications/client.ts`:

```ts
export { describeNotification, type NotificationDescriptor } from "./notification-content";
```

- [ ] **Step 7: Verify lint + test + build**

Run: `pnpm lint && pnpm vitest run src/features/notifications && pnpm build`
Expected: всё зелёное. (`notification-item.tsx` импортирует `@/i18n/client`, не next-intl — Guardrail 5 не срабатывает.)

> **Покрытие facade-render пути (осознанное решение).** Связку `describeNotification → useT` НЕ покрываем компонентным render-тестом в этом слайсе: тест-рендер требует `NextIntlClientProvider`, который тянет `next-intl`, а Guardrail 5 запрещает его импорт вне `src/i18n` (строить тест-render-хелпер с провайдером — отдельная инфраструктура, scope creep для пилота). Вместо этого путь покрыт: (а) `pnpm typecheck` — `AppConfig` ловит несовпадение `kind`↔ключ каталога и опечатки; (б) отдельный ICU-тест каталога (Task 4); (в) чистый юнит `describeNotification` (Step 1); (г) финальная ручная проверка (в конце плана). Подтверждено ревью: компонентных тестов, рендерящих `NotificationItem`, в проекте нет — Task 8 ничего существующего не ломает.

- [ ] **Step 8: Commit**

```bash
git add src/features/notifications/notification-content.ts src/features/notifications/notification-content.test.ts src/features/notifications/ui/notification-item.tsx src/features/notifications/client.ts
git commit -m "refactor(notifications): render via @/i18n catalog + ICU plurals

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Пилотная миграция форматтера — comment-format через getFmt

Централизуем `Intl.DateTimeFormat` через seam `getFmt`, делая дату локале-параметризуемой. Сохраняем изоморфность/офлайн-контракт `comment-node-view` (без хуков): `locale` — необязательный параметр с дефолтом `ru`.

**Files:**
- Modify: `src/features/comments/comment-format.ts`
- Modify: `src/features/comments/comment-format.test.ts`

**Interfaces:**
- Consumes: `getFmt` (`@/i18n/format`); `ResolvedLocale`, `DEFAULT_LOCALE` (`@/i18n/locales`).
- Produces: `formatCommentDate(iso?: string, locale?: ResolvedLocale): string` (дефолт locale = `DEFAULT_LOCALE`).

> Примечание: `comment-node-view.tsx` и `admin-comment-row.tsx` продолжают звать `formatCommentDate(comment.created_at)` без второго аргумента — даты остаются `ru` (контент русский; офлайн-снимок рендерится без locale-контекста). Онлайн-вызовы при желании могут позже передавать `useLocale()`-локаль; threading локали в офлайн-вид вне scope.

- [ ] **Step 1: Update the test (behavior preserved + locale param)**

```ts
// src/features/comments/comment-format.test.ts
import { describe, expect, it } from "vitest";

import { formatCommentDate } from "./comment-format";

describe("formatCommentDate", () => {
  it("ISO → дд.мм.гггг, чч:мм (ru, UTC) по умолчанию", () => {
    const out = formatCommentDate("2026-06-14T10:30:00Z");
    expect(out).toBe("14.06.2026, 10:30");
  });
  it("пустое → пустая строка", () => {
    expect(formatCommentDate(undefined)).toBe("");
    expect(formatCommentDate("")).toBe("");
  });
  it("неразбираемое → как есть", () => {
    expect(formatCommentDate("not-a-date")).toBe("not-a-date");
  });
  it("en-локаль меняет формат", () => {
    expect(formatCommentDate("2026-06-14T10:30:00Z", "en")).not.toBe(
      formatCommentDate("2026-06-14T10:30:00Z", "ru"),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/comments/comment-format.test.ts`
Expected: FAIL — `formatCommentDate` пока не принимает второй аргумент / тест на en падает.

- [ ] **Step 3: Rewrite `comment-format.ts`**

```ts
// src/features/comments/comment-format.ts
// Локале-параметризуемое форматирование даты комментария через единый seam @/i18n.
// Изоморфно (без хуков) → пригодно для офлайн SavedLectureView из снимка.
import { getFmt } from "@/i18n/format";
import { DEFAULT_LOCALE, type ResolvedLocale } from "@/i18n/locales";

/** ISO → "дд.мм.гггг, чч:мм" (UTC). Пустая → ""; неразбираемая → как есть. */
export function formatCommentDate(
  iso?: string,
  locale: ResolvedLocale = DEFAULT_LOCALE,
): string {
  if (!iso) return "";
  return getFmt(locale).dateTime(iso, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/comments/comment-format.test.ts`
Expected: PASS. (Вызовы в `comment-node-view.tsx` / `admin-comment-row.tsx` не меняются — дефолтный `ru`.)

- [ ] **Step 5: Verify lint + build**

Run: `pnpm lint && pnpm build`
Expected: зелёное. (`comment-format.ts` — не server-only; импорт `@/i18n/format` и `@/i18n/locales` client-safe.)

- [ ] **Step 6: Commit**

```bash
git add src/features/comments/comment-format.ts src/features/comments/comment-format.test.ts
git commit -m "refactor(comments): format dates via @/i18n getFmt seam

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Переключатель языка в настройках + persistLocale

UI выбора языка (cookie-first + graceful PATCH на бэк) и серверный экшен persist по образцу `persist-appearance`.

**Files:**
- Create: `src/i18n/persist-locale.ts`
- Test: `src/i18n/persist-locale.test.ts`
- Create: `src/app/me/settings/locale-settings.tsx`
- Modify: `src/app/me/settings/page.tsx`

**Interfaces:**
- Consumes: `Locale`, `LOCALE_COOKIE` (`@/i18n/locales`); `getStoredLocale` (`@/i18n`); `createApiClient` (`@/api/client`); `getMe` (`@/utils/me`); `Select` (`@/components/ui`); `useLocale` (`@/i18n/client`).
- Produces: `persistLocale(locale: Locale): Promise<void>` (server action, graceful); `<LocaleSettings initial={Locale} />`.

- [ ] **Step 1: Write the failing test for persistLocale**

```ts
// src/i18n/persist-locale.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { persistLocale } from "./persist-locale";

vi.mock("server-only", () => ({}));

const patch = vi.fn();
vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ PATCH: patch }),
}));

const getMe = vi.fn();
vi.mock("@/utils/me", () => ({
  getMe: () => getMe() as unknown,
}));

describe("persistLocale", () => {
  beforeEach(() => {
    patch.mockReset();
    getMe.mockReset();
  });

  it("PATCHes preferences с locale для залогиненного", async () => {
    getMe.mockResolvedValue({ id: "u1", status: "active", capabilities: [] });
    patch.mockResolvedValue({ data: {}, error: null });
    await persistLocale("en");
    expect(patch).toHaveBeenCalledWith(
      "/api/me/preferences",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      { body: expect.objectContaining({ locale: "en" }) },
    );
  });

  it("no-op для анонима", async () => {
    getMe.mockResolvedValue(null);
    await persistLocale("ru");
    expect(patch).not.toHaveBeenCalled();
  });

  it("глотает ошибки бэка (поле ещё не в контракте)", async () => {
    getMe.mockResolvedValue({ id: "u1", status: "active", capabilities: [] });
    patch.mockRejectedValue(new Error("backend 500"));
    await expect(persistLocale("en")).resolves.toBeUndefined();
  });

  it("глотает падение getMe (5xx)", async () => {
    getMe.mockRejectedValue(new Error("503"));
    await expect(persistLocale("ru")).resolves.toBeUndefined();
    expect(patch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/i18n/persist-locale.test.ts`
Expected: FAIL — модуль не существует.

- [ ] **Step 3: Create `src/i18n/persist-locale.ts`**

```ts
// src/i18n/persist-locale.ts
"use server";
import "server-only";

import { createApiClient } from "@/api/client";
import { getMe } from "@/utils/me";

import type { Locale } from "./locales";

/** Сохранить выбранную локаль на бэк (cookie пишется на клиенте). Graceful. */
export async function persistLocale(locale: Locale): Promise<void> {
  try {
    const me = await getMe();
    if (!me) return; // аноним — только cookie
    const api = await createApiClient();
    // PATCH-боди в схеме типизирован как Record<string, never> (бэк не описывает
    // partial-преференсы) → cast обязателен, как в persistAppearance. preference.Locale
    // уже в контракте, но тело PATCH остаётся нетипизированным — as never НЕ снимать.
    await api.PATCH("/api/me/preferences", { body: { locale } as never });
  } catch {
    /* graceful: бэк может не знать про locale */
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/i18n/persist-locale.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `src/app/me/settings/locale-settings.tsx`**

```tsx
// src/app/me/settings/locale-settings.tsx
"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Select } from "@/components/ui";
import { persistLocale } from "@/i18n/persist-locale";
import { LOCALE_COOKIE, type Locale } from "@/i18n/locales";

const OPTIONS = [
  { value: "system", label: "Как в системе" },
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
];

export function LocaleSettings({ initial }: { initial: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(v: string) {
    const next = v as Locale;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax; secure`;
    void persistLocale(next);
    // Локаль-зависимые сообщения приходят с сервера → перечитываем дерево.
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">Язык</span>
      <Select
        aria-label="Язык интерфейса"
        options={OPTIONS}
        value={initial}
        onValueChange={onChange}
        disabled={pending}
      />
    </label>
  );
}
```

> Зеркалит Row/label-паттерн `appearance-settings.tsx` (label↔control связь, не только aria-label).

- [ ] **Step 6: Add language section to settings page**

В `src/app/me/settings/page.tsx`:

1. Добавить импорты (с соблюдением `import/order`):

```ts
import { getStoredLocale } from "@/i18n";

import { LocaleSettings } from "./locale-settings";
```

2. В теле `SettingsPage` добавить чтение локали в `Promise.all` или отдельно после него:

```ts
  const storedLocale = await getStoredLocale();
```

3. Добавить секцию языка после `<AppearanceSettings />`:

```tsx
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Язык интерфейса</h2>
        <LocaleSettings initial={storedLocale} />
      </section>
```

- [ ] **Step 7: Verify lint + test + build**

Run: `pnpm lint && pnpm vitest run src/i18n/persist-locale.test.ts && pnpm build`
Expected: зелёное.

- [ ] **Step 8: Commit**

```bash
git add src/i18n/persist-locale.ts src/i18n/persist-locale.test.ts src/app/me/settings/locale-settings.tsx src/app/me/settings/page.tsx
git commit -m "feat(i18n): language picker in settings (cookie-first + graceful persist)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Локализация metadata (title / description / appleWebApp / manifest)

Переводим статичную `<title>`/`<meta>`/PWA-метаданные через `generateMetadata` + `getT`. Каталог получает namespace `metadata`. Frozen: `src/app/layout.tsx` (часть foundation-PR).

**Files:**
- Modify: `src/i18n/messages/ru.ts`, `src/i18n/messages/en.ts` (namespace `metadata`)
- Modify: `src/app/layout.tsx:39-48` (`metadata` → `generateMetadata`)
- Modify: `src/app/me/settings/page.tsx` (`metadata` → `generateMetadata`)
- Create: `src/app/manifest.ts` (динамический локализованный manifest)
- Test: `src/i18n/messages/messages.test.ts` (расширить паритет — namespace уже покрыт общим тестом ключей)

**Interfaces:**
- Consumes: `getT`, `getLocale` (`@/i18n`).
- Produces: namespace `metadata` (ключи: `appTitle`, `appDescription`, `appShortName`, `settingsTitle`).

> Замечание о manifest: текущий `manifest: "/manifest.webmanifest"` — статичный файл (вероятно генерится `scripts/generate-sw-assets.mjs`). Перевод его `name/short_name` требует динамического route `src/app/manifest.ts`. Step 4 это вводит; если route конфликтует с генерацией в `generate-sw-assets.mjs` (проверить на Step 5 build) — откатить `app/manifest.ts`, оставить статичный manifest русским и зафиксировать это в Task 13 «Вне scope». Локализация manifest — наименее критичная часть (PWA-имя при установке).

- [ ] **Step 1: Add `metadata` namespace to catalogs**

В `src/i18n/messages/ru.ts` добавить в объект (рядом с `notifications`):

```ts
  metadata: {
    appTitle: "Философия-ликбез",
    appDescription: "Архив занятий курса Философия-ликбез",
    appShortName: "ФЛБЗ",
    settingsTitle: "Настройки",
  },
```

В `src/i18n/messages/en.ts` (тот же набор ключей — `satisfies Messages` заставит):

```ts
  metadata: {
    appTitle: "Philosophy Primer",
    appDescription: "Archive of the Philosophy Primer course sessions",
    appShortName: "PHIL",
    settingsTitle: "Settings",
  },
```

- [ ] **Step 2: Run parity test (namespace covered by existing key-parity test)**

Run: `pnpm vitest run src/i18n/messages/messages.test.ts`
Expected: PASS (паритет ключей ru/en сходится с новым namespace).

- [ ] **Step 3: Convert `layout.tsx` static metadata → generateMetadata**

Заменить блок `export const metadata: Metadata = { … };` (строки ~39-48) на:

```tsx
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("metadata");
  return {
    title: t("appTitle"),
    description: t("appDescription"),
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      title: t("appShortName"),
      capable: true,
      statusBarStyle: "black-translucent",
    },
  };
}
```

(Импорт `getT` из `@/i18n` уже добавлен в Task 6. Тип `Metadata` уже импортируется в файле.)

- [ ] **Step 4: Create dynamic localized manifest**

```ts
// src/app/manifest.ts
import type { MetadataRoute } from "next";

import { getT } from "@/i18n";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getT("metadata");
  return {
    name: t("appTitle"),
    short_name: t("appShortName"),
    start_url: "/",
    display: "standalone",
  };
}
```

> Сверить с текущим статичным `manifest.webmanifest` (поля theme_color/background_color/icons) и перенести их сюда дословно, чтобы не потерять PWA-конфиг. Если файл генерится `generate-sw-assets.mjs` — согласовать (route `app/manifest.ts` отдаёт `/manifest.webmanifest`, статичный файл удалить/не генерить во избежание конфликта URL).

- [ ] **Step 5: Convert settings page metadata → generateMetadata**

В `src/app/me/settings/page.tsx` заменить `export const metadata = { title: "Настройки" };` на:

```tsx
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("metadata");
  return { title: t("settingsTitle") };
}
```

(Добавить `import type { Metadata } from "next";` и `import { getT } from "@/i18n";` — последний уже есть, если Task 10 импортировал из `@/i18n`; иначе добавить.)

- [ ] **Step 6: Verify build + lint (compat: manifest route vs generate-sw-assets)**

Run: `pnpm build && pnpm lint`
Expected: успешная сборка; `/manifest.webmanifest` отдаёт локализованный JSON; нет конфликта URL со статической генерацией. Если конфликт — откатить `app/manifest.ts` (Step 4) по примечанию выше.

- [ ] **Step 7: Commit**

```bash
git add src/i18n/messages/ru.ts src/i18n/messages/en.ts src/app/layout.tsx src/app/me/settings/page.tsx src/app/manifest.ts
git commit -m "feat(i18n): localize metadata (title/description/appleWebApp/manifest)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12 (OBVIATED): бэк-локаль — действий не требуется

**Обнулена реальностью контракта.** На момент исполнения бэк уже регенерировал `src/api/schema.ts`, и `locale` лёг на **`preference.Preferences`** (`GET/PATCH /api/me/preferences`), а НЕ на `/api/me` (rbac.User). Это меняет картину:

- **Write-sync уже сделан в Task 10** — `persistLocale` PATCHит `/api/me/preferences` с `{ locale }`. Тело PATCH в схеме типизировано как `Record<string, never>` (бэк не описывает partial-преференсы), поэтому `as never` **остаётся** (как в `persistAppearance`) — снимать НЕ нужно.
- **`Me.locale` добавлять НЕ нужно** — на user-объекте локали нет; добавление поля было бы неверным.
- **Reconcile-on-load** (засев cookie из `preferences.locale` на свежей сессии) — намеренно отложен, как и appearance-reconcile (тот «Task 21» в styling-плане). Чтобы резолвить локаль из preferences, пришлось бы делать backend-fetch в `getLocale`/`getRequestConfig` на каждый запрос — это отдельное решение единым заходом с appearance.

**Действий по этой задаче нет.** Зафиксировано в Task 13 «Вне scope». Переходить к Task 13.

---

### Task 13: Документ-чеклист раскатки i18n по остальным слайсам

Фиксируем паттерн, чтобы дальнейший вынос строк шёл единообразно. Без кода.

**Files:**
- Create: `docs/frontend-i18n.md`

**Interfaces:** —

- [ ] **Step 1: Write `docs/frontend-i18n.md`**

Содержание (markdown):

- **Что уже есть:** фасад `@/i18n` (server) / `@/i18n/client` (client); каталоги `src/i18n/messages/{ru,en}.ts`; ESLint Guardrail 5; seam форматирования `getFmt`; пилоты — notifications (ICU-плюрал), comments (даты).
- **Как добавить строку:** 1) добавить ключ в `ru.ts` (источник истины формы), 2) добавить тот же ключ в `en.ts` (`satisfies Messages` заставит), 3) использовать `useT("<namespace>")` (client) или `await getT("<namespace>")` (server), 4) числа/даты — через `useFmt()`/`getServerFmt()`/`getFmt(locale)`.
- **Дисциплина ICU:** только `{var}` и `{count, plural, …}`. НЕ использовать `select`, `selectordinal`, rich-теги, skeleton — это держит каталог переносимым и дешёвой замену библиотеки. Для русского всегда заполнять `one/few/many/other`.
- **Границы фасада:** прикладной код НИКОГДА не импортирует `next-intl` напрямую (форсит Guardrail 5). Если нужна фича next-intl, которой нет в фасаде — добавить тонкую обёртку в `src/i18n`, не пробрасывать наружу сырой API. **Важно:** `useT` реэкспортит `useTranslations` целиком, значит `t.rich`/`t.markup`/`select` технически доступны прикладному коду — запрет на них держится ТОЛЬКО соглашением + код-ревью, не линтером. Если захотим форсить машинно — нужна обёртка `t`, не пробрасывающая `.rich`.
- **Реальная цена свопа (честно):** «переписать один модуль» точно для `getFmt` (Task 2) и модели локали (Task 1) — чистый seam над `Intl.*`. НО формат ICU-плюрала в каталогах (`{count, plural, …}`) — это рантайм-фича библиотеки, а не переносимые данные. При замене next-intl на самопись придётся либо портировать ICU-плюрал-эвалуатор (это часть веса, который и даёт next-intl), либо переписать plural-каталоги и вызовы `t(key, {count})`. Своп-готовность = «фасад + форматтеры тонкие + ICU-формат стандартен», но **ICU-рантайм — осознанная привязка**, а не нулевая.
- **Очередь слайсов для выноса строк** (известные источники backend-/UI-текста; вынести в каталоги): шаблоны/ветки в `src/utils/api-error.ts` (DEFAULT_MESSAGES) и `src/features/*/errors.ts`; branded-тексты forbidden/suspended; push UI (`src/features/preferences/ui/*`); Zod-сообщения форм (`src/features/*/schemas.ts` — через `getT` на сервере); прочие захардкоженные русские строки в `*.tsx` по слайсам. **Замечание:** серверные строки (Zod/api-error помечены `server-only`) брать через `getT`/`getServerFmt`, а не client-хуки.
- **Прочие `Intl.*` для миграции на `getFmt`** (известные места хардкода `"ru-RU"`): `src/features/events/calendar.ts`, `src/features/events/ui/calendar-view*`, `src/features/banners/*`, `src/features/search/*`, `src/features/audit/ui/audit-table.tsx`, `src/features/share-links/*`, `src/features/revision-history/*`, и `localeCompare("ru")` в `src/app/admin/tags/page.tsx`, `src/features/glossary/ui/glossary-list.tsx`. (Список ориентировочный — сверять `grep -rn 'Intl\.\|localeCompare' src`.)
- **Вне scope (зафиксировано):** контентный i18n (лекции/глоссарий — модель данных на бэке); RTL/logical-CSS (нет RTL-языков); reconcile-on-load локали — засев cookie из `preferences.locale` на свежей сессии (требует backend-fetch в резолве локали; отложено единым заходом с appearance-reconcile); `Me.locale` не нужен — локаль живёт на `preference.Preferences`, не на user-объекте.

- [ ] **Step 2: Commit**

```bash
git add docs/frontend-i18n.md
git commit -m "docs(i18n): rollout checklist + facade discipline

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Финальная проверка (после всех задач)

- [ ] Run: `pnpm lint && pnpm test && pnpm build` — всё зелёное.
- [ ] Run: `grep -rn 'from "next-intl' src | grep -v 'src/i18n/'` — пусто (фасад герметичен).
- [ ] Ручная проверка: переключение языка в `/me/settings` меняет локализованные строки (notifications) и формат дат после `router.refresh()`.
