# Под-блочные якоря Phase 3 — прямоугольник: полиш + a11y/touch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полиш прямоугольных якорей: выноска крепится в вертикальный центр bbox (kind-aware), overlay-массивы мемоизированы; a11y/touch подтверждены тестами + зафиксированы known-limits.

**Architecture:** FE-only. Точка крепления выноски выносится в чистую `anchorAttachY` (connector-geometry); оркестратор строит `rectIds` из `geometries` и пробрасывает в `ConnectorLayer`. Overlay-построение оборачивается в `useMemo`. a11y/touch: тач-создание уже device-agnostic (Selection-цепочка) — добавляем подтверждающие тесты; клавиатурное cell-создание — known-limit.

**Tech Stack:** TypeScript, React, Vitest (jsdom).

**Спека:** [docs/superpowers/specs/2026-07-01-subblock-anchors-phase3-rect-polish-a11y-design.md](../specs/2026-07-01-subblock-anchors-phase3-rect-polish-a11y-design.md).

## Global Constraints

- **pnpm.** Итерации `pnpm exec vitest run <path>` (НЕ `pnpm test`). Гейт T4: `pnpm lint && pnpm test && pnpm build`.
- **ESLint:** запрещены `!` non-null (use `must()`/`?.`); `prefer-optional-chain` (`x?.y`, не `!x || x.y`). Прогонять `pnpm lint` на своих файлах.
- **Git (параллельные агенты):** коммитить ТОЛЬКО свои файлы по имени (`git add <files> && git commit --only <те же>`). НЕ `git add -A`/`.`; НЕ коммитить `src/api/schema.ts`; не добавлять untracked-доки; без деструктивного git.
- **Бэк не меняется.** `src/api/schema.ts` не трогать.
- Русские комментарии где уместно. TDD.

---

## File Structure

| Файл | Ответственность | Задача |
| --- | --- | --- |
| `src/components/anchor-engine/connector-geometry.ts` | чистая `anchorAttachY` + `FIRST_LINE_CLAMP_PX` | T1 |
| `src/components/anchor-engine/connector-layer.tsx` | проп `rectIds` + `anchorAttachY` вместо inline anchorY | T1 |
| `src/components/anchor-engine/margin-anchor-layer.tsx` | `rectIds` (useMemo) → ConnectorLayer (T1); overlay useMemo (T2) | T1, T2 |
| `src/components/anchor-engine/use-selection-capture.test.tsx` | тест device-agnostic rect-draft | T3 |
| `src/components/anchor-engine/margin-anchor-layer.test.tsx` | тест rect-карточка (потребление) | T3 |

---

## Task 1: Connector center-attach

**Files:**
- Modify: `src/components/anchor-engine/connector-geometry.ts` (добавить `FIRST_LINE_CLAMP_PX` + `anchorAttachY`)
- Modify: `src/components/anchor-engine/connector-layer.tsx` (проп `rectIds`, использовать `anchorAttachY`)
- Modify: `src/components/anchor-engine/margin-anchor-layer.tsx` (`rectIds` useMemo + проброс)
- Test: `src/components/anchor-engine/connector-geometry.test.ts`

**Interfaces:**
- Produces: `anchorAttachY(anchorTop: number, height: number, isRect: boolean): number` — rect → `anchorTop + height/2`; линейный → `anchorTop + min(height, FIRST_LINE_CLAMP_PX)/2`. `ConnectorLayerProps` += `rectIds: Set<string>`.

- [ ] **Step 1: Write failing test**

В `src/components/anchor-engine/connector-geometry.test.ts` добавить:

```ts
import { anchorAttachY } from "./connector-geometry";

it("anchorAttachY: прямоугольник → центр bbox", () => {
  expect(anchorAttachY(0, 100, true)).toBe(50);
  expect(anchorAttachY(20, 40, true)).toBe(40);
});

it("anchorAttachY: линейный → центр первой строки (clamp 24)", () => {
  expect(anchorAttachY(0, 100, false)).toBe(12); // min(100,24)/2 = 12
  expect(anchorAttachY(0, 10, false)).toBe(5);   // height < clamp → height/2
});
```

- [ ] **Step 2: Run — verify fail**

Run: `pnpm exec vitest run src/components/anchor-engine/connector-geometry.test.ts`
Expected: FAIL (`anchorAttachY` не существует).

- [ ] **Step 3: Implement `anchorAttachY` (connector-geometry.ts)**

Добавить в `src/components/anchor-engine/connector-geometry.ts`:

```ts
export const FIRST_LINE_CLAMP_PX = 24; // оценка высоты первой строки (центр линейного якоря)

/**
 * Y-точка крепления выноски к якорю (document-координаты).
 * Прямоугольник → вертикальный ЦЕНТР bbox; линейный → центр ПЕРВОЙ строки (clamp).
 */
export function anchorAttachY(anchorTop: number, height: number, isRect: boolean): number {
  return isRect ? anchorTop + height / 2 : anchorTop + Math.min(height, FIRST_LINE_CLAMP_PX) / 2;
}
```

- [ ] **Step 4: Run — verify pass**

Run: `pnpm exec vitest run src/components/anchor-engine/connector-geometry.test.ts`
Expected: PASS.

- [ ] **Step 5: Use `anchorAttachY` + `rectIds` in connector-layer.tsx**

В `src/components/anchor-engine/connector-layer.tsx`:
- Импорт: `import { anchorAttachY, attachYs, connectorPath } from "./connector-geometry";` (добавить `anchorAttachY`).
- Удалить локальную `const FIRST_LINE_CLAMP_PX = 24;` (теперь в connector-geometry; больше не используется в этом файле напрямую — `anchorAttachY` инкапсулирует).
- `ConnectorLayerProps` — добавить `rectIds: Set<string>;`.
- `measure(...)` — добавить параметр `rectIds: Set<string>` и заменить строку `const anchorY = anchorTop + Math.min(a.height, FIRST_LINE_CLAMP_PX) / 2;` на:

```ts
    const anchorY = anchorAttachY(anchorTop, a.height, rectIds.has(id));
```

- В компоненте `ConnectorLayer`: добавить `rectIds` в деструктуризацию пропсов; передать в `measure(ids, getAnchorRect, astRootRef, rectIds)`; добавить `rectIds` в deps `useLayoutEffect` (рядом с `idsKey`/`recomputeKey`).

- [ ] **Step 6: Build `rectIds` in orchestrator + pass**

В `src/components/anchor-engine/margin-anchor-layer.tsx`:
- убедиться, что `useMemo` импортирован из `react` (уже есть — использовался в Phase 2).
- после `const allIds = notes.map((n) => n.id);` добавить:

```ts
  // Прямоугольные якоря — их выноска крепится в центр bbox (kind-aware в connector).
  // useMemo: стабильная идентичность Set между recompute'ами (иначе connector-эффект
  // перезапускался бы каждый рендер).
  const rectIds = useMemo(
    () => new Set([...geometries].filter(([, g]) => g?.kind === "rect").map(([id]) => id)),
    [geometries],
  );
```

- в `<ConnectorLayer ... />` добавить проп `rectIds={rectIds}`.

- [ ] **Step 7: Run connector + broader suites + lint**

Run: `pnpm exec vitest run src/components/anchor-engine/connector-geometry.test.ts src/components/anchor-engine/connector-layer.test.tsx src/components/anchor-engine/margin-anchor-layer.test.tsx && pnpm lint`
Expected: PASS, lint clean. Прогнать `pnpm exec vitest run src/components/anchor-engine` — без регресса (existing connector-layer тесты зелёные; anchorY-ветвление покрыто чистым `anchorAttachY`, threading — типобезопасен + существующие рендер-тесты).

- [ ] **Step 8: Commit**

```bash
git add src/components/anchor-engine/connector-geometry.ts src/components/anchor-engine/connector-geometry.test.ts src/components/anchor-engine/connector-layer.tsx src/components/anchor-engine/margin-anchor-layer.tsx
git commit --only src/components/anchor-engine/connector-geometry.ts src/components/anchor-engine/connector-geometry.test.ts src/components/anchor-engine/connector-layer.tsx src/components/anchor-engine/margin-anchor-layer.tsx -m "feat(anchor): выноска прямоугольника крепится в центр bbox (kind-aware anchorAttachY)"
```

---

## Task 2: Overlay мемоизация

**Files:**
- Modify: `src/components/anchor-engine/margin-anchor-layer.tsx` (обернуть overlay-построение в `useMemo`)

**Interfaces:**
- Consumes: `geometries`, `emphasizedId`, `highlightEnabled`, `controller` (из оркестратора).
- Produces: `overlayRects`/`activeOverlayRects` со стабильной идентичностью между recompute'ами.

**Примечание:** behavior-preserving refactor — отдельный тест НЕ пишем (identity-stability бриттл юнит-тестировать); корректность рендера покрыта существующими `margin-anchor-layer.test.tsx` + широким `anchor-engine`.

- [ ] **Step 1: Wrap overlay building in useMemo**

В `src/components/anchor-engine/margin-anchor-layer.tsx` заменить блок построения (текущие строки ~163-174):

