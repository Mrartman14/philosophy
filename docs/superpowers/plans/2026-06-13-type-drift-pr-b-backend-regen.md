# Type-Drift PR-B (backend + regen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Научить swaggo выводить enum для `annotation.parent_entity_type` (#2) и для response-`attachment.AttachmentDTO.entity_type` (#3), регенерировать OpenAPI → `schema.ts`, и заменить рукописный FE-union `ParentEntityType` на ре-экспорт-с-сужением.

**Architecture:** Кросс-репозиторный PR. На бэке (`philosophy-api`, Go + swaggo) вводим именованный `type ParentEntityType string` с const-блоком (источник истины enum), типизируем поле `Annotation.ParentEntityType` (4 точечных `string()`-каста по границам) и поле `AttachmentDTO.EntityType`. `make swagger` → `swagger.json`, `npm run generate:api` → `schema.ts`. На фронте `annotations.ParentEntityType` = `Extract<сгенерированный enum, 4 UI-значения>`, Zod-копии и client-массив строятся из одного guarded-набора.

**Tech Stack:** Go + swaggo (`swag init`), Swagger 2.0 (`definitions`), swagger2openapi + openapi-typescript, TypeScript (strict, `noUnusedLocals:true`), Zod v4, Vitest. Спека: `docs/superpowers/specs/2026-06-13-fe-openapi-type-drift-design.md`.

**Зоны/правила/последовательность:**
- **PR-A должен быть смержен раньше** (или хотя бы не конфликтовать) — он FE-only и независим. PR-B трогает запретную зону `src/api/schema.ts` (координированный regen).
- Бэк-правки — в репозитории `/Users/alexander.borisenko/Documents/philosophy-api` (отдельный git). FE-правки — в `philosophy`.
- Никаких `git add -A`. Добавлять только перечисленные файлы по имени, в своём репозитории.
- swaggo выводит definition-enum из const-блока именованного типа (эталон: `rbac.Capability`). **path/query-param enum НЕ выводится из Go-типа** — он живёт в рукописной `@Param … Enums(...)` и синхронизируется руками.

---

## File Structure

**Backend (`philosophy-api`):**
- Modify: `internal/annotation/model.go:11-20,59,85` — ввести `ParentEntityType` + const-блок, derive `ValidParentEntityTypes`, типизировать поле + getter-каст.
- Modify: `internal/annotation/service.go:161,369,560` — три `string()`/конструктор-каста.
- Modify: `internal/annotation/handler.go:154` — реконсилировать `Enums()` (добавить canvas).
- Modify: `internal/annotation/handler_md_consistency_test.go:74` — `string()`-каст в сравнении.
- Modify: `internal/attachment/request.go:35` — `EntityType string` → `EntityType EntityType`.
- Modify: `internal/attachment/handler.go:257` — убрать каст `string(a.EntityType)`.
- Regenerate: `docs/swagger/swagger.json` (через `make swagger`).

**Frontend (`philosophy`):**
- Regenerate: `src/api/schema.ts` (через `npm run generate:api`).
- Modify: `src/features/annotations/types.ts:32-36` — `Extract`-ре-экспорт + guarded `PARENT_ENTITY_TYPES`.
- Modify: `src/features/annotations/schemas.ts:33-38,108-112` — обе `z.enum` из `PARENT_ENTITY_TYPES`.
- Modify: `src/features/annotations/ui/annotation-admin-filter-form.tsx:5` — `PARENT_TYPES` из общего набора.
- (Опц.) Modify: `src/features/lectures/types.ts` — переориентировать `AttachmentEntityType` на response-ключ.

---

## Группа 1 — Backend #2: `ParentEntityType`

### Task 1: Ввести именованный тип + const-блок, типизировать поле модели

**Files:**
- Modify: `philosophy-api/internal/annotation/model.go`

- [ ] **Step 1: Заменить объявление `ValidParentEntityTypes` на тип + const + derive**

В `internal/annotation/model.go` заменить строки 11-20 (блок `// ValidParentEntityTypes …` + var-литерал) на:

