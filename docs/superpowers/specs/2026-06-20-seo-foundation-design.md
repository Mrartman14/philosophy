# SEO Foundation — Design

- **Дата:** 2026-06-20
- **Статус:** Approved (design), готов к writing-plans
- **Scope:** robots.txt + metadataBase + Open Graph/Twitter + canonical для Next.js App Router (SSR)
- **Зависимость от бэкенда:** нет. (sitemap.xml уже отдаёт бэкенд — см. §2.)

## 1. Проблема

Публичный контент (лекции/trails/глоссарий) плохо виден поисковикам и непривлекательно
выглядит при шеринге: нет `robots.txt`, нет `metadataBase`, нет Open Graph/Twitter-карточек,
нет `canonical`. Цель — закрыть SEO-базис тем, что **принадлежит фронту**, не дублируя
то, что уже делает бэкенд/edge.

## 2. Контекст прод-топологии (критично — см. [[prod-bff-nginx-topology]])

Прод = nginx :443, BFF-модель. Это определяет, что строим, а что НЕТ:

- **`/sitemap.xml` отдаёт БЭКЕНД** (nginx exact-match `/sitemap.xml` → Go). Next-sitemap был бы
  **затенён** и недоступен. → **Sitemap во фронте НЕ строим.** robots лишь ссылается на него.
- `/llms.txt`, `/llms-full.txt` — тоже бэкенд (LLM-краулеры).
- **`/robots.txt`** не перехватывается nginx → фоллбэк в Next → **фронт владеет robots**.
- Краулеры не режутся (GET на edge не лимитируется).
- Картинки/страницы — same-origin; OG-картинки должны быть абсолютными (Next абсолютизирует
  относительные через `metadataBase`).

## 3. Цели / Non-goals

**Цели:** robots.txt (allow public / disallow private, ссылка на бэкендный sitemap);
`metadataBase`; дефолтный OG/Twitter в layout; per-page OG + canonical на детальных страницах.

**Non-goals (YAGNI):** sitemap во фронте (бэкенд); hreflang (cookie-locale, i18n не трогаем —
один canonical-URL); динамическая генерация OG-картинок (`next/og`) — enhancement на потом;
JSON-LD/structured data — отдельный возможный трек, не сейчас.

## 4. Архитектура

Новый ненезамороженный неймспейс `src/seo/` (зеркало подхода `src/security/`):

| Юнит | Ответственность |
|---|---|
| `src/seo/site-url.ts` | `siteUrl(path?)` → абсолютный URL от `NEXT_PUBLIC_BASE_URL`; `metadataBaseUrl()` → `URL`. Единственный источник базового URL для SEO. |
| `src/seo/page-metadata.ts` | `buildPageMetadata({ title, description, image?, path })` → `{ openGraph, twitter, alternates: { canonical } }`. DRY для детальных страниц. |
| `src/app/robots.ts` | `MetadataRoute.Robots`: allow `/`, disallow приватного; `sitemap` → бэкендный URL. |
| `src/app/layout.tsx` (MOD, frozen) | в `generateMetadata`: `metadataBase` + дефолтные `openGraph`/`twitter` (siteName, type, дефолт-картинка `/logo.png`). |
| `src/app/lectures/[id]/page.tsx` (MOD) | в `generateMetadata`: `buildPageMetadata` с og:image из `cover_image_key`. |
| `src/app/trails/[id]/page.tsx` (MOD) | в `generateMetadata`: `buildPageMetadata` с дефолт-картинкой. |
| `src/app/glossary/[id]/page.tsx` (MOD) | в `generateMetadata`: `buildPageMetadata` с дефолт-картинкой. |

### 4.1 Базовый URL

`NEXT_PUBLIC_BASE_URL` — origin прода (в проде корень origin, `NEXT_PUBLIC_BASE_PATH` пустой;
github.io/`/philosophy` — мёртвая легаси). Нормализуем (срезаем хвостовой `/`). Сейчас значение
плейсхолдерное — реальный домен подставится при деплое (как с CSP-origin). Дефолт для dev —
`http://localhost:3001`.

### 4.2 robots правила

`allow: "/"`; `disallow`: `/admin`, `/me`, `/api`, `/dev`, `/canvases`, `/documents`, `/forms`,
`/comments`, `/saved`, `/share-links`, `/submissions`, `/media`, `/calendar`, `/login`,
`/register`, `/search`. `sitemap: siteUrl("/sitemap.xml")`. (Опц.: добавить `/llms.txt` строкой —
но это не стандартное поле robots; кладём ссылку только на sitemap.)

### 4.3 OG/canonical

