# Web-quality Minors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Добить отложенные Minor-находки CSP/SEO-ревью: тест-/косметическая чистка CSP + `og:locale`/`article:published_time` в SEO.

**Architecture:** Точечные правки уже-смёрженного кода + тесты. Логика SEO остаётся в `src/seo/*` (пополняем `buildPageMetadata` двумя опц-полями + хелпер `ogLocale`).

**Tech Stack:** Next 16 Metadata API, TypeScript (exactOptionalPropertyTypes ON), vitest jsdom, next-intl (`getLocale`).

## Global Constraints

- **pnpm** (не npm). vitest jsdom. kebab-case.
- Git: только свои файлы по имени (НЕ `git add -A`); без деструктивных git; без push.
- НЕ трогать i18n-файлы. `getLocale()` из `@/i18n` возвращает `Promise<"ru"|"en">`, безопасно зовётся в `generateMetadata` (cache-обёрнут).
- exactOptionalPropertyTypes: новые опц-поля объявлять `?: T | undefined`.
- Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.

## File Structure

- **Modify** `src/security/csp.ts` — defensive empty-string filter в `externalOrigins`.
- **Modify** `src/security/csp.test.ts` — тест дедупа connect-src + коммент к ассерту.
- **Modify** `src/proxy.ts` — пустая строка между двумя JSDoc-блоками.
- **Modify** `src/app/api/csp-report/route.ts` — `let body: unknown;` (убрать `= null`).
- **Modify** `src/app/api/csp-report/route.test.ts` — `warn.mockClear()` во 2-м тесте.
- **Modify** `src/seo/page-metadata.ts` — `locale?`/`publishedTime?` в input + `ogLocale` хелпер.
- **Modify** `src/seo/page-metadata.test.ts` — тесты locale/publishedTime/ogLocale.
- **Modify** `src/app/layout.tsx` — `openGraph.locale` из `getLocale()`.
- **Modify** `src/app/lectures/[id]/page.tsx` — `locale` + `publishedTime: created_at`.
- **Modify** `src/app/trails/[id]/page.tsx`, `src/app/glossary/[id]/page.tsx` — `locale`.

---

### Task 1: CSP cleanups

**Files:** Modify `src/security/csp.ts`, `src/security/csp.test.ts`, `src/proxy.ts`, `src/app/api/csp-report/route.ts`, `src/app/api/csp-report/route.test.ts`.

- [ ] **Step 1: defensive filter в csp.ts**

В `src/security/csp.ts` заменить:

```ts
  const externalOrigins = [apiOrigin, storageOrigin].filter(
    (o): o is string => o !== null,
  );
```

на (исключаем и пустую строку — на случай прямого вызова buildCsp с `""`):

```ts
  const externalOrigins = [apiOrigin, storageOrigin].filter(
    (o): o is string => o !== null && o.length > 0,
  );
```

- [ ] **Step 2: тест дедупа + коммент в csp.test.ts**

В `src/security/csp.test.ts`, в тесте `"без внешних origin когда null"`, добавить коммент перед ассертом `connect-src 'self';`:

```ts
    // "; " — разделитель директив: после connect-src 'self' идёт "; <next-directive>"
    expect(csp).toContain("connect-src 'self';");
```

И добавить НОВЫЙ тест (после теста `"добавляет внешние origin..."`):

```ts
  it("дедуплицирует connect-src при apiOrigin === storageOrigin", () => {
    const csp = buildCsp({
      ...base,
      apiOrigin: "https://api.example.com",
      storageOrigin: "https://api.example.com",
    });
    expect(csp).toContain("connect-src 'self' https://api.example.com;");
    expect(csp).not.toContain(
      "https://api.example.com https://api.example.com",
    );
  });
```

- [ ] **Step 3: пустая строка в proxy.ts**

В `src/proxy.ts` между концом JSDoc функции `proxy` и началом JSDoc `pageResponse` добавить ОДНУ пустую строку. Было:

```ts
 * обход middleware = «refresh не случился» → гость, не дыра.
 */
/**
 * Ответ, рендерящий страницу, с проставленными CSP+nonce.
```

стало:

```ts
 * обход middleware = «refresh не случился» → гость, не дыра.
 */

/**
 * Ответ, рендерящий страницу, с проставленными CSP+nonce.
```

- [ ] **Step 4: csp-report route — мёртвый инициализатор**

В `src/app/api/csp-report/route.ts` заменить `let body: unknown = null;` на `let body: unknown;`.