```go
// ParentEntityType is the kind of entity an annotation can be attached to.
// The const block below is the SINGLE source of truth: swaggo derives the
// OpenAPI enum from it, ValidParentEntityTypes is built from it, and the FE
// re-exports the generated enum.
//
// NOTE: path/query-param `Enums(...)` annotations in handler.go are NOT
// derived from this type — keep them in sync by hand (see Task 2).
type ParentEntityType string

const (
	ParentDocument ParentEntityType = "document"
	ParentComment  ParentEntityType = "comment"
	ParentGlossary ParentEntityType = "glossary"
	ParentBanner   ParentEntityType = "banner"
	ParentEvent    ParentEntityType = "event"
	ParentMedia    ParentEntityType = "media"
	ParentCanvas   ParentEntityType = "canvas"
)

// allParentEntityTypes drives ValidParentEntityTypes — one entry per constant.
var allParentEntityTypes = []ParentEntityType{
	ParentDocument, ParentComment, ParentGlossary,
	ParentBanner, ParentEvent, ParentMedia, ParentCanvas,
}

// ValidParentEntityTypes is the set of entity types that can be annotated,
// built from allParentEntityTypes (single source of truth).
var ValidParentEntityTypes = func() map[string]bool {
	m := make(map[string]bool, len(allParentEntityTypes))
	for _, t := range allParentEntityTypes {
		m[string(t)] = true
	}
	return m
}()
```

> `LectureScopedEntityTypes` (строки 24-28) НЕ трогаем — это осознанное string-подмножество.

- [ ] **Step 2: Типизировать поле `Annotation.ParentEntityType`**

В `internal/annotation/model.go:59` заменить:

```go
	ParentEntityType string                       `json:"parent_entity_type"`
```

на:

```go
	ParentEntityType ParentEntityType             `json:"parent_entity_type"`
```

- [ ] **Step 3: Каст в getter (обязан вернуть `string` ради `perimeter.AnnotationLike`)**

В `internal/annotation/model.go:85` заменить:

```go
func (a *Annotation) GetParentEntityType() string { return a.ParentEntityType }
```

на:

```go
func (a *Annotation) GetParentEntityType() string { return string(a.ParentEntityType) }
```

- [ ] **Step 4: Прогнать `go build` — увидеть оставшиеся 3 ошибки в service.go**

Run: `cd /Users/alexander.borisenko/Documents/philosophy-api && go build ./...`
Expected: FAIL — три ошибки в `internal/annotation/service.go` (строки 161, 369, 560): несоответствие `ParentEntityType` ↔ `string`. (Чиним в Task 2.)

### Task 2: Починить call-sites + реконсилировать path-param Enums

**Files:**
- Modify: `philosophy-api/internal/annotation/service.go:161,369,560`
- Modify: `philosophy-api/internal/annotation/handler.go:154`

- [ ] **Step 1: service.go:161 — конструктор-каст при сборке `Annotation`**

Заменить (внутри литерала `a := &Annotation{...}`):

```go
		ParentEntityType: req.ParentEntityType,
```

на:

```go
		ParentEntityType: ParentEntityType(req.ParentEntityType),
```

> `req.ParentEntityType` (CreateRequest, request.go:6) остаётся `string` — его не типизируем (граница приходит из path-param).

- [ ] **Step 2: service.go:369 — каст при передаче в `validateAnchor(…string…)`**

Заменить:

```go
	if err := s.validateAnchor(ctx, a.ParentEntityType, req.Anchor); err != nil {
```

на:

```go
	if err := s.validateAnchor(ctx, string(a.ParentEntityType), req.Anchor); err != nil {
```

> Прим.: строка 148 (`s.validateAnchor(ctx, req.ParentEntityType, …)`) НЕ трогается — `req.ParentEntityType` это string.

- [ ] **Step 3: service.go:560 — каст при индексации `map[string]ParentChecker`**

Заменить:

```go
		checker, ok := s.parentCheckers[a.ParentEntityType]
```

на:

```go
		checker, ok := s.parentCheckers[string(a.ParentEntityType)]
```

> Прим.: строка 114 (`s.parentCheckers[req.ParentEntityType]`) НЕ трогается — `req.ParentEntityType` это string.

