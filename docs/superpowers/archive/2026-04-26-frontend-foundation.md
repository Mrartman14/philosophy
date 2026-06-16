# Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Шаг-за-шагом подготовить фундамент фронтенда (`philosophy/`) для параллельной работы агентов: чистый build, инфраструктура (Vitest, ESLint guardrails), shared utils с расширенным `ActionResult` и `Zod`-валидацией, UI-kit на 16 примитивах поверх Base UI, итоговый root и admin layout, шаблон слайса и документация конвенций.

**Architecture:** Облегчённый Feature-Sliced Design ("B+"). Один entity = одна папка `src/features/<entity>/{index.ts, api.ts, actions.ts, permissions.ts, schemas.ts, types.ts, ui/}`. SSR-first: server components по умолчанию, мутации через server actions с `createFormAction` + `requireCapability` + `revalidateEntity`. Формы — client islands на Base UI Form с Zod-валидацией. Cross-feature импорты запрещены ESLint'ом, deep-импорты в чужие фичи — тоже.

**Tech Stack:** Next.js 16 (App Router) + React 19 + Tailwind 4 + Base UI 1.x + openapi-fetch + Zod + Vitest. См. spec: [`docs/superpowers/specs/2026-04-26-frontend-foundation-design.md`](../specs/2026-04-26-frontend-foundation-design.md).

**Pre-conditions:**
- Бэкенд `philosophy-api/` живёт в воркт ри `../philosophy-api`. Swagger-схема: `../philosophy-api/docs/swagger/swagger.json`.
- В `package.json` уже есть скрипт `generate:api`.
- В `src/utils/` есть `create-action.ts`, `me.ts`, `permissions.ts` (трогаем). `permissions.ts` остаётся как есть.
- В `src/components/` есть `app/`, `permission/`, `markdown-editor/`, `shared/`, `yandex-metrika/`. Не трогаем кроме `shared/skeleton/`.
- Текущий `main` сломан: 45 импортов из удалённого `src/features/`. Первая задача — починить build.

**Все коммиты делать с trailer'ом** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` (как в существующих коммитах репозитория).

---

## Phase 1: Restore Clean Build State

### Task 1: Strip broken feature imports + delete broken admin pages

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/app/app-header/app-header.tsx`
- Delete: `src/app/page.tsx`, `src/app/search/`, `src/app/admin/lectures/`, `src/app/admin/comments/`, `src/app/admin/annotations/`, `src/app/admin/users/`, `src/app/admin/push/`, `src/app/admin/page.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/forbidden.tsx`, `src/app/admin/error.tsx`, `src/app/admin/loading.tsx`, `src/app/login/`, `src/app/register/`, `src/app/lectures/` (все ссылаются на удалённый `@/features/`).

**Why:** Текущий `main` не собирается. Перед добавлением чего-либо нужен зелёный build. Все эти роуты будут заведены заново их фичами в отдельных PR.

- [ ] **Step 1: Убедиться, что build сейчас падает**

Run: `npm run build`
Expected: FAIL — Module not found ошибки на `@/features/...`.

- [ ] **Step 2: Удалить все сломанные роуты**

```bash
rm -rf src/app/admin
rm -rf src/app/search
rm -rf src/app/login
rm -rf src/app/register
rm -rf src/app/lectures
rm -f src/app/page.tsx
```

- [ ] **Step 3: Создать минимальный `src/app/page.tsx` (заглушка главной)**

```tsx
// src/app/page.tsx
export const metadata = { title: "Философия-ликбез" };

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <h1 className="text-3xl font-bold">Философия-ликбез</h1>
      <p className="text-(--color-description)">
        Контент готовится. Вернитесь позже.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Упростить `src/components/app/app-header/app-header.tsx` — выпилить SearchInput и logout**

Прочитать файл, удалить импорты `@/features/search/search-input` и `@/features/auth/actions`, удалить их использование. Оставить остальной хедер (логотип, навигация, инсталл-баннер). Если `SearchInput` или `logout` были обязательными частями — заменить на пустой placeholder-`<div>` с TODO-комментарием для будущей `auth`/`search` фичи.

Точечный пример того, что должно остаться (упрощённо):

```tsx
// импорты SearchInput и logout — удалены
// JSX: на месте <SearchInput /> и кнопки logout — ничего не рендерим
```

Не пытаться сохранить функциональность — она будет восстановлена соответствующими фичами.

- [ ] **Step 5: Упростить `src/app/layout.tsx` — убрать getLectures**

Заменить на минимальный layout без `getLectures`. `me` получаем по-прежнему через `getMe()` для `StatusBanner`. `AppHeader` получает `lectures={[]}` (или, если упрощали структуру — без этого prop'а).

```tsx
// src/app/layout.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AppHeader } from "@/components/app/app-header/app-header";
import { InstallBanner } from "@/components/app/install-banner";
import { UpdatePrompt } from "@/components/app/update-prompt";
import { YandexMetrika } from "@/components/yandex-metrika/yandex-metrika";
import { getMe, type MaybeMe } from "@/utils/me";
import { StatusBanner } from "@/components/permission/status-banner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const geistClasses = "font-[family-name:var(--font-geist-sans)]";

export const metadata: Metadata = {
  title: "Философия-ликбез",
  description: "Архив занятий курса Философия-ликбез",
  manifest: "/manifest.webmanifest",
  appleWebApp: { title: "ФЛБЗ", capable: true, statusBarStyle: "black-translucent" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let me: MaybeMe = null;
  try {
    me = await getMe();
  } catch {
    // допустимая деградация: header покажет «Войти», StatusBanner ничего не нарисует
  }

  return (
    <html lang="ru">
      <head>
        <meta name="theme-color" content="#f8f8f8" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#111a20" media="(prefers-color-scheme: dark)" />
      </head>
      <body
        className={`
          root bg-(--color-background)
          ${geistSans.variable} ${geistMono.variable} antialiased
          grid grid-rows-[var(--header-height)_1fr] items-stretch justify-items-center min-h-screen
          ${geistClasses}
        `}
      >
        <AppHeader me={me} />
        <StatusBanner me={me} />
        <InstallBanner />
        <main className="w-[100vw] max-w-[100vw] lg:w-full lg:max-w-screen-lg flex flex-col items-center md:border-l md:border-r md:border-(--color-border)">
          {children}
        </main>
        <UpdatePrompt />
        <Suspense>
          <YandexMetrika />
        </Suspense>
      </body>
    </html>
  );
}
```

Если у `AppHeader` после Step 4 другая сигнатура — поправить вызов соответственно.

- [ ] **Step 6: Убедиться, что build зелёный**

Run: `npm run lint && npm run build`
Expected: PASS. Никаких ошибок про `@/features/...`.

- [ ] **Step 7: Убедиться, что `grep -r "@/features" src/` возвращает 0 строк**

Run: `grep -rn "@/features" src/ || echo "OK: no broken imports"`
Expected: `OK: no broken imports`

- [ ] **Step 8: Commit**

`git add` по конкретным путям (не `-A` / `.` — см. CLAUDE.md). Удаления внутри указанного пути попадают в индекс автоматически.

```bash
git add src/app src/components/app/app-header/app-header.tsx
git status  # убедиться, что вне `src/app` и AppHeader ничего не застейджено
git commit -m "$(cat <<'EOF'
chore(foundation): strip broken feature imports, restore clean build

Remove all routes and components that import from the deleted src/features/
tree. Replace src/app/page.tsx with a placeholder; trim AppHeader to drop
SearchInput and logout references. Routes will be re-introduced by their
respective feature slices in subsequent PRs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Tooling

### Task 2: Regenerate API schema

**Files:**
- Modify: `src/api/schema.ts`

- [ ] **Step 1: Запустить генерацию против актуального swagger**

Run: `npm run generate:api`
Expected: PASS, `src/api/schema.ts` обновлён.

- [ ] **Step 2: Убедиться, что build по-прежнему зелёный**

Run: `npm run build`
Expected: PASS. Если какие-то места используют типы из старой схемы и больше не компилируются — поправить точечно.

- [ ] **Step 3: Commit**

```bash
git add src/api/schema.ts
git commit -m "$(cat <<'EOF'
chore(api): regenerate schema.ts from current philosophy-api swagger

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 3: Add Zod, Vitest, jsdom, clsx dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

**Why:** `zod` нужен для серверной валидации форм; `vitest` + `jsdom` + `@vitest/coverage-v8` — тестовый стек; `clsx` — стандартная утилита для объединения classNames в variant-компонентах UI-kit'а.

- [ ] **Step 1: Установить runtime-зависимости**

Run: `npm install zod clsx`
Expected: PASS, обе версии добавлены в `dependencies`.

- [ ] **Step 2: Установить dev-зависимости**

Run: `npm install -D vitest @vitest/coverage-v8 jsdom`
Expected: PASS.

- [ ] **Step 3: Добавить test-скрипты в `package.json`**

В секцию `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 4: Убедиться, что lock-file не сломал build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore(deps): add zod, clsx, vitest + jsdom for foundation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 4: Vitest config + canary test

**Files:**
- Create: `vitest.config.ts`
- Create: `src/utils/canary.test.ts`

- [ ] **Step 1: Создать `vitest.config.ts`**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

- [ ] **Step 2: Создать canary-тест**

```ts
// src/utils/canary.test.ts
import { describe, it, expect } from "vitest";

describe("vitest canary", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });

  it("has FormData in jsdom", () => {
    const fd = new FormData();
    fd.set("name", "Alice");
    expect(fd.get("name")).toBe("Alice");
  });
});
```

- [ ] **Step 3: Запустить тесты — должны пройти**

Run: `npm test`
Expected: PASS — 2 теста зелёные.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts src/utils/canary.test.ts
git commit -m "$(cat <<'EOF'
chore(test): vitest config + canary test

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: Utils Foundation (TDD)

### Task 5: ZodValidationError + parseFormData

**Files:**
- Modify: `src/utils/create-action.ts`
- Create: `src/utils/create-action.test.ts`

**Why:** Каждый `createFormAction` будет валидировать `FormData` через Zod-схему. `parseFormData` инкапсулирует этот вызов и преобразует `ZodError` в `ZodValidationError` с готовой `fieldErrors`-картой `{ <fieldName>: <первое сообщение> }`. Это позволит `createFormAction` единообразно ловить эту ошибку и возвращать `{ success: false, code: "validation", fieldErrors }`.

- [ ] **Step 1: Написать падающие тесты для parseFormData**

```ts
// src/utils/create-action.test.ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseFormData, ZodValidationError } from "./create-action";

