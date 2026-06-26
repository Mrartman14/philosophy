# Canvas Interaction & Z-order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать редактору канваса figma-подобную модель ввода (инструмент select/hand, marquee по умолчанию, пан/зум по конвенции), nudge выделения стрелками и z-order (на передний/задний план) через kit-примитив контекстного меню.

**Architecture:** Чистое ядро (`canvasReducer`) получает новые команды `setTool`/`bringToFront`/`sendToBack`; вся развилка указателя/колеса/стрелок выносится в чистый модуль `editor/interaction.ts` (полностью юнит-тестируется); тонкий React-слой `canvas-editor.tsx` лишь склеивает события с этими хелперами и командами. Контекстное меню — новый kit-примитив `src/components/ui/context-menu.tsx` (обёртка Base UI `@base-ui/react/context-menu`, зеркало `menu.tsx`).

**Tech Stack:** Next.js / React 19 / TypeScript, Base UI 1.4.1 (`@base-ui/react`), Vitest, next-intl за фасадом `@/i18n`, pnpm, Tailwind v4 токены.

## Global Constraints

- Пакетный менеджер — **pnpm** (npm ломает тулчейн). Гейт перед завершением: `pnpm lint && pnpm test && pnpm build` — всё зелёное.
- Именование файлов в `src/` — **kebab-case**.
- **Guardrail 7:** `@base-ui/*` импортируется ТОЛЬКО внутри `src/components/ui/`. Канвас потребляет kit-примитив, не base-ui напрямую.
- **Guardrail 8:** на leaf-примитивах kit `className` — наивный `cn`-join, без дублей surface на call-site.
- i18n только через фасад `@/i18n` (`useT`). Паритет ключей в `en/ru/ar/zh` форсится `satisfies Messages`; **`ru/canvas.ts` — источник типа `Messages`**, поэтому ключ добавляется во ВСЕ 4 каталога в одном коммите, иначе TS красный. Псевдолокаль `en-XA` генерируется из `en` автоматически — правок не требует.
- **Параллельные агенты:** НЕ делать `git stash/reset/checkout./clean`, НЕ `git add -A`/`git add .`. Добавлять только свои файлы по имени: `git add <path1> <path2> && git commit --only <те же пути>`.
- Запретные зоны AGENTS.md не трогаем, КРОМЕ согласованного нового `src/components/ui/context-menu.tsx`.
- `CanvasEditor` (`ui/canvas-editor.tsx`) по конвенции проекта **не покрывается юнит-тестами** (см. комментарий на строке 60). Поэтому тестируемая логика живёт в `editor/interaction.ts` и редьюсере; задачи-обёртки проверяются прогоном гейта + ручным QA-чеклистом.

---

## File Structure

**Создаём:**
- `src/components/ui/context-menu.tsx` — kit-примитив (compound над Base UI ContextMenu).
- `src/components/ui/context-menu.test.tsx` — тест примитива.
- `src/features/canvas/editor/interaction.ts` — чистые хелперы развилки ввода.
- `src/features/canvas/editor/interaction.test.ts` — их тесты.

**Модифицируем:**
- `src/features/canvas/editor/editor-types.ts` — `CanvasTool`, поле `tool`, команды `setTool`/`bringToFront`/`sendToBack`.
- `src/features/canvas/editor/canvas-reducer.ts` — инициализация `tool`, обработка новых команд.
- `src/features/canvas/editor/canvas-reducer.test.ts` — тесты команд.
- `src/features/canvas/editor/index.ts` — реэкспорт новых публичных функций `interaction.ts` (если barrel так устроен; проверить).
- `src/features/canvas/ui/canvas-editor.tsx` — wiring: pointer-routing, wheel, Space/средняя кнопка, курсор, хоткеи, nudge, контекстное меню.
- `src/features/canvas/ui/editor-toolbar.tsx` — тогл Select/Hand.
- `src/components/ui/index.ts` — реэкспорт `ContextMenu` (если kit имеет общий barrel; проверить, как экспортится `Menu`).
- `src/i18n/messages/{en,ru,ar,zh}/canvas.ts` — ключи `toolbar.toolSelect/toolHand`, блок `contextMenu`.

---

## Task 1: kit-примитив `ContextMenu`

**Files:**
- Create: `src/components/ui/context-menu.tsx`
- Create: `src/components/ui/context-menu.test.tsx`
- Modify: `src/components/ui/menu.tsx` (вынести `MENU_POPUP_CLASS`/`MENU_ITEM_CLASS` в `export`, переиспользовать их же — DRY по ревью)
- Modify: `src/components/ui/index.ts` (реэкспорт `ContextMenu`)

**Interfaces:**
- Produces: `ContextMenu` — объект с полями `Root, Trigger, Portal, Positioner, Popup, Item, Separator` (passthrough/стилизованные части Base UI ContextMenu). Используется в Task 8.

- [ ] **Step 1: Посмотреть образец `menu.tsx`**

Прочитать `src/components/ui/menu.tsx` целиком — новый файл должен быть его точным зеркалом, но из `@base-ui/react/context-menu`. Части ContextMenu (проверены в Base UI 1.4.1): `Root, Trigger, Portal, Positioner, Popup, Item, Separator`. ВАЖНО: `Popup/Positioner/Portal/Item` реэкспортятся из `../menu/...`, но `Separator` — из `../separator/Separator` (отдельный примитив), поэтому его в ките оборачиваем отдельным cn-форвардером (см. Step 4).

- [ ] **Step 2: Написать падающий тест**

Создать `src/components/ui/context-menu.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContextMenu } from "./context-menu";

function Harness({ onPick }: { onPick: () => void }) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={<div data-testid="area">right-click me</div>} />
      <ContextMenu.Portal>
        <ContextMenu.Positioner>
          <ContextMenu.Popup>
            <ContextMenu.Item onClick={onPick}>Action</ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

describe("ui/ContextMenu", () => {
  // ВНИМАНИЕ (ревью): прецеденты репо (menu.test.tsx, lecture-actions-menu.test.tsx)
  // проверяют ТОЛЬКО наличие пункта в DOM, НЕ дёргают Item.onClick через fireEvent
  // (композитная pointer-машина Base UI Item делает fireEvent.click(item)→onClick
  // недетерминированным в jsdom). Поэтому здесь — только открытие+рендер пункта;
  // клик-по-пункту → действие проверяется браузер-QA, не юнитом.
  it("opens on contextmenu and renders the item", async () => {
    render(<Harness onPick={() => {}} />);
    fireEvent.contextMenu(screen.getByTestId("area"));
    expect(await screen.findByRole("menuitem", { name: "Action" })).toBeInTheDocument();
  });
});
```

(Импорт `vi` тогда не нужен — убрать из строки `import`, иначе lint-unused.)

- [ ] **Step 3: Запустить тест — убедиться, что падает**

Run: `pnpm test src/components/ui/context-menu.test.tsx`
Expected: FAIL — `Cannot find module './context-menu'`.

- [ ] **Step 4: Реализовать примитив**

