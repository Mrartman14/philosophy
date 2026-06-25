# anchor-engine Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вынести нейтральное ядро движка маргиналий `src/components/anchor-engine/` (rename из `annotation-layer/`), вынести общие конвертеры/хуки, обобщить eager-оркестратор до `MarginAnchorLayer` и добавить lazy-политику `InlineAnchorLayer` + `useHoverReveal` — БЕЗ изменения поведения аннотаций, чтобы фича комментариев (PR2) встала на тот же движок.

**Architecture:** Движок уже доменно-агностичен (`TextAnchor`/`AnchoredNote`/`AnchorDraft`, char-офсеты UTF-16, CSS Custom Highlight API). Рефактор разбивает монолитный оркестратор `AnnotationLayer` на pure-хуки (`useAnchorRanges`, `useAnchorHighlights`, `useTextClick`) + две тонкие политики-компоненты: `MarginAnchorLayer` (eager-рендер всех карточек в поле, always-on подсветка) и `InlineAnchorLayer` (lazy-карточка по клику + hover-reveal). Аннотации мигрируют на `MarginAnchorLayer` — это поведение-сохраняющий рефактор, гарантируемый существующим тест-сьютом движка.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zod, Vitest + jsdom, pnpm, CSS Custom Highlight API.

## Global Constraints

- **Пакетный менеджер — pnpm.** `npm install` ломает тулчейн. Команды: `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm vitest run <path>` (таргетно).
- **Финальный гейт перед PR — зелёные `pnpm lint && pnpm test && pnpm build`.**
- **Поведение аннотаций НЕ меняется.** Каждый рефактор-таск завершается зелёным существующим тест-сьютом движка — это контракт. Любое изменение наблюдаемого поведения = баг таска.
- **Имена файлов в `src/` — kebab-case.**
- **Не трогать `src/api/schema.ts`** (контракт не меняется).
- **Параллельные агенты:** `git add <свои файлы по имени>`; НЕ `git add -A`/`git add .`; НЕ `git stash/reset/checkout./clean`. Передавать это субагентам. Коммит: `git add <files> && git commit --only <те же files>`.
- **Субагенты-имплементеры/ревьюеры — на модели opus, не haiku.**
- TDD, DRY, YAGNI, частые коммиты.

---

## File Structure

После PR1:

```
src/components/anchor-engine/            (rename из annotation-layer/)
  types.ts                               TextAnchor, AnchoredNote, AnchorDraft (без изменений)
  use-selection-capture.ts               (без изменений)
  anchor-from-selection.ts               (без изменений)
  anchor-to-range.ts                     (без изменений)
  dom-text.ts                            (без изменений)
  hit-test.ts                            (без изменений)
  stacking.ts                            (без изменений)
  highlight-controller.ts                (без изменений; канал по конструктору name)
  highlight-overlay.tsx                  (без изменений)
  selection-affordance.tsx               (без изменений)
  margin-notes-column.tsx                (без изменений)
  css-escape.ts, test-support.ts         (без изменений)
  use-anchor-ranges.ts                   NEW — ranges/geometry-хук (вынут из orchestrator)
  use-anchor-highlights.ts               NEW — apply+setActive-хук
  use-text-click.ts                      NEW — click→hit-test→onPick-хук
  use-hover-reveal.ts                    NEW — mousemove→hit-test→onHover-хук (для comments)
  margin-anchor-layer.tsx                NEW (обобщение annotation-layer.tsx) — eager-политика
  inline-anchor-layer.tsx                NEW — lazy+hover политика
  index.ts                               обновлённый публичный API
  + соответствующие *.test.ts(x)

src/utils/
  text-anchor.ts                         NEW — нейтральный конвертер coords↔TextAnchor
  anchor-json.ts                         NEW — общий zod-field для JSON-якоря из формы

src/features/annotations/
  anchor.ts                              делегирует @/utils/text-anchor
  schemas.ts                             делегирует @/utils/anchor-json
  ui/document-annotation-layer.tsx       импортит MarginAnchorLayer из @/components/anchor-engine
```

---

## Interfaces (контракт между тасками)

```ts
// @/components/anchor-engine — публичный API после PR1
export type { TextAnchor, AnchoredNote, AnchorDraft } from "./types";

export function useAnchorRanges(args: {
  astRootRef: RefObject<HTMLElement | null>;
  notes: AnchoredNote[];
}): {
  ranges: Map<string, Range | null>;
  getAnchorRect: (id: string) => DOMRect | null;
  recomputeKey: number;
  ready: boolean;
};

export function useAnchorHighlights(args: {
  controller: HighlightController;
  ranges: Map<string, Range | null>;
  persistentIds: string[];   // какие якоря держать подсвеченными постоянно
  activeId: string | null;   // какой подсветить «активным» каналом
  enabled: boolean;
}): void;

export function useTextClick(args: {
  astRootRef: RefObject<HTMLElement | null>;
  notes: AnchoredNote[];
  ready: boolean;
  onPick: (id: string) => void;
}): void;

export function useHoverReveal(args: {
  astRootRef: RefObject<HTMLElement | null>;
  notes: AnchoredNote[];
  ready: boolean;
  onHover: (id: string | null) => void;
}): void;

export interface MarginAnchorLayerProps {
  astRootRef: RefObject<HTMLElement | null>;
  notes: AnchoredNote[];
  renderNote: (note: AnchoredNote, orphan: boolean) => ReactNode;
  highlightEnabled: boolean;
  canCreate: boolean;
  onCreateRequest: (draft: AnchorDraft) => void;
  affordanceLabel: string;
  highlightName?: string; // канал HighlightController, default "annotation"
}
export function MarginAnchorLayer(props: MarginAnchorLayerProps): ReactNode;

export interface InlineAnchorLayerProps {
  astRootRef: RefObject<HTMLElement | null>;
  notes: AnchoredNote[];
  renderCard: (id: string) => ReactNode;     // превью-карточка по клику (wide)
  showAllHighlights: boolean;                 // глобальный тогл: подсветить все якоря
  canCreate: boolean;
  onCreateRequest: (draft: AnchorDraft) => void;
  affordanceLabel: string;
  onActivateNarrow: (id: string) => void;     // узкий экран: вместо карточки — колбэк (скролл к треду)
  highlightName?: string;                     // default "comment"
}
// Примечание: getAnchorRect НЕ проп — слой считает ranges/geometry внутри через
// useAnchorRanges (как MarginAnchorLayer).
export function InlineAnchorLayer(props: InlineAnchorLayerProps): ReactNode;
```

