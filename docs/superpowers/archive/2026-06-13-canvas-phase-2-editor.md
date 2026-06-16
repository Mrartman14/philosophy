# Canvas (фаза 2) — визуальный SVG-редактор графа — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: используй superpowers:subagent-driven-development (рекомендуется) или superpowers:executing-plans для пошагового исполнения. Шаги размечены чекбоксами (`- [ ]`).
>
> **ЯЗЫК / git:** общайся с пользователем на русском. НЕ делай `git stash`, `git reset`, `git checkout .`, `git clean`, `git add -A`/`git add .`. Коммить только свои файлы по имени. Эти правила передавай ВСЕМ субагентам.

**Goal:** Кастомный клиентский SVG-редактор графа канваса (`src/features/canvas/editor/` — чистое ядро-редьюсер + `src/features/canvas/ui/canvas-editor.tsx` — interaction-слой) на маршруте `/canvases/[id]/edit`, заменяющий raw-JSON форму фазы 1 как основной путь редактирования. Read-only SSR-рендер фазы 1 на `/canvases/[id]` остаётся без изменений.

**Architecture:** Чистое ядро (`editor/`) — синхронный редьюсер `canvasReducer(state, command)` над `EditorState` (CanvasData + selection + viewport + undo/redo стеки), плюс чистые геометрические утилиты (экранные↔мировые координаты, hit-test, ресайз-ручки). Ядро НЕ импортит React/DOM — покрывается юнит-тестами TDD. Interaction-слой (`ui/canvas-editor.tsx` + дочерние client-компоненты) — тонкий: `useReducer(canvasReducer, …)`, pointer/keyboard-обработчики транслируют DOM-события в команды ядра, рендер переиспользует геометрию `@/components/canvas-render`. Сохранение через существующий `updateCanvas` (action фазы 1, If-Match/ETag уже корректны). Interaction-слой тестами НЕ покрываем (конвенция ast-editor: тестируется логика, не pointer-события).

**Tech Stack:** Next.js App Router (client-компонент в server-маршруте), TypeScript (`exactOptionalPropertyTypes`), `useReducer`, кастомный SVG (БЕЗ новых зависимостей — `package.json` НЕ трогать), Zod (схема фазы 1), Vitest + jsdom. Пикеры entity_ref — прямой импорт из `@/components/ast-editor/pickers/*`. `crypto.randomUUID()` для генерации id узлов/рёбер (доступен в браузере и в jsdom).

---

## Контекст фазы 1 (фундамент — проверено по коду)

Прочитано целиком: `src/features/canvas/{types,schemas,permissions,api,actions,entity-ref,index}.ts` + `ui/*`, `src/components/canvas-render/{types,geometry,canvas-render,node-shapes,index}.{ts,tsx}`, `src/app/canvases/**`, бек `philosophy-api/internal/canvas/{model,validate,service,handler,refcheck}.go`.

**Что переиспользуем как есть (НЕ дублируем):**