describe("parseFormData", () => {
  it("returns parsed object on valid FormData", () => {
    const schema = z.object({ name: z.string().min(1), age: z.coerce.number() });
    const fd = new FormData();
    fd.set("name", "Alice");
    fd.set("age", "30");
    expect(parseFormData(schema, fd)).toEqual({ name: "Alice", age: 30 });
  });

  it("throws ZodValidationError with fieldErrors map on invalid data", () => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(2),
    });
    const fd = new FormData();
    fd.set("email", "not-an-email");
    fd.set("name", "A");
    try {
      parseFormData(schema, fd);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ZodValidationError);
      const err = e as ZodValidationError;
      expect(Object.keys(err.fieldErrors)).toEqual(
        expect.arrayContaining(["email", "name"])
      );
      expect(typeof err.fieldErrors.email).toBe("string");
      expect(typeof err.fieldErrors.name).toBe("string");
    }
  });

  it("only reports first error per field", () => {
    const schema = z.object({ pwd: z.string().min(8).regex(/[A-Z]/) });
    const fd = new FormData();
    fd.set("pwd", "ab");
    try {
      parseFormData(schema, fd);
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as ZodValidationError;
      expect(err.fieldErrors.pwd).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Запустить — должны упасть**

Run: `npm test -- create-action`
Expected: FAIL (`ZodValidationError`/`parseFormData` не экспортированы).

- [ ] **Step 3: Реализовать parseFormData и ZodValidationError**

Добавить в `src/utils/create-action.ts` (поверх существующего файла):

```ts
import { z, type ZodType } from "zod";

/**
 * Бросается из `parseFormData`, когда `FormData` не прошла Zod-валидацию.
 * `createFormAction` ловит её и возвращает
 * `{ success: false, code: "validation", error, fieldErrors }`.
 */
export class ZodValidationError extends Error {
  readonly code = "validation" as const;
  constructor(
    public readonly fieldErrors: Record<string, string>,
    message?: string
  ) {
    super(message ?? "Validation failed");
    this.name = "ZodValidationError";
  }
}

/**
 * Парсит `FormData` через Zod-схему. При успехе — возвращает типизированный
 * объект. При неуспехе — бросает `ZodValidationError`, у которого
 * `fieldErrors[name]` = первое сообщение об ошибке для каждого поля.
 *
 * Преобразует `FormData` в plain-object через `Object.fromEntries(fd.entries())`.
 * Для multi-value полей (множественный select, checkbox-group) используйте
 * `z.array(z.string())` в схеме и кастомное преобразование, не покрывается этим
 * хелпером.
 */
export function parseFormData<T extends ZodType>(
  schema: T,
  formData: FormData
): z.infer<T> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  throw new ZodValidationError(fieldErrors);
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `npm test -- create-action`
Expected: PASS — 3 теста зелёные. canary тоже зелёный.

- [ ] **Step 5: Commit**

```bash
git add src/utils/create-action.ts src/utils/create-action.test.ts
git commit -m "$(cat <<'EOF'
feat(utils): parseFormData + ZodValidationError

Add Zod-based FormData parsing helper that throws ZodValidationError with
a {name: message} fieldErrors map. Used by createFormAction (next commit) to
return validation errors uniformly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 6: Extend ActionResult + handle ZodValidationError in createFormAction

**Files:**
- Modify: `src/utils/create-action.ts`
- Modify: `src/utils/create-action.test.ts`

- [ ] **Step 1: Добавить тесты на новое поведение**

Добавить в `src/utils/create-action.test.ts`:

```ts
import { z } from "zod";
import {
  createAction,
  createFormAction,
  parseFormData,
  ZodValidationError,
} from "./create-action";
import { ForbiddenError } from "./permissions";

describe("createFormAction", () => {
  it("returns success on happy path", async () => {
    const action = createFormAction(async (fd: FormData) => fd.get("x") as string);
    const fd = new FormData();
    fd.set("x", "ok");
    const result = await action({ success: true, data: undefined }, fd);
    expect(result).toEqual({ success: true, data: "ok" });
  });

  it("returns code='forbidden' on ForbiddenError", async () => {
    const action = createFormAction(async () => {
      throw new ForbiddenError("role");
    });
    const result = await action({ success: true, data: undefined }, new FormData());
    expect(result).toMatchObject({ success: false, code: "forbidden" });
  });

  it("returns code='validation' with fieldErrors on ZodValidationError", async () => {
    const schema = z.object({ email: z.string().email() });
    const action = createFormAction(async (fd: FormData) => {
      parseFormData(schema, fd);
      return null;
    });
    const fd = new FormData();
    fd.set("email", "bad");
    const result = await action({ success: true, data: undefined }, fd);
    expect(result).toMatchObject({
      success: false,
      code: "validation",
      fieldErrors: expect.objectContaining({ email: expect.any(String) }),
    });
  });

  it("returns generic error for unknown errors", async () => {
    const action = createFormAction(async () => {
      throw new Error("boom");
    });
    const result = await action({ success: true, data: undefined }, new FormData());
    expect(result).toEqual({ success: false, error: "boom" });
    expect((result as { code?: string }).code).toBeUndefined();
  });
});

describe("ZodValidationError", () => {
  it("is also caught directly by createFormAction (without parseFormData wrapping)", async () => {
    const action = createFormAction(async () => {
      throw new ZodValidationError({ x: "must be set" });
    });
    const result = await action({ success: true, data: undefined }, new FormData());
    expect(result).toMatchObject({
      success: false,
      code: "validation",
      fieldErrors: { x: "must be set" },
    });
  });
});
```

- [ ] **Step 2: Запустить — последний тест-блок должен упасть**

Run: `npm test -- create-action`
Expected: FAIL — `code: "validation"` ещё не реализован в `toResult`.

- [ ] **Step 3: Расширить `ActionResult` и `toResult`**

Заменить в `src/utils/create-action.ts` определение `ActionResult` и функцию `toResult`:

```ts
export type ActionResult<T = void> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      code?: "forbidden" | "validation";
      fieldErrors?: Record<string, string>;
    };

function toResult<T>(error: unknown): ActionResult<T> {
  if (error instanceof ForbiddenError) {
    return { success: false, error: error.message, code: "forbidden" };
  }
  if (error instanceof ZodValidationError) {
    return {
      success: false,
      error: error.message,
      code: "validation",
      fieldErrors: error.fieldErrors,
    };
  }
  const message = error instanceof Error ? error.message : "Неизвестная ошибка";
  return { success: false, error: message };
}
```

`ZodValidationError` уже импортится/определён в этом же файле — лишних импортов не нужно.

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `npm test -- create-action`
Expected: PASS — все тесты зелёные.

- [ ] **Step 5: Commit**

```bash
git add src/utils/create-action.ts src/utils/create-action.test.ts
git commit -m "$(cat <<'EOF'
feat(utils): extend ActionResult with code='validation' + fieldErrors

createFormAction and createAction now catch ZodValidationError and surface it
as { success: false, code: 'validation', fieldErrors } so forms can display
field-level errors from server-side Zod validation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 7: revalidateEntity helper

**Files:**
- Create: `src/utils/revalidate.ts`
- Create: `src/utils/revalidate.test.ts`

**Why:** Единый паттерн инвалидации кеша после мутаций. Все list-fetchers ставят тег `["<entity>"]`, item-fetchers — `["<entity>:<id>"]`. После мутации `revalidateEntity("comments", id)` сбрасывает оба.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/utils/revalidate.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

import { revalidateTag } from "next/cache";
import { revalidateEntity } from "./revalidate";

describe("revalidateEntity", () => {
  it("invalidates the list tag", () => {
    vi.mocked(revalidateTag).mockClear();
    revalidateEntity("comments");
    expect(revalidateTag).toHaveBeenCalledTimes(1);
    expect(revalidateTag).toHaveBeenCalledWith("comments");
  });

  it("invalidates list + item tags when id is given", () => {
    vi.mocked(revalidateTag).mockClear();
    revalidateEntity("comments", "abc-123");
    expect(revalidateTag).toHaveBeenCalledTimes(2);
    expect(revalidateTag).toHaveBeenCalledWith("comments");
    expect(revalidateTag).toHaveBeenCalledWith("comments:abc-123");
  });
});
```

- [ ] **Step 2: Запустить — должен упасть**

Run: `npm test -- revalidate`
Expected: FAIL (модуль не существует).

- [ ] **Step 3: Реализовать**

```ts
// src/utils/revalidate.ts
import "server-only";
import { revalidateTag } from "next/cache";

/**
 * Сбрасывает Next.js cache по конвенции тегов: `<entity>` для списков и
 * `<entity>:<id>` для конкретного item'а. Используется в server actions после
 * мутаций.
 *
 * Соответствующие fetchers в `features/<X>/api.ts` должны ставить эти теги в
 * `unstable_cache(..., { tags: ["<entity>"] })` или `["<entity>:<id>"]`.
 */
export function revalidateEntity(entity: string, id?: string): void {
  revalidateTag(entity);
  if (id) revalidateTag(`${entity}:${id}`);
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `npm test`
Expected: PASS — все тесты зелёные.

- [ ] **Step 5: Commit**

```bash
git add src/utils/revalidate.ts src/utils/revalidate.test.ts
git commit -m "$(cat <<'EOF'
feat(utils): revalidateEntity helper for tag-based cache invalidation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 8: api/tags.ts registry

**Files:**
- Create: `src/api/tags.ts`

**Why:** Защита от typo в строковых тегах. Каждая фича добавляет свою константу при создании; foundation добавляет только базовый файл с примером.

- [ ] **Step 1: Создать файл**

```ts
// src/api/tags.ts
/**
 * Реестр строковых тегов для `unstable_cache` и `revalidateTag`.
 *
 * Каждая фича добавляет сюда константу при создании своего api.ts. Это
 * защищает от typo (typo в строковом литерале молча сделает тег уникальным,
 * и инвалидация перестанет работать).
 *
 * Конвенция: имя совпадает с именем сущности в множественном числе,
 * например LECTURES, COMMENTS, ANNOTATIONS. Item-теги формируются как
 * `${TAG}:${id}` runtime'ом в api.ts фичи.
 */

export const Tags = {
  // example — каждая фича дополняет:
  // LECTURES: "lectures",
  // COMMENTS: "comments",
} as const;

export type EntityTag = (typeof Tags)[keyof typeof Tags];
```

- [ ] **Step 2: Убедиться, что lint и build чистые**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/api/tags.ts
git commit -m "$(cat <<'EOF'
feat(api): tags registry for unstable_cache / revalidateTag

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: UI Kit

### Task 9: classNames helper (`cn`)

**Files:**
- Create: `src/components/ui/cn.ts`

**Why:** Все variant-компоненты UI-kit'а используют `cn(...classes)` для условных Tailwind-классов. Тонкая обёртка над `clsx`.

- [ ] **Step 1: Создать файл**

```ts
// src/components/ui/cn.ts
import { clsx, type ClassValue } from "clsx";

/** Условное склеивание классов. Тонкая обёртка над clsx. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/cn.ts
git commit -m "$(cat <<'EOF'
feat(ui): cn classNames helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 10: Button + IconButton

**Files:**
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/icon-button.tsx`

**Why:** Базовые кнопки с вариантами (primary/secondary/ghost/danger) и единым размерным масштабом. Поверх `<button>`, без обёрток Base UI (для простых кнопок Base UI ничего не даёт).

- [ ] **Step 1: Создать `button.tsx`**

```tsx
// src/components/ui/button.tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-(--color-foreground) text-(--color-background) hover:opacity-90 disabled:opacity-50",
  secondary:
    "border border-(--color-border) bg-(--color-text-pane) hover:bg-(--color-background) disabled:opacity-50",
  ghost:
    "hover:bg-(--color-text-pane) disabled:opacity-50",
  danger:
    "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded font-medium transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-foreground)",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...rest}
    />
  );
});
```

- [ ] **Step 2: Создать `icon-button.tsx`**

```tsx
// src/components/ui/icon-button.tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";
import type { ButtonVariant } from "./button";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Обязательный label для скринридеров. */
  "aria-label": string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-(--color-foreground) text-(--color-background) hover:opacity-90 disabled:opacity-50",
  secondary: "border border-(--color-border) hover:bg-(--color-text-pane) disabled:opacity-50",
  ghost: "hover:bg-(--color-text-pane) disabled:opacity-50",
  danger: "text-red-600 hover:bg-red-50 disabled:opacity-50",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ variant = "ghost", className, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded transition",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-foreground)",
          variantClasses[variant],
          className
        )}
        {...rest}
      />
    );
  }
);
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/icon-button.tsx
git commit -m "$(cat <<'EOF'
feat(ui): Button + IconButton with primary/secondary/ghost/danger variants

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 11: TextInput + Textarea

**Files:**
- Create: `src/components/ui/text-input.tsx`
- Create: `src/components/ui/textarea.tsx`

**Why:** Единый стиль для нативных `<input>` / `<textarea>`. Field.Control из Base UI оборачивает их в Field-контекст и автоматически связывает с Label/Error — для этого они и должны принимать `ref` и весь нативный набор props.

- [ ] **Step 1: Создать `text-input.tsx`**

```tsx
// src/components/ui/text-input.tsx
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

export type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ className, type = "text", ...rest }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-10 w-full rounded border border-(--color-border) bg-(--color-background) px-3 text-sm",
          "placeholder:text-(--color-description)",
          "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-(--color-foreground)",
          "disabled:opacity-50 data-[invalid]:border-red-500",
          className
        )}
        {...rest}
      />
    );
  }
);
```

- [ ] **Step 2: Создать `textarea.tsx`**

```tsx
// src/components/ui/textarea.tsx
import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, rows = 4, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "block w-full rounded border border-(--color-border) bg-(--color-background) px-3 py-2 text-sm",
          "placeholder:text-(--color-description)",
          "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-(--color-foreground)",
          "disabled:opacity-50 data-[invalid]:border-red-500",
          className
        )}
        {...rest}
      />
    );
  }
);
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/text-input.tsx src/components/ui/textarea.tsx
git commit -m "$(cat <<'EOF'
feat(ui): TextInput and Textarea with unified form styling

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 12: Select + Checkbox

