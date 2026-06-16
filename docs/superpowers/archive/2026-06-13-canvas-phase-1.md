# Canvas (фаза 1) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: используй superpowers:subagent-driven-development (рекомендуется) или superpowers:executing-plans для пошагового исполнения. Шаги размечены чекбоксами (`- [ ]`).
>
> **ЯЗЫК / git:** общайся с пользователем на русском. НЕ делай `git stash`, `git reset`, `git checkout .`, `git clean`, `git add -A`/`git add .`. Коммить только свои файлы по имени. Эти правила передавай всем субагентам.

**Goal:** Слайс `src/features/canvas/` + generic `src/components/canvas-render/` + страницы `/canvases`, `/canvases/[id]`, `/canvases/new`: CRUD канвасов и read-only SSR-визуализация графа кастомным SVG. Визуального редактора нет — данные графа правятся через raw-JSON textarea с Zod-валидацией (stopgap до фазы 2).

**Architecture:** SSR-first. Server components фетчат через `api.ts` (openapi-fetch + cookie-JWT), мутации — server actions (`createAction`/`createFormAction`). Координаты узлов уже посчитаны бекендом — layout-движок не нужен; рёбра прямые с привязкой к стороне бокса. Геометрия рендера вынесена в чистые функции с юнит-тестами. RBAC: локальный capability-чек (`isMutationAllowed(me) && me.capabilities.includes("canvas.create")`) до foundation-touch; owner-aware хелперы комбинируют со `owner_id`.

**Tech Stack:** Next.js App Router (server components + server actions), TypeScript (exactOptionalPropertyTypes), Zod, openapi-fetch (`@/api/client`), Base UI Form (`@/components/ui`), Vitest + jsdom. Никаких новых зависимостей — `package.json` НЕ трогать.

---

## Контекст бекенда (источник истины — проверено по коду)

Прочитано: `philosophy-api/internal/canvas/{model,validate,handler,service,request}.go`, `cmd/server/main.go`, `src/api/schema.ts`.

**Эндпоинты** (`cmd/server/main.go:1042-1049,1197`):
- `POST /api/canvases` — requiredAuth, CapCanvasCreate. Body `CreateRequest` (`title` обяз. 1..200, `visibility?` private|public default private, `data?` default пустой граф). 201 + `ETag: "<updated_at>"`.
- `GET /api/canvases` — **requiredAuth** (список ТРЕБУЕТ auth). `?q=&offset=&limit=` (default 20/max 100). Возвращает `[]CanvasSummary` (без `data`-блоба) + pagination. Это «свои + публичные» (SearchVisible).
- `GET /api/canvases/{id}` — optionalAuth + shareTokenMW (`?token=` для приватных). 404 если не виден. Возвращает полный `Canvas` (с `data`).
- `GET /api/canvases/{id}/revisions` — optionalAuth, gated canSee. `[]RevisionMeta` (`rev_num`, `created_at`, `editor_id`, `canvas_id` — **без `id`**). Ревизии есть только у public (private не мутируется в активити).
- `GET /api/canvases/{id}/revisions/{rev}` — `rev` = **положительное целое** (rev_num), не uuid. Возвращает `Revision` (с `data`, `title`, `rev_num`, `created_at`).
- `PUT /api/canvases/{id}` — requiredAuth, **owner-only** (admin чужой → 403; private чужой → 404). **Обязательный `If-Match: <updated_at>`** (пустой → 400; weak/`*` → 400; рассинхрон → 412 `apperror.PreconditionFailed`). Body `UpdateRequest` (`title`, `data` — заменяет целиком).
- `PATCH /api/canvases/{id}/visibility` — requiredAuth, owner-only. **private→public ONLY**; public→private → 422 `PUBLIC_IMMUTABLE`.
- `DELETE /api/canvases/{id}` — requiredAuth. Owner (любая видимость) ИЛИ admin с CapCanvasDeleteAny (**только public**; чужой private → 404).
- `GET /api/canvases/{id}/attachments` — optionalAuth + shareTokenMW (`?token=`). `[]AttachmentDTO` (reverse-lookup лекций-контейнеров). **Эндпоинт ЕСТЬ.**
- **`/api/admin/canvases` НЕ существует** (проверено — нет в main.go). Admin удаляет с обычной страницы `/canvases/[id]` через `DELETE /api/canvases/{id}`.

**Лимиты/коды** (`validate.go`, `service.go`):
- `data` ≤ 1 MiB сериализованного JSON → `413 PAYLOAD_TOO_LARGE` (код `PAYLOAD_TOO_LARGE`). Body ≤ 2 MiB → `413 REQUEST_BODY_TOO_LARGE`.
- nodes ≤ 2000, edges ≤ 2000, title 1..200, node text 0..10000, edge label 0..200.
- Невалидный граф / невидимая entity_ref-цель → `400 VALIDATION_ERROR`/`BAD_REQUEST` (НЕ 404).

**Структура данных** (`model.go`, схема `canvas.*` в `schema.ts:12091-12175`):
- `Node` (discriminated по `type`): общие `id, type, x:int, y:int, width:int>0, height:int>0`.
  - `text`: `+text` (0..10000), запрещены shape_kind/entity_*/anchor.
  - `shape`: `+shape_kind` (rect|ellipse|diamond), опц. `text`, запрещены entity_*/anchor.
  - `entity_ref`: `+entity_type` (10 типов), `+entity_id`, опц. `anchor`; запрещены text/shape_kind.
- `Edge`: `id, from_node, to_node` (ссылаются на существующие node id), опц. `from_side`/`to_side` (top|right|bottom|left), `label` (0..200), `style` (solid|dashed, default solid), `end` (none|arrow, default arrow).
- **entity_ref ВОЗВРАЩАЕТ ТОЛЬКО `entity_type`+`entity_id`** — бек НЕ резолвит title/превью target'а (проверено: `model.go` Node + `schema.ts` `canvas.Node`; нет join'а в `Get`). → карточку рендерим дженерик-меткой типа + ссылкой `/{segment}/{id}`.

---

## Решения по открытым вопросам (зафиксировано)

1. **Резолвятся ли заголовки entity_ref?** НЕТ. Бек отдаёт только `entity_type`+`entity_id`. Карточка узла = метка типа (ru) + усечённый `entity_id` + ссылка на detail-страницу по матрице сегментов. Типы без публичной страницы (`annotation`, `banner`, `event`) и `canvas` сам-на-себя → плашка без ссылки (graceful, ссылку не строим).
2. **attachments-эндпоинт?** ЕСТЬ (`GET /api/canvases/{id}/attachments`). Read-only список лекций-контейнеров через `@/components/attachments`.
3. **admin-эндпоинт списка?** НЕТ. Admin удаляет с `/canvases/[id]`. Пункта в admin-sidebar не будет.
4. **Стратегия If-Match-конфликта.** `updated_at` канваса — это ETag. Форма редактирования держит его в скрытом поле (рендерится из `canvas.updated_at` при загрузке). Action шлёт `If-Match: "<updated_at>"`. На 412 (код `PRECONDITION_FAILED`) action кидает понятный текст «Канвас изменён в другом месте — обновите страницу и повторите.». Пользователь жмёт refresh → форма получает свежий `updated_at`.
5. **Сегмент detail-страницы канваса — `/canvases/{id}` (plural)**, как все остальные сущности (documents/trails/media/forms/glossary/comments — plural). `buildShareUrl` в share-links сейчас кидает на canvas — это foundation-touch (см. ниже); ShareButton на странице канваса использует `resourceType="canvas"`, который УЖЕ валиден в `ResourceType` и имеет label.

---

## Матрица сегментов entity_ref → detail-страница (проверено по `src/app/`)

| entity_type | сегмент | страница есть | в рендере |
|---|---|---|---|
| document | `/documents/{id}` | да | ссылка |
| lecture | `/lectures/{id}` | да | ссылка |
| media | `/media/{id}` | да | ссылка |
| comment | `/comments/{id}` | да | ссылка |
| glossary | `/glossary/{id}` | да | ссылка |
| form | `/forms/{id}` | да | ссылка |
| canvas | `/canvases/{id}` | да (создаём в этой фазе) | ссылка |
| annotation | — | нет публичной | плашка без ссылки |
| banner | — | только admin | плашка без ссылки |
| event | — | только admin | плашка без ссылки |

---

## File Structure

**Слайс `src/features/canvas/`:**
- `types.ts` — сужения из `@/api/schema` (Canvas, CanvasSummary, CanvasData, CanvasNode, CanvasEdge, RevisionMeta, Revision, Visibility, AttachmentDTO).
- `schemas.ts` — Zod: `CanvasDataSchema` (зеркало бека), `CanvasCreateSchema`, `CanvasUpdateSchema`, `CanvasVisibilitySchema`, `CanvasIdSchema`.
- `schemas.test.ts` — success+failure, включая лимиты и битые ссылки рёбер.
- `permissions.ts` — `canCreateCanvas`, `canEditCanvas`, `canDeleteCanvas`, `canChangeVisibility`, `canSeeRevisions`.
- `permissions.test.ts` — 4+ кейса на каждый.
- `api.ts` — `getCanvases` (list, auth), `getCanvasById` (?token), `getCanvasRevisions`, `getCanvasRevision`, `getCanvasContainers` (?token).
- `actions.ts` — `createCanvas`, `updateCanvas` (If-Match), `setCanvasVisibility`, `deleteCanvas`.
- `index.ts` — public API.
- `ui/canvas-my-list.tsx` — server: список CanvasSummary.
- `ui/canvas-pagination.tsx` — client: локальная пагинация (сохраняет `?q=`).
- `ui/canvas-search.tsx` — client: поиск `?q=` через router.replace.
- `ui/canvas-create-form.tsx` — client: title + visibility + опц. data-JSON.
- `ui/canvas-edit-form.tsx` — client: title + data-JSON textarea + If-Match.
- `ui/canvas-visibility-button.tsx` — client: private→public.
- `ui/canvas-delete-button.tsx` — client: ConfirmDialog → deleteCanvas.
- `ui/canvas-detail.tsx` — server: рендер графа через canvas-render + мета.
- `ui/canvas-containers.tsx` — server: AttachmentsPanel read-only.
- `ui/canvas-revisions.tsx` — server: RevisionHistory + снапшот через canvas-render.

**Generic `src/components/canvas-render/`:**
- `types.ts` — props-контракт (CanvasRenderData/Node/Edge, CanvasRenderProps, EntityRefResolver).
- `geometry.ts` — чистые функции (boundingBox, sidePoint, edgePath, boxBorderIntersection).
- `geometry.test.ts` — юнит-тесты геометрии.
- `canvas-render.tsx` — server-компонент `<svg>`.
- `node-shapes.tsx` — рендер узлов (text/shape/entity_ref).
- `index.ts` — экспорт `CanvasRender` + типов.

**Страницы `src/app/canvases/`:**
- `page.tsx` — список (auth-gated, redirect /login?next=, поиск+пагинация).
- `new/page.tsx` — создание.
- `[id]/page.tsx` — detail (render, share, ревизии, контейнеры, owner/admin-контролы).

**Foundation-touch (НЕ в основной ветке фичи, отдельные коммиты/PR):**
- `src/api/tags.ts` — append `CANVASES: "canvas"`. (append-only — безопасно, делаем в Задаче 6 т.к. api.ts требует тег).
- `src/utils/permissions.ts` — `canvas.create`, `canvas.delete_any` в union (отложенный foundation-PR; см. секцию Foundation-touch).
- `src/components/app/app-header/app-header.tsx` — ссылка «Канвасы».
- `src/features/share-links/share-url.ts` + `types.ts` + `share-url.test.ts` — enable canvas (опц. follow-up).
- `src/components/ast-render/inline-renderer.tsx` — canvas_ref → ссылка (опц. follow-up).

---

## Parallel-safety contract

**Create (новые файлы — никем не заняты):**
- весь `src/features/canvas/**`
- весь `src/components/canvas-render/**`
- весь `src/app/canvases/**`

**Modify (касаемся осознанно):**
- `src/api/tags.ts` — **append-only**: добавляем ОДНУ строку `CANVASES: "canvas",` в алфавитный порядок (между `BANNERS` и `COMMENTS`). НЕ переписываем файл, НЕ трогаем другие ключи.
- `src/components/app/app-header/app-header.tsx` — **foundation-touch**, отдельный коммит: добавляем один `<Link href="/canvases">` в authed-блок. Если файл занят другим агентом — пропустить, оставить TODO в отчёте.
- `src/utils/permissions.ts` — **foundation-touch**, отдельный PR (запретная зона union). В основной фиче НЕ трогаем — используем локальный чек.
- `src/features/share-links/*` — **опц. follow-up**, отдельный коммит. В основной фиче НЕ трогаем.
- `src/components/ast-render/*` — **опц. follow-up**, отдельный коммит. В основной фиче НЕ трогаем.

