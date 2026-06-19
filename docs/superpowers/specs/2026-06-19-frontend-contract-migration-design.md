# Дизайн: миграция фронта на новый контракт бэка

**Дата:** 2026-06-19
**Тип:** координированный foundation-update + правки множества фича-слайсов. Затрагивает «запретные зоны» (`src/api/schema.ts` уже регенерирован, `src/utils/*`, `src/api/client.ts`, новый `src/middleware.ts`) — по своей природе это санкционированная coordinated-миграция, а не обычная фича.
**Статус:** дизайн одобрен пользователем 2026-06-19. Готов к написанию плана.

> **Важно:** источник истины — фактический `src/api/schema.ts` (перегенерирован из OpenAPI нового бэка). Спека [2026-06-17-refresh-tokens-design.md](2026-06-17-refresh-tokens-design.md) описывает **устаревшее** состояние бэка (планировала `{token,refresh_token}`, `GET/DELETE /api/auth/sessions`, scope=all) — её детали НЕ применять. Реальный контракт расходится (см. ниже).

## Постановка задачи

Пользователь перегенерировал `src/api/schema.ts` под новый бэк `philosophy-api`. Изменения большие и сквозные: переработка аутентификации (refresh-токены), optimistic locking (ETag/If-Match) на всех мутирующих ручках, изменение структуры `trail` (документы вместо лекций), подписки на изменения сущностей, унификация `Visibility`, новая форма 422, freshness-манифесты для SWR. Нужно привести весь фронт к новому контракту — архитектурно чисто, в стиле проекта.

### Цель

Фронт корректно и чисто работает на новом контракте: логин/сессии не регрессируют, мутации не падают на 428, trail работает с документами, плюс включены выбранные новые возможности.

### Не-цель

OAuth/2FA/сброс пароля; слайс «активные устройства» (эндпоинтов сессий в контракте НЕТ); офлайн-запись (инициатива на паузе — манифесты делаем только read-side).

## Ground truth по контракту (выверено в `schema.ts` и `philosophy-api`)

| Область | Факт |
|---|---|
| Login | `POST /api/auth/login` → `{ data: { access_token, refresh_token, expires_in } }` |
| Refresh | `POST /api/auth/refresh` body `{ refresh_token }` → `{ data: { access_token, refresh_token, expires_in } }`, ротация + reuse-detection |
| Logout | `POST /api/auth/logout` body `{ refresh_token }` → 204 (идемпотентно) |
| Logout-all | `POST /api/auth/logout-all` без тела → 204 (бамп `tokens_valid_after` + отзыв всех сессий) |
| TTL | access **15 мин** (`expires_in`=900), refresh idle/absolute **30 дней**, серверный grace-window **10с** |
| Sessions API | **ОТСУТСТВУЕТ** (`/api/auth/sessions` нет) → слайс устройств невозможен |
| `GET /api/me` | форма не изменилась: `{ id, username, role, status, capabilities }` |
| Optlock | `If-Match` (required) на **10 PUT-ручках**; ETag=`"<version>"` (strong, quoted int) в ответах GET/POST/PUT; 412 `VERSION_MISMATCH`, 428 `IF_MATCH_REQUIRED` |
| Trail | `TrailItem.document_id` (было lecture_id), `SetItemsRequest.document_ids`, `version?: number`; items через `PUT /api/trails/{id}/items` |
| Trail-модель бэка | миграция 016: `trail_items.document_id → documents.id`; бэк валидирует видимость+существование документа |
| Document vs Lecture | разные сущности (не полиморфные); связь lecture↔document — через `attachments` |
| Subscribe | documents + lectures (`POST/DELETE /{entity}/{id}/subscribe` → `notification.Subscription`); trails **не** поддерживают; признака «подписан» в сущностях нет — только `GET /api/me/subscriptions` |
| Visibility | `access.Visibility = "private"|"public"`; `trail./lecture./annotation.Visibility` удалены |
| 422 | `httputil.ValidationErrorResponse { code?, error?, fields?: {[поле]: string} }` (вместо `detail`) |
| Manifests | `GET /api/lectures/{id}/manifest` (`freshness.Manifest`), `GET /api/trails/{id}/manifest` (`freshness.TrailManifest`); `If-None-Match`→304; типы `freshness.SectionVersion`, `freshness.TrailManifestMember`, `composition.NodeRef` |
| Documents browse | `GET /api/documents?q=&offset=&limit=` → `document.DocumentSummary[]` (`filename`, `id`, `visibility`, `version`…); `GET /api/documents/{id}` → `document.Document`; готовый `DocumentPicker` + `searchDocuments` уже есть |

