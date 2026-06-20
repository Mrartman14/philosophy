# SEO Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрыть SEO-базис фронта: `robots.txt`, `metadataBase`, дефолтный Open Graph/Twitter, per-page OG + canonical — без sitemap (его отдаёт бэкенд) и без hreflang.

**Architecture:** Новый чистый неймспейс `src/seo/` (site-url + page-metadata, по образцу `src/security/`) держит всю логику и юнит-тестируется изолированно. `app/robots.ts` и `generateMetadata` страниц — тонкая обвязка поверх хелперов. Sitemap НЕ строим (nginx exact-match `/sitemap.xml` → бэкенд; Next-sitemap был бы затенён).

**Tech Stack:** Next.js 16 App Router (Metadata API), TypeScript, vitest (jsdom), next-intl (`getT`).

**Design doc:** [docs/superpowers/specs/2026-06-20-seo-foundation-design.md](../specs/2026-06-20-seo-foundation-design.md)
**Edge-контракт (почему так):** [docs/ops/edge.md](../../ops/edge.md)

## Global Constraints

- **Пакетный менеджер — `pnpm`** (не npm). Тесты `pnpm test`, линт `pnpm lint`.
- **Именование файлов в `src/` — kebab-case.** Тесты — vitest (jsdom), `*.test.ts` колоцированы.
- **`src/seo/` — новый неймспейс** (не frozen). Frozen-зона под этот PR: `src/app/layout.tsx` (foundation-touch: metadataBase + дефолтный OG). Детальные `page.tsx` — feature-страницы, не заморожены.
- **Git:** только свои файлы по имени (НЕ `git add -A`); без деструктивных git-операций; без push.
- **НЕ трогать i18n-файлы** (i18n в активной чужой работе). Новые i18n-ключи НЕ вводим — используем существующие (`metadata`: appTitle/appDescription; `pages`: *DefaultTitle) и поля сущностей.
- **Sitemap НЕ создаём** (бэкенд). **hreflang НЕТ** (один canonical-URL).
- **Базовый URL — `NEXT_PUBLIC_BASE_URL`** (в проде = реальный **корень origin**, БЕЗ `/philosophy`; пустой → дефолт `http://localhost:3001`). В `.env.example` переменная есть — Task 1 лишь добавляет к её комментарию пометку про SEO. **Прод-пререквизит:** `NEXT_PUBLIC_BASE_PATH` должен быть **пустым** (он не подключён в `next.config.ts` → SSR-апп и так в корне; значение `/philosophy` в `.env.production` — мёртвая легаси и не должно попасть в build-args). До реального origin canonical/OG будут указывать на плейсхолдер `example.com`.
- Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.

## File Structure

- **Create** `src/seo/site-url.ts` — `siteUrl(path?)` + `metadataBaseUrl()`. Единственный источник базового абсолютного URL.
- **Create** `src/seo/site-url.test.ts`
- **Create** `src/seo/page-metadata.ts` — `buildPageMetadata(input)` → `Metadata` (openGraph + twitter + canonical). Вся per-page-логика.
- **Create** `src/seo/page-metadata.test.ts`
- **Create** `src/app/robots.ts` — `MetadataRoute.Robots` (allow public / disallow private, sitemap → бэкенд).
- **Create** `src/app/robots.test.ts`
- **Modify** `src/app/layout.tsx` — `metadataBase` + дефолтный `openGraph`/`twitter` в `generateMetadata` (frozen).
- **Modify** `src/app/lectures/[id]/page.tsx`, `src/app/trails/[id]/page.tsx`, `src/app/glossary/[id]/page.tsx` — `generateMetadata` через `buildPageMetadata`.

**Тест-стратегия (осознанная):** в проекте нет тестов на `generateMetadata`, а импорт `page.tsx`/`layout.tsx` в jsdom тянет server-only-зависимости (хрупко). Поэтому ВСЯ логика вынесена в `src/seo/*` (чисто, тестируется изолированно), а `generateMetadata` страниц/layout — тривиальная обвязка (fetch → хелпер), проверяется сборкой (`pnpm build`) и линтом (type-aware), без отдельных metadata-тестов.

---

### Task 1: Базовый URL (`src/seo/site-url.ts`)

**Files:**
- Create: `src/seo/site-url.ts`
- Test: `src/seo/site-url.test.ts`