```ts
// @/utils/text-anchor
import type { TextAnchor } from "@/components/anchor-engine";

/** Общий координатный субстрат (snake_case) — пересечение annotation.Anchor и comment.Anchor. */
export interface TextAnchorCoords {
  start_block_id?: string;
  end_block_id?: string;
  start_char?: number;
  end_char?: number;
  exact?: string;
  prefix?: string;
  suffix?: string;
  start_sec?: number;
  end_sec?: number;
}

/** coords → TextAnchor движка; null если media или неполный text-range. */
export function coordsToEngineAnchor(a: TextAnchorCoords): TextAnchor | null;

/** TextAnchor движка → координатный объект (опускает пустые prefix/suffix). */
export function engineAnchorToCoords(a: TextAnchor): TextAnchorCoords;
```

```ts
// @/utils/anchor-json
import { z } from "zod";

/** Общий zod-field: опциональная JSON-строка якоря из hidden-input → объект | undefined. */
export function anchorJsonField(messages: {
  notObject: string;
  invalidJson: string;
}): z.ZodType<Record<string, unknown> | undefined>;
```

---

### Task 1: Rename `annotation-layer/` → `anchor-engine/`

Механический rename папки движка. Внутренние импорты относительные (`./...`) и не меняются; меняются только 3 внешних импорта из фичи аннотаций. Поведение и тесты — без изменений.

**Files:**
- Rename (git mv): `src/components/annotation-layer/` → `src/components/anchor-engine/` (все файлы, включая тесты)
- Modify: `src/features/annotations/anchor.ts:2` (импорт `@/components/annotation-layer` → `@/components/anchor-engine`)
- Modify: `src/features/annotations/ui/document-annotation-layer.tsx:17-21` (импорт `@/components/annotation-layer` → `@/components/anchor-engine`)

**Interfaces:**
- Consumes: ничего нового.
- Produces: модуль `@/components/anchor-engine` с тем же публичным API (`AnnotationLayer`, `TextAnchor`, `AnchoredNote`, `AnchorDraft`).

- [ ] **Step 1: Переместить папку через git mv (сохраняет историю)**

```bash
git mv src/components/annotation-layer src/components/anchor-engine
```

- [ ] **Step 2: Обновить 3 внешних импорта**

В `src/features/annotations/anchor.ts` строка 2:

```ts
import type { TextAnchor } from "@/components/anchor-engine";
```

В `src/features/annotations/ui/document-annotation-layer.tsx` строки 17-21:

```ts
import {
  AnnotationLayer,
  type AnchorDraft,
  type AnchoredNote,
} from "@/components/anchor-engine";
```

Также обновить упоминание пути в шапке-комментарии этого файла (строка 4: `@/components/annotation-layer` → `@/components/anchor-engine`).

- [ ] **Step 3: Найти прочие упоминания старого пути**

Run: `grep -rn "annotation-layer" src --include="*.ts" --include="*.tsx"`
Expected: только внутренние относительные пути НЕ всплывают (они `./`); строки с `@/components/annotation-layer` отсутствуют. Если что-то осталось — поправить на `@/components/anchor-engine`.

- [ ] **Step 4: Прогнать гейт — поведение не изменилось**

Run: `pnpm vitest run src/components/anchor-engine`
Expected: PASS (все перемещённые тесты зелёные).

Run: `pnpm lint && pnpm build`
Expected: без ошибок (нет битых импортов).

- [ ] **Step 5: Commit**

```bash
git add src/components/anchor-engine src/features/annotations/anchor.ts src/features/annotations/ui/document-annotation-layer.tsx
git commit --only src/components/anchor-engine src/features/annotations/anchor.ts src/features/annotations/ui/document-annotation-layer.tsx -m "refactor(anchor-engine): rename annotation-layer → anchor-engine

Нейтральное имя движка маргиналий (им пользуются и аннотации, и
будущие комментарии). Только rename + 3 внешних импорта; поведение
и тесты без изменений.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Общий координатный конвертер `@/utils/text-anchor`

Вынести нейтральную coords↔TextAnchor конверсию из `features/annotations/anchor.ts`, чтобы её делила фича комментариев. `annotation.Anchor` и `comment.Anchor` структурно — суперсеты `TextAnchorCoords`.

**Files:**
- Create: `src/utils/text-anchor.ts`
- Create (test): `src/utils/text-anchor.test.ts`
- Modify: `src/features/annotations/anchor.ts` (делегировать `toEngineAnchor`/`fromEngineAnchor`)

**Interfaces:**
- Consumes: `TextAnchor` из `@/components/anchor-engine`.
- Produces: `coordsToEngineAnchor`, `engineAnchorToCoords`, тип `TextAnchorCoords`.

- [ ] **Step 1: Написать падающий тест**

Create `src/utils/text-anchor.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { coordsToEngineAnchor, engineAnchorToCoords } from "./text-anchor";

describe("coordsToEngineAnchor", () => {
  it("маппит полный text-range в TextAnchor движка", () => {
    expect(
      coordsToEngineAnchor({
        start_block_id: "b1",
        end_block_id: "b2",
        start_char: 3,
        end_char: 7,
        exact: "слово",
        prefix: "до ",
        suffix: " после",
      }),
    ).toEqual({
      startBlockId: "b1",
      endBlockId: "b2",
      startChar: 3,
      endChar: 7,
      exact: "слово",
      prefix: "до ",
      suffix: " после",
    });
  });

  it("дефолтит отсутствующие char-поля в 0", () => {
    const r = coordsToEngineAnchor({ start_block_id: "b1", end_block_id: "b1", exact: "x" });
    expect(r).toMatchObject({ startChar: 0, endChar: 0 });
  });

  it("возвращает null для media-якоря", () => {
    expect(coordsToEngineAnchor({ start_sec: 1, end_sec: 2 })).toBeNull();
  });

  it("возвращает null для неполного text-range", () => {
    expect(coordsToEngineAnchor({ start_block_id: "b1", exact: "x" })).toBeNull();
  });
});

