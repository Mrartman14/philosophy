# View Transitions Foundation + Theme Crossfade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить мгновенную смену темы плавным круговым reveal через браузерный View Transitions API, заложив переиспользуемое ядро для будущих переходов.

**Architecture:** Три последовательных PR. PR-1 — новый kit-примитив `RadioGroup` (segmented), API drop-in под `Select`. PR-2 — переиспользуемое VT-ядро: хелпер `withViewTransition` (feature-detect + reduced-motion guard + last-pointer origin + token-driven длительность), единый reduced-motion-предикат, CSS-гейт и токены в globals.css. PR-3 — перевод коротких осей appearance на `RadioGroup` и обёртка смены темы в `withViewTransition`. Визуальная смена темы уже императивна (`applyToHtml` мутирует `data-theme`), поэтому `flushSync` не нужен.

**Tech Stack:** Next 16.2.9, React 19.2.3, Base UI (`@base-ui/react`), Tailwind v4 (CSS-токены), Vitest + @testing-library/react, pnpm.

## Global Constraints

- Пакетный менеджер — **pnpm** (никогда `npm`). Команды тестов: `pnpm exec vitest run <file>`; гейт: `pnpm lint && pnpm test && pnpm build`.
- Именование файлов в `src/` — **kebab-case**.
- Параллельные агенты: **только** `git add <свои файлы по имени>` + `git commit --only <те же файлы>`. НЕ `git add -A`, НЕ деструктивные git-операции, НЕ push.
- Заморожённые зоны трогаем осознанно (этот план — обоснование): `src/components/ui/*`, `src/app/globals.css`, `src/utils/*`, `src/components/appearance/*`.
- UI-kit guardrails (G7/G8): leaf-примитивы с закрытым `className`, без нативных интерактивных тегов / прямого base-ui у потребителей; логические свойства для RTL; фокус-кольцо из `cn`-хелперов.
- Каждый commit-trailer заканчивается строкой:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Спека: [docs/superpowers/specs/2026-06-22-view-transitions-foundation-design.md](2026-06-22-view-transitions-foundation-design.md).

---

## PR-1 — RadioGroup primitive

### Task 1: `RadioGroup` (segmented) kit-примитив

**Files:**
- Create: `src/components/ui/radio-group.tsx`
- Create: `src/components/ui/radio-group.test.tsx`
- Modify: `src/components/ui/index.ts` (добавить экспорт)

**Interfaces:**
- Produces:
  ```ts
  interface RadioGroupOption { value: string; label: string }
  interface RadioGroupProps {
    options: RadioGroupOption[];
    value: string;
    onValueChange: (value: string) => void;
    "aria-label": string;
    name?: string;
    disabled?: boolean;
  }
  export function RadioGroup(props: RadioGroupProps): React.JSX.Element;
  ```
- Consumes: Base UI `RadioGroup` (`@base-ui/react/radio-group`), `Radio` (`@base-ui/react/radio`); `cn`, `FOCUS_RING_CONTROL` из `./cn`.

- [ ] **Step 1: Write the failing test**

`src/components/ui/radio-group.test.tsx`:
```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RadioGroup } from "./radio-group";

afterEach(cleanup);

const OPTIONS = [
  { value: "system", label: "Система" },
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
];

describe("RadioGroup", () => {
  it("рендерит radiogroup с aria-label и по radio на опцию", () => {
    render(<RadioGroup aria-label="Тема" options={OPTIONS} value="light" onValueChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Тема" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("помечает текущее значение как checked", () => {
    render(<RadioGroup aria-label="Тема" options={OPTIONS} value="light" onValueChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Светлая" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Тёмная" })).not.toBeChecked();
  });

  it("клик по сегменту зовёт onValueChange с его value", () => {
    const onValueChange = vi.fn();
    render(<RadioGroup aria-label="Тема" options={OPTIONS} value="light" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Тёмная" }));
    expect(onValueChange).toHaveBeenCalledWith("dark");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/ui/radio-group.test.tsx`
