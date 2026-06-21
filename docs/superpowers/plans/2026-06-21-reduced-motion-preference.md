# Reduced Motion (5-я ось appearance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить настройку «уменьшить движение» как пятую ось appearance (`motion: system | reduced | full`), с синком на бэкенд, no-FOUC SSR, нюансным глушением анимаций по сайту и отключением инерции камеры в карте смыслов.

**Architecture:** Расширяем существующую трубу appearance (enums → cookie/htmlAttrs → SSR → debounced PATCH → Select). `motion` моделируется 1:1 с бэком (как `theme`), `system` = следовать ОС (атрибут `data-motion` НЕ эмитится при `system`). Глушение: CSS-gate в `globals.css` (двойное условие: явный `[data-motion="reduced"]` ИЛИ `@media (prefers-reduced-motion: reduce)` при `:not([data-motion="full"])`) + JS-мост к three.js через хук `useReducedMotion` и метод порта `setReducedMotion`.

**Tech Stack:** Next.js (App Router, server components + server actions), React, TypeScript, Base UI, Tailwind v4, three.js (OrbitControls), Vitest + Testing Library, next-intl (фасад `@/i18n`), pnpm.

## Global Constraints

- **Тип работы:** foundation-update (расширение appearance-фундамента) — замороженные зоны (`src/components/appearance/*`, `src/app/globals.css`, `src/components/app/app-header/*`, `src/api/schema.ts`) трогаем намеренно и координированно. `src/api/schema.ts` уже перегенерирован пользователем — НЕ регенерировать.
- **Контракт оси:** `preference.Motion = "system" | "reduced" | "full"`. `system` = следовать ОС (DEFAULT). `reduced` = форсить уменьшение. `full` = форсить анимации даже если ОС просит reduce.
- **Маппинг:** `motion` шлётся в PATCH напрямую (как `theme`, БЕЗ omit-трюка контраста). `data-motion` эмитится на `<html>` только когда значение ≠ `system`.
- **Политика глушения — нюансная:** движение/transform/looping-анимации → off; одноразовый opacity-fade и hover-смена цвета → ok.
- **Тулчейн:** только pnpm (npm ломает тулчейн). Тест одного файла: `pnpm exec vitest run <path>`.
- **Git:** НЕ `git add -A`/`git add .` — добавлять только свои файлы по имени. НЕ делать деструктивных git-операций (stash/reset/checkout/clean). Не пушить.
- **Именование** файлов в `src/` — kebab-case. Общение и тексты UI — ru + en (обе локали в синхроне).
- **Перед завершением** зелёные: `pnpm lint && pnpm test && pnpm build`.

---

## File Structure

**Создаём:**
- `src/components/appearance/use-reduced-motion.ts` — клиентский хук JS-резолюции `reduce: boolean`.
- `src/components/appearance/use-reduced-motion.test.tsx` — тест хука.
- `src/features/semantic-map/renderer/three-map-renderer.test.ts` — тест `setReducedMotion`.

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
- `src/features/semantic-map/ui/semantic-map-view.tsx` — проводка хука в рендерер.
- `src/app/me/settings/appearance/appearance-settings.tsx` — Select оси motion.
- `src/i18n/messages/ru/settings.ts`, `src/i18n/messages/en/settings.ts` — ключи motion.
- `src/app/globals.css` — CSS-gate reduced-motion.
- `src/components/app/app-header/app-header.tsx` — `--duration` через `var(--app-motion-duration, …)`.

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

Create `src/components/appearance/use-reduced-motion.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_APPEARANCE } from "./appearance-cookie";
import { AppearanceProvider } from "./appearance-provider";
import { useReducedMotion } from "./use-reduced-motion";

vi.mock("./persist-appearance", () => ({ persistAppearance: vi.fn() }));

// matchMedia стаб: управляем "matches" для prefers-reduced-motion.
function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? matches : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }));
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

afterEach(() => { vi.unstubAllGlobals(); });

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
 * Резолвит, нужно ли уменьшать движение (JS-сторона; зеркало CSS-gate в globals.css):
 *  reduced → true | full → false | system → следует OS prefers-reduced-motion.
 * Реактивен к смене настройки (через useAppearance) и к смене OS-настройки (matchMedia).
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
Expected: PASS (4 теста).

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
- Produces: `MapRenderer.setReducedMotion(reduce: boolean): void`; `ThreeMapRenderer` хранит флаг и выставляет `controls.enableDamping = !reduce`.

- [ ] **Step 1: Тест рендерера (failing)**

Create `src/features/semantic-map/renderer/three-map-renderer.test.ts`:
```ts
import { describe, it, expect } from "vitest";