**Interfaces:**
- Produces: `siteUrl(path?: string): string`; `metadataBaseUrl(): URL`.

- [ ] **Step 1: Write the failing test**

Create `src/seo/site-url.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { metadataBaseUrl, siteUrl } from "./site-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("siteUrl", () => {
  it("абсолютный URL от NEXT_PUBLIC_BASE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com");
    expect(siteUrl("/lectures/42")).toBe("https://example.com/lectures/42");
  });
  it("срезает хвостовой слеш базы", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com/");
    expect(siteUrl("/x")).toBe("https://example.com/x");
  });
  it("корень — без хвостового слеша", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com");
    expect(siteUrl("/")).toBe("https://example.com");
    expect(siteUrl()).toBe("https://example.com");
  });
  it("добавляет ведущий слеш к path", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com");
    expect(siteUrl("sitemap.xml")).toBe("https://example.com/sitemap.xml");
  });
  it("дефолт при пустом/неустановленном env", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
    expect(siteUrl("/a")).toBe("http://localhost:3001/a");
  });
});

describe("metadataBaseUrl", () => {
  it("URL с origin базы", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com");
    expect(metadataBaseUrl().origin).toBe("https://example.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/seo/site-url.test.ts`
Expected: FAIL — `Failed to resolve import "./site-url"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/seo/site-url.ts`:

```ts
// src/seo/site-url.ts
// Единый источник базового абсолютного URL для SEO (robots/canonical/OG).
// База — NEXT_PUBLIC_BASE_URL (в проде корень origin; github.io/basePath — мёртвая
// легаси). Значение вшивается build-time; перед раскаткой SEO должно быть реальным origin.
// Пустое/неустановленное → дефолт для dev (порт dev-сервера проекта — 3001).
const DEFAULT_BASE = "http://localhost:3001";

function rawBase(): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  return configured && configured.length > 0 ? configured : DEFAULT_BASE;
}

export function siteUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/" ? rawBase() : `${rawBase()}${normalized}`;
}

export function metadataBaseUrl(): URL {
  return new URL(rawBase());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/seo/site-url.test.ts`
Expected: PASS.

- [ ] **Step 5: Уточнить комментарий к `NEXT_PUBLIC_BASE_URL` в `.env.example`**

Найти в `.env.example` блок и заменить ТОЛЬКО комментарий (значения не трогать):

```bash
# Базовый URL и путь приложения (вшиваются в клиентский бандл через Next.js)
NEXT_PUBLIC_BASE_URL=https://example.com
NEXT_PUBLIC_BASE_PATH=/philosophy
```

на:

```bash
# Базовый URL приложения (вшивается build-time в клиентский бандл).
# ТАКЖЕ источник SEO-URL: canonical / Open Graph / robots Sitemap.
# В проде = реальный корень origin БЕЗ суффикса пути. NEXT_PUBLIC_BASE_PATH НЕ
# подключён в next.config (SSR в корне) → держать пустым; "/philosophy" — мёртвая легаси.
NEXT_PUBLIC_BASE_URL=https://example.com
NEXT_PUBLIC_BASE_PATH=/philosophy
```

- [ ] **Step 6: Commit**

```bash
git add src/seo/site-url.ts src/seo/site-url.test.ts .env.example
git commit -m "feat(seo): absolute site-url helper for canonical/OG/robots"
```

---

### Task 2: Per-page metadata-хелпер (`src/seo/page-metadata.ts`)

**Files:**
- Create: `src/seo/page-metadata.ts`
- Test: `src/seo/page-metadata.test.ts`

**Interfaces:**
- Consumes: `siteUrl(path)` из Task 1.
- Produces: `interface PageMetadataInput { title: string; siteName: string; description?: string | undefined; image?: string | null; imageAlt?: string | undefined; path: string }`; `buildPageMetadata(input: PageMetadataInput): Metadata`. (`description`/`imageAlt` с явным `| undefined` — под exactOptionalPropertyTypes.)

- [ ] **Step 1: Write the failing test**

