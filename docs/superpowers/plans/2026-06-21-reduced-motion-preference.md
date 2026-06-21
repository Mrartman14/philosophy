# Reduced Motion (5-я ось appearance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить настройку «уменьшить движение» как пятую ось appearance (`motion: system | reduced | full`), с синком на бэкенд, no-FOUC SSR, нюансным глушением анимаций по сайту и отключением инерции камеры в карте смыслов.

**Architecture:** Расширяем существующую трубу appearance (enums → cookie/htmlAttrs → SSR → debounced PATCH → Select). `motion` моделируется 1:1 с бэком (как `theme`), `system` = следовать ОС (атрибут `data-motion` НЕ эмитится при `system`). Глушение: CSS-gate в `globals.css` (двойное условие: явный `[data-motion="reduced"]` ИЛИ `@media (prefers-reduced-motion: reduce)` при `:not([data-motion="full"])`) + JS-мост к three.js через хук `useReducedMotion` и метод порта `setReducedMotion`.

**Tech Stack:** Next.js (App Router, server components + server actions), React, TypeScript, Base UI, Tailwind v4, three.js (OrbitControls), Vitest + Testing Library, next-intl (фасад `@/i18n`), pnpm.

> **Изменения после multi-agent ревью (2026-06-21):** Task 0 (префлайт-гейт схемы); Task 5 переведён на `reduceRef` (снимает exhaustive-deps + пересоздание WebGL-рендерера); усилены тесты (cleanup, OS-реактивность хука, ассерт `enableDamping`); закрыт residual закрытия навменю (scale:1); Task 6 i18n — обе локали одним шагом; расширена ручная матрица (анти-FOUC, изоляция ветки). Подробности — в Self-Review.

## Global Constraints

- **Тип работы:** foundation-update (расширение appearance-фундамента) — замороженные зоны (`src/components/appearance/*`, `src/app/globals.css`, `src/components/app/app-header/*`, `src/api/schema.ts`) трогаем намеренно и координированно.
- **`src/api/schema.ts`:** уже перегенерирован пользователем (контракт `preference.Motion` живёт в рабочем дереве). НЕ регенерировать и **НЕ коммитить** его в рамках этой работы (решение пользователя). Наличие контракта проверяет Task 0.
- **Контракт оси:** `preference.Motion = "system" | "reduced" | "full"`. `system` = следовать ОС (DEFAULT, подтверждено пользователем). `reduced` = форсить уменьшение. `full` = форсить анимации даже если ОС просит reduce.
- **Маппинг:** `motion` шлётся в PATCH напрямую (как `theme`, БЕЗ omit-трюка контраста). `data-motion` эмитится на `<html>` только когда значение ≠ `system`.
- **Политика глушения — нюансная:** движение/transform/looping-анимации → off; одноразовый opacity-fade и hover-смена цвета → ok.
- **Тулчейн:** только pnpm (npm ломает тулчейн). Тест одного файла: `pnpm exec vitest run <path>`.
- **Git:** НЕ `git add -A`/`git add .` — добавлять только свои файлы по имени. НЕ делать деструктивных git-операций (stash/reset/checkout/clean). Не пушить. **`src/api/schema.ts` в коммиты НЕ включать.**
- **Именование** файлов в `src/` — kebab-case. Общение и тексты UI — ru + en (обе локали в синхроне).
- **Перед завершением** зелёные: `pnpm lint && pnpm test && pnpm build` (учти: `pnpm test` включает coverage-gate — см. Task 8).

### Порядок коммитов и откат

- Коммиты вливать строго в порядке Task 1 → 8: сначала контракт/труба (Task 1–6), CSS-gate (Task 7) — **последним**, т.к. gate и правка app-header бесполезны без эмиссии `data-motion` (Task 1/2).
- Правка app-header спроектирована безопасной при откате: `--duration: var(--app-motion-duration, 0.35s)` — при отсутствии `--app-motion-duration` fallback `0.35s` идентичен текущему поведению. Task 7 можно ревертнуть отдельно без поломки трубы.
- Обратная зависимость shell↔globals.css (app-header читает `--app-motion-duration`, который определяет только gate) — задокументирована здесь; ревертить эту пару вместе.

---

## File Structure

**Создаём:**
- `src/components/appearance/use-reduced-motion.ts` — клиентский хук JS-резолюции `reduce: boolean`.
- `src/components/appearance/use-reduced-motion.test.tsx` — тест хука (вкл. OS-реактивность).
- `src/features/semantic-map/renderer/three-map-renderer.test.ts` — тест `setReducedMotion` (ассерт `enableDamping`).

**Модифицируем:**
- `src/styles/tokens/enums.ts` — `MOTIONS` + тип `Motion`.
- `src/components/appearance/appearance-cookie.ts` — поле `motion`, DEFAULT, ENUMS, parse, htmlAttrs.
- `src/components/appearance/appearance-cookie.test.ts` — тесты motion (+ фикс round-trip литерала).
- `src/components/appearance/appearance-provider.tsx` — `data-motion` в `DATA_KEYS`.
- `src/components/appearance/appearance-provider.test.tsx` — тест live-apply `data-motion`.
- `src/components/appearance/persist-appearance.ts` — `motion` в payload.
- `src/components/appearance/persist-appearance.test.ts` — тест passthrough.
- `src/components/appearance/index.ts` — экспорт `useReducedMotion`.
- `src/utils/appearance.ts` — `motion` в `fromBackend`.
- `src/utils/appearance.test.ts` — фикс exact-equality + кейс motion из бэка.
- `src/features/semantic-map/renderer/map-renderer.ts` — метод `setReducedMotion` в интерфейсе.
- `src/features/semantic-map/renderer/three-map-renderer.ts` — поле + applyMode + метод.
- `src/features/semantic-map/ui/semantic-map-view.tsx` — `useReducedMotion` + `reduceRef` + проводка в рендерер.
- `src/app/me/settings/appearance/appearance-settings.tsx` — Select оси motion.
- `src/i18n/messages/ru/settings.ts`, `src/i18n/messages/en/settings.ts` — ключи motion.
- `src/app/globals.css` — CSS-gate reduced-motion.
- `src/components/app/app-header/app-header.tsx` — `--duration` через `var(--app-motion-duration, …)` + marker-класс `app-nav-popup`.

