# Дизайн: устранение дрейфа FE-типов от OpenAPI (#1–#3)

**Дата:** 2026-06-13
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
- **Следствие — латентный баг:** `canAccessAdmin` (`src/app/admin/layout.tsx:83`) возвращает `can(me, "admin.access")`; раз capability не существует, проверка **всегда `false`** → admin-layout всегда отдаёт `forbidden()`. Док-коммент гейта (стр. 78–80) описывает намерение «active-юзер с любой админ-capability» — `admin.access` был плейсхолдером, который на бэке так и не завели.
- Фантомы `lecture.update` (нав-итем «Лекции», `layout.tsx:23`) и `admin.access` (`:83`) **используются** в коде → ре-экспорт не механический, всплывут ошибки `tsc`, которые надо чинить осознанно. `lecture.upload_files`, `transcript.edit` — мёртвые, исчезают с типом.

### #2 ParentEntityType (annotations) — бэк отдаёт голый string + FE ещё и сужает
- Бэк: `Annotation.ParentEntityType string` (`internal/annotation/model.go:59`); валидные значения — в `ValidParentEntityTypes map[string]bool` (`model.go:12`), **7 значений**: `document, comment, glossary, banner, event, media, canvas`. Это map, не типизированный enum → swaggo выводит `string`. Рядом `LectureScopedEntityTypes` (подмножество из 3: `document, comment, media`).
- FE: `type ParentEntityType = "document" | "glossary" | "media" | "comment"` (`src/features/annotations/types.ts:36`) — **4 значения**, т.е. FE-тип не только дублирует, но и осознанно сужает домен под имеющиеся в UI роуты. Сопутствующее: Zod `ParentEntityTypeSchema` (`schemas.ts:33`), `Record<ParentEntityType, string>` PER_ENTITY_PATH (`actions.ts:31`, `api.ts:18`) — FE-роутинг, авто-генерацией не покрывается.
- Аннотации возвращаются в swagger напрямую как `Annotation` (`@Success ... {object} httputil.Response{data=Annotation}`), отдельного DTO нет.

### #3 AttachmentEntityType (lectures) — typed на бэке, но DTO кастит в string
- Бэк: нормальный `type EntityType string` + const-блок (`document, media, canvas`) в `internal/attachment/model.go:12-18`. Но `AttachmentDTO.EntityType` объявлено как `string` (`internal/attachment/request.go:35`), и `toDTO` кастит `string(a.EntityType)` (`handler.go:257`) → swag выводит `string`.
- FE: `type AttachmentEntityType = "document" | "media" | "canvas"` (`src/features/lectures/types.ts:30`) — **совпадает с бэком 1:1**. Сопутствующее: Zod `ENTITY_TYPE` (`schemas.ts:40`) + инлайн-повторы литерала (`actions.ts:173,203,306`; `ui/lecture-attachments-manager.tsx:20,71`).

### #4 auth error-codes — НЕ дрейф, вне объёма
`AuthError` union (`src/features/auth/actions.ts:19`) — не бэк-тип. FE синтезирует его из HTTP-статусов (401→`invalid_credentials`, 403→`account_blocked`, 409→`username_taken`, 429→`too_many_requests`). В OpenAPI источника нет → ре-экспорт невозможен. Это легитимный FE-локальный концерн. Выравнивание потребовало бы структурированных error-body на бэке (отдельный большой объём, YAGNI). **Исключено из этого дизайна.**

## Принцип решения

Источник истины — сгенерированный `src/api/schema.ts`. FE доменные union перестают быть рукописными и становятся ре-экспортом `components["schemas"][...]`. Где бэк ещё не выводит enum — сперва правим Go так, чтобы swaggo его вывел. Эталон, который копируем: `rbac.Capability` (`type Capability string` + const-блок, ссылка из struct-поля → swag сам пишет `enum`, без спец-аннотаций).

## Объём и разбиение на PR

Разбито по репозиториям и запретным зонам (`src/utils/*`, `src/app/admin/layout.tsx`, `src/api/schema.ts` — всё это foundation/координируемые зоны).

### PR-A — FE-only, foundation-update — #1 Capability (0 правок бэка, ландится первым и независимо)

1. `src/utils/permissions.ts:12`: ручной union →
   ```ts
   export type Capability = components["schemas"]["rbac.Capability"];
   ```
   (импорт `components` из `@/api/schema`). Убирает 4 фантома, добавляет `banner.view_admin_audience`.
2. `src/app/admin/layout.tsx` (запретная зона admin shell — часть этого же foundation-PR), чиним всплывшие `tsc`-ошибки:
   - стр. 23: убрать мёртвую ветку `|| can(me, "lecture.update")` (нав-итем «Лекции» остаётся гейтнутым `lecture.create` / `lecture.delete`).
   - стр. 83: переписать `canAccessAdmin` на документированное намерение «любая админ-capability». Реализация: `buildNavItems(me).length > 0` (список нав-итемов уже = полный набор админ-возможностей пользователя). Это убирает фантом `admin.access` **и** чинит гейт (сейчас он всегда `false`).
3. `lecture.upload_files`, `transcript.edit` — мёртвые, исчезают вместе с ручным union, отдельных правок не требуют.

### PR-B — backend `philosophy-api` + координированная регенерация FE — #2 + #3