Expected: FAIL — `Failed to resolve import "./radio-group"`.

- [ ] **Step 3: Write minimal implementation**

`src/components/ui/radio-group.tsx`:
```tsx
"use client";
// src/components/ui/radio-group.tsx
import { Radio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";

import { cn, FOCUS_RING_CONTROL } from "./cn";

interface RadioGroupOption {
  value: string;
  label: string;
}

export interface RadioGroupProps {
  options: RadioGroupOption[];
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
  "aria-label": string;
}

/**
 * Segmented single-select (выбор-одного-из-N). Drop-in под `Select` API:
 * same `{ options, value, onValueChange, aria-label }`. Сегменты встык, активный
 * залит. RTL-порядок корректен через flex + логические границы.
 */
export function RadioGroup({
  options,
  value,
  onValueChange,
  name,
  disabled,
  "aria-label": ariaLabel,
}: RadioGroupProps) {
  return (
    <BaseRadioGroup
      aria-label={ariaLabel}
      name={name}
      disabled={disabled}
      value={value}
      onValueChange={(v) => { onValueChange(String(v)); }}
      className="inline-flex overflow-hidden rounded border border-(--color-border)"
    >
      {options.map((opt) => (
        <Radio.Root
          key={opt.value}
          value={opt.value}
          className={cn(
            "h-(--size-control-h-md) cursor-pointer px-(--space-control-pad-x) text-sm",
            "inline-flex items-center justify-center",
            "border-(--color-border) [&:not(:first-child)]:border-s",
            FOCUS_RING_CONTROL,
            "data-[checked]:bg-(--color-fg) data-[checked]:text-(--color-surface)",
            "data-[disabled]:opacity-50",
          )}
        >
          {opt.label}
        </Radio.Root>
      ))}
    </BaseRadioGroup>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/ui/radio-group.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Add export to kit barrel**

В `src/components/ui/index.ts` добавить рядом с `Select`-экспортом (строка 8):
```ts
export { RadioGroup, type RadioGroupProps } from "./radio-group";
```

- [ ] **Step 6: Lint + commit**

Run: `pnpm lint`
Expected: без ошибок в новых файлах.

```bash
git add src/components/ui/radio-group.tsx src/components/ui/radio-group.test.tsx src/components/ui/index.ts
git commit --only src/components/ui/radio-group.tsx src/components/ui/radio-group.test.tsx src/components/ui/index.ts -m "feat(ui): segmented RadioGroup primitive (drop-in под Select API)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## PR-2 — VT foundation

### Task 2: единый reduced-motion-предикат `isReducedMotion`

**Files:**
- Create: `src/components/appearance/is-reduced-motion.ts`
- Create: `src/components/appearance/is-reduced-motion.test.ts`
- Modify: `src/components/appearance/use-reduced-motion.ts` (переключить на общий предикат)
- Modify: `src/components/appearance/index.ts` (экспорт, если барелится — проверить)

**Interfaces:**
- Produces:
  ```ts
  import type { Motion } from "@/styles/tokens/enums";
  export function isReducedMotion(input: { motion: Motion; osReduce: boolean }): boolean;
  ```
- Consumes: тип `Motion` (`"system" | "reduced" | "full"`) из `@/styles/tokens/enums`.
- Note: `withViewTransition` (Task 3) и `useReducedMotion` (этот таск) — оба потребителя этой чистой формулы.

- [ ] **Step 1: Write the failing test**

`src/components/appearance/is-reduced-motion.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import { isReducedMotion } from "./is-reduced-motion";

describe("isReducedMotion", () => {
  it("motion=reduced → всегда true", () => {
    expect(isReducedMotion({ motion: "reduced", osReduce: false })).toBe(true);
    expect(isReducedMotion({ motion: "reduced", osReduce: true })).toBe(true);
  });
  it("motion=full → всегда false (перебивает OS)", () => {
    expect(isReducedMotion({ motion: "full", osReduce: true })).toBe(false);
  });
  it("motion=system → следует OS", () => {
    expect(isReducedMotion({ motion: "system", osReduce: true })).toBe(true);
    expect(isReducedMotion({ motion: "system", osReduce: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/appearance/is-reduced-motion.test.ts`