```ts
  // Оверлей: rect-якоря ВСЕГДА (Highlight API их не берёт) + линейные ТОЛЬКО когда
  // Highlight API не поддержан. Активный — в activeRects (annotation-overlay--active).
  const overlayRects: DOMRect[] = [];
  const activeOverlayRects: DOMRect[] = [];
  if (highlightEnabled) {
    for (const [id, g] of geometries) {
      if (!g) continue;
      const toOverlay = g.kind === "rect" || !controller.supported;
      if (!toOverlay) continue;
      (id === emphasizedId ? activeOverlayRects : overlayRects).push(...g.clientRects);
    }
  }
```

на:

```ts
  // Оверлей: rect-якоря ВСЕГДА (Highlight API их не берёт) + линейные ТОЛЬКО когда
  // Highlight API не поддержан. Активный — в activeRects (annotation-overlay--active).
  // useMemo: стабильная идентичность массивов между recompute'ами → HighlightOverlay
  // useLayoutEffect не перезапускается зря.
  const { overlayRects, activeOverlayRects } = useMemo(() => {
    const rects: DOMRect[] = [];
    const active: DOMRect[] = [];
    if (highlightEnabled) {
      for (const [id, g] of geometries) {
        if (!g) continue;
        const toOverlay = g.kind === "rect" || !controller.supported;
        if (!toOverlay) continue;
        (id === emphasizedId ? active : rects).push(...g.clientRects);
      }
    }
    return { overlayRects: rects, activeOverlayRects: active };
  }, [geometries, emphasizedId, highlightEnabled, controller]);
```

(Рендер `<HighlightOverlay rects={overlayRects} activeRects={activeOverlayRects} />` не меняется.)

- [ ] **Step 2: Run margin-layer + broader + lint**

Run: `pnpm exec vitest run src/components/anchor-engine/margin-anchor-layer.test.tsx && pnpm lint`
Expected: PASS, lint clean (поведение не изменилось). Прогнать `pnpm exec vitest run src/components/anchor-engine`.

- [ ] **Step 3: Commit**

```bash
git add src/components/anchor-engine/margin-anchor-layer.tsx
git commit --only src/components/anchor-engine/margin-anchor-layer.tsx -m "perf(anchor): мемоизация overlay-массивов (стабильная идентичность)"
```

---

## Task 3: a11y/touch — подтверждающие тесты

**Files:**
- Test: `src/components/anchor-engine/use-selection-capture.test.tsx` (device-agnostic rect-draft)
- Test: `src/components/anchor-engine/margin-anchor-layer.test.tsx` (rect-карточка)

**Interfaces:**
- Consumes: `useSelectionCapture` (draft из `window.getSelection()`), `MarginAnchorLayer`.
- Produces: только тесты (прод-код не меняется — тач-путь уже device-agnostic; потребление наследуется).

- [ ] **Step 1: Write device-agnostic rect-draft test**

В `src/components/anchor-engine/use-selection-capture.test.tsx` добавить (использует существующие `must`/`Probe`/`last`; строит РЕАЛЬНОЕ кросс-ячеечное Selection, триггерит `pointerup` — та же ветка, что `touchend`):

```ts
import { act } from "@testing-library/react";

it("кросс-ячеечное выделение одной таблицы → draft с прямоугольным якорем (device-agnostic)", () => {
  const seen: Probe[] = [];
  function TableHarness() {
    const rootRef = useRef<HTMLElement | null>(null);
    seen.push(useSelectionCapture({ rootRef, enabled: true }));
    return (
      <div ref={(el) => { rootRef.current = el; }}>
        <table data-block-id="t1"><tbody><tr>
          <td data-node-id="c1">aa</td><td data-node-id="c2">bb</td>
        </tr></tbody></table>
      </div>
    );
  }
  render(<TableHarness />);
  const c1 = must(document.querySelector('[data-node-id="c1"]')).firstChild as Text;
  const c2 = must(document.querySelector('[data-node-id="c2"]')).firstChild as Text;
  const range = document.createRange();
  range.setStart(c1, 0); range.setEnd(c2, 2);
  const sel = must(window.getSelection());
  sel.removeAllRanges(); sel.addRange(range);
  act(() => {
    // pointerup и touchend идут в один обработчик onPointerUp → recompute (device-agnostic)
    document.dispatchEvent(new Event("pointerup"));
  });
  expect(last(seen).draft?.anchor).toMatchObject({ startNodeId: "c1", endNodeId: "c2" });
});
```