**Backend (Go):**
- **#3 (малый):** `AttachmentDTO.EntityType` (`request.go:35`) `string` → `attachment.EntityType`; убрать каст `string(a.EntityType)` в `toDTO` (`handler.go:257`). Тип + const-блок уже есть → swag выведет enum. Опционально: enum на path-param `entityType` (`@Param ... Enums(...)`).
- **#2 (средний):** ввести `type ParentEntityType string` + const-блок (7 значений), заменить `ValidParentEntityTypes map[string]bool` на типизированный набор + метод `IsValid()` (`LectureScopedEntityTypes` остаётся подмножеством-предикатом над теми же константами). Поле `Annotation.ParentEntityType` (`model.go:59`) `string` → `ParentEntityType`. Аннотации возвращаются как `Annotation` → swag выведет enum на `parent_entity_type`.
- Регенерация бэк-swagger: `make swagger` (`swag init -g cmd/server/main.go -o docs/swagger`) → обновляет `docs/swagger/swagger.json`. Коммитим сгенерированное; `make swagger` повторно должен давать нулевой дифф.

**Frontend (координированный regen — запретная зона `src/api/schema.ts`):**
- `npm run generate:api` (читает `../philosophy-api/docs/swagger/swagger.json`) → перегенерирует `src/api/schema.ts`.
- lectures: `src/features/lectures/types.ts:30` →
  ```ts
  export type AttachmentEntityType = components["schemas"]["attachment.EntityType"];
  ```
  (множества совпадают, 1:1; инлайн-повторы литерала по возможности заменить на этот тип).
- annotations — **ре-экспорт с сужением** (решение подтверждено): бэк-enum = 7, UI поддерживает 4. Якорим к бэку, но не раздуваем UI-поверхность:
  ```ts
  type BackendParentEntityType = components["schemas"]["..."]; // enum из Annotation.parent_entity_type
  export type ParentEntityType = Extract<
    BackendParentEntityType,
    "document" | "glossary" | "media" | "comment"
  >;
  ```
  Переименование/удаление значения на бэке → ошибка `tsc` (т.к. литерал выпадет из `Extract`), но `PER_ENTITY_PATH` Record и пр. не требуют роутов для banner/event/canvas.

> Точное имя ключа `components["schemas"][...]` для `parent_entity_type` определяется после regen (swag именует enum-дефиницию по Go-типу, напр. `annotation.ParentEntityType`). Зафиксировать на этапе плана по факту сгенерированного `schema.ts`.

## Рантайм-нюанс: Zod не покрывается ре-экспортом типа

Ре-экспорт чинит дрейф на уровне TS-типов, но `z.enum([...])` — рантайм-значения, компилятор их с типом не связывает. Чтобы Zod не разъезжался после regen бэка — **compile-time exhaustiveness-гард**: строим enum из `as const`-массива и добавляем двустороннюю type-level проверку «массив ⟺ union», валящую `tsc` при расхождении. Пример паттерна (применить к `ParentEntityTypeSchema` и `ENTITY_TYPE`):

```ts
const PARENT_ENTITY_TYPES = ["document", "glossary", "media", "comment"] as const;

// 1) каждый элемент массива — валидное значение типа
type _A = (typeof PARENT_ENTITY_TYPES)[number] extends ParentEntityType ? true : never;
// 2) каждое значение типа присутствует в массиве (exhaustiveness)
type _B = ParentEntityType extends (typeof PARENT_ENTITY_TYPES)[number] ? true : never;
const _assertParentExhaustive: _A & _B = true;

export const ParentEntityTypeSchema = z.enum(PARENT_ENTITY_TYPES);
```

Без гарда regen бэка молча оставит Zod устаревшим. (Финальную форму гарда — отдельный util или инлайн — уточнить в плане; суть: двусторонняя проверка.)

## Тестирование / верификация

- **PR-A:** обновить/добавить тест на `canAccessAdmin` — теперь реально пускает админа (есть ≥1 админ-capability) и режет гостя/обычного active-юзера/suspended. `permissions.test.ts` уже содержит `banner.view_admin_audience`. Зелёные `npm run lint && npm test && npm run build`.
- **PR-B бэк:** `go test ./...` (затронуты `internal/annotation`, `internal/attachment`); `make swagger` без диффа после коммита сгенерированного; существующая `make check-swagger-labels` зелёная.
- **PR-B FE:** после regen — тесты трёх гейтов (annotations/lectures/permissions) + сработавший exhaustiveness-гард Zod; `npm run lint && npm test && npm run build`.

## Подтверждённые развилки

1. `canAccessAdmin` → `buildNavItems(me).length > 0` (вместо несуществующего `admin.access`). **Подтверждено.** (Альтернатива — завести реальный `admin.access` на бэке — отклонена: лишний backend-объём ради того, что уже выражается «любой админ-capability».)
2. annotations `ParentEntityType` — сужение через `Extract` (4 UI-значения, якорь к бэку), а не расширение FE до 7. **Подтверждено.**

## Вне объёма (YAGNI)

- #4 auth error-codes — не дрейф, источника в OpenAPI нет.
- Структурированные error-body на бэке.
- Расширение annotations UI на banner/event/canvas.

## Правила параллельной работы (из CLAUDE.md)

- Никаких `git stash` / `reset` / `checkout .` / `clean` / `git add -A`. Добавлять только свои файлы по имени.
- PR-A и PR-B — в отдельных воркт ри / репозиториях, не перетирать чужие изменения.