describe("engineAnchorToCoords", () => {
  it("маппит обратно и опускает пустые prefix/suffix", () => {
    expect(
      engineAnchorToCoords({
        startBlockId: "b1",
        endBlockId: "b2",
        startChar: 1,
        endChar: 4,
        exact: "abc",
      }),
    ).toEqual({
      start_block_id: "b1",
      end_block_id: "b2",
      start_char: 1,
      end_char: 4,
      exact: "abc",
    });
  });
});
```

- [ ] **Step 2: Прогнать — падает (модуля нет)**

Run: `pnpm vitest run src/utils/text-anchor.test.ts`
Expected: FAIL — `Cannot find module './text-anchor'`.

- [ ] **Step 3: Реализовать `src/utils/text-anchor.ts`**

```ts
// src/utils/text-anchor.ts
// Нейтральная координатная конверсия между snake_case-якорем бэка (общий
// субстрат annotation.Anchor / comment.Anchor) и camelCase TextAnchor движка
// маргиналий. Единицы идентичны (UTF-16 code units), без преобразования.
// Target-поля комментария (target_entity_*) НЕ касаются координат — добавляются
// доменной фичей поверх.
import type { TextAnchor } from "@/components/anchor-engine";

export interface TextAnchorCoords {
  start_block_id?: string;
  end_block_id?: string;
  start_char?: number;
  end_char?: number;
  exact?: string;
  prefix?: string;
  suffix?: string;
  start_sec?: number;
  end_sec?: number;
}

/** coords → TextAnchor движка; null если media-поля или неполный text-range. */
export function coordsToEngineAnchor(a: TextAnchorCoords): TextAnchor | null {
  if (a.start_sec !== undefined || a.end_sec !== undefined) return null;
  if (!a.start_block_id || !a.end_block_id || !a.exact) return null;
  const engine: TextAnchor = {
    startBlockId: a.start_block_id,
    endBlockId: a.end_block_id,
    startChar: a.start_char ?? 0,
    endChar: a.end_char ?? 0,
    exact: a.exact,
  };
  if (a.prefix) engine.prefix = a.prefix;
  if (a.suffix) engine.suffix = a.suffix;
  return engine;
}

/** TextAnchor движка → координатный объект (опускает пустые prefix/suffix). */
export function engineAnchorToCoords(a: TextAnchor): TextAnchorCoords {
  const coords: TextAnchorCoords = {
    start_block_id: a.startBlockId,
    end_block_id: a.endBlockId,
    start_char: a.startChar,
    end_char: a.endChar,
    exact: a.exact,
  };
  if (a.prefix) coords.prefix = a.prefix;
  if (a.suffix) coords.suffix = a.suffix;
  return coords;
}
```

- [ ] **Step 4: Прогнать — проходит**

Run: `pnpm vitest run src/utils/text-anchor.test.ts`
Expected: PASS.

- [ ] **Step 5: Делегировать в `features/annotations/anchor.ts`**

Заменить тела `toEngineAnchor`/`fromEngineAnchor` (строки 85-116) делегированием — публичные имена и возвращаемые доменные типы сохраняются:

```ts
import { coordsToEngineAnchor, engineAnchorToCoords } from "@/utils/text-anchor";
// ...
export function toEngineAnchor(a: Anchor): TextAnchor | null {
  return coordsToEngineAnchor(a);
}

export function fromEngineAnchor(a: TextAnchor): Anchor {
  // engineAnchorToCoords даёт координатный объект; для аннотации он же —
  // валидный annotation.Anchor (target-полей у аннотации нет). buildTextAnchor
  // остаётся источником правил, но его поведение теперь зеркалит общий util.
  return buildTextAnchor({
    startBlockId: a.startBlockId,
    endBlockId: a.endBlockId,
    startChar: a.startChar,
    endChar: a.endChar,
    exact: a.exact,
    ...(a.prefix ? { prefix: a.prefix } : {}),
    ...(a.suffix ? { suffix: a.suffix } : {}),
  });
}
```

(Примечание: `engineAnchorToCoords` импортируется для будущей фичи комментариев; если линтер ругается на неиспользуемый импорт — оставить только `coordsToEngineAnchor` здесь, `engineAnchorToCoords` использует PR2.)

- [ ] **Step 6: Прогнать тесты аннотаций — зелёные**

Run: `pnpm vitest run src/features/annotations`
Expected: PASS (поведение конверсии не изменилось).

- [ ] **Step 7: Commit**

```bash
git add src/utils/text-anchor.ts src/utils/text-anchor.test.ts src/features/annotations/anchor.ts
git commit --only src/utils/text-anchor.ts src/utils/text-anchor.test.ts src/features/annotations/anchor.ts -m "refactor(anchor): вынести координатный конвертер в @/utils/text-anchor

Нейтральная coords↔TextAnchor конверсия делится аннотациями и (PR2)
комментариями. annotations/anchor.ts делегирует, поведение сохранено.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Общий zod-field якоря `@/utils/anchor-json`

Вынести `makeAnchorJsonSchema` из `annotations/schemas.ts` в общий util, параметризованный сообщениями (не namespace), чтобы комментарии переиспользовали.

**Files:**
- Create: `src/utils/anchor-json.ts`
- Create (test): `src/utils/anchor-json.test.ts`
- Modify: `src/features/annotations/schemas.ts` (делегировать)

**Interfaces:**
- Produces: `anchorJsonField({ notObject, invalidJson })`.

- [ ] **Step 1: Написать падающий тест**

Create `src/utils/anchor-json.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { anchorJsonField } from "./anchor-json";

const schema = z.object({
  anchor: anchorJsonField({ notObject: "not-object", invalidJson: "bad-json" }),
});

describe("anchorJsonField", () => {
  it("пустая строка → undefined", () => {
    expect(schema.parse({ anchor: "" })).toEqual({ anchor: undefined });
  });

  it("отсутствие → undefined", () => {
    expect(schema.parse({})).toEqual({ anchor: undefined });
  });

  it("валидный JSON-объект → объект", () => {
    expect(schema.parse({ anchor: '{"start_block_id":"b1"}' })).toEqual({
      anchor: { start_block_id: "b1" },
    });
  });

  it("JSON-массив → ошибка not-object", () => {
    const r = schema.safeParse({ anchor: "[1,2]" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("not-object");
  });

  it("битый JSON → ошибка bad-json", () => {
    const r = schema.safeParse({ anchor: "{oops" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("bad-json");
  });
});
```

- [ ] **Step 2: Прогнать — падает**

Run: `pnpm vitest run src/utils/anchor-json.test.ts`
Expected: FAIL — модуля нет.

- [ ] **Step 3: Реализовать `src/utils/anchor-json.ts`**