**НЕ трогаем / зависим транзитивно:**
- `src/app/layout.tsx` — уже спредит `...dataAttrs` из `htmlAttrs(appearance)` на `<html>`, новый `data-motion` попадёт туда без правок (SSR no-FOUC проверяется вручную, Task 7 Step 4).
- `src/api/schema.ts` — контракт уже есть; не коммитим (Task 0 — только проверка наличия).

---

## Task 0: Префлайт-гейт контракта схемы

**Files:** — (только проверка, без правок и коммитов)

**Interfaces:**
- Produces: гарантию, что `preference.Motion` присутствует в `src/api/schema.ts` до старта (вся фича на нём держится).

- [ ] **Step 1: Проверить наличие контракта motion**

Run:
```bash
grep -c '"preference.Motion"' src/api/schema.ts && grep -nE 'motion\?: ' src/api/schema.ts
```
Expected: первая команда ≥ 1; вторая показывает `motion?:` в `preference.Appearance` и `preference.AppearancePatch` (~строки 16040 и 16052).

- [ ] **Step 2: Решение по результату**

Если `0` совпадений — **СТОП**, эскалировать пользователю: схема не содержит контракт `motion` (её регенерирует пользователь, см. Global Constraints). НЕ регенерировать самостоятельно, НЕ коммитить `src/api/schema.ts`. Продолжать Task 1+ только при успешном гейте.

---

## Task 1: Модель оси motion (enums + cookie + htmlAttrs)

**Files:**
- Modify: `src/styles/tokens/enums.ts`
- Modify: `src/components/appearance/appearance-cookie.ts`
- Test: `src/components/appearance/appearance-cookie.test.ts`

**Interfaces:**
- Produces: `MOTIONS = ["system","reduced","full"] as const`; `type Motion`; `Appearance.motion: Motion`; `DEFAULT_APPEARANCE.motion = "system"`; `htmlAttrs(a)` возвращает `"data-motion": a.motion` только при `a.motion !== "system"`.

- [ ] **Step 1: Обновить тесты cookie (failing)**

В `src/components/appearance/appearance-cookie.test.ts` (a) изменить round-trip литерал, добавив `motion`, и (b) добавить два новых `it`. Изменить строку литерала:

```ts
  it("round-trips valid appearance", () => {
    const a = { theme: "dark", contrast: "high", density: "compact", font: "serif", textSize: "lg", motion: "reduced" } as const;
    expect(parseAppearance(serializeAppearance(a))).toEqual(a);
  });
```

Добавить перед закрывающим `});` блока `describe`:

```ts
  it("htmlAttrs: system motion omits data-motion; reduced/full emit it", () => {
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, motion: "system" })["data-motion"]).toBeUndefined();
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, motion: "reduced" })["data-motion"]).toBe("reduced");
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, motion: "full" })["data-motion"]).toBe("full");
  });
  it("parseAppearance coerces unknown motion → system and defaults to system", () => {
    expect(parseAppearance(JSON.stringify({ motion: "warp" })).motion).toBe("system");
    expect(DEFAULT_APPEARANCE.motion).toBe("system");
  });
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/components/appearance/appearance-cookie.test.ts`
Expected: FAIL (тип `Appearance` без `motion`; `htmlAttrs` не отдаёт `data-motion`; `DEFAULT_APPEARANCE.motion` undefined).

- [ ] **Step 3: Добавить MOTIONS в enums**

В `src/styles/tokens/enums.ts` после строки `export const TEXT_SIZES = [...] as const;`:

```ts
// "system" (default) следует OS prefers-reduced-motion; "reduced" форсит
// уменьшение движения; "full" форсит анимации даже при OS reduce.
export const MOTIONS = ["system", "reduced", "full"] as const;
```

И в блок типов после `export type TextSize = ...;`:

```ts
export type Motion = (typeof MOTIONS)[number];
```

- [ ] **Step 4: Встроить motion в appearance-cookie**

В `src/components/appearance/appearance-cookie.ts`:

Импорт (добавить `MOTIONS` и `Motion`):
```ts
import { THEMES, CONTRASTS, DENSITIES, FONTS, TEXT_SIZES, MOTIONS,
  type Theme, type Contrast, type Density, type FontChoice, type TextSize, type Motion } from "@/styles/tokens/enums";
```

Интерфейс и дефолт:
```ts
export interface Appearance { theme: Theme; contrast: Contrast; density: Density; font: FontChoice; textSize: TextSize; motion: Motion }
export const APPEARANCE_COOKIE = "appearance";
export const DEFAULT_APPEARANCE: Appearance = { theme: "system", contrast: "auto", density: "comfortable", font: "sans", textSize: "md", motion: "system" };
```

