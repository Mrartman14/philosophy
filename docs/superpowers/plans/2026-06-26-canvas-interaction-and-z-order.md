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
- Modify: `src/components/ui/index.ts` (реэкспорт, если `Menu` экспортится оттуда)

**Interfaces:**
- Produces: `ContextMenu` — объект с полями `Root, Trigger, Portal, Positioner, Popup, Item, Separator` (passthrough/стилизованные части Base UI ContextMenu). Используется в Task 8.

- [ ] **Step 1: Посмотреть образец `menu.tsx`**

Прочитать `src/components/ui/menu.tsx` целиком — новый файл должен быть его точным зеркалом, но из `@base-ui/react/context-menu`. Части ContextMenu (проверены в Base UI 1.4.1): `Root, Trigger, Portal, Positioner, Popup, Item, Separator` (Popup/Positioner/Item/Separator переиспользуются из Menu внутри пакета).

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
  it("opens on contextmenu and fires item onClick", async () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    fireEvent.contextMenu(screen.getByTestId("area"));
    const item = await screen.findByText("Action");
    fireEvent.click(item);
    expect(onPick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Запустить тест — убедиться, что падает**

Run: `pnpm test src/components/ui/context-menu.test.tsx`
Expected: FAIL — `Cannot find module './context-menu'`.

- [ ] **Step 4: Реализовать примитив**

Создать `src/components/ui/context-menu.tsx`:

```tsx
"use client";
// src/components/ui/context-menu.tsx
// Compound-обёртка над Base UI ContextMenu (меню по правому клику / long-press).
// Зеркало menu.tsx: Root/Trigger/Portal/Positioner — passthrough; Popup несёт
// общий surface-стиль; Item — стиль пункта. className — наивный cn-join (как в ките).
import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu";
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from "react";

import { cn } from "./cn";

const Popup = forwardRef<
  ComponentRef<typeof BaseContextMenu.Popup>,
  ComponentPropsWithoutRef<typeof BaseContextMenu.Popup>
>(function ContextMenuPopup({ className, ...rest }, ref) {
  return (
    <BaseContextMenu.Popup
      ref={ref}
      className={cn(
        "min-w-44 rounded border border-(--color-border) bg-(--color-surface) p-1 shadow-lg outline-none",
        className as string,
      )}
      {...rest}
    />
  );
});

const ITEM_CLASS =
  "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-(--color-surface-subtle) data-[disabled]:opacity-50";

const Item = forwardRef<
  ComponentRef<typeof BaseContextMenu.Item>,
  ComponentPropsWithoutRef<typeof BaseContextMenu.Item>
>(function ContextMenuItem({ className, ...rest }, ref) {
  return <BaseContextMenu.Item ref={ref} className={cn(ITEM_CLASS, className as string)} {...rest} />;
});

export const ContextMenu = {
  Root: BaseContextMenu.Root,
  Trigger: BaseContextMenu.Trigger,
  Portal: BaseContextMenu.Portal,
  Positioner: BaseContextMenu.Positioner,
  Popup,
  Item,
  Separator: BaseContextMenu.Separator,
};
```

Если `Menu` реэкспортится из `src/components/ui/index.ts` — добавить туда `export { ContextMenu } from "./context-menu";` (проверить, как именно сделан реэкспорт `Menu`, и повторить тот же стиль).

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Run: `pnpm test src/components/ui/context-menu.test.tsx`
Expected: PASS.

- [ ] **Step 6: Lint**

Run: `pnpm lint`
Expected: без ошибок (в частности Guardrail 7 доволен — base-ui внутри `ui/`).

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/context-menu.tsx src/components/ui/context-menu.test.tsx src/components/ui/index.ts
git commit -m "feat(ui): kit-примитив ContextMenu (обёртка Base UI)"
```
(Если `index.ts` не менялся — не добавлять его.)

---

## Task 2: reducer — состояние инструмента (`tool`) + команда `setTool`

**Files:**
- Modify: `src/features/canvas/editor/editor-types.ts`
- Modify: `src/features/canvas/editor/canvas-reducer.ts:34-46` (initEditorState), `:70-88` (switch)
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
git add src/features/canvas/editor/editor-types.ts src/features/canvas/editor/canvas-reducer.ts src/features/canvas/editor/canvas-reducer.test.ts
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

После `case "setNodeSize": { … }` (около строки 168) добавить:

```ts
    case "bringToFront": {
      const ids = new Set(command.nodeIds);
      if (ids.size === 0) return state;
      const nodes = state.data.nodes ?? [];
      const moved = nodes.filter((n) => n.id != null && ids.has(n.id));
      if (moved.length === 0) return state;
      const rest = nodes.filter((n) => !(n.id != null && ids.has(n.id)));
      return commit(state, { ...state.data, nodes: [...rest, ...moved] });
    }
    case "sendToBack": {
      const ids = new Set(command.nodeIds);
      if (ids.size === 0) return state;
      const nodes = state.data.nodes ?? [];
      const moved = nodes.filter((n) => n.id != null && ids.has(n.id));
      if (moved.length === 0) return state;
      const rest = nodes.filter((n) => !(n.id != null && ids.has(n.id)));
      return commit(state, { ...state.data, nodes: [...moved, ...rest] });
    }
```

`Array.prototype.filter` сохраняет порядок → относительный порядок группы сохраняется.

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

- [ ] **Step 3: Реализовать `interaction.ts`**

Создать `src/features/canvas/editor/interaction.ts`:

```ts
// src/features/canvas/editor/interaction.ts
// Чистые хелперы развилки ввода: pointer-жесты, колесо, nudge. Без React/DOM —
// тестируются изолированно; canvas-editor.tsx лишь подставляет сюда поля событий.
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

const ZOOM_IN = 1.1;
const ZOOM_OUT = 1 / 1.1;

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
git add src/features/canvas/editor/interaction.ts src/features/canvas/editor/interaction.test.ts src/features/canvas/editor/index.ts
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

- [ ] **Step 1: Импортировать хелперы**

В блоке `import { … } from "../editor";` (строки 12-15) добавить к списку: `resolveBackgroundGesture, resolveNodeGesture, resolveWheel`.

- [ ] **Step 2: Добавить отслеживание Space**

Рядом с другими `useState` (около строки 86) добавить:

```ts
  const [spaceHeld, setSpaceHeld] = useState(false);
```

В `onKeyDown` (строки 252-263), СРАЗУ ПОСЛЕ гейта `if (editingNodeId) return;` (чтобы в режиме редактирования текста Space печатал пробел, а не включал пан):

```ts
    if (e.code === "Space" && !spaceHeld) {
      e.preventDefault(); // не скроллить страницу / не «нажимать» фокус
      setSpaceHeld(true);
      return;
    }
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

- [ ] **Step 2: Расширить `onKeyDown`**

Текущий `onKeyDown` (строки 252-263) после гейта `if (editingNodeId) return;` и после Space-ветки (Task 5). Добавить ВНУТРЬ, после существующих веток Delete/Escape/Undo, новые ветки:

```ts
    // переключение инструмента (Figma V/H)
    } else if (e.key === "v" || e.key === "V") {
      dispatch({ type: "setTool", tool: "select" });
    } else if (e.key === "h" || e.key === "H") {
      dispatch({ type: "setTool", tool: "hand" });
    // z-order: Cmd/Ctrl + ] / [
    } else if ((e.ctrlKey || e.metaKey) && e.key === "]") {
      e.preventDefault();
      if (state.selection.nodeIds.length > 0) dispatch({ type: "bringToFront", nodeIds: state.selection.nodeIds });
    } else if ((e.ctrlKey || e.metaKey) && e.key === "[") {
      e.preventDefault();
      if (state.selection.nodeIds.length > 0) dispatch({ type: "sendToBack", nodeIds: state.selection.nodeIds });
    }
```

И ОТДЕЛЬНО — nudge (только когда нет ctrl/meta, чтобы не конфликтовать с зумом/браузером). Добавить перед `}` закрытия функции, отдельным `if` (не в той же цепочке `else if`, т.к. условие про nodeIds):

```ts
    const nudge = !(e.ctrlKey || e.metaKey) ? resolveNudge(e.key, e.shiftKey) : null;
    if (nudge && state.selection.nodeIds.length > 0) {
      e.preventDefault(); // не скроллить страницу стрелками
      dispatch({ type: "moveSelection", dx: nudge.dx, dy: nudge.dy });
    }