```ts
// src/utils/anchor-json.ts
// Общий zod-field: hidden-input формы несёт JSON-строку якоря; парсим в объект
// или undefined (пустая строка / отсутствие). Структурную валидность под
// сущность проверяет бэк (422 ANCHOR_INVALID). Сообщения параметризованы, чтобы
// каждая фича подставила свой i18n-namespace (annotations / comments).
import { z } from "zod";

export function anchorJsonField(messages: { notObject: string; invalidJson: string }) {
  return z
    .string()
    .optional()
    .transform((s, ctx) => {
      if (!s || s.trim() === "") return undefined;
      try {
        const parsed: unknown = JSON.parse(s);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          ctx.addIssue({ code: "custom", message: messages.notObject });
          return z.NEVER;
        }
        return parsed as Record<string, unknown>;
      } catch {
        ctx.addIssue({ code: "custom", message: messages.invalidJson });
        return z.NEVER;
      }
    });
}
```

- [ ] **Step 4: Прогнать — проходит**

Run: `pnpm vitest run src/utils/anchor-json.test.ts`
Expected: PASS.

- [ ] **Step 5: Делегировать в `features/annotations/schemas.ts`**

Заменить локальную `makeAnchorJsonSchema` (строки 41-69) делегированием:

```ts
import { anchorJsonField } from "@/utils/anchor-json";
// ...
function makeAnchorJsonSchema(t: ValidationT) {
  return anchorJsonField({
    notObject: t("annotations.anchorNotObject"),
    invalidJson: t("annotations.anchorInvalidJson"),
  });
}
```

- [ ] **Step 6: Прогнать тесты аннотаций — зелёные**

Run: `pnpm vitest run src/features/annotations`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/utils/anchor-json.ts src/utils/anchor-json.test.ts src/features/annotations/schemas.ts
git commit --only src/utils/anchor-json.ts src/utils/anchor-json.test.ts src/features/annotations/schemas.ts -m "refactor(anchor): вынести JSON-anchor zod-field в @/utils/anchor-json

Параметризован сообщениями → делится аннотациями и (PR2) комментариями.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Вынести хук `useAnchorRanges`

Извлечь из `annotation-layer.tsx` логику ranges/geometry (ready-флаг, recompute-эффект, ranges-memo, getAnchorRect) в переиспользуемый хук. `AnnotationLayer` начинает его звать — поведение идентично.

**Files:**
- Create: `src/components/anchor-engine/use-anchor-ranges.ts`
- Create (test): `src/components/anchor-engine/use-anchor-ranges.test.tsx`
- Modify: `src/components/anchor-engine/annotation-layer.tsx` (использовать хук)

**Interfaces:**
- Consumes: `rangeFromAnchor` (`./anchor-to-range`), типы (`./types`).
- Produces: `useAnchorRanges({ astRootRef, notes }) → { ranges, getAnchorRect, recomputeKey, ready }`.

- [ ] **Step 1: Написать падающий тест (jsdom: rangeFromAnchor вернёт null без раскладки — проверяем структуру, не геометрию)**

Create `src/components/anchor-engine/use-anchor-ranges.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { useAnchorRanges } from "./use-anchor-ranges";

describe("useAnchorRanges", () => {
  it("ready=false когда rootRef пуст; ranges пуст", () => {
    const ref = createRef<HTMLElement>();
    const { result } = renderHook(() =>
      useAnchorRanges({ astRootRef: ref, notes: [] }),
    );
    expect(result.current.ready).toBe(false);
    expect(result.current.ranges.size).toBe(0);
    expect(result.current.getAnchorRect("x")).toBeNull();
  });

  it("ready=true когда rootRef заполнен", () => {
    const el = document.createElement("div");
    const ref = createRef<HTMLElement>();
    ref.current = el;
    const { result } = renderHook(() =>
      useAnchorRanges({ astRootRef: ref, notes: [] }),
    );
    expect(result.current.ready).toBe(true);
  });
});
```

- [ ] **Step 2: Прогнать — падает**

Run: `pnpm vitest run src/components/anchor-engine/use-anchor-ranges.test.tsx`
Expected: FAIL — модуля нет.

- [ ] **Step 3: Реализовать `use-anchor-ranges.ts` (перенести логику из orchestrator строки 78-141 без изменений)**

```ts
// src/components/anchor-engine/use-anchor-ranges.ts
// Геометрия движка: Range по каждому note (для подсветки/позиций/хит-теста),
// ready-флаг (rootRef заполняется после первого коммита) и пересчёт при
// resize / загрузке шрифтов / смене notes. Вынесено из оркестратора — общее
// для eager- и lazy-политик.
import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";

import { rangeFromAnchor } from "./anchor-to-range";
import type { AnchoredNote } from "./types";

export function useAnchorRanges({
  astRootRef,
  notes,
}: {
  astRootRef: RefObject<HTMLElement | null>;
  notes: AnchoredNote[];
}) {
  const [recomputeKey, setRecomputeKey] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(astRootRef.current !== null);
  }, [astRootRef]);

  useEffect(() => {
    const bump = () => {
      setRecomputeKey((k) => k + 1);
    };
    bump();
    window.addEventListener("resize", bump);
    const root = astRootRef.current;
    const ro = typeof ResizeObserver !== "undefined" && root ? new ResizeObserver(bump) : null;
    if (ro && root) ro.observe(root);
    const fonts = (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts;
    fonts?.ready.then(bump).catch(() => undefined);
    return () => {
      window.removeEventListener("resize", bump);
      ro?.disconnect();
    };
  }, [astRootRef, notes, ready]);

  const ranges = useMemo(() => {
    const root = astRootRef.current;
    const m = new Map<string, Range | null>();
    if (root) for (const n of notes) m.set(n.id, rangeFromAnchor(n.anchor, root));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ready/recomputeKey форсят перестроение (astRootRef стабилен по идентичности)
  }, [notes, astRootRef, ready, recomputeKey]);

  const getAnchorRect = useCallback(
    (id: string) => {
      const r = ranges.get(id);
      return r ? r.getBoundingClientRect() : null;
    },
    [ranges],
  );

  return { ranges, getAnchorRect, recomputeKey, ready };
}
```

- [ ] **Step 4: Использовать хук в `annotation-layer.tsx`**

Заменить локальные `recomputeKey`/`ready`/эффекты/`ranges`/`getAnchorRect` (строки 77-141) одним вызовом, сохранив остальную логику (controller, highlight-эффект, клик, onActivate, columnNotes, create) как есть:

```ts
const { ranges, getAnchorRect, recomputeKey, ready } = useAnchorRanges({ astRootRef, notes });
const { draft, clear } = useSelectionCapture({ rootRef: astRootRef, enabled: canCreate });
const [activeId, setActiveId] = useState<string | null>(null);
```