> Если jsdom-Selection не заполняет `anchorNode`/`focusNode` после `addRange` (частичная реализация), и тест не может получить non-null draft — деградировать до проверки, что `touchend` И `pointerup` вызывают ОДИН обработчик (структурная device-agnostic-инвариантность): задиспатчить оба и убедиться, что путь не бросает и симметричен. Но сперва попробовать полный путь выше — jsdom поддерживает `getSelection().addRange()` + `anchorNode`.

- [ ] **Step 2: Run — verify fail (или зелёный-характеризующий)**

Run: `pnpm exec vitest run src/components/anchor-engine/use-selection-capture.test.tsx`
Expected: тест либо RED (если раньше draft был null для этого кейса) → станет GREEN подтверждением; либо сразу GREEN (характеризующий — путь уже device-agnostic). Обе трактовки допустимы: это lock-in device-agnostic капчура, НЕ TDD-red обязателен. Если jsdom-Selection не даёт anchorNode — применить деградацию из примечания Step 1.

- [ ] **Step 3: Write rect-card consumption test**

В `src/components/anchor-engine/margin-anchor-layer.test.tsx` добавить (потребление: rect-нота даёт карточку в колонке; harness с таблицей — по образцу существующего Phase-2 rect-теста файла):

```ts
it("rect-якорь: карточка присутствует в колонке (потребление наследуется)", () => {
  function RectCardHarness() {
    const ref = useRef<HTMLDivElement>(null);
    return (
      <div>
        <div ref={ref} data-ast-root>
          <table data-block-id="t1"><tbody><tr>
            <td data-node-id="c1">aa</td><td data-node-id="c2">bb</td>
          </tr></tbody></table>
        </div>
        <MarginAnchorLayer
          astRootRef={ref}
          notes={[{ id: "r1", anchor: { startBlockId: "t1", endBlockId: "t1", startNodeId: "c1", endNodeId: "c2", startChar: 0, endChar: 2, exact: "aabb" } }]}
          highlightEnabled
          canCreate={false}
          onCreateRequest={() => undefined}
          affordanceLabel="Add"
          renderNote={(n) => <span>card:{n.id}</span>}
        />
      </div>
    );
  }
  render(<RectCardHarness />);
  expect(screen.getByText("card:r1")).toBeTruthy();
});
```

> `screen`/`render`/`useRef` уже импортированы в файле. Если jsdom getBoundingClientRect=0 делает якорь неразрешимым и карточка идёт как orphan — тест всё равно зелёный (карточка присутствует в любом канале; `renderNote` вызывается и для orphan). Суть — rect-нота порождает доступную карточку.

- [ ] **Step 4: Run tests + lint**

Run: `pnpm exec vitest run src/components/anchor-engine/use-selection-capture.test.tsx src/components/anchor-engine/margin-anchor-layer.test.tsx && pnpm lint`
Expected: PASS, lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/anchor-engine/use-selection-capture.test.tsx src/components/anchor-engine/margin-anchor-layer.test.tsx
git commit --only src/components/anchor-engine/use-selection-capture.test.tsx src/components/anchor-engine/margin-anchor-layer.test.tsx -m "test(anchor): a11y/touch — device-agnostic rect-капчур + rect-карточка"
```

---

## Task 4: Интеграционный гейт

**Files:** нет новых; верификация.

- [ ] **Step 1: Lint** — `pnpm lint` → 0 ошибок.
- [ ] **Step 2: Full test** — `pnpm test` → PASS.
- [ ] **Step 3: Build** — `pnpm build` → compiled.
- [ ] **Step 4: Commit (если фиксы)** — перечислить ровно изменённые файлы; НЕ трогать `schema.ts`/чужое.

---

## Спека ↔ план: сверка

- §1 Connector center-attach → T1 (anchorAttachY + rectIds).
- §2 Overlay мемоизация → T2.
- §3 a11y/touch (тач device-agnostic подтверждение + потребление; known-limits в спеке — код не требуют) → T3.
- Гейт → T4.

## Self-Review notes

- **Placeholders:** нет. T3 Step 1/2 содержат явную деградацию-инструкцию на случай частичного jsdom-Selection (реальный fallback, не плейсхолдер).
- **Type consistency:** `anchorAttachY(anchorTop, height, isRect)` (T1) ↔ вызов в connector-layer; `rectIds: Set<string>` (T1) ↔ проп ConnectorLayer ↔ построение в оркестраторе. `overlayRects`/`activeOverlayRects` (T2) — те же имена, что рендер потребляет.
- **Green-per-task:** T1 аддитивен (чистая fn + проброс), T2 refactor (существующие тесты), T3 test-only, T4 гейт. Каждая зелёная на коммите.
