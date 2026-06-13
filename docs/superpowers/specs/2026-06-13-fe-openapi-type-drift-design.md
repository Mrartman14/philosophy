# Дизайн: устранение дрейфа FE-типов от OpenAPI (#1–#3)

**Дата:** 2026-06-13
**Ревизия:** 2026-06-13 (после многоагентного ревью — верификаторы прогоняли реальные `go build` / `tsc`; коррекции вшиты ниже)
**Контекст:** фронт `philosophy/` руками дублирует доменные union-типы, которые бэк `philosophy-api` (Go) уже умеет (или почти умеет) генерировать через OpenAPI → `src/api/schema.ts`. Ручные копии разъезжаются с бэком. По `Capability` дрейф уже двунаправленный + 4 «фантомных» capability, которых на бэке нет вовсе.

## Цели

- **Единый источник истины:** доменные union-типы FE — ре-экспорт из сгенерированного `src/api/schema.ts`, а не рукописные литералы.
- **Дрейф ломает сборку, а не прод:** расхождение FE-набора с бэк-набором должно валить `tsc`, а не тихо жить до рантайма.
- **Где бэк не выводит enum — научить swaggo выводить:** именованный Go-тип + const-блок (эталон — уже работающий `rbac.Capability`).
- **Не задеть рантайм-валидацию молча:** Zod-схемы не покрываются ре-экспортом типа — нужен compile-time гард, иначе regen бэка оставит Zod устаревшим.

## Подтверждённые находки (ground truth)

### #1 Capability — дрейф двунаправленный, подтверждён
- `schema.ts:12645` уже содержит `rbac.Capability` (полный enum из бэк-swagger).
- Ручной union `src/utils/permissions.ts:12` расходится:
  - **4 фантома на FE** (на бэке отсутствуют как RBAC-capability): `lecture.update`, `lecture.upload_files`, `transcript.edit`, `admin.access`.
  - **1 пропущенный на FE** (на бэке есть): `banner.view_admin_audience`.
- Бэк строит `me.capabilities` как `rbac.Capabilities(u.Role)` (`internal/user/handler.go:215`) из статичной `roleCapabilities` map — **никакой рантайм-инъекции виртуальных capability нет**. Единственное вхождение строки `lecture.update` на бэке — audit-label в `internal/lecture/service.go:230`, не capability.
- **Следствие — латентный баг:** `canAccessAdmin` (`src/app/admin/layout.tsx:83`) возвращает `can(me, "admin.access")`; раз capability не существует, проверка **всегда `false`** → admin-layout всегда отдаёт `forbidden()`. `proxy.ts:6-9` подтверждает: middleware роль не проверяет, единственный capability-гейт admin-shell — это layout. Док-коммент гейта (стр. 78–80) описывает намерение «active-юзер с любой админ-capability» — `admin.access` был плейсхолдером, который на бэке так и не завели.
- Фантомы `lecture.update` (нав-итем «Лекции», `layout.tsx:23`) и `admin.access` (`:83`) **используются** в коде → ре-экспорт не механический, всплывут ошибки `tsc`, которые надо чинить осознанно. `lecture.upload_files`, `transcript.edit` — мёртвые, исчезают с типом.

