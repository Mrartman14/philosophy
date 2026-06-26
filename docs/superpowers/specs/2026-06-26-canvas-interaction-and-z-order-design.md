# Дизайн: взаимодействие канваса (marquee/pan/zoom) + z-order

Дата: 2026-06-26
Слайс: `src/features/canvas/` (+ один foundation-кусок в `src/components/ui/`)
Статус: design / pending implementation-plan

## 1. Контекст и цель

Редактор канваса (`src/features/canvas/`) — авторская/админская поверхность с
SVG-графом узлов и рёбер. Состояние живёт в чистом редьюсере `canvasReducer`
(`editor/canvas-reducer.ts`), который применяет `EditorCommand`
(`editor/editor-types.ts`) к `EditorState`. Interaction-слой
(`ui/canvas-editor.tsx`) транслирует pointer/keyboard в команды.

Две задачи пользователя:

1. **Z-order.** Порядок отрисовки сейчас = позиция в `data.nodes[]` (`nodes[0]`
   сзади, последний спереди); новый узел добавляется в конец → поверх всех;
   hit-test (`editor/geometry-editor.ts:hitTestNode`) уже берёт верхний узел.
   Отдельного поля `zIndex`/`order`/`layer` нет — и не нужно: список **сам**
   является порядком (как в Figma/Excalidraw). Не хватает только **команд
   переупорядочивания** и поверхности для них.

2. **Выделение области (marquee).** Мультивыделение и marquee **уже существуют**:
   `Selection` хранит `nodeIds[]`/`edgeIds[]`, в drag-машине есть режим
   `"marquee"` (`ui/canvas-editor.tsx`), `geometry-editor.ts:marqueeHits` находит
   пересечения. Сейчас marquee спрятан за `Shift+drag` по фону, а обычный
   drag по фону = пан. Задача — **развести marquee и пан** через явную модель
   ввода (инструмент select/hand), не ломая тач.

Зум (колесо/пинч) с marquee не конфликтует — «изолировать» его не нужно;
реальный конфликт только пан-vs-marquee на левом drag по пустому фону.

## 2. Сводка решений

| Тема | Решение |
| --- | --- |
| Модель ввода | `state.tool: "select" \| "hand"` (дефолт `select`). Десктоп select: пустой drag = marquee. Пан = hand-tool / зажатый Space / средняя кнопка / two-finger тачпад. |
| Колесо/зум | Figma-конвенция: плоское колесо и two-finger = пан; `Shift`+колесо = горизонтальный пан; `Cmd/Ctrl`+колесо и пинч (`ctrlKey`+wheel) = зум к курсору. |
| Тач | Десктоп-first, тач минимальный: один палец = пан, тап по узлу = выделить один, пинч = зум. Marquee/мультивыделение на тач — вне scope. |
| Nudge стрелками | Выделенные узлы двигаются стрелками (Figma): `Arrow` = 1px, `Shift+Arrow` = 10px. Переиспользуем `moveSelection` (новой команды нет), один нажим = один шаг undo. |
| Z-order | Две команды `bringToFront`/`sendToBack` (undoable). Поверхность: правый клик → kit `ContextMenu` + хоткеи `Cmd+]` / `Cmd+[`. Кнопок в инспекторе не добавляем. |
| ContextMenu | Новый kit-примитив (обёртка Base UI `ContextMenu`) в `src/components/ui/`. Реализуем **в одной ветке** с канвасом, отдельными коммитами — явный, согласованный с пользователем отход от правила AGENTS.md «новый kit-примитив = отдельный PR». |

## 3. Раздел A — kit-примитив `ContextMenu` (foundation)

**Файл:** `src/components/ui/context-menu.tsx` (+ `context-menu.test.tsx`).

Зеркало существующего `src/components/ui/menu.tsx`: compound-обёртка над
`@base-ui/react/context-menu`. Passthrough-части (`Root`/`Trigger`/`Portal`/
`Positioner`) + стилизованные `Popup`/`Item`/`Separator`, переиспользующие те же
surface-токены и `ITEM_CLASS`, что и `menu.tsx`. Закрытый `className` на leaf
(Guardrail 8), base-ui импортируется только внутри `ui/` (Guardrail 7).

```ts
export const ContextMenu = {
  Root: BaseContextMenu.Root,
  Trigger: BaseContextMenu.Trigger,
  Portal: BaseContextMenu.Portal,
  Positioner: BaseContextMenu.Positioner,
  Popup,        // surface-стиль, общий с Menu
  Item,         // ITEM_CLASS, общий с Menu
  Separator: BaseContextMenu.Separator,
};
```

