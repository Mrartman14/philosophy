# Edge contract (nginx) — что фронт обязан про него знать

> Этот документ — **не** конфиг, а зафиксированный контракт прод-edge, от которого
> зависит фронт. Источник истины (другой репозиторий): `philosophy-api/nginx/tls.conf`
> (прод) + `philosophy-api/docs/ops/network-hardening.md`. `nginx/default.conf` —
> **dev-only** (открывает `/api/` и `/swagger`), на прод не катится.
>
> Зачем док: nginx-конфиг живёт в deploy-репо (он связан с docker-compose), но его
> решения напрямую определяют поведение фронта. Без этого контракта легко
> спроектировать фичу неверно (так уже случилось с CSP-HSTS и SEO-sitemap).

## Топология: BFF

Прод = единственная публичная точка входа — **nginx :443**. Браузер общается **только с
Next** (`location /` → frontend:3000). Go-api (`/api/*`) наружу **НЕ проксируется** — Next
зовёт Go **на своей стороне** по внутренней docker-сети (`API_URL=http://api:8080`,
server-only, в браузер не попадает).

## Что публично через nginx

| Путь | Куда | Заметка |
|---|---|---|
| `/` (и всё прочее) | **Next** (SSR, server actions, Next-роуты `/api/telemetry`, `/api/csp-report`, `/api/offline/*`) | `/api/*` не затенён Go в проде → Next-роуты работают |
| `/static/files/...` | nginx с диска (`/data/files`) | НЕ процесс Go; БД (`/data/db`) недоступна |
| `/sitemap.xml`, `/llms.txt`, `/llms-full.txt` | **Go** (краулеры) | exact-match → бэкенд |
| `/mcp` | Go (PAT-auth, SSE) | |
| `/healthz`, `/readyz`, `/api/*` (data), `/swagger` | **закрыты публично** | 404 от фронта |

## Владельцы заголовков (НЕ дублировать)

- **HSTS — nginx** (`max-age=63072000; includeSubDomains`, server-level + на `/static/files/`).
  → Фронт HSTS **не ставит** (дубль перебивал бы её более коротким max-age).
- `X-Content-Type-Options: nosniff` на `/static/files/` — **nginx** (закрывает MIME-sniffing
  пользовательских загрузок). Остаётся бэкенд-долг: `Content-Disposition: attachment` для
  не-картиночных загрузок (stored-XSS через SVG/HTML).
- `CSP`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `nosniff` на страницах —
  **фронт** (nginx их не ставит → дублей нет).

## Следствия для фронт-разработки

- **Same-origin со стороны браузера.** Картинки (`/static/files/`), client-fetch
  (`/api/telemetry`, `/api/csp-report`, `/api/offline/*`, server actions, Next-данные) — всё
  same-origin. Go из браузера не зовётся. → В CSP `'self'` покрывает всё; внешние
  `connect-src`/`img-src` origin не нужны, пока storage не вынесут на отдельный CDN-домен.
- **Sitemap отдаёт бэкенд** → Next-`app/sitemap.ts` был бы затенён. **Не строить sitemap во
  фронте.** `robots.txt` фронтовой (nginx его не перехватывает) и ссылается на бэкендный
  `/sitemap.xml`.
- **Rate-limit:** на `location /` POST-лимит `actions` (15r/s, burst 40) — бьёт по мутациям
  (server actions, логин) и по POST-роутам (`/api/csp-report`, `/api/telemetry`,
  `/api/offline/*`). **GET страниц/ассетов НЕ лимитируется** → краулеры (Googlebot, соц-сети)
  не режутся. Учитывать при штормах POST (напр. CSP-репорты, offline-дренаж).
- **Connection-cap** `limit_conn 30` на IP (щедрый, терпит HTTP/2 и NAT).

## Прочие нюансы

- TLS терминируется на nginx; Next за прокси видит `http` + `X-Forwarded-Proto=https`.
- `NEXT_PUBLIC_*` вшиваются на этапе **сборки** фронта (build-args), `API_URL` — рантайм
  server-only.
- Единственный известный прямой браузерный вызов Go — AST-редактор `/api/ast/schema`
  (сегодня фолбэчит на серверную загрузку; есть закомментированный passthrough в `tls.conf`).