Удалить из импортов `useMemo`, `rangeFromAnchor` (если больше не используются напрямую). Добавить `import { useAnchorRanges } from "./use-anchor-ranges";`.

- [ ] **Step 5: Прогнать — хук + существующий сьют движка зелёные**

Run: `pnpm vitest run src/components/anchor-engine`
Expected: PASS (включая `annotation-layer.test.tsx` — поведение идентично).

- [ ] **Step 6: Commit**

```bash
git add src/components/anchor-engine/use-anchor-ranges.ts src/components/anchor-engine/use-anchor-ranges.test.tsx src/components/anchor-engine/annotation-layer.tsx
git commit --only src/components/anchor-engine/use-anchor-ranges.ts src/components/anchor-engine/use-anchor-ranges.test.tsx src/components/anchor-engine/annotation-layer.tsx -m "refactor(anchor-engine): вынести useAnchorRanges из оркестратора

Общая геометрия (ranges/ready/recompute/getAnchorRect) для eager/lazy
политик. AnnotationLayer делегирует, поведение идентично (сьют зелёный).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Вынести хуки `useAnchorHighlights` и `useTextClick`

Извлечь из оркестратора подсветку (apply+setActive) и клик-по-тексту (hit-test → колбэк). Параметризовать: какие якоря держать постоянно (`persistentIds`) и какой активный (`activeId`). `AnnotationLayer` зовёт их с `persistentIds = все`.

**Files:**
- Create: `src/components/anchor-engine/use-anchor-highlights.ts`
- Create: `src/components/anchor-engine/use-text-click.ts`
- Create (test): `src/components/anchor-engine/use-text-click.test.tsx`
- Modify: `src/components/anchor-engine/annotation-layer.tsx`

**Interfaces:**
- Produces:
  - `useAnchorHighlights({ controller, ranges, persistentIds, activeId, enabled })`
  - `useTextClick({ astRootRef, notes, ready, onPick })`

- [ ] **Step 1: Написать падающий тест для useTextClick (мокаем noteAtPoint через реальный hit-test невозможно в jsdom без caret API — тестируем подписку/отписку и вызов onPick по смоделированному клику с патчем caretRangeFromPoint)**

Create `src/components/anchor-engine/use-text-click.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTextClick } from "./use-text-click";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useTextClick", () => {
  it("не падает и снимает листенер при unmount, когда root пуст", () => {
    const ref = createRef<HTMLElement>();
    const onPick = vi.fn();
    const { unmount } = renderHook(() =>
      useTextClick({ astRootRef: ref, notes: [], ready: false, onPick }),
    );
    unmount();
    expect(onPick).not.toHaveBeenCalled();
  });

  it("подписывается на click рута при ready", () => {
    const el = document.createElement("div");
    const add = vi.spyOn(el, "addEventListener");
    const ref = createRef<HTMLElement>();
    ref.current = el;
    renderHook(() =>
      useTextClick({ astRootRef: ref, notes: [], ready: true, onPick: vi.fn() }),
    );
    expect(add).toHaveBeenCalledWith("click", expect.any(Function));
  });
});
```

- [ ] **Step 2: Прогнать — падает**

Run: `pnpm vitest run src/components/anchor-engine/use-text-click.test.tsx`
Expected: FAIL — модуля нет.

- [ ] **Step 3: Реализовать `use-text-click.ts`**

```ts
// src/components/anchor-engine/use-text-click.ts
// Клик в AST-руте → hit-test (какой note под caret) → onPick(id). Политика
// решает, что делать с id (активировать карточку / скроллить к треду).
import { useEffect, type RefObject } from "react";

import { noteAtPoint } from "./hit-test";
import type { AnchoredNote } from "./types";

export function useTextClick({
  astRootRef,
  notes,
  ready,
  onPick,
}: {
  astRootRef: RefObject<HTMLElement | null>;
  notes: AnchoredNote[];
  ready: boolean;
  onPick: (id: string) => void;
}) {
  useEffect(() => {
    const root = astRootRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const id = noteAtPoint(e.clientX, e.clientY, notes, root);
      if (id) onPick(id);
    };
    root.addEventListener("click", onClick);
    return () => {
      root.removeEventListener("click", onClick);
    };
    // ready в deps: переподписка после готовности рута (root null→element).
  }, [astRootRef, notes, ready, onPick]);
}
```

- [ ] **Step 4: Реализовать `use-anchor-highlights.ts`**

```ts
// src/components/anchor-engine/use-anchor-highlights.ts
// Подсветка через HighlightController: persistentIds держатся в основном канале,
// activeId — в active-канале. enabled=false → всё гасится. Eager-политика
// (аннотации) передаёт persistentIds = все; lazy-политика (комментарии) — [] или
// все (по глобальному тоглу), activeId = hovered/clicked.
import { useEffect } from "react";

import type { HighlightController } from "./highlight-controller";