Expected: FAIL — `Failed to resolve import "./is-reduced-motion"`.

- [ ] **Step 3: Write minimal implementation**

`src/components/appearance/is-reduced-motion.ts`:
```ts
import type { Motion } from "@/styles/tokens/enums";

/**
 * Единая формула приглушения движения (JS-сторона). Источник истины для
 * useReducedMotion (React-стейт) и withViewTransition (DOM dataset).
 * ЗЕРКАЛО CSS-гейта в globals.css — правишь одно, синхронно правь второе.
 *   reduced → true | full → false | system → следует OS prefers-reduced-motion.
 */
export function isReducedMotion(input: { motion: Motion; osReduce: boolean }): boolean {
  if (input.motion === "reduced") return true;
  if (input.motion === "full") return false;
  return input.osReduce;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/appearance/is-reduced-motion.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Рефактор `use-reduced-motion.ts` на общий предикат**

В `src/components/appearance/use-reduced-motion.ts` заменить тело хука (строки 35-41) так, чтобы оно делегировало в `isReducedMotion`, сохранив реактивность:
```ts
import { isReducedMotion } from "./is-reduced-motion";
// ...
export function useReducedMotion(): boolean {
  const { appearance } = useAppearance();
  const osReduce = useSyncExternalStore(subscribe, getOSReduce, () => false);
  return isReducedMotion({ motion: appearance.motion, osReduce });
}
```
Обновить doc-комментарий «JS-ЗЕРКАЛО CSS-формулы»: формула теперь живёт в `is-reduced-motion.ts`, хук — лишь реактивная обёртка.

- [ ] **Step 6: Run existing reduced-motion tests**

Run: `pnpm exec vitest run src/components/appearance/use-reduced-motion.test.tsx src/components/appearance/is-reduced-motion.test.ts`
Expected: PASS (существующие тесты хука зелёные + новые).

- [ ] **Step 7: Commit**

```bash
git add src/components/appearance/is-reduced-motion.ts src/components/appearance/is-reduced-motion.test.ts src/components/appearance/use-reduced-motion.ts
git commit --only src/components/appearance/is-reduced-motion.ts src/components/appearance/is-reduced-motion.test.ts src/components/appearance/use-reduced-motion.ts -m "refactor(appearance): единый reduced-motion предикат isReducedMotion

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: хелпер `withViewTransition` + last-pointer трекер

**Files:**
- Create: `src/utils/view-transition.ts`
- Create: `src/utils/view-transition.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface ViewTransitionOpts {
    origin?: { x: number; y: number };
    duration?: number;   // ms; дефолт — из --vt-duration
    easing?: string;     // дефолт — из --vt-easing
    name?: string;       // зарезервировано под будущий CSS-таргетинг
  }
  export function withViewTransition(mutate: () => void, opts?: ViewTransitionOpts): void;
  ```
- Consumes: `isReducedMotion` из `@/components/appearance/is-reduced-motion`; тип `Motion` из `@/styles/tokens/enums`.

- [ ] **Step 1: Write the failing test**

