# CSP + Security Headers — Design

- **Дата:** 2026-06-20
- **Статус:** Approved (design), готов к writing-plans
- **Scope:** Content-Security-Policy + статические security-заголовки для Next.js App Router (SSR, Docker `next start`)
- **Зависимость от бэкенда:** нет обязательных (см. §8)

## 1. Проблема

Сейчас фронт не отдаёт ни одного security-заголовка: нет `Content-Security-Policy`,
`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
Браузер по умолчанию исполняет и грузит что угодно откуда угодно.

При наличии пользовательского ввода (комментарии, аннотации) и auth-кук это значит:
один XSS-баг → исполнение чужого скрипта с доступом к сессии. CSP — второй рубеж:
он не чинит баги, а **ограничивает ущерб** от ещё не найденных. Плюс clickjacking
(`frame-ancestors`) и MIME-sniffing (`nosniff`).

## 2. Контекст (по результатам разведки)

- **Inline `<script>` / `dangerouslySetInnerHTML`: нет.** Единственные inline-скрипты —
  те, что Next сам инжектит для гидрации/стриминга (`self.__next_f.push`).
- **Тема (appearance):** выставляется SSR-атрибутами на `<html>` (`data-*` + `style`),
  **без** inline-скрипта — no-FOUC уже без скрипта. CSP-скрипты это не задевает.
- **Сторонние скрипты:** Yandex Metrika **отключена** (см.
  [docs/analytics-consent.md](../../analytics-consent.md)) — внешних script-origin'ов
  сейчас нет.
- **Шрифты:** `next/font/google` self-host'ит → Google-домены в CSP не нужны (`font-src 'self'`).
- **Inline `style`-атрибуты есть:** на `<html>` (`--text-scale`, `colorScheme`),
  в баннерах (`background_color` из бэка), глобал-эрроре + инлайны самого Next.
- **Приложение уже полностью динамическое:** root layout читает куки
  (`getMe`/`getAppearance`/`getLocale`) → статической генерации и так нет.
- **Middleware есть:** `src/proxy.ts` (auth-refresh + admin-гейт). Идеальная точка для
  per-request CSP + nonce.
- **next.config.ts:** `headers()` не задан; `images.unoptimized: true`; origin'ы
  изображений/API — через `NEXT_PUBLIC_STORAGE_URL` / `NEXT_PUBLIC_API_URL`.
- **Прод-домен:** пока не задеплоен. Origin'ы параметризуем через env, значение
  подставится при деплое.

## 3. Цели / Non-goals

**Цели:**
- Строгий `script-src` без `'unsafe-inline'` (через nonce) — главная защита от XSS.
- Полный набор статических security-заголовков.
- Безопасная раскатка: Report-Only → enforce, без риска «сломать прод вслепую».

**Non-goals:**
- Строгий `style-src` без `'unsafe-inline'` — технически невозможно для inline-`style`-
  атрибутов (для них nonce не существует). Осознанный компромисс (§5.2).
- HSTS `preload` сразу (почти необратимо) — отложено.
- Consent/аналитика — отдельный отложенный трек.

## 4. Архитектура

Два класса заголовков, два места установки (единый источник истины на каждый класс):

| Класс | Где | Почему |
|---|---|---|
| CSP (per-request, с nonce) | `src/proxy.ts` (middleware) | nonce обязан быть уникален на запрос |
| Статические security-заголовки | `next.config.ts` → `headers()` | широкое покрытие (вкл. ассеты), без dynamic-цены |
| Приём CSP-violation-репортов | `src/app/api/csp-report/route.ts` (новый) | same-origin receiver, логирует через observability |

### 4.1 Nonce-flow (middleware)

Интегрируется в **существующий** `proxy()` (не второй middleware):

1. Сгенерировать nonce: `btoa(crypto.randomUUID())` (или 16 random bytes → base64).
2. Собрать CSP-строку с этим nonce (§5).
3. Прокинуть nonce в request-заголовок `x-nonce` (на случай чтения в server components).
4. Установить CSP-заголовок на response (имя заголовка зависит от режима, §6).
5. Вернуть существующий `NextResponse` proxy с добавленными заголовками.

Next App Router сам проставляет nonce своим framework-скриптам, когда видит
`'nonce-…'` в CSP-заголовке запроса (документированный паттерн). Ручного протягивания
в компоненты не требуется.

Matcher `proxy.ts` уже исключает статические ассеты и `/api/` — CSP применяется к
HTML-документам, что и нужно.

### 4.2 Поток репортов

`Content-Security-Policy[-Report-Only]` содержит `report-to csp-endpoint` +
(legacy) `report-uri /api/csp-report`. Заголовок `Reporting-Endpoints:
csp-endpoint="/api/csp-report"` объявляет endpoint. Route handler принимает
`application/csp-report` / `application/reports+json`, логирует через существующий
observability-слой (console/beacon adapter) — **без нового бэкенд-ингеста**.

## 5. CSP-политика

### 5.1 Директивы

```
default-src 'self';
script-src 'self' 'nonce-{NONCE}' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: {STORAGE_ORIGIN};
font-src 'self';
connect-src 'self' {API_ORIGIN} {STORAGE_ORIGIN};
worker-src 'self';
manifest-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
upgrade-insecure-requests;          (только прод)
report-uri /api/csp-report;
report-to csp-endpoint;
```

`{API_ORIGIN}` = origin из `NEXT_PUBLIC_API_URL`; `{STORAGE_ORIGIN}` = origin из
`NEXT_PUBLIC_STORAGE_URL || NEXT_PUBLIC_API_URL` (то же разрешение, что в
`src/utils/storage-url.ts` — CSP не должен расходиться с тем, что реально грузит
браузер). Пустая переменная → внешний origin не добавляется (остаётся `'self'`).
**Обе переменные ОБЯЗАНЫ быть заданы перед `CSP_ENFORCE=1`** — иначе cross-origin
картинки/XHR заблокируются. Серверный `API_URL` для CSP НЕ используется (он не браузерный).
Дубли origin в `connect-src` дедуплицируются.

`worker-src 'self'` и `manifest-src 'self'` заданы **явно**, а не через фолбэк: из-за
`'strict-dynamic'` фолбэк `worker-src`→`script-src` заблокировал бы регистрацию
service worker'а `/sw.js` (он грузится как ресурс, без nonce). `manifest-src` сейчас
покрыт `default-src`, но явная директива дешевле латентного бага.

**`'strict-dynamic'`** — бонус на будущее: когда Yandex вернётся, его nonced-stub сам
подгрузит внешний скрипт без отдельного allowlist `mc.yandex.ru`.

### 5.2 Почему `style-src 'unsafe-inline'` — это не костыль

Inline-`style`-атрибуты (`style="…"`) **нельзя** покрыть nonce: nonce работает только
для `<style>`-элементов и `<script>`, не для style-**атрибутов**. Приложение использует
inline-style-атрибуты (тема на `<html>`, баннеры, Next-инлайны), убрать их все —
несоразмерно. Инъекция стилей кардинально менее опасна, чем исполнение скриптов.
Поэтому `style-src 'unsafe-inline'` — документированное допущение. Рефактор
`background_color` в CSS-переменную **не помогает** (CSS-var через `style={{}}` — всё
равно inline-атрибут), поэтому его не делаем.

## 6. Раскатка: Report-Only → Enforce

Флаг `CSP_ENFORCE` (env):
- `CSP_ENFORCE != "1"` → заголовок `Content-Security-Policy-Report-Only` (браузер
  только репортит нарушения, ничего не блокирует).
- `CSP_ENFORCE == "1"` → заголовок `Content-Security-Policy` (enforcing).

Порядок: выкатить Report-Only → собрать нарушения на проде (`/api/csp-report`) →
устранить → переключить флаг на enforce. Флип — конфиг, не правка кода.

## 7. Статические security-заголовки (`next.config.ts` `headers()`)

Применяются ко всем путям:

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY                       (legacy-компаньон frame-ancestors)
Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), accelerometer=(), gyroscope=(), magnetometer=(), xr-spatial-tracking=(), display-capture=(), idle-detection=()
Strict-Transport-Security: max-age=31536000; includeSubDomains   (только прод/HTTPS)
```