- Точное имя пакета/частей сверить при реализации с тем, что использует
  `menu.tsx` (`@base-ui/react/...`), и с версией Base UI в проекте.
- Примитив **не хардкодит текст** — лейблы и `aria-label` приходят от
  call-site через `@/i18n`. RTL — через логические свойства/токены (как в ките).
- Тест-примитив (`context-menu.test.tsx`): рендерится, открывается по
  `contextmenu`-событию, вызывает `onClick` пункта, поддерживает `disabled`.

## 4. Раздел B — модель ввода (`src/features/canvas/`)

### B1. Состояние и команда

В `editor/editor-types.ts`:

```ts
export type CanvasTool = "select" | "hand";

export interface EditorState {
  // …существующие поля…
  tool: CanvasTool;            // НОВОЕ, дефолт "select"; UI-состояние (НЕ в undo)
}

export type EditorCommand =
  // …
  | { type: "setTool"; tool: CanvasTool }
  // z-order (раздел C):
  | { type: "bringToFront"; nodeIds: string[] }
  | { type: "sendToBack"; nodeIds: string[] };
```

В `canvas-reducer.ts`: инициализация `tool: "select"`; `setTool` — чистая
замена поля (как `toggleGrid`, **без** `commit()`, т.к. это UI-состояние, не
часть графа и не в undo).

### B2. Маршрутизация указателя (`ui/canvas-editor.tsx`)

Сейчас `onBackgroundPointerDown` ветвится только по `e.shiftKey`. Новая логика
вводит хелпер выбора жеста по фону. Приоритет (десктоп, `pointerType` mouse/pen):

1. `e.button === 1` (средняя кнопка) **или** `tool === "hand"` **или** зажат
   Space → **pan**.
2. иначе (`tool === "select"`, левая кнопка) → **marquee**
   (`Shift` → аддитивный к текущему выделению; без `Shift` → заменяющий).
   Клик без движения (порог в пикселях) → `clearSelection`.

Тач (`pointerType === "touch"`): пустой drag одним пальцем → **всегда pan**
(не зависит от `tool`); marquee на тач не инициируется.

`onNodePointerDown`: при `tool === "hand"` (или зажатом Space / средней кнопке)
— **не** выделять/двигать узел, а начинать pan. Иначе — текущее поведение
(select + move, `Shift` = toggle).

Логику выбора жеста вынести в чистый хелпер (напр. `editor/interaction.ts`:
`resolveBackgroundGesture({ tool, spaceHeld, button, pointerType, shift })`,
`resolveNodeGesture(...)`) — это тестируемое ядро, jsdom не нужен.

### B3. Space / средняя кнопка / курсор

- Зажатый **Space** → временный hand: пан активен, курсор `grabbing`/`grab`,
  по отпусканию возврат к `tool`. Отслеживается `keydown`/`keyup` (Space) на
  контейнере; флаг `spaceHeld` в ref/состоянии interaction-слоя (не в редьюсере).
  Space не должен скроллить страницу/триггерить кнопки (`preventDefault` на
  фокусе канваса).
- **Средняя кнопка** (`button === 1`) — пан независимо от инструмента.
- Курсор: `select` → стрелка (во время marquee-drag допустимо `crosshair`);
  `hand`/Space → `grab`, `grabbing` во время пана.

### B4. Колесо / зум (Figma-конвенция)

Переписать `onWheel`:

- `e.ctrlKey || e.metaKey` (включая пинч тачпада, который браузер шлёт как
  `wheel` с `ctrlKey`) → **зум к курсору** (`applyZoomAtPoint`, как сейчас).
- иначе → **пан**: `setViewport` со сдвигом `x += e.deltaX / zoom`,
  `y += e.deltaY / zoom`. `Shift` без `delta X` → трактовать `deltaY` как
  горизонтальный сдвиг (поведение колеса мыши при `Shift`).
- Сохранить `MIN_ZOOM`/`MAX_ZOOM` и поведение `preventDefault`.

Компромисс: зум мышиным колесом теперь требует `Cmd/Ctrl`. Это осознанный
выбор пользователя ради естественного two-finger пана на тачпаде ноута
(главный жест пана при desktop-first).

### B5. Тач (минимально)

- `touch-action: none` на холсте сохраняется (одно-пальцевый pan через pointer
  events уже работает — не регрессировать).
- Пинч-зум: проверить при реализации, есть ли уже обработчик; если нет —
  добавить через `ctrlKey`-ветку `onWheel` (тачпад-пинч) и/или
  два-pointer gesture для сенсорных экранов (по необходимости; минимальный
  объём — не делать бесповоротных жестов вроде long-press-marquee).