**Reserve (НЕ трогать):**
- `src/api/schema.ts`, `src/app/layout.tsx`, `src/app/admin/**`, `src/app/globals.css`, `src/components/ui/*`, `eslint.config.mjs`, `vitest.config.ts`, `package.json`, `package-lock.json`.

---

## Midpoint (точка возможного разбиения на 2 исполнителей)

**После Задачи 5** (canvas-render готов и протестирован) работу можно разделить:
- **Исполнитель A:** Задачи 6-9 (слайс: api, actions, permissions, schemas + их тесты).
- **Исполнитель B:** Задачи 10-13 (страницы + UI-компоненты слайса), стартует после того, как A смержил api/actions/permissions (UI зависит от их экспортов из `index.ts`).

До Задачи 5 — один исполнитель (canvas-render самодостаточен и нужен всем страницам).

---

## Задачи

### Задача 0: Скопировать шаблон слайса

**Files:**
- Create: `src/features/canvas/` (копия `src/features/_template/`)

- [x] **Шаг 1: Скопировать шаблон**

```bash
cp -R src/features/_template src/features/canvas
rm -f src/features/canvas/ui/.gitkeep
```

- [x] **Шаг 2: Проверить, что скопировалось**

Run: `ls src/features/canvas`
Expected: `README.md actions.ts api.ts index.ts permissions.test.ts permissions.ts schemas.test.ts schemas.ts types.ts ui`

- [x] **Шаг 3: Commit**

```bash
git add src/features/canvas
git commit -m "chore(canvas): scaffold slice from _template"
```

---

### Задача 1: types.ts слайса

**Files:**
- Modify: `src/features/canvas/types.ts`

- [x] **Шаг 1: Записать типы**

```ts
// src/features/canvas/types.ts
import type { components } from "@/api/schema";

/** Полный канвас (GET /api/canvases/{id}). Включает data-блоб. */
export type Canvas = components["schemas"]["canvas.Canvas"];

/** Лёгкая сводка (GET /api/canvases — список). Без data. */
export type CanvasSummary = components["schemas"]["canvas.CanvasSummary"];

/** Корень графа: nodes[] + edges[]. */
export type CanvasData = components["schemas"]["canvas.Data"];

/** Узел графа (discriminated union по type). */
export type CanvasNode = components["schemas"]["canvas.Node"];

/** Ребро графа. */
export type CanvasEdge = components["schemas"]["canvas.Edge"];

/** Видимость: "private" | "public". */
export type Visibility = components["schemas"]["access.Visibility"];

/** Мета-ревизии (элемент списка). У канваса нет id — ключ rev_num. */
export type CanvasRevisionMeta = components["schemas"]["canvas.RevisionMeta"];

/** Полная ревизия со снапшотом data. */
export type CanvasRevision = components["schemas"]["canvas.Revision"];

/** Один attachment (reverse-lookup лекций-контейнеров). */
export type AttachmentDTO = components["schemas"]["attachment.AttachmentDTO"];
```

- [x] **Шаг 2: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "features/canvas/types" || echo OK`
Expected: `OK`

- [x] **Шаг 3: Commit**

```bash
git add src/features/canvas/types.ts
git commit -m "feat(canvas): types from schema"
```

---

### Задача 2: schemas.ts — Zod-зеркало CanvasData (TDD)

Тесты пишем ПЕРВЫМИ. `CanvasDataSchema` валидирует структуру графа на фронте перед PUT/POST (stopgap raw-JSON редактора). Зеркалит `validate.go`: типы узлов, рёбра ссылаются на существующие узлы, лимиты.

**Files:**
- Modify: `src/features/canvas/schemas.ts`
- Modify: `src/features/canvas/schemas.test.ts`

- [x] **Шаг 1: Написать падающие тесты**

```ts
// src/features/canvas/schemas.test.ts
import { describe, it, expect } from "vitest";
import {
  CanvasDataSchema,
  CanvasCreateSchema,
  CanvasUpdateSchema,
  CanvasVisibilitySchema,
  CanvasIdSchema,
  parseCanvasDataJson,
} from "./schemas";

const VALID_NODE_TEXT = { id: "n1", type: "text", x: 0, y: 0, width: 100, height: 40, text: "hi" };
const VALID_NODE_SHAPE = { id: "n2", type: "shape", x: 10, y: 10, width: 80, height: 80, shape_kind: "rect" };
const VALID_NODE_REF = { id: "n3", type: "entity_ref", x: 0, y: 0, width: 120, height: 60, entity_type: "document", entity_id: "11111111-1111-1111-1111-111111111111" };

describe("CanvasDataSchema — success", () => {
  it("принимает пустой граф", () => {
    expect(CanvasDataSchema.safeParse({ nodes: [], edges: [] }).success).toBe(true);
  });
  it("принимает text/shape/entity_ref узлы", () => {
    const r = CanvasDataSchema.safeParse({ nodes: [VALID_NODE_TEXT, VALID_NODE_SHAPE, VALID_NODE_REF], edges: [] });
    expect(r.success).toBe(true);
  });
  it("принимает ребро между существующими узлами", () => {
    const r = CanvasDataSchema.safeParse({
      nodes: [VALID_NODE_TEXT, VALID_NODE_SHAPE],
      edges: [{ id: "e1", from_node: "n1", to_node: "n2", style: "dashed", end: "arrow", from_side: "right", to_side: "left", label: "x" }],
    });
    expect(r.success).toBe(true);
  });
});

describe("CanvasDataSchema — failure", () => {
  it("отклоняет неположительную width", () => {
    expect(CanvasDataSchema.safeParse({ nodes: [{ ...VALID_NODE_TEXT, width: 0 }], edges: [] }).success).toBe(false);
  });
  it("отклоняет text-узел без text", () => {
    const { id, type, x, y, width, height } = VALID_NODE_TEXT;
    expect(CanvasDataSchema.safeParse({ nodes: [{ id, type, x, y, width, height }], edges: [] }).success).toBe(false);
  });
  it("отклоняет shape-узел без shape_kind", () => {
    const { text, ...rest } = VALID_NODE_TEXT;
    expect(CanvasDataSchema.safeParse({ nodes: [{ ...rest, type: "shape" }], edges: [] }).success).toBe(false);
  });
  it("отклоняет entity_ref с неразрешённым типом", () => {
    expect(CanvasDataSchema.safeParse({ nodes: [{ ...VALID_NODE_REF, entity_type: "user" }], edges: [] }).success).toBe(false);
  });
  it("отклоняет дубликат node.id", () => {
    expect(CanvasDataSchema.safeParse({ nodes: [VALID_NODE_TEXT, { ...VALID_NODE_SHAPE, id: "n1" }], edges: [] }).success).toBe(false);
  });
  it("отклоняет ребро с from_node на несуществующий узел", () => {
    const r = CanvasDataSchema.safeParse({ nodes: [VALID_NODE_TEXT], edges: [{ id: "e1", from_node: "missing", to_node: "n1" }] });
    expect(r.success).toBe(false);
  });
  it("отклоняет ребро с to_node на несуществующий узел", () => {
    const r = CanvasDataSchema.safeParse({ nodes: [VALID_NODE_TEXT], edges: [{ id: "e1", from_node: "n1", to_node: "missing" }] });
    expect(r.success).toBe(false);
  });
  it("отклоняет >2000 узлов", () => {
    const nodes = Array.from({ length: 2001 }, (_, i) => ({ ...VALID_NODE_TEXT, id: `n${i}` }));
    expect(CanvasDataSchema.safeParse({ nodes, edges: [] }).success).toBe(false);
  });
  it("отклоняет node text длиннее 10000", () => {
    expect(CanvasDataSchema.safeParse({ nodes: [{ ...VALID_NODE_TEXT, text: "a".repeat(10001) }], edges: [] }).success).toBe(false);
  });
  it("отклоняет edge label длиннее 200", () => {
    const r = CanvasDataSchema.safeParse({ nodes: [VALID_NODE_TEXT], edges: [{ id: "e1", from_node: "n1", to_node: "n1", label: "a".repeat(201) }] });
    expect(r.success).toBe(false);
  });
});

describe("parseCanvasDataJson", () => {
  it("парсит валидный JSON в CanvasData", () => {
    const json = JSON.stringify({ nodes: [VALID_NODE_TEXT], edges: [] });
    const r = parseCanvasDataJson(json);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.nodes).toHaveLength(1);
  });
  it("возвращает ошибку на битый JSON", () => {
    const r = parseCanvasDataJson("{ broken");
    expect(r.ok).toBe(false);
  });
  it("возвращает ошибку на невалидную структуру", () => {
    const r = parseCanvasDataJson(JSON.stringify({ nodes: [{ id: "n1", type: "text", x: 0, y: 0, width: 0, height: 10 }], edges: [] }));
    expect(r.ok).toBe(false);
  });
  it("пустую строку трактует как пустой граф", () => {
    const r = parseCanvasDataJson("");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ nodes: [], edges: [] });
  });
});

describe("CanvasCreateSchema", () => {
  it("принимает title без visibility/data", () => {
    expect(CanvasCreateSchema.safeParse({ title: "Граф" }).success).toBe(true);
  });
  it("отклоняет пустой title", () => {
    expect(CanvasCreateSchema.safeParse({ title: "" }).success).toBe(false);
  });
  it("парсит data-JSON строку в объект", () => {
    const r = CanvasCreateSchema.safeParse({ title: "Граф", data: JSON.stringify({ nodes: [VALID_NODE_TEXT], edges: [] }) });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.data?.nodes).toHaveLength(1);
  });
  it("отклоняет битый data-JSON", () => {
    expect(CanvasCreateSchema.safeParse({ title: "Граф", data: "{bad" }).success).toBe(false);
  });
});

describe("CanvasUpdateSchema", () => {
  it("требует id, title, data", () => {
    const r = CanvasUpdateSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      title: "Граф",
      data: JSON.stringify({ nodes: [], edges: [] }),
    });
    expect(r.success).toBe(true);
  });
  it("отклоняет невалидный id", () => {
    expect(CanvasUpdateSchema.safeParse({ id: "x", title: "Граф", data: "{}" }).success).toBe(false);
  });
});

describe("CanvasVisibilitySchema / CanvasIdSchema", () => {
  it("visibility принимает public", () => {
    expect(CanvasVisibilitySchema.safeParse({ id: "11111111-1111-1111-1111-111111111111", visibility: "public" }).success).toBe(true);
  });
  it("visibility отклоняет мусор", () => {
    expect(CanvasVisibilitySchema.safeParse({ id: "11111111-1111-1111-1111-111111111111", visibility: "secret" }).success).toBe(false);
  });
  it("IdSchema отклоняет не-uuid", () => {
    expect(CanvasIdSchema.safeParse({ id: "nope" }).success).toBe(false);
  });
});
```

- [x] **Шаг 2: Запустить тесты — убедиться, что падают**

Run: `npm test -- src/features/canvas/schemas.test.ts`
Expected: FAIL (модуль не экспортирует CanvasDataSchema и т.д.)

- [x] **Шаг 3: Реализовать schemas.ts**

```ts
// src/features/canvas/schemas.ts
import "server-only";
import { z } from "zod";

/**
 * Zod-зеркало canvas-графа. Источник истины — philosophy-api
 * internal/canvas/validate.go (ValidateData) + model.go (типы узлов/рёбер).
 * Эти схемы валидируют граф на фронте перед POST/PUT (raw-JSON редактор фазы 1).
 * Лимиты совпадают с беком; бек всё равно перепроверит.
 */

const MAX_NODES = 2000;
const MAX_EDGES = 2000;
const MAX_NODE_TEXT = 10_000;
const MAX_EDGE_LABEL = 200;

const ALLOWED_REF_TYPES = [
  "document", "lecture", "annotation", "comment", "media",
  "glossary", "banner", "event", "form", "canvas",
] as const;

const PosInt = z.number().int();
const PosDim = z.number().int().positive();

const BaseNode = z.object({
  id: z.string().min(1),
  x: PosInt,
  y: PosInt,
  width: PosDim,
  height: PosDim,
});

const TextNode = BaseNode.extend({
  type: z.literal("text"),
  text: z.string().max(MAX_NODE_TEXT),
});

const ShapeNode = BaseNode.extend({
  type: z.literal("shape"),
  shape_kind: z.enum(["rect", "ellipse", "diamond"]),
  text: z.string().max(MAX_NODE_TEXT).optional(),
});

