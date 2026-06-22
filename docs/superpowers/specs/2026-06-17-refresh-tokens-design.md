# Дизайн: refresh-токены, per-device сессии и устранение рассинхрона TTL

**Дата:** 2026-06-17
**Тип:** cross-repo foundation-update + новый фича-слайс. Бэк `philosophy-api` (Go): таблицы + сервис + эндпоинты. Фронт `philosophy`: новый `src/middleware.ts` (корневая инфра) + cookie-слой `src/features/auth/*` + слайс `src/features/sessions/` (UI «активные устройства»). **Не одна фича** — координированно.
**Статус:** решения по открытым вопросам зафиксированы 2026-06-17 (см. раздел «Решения»). Готово к написанию плана.

## Постановка задачи

Один токен — access-JWT — с рассинхроном жизненного цикла:

- Бэк выпускает access-JWT `exp = iat + 24h` ([philosophy-api/internal/user/service.go:166](../../../../philosophy-api/internal/user/service.go)). Refresh нет.
- **Стопгап от 2026-06-17 уже выровнял cookie под 24ч** ([src/features/auth/cookie.ts](../../../src/features/auth/cookie.ts)) — зомби-окно (cookie переживала токен на ~29 дней) закрыто.
- `jwt.Parse` валидирует `exp` → через 24ч → 401 ([auth.go:120-122](../../../../philosophy-api/internal/middleware/auth.go)) → `getMe()` сворачивает 401 → гость ([src/utils/me.ts:69-71](../../../src/utils/me.ts)).

После стопгапа сессия = 24ч жёстко, ежедневный перелогин. Эта спека возвращает долгую сессию **без** долгоживущего access, опираясь на уже существующий stateful-отзыв (`tokens_valid_after`), и добавляет управление устройствами.

### Цель

- Сессия 30 дней при коротком access (15 мин), прозрачное обновление.
- Per-device сессии: список активных устройств, отзыв по одному, плюс «выйти везде».
- Усилить, а не ослабить отзыв: reuse-detection украденного refresh.

### Не-цель

OAuth/соц-логины, email-верификация, сброс пароля, 2FA — отдельные инициативы. Модель «бэк — единственный источник истины по auth» не меняется (фронт остаётся тонким).

## Решения (зафиксировано 2026-06-17)

| # | Вопрос | Решение |
|---|---|---|
| 1 | TTL | access **15 мин**, refresh/сессия **30 дней** |
| 4 | sliding vs absolute | **absolute**: `expires_at` сессии фиксируется на логине, ротация его не двигает |
| 3 | logout-scope | **per-device** + «выйти везде». Отзыв удалённого устройства — **eventual ≤15м** (мех. P2, hot-path не трогаем) |
| 2 | гонка refresh | **коалесинг в Next** (один `/refresh` на refresh-cookie), бэк строго single-use; **grace-window на бэке — бэкстоп для горизонтального скейла** |
| 5 | очистка | периодический sweep-горутина (`expires_at < now`); `used`-строки живут до конца сессии (нужны для reuse-detection) |
| 6 | middleware | отдельный foundation-PR; **не несущая** конструкция (refresh = UX, не authz; согласуется с [banned-forced-logout](2026-06-15-banned-user-forced-logout-design.md) и CVE-2025-29927) |

## Текущее устройство (факты)

| Аспект | Сейчас |
|---|---|
| access | HS256 JWT, claims `{user_id, iat, exp}`, `exp=iat+24h` |
| отзыв | per-user `tokens_valid_after`: `iat < tokens_valid_after` → мёртв ([auth.go:140-153](../../../../philosophy-api/internal/middleware/auth.go)) |
| хранение | httpOnly cookie `token`, sameSite lax, secure(prod), `path=/` |
| identity | из БД на каждый запрос (роль/статус/`tokens_valid_after`) — бан/роль уже свежие за 1 запрос |

`tokens_valid_after` сохраняем **только** для «выйти везде» / смены пароля (мгновенный kill всего access). Per-device его не трогает.

## Модель токенов

- **access** — JWT как сейчас, `exp=15м`. Claims и middleware **не меняются** (ключевое для P2): вся проверка подписи/`exp`/`tokens_valid_after`/ban остаётся как есть. `session_id` в claims НЕ кладём.
- **refresh** — непрозрачный CSPRNG-токен (32 байта, base64url). В БД — только `sha256(raw)`. Решает lookup, подделывать нечего.

## Схема БД (миграция `006_auth_sessions.sql`)

Сессия (= устройство = «семья ротации») вынесена в свою таблицу; refresh-строки — цепочка ротации внутри сессии.