```

> Порядок: гейт `editingNodeId` уже стоит первым (в текст-режиме стрелки идут в курсор). Space-ветка (Task 5) — следом. Затем Delete/Escape/Undo/tool/z-order цепочка. Затем nudge-блок. Убедиться, что V/H не перехватываются, когда зажат ctrl/meta (там свои сочетания) — добавить в V/H-ветки защиту `!e.ctrlKey && !e.metaKey` при необходимости.

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

В `canvas-editor.tsx` добавить импорт kit-примитива (рядом с другими `@/components/ui`):

```ts
import { ContextMenu } from "@/components/ui/context-menu";
```

(или из barrel `@/components/ui`, если Task 1 туда его добавил — использовать тот же путь, что и `Menu`.)

Добавить обработчик правого клика (рядом с другими pointer-хендлерами):

```ts
  // правый клик: нацелить меню на узел под курсором; пустота → не показывать
  const onCanvasContextMenu = (e: React.MouseEvent) => {
    const world = eventWorld(e);
    const hit = hitTestNode(world, renderData.nodes);
    if (!hit) {
      e.preventDefault(); // гасим нативное меню; по пустому фону своё не открываем
      return;
    }
    if (!selectedNodeIds.has(hit.id)) {
      dispatch({ type: "selectNode", nodeId: hit.id, additive: false });
    }
    // не preventDefault — даём Base UI ContextMenu открыться и заанкориться к курсору
  };
