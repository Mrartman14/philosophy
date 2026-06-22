# Schema-sync hardening + usage-tracking — design

Дата: 2026-06-20
Статус: одобрено (брейншторм), готов к плану

## Контекст

Перегенерён `src/api/schema.ts` из обновлённого бэкенд-контракта (`pnpm generate:api`).
Дифф (+309/−55) принёс: ужесточение типов (optional → required, инлайн-енумы),
новые ответы ошибок (`400`/`413`), новые ручки (`GET/PUT /api/me/tokens/usage-tracking`),
новые поля (`pat.Token.last_used_at`/`request_count`), типизированное тело
`PATCH /api/me/preferences`, `ETag` на `412`, single-GET комментария, новый
audit-target `map`, удаление `503 MAP_NOT_READY` с двух ручек.

Цель — «подтянуть» фронт под новый контракт: устрожить типы, поддержать новые
ошибки, интегрировать новые ручки/поля. Это hardening + одна небольшая фича
(usage-tracking), НЕ рефакторинг ядра обработки ошибок — оно уже крепкое
(`rethrowApiError` мапит `apperror.Code` → ключ каталога `errors`).

## Объём

Три независимых «ведра» + явный список вне-объёма.

### Ведро 1 — Устрожение типов

Снять обходные касты, появившиеся из-за раньше-нетипизированных тел/полей,
и починить фоллаут `pnpm typecheck` (3 файла; см. «Диагностика» ниже).

1. **`PATCH /api/me/preferences` — убрать `as never` (3 места).** Тело теперь
   типизировано схемой как `preference.UpdatePreferencesRequest`
   (`{ appearance?: AppearancePatch, locale?: "system"|"ru"|"en",
   reading_mode?: "full"|"focused" }`).
   - `src/features/preferences/actions.ts` (`reading_mode`)
   - `src/components/appearance/persist-appearance.ts` (`appearance` →
     `preference.AppearancePatch`; `contrast:"auto"` по-прежнему отбрасывается —
     в `AppearancePatch.contrast` только `normal|high`)
   - `src/i18n/persist-locale.ts` (`locale`)
   Под `exactOptionalPropertyTypes: true` — спред-исключение undefined-ключей.

2. **`src/api/enums.ts` — `AUDIT_TARGET_TYPES += "map"`.** `audit.TargetType`
   получил `"map"`; `enumValues<S["audit.TargetType"]>()` требует все члены союза.
   Добавить `"map"` алфавитно (между `lecture` и `media`). Добавить i18n-лейбл
   target-type `map` там, где рендерятся лейблы (найти потребителя
   `AUDIT_TARGET_TYPES`).

3. **`src/features/forms/actions.ts` — типизировать `buildFieldsBody`.**
   `CreateFormRequest` ужесточил `fields`/`submission_mode`/`visibility`/`title`
   до required. Текущий `buildFieldsBody(...) as never` + условный спред
   `submission_mode`/`visibility` (делавший их optional) больше не проходят.
   - Типизировать `buildFieldsBody` под `components["schemas"]["form.CreateFieldRequest"][]`
     (поле `type` — инлайн-енум, не `string`); убрать `as never`.
   - `submission_mode`/`visibility` гарантированы `superRefine` —
     присваивать прямо (через сужение типа парс-результата или non-null),
     без условного спреда.
   - Проверить, что `updateForm` (PATCH) тоже выигрывает / не ломается
     (там поля остались optional).

4. **`src/features/audit/api.ts` — выровнять `target_type` фильтра.** Дрейф
   контракта бэка: общий `audit.TargetType` получил `map`, а query-параметр
   `target_type` у `GET /api/admin/audit` — нет. FE-решение: тип query-фильтра
   вывести из самого эндпоинта (`paths[...]["get"]["parameters"]["query"]` —
   источник истины «по чему можно фильтровать»), а `map` оставить в лейблах для
   рендера записей. **Бэк-аск:** выровнять enum query-параметра `target_type`
   у `GET /api/admin/audit` с `audit.TargetType` (добавить `map`), если карты
   должны быть фильтруемы.

**Критерий готовности ведра:** `pnpm typecheck` оставляет ТОЛЬКО пре-существующие
ошибки `src/components/ast-merge/*` (17 шт.) — это параллельная инициатива
conflict-merge (`word-diff.ts` падает на `noUncheckedIndexedAccess`, не на схеме).
Не моё, не трогать (правило параллельной работы агентов из AGENTS.md).

### Ведро 2 — Новые типы ошибок

5. **`src/utils/api-error.ts` — `DEFAULT_MESSAGES += REQUEST_BODY_TOO_LARGE,
   PAYLOAD_TOO_LARGE`.** Бэк добавил `413` на множество ручек (создание
   комментария, поиск, контекст и др.); сейчас они падают в generic-фоллбек
   (`serverError`/текст бэка). Добавить общие ключи каталога `errors`
   (`ru/errors.ts` + `en/errors.ts`) — дружелюбное «Запрос слишком большой».
   canvas/annotations сохраняют свои entity-специфичные `overrides`
   (`CANVAS_PAYLOAD_TOO_LARGE`, `ANNOTATION_REQUEST_BODY_TOO_LARGE`) — они
   приоритетнее дефолта, ничего не ломается.