### #2 ParentEntityType (annotations) — бэк отдаёт голый string + FE ещё и сужает
- Бэк: `Annotation.ParentEntityType string` (`internal/annotation/model.go:59`); валидные значения — в `ValidParentEntityTypes map[string]bool` (`model.go:12`), **7 значений**: `document, comment, glossary, banner, event, media, canvas`. Это map, не типизированный enum → swaggo выводит `string`. Рядом `LectureScopedEntityTypes` (подмножество из 3: `document, comment, media`).
- **Дрейф уже внутри бэка:** рукописная аннотация path-param `Enums(document,comment,glossary,banner,event,media)` (`internal/annotation/handler.go:154`) — **6 значений, без `canvas`**, тогда как map содержит 7. swag для path/query-param enum НЕ выводит из Go-типа (берёт из ручной `Enums()`), поэтому regen этот источник не починит.
- FE: `type ParentEntityType = "document" | "glossary" | "media" | "comment"` (`src/features/annotations/types.ts:36`) — **4 значения**, т.е. FE-тип не только дублирует, но и осознанно сужает домен под имеющиеся в UI роуты.
- **Полный инвентарь дублей parent-union на FE (≥3 копии — все надо учесть):**
  - `src/features/annotations/types.ts:36` — TS-тип (целевой ре-экспорт).
  - `src/features/annotations/schemas.ts:33` — Zod `ParentEntityTypeSchema`.
  - `src/features/annotations/schemas.ts:110` — Zod внутри `AdminAnnotationFilterSchema` (вторая Zod-копия!).
  - `src/features/annotations/api.ts:118` — инлайн-литерал lecture-scoped (`"document" | "comment" | "media"`).
  - `src/features/annotations/ui/annotation-admin-filter-form.tsx` — инлайн в UI.
  - `Record<ParentEntityType, string>` PER_ENTITY_PATH (`actions.ts:31`, `api.ts:18`) — FE-роутинг, авто-генерацией не покрывается (ключи зависят от типа).
- Аннотации возвращаются в swagger напрямую как `Annotation` (`@Success ... {object} httputil.Response{data=Annotation}`), отдельного response-DTO нет.

### #3 AttachmentEntityType (lectures) — enum УЖЕ есть на request-стороне; нужна симметрия на response
- Бэк: `type EntityType string` + const-блок (`document, media, canvas`) в `internal/attachment/model.go:12-18`.
- **Enum уже сгенерирован, но из другого источника:** `entity_type: "document" | "media" | "canvas"` в `schema.ts:12091` приходит **не** из именованного `attachment.EntityType`, а из тега `validate:"oneof=document media canvas"` на string-поле `CreateAttachmentRequest.EntityType` (`request.go:10` → `swagger.json:11587`). То есть у swag **два** механизма генерации enum (см. «Принцип решения»).
- **Response-сторона без enum:** `AttachmentDTO.EntityType` объявлено как `string` (`request.go:35`), `toDTO` кастит `string(a.EntityType)` (`handler.go:257`) → swag выводит `string` (`swagger.json:11564`).
- FE: `type AttachmentEntityType = "document" | "media" | "canvas"` (`src/features/lectures/types.ts:30`) — совпадает с бэком 1:1, **но фактически не используется как тип**: код опирается на инлайн-литералы (`actions.ts:173,203,306`; `ui/lecture-attachments-manager.tsx:20,71,76`; `api.ts:118`) + Zod `ENTITY_TYPE` (`schemas.ts:40`). Голый 1:1-ре-экспорт без миграции этих инлайнов почти косметика.

### #4 auth error-codes — НЕ дрейф, вне объёма
`AuthError` union (`src/features/auth/actions.ts:19`) — не бэк-тип. FE синтезирует его из HTTP-статусов (401→`invalid_credentials`, 403→`account_blocked`, 409→`username_taken`, 429→`too_many_requests`). В OpenAPI источника нет → ре-экспорт невозможен. **Исключено из этого дизайна.**

## Принцип решения

Источник истины — сгенерированный `src/api/schema.ts`. FE доменные union перестают быть рукописными и становятся ре-экспортом `components["schemas"][...]`. Где бэк ещё не выводит enum — сперва правим Go.

**У swaggo два механизма генерации enum в definition:**
1. **Именованный Go-тип + const-блок**, на который ссылается поле struct → swag пишет `#/definitions/<Type>` с `enum`. Эталон: `rbac.Capability`.
2. **Тег `validate:"oneof=v1 v2 …"` на string-поле** → swag пишет inline-`enum` прямо на поле. Так сейчас получен `CreateAttachmentRequest.entity_type`.

