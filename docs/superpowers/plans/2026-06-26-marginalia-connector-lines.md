# Marginalia Connector Lines — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Нарисовать постоянные выноски-связи (Word-style ортогональные «локти») от карточек маргиналий (комментарии слева, аннотации справа) к их тексту-якорю, и сделать комментарии всегда-видимыми (eager), как аннотации.

**Architecture:** Один чистый модуль геометрии (`connector-geometry.ts`) рисует SVG-путь локтя; один тонкий SVG-оверлей (`connector-layer.tsx`, портал в `document.body`, document-координаты, как `highlight-overlay.tsx`) рендерит путь на каждую видимую заметку; eager-слой `MarginAnchorLayer` получает hover-акцент (`useHoverReveal` + наведение на карточку) и монтирует оверлей. Комментарии мигрируют с lazy `InlineAnchorLayer` на тот же `MarginAnchorLayer` (унификация; `InlineAnchorLayer` удаляется).

**Tech Stack:** TypeScript, React 19, Next 16, Vitest + Testing Library, существующий движок `src/components/anchor-engine`.

## Global Constraints

- Пакетный менеджер — **pnpm** (НЕ npm). Гейт: `pnpm lint && pnpm test && pnpm build`.
- Параллельные агенты: НЕ делать `git stash/reset/checkout .//clean`, НЕ `git add -A`/`git add .` — добавлять только перечисленные в задаче файлы по имени. Передавать это субагентам.
- Именование файлов в `src/` — kebab-case.
- Общение с пользователем — на русском.
- **Запретные зоны НЕ трогаем:** `src/api/schema.ts`, shell-файлы (`src/app/layout.tsx`, `globals.css` и т.п.), `src/components/ui/*`, `src/utils/*`, `src/hooks/*`, `src/services/*`, `package.json`. Вся работа — в `src/components/anchor-engine/*` и доменных коннекторах `src/features/{annotations,comments}/ui/*`. CSS НЕ добавляем — цвета выносок задаются inline через существующие токены (`--color-highlight-active`, `--color-link`); подсветка комментария уже отличается от аннотации пунктирным подчёркиванием (`::highlight(comment)` в globals.css — не меняем).
- Брейкпоинт «wide» = `(min-width: 80rem)` (как в `margin-notes-column.tsx`). Выноски рисуются ТОЛЬКО на wide.
- Координаты оверлея — document-space (`rect + window.scrollX/scrollY`), пересчёт на `scroll`(capture)+`resize`, как в `highlight-overlay.tsx`.
- Субагентов диспатчить на модели **opus**.

---

### Task 1: Чистая геометрия локтя (`connector-geometry.ts`)

**Files:**
- Create: `src/components/anchor-engine/connector-geometry.ts`
- Test: `src/components/anchor-engine/connector-geometry.test.ts`

**Interfaces:**
- Produces:
  - `interface ElbowInput { x1: number; y1: number; x2: number; y2: number; stub?: number }`
  - `function connectorPath(input: ElbowInput): string` — SVG-атрибут `d` ортогонального локтя: от точки крепления к тексту `(x1,y1)` → горизонтальный ус в жёлоб → вертикаль → горизонтальный ус к карточке `(x2,y2)`. Вертикаль стоит на `vx = x1 + dir*min(stub, |x2-x1|)`, где `dir = sign(x2-x1)` — это держит все x в `[min(x1,x2), max(x1,x2)]` (никогда в зоне текста). `stub` по умолчанию `12`.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/components/anchor-engine/connector-geometry.test.ts
import { describe, expect, it } from "vitest";

import { connectorPath } from "./connector-geometry";