`src/utils/view-transition.test.ts`:
```ts
import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withViewTransition } from "./view-transition";

function setMatchMedia(reduce: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("reduce") ? reduce : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-motion");
  delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
});

describe("withViewTransition", () => {
  let animate: MockInstance;
  beforeEach(() => {
    setMatchMedia(false);
    // jsdom-стаб WAAPI: хвостовой ready.then(...animate) не должен падать.
    animate = vi.spyOn(document.documentElement, "animate").mockReturnValue({} as Animation);
  });

  it("без поддержки startViewTransition → mutate синхронно", () => {
    const mutate = vi.fn();
    withViewTransition(mutate);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("при reduced motion → mutate синхронно, startViewTransition НЕ зовётся", () => {
    document.documentElement.setAttribute("data-motion", "reduced");
    const start = vi.fn();
    (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
    const mutate = vi.fn();
    withViewTransition(mutate);
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
  });

  it("VT доступен + motion разрешён → startViewTransition(mutate)", () => {
    const start = vi.fn((cb: () => void) => { cb(); return { ready: Promise.resolve() }; });
    (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
    const mutate = vi.fn();
    withViewTransition(mutate);
    expect(start).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("origin берётся из последней точки указателя (pointerdown)", async () => {
    let ready!: () => void;
    const start = vi.fn((cb: () => void) => { cb(); return { ready: new Promise<void>((r) => { ready = () => { r(); }; }) }; });
    (document as unknown as { startViewTransition: unknown }).startViewTransition = start;
    document.dispatchEvent(new MouseEvent("pointerdown", { clientX: 10, clientY: 20 }));
    withViewTransition(() => {});
    ready();
    await Promise.resolve();
    expect(animate).toHaveBeenCalled();
    const keyframes = animate.mock.calls[0]![0] as { clipPath: string[] };
    expect(keyframes.clipPath[0]).toContain("at 10px 20px");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/utils/view-transition.test.ts`
Expected: FAIL — `Failed to resolve import "./view-transition"`.

- [ ] **Step 3: Write minimal implementation**

`src/utils/view-transition.ts`:
```ts
import { isReducedMotion } from "@/components/appearance/is-reduced-motion";
import type { Motion } from "@/styles/tokens/enums";

interface Point { x: number; y: number }

export interface ViewTransitionOpts {
  origin?: Point;
  duration?: number;
  easing?: string;
  name?: string;
}

type VTCapableDocument = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<unknown> };
};

// Последняя точка указателя — origin кругового reveal по умолчанию. Capture-фаза
// гарантирует, что pointerdown триггерящего клика записан ДО React-обработчика.
let lastPointer: Point | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (e) => { lastPointer = { x: e.clientX, y: e.clientY }; },
    { capture: true, passive: true },
  );
}

function reducedNow(): boolean {
  const motion = (document.documentElement.dataset.motion as Motion | undefined) ?? "system";
  const osReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return isReducedMotion({ motion, osReduce });
}

function readNumberToken(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (raw.endsWith("ms")) return parseFloat(raw) || fallback;
  if (raw.endsWith("s")) return (parseFloat(raw) || fallback / 1000) * 1000;
  return fallback;
}

function readStringToken(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * Оборачивает СИНХРОННУЮ DOM-мутацию в круговой View-Transition reveal.
 * Фолбэк (нет VT ИЛИ движение приглушено) — просто вызвать mutate (мгновенно).
 * flushSync не нужен: потребитель сам синхронно мутирует DOM в mutate.
 */
export function withViewTransition(mutate: () => void, opts: ViewTransitionOpts = {}): void {
  const doc = document as VTCapableDocument;
  if (typeof doc.startViewTransition !== "function" || reducedNow()) {
    mutate();
    return;
  }
  const origin = opts.origin ?? lastPointer ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const duration = opts.duration ?? readNumberToken("--vt-duration", 400);
  const easing = opts.easing ?? readStringToken("--vt-easing", "ease-in-out");

  const transition = doc.startViewTransition(mutate);
  void transition.ready.then(() => {
    const end = Math.hypot(
      Math.max(origin.x, window.innerWidth - origin.x),
      Math.max(origin.y, window.innerHeight - origin.y),
    );
    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${origin.x}px ${origin.y}px)`,
          `circle(${end}px at ${origin.x}px ${origin.y}px)`,
        ],
      },
      { duration, easing, pseudoElement: "::view-transition-new(root)" },
    );
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/utils/view-transition.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck (убедиться, что локальный VTCapableDocument не конфликтует с lib.dom)**

Run: `pnpm lint`
Expected: без ошибок. Если линт ругается на `no-unnecessary-condition` для `typeof document !== "undefined"` — оставить как есть только при реальной ошибке; иначе не трогать.

- [ ] **Step 6: Commit**