ENUMS-карта:
```ts
const ENUMS = { theme: THEMES, contrast: CONTRASTS, density: DENSITIES, font: FONTS, textSize: TEXT_SIZES, motion: MOTIONS } as const;
```

`parseAppearance` return — добавить `motion`:
```ts
  return { theme: pick("theme", o.theme), contrast: pick("contrast", o.contrast), density: pick("density", o.density), font: pick("font", o.font), textSize: pick("textSize", o.textSize), motion: pick("motion", o.motion) };
```

`htmlAttrs` — добавить эмит `data-motion` (после строки `data-font`):
```ts
    // "system" → нет атрибута (правит OS prefers-reduced-motion через CSS-gate);
    // "reduced"/"full" → эмитим (full перебивает OS-запрос в CSS).
    ...(a.motion !== "system" ? { "data-motion": a.motion } : {}),
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/components/appearance/appearance-cookie.test.ts`
Expected: PASS (все, включая round-trip с motion).

- [ ] **Step 6: Commit**

```bash
git add src/styles/tokens/enums.ts src/components/appearance/appearance-cookie.ts src/components/appearance/appearance-cookie.test.ts
git commit -m "feat(appearance): ось motion в модели appearance + htmlAttrs data-motion"
```

---

## Task 2: Live-apply data-motion в провайдере

**Files:**
- Modify: `src/components/appearance/appearance-provider.tsx`
- Test: `src/components/appearance/appearance-provider.test.tsx`

**Interfaces:**
- Consumes: `Appearance.motion`, `htmlAttrs` (Task 1).
- Produces: `setAxis("motion", v)` мутирует/снимает атрибут `data-motion` на `<html>` мгновенно.

- [ ] **Step 1: Дополнить тест провайдера (failing)**

В `src/components/appearance/appearance-provider.test.tsx`:

В `Probe` добавить две кнопки (внутри фрагмента, рядом с существующими):
```tsx
    <button onClick={() => { setAxis("motion", "reduced"); }}>reduce</button>
    <button onClick={() => { setAxis("motion", "system"); }}>motion-system</button>
```

В `beforeEach` добавить очистку атрибута (в конец цепочки `removeAttribute`):
```ts
document.documentElement.removeAttribute("data-motion");
```

Добавить новый `it` перед закрывающим `});` describe:
```ts
  it("setAxis motion: reduced sets data-motion, system removes it", () => {
    render(<AppearanceProvider initial={DEFAULT_APPEARANCE}><Probe/></AppearanceProvider>);
    fireEvent.click(screen.getByText("reduce"));
    expect(document.documentElement.getAttribute("data-motion")).toBe("reduced");
    fireEvent.click(screen.getByText("motion-system"));
    expect(document.documentElement.hasAttribute("data-motion")).toBe(false);
  });
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/components/appearance/appearance-provider.test.tsx`
Expected: FAIL (`data-motion` не выставляется — нет в `DATA_KEYS`).

- [ ] **Step 3: Добавить data-motion в DATA_KEYS**

В `src/components/appearance/appearance-provider.tsx` изменить строку `DATA_KEYS`:
```ts
const DATA_KEYS = ["data-theme", "data-contrast", "data-density", "data-font", "data-motion"] as const;
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/components/appearance/appearance-provider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/appearance/appearance-provider.tsx src/components/appearance/appearance-provider.test.tsx
git commit -m "feat(appearance): live-apply data-motion через провайдер"
```

---

## Task 3: Синк motion на бэкенд (write + read)

**Files:**
- Modify: `src/components/appearance/persist-appearance.ts`
- Test: `src/components/appearance/persist-appearance.test.ts`
- Modify: `src/utils/appearance.ts`
- Test: `src/utils/appearance.test.ts`

**Interfaces:**
- Consumes: `Appearance.motion` (Task 1), `preference.AppearancePatch.motion` (схема, уже есть).
- Produces: PATCH тела включают `motion`; `fromBackend` читает `motion` (отсутствие → `"system"`).

- [ ] **Step 1: Тесты write/read (failing)**

В `src/components/appearance/persist-appearance.test.ts` добавить `it` перед закрывающим `});`:
```ts
  it("passes motion through (sent as-is, like theme)", async () => {
    getMe.mockResolvedValue({ id: "u1", status: "active", capabilities: [] });
    patch.mockResolvedValue({ data: {}, error: null });
    await persistAppearance({ ...DEFAULT_APPEARANCE, motion: "reduced" });
    const body = patch.mock.calls[0]?.[1] as { body: { appearance: Record<string, unknown> } };
    expect(body.body.appearance.motion).toBe("reduced");
  });
```

В `src/utils/appearance.test.ts` (a) поправить exact-equality в тесте seed (добавить `motion: "system"`):
```ts
    expect(a).toEqual({ theme: "dark", contrast: "auto", density: "compact", font: "serif", textSize: "lg", motion: "system" });
```
(b) добавить новый `it` перед закрывающим `});`:
```ts
  it("reads motion from the backend appearance when present", async () => {
    cookieStore.get.mockReturnValue(undefined);
    getMe.mockResolvedValue({ id: "u1", status: "active", capabilities: [] });
    getPreferences.mockResolvedValue({ appearance: { motion: "reduced" } });
    expect((await getAppearance()).motion).toBe("reduced");
  });
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/components/appearance/persist-appearance.test.ts src/utils/appearance.test.ts`
Expected: FAIL (payload без `motion`; `fromBackend` без `motion` → exact-equality и кейс reduced падают).