**Files:**
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/checkbox.tsx`

**Why:** Тонкие обёртки над `Select` и `Checkbox` из Base UI. Обе используют `data-*` атрибуты для состояний, которые мы стилизуем через Tailwind.

- [ ] **Step 1: Создать `select.tsx`**

```tsx
"use client";
// src/components/ui/select.tsx
import { Select as BaseSelect } from "@base-ui/react/select";
import type { ReactNode } from "react";
import { cn } from "./cn";

interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: ReactNode;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * Тонкая обёртка над Base UI Select. Для form-кейса нужен `name` —
 * Base UI Select сам отрисует hidden input под капотом.
 */
export function Select({
  name,
  defaultValue,
  value,
  onValueChange,
  options,
  placeholder = "Выберите…",
  disabled,
  className,
  "aria-label": ariaLabel,
}: SelectProps) {
  return (
    <BaseSelect.Root
      name={name}
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <BaseSelect.Trigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-10 w-full items-center justify-between gap-2 rounded border border-(--color-border) bg-(--color-background) px-3 text-sm",
          "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-(--color-foreground)",
          "data-[disabled]:opacity-50",
          className
        )}
      >
        <BaseSelect.Value>{(value) => value ?? placeholder}</BaseSelect.Value>
        <BaseSelect.Icon>▾</BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={4} className="outline-none">
          <BaseSelect.Popup className="min-w-(--anchor-width) rounded border border-(--color-border) bg-(--color-background) p-1 shadow-lg">
            {options.map((opt) => (
              <BaseSelect.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  "flex cursor-pointer items-center rounded px-2 py-1.5 text-sm outline-none",
                  "data-[highlighted]:bg-(--color-text-pane)",
                  "data-[selected]:font-semibold"
                )}
              >
                <BaseSelect.ItemText>{opt.label}</BaseSelect.ItemText>
              </BaseSelect.Item>
            ))}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