```bash
git add src/utils/view-transition.ts src/utils/view-transition.test.ts
git commit --only src/utils/view-transition.ts src/utils/view-transition.test.ts -m "feat(utils): withViewTransition — круговой reveal с reduced-motion guard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: CSS — VT-токены, отключение UA-кроссфейда, reduced-гейт

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/app/globals.view-transition.test.ts` (контент-гард)

**Interfaces:**
- Produces: CSS-токены `--vt-duration`, `--vt-easing` в `:root`; правило отключения UA-кроссфейда корня; глушение `::view-transition-*` под reduced.
- Consumes: существующий motion-гейт (`[data-motion="reduced"]` и `@media (prefers-reduced-motion: reduce) :root:not([data-motion="full"])`).

- [ ] **Step 1: Write the failing test**

`src/app/globals.view-transition.test.ts`:
```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("globals.css — View Transitions", () => {
  it("объявляет VT-токены в :root", () => {
    expect(css).toMatch(/--vt-duration:/);
    expect(css).toMatch(/--vt-easing:/);
  });
  it("отключает UA-кроссфейд корня (под наш clip-reveal)", () => {
    expect(css).toMatch(/::view-transition-old\(root\)/);
    expect(css).toMatch(/::view-transition-new\(root\)/);
  });
  it("глушит view-transition под data-motion=reduced", () => {
    expect(css).toMatch(/\[data-motion="reduced"\][^}]*::view-transition-group/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/globals.view-transition.test.ts`
Expected: FAIL — токены/правила ещё не добавлены.

- [ ] **Step 3: Добавить токены и правила в `globals.css`**

В блок `:root` (рядом с тем местом, где живут motion-переменные; искать `--app-motion-duration`) добавить дефолты:
```css
:root { --vt-duration: 400ms; --vt-easing: ease-in-out; }
```

После RTL-блока `.rtl-flip` (около строки 149), добавить VT-секцию:
```css
/* ═══════════════════════════════════════════════════════════════
   VIEW TRANSITIONS
   Отключаем UA-дефолтный кроссфейд корня — наш круговой clip-reveal
   рисует withViewTransition (src/utils/view-transition.ts) через WAAPI.
   Reduced-глушение встроено в motion-политику ниже: для смены темы это
   belt-and-suspenders (JS-guard и так не вызовет VT), но это forward-
   protection для будущих переходов, которые триггерит фреймворк.
   ═══════════════════════════════════════════════════════════════ */
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}
```

В существующий блок `@media (prefers-reduced-motion: reduce)` (внутри `:root:not([data-motion="full"])`) добавить обнуление токена и глушение псевдо-элементов:
```css
  :root:not([data-motion="full"]) { --vt-duration: 0.001ms; }
  :root:not([data-motion="full"])::view-transition-group(*),
  :root:not([data-motion="full"])::view-transition-old(*),
  :root:not([data-motion="full"])::view-transition-new(*) {
    animation: none !important;
  }
```

В существующий блок `[data-motion="reduced"]` добавить то же:
```css
[data-motion="reduced"] { --vt-duration: 0.001ms; }
[data-motion="reduced"]::view-transition-group(*),
[data-motion="reduced"]::view-transition-old(*),
[data-motion="reduced"]::view-transition-new(*) {
  animation: none !important;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/globals.view-transition.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Build (валидация CSS)**

Run: `pnpm build`
Expected: успешная сборка (CSS валиден).

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/app/globals.view-transition.test.ts
git commit --only src/app/globals.css src/app/globals.view-transition.test.ts -m "feat(css): VT-токены + reduced-гейт для view-transition псевдо-элементов

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## PR-3 — Appearance: контролы + кроссфейд

### Task 5: перевод осей на RadioGroup + кроссфейд темы

**Files:**
- Modify: `src/app/me/settings/appearance/appearance-settings.tsx`
- Create: `src/app/me/settings/appearance/appearance-settings.test.tsx`

**Interfaces:**
- Consumes: `RadioGroup` (Task 1), `withViewTransition` (Task 3), существующие `useAppearance`/`setAxis`, `Select` (для textSize).

- [ ] **Step 1: Write the failing test**

`src/app/me/settings/appearance/appearance-settings.test.tsx`:
```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const setAxis = vi.fn();
vi.mock("@/components/appearance", () => ({
  useAppearance: () => ({
    appearance: { theme: "light", contrast: "auto", density: "comfortable", font: "sans", textSize: "md", motion: "system" },
    setAxis,
  }),
}));