**Сначала (DRY, по ревью):** вынести общие классы стиля из `menu.tsx`, чтобы `context-menu.tsx` не дублировал байт-в-байт те же строки (обёртки оборачивают ОДНИ И ТЕ ЖЕ Base UI компоненты — `ContextMenu.Popup`/`.Item` реэкспортятся из `../menu/...`). В `src/components/ui/menu.tsx` пометить две константы `export` и использовать их же внутри `menu.tsx`:

```ts
export const MENU_POPUP_CLASS =
  "min-w-44 rounded border border-(--color-border) bg-(--color-surface) p-1 shadow-lg outline-none";
export const MENU_ITEM_CLASS =
  "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-(--color-surface-subtle) data-[disabled]:opacity-50";
```

(в `menu.tsx` заменить инлайновые строки `Popup`/`ITEM_CLASS` на эти экспортированные константы — поведение байт-в-байт прежнее).

Затем создать `src/components/ui/context-menu.tsx`:

```tsx
"use client";
// src/components/ui/context-menu.tsx
// Compound-обёртка над Base UI ContextMenu (меню по правому клику / long-press).
// Зеркало menu.tsx: Root/Trigger/Portal/Positioner — passthrough; Popup/Item/Separator
// несут общий surface/item-стиль (классы шарятся с menu.tsx). ВНИМАНИЕ: Separator у
// ContextMenu — отдельный примитив (../separator/Separator), НЕ из menu/; оборачиваем
// его cn-форвардером, чтобы стиль жил в ките, а не на call-site (Guardrail 8).
import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu";
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from "react";

import { cn } from "./cn";
import { MENU_POPUP_CLASS, MENU_ITEM_CLASS } from "./menu";

const Popup = forwardRef<
  ComponentRef<typeof BaseContextMenu.Popup>,
  ComponentPropsWithoutRef<typeof BaseContextMenu.Popup>
>(function ContextMenuPopup({ className, ...rest }, ref) {
  return <BaseContextMenu.Popup ref={ref} className={cn(MENU_POPUP_CLASS, className as string)} {...rest} />;
});

const Item = forwardRef<
  ComponentRef<typeof BaseContextMenu.Item>,
  ComponentPropsWithoutRef<typeof BaseContextMenu.Item>
>(function ContextMenuItem({ className, ...rest }, ref) {
  return <BaseContextMenu.Item ref={ref} className={cn(MENU_ITEM_CLASS, className as string)} {...rest} />;
});

const Separator = forwardRef<
  ComponentRef<typeof BaseContextMenu.Separator>,
  ComponentPropsWithoutRef<typeof BaseContextMenu.Separator>
>(function ContextMenuSeparator({ className, ...rest }, ref) {
  return <BaseContextMenu.Separator ref={ref} className={cn("my-1 h-px bg-(--color-border)", className as string)} {...rest} />;
});

export const ContextMenu = {
  Root: BaseContextMenu.Root,
  Trigger: BaseContextMenu.Trigger,
  Portal: BaseContextMenu.Portal,
  Positioner: BaseContextMenu.Positioner,
  Popup,
  Item,
  Separator,
};
```

`Menu` реэкспортится из `src/components/ui/index.ts` (`export { Menu } from "./menu";`) — добавить тем же стилем `export { ContextMenu } from "./context-menu";`. Канвас (Task 8) импортирует из barrel `@/components/ui`, не deep-путём.

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Run: `pnpm test src/components/ui/context-menu.test.tsx`
Expected: PASS.

- [ ] **Step 6: Lint**