Create `src/seo/page-metadata.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPageMetadata } from "./page-metadata";

afterEach(() => {
  vi.unstubAllEnvs();
});

function withBase() {
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com");
}

const base = { title: "T", siteName: "Сайт", path: "/x" };

describe("buildPageMetadata", () => {
  it("canonical/og:url = self-URL, type=article, siteName задан", () => {
    withBase();
    expect(buildPageMetadata({ ...base, path: "/lectures/42" })).toMatchObject({
      alternates: { canonical: "https://example.com/lectures/42" },
      openGraph: {
        url: "https://example.com/lectures/42",
        type: "article",
        siteName: "Сайт",
      },
    });
  });
  it("реальная картинка → summary_large_image + og:image с alt", () => {
    withBase();
    expect(
      buildPageMetadata({ ...base, image: "/static/files/abc", imageAlt: "Обложка" }),
    ).toMatchObject({
      openGraph: { images: [{ url: "/static/files/abc", alt: "Обложка" }] },
      twitter: { card: "summary_large_image", images: ["/static/files/abc"] },
    });
  });
  it("без alt — og:image строкой (без объекта)", () => {
    withBase();
    expect(buildPageMetadata({ ...base, image: "/static/files/x" })).toMatchObject({
      openGraph: { images: ["/static/files/x"] },
    });
  });
  it("без картинки (null/пусто) → дефолт /logo.png + twitter summary", () => {
    withBase();
    expect(buildPageMetadata({ ...base, image: null })).toMatchObject({
      openGraph: { images: ["/logo.png"] },
      twitter: { card: "summary" },
    });
    expect(buildPageMetadata({ ...base, image: "" })).toMatchObject({
      openGraph: { images: ["/logo.png"] },
    });
  });
  it("description прокидывается в meta/og", () => {
    withBase();
    expect(buildPageMetadata({ ...base, description: "D" })).toMatchObject({
      description: "D",
      openGraph: { description: "D" },
    });
  });
  it("без description — поле отсутствует", () => {
    withBase();
    expect(buildPageMetadata({ ...base }).description).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/seo/page-metadata.test.ts`
Expected: FAIL — import не резолвится.

- [ ] **Step 3: Write minimal implementation**

Create `src/seo/page-metadata.ts`:

```ts
// src/seo/page-metadata.ts
// Сборка per-page метаданных: Open Graph + Twitter + canonical. Вся логика SEO-страниц
// здесь (тестируемо), а generateMetadata страниц — тонкая обвязка поверх этого.
import type { Metadata } from "next";

import { siteUrl } from "./site-url";

const DEFAULT_OG_IMAGE = "/logo.png";

export interface PageMetadataInput {
  title: string;
  /** og:site_name. Next ЗАМЕНЯЕТ (не мержит) openGraph дочерней страницы — поэтому
   *  siteName надо задавать на каждой странице, иначе он пропадёт. */
  siteName: string;
  // `| undefined` обязателен: под exactOptionalPropertyTypes значение `string|undefined`
  // (напр. lecture?.description) НЕ присваивается в `?: string`.
  description?: string | undefined;
  /** Абсолютный или root-relative URL картинки; Next абсолютизирует относительный
   *  через metadataBase. Пусто/нет → дефолт /logo.png. */
  image?: string | null;
  /** alt для og:image (у лекций — cover_image_alt). */
  imageAlt?: string | undefined;
  /** Путь страницы для canonical/og:url, напр. "/lectures/42". */
  path: string;
}

export function buildPageMetadata({
  title,
  siteName,
  description,
  image,
  imageAlt,
  path,
}: PageMetadataInput): Metadata {
  const url = siteUrl(path);
  const hasImage = Boolean(image && image.length > 0);
  const ogImage = hasImage && image ? image : DEFAULT_OG_IMAGE;
  const imageEntry = imageAlt ? { url: ogImage, alt: imageAlt } : ogImage;
  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical: url },
    openGraph: {
      title,
      siteName,
      type: "article",
      url,
      images: [imageEntry],
      ...(description ? { description } : {}),
    },
    twitter: {
      // summary_large_image только при настоящей обложке; для дефолт-логотипа —
      // summary (логотип не 1200×630, large-card его уродует).
      card: hasImage ? "summary_large_image" : "summary",
      title,
      images: [ogImage],
      ...(description ? { description } : {}),
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/seo/page-metadata.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/seo/page-metadata.ts src/seo/page-metadata.test.ts
git commit -m "feat(seo): per-page OG/Twitter/canonical metadata builder"
```

---

### Task 3: robots.txt (`src/app/robots.ts`)

**Files:**
- Create: `src/app/robots.ts`
- Test: `src/app/robots.test.ts`