- Тап по узлу = выделить один (текущее поведение pointer-tap). Мультивыделение
  и marquee на тач **вне scope**.

### B6. Тулбар (`ui/editor-toolbar.tsx`)

- Добавить сегмент-тогл **Select / Hand** (kit-кнопки/`ToggleGroup`-аналог из
  кита), диспатчит `setTool`. Активный инструмент подсвечен.
- Горячие клавиши `V` (select) / `H` (hand) в `onKeyDown` канваса.
- Тултипы/`aria-label` — через `@/i18n` (новые ключи, см. §6).

### B7. Nudge стрелками (Figma)

Выделенные узлы двигаются стрелками клавиатуры. В `onKeyDown` (`ui/canvas-editor.tsx`),
**после** гейта `if (editingNodeId) return` (в режиме редактирования текста стрелки
двигают курсор, не узел):

- `ArrowLeft/Right/Up/Down` при непустом `selection.nodeIds`:
  - `e.preventDefault()` (не скроллить страницу);
  - шаг `step = e.shiftKey ? 10 : 1` (Figma: small/big nudge);
  - dispatch `moveSelection` с дельтой по направлению: Left `dx=-step`, Right
    `dx=+step`, Up `dy=-step`, Down `dy=+step` (мир Y растёт вниз, поэтому
    Up — отрицательный `dy`).
- Двигаются только узлы (`moveSelection` затрагивает `nodeIds`); рёбра следуют
  за своими концами автоматически. Если выбраны только рёбра — стрелки no-op.
- Переиспользуем существующую команду `moveSelection` — **новой команды
  редьюсера не нужно**. `moveSelection` не снепит к сетке
  (`snapToGrid(dx, false)`), поэтому nudge — ровно 1px/10px.
- Undo: каждое нажатие = один `commit()` = один шаг undo (см. §9 про текущую
  семантику `commit` на каждый dispatch). Коалесцинг серий nudge — вне scope.
- Маппинг «клавиша+shift → дельта» вынести в чистый хелпер в
  `editor/interaction.ts` (`resolveNudge(key, shift)` → `{dx,dy} | null`),
  тестируемый без jsdom.

## 5. Раздел C — z-order

### C1. Команды (`canvas-reducer.ts`)

`bringToFront`/`sendToBack` идут **через `commit()`** (попадают в undo-стек,
выставляют `dirty`). Алгоритм — splice по `data.nodes[]` с сохранением
относительного порядка перемещаемой группы:

- `bringToFront(ids)`: вынуть узлы с `id ∈ ids` (в их текущем относительном
  порядке), переставить в **конец** массива.
- `sendToBack(ids)`: те же узлы — в **начало** массива.

Рёбра (`data.edges[]`) не участвуют: `EditorEdgeLayer` всегда рисуется до
`EditorNodeLayer`, т.е. рёбра всегда позади узлов. Z-order — только для узлов.

### C2. Поверхности

**Правый клик → kit `ContextMenu`.** Интеграция с кастомным SVG:

- Обернуть **контейнер канваса** в `ContextMenu.Trigger` (один триггер на холст,
  не на каждый узел — узлы рисуются вручную в SVG).
- На `contextmenu`-событии до открытия меню: hit-test точки
  (`hitTestNode(eventWorld(e), renderData.nodes)`). Если попали в узел, не
  входящий в выделение → выделить его (`selectNode`, не аддитивно). Если попали
  в пустоту → меню не показывать (`preventDefault`/закрыть). Так пункты меню
  всегда действуют на актуальное выделение.
- Пункты: «На передний план» (`Cmd+]`), «На задний план» (`Cmd+[`),
  `Separator`, «Удалить» (`Delete`, → `deleteSelection`). Лейблы и хинты
  хоткеев — через `@/i18n`.

**Хоткеи** (в `onKeyDown` канваса, работают на любом выделении — одиночном и
группе): `Cmd/Ctrl+]` → `bringToFront(selection.nodeIds)`;
`Cmd/Ctrl+[` → `sendToBack(selection.nodeIds)`. No-op при пустом выделении.

Кнопок в `editor-inspector.tsx` **не добавляем** — контекстное меню + хоткеи
заменяют их (решение пользователя).

## 6. i18n

Новые ключи в `canvas` namespace для **en / ru / ar / zh** (паритет ключей
форсится `satisfies Messages`; каталоги канваса уже в активной правке по
git-статусу). Под-блоки:

- `toolbar`: `toolSelect`, `toolHand` (+ их `aria-label`/tooltip при
  необходимости).
- Новый блок `contextMenu`: `bringToFront`, `sendToBack`, `delete`
  (+ опц. подписи хоткеев, если выводим их в меню).