- **Геометрия** `src/components/canvas-render/geometry.ts`: `boundingBox`, `center`, `sidePoint`, `boxBorderIntersection`, `edgePath`, `round`, типы `Point`/`EdgeGeometry`/`BBox`. `index.ts` сейчас экспортирует `boundingBox, sidePoint, edgePath` — в Задаче 1 доэкспортируем `center`, `boxBorderIntersection`, `Point`. Это правка НЕ-замороженного `canvas-render` (наша зона, фаза 1).
- **Рендер-типы** `RenderNode`/`RenderEdge`/`RenderData`/`Side`/`EntityRefResolver`/`EntityRefView` из `@/components/canvas-render`. Редактор рендерит узлы/рёбра ТЕМИ ЖЕ примитивами (`NodeShapeRender` через прямой рендер shape'ов; рёбра — через `edgePath`). Чтобы не дублировать shape-рендер, в Задаче 14 переиспользуем `NodeShapeRender` (экспортируем его из `index.ts` canvas-render).
- **Маппинг** `CanvasData ↔ RenderData`: фаза 1 имеет `toRenderData` приватно в `canvas-detail.tsx`. Редактор работает НАПРЯМУЮ над `CanvasData` (snake_case, schema-форма) в ядре, а для рендера мапит в `RenderData` тем же преобразованием — выносим переиспользуемый `canvasDataToRenderData` в `editor/`-модуль (Задача 5), чтобы и detail, и editor могли его использовать; detail НЕ трогаем (он самодостаточен).
- **Zod-схема** `CanvasDataSchema` + `parseCanvasDataJson` из `schemas.ts` — валидация графа перед сохранением (уникальность id, рёбра→узлы, лимиты). Re-export `CanvasDataSchema` из `index.ts` слайса для использования в client-компоненте (схема — НЕ server-only по содержимому: чистый Zod; но файл `schemas.ts` начинается с `import "server-only"`. РЕШЕНИЕ: НЕ импортируем `schemas.ts` в client. Вместо этого ядро редактора имеет СОБСТВЕННУЮ чистую функцию `validateGraph(data)` в `editor/validate.ts` — без `server-only`, тестируется юнитами; зеркалит те же правила. Это избегает протекания `server-only` в client-бандл.).
- **Action** `updateCanvas` (`actions.ts`) — сохранение PUT с If-Match. Сигнатура: `createFormAction`, читает `formData` поля `id`, `title`, `data` (JSON-строка), `etag`. Редактор сериализует `EditorState.data` в JSON-строку и шлёт через `<form>`/`useActionState` или прямой вызов. Action УЖЕ маппит коды 412/413/422/400 в русский текст (`rethrowApiError`). НЕ меняем action.
- **Пикеры** `@/components/ast-editor/pickers/*`: `AsyncCombobox<T>`, `DocumentPicker`, `LecturePicker`, `GlossaryPicker`, `MediaPicker`, `CanvasPicker`, `CommentPicker`/`Comment2StagePicker`. Все `"use client"`, колбэк `onSelect: (id: string, label: string) => void`, фетчат через server-actions (`pickers/actions.ts`). Импорт ПРЯМОЙ по файлу (барреля нет): `@/components/ast-editor/pickers/document-picker`.
- **RBAC** `canEditCanvas(me, canvas)` (owner-only) — гейт маршрута `/edit`. `can(me, "canvas.create")` уже в union.

**Факты модели (проверено):**

- `Node`: `id, type(text|shape|entity_ref), x:int, y:int, width:int>0, height:int>0`. text→`text`(0..10000, обязателен). shape→`shape_kind`(rect|ellipse|diamond, обязателен), опц.`text`. entity_ref→`entity_type`(10 типов), `entity_id`(непустой), опц.`anchor`. Бек запрещает «чужие» поля (text на entity_ref и т.п.).
- `Edge`: `id, from_node, to_node`(существующие узлы), опц.`from_side`/`to_side`(top|right|bottom|left), `label`(0..200), `style`(solid|dashed, default solid), `end`(none|arrow, default arrow).
- **Лимиты:** nodes ≤ 2000, edges ≤ 2000, node text ≤ 10000, edge label ≤ 200, data ≤ 1 MiB.
- **anchor ВНЕ MVP редактора.** anchor опционален для ВСЕХ типов (`AllowedRefEntityTypes` = все 10; `AnchorCompatibility` допускает `none` для всех). Редактор создаёт entity_ref БЕЗ anchor — это всегда валидно. Существующие anchor'ы в загруженном графе сохраняются «как есть» (ядро не трогает поле `anchor`, переносит его при move/resize). Редактирование anchor — вне скоупа (фаза 3).
- **Ошибка 400 несёт node id В ТЕКСТЕ сообщения, НЕ структурно.** Бек: `apperror.Validation(err.Error())`, где сообщения вида `node "n3": ...`, `duplicate node id "n3"`, `edge "e1": from_node "x" missing`, `node "n3": target document/<id> not visible or not found`. Структурного `Details.node_id` НЕТ. → В UI парсим первый `node "<id>"` / `node id "<id>"` регэкспом и подсвечиваем узел (best-effort; если не распарсилось — просто показываем текст). Action фазы 1 СЕЙЧАС заменяет это сообщение на общее «Граф не прошёл валидацию…» (`rethrowApiError`), теряя node id. **РЕШЕНИЕ:** редактор НЕ полагается на серверный node id; основную валидацию (уникальность/ссылки/лимиты) ловим ЛОКАЛЬНО через `validateGraph` ДО отправки и подсвечиваем узел из локального результата. Серверный 400 (видимость entity_ref) показываем как общий тост — это редкий кейс, который локально проверить нельзя.

---

## Решения по открытым вопросам (зафиксировано)

1. **Где живёт редактор.** Отдельный маршрут `src/app/canvases/[id]/edit/page.tsx` (server-gate: `getMe()` → `canEditCanvas(me, canvas)` → иначе `forbidden()`/`redirect`). Страница фетчит `{canvas, etag}` через `getCanvasById`, передаёт в client `<CanvasEditor>`. Read-only `/canvases/[id]` НЕ меняется (SSR-рендер фазы 1 остаётся).
2. **Судьба raw-JSON формы.** `CanvasEditForm` (raw-JSON textarea) УБИРАЕМ из основного пути: на `/canvases/[id]` секцию «Редактирование» заменяем на кнопку-ссылку «Открыть редактор» (→ `/canvases/[id]/edit`), видимую при `canEdit`. Сам файл `canvas-edit-form.tsx` НЕ удаляем сразу — оставляем как «продвинутый фолбэк», доступный ВНУТРИ страницы редактора за переключателем «JSON» (Задача 19), т.к. он уже отлажен, переиспользует тот же `updateCanvas`/ETag и страхует на случай графа, который визуальный редактор не покрывает (напр. entity_ref с anchor). Обоснование: нулевая стоимость сохранения (уже есть), реальная польза для edge-кейсов, не нарушает «визуальный — основной путь».
3. **Координаты создаваемых узлов.** Размещение в центре текущего вьюпорта (мировые координаты центра viewBox). Дефолтные размеры: text 160×60, shape 120×80, entity_ref 200×72. Координаты округляются к int (бек требует int).
4. **id узлов/рёбер.** `crypto.randomUUID()` (браузер + jsdom). Префикс не нужен — бек принимает любую непустую строку.
5. **Пикеры entity_ref в MVP.** Прямой AsyncCombobox-пикер для 5 типов: `document`, `lecture`, `glossary`, `media`, `canvas` (есть готовые `*-picker.tsx` + search-actions). Для `comment` — двухэтапный (lecture→comment) есть, но усложняет UI; в MVP comment идёт через ручной ввод. Для `annotation`, `banner`, `event`, `form`, `comment` — fallback «ручной ввод entity_id» (текстовое поле + выбор типа). Все 10 типов создаются; разница лишь в способе ввода id. anchor не задаётся.
6. **Undo/redo.** Стек полных снапшотов `CanvasData` (граф ≤ 1 MiB → дёшево). `past: CanvasData[]`, `future: CanvasData[]`, лимит глубины 100. Команды-мутации графа пушат снапшот в `past`, чистят `future`. Selection/viewport НЕ в undo-стеке (только данные графа).
7. **dirty-guard.** `EditorState.dirty` (граф отличается от загруженного). `beforeunload` при dirty + клиентский confirm при навигации «Назад» (через перехват кнопки, не router-events — проще и надёжно). После успешного сохранения `dirty=false`, базовый снапшот обновляется.
8. **Сетка/snap.** Опциональная привязка к сетке 8px (тумблер в тулбаре, по умолчанию ВКЛ). Snap применяется в команде move/resize в ядре (чистая функция, тестируется).

---

## File Structure

**Ядро-редьюсер (чистое, БЕЗ React/DOM, БЕЗ `server-only`) — `src/features/canvas/editor/`:**

- `editor-types.ts` — `EditorState`, `EditorCommand` (discriminated union), `Selection`, `Viewport`, `ResizeHandle`, `EntityRefDraft`.
- `id.ts` — `newId()` (обёртка над `crypto.randomUUID`, чтобы тесты могли мокать).
- `coords.ts` — экранные↔мировые: `screenToWorld`, `worldToScreen`, `applyZoomAtPoint`, `snapToGrid`, `snapPoint`. Чистые функции.
- `coords.test.ts` — юниты координат/зума/snap.
- `geometry-editor.ts` — редакторская геометрия поверх canvas-render: `hitTestNode`, `hitTestEdge`, `resizeHandles` (8 ручек), `applyResize`, `marqueeHits`, `nodeById`, `pointInRect`. Чистые.
- `geometry-editor.test.ts` — юниты hit-test/ресайз/marquee.
- `validate.ts` — `validateGraph(data): GraphValidation` (зеркало правил бека: непустые id, уникальность node id, рёбра→узлы, лимиты, per-type поля). Возвращает `{ ok, errors: {nodeId?, edgeId?, message}[] }`. БЕЗ `server-only` (используется в client).
- `validate.test.ts` — юниты валидации.
- `canvas-reducer.ts` — `canvasReducer(state, command): EditorState` + `initEditorState(data)`. Чистая.
- `canvas-reducer.test.ts` — юниты ВСЕХ команд + undo/redo + dirty + snap.
- `render-map.ts` — `canvasDataToRenderData(data): RenderData` (переиспользуемый маппинг snake→camel для рендера).
- `render-map.test.ts` — юниты маппинга.
- `index.ts` — public API ядра (для UI-слоя слайса; НЕ для внешних фич).

**Interaction-слой (client-компоненты) — `src/features/canvas/ui/`:**

- `canvas-editor.tsx` — корневой `"use client"`: `useReducer(canvasReducer, initEditorState(data))`, SVG-холст, pointer/keyboard-обработчики, viewport-трансформ, оркестрация дочерних. Тестами НЕ покрываем.
- `editor-toolbar.tsx` — `"use client"`: кнопки Текст/Фигура/Ссылка/Удалить/Undo/Redo/Сохранить/Сетка/JSON-тоггл/Назад. Диспатчит команды.
- `editor-node-layer.tsx` — `"use client"`: рендер узлов (через `NodeShapeRender`) + рамки выделения + ручки ресайза + side-handles для рёбер.
- `editor-edge-layer.tsx` — `"use client"`: рендер рёбер (через `edgePath`) + preview-линия создаваемого ребра + выделение ребра.
- `editor-text-overlay.tsx` — `"use client"`: inline textarea-оверлей поверх SVG для редактирования text узла (HTML поверх SVG, позиционируется через worldToScreen).
- `editor-inspector.tsx` — `"use client"`: панель свойств выбранного узла/ребра (shape_kind, размеры, label, style, end, стороны).
- `entity-ref-dialog.tsx` — `"use client"`: модалка создания entity_ref (Select типа + соответствующий пикер ИЛИ ручной ввод id).

**Слайс-инфраструктура — `src/features/canvas/`:**

- `index.ts` — **Modify (append)**: экспорт `CanvasEditor`; экспорт ядра НЕ нужен наружу (ядро используется только внутри `ui/`).

**Страница — `src/app/canvases/`:**

- `[id]/edit/page.tsx` — **Create**: server-gate + рендер `<CanvasEditor>`.
- `[id]/page.tsx` — **Modify**: заменить inline `CanvasEditForm` на кнопку-ссылку «Открыть редактор».

---

## Parallel-safety contract

**Create (новые файлы — никем не заняты):**
- весь `src/features/canvas/editor/**`
- `src/features/canvas/ui/canvas-editor.tsx`, `editor-toolbar.tsx`, `editor-node-layer.tsx`, `editor-edge-layer.tsx`, `editor-text-overlay.tsx`, `editor-inspector.tsx`, `entity-ref-dialog.tsx`
- `src/app/canvases/[id]/edit/page.tsx`

**Modify (касаемся осознанно, только свои строки):**
- `src/components/canvas-render/index.ts` — **append-only**: добавить экспорты `center, boxBorderIntersection` (функции) + `Point` (тип) + `NodeShapeRender` (компонент). НЕ трогаем существующие строки. Наша зона (canvas-render — часть фазы 1, НЕ заморожен).
- `src/features/canvas/index.ts` — **append-only**: добавить `export { CanvasEditor } from "./ui/canvas-editor";`. НЕ трогаем существующие экспорты.
- `src/app/canvases/[id]/page.tsx` — заменить блок `{canEdit && (<section>…CanvasEditForm…</section>)}` на ссылку-кнопку «Открыть редактор». Точечная правка, остальное не трогаем.

**Reserve (НЕ трогать):**
- `src/api/schema.ts`, `src/utils/permissions.ts` (union готов), `src/app/layout.tsx`, `src/app/admin/**`, `src/app/globals.css`, `src/components/ui/*`, `src/components/ast-editor/**` (пикеры — только импортируем, НЕ редактируем), `eslint.config.mjs`, `vitest.config.ts`, `package.json`, `package-lock.json`.
- `src/features/canvas/{schemas,actions,api,permissions,types,entity-ref}.ts` — НЕ меняем (переиспользуем как есть). `schemas.ts` (`server-only`) в client НЕ импортируем.
- `src/features/canvas/ui/canvas-edit-form.tsx`, `canvas-detail.tsx` — НЕ меняем (фолбэк/рендер остаются).

---

## Midpoint (точка возможного разбиения на 2 исполнителей)

**После Задачи 9** (ядро готово и протестировано: типы, координаты, геометрия, валидация, редьюсер, render-map, ядро-index — всё с зелёными юнит-тестами). Дальше:
- **Исполнитель A:** Задачи 10-14 (рендер-слои: node-layer, edge-layer + переиспользование canvas-render).
- **Исполнитель B:** Задачи 15-20 (interaction: тулбар, inspector, text-overlay, entity-ref-dialog, корневой canvas-editor, страница `/edit` + правка detail-страницы). B стартует после того, как A смержил рендер-слои (canvas-editor их собирает).

До Задачи 9 — один исполнитель (ядро самодостаточно и нужно всем UI-слоям). Interaction-слой тестами не покрывается — ревью по месту.

---

## Задачи

### Задача 1: Доэкспорт геометрии и shape-рендера из canvas-render

Редактору нужны `center`, `boxBorderIntersection`, тип `Point` и компонент `NodeShapeRender`, которые сейчас есть в `geometry.ts`/`node-shapes.tsx`, но не реэкспортированы. Append-only правка index.

**Files:**
- Modify: `src/components/canvas-render/index.ts`

- [x] **Шаг 1: Добавить экспорты**

Открыть `src/components/canvas-render/index.ts`. Текущее содержимое:

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

Заменить последнюю строку `export { boundingBox, sidePoint, edgePath } from "./geometry";` на:

```ts
export {
  boundingBox,
  sidePoint,
  edgePath,
  center,
  boxBorderIntersection,
} from "./geometry";
export type { Point, EdgeGeometry } from "./geometry";
export { NodeShapeRender } from "./node-shapes";
```

- [x] **Шаг 2: Проверить, что экспорты резолвятся**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "canvas-render/index" || echo OK`
Expected: `OK`

- [x] **Шаг 3: Commit**

```bash
git add src/components/canvas-render/index.ts
git commit -m "feat(canvas-render): re-export center/boxBorderIntersection/Point/NodeShapeRender for editor reuse"
```

---

### Задача 2: editor-types.ts — типы ядра

Фундамент ядра: состояние редактора и union команд. Чистый TS, без React/DOM/server-only.

**Files:**
- Create: `src/features/canvas/editor/editor-types.ts`

- [x] **Шаг 1: Записать типы**

```ts
// src/features/canvas/editor/editor-types.ts
import type { CanvasData } from "../types";

/** Сторона бокса (совпадает с canvas-render Side). */
export type Side = "top" | "right" | "bottom" | "left";

/** Вид выделенного элемента. */
export type SelectionKind = "node" | "edge";

/** Текущее выделение: множество node id и edge id. */
export interface Selection {
  nodeIds: string[];
  edgeIds: string[];
}

/** Состояние вьюпорта (pan/zoom) в мировых координатах. */
export interface Viewport {
  /** Смещение мира относительно экрана (мировые координаты левого-верхнего угла). */
  x: number;
  y: number;
  /** Масштаб (1 = 100%). */
  zoom: number;
}

/** 8 ручек ресайза одиночного узла. */
export type ResizeHandle =
  | "nw" | "n" | "ne"
  | "e"  | "se" | "s"
  | "sw" | "w";

/** Черновик entity_ref для диалога создания. */
export interface EntityRefDraft {
  entityType: string;
  entityId: string;
}

/**
 * Полное состояние редактора. `data` — единственный источник графа (snake_case
 * schema-форма, как CanvasData). Selection/viewport — UI-состояние (НЕ в undo).
 * past/future — стеки снапшотов CanvasData для undo/redo. baseline — снапшот
 * последнего сохранённого графа (для вычисления dirty). gridEnabled — snap.
 */
export interface EditorState {
  data: CanvasData;
  selection: Selection;
  viewport: Viewport;
  past: CanvasData[];
  future: CanvasData[];
  baseline: CanvasData;
  dirty: boolean;
  gridEnabled: boolean;
}

/** Глубина undo-стека. */
export const UNDO_LIMIT = 100;

/** Шаг сетки (px в мировых координатах). */
export const GRID_SIZE = 8;

/**
 * Команды над состоянием. Discriminated union по `type`. Interaction-слой
 * транслирует pointer/keyboard в эти команды; ядро применяет их синхронно.
 * Имена — глаголы/существительные в camelCase значения `type`.
 */
export type EditorCommand =
  // --- viewport ---
  | { type: "panBy"; dx: number; dy: number }
  | { type: "zoomAt"; factor: number; screenX: number; screenY: number; viewportWidth: number; viewportHeight: number }
  | { type: "setViewport"; viewport: Viewport }
  // --- selection ---
  | { type: "selectNode"; nodeId: string; additive: boolean }
  | { type: "selectEdge"; edgeId: string; additive: boolean }
  | { type: "selectMany"; nodeIds: string[]; edgeIds: string[] }
  | { type: "clearSelection" }
  // --- node mutations ---
  | { type: "addTextNode"; x: number; y: number }
  | { type: "addShapeNode"; shapeKind: "rect" | "ellipse" | "diamond"; x: number; y: number }
  | { type: "addEntityRefNode"; entityType: string; entityId: string; x: number; y: number }
  | { type: "moveSelection"; dx: number; dy: number }
  | { type: "resizeNode"; nodeId: string; handle: ResizeHandle; dx: number; dy: number }
  | { type: "setNodeText"; nodeId: string; text: string }
  | { type: "setShapeKind"; nodeId: string; shapeKind: "rect" | "ellipse" | "diamond" }
  | { type: "setNodeSize"; nodeId: string; width: number; height: number }
  // --- edge mutations ---
  | { type: "addEdge"; fromNode: string; toNode: string; fromSide?: Side; toSide?: Side }
  | { type: "setEdgeLabel"; edgeId: string; label: string }
  | { type: "setEdgeStyle"; edgeId: string; style: "solid" | "dashed" }
  | { type: "setEdgeEnd"; edgeId: string; end: "none" | "arrow" }
  | { type: "setEdgeSides"; edgeId: string; fromSide?: Side; toSide?: Side }
  // --- delete ---
  | { type: "deleteSelection" }
  // --- history / meta ---
  | { type: "undo" }
  | { type: "redo" }
  | { type: "toggleGrid" }
  | { type: "markSaved"; data: CanvasData };
```

- [x] **Шаг 2: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "editor/editor-types" || echo OK`
Expected: `OK`

- [x] **Шаг 3: Commit**

```bash
git add src/features/canvas/editor/editor-types.ts
git commit -m "feat(canvas-editor): core state + command union types"
```

---

### Задача 3: id.ts — генератор id

Тонкая обёртка над `crypto.randomUUID`, чтобы редьюсер был детерминированно-тестируемым (мок в тестах).

**Files:**
- Create: `src/features/canvas/editor/id.ts`

- [x] **Шаг 1: Записать**

```ts
// src/features/canvas/editor/id.ts

/**
 * Генерирует уникальный id для нового узла/ребра. Обёртка над
 * crypto.randomUUID (доступен в браузере и в jsdom/Node ≥ 19). Вынесена
 * отдельно, чтобы тесты редьюсера могли подменять её через vi.spyOn.
 * Бек принимает любую непустую строку id.
 */
export function newId(): string {
  return crypto.randomUUID();
}
```

- [x] **Шаг 2: Commit**

```bash
git add src/features/canvas/editor/id.ts
git commit -m "feat(canvas-editor): newId wrapper over crypto.randomUUID"
```

---

### Задача 4: coords.ts — экранные↔мировые координаты + snap (TDD)

Чистые функции преобразования координат и зума. Тесты первыми.

**Files:**
- Create: `src/features/canvas/editor/coords.ts`
- Create: `src/features/canvas/editor/coords.test.ts`

- [x] **Шаг 1: Написать падающие тесты**

```ts
// src/features/canvas/editor/coords.test.ts
import { describe, it, expect } from "vitest";
import { screenToWorld, worldToScreen, applyZoomAtPoint, snapToGrid, snapPoint } from "./coords";
import type { Viewport } from "./editor-types";

const vp = (over: Partial<Viewport> = {}): Viewport => ({ x: 0, y: 0, zoom: 1, ...over });

describe("screenToWorld / worldToScreen — обратимость", () => {
  it("zoom=1, нет смещения — экран == мир", () => {
    expect(screenToWorld({ x: 10, y: 20 }, vp())).toEqual({ x: 10, y: 20 });
    expect(worldToScreen({ x: 10, y: 20 }, vp())).toEqual({ x: 10, y: 20 });
  });
  it("со смещением вьюпорта", () => {
    const v = vp({ x: 5, y: 7, zoom: 1 });
    expect(screenToWorld({ x: 0, y: 0 }, v)).toEqual({ x: 5, y: 7 });
    expect(worldToScreen({ x: 5, y: 7 }, v)).toEqual({ x: 0, y: 0 });
  });
  it("с зумом 2x", () => {
    const v = vp({ x: 0, y: 0, zoom: 2 });
    // экранная точка (20,20) при zoom 2 → мировая (10,10)
    expect(screenToWorld({ x: 20, y: 20 }, v)).toEqual({ x: 10, y: 10 });
    expect(worldToScreen({ x: 10, y: 10 }, v)).toEqual({ x: 20, y: 20 });
  });
  it("round-trip произвольной точки", () => {
    const v = vp({ x: 3.5, y: -2.25, zoom: 1.5 });
    const w = screenToWorld({ x: 123, y: 45 }, v);
    const back = worldToScreen(w, v);
    expect(back.x).toBeCloseTo(123);
    expect(back.y).toBeCloseTo(45);
  });
});

describe("applyZoomAtPoint", () => {
  it("точка под курсором остаётся на месте после зума", () => {
    const v = vp({ x: 0, y: 0, zoom: 1 });
    const screenPoint = { x: 100, y: 100 };
    const worldBefore = screenToWorld(screenPoint, v);
    const v2 = applyZoomAtPoint(v, 2, screenPoint.x, screenPoint.y);
    const worldAfter = screenToWorld(screenPoint, v2);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y);
    expect(v2.zoom).toBeCloseTo(2);
  });
  it("зум клампится в [0.1, 8]", () => {
    const v = vp({ zoom: 1 });
    expect(applyZoomAtPoint(v, 100, 0, 0).zoom).toBeLessThanOrEqual(8);
    expect(applyZoomAtPoint(v, 0.0001, 0, 0).zoom).toBeGreaterThanOrEqual(0.1);
  });
});

describe("snapToGrid / snapPoint", () => {
  it("округляет к ближайшим 8px когда включено", () => {
    expect(snapToGrid(11, true)).toBe(8);
    expect(snapToGrid(13, true)).toBe(16);
    expect(snapToGrid(-3, true)).toBe(0);
  });
  it("не трогает значение когда выключено (только int-округление)", () => {
    expect(snapToGrid(11.4, false)).toBe(11);
    expect(snapToGrid(11.6, false)).toBe(12);
  });
  it("snapPoint снапит обе координаты", () => {
    expect(snapPoint({ x: 11, y: 13 }, true)).toEqual({ x: 8, y: 16 });
  });
});
```

- [x] **Шаг 2: Запустить — убедиться, что падают**

Run: `npm test -- src/features/canvas/editor/coords.test.ts`
Expected: FAIL (нет модуля coords)

- [x] **Шаг 3: Реализовать coords.ts**

```ts
// src/features/canvas/editor/coords.ts
import type { Point } from "@/components/canvas-render";
import type { Viewport } from "./editor-types";
import { GRID_SIZE } from "./editor-types";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

/**
 * Экранная точка (внутри SVG-контейнера, пиксели) → мировая (координаты графа).
 * Модель вьюпорта: world = viewport.{x,y} + screen / zoom.
 */
export function screenToWorld(screen: Point, vp: Viewport): Point {
  return {
    x: vp.x + screen.x / vp.zoom,
    y: vp.y + screen.y / vp.zoom,
  };
}

/** Мировая точка → экранная. screen = (world - viewport.{x,y}) * zoom. */
export function worldToScreen(world: Point, vp: Viewport): Point {
  return {
    x: (world.x - vp.x) * vp.zoom,
    y: (world.y - vp.y) * vp.zoom,
  };
}

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/**
 * Множит зум на factor, сохраняя мировую точку под экранным курсором на месте.
 * Возвращает новый Viewport.
 */
export function applyZoomAtPoint(vp: Viewport, factor: number, screenX: number, screenY: number): Viewport {
  const newZoom = clampZoom(vp.zoom * factor);
  // мировая точка под курсором до зума
  const worldX = vp.x + screenX / vp.zoom;
  const worldY = vp.y + screenY / vp.zoom;
  // подбираем смещение так, чтобы та же мировая точка осталась под курсором
  return {
    zoom: newZoom,
    x: worldX - screenX / newZoom,
    y: worldY - screenY / newZoom,
  };
}

/** Округляет к ближайшему GRID_SIZE при enabled, иначе к ближайшему int. */
export function snapToGrid(value: number, enabled: boolean): number {
  if (!enabled) return Math.round(value);
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

/** Снапит обе координаты точки. */
export function snapPoint(p: Point, enabled: boolean): Point {
  return { x: snapToGrid(p.x, enabled), y: snapToGrid(p.y, enabled) };
}
```

- [x] **Шаг 4: Запустить — убедиться, что зелёные**

Run: `npm test -- src/features/canvas/editor/coords.test.ts`
Expected: PASS

- [x] **Шаг 5: Commit**

```bash
git add src/features/canvas/editor/coords.ts src/features/canvas/editor/coords.test.ts
git commit -m "feat(canvas-editor): screen<->world coords, zoom-at-point, grid snap (TDD)"
```

---

### Задача 5: render-map.ts — CanvasData → RenderData (TDD)

Переиспользуемый маппинг snake_case CanvasData в доменно-нейтральный RenderData (тот же, что приватно делает canvas-detail). Нужен рендер-слоям редактора.

**Files:**
- Create: `src/features/canvas/editor/render-map.ts`
- Create: `src/features/canvas/editor/render-map.test.ts`

- [x] **Шаг 1: Написать падающие тесты**

```ts
// src/features/canvas/editor/render-map.test.ts
import { describe, it, expect } from "vitest";
import { canvasDataToRenderData } from "./render-map";
import type { CanvasData } from "../types";

describe("canvasDataToRenderData", () => {
  it("пустой граф", () => {
    expect(canvasDataToRenderData({ nodes: [], edges: [] })).toEqual({ nodes: [], edges: [] });
  });
  it("undefined → пустой", () => {
    expect(canvasDataToRenderData(undefined)).toEqual({ nodes: [], edges: [] });
  });
  it("мапит text/shape/entity_ref и ребро", () => {
    const data: CanvasData = {
      nodes: [
        { id: "n1", type: "text", x: 1, y: 2, width: 100, height: 40, text: "hi" },
        { id: "n2", type: "shape", x: 5, y: 6, width: 80, height: 80, shape_kind: "ellipse" },
        { id: "n3", type: "entity_ref", x: 0, y: 0, width: 120, height: 60, entity_type: "document", entity_id: "d1" },
      ],
      edges: [{ id: "e1", from_node: "n1", to_node: "n2", from_side: "right", to_side: "left", label: "x", style: "dashed", end: "arrow" }],
    };
    const r = canvasDataToRenderData(data);
    expect(r.nodes[0]).toEqual({ id: "n1", type: "text", x: 1, y: 2, width: 100, height: 40, text: "hi", shapeKind: undefined, entityType: undefined, entityId: undefined });
    expect(r.nodes[1]?.shapeKind).toBe("ellipse");
    expect(r.nodes[2]?.entityType).toBe("document");
    expect(r.edges[0]).toEqual({ id: "e1", fromNode: "n1", toNode: "n2", fromSide: "right", toSide: "left", label: "x", style: "dashed", end: "arrow" });
  });
  it("пропускает узлы без id/type и рёбра без концов", () => {
    const data: CanvasData = {
      nodes: [{ type: "text", x: 0, y: 0, width: 10, height: 10, text: "x" } as CanvasData["nodes"][number]],
      edges: [{ id: "e1", from_node: "n1" } as CanvasData["edges"][number]],
    };
    const r = canvasDataToRenderData(data);
    expect(r.nodes).toHaveLength(0);
    expect(r.edges).toHaveLength(0);
  });
});
```

- [x] **Шаг 2: Запустить — убедиться, что падают**

Run: `npm test -- src/features/canvas/editor/render-map.test.ts`
Expected: FAIL

- [x] **Шаг 3: Реализовать render-map.ts**

```ts
// src/features/canvas/editor/render-map.ts
import type { RenderData, RenderEdge, RenderNode } from "@/components/canvas-render";
import type { CanvasData } from "../types";

/**
 * Мапит CanvasData (snake_case, schema-форма) в доменно-нейтральный RenderData
 * (camelCase) для canvas-render примитивов. Зеркалит приватный toRenderData
 * из canvas-detail.tsx; вынесен в ядро, чтобы рендер-слои редактора
 * переиспользовали тот же маппинг. Узлы без id/type и рёбра без обоих концов
 * отбрасываются (бек их не пропустит, рендер не должен падать).
 */
export function canvasDataToRenderData(data: CanvasData | undefined): RenderData {
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
```

- [x] **Шаг 4: Запустить — убедиться, что зелёные**

Run: `npm test -- src/features/canvas/editor/render-map.test.ts`
Expected: PASS

- [x] **Шаг 5: Commit**

```bash
git add src/features/canvas/editor/render-map.ts src/features/canvas/editor/render-map.test.ts
git commit -m "feat(canvas-editor): reusable CanvasData->RenderData mapping (TDD)"
```

---

### Задача 6: validate.ts — клиентская валидация графа (TDD)

Чистая валидация (зеркало бека) БЕЗ `server-only` — вызывается из client перед сохранением. Возвращает структурированные ошибки с node/edge id для подсветки. НЕ импортируем `schemas.ts` (он server-only) — пишем компактное зеркало.

**Files:**
- Create: `src/features/canvas/editor/validate.ts`
- Create: `src/features/canvas/editor/validate.test.ts`

- [x] **Шаг 1: Написать падающие тесты**

```ts
// src/features/canvas/editor/validate.test.ts
import { describe, it, expect } from "vitest";
import { validateGraph } from "./validate";
import type { CanvasData } from "../types";

const textNode = (id: string): CanvasData["nodes"][number] => ({ id, type: "text", x: 0, y: 0, width: 100, height: 40, text: "hi" });

describe("validateGraph — success", () => {
  it("пустой граф ок", () => {
    expect(validateGraph({ nodes: [], edges: [] }).ok).toBe(true);
  });
  it("валидные узлы + ребро ок", () => {
    const data: CanvasData = {
      nodes: [textNode("n1"), { id: "n2", type: "shape", x: 10, y: 10, width: 80, height: 80, shape_kind: "rect" }],
      edges: [{ id: "e1", from_node: "n1", to_node: "n2" }],
    };
    expect(validateGraph(data).ok).toBe(true);
  });
});

describe("validateGraph — failure с привязкой к id", () => {
  it("дубликат node id → error с nodeId", () => {
    const data: CanvasData = { nodes: [textNode("n1"), textNode("n1")], edges: [] };
    const r = validateGraph(data);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.nodeId === "n1")).toBe(true);
  });
  it("ребро на несуществующий узел → error с edgeId", () => {
    const data: CanvasData = { nodes: [textNode("n1")], edges: [{ id: "e1", from_node: "n1", to_node: "ghost" }] };
    const r = validateGraph(data);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.edgeId === "e1")).toBe(true);
  });
  it("text-узел без text → error с nodeId", () => {
    const data: CanvasData = { nodes: [{ id: "n1", type: "text", x: 0, y: 0, width: 100, height: 40 }], edges: [] };
    const r = validateGraph(data);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.nodeId === "n1")).toBe(true);
  });
  it("shape без shape_kind → error", () => {
    const data: CanvasData = { nodes: [{ id: "n1", type: "shape", x: 0, y: 0, width: 80, height: 80 }], edges: [] };
    expect(validateGraph(data).ok).toBe(false);
  });
  it("entity_ref без entity_id → error", () => {
    const data: CanvasData = { nodes: [{ id: "n1", type: "entity_ref", x: 0, y: 0, width: 120, height: 60, entity_type: "document" }], edges: [] };
    expect(validateGraph(data).ok).toBe(false);
  });
  it("неположительная width → error", () => {
    const data: CanvasData = { nodes: [{ id: "n1", type: "text", x: 0, y: 0, width: 0, height: 40, text: "x" }], edges: [] };
    expect(validateGraph(data).ok).toBe(false);
  });
  it(">2000 узлов → error", () => {
    const nodes = Array.from({ length: 2001 }, (_, i) => textNode(`n${i}`));
    expect(validateGraph({ nodes, edges: [] }).ok).toBe(false);
  });
  it("node text > 10000 → error", () => {
    const data: CanvasData = { nodes: [{ id: "n1", type: "text", x: 0, y: 0, width: 100, height: 40, text: "a".repeat(10001) }], edges: [] };
    expect(validateGraph(data).ok).toBe(false);
  });
  it("edge label > 200 → error", () => {
    const data: CanvasData = { nodes: [textNode("n1")], edges: [{ id: "e1", from_node: "n1", to_node: "n1", label: "a".repeat(201) }] };
    expect(validateGraph(data).ok).toBe(false);
  });
});
```

- [x] **Шаг 2: Запустить — убедиться, что падают**

Run: `npm test -- src/features/canvas/editor/validate.test.ts`
Expected: FAIL

- [x] **Шаг 3: Реализовать validate.ts**

```ts
// src/features/canvas/editor/validate.ts
import type { CanvasData } from "../types";

const MAX_NODES = 2000;
const MAX_EDGES = 2000;
const MAX_NODE_TEXT = 10_000;
const MAX_EDGE_LABEL = 200;

/** Одна ошибка валидации с привязкой к узлу/ребру для подсветки в UI. */
export interface GraphError {
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface GraphValidation {
  ok: boolean;
  errors: GraphError[];
}

/**
 * Клиентская структурная валидация графа — зеркало philosophy-api
 * internal/canvas/validate.go (ValidateData + validateNode). Вызывается из
 * client ДО сохранения, чтобы поймать ошибки локально и подсветить узел/ребро.
 * Бек всё равно перепроверит. anchor НЕ валидируем (редактор его не создаёт,
 * существующие переносим как есть; anchor-compat проверит бек).
 */
export function validateGraph(data: CanvasData): GraphValidation {
  const errors: GraphError[] = [];
  const nodes = data.nodes ?? [];
  const edges = data.edges ?? [];

  if (nodes.length > MAX_NODES) {
    errors.push({ message: `Слишком много узлов: ${nodes.length} > ${MAX_NODES}` });
  }
  if (edges.length > MAX_EDGES) {
    errors.push({ message: `Слишком много рёбер: ${edges.length} > ${MAX_EDGES}` });
  }

  const ids = new Set<string>();
  for (const n of nodes) {
    if (!n.id) {
      errors.push({ message: "У узла нет id" });
      continue;
    }
    if (ids.has(n.id)) {
      errors.push({ nodeId: n.id, message: `Дубликат id узла "${n.id}"` });
    }
    ids.add(n.id);

    if ((n.width ?? 0) <= 0 || (n.height ?? 0) <= 0) {
      errors.push({ nodeId: n.id, message: `Узел "${n.id}": размеры должны быть положительными` });
    }

    if (n.type === "text") {
      if (n.text == null) errors.push({ nodeId: n.id, message: `Текстовый узел "${n.id}" без текста` });
      else if (n.text.length > MAX_NODE_TEXT) errors.push({ nodeId: n.id, message: `Узел "${n.id}": текст слишком длинный` });
    } else if (n.type === "shape") {
      if (!n.shape_kind) errors.push({ nodeId: n.id, message: `Фигура "${n.id}" без типа фигуры` });
      if (n.text != null && n.text.length > MAX_NODE_TEXT) errors.push({ nodeId: n.id, message: `Узел "${n.id}": текст слишком длинный` });
    } else if (n.type === "entity_ref") {
      if (!n.entity_type) errors.push({ nodeId: n.id, message: `Ссылка "${n.id}" без типа сущности` });
      if (!n.entity_id) errors.push({ nodeId: n.id, message: `Ссылка "${n.id}" без id сущности` });
    } else {
      errors.push({ nodeId: n.id, message: `Узел "${n.id}": неизвестный тип` });
    }
  }

  for (const e of edges) {
    if (!e.id) {
      errors.push({ message: "У ребра нет id" });
      continue;
    }
    if (!e.from_node || !ids.has(e.from_node)) {
      errors.push({ edgeId: e.id, message: `Ребро "${e.id}": from_node не найден` });
    }
    if (!e.to_node || !ids.has(e.to_node)) {
      errors.push({ edgeId: e.id, message: `Ребро "${e.id}": to_node не найден` });
    }
    if (e.label != null && e.label.length > MAX_EDGE_LABEL) {
      errors.push({ edgeId: e.id, message: `Ребро "${e.id}": подпись слишком длинная` });
    }
  }

  return { ok: errors.length === 0, errors };
}
```

- [x] **Шаг 4: Запустить — убедиться, что зелёные**

Run: `npm test -- src/features/canvas/editor/validate.test.ts`
Expected: PASS

- [x] **Шаг 5: Commit**

```bash
git add src/features/canvas/editor/validate.ts src/features/canvas/editor/validate.test.ts
git commit -m "feat(canvas-editor): client-side graph validation mirroring backend (TDD)"
```

---

### Задача 7: geometry-editor.ts — hit-test, ресайз-ручки, marquee (TDD)

Редакторская геометрия поверх canvas-render. Чистые функции над RenderNode (camelCase). Тесты первыми.

**Files:**
- Create: `src/features/canvas/editor/geometry-editor.ts`
- Create: `src/features/canvas/editor/geometry-editor.test.ts`

- [x] **Шаг 1: Написать падающие тесты**

```ts
// src/features/canvas/editor/geometry-editor.test.ts
import { describe, it, expect } from "vitest";
import { pointInRect, hitTestNode, resizeHandles, applyResize, marqueeHits, handleAtPoint } from "./geometry-editor";
import type { RenderNode } from "@/components/canvas-render";

const node = (over: Partial<RenderNode> = {}): RenderNode => ({
  id: "n", type: "shape", x: 0, y: 0, width: 100, height: 50, shapeKind: "rect", ...over,
});

describe("pointInRect", () => {
  const n = node({ x: 10, y: 10, width: 100, height: 50 });
  it("точка внутри", () => expect(pointInRect({ x: 50, y: 30 }, n)).toBe(true));
  it("точка снаружи", () => expect(pointInRect({ x: 5, y: 5 }, n)).toBe(false));
  it("на границе считается внутри", () => expect(pointInRect({ x: 10, y: 10 }, n)).toBe(true));
});

describe("hitTestNode — последний (верхний) узел под точкой", () => {
  const a = node({ id: "a", x: 0, y: 0, width: 100, height: 100 });
  const b = node({ id: "b", x: 50, y: 50, width: 100, height: 100 });
  it("возвращает верхний (последний в массиве) при перекрытии", () => {
    expect(hitTestNode({ x: 60, y: 60 }, [a, b])?.id).toBe("b");
  });
  it("возвращает a вне пересечения", () => {
    expect(hitTestNode({ x: 10, y: 10 }, [a, b])?.id).toBe("a");
  });
  it("null если мимо всех", () => {
    expect(hitTestNode({ x: 500, y: 500 }, [a, b])).toBeNull();
  });
});

describe("resizeHandles", () => {
  const n = node({ x: 0, y: 0, width: 100, height: 50 });
  it("возвращает 8 ручек", () => {
    expect(Object.keys(resizeHandles(n))).toHaveLength(8);
  });
  it("nw в левом-верхнем углу, se в правом-нижнем", () => {
    const h = resizeHandles(n);
    expect(h.nw).toEqual({ x: 0, y: 0 });
    expect(h.se).toEqual({ x: 100, y: 50 });
    expect(h.n).toEqual({ x: 50, y: 0 });
  });
});

describe("handleAtPoint", () => {
  const n = node({ x: 0, y: 0, width: 100, height: 50 });
  it("находит ручку se рядом с углом", () => {
    expect(handleAtPoint({ x: 100, y: 50 }, n, 6)).toBe("se");
  });
  it("null вдали от ручек", () => {
    expect(handleAtPoint({ x: 50, y: 25 }, n, 6)).toBeNull();
  });
});

describe("applyResize", () => {
  const n = node({ x: 0, y: 0, width: 100, height: 50 });
  it("se увеличивает width/height", () => {
    const r = applyResize(n, "se", 20, 10);
    expect(r).toEqual({ x: 0, y: 0, width: 120, height: 60 });
  });
  it("nw двигает x/y и уменьшает размер", () => {
    const r = applyResize(n, "nw", 10, 5);
    expect(r).toEqual({ x: 10, y: 5, width: 90, height: 45 });
  });
  it("клампит минимальный размер 20x20", () => {
    const r = applyResize(n, "se", -200, -200);
    expect(r.width).toBeGreaterThanOrEqual(20);
    expect(r.height).toBeGreaterThanOrEqual(20);
  });
  it("e меняет только width", () => {
    const r = applyResize(n, "e", 30, 999);
    expect(r.width).toBe(130);
    expect(r.height).toBe(50);
    expect(r.y).toBe(0);
  });
});

describe("marqueeHits", () => {
  const a = node({ id: "a", x: 0, y: 0, width: 40, height: 40 });
  const b = node({ id: "b", x: 200, y: 200, width: 40, height: 40 });
  it("захватывает узлы, пересекающие рамку", () => {
    const hits = marqueeHits({ x: -10, y: -10, width: 100, height: 100 }, [a, b]);
    expect(hits).toEqual(["a"]);
  });
  it("рамка вокруг обоих", () => {
    const hits = marqueeHits({ x: -10, y: -10, width: 300, height: 300 }, [a, b]);
    expect(hits).toEqual(["a", "b"]);
  });
});
```

- [x] **Шаг 2: Запустить — убедиться, что падают**

Run: `npm test -- src/features/canvas/editor/geometry-editor.test.ts`
Expected: FAIL

- [x] **Шаг 3: Реализовать geometry-editor.ts**

```ts
// src/features/canvas/editor/geometry-editor.ts
import type { Point, RenderNode } from "@/components/canvas-render";
import type { ResizeHandle } from "./editor-types";

/** Прямоугольник в мировых координатах. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_SIZE = 20;

/** Точка внутри бокса узла (границы включительно). */
export function pointInRect(p: Point, n: RenderNode): boolean {
  return p.x >= n.x && p.x <= n.x + n.width && p.y >= n.y && p.y <= n.y + n.height;
}

/**
 * Верхний узел под точкой (последний в массиве = визуально верхний, т.к.
 * рендерятся по порядку). null если мимо всех.
 */
export function hitTestNode(p: Point, nodes: RenderNode[]): RenderNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n && pointInRect(p, n)) return n;
  }
  return null;
}

/** Координаты 8 ручек ресайза в мировых координатах. */
export function resizeHandles(n: RenderNode): Record<ResizeHandle, Point> {
  const { x, y, width: w, height: h } = n;
  return {
    nw: { x, y },
    n: { x: x + w / 2, y },
    ne: { x: x + w, y },
    e: { x: x + w, y: y + h / 2 },
    se: { x: x + w, y: y + h },
    s: { x: x + w / 2, y: y + h },
    sw: { x, y: y + h },
    w: { x, y: y + h / 2 },
  };
}

/** Ручка ресайза в радиусе `tolerance` от точки, либо null. */
export function handleAtPoint(p: Point, n: RenderNode, tolerance: number): ResizeHandle | null {
  const handles = resizeHandles(n);
  let best: ResizeHandle | null = null;
  let bestDist = tolerance;
  for (const key of Object.keys(handles) as ResizeHandle[]) {
    const h = handles[key];
    const dist = Math.hypot(h.x - p.x, h.y - p.y);
    if (dist <= bestDist) {
      bestDist = dist;
      best = key;
    }
  }
  return best;
}

/**
 * Применяет ресайз к узлу по ручке и смещению (dx, dy в мировых координатах).
 * Клампит минимальный размер MIN_SIZE, не давая боксу схлопнуться/вывернуться.
 * Возвращает новый Rect (x/y/width/height).
 */
export function applyResize(n: RenderNode, handle: ResizeHandle, dx: number, dy: number): Rect {
  let { x, y, width: w, height: h } = n;
  const right = x + w;
  const bottom = y + h;

  const movesLeft = handle === "nw" || handle === "w" || handle === "sw";
  const movesTop = handle === "nw" || handle === "n" || handle === "ne";
  const movesRight = handle === "ne" || handle === "e" || handle === "se";
  const movesBottom = handle === "sw" || handle === "s" || handle === "se";

  if (movesLeft) {
    x = Math.min(x + dx, right - MIN_SIZE);
    w = right - x;
  }
  if (movesRight) {
    w = Math.max(MIN_SIZE, w + dx);
  }
  if (movesTop) {
    y = Math.min(y + dy, bottom - MIN_SIZE);
    h = bottom - y;
  }
  if (movesBottom) {
    h = Math.max(MIN_SIZE, h + dy);
  }

  return { x, y, width: w, height: h };
}

/** id узлов, чьи боксы пересекают marquee-рамку. */
export function marqueeHits(rect: Rect, nodes: RenderNode[]): string[] {
  const rx2 = rect.x + rect.width;
  const ry2 = rect.y + rect.height;
  return nodes
    .filter((n) => n.x < rx2 && n.x + n.width > rect.x && n.y < ry2 && n.y + n.height > rect.y)
    .map((n) => n.id);
}
```

- [x] **Шаг 4: Запустить — убедиться, что зелёные**

Run: `npm test -- src/features/canvas/editor/geometry-editor.test.ts`
Expected: PASS

- [x] **Шаг 5: Commit**

```bash
git add src/features/canvas/editor/geometry-editor.ts src/features/canvas/editor/geometry-editor.test.ts
git commit -m "feat(canvas-editor): editor geometry — hit-test, resize handles, marquee (TDD)"
```

---

### Задача 8: canvas-reducer.ts — ядро-редьюсер (TDD, часть 1: init, selection, viewport, add)

Сердце редактора. Разбито на 2 задачи для bite-size: сначала init/selection/viewport/add-команды, затем move/resize/edit/delete/undo. Тесты первыми.

**Files:**
- Create: `src/features/canvas/editor/canvas-reducer.ts`
- Create: `src/features/canvas/editor/canvas-reducer.test.ts`

- [x] **Шаг 1: Написать падающие тесты (init + selection + viewport + add)**

```ts
// src/features/canvas/editor/canvas-reducer.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { canvasReducer, initEditorState } from "./canvas-reducer";
import type { CanvasData } from "../types";
import * as idMod from "./id";

const baseData: CanvasData = {
  nodes: [
    { id: "n1", type: "text", x: 0, y: 0, width: 100, height: 40, text: "a" },
    { id: "n2", type: "shape", x: 200, y: 0, width: 80, height: 80, shape_kind: "rect" },
  ],
  edges: [],
};

let idCounter = 0;
beforeEach(() => {
  idCounter = 0;
  vi.spyOn(idMod, "newId").mockImplementation(() => `gen-${++idCounter}`);
});

describe("initEditorState", () => {
  it("кладёт data, пустое выделение, чистые стеки, dirty=false", () => {
    const s = initEditorState(baseData);
    expect(s.data).toEqual(baseData);
    expect(s.selection).toEqual({ nodeIds: [], edgeIds: [] });
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
    expect(s.dirty).toBe(false);
    expect(s.baseline).toEqual(baseData);
    expect(s.gridEnabled).toBe(true);
    expect(s.viewport.zoom).toBe(1);
  });
  it("нормализует undefined nodes/edges в пустые массивы", () => {
    const s = initEditorState({});
    expect(s.data.nodes).toEqual([]);
    expect(s.data.edges).toEqual([]);
  });
});

describe("selection команды", () => {
  it("selectNode (не additive) заменяет выделение", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "selectNode", nodeId: "n1", additive: false });
    expect(s.selection.nodeIds).toEqual(["n1"]);
    s = canvasReducer(s, { type: "selectNode", nodeId: "n2", additive: false });
    expect(s.selection.nodeIds).toEqual(["n2"]);
  });
  it("selectNode additive добавляет и тогглит", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "selectNode", nodeId: "n1", additive: true });
    s = canvasReducer(s, { type: "selectNode", nodeId: "n2", additive: true });
    expect(s.selection.nodeIds.sort()).toEqual(["n1", "n2"]);
    s = canvasReducer(s, { type: "selectNode", nodeId: "n1", additive: true });
    expect(s.selection.nodeIds).toEqual(["n2"]);
  });
  it("clearSelection очищает", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "selectMany", nodeIds: ["n1", "n2"], edgeIds: [] });
    s = canvasReducer(s, { type: "clearSelection" });
    expect(s.selection).toEqual({ nodeIds: [], edgeIds: [] });
  });
  it("selection не делает граф dirty", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "selectNode", nodeId: "n1", additive: false });
    expect(s.dirty).toBe(false);
    expect(s.past).toHaveLength(0);
  });
});

describe("viewport команды", () => {
  it("panBy сдвигает мир", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "panBy", dx: 10, dy: -5 });
    expect(s.viewport.x).toBe(10);
    expect(s.viewport.y).toBe(-5);
  });
  it("toggleGrid переключает", () => {
    let s = initEditorState(baseData);
    expect(s.gridEnabled).toBe(true);
    s = canvasReducer(s, { type: "toggleGrid" });
    expect(s.gridEnabled).toBe(false);
  });
});

describe("add-команды", () => {
  it("addTextNode добавляет text-узел с новым id и делает dirty", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addTextNode", x: 50, y: 60 });
    expect(s.data.nodes).toHaveLength(3);
    const added = s.data.nodes[2];
    expect(added?.id).toBe("gen-1");
    expect(added?.type).toBe("text");
    expect(added?.text).toBe("");
    expect(added?.x).toBe(50);
    expect(s.dirty).toBe(true);
    expect(s.past).toHaveLength(1);
    expect(s.selection.nodeIds).toEqual(["gen-1"]);
  });
  it("addShapeNode задаёт shape_kind", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addShapeNode", shapeKind: "ellipse", x: 0, y: 0 });
    expect(s.data.nodes[2]?.type).toBe("shape");
    expect(s.data.nodes[2]?.shape_kind).toBe("ellipse");
  });
  it("addEntityRefNode задаёт entity_type/entity_id без anchor", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addEntityRefNode", entityType: "document", entityId: "d1", x: 0, y: 0 });
    const n = s.data.nodes[2];
    expect(n?.type).toBe("entity_ref");
    expect(n?.entity_type).toBe("document");
    expect(n?.entity_id).toBe("d1");
    expect(n?.anchor).toBeUndefined();
  });
});
```

- [x] **Шаг 2: Запустить — убедиться, что падают**

Run: `npm test -- src/features/canvas/editor/canvas-reducer.test.ts`
Expected: FAIL (нет модуля)

- [x] **Шаг 3: Реализовать canvas-reducer.ts (полностью — включая команды Задачи 9, чтобы файл компилировался; тесты Задачи 9 добавим следом)**

```ts
// src/features/canvas/editor/canvas-reducer.ts
import { canvasDataToRenderData } from "./render-map";
import { applyResize } from "./geometry-editor";
import { snapToGrid } from "./coords";
import { newId } from "./id";
import { GRID_SIZE, UNDO_LIMIT } from "./editor-types";
import type { CanvasData, CanvasNode } from "../types";
import type { EditorCommand, EditorState, Viewport } from "./editor-types";

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

const TEXT_W = 160;
const TEXT_H = 60;
const SHAPE_W = 120;
const SHAPE_H = 80;
const REF_W = 200;
const REF_H = 72;

/** Клонирует CanvasData (структурно, для снапшотов undo). */
function cloneData(data: CanvasData): CanvasData {
  return {
    nodes: (data.nodes ?? []).map((n) => ({ ...n })),
    edges: (data.edges ?? []).map((e) => ({ ...e })),
  };
}

/** Глубокое сравнение графов по сериализации (граф мал — дёшево). */
function dataEquals(a: CanvasData, b: CanvasData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Инициализирует состояние редактора из загруженного CanvasData. */
export function initEditorState(data: CanvasData): EditorState {
  const normalized: CanvasData = { nodes: data.nodes ?? [], edges: data.edges ?? [] };
  return {
    data: normalized,
    selection: { nodeIds: [], edgeIds: [] },
    viewport: { ...DEFAULT_VIEWPORT },
    past: [],
    future: [],
    baseline: cloneData(normalized),
    dirty: false,
    gridEnabled: true,
  };
}

/**
 * Применяет мутацию графа: пушит текущий снапшот в past (с лимитом), чистит
 * future, ставит новый data, пересчитывает dirty относительно baseline.
 * `nextData` — уже изменённый граф. `selection` — опц. новое выделение.
 */
function commit(state: EditorState, nextData: CanvasData, selection?: EditorState["selection"]): EditorState {
  const past = [...state.past, cloneData(state.data)];
  if (past.length > UNDO_LIMIT) past.shift();
  return {
    ...state,
    data: nextData,
    past,
    future: [],
    dirty: !dataEquals(nextData, state.baseline),
    ...(selection ? { selection } : {}),
  };
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function canvasReducer(state: EditorState, command: EditorCommand): EditorState {
  switch (command.type) {
    // ---------------- viewport ----------------
    case "panBy":
      return { ...state, viewport: { ...state.viewport, x: state.viewport.x + command.dx, y: state.viewport.y + command.dy } };
    case "setViewport":
      return { ...state, viewport: command.viewport };
    case "zoomAt": {
      // зум вычисляется в interaction-слое через applyZoomAtPoint и приходит как setViewport;
      // этот кейс оставлен для прямого вызова, повторяет coords.applyZoomAtPoint.
      const { factor, screenX, screenY } = command;
      const vp = state.viewport;
      const newZoom = Math.min(8, Math.max(0.1, vp.zoom * factor));
      const worldX = vp.x + screenX / vp.zoom;
      const worldY = vp.y + screenY / vp.zoom;
      return { ...state, viewport: { zoom: newZoom, x: worldX - screenX / newZoom, y: worldY - screenY / newZoom } };
    }
    case "toggleGrid":
      return { ...state, gridEnabled: !state.gridEnabled };

    // ---------------- selection ----------------
    case "selectNode":
      return {
        ...state,
        selection: command.additive
          ? { nodeIds: toggleId(state.selection.nodeIds, command.nodeId), edgeIds: state.selection.edgeIds }
          : { nodeIds: [command.nodeId], edgeIds: [] },
      };
    case "selectEdge":
      return {
        ...state,
        selection: command.additive
          ? { nodeIds: state.selection.nodeIds, edgeIds: toggleId(state.selection.edgeIds, command.edgeId) }
          : { nodeIds: [], edgeIds: [command.edgeId] },
      };
    case "selectMany":
      return { ...state, selection: { nodeIds: command.nodeIds, edgeIds: command.edgeIds } };
    case "clearSelection":
      return { ...state, selection: { nodeIds: [], edgeIds: [] } };

    // ---------------- add nodes ----------------
    case "addTextNode": {
      const id = newId();
      const node: CanvasNode = {
        id, type: "text",
        x: snapToGrid(command.x, state.gridEnabled), y: snapToGrid(command.y, state.gridEnabled),
        width: TEXT_W, height: TEXT_H, text: "",
      };
      return commit(state, { ...state.data, nodes: [...(state.data.nodes ?? []), node] }, { nodeIds: [id], edgeIds: [] });
    }
    case "addShapeNode": {
      const id = newId();
      const node: CanvasNode = {
        id, type: "shape",
        x: snapToGrid(command.x, state.gridEnabled), y: snapToGrid(command.y, state.gridEnabled),
        width: SHAPE_W, height: SHAPE_H, shape_kind: command.shapeKind,
      };
      return commit(state, { ...state.data, nodes: [...(state.data.nodes ?? []), node] }, { nodeIds: [id], edgeIds: [] });
    }
    case "addEntityRefNode": {
      const id = newId();
      const node: CanvasNode = {
        id, type: "entity_ref",
        x: snapToGrid(command.x, state.gridEnabled), y: snapToGrid(command.y, state.gridEnabled),
        width: REF_W, height: REF_H,
        entity_type: command.entityType, entity_id: command.entityId,
      };
      return commit(state, { ...state.data, nodes: [...(state.data.nodes ?? []), node] }, { nodeIds: [id], edgeIds: [] });
    }

    // ---------------- move / resize ----------------
    case "moveSelection": {
      const ids = new Set(state.selection.nodeIds);
      if (ids.size === 0) return state;
      const dx = snapToGrid(command.dx, false);
      const dy = snapToGrid(command.dy, false);
      const nodes = (state.data.nodes ?? []).map((n) =>
        n.id && ids.has(n.id) ? { ...n, x: (n.x ?? 0) + dx, y: (n.y ?? 0) + dy } : n,
      );
      return commit(state, { ...state.data, nodes });
    }
    case "resizeNode": {
      const nodes = (state.data.nodes ?? []).map((n) => {
        if (n.id !== command.nodeId) return n;
        const render = canvasDataToRenderData({ nodes: [n], edges: [] }).nodes[0];
        if (!render) return n;
        const r = applyResize(render, command.handle, command.dx, command.dy);
        return { ...n, x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
      });
      return commit(state, { ...state.data, nodes });
    }
    case "setNodeSize": {
      const nodes = (state.data.nodes ?? []).map((n) =>
        n.id === command.nodeId ? { ...n, width: Math.max(20, Math.round(command.width)), height: Math.max(20, Math.round(command.height)) } : n,
      );
      return commit(state, { ...state.data, nodes });
    }

    // ---------------- edit node ----------------
    case "setNodeText": {
      const nodes = (state.data.nodes ?? []).map((n) =>
        n.id === command.nodeId && (n.type === "text" || n.type === "shape") ? { ...n, text: command.text } : n,
      );
      return commit(state, { ...state.data, nodes });
    }
    case "setShapeKind": {
      const nodes = (state.data.nodes ?? []).map((n) =>
        n.id === command.nodeId && n.type === "shape" ? { ...n, shape_kind: command.shapeKind } : n,
      );
      return commit(state, { ...state.data, nodes });
    }

    // ---------------- edges ----------------
    case "addEdge": {
      if (command.fromNode === command.toNode) return state; // self-loop запрещаем в UI
      const id = newId();
      const edge = {
        id, from_node: command.fromNode, to_node: command.toNode,
        ...(command.fromSide ? { from_side: command.fromSide } : {}),
        ...(command.toSide ? { to_side: command.toSide } : {}),
      };
      return commit(state, { ...state.data, edges: [...(state.data.edges ?? []), edge] }, { nodeIds: [], edgeIds: [id] });
    }
    case "setEdgeLabel": {
      const edges = (state.data.edges ?? []).map((e) => (e.id === command.edgeId ? { ...e, label: command.label } : e));
      return commit(state, { ...state.data, edges });
    }
    case "setEdgeStyle": {
      const edges = (state.data.edges ?? []).map((e) => (e.id === command.edgeId ? { ...e, style: command.style } : e));
      return commit(state, { ...state.data, edges });
    }
    case "setEdgeEnd": {
      const edges = (state.data.edges ?? []).map((e) => (e.id === command.edgeId ? { ...e, end: command.end } : e));
      return commit(state, { ...state.data, edges });
    }
    case "setEdgeSides": {
      const edges = (state.data.edges ?? []).map((e) =>
        e.id === command.edgeId
          ? {
              ...e,
              ...(command.fromSide ? { from_side: command.fromSide } : { from_side: undefined }),
              ...(command.toSide ? { to_side: command.toSide } : { to_side: undefined }),
            }
          : e,
      );
      return commit(state, { ...state.data, edges });
    }

    // ---------------- delete ----------------
    case "deleteSelection": {
      const nodeIds = new Set(state.selection.nodeIds);
      const edgeIds = new Set(state.selection.edgeIds);
      if (nodeIds.size === 0 && edgeIds.size === 0) return state;
      const nodes = (state.data.nodes ?? []).filter((n) => !(n.id && nodeIds.has(n.id)));
      // удаляем выбранные рёбра + инцидентные удалённым узлам
      const edges = (state.data.edges ?? []).filter(
        (e) => !(e.id && edgeIds.has(e.id)) && !(e.from_node && nodeIds.has(e.from_node)) && !(e.to_node && nodeIds.has(e.to_node)),
      );
      return commit(state, { nodes, edges }, { nodeIds: [], edgeIds: [] });
    }

    // ---------------- history ----------------
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1]!;
      return {
        ...state,
        data: previous,
        past: state.past.slice(0, -1),
        future: [cloneData(state.data), ...state.future],
        dirty: !dataEquals(previous, state.baseline),
        selection: { nodeIds: [], edgeIds: [] },
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const next = state.future[0]!;
      return {
        ...state,
        data: next,
        past: [...state.past, cloneData(state.data)],
        future: state.future.slice(1),
        dirty: !dataEquals(next, state.baseline),
        selection: { nodeIds: [], edgeIds: [] },
      };
    }

    // ---------------- meta ----------------
    case "markSaved":
      return { ...state, baseline: cloneData(command.data), dirty: false };

    default:
      return state;
  }
}

export { GRID_SIZE };
```

- [x] **Шаг 4: Запустить — убедиться, что зелёные (тесты части 1)**

Run: `npm test -- src/features/canvas/editor/canvas-reducer.test.ts`
Expected: PASS (init/selection/viewport/add)

- [x] **Шаг 5: Commit**

```bash
git add src/features/canvas/editor/canvas-reducer.ts src/features/canvas/editor/canvas-reducer.test.ts
git commit -m "feat(canvas-editor): reducer core — init, selection, viewport, add nodes (TDD)"
```

---

### Задача 9: canvas-reducer.ts — тесты move/resize/edit/edge/delete/undo (TDD, часть 2)

Реализация уже написана в Задаче 8 (полный редьюсер). Здесь дописываем тесты на оставшиеся команды и фиксим, если что-то всплывёт.

**Files:**
- Modify: `src/features/canvas/editor/canvas-reducer.test.ts`

- [x] **Шаг 1: Дописать тесты (append в конец файла)**

```ts
// --- append to src/features/canvas/editor/canvas-reducer.test.ts ---

describe("move / resize", () => {
  it("moveSelection сдвигает выбранные узлы и делает dirty", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "selectNode", nodeId: "n1", additive: false });
    s = canvasReducer(s, { type: "moveSelection", dx: 10, dy: 20 });
    expect(s.data.nodes[0]?.x).toBe(10);
    expect(s.data.nodes[0]?.y).toBe(20);
    expect(s.data.nodes[1]?.x).toBe(200); // n2 не выбран — не двигается
    expect(s.dirty).toBe(true);
  });
  it("moveSelection без выделения — no-op", () => {
    const s0 = initEditorState(baseData);
    const s1 = canvasReducer(s0, { type: "moveSelection", dx: 10, dy: 10 });
    expect(s1).toBe(s0);
  });
  it("resizeNode se увеличивает размер", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "resizeNode", nodeId: "n2", handle: "se", dx: 20, dy: 10 });
    expect(s.data.nodes[1]?.width).toBe(100);
    expect(s.data.nodes[1]?.height).toBe(90);
  });
  it("setNodeSize клампит минимум 20", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "setNodeSize", nodeId: "n1", width: 5, height: 5 });
    expect(s.data.nodes[0]?.width).toBe(20);
    expect(s.data.nodes[0]?.height).toBe(20);
  });
});

describe("edit node", () => {
  it("setNodeText меняет текст text-узла", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "setNodeText", nodeId: "n1", text: "новый" });
    expect(s.data.nodes[0]?.text).toBe("новый");
  });
  it("setShapeKind меняет фигуру", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "setShapeKind", nodeId: "n2", shapeKind: "diamond" });
    expect(s.data.nodes[1]?.shape_kind).toBe("diamond");
  });
});

describe("edges", () => {
  it("addEdge создаёт ребро между разными узлами", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addEdge", fromNode: "n1", toNode: "n2", fromSide: "right", toSide: "left" });
    expect(s.data.edges).toHaveLength(1);
    expect(s.data.edges[0]).toMatchObject({ id: "gen-1", from_node: "n1", to_node: "n2", from_side: "right", to_side: "left" });
    expect(s.selection.edgeIds).toEqual(["gen-1"]);
  });
  it("addEdge self-loop — no-op", () => {
    const s0 = initEditorState(baseData);
    const s1 = canvasReducer(s0, { type: "addEdge", fromNode: "n1", toNode: "n1" });
    expect(s1).toBe(s0);
  });
  it("setEdgeLabel / setEdgeStyle / setEdgeEnd", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addEdge", fromNode: "n1", toNode: "n2" });
    const eid = s.data.edges[0]!.id!;
    s = canvasReducer(s, { type: "setEdgeLabel", edgeId: eid, label: "связь" });
    s = canvasReducer(s, { type: "setEdgeStyle", edgeId: eid, style: "dashed" });
    s = canvasReducer(s, { type: "setEdgeEnd", edgeId: eid, end: "none" });
    expect(s.data.edges[0]).toMatchObject({ label: "связь", style: "dashed", end: "none" });
  });
});

describe("delete", () => {
  it("deleteSelection удаляет узел и инцидентные рёбра", () => {
    let s = initEditorState({
      nodes: baseData.nodes,
      edges: [{ id: "e1", from_node: "n1", to_node: "n2" }],
    });
    s = canvasReducer(s, { type: "selectNode", nodeId: "n1", additive: false });
    s = canvasReducer(s, { type: "deleteSelection" });
    expect(s.data.nodes.map((n) => n.id)).toEqual(["n2"]);
    expect(s.data.edges).toHaveLength(0); // e1 инцидентно n1 → удалено
  });
  it("deleteSelection удаляет выбранное ребро, оставляя узлы", () => {
    let s = initEditorState({
      nodes: baseData.nodes,
      edges: [{ id: "e1", from_node: "n1", to_node: "n2" }],
    });
    s = canvasReducer(s, { type: "selectEdge", edgeId: "e1", additive: false });
    s = canvasReducer(s, { type: "deleteSelection" });
    expect(s.data.nodes).toHaveLength(2);
    expect(s.data.edges).toHaveLength(0);
  });
});

describe("undo / redo / dirty", () => {
  it("undo откатывает последнюю мутацию", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addTextNode", x: 0, y: 0 });
    expect(s.data.nodes).toHaveLength(3);
    s = canvasReducer(s, { type: "undo" });
    expect(s.data.nodes).toHaveLength(2);
    expect(s.dirty).toBe(false); // вернулись к baseline
  });
  it("redo возвращает откат", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addTextNode", x: 0, y: 0 });
    s = canvasReducer(s, { type: "undo" });
    s = canvasReducer(s, { type: "redo" });
    expect(s.data.nodes).toHaveLength(3);
    expect(s.dirty).toBe(true);
  });
  it("новая мутация чистит future", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addTextNode", x: 0, y: 0 });
    s = canvasReducer(s, { type: "undo" });
    s = canvasReducer(s, { type: "addShapeNode", shapeKind: "rect", x: 0, y: 0 });
    expect(s.future).toHaveLength(0);
    s = canvasReducer(s, { type: "redo" });
    expect(s.data.nodes).toHaveLength(3); // redo no-op (future пуст)
  });
  it("undo на пустом стеке — no-op", () => {
    const s0 = initEditorState(baseData);
    expect(canvasReducer(s0, { type: "undo" })).toBe(s0);
  });
  it("markSaved обновляет baseline и сбрасывает dirty", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "addTextNode", x: 0, y: 0 });
    expect(s.dirty).toBe(true);
    s = canvasReducer(s, { type: "markSaved", data: s.data });
    expect(s.dirty).toBe(false);
    // дальнейший undo вернёт к графу с 2 узлами, который теперь != baseline → dirty
    s = canvasReducer(s, { type: "undo" });
    expect(s.dirty).toBe(true);
  });
});
```

- [x] **Шаг 2: Запустить весь файл — убедиться, что всё зелёное**

Run: `npm test -- src/features/canvas/editor/canvas-reducer.test.ts`
Expected: PASS (все describe-блоки)

- [x] **Шаг 3: Прогнать ВСЕ юниты ядра**

Run: `npm test -- src/features/canvas/editor`
Expected: PASS (coords, render-map, validate, geometry-editor, canvas-reducer)

- [x] **Шаг 4: Commit**

```bash
git add src/features/canvas/editor/canvas-reducer.test.ts
git commit -m "test(canvas-editor): reducer move/resize/edit/edge/delete/undo coverage"
```

---

### Задача 10: editor/index.ts — public API ядра

Барель ядра для UI-слоя. Экспортирует редьюсер, init, типы, чистые утилиты.

**Files:**
- Create: `src/features/canvas/editor/index.ts`

- [x] **Шаг 1: Записать**

```ts
// src/features/canvas/editor/index.ts
export { canvasReducer, initEditorState } from "./canvas-reducer";
export { newId } from "./id";
export { screenToWorld, worldToScreen, applyZoomAtPoint, snapToGrid, snapPoint } from "./coords";
export { canvasDataToRenderData } from "./render-map";
export { validateGraph } from "./validate";
export type { GraphError, GraphValidation } from "./validate";
export {
  pointInRect,
  hitTestNode,
  resizeHandles,
  handleAtPoint,
  applyResize,
  marqueeHits,
} from "./geometry-editor";
export type { Rect } from "./geometry-editor";
export type {
  EditorState,
  EditorCommand,
  Selection,
  Viewport,
  ResizeHandle,
  EntityRefDraft,
  Side,
} from "./editor-types";
export { GRID_SIZE, UNDO_LIMIT } from "./editor-types";
```

- [x] **Шаг 2: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "editor/index" || echo OK`
Expected: `OK`

- [x] **Шаг 3: Commit**

```bash
git add src/features/canvas/editor/index.ts
git commit -m "feat(canvas-editor): core public API barrel"
```

---

> **MIDPOINT здесь.** Ядро готово и протестировано. Дальше interaction-слой (тестами не покрываем — конвенция). Можно разделить на 2 исполнителей: A — рендер-слои (Задачи 11-12), B — тулбар/inspector/overlay/dialog/корень/страница (Задачи 13-18). B стартует после мержа A (canvas-editor собирает рендер-слои).

---

### Задача 11: editor-edge-layer.tsx — рендер рёбер + preview

Client-компонент: рисует рёбра через `edgePath` (переиспякание геометрии), preview-линию создаваемого ребра, выделение. Чистый презентационный слой — получает данные и колбэки пропами.

**Files:**
- Create: `src/features/canvas/ui/editor-edge-layer.tsx`

- [x] **Шаг 1: Записать**

```tsx
"use client";
// src/features/canvas/ui/editor-edge-layer.tsx
import { edgePath } from "@/components/canvas-render";
import type { Point, RenderNode, RenderEdge } from "@/components/canvas-render";

interface Props {
  edges: RenderEdge[];
  nodesById: Map<string, RenderNode>;
  selectedEdgeIds: Set<string>;
  /** Превью создаваемого ребра: от точки старта к текущей точке курсора (мировые). */
  preview?: { from: Point; to: Point } | undefined;
  onEdgePointerDown: (edgeId: string, e: React.PointerEvent) => void;
}

/**
 * SVG-слой рёбер редактора. Геометрия — та же edgePath, что в read-only
 * рендере (одна система рендеринга). Выделенное ребро подсвечивается;
 * preview-линия рисуется поверх во время drag-создания.
 */
export function EditorEdgeLayer({ edges, nodesById, selectedEdgeIds, preview, onEdgePointerDown }: Props) {
  return (
    <g data-layer="edges">
      {edges.map((e) => {
        const from = nodesById.get(e.fromNode);
        const to = nodesById.get(e.toNode);
        if (!from || !to) return null;
        const geo = edgePath(from, to, e.fromSide, e.toSide);
        const selected = selectedEdgeIds.has(e.id);
        const arrow = (e.end ?? "arrow") === "arrow";
        return (
          <g key={e.id}>
            {/* широкая прозрачная подложка для удобного клика */}
            <path
              d={geo.d}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              style={{ cursor: "pointer" }}
              onPointerDown={(ev) => onEdgePointerDown(e.id, ev)}
            />
            <path
              d={geo.d}
              fill="none"
              stroke={selected ? "var(--color-primary)" : "var(--color-description)"}
              strokeWidth={selected ? 2.5 : 1.5}
              strokeDasharray={e.style === "dashed" ? "6 4" : undefined}
              markerEnd={arrow ? "url(#cv-arrow)" : undefined}
              pointerEvents="none"
            />
            {e.label && (
              <text x={geo.mid.x} y={geo.mid.y - 4} fontSize={11} textAnchor="middle" fill="var(--color-description)" pointerEvents="none">
                {e.label.length > 40 ? e.label.slice(0, 39) + "…" : e.label}
              </text>
            )}
          </g>
        );
      })}
      {preview && (
        <path
          d={`M ${preview.from.x} ${preview.from.y} L ${preview.to.x} ${preview.to.y}`}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={2}
          strokeDasharray="4 4"
          pointerEvents="none"
        />
      )}
    </g>
  );
}
```

- [x] **Шаг 2: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "editor-edge-layer" || echo OK`
Expected: `OK`

- [x] **Шаг 3: Commit**

```bash
git add src/features/canvas/ui/editor-edge-layer.tsx
git commit -m "feat(canvas-editor): edge render layer with preview + selection"
```

---

### Задача 12: editor-node-layer.tsx — рендер узлов + рамки выделения + ручки + side-handles

Client-компонент: рисует узлы через `NodeShapeRender` (переиспользование), рамку выделения, 8 ручек ресайза на одиночном выделении, 4 side-handle для старта ребра. Презентационный — данные и колбэки пропами.

**Files:**
- Create: `src/features/canvas/ui/editor-node-layer.tsx`

- [x] **Шаг 1: Записать**

```tsx
"use client";
// src/features/canvas/ui/editor-node-layer.tsx
import { NodeShapeRender, sidePoint } from "@/components/canvas-render";
import type { RenderNode, Side, EntityRefResolver } from "@/components/canvas-render";
import { resizeHandles } from "../editor";
import type { ResizeHandle } from "../editor";

const SIDES: Side[] = ["top", "right", "bottom", "left"];

interface Props {
  nodes: RenderNode[];
  selectedNodeIds: Set<string>;
  resolveEntityRef: EntityRefResolver;
  /** id узла с ошибкой валидации — подсвечивается красным. */
  invalidNodeId?: string | undefined;
  onNodePointerDown: (nodeId: string, e: React.PointerEvent) => void;
  onNodeDoubleClick: (nodeId: string, e: React.MouseEvent) => void;
  onResizeHandleDown: (nodeId: string, handle: ResizeHandle, e: React.PointerEvent) => void;
  onSideHandleDown: (nodeId: string, side: Side, e: React.PointerEvent) => void;
}

/**
 * SVG-слой узлов редактора. Сами узлы рисуются NodeShapeRender (та же
 * презентация, что read-only рендер). Поверх выбранного узла — рамка,
 * на одиночном выделении — 8 ручек ресайза и 4 side-handle для старта ребра.
 */
export function EditorNodeLayer({
  nodes, selectedNodeIds, resolveEntityRef, invalidNodeId,
  onNodePointerDown, onNodeDoubleClick, onResizeHandleDown, onSideHandleDown,
}: Props) {
  const singleSelected = selectedNodeIds.size === 1 ? nodes.find((n) => selectedNodeIds.has(n.id)) ?? null : null;

  return (
    <g data-layer="nodes">
      {nodes.map((n) => {
        const selected = selectedNodeIds.has(n.id);
        const invalid = n.id === invalidNodeId;
        return (
          <g
            key={n.id}
            style={{ cursor: "move" }}
            onPointerDown={(e) => onNodePointerDown(n.id, e)}
            onDoubleClick={(e) => onNodeDoubleClick(n.id, e)}
          >
            <NodeShapeRender node={n} resolve={resolveEntityRef} />
            {(selected || invalid) && (
              <rect
                x={n.x - 2} y={n.y - 2} width={n.width + 4} height={n.height + 4}
                fill="none"
                stroke={invalid ? "var(--color-danger)" : "var(--color-primary)"}
                strokeWidth={1.5}
                strokeDasharray={invalid ? "4 2" : undefined}
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}

      {/* side-handles на одиночном выделении — старт ребра */}
      {singleSelected && SIDES.map((side) => {
        const p = sidePoint(singleSelected, side);
        return (
          <circle
            key={`side-${side}`}
            cx={p.x} cy={p.y} r={5}
            fill="var(--color-background)" stroke="var(--color-primary)" strokeWidth={1.5}
            style={{ cursor: "crosshair" }}
            onPointerDown={(e) => onSideHandleDown(singleSelected.id, side, e)}
          />
        );
      })}

      {/* 8 ручек ресайза на одиночном выделении */}
      {singleSelected && (Object.entries(resizeHandles(singleSelected)) as [ResizeHandle, { x: number; y: number }][]).map(([handle, p]) => (
        <rect
          key={`rh-${handle}`}
          x={p.x - 4} y={p.y - 4} width={8} height={8}
          fill="var(--color-primary)"
          style={{ cursor: `${handle}-resize` }}
          onPointerDown={(e) => onResizeHandleDown(singleSelected.id, handle, e)}
        />
      ))}
    </g>
  );
}
```

- [x] **Шаг 2: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "editor-node-layer" || echo OK`
Expected: `OK`

- [x] **Шаг 3: Commit**

```bash
git add src/features/canvas/ui/editor-node-layer.tsx
git commit -m "feat(canvas-editor): node render layer with selection frame, resize + side handles"
```

---

### Задача 13: entity-ref-dialog.tsx — диалог создания entity_ref

Client-компонент: модалка выбора типа сущности + пикер (для 5 типов) ИЛИ ручной ввод id. Вызывает колбэк `onConfirm(entityType, entityId)`.

**Files:**
- Create: `src/features/canvas/ui/entity-ref-dialog.tsx`

- [x] **Шаг 1: Записать**

```tsx
"use client";
// src/features/canvas/ui/entity-ref-dialog.tsx
import { useState } from "react";
import { Dialog, Select, TextInput, Button } from "@/components/ui";
import { DocumentPicker } from "@/components/ast-editor/pickers/document-picker";
import { LecturePicker } from "@/components/ast-editor/pickers/lecture-picker";
import { GlossaryPicker } from "@/components/ast-editor/pickers/glossary-picker";
import { MediaPicker } from "@/components/ast-editor/pickers/media-picker";
import { CanvasPicker } from "@/components/ast-editor/pickers/canvas-picker";

/** Все 10 типов entity_ref (порядок UI). */
const ENTITY_TYPES: { value: string; label: string }[] = [
  { value: "document", label: "Документ" },
  { value: "lecture", label: "Лекция" },
  { value: "glossary", label: "Глоссарий" },
  { value: "media", label: "Медиа" },
  { value: "canvas", label: "Канвас" },
  { value: "comment", label: "Комментарий" },
  { value: "annotation", label: "Аннотация" },
  { value: "form", label: "Форма" },
  { value: "banner", label: "Баннер" },
  { value: "event", label: "Событие" },
];

/** Типы с готовым AsyncCombobox-пикером. Остальные — ручной ввод id. */
const PICKER_TYPES = new Set(["document", "lecture", "glossary", "media", "canvas"]);

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (entityType: string, entityId: string) => void;
}