```

- [ ] **Step 3: Обернуть холст в `ContextMenu` и отрендерить меню**

Обернуть контейнер `<div role="application" …>` в `ContextMenu.Root` + `ContextMenu.Trigger` (через `render`, чтобы НЕ плодить лишний DOM и сохранить role/tabIndex/обработчики). Структура:

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
                <ContextMenu.Item onClick={() => { dispatch({ type: "bringToFront", nodeIds: state.selection.nodeIds }); }}>
                  {t("contextMenu.bringToFront")}
                </ContextMenu.Item>
                <ContextMenu.Item onClick={() => { dispatch({ type: "sendToBack", nodeIds: state.selection.nodeIds }); }}>
                  {t("contextMenu.sendToBack")}
                </ContextMenu.Item>
                <ContextMenu.Separator className="my-1 h-px bg-(--color-border)" />
                <ContextMenu.Item onClick={() => { dispatch({ type: "deleteSelection" }); }}>
                  {t("contextMenu.delete")}
                </ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
```

> Прежние eslint-disable-комментарии (`jsx-a11y/no-noninteractive-*`) над `<div role="application">` сохранить — перенести к `render`-элементу.
> **Если** `render`-merge Base UI Trigger конфликтует с пробросом обработчиков/ref — fallback: оставить `<div role="application">` как есть и обернуть его СНАРУЖИ `ContextMenu.Trigger` без `render` (доп. div-обёртка `display: contents`/`flex-1`). Выбрать рабочий вариант в браузере.
> **Если** Base UI всё же открывает меню по пустому фону несмотря на `preventDefault` — добавить дизейбл пунктов z-order при `state.selection.nodeIds.length === 0` (проп `disabled` на `ContextMenu.Item`) как запасную меру.

- [ ] **Step 4: Verify — гейт целиком**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное. Особое внимание: Guardrail 7 (base-ui не утёк за пределы `ui/` — в канвасе только kit `ContextMenu`), i18n-паритет 4 каталогов.

- [ ] **Step 5: Commit**

```bash
git add src/features/canvas/ui/canvas-editor.tsx src/i18n/messages/ru/canvas.ts src/i18n/messages/en/canvas.ts src/i18n/messages/ar/canvas.ts src/i18n/messages/zh/canvas.ts
git commit -m "feat(canvas): контекстное меню z-order по правому клику + i18n"
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