export function useAnchorHighlights({
  controller,
  ranges,
  persistentIds,
  activeId,
  enabled,
}: {
  controller: HighlightController;
  ranges: Map<string, Range | null>;
  persistentIds: string[];
  activeId: string | null;
  enabled: boolean;
}) {
  // Стабильный ключ набора, чтобы эффект не зависел от идентичности массива.
  const idsKey = persistentIds.join(",");
  useEffect(() => {
    if (!enabled) {
      controller.clear();
      return;
    }
    const persistent = persistentIds
      .map((id) => ranges.get(id) ?? null)
      .filter((r): r is Range => r !== null);
    controller.apply(persistent);
    controller.setActive(activeId ? (ranges.get(activeId) ?? null) : null);
    return () => {
      controller.clear();
    };
    // idsKey покрывает persistentIds по значению.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranges, enabled, activeId, controller, idsKey]);
}
```

- [ ] **Step 5: Использовать оба хука в `annotation-layer.tsx`**

Заменить highlight-эффект (строки 122-133) и click-эффект (строки 145-162) вызовами. Подсветка всех нот (eager) = `persistentIds` всех id:

```ts
const allIds = notes.map((n) => n.id);
useAnchorHighlights({
  controller,
  ranges,
  persistentIds: allIds,
  activeId,
  enabled: highlightEnabled,
});

const pickFromText = useCallback((id: string) => {
  setActiveId(id);
  document
    .querySelector(`[data-note-card="${cssEscape(id)}"]`)
    ?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
}, []);
useTextClick({ astRootRef, notes, ready, onPick: pickFromText });
```

Добавить импорты `useAnchorHighlights`, `useTextClick`; удалить прямые `controller.apply/setActive/clear` и ручной click-эффект + неиспользуемый `noteAtPoint` импорт.

- [ ] **Step 6: Прогнать — сьют движка зелёный**

Run: `pnpm vitest run src/components/anchor-engine`
Expected: PASS (поведение аннотаций идентично).

- [ ] **Step 7: Commit**

```bash
git add src/components/anchor-engine/use-anchor-highlights.ts src/components/anchor-engine/use-text-click.ts src/components/anchor-engine/use-text-click.test.tsx src/components/anchor-engine/annotation-layer.tsx
git commit --only src/components/anchor-engine/use-anchor-highlights.ts src/components/anchor-engine/use-text-click.ts src/components/anchor-engine/use-text-click.test.tsx src/components/anchor-engine/annotation-layer.tsx -m "refactor(anchor-engine): вынести useAnchorHighlights + useTextClick

Подсветка (persistentIds/activeId) и клик-по-тексту параметризованы для
обеих политик. AnnotationLayer делегирует, поведение идентично.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Обобщить `AnnotationLayer` → `MarginAnchorLayer`; мигрировать аннотации

Переименовать eager-оркестратор в нейтральный `MarginAnchorLayer`, добавить опциональный `highlightName` (канал HighlightController, default `"annotation"`). Обновить публичный `index.ts` и коннектор аннотаций. Side управляется страницей через `MarginNote` — проп стороны движку НЕ нужен (карточки заполняют контейнер; RTL — логическими свойствами).

**Files:**
- Rename (git mv): `src/components/anchor-engine/annotation-layer.tsx` → `margin-anchor-layer.tsx`
- Rename (git mv): `src/components/anchor-engine/annotation-layer.test.tsx` → `margin-anchor-layer.test.tsx`
- Modify: `margin-anchor-layer.tsx` (имя компонента/пропсов + highlightName)
- Modify: `src/components/anchor-engine/index.ts`
- Modify: `src/features/annotations/ui/document-annotation-layer.tsx`

**Interfaces:**
- Produces: `MarginAnchorLayer`, `MarginAnchorLayerProps` (см. блок Interfaces вверху).
- Consumes: `HighlightController(name)`.

- [ ] **Step 1: git mv компонент и его тест**

```bash
git mv src/components/anchor-engine/annotation-layer.tsx src/components/anchor-engine/margin-anchor-layer.tsx
git mv src/components/anchor-engine/annotation-layer.test.tsx src/components/anchor-engine/margin-anchor-layer.test.tsx
```

- [ ] **Step 2: Переименовать символы + добавить highlightName в `margin-anchor-layer.tsx`**

- `AnnotationLayerProps` → `MarginAnchorLayerProps`; добавить поле `highlightName?: string;`.
- `export function AnnotationLayer` → `export function MarginAnchorLayer`.
- Контроллер с каналом:

```ts
const controllerRef = useRef<HighlightController | null>(null);
controllerRef.current ??= new HighlightController(props.highlightName ?? "annotation");
const controller = controllerRef.current;
```

- Обновить шапку-комментарий (имя оркестратора).

- [ ] **Step 3: Обновить тест-файл `margin-anchor-layer.test.tsx`**

Заменить все `AnnotationLayer` → `MarginAnchorLayer` и импорт `./annotation-layer` → `./margin-anchor-layer`. Логика проверок без изменений.

- [ ] **Step 4: Обновить публичный `index.ts`**

```ts
// src/components/anchor-engine/index.ts
// Публичный API движка маргиналий: политики-компоненты + типы якоря. Хуки и
// примитивы (highlight-controller, selection-affordance, margin-notes-column,
// use-anchor-*) — ВНУТРЕННИЕ: их зовут сами политики относительными импортами,
// поэтому в публичный сёрфейс НЕ выносим (иначе knip пометит unused export).
export { MarginAnchorLayer, type MarginAnchorLayerProps } from "./margin-anchor-layer";
export type { TextAnchor, AnchoredNote, AnchorDraft } from "./types";
```

(`InlineAnchorLayer` добавится в Task 8.)

- [ ] **Step 5: Мигрировать коннектор аннотаций**

В `src/features/annotations/ui/document-annotation-layer.tsx`:
- импорт: `AnnotationLayer` → `MarginAnchorLayer`;
- JSX: `<AnnotationLayer ...>` → `<MarginAnchorLayer ...>` (пропсы те же; `highlightName` не передаём — дефолт `"annotation"`).

- [ ] **Step 6: Прогнать — всё зелёное**

Run: `pnpm vitest run src/components/anchor-engine src/features/annotations`
Expected: PASS.

Run: `pnpm lint && pnpm build`
Expected: без ошибок.

- [ ] **Step 7: Commit**

```bash
git add src/components/anchor-engine/margin-anchor-layer.tsx src/components/anchor-engine/margin-anchor-layer.test.tsx src/components/anchor-engine/index.ts src/features/annotations/ui/document-annotation-layer.tsx
git commit --only src/components/anchor-engine/margin-anchor-layer.tsx src/components/anchor-engine/margin-anchor-layer.test.tsx src/components/anchor-engine/index.ts src/features/annotations/ui/document-annotation-layer.tsx -m "refactor(anchor-engine): AnnotationLayer → MarginAnchorLayer (eager-политика)

Нейтральное имя + highlightName-канал. Аннотации мигрированы, поведение
идентично. Side управляется страницей через MarginNote.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Хук `useHoverReveal`

Новая способность (только для lazy-политики): throttled `mousemove` в AST-руте → hit-test → `onHover(id|null)`. Аннотаций не касается.

**Files:**
- Create: `src/components/anchor-engine/use-hover-reveal.ts`
- Create (test): `src/components/anchor-engine/use-hover-reveal.test.tsx`
- Modify: `src/components/anchor-engine/index.ts` (экспорт)

**Interfaces:**
- Produces: `useHoverReveal({ astRootRef, notes, ready, onHover })`.

- [ ] **Step 1: Написать падающий тест**

Create `src/components/anchor-engine/use-hover-reveal.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { useHoverReveal } from "./use-hover-reveal";

describe("useHoverReveal", () => {
  it("подписывается на mousemove и mouseleave рута", () => {
    const el = document.createElement("div");
    const add = vi.spyOn(el, "addEventListener");
    const ref = createRef<HTMLElement>();
    ref.current = el;
    renderHook(() =>
      useHoverReveal({ astRootRef: ref, notes: [], ready: true, onHover: vi.fn() }),
    );
    expect(add).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(add).toHaveBeenCalledWith("mouseleave", expect.any(Function));
  });

  it("mouseleave вызывает onHover(null)", () => {
    const el = document.createElement("div");
    const ref = createRef<HTMLElement>();
    ref.current = el;
    const onHover = vi.fn();
    renderHook(() =>
      useHoverReveal({ astRootRef: ref, notes: [], ready: true, onHover }),
    );
    el.dispatchEvent(new MouseEvent("mouseleave"));
    expect(onHover).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Прогнать — падает**

Run: `pnpm vitest run src/components/anchor-engine/use-hover-reveal.test.tsx`
Expected: FAIL — модуля нет.

- [ ] **Step 3: Реализовать `use-hover-reveal.ts`**

```ts
// src/components/anchor-engine/use-hover-reveal.ts
// Lazy-подсветка: движение мыши в AST-руте → hit-test → onHover(id) подсвечивает
// фрагмент под курсором; mouseleave → onHover(null). Throttle через rAF, чтобы
// не хит-тестить на каждый mousemove. Только для InlineAnchorLayer (комментарии).
import { useEffect, type RefObject } from "react";

import { noteAtPoint } from "./hit-test";
import type { AnchoredNote } from "./types";

export function useHoverReveal({
  astRootRef,
  notes,
  ready,
  onHover,
}: {
  astRootRef: RefObject<HTMLElement | null>;
  notes: AnchoredNote[];
  ready: boolean;
  onHover: (id: string | null) => void;
}) {
  useEffect(() => {
    const root = astRootRef.current;
    if (!root) return;
    let raf = 0;
    let last: string | null = null;
    const emit = (id: string | null) => {
      if (id !== last) {
        last = id;
        onHover(id);
      }
    };
    const onMove = (e: MouseEvent) => {
      if (raf) return;
      const { clientX, clientY } = e;
      raf =
        typeof requestAnimationFrame === "function"
          ? requestAnimationFrame(() => {
              raf = 0;
              emit(noteAtPoint(clientX, clientY, notes, root));
            })
          : 0;
      if (!raf) emit(noteAtPoint(clientX, clientY, notes, root));
    };
    const onLeave = () => {
      emit(null);
    };
    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);
    return () => {
      if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
    };
  }, [astRootRef, notes, ready, onHover]);
}
```

- [ ] **Step 4: Прогнать — проходит**

Run: `pnpm vitest run src/components/anchor-engine/use-hover-reveal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit** (хук ВНУТРЕННИЙ — в `index.ts` НЕ экспортируем; его зовёт только `InlineAnchorLayer` относительным импортом)

```bash
git add src/components/anchor-engine/use-hover-reveal.ts src/components/anchor-engine/use-hover-reveal.test.tsx
git commit --only src/components/anchor-engine/use-hover-reveal.ts src/components/anchor-engine/use-hover-reveal.test.tsx -m "feat(anchor-engine): useHoverReveal (mousemove→hit-test→onHover)

Lazy-подсветка фрагмента под курсором для InlineAnchorLayer (комментарии).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Компонент `InlineAnchorLayer` (lazy-политика)

Тонкий оркестратор на pure-хуках: захват выделения → аффорданс создания; подсветка по hover (`useHoverReveal`) ИЛИ по тоглу `showAllHighlights`; клик по фрагменту → wide: показать превью-карточку в поле у якоря; narrow: вызвать `onActivateNarrow(id)`. Канал подсветки default `"comment"`.

**Files:**
- Create: `src/components/anchor-engine/inline-anchor-layer.tsx`
- Create (test): `src/components/anchor-engine/inline-anchor-layer.test.tsx`
- Modify: `src/components/anchor-engine/index.ts` (экспорт)

**Interfaces:**
- Consumes: `useAnchorRanges`, `useAnchorHighlights`, `useTextClick`, `useHoverReveal`, `useSelectionCapture`, `HighlightController`, `SelectionAffordance`, `MarginNotesColumn`, `resolveStack`.
- Produces: `InlineAnchorLayer`, `InlineAnchorLayerProps` (см. блок Interfaces вверху).

- [ ] **Step 1: Написать падающий тест (поведение политики; геометрию/подсветку jsdom не рендерит — проверяем lazy-инвариант и narrow-колбэк через wide-флаг матч-медиа)**

Create `src/components/anchor-engine/inline-anchor-layer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { InlineAnchorLayer } from "./inline-anchor-layer";
import type { AnchoredNote } from "./types";

const notes: AnchoredNote[] = [
  { id: "c1", anchor: { startBlockId: "b1", endBlockId: "b1", startChar: 0, endChar: 3, exact: "abc" } },
];

function noopMatchMedia(matches: boolean) {
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

describe("InlineAnchorLayer", () => {
  it("по умолчанию карточки НЕ отрендерены (lazy): renderCard не вызван без клика", () => {
    noopMatchMedia(true);
    const renderCard = vi.fn((id: string) => <div>card-{id}</div>);
    const ref = createRef<HTMLElement>();
    ref.current = document.createElement("div");
    render(
      <InlineAnchorLayer
        astRootRef={ref}
        notes={notes}
        renderCard={renderCard}
        showAllHighlights={false}
        canCreate={false}
        onCreateRequest={vi.fn()}
        affordanceLabel="x"
        onActivateNarrow={vi.fn()}
      />,
    );
    expect(renderCard).not.toHaveBeenCalled();
    expect(screen.queryByText(/card-/)).toBeNull();
  });
});
```

- [ ] **Step 2: Прогнать — падает**

Run: `pnpm vitest run src/components/anchor-engine/inline-anchor-layer.test.tsx`
Expected: FAIL — модуля нет.

- [ ] **Step 3: Реализовать `inline-anchor-layer.tsx`**

```tsx
"use client";
// src/components/anchor-engine/inline-anchor-layer.tsx
// Lazy-политика движка (под комментарии): подсветка не постоянная — по hover
// (useHoverReveal) или по глобальному тоглу showAllHighlights; клик по фрагменту
// открывает ОДНУ превью-карточку у якоря (wide) или зовёт onActivateNarrow
// (narrow, напр. скролл к треду внизу). Захват выделения → аффорданс создания —
// как в eager-политике. Side колонки задаёт страница через MarginNote.
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { HighlightController } from "./highlight-controller";
import { HighlightOverlay } from "./highlight-overlay";
import { MarginNotesColumn } from "./margin-notes-column";
import { SelectionAffordance } from "./selection-affordance";
import type { AnchorDraft, AnchoredNote } from "./types";
import { useAnchorHighlights } from "./use-anchor-highlights";
import { useAnchorRanges } from "./use-anchor-ranges";
import { useHoverReveal } from "./use-hover-reveal";
import { useSelectionCapture } from "./use-selection-capture";
import { useTextClick } from "./use-text-click";

const WIDE = "(min-width: 80rem)";

export interface InlineAnchorLayerProps {
  astRootRef: RefObject<HTMLElement | null>;
  notes: AnchoredNote[];
  renderCard: (id: string) => ReactNode;
  showAllHighlights: boolean;
  canCreate: boolean;
  onCreateRequest: (draft: AnchorDraft) => void;
  affordanceLabel: string;
  onActivateNarrow: (id: string) => void;
  highlightName?: string;
}

export function InlineAnchorLayer(props: InlineAnchorLayerProps) {
  const {
    astRootRef,
    notes,
    renderCard,
    showAllHighlights,
    canCreate,
    onCreateRequest,
    affordanceLabel,
    onActivateNarrow,
    highlightName = "comment",
  } = props;

  const controllerRef = useRef<HighlightController | null>(null);
  controllerRef.current ??= new HighlightController(highlightName);
  const controller = controllerRef.current;

  const { ranges, getAnchorRect, recomputeKey, ready } = useAnchorRanges({ astRootRef, notes });
  const { draft, clear } = useSelectionCapture({ rootRef: astRootRef, enabled: canCreate });

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // wide vs narrow (зеркало MarginNotesColumn). jsdom/SSR → narrow.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(WIDE);
    const sync = () => {
      setWide(mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
    };
  }, []);

  useHoverReveal({ astRootRef, notes, ready, onHover: setHoveredId });

  // persistentIds: при тогле — все, иначе пусто. activeId: открытая карточка
  // важнее наведения.
  const persistentIds = showAllHighlights ? notes.map((n) => n.id) : [];
  useAnchorHighlights({
    controller,
    ranges,
    persistentIds,
    activeId: openId ?? hoveredId,
    enabled: true,
  });

  const pick = useCallback(
    (id: string) => {
      if (wide) setOpenId(id);
      else onActivateNarrow(id);
    },
    [wide, onActivateNarrow],
  );
  useTextClick({ astRootRef, notes, ready, onPick: pick });

  const create = useCallback(() => {
    if (draft) {
      onCreateRequest(draft);
      clear();
    }
  }, [draft, onCreateRequest, clear]);

  // Превью-карточка: только открытая, как одиночный якорённый note в колонке.
  const columnNotes =
    wide && openId
      ? [
          {
            id: openId,
            orphan: (ranges.get(openId) ?? null) === null,
            node: <div data-note-card={openId}>{renderCard(openId)}</div>,
          },
        ]
      : [];

  const overlayRanges =
    !controller.supported && openId
      ? [ranges.get(openId)].filter((r): r is Range => r != null)
      : [];

  return (
    <>
      {draft && canCreate && (
        <SelectionAffordance rect={draft.rect} label={affordanceLabel} onCreate={create} />
      )}
      {overlayRanges.length > 0 && <HighlightOverlay ranges={overlayRanges} activeRange={null} />}
      <MarginNotesColumn
        notes={columnNotes}
        getAnchorRect={getAnchorRect}
        onActivate={() => {
          setOpenId(null);
        }}
        recomputeKey={recomputeKey}
      />
    </>
  );
}
```

- [ ] **Step 4: Прогнать — проходит**

Run: `pnpm vitest run src/components/anchor-engine/inline-anchor-layer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Экспортировать из `index.ts`**

```ts
export { InlineAnchorLayer, type InlineAnchorLayerProps } from "./inline-anchor-layer";
```

- [ ] **Step 6: Commit**

```bash
git add src/components/anchor-engine/inline-anchor-layer.tsx src/components/anchor-engine/inline-anchor-layer.test.tsx src/components/anchor-engine/index.ts
git commit --only src/components/anchor-engine/inline-anchor-layer.tsx src/components/anchor-engine/inline-anchor-layer.test.tsx src/components/anchor-engine/index.ts -m "feat(anchor-engine): InlineAnchorLayer (lazy-политика по клику + hover)

Подсветка по hover/тоглу; клик → превью-карточка (wide) или
onActivateNarrow (narrow). Канал highlight default comment.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Финальный гейт + поведение-сохранность

Свести воедино: полный гейт + ручная браузер-проверка аннотаций (jsdom не рендерит CSS Highlight/геометрию — визуал проверяется только в браузере). Это ВОРОТА перед PR2.

**Files:** нет изменений кода (проверочный таск).

- [ ] **Step 1: Полный гейт**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное.

- [ ] **Step 2: Ручная браузер-QA аннотаций (поведение идентично до рефактора)**

Чек-лист (локально `pnpm dev`, страница `/documents/[id]` и `/lectures/[id]` с активным документом):
- выделение текста → всплывает аффорданс «добавить аннотацию» → создание работает;
- существующие аннотации подсвечены, карточки в правом поле спозиционированы у фрагментов;
- клик по подсвеченному тексту → активная карточка + скролл к ней;
- клик по карточке → скролл к фрагменту;
- тогл подсветки on/off работает; перезагрузка хранит состояние;
- сироты (orphan) — в начале списка.

- [ ] **Step 3: Зафиксировать готовность PR1**

Если всё зелёное и браузер-QA пройдена — PR1 готов к ревью/мержу. PR2 (`2026-06-26-anchored-comments-feature.md`) стартует ТОЛЬКО после этого.

---

## Self-Review (выполнено автором плана)

- **Покрытие спеки:** rename ядра (Task 1), shared-конвертер/схема (Task 2-3), вынос хуков (Task 4-5), MarginAnchorLayer + миграция аннотаций (Task 6), useHoverReveal (Task 7), InlineAnchorLayer (Task 8), гейт+QA (Task 9) — все элементы «Архитектура/Ярус 1-2» из спеки покрыты. `side` сознательно НЕ проп движка (управляется страницей через `MarginNote`) — уточнение к спеке, согласовано: проще и честнее.
- **Плейсхолдеров нет:** каждый код-шаг содержит реальный код; каждая команда — ожидаемый результат.
- **Консистентность типов:** `MarginAnchorLayerProps`/`InlineAnchorLayerProps`, `useAnchorRanges`/`useAnchorHighlights`/`useTextClick`/`useHoverReveal` совпадают между блоком Interfaces и тасками. `coordsToEngineAnchor`/`engineAnchorToCoords`/`anchorJsonField` — единые имена.