```

> **Совместимость API:** проверьте структуру частей Base UI Select против `node_modules/@base-ui/react/select/`. Если имена частей отличаются (например, `Select.Trigger` vs другая структура) — поправьте JSX строго по фактическому API установленной версии. Стилизация и контракт компонента (`name`, `options`) при этом остаются.

- [ ] **Step 2: Создать `checkbox.tsx`**

```tsx
"use client";
// src/components/ui/checkbox.tsx
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { forwardRef } from "react";
import { cn } from "./cn";

export interface CheckboxProps {
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <BaseCheckbox.Root
        ref={ref}
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded border border-(--color-border) bg-(--color-background)",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-foreground)",
          "data-[checked]:bg-(--color-foreground) data-[checked]:text-(--color-background)",
          "data-[disabled]:opacity-50",
          className
        )}
        {...props}
      >
        <BaseCheckbox.Indicator>✓</BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
    );
  }
);
```

> **Совместимость API:** аналогично, проверьте `node_modules/@base-ui/react/checkbox/` на корректные имена частей.

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/select.tsx src/components/ui/checkbox.tsx
git commit -m "$(cat <<'EOF'
feat(ui): Select and Checkbox wrappers over Base UI

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 13: Form + FormField + SubmitButton

**Files:**
- Create: `src/components/ui/form.tsx`
- Create: `src/components/ui/form-field.tsx`
- Create: `src/components/ui/submit-button.tsx`

**Why:** Форменное трио. `Form` — client-обёртка над Base UI `Form` с пробросом `errors` (берётся из `ActionResult.fieldErrors`). `FormField` — обёртка над Base UI `Field` (Root + Label + Control + Error). `SubmitButton` использует `useFormStatus` для pending state.

- [ ] **Step 1: Создать `form.tsx`**

```tsx
"use client";
// src/components/ui/form.tsx
import { Form as BaseForm } from "@base-ui/react/form";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

interface FormProps extends Omit<ComponentProps<typeof BaseForm>, "children"> {
  errors?: Record<string, string>;
  className?: string;
  children: ReactNode;
}

/**
 * Тонкая обёртка над Base UI Form. Принимает `errors`-карту от
 * `ActionResult.fieldErrors`, Base UI сам распределяет ошибки по полям с
 * совпадающим `name`.
 */
export function Form({ errors, className, children, ...rest }: FormProps) {
  return (
    <BaseForm errors={errors} className={cn("flex flex-col gap-4", className)} {...rest}>
      {children}
    </BaseForm>
  );
}
```

- [ ] **Step 2: Создать `form-field.tsx`**

```tsx
"use client";
// src/components/ui/form-field.tsx
import { Field } from "@base-ui/react/field";
import type { ReactNode } from "react";
import { cn } from "./cn";

export interface FormFieldProps {
  name: string;
  label: ReactNode;
  description?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Стандартизированная обёртка над Base UI Field. Внутри `children` рендерится
 * нативный контрол (`<input>`, `<textarea>` или Base UI Field.Control обёртка).
 *
 * Field.Error автоматически берёт сообщение из errors-карты `<Form>` по
 * совпадающему `name`.
 */
export function FormField({
  name,
  label,
  description,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <Field.Root name={name} className={cn("flex flex-col gap-1", className)}>
      <Field.Label className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Field.Label>
      {children}
      {description && (
        <Field.Description className="text-xs text-(--color-description)">
          {description}
        </Field.Description>
      )}
      <Field.Error className="text-xs text-red-600" />
    </Field.Root>
  );
}
```

- [ ] **Step 3: Создать `submit-button.tsx`**

```tsx
"use client";
// src/components/ui/submit-button.tsx
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";

export function SubmitButton({ children, disabled, ...rest }: ButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} {...rest}>
      {pending ? "…" : children}
    </Button>
  );
}
```

- [ ] **Step 4: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/form.tsx src/components/ui/form-field.tsx src/components/ui/submit-button.tsx
git commit -m "$(cat <<'EOF'
feat(ui): Form, FormField, SubmitButton — Base UI Form trio

Form forwards ActionResult.fieldErrors to Base UI's errors prop; FormField
standardizes Field.Root + Label + Error; SubmitButton wraps Button with
useFormStatus pending state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 14: Dialog + ConfirmDialog

**Files:**
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/ui/confirm-dialog.tsx`

- [ ] **Step 1: Создать `dialog.tsx`**

```tsx
"use client";
// src/components/ui/dialog.tsx
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { cn } from "./cn";

interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  className,
}: DialogProps) {
  return (
    <BaseDialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger && <BaseDialog.Trigger render={trigger as never} />}
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 bg-black/40 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity" />
        <BaseDialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "w-full max-w-lg rounded-lg border border-(--color-border) bg-(--color-background) p-6 shadow-xl",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity",
            className
          )}
        >
          <BaseDialog.Title className="text-lg font-semibold">{title}</BaseDialog.Title>
          {description && (
            <BaseDialog.Description className="mt-1 text-sm text-(--color-description)">
              {description}
            </BaseDialog.Description>
          )}
          <div className="mt-4">{children}</div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export const DialogClose = BaseDialog.Close;
```

> **Совместимость API:** проверьте `node_modules/@base-ui/react/dialog/`. В частности — путь к Trigger render-API; если в текущей версии Trigger принимает `children` напрямую (а не через `render`-prop), упростите Trigger-обёртку соответственно.

- [ ] **Step 2: Создать `confirm-dialog.tsx`**

```tsx
"use client";
// src/components/ui/confirm-dialog.tsx
import { useState, type ReactNode } from "react";
import { Dialog, DialogClose } from "./dialog";
import { Button } from "./button";

interface ConfirmDialogProps {
  trigger: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={title}
      description={description}
    >
      <div className="flex justify-end gap-2">
        <DialogClose render={<Button variant="ghost">{cancelLabel}</Button>} />
        <Button
          variant={destructive ? "danger" : "primary"}
          disabled={pending}
          onClick={handleConfirm}
        >
          {pending ? "…" : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/dialog.tsx src/components/ui/confirm-dialog.tsx
git commit -m "$(cat <<'EOF'
feat(ui): Dialog and ConfirmDialog over Base UI Dialog

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 15: Table primitives

**Files:**
- Create: `src/components/ui/table.tsx`

**Why:** Минимальная стилизация нативных `<table>`/`<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>`. Без сортировки, фильтров, виртуализации — это поднимем по правилу "extract on second use".

- [ ] **Step 1: Создать файл**

```tsx
// src/components/ui/table.tsx
import { forwardRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cn } from "./cn";

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  function Table({ className, ...rest }, ref) {
    return (
      <div className="w-full overflow-x-auto">
        <table
          ref={ref}
          className={cn("w-full border-collapse text-sm", className)}
          {...rest}
        />
      </div>
    );
  }
);

export const Thead = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function Thead({ className, ...rest }, ref) {
    return (
      <thead
        ref={ref}
        className={cn("border-b border-(--color-border) text-left", className)}
        {...rest}
      />
    );
  }
);

export const Tbody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function Tbody({ className, ...rest }, ref) {
    return <tbody ref={ref} className={className} {...rest} />;
  }
);

export const Tr = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  function Tr({ className, ...rest }, ref) {
    return (
      <tr
        ref={ref}
        className={cn("border-b border-(--color-border) last:border-b-0", className)}
        {...rest}
      />
    );
  }
);

export const Th = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  function Th({ className, ...rest }, ref) {
    return (
      <th
        ref={ref}
        className={cn("px-3 py-2 font-semibold text-(--color-description)", className)}
        {...rest}
      />
    );
  }
);