const EntityRefNode = BaseNode.extend({
  type: z.literal("entity_ref"),
  entity_type: z.enum(ALLOWED_REF_TYPES),
  entity_id: z.string().min(1),
  // anchor — пробрасываем как есть; бек проверяет совместимость kind'а.
  anchor: z.record(z.unknown()).optional(),
});

const NodeSchema = z.discriminatedUnion("type", [TextNode, ShapeNode, EntityRefNode]);

const EdgeSchema = z.object({
  id: z.string().min(1),
  from_node: z.string().min(1),
  to_node: z.string().min(1),
  from_side: z.enum(["top", "right", "bottom", "left"]).optional(),
  to_side: z.enum(["top", "right", "bottom", "left"]).optional(),
  label: z.string().max(MAX_EDGE_LABEL).optional(),
  style: z.enum(["solid", "dashed"]).optional(),
  end: z.enum(["none", "arrow"]).optional(),
});

/** Полная структурная валидация графа (зеркало ValidateData). */
export const CanvasDataSchema = z
  .object({
    nodes: z.array(NodeSchema).max(MAX_NODES),
    edges: z.array(EdgeSchema).max(MAX_EDGES),
  })
  .superRefine((d, ctx) => {
    const ids = new Set<string>();
    for (const n of d.nodes) {
      if (ids.has(n.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Дубликат node.id "${n.id}"` });
      }
      ids.add(n.id);
    }
    for (const e of d.edges) {
      if (!ids.has(e.from_node)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Ребро "${e.id}": from_node "${e.from_node}" не найден` });
      }
      if (!ids.has(e.to_node)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Ребро "${e.id}": to_node "${e.to_node}" не найден` });
      }
    }
  });

export type CanvasDataInput = z.infer<typeof CanvasDataSchema>;

export type ParseDataResult =
  | { ok: true; data: CanvasDataInput }
  | { ok: false; error: string };

/**
 * Парсит JSON-строку графа из textarea. Пустая строка → пустой граф.
 * Возвращает discriminated result (не бросает) — удобно для preview-валидации
 * в client-форме и для schemas в actions.
 */
export function parseCanvasDataJson(raw: string): ParseDataResult {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, data: { nodes: [], edges: [] } };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "Битый JSON в данных графа" };
  }
  const result = CanvasDataSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, error: first?.message ?? "Граф не прошёл валидацию" };
  }
  return { ok: true, data: result.data };
}

/** Transform-обёртка: JSON-строка data → CanvasData (для FormData-схем). */
const DataJsonField = z.string().optional().transform((s, ctx) => {
  const result = parseCanvasDataJson(s ?? "");
  if (!result.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
    return z.NEVER;
  }
  return result.data;
});

const TitleSchema = z.string().trim().min(1, "Введите название").max(200, "До 200 символов");
const VisibilityEnum = z.enum(["private", "public"]);
const UuidSchema = z.string().uuid("Некорректный id канваса");

/** POST /api/canvases. visibility/data опциональны. */
export const CanvasCreateSchema = z.object({
  title: TitleSchema,
  visibility: VisibilityEnum.optional(),
  data: DataJsonField,
});

/** PUT /api/canvases/{id}. id + title + data (заменяет целиком). */
export const CanvasUpdateSchema = z.object({
  id: UuidSchema,
  title: TitleSchema,
  data: DataJsonField,
});

/** PATCH /api/canvases/{id}/visibility. UI шлёт только private→public. */
export const CanvasVisibilitySchema = z.object({
  id: UuidSchema,
  visibility: VisibilityEnum,
});

/** Для delete. */
export const CanvasIdSchema = z.object({ id: UuidSchema });

export type CanvasCreateInput = z.infer<typeof CanvasCreateSchema>;
export type CanvasUpdateInput = z.infer<typeof CanvasUpdateSchema>;
export type CanvasVisibilityInput = z.infer<typeof CanvasVisibilitySchema>;
export type CanvasIdInput = z.infer<typeof CanvasIdSchema>;
```

- [x] **Шаг 4: Запустить тесты — убедиться, что зелёные**

Run: `npm test -- src/features/canvas/schemas.test.ts`
Expected: PASS (все describe-блоки)

- [x] **Шаг 5: Commit**

```bash
git add src/features/canvas/schemas.ts src/features/canvas/schemas.test.ts
git commit -m "feat(canvas): zod schemas mirroring backend graph validation"
```

---

### Задача 3: permissions.ts (TDD)

Локальный capability-чек (canvas.create/delete_any ещё не в union → используем `me.capabilities.includes`). Owner-aware комбинируем с `owner_id`.

**Files:**
- Modify: `src/features/canvas/permissions.ts`
- Modify: `src/features/canvas/permissions.test.ts`

- [x] **Шаг 1: Написать падающие тесты**

```ts
// src/features/canvas/permissions.test.ts
import { describe, it, expect } from "vitest";
import {
  canCreateCanvas,
  canEditCanvas,
  canChangeVisibility,
  canDeleteCanvas,
  canSeeRevisions,
} from "./permissions";
import type { MaybeMe } from "@/utils/me";
import type { Canvas } from "./types";

function me(over: Partial<NonNullable<MaybeMe>> = {}): NonNullable<MaybeMe> {
  return { id: "u1", username: "u", role: "user", status: "active", capabilities: [], ...over };
}
function canvas(over: Partial<Canvas> = {}): Canvas {
  return { id: "c1", owner_id: "u1", visibility: "private", title: "T", ...over };
}

describe("canCreateCanvas", () => {
  it("гость → false", () => expect(canCreateCanvas(null)).toBe(false));
  it("есть canvas.create → true", () => expect(canCreateCanvas(me({ capabilities: ["canvas.create"] }))).toBe(true));
  it("нет capability → false", () => expect(canCreateCanvas(me())).toBe(false));
  it("suspended с canvas.create → false", () => expect(canCreateCanvas(me({ status: "suspended", capabilities: ["canvas.create"] }))).toBe(false));
});

describe("canEditCanvas", () => {
  it("гость → false", () => expect(canEditCanvas(null, canvas())).toBe(false));
  it("владелец → true", () => expect(canEditCanvas(me({ id: "u1" }), canvas({ owner_id: "u1" }))).toBe(true));
  it("не владелец → false", () => expect(canEditCanvas(me({ id: "u2" }), canvas({ owner_id: "u1" }))).toBe(false));
  it("владелец suspended → false", () => expect(canEditCanvas(me({ id: "u1", status: "suspended" }), canvas({ owner_id: "u1" }))).toBe(false));
});

describe("canChangeVisibility", () => {
  it("гость → false", () => expect(canChangeVisibility(null, canvas())).toBe(false));
  it("владелец приватного → true", () => expect(canChangeVisibility(me({ id: "u1" }), canvas({ owner_id: "u1", visibility: "private" }))).toBe(true));
  it("владелец публичного → false (downgrade запрещён)", () => expect(canChangeVisibility(me({ id: "u1" }), canvas({ owner_id: "u1", visibility: "public" }))).toBe(false));
  it("не владелец приватного → false", () => expect(canChangeVisibility(me({ id: "u2" }), canvas({ owner_id: "u1", visibility: "private" }))).toBe(false));
});

describe("canDeleteCanvas", () => {
  it("гость → false", () => expect(canDeleteCanvas(null, canvas())).toBe(false));
  it("владелец приватного → true", () => expect(canDeleteCanvas(me({ id: "u1" }), canvas({ owner_id: "u1", visibility: "private" }))).toBe(true));
  it("admin с delete_any на публичном чужом → true", () => expect(canDeleteCanvas(me({ id: "adm", capabilities: ["canvas.delete_any"] }), canvas({ owner_id: "u1", visibility: "public" }))).toBe(true));
  it("admin с delete_any на приватном чужом → false", () => expect(canDeleteCanvas(me({ id: "adm", capabilities: ["canvas.delete_any"] }), canvas({ owner_id: "u1", visibility: "private" }))).toBe(false));
  it("чужой без delete_any → false", () => expect(canDeleteCanvas(me({ id: "u2" }), canvas({ owner_id: "u1", visibility: "public" }))).toBe(false));
});

describe("canSeeRevisions", () => {
  it("public → true", () => expect(canSeeRevisions(canvas({ visibility: "public" }))).toBe(true));
  it("private → false", () => expect(canSeeRevisions(canvas({ visibility: "private" }))).toBe(false));
});
```

- [x] **Шаг 2: Запустить — убедиться, что падают**

Run: `npm test -- src/features/canvas/permissions.test.ts`
Expected: FAIL (нет экспортов)

- [x] **Шаг 3: Реализовать permissions.ts**

```ts
// src/features/canvas/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { isMutationAllowed } from "@/utils/permissions";
import type { Canvas } from "./types";

/**
 * Локальный capability-чек: canvas.create / canvas.delete_any ЕЩЁ НЕ в union
 * `Capability` (`@/utils/permissions`) — это foundation-touch (мигрируем на
 * can() отдельным PR). До тех пор используем isMutationAllowed + членство в
 * capabilities напрямую (паттерн волн forms/trails/comments). Имена сверены с
 * philosophy-api internal/rbac/capabilities.go (CapCanvasCreate="canvas.create",
 * CapCanvasDeleteAny="canvas.delete_any").
 */
function hasCap(me: MaybeMe, cap: string): boolean {
  return isMutationAllowed(me) && me.capabilities.includes(cap);
}

/** Создание канваса — capability canvas.create. */
export function canCreateCanvas(me: MaybeMe): boolean {
  return hasCap(me, "canvas.create");
}

/**
 * Редактирование (title + data) — OWNER-ONLY без admin-override.
 * Бек: existing.OwnerID == actor.UserID (service.go Update).
 */
export function canEditCanvas(me: MaybeMe, canvas: Canvas): boolean {
  if (!isMutationAllowed(me)) return false;
  return canvas.owner_id === me.id;
}

/**
 * Смена видимости — OWNER, и только private→public (downgrade → 422
 * PUBLIC_IMMUTABLE). Кнопку показываем только владельцу приватного канваса.
 */
export function canChangeVisibility(me: MaybeMe, canvas: Canvas): boolean {
  if (!isMutationAllowed(me)) return false;
  if (canvas.owner_id !== me.id) return false;
  return canvas.visibility === "private";
}

/**
 * Удаление. Владелец — любая видимость. Admin с delete_any — только public
 * (чужой private → бек 404, кнопку не показываем).
 */
export function canDeleteCanvas(me: MaybeMe, canvas: Canvas): boolean {
  if (!isMutationAllowed(me)) return false;
  if (canvas.owner_id === me.id) return true;
  if (!me.capabilities.includes("canvas.delete_any")) return false;
  return canvas.visibility === "public";
}

/**
 * Ревизии бек создаёт только при мутации public-канваса. У private список
 * всегда пуст — секцию показываем только для public.
 */
export function canSeeRevisions(canvas: Canvas): boolean {
  return canvas.visibility === "public";
}
```

- [x] **Шаг 4: Запустить — убедиться, что зелёные**

Run: `npm test -- src/features/canvas/permissions.test.ts`
Expected: PASS

- [x] **Шаг 5: Commit**

```bash
git add src/features/canvas/permissions.ts src/features/canvas/permissions.test.ts
git commit -m "feat(canvas): owner-aware permission helpers + tests"
```

---

### Задача 4: canvas-render — типы + геометрия (TDD)

Чистые геометрические функции — фундамент рендера. Тесты первыми.

**Files:**
- Create: `src/components/canvas-render/types.ts`
- Create: `src/components/canvas-render/geometry.ts`
- Create: `src/components/canvas-render/geometry.test.ts`

- [x] **Шаг 1: Записать types.ts**

```ts
// src/components/canvas-render/types.ts
import type { ReactNode } from "react";

/** Сторона бокса для привязки рёбер. */
export type Side = "top" | "right" | "bottom" | "left";

/** Доменно-нейтральный узел для рендера (слайс мапит свой CanvasNode сюда). */
export interface RenderNode {
  id: string;
  type: "text" | "shape" | "entity_ref";
  x: number;
  y: number;
  width: number;
  height: number;
  /** text-узел / опц. подпись shape-узла. */
  text?: string | undefined;
  /** shape-узел. */
  shapeKind?: "rect" | "ellipse" | "diamond" | undefined;
  /** entity_ref. */
  entityType?: string | undefined;
  entityId?: string | undefined;
}

/** Доменно-нейтральное ребро для рендера. */
export interface RenderEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: Side | undefined;
  toSide?: Side | undefined;
  label?: string | undefined;
  style?: "solid" | "dashed" | undefined;
  end?: "none" | "arrow" | undefined;
}

export interface RenderData {
  nodes: RenderNode[];
  edges: RenderEdge[];
}

/**
 * Резолвер ссылки для entity_ref-узла. Слайс передаёт функцию, которая по
 * (entityType, entityId) возвращает href detail-страницы ИЛИ null, если
 * страницы для типа нет (annotation/banner/event/неизвестный → плашка без
 * ссылки). Также метку типа (ru) для подписи карточки.
 */
export interface EntityRefView {
  /** href detail-страницы или null (нет публичной страницы). */
  href: string | null;
  /** Человекочитаемая метка типа, напр. «Документ». */
  typeLabel: string;
}

export type EntityRefResolver = (entityType: string, entityId: string) => EntityRefView;

export interface CanvasRenderProps {
  data: RenderData;
  resolveEntityRef: EntityRefResolver;
  /** Подпись при пустом графе. По умолчанию «Граф пуст.». */
  emptyText?: string;
  className?: string;
  /** Доп. контент поверх (напр. бейдж ревизии). */
  children?: ReactNode;
}

/** Прямоугольник bounding-box всего графа. */
export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
```

- [x] **Шаг 2: Написать падающие тесты geometry.test.ts**

```ts
// src/components/canvas-render/geometry.test.ts
import { describe, it, expect } from "vitest";
import { boundingBox, sidePoint, boxBorderIntersection, edgePath } from "./geometry";
import type { RenderNode } from "./types";

const node = (over: Partial<RenderNode> = {}): RenderNode => ({
  id: "n", type: "shape", x: 0, y: 0, width: 100, height: 50, shapeKind: "rect", ...over,
});

describe("boundingBox", () => {
  it("пустой массив → нулевой бокс", () => {
    expect(boundingBox([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });
  it("один узел", () => {
    expect(boundingBox([node({ x: 10, y: 20, width: 100, height: 50 })])).toEqual({
      minX: 10, minY: 20, maxX: 110, maxY: 70,
    });
  });
  it("два узла — объединение", () => {
    const r = boundingBox([
      node({ x: 0, y: 0, width: 50, height: 50 }),
      node({ x: 100, y: 80, width: 40, height: 40 }),
    ]);
    expect(r).toEqual({ minX: 0, minY: 0, maxX: 140, maxY: 120 });
  });
});

describe("sidePoint", () => {
  const n = node({ x: 0, y: 0, width: 100, height: 50 });
  it("top → центр верхней грани", () => expect(sidePoint(n, "top")).toEqual({ x: 50, y: 0 }));
  it("right → центр правой грани", () => expect(sidePoint(n, "right")).toEqual({ x: 100, y: 25 }));
  it("bottom → центр нижней грани", () => expect(sidePoint(n, "bottom")).toEqual({ x: 50, y: 50 }));
  it("left → центр левой грани", () => expect(sidePoint(n, "left")).toEqual({ x: 0, y: 25 }));
});

describe("boxBorderIntersection", () => {
  const n = node({ x: 0, y: 0, width: 100, height: 100 }); // центр (50,50)
  it("луч вправо пересекает правую грань", () => {
    const p = boxBorderIntersection(n, { x: 200, y: 50 });
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(50);
  });
  it("луч вверх пересекает верхнюю грань", () => {
    const p = boxBorderIntersection(n, { x: 50, y: -100 });
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(0);
  });
  it("цель в центре → возвращает центр (без NaN)", () => {
    const p = boxBorderIntersection(n, { x: 50, y: 50 });
    expect(Number.isNaN(p.x)).toBe(false);
    expect(Number.isNaN(p.y)).toBe(false);
  });
});

describe("edgePath", () => {
  const a = node({ id: "a", x: 0, y: 0, width: 100, height: 50 });
  const b = node({ id: "b", x: 200, y: 0, width: 100, height: 50 });
  it("с явными сторонами соединяет указанные грани", () => {
    const { d, mid } = edgePath(a, b, "right", "left");
    expect(d).toContain("M 100 25"); // правая грань a = (100,25)
    expect(d).toContain("200 25");   // левая грань b при x=200 = (200,25)
    expect(mid.x).toBeCloseTo(150);
    expect(mid.y).toBeCloseTo(25);
  });
  it("без сторон — от границы к границе (не NaN)", () => {
    const { d, mid } = edgePath(a, b, undefined, undefined);
    expect(d.startsWith("M ")).toBe(true);
    expect(Number.isNaN(mid.x)).toBe(false);
  });
});
```

- [x] **Шаг 3: Запустить — убедиться, что падают**

Run: `npm test -- src/components/canvas-render/geometry.test.ts`
Expected: FAIL (нет geometry.ts)

- [x] **Шаг 4: Реализовать geometry.ts**

```ts
// src/components/canvas-render/geometry.ts
import type { BBox, RenderNode, Side } from "./types";

export interface Point {
  x: number;
  y: number;
}

/** Bounding box всех узлов. Пустой список → нулевой бокс. */
export function boundingBox(nodes: RenderNode[]): BBox {
  if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  return { minX, minY, maxX, maxY };
}

/** Центр узла. */
export function center(n: RenderNode): Point {
  return { x: n.x + n.width / 2, y: n.y + n.height / 2 };
}

/** Центральная точка указанной грани бокса. */
export function sidePoint(n: RenderNode, side: Side): Point {
  switch (side) {
    case "top": return { x: n.x + n.width / 2, y: n.y };
    case "right": return { x: n.x + n.width, y: n.y + n.height / 2 };
    case "bottom": return { x: n.x + n.width / 2, y: n.y + n.height };
    case "left": return { x: n.x, y: n.y + n.height / 2 };
  }
}

/**
 * Точка пересечения границы бокса узла с лучом из центра узла к `target`.
 * Используется, когда у ребра не заданы from_side/to_side. Если target
 * совпадает с центром — возвращает центр (защита от деления на ноль).
 */
export function boxBorderIntersection(n: RenderNode, target: Point): Point {
  const c = center(n);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const hw = n.width / 2;
  const hh = n.height / 2;
  // Параметр t вдоль луга до пересечения с ближайшей гранью.
  const tx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

export interface EdgeGeometry {
  /** SVG path `d` атрибут (прямая линия). */
  d: string;
  /** Середина ребра — для размещения label. */
  mid: Point;
  /** Конечная точка (для разворота стрелки её хватает marker'у). */
  end: Point;
}

/**
 * Геометрия ребра между двумя узлами. Если сторона задана — точка на ней;
 * иначе — пересечение границы бокса с лучом к центру другого узла.
 */
export function edgePath(
  from: RenderNode,
  to: RenderNode,
  fromSide: Side | undefined,
  toSide: Side | undefined,
): EdgeGeometry {
  const start = fromSide ? sidePoint(from, fromSide) : boxBorderIntersection(from, center(to));
  const finish = toSide ? sidePoint(to, toSide) : boxBorderIntersection(to, center(from));
  const d = `M ${round(start.x)} ${round(start.y)} L ${round(finish.x)} ${round(finish.y)}`;
  return {
    d,
    mid: { x: (start.x + finish.x) / 2, y: (start.y + finish.y) / 2 },
    end: finish,
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
```

- [x] **Шаг 5: Запустить — убедиться, что зелёные**

Run: `npm test -- src/components/canvas-render/geometry.test.ts`
Expected: PASS

- [x] **Шаг 6: Commit**

```bash
git add src/components/canvas-render/types.ts src/components/canvas-render/geometry.ts src/components/canvas-render/geometry.test.ts
git commit -m "feat(canvas-render): geometry pure functions + types (TDD)"
```

---

### Задача 5: canvas-render — SVG-компонент + узлы

Server-компонент. Рендерит `<svg>` с `viewBox` по bounding box, узлы и рёбра. Read-only, без интерактива; внешний скролл — простая CSS-обёртка с `overflow:auto`.

**Files:**
- Create: `src/components/canvas-render/node-shapes.tsx`
- Create: `src/components/canvas-render/canvas-render.tsx`
- Create: `src/components/canvas-render/index.ts`
- Create: `src/components/canvas-render/canvas-render.test.tsx`

- [x] **Шаг 1: node-shapes.tsx**

```tsx
// src/components/canvas-render/node-shapes.tsx
import type { RenderNode, EntityRefResolver } from "./types";

const PADDING = 8;

/** Усечение длинного текста для подписи (рендер read-only, без переноса по словам). */
function clamp(text: string, max = 120): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/** Многострочный перенос текста по ширине (грубая оценка ~7px/символ). */
function wrapLines(text: string, width: number, maxLines = 4): string[] {
  const charsPerLine = Math.max(4, Math.floor((width - PADDING * 2) / 7));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length > charsPerLine && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    } else {
      cur = candidate;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) lines[maxLines - 1] = clamp(lines[maxLines - 1] ?? "", charsPerLine);
  return lines.length ? lines : [""];
}

function NodeText({ node }: { node: RenderNode }) {
  const lines = wrapLines(node.text ?? "", node.width);
  return (
    <g>
      <rect
        x={node.x} y={node.y} width={node.width} height={node.height}
        rx={4} fill="var(--color-text-pane)" stroke="var(--color-border)"
      />
      <text x={node.x + PADDING} y={node.y + 18} fontSize={12} fill="var(--color-foreground)">
        {lines.map((ln, i) => (
          <tspan key={i} x={node.x + PADDING} dy={i === 0 ? 0 : 14}>{ln}</tspan>
        ))}
      </text>
    </g>
  );
}

function NodeShape({ node }: { node: RenderNode }) {
  const { x, y, width, height } = node;
  const fill = "var(--color-text-pane)";
  const stroke = "var(--color-border)";
  let shape;
  if (node.shapeKind === "ellipse") {
    shape = <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} fill={fill} stroke={stroke} />;
  } else if (node.shapeKind === "diamond") {
    const pts = `${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`;
    shape = <polygon points={pts} fill={fill} stroke={stroke} />;
  } else {
    shape = <rect x={x} y={y} width={width} height={height} rx={4} fill={fill} stroke={stroke} />;
  }
  return (
    <g>
      {shape}
      {node.text && (
        <text x={x + width / 2} y={y + height / 2} fontSize={12} textAnchor="middle" dominantBaseline="middle" fill="var(--color-foreground)">
          {clamp(node.text, 40)}
        </text>
      )}
    </g>
  );
}

function NodeEntityRef({ node, resolve }: { node: RenderNode; resolve: EntityRefResolver }) {
  const view = resolve(node.entityType ?? "", node.entityId ?? "");
  const label = `${view.typeLabel}: ${clamp(node.entityId ?? "", 12)}`;
  const card = (
    <g>
      <rect
        x={node.x} y={node.y} width={node.width} height={node.height}
        rx={6} fill="var(--color-text-pane)" stroke="var(--color-primary)"
      />
      <text x={node.x + PADDING} y={node.y + 20} fontSize={12} fill="var(--color-foreground)">{label}</text>
    </g>
  );
  if (view.href) {
    return (
      <a href={view.href} aria-label={label} data-entity-type={node.entityType}>
        {card}
      </a>
    );
  }
  return <g data-entity-unlinked={node.entityType}>{card}</g>;
}

export function NodeShapeRender({ node, resolve }: { node: RenderNode; resolve: EntityRefResolver }) {
  switch (node.type) {
    case "text": return <NodeText node={node} />;
    case "shape": return <NodeShape node={node} />;
    case "entity_ref": return <NodeEntityRef node={node} resolve={resolve} />;
    default: return null;
  }
}
```

- [x] **Шаг 2: canvas-render.tsx**

```tsx
// src/components/canvas-render/canvas-render.tsx
import { boundingBox, edgePath } from "./geometry";
import { NodeShapeRender } from "./node-shapes";
import type { CanvasRenderProps, RenderNode } from "./types";

const MARGIN = 24;

/**
 * Generic read-only SSR-рендер canvas-графа. Координаты узлов заданы извне
 * (бек уже посчитал layout). Рисует <svg> с viewBox по bounding box; узлы и
 * прямые рёбра с привязкой к стороне. Без интерактива (pan/zoom) — внешняя
 * обёртка скроллит при необходимости (overflow:auto).
 */
export function CanvasRender({ data, resolveEntityRef, emptyText = "Граф пуст.", className, children }: CanvasRenderProps) {
  if (data.nodes.length === 0) {
    return <p className="text-sm text-(--color-description)">{emptyText}</p>;
  }

  const bbox = boundingBox(data.nodes);
  const vbX = bbox.minX - MARGIN;
  const vbY = bbox.minY - MARGIN;
  const vbW = bbox.maxX - bbox.minX + MARGIN * 2;
  const vbH = bbox.maxY - bbox.minY + MARGIN * 2;

  const byId = new Map<string, RenderNode>(data.nodes.map((n) => [n.id, n]));

  return (
    <div className={className} style={{ overflow: "auto", maxWidth: "100%" }}>
      <svg
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        width={vbW}
        height={vbH}
        role="img"
        aria-label="Граф канваса"
        style={{ maxWidth: "100%", height: "auto" }}
      >
        <defs>
          <marker id="cv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-description)" />
          </marker>
        </defs>

        {data.edges.map((e) => {
          const from = byId.get(e.fromNode);
          const to = byId.get(e.toNode);
          if (!from || !to) return null; // битая ссылка — не рисуем (бек её не пропустит, но рендер не падает)
          const geo = edgePath(from, to, e.fromSide, e.toSide);
          const arrow = (e.end ?? "arrow") === "arrow";
          return (
            <g key={e.id}>
              <path
                d={geo.d}
                fill="none"
                stroke="var(--color-description)"
                strokeWidth={1.5}
                strokeDasharray={e.style === "dashed" ? "6 4" : undefined}
                markerEnd={arrow ? "url(#cv-arrow)" : undefined}
              />
              {e.label && (
                <text x={geo.mid.x} y={geo.mid.y - 4} fontSize={11} textAnchor="middle" fill="var(--color-description)">
                  {e.label.length > 40 ? e.label.slice(0, 39) + "…" : e.label}
                </text>
              )}
            </g>
          );
        })}

        {data.nodes.map((n) => (
          <NodeShapeRender key={n.id} node={n} resolve={resolveEntityRef} />
        ))}
      </svg>
      {children}
    </div>
  );
}
```

- [x] **Шаг 3: index.ts**

```ts
// src/components/canvas-render/index.ts
export { CanvasRender } from "./canvas-render";
export type {
  CanvasRenderProps,
  RenderData,
  RenderNode,
  RenderEdge,
  Side,
  EntityRefResolver,
  EntityRefView,
  BBox,
} from "./types";
export { boundingBox, sidePoint, edgePath } from "./geometry";
```

- [x] **Шаг 4: Написать тест canvas-render.test.tsx**

```tsx
// src/components/canvas-render/canvas-render.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CanvasRender } from "./canvas-render";
import type { RenderData, EntityRefResolver } from "./types";

const resolve: EntityRefResolver = (type, id) =>
  type === "document"
    ? { href: `/documents/${id}`, typeLabel: "Документ" }
    : { href: null, typeLabel: "Аннотация" };

describe("CanvasRender", () => {
  it("пустой граф → плашка emptyText", () => {
    const { getByText } = render(<CanvasRender data={{ nodes: [], edges: [] }} resolveEntityRef={resolve} />);
    expect(getByText("Граф пуст.")).not.toBeNull();
  });

  it("рисует svg с узлами и ребром", () => {
    const data: RenderData = {
      nodes: [
        { id: "a", type: "text", x: 0, y: 0, width: 100, height: 40, text: "Привет" },
        { id: "b", type: "shape", x: 200, y: 0, width: 80, height: 80, shapeKind: "ellipse" },
      ],
      edges: [{ id: "e1", fromNode: "a", toNode: "b", style: "dashed", end: "arrow" }],
    };
    const { container } = render(<CanvasRender data={data} resolveEntityRef={resolve} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("ellipse")).not.toBeNull();
    expect(container.querySelector("path[stroke-dasharray]")).not.toBeNull();
    expect(container.querySelector("path[marker-end]")).not.toBeNull();
  });

  it("entity_ref с известным типом → ссылка", () => {
    const data: RenderData = {
      nodes: [{ id: "r", type: "entity_ref", x: 0, y: 0, width: 120, height: 60, entityType: "document", entityId: "d1" }],
      edges: [],
    };
    const { container } = render(<CanvasRender data={data} resolveEntityRef={resolve} />);
    const a = container.querySelector('a[href="/documents/d1"]');
    expect(a).not.toBeNull();
  });

  it("entity_ref без публичной страницы → плашка без ссылки", () => {
    const data: RenderData = {
      nodes: [{ id: "r", type: "entity_ref", x: 0, y: 0, width: 120, height: 60, entityType: "annotation", entityId: "an1" }],
      edges: [],
    };
    const { container } = render(<CanvasRender data={data} resolveEntityRef={resolve} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("[data-entity-unlinked='annotation']")).not.toBeNull();
  });

  it("ребро на несуществующий узел не валит рендер", () => {
    const data: RenderData = {
      nodes: [{ id: "a", type: "text", x: 0, y: 0, width: 100, height: 40, text: "x" }],
      edges: [{ id: "e1", fromNode: "a", toNode: "ghost" }],
    };
    const { container } = render(<CanvasRender data={data} resolveEntityRef={resolve} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
```

- [x] **Шаг 5: Запустить — убедиться, что зелёные**

Run: `npm test -- src/components/canvas-render/`
Expected: PASS (geometry + render тесты)

- [x] **Шаг 6: Commit**

```bash
git add src/components/canvas-render/node-shapes.tsx src/components/canvas-render/canvas-render.tsx src/components/canvas-render/index.ts src/components/canvas-render/canvas-render.test.tsx
git commit -m "feat(canvas-render): SVG component + node shapes + tests"
```

> **MIDPOINT** — после этой задачи canvas-render готов. Дальше можно разделить на 2 исполнителей (см. секцию Midpoint).

---

### Задача 6: api.ts слайса + tags.ts

**Files:**
- Modify: `src/api/tags.ts` (append-only, одна строка)
- Modify: `src/features/canvas/api.ts`

- [x] **Шаг 1: Добавить тег CANVASES (append-only)**

В `src/api/tags.ts`, внутри объекта `Tags`, добавь строку в алфавитном порядке между `BANNERS` и `COMMENTS`:

```ts
  BANNERS: "banners",
  CANVASES: "canvas",
  COMMENTS: "comments",
```

(значение `"canvas"` — единственное число, как имена ресурсов; элемент-теги формируются как `canvas:<id>` в api.ts.)

- [x] **Шаг 2: Реализовать api.ts**

```ts
// src/features/canvas/api.ts
import "server-only";
import { cache } from "react";
import { createApiClient } from "@/api/client";
import type {
  AttachmentDTO,
  Canvas,
  CanvasRevision,
  CanvasRevisionMeta,
  CanvasSummary,
} from "./types";

export interface CanvasListFilter {
  q?: string;
  offset?: number;
  limit?: number;
}

export interface CanvasListResult {
  items: CanvasSummary[];
  total: number;
  offset: number;
  limit: number;
}

/** Список доступных канвасов (GET /api/canvases — свои + публичные). Гейт — auth. */
export const getCanvases = cache(
  async (filter: CanvasListFilter = {}): Promise<CanvasListResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const query: { offset: number; limit: number; q?: string } = { offset, limit };
    if (filter.q) query.q = filter.q;
    const { data, error } = await api.GET("/api/canvases", { params: { query } });
    if (error) throw new Error(error.error ?? "Не удалось загрузить канвасы");
    return {
      items: (data?.data ?? []) as CanvasSummary[],
      total: data?.pagination?.total ?? 0,
      offset: data?.pagination?.offset ?? offset,
      limit: data?.pagination?.limit ?? limit,
    };
  },
);

/**
 * Канвас по id (GET /api/canvases/{id}). 404 → null. token (?token=) — для
 * приватных через share-link (shareTokenMW). schema.ts не объявляет token в
 * query → cast `as never` (паттерн documents/media).
 */
export const getCanvasById = cache(
  async (id: string, token?: string): Promise<Canvas | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/canvases/{id}", {
      params: {
        path: { id },
        ...(token ? { query: { token } as never } : {}),
      },
    });
    if (response.status === 404) return null;
    if (error) throw new Error(error.error ?? "Не удалось загрузить канвас");
    return (data?.data ?? null) as Canvas | null;
  },
);

/**
 * Список ревизий (GET /api/canvases/{id}/revisions). created_at ASC — слайс
 * переворачивает в мостике. Только у public. token — для приватных через share.
 */
export const getCanvasRevisions = cache(
  async (id: string, token?: string): Promise<CanvasRevisionMeta[]> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/canvases/{id}/revisions", {
      params: {
        path: { id },
        ...(token ? { query: { token } as never } : {}),
      },
    });
    if (error) throw new Error(error.error ?? "Не удалось загрузить ревизии");
    return (data?.data ?? []) as CanvasRevisionMeta[];
  },
);

/** Одна ревизия (GET /api/canvases/{id}/revisions/{rev}). rev = rev_num (int). 404 → null. */
export const getCanvasRevision = cache(
  async (id: string, rev: number, token?: string): Promise<CanvasRevision | null> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/canvases/{id}/revisions/{rev}", {
      params: {
        path: { id, rev },
        ...(token ? { query: { token } as never } : {}),
      },
    });
    if (response.status === 404) return null;
    if (error) throw new Error(error.error ?? "Не удалось загрузить ревизию");
    return (data?.data ?? null) as CanvasRevision | null;
  },
);

/** Лекции-контейнеры канваса (reverse-lookup GET /api/canvases/{id}/attachments). */
export const getCanvasContainers = cache(
  async (id: string, token?: string): Promise<AttachmentDTO[]> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/canvases/{id}/attachments", {
      params: {
        path: { id },
        ...(token ? { query: { token } as never } : {}),
      },
    });
    if (error) throw new Error(error.error ?? "Не удалось загрузить привязки");
    return (data?.data ?? []) as AttachmentDTO[];
  },
);
```

> Если openapi-fetch типизирует `path.rev` как `string` (swagger `@Param rev path int`), а не `number` — приведи `rev` к строке: `path: { id, rev: String(rev) }`. На шаге 3 build покажет точный тип; подстрой при ошибке.

- [x] **Шаг 3: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "features/canvas/api" || echo OK`
Expected: `OK` (или поправь `rev`-cast по подсказке выше)

- [x] **Шаг 4: Commit**

```bash
git add src/api/tags.ts src/features/canvas/api.ts
git commit -m "feat(canvas): api fetchers (list/by-id/revisions/containers) + CANVASES tag"
```

---

### Задача 7: actions.ts слайса

If-Match, обработка 412/413/422/FORBIDDEN понятными русскими текстами.

**Files:**
- Modify: `src/features/canvas/actions.ts`

- [x] **Шаг 1: Реализовать actions.ts**

```ts
// src/features/canvas/actions.ts
"use server";
import "server-only";
import { cookies } from "next/headers";
import { createApiClient } from "@/api/client";
import { createAction, createFormAction, parseFormData } from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";
import { Tags } from "@/api/tags";
import { canCreateCanvas } from "./permissions";
import {
  CanvasCreateSchema,
  CanvasUpdateSchema,
  CanvasVisibilitySchema,
  CanvasIdSchema,
} from "./schemas";
import type { Canvas } from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

type ApiError = { code?: string; error?: string };

/** Маппинг UPPER_SNAKE_CASE кодов бека в понятный русский текст. */
function rethrowApiError(err: ApiError | undefined): never {
  switch (err?.code) {
    case "FORBIDDEN":
      throw new ForbiddenError("role", err.error);
    case "PUBLIC_IMMUTABLE":
      throw new Error("Публичный канвас нельзя сделать приватным.");
    case "PRECONDITION_FAILED":
      throw new Error("Канвас изменён в другом месте — обновите страницу и повторите.");
    case "PAYLOAD_TOO_LARGE":
    case "REQUEST_BODY_TOO_LARGE":
      throw new Error("Данные графа слишком большие (лимит 1 МиБ).");
    case "VALIDATION_ERROR":
    case "BAD_REQUEST":
      throw new Error("Граф не прошёл валидацию (узлы/рёбра/ссылки на сущности).");
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}

/** POST /api/canvases (JSON). Гейт — canvas.create. */
export const createCanvas = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canCreateCanvas);
  const input = parseFormData(CanvasCreateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/canvases", {
    body: {
      title: input.title,
      ...(input.visibility ? { visibility: input.visibility } : {}),
      ...(input.data ? { data: input.data as never } : {}),
    },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.CANVASES);
  return (data?.data ?? null) as Canvas | null;
});

/**
 * PUT /api/canvases/{id} (полная замена title+data). Owner-only enforce'ит бек.
 * Требует If-Match: "<updated_at>". updated_at приходит из скрытого поля формы.
 * openapi-fetch не типизирует кастомные заголовки PUT → передаём через
 * `headers` верхнего уровня (поддерживается openapi-fetch как fetch-init).
 */
export const updateCanvas = createFormAction(async (formData) => {
  const me = await getMe();
  if (!me || me.status !== "active") throw new ForbiddenError(me ? "status" : "guest");
  const input = parseFormData(CanvasUpdateSchema, formData);
  const updatedAt = formData.get("updated_at");
  if (typeof updatedAt !== "string" || updatedAt === "") {
    throw new Error("Отсутствует версия канваса (updated_at) — обновите страницу.");
  }
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/canvases/{id}", {
    params: { path: { id: input.id } },
    headers: { "If-Match": `"${updatedAt}"` },
    body: { title: input.title, data: input.data as never },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.CANVASES, input.id);
  revalidateEntity(Tags.CANVASES);
  return (data?.data ?? null) as Canvas | null;
});

/** PATCH /api/canvases/{id}/visibility. UI шлёт только private→public. */
export const setCanvasVisibility = createFormAction(async (formData) => {
  const me = await getMe();
  if (!me || me.status !== "active") throw new ForbiddenError(me ? "status" : "guest");
  const input = parseFormData(CanvasVisibilitySchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/canvases/{id}/visibility", {
    params: { path: { id: input.id } },
    body: { visibility: input.visibility },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.CANVASES, input.id);
  revalidateEntity(Tags.CANVASES);
  return (data?.data ?? null) as Canvas | null;
});

/** DELETE /api/canvases/{id}. Owner (любая) или admin delete_any (public) — enforce'ит бек. */
export const deleteCanvas = createAction(async (rawId: string) => {
  const me = await getMe();
  if (!me || me.status !== "active") throw new ForbiddenError(me ? "status" : "guest");
  const { id } = CanvasIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/canvases/{id}", { params: { path: { id } } });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.CANVASES);
  return undefined;
});
```

> `API_URL` объявлен на случай, если build покажет, что `If-Match` через openapi-fetch `headers` не проходит типизацию — тогда fallback: прямой `fetch(\`${API_URL}/api/canvases/${id}\`, { method: "PUT", headers: { Authorization, "If-Match", "Content-Type": "application/json" }, body: JSON.stringify(...) })` с токеном из `cookies()` (паттерн `uploadDocument` в documents/actions.ts). Если openapi-fetch принимает `headers` — удали неиспользуемый `API_URL`, чтобы lint не ругался на no-unused-vars.

- [x] **Шаг 2: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "features/canvas/actions" || echo OK`
Expected: `OK` (или примени fetch-fallback для If-Match по подсказке)

- [x] **Шаг 3: Commit**

```bash
git add src/features/canvas/actions.ts
git commit -m "feat(canvas): server actions (create/update If-Match/visibility/delete)"
```

---

### Задача 8: index.ts слайса (этап A)

**Files:**
- Modify: `src/features/canvas/index.ts`

- [x] **Шаг 1: Записать public API (api + actions + permissions + types)**

```ts
// src/features/canvas/index.ts
export {
  getCanvases,
  getCanvasById,
  getCanvasRevisions,
  getCanvasRevision,
  getCanvasContainers,
} from "./api";
export type { CanvasListFilter, CanvasListResult } from "./api";

export {
  canCreateCanvas,
  canEditCanvas,
  canChangeVisibility,
  canDeleteCanvas,
  canSeeRevisions,
} from "./permissions";

export {
  createCanvas,
  updateCanvas,
  setCanvasVisibility,
  deleteCanvas,
} from "./actions";

export type {
  Canvas,
  CanvasSummary,
  CanvasData,
  CanvasNode,
  CanvasEdge,
  Visibility,
  CanvasRevision,
  CanvasRevisionMeta,
  AttachmentDTO,
} from "./types";

// UI-экспорты добавляются в Задаче 13.
```

- [x] **Шаг 2: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "features/canvas/index" || echo OK`
Expected: `OK`

- [x] **Шаг 3: Commit**

```bash
git add src/features/canvas/index.ts
git commit -m "feat(canvas): public API exports (api/actions/permissions/types)"
```

---

### Задача 9: Хелпер entity-ref view (мостик для canvas-render)

Маппинг entity_type → сегмент + метка (ru). Чистая функция, тестируем. Не «server-only» (используется только в server-компонентах слайса, но без побочек — держим простым).

**Files:**
- Create: `src/features/canvas/entity-ref.ts`
- Create: `src/features/canvas/entity-ref.test.ts`

- [x] **Шаг 1: Написать падающие тесты**

```ts
// src/features/canvas/entity-ref.test.ts
import { describe, it, expect } from "vitest";
import { resolveEntityRefView } from "./entity-ref";

describe("resolveEntityRefView", () => {
  it("document → ссылка и метка", () => {
    expect(resolveEntityRefView("document", "d1")).toEqual({ href: "/documents/d1", typeLabel: "Документ" });
  });
  it("lecture → /lectures/", () => {
    expect(resolveEntityRefView("lecture", "l1").href).toBe("/lectures/l1");
  });
  it("canvas → /canvases/", () => {
    expect(resolveEntityRefView("canvas", "c1").href).toBe("/canvases/c1");
  });
  it("annotation → нет страницы (href null), метка есть", () => {
    const v = resolveEntityRefView("annotation", "a1");
    expect(v.href).toBeNull();
    expect(v.typeLabel).toBe("Аннотация");
  });
  it("banner/event → href null", () => {
    expect(resolveEntityRefView("banner", "b1").href).toBeNull();
    expect(resolveEntityRefView("event", "e1").href).toBeNull();
  });
  it("неизвестный тип → href null, метка «Объект»", () => {
    const v = resolveEntityRefView("unknown", "x");
    expect(v.href).toBeNull();
    expect(v.typeLabel).toBe("Объект");
  });
  it("экранирует id в href", () => {
    expect(resolveEntityRefView("document", "a b").href).toBe("/documents/a%20b");
  });
});
```

- [x] **Шаг 2: Запустить — падают**

Run: `npm test -- src/features/canvas/entity-ref.test.ts`
Expected: FAIL

- [x] **Шаг 3: Реализовать entity-ref.ts**

```ts
// src/features/canvas/entity-ref.ts
import type { EntityRefView } from "@/components/canvas-render";

/** Сегмент app-роутера для типов с публичной detail-страницей. */
const SEGMENTS: Record<string, string> = {
  document: "documents",
  lecture: "lectures",
  media: "media",
  comment: "comments",
  glossary: "glossary",
  form: "forms",
  canvas: "canvases",
};

/** Человекочитаемые метки (ru) всех 10 типов entity_ref + fallback. */
const LABELS: Record<string, string> = {
  document: "Документ",
  lecture: "Лекция",
  media: "Медиа",
  comment: "Комментарий",
  glossary: "Глоссарий",
  form: "Форма",
  canvas: "Канвас",
  annotation: "Аннотация",
  banner: "Баннер",
  event: "Событие",
};

/**
 * Резолвит ссылку и метку для entity_ref-узла. Типы без публичной страницы
 * (annotation/banner/event) и неизвестные → href=null (плашка без ссылки).
 * Бек НЕ резолвит title цели — поэтому метка = только тип сущности.
 */
export function resolveEntityRefView(entityType: string, entityId: string): EntityRefView {
  const segment = SEGMENTS[entityType];
  const typeLabel = LABELS[entityType] ?? "Объект";
  return {
    href: segment ? `/${segment}/${encodeURIComponent(entityId)}` : null,
    typeLabel,
  };
}
```

- [x] **Шаг 4: Запустить — зелёные**

Run: `npm test -- src/features/canvas/entity-ref.test.ts`
Expected: PASS

- [x] **Шаг 5: Commit**

```bash
git add src/features/canvas/entity-ref.ts src/features/canvas/entity-ref.test.ts
git commit -m "feat(canvas): entity-ref view resolver (segment + ru label) + tests"
```

---

### Задача 10: UI — список, поиск, пагинация

**Files:**
- Create: `src/features/canvas/ui/canvas-pagination.tsx`
- Create: `src/features/canvas/ui/canvas-search.tsx`
- Create: `src/features/canvas/ui/canvas-my-list.tsx`

- [x] **Шаг 1: canvas-pagination.tsx** (копия паттерна MediaPagination — сохраняет `?q=`)

```tsx
"use client";
// src/features/canvas/ui/canvas-pagination.tsx
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface Props {
  offset: number;
  limit: number;
  total: number;
}

const linkCls = "rounded border border-(--color-border) px-3 py-1 hover:bg-(--color-text-pane)";
const disabledCls = "rounded border border-(--color-border) px-3 py-1 opacity-40";

/** Слайс-локальная пагинация: мержит offset в текущий query (?q= выживает). */
export function CanvasPagination({ offset, limit, total }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function makeHref(nextOffset: number): string {
    const params = new URLSearchParams(searchParams.toString());
    if (nextOffset > 0) params.set("offset", String(nextOffset));
    else params.delete("offset");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <nav aria-label="Пагинация" className="flex items-center gap-2 text-sm">
      {hasPrev ? (
        <Link href={makeHref(Math.max(0, offset - limit))} className={linkCls}>← Назад</Link>
      ) : (
        <span className={disabledCls}>← Назад</span>
      )}
      <span className="text-(--color-description)">
        {total === 0 ? "0 из 0" : `${offset + 1}–${Math.min(offset + limit, total)} из ${total}`}
      </span>
      {hasNext ? (
        <Link href={makeHref(offset + limit)} className={linkCls}>Вперёд →</Link>
      ) : (
        <span className={disabledCls}>Вперёд →</span>
      )}
    </nav>
  );
}
```

- [x] **Шаг 2: canvas-search.tsx**

```tsx
"use client";
// src/features/canvas/ui/canvas-search.tsx
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TextInput } from "@/components/ui";

/** Поиск по title через ?q=. Сбрасывает offset при изменении запроса. */
export function CanvasSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const q = String(form.get("q") ?? "").trim();
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else params.delete("q");
    params.delete("offset");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <TextInput name="q" defaultValue={searchParams.get("q") ?? ""} placeholder="Поиск по названию" />
      <button type="submit" className="rounded border border-(--color-border) px-3 py-1 text-sm hover:bg-(--color-text-pane)">
        Найти
      </button>
    </form>
  );
}
```

- [x] **Шаг 3: canvas-my-list.tsx** (server)

```tsx
// src/features/canvas/ui/canvas-my-list.tsx
import Link from "next/link";
import type { CanvasSummary } from "../types";

interface Props {
  canvases: CanvasSummary[];
}

/** Read-only список карточек канвасов. */
export function CanvasMyList({ canvases }: Props) {
  if (canvases.length === 0) {
    return <p className="text-sm text-(--color-description)">Канвасов пока нет.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {canvases.flatMap((c) =>
        c.id
          ? [
              <li key={c.id} className="rounded border border-(--color-border) p-3">
                <Link href={`/canvases/${c.id}`} className="font-medium hover:text-(--color-primary)">
                  {c.title || "Без названия"}
                </Link>
                <span className="ml-2 text-xs text-(--color-description)">
                  {c.visibility === "public" ? "публичный" : "приватный"}
                </span>
              </li>,
            ]
          : [],
      )}
    </ul>
  );
}
```

- [x] **Шаг 4: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "features/canvas/ui/canvas-\(pagination\|search\|my-list\)" || echo OK`
Expected: `OK`

- [x] **Шаг 5: Commit**

```bash
git add src/features/canvas/ui/canvas-pagination.tsx src/features/canvas/ui/canvas-search.tsx src/features/canvas/ui/canvas-my-list.tsx
git commit -m "feat(canvas): list/search/pagination UI"
```

---

### Задача 11: UI — формы создания и редактирования

**Files:**
- Create: `src/features/canvas/ui/canvas-create-form.tsx`
- Create: `src/features/canvas/ui/canvas-edit-form.tsx`

- [x] **Шаг 1: canvas-create-form.tsx**

```tsx
"use client";
// src/features/canvas/ui/canvas-create-form.tsx
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Form, FormField, TextInput, Textarea, Select, SubmitButton, useToast } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { createCanvas } from "../actions";
import type { Canvas } from "../types";

const initial: ActionResult<Canvas | null> = { success: true, data: null };

/**
 * Создание канваса: title + visibility + опц. data-JSON (по умолчанию пустой
 * граф). Редактора графа в фазе 1 нет — data вводится сырым JSON.
 */
export function CanvasCreateForm() {
  const router = useRouter();
  const toast = useToast();
  const [state, action] = useActionState(createCanvas, initial);

  useEffect(() => {
    if (state.success && state.data?.id) {
      toast.add({ title: "Канвас создан" });
      router.push(`/canvases/${state.data.id}`);
    } else if (!state.success && state.code !== "validation") {
      const msg = state.code === "forbidden" ? "У вас нет прав на создание канваса." : state.error;
      toast.add({ title: "Ошибка", description: msg });
    }
  }, [state]);

  const fieldErrors = state.success === false && state.code === "validation" ? state.fieldErrors : undefined;

  return (
    <Form action={action} errors={fieldErrors}>
      <FormField name="title" label="Название" required>
        <TextInput name="title" required />
      </FormField>
      <FormField name="visibility" label="Видимость">
        <Select
          name="visibility"
          defaultValue="private"
          options={[
            { value: "private", label: "Приватный" },
            { value: "public", label: "Публичный" },
          ]}
        />
      </FormField>
      <FormField name="data" label="Данные графа (JSON, необязательно)" description='Например: {"nodes":[],"edges":[]}'>
        <Textarea name="data" rows={6} placeholder='{"nodes":[],"edges":[]}' />
      </FormField>
      <SubmitButton>Создать</SubmitButton>
    </Form>
  );
}
```

> `Select` из `@/components/ui` ждёт проп `options: { value, label }[]` (НЕ children `<option>`) — проверено по `src/components/ui/select.tsx`. Код выше уже использует `options`. `name`+`defaultValue` поддерживаются, hidden input Base UI рисует сам.

- [x] **Шаг 2: canvas-edit-form.tsx**

```tsx
"use client";
// src/features/canvas/ui/canvas-edit-form.tsx
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Form, FormField, TextInput, Textarea, SubmitButton, useToast } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { updateCanvas } from "../actions";
import type { Canvas } from "../types";