- Дефолтный OG (layout): `siteName` + `type: website` + `images: ["/logo.png"]` (Next абсолютизирует
  через `metadataBase`) + `twitter.card: "summary_large_image"`. Локализация — через существующий
  `getT("metadata")`.
- Per-page (детальные): `openGraph.title/description/url(canonical)/images`, `alternates.canonical`
  = self-URL (`siteUrl(path)`), `type: article`. og:image: лекции — обложка; trails/glossary —
  дефолт `/logo.png`. **Без hreflang.**

## 5. Поток данных

Детальные страницы уже фетчат сущность в `generateMetadata` (для title) — переиспользуем тот же
объект: достаём `title`/`description`/`cover_image_key`, прокидываем в `buildPageMetadata`. Никаких
новых запросов к бэку.

## 6. Обработка ошибок / edge-cases

- Сущность не найдена / фетч упал → дефолтные title + дефолт-картинка (как сейчас для title).
- `NEXT_PUBLIC_BASE_URL` пуст → дефолт `http://localhost:3001` (dev); абсолютные URL всё равно
  валидны (важно только чтобы при деплое задали реальный).
- og:image относительный → Next абсолютизирует через `metadataBase` (поэтому `metadataBase`
  обязателен).

## 7. Тестирование

- `site-url.ts`: `siteUrl` собирает абсолютный URL, срезает двойные слеши, дефолт при пустом env.
- `page-metadata.ts`: canonical = self-URL; og:image из переданной картинки или дефолт; twitter-карточка.
- `robots.ts`: allow `/`; приватные пути в disallow; sitemap указывает на абсолютный `/sitemap.xml`.
- Детальные `generateMetadata`: canonical совпадает с путём; og:image из обложки (лекция) / дефолт (trail/glossary).

## 8. Frozen-зоны под этот PR (явно)

- `src/app/layout.tsx` — `metadataBase` + дефолтный OG (foundation-touch).
- Детальные `page.tsx` лекций/trails/глоссария — feature-страницы, не заморожены.
- Новое: `src/seo/*`, `src/app/robots.ts`. `.env.example` — добавить пояснение к `NEXT_PUBLIC_BASE_URL`
  (нужен реальный origin перед раскаткой SEO).

## 9. YAGNI-отсечки

- Без sitemap (бэкенд), без hreflang, без `next/og`, без JSON-LD.
- Без отдельного OG-ассета (пока `/logo.png`).

## 10. Поправки по итогам 4-агентного ревью

- **Next ЗАМЕНЯЕТ openGraph дочерней страницы (не мержит)** — поэтому `og:site_name` (и любые
  наследуемые OG-поля) надо задавать НА КАЖДОЙ странице. `buildPageMetadata` получает `siteName`
  (из `getT("metadata")("appTitle")`).
- **`title.template`** (`"%s — <siteName>"`) в layout — бренд в `<title>`.
- **twitter card:** `summary` для дефолт-логотипа, `summary_large_image` только при настоящей обложке;
  `og:image.alt` из `lecture.cover_image_alt`.
- **exactOptionalPropertyTypes:** `description`/`imageAlt` объявлены `?: string | undefined`.
- **basePath:** `NEXT_PUBLIC_BASE_PATH` НЕ подключён в `next.config` (SSR в корне) → в проде пустой;
  `/philosophy` в `.env.production` — мёртвая легаси. `NEXT_PUBLIC_BASE_URL` = реальный корень origin
  (прод-пререквизит; до него canonical/OG указывают на плейсхолдер).
- **Share-token (`?token=`):** `generateMetadata` фетчит БЕЗ токена → приватный ресурс деградирует до
  дефолтного title (приватное не утекает); canonical — всегда tokenless. By-design.
- **og:image origin:** обложки лекций резолвятся из `NEXT_PUBLIC_STORAGE_URL`/`NEXT_PUBLIC_API_URL`
  (НЕ `BASE_URL`); в проде storage same-origin (`/static/files/`). Если вынесут на CDN-домен — OG станет
  cross-origin (осознать).
- **Внешняя зависимость (бэкенд):** бэкендный `/sitemap.xml` обязан перечислять публичные
  lecture/trail/glossary URL (с `lastmod`) — иначе обнаружение страниц не работает. Вынесено в бэкенд-аски.
- **`/calendar` УБРАН из robots disallow** (финальное ревью): страница публичная (без auth-гейта,
  `createPublicApiClient`) — блокировать её от индексации противоречит политике «allow public».
- **Отложено (Minor):** `og:locale`; description глоссария из `term.blocks`; JSON-LD; `article:published_time`;
  query-param canonical-дубли; prod build-guard на `NEXT_PUBLIC_BASE_URL`.