**Interfaces:**
- Consumes: `siteUrl("/sitemap.xml")` из Task 1.
- Produces: `export default function robots(): MetadataRoute.Robots`.

- [ ] **Step 1: Write the failing test**

Create `src/app/robots.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import robots from "./robots";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("robots", () => {
  it("allow / и disallow приватного", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com");
    const r = robots();
    expect(r.rules).toMatchObject({ userAgent: "*", allow: "/" });
    const disallow = (r.rules as { disallow?: string[] }).disallow ?? [];
    expect(disallow).toEqual(
      expect.arrayContaining(["/admin", "/me", "/api", "/login"]),
    );
  });
  it("sitemap → бэкендный абсолютный /sitemap.xml", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com");
    expect(robots().sitemap).toBe("https://example.com/sitemap.xml");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/app/robots.test.ts`
Expected: FAIL — `./robots` не существует.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/robots.ts`:

```ts
// src/app/robots.ts
// robots.txt отдаёт Next (nginx этот путь не перехватывает — см. docs/ops/edge.md).
// sitemap.xml — НЕ наш: его отдаёт бэкенд (nginx exact-match → Go), здесь только ссылка.
import type { MetadataRoute } from "next";

import { siteUrl } from "@/seo/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/me",
        "/api",
        "/dev",
        "/canvases",
        "/documents",
        "/forms",
        "/comments",
        "/annotations",
        "/saved",
        "/share-links",
        "/submissions",
        "/media",
        "/calendar",
        "/auth",
        "/login",
        "/register",
        "/search",
        "/push",
        "/offline",
        "/_offline",
        "/trails/my",
      ],
    },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/app/robots.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/robots.ts src/app/robots.test.ts
git commit -m "feat(seo): robots.txt (allow public, disallow private, backend sitemap)"
```

---

### Task 4: metadataBase + дефолтный OG в layout (`src/app/layout.tsx`)

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `metadataBaseUrl()` из Task 1.

**Контекст:** текущий `generateMetadata` (строки 41–53) возвращает title/description/manifest/appleWebApp. Добавляем `metadataBase` + дефолтные `openGraph`/`twitter`. Ничего из существующего не удаляем.

- [ ] **Step 1: Добавить импорт**

В `src/app/layout.tsx` есть ДВЕ строки импорта из i18n: `@/i18n` и `@/i18n/client`.
По `import/order` (alphabetize asc) `@/seo/...` идёт ПОСЛЕ обеих (`@/i18n/client` < `@/seo`).
Вставить строку **после `import ... from "@/i18n/client";`** (и перед `@/services/...`):

```ts
import { metadataBaseUrl } from "@/seo/site-url";
```

- [ ] **Step 2: Расширить generateMetadata**

Заменить текущую функцию `generateMetadata` целиком на:

```ts
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("metadata");
  const siteName = t("appTitle");
  return {
    metadataBase: metadataBaseUrl(),
    // title.template добавляет бренд к титулам страниц: "<page> — <siteName>".
    // default — для корня (home). Per-page возвращают просто строку.
    title: { default: siteName, template: `%s — ${siteName}` },
    description: t("appDescription"),
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      title: t("appShortName"),
      capable: true,
      statusBarStyle: "black-translucent",
    },
    openGraph: {
      type: "website",
      siteName,
      title: siteName,
      description: t("appDescription"),
      images: ["/logo.png"],
    },
    twitter: {
      // дефолтная картинка — логотип (не 1200×630) → summary, не large.
      card: "summary",
      title: siteName,
      description: t("appDescription"),
      images: ["/logo.png"],
    },
  };
}
```

(`Metadata` уже импортирован в layout. `/logo.png` есть в `public/`. Относительная картинка абсолизируется через `metadataBase`. Note: `title.template` применяется к строковым per-page титулам автоматически; на `og:title` шаблон НЕ распространяется — поэтому `buildPageMetadata` ставит чистый og:title.)

- [ ] **Step 3: Verify lint + build**

Run: `pnpm lint`
Expected: чисто (type-aware правила подтверждают корректность типов Metadata).

Run: `pnpm build`
Expected: сборка проходит (конфиг/метаданные валидны).
(Отдельного юнит-теста нет: импорт layout.tsx в jsdom тянет server-only-провайдеры — хрупко; значения статические + getT, корректность подтверждается типами и сборкой.)

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(seo): metadataBase + default Open Graph/Twitter in root layout"
```