const initial: ActionResult<Canvas | null> = { success: true, data: null };

interface Props {
  canvas: Canvas;
}

/**
 * Редактирование канваса: title + data-JSON. updated_at канваса хранится в
 * скрытом поле и шлётся как If-Match — на 412 action вернёт понятный текст.
 * data сериализуется из canvas.data в pretty-JSON для удобства правки.
 */
export function CanvasEditForm({ canvas }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [state, action] = useActionState(updateCanvas, initial);

  useEffect(() => {
    if (state.success && state.data) {
      toast.add({ title: "Сохранено" });
      router.refresh();
    } else if (!state.success && state.code !== "validation") {
      const msg = state.code === "forbidden" ? "У вас нет прав на изменение канваса." : state.error;
      toast.add({ title: "Ошибка", description: msg });
    }
  }, [state]);

  const fieldErrors = state.success === false && state.code === "validation" ? state.fieldErrors : undefined;
  const dataJson = JSON.stringify(canvas.data ?? { nodes: [], edges: [] }, null, 2);

  return (
    <Form action={action} errors={fieldErrors}>
      <input type="hidden" name="id" value={canvas.id ?? ""} />
      <input type="hidden" name="updated_at" value={canvas.updated_at ?? ""} />
      <FormField name="title" label="Название" required>
        <TextInput name="title" defaultValue={canvas.title ?? ""} required />
      </FormField>
      <FormField name="data" label="Данные графа (JSON)">
        <Textarea name="data" rows={14} defaultValue={dataJson} className="font-mono text-xs" />
      </FormField>
      <SubmitButton>Сохранить</SubmitButton>
    </Form>
  );
}
```

- [x] **Шаг 3: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "canvas-\(create\|edit\)-form" || echo OK`
Expected: `OK` (подстрой Select по подсказке при необходимости)