## Решения (зафиксировано 2026-06-19)

| # | Вопрос | Решение |
|---|---|---|
| 1 | Trail builder | **Переделать на документы сейчас** (готовый `DocumentPicker`) |
| 2 | Новые возможности | Включить **все**: подписка на лекции (UI), «выйти со всех устройств», ошибки по полям, офлайн-манифесты (read-side SWR) |
| 3 | Прозрачный refresh | Новый `src/middleware.ts` (Node-runtime), refresh-on-demand; коалесинг — опция (серверный grace страхует) |
| 4 | Манифесты | Изолированная read-side волна, может быть отложена/урезана без блокировки остального |
| 5 | Структура | Foundation-first волнами; параллельные субагенты внутри волны, барьер между волнами |

## Архитектура: foundation-first, волнами

Общая инфра проходит ревью и фиксируется ДО того, как на неё опираются слайсы. Внутри волны слайсы независимы → параллелятся субагентами. Между волнами — барьер. После каждой волны зелёные `pnpm lint && pnpm test && pnpm build`.

### Волна 0 — Foundation (shared)

**0.1 Auth + прозрачный refresh.**
- [src/features/auth/cookie.ts](../../../src/features/auth/cookie.ts): две httpOnly-cookie — `token` (access, `maxAge≈expires_in`) и `refresh_token` (30 д, `httpOnly`, `secure`(prod), `sameSite=lax`, `path=/`). Хелперы set/clear/get для обеих.
- [src/features/auth/actions.ts](../../../src/features/auth/actions.ts): `loginAction` кладёт обе cookie из `{access_token, refresh_token, expires_in}`; `logoutAction` шлёт `POST /api/auth/logout` с телом `{refresh_token}` (из cookie) и чистит обе (best-effort, как сейчас).
- **`src/middleware.ts` (НОВЫЙ):** на запрос — access-cookie есть → пропуск; нет, refresh есть → `POST /api/auth/refresh {refresh_token}` → Set-Cookie ротированной пары → пропуск; 4xx → удалить обе cookie → гость. Matcher исключает статику/ассеты. Server components не умеют Set-Cookie в рендере — поэтому refresh в middleware. Безопасность держит data-layer (`getMe()`→бэк на каждый запрос); обход middleware = «refresh не случился» → гость, не дыра. Коалесинг (module-level `Map<refresh_cookie, Promise>`) — **опциональная** оптимизация v2 (серверный grace 10с уже гасит мультитаб-гонку; прод — один Docker-инстанс).
- [src/utils/me.ts](../../../src/utils/me.ts): форма ответа не меняется; проверить, что чтение токена согласовано с разделением cookie.
- [src/api/client.ts](../../../src/api/client.ts): `Authorization: Bearer {access}` из cookie `token` (как сейчас).

**0.2 Optlock-хелпер.** `src/utils/optlock.ts` (новый): извлечь ETag из `response.headers` (openapi-fetch отдаёт `response`); единый способ прокинуть `If-Match`. Паттерн: GET-фетчер возвращает ETag рядом с данными → страница редактирования отдаёт ETag пропом → скрытое поле формы (по образцу [idempotency-field.tsx](../../../src/components/ui/idempotency-field.tsx)) → action читает и шлёт `If-Match`.

**0.3 Обработка ошибок.** [src/utils/api-error.ts](../../../src/utils/api-error.ts): добавить/проверить `VERSION_MISMATCH`(412), `IF_MATCH_REQUIRED`(428) → брендированный текст «Данные изменились, обновите страницу». Перейти на `ValidationErrorResponse`: убрать чтение `.detail` (если есть), читать `fields`.