---

### Task 5: per-page OG + canonical на детальных страницах

**Files:**
- Modify: `src/app/lectures/[id]/page.tsx`
- Modify: `src/app/trails/[id]/page.tsx`
- Modify: `src/app/glossary/[id]/page.tsx`

**Interfaces:**
- Consumes: `buildPageMetadata(input)` из Task 2; `lectureCoverUrl(key)` (существует в `@/features/lectures/cover-url`).

**Контекст:** у всех трёх `generateMetadata({ params })` уже фетчит сущность и возвращает `{ title }`. Переиспользуем тот же fetch, прокидываем поля в `buildPageMetadata`. Поля: lecture — `title`,`description`,`cover_image_key`; trail — `title`,`description?`; term — только `title` (у `glossary.Term` НЕТ description). Никаких новых i18n-ключей и запросов.

- [ ] **Step 1: lectures/[id]/page.tsx**

Добавить импорты (НЕ были импортированы — проверено). Позиции по `import/order`
(alphabetize asc внутри группы `@/`): `@/features/lectures/cover-url` — в блоке
`@/features/lectures/*`; `@/seo/page-metadata` — после `@/i18n*`, перед `@/services/*`/`@/utils/*`.
После правки прогнать `pnpm lint`, чтобы подтвердить порядок.

```ts
import { lectureCoverUrl } from "@/features/lectures/cover-url";
import { buildPageMetadata } from "@/seo/page-metadata";
```

Заменить `generateMetadata` на (добавляем `getT("metadata")` для siteName и
`cover_image_alt` для og:image.alt):

```ts
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const [lecture, t, tMeta] = await Promise.all([
    getLectureById(id),
    getT("pages"),
    getT("metadata"),
  ]);
  return buildPageMetadata({
    title: lecture?.title ?? t("lectureDefaultTitle"),
    siteName: tMeta("appTitle"),
    description: lecture?.description,
    image: lectureCoverUrl(lecture?.cover_image_key),
    imageAlt: lecture?.cover_image_alt,
    path: `/lectures/${id}`,
  });
}
```

- [ ] **Step 2: trails/[id]/page.tsx**

Добавить импорт `@/seo/page-metadata` (после `@/i18n*`, перед `@/services/*`/`@/utils/*`):

```ts
import { buildPageMetadata } from "@/seo/page-metadata";
```

Заменить `generateMetadata` на:

```ts
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const [trail, t, tMeta] = await Promise.all([
    getTrailById(id),
    getT("pages"),
    getT("metadata"),
  ]);
  return buildPageMetadata({
    title: trail?.title ?? t("trailDefaultTitle"),
    siteName: tMeta("appTitle"),
    description: trail?.description,
    path: `/trails/${id}`,
  });
}
```

- [ ] **Step 3: glossary/[id]/page.tsx**

Добавить импорт `@/seo/page-metadata` (после `@/i18n*`, перед `@/services/*`/`@/utils/*`):

```ts
import { buildPageMetadata } from "@/seo/page-metadata";
```

Заменить `generateMetadata` на (у `glossary.Term` НЕТ description — не передаём):

```ts
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const [term, t, tMeta] = await Promise.all([
    getTermById(id),
    getT("pages"),
    getT("metadata"),
  ]);
  return buildPageMetadata({
    title: term?.title ?? t("termDefaultTitle"),
    siteName: tMeta("appTitle"),
    path: `/glossary/${id}`,
  });
}
```

- [ ] **Step 4: Verify lint + build**

Run: `pnpm lint`
Expected: чисто (типы `buildPageMetadata`/полей сущностей корректны; импорты в правильном порядке).

Run: `pnpm build`
Expected: сборка проходит.
(Отдельных metadata-тестов нет — логика покрыта тестами `buildPageMetadata`; обвязка тривиальна.)

- [ ] **Step 5: Commit**

```bash
git add src/app/lectures/[id]/page.tsx src/app/trails/[id]/page.tsx src/app/glossary/[id]/page.tsx
git commit -m "feat(seo): per-page OG + canonical on lecture/trail/glossary pages"
```

---

### Task 6: Финальная проверка ворот

**Files:** —