- [ ] **Step 4: handler.go:154 — добавить `canvas` в рукописную `Enums()`**

Заменить:

```go
// @Param       type path     string         true  "Тип родительской сущности" Enums(document,comment,glossary,banner,event,media)
```

на:

```go
// @Param       type path     string         true  "Тип родительской сущности" Enums(document,comment,glossary,banner,event,media,canvas)
```

- [ ] **Step 5: `go build` — зелёный**

Run: `cd /Users/alexander.borisenko/Documents/philosophy-api && go build ./...`
Expected: PASS.

### Task 3: Починить тест + прогнать backend-тесты #2

**Files:**
- Modify: `philosophy-api/internal/annotation/handler_md_consistency_test.go:74`

- [ ] **Step 1: Каст в сравнении frontmatter ↔ типизированное поле**

В `internal/annotation/handler_md_consistency_test.go:74` заменить:

```go
	if fm["parent_entity_type"] != wrap.Data.ParentEntityType {
		t.Fatalf("parent_entity_type mismatch: md=%q json=%q", fm["parent_entity_type"], wrap.Data.ParentEntityType)
```

на:

```go
	if fm["parent_entity_type"] != string(wrap.Data.ParentEntityType) {
		t.Fatalf("parent_entity_type mismatch: md=%q json=%q", fm["parent_entity_type"], string(wrap.Data.ParentEntityType))
```

> `string(...)` безопасен в любом случае (на string — no-op). Строка 71 (`wrap.Data.ParentEntityType == ""`) не трогается — сравнение с untyped-константой компилируется.

- [ ] **Step 2: Прогнать тесты annotation + model_test**

Run: `cd /Users/alexander.borisenko/Documents/philosophy-api && go test ./internal/annotation/...`
Expected: PASS. (`model_test.go:10,13` использует `ValidParentEntityTypes["canvas"]` / `LectureScopedEntityTypes["canvas"]` — maps остались string-keyed, не ломается.)