**Важное ограничение:** enum на **path/query-параметрах** swag из Go-типа НЕ выводит — только из рукописной аннотации `@Param … Enums(…)`. Это отдельный, ручной источник истины (и он уже разъехался в `annotation/handler.go:154`). Любая правка definition-типа его не трогает.

**Прецедент и расхождение (portal-web).** Соседний проект `portal-web` (схожий, но не идентичный стек: openapi-typescript 7.x, openapi-fetch 0.17, **Zod v3**) кодифицировал противоположную стратегию — mapper-слой (`DTO_TO_DOMAIN`/`DOMAIN_TO_DTO`), инвариант «entities never import from `src/generated/`». Мотив: у него `DTO ≠ entity` (бэк отдаёт `ENVIRONMENT_DEV`, UI хочет `'dev'`). **philosophy выбирает прямой ре-экспорт сознательно**, и это не нарушение чужой нормы, а следование **своей**: ~18–23 `features/*/types.ts` уже импортируют `@/api/schema` и ре-экспортят `components["schemas"][...]`, паттерн прописан в `src/features/_template/types.ts`, который CLAUDE.md обязывает копировать. Mapper-слоя в philosophy нет; доменные значения совпадают с бэком 1:1 (#1/#3), а сужение #2 решается `Extract`. Переход на `rootTypes`-генерацию (плоские именованные алиасы, как у portal) — крупная foundation-миграция (107 вхождений index-доступа) и вне объёма.

## Объём и разбиение на PR

Разбито по репозиториям и запретным зонам (`src/utils/*`, `src/app/admin/layout.tsx`, `src/api/schema.ts` — foundation/координируемые зоны).

### PR-A — FE-only, foundation-update (0 правок бэка, ландится первым и независимо)

Включает **#1 целиком** и **FE-часть #3** (она не требует бэка — enum `entity_type` уже в `schema.ts` на request-стороне).

**#1 Capability:**
1. `src/utils/permissions.ts:12`: ручной union →
   ```ts
   export type Capability = components["schemas"]["rbac.Capability"];
   ```
   (импорт `components` из `@/api/schema`). Убирает 4 фантома, добавляет `banner.view_admin_audience`.
2. `src/app/admin/layout.tsx` (запретная зона admin shell — часть этого же foundation-PR), чиним всплывшие `tsc`-ошибки:
   - стр. 23: убрать мёртвую ветку `|| can(me, "lecture.update")` (нав-итем «Лекции» остаётся гейтнутым `lecture.create` / `lecture.delete`).
   - стр. 83: переписать `canAccessAdmin` на «любая админ-capability». Реализация: `buildNavItems(me).length > 0`. Это убирает фантом `admin.access` **и** чинит гейт (сейчас он всегда `false`).
   - **status-гейт (suspended/banned) сохраняется неявно**, т.к. `buildNavItems` зовёт `can()`, а `can()` режет не-`active`. Зафиксировать это комментарием, чтобы не потерять при будущем рефакторе.
   - **Защита от связности (см. ревью):** производный гейт делает security-границу побочным эффектом нав-меню. Сегодня эскалации нет (нав-cap ∩ RoleUser = ∅), но `RoleUser` уже имеет `canvas.create`/`form.create`. Добавить: (а) предупреждающий комментарий над `buildNavItems` — «эти capability ОПРЕДЕЛЯЮТ admin-границу; не гейти нав-итемы на user-cap»; (б) unit-инвариант (см. «Тестирование»).
   - **Тестируемость:** `buildNavItems`/`canAccessAdmin` сейчас module-private. Чтобы покрыть тестом — `export` обеих функций из `layout.tsx` (минимальная правка, та же foundation-зона) ИЛИ вынести гейт-логику в отдельный тестируемый модуль и импортировать в layout. Решение зафиксировать в плане; по умолчанию — `export` из layout.
3. `lecture.upload_files`, `transcript.edit` — мёртвые, исчезают вместе с ручным union.

**#3 FE-часть (FE-only):**
4. `src/features/lectures/types.ts:30` →
   ```ts
   export type AttachmentEntityType =
     components["schemas"]["attachment.CreateAttachmentRequest"]["entity_type"];
   ```
   (enum уже сгенерирован из oneof-тега; правок бэка не нужно). После landing PR-B этот ключ можно переориентировать на response-сторону, но это не обязательно — множества тождественны.
5. **Мигрировать инлайн-литералы** `"document" | "media" | "canvas"` на `AttachmentEntityType` (`actions.ts:173,203,306`; `ui/lecture-attachments-manager.tsx:20,71,76`) — иначе ре-экспорт косметичен.
6. Zod `ENTITY_TYPE` (`schemas.ts:40`) — обернуть exhaustiveness-гардом (см. «Рантайм-нюанс»).

### PR-B — backend `philosophy-api` + координированная регенерация FE — #2 + response-симметрия #3

**Backend (Go):**
- **#2 ParentEntityType:**
  - Ввести `type ParentEntityType string` + const-блок (7 значений), заменить `ValidParentEntityTypes map[string]bool` на типизированный набор + метод `IsValid()`. `LectureScopedEntityTypes` остаётся подмножеством-предикатом над теми же константами.
  - Сменить поле `Annotation.ParentEntityType` (`model.go:59`) `string` → `ParentEntityType`. **Это даёт ровно 4 компайл-ошибки + 1 тест** (проверено `go build ./...`), которые чиним точечными `string(...)`-конверсиями (стратегия «минимальная правка», без протаскивания типа сквозь request/repo):
    1. `model.go:85` — getter `GetParentEntityType() string` **обязан вернуть `string`** (кросс-пакетный контракт `perimeter.AnnotationLike`, `perimeter/parent.go:32`): `return string(a.ParentEntityType)`.
    2. `service.go:161` — struct-литерал `ParentEntityType: ParentEntityType(req.ParentEntityType)` (`req.ParentEntityType` из `request.go:6` остаётся `string`).
    3. `service.go:369` — `validateAnchor(ctx, string(a.ParentEntityType), …)` (`validateAnchor`/`ValidateAnchorStructure` принимают `string`).
    4. `service.go:560` — `s.parentCheckers[string(a.ParentEntityType)]` (`parentCheckers` объявлен `map[string]ParentChecker`).
    5. Тест `handler_md_consistency_test.go:74` — привести сравнение к одному типу.
  - **НЕ ломаются** (для справки, чтобы не чинить лишнее): `repo.go` (database/sql покрывает named-string через reflection), `service.go:114` (`req.ParentEntityType` — string), `repo.go:26/249` и `handler.go:181` (независимые string-поля filter/path).
  - **Развилка canvas — решено:** канонический набор = **7** (как в `ValidParentEntityTypes`). Реконсилировать устаревшую `Enums()` в `handler.go:154` под 7 (добавить `canvas`) ИЛИ убрать enum с path-param. FE через `Extract` всё равно сужается до 4, на FE это не влияет.
- **#3 response-симметрия:** `AttachmentDTO.EntityType` (`request.go:35`) `string` → `attachment.EntityType`; убрать каст `string(a.EntityType)` в `toDTO` (`handler.go:257`). Тип + const-блок уже есть → swag выведет enum и на response-стороне.
- **Регенерация бэк-swagger:** `make swagger` (`swag init -g cmd/server/main.go -o docs/swagger`) → обновляет `docs/swagger/swagger.json`. Коммитим сгенерированное; повторный `make swagger` должен давать нулевой дифф. `make check-swagger-labels` зелёная.
- **Чек-лист бэка:** `go build ./...` (явно — ловит 4 каста до regen) + `go test ./...`.

**Frontend (координированный regen — запретная зона `src/api/schema.ts`):**
- **Явный шаг:** `npm run generate:api` (читает `../philosophy-api/docs/swagger/swagger.json`) → перегенерирует `src/api/schema.ts` → **закоммитить `schema.ts` в составе PR-B** (отдельным явным шагом, не «между делом»).
- annotations — **ре-экспорт с сужением** (решение подтверждено): бэк-enum = 7, UI поддерживает 4. Якорим к бэку, но не раздуваем UI-поверхность:
  ```ts
  type BackendParentEntityType = components["schemas"]["<annotation.ParentEntityType>"];
  export type ParentEntityType = Extract<
    BackendParentEntityType,
    "document" | "glossary" | "media" | "comment"
  >;
  ```
  **Механизм защиты от дрейфа (уточнение):** сам `Extract` при удалении/переименовании значения на бэке `tsc` НЕ валит — он молча сожмётся (вплоть до `never`). Ошибку даёт **downstream-потребитель** — `Record<ParentEntityType, string>` PER_ENTITY_PATH (`actions.ts:31`, `api.ts:18`): пропавший ключ → недостающее свойство Record → `tsc` error. Это и есть страховка; формулировку «литерал выпадет из Extract → ошибка tsc» заменить на корректную.

> Точное имя ключа `components["schemas"][...]` для `parent_entity_type` неизвестно до regen (Go-тип `annotation.ParentEntityType` вводит сам PR-B). Зафиксировать на этапе плана по факту сгенерированного `schema.ts` — это корректное отложенное значение, а не пробел.

## Рантайм-нюанс: Zod не покрывается ре-экспортом типа

Ре-экспорт чинит дрейф на уровне TS-типов, но `z.enum([...])` — рантайм-значения, компилятор их с типом не связывает. Нужен **compile-time exhaustiveness-гард**.

**Конкретная форма (компилируется под `noUnusedLocals:true`, ловит ОБА направления дрейфа).** Наивный `const _assert: _A & _B = true;` падает с `TS6133` (проверено на tsc 5.8.3) — не использовать. Идиома `as const satisfies readonly T[]` (уже применяется в репо: `src/features/share-links/types.ts:21,34`) ловит только лишние элементы, но НЕ exhaustiveness (добавление значения на бэке промолчит) — для цели спеки её недостаточно. Двусторонняя проверка без висячего локала — через `Record`:

```ts
// `satisfies Record<ParentEntityType, true>` форсит присутствие КАЖДОГО значения union (exhaustiveness,
// union ⊆ object) И запрещает лишние ключи (object ⊆ union) — обе стороны дрейфа валят tsc.
const PARENT_ENTITY_TYPE_SET = {
  document: true, glossary: true, media: true, comment: true,
} as const satisfies Record<ParentEntityType, true>;

export const PARENT_ENTITY_TYPES = Object.keys(PARENT_ENTITY_TYPE_SET) as ParentEntityType[];
export const ParentEntityTypeSchema = z.enum(
  PARENT_ENTITY_TYPES as [ParentEntityType, ...ParentEntityType[]],
);
```

**Гард применить ко ВСЕМ копиям** (инвентарь выше), а не к одной:
- annotations: `schemas.ts:33` (`ParentEntityTypeSchema`) **и** `schemas.ts:110` (внутри `AdminAnnotationFilterSchema`) — обе строить из одного `PARENT_ENTITY_TYPES`; инлайн в `api.ts:118` и `annotation-admin-filter-form.tsx` заменить на производные от него.
- lectures: `schemas.ts:40` (`ENTITY_TYPE`) — аналогично от `AttachmentEntityType`.

Гард держать **инлайн в `schemas.ts` фичи** (не выносить в `src/utils/*` — запретная зона; и portal-web `zodEnum` тут не подходит: это рантайм-конструктор Zod v3, exhaustiveness не делает).

## Асимметрия read↔write (зафиксировано явно)

Ре-экспорт и типизация definition дают enum **только на теле ответа**. Остаются `string` (это приемлемо, но не «полный фикс»):
- query-фильтр `parent_entity_type` (`annotation/handler.go:55,84,197`) — приходит из `r.URL.Query().Get` (`handler.go:100`), валидируется в рантайме, не типизируется.
- write-путь `POST /api/entities/{type}/{id}/annotations` — `type` из path (`handler.go:181`), остаётся string.
- attachment path-param `entityType` (detach/reorder, `handler.go:86,124`) — остаётся string.

Граница string↔typed на этих местах реальна; конверсии при необходимости — точечные, компиляцию не ломают.

## Тестирование / верификация

- **PR-A:**
  - **Добавить** (не «обновить» — теста нет) тест на `canAccessAdmin`/`buildNavItems`: пускает админа (≥1 админ-cap), режет гостя / обычного active-юзера / suspended. Требует `export` функций из `layout.tsx` (см. PR-A п.2).
  - **Инвариант-тест связности:** «множество capability, проверяемых в `buildNavItems`, не пересекается с набором `RoleUser`» — будущий нав-итем на user-cap (`canvas.create`/`form.create`) завалит тест. (Набор RoleUser зеркалить из бэк-`roleCapabilities` либо документировать как фикстуру.)
  - Гард Zod в lectures `schemas.ts` компилируется (часть `npm run build`).
  - Ссылку на `banner.view_admin_audience` тест искать в `src/features/banners/permissions.test.ts` (не в несуществующем `src/utils/permissions.test.ts`).
  - Зелёные `npm run lint && npm test && npm run build`.
- **PR-B бэк:** `go build ./...` (явно) + `go test ./...` (затронуты `internal/annotation`, `internal/attachment`); `make swagger` без диффа после коммита; `make check-swagger-labels`.
- **PR-B FE:** после regen — тесты гейтов annotations/lectures + сработавшие exhaustiveness-гарды Zod (все копии); `npm run lint && npm test && npm run build`.
- **Анти-дрейф-гард (новое):** добавить проверку «`schema.ts` соответствует свежему `swagger.json`» — лёгкий тест/скрипт (regen в tmp + diff), чтобы будущий дрейф swagger↔schema ловился, а не накапливался. Форму (vitest / npm-script в CI) уточнить в плане.

## Подтверждённые развилки

1. `canAccessAdmin` → `buildNavItems(me).length > 0` + инвариант-тест «нав-cap ∩ RoleUser = ∅» (вместо отдельного allowlist и вместо несуществующего `admin.access`). **Подтверждено.**
2. annotations `ParentEntityType` — сужение через `Extract` (4 UI-значения, якорь к бэку), а не расширение FE до 7. **Подтверждено.**
3. **#3 split:** FE-ре-экспорт `AttachmentEntityType` — в PR-A (FE-only, из request-схемы, 0 правок бэка); бэк-DTO — в PR-B только ради response-симметрии. **Подтверждено.**
4. **canvas** как parent-тип — канонический набор = 7 (как в map), реконсилировать `Enums()` на path-param под него. **Подтверждено.**

## Вне объёма (YAGNI)

- #4 auth error-codes — не дрейф, источника в OpenAPI нет.
- Структурированные error-body на бэке.
- Расширение annotations UI на banner/event/canvas (Extract сознательно держит 4).
- Переход `generate:api` на `rootTypes` (плоские именованные алиасы) — крупная foundation-миграция, отдельно.
- Старые/невалидные значения `parent_entity_type` из БД — **не проблема** (scan в named-string безопасен, рантайм-enforcement enum на чтении нет; отклонено ревью).

## Правила параллельной работы (из CLAUDE.md)

- Никаких `git stash` / `reset` / `checkout .` / `clean` / `git add -A`. Добавлять только свои файлы по имени.
- PR-A и PR-B — в отдельных воркт ри / репозиториях, не перетирать чужие изменения.