Псевдолокаль `en-XA` генерируется автоматически из `en` — отдельных правок не
требует. RTL для `ar` — через логические свойства (контекстное меню/тулбар уже
наследуют RTL-инфраструктуру).

## 7. Тестирование

**Юнит (редьюсер, чистые функции — без jsdom-ограничений):**

- `setTool` переключает `tool`, не трогает `data`/undo.
- `bringToFront`/`sendToBack`: корректный итоговый порядок `nodes[]`;
  **сохранение относительного порядка** перемещаемой группы; undoable
  (попали в `past`, `dirty=true`); no-op-семантика на пустом наборе/несуществ. id.
- `selectMany`/marquee-путь не сломан (регресс-тест существующего поведения).
- Хелперы `resolveBackgroundGesture`/`resolveNodeGesture`: таблица
  (tool × space × button × pointerType × shift) → ожидаемый жест.
- `onWheel`-ветвление зум-vs-пан: чистая функция выбора (вынести расчёт из
  React-обработчика), таблица по `ctrlKey/metaKey/shiftKey/delta`.
- `resolveNudge(key, shift)`: 4 направления × (shift/no-shift) → корректные
  `{dx,dy}` со знаком (Up = `dy<0`); не-стрелки → `null`. Плюс редьюсер-проверка,
  что `moveSelection` от nudge даёт один шаг undo.

**kit:** `context-menu.test.tsx` — рендер, открытие по `contextmenu`, клик
пункта, `disabled`.

**Ручная браузер-QA (jsdom не воспроизводит pointer-capture/жесты):** пан
(Space/средняя/тачпад), marquee-drag и аддитивный marquee, тогл Select/Hand +
`V`/`H`, пинч-зум, правый клик → z-order на узле и на группе, хоткеи `Cmd+]`/
`Cmd+[`, nudge стрелками (1px/`Shift`=10px на одном узле и на группе; в
текст-режиме стрелки двигают курсор, не узел), тач (один палец = пан, тап =
выбор), RTL-раскладка меню/тулбара.

## 8. Затронутые файлы и границы

**Foundation (один кусок, отдельные коммиты, согласовано):**

- `src/components/ui/context-menu.tsx` (+ `.test.tsx`) — НОВЫЙ kit-примитив.

**Слайс канваса (`src/features/canvas/`):**

- `editor/editor-types.ts` — `CanvasTool`, поле `tool`, команды `setTool`/
  `bringToFront`/`sendToBack`.
- `editor/canvas-reducer.ts` (+ `.test.ts`) — инициализация `tool`, обработка
  новых команд.
- `editor/interaction.ts` (НОВЫЙ, + тест) — чистые хелперы выбора жеста,
  ветвления колеса и `resolveNudge`.
- `ui/canvas-editor.tsx` — маршрутизация указателя/Space/средней кнопки,
  переписанный `onWheel`, хоткеи (`V`/`H`, `Cmd+]`/`Cmd+[`, стрелки-nudge),
  интеграция `ContextMenu.Trigger` + hit-test на `contextmenu`.
- `ui/editor-toolbar.tsx` — тогл Select/Hand.
- `i18n/messages/{en,ru,ar,zh}/canvas.ts` — новые ключи `toolbar.*`,
  `contextMenu.*`.

**Не трогаем:** `editor-inspector.tsx` (z-order туда не добавляем),
`api/schema.ts`, прочие запретные зоны AGENTS.md, кроме согласованного
`components/ui/context-menu.tsx`.

## 9. Вне scope / открытые вопросы

- Панель слоёв (drag-reorder), операции «на шаг вперёд/назад», «Дублировать» —
  не делаем (YAGNI; при необходимости — отдельной итерацией).
- Контекстное меню по пустому фону (select-all/paste) — не делаем.
- Marquee/мультивыделение и спец-жесты на тач — вне scope (десктоп-first).
- Marquee выделяет только узлы (как сейчас); включение рёбер между выбранными
  узлами — не делаем.
- Пинч-зум на сенсорных экранах: объём уточняется при реализации (минимально —
  через `ctrlKey`-ветку `onWheel`); полноценный two-pointer pinch — по факту
  необходимости.
- **Наблюдение (вне scope):** `moveSelection` коммитит на каждый dispatch,
  поэтому drag-move уже сейчас кладёт в undo-стек по шагу на каждое
  `pointermove` (undo откатывает движение «по чуть-чуть»). Nudge сознательно
  повторяет эту семантику (один нажим = один шаг). Коалесцинг серий move/nudge
  в один undo-шаг — потенциальный отдельный улучшающий тикет, не в этой фиче.