Примечание: `upgrade-insecure-requests` живёт в CSP (per-request, §5.1), не здесь —
эти заголовки статические. `notifications`/`push` в `Permissions-Policy` НЕ запрещаем
(токенов нет, и приложение использует web-push).

HSTS включается только в проде по env-гейту (`NODE_ENV === "production"`); **без
`preload`** на старте (почти необратимо). `Permissions-Policy` выключает фичи, которые
приложение не использует.

## 8. Зависимости от бэкенда

**Обязательных — нет.** CSP катится независимо.

**Комплементарные (опциональные, defense-in-depth):**
1. Security-заголовки на отдаче файлов `/static/files/{key}`: `X-Content-Type-Options:
   nosniff`, корректный `Content-Type`, для пользовательских не-картиночных загрузок —
   `Content-Disposition: attachment`. Закрывает stored-XSS через загруженный SVG/HTML —
   фронтовый CSP это не покрывает (контент с другого origin).
2. (Под будущую SEO-спеку) `updated_at` в листинг-ответах `/api/lectures|trails|glossary`
   для точного `lastmod` в sitemap.

## 9. Frozen-зоны под этот PR (foundation-update, явно)

- `src/proxy.ts` — добавление CSP + nonce в существующий response.
- `next.config.ts` — `headers()` со статическими заголовками.
- Новый файл: `src/app/api/csp-report/route.ts`.
- `.env.example` (НЕ frozen): задокументировать `CSP_ENFORCE`, origin-переменные
  `NEXT_PUBLIC_STORAGE_URL`/`NEXT_PUBLIC_API_URL` (их сейчас НЕТ ни в одном .env) и
  `NEXT_PUBLIC_ANALYTICS_ENABLED`. Origin'ы обязательны перед enforce.

## 10. Тестирование

- **Unit:** сборка CSP-строки — корректные директивы, подстановка nonce, ветка
  Report-Only vs enforce по `CSP_ENFORCE`, резолв origin'ов из env (пусто → без внешнего
  origin).
- **Unit:** `csp-report` route — принимает report-контент-типы, не падает на пустом/битом
  теле, логирует.
- **Integration/middleware:** на HTML-ответе присутствует CSP-заголовок с уникальным
  nonce; статические заголовки присутствуют; на двух запросах nonce разный.
- **Ручная проверка:** прогон по приложению в Report-Only, ноль ложных нарушений в
  `/api/csp-report` до переключения на enforce.

## 11. Риски / открытые вопросы

- **Next-инлайн-скрипты без nonce.** Если какая-то версия Next проставит скрипт без
  nonce — Report-Only это поймает до enforce. Поэтому Report-Only обязателен первым.
- **Прод-origin'ы.** До деплоя `{API/STORAGE_ORIGIN}` неизвестны; политика
  параметризована, значения подставятся из env при деплое.
- **WebSocket/HMR в dev.** В dev `connect-src` должен допускать `ws:`/HMR — добавить
  dev-ветку, чтобы не ломать локальную разработку.

## 12. YAGNI-отсечки

- Без strict `style-src` (невозможно для атрибутов).
- Без аналитики поверх CSP-репортов — простой логирующий ингест.
- Без HSTS preload на старте.
- Без `trusted-types` (отдельный крупный трек, не сейчас).