const withViewTransition = vi.fn((fn: () => void) => { fn(); });
vi.mock("@/utils/view-transition", () => ({ withViewTransition: (fn: () => void) => withViewTransition(fn) }));

vi.mock("@/i18n/client", async () => {
  const settings = (await import("@/i18n/messages/ru/settings")).default;
  const useT = () => (key: string) =>
    (key.split(".").reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], settings) ?? key) as string;
  return { useT };
});

import { AppearanceSettings } from "./appearance-settings";

afterEach(() => { cleanup(); setAxis.mockClear(); withViewTransition.mockClear(); });

describe("AppearanceSettings", () => {
  it("смена темы идёт через withViewTransition и setAxis('theme')", () => {
    render(<AppearanceSettings />);
    const group = screen.getByRole("radiogroup", { name: /тем/i });
    fireEvent.click(within(group).getByRole("radio", { name: /тёмн/i }));
    expect(withViewTransition).toHaveBeenCalledTimes(1);
    expect(setAxis).toHaveBeenCalledWith("theme", "dark");
  });

  it("смена плотности — напрямую setAxis, без withViewTransition", () => {
    render(<AppearanceSettings />);
    const group = screen.getByRole("radiogroup", { name: /плотн/i });
    fireEvent.click(within(group).getByRole("radio", { name: /компакт/i }));
    expect(setAxis).toHaveBeenCalledWith("density", "compact");
    expect(withViewTransition).not.toHaveBeenCalled();
  });
});
```
> Примечание: лейблы radio (`/тёмн/i`, `/компакт/i`) и aria-label групп (`/тем/i`, `/плотн/i`) сверить с реальными значениями каталога `ru/settings` на шаге реализации; при расхождении — поправить регэкспы.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/me/settings/appearance/appearance-settings.test.tsx`
Expected: FAIL — компонент ещё использует `Select`, нет `radiogroup`.

- [ ] **Step 3: Переписать `appearance-settings.tsx`**