- [ ] **Step 1: Lint** — Run: `pnpm lint` — Expected: чисто.
- [ ] **Step 2: Tests** — Run: `pnpm test` — Expected: все зелёные (включая новые seo/robots тесты).
- [ ] **Step 3: Build** — Run: `pnpm build` — Expected: сборка проходит.
- [ ] **Step 4: Ручная проверка** — `pnpm dev`, затем:
  - `curl -s http://localhost:<port>/robots.txt` — содержит `Allow: /`, `Disallow:` приватного, `Sitemap: <base>/sitemap.xml`.
  - открыть лекцию, view-source: `<meta property="og:title">`, `og:image`, `<link rel="canonical">` присутствуют; canonical = URL страницы. Остановить dev-сервер.

> **Зависимость для прода:** `NEXT_PUBLIC_BASE_URL` должен быть реальным origin (сейчас плейсхолдер). До этого canonical/OG-URL будут указывать на дефолт/плейсхолдер.

---

## Self-Review

**1. Spec coverage:**
- robots.txt (allow public/disallow private, ссылка на бэкендный sitemap) → Task 3. ✓
- metadataBase + дефолтный OG/twitter → Task 4. ✓
- per-page OG + canonical (lectures/trails/glossary) → Task 5. ✓
- base-URL хелпер (`siteUrl`/`metadataBaseUrl`) → Task 1. ✓
- og:image: лекция — обложка, trail/glossary — дефолт `/logo.png` → Task 2 (дефолт) + Task 5 (cover у лекции). ✓
- НЕ строим sitemap, НЕ вводим hreflang → не запланировано (соответствует спеке). ✓
- glossary без description → Task 5 Step 3 (не передаём description). ✓
- og:image абсолютизация через metadataBase → Task 4 (metadataBase) + Task 2 (относительный путь допустим). ✓

**2. Placeholder scan:** плейсхолдеров нет; весь код приведён целиком. Отсутствие metadata-тестов у layout/страниц — осознанное решение с обоснованием (хрупкость импорта page.tsx в jsdom), логика покрыта в `src/seo/*`.

**3. Type consistency:** `siteUrl(path?)`/`metadataBaseUrl()` (Task 1) ↔ потребление в Task 2/3/4. `PageMetadataInput { title, siteName, description?|undefined, image?, imageAlt?|undefined, path }` и `buildPageMetadata` (Task 2) ↔ вызовы в Task 5 (поля сущностей: lecture.description/cover_image_key/cover_image_alt, trail.description?, term только title). `lectureCoverUrl(key): string | null` ↔ `image?: string | null`. ✓

## Поправки по итогам 4-агентного ревью

- **Critical (фикс):** `exactOptionalPropertyTypes` — `description`/`imageAlt` в `PageMetadataInput` объявлены как `?: string | undefined` (иначе `lecture?.description: string|undefined` не присваивается → TS2379, падал бы `pnpm build`).
- **Important (фикс):** Next **ЗАМЕНЯЕТ** (не мержит) `openGraph` дочерней страницы → `og:site_name` пропадал бы на детальных. Добавлен `siteName` в `buildPageMetadata`, прокидывается из `getT("metadata")("appTitle")` на каждой странице.
- **Important (фикс):** `title.template` (`"%s — <siteName>"`) в layout — бренд в `<title>`/выдаче.
- **Important (фикс):** `twitter.card` = `summary` для дефолт-логотипа, `summary_large_image` только при реальной обложке (логотип не 1200×630). + `og:image.alt` из `lecture.cover_image_alt`.
- **Important (фикс):** точные позиции импортов (layout — после `@/i18n/client`; детальные — `cover-url` в блоке `@/features/lectures/*`, `page-metadata` после `@/i18n*`) — иначе `import/order`.
- **Minor (фикс):** robots disallow дополнен (`/annotations /auth /offline /_offline /push /trails/my`); dev-дефолт base → `:3001`; комментарий `.env.example` уточнён (BASE_PATH пуст в проде, github.io — легаси).
- **Отложено (Minor, осознанно):** `og:locale`; description глоссария из `term.blocks` (AST); JSON-LD/structured-data; `article:published_time`; query-param canonical-дубли; prod build-guard на `NEXT_PUBLIC_BASE_URL` (пока документировано как прод-пререквизит).
- **Внешняя зависимость (бэкенд):** бэкендный `/sitemap.xml` ДОЛЖЕН перечислять публичные lecture/trail/glossary URL (желательно с `lastmod`) — иначе обнаружение страниц не работает. Вынесено в бэкенд-аски.