/**
 * Диалог создания entity_ref-узла. Для 5 типов с пикером (document/lecture/
 * glossary/media/canvas) показывает AsyncCombobox; для остальных — поле ручного
 * ввода id. anchor не задаётся (вне MVP — entity_ref без anchor валиден для
 * всех типов). Бек проверит существование+видимость цели при сохранении.
 *
 * Контракт Dialog (подтверждён по src/components/ui/dialog.tsx): контролируемый
 * режим через `open` + `onOpenChange(next: boolean)`; `title` обязателен.
 * Колбэк onOpenChange(false) ⇒ закрытие.
 */
export function EntityRefDialog({ open, onClose, onConfirm }: Props) {
  const [entityType, setEntityType] = useState("document");
  const [manualId, setManualId] = useState("");

  const usePicker = PICKER_TYPES.has(entityType);

  const reset = () => {
    setManualId("");
    onClose();
  };
  const pick = (id: string) => {
    onConfirm(entityType, id);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next) reset(); }}
      title="Добавить ссылку на сущность"
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Тип сущности
          <Select
            name="entity_type"
            value={entityType}
            onValueChange={setEntityType}
            options={ENTITY_TYPES}
          />
        </label>

        {usePicker ? (
          <div className="entity-ref-picker">
            {entityType === "document" && <DocumentPicker onSelect={(id) => pick(id)} />}
            {entityType === "lecture" && <LecturePicker onSelect={(id) => pick(id)} />}
            {entityType === "glossary" && <GlossaryPicker onSelect={(id) => pick(id)} />}
            {entityType === "media" && <MediaPicker onSelect={(id) => pick(id)} />}
            {entityType === "canvas" && <CanvasPicker onSelect={(id) => pick(id)} />}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-sm">
              ID сущности (UUID)
              <TextInput
                name="entity_id"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </label>
            <Button
              type="button"
              disabled={manualId.trim() === ""}
              onClick={() => manualId.trim() && pick(manualId.trim())}
            >
              Добавить
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
```

> **ПРИМЕЧАНИЕ исполнителю (контракты подтверждены по коду UI-kit):**
> - `Dialog` (`src/components/ui/dialog.tsx`): контролируемый режим `open?: boolean` + `onOpenChange?: (open: boolean) => void`; `title: ReactNode` ОБЯЗАТЕЛЕН; `children`. Нет пропа `onClose` — закрытие ловим через `onOpenChange(false)` (см. листинг выше).
> - `Select` (`src/components/ui/select.tsx`): `value?: string`, `onValueChange?: (value: string) => void`, `options: {value,label}[]`, опц. `name`. Использовано верно.
> - `TextInput` (`src/components/ui/text-input.tsx`): стандартные input-пропсы (`value`/`onChange`/`type`/`placeholder`/`maxLength`).
> - Пикеры: `onSelect: (id: string, label: string) => void` — подтверждено для document/lecture/glossary/media/canvas.
> Если какая-то деталь всё же разойдётся — подстраивайся под UI-kit (запретная зона, НЕ меняем его).

- [x] **Шаг 2: Сверить TextInput (быстрая проверка)**

Run: `grep -nE "interface|Props|value|onChange|type|maxLength" src/components/ui/text-input.tsx | head -10`
Действие: при расхождении пропов TextInput — поправить вызовы под фактическую сигнатуру.

- [x] **Шаг 3: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "entity-ref-dialog" || echo OK`
Expected: `OK`

- [x] **Шаг 4: Commit**

```bash
git add src/features/canvas/ui/entity-ref-dialog.tsx
git commit -m "feat(canvas-editor): entity_ref creation dialog (pickers + manual id fallback)"
```

---

### Задача 14: editor-inspector.tsx — инспектор свойств узла/ребра

Client-компонент: панель свойств выбранного одиночного узла (shape_kind, размеры) или ребра (label, style, end, стороны). Диспатчит команды.

**Files:**
- Create: `src/features/canvas/ui/editor-inspector.tsx`

- [x] **Шаг 1: Записать**

```tsx
"use client";
// src/features/canvas/ui/editor-inspector.tsx
import { Select, TextInput } from "@/components/ui";
import type { CanvasData } from "../types";
import type { EditorCommand, Side } from "../editor";

const SIDE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "авто" },
  { value: "top", label: "сверху" },
  { value: "right", label: "справа" },
  { value: "bottom", label: "снизу" },
  { value: "left", label: "слева" },
];

interface Props {
  data: CanvasData;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  dispatch: (c: EditorCommand) => void;
}

/**
 * Инспектор: свойства одиночно выбранного узла или ребра. Для shape — выбор
 * фигуры; для всех — размеры (через setNodeSize). Для ребра — label/style/end/
 * стороны. При множественном/пустом выделении показывает подсказку.
 */
export function EditorInspector({ data, selectedNodeIds, selectedEdgeIds, dispatch }: Props) {
  const node = selectedNodeIds.length === 1 ? (data.nodes ?? []).find((n) => n.id === selectedNodeIds[0]) : undefined;
  const edge = selectedEdgeIds.length === 1 ? (data.edges ?? []).find((e) => e.id === selectedEdgeIds[0]) : undefined;

  if (!node && !edge) {
    return <p className="text-sm text-(--color-description)">Выберите узел или ребро.</p>;
  }

  if (node) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Узел: {node.type}</h3>
        {node.type === "shape" && (
          <label className="flex flex-col gap-1 text-sm">
            Фигура
            <Select
              name="shape_kind"
              value={node.shape_kind ?? "rect"}
              onValueChange={(v) => dispatch({ type: "setShapeKind", nodeId: node.id!, shapeKind: v as "rect" | "ellipse" | "diamond" })}
              options={[
                { value: "rect", label: "Прямоугольник" },
                { value: "ellipse", label: "Эллипс" },
                { value: "diamond", label: "Ромб" },
              ]}
            />
          </label>
        )}
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Ширина
            <TextInput
              type="number"
              value={String(node.width ?? 0)}
              onChange={(e) => dispatch({ type: "setNodeSize", nodeId: node.id!, width: Number(e.target.value), height: node.height ?? 0 })}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Высота
            <TextInput
              type="number"
              value={String(node.height ?? 0)}
              onChange={(e) => dispatch({ type: "setNodeSize", nodeId: node.id!, width: node.width ?? 0, height: Number(e.target.value) })}
            />
          </label>
        </div>
        {node.type === "entity_ref" && (
          <p className="text-xs text-(--color-description)">
            {node.entity_type}: {node.entity_id}
          </p>
        )}
      </div>
    );
  }

  // edge
  const sideValue = (s: Side | undefined) => s ?? "";
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Ребро</h3>
      <label className="flex flex-col gap-1 text-sm">
        Подпись
        <TextInput
          value={edge!.label ?? ""}
          maxLength={200}
          onChange={(e) => dispatch({ type: "setEdgeLabel", edgeId: edge!.id!, label: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Стиль
        <Select
          name="style"
          value={edge!.style ?? "solid"}
          onValueChange={(v) => dispatch({ type: "setEdgeStyle", edgeId: edge!.id!, style: v as "solid" | "dashed" })}
          options={[{ value: "solid", label: "Сплошная" }, { value: "dashed", label: "Пунктир" }]}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Конец
        <Select
          name="end"
          value={edge!.end ?? "arrow"}
          onValueChange={(v) => dispatch({ type: "setEdgeEnd", edgeId: edge!.id!, end: v as "none" | "arrow" })}
          options={[{ value: "arrow", label: "Стрелка" }, { value: "none", label: "Без стрелки" }]}
        />
      </label>
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          От стороны
          <Select
            name="from_side"
            value={sideValue(edge!.from_side)}
            onValueChange={(v) => dispatch({ type: "setEdgeSides", edgeId: edge!.id!, fromSide: (v || undefined) as Side | undefined, toSide: edge!.to_side })}
            options={SIDE_OPTIONS}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          К стороне
          <Select
            name="to_side"
            value={sideValue(edge!.to_side)}
            onValueChange={(v) => dispatch({ type: "setEdgeSides", edgeId: edge!.id!, fromSide: edge!.from_side, toSide: (v || undefined) as Side | undefined })}
            options={SIDE_OPTIONS}
          />
        </label>
      </div>
    </div>
  );
}
```

> **ПРИМЕЧАНИЕ:** сверь сигнатуру `Select`/`TextInput` (онъ value/onValueChange vs onChange) — см. примечание Задачи 13. Адаптируй под фактический контракт UI-kit, не меняя сам UI-kit.

- [x] **Шаг 2: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "editor-inspector" || echo OK`
Expected: `OK`

- [x] **Шаг 3: Commit**

```bash
git add src/features/canvas/ui/editor-inspector.tsx
git commit -m "feat(canvas-editor): inspector panel for node/edge properties"
```

---

### Задача 15: editor-text-overlay.tsx — inline textarea для редактирования текста

Client-компонент: HTML textarea, позиционируемый поверх SVG в экранных координатах (через worldToScreen). Появляется по double-click на text/shape узле. На blur/Enter — `setNodeText`.

**Files:**
- Create: `src/features/canvas/ui/editor-text-overlay.tsx`

- [x] **Шаг 1: Записать**

```tsx
"use client";
// src/features/canvas/ui/editor-text-overlay.tsx
import { useEffect, useRef, useState } from "react";
import { worldToScreen } from "../editor";
import type { Viewport } from "../editor";
import type { CanvasNode } from "../types";

interface Props {
  node: CanvasNode;
  viewport: Viewport;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

/**
 * Inline-редактирование текста узла. HTML <textarea> позиционируется абсолютно
 * поверх SVG-холста в ЭКРАННЫХ координатах (worldToScreen от мировых node.x/y),
 * масштабируется по zoom. Enter (без Shift) или blur — коммит; Esc — отмена.
 * SVG <foreignObject> избегаем: HTML-оверлей надёжнее работает с фокусом/IME.
 */
export function EditorTextOverlay({ node, viewport, onCommit, onCancel }: Props) {
  const [value, setValue] = useState(node.text ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const screen = worldToScreen({ x: node.x ?? 0, y: node.y ?? 0 }, viewport);
  const w = (node.width ?? 100) * viewport.zoom;
  const h = (node.height ?? 40) * viewport.zoom;

  return (
    <textarea
      ref={ref}
      value={value}
      maxLength={10000}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onCommit(value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
        e.stopPropagation();
      }}
      style={{
        position: "absolute",
        left: screen.x,
        top: screen.y,
        width: w,
        height: h,
        fontSize: 12 * viewport.zoom,
        padding: 4,
        boxSizing: "border-box",
        resize: "none",
        border: "1px solid var(--color-primary)",
        background: "var(--color-background)",
        color: "var(--color-foreground)",
        zIndex: 10,
      }}
    />
  );
}
```

- [x] **Шаг 2: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "editor-text-overlay" || echo OK`
Expected: `OK`

- [x] **Шаг 3: Commit**

```bash
git add src/features/canvas/ui/editor-text-overlay.tsx
git commit -m "feat(canvas-editor): inline textarea overlay for node text editing"
```

---

### Задача 16: editor-toolbar.tsx — тулбар

Client-компонент: кнопки создания/удаления/undo/redo/сетки/сохранения/JSON-тоггла/назад. Диспатчит команды и вызывает колбэки.

**Files:**
- Create: `src/features/canvas/ui/editor-toolbar.tsx`

- [x] **Шаг 1: Записать**

```tsx
"use client";
// src/features/canvas/ui/editor-toolbar.tsx
import { Button } from "@/components/ui";
import type { EditorCommand } from "../editor";

interface Props {
  dispatch: (c: EditorCommand) => void;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  gridEnabled: boolean;
  saving: boolean;
  showJson: boolean;
  hasSelection: boolean;
  onAddText: () => void;
  onAddShape: (kind: "rect" | "ellipse" | "diamond") => void;
  onAddEntityRef: () => void;
  onSave: () => void;
  onToggleJson: () => void;
  onBack: () => void;
}

/** Тулбар редактора: создание узлов, удаление, история, сетка, сохранение. */
export function EditorToolbar({
  dispatch, canUndo, canRedo, dirty, gridEnabled, saving, showJson, hasSelection,
  onAddText, onAddShape, onAddEntityRef, onSave, onToggleJson, onBack,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-(--color-border) p-2">
      <Button type="button" size="sm" variant="ghost" onClick={onBack}>← Назад</Button>
      <span className="mx-1 h-5 w-px bg-(--color-border)" />

      <Button type="button" size="sm" onClick={onAddText}>Текст</Button>
      <Button type="button" size="sm" onClick={() => onAddShape("rect")}>Прямоуг.</Button>
      <Button type="button" size="sm" onClick={() => onAddShape("ellipse")}>Эллипс</Button>
      <Button type="button" size="sm" onClick={() => onAddShape("diamond")}>Ромб</Button>
      <Button type="button" size="sm" onClick={onAddEntityRef}>Ссылка</Button>

      <span className="mx-1 h-5 w-px bg-(--color-border)" />
      <Button type="button" size="sm" variant="danger" disabled={!hasSelection} onClick={() => dispatch({ type: "deleteSelection" })}>
        Удалить
      </Button>

      <span className="mx-1 h-5 w-px bg-(--color-border)" />
      <Button type="button" size="sm" variant="ghost" disabled={!canUndo} onClick={() => dispatch({ type: "undo" })} aria-label="Отменить">↶</Button>
      <Button type="button" size="sm" variant="ghost" disabled={!canRedo} onClick={() => dispatch({ type: "redo" })} aria-label="Повторить">↷</Button>

      <span className="mx-1 h-5 w-px bg-(--color-border)" />
      <Button type="button" size="sm" variant={gridEnabled ? "primary" : "ghost"} onClick={() => dispatch({ type: "toggleGrid" })}>
        Сетка
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onToggleJson}>
        {showJson ? "Холст" : "JSON"}
      </Button>

      <span className="ml-auto flex items-center gap-2">
        {dirty && <span className="text-xs text-(--color-description)">Есть несохранённые изменения</span>}
        <Button type="button" size="sm" variant="primary" disabled={saving || !dirty} onClick={onSave}>
          {saving ? "Сохранение…" : "Сохранить"}
        </Button>
      </span>
    </div>
  );
}
```

> **ПРИМЕЧАНИЕ:** сверь доступные `ButtonVariant`/`ButtonSize` в `src/components/ui/button.tsx`. Если `"ghost"`/`"danger"`/`"primary"`/`size="sm"` не существуют — замени на фактические варианты. UI-kit не меняем.

- [x] **Шаг 2: Сверить варианты Button**

Run: `grep -n "ButtonVariant\|ButtonSize\|variant\|size" src/components/ui/button.tsx | head -20`
Действие: при расхождении — подставить реальные значения вариантов/размеров.

- [x] **Шаг 3: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "editor-toolbar" || echo OK`
Expected: `OK`

- [x] **Шаг 4: Commit**

```bash
git add src/features/canvas/ui/editor-toolbar.tsx
git commit -m "feat(canvas-editor): toolbar — create/delete/history/grid/save/json"
```

---

### Задача 17: canvas-editor.tsx — корневой interaction-компонент

Сердце interaction-слоя. `useReducer`, SVG-холст с viewBox-трансформом, pointer/keyboard-обработчики (pan/zoom/select/move/resize/marquee/edge-create), сборка слоёв, текст-оверлей, инспектор, диалог, сохранение через `updateCanvas`, dirty-guard.

**Files:**
- Create: `src/features/canvas/ui/canvas-editor.tsx`

- [x] **Шаг 1: Записать**

```tsx
"use client";
// src/features/canvas/ui/canvas-editor.tsx
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import type { Point, RenderNode, Side } from "@/components/canvas-render";
import { resolveEntityRefView } from "../entity-ref";
import { updateCanvas } from "../actions";
import type { Canvas, CanvasData } from "../types";
import {
  canvasReducer, initEditorState, canvasDataToRenderData,
  screenToWorld, applyZoomAtPoint, snapPoint, validateGraph, hitTestNode,
} from "../editor";
import type { EditorCommand, ResizeHandle } from "../editor";
import { EditorToolbar } from "./editor-toolbar";
import { EditorNodeLayer } from "./editor-node-layer";
import { EditorEdgeLayer } from "./editor-edge-layer";
import { EditorTextOverlay } from "./editor-text-overlay";
import { EditorInspector } from "./editor-inspector";
import { EntityRefDialog } from "./entity-ref-dialog";
import { CanvasEditForm } from "./canvas-edit-form";

interface Props {
  canvas: Canvas;
  etag: string | null;
}

/** Тип активного drag-жеста. */
type Drag =
  | { kind: "pan"; startScreen: Point; startVp: { x: number; y: number } }
  | { kind: "move"; lastWorld: Point }
  | { kind: "resize"; nodeId: string; handle: ResizeHandle; lastWorld: Point }
  | { kind: "marquee"; startWorld: Point; currentWorld: Point }
  | { kind: "edge"; fromNode: string; fromSide: Side; currentWorld: Point }
  | null;

/**
 * Клиентский визуальный редактор графа канваса. Тонкий interaction-слой над
 * чистым ядром (canvasReducer): pointer/keyboard → команды. Рендер через
 * переиспользуемые canvas-render примитивы. Сохранение — existing updateCanvas
 * (If-Match по etag). Тестами НЕ покрывается (конвенция ast-editor).
 */
export function CanvasEditor({ canvas, etag }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [state, rawDispatch] = useReducer(canvasReducer, canvas.data ?? { nodes: [], edges: [] }, initEditorState);
  const dispatch = useCallback((c: EditorCommand) => rawDispatch(c), []);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [refDialogOpen, setRefDialogOpen] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invalidNodeId, setInvalidNodeId] = useState<string | undefined>(undefined);
  const [size, setSize] = useState({ width: 800, height: 600 });

  // dirty-guard: beforeunload при несохранённых изменениях
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.dirty]);

  // измеряем контейнер для viewBox
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const renderData = useMemo(() => canvasDataToRenderData(state.data), [state.data]);
  const nodesById = useMemo(() => new Map<string, RenderNode>(renderData.nodes.map((n) => [n.id, n])), [renderData.nodes]);
  const selectedNodeIds = useMemo(() => new Set(state.selection.nodeIds), [state.selection.nodeIds]);
  const selectedEdgeIds = useMemo(() => new Set(state.selection.edgeIds), [state.selection.edgeIds]);

  const vp = state.viewport;
  // viewBox: мировые координаты видимой области = viewport.{x,y} + размер/zoom
  const viewBox = `${vp.x} ${vp.y} ${size.width / vp.zoom} ${size.height / vp.zoom}`;

  /** Экранные координаты события (относительно SVG) → мировые. */
  const eventWorld = useCallback((e: { clientX: number; clientY: number }): Point => {
    const rect = svgRef.current?.getBoundingClientRect();
    const sx = e.clientX - (rect?.left ?? 0);
    const sy = e.clientY - (rect?.top ?? 0);
    return screenToWorld({ x: sx, y: sy }, state.viewport);
  }, [state.viewport]);

  // ---- pointer handlers ----
  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return; // клик именно по фону
    const world = eventWorld(e);
    if (e.shiftKey) {
      dragRef.current = { kind: "marquee", startWorld: world, currentWorld: world };
    } else {
      dispatch({ type: "clearSelection" });
      dragRef.current = { kind: "pan", startScreen: { x: e.clientX, y: e.clientY }, startVp: { x: vp.x, y: vp.y } };
    }
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const onNodePointerDown = (nodeId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    if (!selectedNodeIds.has(nodeId)) {
      dispatch({ type: "selectNode", nodeId, additive: e.shiftKey });
    } else if (e.shiftKey) {
      dispatch({ type: "selectNode", nodeId, additive: true });
    }
    dragRef.current = { kind: "move", lastWorld: eventWorld(e) };
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onResizeHandleDown = (nodeId: string, handle: ResizeHandle, e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = { kind: "resize", nodeId, handle, lastWorld: eventWorld(e) };
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onSideHandleDown = (nodeId: string, side: Side, e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = { kind: "edge", fromNode: nodeId, fromSide: side, currentWorld: eventWorld(e) };
    svgRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onEdgePointerDown = (edgeId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    dispatch({ type: "selectEdge", edgeId, additive: e.shiftKey });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const world = eventWorld(e);
    switch (drag.kind) {
      case "pan": {
        const dxScreen = e.clientX - drag.startScreen.x;
        const dyScreen = e.clientY - drag.startScreen.y;
        dispatch({ type: "setViewport", viewport: { ...vp, x: drag.startVp.x - dxScreen / vp.zoom, y: drag.startVp.y - dyScreen / vp.zoom } });
        break;
      }
      case "move": {
        dispatch({ type: "moveSelection", dx: world.x - drag.lastWorld.x, dy: world.y - drag.lastWorld.y });
        drag.lastWorld = world;
        break;
      }
      case "resize": {
        dispatch({ type: "resizeNode", nodeId: drag.nodeId, handle: drag.handle, dx: world.x - drag.lastWorld.x, dy: world.y - drag.lastWorld.y });
        drag.lastWorld = world;
        break;
      }
      case "marquee":
        drag.currentWorld = world;
        // marquee-рамку рендерим из dragRef через force-update тиком ниже
        setMarquee({ x: Math.min(drag.startWorld.x, world.x), y: Math.min(drag.startWorld.y, world.y), width: Math.abs(world.x - drag.startWorld.x), height: Math.abs(world.y - drag.startWorld.y) });
        break;
      case "edge":
        drag.currentWorld = world;
        setEdgePreview({ from: nodesById.get(drag.fromNode) ? sideWorld(drag.fromNode, drag.fromSide) : world, to: world });
        break;
    }
  };

  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [edgePreview, setEdgePreview] = useState<{ from: Point; to: Point } | null>(null);

  /** Мировая точка стороны узла (для preview ребра). */
  const sideWorld = useCallback((nodeId: string, side: Side): Point => {
    const n = nodesById.get(nodeId);
    if (!n) return { x: 0, y: 0 };
    switch (side) {
      case "top": return { x: n.x + n.width / 2, y: n.y };
      case "right": return { x: n.x + n.width, y: n.y + n.height / 2 };
      case "bottom": return { x: n.x + n.width / 2, y: n.y + n.height };
      case "left": return { x: n.x, y: n.y + n.height / 2 };
    }
  }, [nodesById]);

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.kind === "marquee") {
      const world = eventWorld(e);
      const rect = { x: Math.min(drag.startWorld.x, world.x), y: Math.min(drag.startWorld.y, world.y), width: Math.abs(world.x - drag.startWorld.x), height: Math.abs(world.y - drag.startWorld.y) };
      const { marqueeHits } = require("../editor") as typeof import("../editor");
      const ids = marqueeHits(rect, renderData.nodes);
      dispatch({ type: "selectMany", nodeIds: ids, edgeIds: [] });
      setMarquee(null);
    } else if (drag.kind === "edge") {
      const world = eventWorld(e);
      const target = hitTestNode(world, renderData.nodes);
      if (target && target.id !== drag.fromNode) {
        dispatch({ type: "addEdge", fromNode: drag.fromNode, toNode: target.id, fromSide: drag.fromSide });
      }
      setEdgePreview(null);
    }
  };

  // ---- wheel zoom ----
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    const sx = e.clientX - (rect?.left ?? 0);
    const sy = e.clientY - (rect?.top ?? 0);
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    dispatch({ type: "setViewport", viewport: applyZoomAtPoint(vp, factor, sx, sy) });
  };

  // ---- keyboard ----
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editingNodeId) return; // текст-оверлей перехватывает
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      dispatch({ type: "deleteSelection" });
    } else if (e.key === "Escape") {
      dispatch({ type: "clearSelection" });
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      dispatch(e.shiftKey ? { type: "redo" } : { type: "undo" });
    }
  };

  // ---- node double-click → текст-оверлей (text/shape) ----
  const onNodeDoubleClick = (nodeId: string) => {
    const node = (state.data.nodes ?? []).find((n) => n.id === nodeId);
    if (node && (node.type === "text" || node.type === "shape")) {
      dispatch({ type: "selectNode", nodeId, additive: false });
      setEditingNodeId(nodeId);
    }
  };

  // ---- create-node helpers (центр вьюпорта) ----
  const viewportCenterWorld = useCallback((): Point => {
    return snapPoint(screenToWorld({ x: size.width / 2, y: size.height / 2 }, vp), state.gridEnabled);
  }, [size, vp, state.gridEnabled]);

  const onAddText = () => { const c = viewportCenterWorld(); dispatch({ type: "addTextNode", x: c.x, y: c.y }); };
  const onAddShape = (kind: "rect" | "ellipse" | "diamond") => { const c = viewportCenterWorld(); dispatch({ type: "addShapeNode", shapeKind: kind, x: c.x, y: c.y }); };
  const onAddEntityRefConfirm = (entityType: string, entityId: string) => {
    const c = viewportCenterWorld();
    dispatch({ type: "addEntityRefNode", entityType, entityId, x: c.x, y: c.y });
    setRefDialogOpen(false);
  };

  // ---- save ----
  const onSave = async () => {
    setInvalidNodeId(undefined);
    const validation = validateGraph(state.data);
    if (!validation.ok) {
      const first = validation.errors[0];
      if (first?.nodeId) setInvalidNodeId(first.nodeId);
      toast.add({ title: "Граф не прошёл проверку", description: first?.message ?? "Исправьте ошибки." });
      return;
    }
    setSaving(true);
    const fd = new FormData();
    fd.set("id", canvas.id ?? "");
    fd.set("title", canvas.title ?? "");
    fd.set("data", JSON.stringify(state.data));
    fd.set("etag", etag ?? "");
    const result = await updateCanvas({ success: true, data: null }, fd);
    setSaving(false);
    if (result.success) {
      toast.add({ title: "Сохранено" });
      dispatch({ type: "markSaved", data: state.data });
      router.refresh();
    } else {
      // серверная 400 по entity_ref-видимости: пытаемся вытащить node id из текста
      const m = /node(?:\sid)?\s+"([^"]+)"/.exec(result.error);
      if (m?.[1]) setInvalidNodeId(m[1]);
      const msg = result.code === "forbidden" ? "У вас нет прав на изменение канваса." : result.error;
      toast.add({ title: "Ошибка сохранения", description: msg });
    }
  };

  const onBack = () => {
    if (state.dirty && !window.confirm("Есть несохранённые изменения. Уйти без сохранения?")) return;
    router.push(`/canvases/${canvas.id}`);
  };

  const editingNode = editingNodeId ? (state.data.nodes ?? []).find((n) => n.id === editingNodeId) : undefined;

  if (showJson) {
    return (
      <div className="flex flex-col gap-3">
        <EditorToolbar
          dispatch={dispatch} canUndo={state.past.length > 0} canRedo={state.future.length > 0}
          dirty={state.dirty} gridEnabled={state.gridEnabled} saving={saving} showJson={showJson}
          hasSelection={state.selection.nodeIds.length + state.selection.edgeIds.length > 0}
          onAddText={onAddText} onAddShape={onAddShape} onAddEntityRef={() => setRefDialogOpen(true)}
          onSave={onSave} onToggleJson={() => setShowJson(false)} onBack={onBack}
        />
        <CanvasEditForm canvas={canvas} etag={etag} />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <EditorToolbar
        dispatch={dispatch} canUndo={state.past.length > 0} canRedo={state.future.length > 0}
        dirty={state.dirty} gridEnabled={state.gridEnabled} saving={saving} showJson={showJson}
        hasSelection={state.selection.nodeIds.length + state.selection.edgeIds.length > 0}
        onAddText={onAddText} onAddShape={onAddShape} onAddEntityRef={() => setRefDialogOpen(true)}
        onSave={onSave} onToggleJson={() => setShowJson(true)} onBack={onBack}
      />

      <div className="flex">
        {/* холст */}
        <div
          className="relative flex-1"
          style={{ height: "70vh" }}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onWheel={onWheel}
        >
          <svg
            ref={svgRef}
            width="100%" height="100%"
            viewBox={viewBox}
            style={{ touchAction: "none", background: "var(--color-background)", display: "block" }}
            onPointerDown={onBackgroundPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <defs>
              <marker id="cv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-description)" />
              </marker>
            </defs>

            <EditorEdgeLayer
              edges={renderData.edges}
              nodesById={nodesById}
              selectedEdgeIds={selectedEdgeIds}
              preview={edgePreview ?? undefined}
              onEdgePointerDown={onEdgePointerDown}
            />
            <EditorNodeLayer
              nodes={renderData.nodes}
              selectedNodeIds={selectedNodeIds}
              resolveEntityRef={resolveEntityRefView}
              invalidNodeId={invalidNodeId}
              onNodePointerDown={onNodePointerDown}
              onNodeDoubleClick={onNodeDoubleClick}
              onResizeHandleDown={onResizeHandleDown}
              onSideHandleDown={onSideHandleDown}
            />

            {marquee && (
              <rect
                x={marquee.x} y={marquee.y} width={marquee.width} height={marquee.height}
                fill="var(--color-primary)" fillOpacity={0.1}
                stroke="var(--color-primary)" strokeDasharray="4 2" pointerEvents="none"
              />
            )}
          </svg>

          {editingNode && (
            <EditorTextOverlay
              node={editingNode}
              viewport={vp}
              onCommit={(text) => { dispatch({ type: "setNodeText", nodeId: editingNode.id!, text }); setEditingNodeId(null); }}
              onCancel={() => setEditingNodeId(null)}
            />
          )}
        </div>

        {/* инспектор */}
        <aside className="w-64 shrink-0 border-l border-(--color-border) p-3">
          <EditorInspector
            data={state.data}
            selectedNodeIds={state.selection.nodeIds}
            selectedEdgeIds={state.selection.edgeIds}
            dispatch={dispatch}
          />
        </aside>
      </div>

      <EntityRefDialog open={refDialogOpen} onClose={() => setRefDialogOpen(false)} onConfirm={onAddEntityRefConfirm} />
    </div>
  );
}
```

> **ПРИМЕЧАНИЯ исполнителю (важно):**
> 1. `require("../editor")` в `onPointerUp` — замени на статический импорт: добавь `marqueeHits` в импорт из `"../editor"` вверху файла (он уже экспортируется ядром в Задаче 10) и используй напрямую. `require` оставлен в плане только чтобы не дублировать импорт-строку в листинге; в коде используй ES-import.
> 2. Сверь сигнатуру `Dialog`/`Select`/`Button`/`TextInput` (см. примечания Задач 13/14/16) — адаптируй под фактический UI-kit.
> 3. Это interaction-слой — тестами НЕ покрываем. Проверка: ручной прогон в браузере (Задача 18) + `npm run build`.

- [x] **Шаг 2: Заменить require на статический импорт**

В импорте из `"../editor"` (вверху файла) добавить `marqueeHits`. В `onPointerUp` удалить строку `const { marqueeHits } = require(...)` и использовать импортированный `marqueeHits` напрямую.

- [x] **Шаг 3: Проверить компиляцию и линт**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "canvas-editor.tsx" || echo OK`
Expected: `OK`
Run: `npm run lint 2>&1 | grep "canvas-editor" || echo "LINT OK"`
Expected: `LINT OK`

- [x] **Шаг 4: Commit**

```bash
git add src/features/canvas/ui/canvas-editor.tsx
git commit -m "feat(canvas-editor): root interaction component (pan/zoom/select/move/resize/edge/save)"
```

---

### Задача 18: index.ts слайса + маршрут /edit + замена raw-формы на detail-странице

Сборка: экспорт редактора, страница `/canvases/[id]/edit` с server-gate, замена inline-формы на detail-странице кнопкой-ссылкой.

**Files:**
- Modify: `src/features/canvas/index.ts`
- Create: `src/app/canvases/[id]/edit/page.tsx`
- Modify: `src/app/canvases/[id]/page.tsx`

- [x] **Шаг 1: Экспортировать CanvasEditor из index слайса (append)**

В конец `src/features/canvas/index.ts` добавить:

```ts
export { CanvasEditor } from "./ui/canvas-editor";
```

- [x] **Шаг 2: Создать страницу редактора**

```tsx
// src/app/canvases/[id]/edit/page.tsx
import { notFound, redirect, forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import { canEditCanvas, getCanvasById, CanvasEditor } from "@/features/canvas";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Редактор канваса" };

/**
 * Маршрут визуального редактора. Owner-only (canEditCanvas). Гость → /login;
 * не-владелец → forbidden(). Read-only /canvases/[id] остаётся отдельно.
 */
export default async function CanvasEditPage({ params }: Props) {
  const { id } = await params;
  const me = await getMe();
  if (!me || me.status !== "active") redirect(`/login?next=/canvases/${id}/edit`);

  const result = await getCanvasById(id);
  if (!result) notFound();
  const { canvas, etag } = result;
  if (!canEditCanvas(me, canvas)) forbidden();

  return (
    <main className="flex flex-col">
      <h1 className="sr-only">Редактор канваса {canvas.title}</h1>
      <CanvasEditor canvas={canvas} etag={etag} />
    </main>
  );
}
```

- [x] **Шаг 3: Заменить inline-форму на detail-странице кнопкой-ссылкой**

В `src/app/canvases/[id]/page.tsx` найти блок:

```tsx
      {canEdit && (
        <section className="flex flex-col gap-6 rounded border border-(--color-border) p-4">
          <h2 className="text-lg font-semibold">Редактирование</h2>
          <CanvasEditForm canvas={canvas} etag={etag} />
          {canPublish && canvas.id && <CanvasVisibilityButton id={canvas.id} />}
        </section>
      )}
```

Заменить на (визуальный редактор — основной путь; raw-JSON доступен внутри него за тогглом «JSON»):

```tsx
      {canEdit && (
        <section className="flex flex-col gap-4 rounded border border-(--color-border) p-4">
          <h2 className="text-lg font-semibold">Редактирование</h2>
          <Link
            href={`/canvases/${canvas.id}/edit`}
            className="inline-flex w-fit items-center rounded bg-(--color-primary) px-4 py-2 text-sm font-medium text-(--color-on-primary)"
          >
            Открыть редактор
          </Link>
          {canPublish && canvas.id && <CanvasVisibilityButton id={canvas.id} />}
        </section>
      )}
```

Удалить импорт `CanvasEditForm` из этого файла (он больше не используется на detail-странице; сам файл остаётся для JSON-тоггла в редакторе). Добавить `import Link from "next/link";` если его ещё нет в файле.

> **ПРИМЕЧАНИЕ:** проверь существование CSS-переменной `--color-on-primary` (grep по globals.css); если её нет — используй ту же конструкцию, что в `<Button variant="primary">` (загляни в button.tsx за классами), либо просто отрендерь `<Button>` как ссылку через `asChild`/обёртку. Не вводи новые токены. Самый простой вариант — обернуть текст в существующий `<Button>` внутри `<Link>`.

- [x] **Шаг 4: Сверить импорты detail-страницы**

Run: `grep -n "CanvasEditForm\|import Link\|next/link\|color-on-primary" src/app/canvases/[id]/page.tsx src/app/globals.css`
Действие: убрать неиспользуемый `CanvasEditForm`, добавить `Link`, поправить класс кнопки под существующие токены/компоненты.

- [x] **Шаг 5: Проверить компиляцию**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "canvases/\[id\]" || echo OK`
Expected: `OK`

- [x] **Шаг 6: Commit**

```bash
git add src/features/canvas/index.ts "src/app/canvases/[id]/edit/page.tsx" "src/app/canvases/[id]/page.tsx"
git commit -m "feat(canvas-editor): /canvases/[id]/edit route + link from detail, retire inline raw-JSON form"
```

---

### Задача 19: Финальная проверка — lint, test, build, ручной прогон

**Files:** —

- [x] **Шаг 1: Прогнать все юниты ядра**

Run: `npm test -- src/features/canvas/editor`
Expected: PASS (coords, render-map, validate, geometry-editor, canvas-reducer)

- [x] **Шаг 2: Прогнать существующие тесты слайса/рендера (не сломали ли)**

Run: `npm test -- src/features/canvas src/components/canvas-render`
Expected: PASS (старые schemas/permissions/api/geometry/canvas-render тесты зелёные)

- [x] **Шаг 3: Lint**

Run: `npm run lint`
Expected: без ошибок (особенно: нет cross-feature импортов, нет `react-dom/client` в server-файлах, нет deep-import чужих фич; пикеры — это `@/components`, разрешено)

- [x] **Шаг 4: Build**

Run: `npm run build`
Expected: успешная сборка (страница `/canvases/[id]/edit` собирается)

- [x] **Шаг 5: Ручной smoke (browser)** — выполняет ревьюер/пользователь, не агент

Чеклист:
- `/canvases/[id]/edit` открывается у владельца; не-владельцу — forbidden.
- Создание text/shape/entity_ref; перемещение; ресайз; создание ребра drag'ом от side-handle; редактирование текста по double-click; правка ребра в инспекторе; удаление (Del); undo/redo (Ctrl+Z/Shift+Ctrl+Z); pan (драг фона); zoom (колесо); marquee (shift-драг фона); сетка-тоггл.
- Сохранение → тост «Сохранено», возврат флага dirty в false. Повторное сохранение без изменений — кнопка disabled.
- JSON-тоггл показывает старую raw-форму; сохранение из неё работает.
- Несохранённые изменения + «Назад» → confirm; + закрытие вкладки → beforeunload.

- [x] **Шаг 6: Commit (если были мелкие фиксы по итогам)**

```bash
git add -p   # только свои файлы
git commit -m "chore(canvas-editor): lint/test/build green, polish"
```

---

## Self-review (выполнено при написании плана)

**1. Покрытие скоупа фазы 2 (12 пунктов MVP):**
- Viewport pan/zoom + экранные↔мировые → Задачи 4 (coords), 17 (handlers). ✔
- Выделение (клик/shift/marquee/Esc) → Задачи 8 (selection-команды), 17. ✔
- Перемещение + snap → Задачи 8 (moveSelection+snap), 4 (snap), 17. ✔
- Ресайз 8 ручек + min-size → Задачи 7 (applyResize/handles), 12 (UI ручки), 8 (resizeNode). ✔
- Создание узлов (text/shape/entity_ref + пикеры) → Задачи 8 (add-команды), 13 (диалог+пикеры), 16 (тулбар). ✔
- Редактирование узла (text-оверлей, инспектор shape/размеры) → Задачи 15 (оверлей), 14 (инспектор), 8 (setNodeText/setShapeKind/setNodeSize). ✔
- Создание ребра (drag side→node, preview) → Задачи 8 (addEdge), 12 (side-handles), 11 (preview), 17 (edge-drag). ✔
- Редактирование ребра (label/style/end/стороны) → Задачи 14 (инспектор), 8 (setEdge*). ✔
- Удаление (узлы+инцидентные рёбра / рёбра) → Задачи 8 (deleteSelection), 16/17 (Del). ✔
- Undo/redo (снапшоты) → Задачи 8 (undo/redo/commit), 9 (тесты). ✔
- Сохранение (updateCanvas + 412/413/422/400) → Задача 17 (onSave); action фазы 1 уже маппит коды. ✔
- Валидация перед сохранением → Задачи 6 (validateGraph), 17 (вызов+подсветка). ✔
- Где живёт / судьба raw-JSON → Задача 18 (маршрут /edit, тоггл JSON, кнопка с detail). ✔

**2. Placeholder-скан:** один намеренный `require(...)` в листинге Задачи 17 явно помечен с инструкцией заменить на ES-import (Шаг 2). Контракты Dialog/Select/Button помечены как «сверить и адаптировать» с конкретными командами проверки — это не placeholder, а защита от рассинхрона с UI-kit (запретная зона). Весь код ядра — полный, без TODO.

**3. Консистентность типов/имён:** команды `EditorCommand` (Задача 2) совпадают с кейсами редьюсера (Задача 8) и вызовами в UI (14/16/17). `ResizeHandle` = `"nw"|"n"|...` единообразно в editor-types/geometry-editor/node-layer. `Side` импортируется из `@/components/canvas-render` в рендер-слоях и реэкспортируется ядром для UI. `canvasDataToRenderData`/`validateGraph`/`marqueeHits`/`hitTestNode`/`applyResize` — имена совпадают в реализации, ядро-index и потребителях. `updateCanvas(prevState, formData)` — сигнатура `createFormAction` подтверждена (Задача 17 вызывает с `({success:true,data:null}, fd)`).

**4. Parallel-safety:** все новые файлы в Create; 3 Modify-файла трогаются append-only/точечно с явными инструкциями не переписывать чужое; запретные зоны (schema.ts, permissions.ts, ui-kit, ast-editor/pickers, layouts, package.json) — только чтение/импорт.

## Риски и допущения

- **UI-kit контракты (Dialog/Select/Button/TextInput).** Точные пропсы (`open` vs `trigger`, `onValueChange` vs `onChange`, набор вариантов Button) не зафиксированы в плане — помечены «сверить и адаптировать» с командами проверки. Риск средний, локализован в Задачах 13/14/16; UI-kit не меняем, подстраиваемся.
- **Серверный 400 теряет node_id.** Action фазы 1 (`rethrowApiError`) заменяет сообщение бека на общее, стирая `node "id"`. План это обходит локальной валидацией ДО отправки (validateGraph ловит уникальность/ссылки/лимиты с node id). Остаётся непокрытым лишь серверный кейс невидимой entity_ref-цели — показываем общий тост + best-effort regex по `result.error` (если action всё же пробросит детали). Подсветка этого кейса — best-effort, не блокер.
- **anchor вне MVP.** entity_ref создаются без anchor (валидно для всех типов). Существующие anchor'ы переносятся как есть при move/resize (редьюсер копирует поле через spread `{...n}`). Редактирование anchor — фаза 3.
- **comment-пикер.** Двухэтапный (lecture→comment) пикер существует, но в MVP comment идёт через ручной ввод id ради простоты диалога. Можно добавить позже, не меняя ядро.
- **Производительность.** Снапшоты undo через JSON.stringify-сравнение и spread-клон — приемлемо для графов в десятки узлов (≤2000 лимит, реально единицы-десятки). Не оптимизируем (YAGNI).
- **Pointer capture / тач.** Базовый pan/zoom мышью/трекпадом. Продвинутые тач-жесты вне скоупа (зафиксировано). `touchAction: none` на SVG предотвращает скролл страницы при drag.
- **viewBox-модель зума.** Реализована через `viewBox` + `viewport.{x,y,zoom}` (мировые координаты видимой области). Координатные функции (`screenToWorld`/`worldToScreen`) согласованы с этой моделью и покрыты юнитами (round-trip, zoom-at-point) — это критическая часть, протестирована.

## Вне скоупа фазы 2 (зафиксировано)

Реал-тайм коллаборация; авто-layout; ортогональная маршрутизация рёбер; группировка; copy-paste между канвасами; .canvas импорт/экспорт; продвинутые тач-жесты; редактирование anchor у entity_ref; comment-пикер (ручной ввод id в MVP).