import { ThreeMapRenderer } from "./three-map-renderer";

describe("ThreeMapRenderer.setReducedMotion", () => {
  it("callable before mount without throwing (controls not yet created)", () => {
    const r = new ThreeMapRenderer();
    expect(() => { r.setReducedMotion(true); r.setReducedMotion(false); }).not.toThrow();
  });
});
```

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

(c) Метод — добавить рядом с `setMode` (например, сразу после метода `setMode`):
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
Expected: PASS.

- [ ] **Step 6: Проводка хука во view**

В `src/features/semantic-map/ui/semantic-map-view.tsx`:

(a) Импорт (рядом с другими `@/`-импортами):
```tsx
import { useReducedMotion } from "@/components/appearance";
```

(b) Внутри компонента, после `const t = useT("semanticMap");`:
```tsx
  const reduce = useReducedMotion();
```

(c) В lifecycle-эффекте `[model]` после строки `r.setMode(modeRef.current);` добавить:
```tsx
    r.setReducedMotion(reduce);
```
ВАЖНО: добавить `reduce` в массив зависимостей этого `useEffect` НЕ нужно (rerun по `[model]` достаточно для старта); рантайм-смену покрывает отдельный эффект ниже. Чтобы ESLint не ругался на отсутствие `reduce` в deps, читаем его через ref-паттерн НЕ требуется — Base UI/проект используют `eslint-disable` точечно; вместо этого используем отдельный эффект (п. d), а в lifecycle-эффекте берём актуальное значение через замыкание (оно стабильно на момент маунта). Если линтер потребует — добавить `reduce` в deps lifecycle-эффекта безопасно (рендерер пересоздаётся, повторный `setReducedMotion` идемпотентен).

(d) Отдельный эффект для рантайм-смены — добавить рядом с эффектом `[mode]`:
```tsx
  // Рантайм-смена настройки движения → применить к существующему рендереру.
  useEffect(() => {
    rendererRef.current?.setReducedMotion(reduce);
  }, [reduce]);
```

- [ ] **Step 7: Запустить линт по затронутым файлам**

Run: `pnpm lint`
Expected: PASS (без ошибок react-hooks/exhaustive-deps по новому коду). Если линтер требует `reduce` в deps lifecycle-эффекта `[model]` — изменить его массив на `[model, reduce]` и перезапустить.

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

- [ ] **Step 1: Добавить ключи в RU (одна локаль → парити-тест должен упасть)**

В `src/i18n/messages/ru/settings.ts`:

(a) В `appearance`, рядом с `textSizeLabel`/`textSizeAriaLabel` добавить:
```ts
    motionLabel: "Анимация",
    motionAriaLabel: "Анимация",
```
(b) После группы `textSize: { … },` добавить группу:
```ts
    motion: {
      system: "Системно",
      reduced: "Меньше движения",
      full: "Полная анимация",
    },
```

- [ ] **Step 2: Запустить парити-тест — убедиться, что падает**

Run: `pnpm exec vitest run src/i18n/messages/messages.test.ts`
Expected: FAIL (структурный рассинхрон ru/en — в en нет ключей `appearance.motion*`).

- [ ] **Step 3: Добавить ключи в EN**

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

- [ ] **Step 4: Запустить парити + icu-тесты — убедиться, что проходят**

Run: `pnpm exec vitest run src/i18n/messages/messages.test.ts src/i18n/messages/icu-parity.test.ts`
Expected: PASS.

- [ ] **Step 5: Добавить Select в appearance-settings**

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

- [ ] **Step 6: Тайпчек/линт**

Run: `pnpm lint`
Expected: PASS (типы i18n-ключей и `appearance.motion` сходятся).

- [ ] **Step 7: Commit**

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
- Consumes: атрибут `data-motion` на `<html>` (Task 1/2); переменная `--app-motion-duration`.
- Produces: при reduced-условии — `animation: none` глобально (skeleton pulse, router-link wave), мгновенный навменю, замороженная стрелка fancy-link; opacity-fade диалогов/поповеров сохранён.

Примечание: тестируется вручную (CSS/WebGL юнит непрактичен). Глушение skeleton (`animate-pulse`) и router-link достигается глобальным `animation: none` — отдельные правки этих компонентов не нужны.

- [ ] **Step 1: Сделать --duration навменю управляемым**

В `src/components/app/app-header/app-header.tsx`, в инлайн-`style` у `NavigationMenu.Positioner` заменить строку `--duration`:
```tsx
              ["--duration" as string]: "var(--app-motion-duration, 0.35s)",