- [ ] **Step 3: Добавить motion в payload**

В `src/components/appearance/persist-appearance.ts`, в `toAppearancePayload` (после `text_size: a.textSize,`):
```ts
    motion: a.motion,
```

- [ ] **Step 4: Добавить motion в fromBackend**

В `src/utils/appearance.ts`, в `fromBackend` return (после `textSize: a?.text_size ?? DEFAULT_APPEARANCE.textSize,`):
```ts
    motion: a?.motion ?? "system",
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/components/appearance/persist-appearance.test.ts src/utils/appearance.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/appearance/persist-appearance.ts src/components/appearance/persist-appearance.test.ts src/utils/appearance.ts src/utils/appearance.test.ts
git commit -m "feat(appearance): синк motion на бэкенд (PATCH + seed из preferences)"
```

---

## Task 4: Хук useReducedMotion

**Files:**
- Create: `src/components/appearance/use-reduced-motion.ts`
- Create: `src/components/appearance/use-reduced-motion.test.tsx`
- Modify: `src/components/appearance/index.ts`

**Interfaces:**
- Consumes: `useAppearance()` (контекст из провайдера) → `appearance.motion`; `window.matchMedia("(prefers-reduced-motion: reduce)")`.
- Produces: `useReducedMotion(): boolean` — `true`, если `motion==="reduced"` ИЛИ (`motion==="system"` И ОС просит reduce); `false` при `motion==="full"`. Экспорт из `@/components/appearance`.

- [ ] **Step 1: Тест хука (failing)**

Create `src/components/appearance/use-reduced-motion.test.tsx` (вкл. cleanup — у проекта `globals:false` без setupFiles, авто-cleanup НЕ зарегистрирован; и тест OS-реактивности — самая хрупкая часть хука):
```tsx
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_APPEARANCE } from "./appearance-cookie";
import { AppearanceProvider } from "./appearance-provider";
import { useReducedMotion } from "./use-reduced-motion";

vi.mock("./persist-appearance", () => ({ persistAppearance: vi.fn() }));

// Управляемый matchMedia: mutable matches + реестр change-листенеров,
// чтобы тестировать и статическое значение, и live OS-переключение.
let mqMatches = false;
let mqListeners: Array<() => void> = [];
function stubMatchMedia(matches: boolean) {
  mqMatches = matches;
  mqListeners = [];
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() { return query.includes("prefers-reduced-motion") ? mqMatches : false; },
    media: query,
    addEventListener: (_: string, cb: () => void) => { mqListeners.push(cb); },
    removeEventListener: (_: string, cb: () => void) => { mqListeners = mqListeners.filter((l) => l !== cb); },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }));
}
function fireOSChange(matches: boolean) {
  mqMatches = matches;
  mqListeners.forEach((cb) => { cb(); });
}

function Probe() {
  return <span data-testid="r">{String(useReducedMotion())}</span>;
}
function renderWith(motion: "system" | "reduced" | "full") {
  render(
    <AppearanceProvider initial={{ ...DEFAULT_APPEARANCE, motion }}>
      <Probe />
    </AppearanceProvider>,
  );
  return screen.getByTestId("r").textContent;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("useReducedMotion", () => {
  beforeEach(() => { stubMatchMedia(false); });

  it("reduced → true regardless of OS", () => {
    stubMatchMedia(false);
    expect(renderWith("reduced")).toBe("true");
  });
  it("full → false even when OS asks reduce", () => {
    stubMatchMedia(true);
    expect(renderWith("full")).toBe("false");
  });
  it("system follows OS: off", () => {
    stubMatchMedia(false);
    expect(renderWith("system")).toBe("false");
  });
  it("system follows OS: on", () => {
    stubMatchMedia(true);
    expect(renderWith("system")).toBe("true");
  });
  it("system reacts to a live OS change (subscribe → re-render)", () => {
    stubMatchMedia(false);
    renderWith("system");
    expect(screen.getByTestId("r").textContent).toBe("false");
    act(() => { fireOSChange(true); });
    expect(screen.getByTestId("r").textContent).toBe("true");
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/components/appearance/use-reduced-motion.test.tsx`
Expected: FAIL (модуль `./use-reduced-motion` не найден).

- [ ] **Step 3: Реализовать хук**

Create `src/components/appearance/use-reduced-motion.ts`:
```ts
"use client";
import { useSyncExternalStore } from "react";

import { useAppearance } from "./appearance-provider";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => { mq.removeEventListener("change", cb); };
}
function getOSReduce(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * Резолвит, нужно ли уменьшать движение (JS-сторона).
 *   reduced → true | full → false | system → следует OS prefers-reduced-motion.
 * Реактивен к смене настройки (через useAppearance) и к смене OS-настройки (matchMedia).
 *
 * ВАЖНО: это JS-ЗЕРКАЛО CSS-формулы из globals.css (reduced-motion gate).
 * При правке логики здесь — синхронно правь CSS-gate, и наоборот.
 */
export function useReducedMotion(): boolean {
  const { appearance } = useAppearance();
  const osReduce = useSyncExternalStore(subscribe, getOSReduce, () => false);
  if (appearance.motion === "reduced") return true;
  if (appearance.motion === "full") return false;
  return osReduce;
}
```

- [ ] **Step 4: Экспортировать из index**

В `src/components/appearance/index.ts` добавить строку:
```ts
export { useReducedMotion } from "./use-reduced-motion";
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/components/appearance/use-reduced-motion.test.tsx`
Expected: PASS (5 тестов, включая OS-реактивность).