- [ ] **Step 3: Коммит (бэк #2)**

```bash
cd /Users/alexander.borisenko/Documents/philosophy-api
git add internal/annotation/model.go internal/annotation/service.go internal/annotation/handler.go internal/annotation/handler_md_consistency_test.go
git commit -m "feat(annotation): typed ParentEntityType for OpenAPI enum

- именованный тип + const-блок (источник истины), swaggo выведет enum
- ValidParentEntityTypes derive из констант (single source)
- path-param Enums() реконсилирован (+canvas)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Группа 2 — Backend #3: response-симметрия attachment

### Task 4: Типизировать `AttachmentDTO.EntityType`

**Files:**
- Modify: `philosophy-api/internal/attachment/request.go:35`
- Modify: `philosophy-api/internal/attachment/handler.go:257`

- [ ] **Step 1: Типизировать поле DTO**

В `internal/attachment/request.go:35` заменить:

```go
	EntityType    string `json:"entity_type"`
```

на:

```go
	EntityType    EntityType `json:"entity_type"`
```

> `EntityType` (тип + const-блок document/media/canvas) уже объявлен в `internal/attachment/model.go:12-18`, тот же пакет.

- [ ] **Step 2: Убрать ненужный каст в `toDTO`**

В `internal/attachment/handler.go:257` заменить:

```go
		EntityType:    string(a.EntityType),
```

на:

```go
		EntityType:    a.EntityType,
```

- [ ] **Step 3: `go build` + тесты attachment**

Run: `cd /Users/alexander.borisenko/Documents/philosophy-api && go build ./... && go test ./internal/attachment/...`
Expected: PASS.

- [ ] **Step 4: Коммит (бэк #3)**

```bash
cd /Users/alexander.borisenko/Documents/philosophy-api
git add internal/attachment/request.go internal/attachment/handler.go
git commit -m "feat(attachment): typed AttachmentDTO.EntityType for response-side enum

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Группа 3 — Регенерация OpenAPI

### Task 5: `make swagger` + проверка enum в swagger.json

**Files:**
- Regenerate: `philosophy-api/docs/swagger/swagger.json`

- [ ] **Step 1: Регенерировать swagger**

Run: `cd /Users/alexander.borisenko/Documents/philosophy-api && make swagger`
Expected: команда отрабатывает без ошибок (`swag init -g cmd/server/main.go -o docs/swagger`).

- [ ] **Step 2: Проверить, что enum появился (#2 и #3)**

Run:
```bash
cd /Users/alexander.borisenko/Documents/philosophy-api
python3 -c "import json;d=json.load(open('docs/swagger/swagger.json'));defs=d['definitions'];print('parent enum:', defs.get('annotation.ParentEntityType',{}).get('enum'));print('attach DTO entity_type:', defs['attachment.AttachmentDTO']['properties']['entity_type'])"
```
Expected:
- `parent enum: ['document', 'comment', 'glossary', 'banner', 'event', 'media', 'canvas']` (7 значений; точное имя ключа definition ожидается `annotation.ParentEntityType` — если вдруг иначе, найти: `grep -o '"annotation\.[A-Za-z]*"' docs/swagger/swagger.json | sort -u`).
- `attach DTO entity_type:` содержит `'enum': ['document', 'media', 'canvas']` (а не голый `{'type':'string'}`).

> Если definition для `Annotation.parent_entity_type` сослался не на отдельный `annotation.ParentEntityType`, а на inline-enum поля — это тоже приемлемо; ключ для FE определяем в Task 7 Step 1 по факту.

- [ ] **Step 3: Идемпотентность + лейблы**

Run: `cd /Users/alexander.borisenko/Documents/philosophy-api && make swagger && git diff --stat docs/swagger/swagger.json && make check-swagger-labels`
Expected: повторный `make swagger` не меняет файл сверх первого прогона; `check-swagger-labels` зелёный.

- [ ] **Step 4: Коммит сгенерированного swagger**

```bash
cd /Users/alexander.borisenko/Documents/philosophy-api
git add docs/swagger/swagger.json
git commit -m "chore(swagger): regenerate — parent_entity_type & attachment entity_type enums

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 6: `npm run generate:api` + проверка ключей в schema.ts

**Files:**
- Regenerate: `philosophy/src/api/schema.ts` (запретная зона — координированно)

- [ ] **Step 1: Регенерировать schema.ts**

Run: `cd /Users/alexander.borisenko/Documents/philosophy && npm run generate:api`
Expected: команда отрабатывает (`swagger2openapi … && openapi-typescript … -o src/api/schema.ts`).

- [ ] **Step 2: Зафиксировать точный ключ enum parent-типа**

Run:
```bash
cd /Users/alexander.borisenko/Documents/philosophy
grep -n 'annotation.ParentEntityType\|"document" | "comment" | "glossary" | "banner" | "event" | "media" | "canvas"' src/api/schema.ts
grep -n 'attachment.AttachmentDTO' src/api/schema.ts
```
Expected: найден ключ enum с 7 значениями (запомнить точное имя `components["schemas"]["<KEY>"]` — используется в Task 7) и enum-`entity_type` внутри `attachment.AttachmentDTO`.

- [ ] **Step 3: Прогнать tsc — поймать места, где сузившийся/расширившийся тип ломает FE**

Run: `cd /Users/alexander.borisenko/Documents/philosophy && npx tsc --noEmit`
Expected: на этом шаге возможны ошибки в annotations (рукописный `ParentEntityType` ещё не привязан к новому enum, но значения те же 4 → скорее всего PASS). Если PASS — хорошо; ошибки (если есть) устраняются в Task 7. **Коммит schema.ts — вместе с FE-правками Task 7** (один логический regen-commit), чтобы в истории не было промежуточного «schema.ts обновлён, FE не подогнан».

---

## Группа 4 — FE: ре-экспорт `ParentEntityType` (#2)

### Task 7: Extract-ре-экспорт + единый guarded-набор

**Files:**
- Modify: `src/features/annotations/types.ts:32-36`
- Modify: `src/features/annotations/schemas.ts:1-3,33-38,108-112`
- Modify: `src/features/annotations/ui/annotation-admin-filter-form.tsx:5`

- [ ] **Step 1: types.ts — Extract-ре-экспорт + guarded `PARENT_ENTITY_TYPES`**

В `src/features/annotations/types.ts` заменить строки 32-36 (docstring + `export type ParentEntityType = …`) на (подставив `<KEY>` из Task 6 Step 2 — ожидаемо `"annotation.ParentEntityType"`):

```ts
/**
 * Полный домен parent-типов с бэка (сгенерированный enum). Источник истины.
 */
type BackendParentEntityType =
  components["schemas"]["annotation.ParentEntityType"];

/**
 * Подмножество parent-типов, для которых строим UI создания/просмотра.
 * Бек поддерживает также banner/event/canvas, UI для них не делаем (§4).
 * `Extract` якорит к бэку: если бэк удалит/переименует одно из 4 значений,
 * downstream-потребители (PER_ENTITY_PATH Record ниже по слайсу) → ошибка tsc.
 */
export type ParentEntityType = Extract<
  BackendParentEntityType,
  "document" | "glossary" | "media" | "comment"
>;

/**
 * Рантайм-набор UI parent-типов + двусторонний drift-гард (по образцу
 * share-links/types.ts). `satisfies Record<ParentEntityType, true>` валит tsc,
 * если набор разойдётся с типом в любую сторону. Из него строятся Zod-схемы и
 * options селекта — единственная рантайм-копия значений в слайсе.
 */
const PARENT_ENTITY_TYPE_SET = {
  document: true,
  glossary: true,
  media: true,
  comment: true,
} as const satisfies Record<ParentEntityType, true>;

export const PARENT_ENTITY_TYPES = Object.keys(
  PARENT_ENTITY_TYPE_SET,
) as ParentEntityType[];
```

> `import type { components } from "@/api/schema";` уже есть (стр. 2). Файл — не `server-only`, его рантайм-экспорт `PARENT_ENTITY_TYPES` безопасно импортируется и server-, и client-кодом (как `SHARE_RESOURCE_TYPES` в share-links).

- [ ] **Step 2: schemas.ts — обе `z.enum` из общего набора**

В `src/features/annotations/schemas.ts`:
1. После `import { z } from "zod";` (стр. 3) добавить:

```ts
import { PARENT_ENTITY_TYPES } from "./types";
import type { ParentEntityType } from "./types";
```

2. Заменить блок строк 32-38 (`/** … §4 */` + `const ParentEntityTypeSchema = z.enum([...]);`) на:

```ts
/** Подмножество parent-типов с UI (banner/event/canvas не покрываем — §4). */
const ParentEntityTypeSchema = z.enum(
  PARENT_ENTITY_TYPES as [ParentEntityType, ...ParentEntityType[]],
);
```

3. Заменить вложенный `z.enum` в `AdminAnnotationFilterSchema` (строки 109-112):

```ts
  parent_entity_type: z
    .enum(["document", "glossary", "media", "comment"])
    .optional()
    .catch(undefined),
```

на:

```ts
  parent_entity_type: z
    .enum(PARENT_ENTITY_TYPES as [ParentEntityType, ...ParentEntityType[]])
    .optional()
    .catch(undefined),
```

- [ ] **Step 3: filter-form — options из общего набора**

В `src/features/annotations/ui/annotation-admin-filter-form.tsx:5` заменить:

```ts
const PARENT_TYPES = ["document", "glossary", "media", "comment"] as const;
```

на:

```ts
import { PARENT_ENTITY_TYPES as PARENT_TYPES } from "../types";
```

(удалив локальный `const`; импорт добавить к шапке файла после строки 3). Остальной код формы (`PARENT_TYPES.map(...)`) работает без изменений — массив тех же значений.

- [ ] **Step 4: tsc — зелёный + проверка, что гард ловит дрейф**

Run: `cd /Users/alexander.borisenko/Documents/philosophy && npx tsc --noEmit`
Expected: PASS.

Проверка гарда: временно убрать `comment: true,` из `PARENT_ENTITY_TYPE_SET` (types.ts) → `npx tsc --noEmit` → FAIL (`Property 'comment' is missing … Record<ParentEntityType, true>`). Вернуть обратно → PASS.

- [ ] **Step 5: Прогнать тесты annotations**

Run: `cd /Users/alexander.borisenko/Documents/philosophy && npx vitest run src/features/annotations`
Expected: PASS (значения те же 4 — поведение схем не изменилось).

- [ ] **Step 6: Коммит regen + FE (#2) одним логическим коммитом**

```bash
cd /Users/alexander.borisenko/Documents/philosophy
git add src/api/schema.ts src/features/annotations/types.ts src/features/annotations/schemas.ts src/features/annotations/ui/annotation-admin-filter-form.tsx
git commit -m "feat(annotations): ParentEntityType = re-export+Extract from generated enum

- regen schema.ts (parent_entity_type теперь enum)
- ParentEntityType якорится к бэку через Extract (4 UI-значения)
- единый guarded PARENT_ENTITY_TYPES → обе Zod-схемы + options селекта

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Группа 5 — Опциональные доводки

### Task 8 (опц.): Переориентировать `AttachmentEntityType` на response-ключ

После PR-B enum есть и на `attachment.AttachmentDTO.entity_type`. Можно переключить FE-ре-экспорт с request- на response-ключ (косметика — множества тождественны).

**Files:**
- Modify: `src/features/lectures/types.ts`

- [ ] **Step 1: Переключить ключ (если ровнее по семантике)**

В `src/features/lectures/types.ts` `AttachmentEntityType` сейчас (после PR-A) ссылается на `…["attachment.CreateAttachmentRequest"]["entity_type"]`. При желании заменить на `components["schemas"]["attachment.EntityType"]` — **только если** Task 6 Step 2 подтвердил такой ключ в schema.ts (swag мог сослаться на отдельную definition `attachment.EntityType`). Если такого ключа нет — оставить как есть.

- [ ] **Step 2: tsc + commit (если меняли)**

Run: `cd /Users/alexander.borisenko/Documents/philosophy && npx tsc --noEmit`
Expected: PASS. Commit при изменении.

### Task 9 (опц., follow-up): Анти-дрейф-гард schema.ts ↔ swagger.json

> **Зона:** добавление npm-скрипта трогает `package.json` (запретная зона) — делать отдельным координированным foundation-PR, не в PR-B. Здесь — только зафиксировать намерение.

Идея: скрипт `scripts/check-api-schema.mjs`, который повторяет `generate:api` во временный файл и `diff`-ит с `src/api/schema.ts`; ненулевой diff = «schema.ts отстал от swagger.json». Подключить в CI. Реализация — вне объёма PR-B (см. spec §«Тестирование», анти-дрейф-гард).

---

## Финальная верификация PR-B

- [ ] **Step 1: Backend полностью зелёный**

Run: `cd /Users/alexander.borisenko/Documents/philosophy-api && go build ./... && go test ./... && make swagger && git diff --quiet docs/swagger/swagger.json && echo "swagger up-to-date"`
Expected: всё зелёное, swagger без диффа.

- [ ] **Step 2: Frontend полностью зелёный**

Run: `cd /Users/alexander.borisenko/Documents/philosophy && npm run lint && npm test && npm run build`
Expected: всё зелёное.

- [ ] **Step 3: Sanity — дрейф #2 закрыт**

Run: `cd /Users/alexander.borisenko/Documents/philosophy && grep -rn 'z.enum(\["document", "glossary", "media", "comment"\])\|"document" | "glossary" | "media" | "comment"' src/features/annotations/`
Expected: единственное оставшееся определение значений — `PARENT_ENTITY_TYPE_SET` в `types.ts` (рукописных дублей `z.enum([...])` / литералов больше нет).

---

## Связь с PR-A

PR-A (`2026-06-13-type-drift-pr-a-fe.md`) — независимый FE-only префикс (Capability + AttachmentEntityType FE-re-export). PR-B опирается на стабильный `schema.ts`, поэтому ландится после PR-A и координируется как regen запретной зоны. `#4 auth error-codes` — вне объёма обоих (не дрейф).