- [ ] **Step 5: csp-report test — mockClear во 2-м тесте**

В `src/app/api/csp-report/route.test.ts` во втором тесте (`"не падает на битом теле..."`) добавить первой строкой тела:

```ts
    warn.mockClear();
```

- [ ] **Step 6: тесты + л인т**

Run: `pnpm test src/security/csp.test.ts src/app/api/csp-report/route.test.ts src/proxy.test.ts`
Expected: всё PASS (включая новый дедуп-тест).
Run: `pnpm exec eslint src/security/csp.ts src/proxy.ts src/app/api/csp-report/route.ts`
Expected: чисто.

- [ ] **Step 7: Commit**

```bash
git add src/security/csp.ts src/security/csp.test.ts src/proxy.ts src/app/api/csp-report/route.ts src/app/api/csp-report/route.test.ts
git commit -m "chore(security): CSP minor cleanups (dedup test, defensive filter, jsdoc, dead init)"
```

---

### Task 2: SEO — og:locale + article:published_time

**Files:** Modify `src/seo/page-metadata.ts`, `src/seo/page-metadata.test.ts`, `src/app/layout.tsx`, `src/app/lectures/[id]/page.tsx`, `src/app/trails/[id]/page.tsx`, `src/app/glossary/[id]/page.tsx`.

**Interfaces:**
- Produces: `ogLocale(resolved: string): string` (ru→ru_RU, en→en_US, иначе как есть); `PageMetadataInput` += `locale?: string | undefined`, `publishedTime?: string | undefined`.

- [ ] **Step 1: page-metadata.ts — поля + ogLocale**

В `src/seo/page-metadata.ts`:

(а) добавить в `PageMetadataInput` (после `imageAlt`):

```ts
  /** og:locale в BCP-47-стиле "ru_RU"/"en_US" (используй ogLocale()). */
  locale?: string | undefined;
  /** article:published_time (ISO datetime, напр. created_at). */
  publishedTime?: string | undefined;
```

(б) добавить экспорт-хелпер (рядом с `DEFAULT_OG_IMAGE`):

```ts
const OG_LOCALE: Record<string, string> = { ru: "ru_RU", en: "en_US" };

/** Резолвит UI-локаль ("ru"/"en") в og:locale ("ru_RU"/"en_US"); иначе — как есть. */
export function ogLocale(resolved: string): string {
  return OG_LOCALE[resolved] ?? resolved;
}
```

(в) в `buildPageMetadata` принять новые поля и добавить их в `openGraph` (после `images`):

```ts
export function buildPageMetadata({
  title,
  siteName,
  description,
  image,
  imageAlt,
  locale,
  publishedTime,
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
      ...(locale ? { locale } : {}),
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: hasImage ? "summary_large_image" : "summary",
      title,
      images: [ogImage],
      ...(description ? { description } : {}),
    },
  };
}
```

- [ ] **Step 2: page-metadata.test.ts — тесты**

Добавить импорт `ogLocale` (рядом с `buildPageMetadata`) и два теста (внутри `describe`):

```ts
  it("og:locale и article:published_time когда заданы", () => {
    withBase();
    expect(
      buildPageMetadata({
        ...base,
        locale: "ru_RU",
        publishedTime: "2026-01-02T03:04:05Z",
      }),
    ).toMatchObject({
      openGraph: { locale: "ru_RU", publishedTime: "2026-01-02T03:04:05Z" },
    });
  });
```

И отдельный `describe` для `ogLocale`:

```ts
describe("ogLocale", () => {
  it("маппит ru→ru_RU, en→en_US, иначе как есть", () => {
    expect(ogLocale("ru")).toBe("ru_RU");
    expect(ogLocale("en")).toBe("en_US");
    expect(ogLocale("xx")).toBe("xx");
  });
});
```

- [ ] **Step 3: layout.tsx — openGraph.locale**

В `src/app/layout.tsx` импортировать `ogLocale` и `getLocale` (getLocale уже импортирован из `@/i18n`; добавить `ogLocale` к импорту из `@/seo/...` — рядом с `metadataBaseUrl`, т.е. `import { metadataBaseUrl } from "@/seo/site-url";` оставить, и добавить `import { ogLocale } from "@/seo/page-metadata";` в правильной позиции: `@/seo/page-metadata` < `@/seo/site-url`, значит ДО строки site-url).

В `generateMetadata` добавить `const locale = await getLocale();` после `const siteName = ...`, и в `openGraph` добавить `locale: ogLocale(locale),` (после `images`):