Run: `pnpm lint`
Expected: без ошибок (в частности Guardrail 7 доволен — base-ui внутри `ui/`).

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/context-menu.tsx src/components/ui/context-menu.test.tsx src/components/ui/menu.tsx src/components/ui/index.ts
git commit -m "feat(ui): kit-примитив ContextMenu (обёртка Base UI) + общие классы с Menu"
```

---

## Task 2: reducer — состояние инструмента (`tool`) + команда `setTool`

**Files:**
- Modify: `src/features/canvas/editor/editor-types.ts`
- Modify: `src/features/canvas/editor/canvas-reducer.ts:34-46` (initEditorState), `:70-88` (switch)
- Modify: `src/features/canvas/editor/index.ts` (реэкспорт типа `CanvasTool`)
- Test: `src/features/canvas/editor/canvas-reducer.test.ts`

**Interfaces:**
- Produces: тип `CanvasTool = "select" | "hand"`; поле `EditorState.tool: CanvasTool`; команда `{ type: "setTool"; tool: CanvasTool }`. Используется в Tasks 4–8.

- [ ] **Step 1: Написать падающий тест**

Добавить в `src/features/canvas/editor/canvas-reducer.test.ts`:

```ts
it("setTool переключает инструмент, не трогая data/undo", () => {
  const s = initEditorState({ nodes: [], edges: [] });
  expect(s.tool).toBe("select");
  const next = canvasReducer(s, { type: "setTool", tool: "hand" });
  expect(next.tool).toBe("hand");
  expect(next.past).toHaveLength(0);
  expect(next.data).toBe(s.data);
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test src/features/canvas/editor/canvas-reducer.test.ts -t setTool`
Expected: FAIL — `s.tool` undefined / тип `setTool` неизвестен.

- [ ] **Step 3: Добавить тип и поле в `editor-types.ts`**

После `export interface Selection { … }` (около строки 14) добавить:

```ts
/** Активный инструмент взаимодействия. */
export type CanvasTool = "select" | "hand";
```

В `EditorState` (после `gridEnabled: boolean;`) добавить поле:

```ts
  /** Активный инструмент (UI-состояние, НЕ в undo). */
  tool: CanvasTool;
```

В `EditorCommand`, в секции `// --- viewport ---` (или новой `// --- tool ---` после selection), добавить:

```ts
  | { type: "setTool"; tool: CanvasTool }
```

Обновить импорт типа в `canvas-reducer.ts`, если он импортирует именованные типы (там уже `import type { EditorCommand, EditorState, Viewport } from "./editor-types";` — `CanvasTool` тянуть не обязательно, поле берётся из команды).

**ВАЖНО (блокер от ревью):** добавить `CanvasTool` в реэкспорт типов barrel `src/features/canvas/editor/index.ts` — там уже есть `export type { … EditorState, EditorCommand, … } from "./editor-types";`, дописать `CanvasTool` в этот список. Иначе Task 7 (`tool: CanvasTool` в пропсах тулбара, импорт через `../editor`) не скомпилируется.

- [ ] **Step 4: Инициализация + обработка в `canvas-reducer.ts`**

В `initEditorState` (объект возврата, рядом с `gridEnabled: true,`) добавить:

```ts
    tool: "select",
```

В `switch (command.type)`, рядом с `case "toggleGrid":` добавить:

```ts
    case "setTool":
      return { ...state, tool: command.tool };
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `pnpm test src/features/canvas/editor/canvas-reducer.test.ts -t setTool`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/canvas/editor/editor-types.ts src/features/canvas/editor/canvas-reducer.ts src/features/canvas/editor/index.ts src/features/canvas/editor/canvas-reducer.test.ts
git commit -m "feat(canvas): состояние инструмента select/hand (setTool)"
```

---

## Task 3: reducer — z-order команды `bringToFront` / `sendToBack`

**Files:**
- Modify: `src/features/canvas/editor/editor-types.ts` (EditorCommand)
- Modify: `src/features/canvas/editor/canvas-reducer.ts` (switch, рядом с move/resize)
- Test: `src/features/canvas/editor/canvas-reducer.test.ts`

**Interfaces:**
- Produces: команды `{ type: "bringToFront"; nodeIds: string[] }` и `{ type: "sendToBack"; nodeIds: string[] }`. Используются в Tasks 6 (хоткеи) и 8 (меню).

- [ ] **Step 1: Написать падающие тесты**

Добавить в `canvas-reducer.test.ts`. Хелпер графа — узлы с известными id в известном порядке:

```ts
function fourNodeState() {
  const data = {
    nodes: [
      { id: "a", type: "shape", x: 0, y: 0, width: 20, height: 20, shape_kind: "rect" },
      { id: "b", type: "shape", x: 0, y: 0, width: 20, height: 20, shape_kind: "rect" },
      { id: "c", type: "shape", x: 0, y: 0, width: 20, height: 20, shape_kind: "rect" },
      { id: "d", type: "shape", x: 0, y: 0, width: 20, height: 20, shape_kind: "rect" },
    ],
    edges: [],
  } as unknown as Parameters<typeof initEditorState>[0];
  return initEditorState(data);
}
const ids = (s: ReturnType<typeof initEditorState>) => (s.data.nodes ?? []).map((n) => n.id);

it("bringToFront перемещает выбранные в конец, сохраняя их относительный порядок", () => {
  const s = fourNodeState();
  const next = canvasReducer(s, { type: "bringToFront", nodeIds: ["b", "a"] });
  // a,b уходят в конец в их ИСХОДНОМ относительном порядке (a перед b)
  expect(ids(next)).toEqual(["c", "d", "a", "b"]);
  expect(next.past).toHaveLength(1); // undoable
  expect(next.dirty).toBe(true);
});

it("sendToBack перемещает выбранные в начало, сохраняя относительный порядок", () => {
  const s = fourNodeState();
  const next = canvasReducer(s, { type: "sendToBack", nodeIds: ["d", "c"] });
  expect(ids(next)).toEqual(["c", "d", "a", "b"]);
});

it("bringToFront — no-op на пустом наборе и несуществующих id", () => {
  const s = fourNodeState();
  expect(canvasReducer(s, { type: "bringToFront", nodeIds: [] })).toBe(s);
  expect(canvasReducer(s, { type: "bringToFront", nodeIds: ["zzz"] })).toBe(s);
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test src/features/canvas/editor/canvas-reducer.test.ts -t "bringToFront|sendToBack"`
Expected: FAIL — тип команды неизвестен.

- [ ] **Step 3: Добавить команды в `editor-types.ts`**

В `EditorCommand`, после секции `// --- move / resize ---` соответствующих команд (после `setNodeSize`), добавить новую секцию:

```ts
  // --- z-order ---
  | { type: "bringToFront"; nodeIds: string[] }
  | { type: "sendToBack"; nodeIds: string[] }
```

- [ ] **Step 4: Реализовать в `canvas-reducer.ts`**

Извлечь общий module-private хелпер (DRY по ревью — две ветки идентичны кроме порядка склейки). Рядом с другими хелперами вверху `canvas-reducer.ts` (после `toggleId`, около строки 68) добавить:

```ts
/** Переставляет выбранные узлы в начало/конец массива, сохраняя их относительный
 *  порядок. Через commit → undoable. No-op при пустом/несуществующем наборе. */
function reorderNodes(state: EditorState, nodeIds: string[], edge: "front" | "back"): EditorState {
  const ids = new Set(nodeIds);
  if (ids.size === 0) return state;
  const nodes = state.data.nodes ?? [];
  const moved = nodes.filter((n) => n.id != null && ids.has(n.id)); // filter сохраняет порядок
  if (moved.length === 0) return state;
  const rest = nodes.filter((n) => !(n.id != null && ids.has(n.id)));
  const next = edge === "front" ? [...rest, ...moved] : [...moved, ...rest];
  return commit(state, { ...state.data, nodes: next });
}
```

После `case "setNodeSize": { … }` (около строки 168) добавить два однострочных кейса:

```ts
    case "bringToFront":
      return reorderNodes(state, command.nodeIds, "front");
    case "sendToBack":
      return reorderNodes(state, command.nodeIds, "back");
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `pnpm test src/features/canvas/editor/canvas-reducer.test.ts -t "bringToFront|sendToBack"`
Expected: PASS (3 теста).

- [ ] **Step 6: Commit**

```bash
git add src/features/canvas/editor/editor-types.ts src/features/canvas/editor/canvas-reducer.ts src/features/canvas/editor/canvas-reducer.test.ts
git commit -m "feat(canvas): z-order команды bringToFront/sendToBack (undoable)"
```

---

## Task 4: чистые хелперы развилки ввода (`interaction.ts`)

**Files:**
- Create: `src/features/canvas/editor/interaction.ts`
- Create: `src/features/canvas/editor/interaction.test.ts`
- Modify: `src/features/canvas/editor/coords.ts` (экспорт `ZOOM_IN`/`ZOOM_OUT`)
- Modify: `src/features/canvas/editor/index.ts` (barrel-реэкспорт; проверить, экспортит ли он `coords`/`geometry-editor` — повторить стиль)

**Interfaces:**
- Produces:
  - `resolveBackgroundGesture(i: GestureInput): "pan" | "marquee"`
  - `resolveNodeGesture(i: GestureInput): "select-move" | "pan"`
  - `resolveWheel(i: WheelInput): { kind: "zoom"; factor: number } | { kind: "pan"; dx: number; dy: number }`
  - `resolveNudge(key: string, shift: boolean): { dx: number; dy: number } | null`
  - типы `GestureInput`, `WheelInput`. Все потребляются в Tasks 5–6.

- [ ] **Step 1: Написать падающие тесты**

Создать `src/features/canvas/editor/interaction.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { resolveBackgroundGesture, resolveNodeGesture, resolveWheel, resolveNudge } from "./interaction";

const base = { tool: "select" as const, spaceHeld: false, button: 0, pointerType: "mouse", shift: false };

describe("resolveBackgroundGesture", () => {
  it("select + левая мышь → marquee", () => {
    expect(resolveBackgroundGesture(base)).toBe("marquee");
  });
  it("hand-tool → pan", () => {
    expect(resolveBackgroundGesture({ ...base, tool: "hand" })).toBe("pan");
  });
  it("зажатый Space → pan", () => {
    expect(resolveBackgroundGesture({ ...base, spaceHeld: true })).toBe("pan");
  });
  it("средняя кнопка → pan", () => {
    expect(resolveBackgroundGesture({ ...base, button: 1 })).toBe("pan");
  });
  it("тач одним пальцем → pan (не marquee)", () => {
    expect(resolveBackgroundGesture({ ...base, pointerType: "touch" })).toBe("pan");
  });
});

describe("resolveNodeGesture", () => {
  it("select → select-move", () => {
    expect(resolveNodeGesture(base)).toBe("select-move");
  });
  it("hand/Space/средняя → pan", () => {
    expect(resolveNodeGesture({ ...base, tool: "hand" })).toBe("pan");
    expect(resolveNodeGesture({ ...base, spaceHeld: true })).toBe("pan");
    expect(resolveNodeGesture({ ...base, button: 1 })).toBe("pan");
  });
});

describe("resolveWheel", () => {
  it("ctrl/meta → zoom (вверх = увеличение)", () => {
    expect(resolveWheel({ deltaX: 0, deltaY: -10, ctrlKey: true, metaKey: false, shiftKey: false })).toEqual({ kind: "zoom", factor: 1.1 });
    expect(resolveWheel({ deltaX: 0, deltaY: 10, ctrlKey: false, metaKey: true, shiftKey: false })).toEqual({ kind: "zoom", factor: 1 / 1.1 });
  });
  it("плоское колесо → pan по дельтам", () => {
    expect(resolveWheel({ deltaX: 5, deltaY: 12, ctrlKey: false, metaKey: false, shiftKey: false })).toEqual({ kind: "pan", dx: 5, dy: 12 });
  });
  it("shift без deltaX → горизонтальный pan", () => {
    expect(resolveWheel({ deltaX: 0, deltaY: 15, ctrlKey: false, metaKey: false, shiftKey: true })).toEqual({ kind: "pan", dx: 15, dy: 0 });
  });
});

describe("resolveNudge", () => {
  it("стрелки без shift → 1px со знаком", () => {
    expect(resolveNudge("ArrowLeft", false)).toEqual({ dx: -1, dy: 0 });
    expect(resolveNudge("ArrowRight", false)).toEqual({ dx: 1, dy: 0 });
    expect(resolveNudge("ArrowUp", false)).toEqual({ dx: 0, dy: -1 });
    expect(resolveNudge("ArrowDown", false)).toEqual({ dx: 0, dy: 1 });
  });
  it("shift → 10px", () => {
    expect(resolveNudge("ArrowDown", true)).toEqual({ dx: 0, dy: 10 });
  });
  it("не-стрелка → null", () => {
    expect(resolveNudge("Enter", false)).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test src/features/canvas/editor/interaction.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3a: Вынести зум-фактор в `coords.ts` (DRY по ревью)**

В `src/features/canvas/editor/coords.ts`, рядом с `MIN_ZOOM`/`MAX_ZOOM` (строки 7-8), добавить и **экспортировать** шаг зума (сейчас магия `1.1` живёт инлайн в `onWheel`):

```ts
export const ZOOM_IN = 1.1;
export const ZOOM_OUT = 1 / 1.1;
```

(Все зум-константы — в одном модуле, который уже владеет зум-математикой `applyZoomAtPoint`/`clampZoom`.)

- [ ] **Step 3b: Реализовать `interaction.ts`**

Создать `src/features/canvas/editor/interaction.ts`:

```ts
// src/features/canvas/editor/interaction.ts
// Чистые хелперы развилки ввода: pointer-жесты, колесо, nudge. Без React/DOM —
// тестируются изолированно; canvas-editor.tsx лишь подставляет сюда поля событий.
import { ZOOM_IN, ZOOM_OUT } from "./coords";
import type { CanvasTool } from "./editor-types";

export interface GestureInput {
  tool: CanvasTool;
  spaceHeld: boolean;
  /** PointerEvent.button: 0 — левая, 1 — средняя, 2 — правая. */
  button: number;
  /** PointerEvent.pointerType: "mouse" | "pen" | "touch". */
  pointerType: string;
  shift: boolean;
}

/** Жест при pointerdown по пустому фону. */
export function resolveBackgroundGesture(i: GestureInput): "pan" | "marquee" {
  if (i.button === 1 || i.tool === "hand" || i.spaceHeld) return "pan";
  if (i.pointerType === "touch") return "pan"; // один палец = пан (десктоп-first)
  return "marquee";
}

/** Жест при pointerdown по узлу. */
export function resolveNodeGesture(i: GestureInput): "select-move" | "pan" {
  if (i.button === 1 || i.tool === "hand" || i.spaceHeld) return "pan";
  return "select-move";
}

export interface WheelInput {
  deltaX: number;
  deltaY: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export type WheelAction = { kind: "zoom"; factor: number } | { kind: "pan"; dx: number; dy: number };

/** Figma-конвенция: ctrl/meta (и пинч=ctrl+wheel) → зум; иначе → пан. */
export function resolveWheel(i: WheelInput): WheelAction {
  if (i.ctrlKey || i.metaKey) {
    return { kind: "zoom", factor: i.deltaY < 0 ? ZOOM_IN : ZOOM_OUT };
  }
  if (i.shiftKey && i.deltaX === 0) {
    return { kind: "pan", dx: i.deltaY, dy: 0 }; // колесо мыши + shift = горизонталь
  }
  return { kind: "pan", dx: i.deltaX, dy: i.deltaY };
}

const SMALL_NUDGE = 1;
const BIG_NUDGE = 10;

/** Стрелка → дельта перемещения (world px). Не-стрелка → null. */
export function resolveNudge(key: string, shift: boolean): { dx: number; dy: number } | null {
  const step = shift ? BIG_NUDGE : SMALL_NUDGE;
  switch (key) {
    case "ArrowLeft": return { dx: -step, dy: 0 };
    case "ArrowRight": return { dx: step, dy: 0 };
    case "ArrowUp": return { dx: 0, dy: -step };
    case "ArrowDown": return { dx: 0, dy: step };
    default: return null;
  }
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm test src/features/canvas/editor/interaction.test.ts`
Expected: PASS.

- [ ] **Step 5: Barrel-реэкспорт**

Открыть `src/features/canvas/editor/index.ts`. Если он реэкспортит `./coords`, `./geometry-editor` и т.п. — добавить тем же стилем:

```ts
export {
  resolveBackgroundGesture, resolveNodeGesture, resolveWheel, resolveNudge,
} from "./interaction";
export type { GestureInput, WheelInput, WheelAction } from "./interaction";
```

Прогнать `pnpm test src/features/canvas/editor/interaction.test.ts` ещё раз — зелёное.

- [ ] **Step 6: Commit**

```bash
git add src/features/canvas/editor/interaction.ts src/features/canvas/editor/interaction.test.ts src/features/canvas/editor/coords.ts src/features/canvas/editor/index.ts
git commit -m "feat(canvas): чистые хелперы развилки ввода (gesture/wheel/nudge)"
```

---

## Task 5: wiring указателя + колеса + Space + курсор (`canvas-editor.tsx`)

**Files:**
- Modify: `src/features/canvas/ui/canvas-editor.tsx` (импорты; pointer-хендлеры `:145-167`; `onPointerUp` `:222-240`; `onWheel` `:243-249`; контейнер `:462-471`; добавить `onKeyUp`)

**Interfaces:**
- Consumes: `resolveBackgroundGesture`, `resolveNodeGesture`, `resolveWheel` (Task 4); `state.tool` (Task 2); существующие `applyZoomAtPoint`, `eventWorld`, `marqueeHits`.
- Produces: tool-aware взаимодействие. Никаких новых экспортов.

> **Тестирование:** `CanvasEditor` не покрывается юнит-тестами (конвенция, строка 60). Логика уже протестирована в Task 4. Эта задача проверяется прогоном гейта + ручным QA (см. финальный чеклист). Падающего теста для шага нет — вместо него Step «verify» прогоняет существующий suite на отсутствие регрессий.
>
> **ВАЖНО (ревью):** `spaceHeld` — `useState`, а pointer-хендлеры читают его из замыкания рендера. Это работает ТОЛЬКО потому, что хендлеры — инлайновые функции, пересоздаваемые каждый рендер. **НЕ оборачивать `onBackgroundPointerDown`/`onNodePointerDown`/`onPointerMove`/`onPointerUp` в `useCallback`** — иначе `spaceHeld`/`state.tool` застынут (stale closure).

- [ ] **Step 1: Импортировать хелперы**

В блоке `import { … } from "../editor";` (строки 12-15) добавить к списку: `resolveBackgroundGesture, resolveNodeGesture, resolveWheel`.

- [ ] **Step 2: Space-состояние + полная замена `onKeyDown` + `onKeyUp`**

Рядом с другими `useState` (около строки 86) добавить:

```ts
  const [spaceHeld, setSpaceHeld] = useState(false);
```

**Заменить весь `onKeyDown`** (строки 252-263) на версию ниже — самостоятельные guarded-`if` с ранним `return` (НЕ цепочка `else if`, чтобы Task 6 мог дописать ветки без рассыпающегося splice). Space обрабатывается ПОСЛЕ гейта `editingNodeId` (в текст-режиме Space печатает пробел), `preventDefault` на КАЖДОМ keydown (вкл. авто-repeat — иначе зажатый Space может скроллить):

```ts
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editingNodeId) return; // текст-оверлей перехватывает ввод

    if (e.code === "Space") {
      e.preventDefault();              // не скроллить / не «жать» фокус (на каждом repeat)
      if (!spaceHeld) setSpaceHeld(true);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      dispatch({ type: "deleteSelection" });
      return;
    }
    if (e.key === "Escape") {
      dispatch({ type: "clearSelection" });
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      dispatch(e.shiftKey ? { type: "redo" } : { type: "undo" });
      return;
    }
    // ветки V/H + z-order + nudge дописываются в Task 6 (тут пока всё).
  };
```

Добавить новый обработчик `onKeyUp` рядом с `onKeyDown`:

```ts
  const onKeyUp = (e: React.KeyboardEvent) => {
    if (e.code === "Space") setSpaceHeld(false);
  };
```

- [ ] **Step 3: Переписать `onBackgroundPointerDown` через хелпер**

Заменить тело (строки 145-155) на:

```ts
  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return; // клик именно по фону
    const gesture = resolveBackgroundGesture({
      tool: state.tool, spaceHeld, button: e.button, pointerType: e.pointerType, shift: e.shiftKey,
    });
    const world = eventWorld(e);
    if (gesture === "marquee") {
      // shift → аддитивный marquee (к текущему выделению)
      dragRef.current = { kind: "marquee", startWorld: world, currentWorld: world, additive: e.shiftKey };
    } else {
      dispatch({ type: "clearSelection" });
      dragRef.current = { kind: "pan", startScreen: { x: e.clientX, y: e.clientY }, startVp: { x: vp.x, y: vp.y } };
    }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
```

Расширить тип `Drag` (строки 39-45): в варианте marquee добавить `additive: boolean`:

```ts
  | { kind: "marquee"; startWorld: Point; currentWorld: Point; additive: boolean }
```

- [ ] **Step 4: Учесть `additive` при завершении marquee**

В `onPointerUp`, в ветке `if (drag.kind === "marquee")` (строки 226-231), заменить dispatch на:

```ts
      const ids = marqueeHits(rect, renderData.nodes);
      const nextNodeIds = drag.additive
        ? Array.from(new Set([...state.selection.nodeIds, ...ids]))
        : ids;
      dispatch({ type: "selectMany", nodeIds: nextNodeIds, edgeIds: drag.additive ? state.selection.edgeIds : [] });
      setMarquee(null);
```

- [ ] **Step 5: tool-aware `onNodePointerDown`**

Заменить начало (строки 157-164) — если жест «pan», начинаем пан вместо select/move:

```ts
  const onNodePointerDown = (nodeId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    const gesture = resolveNodeGesture({
      tool: state.tool, spaceHeld, button: e.button, pointerType: e.pointerType, shift: e.shiftKey,
    });
    if (gesture === "pan") {
      dragRef.current = { kind: "pan", startScreen: { x: e.clientX, y: e.clientY }, startVp: { x: vp.x, y: vp.y } };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    if (!selectedNodeIds.has(nodeId)) {
      dispatch({ type: "selectNode", nodeId, additive: e.shiftKey });
    } else if (e.shiftKey) {
      dispatch({ type: "selectNode", nodeId, additive: true });
    }
    dragRef.current = { kind: "move", lastWorld: eventWorld(e) };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
```

- [ ] **Step 6: Переписать `onWheel` через `resolveWheel`**

Заменить тело (строки 243-249):

```ts
  const onWheel = (e: React.WheelEvent) => {
    const action = resolveWheel({
      deltaX: e.deltaX, deltaY: e.deltaY, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
    });
    if (action.kind === "zoom") {
      const rect = svgRef.current?.getBoundingClientRect();
      const sx = e.clientX - (rect?.left ?? 0);
      const sy = e.clientY - (rect?.top ?? 0);
      dispatch({ type: "setViewport", viewport: applyZoomAtPoint(vp, action.factor, sx, sy) });
    } else {
      dispatch({ type: "setViewport", viewport: { ...vp, x: vp.x + action.dx / vp.zoom, y: vp.y + action.dy / vp.zoom } });
    }
  };
```

- [ ] **Step 7: Курсор по инструменту + onKeyUp на контейнере**

В контейнере `<div role="application" …>` (строки 462-471) добавить `onKeyUp={onKeyUp}` и вычисляемый курсор. Перед `return` (около строки 388) добавить:

```ts
  const dragging = dragRef.current?.kind === "pan";
  const canvasCursor = dragging ? "grabbing" : (state.tool === "hand" || spaceHeld) ? "grab" : "default";
```

> Примечание: `dragRef` — ref, его смена не ре-рендерит; курсор `grabbing` во время активного пана может не примениться мгновенно. Это косметика — приемлемо. Базовый `grab` при hand/Space обновляется через `spaceHeld`/`state.tool` (оба триггерят ре-рендер). Если в QA «grabbing» важен — завести `useState` для активного drag-kind отдельным follow-up, не в этой задаче.

В JSX контейнера добавить к `style`/атрибутам:

```tsx
          tabIndex={0}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onWheel={onWheel}
          style={{ height: "70vh", cursor: canvasCursor }}
```

- [ ] **Step 8: Verify — гейт без регрессий**

Run: `pnpm test src/features/canvas && pnpm lint`
Expected: PASS (новых тестов нет; существующие reducer/interaction зелёные, lint чистый — особенно проверить, что `spaceHeld` используется и нет unused-var).

- [ ] **Step 9: Commit**

```bash
git add src/features/canvas/ui/canvas-editor.tsx
git commit -m "feat(canvas): tool-aware pointer/wheel, Space-пан, marquee по умолчанию"
```

---

## Task 6: клавиатура — хоткеи инструмента, z-order, nudge (`canvas-editor.tsx`)

**Files:**
- Modify: `src/features/canvas/ui/canvas-editor.tsx` (`onKeyDown` `:252-263`; a11y-комментарий `:450-459`; импорт `resolveNudge`)

**Interfaces:**
- Consumes: `resolveNudge` (Task 4); команды `setTool` (Task 2), `bringToFront`/`sendToBack` (Task 3), существующая `moveSelection`.

> **Тестирование:** как в Task 5 — wiring без юнит-тестов; `resolveNudge` уже покрыт в Task 4. Проверка: гейт + ручной QA.

- [ ] **Step 1: Импортировать `resolveNudge`**

Добавить `resolveNudge` в импорт `from "../editor"`.

- [ ] **Step 2: Полностью заменить `onKeyDown` финальной версией**

**Заменить весь `onKeyDown`** (тот, что собран в Task 5 Step 2) на полную версию ниже. Все ветки — самостоятельные guarded-`if` с ранним `return` (никаких `} else if` для вклейки — это устраняет «рассыпающийся splice»). V/H **обязательно** гейтятся `!e.ctrlKey && !e.metaKey` (иначе `Cmd/Ctrl+V` (paste) и `Cmd+H` переключат инструмент). Nudge — последним, только без ctrl/meta:

```ts
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editingNodeId) return; // текст-оверлей перехватывает ввод

    if (e.code === "Space") {
      e.preventDefault();
      if (!spaceHeld) setSpaceHeld(true);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      dispatch({ type: "deleteSelection" });
      return;
    }
    if (e.key === "Escape") {
      dispatch({ type: "clearSelection" });
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      dispatch(e.shiftKey ? { type: "redo" } : { type: "undo" });
      return;
    }
    // z-order: Cmd/Ctrl + ] / [  (на одиночном и групповом выделении)
    if ((e.ctrlKey || e.metaKey) && e.key === "]") {
      e.preventDefault();
      if (state.selection.nodeIds.length > 0) dispatch({ type: "bringToFront", nodeIds: state.selection.nodeIds });
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "[") {
      e.preventDefault();
      if (state.selection.nodeIds.length > 0) dispatch({ type: "sendToBack", nodeIds: state.selection.nodeIds });
      return;
    }
    // инструмент V/H — ТОЛЬКО без ctrl/meta (не перехватывать Cmd+V / Cmd+H)
    if (!e.ctrlKey && !e.metaKey && (e.key === "v" || e.key === "V")) {
      dispatch({ type: "setTool", tool: "select" });
      return;
    }
    if (!e.ctrlKey && !e.metaKey && (e.key === "h" || e.key === "H")) {
      dispatch({ type: "setTool", tool: "hand" });
      return;
    }
    // nudge стрелками (без ctrl/meta); двигаем выделение, гасим скролл страницы
    const nudge = !(e.ctrlKey || e.metaKey) ? resolveNudge(e.key, e.shiftKey) : null;
    if (nudge && state.selection.nodeIds.length > 0) {
      e.preventDefault();
      dispatch({ type: "moveSelection", dx: nudge.dx, dy: nudge.dy });
    }
  };
```

- [ ] **Step 3: Обновить a11y-комментарий**

В комментарии контейнера (строки 450-459) обновить список клавиш и снять «стрелки не реализованы»:

```
          Текущая клавиатурная модель (tabIndex + onKeyDown/onKeyUp):
            Delete/Backspace — удалить выбранный элемент;
            Escape          — снять выделение;
            Ctrl+Z / Ctrl+Shift+Z — Undo/Redo;
            V / H           — инструмент Select / Hand;
            Space (зажат)   — временный пан (Hand);
            Стрелки         — сдвиг выделения (Shift = 10px);
            Ctrl/Cmd+] / [  — на передний / задний план.
          Колесо: ctrl/meta — зум к курсору, иначе — пан (Figma-конвенция).
```

(Строку «KNOWN A11Y LIMITATION … перемещение узлов клавишами-стрелками … не реализованы» — удалить пункт про стрелки; навигацию между узлами без указателя оставить как оставшийся deferred-пункт.)

- [ ] **Step 4: Verify — гейт**

Run: `pnpm test src/features/canvas && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/canvas/ui/canvas-editor.tsx
git commit -m "feat(canvas): хоткеи V/H, z-order Cmd+]/[ и nudge стрелками"
```

---

## Task 7: тогл Select/Hand в тулбаре + i18n

**Files:**
- Modify: `src/features/canvas/ui/editor-toolbar.tsx`
- Modify: `src/features/canvas/ui/canvas-editor.tsx` (передать `tool={state.tool}` в оба `<EditorToolbar … />`, строки 398-405 и 431-439)
- Modify: `src/i18n/messages/{ru,en,ar,zh}/canvas.ts` (блок `toolbar`)

**Interfaces:**
- Consumes: `state.tool`, `dispatch` (`setTool`).
- Produces: визуальный тогл. Новые i18n-ключи `toolbar.toolSelect`, `toolbar.toolHand`.

- [ ] **Step 1: i18n-ключи (все 4 каталога, `ru` первым)**

В `src/i18n/messages/ru/canvas.ts`, блок `toolbar`, добавить:

```ts
    toolSelect: "Выделение",
    toolHand: "Рука",
```

В `en/canvas.ts` (тот же блок):

```ts
    toolSelect: "Select",
    toolHand: "Hand",
```

В `ar/canvas.ts`:

```ts
    toolSelect: "تحديد",
    toolHand: "يد",
```

В `zh/canvas.ts`:

```ts
    toolSelect: "选择",
    toolHand: "抓手",
```

> ar/zh — рабочий перевод; пометить на вычитку носителем (консистентно с практикой проекта). Порядок ключей внутри блока некритичен, но держать рядом для читаемости.

- [ ] **Step 2: Прокинуть `tool` в тулбар (тип + JSX)**

В `editor-toolbar.tsx`, в `interface Props` добавить:

```ts
  tool: import("../editor").CanvasTool;
  // dispatch уже есть — через него шлём setTool
```

(или импортировать `CanvasTool` отдельным `import type` сверху и использовать `tool: CanvasTool;`.)

В деструктуризации пропсов добавить `tool,`.

В `canvas-editor.tsx` в ОБА рендера `<EditorToolbar …>` добавить пропс `tool={state.tool}`.

- [ ] **Step 3: Добавить тогл в разметку тулбара**

В `editor-toolbar.tsx`, сразу после первого разделителя (после строки `<span className="mx-1 h-5 w-px bg-(--color-border)" />` на строке 49), вставить группу:

```tsx
      <Button type="button" compact tone={tool === "select" ? "primary" : "quiet"} onClick={() => { dispatch({ type: "setTool", tool: "select" }); }}>
        {t("toolbar.toolSelect")}
      </Button>
      <Button type="button" compact tone={tool === "hand" ? "primary" : "quiet"} onClick={() => { dispatch({ type: "setTool", tool: "hand" }); }}>
        {t("toolbar.toolHand")}
      </Button>
      <span className="mx-1 h-5 w-px bg-(--color-border)" />
```

- [ ] **Step 4: Verify**

Run: `pnpm test src/i18n && pnpm lint && pnpm test src/features/canvas`
Expected: PASS (i18n-паритет-тесты зелёные — все 4 каталога согласованы; типы тулбара ок).

- [ ] **Step 5: Commit**

```bash
git add src/features/canvas/ui/editor-toolbar.tsx src/features/canvas/ui/canvas-editor.tsx src/i18n/messages/ru/canvas.ts src/i18n/messages/en/canvas.ts src/i18n/messages/ar/canvas.ts src/i18n/messages/zh/canvas.ts
git commit -m "feat(canvas): тогл инструмента Select/Hand в тулбаре + i18n"
```

---

## Task 8: контекстное меню z-order (правый клик) + i18n

**Files:**
- Modify: `src/features/canvas/ui/canvas-editor.tsx` (импорт `ContextMenu`; новый `onContextMenu`; обернуть контейнер; рендер меню)
- Modify: `src/i18n/messages/{ru,en,ar,zh}/canvas.ts` (новый блок `contextMenu`)

**Interfaces:**
- Consumes: kit `ContextMenu` (Task 1); `bringToFront`/`sendToBack`/`deleteSelection`; `hitTestNode`, `eventWorld`, `selectedNodeIds`.
- Produces: меню по правому клику. Новые i18n-ключи `contextMenu.bringToFront/sendToBack/delete`.

> **Тестирование:** wiring без юнит-тестов; проверка — гейт + ручной QA. Поведение Base UI (открытие/анкор) верифицируется в браузере.

- [ ] **Step 1: i18n-ключи (все 4 каталога)**

В `src/i18n/messages/ru/canvas.ts` добавить новый блок (рядом с `toolbar`/`inspector`):

```ts
  // --- editor context menu (right-click) ---
  contextMenu: {
    bringToFront: "На передний план",
    sendToBack: "На задний план",
    delete: "Удалить",
  },
```

`en`:

```ts
  contextMenu: {
    bringToFront: "Bring to front",
    sendToBack: "Send to back",
    delete: "Delete",
  },
```

`ar`:

```ts
  contextMenu: {
    bringToFront: "إحضار إلى الأمام",
    sendToBack: "إرسال إلى الخلف",
    delete: "حذف",
  },
```

`zh`:

```ts
  contextMenu: {
    bringToFront: "置于顶层",
    sendToBack: "置于底层",
    delete: "删除",
  },
```

> ar/zh — на вычитку носителем.

- [ ] **Step 2: Импорт и обработчик**

В `canvas-editor.tsx` добавить импорт kit-примитива из barrel (тот же путь, что и остальной kit; `ContextMenu` уже реэкспортится из Task 1):

```ts
import { ContextMenu } from "@/components/ui";
```

Добавить обработчик правого клика (рядом с другими pointer-хендлерами):

```ts
  // правый клик: нацелить меню на узел под курсором; по пустому фону — НЕ показывать.
  // КРИТИЧНО (ревью): Base UI ContextMenu открывается своим обработчиком contextmenu,
  // и обычный e.preventDefault() его НЕ останавливает (гасит лишь нативное меню браузера).
  // Чтобы подавить открытие popup, надо вызвать e.preventBaseUIHandler() — Base UI
  // добавляет этот метод на синтетическое событие, а наш onContextMenu по правилам
  // mergeProps выполняется ДО базового. Тип события расширяем локально.
  const onCanvasContextMenu = (e: React.MouseEvent & { preventBaseUIHandler?: () => void }) => {
    const world = eventWorld(e);
    const hit = hitTestNode(world, renderData.nodes);
    if (!hit) {
      e.preventDefault();          // нет нативного меню
      e.preventBaseUIHandler?.();  // и Base UI не открывает popup по пустому фону
      return;
    }
    if (!selectedNodeIds.has(hit.id)) {
      dispatch({ type: "selectNode", nodeId: hit.id, additive: false });
    }
    // на узле: НЕ зовём preventBaseUIHandler — даём меню открыться и заанкориться к курсору
  };
```

> Если `preventBaseUIHandler` окажется недоступен в текущей сборке Base UI — проверить точное имя метода в `node_modules/@base-ui/react/.../mergeProps`/`makeEventPreventable`; как страховку оставить `disabled`-пункты (Step 3), но цель «по пустому фону меню не появляется» достигается именно подавлением базового обработчика, не `preventDefault`.

- [ ] **Step 3: Обернуть холст в `ContextMenu` и отрендерить меню**

Перед `return` (рядом с `canvasCursor` из Task 5) вычислить один раз:

```ts
  const hasNodeSelection = state.selection.nodeIds.length > 0;
```

Обернуть контейнер `<div role="application" …>` в `ContextMenu.Root` + `ContextMenu.Trigger` (через `render`, чтобы НЕ плодить лишний DOM и сохранить role/tabIndex/обработчики). `Separator` идёт БЕЗ `className` (kit уже несёт стиль, Task 1). Z-order-пункты `disabled` при пустом выделении (инвариант, не запасная мера). Структура:

```tsx
        <ContextMenu.Root>
          <ContextMenu.Trigger
            render={
              <div
                role="application"
                aria-label={t("editor.ariaLabel")}
                className="relative flex-1"
                tabIndex={0}
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
                onWheel={onWheel}
                onContextMenu={onCanvasContextMenu}
                style={{ height: "70vh", cursor: canvasCursor }}
              />
            }
          >
            <svg ref={svgRef} /* …без изменений… */>
              {/* …existing layers… */}
            </svg>
            {editingNode && (<EditorTextOverlay /* … */ />)}
          </ContextMenu.Trigger>

          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup>
                <ContextMenu.Item disabled={!hasNodeSelection} onClick={() => { dispatch({ type: "bringToFront", nodeIds: state.selection.nodeIds }); }}>
                  {t("contextMenu.bringToFront")}
                </ContextMenu.Item>
                <ContextMenu.Item disabled={!hasNodeSelection} onClick={() => { dispatch({ type: "sendToBack", nodeIds: state.selection.nodeIds }); }}>
                  {t("contextMenu.sendToBack")}
                </ContextMenu.Item>
                <ContextMenu.Separator />
                <ContextMenu.Item disabled={!hasNodeSelection} onClick={() => { dispatch({ type: "deleteSelection" }); }}>
                  {t("contextMenu.delete")}
                </ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
```

> **eslint-disable (риск lint):** над текущим `<div role="application">` стоят два `// eslint-disable-next-line jsx-a11y/no-noninteractive-*` (строки ~468, 474). При переезде в `render={<div .../>}` их надо положить так, чтобы они глушили именно нужные строки внутри JSX-выражения. Это хрупко — **обязательно прогнать `pnpm lint` и при красноте jsx-a11y** скорректировать размещение (возможно блочный `/* eslint-disable jsx-a11y/... */ … /* eslint-enable */` вокруг render-выражения).
> **`relative` критичен:** `EditorTextOverlay` позиционируется абсолютно относительно этого контейнера — `className="relative flex-1"` ДОЛЖЕН остаться на нём (а в fallback-ветке ниже — на ВНУТРЕННЕМ div, не на внешней обёртке).
> **Fallback по `render`-merge:** если `render`-merge Base UI Trigger конфликтует с пробросом обработчиков/ref — оставить `<div role="application">` как есть и обернуть его СНАРУЖИ `ContextMenu.Trigger` без `render` (доп. обёртка `flex-1`), сохранив `relative` на внутреннем контейнере. Выбрать рабочий вариант в браузере. (По проверке ревью `render`-merge в 1.4.1 валиден — fallback маловероятен.)

- [ ] **Step 4: Verify — гейт целиком**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное. Особое внимание: Guardrail 7 (base-ui не утёк за пределы `ui/` — в канвасе только kit `ContextMenu`), i18n-паритет 4 каталогов.

- [ ] **Step 5: Commit**

```bash
git add src/features/canvas/ui/canvas-editor.tsx src/i18n/messages/ru/canvas.ts src/i18n/messages/en/canvas.ts src/i18n/messages/ar/canvas.ts src/i18n/messages/zh/canvas.ts
git commit -m "feat(canvas): контекстное меню z-order по правому клику + i18n"
```

---

## Task 9: вычистка мёртвого кода (`panBy` / `zoomAt`)

**Контекст:** ревью нашло мёртвые viewport-команды. `panBy` и `zoomAt` определены в `EditorCommand` и обработаны в редьюсере, но **нигде не диспатчатся** (grep по `src` — только кейсы редьюсера + один тест `panBy`; пан/зум идут через `setViewport`/`applyZoomAtPoint`). Удаляем обе. Эта задача независима от Tasks 1–8 — можно выполнять первой или последней.

**Files:**
- Modify: `src/features/canvas/editor/editor-types.ts` (убрать 2 строки из `EditorCommand`)
- Modify: `src/features/canvas/editor/canvas-reducer.ts` (убрать `case "panBy"` и `case "zoomAt"`)
- Modify: `src/features/canvas/editor/canvas-reducer.test.ts` (убрать тест `panBy`)

**Interfaces:**
- Produces: ничего нового; сужает `EditorCommand` (убирает `panBy`/`zoomAt`).

- [ ] **Step 1: Убедиться, что команды мертвы**

Run: `grep -rn 'panBy\|zoomAt' src`
Expected: совпадения ТОЛЬКО в `editor-types.ts` (объявления), `canvas-reducer.ts` (кейсы), `canvas-reducer.test.ts` (тест panBy). Никаких `dispatch({ type: "panBy" })`/`"zoomAt"` в UI. Если есть call-site — НЕ удалять, эскалировать.

- [ ] **Step 2: Удалить тест `panBy`**

В `canvas-reducer.test.ts`, в `describe("viewport команды", …)`, удалить блок (сохранив `toggleGrid`):

```ts
  it("panBy сдвигает мир", () => {
    let s = initEditorState(baseData);
    s = canvasReducer(s, { type: "panBy", dx: 10, dy: -5 });
    expect(s.viewport.x).toBe(10);
    expect(s.viewport.y).toBe(-5);
  });
```

- [ ] **Step 3: Удалить команды из `editor-types.ts`**

В `EditorCommand`, секция `// --- viewport ---`, удалить две строки (оставить `setViewport`):

```ts
  | { type: "panBy"; dx: number; dy: number }
  | { type: "zoomAt"; factor: number; screenX: number; screenY: number; viewportWidth: number; viewportHeight: number }
```

- [ ] **Step 4: Удалить кейсы из `canvas-reducer.ts`**

Удалить `case "panBy": …` и весь блок `case "zoomAt": { … }` (около строк 73-86). НЕ трогать `case "setViewport"` и `case "toggleGrid"`. Проверить, что импорт `Viewport` остаётся нужен (его использует `DEFAULT_VIEWPORT`) — не удалять импорт.

- [ ] **Step 5: Verify**

Run: `pnpm test src/features/canvas/editor/canvas-reducer.test.ts && pnpm lint`
Expected: PASS — switch имеет `default: return state;`, удаление кейсов безопасно; TS-исчерпывающести по `EditorCommand` нет (есть default), так что красноты нет. `grep -rn 'panBy\|zoomAt' src` теперь пусто.

- [ ] **Step 6: Commit**

```bash
git add src/features/canvas/editor/editor-types.ts src/features/canvas/editor/canvas-reducer.ts src/features/canvas/editor/canvas-reducer.test.ts
git commit -m "refactor(canvas): удалить мёртвые команды panBy/zoomAt"
```

---

## Финальная верификация (после всех задач)

- [ ] **Гейт зелёный:** `pnpm lint && pnpm test && pnpm build`.
- [ ] **Ручной браузер-QA** (на `/canvases/<id>/edit`):
  - Select (дефолт): drag по пустому → marquee выделяет узлы; `Shift`+drag → добавляет к выделению; клик по пустому → снимает выделение.
  - Пан: зажать `Space`+drag, средняя кнопка+drag, two-finger тачпад — холст движется; курсор `grab`/`grabbing`.
  - Hand-тогл (или `H`): drag по пустому и по узлу → пан; `V` → обратно в Select.
  - Зум: `Cmd/Ctrl`+колесо и пинч → зум к курсору; плоское колесо → пан.
  - Nudge: выбрать узел → стрелки двигают на 1px, `Shift`+стрелка — 10px; на группе — двигает всех; в режиме редактирования текста стрелки двигают курсор, НЕ узел.
  - Z-order: правый клик по узлу → меню «на передний/задний план», «удалить»; проверить перекрытие узлов до/после; `Cmd+]`/`Cmd+[` на одном узле и на группе; правый клик по пустому → меню НЕ появляется (или пункты дизейблены — fallback).
  - Тач (если есть устройство): один палец = пан, тап по узлу = выделить.
  - RTL (локаль `ar`): тулбар-тогл и контекстное меню раскладываются зеркально, текст корректный.
- [ ] **Финиш ветки:** предложить пользователю `superpowers:finishing-a-development-branch` (push + QA за пользователем — деструктивный git/push заблокированы, выполняет пользователь).

---

## Self-Review (выполнено при написании плана)

- **Покрытие спеки:** §3 ContextMenu → Task 1; §B1 tool/setTool → Task 2; §C z-order команды → Task 3; §B2/B4 хелперы → Task 4; §B2/B3/B4 wiring → Task 5; §B6 тулбар → Task 7; §B7 nudge + §C хоткеи → Task 6; §C меню → Task 8; §6 i18n → Tasks 7,8. Все разделы спеки покрыты.
- **Типы согласованы:** `CanvasTool` (Task 2) используется в `GestureInput` (Task 4), пропсах тулбара (Task 7); команды `setTool/bringToFront/sendToBack` определены в Task 2/3 и потребляются в Task 6/8 с теми же сигнатурами (`nodeIds: string[]`).
- **Без плейсхолдеров:** код приведён для всех тестируемых единиц; для wiring-задач (конвенционно без юнит-тестов) явно указан способ проверки — гейт + QA, а не пропуск.