- [x] **Шаг 4: Commit**

```bash
git add src/features/canvas/ui/canvas-create-form.tsx src/features/canvas/ui/canvas-edit-form.tsx
git commit -m "feat(canvas): create + edit (raw-JSON, If-Match) forms"
```

---

### Задача 12: UI — visibility, delete, detail, containers, revisions

**Files:**
- Create: `src/features/canvas/ui/canvas-visibility-button.tsx`
- Create: `src/features/canvas/ui/canvas-delete-button.tsx`
- Create: `src/features/canvas/ui/canvas-detail.tsx`
- Create: `src/features/canvas/ui/canvas-containers.tsx`
- Create: `src/features/canvas/ui/canvas-revisions.tsx`

- [x] **Шаг 1: canvas-visibility-button.tsx**

```tsx
"use client";
// src/features/canvas/ui/canvas-visibility-button.tsx
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/components/ui";
import type { ActionResult } from "@/utils/create-action";
import { setCanvasVisibility } from "../actions";
import type { Canvas } from "../types";

const initial: ActionResult<Canvas | null> = { success: true, data: null };

interface Props {
  id: string;
}

/** Кнопка «Сделать публичным» (private→public, необратимо). */
export function CanvasVisibilityButton({ id }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [state, action] = useActionState(setCanvasVisibility, initial);

  useEffect(() => {
    if (state.success && state.data) {
      toast.add({ title: "Канвас опубликован" });
      router.refresh();
    } else if (!state.success) {
      const msg = state.code === "forbidden" ? "У вас нет прав на это действие." : state.error;
      toast.add({ title: "Ошибка", description: msg });
    }
  }, [state]);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="visibility" value="public" />
      <Button type="submit" variant="secondary">Сделать публичным</Button>
    </form>
  );
}
```