- [ ] **Step 6: Commit**

```bash
git add src/components/appearance/use-reduced-motion.ts src/components/appearance/use-reduced-motion.test.tsx src/components/appearance/index.ts
git commit -m "feat(appearance): хук useReducedMotion (JS-резолюция reduce)"
```

---

## Task 5: Мост к three.js (порт + рендерер + view)

**Files:**
- Modify: `src/features/semantic-map/renderer/map-renderer.ts`
- Modify: `src/features/semantic-map/renderer/three-map-renderer.ts`
- Create: `src/features/semantic-map/renderer/three-map-renderer.test.ts`
- Modify: `src/features/semantic-map/ui/semantic-map-view.tsx`

**Interfaces:**
- Consumes: `useReducedMotion()` (Task 4); `MapRenderer` (порт).
- Produces: `MapRenderer.setReducedMotion(reduce: boolean): void`; `ThreeMapRenderer` хранит флаг и выставляет `controls.enableDamping = !reduce` (в `applyMode` и в сеттере).

- [ ] **Step 1: Тест рендерера (failing) — с ассертом enableDamping**

Create `src/features/semantic-map/renderer/three-map-renderer.test.ts`. Мокаем `OrbitControls` и `WebGLRenderer` + стабим `requestAnimationFrame`, чтобы дойти до `applyMode()` без реального GL и проверить главный инвариант `enableDamping === !reduce`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("three/addons/controls/OrbitControls.js", () => ({
  OrbitControls: class {
    enableDamping = true;
    enableRotate = true;
    mouseButtons: Record<string, unknown> = {};
    target = { set: () => {} };
    update() {}
    addEventListener() {}
    dispose() {}
  },
}));
vi.mock("three", async (importActual) => {
  const actual = await importActual<typeof import("three")>();
  class FakeWebGLRenderer {
    domElement = {} as HTMLCanvasElement;
    setClearColor() {}
    setPixelRatio() {}
    setSize() {}
    render() {}
    dispose() {}
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

import { ThreeMapRenderer } from "./three-map-renderer";

function fakeCanvas(): HTMLCanvasElement {
  return { clientWidth: 100, clientHeight: 100 } as unknown as HTMLCanvasElement;
}
type WithControls = { controls: { enableDamping: boolean } | null };

describe("ThreeMapRenderer.setReducedMotion", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("вызов до mount не бросает (controls ещё нет)", () => {
    const r = new ThreeMapRenderer();
    expect(() => { r.setReducedMotion(true); r.setReducedMotion(false); }).not.toThrow();
  });

  it("после mount applyMode выставляет controls.enableDamping = !reduce", () => {
    const r = new ThreeMapRenderer();
    r.setReducedMotion(true);   // флаг до mount → applyMode применит его
    r.mount(fakeCanvas());
    const controls = (r as unknown as WithControls).controls;
    expect(controls?.enableDamping).toBe(false);

    r.setReducedMotion(false);  // рантайм-переключение
    expect(controls?.enableDamping).toBe(true);
    r.destroy();
  });
});
```
ПРИМЕЧАНИЕ: если GL-мок-путь окажется хрупким в jsdom конкретной версии — оставить первый `it`, а инвариант `enableDamping` зафиксировать ручной верификацией (Task 7 Step 4 п.6). Но мок выше рассчитан на проход (WebGLRenderer/OrbitControls замоканы, rAF стаблен, `fitToBounds` рано выходит при `model===null`).

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/features/semantic-map/renderer/three-map-renderer.test.ts`
Expected: FAIL (метод `setReducedMotion` отсутствует — type error / not a function).

- [ ] **Step 3: Добавить метод в порт**

В `src/features/semantic-map/renderer/map-renderer.ts`, в интерфейс `MapRenderer` (перед `destroy()`):
```ts
  /** Уменьшить движение: выключает инерцию камеры (OrbitControls damping). Навигация drag/zoom не затрагивается. */
  setReducedMotion(reduce: boolean): void;
```

- [ ] **Step 4: Реализовать в ThreeMapRenderer**

В `src/features/semantic-map/renderer/three-map-renderer.ts`:

(a) Поле — после `private marker: THREE.Sprite | null = null;`:
```ts
  private reducedMotion = false;
```

(b) В `applyMode()` заменить строку `this.controls.enableDamping = true;` на:
```ts
      this.controls.enableDamping = !this.reducedMotion;
```

(c) Метод — добавить сразу после метода `setMode`:
```ts
  setReducedMotion(reduce: boolean): void {
    this.reducedMotion = reduce;
    if (this.controls) {
      this.controls.enableDamping = !reduce;
      this.dirty = true;
    }
  }
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/semantic-map/renderer/three-map-renderer.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 6: Проводка хука во view (через reduceRef)**

В `src/features/semantic-map/ui/semantic-map-view.tsx`:

(a) Импорт (рядом с другими `@/`-импортами):
```tsx
import { useReducedMotion } from "@/components/appearance";
```

(b) Внутри компонента, после `const t = useT("semanticMap");`:
```tsx
  const reduce = useReducedMotion();
  // reduceRef: актуальный reduce для lifecycle-эффекта [model] БЕЗ добавления его в
  // deps. Иначе cleanup эффекта (r.destroy()) пересоздавал бы WebGL-рендерер и сбрасывал
  // камеру на каждый тогл движения. Тот же escape-hatch, что matchedRef/modeRef.
  const reduceRef = useRef(reduce);
  // eslint-disable-next-line react-hooks/refs -- intentional: sync escape-hatch ref for lifecycle-effect
  reduceRef.current = reduce;
```

(c) В lifecycle-эффекте `[model]` после строки `r.setMode(modeRef.current);` добавить:
```tsx
    r.setReducedMotion(reduceRef.current); // применить к свежему рендереру (переживает смену data)
```
deps этого эффекта остаются `[model]` (читаем `reduceRef.current`, не реактивный `reduce` → exhaustive-deps доволен, рендерер НЕ пересоздаётся при смене motion).

(d) Отдельный эффект для рантайм-смены — добавить рядом с эффектом `[mode]`:
```tsx
  // Рантайм-смена настройки движения → применить к существующему рендереру.
  useEffect(() => {
    rendererRef.current?.setReducedMotion(reduce);
  }, [reduce]);
```

- [ ] **Step 7: Линт по затронутым файлам**

Run: `pnpm lint`
Expected: PASS. `react-hooks/exhaustive-deps` НЕ срабатывает: lifecycle-эффект читает `reduceRef.current` (с `eslint-disable react-hooks/refs`, как у matchedRef), а эффект `[reduce]` имеет корректные deps. НЕ добавлять `reduce` в deps `[model]` (это вызвало бы пересоздание рендерера).

- [ ] **Step 8: Commit**

```bash
git add src/features/semantic-map/renderer/map-renderer.ts src/features/semantic-map/renderer/three-map-renderer.ts src/features/semantic-map/renderer/three-map-renderer.test.ts src/features/semantic-map/ui/semantic-map-view.tsx
git commit -m "feat(semantic-map): reduced-motion отключает инерцию камеры (damping)"
```

---

## Task 6: UI настройки + i18n

**Files:**
- Modify: `src/app/me/settings/appearance/appearance-settings.tsx`
- Modify: `src/i18n/messages/ru/settings.ts`
- Modify: `src/i18n/messages/en/settings.ts`

**Interfaces:**
- Consumes: `appearance.motion`, `setAxis("motion", …)` (Task 1/2); ключи i18n `appearance.motion*`.
- Produces: строка «Анимация» с Select (system/reduced/full) на странице настроек.

ПРИМЕЧАНИЕ: парити ключей форсится ДВУМЯ слоями — (a) tsc через `en satisfies Messages` (`Messages = typeof ru`, source of truth = ru) и (b) runtime `messages.test.ts`. Поэтому ключи добавляем в **обе** локали ОДНИМ шагом (иначе между правками дерево tsc-красное по `en/index.ts`).

- [ ] **Step 1: Добавить ключи в RU и EN (обе локали)**

В `src/i18n/messages/ru/settings.ts`:
(a) В `appearance`, рядом с `textSizeLabel`/`textSizeAriaLabel`:
```ts
    motionLabel: "Анимация",
    motionAriaLabel: "Анимация",
```
(b) После группы `textSize: { … },`:
```ts
    motion: {
      system: "Системно",
      reduced: "Меньше движения",
      full: "Полная анимация",
    },
```

В `src/i18n/messages/en/settings.ts`:
(a) В `appearance`, рядом с `textSizeLabel`/`textSizeAriaLabel`:
```ts
    motionLabel: "Motion",
    motionAriaLabel: "Motion",
```
(b) После группы `textSize: { … },`:
```ts
    motion: {
      system: "System",
      reduced: "Reduced",
      full: "Full",
    },
```

- [ ] **Step 2: Подтвердить парити (tsc + runtime)**

Run: `pnpm exec vitest run src/i18n/messages/messages.test.ts src/i18n/messages/icu-parity.test.ts`
Expected: PASS (структурная парити ru/en соблюдена; ICU-плейсхолдеров в новых ключах нет).

- [ ] **Step 3: Добавить Select в appearance-settings**

В `src/app/me/settings/appearance/appearance-settings.tsx`:
(a) После массива `TEXT_SIZE = [...]` добавить:
```tsx
  const MOTION = [
    { value: "system", label: t("appearance.motion.system") },
    { value: "reduced", label: t("appearance.motion.reduced") },
    { value: "full", label: t("appearance.motion.full") },
  ];
```
(b) В JSX после строки `<Row label={t("appearance.textSizeLabel")}>…</Row>` добавить:
```tsx
      <Row label={t("appearance.motionLabel")}><Select aria-label={t("appearance.motionAriaLabel")} options={MOTION} value={appearance.motion} onValueChange={(v) => { setAxis("motion", v as typeof appearance.motion); }} /></Row>
```

(Подсказку-оговорку к `full` намеренно НЕ добавляем — для консистентности с осью `contrast`, у которой OS-override `auto/normal/high` тоже без hint; копирайт лейблов за пользователем.)

- [ ] **Step 4: Тайпчек/линт**

Run: `pnpm lint`
Expected: PASS (типы i18n-ключей и `appearance.motion` сходятся; `en satisfies Messages` зелёный).

- [ ] **Step 5: Commit**

```bash
git add src/app/me/settings/appearance/appearance-settings.tsx src/i18n/messages/ru/settings.ts src/i18n/messages/en/settings.ts
git commit -m "feat(settings): ось «Анимация» в настройках внешнего вида (ru/en)"
```

---

## Task 7: CSS-gate глушения движения (+ навменю)

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/app/app-header/app-header.tsx`

**Interfaces:**
- Consumes: атрибут `data-motion` на `<html>` (Task 1/2); переменная `--app-motion-duration`; marker-класс `app-nav-popup`.
- Produces: при reduced-условии — `animation: none` глобально (skeleton pulse, router-link wave), мгновенный навменю (открытие+закрытие без scale-движения, opacity-fade остаётся), замороженная стрелка fancy-link; opacity-fade диалогов/поповеров сохранён.

ПРИМЕЧАНИЕ: тестируется вручную (CSS/WebGL юнит непрактичен). Глушение skeleton `animate-pulse` достигается глобальным `animation: none !important` — `!important` перебивает Tailwind utility-слой (non-important), отдельная правка skeleton.tsx не нужна (проверяется блокирующим пунктом Step 4.1).

- [ ] **Step 1: Сделать --duration навменю управляемым + marker-класс**

В `src/components/app/app-header/app-header.tsx`:

(a) В инлайн-`style` у `NavigationMenu.Positioner` заменить строку `--duration`:
```tsx
              ["--duration" as string]: "var(--app-motion-duration, 0.35s)",
```
(`--easing` оставить как есть.)

(b) В `popupClassName` добавить стабильный marker-класс в начало строки (для точечного гашения scale на закрытии под reduce):
```tsx
const popupClassName =
  "app-nav-popup w-full rounded bg-(--color-surface) border border-(--color-border) data-[ending-style]:easing-[ease] relative h-[var(--popup-height)] origin-[var(--transform-origin)] transition-[opacity,transform,width,height,scale,translate] duration-[var(--duration)] ease-[var(--easing)] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[ending-style]:duration-150 data-[starting-style]:scale-90 data-[starting-style]:opacity-0 min-[500px]:w-[var(--popup-width)] xs:w-[var(--popup-width)]";
```

- [ ] **Step 2: Переписать блок reduced-motion в globals.css**

В `src/app/globals.css` заменить существующий блок (сейчас):
```css
@media (prefers-reduced-motion: reduce) {
  .router-link:has([data-link-pending]) {
    animation: none;
    background-image: none; /* остаётся статичный currentColor-тинт как feedback */
  }
}
```
на:
```css
/* ═══════════════════════════════════════════════════════════════
   REDUCED MOTION (ось appearance `motion`)
   JS-ЗЕРКАЛО этой формулы — src/components/appearance/use-reduced-motion.ts
   (правишь одно — синхронно правь второе).

   Активно, если пользователь выбрал "reduced" ([data-motion="reduced"]),
   ЛИБО OS просит reduce и пользователь НЕ форснул "full"
   (:root:not([data-motion="full"])).
   Нюансная политика: глушим looping/keyframe-анимации и движение
   (transform/позиция); одноразовый opacity-fade и hover-цвет — оставляем.
   `* { animation: none }` глушит skeleton `animate-pulse` и router-link wave
   (!important перебивает Tailwind utility-слой). Будущие СМЫСЛОВЫЕ анимации
   (прогресс/статус) должны иметь opacity/цвет-fallback или опрашивать
   useReducedMotion, а не полагаться на keyframes.
   `--app-motion-duration` читает только навменю (app-header) → обнуление
   делает открытие/позиционирование мгновенным; `.app-nav-popup { scale: 1 }`
   убирает scale-«схлопывание» на закрытии (opacity-fade закрытия остаётся).
   ═══════════════════════════════════════════════════════════════ */
@media (prefers-reduced-motion: reduce) {
  :root:not([data-motion="full"]) { --app-motion-duration: 0.001ms; }
  :root:not([data-motion="full"]) *,
  :root:not([data-motion="full"]) *::before,
  :root:not([data-motion="full"]) *::after {
    animation: none !important;
    scroll-behavior: auto !important; /* no-op сейчас (smooth-scroll нет) — защита на будущее */
  }
  :root:not([data-motion="full"]) .router-link:has([data-link-pending]) {
    background-image: none;
  }
  :root:not([data-motion="full"]) .app-nav-popup { scale: 1 !important; }
  :root:not([data-motion="full"]) .fancy-link::after,
  :root:not([data-motion="full"]) .fancy-link:hover::after,
  :root:not([data-motion="full"]) .fancy-link:focus::after {
    transition: none !important;
    left: calc(100% + 5px);
  }
}
[data-motion="reduced"] { --app-motion-duration: 0.001ms; }
[data-motion="reduced"] *,
[data-motion="reduced"] *::before,
[data-motion="reduced"] *::after {
  animation: none !important;
  scroll-behavior: auto !important;
}
[data-motion="reduced"] .router-link:has([data-link-pending]) {
  background-image: none;
}
[data-motion="reduced"] .app-nav-popup { scale: 1 !important; }
[data-motion="reduced"] .fancy-link::after,
[data-motion="reduced"] .fancy-link:hover::after,
[data-motion="reduced"] .fancy-link:focus::after {
  transition: none !important;
  left: calc(100% + 5px);
}
```

- [ ] **Step 3: Сборка/линт**

Run: `pnpm lint && pnpm build`
Expected: PASS (CSS валиден, app-header компилируется).

- [ ] **Step 4: Ручная верификация (dev) — расширенная матрица**

Run: `pnpm dev` (фронт на :3001 — см. local dev stack). Проверить:
1. **(блокирующий)** Настройки → «Анимация» = «Меньше движения», открыть экран со Skeleton (загрузка списка/страницы): скелетоны НЕ пульсируют. Также: шиммер навигации статичен; навменю открывается мгновенно и **закрывается без scale-«схлопывания»** (только opacity); стрелка fancy-link не уезжает; **opacity-fade диалога остаётся**.
2. **Изоляция ветки:** «Меньше движения» при ВЫКЛЮЧЕННОМ системном reduce motion → анимации всё равно заглушены (проверяет `[data-motion="reduced"]` в отрыве от media-query).
3. «Полная анимация» при ВКЛЮЧЁННОМ OS «Reduce Motion»: анимации РАБОТАЮТ; в DevTools на `<html>` стоит `data-motion="full"`.
4. «Системно»: поведение совпадает с OS-настройкой (вкл/выкл системного reduce).
5. **Анти-FOUC SSR:** с кукой `motion=reduced` сделать ЖЁСТКИЙ reload (Cmd-Shift-R) и в View-Source убедиться, что серверный HTML содержит `<html … data-motion="reduced">` (атрибут есть ДО гидрации, без вспышки анимаций).
6. **Карта смыслов:** при reduced drag/zoom работают, но без инерционного «доезжания» камеры (damping off); при «Полная анимация»/system-без-reduce — инерция есть.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/app/app-header/app-header.tsx
git commit -m "feat(appearance): CSS-gate reduced-motion (нюансное глушение + навменю)"
```

---

## Task 8: Финальная верификация

**Files:** —

- [ ] **Step 1: Полный прогон**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное; новые тесты (cookie/provider/persist/utils/use-reduced-motion/three-map-renderer/i18n) проходят.

ПРИМЕЧАНИЕ: `pnpm test` форсит coverage-thresholds (statements/branches/functions/lines). Если падёт ИМЕННО по порогам (а не по упавшему тесту) — это сигнал добавить недостающие тесты (легко мокаются: проводка во view, OS-реактивность хука уже покрыта, setReducedMotion после mount уже покрыт), а НЕ снижать пороги.

- [ ] **Step 2: Зафиксировать остаток (если есть)**

Если остались несакоммиченные правки ТОЛЬКО по этой фиче — добавить их по именам и закоммитить. НЕ использовать `git add -A`. `src/api/schema.ts` в коммиты НЕ включать.

---

## Self-Review (выполнено при написании плана + после multi-agent ревью)

**1. Покрытие спеки:**
- §2 значения `system|reduced|full`, `system`=OS, дефолт — Task 1 ✅
- §3 резолюция + CSS-gate с `full`-override — Task 7; JS-зеркало с перекрёстными комментами-якорями — Task 4 ✅
- §4 труба — Tasks 1,2,3,6 ✅
- §5 инвентарь: карта damping — Task 5; router-link/skeleton (global `animation:none`), навменю открытие+закрытие (`--app-motion-duration` + `.app-nav-popup{scale:1}`), fancy-link — Task 7; hover-цвет/opacity сохранены ✅
- §6 порт `setReducedMotion` + хук + view (через `reduceRef`) — Tasks 4,5 ✅
- §7 i18n ru/en — Task 6 ✅
- §8 `system`=OS подтверждено пользователем ✅
- §10 тесты — в каждой задаче; усилены (ассерт `enableDamping`, OS-реактивность хука, cleanup) ✅

**2. Плейсхолдеры:** нет TODO/TBD; весь код приведён дословно.

**3. Согласованность типов:** `motion: Motion` консистентно по всем файлам; `setReducedMotion(reduce: boolean)` одинаково в порту/реализации/тесте/view; `useReducedMotion(): boolean` — единая сигнатура.

**Реакция на находки ревью (учтены в плане):**
- **HIGH — exhaustive-deps / пересоздание WebGL (Task 5):** переведено на `reduceRef` по образцу `matchedRef`/`modeRef`; убран регрессивный фолбэк `[model, reduce]`.
- **HIGH — тест хука без cleanup:** добавлены `cleanup` + `afterEach` (иначе Task 4 падал бы на multiple-elements).
- **HIGH — контракт схемы в незакоммиченном дереве:** Task 0 (префлайт-гейт); схему НЕ коммитим (решение пользователя), при отсутствии — СТОП/эскалация.
- **MEDIUM — тавтологичный тест рендерера:** усилен моками OrbitControls+WebGLRenderer, ассерт `enableDamping === !reduce`.
- **MEDIUM — нет теста OS-реактивности хука:** добавлен 5-й тест (dispatch change в `act()`).
- **MEDIUM — skeleton:** механизм подтверждён (`!important` > utility-слой); блокирующий dev-чек (Step 4.1) + коммент в CSS.
- **MEDIUM — no-FOUC SSR не прогоняется:** добавлен анти-FOUC пункт ручной матрицы (Step 4.5); SSR-эмиссия покрыта транзитивно через htmlAttrs-юнит + неизменный layout.tsx.
- **LOW — закрытие навменю scale-90:** закрыто `.app-nav-popup { scale: 1 !important }` (opacity-fade остаётся; §5 выполнен полностью).
- **LOW — i18n tsc-окно:** ключи добавляются в обе локали одним шагом (Task 6 Step 1).
- **LOW — DRY-дрейф CSS↔JS:** взаимные комменты-якоря в хуке и gate.
- **LOW — матрица:** добавлены кейсы изоляции ветки `[data-motion="reduced"]` и анти-FOUC.
- **LOW — `* {animation:none}` / `scroll-behavior`:** forward-looking комменты в CSS; `scroll-behavior` помечен как защита на будущее.
- **LOW — откат/секвенс / coverage-gate:** добавлены секция «Порядок коммитов и откат» и примечание в Task 8.
- **NIT — hint у `full`:** сознательно НЕ добавлен (консистентность с осью contrast; копирайт за пользователем).