Заменить импорт и строки 44-49 (короткие оси → `RadioGroup`, theme — через `withViewTransition`, textSize остаётся `Select`):
```tsx
"use client";
import { useAppearance } from "@/components/appearance";
import { FormField, RadioGroup, Select } from "@/components/ui";
import { useT } from "@/i18n/client";
import { withViewTransition } from "@/utils/view-transition";

export function AppearanceSettings() {
  const { appearance, setAxis } = useAppearance();
  const t = useT("settings");

  const THEME = [
    { value: "system", label: t("appearance.theme.system") },
    { value: "light", label: t("appearance.theme.light") },
    { value: "dark", label: t("appearance.theme.dark") },
  ];
  const CONTRAST = [
    { value: "auto", label: t("appearance.contrast.auto") },
    { value: "normal", label: t("appearance.contrast.normal") },
    { value: "high", label: t("appearance.contrast.high") },
  ];
  const DENSITY = [
    { value: "comfortable", label: t("appearance.density.comfortable") },
    { value: "compact", label: t("appearance.density.compact") },
  ];
  const FONT = [
    { value: "sans", label: t("appearance.font.sans") },
    { value: "legible", label: t("appearance.font.legible") },
    { value: "serif", label: t("appearance.font.serif") },
  ];
  const TEXT_SIZE = [
    { value: "sm", label: t("appearance.textSize.sm") },
    { value: "md", label: t("appearance.textSize.md") },
    { value: "lg", label: t("appearance.textSize.lg") },
    { value: "xl", label: t("appearance.textSize.xl") },
  ];
  const MOTION = [
    { value: "system", label: t("appearance.motion.system") },
    { value: "reduced", label: t("appearance.motion.reduced") },
    { value: "full", label: t("appearance.motion.full") },
  ];

  return (
    <section className="flex max-w-xl flex-col gap-4">
      <h2 className="text-lg font-semibold">{t("appearance.heading")}</h2>
      <Row name="theme" label={t("appearance.themeLabel")}><RadioGroup aria-label={t("appearance.themeAriaLabel")} options={THEME} value={appearance.theme} onValueChange={(v) => { withViewTransition(() => { setAxis("theme", v as typeof appearance.theme); }); }} /></Row>
      <Row name="contrast" label={t("appearance.contrastLabel")}><RadioGroup aria-label={t("appearance.contrastAriaLabel")} options={CONTRAST} value={appearance.contrast} onValueChange={(v) => { setAxis("contrast", v as typeof appearance.contrast); }} /></Row>
      <Row name="density" label={t("appearance.densityLabel")}><RadioGroup aria-label={t("appearance.densityAriaLabel")} options={DENSITY} value={appearance.density} onValueChange={(v) => { setAxis("density", v as typeof appearance.density); }} /></Row>
      <Row name="font" label={t("appearance.fontLabel")}><RadioGroup aria-label={t("appearance.fontAriaLabel")} options={FONT} value={appearance.font} onValueChange={(v) => { setAxis("font", v as typeof appearance.font); }} /></Row>
      <Row name="textSize" label={t("appearance.textSizeLabel")}><Select aria-label={t("appearance.textSizeAriaLabel")} options={TEXT_SIZE} value={appearance.textSize} onValueChange={(v) => { setAxis("textSize", v as typeof appearance.textSize); }} /></Row>
      <Row name="motion" label={t("appearance.motionLabel")}><RadioGroup aria-label={t("appearance.motionAriaLabel")} options={MOTION} value={appearance.motion} onValueChange={(v) => { setAxis("motion", v as typeof appearance.motion); }} /></Row>
    </section>
  );
}
function Row({ name, label, children }: { name: string; label: string; children: React.ReactNode }) {
  return <FormField name={name} label={label}>{children}</FormField>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/me/settings/appearance/appearance-settings.test.tsx`
Expected: PASS (2 tests). При необходимости поправить регэкспы лейблов под реальный `ru/settings`.

- [ ] **Step 5: Full gate**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное.

- [ ] **Step 6: Commit**

```bash
git add src/app/me/settings/appearance/appearance-settings.tsx src/app/me/settings/appearance/appearance-settings.test.tsx
git commit --only src/app/me/settings/appearance/appearance-settings.tsx src/app/me/settings/appearance/appearance-settings.test.tsx -m "feat(appearance): segmented-оси + кроссфейд смены темы (View Transitions)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Ручная приёмка (после Task 5)

В Chromium/Safari на `/me/settings/appearance`:
- Смена темы (system/light/dark) — новая палитра расходится круговым reveal из точки клика по сегменту.
- `motion: reduced` (и в браузере без VT) — смена мгновенная, без анимации.
- Контролы 5 коротких осей — segmented; textSize — выпадающий Select.
- RTL (переключить locale на RTL, если доступно) — порядок сегментов корректен, reveal без артефактов.
- Подобрать финальные `--vt-duration` / `--vt-easing` под ощущение (старт: 400ms / ease-in-out).

## Self-Review заметки

- **Spec coverage:** §5→Task1; §6.1/6.2→Task3; §6.3→Task2; §6.4→Task4; §6.5→Task3 (локальный cast вместо ambient — конфликт исключён); §7→Task5. Все секции покрыты.
- **Type consistency:** `isReducedMotion({motion,osReduce})` единообразно в Task2/Task3; `withViewTransition(mutate, opts)` единообразно Task3/Task5; `RadioGroupProps` единообразно Task1/Task5.
- **Reduced-motion в helper:** `dataset.motion ?? "system"` — учитывает, что `htmlAttrs` не эмитит `data-motion` при system (подтверждено в appearance-cookie.ts).