describe("connectorPath", () => {
  it("правая сторона (карточка правее текста): вертикаль у края текста", () => {
    expect(connectorPath({ x1: 100, y1: 50, x2: 300, y2: 200 })).toBe(
      "M 100 50 L 112 50 L 112 200 L 300 200",
    );
  });

  it("левая сторона (карточка левее текста): ус идёт влево", () => {
    expect(connectorPath({ x1: 300, y1: 50, x2: 100, y2: 200 })).toBe(
      "M 300 50 L 288 50 L 288 200 L 100 200",
    );
  });

  it("узкий жёлоб: stub зажимается до ширины жёлоба (vx не выходит за карточку)", () => {
    expect(connectorPath({ x1: 100, y1: 10, x2: 106, y2: 80, stub: 12 })).toBe(
      "M 100 10 L 106 10 L 106 80 L 106 80",
    );
  });

  it("инвариант: все x пути лежат в [min(x1,x2), max(x1,x2)] (текст не пересекается)", () => {
    const d = connectorPath({ x1: 120, y1: 0, x2: 420, y2: 999 });
    const xs = [...d.matchAll(/[ML] (\d+(?:\.\d+)?) /g)].map((m) => Number(m[1]));
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(120);
      expect(x).toBeLessThanOrEqual(420);
    }
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm test -- src/components/anchor-engine/connector-geometry.test.ts`
Expected: FAIL — `connectorPath` не найден / модуль отсутствует.

- [ ] **Step 3: Реализовать**

```ts
// src/components/anchor-engine/connector-geometry.ts
// Чистая геометрия выноски-связи (Word-style ортогональный «локоть»). Без React/DOM.
// Инвариант: вертикаль (vx) стоит на стороне жёлоба, все x ∈ [min(x1,x2),max(x1,x2)] —
// путь никогда не заходит в зону текста (см. spec §«Геометрические инварианты»).
export interface ElbowInput {
  x1: number; // точка крепления к тексту (document-координаты)
  y1: number;
  x2: number; // точка крепления к карточке
  y2: number;
  stub?: number; // длина горизонтального уса в жёлоб
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function connectorPath({ x1, y1, x2, y2, stub = 12 }: ElbowInput): string {
  const dir = x2 >= x1 ? 1 : -1;
  const vx = x1 + dir * Math.min(stub, Math.abs(x2 - x1)); // вертикаль у края текста, зажата в жёлоб
  return `M ${round(x1)} ${round(y1)} L ${round(vx)} ${round(y1)} L ${round(vx)} ${round(y2)} L ${round(x2)} ${round(y2)}`;
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm test -- src/components/anchor-engine/connector-geometry.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Коммит**

```bash
git add src/components/anchor-engine/connector-geometry.ts src/components/anchor-engine/connector-geometry.test.ts
git commit -m "feat(anchor-engine): чистая геометрия выноски-связи (ортогональный локоть)"
```

---

### Task 2: SVG-оверлей выносок (`connector-layer.tsx`)

**Files:**
- Create: `src/components/anchor-engine/connector-layer.tsx`
- Test: `src/components/anchor-engine/connector-layer.test.tsx`

**Interfaces:**
- Consumes: `connectorPath` (Task 1); `cssEscape` из `./css-escape`.
- Produces:
  - `interface ConnectorLayerProps { ids: string[]; getAnchorRect: (id: string) => DOMRect | null; astRootRef: RefObject<HTMLElement | null>; activeId: string | null; tone: "annotation" | "comment"; recomputeKey: number }`
  - `function ConnectorLayer(props: ConnectorLayerProps): ReactNode` — портал-SVG в `document.body`; рисует `<path data-connector={id}>` на каждый id, у которого есть и якорь (`getAnchorRect != null`), и DOM-карточка (`[data-note-card-wrapper="id"]`); только на wide; `activeId` → акцент (толще + полная непрозрачность), остальные приглушены.

**Notes:**
- Сторона выводится из геометрии (`card.left >= anchor.right` → карточка правее → правая сторона) — RTL-safe.
- Точка крепления к тексту: x = край текстовой колонки (`astRoot` rect, правый для правой стороны / левый для левой), y = центр первой строки якоря (`anchor.top + min(anchor.height, 24)/2`).
- Точка крепления к карточке: x = обращённый к тексту край карточки, y = `card.top + 14`.
- Цвет: `comment → var(--color-link)`, иначе `var(--color-highlight-active)` (inline, без CSS-файлов).

- [ ] **Step 1: Написать падающий тест**

```tsx
// src/components/anchor-engine/connector-layer.test.tsx
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectorLayer } from "./connector-layer";

function stubMatch(matches: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
}

function rect(o: Partial<DOMRect>): DOMRect {
  return {
    top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0,
    toJSON() {}, ...o,
  } as DOMRect;
}

function makeRoot(): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-ast-root", "");
  root.getBoundingClientRect = () => rect({ left: 0, right: 700, top: 0, bottom: 1000, width: 700, height: 1000 });
  document.body.appendChild(root);
  return root;
}

function addCard(id: string) {
  const w = document.createElement("div");
  w.setAttribute("data-note-card-wrapper", id);
  w.getBoundingClientRect = () => rect({ left: 760, right: 920, top: 40, bottom: 120, width: 160, height: 80 });
  document.body.appendChild(w);
}

const anchorRect = () => rect({ left: 100, right: 300, top: 50, bottom: 70, width: 200, height: 20 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("ConnectorLayer", () => {
  it("на wide рисует по одному path на заметку с якорем и карточкой", () => {
    stubMatch(true);
    const root = makeRoot();
    addCard("a");
    addCard("b");
    render(
      <ConnectorLayer
        ids={["a", "b"]}
        getAnchorRect={anchorRect}
        astRootRef={{ current: root }}
        activeId={null}
        tone="annotation"
        recomputeKey={0}
      />,
    );
    expect(document.querySelectorAll("svg path").length).toBe(2);
  });

  it("пропускает заметку без DOM-карточки", () => {
    stubMatch(true);
    const root = makeRoot();
    addCard("a"); // для "b" карточки нет
    render(
      <ConnectorLayer
        ids={["a", "b"]}
        getAnchorRect={anchorRect}
        astRootRef={{ current: root }}
        activeId={null}
        tone="annotation"
        recomputeKey={0}
      />,
    );
    expect(document.querySelectorAll("svg path").length).toBe(1);
  });

  it("на narrow (не wide) ничего не рисует", () => {
    stubMatch(false);
    const root = makeRoot();
    addCard("a");
    render(
      <ConnectorLayer
        ids={["a"]}
        getAnchorRect={anchorRect}
        astRootRef={{ current: root }}
        activeId={null}
        tone="annotation"
        recomputeKey={0}
      />,
    );
    expect(document.querySelector("svg")).toBeNull();
  });

  it("activeId акцентирует свою линию и гасит остальные", () => {
    stubMatch(true);
    const root = makeRoot();
    addCard("a");
    addCard("b");
    render(
      <ConnectorLayer
        ids={["a", "b"]}
        getAnchorRect={anchorRect}
        astRootRef={{ current: root }}
        activeId="a"
        tone="annotation"
        recomputeKey={0}
      />,
    );
    const a = document.querySelector('[data-connector="a"]');
    const b = document.querySelector('[data-connector="b"]');
    expect(a?.getAttribute("stroke-opacity")).toBe("1");
    expect(a?.getAttribute("stroke-width")).toBe("2");
    expect(b?.getAttribute("stroke-opacity")).toBe("0.25");
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm test -- src/components/anchor-engine/connector-layer.test.tsx`
Expected: FAIL — `ConnectorLayer` не найден.

- [ ] **Step 3: Реализовать**

```tsx
"use client";
// src/components/anchor-engine/connector-layer.tsx
// SVG-оверлей выносок-связей карточка↔текст. Портал в document.body, document-
// координаты (rect + scrollX/Y), пересчёт на scroll/resize/recomputeKey — паттерн
// highlight-overlay.tsx. Рисует на каждую заметку с разрешённым якорем И DOM-
// карточкой ([data-note-card-wrapper]) ортогональный локоть (connector-geometry).
// Только на wide (на narrow поля схлопнуты — линии пересекли бы текст). Сторона
// выводится из геометрии (RTL-safe). aria-hidden + pointer-events:none —
// декоративный слой; клавиатурный путь — карточки и доступный список заметок.
import { useLayoutEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

import { connectorPath } from "./connector-geometry";
import { cssEscape } from "./css-escape";

const WIDE = "(min-width: 80rem)";
const CARD_ATTACH_PX = 14; // вертикальный отступ точки крепления к карточке
const FIRST_LINE_CLAMP_PX = 24; // оценка высоты первой строки для центра якоря

export interface ConnectorLayerProps {
  ids: string[];
  getAnchorRect: (id: string) => DOMRect | null; // viewport-координаты якоря
  astRootRef: RefObject<HTMLElement | null>;
  activeId: string | null;
  tone: "annotation" | "comment";
  recomputeKey: number;
}

interface Seg {
  id: string;
  d: string;
}

function measure(
  ids: string[],
  getAnchorRect: (id: string) => DOMRect | null,
  astRootRef: RefObject<HTMLElement | null>,
): Seg[] {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return [];
  if (!window.matchMedia(WIDE).matches) return [];
  const root = astRootRef.current;
  if (!root) return [];
  const rootRect = root.getBoundingClientRect();
  const segs: Seg[] = [];
  for (const id of ids) {
    const a = getAnchorRect(id);
    if (!a) continue; // сирота / неразрешённый якорь
    const card = document.querySelector<HTMLElement>(
      `[data-note-card-wrapper="${cssEscape(id)}"]`,
    );
    if (!card) continue; // карточка ещё не смонтирована/спозиционирована
    const c = card.getBoundingClientRect();
    const right = c.left >= a.right; // карточка правее текста → правая сторона (RTL-safe)
    const x1 = (right ? rootRect.right : rootRect.left) + window.scrollX;
    const y1 = a.top + Math.min(a.height, FIRST_LINE_CLAMP_PX) / 2 + window.scrollY;
    const x2 = (right ? c.left : c.right) + window.scrollX;
    const y2 = c.top + CARD_ATTACH_PX + window.scrollY;
    segs.push({ id, d: connectorPath({ x1, y1, x2, y2 }) });
  }
  return segs;
}

export function ConnectorLayer({
  ids,
  getAnchorRect,
  astRootRef,
  activeId,
  tone,
  recomputeKey,
}: ConnectorLayerProps) {
  const [segs, setSegs] = useState<Seg[]>([]);
  const idsKey = ids.join(",");

  useLayoutEffect(() => {
    const update = () => {
      setSegs(measure(ids, getAnchorRect, astRootRef));
    };
    update();
    // rAF: даём MarginNotesColumn спозиционировать карточки в его layout-эффекте,
    // затем перемеряем по их финальным rect'ам.
    const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(update) : 0;
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
    // ids покрыт idsKey по значению; getAnchorRect стабилен (useCallback в движке).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, getAnchorRect, astRootRef, recomputeKey]);

  if (segs.length === 0) return null;
  const stroke = tone === "comment" ? "var(--color-link)" : "var(--color-highlight-active)";

  return createPortal(
    <svg
      aria-hidden
      // eslint-disable-next-line no-restricted-syntax -- координатный оверлей, направление-нейтрально (как highlight-overlay)
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 0,
      }}
    >
      {segs.map((s) => {
        const active = activeId === s.id;
        const dimmed = activeId != null && !active;
        return (
          <path
            key={s.id}
            data-connector={s.id}
            d={s.d}
            fill="none"
            stroke={stroke}
            strokeWidth={active ? 2 : 1}
            strokeOpacity={dimmed ? 0.25 : active ? 1 : 0.5}
          />
        );
      })}
    </svg>,
    document.body,
  );
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm test -- src/components/anchor-engine/connector-layer.test.tsx`
Expected: PASS (4 теста).

- [ ] **Step 5: Коммит**

```bash
git add src/components/anchor-engine/connector-layer.tsx src/components/anchor-engine/connector-layer.test.tsx
git commit -m "feat(anchor-engine): SVG-оверлей выносок-связей (портал, wide-only, hover-акцент)"
```

---

### Task 3: Hover-репортинг карточки в `MarginNotesColumn`

**Files:**
- Modify: `src/components/anchor-engine/margin-notes-column.tsx`
- Test: `src/components/anchor-engine/margin-notes-column.test.tsx`

**Interfaces:**
- Produces: `Props` колонки получает опциональный `onHoverNote?: (id: string | null) => void`. На обёртке карточки (`data-note-card-wrapper`) вешаются `onMouseEnter → onHoverNote(id)` и `onMouseLeave → onHoverNote(null)`.

- [ ] **Step 1: Написать падающий тест** (добавить в конец `describe` в `margin-notes-column.test.tsx`)

```tsx
  it("сообщает наведение на карточку через onHoverNote", () => {
    const onHoverNote = vi.fn();
    const { container } = render(
      <MarginNotesColumn
        notes={makeNotes()}
        getAnchorRect={noRect}
        onActivate={() => undefined}
        onHoverNote={onHoverNote}
        recomputeKey={0}
      />,
    );
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- карточка без роли по дизайну
    const card = container.querySelector('[data-note-card-wrapper="a"]') as HTMLElement;
    fireEvent.mouseEnter(card);
    expect(onHoverNote).toHaveBeenCalledWith("a");
    fireEvent.mouseLeave(card);
    expect(onHoverNote).toHaveBeenCalledWith(null);
  });
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test -- src/components/anchor-engine/margin-notes-column.test.tsx`
Expected: FAIL — `onHoverNote` не вызывается (проп не существует).

- [ ] **Step 3: Реализовать**

В `interface Props` (после `recomputeKey`) добавить:

```ts
  onHoverNote?: (id: string | null) => void;
```

В сигнатуре деструктуризации добавить `onHoverNote`:

```ts
export function MarginNotesColumn({ notes, getAnchorRect, onActivate, onHoverNote, recomputeKey }: Props) {
```

На обёртке карточки (`<div key={n.id} data-note-card-wrapper={n.id} ...>`) добавить обработчики рядом с `onClick`:

```tsx
            onMouseEnter={() => onHoverNote?.(n.id)}
            onMouseLeave={() => onHoverNote?.(null)}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm test -- src/components/anchor-engine/margin-notes-column.test.tsx`
Expected: PASS (все тесты, включая новый).

- [ ] **Step 5: Коммит**

```bash
git add src/components/anchor-engine/margin-notes-column.tsx src/components/anchor-engine/margin-notes-column.test.tsx
git commit -m "feat(anchor-engine): MarginNotesColumn сообщает наведение на карточку (onHoverNote)"
```

---

### Task 4: Hover-акцент + выноски + тон в `MarginAnchorLayer`

**Files:**
- Modify: `src/components/anchor-engine/margin-anchor-layer.tsx`
- Modify: `src/components/anchor-engine/use-hover-reveal.ts` (только комментарий-шапка)
- Test: `src/components/anchor-engine/margin-anchor-layer.test.tsx`

**Interfaces:**
- Consumes: `useHoverReveal` (text-hover → id), `ConnectorLayer` (Task 2), `onHoverNote` колонки (Task 3).
- Produces: `MarginAnchorLayerProps` получает `tone?: "annotation" | "comment"` (default `"annotation"`). Эмфаза = `hoveredId ?? activeId` (наведение поверх постоянной видимости). Карточка получает тон-акцент (3px `border-inline-start` цветом тона). Аннотации (единственный текущий потребитель) получают выноски автоматически — отдельной правки `document-annotation-layer.tsx` не требуется (тон по умолчанию = annotation).

- [ ] **Step 1: Написать падающий тест** (добавить в `margin-anchor-layer.test.tsx`)

Сначала прокинуть `tone` через Harness — заменить сигнатуру `Harness` и вызов `MarginAnchorLayer`:

```tsx
function Harness({ notes, tone }: { notes: AnchoredNote[]; tone?: "annotation" | "comment" }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div ref={ref} data-ast-root>
        <p data-block-id="p1">present</p>
      </div>
      <MarginAnchorLayer
        astRootRef={ref}
        notes={notes}
        highlightEnabled
        canCreate={false}
        onCreateRequest={() => undefined}
        affordanceLabel="Add"
        tone={tone}
        renderNote={(n, orphan) => (
          <span>
            {orphan ? "orphan:" : "anchored:"}
            {n.id}
          </span>
        )}
      />
    </div>
  );
}
```

Добавить тест (тон comment не ломает монтирование; smoke остаётся валиден):

```tsx
  it("монтируется с tone=comment без throw", () => {
    expect(() => {
      render(<Harness notes={[orphanNote]} tone="comment" />);
    }).not.toThrow();
    expect(screen.getByText(/orphan:/)).toBeTruthy();
  });
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test -- src/components/anchor-engine/margin-anchor-layer.test.tsx`
Expected: FAIL — `tone` не существует в `MarginAnchorLayerProps` (TS-ошибка/типовой провал сборки теста).

- [ ] **Step 3: Реализовать**

В `margin-anchor-layer.tsx`:

1. Импорты — добавить:

```ts
import { ConnectorLayer } from "./connector-layer";
import { useHoverReveal } from "./use-hover-reveal";
```

2. В `MarginAnchorLayerProps` (после `highlightName?`) добавить:

```ts
  // Тон выноски/акцента карточки: annotation (тёплый) | comment (синий). Default annotation.
  tone?: "annotation" | "comment";
```

3. В деструктуризации `props` добавить `tone = "annotation"`:

```ts
    highlightName = "annotation",
    tone = "annotation",
```

4. После `const [activeId, setActiveId] = useState<string | null>(null);` добавить hover-канал:

```ts
  // Hover-акцент поверх постоянной видимости: наведение на текст (useHoverReveal)
  // или на карточку (onHoverNote колонки) → hoveredId; эмфаза = hoveredId ?? activeId.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  useHoverReveal({ astRootRef, ranges, ready, onHover: setHoveredId });
  const emphasizedId = hoveredId ?? activeId;
```

5. В `useAnchorHighlights` заменить `activeId` на `emphasizedId`:

```ts
  useAnchorHighlights({
    controller,
    ranges,
    persistentIds: allIds,
    activeId: emphasizedId,
    enabled: highlightEnabled,
  });
```

6. Тон-акцент карточки — в `columnNotes` обернуть с inline-бордером:

```tsx
  const accent = tone === "comment" ? "var(--color-link)" : "var(--color-highlight-active)";
  const columnNotes: ColumnNote[] = notes.map((n) => {
    const orphan = (ranges.get(n.id) ?? null) === null;
    return {
      id: n.id,
      orphan,
      node: (
        <div
          data-note-card={n.id}
          // eslint-disable-next-line no-restricted-syntax -- тон-акцент карточки (логическое свойство, RTL-safe)
          style={{ borderInlineStart: `3px solid ${accent}`, paddingInlineStart: "0.5rem" }}
        >
          {renderNote(n, orphan)}
        </div>
      ),
    };
  });
```

7. Прокинуть `onHoverNote` в колонку и смонтировать `ConnectorLayer`. Заменить возвращаемый JSX-хвост:

```tsx
      <MarginNotesColumn
        notes={columnNotes}
        getAnchorRect={getAnchorRect}
        onActivate={onActivate}
        onHoverNote={setHoveredId}
        recomputeKey={recomputeKey}
      />
      <ConnectorLayer
        ids={allIds}
        getAnchorRect={getAnchorRect}
        astRootRef={astRootRef}
        activeId={emphasizedId}
        tone={tone}
        recomputeKey={recomputeKey}
      />
```

8. В `use-hover-reveal.ts` обновить шапку-комментарий: строку «Только для InlineAnchorLayer (комментарии).» заменить на «Используется eager-слоем MarginAnchorLayer (текст-hover → эмфаза).».

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm test -- src/components/anchor-engine/margin-anchor-layer.test.tsx`
Expected: PASS (smoke + новый tone-тест). `matchMedia` в этом тесте отсутствует → `ConnectorLayer` деградирует (guard) → не падает.

- [ ] **Step 5: Коммит**

```bash
git add src/components/anchor-engine/margin-anchor-layer.tsx src/components/anchor-engine/margin-anchor-layer.test.tsx src/components/anchor-engine/use-hover-reveal.ts
git commit -m "feat(anchor-engine): hover-акцент + выноски-связи + тон в MarginAnchorLayer"
```

---

### Task 5: Eager-комментарии на `MarginAnchorLayer`; удаление `InlineAnchorLayer`

**Files:**
- Rewrite: `src/features/comments/ui/document-comment-layer.tsx`
- Delete: `src/components/anchor-engine/inline-anchor-layer.tsx`
- Delete: `src/components/anchor-engine/inline-anchor-layer.test.tsx`
- Modify: `src/components/anchor-engine/index.ts` (убрать экспорт `InlineAnchorLayer` / `InlineAnchorLayerProps`)
- Rewrite test: `src/features/comments/ui/document-comment-layer.test.tsx`

**Interfaces:**
- Consumes: `MarginAnchorLayer` с `tone="comment"`, `highlightName="comment"` (Task 4).
- Поведение: комментарии теперь eager — постоянная подсветка + позиционированные карточки + выноски, как аннотации. Зеркалит SSR-паттерн `document-annotation-layer.tsx`: до mount (`!ready`) — простой список превью (есть в HTML, no-JS/a11y); после mount — `MarginAnchorLayer` позиционирует. Тогл «показать/скрыть подсветку» УДАЛЁН (всегда видно). Узкий экран: `MarginNotesColumn` рендерит превью потоком (фокусируемый a11y-путь), выноски не рисуются.

- [ ] **Step 1: Переписать тест** (`document-comment-layer.test.tsx` целиком)

```tsx
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DocumentCommentLayer } from "./document-comment-layer";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

// Стабильная module-scope ссылка: useAnchorRanges держит notes в deps+setState;
// нестабильный литерал в render зациклил бы effect.
const note = {
  id: "c1",
  anchor: {
    target_entity_type: "document" as const,
    target_entity_id: "doc-1",
    start_block_id: "b1",
    end_block_id: "b1",
    start_char: 0,
    end_char: 3,
    exact: "abc",
  },
  preview: <div>preview-c1</div>,
};
const notes = [note];

function stubMatch(matches: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("DocumentCommentLayer (eager)", () => {
  it("комментарии всегда видимы: превью отрендерено и тогла подсветки нет", () => {
    stubMatch(false); // narrow → превью в потоке
    render(
      <DocumentCommentLayer
        lectureId="L"
        documentId="doc-1"
        rootTypes={["claim"]}
        notes={notes}
        canCreate={false}
      />,
    );
    // Тогл «показать/скрыть» удалён (eager).
    expect(screen.queryByText("marginHighlightShow")).toBeNull();
    expect(screen.queryByText("marginHighlightHide")).toBeNull();
    // Превью комментария присутствует ровно один раз (SSR-список ИЛИ eager-слой,
    // не оба сразу — тернар по ready).
    expect(screen.getAllByText("preview-c1")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test -- src/features/comments/ui/document-comment-layer.test.tsx`
Expected: FAIL — старый слой всё ещё рендерит тогл `marginHighlightShow` (тест ждёт его отсутствия).

- [ ] **Step 3: Переписать `document-comment-layer.tsx`**

```tsx
"use client";
// src/features/comments/ui/document-comment-layer.tsx
// Коннектор движок↔домен (client) для заякоренных комментариев. EAGER-политика
// (как аннотации): постоянная подсветка + позиционированные превью у фрагмента +
// выноски-связи. Зеркалит SSR-инвариант document-annotation-layer: до mount
// (ready=false) превью — простым списком (есть в HTML, no-JS/a11y), после mount
// те же ноды позиционирует MarginAnchorLayer (на narrow — поток, на wide — у
// фрагмента + выноски). Создание из выделения: TextAnchor → buildCommentTextAnchor
// (+target document) → модалка-композер.
// Guardrail 4: импортит только pure-фасады (../anchor, ../types), движок, i18n/client
// и composer-диалог. НЕ тянет server-only api/actions/permissions/schemas.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { MarginAnchorLayer, type AnchorDraft, type AnchoredNote } from "@/components/anchor-engine";
import { useT } from "@/i18n/client";
import { coordsToEngineAnchor } from "@/utils/text-anchor";

import { buildCommentTextAnchor } from "../anchor";
import type { Anchor, CommentType } from "../types";

import { CommentComposerDialog } from "./comment-composer-dialog";

export interface DocumentCommentNote {
  id: string;
  anchor: Anchor;
  preview: ReactNode;
}

export interface DocumentCommentLayerProps {
  lectureId: string;
  documentId: string;
  rootTypes: CommentType[];
  notes: DocumentCommentNote[];
  canCreate: boolean;
}

export function DocumentCommentLayer({
  lectureId,
  documentId,
  rootTypes,
  notes,
  canCreate,
}: DocumentCommentLayerProps) {
  const t = useT("comments");
  const astRootRef = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [composer, setComposer] = useState<{ open: boolean; anchor?: Anchor }>({ open: false });

  useEffect(() => {
    astRootRef.current = document.querySelector<HTMLElement>("[data-ast-root]");
    setReady(true);
  }, []);

  // Доменные ноты → движковые: только валидный text-range (coordsToEngineAnchor != null).
  // Мемоизация по notes: MarginAnchorLayer держит notes в deps useAnchorRanges.
  const engineNotes: AnchoredNote[] = useMemo(
    () =>
      notes.flatMap((n) => {
        const engine = coordsToEngineAnchor(n.anchor);
        return engine ? [{ id: n.id, anchor: engine }] : [];
      }),
    [notes],
  );
  const previewById = useMemo(() => new Map(notes.map((n) => [n.id, n.preview])), [notes]);
  const renderNote = useCallback(
    (n: AnchoredNote) => previewById.get(n.id) ?? null,
    [previewById],
  );

  const engineIds = new Set(engineNotes.map((n) => n.id));
  const ssrOnly = notes.filter((n) => !engineIds.has(n.id)); // без валидного якоря — всегда списком

  return (
    <div className="flex flex-col gap-4" aria-label={t("marginColumnLabel")}>
      {ssrOnly.map((n) => (
        <div key={n.id}>{n.preview}</div>
      ))}

      {!ready ? (
        engineNotes.map((n) => <div key={n.id}>{previewById.get(n.id)}</div>)
      ) : (
        <MarginAnchorLayer
          astRootRef={astRootRef}
          notes={engineNotes}
          renderNote={renderNote}
          highlightEnabled
          canCreate={canCreate}
          onCreateRequest={(d: AnchorDraft) => {
            setComposer({ open: true, anchor: buildCommentTextAnchor(d.anchor, documentId) });
          }}
          affordanceLabel={t("marginCommentAdd")}
          highlightName="comment"
          tone="comment"
        />
      )}

      <CommentComposerDialog
        lectureId={lectureId}
        rootTypes={rootTypes}
        open={composer.open}
        onOpenChange={(open) => {
          setComposer((c) => ({ ...c, open }));
        }}
        anchor={composer.anchor}
      />
    </div>
  );
}
```

- [ ] **Step 4: Удалить `InlineAnchorLayer` и его экспорт**

```bash
git rm src/components/anchor-engine/inline-anchor-layer.tsx src/components/anchor-engine/inline-anchor-layer.test.tsx
```

В `src/components/anchor-engine/index.ts` удалить строку:

```ts
export { InlineAnchorLayer, type InlineAnchorLayerProps } from "./inline-anchor-layer";
```

- [ ] **Step 5: Проверить осиротевшие импорты thread-scroll**

Run: `grep -rn "useScrollToCommentThread\|thread-scroll" src --include='*.tsx' --include='*.ts'`
Expected: если единственные совпадения — определение в `src/features/comments/thread-scroll.ts` (и его тест), значит он осиротел после ухода `onActivateNarrow`. Тогда удалить файл(ы):

```bash
git rm src/features/comments/thread-scroll.ts
# + соответствующий тест, если есть
```

Если `useScrollToCommentThread` используется в другом месте (напр. `CommentSection`) — оставить как есть, ничего не удалять.

- [ ] **Step 6: Запустить тесты затронутых областей**

Run: `pnpm test -- src/features/comments src/components/anchor-engine`
Expected: PASS. (Если падает `document-comments.tsx` или другой импортёр — поправить импорты под новый API; контент превью не меняется.)

- [ ] **Step 7: Коммит**

```bash
git add src/features/comments/ui/document-comment-layer.tsx src/features/comments/ui/document-comment-layer.test.tsx src/components/anchor-engine/index.ts
git commit -m "feat(comments): eager-комментарии на MarginAnchorLayer + выноски; удалить InlineAnchorLayer"
```

---

### Task 6: Полный гейт + заметка о ручном QA

**Files:** нет правок кода (только верификация).

- [ ] **Step 1: Линт**

Run: `pnpm lint`
Expected: без ошибок. Частые причины падений: неиспользуемый импорт (`HighlightOverlay`/`InlineAnchorLayer`-остатки), `no-restricted-syntax` на inline-стилях без eslint-disable.

- [ ] **Step 2: Тесты**

Run: `pnpm test`
Expected: весь набор зелёный.

- [ ] **Step 3: Сборка**

Run: `pnpm build`
Expected: успешная сборка.

- [ ] **Step 4: Зафиксировать ручной QA-долг**

Выписать пользователю (НЕ коммит): браузер-приёмка на `/lectures/[id]` (и `/documents/[id]`) на wide-экране (≥1280px):
- Выноски идут только в жёлобе, текст не пересекают; левые (комментарии, синие) и правые (аннотации, тёплые) корректны.
- При раздвижке карточек (`resolveStack`) линии остаются монотонными (не пересекаются).
- Наведение на карточку/текст акцентирует свою линию+подсветку, остальные гаснут.
- Скролл: линии «приклеены» к контенту.
- Узкий экран (<1280px): выносок нет, комментарии и аннотации — потоком, a11y-список фокусируем.
- RTL (`?locale=ar`): стороны зеркалятся корректно.
- reduced-motion: без рывков (линии статичны).

- [ ] **Step 5: Финальный консолидирующий коммит (если остались несведённые правки)**

```bash
git status   # убедиться, что свои файлы закоммичены; чужие не трогать
```

---

## Self-Review

**Spec coverage:**
- Видимость always-on, обе стороны → Task 4 (выноски для аннотаций) + Task 5 (eager-комментарии). ✓
- Eager-комментарии (смена lazy-политики) → Task 5. ✓
- Ортогональный локоть → Task 1 `connectorPath`. ✓
- Два тон-цвета (линия + акцент карточки) → Task 2 (stroke) + Task 4 (border-inline-start). Подсветка остаётся на общем токене, различается пунктиром (существующий `::highlight(comment)`) — осознанное отклонение от «цвет красит и подсветку» (две фоновые подсветки на одном фрагменте слились бы; APCA-токен-пайплайн — отдельная gated-зона). Зафиксировано в Global Constraints. ✓
- Hover-акцент → Task 2 (классы стиля) + Task 3 (hover карточки) + Task 4 (text-hover + эмфаза). ✓
- Инвариант «не пересекает текст» → Task 1 (геометрия) + Task 2 (сторона из геометрии, x от края колонки). ✓
- Граничные случаи: narrow без выносок (Task 2 wide-guard), неразрешённый якорь пропускается (Task 2), a11y aria-hidden (Task 2), reduced-motion (статичные линии, QA Task 6). ✓
- Бэкенд не трогаем → подтверждено. ✓

**Отклонение от спеки (зафиксировано):** оверлей использует document-координаты + scroll/resize-листенеры (паттерн `highlight-overlay.tsx`), а НЕ «relative-grid без scroll-листенеров», как предполагала спека. Причина: консистентность с существующим оверлеем подсветки и меньшая связанность (не требует grid-обёртки). Перф-стоимость та же, что у уже работающего highlight-overlay.

**Placeholder scan:** плейсхолдеров нет — весь код приведён целиком.

**Type consistency:** `ConnectorLayerProps` (Task 2) совпадает с вызовом в Task 4; `onHoverNote` (Task 3) совпадает с `setHoveredId` (Task 4); `tone: "annotation" | "comment"` единообразен в Task 2/4/5.