```sql
CREATE TABLE auth_sessions (
    id           TEXT PRIMARY KEY,       -- session_id / family (uuid)
    user_id      TEXT NOT NULL REFERENCES users(id),
    user_agent   TEXT,                   -- опознание устройства в списке
    ip           TEXT,                   -- то же; усечённо/по политике приватности
    created_at   INTEGER NOT NULL,
    last_used_at INTEGER NOT NULL,       -- двигается на каждом refresh
    expires_at   INTEGER NOT NULL        -- ABSOLUTE: login + 30d, ротацией НЕ двигается
);

CREATE TABLE refresh_tokens (
    id          TEXT PRIMARY KEY,        -- uuid
    session_id  TEXT NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,    -- sha256(raw)
    used_at     INTEGER,                 -- != NULL → ротирован (reuse-detection)
    created_at  INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user   ON auth_sessions(user_id);
CREATE INDEX idx_refresh_session ON refresh_tokens(session_id);
```

Удаление сессии каскадом убивает её refresh-строки. `GET /sessions` читает `auth_sessions`; per-device отзыв = удалить одну строку `auth_sessions`.

## Эндпоинты

- `POST /api/auth/login` → `{ token, refresh_token }`. Заводит `auth_sessions` (захват `user_agent`/`ip` из запроса) + первую refresh-строку. *(Контракт расширяется — регенерация OpenAPI `src/api/schema.ts`, координированно.)*
- `POST /api/auth/refresh` → принимает `{ refresh_token }`. Валидирует: `token_hash` найден, `used_at IS NULL`, сессия не `expired`, юзер не banned. На успех — ротирует (старому `used_at=now`, новая строка в той же сессии), двигает `last_used_at` (но **не** `expires_at`), выпускает новый access. Возвращает `{ token, refresh_token }`.
- `GET /api/auth/sessions` → список активных сессий юзера: `id, user_agent, ip, created_at, last_used_at` + флаг `is_current`.
- `DELETE /api/auth/sessions/:id` → отзыв одной сессии (проверка принадлежности вызывающему). Каскад убивает refresh; удалённое устройство умрёт в ≤15м (см. P2).
- `POST /api/auth/logout` → выход текущего устройства: удалить **текущую** сессию. (Текущее устройство дополнительно чистит cookie локально → мгновенно для себя.)
- `POST /api/auth/logout?scope=all` (или отдельная ручка) → «выйти везде»: удалить **все** сессии юзера **+ бамп `tokens_valid_after`** (мгновенный kill всего access; нужно для смены пароля/компрометации).

## Per-device отзыв — механика P2 (eventual ≤15м)

«Выйти на устройстве X» = удалить его `auth_sessions`-строку (каскад → refresh мёртв). Текущий access устройства X валиден до своего `exp` (≤15м), но рефрешнуться уже нельзя → в ≤15м оно становится гостем. Остальные устройства не затронуты. **Hot-path middleware не меняется, `session_id` в claims не нужен** — это и есть выигрыш P2: per-device без удорожания каждого запроса. Текущее устройство при self-logout чистит свою cookie сразу, так что для себя выход мгновенный; ≤15м касается только отзыва *чужого* устройства.

«Выйти везде» остаётся мгновенным для всего access через `tokens_valid_after`.

## Ротация + reuse-detection

Refresh одноразовый. Предъявление refresh с `used_at != NULL` (легитимный владелец уже ротировал) → кто-то держит украденную копию → **удаляем всю сессию** (каскад) + бамп `tokens_valid_after` юзера. Жертва перелогинится, кража обрывается. Stateful-сторадж это позволяет.

### Гонка параллельного refresh (Q2) — коалесинг + grace-бэкстоп

Одна навигация = несколько параллельных запросов к Next; при протухшем access они все дёрнут `/refresh` одним токеном → второй увидит `used_at` → ложная reuse-тревога → спонтанный логаут.

- **Основной слой — коалесинг в Next-middleware.** Module-level `Map<refresh_cookie, Promise>`: первый запрос с данной cookie запускает один `/refresh`, остальные ждут тот же Promise → одна новая пара, одна cookie, один вызов бэка. Cookie общая на вкладки одного браузера → мультитаб покрыт. Требует Node-runtime middleware (Next 16) ради переживающего process state; на деплое (один Docker `next start`) работает идеально.
- **Бэкстоп — grace-window на бэке (для горизонтального скейла).** Реализуем, когда появятся ≥2 инстанса Next: при ротации бэк короткое окно (~10с) держит сырой успешный refresh и на повтор внутри окна возвращает его же + свежий access (не тревога). Гонщики сходятся на одном токене.