export const Td = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  function Td({ className, ...rest }, ref) {
    return <td ref={ref} className={cn("px-3 py-2", className)} {...rest} />;
  }
);
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/table.tsx
git commit -m "$(cat <<'EOF'
feat(ui): minimal Table primitives (Table/Thead/Tbody/Tr/Th/Td)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 16: Toast + Toaster

**Files:**
- Create: `src/components/ui/toast.tsx`
- Create: `src/components/ui/toaster.tsx`

**Why:** Глобальная система тостов поверх Base UI Toast. `<Toaster />` ставится в root layout один раз; фичи дёргают `useToast()` для показа сообщений (например, об успешной мутации).

- [ ] **Step 1: Создать `toast.tsx` — провайдер и хук**

```tsx
"use client";
// src/components/ui/toast.tsx
import { Toast as BaseToast } from "@base-ui/react/toast";
import type { ReactNode } from "react";

/**
 * Provider должен оборачивать всё, что использует useToast (root layout).
 * Toaster (отдельный файл) рендерит Viewport.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  return <BaseToast.Provider>{children}</BaseToast.Provider>;
}

export function useToast() {
  return BaseToast.useToastManager();
}
```

> **Совместимость API:** проверьте `node_modules/@base-ui/react/toast/`. Если хук называется иначе (`createToastManager`/`useToastManager`) — используйте фактический.

- [ ] **Step 2: Создать `toaster.tsx` — viewport**

```tsx
"use client";
// src/components/ui/toaster.tsx
import { Toast as BaseToast } from "@base-ui/react/toast";
import { cn } from "./cn";

export function Toaster() {
  return (
    <BaseToast.Portal>
      <BaseToast.Viewport className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        <BaseToast.List>
          {(toast) => (
            <BaseToast.Root
              toast={toast}
              key={toast.id}
              className={cn(
                "rounded border border-(--color-border) bg-(--color-background) p-3 shadow-lg",
                "data-[type=error]:border-red-500"
              )}
            >
              <BaseToast.Title className="text-sm font-semibold">
                {toast.title}
              </BaseToast.Title>
              {toast.description && (
                <BaseToast.Description className="mt-1 text-xs text-(--color-description)">
                  {toast.description}
                </BaseToast.Description>
              )}
            </BaseToast.Root>
          )}
        </BaseToast.List>
      </BaseToast.Viewport>
    </BaseToast.Portal>
  );
}
```

> **Совместимость API:** Base UI Toast в текущей версии экспортирует Provider/Viewport/List/Root. Если структура частей отличается (например, нужен `BaseToast.Provider` снаружи `Portal`) — приведите в соответствие с фактическим API. Логика «один Provider, один Viewport, тосты добавляются через manager» неизменна.

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/toast.tsx src/components/ui/toaster.tsx
git commit -m "$(cat <<'EOF'
feat(ui): Toast provider + useToast hook + Toaster viewport

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 17: EmptyState + Pagination + Skeleton (move)

**Files:**
- Create: `src/components/ui/empty-state.tsx`
- Create: `src/components/ui/pagination.tsx`
- Move: `src/components/shared/skeleton/...` → `src/components/ui/skeleton.tsx` (свести в один файл, если там сейчас много мелких)

- [ ] **Step 1: Прочитать текущий skeleton и определить, как переносить**

Run: `ls src/components/shared/skeleton/`
Прочитать содержимое каждого файла. Если там один компонент `Skeleton` — переписать в `src/components/ui/skeleton.tsx`. Если их несколько вариантов (например, `LineSkeleton`, `BlockSkeleton`) — оставить такую же декомпозицию в новом файле.

- [ ] **Step 2: Создать `src/components/ui/skeleton.tsx`**

```tsx
// src/components/ui/skeleton.tsx
import { type HTMLAttributes } from "react";
import { cn } from "./cn";

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...rest }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-(--color-text-pane)", className)}
      {...rest}
    />
  );
}
```

(Если в старом skeleton'е была другая логика — сохранить её, заменив только импорт `cn` и токены.)

- [ ] **Step 3: Удалить старый `src/components/shared/skeleton/`**

Run: `rm -rf src/components/shared/skeleton`

- [ ] **Step 4: Найти и обновить все импорты старого skeleton'а**

Run: `grep -rn "components/shared/skeleton" src/ || echo "OK: no old imports"`

Если есть импорты — поправить на `@/components/ui/skeleton`.

- [ ] **Step 5: Создать `empty-state.tsx`**

```tsx
// src/components/ui/empty-state.tsx
import type { ReactNode } from "react";
import { cn } from "./cn";

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded border border-dashed border-(--color-border) p-8 text-center",
        className
      )}
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && (
        <p className="max-w-sm text-xs text-(--color-description)">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 6: Создать `pagination.tsx`**

```tsx
// src/components/ui/pagination.tsx
import Link from "next/link";
import { cn } from "./cn";

interface PaginationProps {
  basePath: string;
  /** Имя query-параметра для offset. По умолчанию "offset". */
  offsetParam?: string;
  offset: number;
  limit: number;
  total: number;
  className?: string;
}

/**
 * Простая offset/limit пагинация на URL searchParams. SSR-friendly: просто
 * рендерит ссылки, никакого client state. `basePath` — путь без query, например
 * "/admin/comments". Существующие searchParams сохраняются автоматически на
 * стороне Next.js при использовании `<Link>` с относительным href; если нужно
 * сохранить дополнительные фильтры — переключить на `searchParams.toString()`
 * на стороне страницы.
 */
export function Pagination({
  basePath,
  offsetParam = "offset",
  offset,
  limit,
  total,
  className,
}: PaginationProps) {
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;
  const prev = Math.max(0, offset - limit);
  const next = offset + limit;

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center gap-2 text-sm", className)}
    >
      {hasPrev ? (
        <Link
          href={`${basePath}?${offsetParam}=${prev}`}
          className="rounded border border-(--color-border) px-3 py-1 hover:bg-(--color-text-pane)"
        >
          ← Назад
        </Link>
      ) : (
        <span className="rounded border border-(--color-border) px-3 py-1 opacity-40">
          ← Назад
        </span>
      )}
      <span className="text-(--color-description)">
        {offset + 1}–{Math.min(offset + limit, total)} из {total}
      </span>
      {hasNext ? (
        <Link
          href={`${basePath}?${offsetParam}=${next}`}
          className="rounded border border-(--color-border) px-3 py-1 hover:bg-(--color-text-pane)"
        >
          Вперёд →
        </Link>
      ) : (
        <span className="rounded border border-(--color-border) px-3 py-1 opacity-40">
          Вперёд →
        </span>
      )}
    </nav>
  );
}
```

- [ ] **Step 7: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/empty-state.tsx src/components/ui/pagination.tsx src/components/ui/skeleton.tsx
git add src/components/shared/skeleton  # фиксирует удаление папки в индексе
git commit -m "$(cat <<'EOF'
feat(ui): EmptyState, Pagination, move Skeleton to ui/

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 18: UI-kit barrel + smoke page

**Files:**
- Create: `src/components/ui/index.ts`
- Create: `src/app/_dev/ui/page.tsx`

**Why:** Barrel-файл — единая точка импорта для UI-kit'а из фич (`import { Button, Form, FormField } from "@/components/ui"`). Smoke-страница даёт визуальное подтверждение, что вся палитра рендерится без ошибок (удалится в самом конце foundation работы или останется под `/_dev/`).

- [ ] **Step 1: Создать barrel**

```ts
// src/components/ui/index.ts
export { cn } from "./cn";
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./button";
export { IconButton, type IconButtonProps } from "./icon-button";
export { TextInput, type TextInputProps } from "./text-input";
export { Textarea, type TextareaProps } from "./textarea";
export { Select, type SelectProps } from "./select";
export { Checkbox, type CheckboxProps } from "./checkbox";
export { Form } from "./form";
export { FormField, type FormFieldProps } from "./form-field";
export { SubmitButton } from "./submit-button";
export { Dialog, DialogClose } from "./dialog";
export { ConfirmDialog } from "./confirm-dialog";
export { Table, Thead, Tbody, Tr, Th, Td } from "./table";
export { ToastProvider, useToast } from "./toast";
export { Toaster } from "./toaster";
export { EmptyState } from "./empty-state";
export { Pagination } from "./pagination";
export { Skeleton, type SkeletonProps } from "./skeleton";
```

- [ ] **Step 2: Создать smoke-страницу**

```tsx
// src/app/_dev/ui/page.tsx
import { Field } from "@base-ui/react/field";
import {
  Button,
  IconButton,
  TextInput,
  Textarea,
  Form,
  FormField,
  SubmitButton,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  EmptyState,
  Skeleton,
  Pagination,
} from "@/components/ui";