- [x] **Шаг 2: canvas-delete-button.tsx**

```tsx
"use client";
// src/features/canvas/ui/canvas-delete-button.tsx
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { deleteCanvas } from "../actions";

interface Props {
  id: string;
}

/** Удаление канваса с подтверждением. После успеха → редирект на /canvases. */
export function CanvasDeleteButton({ id }: Props) {
  const router = useRouter();
  const toast = useToast();

  return (
    <ConfirmDialog
      trigger={<Button variant="danger">Удалить</Button>}
      title="Удалить канвас?"
      description="Действие необратимо."
      destructive
      confirmLabel="Удалить"
      onConfirm={async () => {
        const result = await deleteCanvas(id);
        if (result.success) {
          toast.add({ title: "Канвас удалён" });
          router.push("/canvases");
        } else {
          const msg = result.code === "forbidden" ? "У вас нет прав на удаление канваса." : result.error;
          toast.add({ title: "Ошибка", description: msg });
        }
      }}
    />
  );
}
```

- [x] **Шаг 3: canvas-detail.tsx** (server — мостик слайс → canvas-render)

```tsx
// src/features/canvas/ui/canvas-detail.tsx
import { CanvasRender } from "@/components/canvas-render";
import type { RenderData, RenderEdge, RenderNode } from "@/components/canvas-render";
import { resolveEntityRefView } from "../entity-ref";
import type { CanvasData } from "../types";

interface Props {
  data: CanvasData | undefined;
}

/** Мапит CanvasData (schema-форма) в доменно-нейтральный RenderData. */
function toRenderData(data: CanvasData | undefined): RenderData {
  const nodes: RenderNode[] = (data?.nodes ?? []).flatMap((n) =>
    n.id && n.type
      ? [
          {
            id: n.id,
            type: n.type,
            x: n.x ?? 0,
            y: n.y ?? 0,
            width: n.width ?? 100,
            height: n.height ?? 40,
            text: n.text,
            shapeKind: n.shape_kind,
            entityType: n.entity_type,
            entityId: n.entity_id,
          },
        ]
      : [],
  );
  const edges: RenderEdge[] = (data?.edges ?? []).flatMap((e) =>
    e.id && e.from_node && e.to_node
      ? [
          {
            id: e.id,
            fromNode: e.from_node,
            toNode: e.to_node,
            fromSide: e.from_side,
            toSide: e.to_side,
            label: e.label,
            style: e.style,
            end: e.end,
          },
        ]
      : [],
  );
  return { nodes, edges };
}

/** Read-only SSR-визуализация графа канваса. */
export function CanvasDetail({ data }: Props) {
  return (
    <CanvasRender
      data={toRenderData(data)}
      resolveEntityRef={resolveEntityRefView}
      className="rounded border border-(--color-border) bg-(--color-background) p-2"
    />
  );
}
```