```ts
  const t = await getT("metadata");
  const siteName = t("appTitle");
  const locale = await getLocale();
  return {
    metadataBase: metadataBaseUrl(),
    title: { default: siteName, template: `%s — ${siteName}` },
    description: t("appDescription"),
    manifest: "/manifest.webmanifest",
    appleWebApp: { title: t("appShortName"), capable: true, statusBarStyle: "black-translucent" },
    openGraph: {
      type: "website",
      siteName,
      title: siteName,
      description: t("appDescription"),
      images: ["/logo.png"],
      locale: ogLocale(locale),
    },
    twitter: { card: "summary", title: siteName, description: t("appDescription"), images: ["/logo.png"] },
  };
```

(Сохранить существующие комментарии в функции; здесь они опущены для краткости — НЕ удалять их.)

- [ ] **Step 4: lectures page — locale + publishedTime**

В `src/app/lectures/[id]/page.tsx`:
- к импорту из `@/seo/page-metadata` добавить `ogLocale` (`import { buildPageMetadata, ogLocale } from "@/seo/page-metadata";`);
- импортировать `getLocale` из `@/i18n` (если ещё нет — добавить в правильной позиции группы `@/i18n`);
- в `generateMetadata` добавить `getLocale()` в `Promise.all` и передать поля:

```ts
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

- [ ] **Step 5: trails + glossary pages — locale**

В `src/app/trails/[id]/page.tsx` и `src/app/glossary/[id]/page.tsx` аналогично: добавить `ogLocale` к импорту `@/seo/page-metadata`, импортировать `getLocale` из `@/i18n`, добавить `getLocale()` в `Promise.all` и `locale: ogLocale(locale)` в вызов `buildPageMetadata`. (publishedTime НЕ добавляем — у trail/term нет ясной даты публикации.)

trails:

```ts
  const [trail, t, tMeta, locale] = await Promise.all([
    getTrailById(id),
    getT("pages"),
    getT("metadata"),
    getLocale(),
  ]);
  return buildPageMetadata({
    title: trail?.title ?? t("trailDefaultTitle"),
    siteName: tMeta("appTitle"),
    description: trail?.description,
    locale: ogLocale(locale),
    path: `/trails/${id}`,
  });
```

glossary:

```ts
  const [term, t, tMeta, locale] = await Promise.all([
    getTermById(id),
    getT("pages"),
    getT("metadata"),
    getLocale(),
  ]);
  return buildPageMetadata({
    title: term?.title ?? t("termDefaultTitle"),
    siteName: tMeta("appTitle"),
    locale: ogLocale(locale),
    path: `/glossary/${id}`,
  });
```

- [ ] **Step 6: тесты + lint + build**

Run: `pnpm test src/seo/page-metadata.test.ts`
Expected: PASS (incl. новые locale/publishedTime/ogLocale тесты).
Run: `pnpm lint`
Expected: чисто (import/order в layout + 3 страницах; типы Metadata).
Run: `pnpm build`
Expected: сборка проходит.

- [ ] **Step 7: Commit**

```bash
git add src/seo/page-metadata.ts src/seo/page-metadata.test.ts src/app/layout.tsx src/app/lectures/[id]/page.tsx src/app/trails/[id]/page.tsx src/app/glossary/[id]/page.tsx
git commit -m "feat(seo): og:locale (all pages) + article:published_time (lectures)"
```

---

### Task 3: Финальный гейт

- [ ] **Step 1:** `pnpm lint` — чисто.
- [ ] **Step 2:** `pnpm test` — все зелёные.
- [ ] **Step 3:** `pnpm build` — проходит.

---

## Self-Review

**Spec coverage:** CSP-чистка (дедуп-тест/defensive-filter/jsdoc/dead-init/mockClear) → Task 1. og:locale (layout+3 страницы) + article:published_time (lectures) → Task 2. ✓
**Placeholder scan:** код приведён целиком; комментарии layout сохраняются (явно отмечено). ✓
**Type consistency:** `ogLocale(string): string` ↔ вызовы в layout+3 страницах. `locale?/publishedTime?: string | undefined` ↔ передаются `ogLocale(locale)` (string) и `lecture?.created_at` (string, required-поле). `getLocale(): Promise<"ru"|"en">` → `ogLocale` принимает string. ✓
**Build-guard на NEXT_PUBLIC_BASE_URL — НЕ включён:** fail-build сломал бы текущую сборку на плейсхолдере; warn даёт шум; прод-пререквизит уже документирован (.env.example/spec/memory).