export const metadata = { title: "UI Kit smoke" };

export default function UiKitSmokePage() {
  return (
    <div className="flex flex-col gap-8 p-8">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <IconButton aria-label="Close">×</IconButton>
        </div>
      </section>

      <section className="flex flex-col gap-2 max-w-md">
        <h2 className="text-lg font-bold">Form</h2>
        <Form>
          <FormField name="title" label="Заголовок" required>
            <Field.Control render={<TextInput />} />
          </FormField>
          <FormField name="description" label="Описание" description="Не более 500 символов">
            <Field.Control render={<Textarea />} />
          </FormField>
          <SubmitButton>Сохранить</SubmitButton>
        </Form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Table</h2>
        <Table>
          <Thead>
            <Tr>
              <Th>ID</Th>
              <Th>Имя</Th>
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              <Td>1</Td>
              <Td>Alpha</Td>
            </Tr>
          </Tbody>
        </Table>
      </section>

      <section className="flex flex-col gap-2 max-w-md">
        <h2 className="text-lg font-bold">EmptyState</h2>
        <EmptyState title="Пусто" description="Здесь пока ничего нет." />
      </section>

      <section className="flex flex-col gap-2 max-w-md">
        <h2 className="text-lg font-bold">Skeleton</h2>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Pagination</h2>
        <Pagination basePath="/_dev/ui" offset={20} limit={20} total={100} />
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Запустить dev-сервер и проверить страницу глазами**

Run: `npm run dev` (в отдельном терминале)
Открыть http://localhost:3001/_dev/ui — страница должна отрендериться без ошибок в консоли.
Stop dev-server.

- [ ] **Step 4: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS. Smoke-страница попадает в build, это нормально (можно удалить позднее).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/index.ts src/app/_dev/
git commit -m "$(cat <<'EOF'
feat(ui): barrel index + /_dev/ui smoke page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5: App Shell

### Task 19: Wire ToastProvider + Toaster into root layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Добавить ToastProvider вокруг body content и Toaster в конце body**

Открыть `src/app/layout.tsx`. Импортировать:

```tsx
import { ToastProvider, Toaster } from "@/components/ui";
```

Обернуть содержимое `<body>` в `<ToastProvider>...<Toaster /></ToastProvider>`. Финальный `<body>`:

```tsx
<body className={...}>
  <ToastProvider>
    <AppHeader me={me} />
    <StatusBanner me={me} />
    <InstallBanner />
    <main className={...}>{children}</main>
    <UpdatePrompt />
    <Suspense>
      <YandexMetrika />
    </Suspense>
    <Toaster />
  </ToastProvider>
</body>
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "$(cat <<'EOF'
feat(app): wire ToastProvider + Toaster in root layout

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 20: Admin layout with full sidebar (capability-gated)

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Create: `src/app/admin/forbidden.tsx`
- Create: `src/app/admin/error.tsx`
- Create: `src/app/admin/loading.tsx`
- Create: `src/app/admin/admin-sidebar.tsx` (client component)

**Why:** Закрепляем за админкой layout с полным заранее заведённым сайдбаром. Каждая позиция гейтится `can()` capability; пока фича не выкатилась — пункт скрыт. Когда фича появится, она заведёт свою страницу под `app/admin/<entity>/`, capability будет выдаваться бекендом, и пункт включится сам. Сайдбар после этого никто не трогает.

- [ ] **Step 1: Создать `src/app/admin/admin-sidebar.tsx` — client-навигация с подсветкой активного**

```tsx
"use client";
// src/app/admin/admin-sidebar.tsx
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export interface NavItem {
  href: string;
  label: string;
}

export function AdminSidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin navigation" className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded px-2 py-1.5 text-sm transition",
              active
                ? "bg-(--color-foreground) text-(--color-background)"
                : "hover:bg-(--color-background)"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Создать `src/app/admin/layout.tsx` с заранее заведённым полным сайдбаром**

```tsx
// src/app/admin/layout.tsx
import Link from "next/link";
import { forbidden } from "next/navigation";
import { getMe, type MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";
import { AdminSidebar, type NavItem } from "./admin-sidebar";

export const metadata = { title: "Админ-панель" };

/**
 * Полный набор пунктов админки. Каждый пункт гейтится capability'ями: пока
 * фича не появилась и бекенд не выдаёт capability, пункт не показывается.
 * Когда фича вкатывается — она заводит роут `app/admin/<entity>/`,
 * capability добавляется в RBAC, и пункт включается сам.
 *
 * Когда добавляется новая фича — расширяется этот файл (foundation update PR),
 * не каждой фичей в её собственном PR.
 */
function buildNavItems(me: MaybeMe): NavItem[] {
  const items: NavItem[] = [];
  if (
    can(me, "lecture.create") ||
    can(me, "lecture.update") ||
    can(me, "lecture.delete")
  ) {
    items.push({ href: "/admin/lectures", label: "Лекции" });
  }
  if (can(me, "comment.moderate")) {
    items.push({ href: "/admin/comments", label: "Комментарии" });
  }
  if (can(me, "annotation.moderate")) {
    items.push({ href: "/admin/annotations", label: "Аннотации" });
  }
  if (can(me, "user.list")) {
    items.push({ href: "/admin/users", label: "Пользователи" });
  }
  if (can(me, "push.send")) {
    items.push({ href: "/admin/push", label: "Push-уведомления" });
  }
  return items;
}

/**
 * Гейт layout-уровня: только active-пользователь с любой админ-capability'ю
 * проходит сюда. Доменные страницы дополнительно проверяют свою capability.
 */
function canAccessAdmin(me: MaybeMe): boolean {
  return can(me, "admin.access");
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!canAccessAdmin(me)) forbidden();

  const navItems = buildNavItems(me);

  return (
    <div className="flex min-h-[calc(100vh-var(--header-height))] w-full">
      <aside className="w-56 shrink-0 border-r border-(--color-border) bg-(--color-text-pane) p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Link
            href="/"
            className="text-xs text-(--color-description) hover:underline"
          >
            ← На сайт
          </Link>
          <h2 className="text-lg font-bold">Админ-панель</h2>
          {me && (
            <span className="text-xs text-(--color-description) break-all">
              {me.username}
            </span>
          )}
        </div>
        <AdminSidebar items={navItems} />
      </aside>
      <main className="flex-1 min-w-0 p-6">{children}</main>
    </div>
  );
}
```

> **Note:** Capability `admin.access` уже определена в `src/utils/permissions.ts`. Если бекенд её ещё не выдаёт нужным ролям — это бекенд-вопрос (фронт лишь проверяет).

- [ ] **Step 3: Создать `src/app/admin/page.tsx` — простой дашборд-плейсхолдер**

```tsx
// src/app/admin/page.tsx
export const metadata = { title: "Админ-панель" };

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Админ-панель</h1>
      <p className="text-sm text-(--color-description)">
        Управление разделами — через меню слева.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Создать `forbidden.tsx`, `error.tsx`, `loading.tsx`**

```tsx
// src/app/admin/forbidden.tsx
export default function AdminForbidden() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-2xl font-bold">403</h1>
      <p className="text-(--color-description)">Доступ к админ-панели запрещён.</p>
    </div>
  );
}
```

```tsx
// src/app/admin/error.tsx
"use client";
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
      <button
        type="button"
        onClick={reset}
        className="rounded border border-(--color-border) px-3 py-1 text-sm"
      >
        Попробовать снова
      </button>
    </div>
  );
}
```

```tsx
// src/app/admin/loading.tsx
import { Skeleton } from "@/components/ui";
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
```

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/
git commit -m "$(cat <<'EOF'
feat(admin): layout, sidebar, dashboard placeholder, forbidden/error/loading

Sidebar pre-declares all expected sections; each item is capability-gated so
features become visible automatically once they ship and capabilities are
granted. Sidebar lives here and is not modified by feature PRs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6: ESLint Guardrails, Scaffolding, Documentation

### Task 21: ESLint guardrails

**Files:**
- Modify: `eslint.config.mjs`

**Why:** Автоматически предотвращаем (а) cross-feature импорты, (б) deep-импорты в чужие фичи в обход `index.ts`, (в) импорт client-only пакетов в `api.ts`/`actions.ts`/`permissions.ts`.

- [ ] **Step 1: Расширить `eslint.config.mjs`**

```js
// eslint.config.mjs
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    rules: {
      "react-hooks/exhaustive-deps": "error",
    },
  },
  // Запрет deep-импортов в чужие фичи: fold через index.ts
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/features/*/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/!(index)", "@/features/*/*/**"],
              message: "Импортируй фичу через её index.ts (@/features/<entity>).",
            },
          ],
        },
      ],
    },
  },
  // Cross-feature импорты запрещены
  {
    files: ["src/features/*/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*"],
              message:
                "Cross-feature импорты запрещены. Данные ходят через бекенд, общий код — через @/components, @/utils, @/hooks.",
            },
          ],
        },
      ],
    },
  },
  // Server-only файлы фичи: запрет импорта react-dom/client (ранний детектор client-only зависимостей)
  {
    files: [
      "src/features/*/api.ts",
      "src/features/*/actions.ts",
      "src/features/*/permissions.ts",
      "src/features/*/schemas.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-dom/client",
              message: "Этот файл server-only. Используй import \"server-only\" в начале файла.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
```

- [ ] **Step 2: Проверить, что lint остаётся зелёным**

Run: `npm run lint`
Expected: PASS (никаких нарушений в текущем коде, потому что `src/features/` пока пустой).

- [ ] **Step 3: Sanity-check: создать временный файл-нарушитель и убедиться, что ESLint его ловит**

Создать `src/features/_lint-check/foo.ts`:

```ts
// src/features/_lint-check/foo.ts
import { Bar } from "@/features/other/bar";
export const baz = Bar;
```

Run: `npm run lint`
Expected: FAIL с сообщением «Cross-feature импорты запрещены».

Удалить файл:

```bash
rm -rf src/features/_lint-check
```

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add eslint.config.mjs
git commit -m "$(cat <<'EOF'
chore(eslint): add boundary guardrails for feature slices

Forbid cross-feature imports, deep-imports past a slice's index.ts, and
react-dom/client in server-only slice files.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 22: features/_template/ scaffolding

**Files:**
- Create: `src/features/_template/index.ts`
- Create: `src/features/_template/api.ts`
- Create: `src/features/_template/actions.ts`
- Create: `src/features/_template/permissions.ts`
- Create: `src/features/_template/schemas.ts`
- Create: `src/features/_template/types.ts`
- Create: `src/features/_template/permissions.test.ts`
- Create: `src/features/_template/schemas.test.ts`
- Create: `src/features/_template/ui/.gitkeep`
- Create: `src/features/_template/README.md`

**Why:** Готовый шаблон, который агент копирует в `src/features/<entity>/` и заменяет `_template` → `<entity>`. Уменьшает порог входа в TDD-цикл и обеспечивает, что у каждой фичи будут одинаковые файлы.

- [ ] **Step 1: Создать `index.ts`**

```ts
// src/features/_template/index.ts
// Public API слайса.
// Сюда экспортируется ТОЛЬКО то, что нужно снаружи (страницам в app/, root layout).
// types.ts, schemas.ts, model/* по умолчанию приватные — экспортируй явно при необходимости.

export {} from "./api";
export {} from "./actions";
export {} from "./permissions";
// export { SomeUiComponent } from "./ui/some-ui-component";
```

- [ ] **Step 2: Создать `api.ts`**

```ts
// src/features/_template/api.ts
import "server-only";
import { cache } from "react";
// import { unstable_cache } from "next/cache";
// import { createApiClient } from "@/api/client";

/**
 * Серверные fetchers сущности. Дедуплицируются через React.cache внутри одного
 * запроса. Для cross-request кеширования — обернуть в unstable_cache с тегом
 * `entity` (для list) или `entity:<id>` (для item).
 */

// export const getEntities = cache(async () => {
//   const api = await createApiClient();
//   const { data, error } = await api.GET("/...");
//   if (error) throw new Error(error.message);
//   return data;
// });

export const _placeholder = cache(async () => null);
```

- [ ] **Step 3: Создать `actions.ts`**

```ts
// src/features/_template/actions.ts
"use server";
import "server-only";
// import { createFormAction, parseFormData } from "@/utils/create-action";
// import { requireCapability } from "@/utils/permissions";
// import { revalidateEntity } from "@/utils/revalidate";
// import { getMe } from "@/utils/me";
// import { createApiClient } from "@/api/client";
// import { canCreateEntity } from "./permissions";
// import { EntityCreateSchema } from "./schemas";

/**
 * Server actions сущности. Каждая действие:
 * 1. await getMe()
 * 2. requireCapability(me, canX) — для capability-чека
 * 3. parseFormData(Schema, formData) — для Zod-валидации (если форма)
 * 4. createApiClient() + вызов бекенда
 * 5. revalidateEntity("entity", id?) после успешной мутации
 */

// export const createEntity = createFormAction(async (formData) => {
//   const me = await getMe();
//   const input = parseFormData(EntityCreateSchema, formData);
//   requireCapability(me, canCreateEntity);
//   const api = await createApiClient();
//   const { data, error } = await api.POST("/entities", { body: input });
//   if (error) throw new Error(error.message);
//   revalidateEntity("entities");
//   return data;
// });

export const _placeholder = async () => null;
```

- [ ] **Step 4: Создать `permissions.ts`**

```ts
// src/features/_template/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";

/**
 * Доменные permission-хелперы. Каждая функция возвращает boolean.
 * Status-чек уже включён в can() — не дублируйте.
 *
 * Owner-aware-проверки делаются здесь, например:
 *   export function canDeleteX(me: MaybeMe, x: { user_id: string }): boolean {
 *     if (!me) return false;
 *     if (x.user_id === me.id) return can(me, "x.delete_own");
 *     return can(me, "x.delete_any");
 *   }
 */

export function canPlaceholder(_me: MaybeMe): boolean {
  return false;
}
```

- [ ] **Step 5: Создать `schemas.ts`**

```ts
// src/features/_template/schemas.ts
import "server-only";
import { z } from "zod";

/**
 * Zod-схемы для валидации FormData в server actions. Используются через
 * `parseFormData(Schema, formData)`.
 *
 * Хранятся отдельно от actions.ts, чтобы при необходимости их можно было
 * импортировать в client-форму для preview-валидации (через "use client"
 * границу).
 */

// export const EntityCreateSchema = z.object({
//   title: z.string().min(1).max(200),
//   description: z.string().max(1000).optional(),
// });
// export type EntityCreateInput = z.infer<typeof EntityCreateSchema>;

export const PlaceholderSchema = z.object({});
```

- [ ] **Step 6: Создать `types.ts`**

```ts
// src/features/_template/types.ts
// Сужения и derived-типы из @/api/schema.
// Пример:
//   import type { components } from "@/api/schema";
//   export type Entity = components["schemas"]["entity.Entity"];
//   export type EntityListItem = Pick<Entity, "id" | "title" | "created_at">;

export type _Placeholder = unknown;
```

- [ ] **Step 7: Создать `permissions.test.ts`**

```ts
// src/features/_template/permissions.test.ts
import { describe, it, expect } from "vitest";
import { canPlaceholder } from "./permissions";

describe("canPlaceholder", () => {
  it("returns false for guest (placeholder)", () => {
    expect(canPlaceholder(null)).toBe(false);
  });

  // Замените на реальные тесты после реализации:
  // it("owner может удалить свой ресурс");
  // it("owner не может удалить чужой без delete_any");
  // it("status='inactive' блокирует");
  // it("гость всегда false");
});
```

- [ ] **Step 8: Создать `schemas.test.ts`**

```ts
// src/features/_template/schemas.test.ts
import { describe, it, expect } from "vitest";
import { PlaceholderSchema } from "./schemas";

describe("PlaceholderSchema", () => {
  it("accepts an empty object (placeholder)", () => {
    expect(PlaceholderSchema.safeParse({}).success).toBe(true);
  });

  // Замените на реальные тесты после реализации:
  // it("rejects empty title");
  // it("trims and accepts valid title");
  // it("rejects description longer than max");
});
```

- [ ] **Step 9: Создать `ui/.gitkeep` и `README.md`**

```bash
mkdir -p src/features/_template/ui
touch src/features/_template/ui/.gitkeep
```

```markdown
<!-- src/features/_template/README.md -->
# Шаблон слайса фичи

Скопируй эту папку в `src/features/<entity>/`, переименуй упоминания
`_template` и наполни смыслом.

## Чеклист (до open PR)

- [ ] `index.ts` экспортирует только то, что нужно снаружи
- [ ] `api.ts`, `actions.ts`, `permissions.ts`, `schemas.ts` начинаются с `import "server-only";`
- [ ] Каждая `canXxx` в `permissions.ts` покрыта тестом
- [ ] Каждая Zod-схема имеет минимум 1 success + 1 failure тест
- [ ] Использует `createFormAction` + `parseFormData` + `requireCapability`
+ `revalidateEntity`
- [ ] Не импортит другие `@/features/*` (запрещено ESLint'ом)
- [ ] Удалён `ui/.gitkeep`, добавлены реальные UI-файлы
- [ ] `npm run lint && npm run test && npm run build` зелёные локально

См. конвенции: `docs/frontend-conventions.md`.
См. дизайн: `docs/superpowers/specs/2026-04-26-frontend-foundation-design.md`.
```

- [ ] **Step 10: Lint + test + build**

Run: `npm run lint && npm test && npm run build`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/features/_template/
git commit -m "$(cat <<'EOF'
feat(features): add _template slice scaffold

Copy this folder to features/<entity>/ to start a new feature with the
expected layout: api/actions/permissions/schemas/types + tests + ui/.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 23: Frontend conventions documentation

**Files:**
- Create: `docs/frontend-conventions.md`

**Why:** Один документ, который агент читает в начале своего worktree. Сводит правила, шаблоны, чеклисты в одно место.

- [ ] **Step 1: Создать `docs/frontend-conventions.md`**

````markdown
# Frontend conventions

Краткий референс для агента, реализующего фичу. Полный дизайн:
[`docs/superpowers/specs/2026-04-26-frontend-foundation-design.md`](superpowers/specs/2026-04-26-frontend-foundation-design.md).

## Архитектура

Облегчённый Feature-Sliced Design ("B+"):

```text
src/
  app/                    # Next.js App Router
  api/                    # openapi-fetch + schema.ts + tags.ts
  components/
    ui/                   # UI-kit (использовать через barrel @/components/ui)
    shared/, app/, permission/, markdown-editor/, yandex-metrika/
  features/               # 1 entity = 1 папка = 1 агент
  hooks/, utils/, services/
```

**Правила импортов (форсятся ESLint'ом):**

- `app/` → импортит `features/`, `components/`, `utils/`, `hooks/`.
- `features/<X>` → импортит `components/`, `utils/`, `hooks/`, `services/`, `api/`.
- `features/<X>` НЕ импортит `features/<Y>`.
- Внешние потребители фичи импортят ТОЛЬКО через `features/<X>` (то есть через `index.ts`).
  Глубокие импорты типа `features/comments/ui/comment-form` запрещены.

## Шаблон слайса

Скопируй `src/features/_template/` в `src/features/<entity>/`. Содержимое:

```text
src/features/<entity>/
  index.ts          # Public API
  api.ts            # "server-only" — fetchers
  actions.ts        # "server-only" — server actions
  permissions.ts    # canX(me, ...) хелперы
  schemas.ts        # Zod-схемы для FormData
  types.ts          # сужения из @/api/schema
  ui/               # server и client components
```

## Паттерны

### Чтение данных (только в server components)

```ts
import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createApiClient } from "@/api/client";

export const getEntities = cache(
  unstable_cache(
    async () => {
      const api = await createApiClient();
      const { data, error } = await api.GET("/entities");
      if (error) throw new Error(error.message);
      return data;
    },
    ["entities-list"],
    { tags: ["entities"] }
  )
);
```

### Мутации (server actions)

```ts
"use server";
import "server-only";
import { createFormAction, parseFormData } from "@/utils/create-action";
import { requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";
import { getMe } from "@/utils/me";
import { createApiClient } from "@/api/client";
import { canCreateEntity } from "./permissions";
import { EntityCreateSchema } from "./schemas";

export const createEntity = createFormAction(async (formData) => {
  const me = await getMe();
  const input = parseFormData(EntityCreateSchema, formData);
  requireCapability(me, canCreateEntity);
  const api = await createApiClient();
  const { data, error } = await api.POST("/entities", { body: input });
  if (error) throw new Error(error.message);
  revalidateEntity("entities");
  return data;
});
```

### Формы (client islands)

```tsx
"use client";
import { Field } from "@base-ui/react/field";
import { useActionState } from "react";
import { Form, FormField, SubmitButton, TextInput } from "@/components/ui";
import { createEntity } from "../actions";

export function EntityCreateForm() {
  const [state, action] = useActionState(createEntity, {
    success: true,
    data: undefined,
  });
  const fieldErrors = !state.success ? state.fieldErrors ?? {} : {};

  return (
    <Form action={action} errors={fieldErrors}>
      <FormField name="title" label="Заголовок" required>
        <Field.Control render={<TextInput />} />
      </FormField>
      {!state.success && state.code === "forbidden" && (
        <p role="alert">У вас нет прав на создание сущности.</p>
      )}
      <SubmitButton>Создать</SubmitButton>
    </Form>
  );
}
```

### Поиск/фильтры/пагинация

Только через URL `searchParams`. Server component читает их и фетчит. Клиент
обновляет URL через `<Link>` или `router.push()`. См. `<Pagination>` из
`@/components/ui` как готовый кейс.

## RBAC

- Источник истины — бекенд. `getMe()` возвращает `{ role, status, capabilities }`.
- В UI: вызывайте `canX(me)` (домен) или `can(me, "<resource>.<action>")` (плоско).
- В server action: `requireCapability(me, canX)` бросает `ForbiddenError`,
  `createAction` ловит и возвращает `{ success: false, code: "forbidden" }`.
- Status-гейт уже встроен в `can()` — не дублируйте.

## Тесты

**Обязательно** (для каждой фичи):

- `permissions.ts` — каждая `canXxx` покрыта тестом на матрице ролей/статусов/ownership.
- `schemas.ts` — каждая Zod-схема имеет ≥1 success и ≥1 failure тест.

**Не покрываем** (на старте):

- UI-компоненты (server и client).
- API-фетчеры — это тонкая обёртка.
- Server actions целиком — гарантируется типизацией + permissions/schemas тестами.

Размещение: `*.test.ts` рядом с тестируемым файлом.

Команда: `npm test`. Перед PR: `npm run lint && npm run test && npm run build`.

## Что нельзя трогать

При параллельной работе агент пишет ТОЛЬКО в:

- свой `src/features/<entity>/`,
- свои роуты в `src/app/<entity>/` и `src/app/admin/<entity>/`.

Запрещено трогать (всё это — отдельные foundation-update PR):

- `src/api/schema.ts` — координированная регенерация.
- `src/app/admin/layout.tsx` (sidebar) — пункты заранее заведены, гейтятся capability'ями.
- `src/app/layout.tsx`, `src/app/globals.css`, providers — заморожены.
- `src/components/ui/*` — существующие; новые примитивы — лучше тоже через update PR.
- `src/components/{shared, app, permission, ...}` — заморожены.
- `src/utils/*`, `src/hooks/*`, `src/services/*` — координированные изменения.
- `package.json`/`package-lock.json` — координированные.
- `eslint.config.mjs` — координированные.

Также (из `CLAUDE.md`) — запрет деструктивных git-операций (`stash`, `reset`, `checkout .`, `clean`), запрет `git add -A`/`git add .`.

## Чеклист агента (для PR)

См. `src/features/_template/README.md`.
````

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/frontend-conventions.md
git commit -m "$(cat <<'EOF'
docs: frontend conventions reference for feature work

Single document agents read at the start of a new worktree: architecture,
slice template, SSR-first patterns, RBAC, tests, the no-touch list.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Финальная проверка

- [ ] **Run полный чек:** `npm run lint && npm run test && npm run build`
Expected: PASS, все три зелёные.

- [ ] **Sanity:** `grep -rn "@/features/_template" src/ || echo "OK: no leftover _template references"`
Expected: `OK` (никто не должен импортить шаблон, кроме самого шаблона).

- [ ] **Sanity:** `grep -rn "TODO" docs/superpowers/plans/2026-04-26-frontend-foundation.md || echo "OK"`
Expected: какие-то TODO допустимы только внутри шаблонов кода с явным комментарием.

- [ ] **Открыть PR в `main`** с заголовком `chore(foundation): frontend foundation for parallel feature work`. После мержа — открывать воркт ри на фичи.

---

## Out of scope этого плана

- Реальные фичи (lectures, comments, annotations, etc.) — каждая делается в своём воркт ри по этому плану-фундаменту.
- Полноценный Combobox / DatePicker / FileUpload — добавятся в `components/ui/` по правилу "extract on second use".
- Playwright e2e и docker-compose с бекендом — отдельная инициатива.
- Storybook — не нужен, smoke-страничка покрывает потребность.
- Удаление smoke-страницы `/_dev/ui` — оставляем под dev-флагом до появления Storybook'а или решения о её сносе.