## Совместимость слоёв

| Механизм | Что режет | Горизонт |
|---|---|---|
| `tokens_valid_after` (per-user) | весь access юзера | мгновенно (per-request DB) |
| удаление `auth_sessions`-строки | refresh устройства | access устройства — ≤15м |
| `used_at` + reuse-detection | украденный refresh → вся сессия | мгновенно при предъявлении |

Конфликта нет; logout-all использует первый, per-device — второй, защита от кражи — третий.

## Фронт

### `src/middleware.ts` (foundation-PR)

Серверные компоненты не умеют `Set-Cookie` (только actions/route handlers/middleware), а `getMe()` зовётся в рендере — он обнаружит протухший access, но не починит. Поэтому прозрачный refresh живёт в middleware:

```text
[Любой запрос] → src/middleware.ts:
    access есть и не протух → пропустить
    access нет/протух, refresh есть → (коалесинг по refresh-cookie)
        POST philosophy-api /api/auth/refresh { refresh_token }
        200 → Set-Cookie token + refresh_token (ротированный), пропустить
        4xx → удалить обе cookie, пропустить как гостя
    refresh нет → гость
```

Безопасность держит data-layer (`getMe`→бэк на каждый запрос); обход middleware (CVE-2025-29927) = «refresh не случился» → юзер видит гостя/401, не дыра.

### Cookie-стратегия

Две httpOnly-cookie на домене Next (бэк их не видит, он на другом origin по Bearer; refresh из cookie извлекает middleware Next и шлёт в тело `/refresh`):

- `token` (access) — короткая (≈TTL access).
- `refresh_token` — длинная (≈30д), `httpOnly`, `secure`(prod), `sameSite=lax`, `path=/`.

`loginAction`/`logoutAction` ([actions.ts](../../../src/features/auth/actions.ts)) работают с обеими.

### Слайс `src/features/sessions/` (новая фича поверх foundation)

Страница настроек «Активные устройства»: список из `GET /api/auth/sessions` (текущее помечено), кнопки «выйти здесь» и «выйти на остальных» → `DELETE /api/auth/sessions/:id` / logout-all. По конвенциям фронта (server component + server actions, RBAC, `revalidateEntity`).

## Отклонённая альтернатива

Refresh как второй JWT (без таблицы): нет ротации, нет индивидуального отзыва (только `tokens_valid_after` = everywhere), нет per-device, нет reuse-detection. Почти не лучше длинного access, но со сложностью refresh-flow. Берём stateful-вариант.

## Безопасность

- В БД только `sha256(refresh)` — утечка дампа ≠ угон сессий.
- Reuse-detection ловит кражу refresh; `tokens_valid_after` ограничивает окно угнанного access ≤15м; absolute-`expires_at` ограничивает жизнь украденной сессии абсолютным дедлайном.
- `sameSite=lax` + server-to-server `/refresh` (из Next, не из браузера) сужают CSRF.
- `/refresh` под per-IP rate-limit (как login).
- `ip`/`user_agent` в `auth_sessions` — по политике приватности (усечение/хэш IP — обсудить отдельно при реализации слайса).

## План внедрения (фазы)

1. **Бэк, схема+сервис:** миграция `006`, repo, генерация/хэш/ротация, reuse-detection (удаление сессии), sweep-горутина. TDD на сервисе.
2. **Бэк, эндпоинты:** `login` (расширить ответ + создать сессию), `refresh`, `logout` (current/all), `GET/DELETE /sessions`. Регенерация OpenAPI → `src/api/schema.ts` (координированно).
3. **Фронт, cookie-слой:** `refresh_token` в [cookie.ts](../../../src/features/auth/cookie.ts), правки `loginAction`/`logoutAction`.
4. **Фронт, middleware (foundation-PR):** `src/middleware.ts` с refresh-on-demand + коалесинг; matcher исключает статику/ассеты.
5. **Фронт, слайс `sessions`:** страница «активные устройства».
6. **Тесты:** unit (ротация/reuse/expiry/banned/per-device), e2e (истечение access → прозрачный refresh → продолжение; reuse → логаут; отзыв устройства → ≤15м гостем).

### Cutover

Старые 24ч-access без refresh после деплоя доживают ≤24ч и не рефрешатся (refresh-cookie нет) → деградируют до перелогина (как после стопгапа). Новые логины сразу получают пару + сессию. Forward-only, без миграции живых сессий.