**0.4 Ошибки по полям.** Прокинуть `fields` через результат `createFormAction` (`{ success:false, code:"validation", fields }`) и отрисовать под конкретными полями в form-компонентах ([src/utils/*](../../../src/utils/), form-инфра).

**0.5 Унификация Visibility.** `access.Visibility` вместо удалённых `trail./lecture./annotation.Visibility` в `src/features/*/types.ts` и локальных ссылках. Zod-литералы `"private"|"public"` не страдают.

### Волна 1 — Optimistic locking по слайсам

Прокинуть ETag(GET)→If-Match(PUT) на каждой из 10 ручек, обработать 412/428. Слайсы независимы → параллельно.

| Слайс | PUT-ручка(и) с If-Match | GET с ETag |
|---|---|---|
| lectures | `PUT /api/lectures/{id}` | `GET /api/lectures/{id}` |
| trails | `PUT /api/trails/{id}`, `PUT /api/trails/{id}/items` | `GET /api/trails/{id}` |
| documents | `PUT /api/documents/{document_id}/blocks` | `GET /api/documents/{document_id}` |
| comments | `PUT /api/comments/{id}/blocks` | (из листинга/сущности) |
| annotations | `PUT /api/annotations/{id}` | `GET /api/annotations/{id}` |
| canvas | `PUT /api/canvases/{id}` | `GET /api/canvases/{id}` |
| banners | `PUT /api/admin/banners/{id}` | `GET /api/admin/banners/{id}` |
| events | `PUT /api/admin/events/{id}` | `GET /api/admin/events/{id}` |
| glossary | `PUT /api/admin/glossary/{id}/blocks` | `GET /api/glossary/{id}` |

### Волна 2 — Trail-документы + новые возможности

**2.1 Trail → документы.**
- [trail-items-editor.tsx](../../../src/features/trails/ui/trail-items-editor.tsx): `LecturePicker`→`DocumentPicker` (готовый), `addLecture`→`addDocument`, hidden `lecture_ids`→`document_ids`, отображать `filename`.
- [actions.ts](../../../src/features/trails/actions.ts): body `{ document_ids }` (+ If-Match из Волны 1).
- [schemas.ts](../../../src/features/trails/schemas.ts): `LectureIdsJsonSchema`→`DocumentIdsJsonSchema`. [types.ts](../../../src/features/trails/types.ts): `TrailDocumentSummary`. [api.ts](../../../src/features/trails/api.ts): резолв имени элемента через `GET /api/documents/{id}` (`filename`).

**2.2 Подписка на лекции (UI).** В `notifications`: `subscribeLecture/unsubscribeLecture` + `getLectureSubscription` (скан `GET /api/me/subscriptions`, как у документов). Кнопка на странице лекции (паритет с уже работающими документами).

**2.3 «Выйти со всех устройств».** `logoutAllAction` (`POST /api/auth/logout-all`, чистка обеих cookie) + кнопка в UI аккаунта/настроек.

### Волна 3 — Freshness-манифесты / SWR (read-only, отложима)

`GET /api/lectures/{id}/manifest`, `GET /api/trails/{id}/manifest` с `If-None-Match`→304. Типы `freshness.*`, `composition.NodeRef`. **Только read-side**: типизированные фетчеры манифестов + точка интеграции с существующим offline-SWR кешем (`src/app/_offline/`), без офлайн-записи. На старте волны — короткий спайк против текущей offline-инфры; волна может быть отложена/урезана, не блокируя Волны 0–2.

## Модель исполнения и верификация

- Субагенты делают всю реализацию; оркестратор ревьюит выход каждой волны и гоняет гейты.
- Все агенты соблюдают [AGENTS.md](../../../AGENTS.md)/[CLAUDE.md](../../../CLAUDE.md): без деструктивных git-операций, без `git add -A`, добавлять только свои файлы, не перезаписывать чужие изменения.
- Перед закрытием каждой волны: `pnpm lint && pnpm test && pnpm build` зелёные. Тесты по конвенциям [docs/frontend-conventions.md](../../../docs/frontend-conventions.md).
- Каждая волна — отдельный логический PR (foundation отдельно от фич).

## Риски и открытые вопросы

- **Манифесты × пауза офлайна.** Самая нечёткая часть; делаем read-side и держим отложимой. Спайк против `src/app/_offline/` на старте Волны 3.
- **Коалесинг refresh.** В v1 не делаем (серверный grace страхует); если появится мультитаб-флап — добавить module-level `Map`.
- **Импорт `DocumentPicker`.** Лежит в `src/components/ast-editor/pickers/` (shared), не cross-feature — импорт из trail-слайса допустим; подтвердить ESLint-гардами при реализации.
- **ETag в листингах** (comments): ETag приходит на single-GET; для inline-редактирования из списков убедиться, что версия/ETag доступны на сущности (`version`) — иначе пред-GET перед PUT.