```
(`--easing` оставить как есть.)

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
   Активно, если пользователь выбрал "reduced" ([data-motion="reduced"]),
   ЛИБО OS просит reduce и пользователь НЕ форснул "full"
   (:root:not([data-motion="full"])).
   Нюансная политика: глушим looping/keyframe-анимации и движение
   (transform/позиция); одноразовый opacity-fade и hover-цвет — оставляем.
   `--app-motion-duration` читает только навменю (app-header) →
   обнуление делает его открытие/позиционирование мгновенным.
   Известный минор: закрытие навменю сохраняет ~150ms (data-[ending-style]).
   ═══════════════════════════════════════════════════════════════ */
@media (prefers-reduced-motion: reduce) {
  :root:not([data-motion="full"]) { --app-motion-duration: 0.001ms; }
  :root:not([data-motion="full"]) *,
  :root:not([data-motion="full"]) *::before,
  :root:not([data-motion="full"]) *::after {
    animation: none !important;
    scroll-behavior: auto !important;
  }
  :root:not([data-motion="full"]) .router-link:has([data-link-pending]) {
    background-image: none;
  }
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

- [ ] **Step 4: Ручная верификация (dev)**

Run: `pnpm dev` (фронт на :3001 — см. local dev stack). Проверить матрицу:
1. Настройки → «Анимация» = «Меньше движения»: скелетоны не пульсируют; шиммер навигации статичен; навменю открывается мгновенно; стрелка fancy-link не уезжает; **opacity-fade диалога остаётся**.
2. = «Полная анимация» при включённом OS «Reduce Motion»: анимации РАБОТАЮТ (full перебивает OS).
3. = «Системно»: поведение совпадает с OS-настройкой (вкл/выкл системного reduce motion).
4. Карта смыслов при reduced: drag/zoom работают, но без инерционного «доезжания» камеры (damping off). При «Полная анимация»/system-без-reduce — инерция есть.

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

- [ ] **Step 2: Зафиксировать остаток (если есть)**

Если остались несакоммиченные правки только по этой фиче — добавить их по именам и закоммитить. НЕ использовать `git add -A`.

---

## Self-Review (выполнено при написании плана)

**1. Покрытие спеки:**
- §2 значения `system|reduced|full`, `system`=OS, дефолт — Task 1 (enums/DEFAULT) ✅
- §3 резолюция + CSS-gate с `full`-override — Task 7 (CSS) + Task 4 (JS-зеркало) ✅
- §4 труба (enums/cookie/provider/persist/utils/settings) — Tasks 1,2,3,6 ✅
- §5 инвентарь: карта damping — Task 5; router-link/skeleton (global `animation:none`), навменю (`--app-motion-duration`), fancy-link — Task 7; hover-цвет/opacity сохранены (не трогаем) ✅
- §6 порт `setReducedMotion` + хук `useReducedMotion` + view — Tasks 4,5 ✅
- §7 i18n ru/en — Task 6 ✅
- §8 `system`=OS подтверждено пользователем; копирайт лейблов задан (ru/en), пользователь правит при желании ✅
- §10 тесты — присутствуют в каждой задаче ✅

**2. Плейсхолдеры:** нет TODO/TBD; весь код приведён дословно.

**3. Согласованность типов:** `motion: Motion` (enums) консистентно в `Appearance`/`DEFAULT`/`ENUMS`/`parse`/`htmlAttrs`/`toAppearancePayload`/`fromBackend`; `setReducedMotion(reduce: boolean)` одинаково в порту, реализации, тесте и вызовах view; `useReducedMotion(): boolean` — единая сигнатура.

**Отклонение от спеки (в духе спеки):** навменю и skeleton глушатся через `globals.css` (global `animation:none` + `--app-motion-duration`) без правок `skeleton.tsx`; `app-header.tsx` правится одной строкой (инлайн `--duration` → `var(--app-motion-duration,…)`) — меньше касаний замороженных файлов, тот же результат. Известный минор: закрытие навменю сохраняет ~150ms (зафиксировано в комментарии CSS).