- [x] **Шаг 4: canvas-containers.tsx** (server)

```tsx
// src/features/canvas/ui/canvas-containers.tsx
import { AttachmentsPanel } from "@/components/attachments";
import type { AttachmentItem } from "@/components/attachments";
import { getCanvasContainers } from "../api";

interface Props {
  canvasId: string;
  token?: string | undefined;
}

/**
 * Read-only список лекций, в которые включён канвас (reverse-lookup
 * GET /api/canvases/{id}/attachments). Имя лекции бек не отдаёт — id-плашка
 * со ссылкой на лекцию.
 */
export async function CanvasContainers({ canvasId, token }: Props) {
  const dtos = await getCanvasContainers(canvasId, token);
  const items: AttachmentItem[] = dtos.flatMap((d) =>
    d.container_id
      ? [
          {
            id: d.container_id,
            label: `Лекция ${d.container_id}`,
            sortOrder: d.sort_order ?? 0,
            href: `/lectures/${d.container_id}`,
            ...(d.entity_type ? { entityType: d.entity_type } : {}),
          },
        ]
      : [],
  );
  return (
    <AttachmentsPanel
      title="Включён в лекции"
      items={items}
      emptyText="Канвас не включён ни в одну лекцию."
    />
  );
}
```

- [x] **Шаг 5: canvas-revisions.tsx** (server)

```tsx
// src/features/canvas/ui/canvas-revisions.tsx
import { RevisionHistory } from "@/components/revision-history";
import { getCanvasRevision, getCanvasRevisions } from "../api";
import { CanvasDetail } from "./canvas-detail";

interface Props {
  canvasId: string;
  /** Выбранный rev_num из ?revision= (строка). */
  selectedRevision?: string | undefined;
  token?: string | undefined;
}

/**
 * Ревизии канваса. RevisionMeta не имеет id — ключ это rev_num (int); мапим
 * его в строковый id для generic RevisionHistory. Бек отдаёт created_at ASC —
 * переворачиваем. Снапшот рендерим тем же canvas-render через CanvasDetail.
 */
export async function CanvasRevisions({ canvasId, selectedRevision, token }: Props) {
  const metas = await getCanvasRevisions(canvasId, token);
  const revNum = selectedRevision ? Number(selectedRevision) : NaN;
  const selected = Number.isInteger(revNum) && revNum >= 1
    ? await getCanvasRevision(canvasId, revNum, token)
    : null;

  return (
    <RevisionHistory
      revisions={[...metas]
        .reverse()
        .flatMap((m) =>
          m.rev_num != null
            ? [{ id: String(m.rev_num), createdAt: m.created_at ?? "", label: `Версия ${m.rev_num}` }]
            : [],
        )}
      selectedId={selected?.rev_num != null ? String(selected.rev_num) : undefined}
      buildHref={(rid) => `/canvases/${canvasId}?revision=${rid}`}
    >
      {selected && <CanvasDetail data={selected.data} />}
    </RevisionHistory>
  );
}
```

- [x] **Шаг 6: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "features/canvas/ui" || echo OK`
Expected: `OK`

- [x] **Шаг 7: Commit**

```bash
git add src/features/canvas/ui/canvas-visibility-button.tsx src/features/canvas/ui/canvas-delete-button.tsx src/features/canvas/ui/canvas-detail.tsx src/features/canvas/ui/canvas-containers.tsx src/features/canvas/ui/canvas-revisions.tsx
git commit -m "feat(canvas): visibility/delete/detail/containers/revisions UI"
```

---

### Задача 13: index.ts слайса (этап B — UI-экспорты)

**Files:**
- Modify: `src/features/canvas/index.ts`

- [x] **Шаг 1: Добавить UI-экспорты и entity-ref**

В конец `src/features/canvas/index.ts` добавь:

```ts
export { resolveEntityRefView } from "./entity-ref";

export { CanvasMyList } from "./ui/canvas-my-list";
export { CanvasSearch } from "./ui/canvas-search";
export { CanvasPagination } from "./ui/canvas-pagination";
export { CanvasCreateForm } from "./ui/canvas-create-form";
export { CanvasEditForm } from "./ui/canvas-edit-form";
export { CanvasVisibilityButton } from "./ui/canvas-visibility-button";
export { CanvasDeleteButton } from "./ui/canvas-delete-button";
export { CanvasDetail } from "./ui/canvas-detail";
export { CanvasContainers } from "./ui/canvas-containers";
export { CanvasRevisions } from "./ui/canvas-revisions";
```

(Удали комментарий-заглушку `// UI-экспорты добавляются в Задаче 13.`.)

- [x] **Шаг 2: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "features/canvas/index" || echo OK`
Expected: `OK`

- [x] **Шаг 3: Commit**

```bash
git add src/features/canvas/index.ts
git commit -m "feat(canvas): export UI components from slice public API"
```

---

### Задача 14: Страница списка `/canvases`

**Files:**
- Create: `src/app/canvases/page.tsx`

- [x] **Шаг 1: Реализовать page.tsx**

```tsx
// src/app/canvases/page.tsx
import { redirect } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  canCreateCanvas,
  getCanvases,
  CanvasMyList,
  CanvasSearch,
  CanvasPagination,
} from "@/features/canvas";
import { Button } from "@/components/ui";
import Link from "next/link";