6. **MAP_NOT_READY (низкий приоритет).** Бэк убрал `503 MAP_NOT_READY` с двух
   ручек semantic-map. Проверить, есть ли в `src/features/semantic-map/`
   реальная обработка `503`/`MAP_NOT_READY` (grep нашёл только комментарий на
   `api.ts:9`); если код мёртв — убрать, иначе оставить как защитный
   (код `MAP_NOT_READY` всё ещё в `apperror.Code`).

### Ведро 3 — usage-tracking (полная фича)

Новая UX-поверхность на `/me/tokens`. Слайс `src/features/tokens/` уже есть
(list/create/revoke) — расширяем по его же конвенциям.

7. **`src/features/tokens/api.ts` — `getUsageTracking()`** —
   `GET /api/me/tokens/usage-tracking` → `pat.UsageTracking { tracking_enabled }`,
   server-only, `cache`.

8. **`src/features/tokens/actions.ts` — `setUsageTracking(enabled)`** —
   `PUT /api/me/tokens/usage-tracking` (тело `pat.setUsageTrackingRequest
   { enabled }`) + `revalidateEntity(Tags.TOKENS)`. Гейт — `canManageTokens`.

9. **`src/features/tokens/ui/usage-tracking-toggle.tsx`** — client-компонент,
   переключатель состояния. При **выключении** — confirm (реюз паттерна
   подтверждения из revoke-токена): «Выключить трекинг? Все накопленные счётчики
   использования удалятся безвозвратно.» При включении — без подтверждения.

10. **`src/features/tokens/ui/token-list.tsx`** — добавить колонки
    `last_used_at` (Unix sec → форматированная дата) и `request_count`. При `nil`
    (трекинг выключен или ещё нет обращений) — «—».

11. **i18n** — namespace-ключи `tokens.usageTracking.*` (заголовок секции,
    лейбл тогла, текст confirm, заголовки колонок «Последнее использование» /
    «Запросов»). Права — реюз `canManageTokens` (любой active user).

### Вне объёма (зафиксировано явно)

- **conflict-merge комментария** (подключение single-GET `/api/comments/{id}` +
  `ETag` на `412` + merge-UI) → существующая активная инициатива
  `docs/superpowers/specs/2026-06-20-ast-conflict-merge-design.md` (волна 1 —
  документы; комментарии — её волна 2). Single-GET в схеме уже есть, но
  подключение — её зона.
- **`sitemap.xml`** — бэкендный, FE-кода нет (изменилась только семантика
  описания: фронт-страницы вместо .md-списков, документы не перечисляются).
- **Ядро обработки ошибок** — не трогаем, только расширяем `DEFAULT_MESSAGES`.

## Диагностика фоллаута (зафиксирована до старта)

`pnpm typecheck` против перегенерённой схемы — 20 ошибок, из них:
- 17 — `src/components/ast-merge/*` (чужая инициатива, пре-существующие, вне-объём).
- 3 — мой фоллаут: `src/api/enums.ts:96`, `src/features/audit/api.ts:64`,
  `src/features/forms/actions.ts:77`.

## Тестирование и гейты

- **Unit (vitest):** маппинг `413 → REQUEST_BODY_TOO_LARGE` в `api-error`;
  `setUsageTracking` action (PUT + revalidate); типизация `buildFieldsBody`
  проверяется компиляцией.
- **Гейты PR:** `pnpm lint && pnpm test` зелёные.
- **Ограничение:** полный `pnpm typecheck`/`pnpm build` останутся красными, пока
  параллельный агент не починит `ast-merge/*`. Это не наш код; свою часть
  верифицируем typecheck-дельтой (после фиксов остаётся только `ast-merge/*`) +
  lint + test. Зафиксировать это в отчёте о готовности, не выдавать за «build
  зелёный».

## Бэк-аски (выдать пользователю по завершении)

1. Выровнять enum query-параметра `target_type` у `GET /api/admin/audit`
   с `audit.TargetType` (добавить `map`), если карты должны быть фильтруемы
   в админ-аудите.

## Принципы изоляции

- Каждое ведро независимо, может реализовываться/ревьюиться отдельно.
- Ведро 3 — единственная новая UX-поверхность; остальное — точечное устрожение
  по существующим паттернам слайсов (см. `src/features/_template/`,
  `docs/frontend-conventions.md`).
- Запретные зоны не трогаем: `schema.ts` уже перегенерён пользователем;
  `api-error.ts`/`enums.ts` — общая инфраструктура, правки точечные и
  координированные (входят в этот же PR как foundation-update).