export const metadata = { title: "Канвасы" };

interface Props {
  searchParams: Promise<{ q?: string; offset?: string }>;
}

export default async function CanvasesPage({ searchParams }: Props) {
  const me = await getMe();
  // Список канвасов требует auth (бек: requiredAuth) — гостя на логин.
  if (!me || me.status !== "active") redirect("/login?next=/canvases");

  const { q, offset } = await searchParams;
  const limit = 20;
  const result = await getCanvases({
    ...(q ? { q } : {}),
    offset: offset ? Number(offset) : 0,
    limit,
  });
  const canCreate = canCreateCanvas(me);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Канвасы</h1>
          <p className="text-sm text-(--color-description)">Всего: {result.total}</p>
        </div>
        {canCreate && (
          <Link href="/canvases/new">
            <Button>Создать канвас</Button>
          </Link>
        )}
      </header>

      <CanvasSearch />
      <CanvasMyList canvases={result.items} />
      <CanvasPagination offset={result.offset} limit={result.limit} total={result.total} />
    </main>
  );
}
```

- [x] **Шаг 2: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "app/canvases/page" || echo OK`
Expected: `OK`

- [x] **Шаг 3: Commit**

```bash
git add src/app/canvases/page.tsx
git commit -m "feat(canvas): /canvases list page (auth-gated, search, pagination)"
```

---

### Задача 15: Страница создания `/canvases/new`

**Files:**
- Create: `src/app/canvases/new/page.tsx`

- [x] **Шаг 1: Реализовать page.tsx**

```tsx
// src/app/canvases/new/page.tsx
import { redirect } from "next/navigation";
import { getMe } from "@/utils/me";
import { canCreateCanvas, CanvasCreateForm } from "@/features/canvas";

export const metadata = { title: "Новый канвас" };

export default async function NewCanvasPage() {
  const me = await getMe();
  if (!me || me.status !== "active") redirect("/login?next=/canvases/new");
  if (!canCreateCanvas(me)) redirect("/canvases");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Новый канвас</h1>
      <CanvasCreateForm />
    </main>
  );
}
```

- [x] **Шаг 2: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "app/canvases/new" || echo OK`
Expected: `OK`

- [x] **Шаг 3: Commit**

```bash
git add src/app/canvases/new/page.tsx
git commit -m "feat(canvas): /canvases/new create page"
```

---

### Задача 16: Страница detail `/canvases/[id]`

**Files:**
- Create: `src/app/canvases/[id]/page.tsx`

- [x] **Шаг 1: Реализовать page.tsx**

```tsx
// src/app/canvases/[id]/page.tsx
import { notFound } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  canEditCanvas,
  canDeleteCanvas,
  canChangeVisibility,
  canSeeRevisions,
  getCanvasById,
  CanvasDetail,
  CanvasContainers,
  CanvasRevisions,
  CanvasEditForm,
  CanvasVisibilityButton,
  CanvasDeleteButton,
} from "@/features/canvas";
import { ShareButton, canCreateShareLink, getShareLinksFor } from "@/features/share-links";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string; token?: string }>;
}

export default async function CanvasPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { revision, token } = await searchParams;
  const me = await getMe();
  const canvas = await getCanvasById(id, token);
  if (!canvas) notFound();

  const canEdit = canEditCanvas(me, canvas);
  const canDelete = canDeleteCanvas(me, canvas);
  const canPublish = canChangeVisibility(me, canvas);
  const showRevisions = canSeeRevisions(canvas);

  const canShare = canCreateShareLink(me, canvas);
  const shareLinks = canShare && canvas.id ? await getShareLinksFor("canvas", canvas.id) : [];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{canvas.title || "Канвас"}</h1>
        {canvas.id && (
          <ShareButton
            resourceType="canvas"
            resourceId={canvas.id}
            canCreate={canShare}
            initialLinks={shareLinks}
          />
        )}
      </header>

      <CanvasDetail data={canvas.data} />

      {canvas.id && <CanvasContainers canvasId={canvas.id} token={token} />}

      {canEdit && (
        <section className="flex flex-col gap-6 rounded border border-(--color-border) p-4">
          <h2 className="text-lg font-semibold">Редактирование</h2>
          <CanvasEditForm canvas={canvas} />
          {canPublish && canvas.id && <CanvasVisibilityButton id={canvas.id} />}
        </section>
      )}

      {showRevisions && canvas.id && (
        <CanvasRevisions canvasId={canvas.id} selectedRevision={revision} token={token} />
      )}

      {canDelete && canvas.id && (
        <div>
          <CanvasDeleteButton id={canvas.id} />
        </div>
      )}
    </main>
  );
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const canvas = await getCanvasById(id);
  return { title: canvas?.title ?? "Канвас" };
}
```

> Подтверждено по коду: `canCreateShareLink(me, resource: ShareableResource)` принимает `{ owner_id?, visibility? }` — `Canvas` совместим (owner-приватного → true). `getShareLinksFor(resourceType: ResourceType, id)` принимает `"canvas"` (валидный ResourceType) и возвращает `[]` на 404. `ShareButton` props: `resourceType="canvas"`, `resourceId`, `canCreate`, `initialLinks`. Всё типобезопасно — fallback не нужен.

- [x] **Шаг 2: Проверить типы**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "app/canvases/\[id\]" || echo OK`
Expected: `OK` (подстрой ShareButton/canShare по подсказке)

- [x] **Шаг 3: Commit**

```bash
git add src/app/canvases/[id]/page.tsx
git commit -m "feat(canvas): /canvases/[id] detail page (render/share/edit/revisions/delete)"
```

---

### Задача 17: Полная верификация фичи

**Files:** нет (только проверки)

- [x] **Шаг 1: Lint**

Run: `npm run lint`
Expected: без ошибок (особенно: нет cross-feature импортов из canvas в чужие фичи, нет deep-импортов; `react-dom/client` отсутствует в server-only файлах слайса).

> Частая ловушка: ESLint-гард запрещает cross-feature импорт. `src/app/canvases/[id]/page.tsx` импортит И `@/features/canvas`, И `@/features/share-links` — это импорт ИЗ app-страницы (разрешён), не cross-feature внутри слайса. Слайс `canvas` НЕ должен импортить `@/features/*`. Проверь, что `canvas-detail.tsx` импортит canvas-render из `@/components/canvas-render` (общий компонент), а не из чужого слайса.

- [x] **Шаг 2: Тесты**

Run: `npm test`
Expected: PASS (schemas, permissions, geometry, canvas-render, entity-ref — все зелёные).

- [x] **Шаг 3: Build**

Run: `npm run build`
Expected: успешная сборка, страницы `/canvases`, `/canvases/new`, `/canvases/[id]` в выводе.

- [x] **Шаг 4: Финальный self-review** (см. чеклист `src/features/_template/README.md`): server-only первой строкой в api/actions/permissions/schemas; каждая can* покрыта; каждая схема success+failure; createFormAction+parseFormData+requireCapability+revalidateEntity; нет импортов чужих `@/features/*`; нет `ui/.gitkeep`.

- [x] **Шаг 5: Commit (если были правки от подстройки типов)**

```bash
git add -- <изменённые-файлы-по-имени>
git commit -m "fix(canvas): green lint/test/build"
```

---

## Foundation-touch (ОТДЕЛЬНЫЕ коммиты/PR, НЕ в основной ветке фичи)

Эти изменения касаются запретных/общих зон. Делать ПОСЛЕ основной фичи, отдельными коммитами. Если соответствующий файл занят другим агентом — пропустить и оставить TODO в отчёте.

### FT-1: Header-ссылка «Канвасы»

**Files:** Modify `src/components/app/app-header/app-header.tsx`

- [ ] Внутри authed-блока (`{me ? (<>...</>) : ...}`), рядом с «Мои документы»/«Мои медиа», добавь:

```tsx
<Link
  href="/canvases"
  className="text-sm text-(--color-description) hover:text-(--color-primary)"
>
  Канвасы
</Link>
```

- [ ] Build + commit: `git add src/components/app/app-header/app-header.tsx && git commit -m "feat(foundation): header link Канвасы for authed users"`

### FT-2: Миграция локального чека на can() (запретная зона union)

**Files:** Modify `src/utils/permissions.ts`, `src/features/canvas/permissions.ts`

- [ ] В union `Capability` добавь `"canvas.create"` и `"canvas.delete_any"` (имена сверены с `internal/rbac/capabilities.go` — CapCanvasCreate, CapCanvasDeleteAny; они уже в OpenAPI-union `rbac.Capability` в `schema.ts`).
- [ ] В `src/features/canvas/permissions.ts` замени локальный `hasCap(me, "canvas.create")` на `can(me, "canvas.create")` и `me.capabilities.includes("canvas.delete_any")` на `can(me, "canvas.delete_any")`. Удали хелпер `hasCap`, импортируй `can`. Тесты `permissions.test.ts` остаются зелёными без изменений (семантика идентична).
- [ ] Verify: `npm run lint && npm test && npm run build`. Commit отдельным PR.

### FT-3 (опц. follow-up): canvas в share-url

**Files:** Modify `src/features/share-links/share-url.ts`, `types.ts`, `share-url.test.ts`

- [ ] Если хочется, чтобы share-ссылка канваса вела на `/canvases/{id}`: добавь `canvas: "canvases"` в `RESOURCE_PATH_SEGMENT`, убери `Exclude<ResourceType, "canvas">`, убери throw на canvas в `buildShareUrl`, добавь `canvas` в `SHARE_RESOURCE_TYPES`, обнови `share-url.test.ts` (тест «падает на canvas» заменить на «строит /canvases/{id}»). Без этого ShareButton на странице канваса работает через создание ссылки, но copy-URL может падать на canvas — проверь поведение `ShareLinkList`/`copy-button` (используют ли они `buildShareUrl`). Решение принять при реализации FT-3.

### FT-4 (опц. follow-up): canvas_ref-марка в ast-render → /canvases/[id]

**Files:** Modify `src/components/ast-render/inline-renderer.tsx` (+ тест)

- [ ] Сейчас `canvas_ref` падает в `default` (graceful `<span data-unsupported-mark>`). Теперь, когда страница канваса есть, можно довести до `<a href="/canvases/{attrs.id}">`. Это правка незаморожённого, но shared `ast-render` — отдельный коммит с обновлением `ast-render.test.tsx` (тест «canvas_ref рендерится плашкой» заменить на «canvas_ref → ссылка»). Реши при реализации, нужно ли в фазе 1 (низкий приоритет).

---

## Вне скоупа фазы 1 (зафиксировано)

- Визуальный drag-drop редактор графа — **фаза 2**.
- Импорт/экспорт `.canvas` (Obsidian-интероп) — будущее.
- pan/zoom-интерактив в canvas-render — отложено (фаза 1 = статичный SVG + CSS-скролл).
- FT-2/FT-3/FT-4 — foundation/follow-up, не блокируют фазу 1.

---

## Риски и допущения

1. **entity_ref не резолвится беком** (подтверждено) — карточка показывает только тип + усечённый id. Если в будущем бек начнёт резолвить title, `resolveEntityRefView` расширяется без слома контракта `EntityRefView`.
2. **If-Match через openapi-fetch.** Допущение: openapi-fetch принимает кастомный `headers: { "If-Match": ... }`. Если типизация не пускает — fallback на прямой `fetch` с Bearer-токеном (паттерн `uploadDocument`). Подсказка вписана в Задачу 7.
3. **`rev` path-param тип** (int vs string в openapi-fetch) — подсказка о `String(rev)` в Задаче 6.
4. **`Select` API** из ui-kit (children `<option>` vs проп `options`) — подсказка в Задаче 11.
5. **`canCreateShareLink` принимает canvas** — ПОДТВЕРЖДЕНО по коду: `canCreateShareLink(me, ShareableResource{owner_id?, visibility?})` совместим с Canvas; `getShareLinksFor("canvas", id)` валиден ("canvas" ∈ ResourceType). Риск снят.
6. **412-конфликт** — стратегия: `updated_at` как ETag в скрытом поле; на 412 понятный текст + предложение обновить страницу (refresh подтянет свежий `updated_at`). Без авто-merge (фаза 1).
7. **Тег `CANVASES: "canvas"`** — значение единственное число (как имена ресурсов), элемент-теги `canvas:<id>`. api.ts фазы 1 НЕ оборачивает в `unstable_cache` (только React.cache), поэтому теги работают на будущее; `revalidateEntity` всё равно вызывается в actions для консистентности.
8. **Параллельная работа** — все новые файлы конфликтов не создают; `tags.ts` правка append-only; foundation-touch файлы (header, permissions union) изолированы в отдельные коммиты.
