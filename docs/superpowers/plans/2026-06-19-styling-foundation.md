# Styling Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заложить строгий, расширяемый фундамент стилизации: APCA-корректные design-токены с единым TS-источником истины, генерацией CSS и CI-гардом контраста; 4 настраиваемые оси внешнего вида (тема/контраст/плотность/шрифт + размер текста) с no-FOUC cookie-SSR; замена `@tailwindcss/typography` на свой flow-слой `.content`; наложение на существующий код через compat-shim.

**Architecture:** Токены описаны в типизированном TS-модуле (`src/styles/tokens/*`) — primitive (сырые OKLCH + apcach-деривация) → semantic (переключаемый ярус) → component. Скрипт `scripts/generate-tokens.mjs` эмитит `src/styles/tokens.generated.css` (`@theme inline` + слои-оверрайды по `data-*`). Тот же TS-модуль импортит vitest-гард, проверяющий APCA-Lc каждой пары fg/bg. Рантайм: cookie читается в root layout (server) → `data-*` + `color-scheme` на `<html>` до пейнта (0 FOUC, 0 hydration mismatch); `AppearanceProvider` применяет смену оптимистично (мутация атрибута = чистый var-swap), пишет cookie и синкает в бэк.

**Tech Stack:** Next.js 16.1.4 (App Router, RSC), React 19.2.3, Tailwind v4 (CSS-first, `@theme`), Base UI, Zod 4, vitest (jsdom, `globals: false`), pnpm. Новые dev-deps: `apcach`, `apca-w3`, `culori`. Шрифты через `next/font/google`.

## Global Constraints

- **Пакетный менеджер — pnpm.** Никогда не `npm install` (ломает тулчейн, даёт ложные lint/test-падения). Команды: `pnpm add -D <pkg>`, `pnpm lint`, `pnpm test`, `pnpm build`.
- **Параллельные агенты.** НЕ делать `git stash/reset/checkout ./clean`, НЕ `git add -A`/`git add .` — добавлять только свои файлы по имени. Не трогать чужие изменения.
- **Push заблокирован** в settings.local.json — только локальные коммиты.
- **vitest:** `globals: false` → импортировать `describe/it/expect/vi` из `vitest` в каждом тест-файле. Алиас `@` → `src`. `server-only` стабится автоматически; для server-модулей в тестах — `vi.mock("server-only", () => ({}))`.
- **Запретные зоны** (этот план — единственный санкционированный foundation-PR, который их трогает): `src/app/layout.tsx`, `src/app/globals.css`, `src/components/ui/*`, `package.json`, `eslint.config.mjs`, `vitest.config.ts`. `src/api/schema.ts` — НЕ регенерировать; partial-body PATCH типизировать через `as never` (как в существующем `updatePreferences`).
- **Именование файлов в `src/` — kebab-case.**
- **APCA не нормативен** — внутренняя планка качества. WCAG 2.x AA через `bridge-pca` — опционально, не в этом плане.
- **Коммит-сообщения** заканчивать строкой: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Перед завершением любой фазы зелёные: `pnpm lint && pnpm test && pnpm build`.

## File Structure

```
src/styles/tokens/
  scales.ts          # не-цветовые шкалы: type, radius, shadow, z, duration, density, fonts
  apca-targets.ts    # таблица Lc-таргетов: пары [fgToken, bgToken] → minLc; полярность по теме
  primitives.ts      # фиксированные фоны + hue/chroma констант; deriveOklch() поверх apcach
  semantic.ts        # модель semantic-токенов per (theme × contrast); density/font/text слои
  index.ts           # собранная модель TokenModel (единый импорт: генератор + тесты)
  apca.test.ts       # CI-гард: |Lc| ≥ target для каждой пары в каждой комбинации
  scales.test.ts     # юнит-тесты шкал/инвариантов
src/styles/tokens.generated.css   # GENERATED — @theme inline + слои-оверрайды (коммитим)
src/styles/content.css            # слой .content (flow), на semantic-токенах
src/styles/themes/compat.css      # ВРЕМЕННЫЙ shim: старые --color-* = алиасы новых (удаляется в Task 17)
src/app/globals.css               # MOD: импорт generated + content; px-брейкпоинты; forced-colors
scripts/generate-tokens.mjs       # генератор CSS из TS-модуля
src/utils/appearance.ts           # server: типы, дефолты, getAppearance() из cookie, сериализация
src/utils/appearance.test.ts
src/components/appearance/appearance-provider.tsx   # client: provider + useAppearance + сеттеры
src/components/appearance/appearance-provider.test.tsx
src/components/appearance/appearance-cookie.ts      # имя cookie + (де)сериализация (shared client/server)
src/components/appearance/index.ts
src/app/me/settings/appearance/appearance-settings.tsx   # секция «Внешний вид» в настройках
src/features/preferences/schemas.ts   # MOD: appearance-поля в PreferencesUpdateSchema
src/features/preferences/actions.ts   # MOD: проброс appearance в PATCH (graceful)
```

**Генерация:** `tokens.generated.css` **коммитим**; CI-шаг `pnpm generate:tokens && git diff --exit-code src/styles/tokens.generated.css` ловит дрифт. `generate:tokens` повесить на `prebuild`.

---

# ФАЗА 1 — Скелет токенов (clean-room)

Производит самодостаточный, протестированный слой токенов + APCA-гард + генерацию CSS. Ничего из существующего UI ещё не переключается на новые токены.

### Task 1: Зависимости + смоук API контраст-либ

**Files:**
- Modify: `package.json` (devDependencies)
- Create: `src/styles/tokens/apca-smoke.test.ts` (временный — удалить в конце Task 1)

**Interfaces:**
- Produces: проверенные сигнатуры `apca-w3` (`APCAcontrast`, `sRGBtoY`), `culori` (`parse`, `converter`), `apcach` (`apcach`, `apcachToCss`, `crToBg`) — на них опираются Task 4 и Task 7.

- [ ] **Step 1: Установить dev-зависимости**

Run:
```bash
pnpm add -D apcach apca-w3 culori
```
Expected: пакеты добавлены в `devDependencies`, `pnpm-lock.yaml` обновлён, exit 0.

- [ ] **Step 2: Написать смоук-тест, фиксирующий реальное API**

Create `src/styles/tokens/apca-smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { APCAcontrast, sRGBtoY } from "apca-w3";
import { parse, converter } from "culori";
import { apcach, apcachToCss, crToBg } from "apcach";

const toRgb = converter("rgb");

function oklchToRgb255(oklch: string): [number, number, number] {
  const c = toRgb(parse(oklch));
  if (!c) throw new Error(`culori failed to parse: ${oklch}`);
  const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));
  return [clamp(c.r), clamp(c.g), clamp(c.b)];
}

describe("contrast libs smoke", () => {
  it("apca-w3 reports positive Lc for dark text on light bg", () => {
    const fgY = sRGBtoY([0x1a, 0x1a, 0x1a]); // near-black
    const bgY = sRGBtoY([0xf6, 0xf2, 0xeb]); // beige
    const lc = APCAcontrast(fgY, bgY);
    expect(typeof lc).toBe("number");
    expect(lc).toBeGreaterThan(75); // dark-on-light → strong positive Lc
  });

  it("culori parses oklch and converts to rgb", () => {
    const [r, g, b] = oklchToRgb255("oklch(0.2 0 0)");
    expect(r).toBeLessThan(80);
    expect(g).toBeLessThan(80);
    expect(b).toBeLessThan(80);
  });

  it("apcach derives an oklch hitting a target Lc against a bg", () => {
    const color = apcach(crToBg("#f6f2eb", 75), 0.02, 70);
    const css = apcachToCss(color, "oklch");
    expect(css.startsWith("oklch(")).toBe(true);
    // round-trip: derived fg vs beige bg should measure ~Lc 75 (±10 tolerance)
    const fgY = sRGBtoY(oklchToRgb255(css));
    const bgY = sRGBtoY([0xf6, 0xf2, 0xeb]);
    expect(Math.abs(APCAcontrast(fgY, bgY))).toBeGreaterThanOrEqual(70);
  });
});
```

- [ ] **Step 3: Запустить смоук-тест**

Run: `pnpm test src/styles/tokens/apca-smoke.test.ts`
Expected: PASS. Если API отличается (имена экспортов/сигнатуры) — поправить импорты/вызовы под установленные версии и зафиксировать рабочий `oklchToRgb255` + `apcach`-вызов; эти формы переиспользуются в Task 4/Task 7.

- [ ] **Step 4: Удалить смоук-тест, закоммитить deps**

Run:
```bash
rm src/styles/tokens/apca-smoke.test.ts
git add package.json pnpm-lock.yaml
git commit -m "chore(styles): add apcach/apca-w3/culori for APCA token derivation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
Expected: exit 0.

---

### Task 2: Не-цветовые шкалы (`scales.ts`)

**Files:**
- Create: `src/styles/tokens/scales.ts`
- Test: `src/styles/tokens/scales.test.ts`

**Interfaces:**
- Produces:
  - `TYPE_SCALE: Record<TypeStep, { size: string; line: string }>` где `TypeStep = "2xs"|"xs"|"sm"|"base"|"lg"|"xl"|"2xl"|"3xl"|"4xl"`
  - `RADIUS: Record<"sm"|"md"|"lg"|"full", string>`
  - `SHADOW: Record<"sm"|"md"|"lg", string>`
  - `Z: Record<"base"|"dropdown"|"sticky"|"overlay"|"modal"|"toast", number>`
  - `DURATION: Record<"fast"|"base"|"slow", string>`
  - `DENSITY: Record<Density, { controlH: Record<"sm"|"md"|"lg", string>; padX: string; padY: string; stack: string }>` где `Density = "comfortable"|"compact"`
  - `FONT_STACKS: Record<FontChoice, string>` где `FontChoice = "sans"|"legible"|"serif"`, значения ссылаются на next/font CSS-переменные (`var(--font-geist-sans)` и т.д.)
  - `TEXT_SCALE: Record<TextSize, number>` где `TextSize = "sm"|"md"|"lg"|"xl"`

- [ ] **Step 1: Написать тест инвариантов шкал**

Create `src/styles/tokens/scales.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { TYPE_SCALE, DENSITY, TEXT_SCALE, FONT_STACKS, Z } from "./scales";

describe("scales", () => {
  it("type scale is monotonic in rem size", () => {
    const steps = ["2xs","xs","sm","base","lg","xl","2xl","3xl","4xl"] as const;
    const rems = steps.map((s) => parseFloat(TYPE_SCALE[s].size));
    for (let i = 1; i < rems.length; i++) expect(rems[i]).toBeGreaterThan(rems[i - 1]);
  });

  it("compact density is tighter than comfortable", () => {
    expect(parseFloat(DENSITY.compact.controlH.md))
      .toBeLessThan(parseFloat(DENSITY.comfortable.controlH.md));
  });

  it("md text scale is exactly 1 (neutral default)", () => {
    expect(TEXT_SCALE.md).toBe(1);
  });

  it("font stacks reference next/font CSS variables", () => {
    expect(FONT_STACKS.sans).toContain("--font-geist-sans");
    expect(FONT_STACKS.legible).toContain("--font-atkinson");
    expect(FONT_STACKS.serif).toContain("--font-serif");
  });

  it("z-index layers are strictly increasing toward toast", () => {
    expect(Z.toast).toBeGreaterThan(Z.modal);
    expect(Z.modal).toBeGreaterThan(Z.overlay);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test src/styles/tokens/scales.test.ts`
Expected: FAIL (`Cannot find module './scales'`).

- [ ] **Step 3: Реализовать `scales.ts`**

Create `src/styles/tokens/scales.ts`:
```ts
// Не-цветовые design-токены. Единый источник для генератора CSS и тестов.
// Все размеры в rem (масштабируются глобальной осью text-size через root font-size).

export type TypeStep =
  | "2xs" | "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

export const TYPE_SCALE: Record<TypeStep, { size: string; line: string }> = {
  "2xs": { size: "0.6875rem", line: "1rem" },
  xs:    { size: "0.75rem",   line: "1rem" },
  sm:    { size: "0.875rem",  line: "1.25rem" },
  base:  { size: "1rem",      line: "1.5rem" },
  lg:    { size: "1.125rem",  line: "1.75rem" },
  xl:    { size: "1.25rem",   line: "1.75rem" },
  "2xl": { size: "1.5rem",    line: "2rem" },
  "3xl": { size: "1.875rem",  line: "2.25rem" },
  "4xl": { size: "2.25rem",   line: "2.5rem" },
};

export const RADIUS = {
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  full: "9999px",
} as const;

export const SHADOW = {
  sm: "0 1px 2px 0 oklch(0% 0 0 / 0.05)",
  md: "0 4px 6px -1px oklch(0% 0 0 / 0.1), 0 2px 4px -2px oklch(0% 0 0 / 0.1)",
  lg: "0 10px 15px -3px oklch(0% 0 0 / 0.1), 0 4px 6px -4px oklch(0% 0 0 / 0.1)",
} as const;

export const Z = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  toast: 50,
} as const;

export const DURATION = {
  fast: "120ms",
  base: "200ms",
  slow: "320ms",
} as const;

export type Density = "comfortable" | "compact";

export const DENSITY: Record<
  Density,
  { controlH: Record<"sm" | "md" | "lg", string>; padX: string; padY: string; stack: string }
> = {
  comfortable: {
    controlH: { sm: "2rem", md: "2.5rem", lg: "3rem" },
    padX: "0.75rem",
    padY: "0.5rem",
    stack: "1rem",
  },
  compact: {
    controlH: { sm: "1.75rem", md: "2.25rem", lg: "2.75rem" },
    padX: "0.5rem",
    padY: "0.375rem",
    stack: "0.75rem",
  },
};

export type FontChoice = "sans" | "legible" | "serif";

// Значения ссылаются на CSS-переменные, которые next/font выставит на <html>.
export const FONT_STACKS: Record<FontChoice, string> = {
  sans: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  legible: "var(--font-atkinson), var(--font-geist-sans), sans-serif",
  serif: "var(--font-serif), ui-serif, Georgia, serif",
};

export type TextSize = "sm" | "md" | "lg" | "xl";

export const TEXT_SCALE: Record<TextSize, number> = {
  sm: 0.9,
  md: 1,
  lg: 1.125,
  xl: 1.25,
};
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm test src/styles/tokens/scales.test.ts`
Expected: PASS.

- [ ] **Step 5: Закоммитить**

Run:
```bash
git add src/styles/tokens/scales.ts src/styles/tokens/scales.test.ts
git commit -m "feat(styles): non-color design scales (type/radius/density/fonts)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Таблица APCA-таргетов (`apca-targets.ts`)

**Files:**
- Create: `src/styles/tokens/apca-targets.ts`
- (тест таргетов идёт вместе с гардом в Task 7)

**Interfaces:**
- Produces:
  - `ColorTokenName` — union всех semantic цвет-токенов (см. ниже). На него опираются `semantic.ts` (Task 5) и `apca.test.ts` (Task 7).
  - `CONTRAST_PAIRS: { fg: ColorTokenName; bg: ColorTokenName; minLc: number; note: string }[]`

- [ ] **Step 1: Реализовать `apca-targets.ts`**

Create `src/styles/tokens/apca-targets.ts`:
```ts
// Машиночитаемая таблица контраст-требований. Каждая пара (fg на bg) обязана
// давать |Lc| ≥ minLc (APCA Bronze Simple Mode, см. spec §3/§5). Полярность
// учитывается в гарде через |Lc| — bg/fg всегда подаются на правильные входы.

export type ColorTokenName =
  // surfaces
  | "bg" | "bg-subtle" | "bg-raised" | "bg-overlay"
  // content
  | "fg" | "fg-muted" | "fg-subtle" | "fg-on-accent"
  // lines
  | "border" | "border-strong" | "ring"
  // accent / brand
  | "accent" | "accent-hover" | "accent-fg"
  // link
  | "link" | "link-hover"
  // status
  | "danger" | "danger-bg" | "danger-fg"
  | "success" | "success-bg" | "success-fg"
  | "warning" | "warning-bg" | "warning-fg"
  | "info" | "info-bg" | "info-fg";

export const CONTRAST_PAIRS: {
  fg: ColorTokenName;
  bg: ColorTokenName;
  minLc: number;
  note: string;
}[] = [
  { fg: "fg",         bg: "bg",        minLc: 75, note: "body text on app bg (preferred 90)" },
  { fg: "fg",         bg: "bg-subtle", minLc: 75, note: "body text on subtle pane" },
  { fg: "fg",         bg: "bg-raised", minLc: 75, note: "body text on raised surface" },
  { fg: "fg-muted",   bg: "bg",        minLc: 60, note: "secondary/description text" },
  { fg: "fg-muted",   bg: "bg-subtle", minLc: 60, note: "secondary text on pane" },
  { fg: "fg-subtle",  bg: "bg",        minLc: 30, note: "placeholder/disabled (absolute min)" },
  { fg: "link",       bg: "bg",        minLc: 60, note: "link on app bg" },
  { fg: "link-hover", bg: "bg",        minLc: 60, note: "link hover" },
  { fg: "accent-fg",  bg: "accent",    minLc: 60, note: "text/icon on accent fill" },
  { fg: "fg-on-accent", bg: "accent",  minLc: 60, note: "label on accent" },
  { fg: "border",     bg: "bg",        minLc: 15, note: "discernible non-text border" },
  { fg: "border-strong", bg: "bg",     minLc: 30, note: "interactive border" },
  { fg: "ring",       bg: "bg",        minLc: 45, note: "focus ring visibility" },
  { fg: "danger",     bg: "bg",        minLc: 60, note: "danger text/icon" },
  { fg: "danger-fg",  bg: "danger-bg", minLc: 60, note: "danger text on its tint" },
  { fg: "success",    bg: "bg",        minLc: 60, note: "success text/icon" },
  { fg: "success-fg", bg: "success-bg",minLc: 60, note: "success text on tint" },
  { fg: "warning",    bg: "bg",        minLc: 60, note: "warning text/icon" },
  { fg: "warning-fg", bg: "warning-bg",minLc: 60, note: "warning text on tint" },
  { fg: "info",       bg: "bg",        minLc: 60, note: "info text/icon" },
  { fg: "info-fg",    bg: "info-bg",   minLc: 60, note: "info text on tint" },
];
```

- [ ] **Step 2: Проверить, что модуль импортируется (typecheck)**

Run: `pnpm exec tsc --noEmit`
Expected: без новых ошибок по `apca-targets.ts`.

- [ ] **Step 3: Закоммитить**

Run:
```bash
git add src/styles/tokens/apca-targets.ts
git commit -m "feat(styles): APCA target table (fg/bg pairs → minLc)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Примитивы + apcach-деривация (`primitives.ts`)

**Files:**
- Create: `src/styles/tokens/primitives.ts`
- Test: `src/styles/tokens/primitives.test.ts`

**Interfaces:**
- Consumes: `apcach`, `apcachToCss`, `crToBg`, `crToFg` (`apcach`) — формы из Task 1.
- Produces:
  - `BACKDROP: Record<Theme, { bg: string; bgSubtle: string; bgRaised: string }>` где `Theme = "light"|"dark"` — фиксированные OKLCH-фоны (тёплый бежевый / тёмный сине-графит).
  - `HUE: Record<"neutral"|"accent"|"link"|"danger"|"success"|"warning"|"info", { h: number; c: number }>`
  - `deriveOn(bgOklch: string, targetLc: number, hue: number, chroma: number, dir?: "lighter"|"darker"|"auto"): string` — возвращает oklch-строку, попадающую в targetLc против фона.

- [ ] **Step 1: Написать тест деривации**

Create `src/styles/tokens/primitives.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { APCAcontrast, sRGBtoY } from "apca-w3";
import { parse, converter } from "culori";
import { BACKDROP, HUE, deriveOn } from "./primitives";

const toRgb = converter("rgb");
function y(oklch: string): number {
  const c = toRgb(parse(oklch))!;
  const k = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));
  return sRGBtoY([k(c.r), k(c.g), k(c.b)]);
}

describe("primitives", () => {
  it("light backdrop is a warm light beige (high lightness)", () => {
    const c = toRgb(parse(BACKDROP.light.bg))!;
    expect(Math.min(c.r, c.g, c.b)).toBeGreaterThan(0.85); // very light
  });

  it("deriveOn hits the requested Lc against light bg (±12)", () => {
    const fg = deriveOn(BACKDROP.light.bg, 75, HUE.neutral.h, HUE.neutral.c, "darker");
    const lc = Math.abs(APCAcontrast(y(fg), y(BACKDROP.light.bg)));
    expect(lc).toBeGreaterThanOrEqual(70);
    expect(lc).toBeLessThanOrEqual(95);
  });

  it("deriveOn on dark bg produces lighter text (negative raw Lc)", () => {
    const fg = deriveOn(BACKDROP.dark.bg, 75, HUE.neutral.h, HUE.neutral.c, "lighter");
    const raw = APCAcontrast(y(fg), y(BACKDROP.dark.bg));
    expect(raw).toBeLessThan(0); // light-on-dark → negative
    expect(Math.abs(raw)).toBeGreaterThanOrEqual(70);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test src/styles/tokens/primitives.test.ts`
Expected: FAIL (`Cannot find module './primitives'`).

- [ ] **Step 3: Реализовать `primitives.ts`**

Create `src/styles/tokens/primitives.ts`:
```ts
import { apcach, apcachToCss, crToBg } from "apcach";

export type Theme = "light" | "dark";

// Фиксированные фоны. Тёплый бежевый сохраняем как вайб проекта (был #f6f2eb),
// тёмный — графитово-синий (был #111a20), оба в OKLCH.
export const BACKDROP: Record<Theme, { bg: string; bgSubtle: string; bgRaised: string }> = {
  light: {
    bg:       "oklch(0.96 0.012 80)",
    bgSubtle: "oklch(0.93 0.014 80)",
    bgRaised: "oklch(0.985 0.008 80)",
  },
  dark: {
    bg:       "oklch(0.21 0.018 250)",
    bgSubtle: "oklch(0.26 0.018 250)",
    bgRaised: "oklch(0.25 0.02 250)",
  },
};

// Тон/насыщенность семантических семейств (lightness вычисляется деривацией).
export const HUE = {
  neutral: { h: 80,  c: 0.012 }, // тёплый нейтральный — для текста на бежевом
  accent:  { h: 70,  c: 0.14 },  // жёлто-зелёный бренд
  link:    { h: 250, c: 0.13 },  // синий
  danger:  { h: 27,  c: 0.2 },
  success: { h: 149, c: 0.16 },
  warning: { h: 75,  c: 0.16 },
  info:    { h: 250, c: 0.12 },
} as const;

/**
 * Возвращает oklch-цвет, дающий |Lc| ≈ targetLc против фона bgOklch.
 * apcach сам учитывает полярность APCA (crToBg = «цвет НА фоне»).
 */
export function deriveOn(
  bgOklch: string,
  targetLc: number,
  hue: number,
  chroma: number,
  dir: "lighter" | "darker" | "auto" = "auto",
): string {
  const color = apcach(crToBg(bgOklch, targetLc, "apca", dir), chroma, hue);
  return apcachToCss(color, "oklch");
}
```

- [ ] **Step 4: Запустить — проверить**

Run: `pnpm test src/styles/tokens/primitives.test.ts`
Expected: PASS. Если деривация промахивается мимо допуска — подстроить `dir`/`chroma` либо backdrop lightness, пока round-trip не в допуске.

- [ ] **Step 5: Закоммитить**

Run:
```bash
git add src/styles/tokens/primitives.ts src/styles/tokens/primitives.test.ts
git commit -m "feat(styles): OKLCH primitives + apcach contrast derivation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Semantic-модель (`semantic.ts`)

**Files:**
- Create: `src/styles/tokens/semantic.ts`
- Test: `src/styles/tokens/semantic.test.ts`

**Interfaces:**
- Consumes: `BACKDROP`, `HUE`, `deriveOn` (Task 4); `ColorTokenName` (Task 3); `Theme` (Task 4).
- Produces:
  - `Contrast = "normal" | "high"`
  - `buildColorLayer(theme: Theme, contrast: Contrast): Record<ColorTokenName, string>` — полный набор semantic цвет-токенов (oklch-строки) для комбинации.
  - `COLOR_LAYERS: Record<`${Theme}-${Contrast}`, Record<ColorTokenName, string>>` — все 4 комбинации, предвычисленные.

- [ ] **Step 1: Написать тест полноты слоёв**

Create `src/styles/tokens/semantic.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { COLOR_LAYERS, buildColorLayer } from "./semantic";
import { CONTRAST_PAIRS, type ColorTokenName } from "./apca-targets";

const ALL_TOKENS: ColorTokenName[] = [
  "bg","bg-subtle","bg-raised","bg-overlay",
  "fg","fg-muted","fg-subtle","fg-on-accent",
  "border","border-strong","ring",
  "accent","accent-hover","accent-fg",
  "link","link-hover",
  "danger","danger-bg","danger-fg",
  "success","success-bg","success-fg",
  "warning","warning-bg","warning-fg",
  "info","info-bg","info-fg",
];

describe("semantic color layers", () => {
  it("defines all 4 theme×contrast combinations", () => {
    expect(Object.keys(COLOR_LAYERS).sort()).toEqual(
      ["dark-high","dark-normal","light-high","light-normal"].sort(),
    );
  });

  it("every layer defines every color token as an oklch string", () => {
    for (const layer of Object.values(COLOR_LAYERS)) {
      for (const t of ALL_TOKENS) {
        expect(layer[t], t).toMatch(/^oklch\(/);
      }
    }
  });

  it("high contrast is not identical to normal (some token differs)", () => {
    const normal = buildColorLayer("light", "normal");
    const high = buildColorLayer("light", "high");
    const differs = ALL_TOKENS.some((t) => normal[t] !== high[t]);
    expect(differs).toBe(true);
  });

  it("references no token outside ColorTokenName (pairs are covered)", () => {
    const names = new Set(ALL_TOKENS);
    for (const p of CONTRAST_PAIRS) {
      expect(names.has(p.fg)).toBe(true);
      expect(names.has(p.bg)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test src/styles/tokens/semantic.test.ts`
Expected: FAIL (`Cannot find module './semantic'`).

- [ ] **Step 3: Реализовать `semantic.ts`**

Create `src/styles/tokens/semantic.ts`:
```ts
import { BACKDROP, HUE, deriveOn, type Theme } from "./primitives";
import type { ColorTokenName } from "./apca-targets";

export type Contrast = "normal" | "high";

// Целевые Lc per токен. high поднимает планку (см. spec §10).
function targets(contrast: Contrast) {
  const boost = contrast === "high" ? 15 : 0;
  return {
    fg: 90,
    fgMuted: Math.min(75, 60 + boost),
    fgSubtle: 30 + boost,
    link: 60 + boost,
    accentFg: 60 + boost,
    border: 15 + boost,
    borderStrong: 30 + boost,
    ring: 45 + boost,
    status: 60 + boost,
    statusOnTint: 60 + boost,
  };
}

export function buildColorLayer(theme: Theme, contrast: Contrast): Record<ColorTokenName, string> {
  const bd = BACKDROP[theme];
  const t = targets(contrast);
  const dirFg = theme === "light" ? "darker" : "lighter";

  // accent — фиксированная заливка (яркий бренд), на ней текст-контраст
  const accent = deriveOn(bd.bg, 45, HUE.accent.h, HUE.accent.c, dirFg);
  const accentHover = deriveOn(bd.bg, 55, HUE.accent.h, HUE.accent.c, dirFg);

  // тинты статусов (мягкий фон) — низкий Lc к bg, текст деривируем НА тинте
  const dangerBg = deriveOn(bd.bg, 8, HUE.danger.h, HUE.danger.c * 0.3, "auto");
  const successBg = deriveOn(bd.bg, 8, HUE.success.h, HUE.success.c * 0.3, "auto");
  const warningBg = deriveOn(bd.bg, 8, HUE.warning.h, HUE.warning.c * 0.3, "auto");
  const infoBg = deriveOn(bd.bg, 8, HUE.info.h, HUE.info.c * 0.3, "auto");

  return {
    bg: bd.bg,
    "bg-subtle": bd.bgSubtle,
    "bg-raised": bd.bgRaised,
    "bg-overlay": theme === "light" ? "oklch(0.21 0.018 250 / 0.45)" : "oklch(0 0 0 / 0.6)",

    fg: deriveOn(bd.bg, t.fg, HUE.neutral.h, HUE.neutral.c, dirFg),
    "fg-muted": deriveOn(bd.bg, t.fgMuted, HUE.neutral.h, HUE.neutral.c, dirFg),
    "fg-subtle": deriveOn(bd.bg, t.fgSubtle, HUE.neutral.h, HUE.neutral.c, dirFg),
    "fg-on-accent": deriveOn(accent, t.accentFg, HUE.neutral.h, 0.0, "auto"),

    border: deriveOn(bd.bg, t.border, HUE.neutral.h, HUE.neutral.c, dirFg),
    "border-strong": deriveOn(bd.bg, t.borderStrong, HUE.neutral.h, HUE.neutral.c, dirFg),
    ring: deriveOn(bd.bg, t.ring, HUE.accent.h, HUE.accent.c, dirFg),

    accent,
    "accent-hover": accentHover,
    "accent-fg": deriveOn(accent, t.accentFg, HUE.neutral.h, 0.0, "auto"),

    link: deriveOn(bd.bg, t.link, HUE.link.h, HUE.link.c, dirFg),
    "link-hover": deriveOn(bd.bg, t.link + 10, HUE.link.h, HUE.link.c, dirFg),

    danger: deriveOn(bd.bg, t.status, HUE.danger.h, HUE.danger.c, dirFg),
    "danger-bg": dangerBg,
    "danger-fg": deriveOn(dangerBg, t.statusOnTint, HUE.danger.h, HUE.danger.c, "auto"),

    success: deriveOn(bd.bg, t.status, HUE.success.h, HUE.success.c, dirFg),
    "success-bg": successBg,
    "success-fg": deriveOn(successBg, t.statusOnTint, HUE.success.h, HUE.success.c, "auto"),

    warning: deriveOn(bd.bg, t.status, HUE.warning.h, HUE.warning.c, dirFg),
    "warning-bg": warningBg,
    "warning-fg": deriveOn(warningBg, t.statusOnTint, HUE.warning.h, HUE.warning.c, "auto"),

    info: deriveOn(bd.bg, t.status, HUE.info.h, HUE.info.c, dirFg),
    "info-bg": infoBg,
    "info-fg": deriveOn(infoBg, t.statusOnTint, HUE.info.h, HUE.info.c, "auto"),
  };
}

export const COLOR_LAYERS = {
  "light-normal": buildColorLayer("light", "normal"),
  "light-high": buildColorLayer("light", "high"),
  "dark-normal": buildColorLayer("dark", "normal"),
  "dark-high": buildColorLayer("dark", "high"),
} as const;
```

- [ ] **Step 4: Запустить — проверить**

Run: `pnpm test src/styles/tokens/semantic.test.ts`
Expected: PASS.

- [ ] **Step 5: Закоммитить**

Run:
```bash
git add src/styles/tokens/semantic.ts src/styles/tokens/semantic.test.ts
git commit -m "feat(styles): semantic color layers per theme×contrast (apcach-derived)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Сборка модели (`index.ts`)

**Files:**
- Create: `src/styles/tokens/index.ts`
- Test: `src/styles/tokens/index.test.ts`

**Interfaces:**
- Consumes: всё из Task 2–5.
- Produces: `TOKENS` — единый объект `{ colorLayers, scales: { TYPE_SCALE, RADIUS, SHADOW, Z, DURATION, DENSITY, FONT_STACKS, TEXT_SCALE } }`. На него опираются генератор (Task 8) и гард (Task 7).

- [ ] **Step 1: Написать тест сборки**

Create `src/styles/tokens/index.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { TOKENS } from "./index";

describe("TOKENS model", () => {
  it("bundles color layers and scales", () => {
    expect(TOKENS.colorLayers["light-normal"].fg).toMatch(/^oklch\(/);
    expect(TOKENS.scales.TYPE_SCALE.base.size).toBe("1rem");
    expect(TOKENS.scales.DENSITY.compact.padX).toBeDefined();
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm test src/styles/tokens/index.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать `index.ts`**

Create `src/styles/tokens/index.ts`:
```ts
import { COLOR_LAYERS } from "./semantic";
import {
  TYPE_SCALE, RADIUS, SHADOW, Z, DURATION, DENSITY, FONT_STACKS, TEXT_SCALE,
} from "./scales";

export const TOKENS = {
  colorLayers: COLOR_LAYERS,
  scales: { TYPE_SCALE, RADIUS, SHADOW, Z, DURATION, DENSITY, FONT_STACKS, TEXT_SCALE },
} as const;

export type { ColorTokenName } from "./apca-targets";
export { CONTRAST_PAIRS } from "./apca-targets";
```

- [ ] **Step 4: Запустить — проходит**

Run: `pnpm test src/styles/tokens/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Закоммитить**

```bash
git add src/styles/tokens/index.ts src/styles/tokens/index.test.ts
git commit -m "feat(styles): assemble TOKENS model (single source of truth)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: APCA CI-гард (`apca.test.ts`)

**Files:**
- Create: `src/styles/tokens/apca.test.ts`

**Interfaces:**
- Consumes: `TOKENS`, `CONTRAST_PAIRS` (Task 6); хелперы из Task 1.

- [ ] **Step 1: Написать гард + само-проверку (что ловит плохую пару)**

Create `src/styles/tokens/apca.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { APCAcontrast, sRGBtoY } from "apca-w3";
import { parse, converter } from "culori";
import { TOKENS, CONTRAST_PAIRS, type ColorTokenName } from "./index";

const toRgb = converter("rgb");
function lc(fgOklch: string, bgOklch: string): number {
  const f = toRgb(parse(fgOklch))!;
  const b = toRgb(parse(bgOklch))!;
  const k = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));
  const fgY = sRGBtoY([k(f.r), k(f.g), k(f.b)]);
  const bgY = sRGBtoY([k(b.r), k(b.g), k(b.b)]);
  return APCAcontrast(fgY, bgY);
}

const COMBOS = ["light-normal", "light-high", "dark-normal", "dark-high"] as const;

describe("APCA contrast guardrail", () => {
  for (const combo of COMBOS) {
    const layer = TOKENS.colorLayers[combo];
    for (const pair of CONTRAST_PAIRS) {
      it(`[${combo}] ${pair.fg} on ${pair.bg} ≥ Lc ${pair.minLc} (${pair.note})`, () => {
        const value = Math.abs(lc(layer[pair.fg], layer[pair.bg]));
        expect(value).toBeGreaterThanOrEqual(pair.minLc);
      });
    }
  }

  it("self-check: guardrail rejects a deliberately low-contrast pair", () => {
    const bg = TOKENS.colorLayers["light-normal"].bg;
    // bg-on-bg → Lc ≈ 0, must fail the body-text bar
    expect(Math.abs(lc(bg, bg))).toBeLessThan(75);
  });
});
```

- [ ] **Step 2: Запустить гард**

Run: `pnpm test src/styles/tokens/apca.test.ts`
Expected: PASS. **Если какая-то пара не дотягивает** — это сигнал, что деривация в `semantic.ts` (Task 5) промахнулась: подстроить целевой Lc/`dir`/`chroma` для соответствующего токена и перезапустить, пока все пары не зелёные. Не ослаблять `minLc` в `apca-targets.ts` ради прохождения — гард должен отражать реальную планку.

- [ ] **Step 3: Закоммитить**

```bash
git add src/styles/tokens/apca.test.ts
git commit -m "test(styles): APCA Lc guardrail over all token pairs × combos

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Генератор CSS (`generate-tokens.mjs`)

**Files:**
- Create: `scripts/generate-tokens.mjs`
- Create: `src/styles/tokens.generated.css` (output, коммитим)
- Modify: `package.json` (scripts: `generate:tokens`, `prebuild`)
- Test: `scripts/generate-tokens.test.ts`

**Interfaces:**
- Consumes: `TOKENS` (Task 6) — генератор импортит TS через `tsx`/прямой `import` из ESM. Поскольку `scripts/generate-sw-assets.mjs` уже использует `typescript` для транспиляции, здесь применяем тот же подход: транспилируем нужные TS-модули в память и исполняем, ЛИБО проще — переиспользуем `tsx` через `pnpm exec tsx`. Выбираем `tsx` (нулевой ручной транспайл).
- Produces: `src/styles/tokens.generated.css` со структурой: `@theme inline { … }`, `:root { … }` (light-normal + scales), `@media (prefers-color-scheme: dark) { :root { … } }`, `[data-theme="dark"]`, `[data-theme="light"]`, `[data-contrast="high"]` + `@media (prefers-contrast: more)`, `[data-theme="dark"][data-contrast="high"]`, `[data-density="compact"]`, `[data-font="legible"|"serif"]`.

- [ ] **Step 1: Добавить `tsx` и npm-скрипты**

Run: `pnpm add -D tsx`

Modify `package.json` scripts — добавить:
```json
"generate:tokens": "tsx scripts/generate-tokens.mjs",
"prebuild": "pnpm generate:tokens"
```
(Не удалять существующий `build`-скрипт с `generate-sw-assets.mjs`.)

- [ ] **Step 2: Реализовать генератор**

Create `scripts/generate-tokens.mjs`:
```js
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOKENS } from "../src/styles/tokens/index.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { colorLayers, scales } = TOKENS;

const colorVars = (layer) =>
  Object.entries(layer).map(([k, v]) => `  --${k}: ${v};`).join("\n");

const scaleVars = () => {
  const lines = [];
  for (const [step, { size, line }] of Object.entries(scales.TYPE_SCALE)) {
    lines.push(`  --text-${step}: ${size};`);
    lines.push(`  --text-${step}--line-height: ${line};`);
  }
  for (const [k, v] of Object.entries(scales.RADIUS)) lines.push(`  --radius-${k}: ${v};`);
  for (const [k, v] of Object.entries(scales.SHADOW)) lines.push(`  --shadow-${k}: ${v};`);
  for (const [k, v] of Object.entries(scales.DURATION)) lines.push(`  --duration-${k}: ${v};`);
  for (const [k, v] of Object.entries(scales.Z)) lines.push(`  --z-${k}: ${v};`);
  // density default = comfortable
  const d = scales.DENSITY.comfortable;
  lines.push(`  --size-control-h-sm: ${d.controlH.sm};`);
  lines.push(`  --size-control-h-md: ${d.controlH.md};`);
  lines.push(`  --size-control-h-lg: ${d.controlH.lg};`);
  lines.push(`  --space-control-pad-x: ${d.padX};`);
  lines.push(`  --space-control-pad-y: ${d.padY};`);
  lines.push(`  --space-stack: ${d.stack};`);
  // font default = sans
  lines.push(`  --app-font: ${scales.FONT_STACKS.sans};`);
  return lines.join("\n");
};

const densityLayer = (name) => {
  const d = scales.DENSITY[name];
  return `[data-density="${name}"] {
  --size-control-h-sm: ${d.controlH.sm};
  --size-control-h-md: ${d.controlH.md};
  --size-control-h-lg: ${d.controlH.lg};
  --space-control-pad-x: ${d.padX};
  --space-control-pad-y: ${d.padY};
  --space-stack: ${d.stack};
}`;
};

// @theme inline маппит Tailwind-токены на рантайм-переменные (utility ссылается на var()).
const themeInline = () => {
  const colorNames = Object.keys(colorLayers["light-normal"]);
  const colorMap = colorNames.map((n) => `  --color-${n}: var(--${n});`).join("\n");
  return `@theme inline {
${colorMap}
  --font-ui: var(--app-font);
}`;
};

const css = `/* AUTO-GENERATED by scripts/generate-tokens.mjs — DO NOT EDIT BY HAND.
   Source of truth: src/styles/tokens/*. Run \`pnpm generate:tokens\`. */

${themeInline()}

:root {
${colorVars(colorLayers["light-normal"])}
${scaleVars()}
}

@media (prefers-color-scheme: dark) {
  :root {
${colorVars(colorLayers["dark-normal"]).split("\n").map((l) => "  " + l).join("\n")}
  }
}

[data-theme="dark"] {
${colorVars(colorLayers["dark-normal"])}
}

[data-theme="light"] {
${colorVars(colorLayers["light-normal"])}
}

[data-contrast="high"],
@media (prefers-contrast: more) {
  :root {
${colorVars(colorLayers["light-high"]).split("\n").map((l) => "  " + l).join("\n")}
  }
}

[data-theme="dark"][data-contrast="high"] {
${colorVars(colorLayers["dark-high"])}
}

${densityLayer("compact")}

[data-font="legible"] { --app-font: ${scales.FONT_STACKS.legible}; }
[data-font="serif"]   { --app-font: ${scales.FONT_STACKS.serif}; }
`;

writeFileSync(resolve(root, "src/styles/tokens.generated.css"), css);
console.log("[generate-tokens] wrote src/styles/tokens.generated.css");
```

- [ ] **Step 3: Сгенерировать CSS**

Run: `pnpm generate:tokens`
Expected: `[generate-tokens] wrote …`; файл `src/styles/tokens.generated.css` создан, содержит `@theme inline`, `:root`, слои `[data-theme]`/`[data-contrast]`/`[data-density]`/`[data-font]`.

- [ ] **Step 4: Тест актуальности (freshness)**

Create `scripts/generate-tokens.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("tokens.generated.css", () => {
  it("contains the runtime override layers", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/styles/tokens.generated.css"),
      "utf-8",
    );
    expect(css).toContain("@theme inline");
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('[data-contrast="high"]');
    expect(css).toContain('[data-density="compact"]');
    expect(css).toContain('[data-font="serif"]');
    expect(css).toContain("--color-fg: var(--fg)");
  });
});
```

Run: `pnpm test scripts/generate-tokens.test.ts`
Expected: PASS.

- [ ] **Step 5: Закоммитить (вкл. сгенерированный CSS)**

```bash
git add scripts/generate-tokens.mjs scripts/generate-tokens.test.ts src/styles/tokens.generated.css package.json pnpm-lock.yaml
git commit -m "feat(styles): token CSS generator + generated tokens (committed)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Фаза-гейт**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное (build вызовет `prebuild` → `generate:tokens`; `git status` должен показать `tokens.generated.css` без изменений).

---

# ФАЗА 2 — Рантайм темизации (no-FOUC, 4 оси)

После фазы все оси переключаются end-to-end; настройки ещё не вынесены в UI (Фаза 4), но провайдер и cookie работают.

### Task 9: Модель appearance + чтение cookie (`appearance.ts`)

**Files:**
- Create: `src/components/appearance/appearance-cookie.ts` (shared, без `server-only`)
- Create: `src/utils/appearance.ts` (server: `getAppearance`)
- Test: `src/components/appearance/appearance-cookie.test.ts`
- Test: `src/utils/appearance.test.ts`

**Interfaces:**
- Produces:
  - `Appearance = { theme: "light"|"dark"|"system"; contrast: "normal"|"high"; density: "comfortable"|"compact"; font: "sans"|"legible"|"serif"; textSize: "sm"|"md"|"lg"|"xl" }`
  - `DEFAULT_APPEARANCE: Appearance`
  - `APPEARANCE_COOKIE = "appearance"`
  - `parseAppearance(raw: string | undefined): Appearance` (валидирует, неизвестное → дефолт)
  - `serializeAppearance(a: Appearance): string`
  - `getAppearance(): Promise<Appearance>` (server, читает cookie через `next/headers`)
  - `htmlAttrs(a: Appearance): { "data-theme"?: string; "data-contrast"?: string; "data-density"?: string; "data-font"?: string; style: Record<string,string>; colorScheme: string }`

- [ ] **Step 1: Тест cookie-модуля**

Create `src/components/appearance/appearance-cookie.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  DEFAULT_APPEARANCE, parseAppearance, serializeAppearance, htmlAttrs,
} from "./appearance-cookie";

describe("appearance-cookie", () => {
  it("returns defaults for undefined/garbage", () => {
    expect(parseAppearance(undefined)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance("not-json")).toEqual(DEFAULT_APPEARANCE);
  });

  it("round-trips a valid appearance", () => {
    const a = { theme: "dark", contrast: "high", density: "compact", font: "serif", textSize: "lg" } as const;
    expect(parseAppearance(serializeAppearance(a))).toEqual(a);
  });

  it("coerces unknown enum values to defaults per field", () => {
    const a = parseAppearance(JSON.stringify({ theme: "neon", textSize: "huge" }));
    expect(a.theme).toBe("system");
    expect(a.textSize).toBe("md");
  });

  it("htmlAttrs omits data-theme for system, sets color-scheme", () => {
    const sys = htmlAttrs({ ...DEFAULT_APPEARANCE, theme: "system" });
    expect(sys["data-theme"]).toBeUndefined();
    expect(sys.colorScheme).toBe("light dark");

    const dark = htmlAttrs({ ...DEFAULT_APPEARANCE, theme: "dark" });
    expect(dark["data-theme"]).toBe("dark");
    expect(dark.colorScheme).toBe("dark");
  });

  it("htmlAttrs sets --text-scale style from textSize", () => {
    const a = htmlAttrs({ ...DEFAULT_APPEARANCE, textSize: "xl" });
    expect(a.style["--text-scale"]).toBe("1.25");
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm test src/components/appearance/appearance-cookie.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать `appearance-cookie.ts`**

Create `src/components/appearance/appearance-cookie.ts`:
```ts
import { TEXT_SCALE } from "@/styles/tokens/scales";

export type Appearance = {
  theme: "light" | "dark" | "system";
  contrast: "normal" | "high";
  density: "comfortable" | "compact";
  font: "sans" | "legible" | "serif";
  textSize: "sm" | "md" | "lg" | "xl";
};

export const APPEARANCE_COOKIE = "appearance";

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "system",
  contrast: "normal",
  density: "comfortable",
  font: "sans",
  textSize: "md",
};

const ENUMS = {
  theme: ["light", "dark", "system"],
  contrast: ["normal", "high"],
  density: ["comfortable", "compact"],
  font: ["sans", "legible", "serif"],
  textSize: ["sm", "md", "lg", "xl"],
} as const;

function pick<K extends keyof Appearance>(key: K, value: unknown): Appearance[K] {
  return (ENUMS[key] as readonly string[]).includes(value as string)
    ? (value as Appearance[K])
    : DEFAULT_APPEARANCE[key];
}

export function parseAppearance(raw: string | undefined): Appearance {
  if (!raw) return DEFAULT_APPEARANCE;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return DEFAULT_APPEARANCE;
  }
  return {
    theme: pick("theme", obj.theme),
    contrast: pick("contrast", obj.contrast),
    density: pick("density", obj.density),
    font: pick("font", obj.font),
    textSize: pick("textSize", obj.textSize),
  };
}

export function serializeAppearance(a: Appearance): string {
  return JSON.stringify(a);
}

export function htmlAttrs(a: Appearance) {
  const colorScheme = a.theme === "system" ? "light dark" : a.theme;
  return {
    ...(a.theme !== "system" ? { "data-theme": a.theme } : {}),
    ...(a.contrast !== "normal" ? { "data-contrast": a.contrast } : {}),
    ...(a.density !== "comfortable" ? { "data-density": a.density } : {}),
    ...(a.font !== "sans" ? { "data-font": a.font } : {}),
    style: { "--text-scale": String(TEXT_SCALE[a.textSize]) } as Record<string, string>,
    colorScheme,
  };
}
```

- [ ] **Step 4: Запустить — проходит**

Run: `pnpm test src/components/appearance/appearance-cookie.test.ts`
Expected: PASS.

- [ ] **Step 5: Тест серверного `getAppearance`**

Create `src/utils/appearance.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: () => Promise.resolve(cookieStore) }));

import { getAppearance } from "./appearance";
import { DEFAULT_APPEARANCE } from "@/components/appearance/appearance-cookie";

describe("getAppearance", () => {
  beforeEach(() => cookieStore.get.mockReset());

  it("returns defaults when cookie absent", async () => {
    cookieStore.get.mockReturnValue(undefined);
    expect(await getAppearance()).toEqual(DEFAULT_APPEARANCE);
  });

  it("parses cookie value", async () => {
    cookieStore.get.mockReturnValue({
      value: JSON.stringify({ ...DEFAULT_APPEARANCE, theme: "dark" }),
    });
    expect((await getAppearance()).theme).toBe("dark");
  });
});
```

- [ ] **Step 6: Реализовать `src/utils/appearance.ts`**

Create `src/utils/appearance.ts`:
```ts
import "server-only";
import { cookies } from "next/headers";
import {
  APPEARANCE_COOKIE, parseAppearance, type Appearance,
} from "@/components/appearance/appearance-cookie";

export async function getAppearance(): Promise<Appearance> {
  const store = await cookies();
  return parseAppearance(store.get(APPEARANCE_COOKIE)?.value);
}
```

- [ ] **Step 7: Запустить — проходит**

Run: `pnpm test src/utils/appearance.test.ts src/components/appearance/appearance-cookie.test.ts`
Expected: PASS.

- [ ] **Step 8: Закоммитить**

```bash
git add src/components/appearance/appearance-cookie.ts src/components/appearance/appearance-cookie.test.ts src/utils/appearance.ts src/utils/appearance.test.ts
git commit -m "feat(appearance): cookie model + server getAppearance() (no-FOUC source)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Подключить generated CSS в globals + px-брейкпоинты

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `src/styles/tokens.generated.css` (Task 8). Старый `rebus.css` пока НЕ удаляем (compat-shim в Task 14 заменит его).

- [ ] **Step 1: Обновить `globals.css`**

Replace `src/app/globals.css` content (сохранив существующие global rules — scroll-margin, fancy-link, router-link-wave, sensitive-image, forced-colors) на:
```css
@import "tailwindcss";

@import "../styles/tokens.generated.css";
@import "../styles/content.css";

/* Глобальная ось «размер текста»: масштабирует все rem (вкл. type-утилиты).
   100% уважает системный размер браузера. */
html {
  font-size: calc(100% * var(--text-scale, 1));
}

/* px-брейкпоинты (стабильный лейаут при масштабировании текста). */
@theme {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
  --spacing-header: 50px;
}

:root {
  color-scheme: light dark;
  --header-height: var(--spacing-header);
}

@media (forced-colors: active) {
  :root {
    --color-accent: AccentColor;
    --color-bg: Canvas;
    --color-fg: CanvasText;
    --color-border: ButtonBorder;
    --color-link: LinkText;
    --color-fg-muted: GrayText;
  }
  *::target-text { background-color: Highlight; color: HighlightText; }
}

/* ── существующие глобальные правила (перенести без изменений) ── */
* {
  scroll-margin-top: var(--spacing-header);
  scrollbar-color: var(--color-border) transparent;
  &::target-text { background-color: var(--color-accent); color: #fff; }
}
body:has(dialog[open]) { overflow: hidden; }
/* … .fancy-link, @keyframes router-link-wave, .router-link, prefers-reduced-motion,
   .sensitive-image — перенести из текущего globals.css дословно … */
```

Примечание: `@import "../styles/content.css"` создаём в Task 15; до тех пор закомментировать строку или создать пустой файл `src/styles/content.css` сейчас, чтобы сборка не падала. Создать пустой:
```bash
printf '/* .content layer — populated in Task 15 */\n' > src/styles/content.css
```

- [ ] **Step 2: Проверить сборку**

Run: `pnpm build`
Expected: успех. (Старый `rebus.css` всё ещё импортируется? — нет, мы его убрали из globals; компоненты на старых `--color-background` сломаются визуально, но СБОРКА проходит. Визуальную совместимость даёт Task 14 compat-shim — выполнить его сразу после, не оставляя ветку в полу-рабочем виде надолго.)

- [ ] **Step 3: Закоммитить**

```bash
git add src/app/globals.css src/styles/content.css
git commit -m "feat(styles): wire generated tokens into globals; px breakpoints; text-scale root

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Шрифты + применение appearance на `<html>` (root layout)

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `getAppearance` (Task 9), `htmlAttrs` (Task 9), next/font.

- [ ] **Step 1: Подключить шрифты и применить атрибуты**

Modify `src/app/layout.tsx`:
- Добавить импорты шрифтов:
```ts
import { Geist, Geist_Mono, Atkinson_Hyperlegible, Source_Serif_4 } from "next/font/google";
import { getAppearance } from "@/utils/appearance";
import { htmlAttrs } from "@/components/appearance/appearance-cookie";
```
- Объявить новые шрифты рядом с существующими:
```ts
const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  weight: ["400", "700"],
  subsets: ["latin", "cyrillic"],
});
const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin", "cyrillic"],
});
```
- В теле `RootLayout` получить appearance:
```ts
const appearance = await getAppearance();
const { style, colorScheme, ...dataAttrs } = htmlAttrs(appearance);
```
- На `<html>` навесить атрибуты и стиль:
```tsx
<html lang="ru" {...dataAttrs} style={{ ...style, colorScheme }}>
```
- В `className` body добавить все font-переменные: `${geistSans.variable} ${geistMono.variable} ${atkinson.variable} ${sourceSerif.variable}`; заменить жёсткий `font-[family-name:var(--font-geist-sans)]` на использование `--font-ui`: добавить класс `font-(family-name:--font-ui)` (Tailwind v4 arbitrary) или inline-стиль `style={{ fontFamily: "var(--font-ui)" }}` на body.
- `bg-(--color-background)` → `bg-(--color-bg)` НЕ менять здесь (compat-shim в Task 14 оставит `--color-background` рабочим; смену имён делаем в Task 16). Оставить как есть до Task 16.

- [ ] **Step 2: Проверить SSR-применение**

Run: `pnpm build && pnpm test`
Expected: сборка успешна. (Ручная проверка no-FOUC — после Task 12/dev-запуска.)

- [ ] **Step 3: Закоммитить**

```bash
git add src/app/layout.tsx
git commit -m "feat(appearance): load fonts + apply SSR data-attrs/color-scheme on <html>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: AppearanceProvider + сеттеры (client)

**Files:**
- Create: `src/components/appearance/appearance-provider.tsx`
- Create: `src/components/appearance/index.ts`
- Test: `src/components/appearance/appearance-provider.test.tsx`

**Interfaces:**
- Consumes: `Appearance`, `htmlAttrs`, `serializeAppearance`, `APPEARANCE_COOKIE` (Task 9).
- Produces:
  - `<AppearanceProvider initial={Appearance}>` — кладёт значение в контекст.
  - `useAppearance(): { appearance: Appearance; setAxis: <K extends keyof Appearance>(k: K, v: Appearance[K]) => void }`
  - `setAxis` ОПТИМИСТИЧЕН: мутирует `document.documentElement` атрибуты/стиль (мгновенный ре-тем), пишет cookie, вызывает `persistAppearance` server action (Task 13). Серверный sync не блокирует UI.

- [ ] **Step 1: Тест провайдера (оптимистичная мутация DOM + cookie)**

Create `src/components/appearance/appearance-provider.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppearanceProvider, useAppearance } from "./appearance-provider";
import { DEFAULT_APPEARANCE } from "./appearance-cookie";

vi.mock("./persist-appearance", () => ({ persistAppearance: vi.fn() }));

function Probe() {
  const { appearance, setAxis } = useAppearance();
  return (
    <>
      <span data-testid="theme">{appearance.theme}</span>
      <button onClick={() => setAxis("theme", "dark")}>dark</button>
      <button onClick={() => setAxis("density", "compact")}>compact</button>
    </>
  );
}

describe("AppearanceProvider", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-density");
    document.cookie = "";
  });

  it("exposes initial appearance", () => {
    render(<AppearanceProvider initial={DEFAULT_APPEARANCE}><Probe /></AppearanceProvider>);
    expect(screen.getByTestId("theme").textContent).toBe("system");
  });

  it("setAxis mutates <html> immediately and updates state", () => {
    render(<AppearanceProvider initial={DEFAULT_APPEARANCE}><Probe /></AppearanceProvider>);
    fireEvent.click(screen.getByText("dark"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByTestId("theme").textContent).toBe("dark");
  });

  it("setAxis writes the appearance cookie", () => {
    render(<AppearanceProvider initial={DEFAULT_APPEARANCE}><Probe /></AppearanceProvider>);
    fireEvent.click(screen.getByText("compact"));
    expect(document.cookie).toContain("appearance=");
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm test src/components/appearance/appearance-provider.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Реализовать провайдер**

Create `src/components/appearance/appearance-provider.tsx`:
```tsx
"use client";
import { createContext, useCallback, useContext, useState } from "react";
import {
  type Appearance, APPEARANCE_COOKIE, htmlAttrs, serializeAppearance,
} from "./appearance-cookie";
import { persistAppearance } from "./persist-appearance";

type Ctx = {
  appearance: Appearance;
  setAxis: <K extends keyof Appearance>(k: K, v: Appearance[K]) => void;
};
const AppearanceContext = createContext<Ctx | null>(null);

function applyToHtml(a: Appearance) {
  const el = document.documentElement;
  const { style, colorScheme, ...data } = htmlAttrs(a);
  for (const key of ["data-theme", "data-contrast", "data-density", "data-font"] as const) {
    const v = (data as Record<string, string>)[key];
    if (v) el.setAttribute(key, v);
    else el.removeAttribute(key);
  }
  el.style.setProperty("--text-scale", style["--text-scale"]);
  el.style.colorScheme = colorScheme;
}

export function AppearanceProvider({
  initial, children,
}: { initial: Appearance; children: React.ReactNode }) {
  const [appearance, setAppearance] = useState(initial);

  const setAxis = useCallback<Ctx["setAxis"]>((k, v) => {
    setAppearance((prev) => {
      const next = { ...prev, [k]: v };
      applyToHtml(next);
      // cookie — 1 год, root path
      document.cookie =
        `${APPEARANCE_COOKIE}=${encodeURIComponent(serializeAppearance(next))}; path=/; max-age=31536000; samesite=lax`;
      void persistAppearance(next); // fire-and-forget бэк-синк
      return next;
    });
  }, []);

  return (
    <AppearanceContext.Provider value={{ appearance, setAxis }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): Ctx {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
```

Create `src/components/appearance/index.ts`:
```ts
export { AppearanceProvider, useAppearance } from "./appearance-provider";
export type { Appearance } from "./appearance-cookie";
```

- [ ] **Step 4: Запустить — проходит** (persist замокан)

Run: `pnpm test src/components/appearance/appearance-provider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Подключить провайдер в layout**

Modify `src/app/layout.tsx`: обернуть содержимое `<body>` в `<AppearanceProvider initial={appearance}>…</AppearanceProvider>` (внутри/снаружи ToastProvider — снаружи, чтобы тосты тоже жили в контексте). Импорт: `import { AppearanceProvider } from "@/components/appearance";`.

- [ ] **Step 6: Закоммитить**

```bash
git add src/components/appearance/appearance-provider.tsx src/components/appearance/appearance-provider.test.tsx src/components/appearance/index.ts src/app/layout.tsx
git commit -m "feat(appearance): client provider with optimistic html mutation + cookie write

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Бэк-синк (write-through) + reconcile-on-load

**Files:**
- Create: `src/components/appearance/persist-appearance.ts` (server action)
- Test: `src/components/appearance/persist-appearance.test.ts`

**Interfaces:**
- Consumes: `Appearance` (Task 9). Бэк-поля appearance в `preference.Preferences` ЕЩЁ НЕ существуют → действие пишет cookie-валидный JSON и пытается PATCH-нуть `/api/me/preferences` с appearance-полями как `as never` (graceful: при 4xx/отсутствии полей просто логируем и не падаем — cookie уже применён клиентом).

- [ ] **Step 1: Тест graceful-поведения**

Create `src/components/appearance/persist-appearance.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));

const patch = vi.fn();
vi.mock("@/api/client", () => ({ createApiClient: () => Promise.resolve({ PATCH: patch }) }));
vi.mock("@/utils/me", () => ({ getMe: () => Promise.resolve({ id: "u1", status: "active", capabilities: [] }) }));

import { persistAppearance } from "./persist-appearance";
import { DEFAULT_APPEARANCE } from "./appearance-cookie";

describe("persistAppearance", () => {
  beforeEach(() => patch.mockReset());

  it("does not throw when backend lacks appearance fields (4xx)", async () => {
    patch.mockResolvedValue({ data: null, error: { code: "BAD_REQUEST" } });
    await expect(persistAppearance(DEFAULT_APPEARANCE)).resolves.toBeUndefined();
  });

  it("no-ops for anonymous users", async () => {
    const me = await import("@/utils/me");
    vi.spyOn(me, "getMe").mockResolvedValueOnce(null);
    await expect(persistAppearance(DEFAULT_APPEARANCE)).resolves.toBeUndefined();
    expect(patch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm test src/components/appearance/persist-appearance.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать server action**

Create `src/components/appearance/persist-appearance.ts`:
```ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { getMe } from "@/utils/me";
import type { Appearance } from "./appearance-cookie";

/**
 * Write-through настроек в бэк. Бэк-поля appearance ещё не в контракте —
 * пробуем PATCH, любые ошибки глотаем (cookie уже применён на клиенте).
 * Когда бэк добавит поля и schema.ts регенерится — убрать `as never` и обработку.
 */
export async function persistAppearance(appearance: Appearance): Promise<void> {
  const me = await getMe();
  if (!me) return; // аноним — только cookie
  try {
    const api = await createApiClient();
    await api.PATCH("/api/me/preferences", {
      body: { appearance } as never,
    });
  } catch {
    // graceful: бэк может ещё не знать про appearance
  }
}
```

- [ ] **Step 4: Запустить — проходит**

Run: `pnpm test src/components/appearance/persist-appearance.test.ts`
Expected: PASS.

- [ ] **Step 5: Reconcile-on-load (документировать, реализовать когда бэк готов)**

Добавить в `src/utils/appearance.ts` комментарий-якорь о политике конфликтов (бэк авторитетен на свежей сессии, cookie — кеш) и оставить `getAppearance` cookie-only до появления бэк-полей. Когда бэк готов — `getAppearance` будет: прочитать cookie (быстрый SSR) и, если `me.preferences.appearance` задан и отличается, вернуть бэк-значение + перезаписать cookie. Это отдельная под-задача Фазы 4.

- [ ] **Step 6: Закоммитить + фаза-гейт**

```bash
git add src/components/appearance/persist-appearance.ts src/components/appearance/persist-appearance.test.ts src/utils/appearance.ts
git commit -m "feat(appearance): graceful backend write-through (cookie-authoritative until API)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
pnpm lint && pnpm test && pnpm build
```
Expected: всё зелёное. Опционально: `pnpm dev` и вручную проверить мгновенное переключение через DOM-атрибуты (DevTools → `<html data-theme="dark">`).

---

# ФАЗА 3 — Наложение на существующий код

### Task 14: Compat-shim (старые `--color-*` → новые токены)

**Files:**
- Create: `src/styles/themes/compat.css`
- Modify: `src/app/globals.css` (импорт compat)
- Delete: импорт `rebus.css` уже убран в Task 10; сам файл удалим в Task 17.

**Interfaces:**
- Старые имена (`--color-background`, `--color-foreground`, `--color-border`, `--color-link`, `--color-description`, `--color-text-pane`, `--color-primary`, `--color-danger*`, `--color-success`) делаем алиасами новых semantic-токенов, чтобы существующие компоненты работали без правок.

- [ ] **Step 1: Создать compat-shim**

Create `src/styles/themes/compat.css`:
```css
/* ВРЕМЕННЫЙ shim миграции. Старые имена токенов = алиасы новых semantic.
   Удаляется в Task 17 после миграции компонентов. */
:root {
  --color-background: var(--color-bg);
  --color-foreground: var(--color-fg);
  --color-border: var(--color-border); /* имя совпало — резолвится в новый */
  --color-link: var(--color-link);
  --color-description: var(--color-fg-muted);
  --color-text-pane: var(--color-bg-subtle);
  --color-primary: var(--color-accent);
  --color-danger: var(--color-danger);
  --color-danger-bg: var(--color-danger-bg);
  --color-danger-fill: var(--color-danger);
  --color-danger-fill-hover: var(--color-danger);
  --color-success: var(--color-success);
}
```
Примечание: `--color-border`, `--color-link`, `--color-danger*`, `--color-success` совпадают по имени с новыми semantic-токенами (`@theme inline` уже эмитит `--color-border` и т.д.), поэтому отдельный алиас им не нужен — оставить в shim только реально переименованные (`--color-background`→`bg`, `--color-foreground`→`fg`, `--color-description`→`fg-muted`, `--color-text-pane`→`bg-subtle`, `--color-primary`→`accent`, `--color-danger-fill*`→`danger`). Убрать строки-тавтологии.

Финальный compat.css:
```css
:root {
  --color-background: var(--color-bg);
  --color-foreground: var(--color-fg);
  --color-description: var(--color-fg-muted);
  --color-text-pane: var(--color-bg-subtle);
  --color-primary: var(--color-accent);
  --color-danger-fill: var(--color-danger);
  --color-danger-fill-hover: var(--color-danger);
}
```

- [ ] **Step 2: Импортировать compat в globals**

Modify `src/app/globals.css`: после `@import "../styles/tokens.generated.css";` добавить `@import "../styles/themes/compat.css";`.

- [ ] **Step 3: Проверить визуальную совместимость + сборку**

Run: `pnpm build && pnpm test`
Expected: успех. `pnpm dev` — приложение выглядит как раньше (старые токены резолвятся в новую APCA-палитру; вайб сохранён).

- [ ] **Step 4: Закоммитить**

```bash
git add src/styles/themes/compat.css src/app/globals.css
git commit -m "feat(styles): compat shim aliasing legacy color tokens to new semantic set

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Слой `.content` (flow) + выпил typography-плагина

**Files:**
- Modify: `src/styles/content.css` (наполнить)
- Modify: `src/app/globals.css` (убрать `@plugin "@tailwindcss/typography"`)
- Modify: `package.json` (убрать `@tailwindcss/typography` из devDependencies)
- Modify: 21 файл с `prose` (список ниже)

**Interfaces:**
- `.content` — flow-слой на semantic-токенах. `.content--measure` — opt-in читаемая мера. `data-size="sm"` — компактный вариант (бывш. `prose-sm`).

- [ ] **Step 1: Наполнить `content.css`**

Replace `src/styles/content.css`:
```css
@layer components {
  .content {
    color: var(--color-fg);
    font-family: var(--font-ui);
    font-size: var(--text-base);
    line-height: var(--text-base--line-height);
    --flow: var(--space-stack);
  }
  .content[data-size="sm"] { font-size: var(--text-sm); line-height: var(--text-sm--line-height); }
  .content--measure { max-inline-size: 65ch; }

  /* FLOW: единственный механизм вертикального ритма — односторонний логический margin. */
  .content > * + * { margin-block-start: var(--flow); }
  .content > :is(h1, h2, h3) { --flow: calc(var(--space-stack) * 1.75); }
  .content > :is(h4, h5, h6) { --flow: calc(var(--space-stack) * 1.25); }

  .content :is(h1, h2, h3, h4, h5, h6) { font-weight: 600; line-height: 1.2; }
  .content h1 { font-size: var(--text-3xl); }
  .content h2 { font-size: var(--text-2xl); }
  .content h3 { font-size: var(--text-xl); }
  .content h4 { font-size: var(--text-lg); }

  .content a { color: var(--color-link); text-decoration: underline; }
  .content a:hover { color: var(--color-link-hover); }
  .content strong { font-weight: 600; }
  .content :is(ul, ol) { padding-inline-start: 1.5em; }
  .content ul { list-style: disc; }
  .content ol { list-style: decimal; }
  .content > :is(ul, ol) > li + li { margin-block-start: calc(var(--space-stack) * 0.4); }
  .content blockquote {
    border-inline-start: 3px solid var(--color-border-strong);
    padding-inline-start: 1em;
    color: var(--color-fg-muted);
  }
  .content code {
    font-family: var(--font-geist-mono), ui-monospace, monospace;
    font-size: 0.9em;
    background: var(--color-bg-subtle);
    padding: 0.1em 0.3em;
    border-radius: var(--radius-sm);
  }
  .content pre {
    font-family: var(--font-geist-mono), ui-monospace, monospace;
    background: var(--color-bg-subtle);
    padding: var(--space-control-pad-x);
    border-radius: var(--radius-md);
    overflow-x: auto;
  }
  .content pre code { background: none; padding: 0; }
  .content hr { border: 0; border-block-start: 1px solid var(--color-border); }
  .content img { max-width: 100%; height: auto; border-radius: var(--radius-md); }
  .content table { width: 100%; border-collapse: collapse; }
  .content :is(th, td) {
    border: 1px solid var(--color-border);
    padding: var(--space-control-pad-y) var(--space-control-pad-x);
    text-align: start;
  }
  .content th { font-weight: 600; background: var(--color-bg-subtle); }
}
```

- [ ] **Step 2: Убрать плагин из globals + package.json**

Modify `src/app/globals.css`: удалить строку `@plugin "@tailwindcss/typography";`.
Run: `pnpm remove @tailwindcss/typography`

- [ ] **Step 3: Мигрировать 21 site `prose` → `.content`**

Трансформация className: `prose` → `content`; `prose prose-sm` → `content` + `data-size="sm"` (атрибут на том же элементе); `max-w-none` убрать (мера у `.content` выключена по умолчанию); статейные вью (`document-detail`, `form-detail`, `form-after-submit`) — добавить `content--measure` если нужна узкая колонка (на усмотрение, по умолчанию не добавляем).

Файлы (заменить `className` в указанной строке):
- `src/app/saved/saved-lecture-view.tsx:234` — `prose prose-sm max-w-none` → `className="content" data-size="sm"`
- `src/features/comments/ui/admin-comment-row.tsx:22` — `prose prose-sm max-w-none` → `className="content" data-size="sm"`
- `src/features/comments/ui/comment-anchor-context.tsx:36` — `prose prose-sm mt-1 max-w-none opacity-80` → `className="content mt-1 opacity-80" data-size="sm"`
- `src/features/comments/ui/comment-node-view.tsx:56` — `prose prose-sm max-w-none` → `className="content" data-size="sm"`
- `src/features/comments/ui/comment-revisions.tsx:30` — `prose prose-sm max-w-none` → `className="content" data-size="sm"`
- `src/features/forms/ui/form-detail.tsx:15` — `prose max-w-none` → `className="content"`
- `src/features/forms/ui/submission-detail.tsx:27` — `prose prose-sm max-w-none font-medium` → `className="content font-medium" data-size="sm"`
- `src/features/forms/ui/form-after-submit.tsx:11` — `prose max-w-none` → `className="content"`
- `src/features/forms/ui/form-field-input.tsx:22` — `prose prose-sm max-w-none` → `className="content" data-size="sm"`
- `src/features/forms/ui/form-field-input.tsx:27` — `prose prose-sm max-w-none text-(--color-description)` → `className="content text-(--color-fg-muted)" data-size="sm"`
- `src/features/banners/ui/active-banners.tsx:43` — `prose min-w-0 flex-1 text-sm` → `className="content min-w-0 flex-1" data-size="sm"`
- `src/features/banners/ui/banner-revisions.tsx:40` — `prose` → `className="content"`
- `src/features/annotations/ui/annotation-card.tsx:37` — `prose prose-sm` → `className="content" data-size="sm"`
- `src/features/annotations/ui/annotation-revisions.tsx:41` — `prose prose-sm` → `className="content" data-size="sm"`
- `src/features/annotations/ui/annotation-admin-row.tsx:24` — `prose prose-sm` → `className="content" data-size="sm"`
- `src/features/glossary/ui/glossary-revisions.tsx:43` — `prose` → `className="content"`
- `src/features/glossary/ui/glossary-detail.tsx:22` — `prose` → `className="content"`
- `src/features/documents/ui/document-revisions.tsx:33` — `prose max-w-none` → `className="content"`
- `src/features/documents/ui/document-detail.tsx:13` — `prose max-w-none` → `className="content"`
- `src/features/events/ui/calendar-view.tsx:75` — `prose mt-2` → `className="content mt-2"`
- `src/features/events/ui/event-revisions.tsx:37` — `prose` → `className="content"`
- `src/components/ast-editor/ast-editor.tsx:110` — `prose prose-sm max-w-none` → `className="content" data-size="sm"`

- [ ] **Step 4: Проверить, что `prose` нигде не осталось**

Run: `grep -rn "prose" src/ --include="*.tsx" --include="*.css"`
Expected: пусто (0 совпадений).

- [ ] **Step 5: Сборка + визуальная проверка**

Run: `pnpm build && pnpm lint && pnpm test`
Expected: успех. `pnpm dev` — открыть страницу документа/глоссария: контент рендерится с flow-ритмом, заголовки дышат, на токенах.

- [ ] **Step 6: Закоммитить**

```bash
git add src/styles/content.css src/app/globals.css package.json pnpm-lock.yaml src/app/saved/saved-lecture-view.tsx src/features src/components/ast-editor/ast-editor.tsx
git commit -m "feat(styles): own .content flow layer; drop @tailwindcss/typography; migrate 21 prose sites

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Миграция `components/ui/*` на новые токены + density

**Files:**
- Modify: `src/components/ui/cn.ts`, `button.tsx`, `icon-button.tsx`, `text-input.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`, `dialog.tsx`, `table.tsx`, `toaster.tsx`, `skeleton.tsx`, `empty-state.tsx`, и др. использующие `--color-background/-foreground/-text-pane/-border` и хардкод высот.

**Interfaces:**
- Заменить старые токен-имена на новые semantic (`--color-bg`, `--color-fg`, `--color-bg-subtle`, `--color-border`, `--color-fg-muted`, `--color-accent` …).
- Заменить хардкод высот/паддингов контролов на density-токены: `h-10`→`h-(--size-control-h-md)`, `px-3`→`px-(--space-control-pad-x)` и т.п.

- [ ] **Step 1: Обновить общие хелперы `cn.ts`**

Modify `src/components/ui/cn.ts`:
- `FOCUS_RING_INPUT` / `FOCUS_RING_CONTROL`: `outline-(--color-foreground)` → `outline-(--color-ring)`.
- `SHELL_BASE`: `border-(--color-border) bg-(--color-background)` → `border-(--color-border) bg-(--color-bg)`.

- [ ] **Step 2: Прогнать поиск старых токен-имён в ui**

Run: `grep -rn "color-background\|color-foreground\|color-text-pane\|color-description\|color-primary" src/components/ui/`
Для каждого совпадения заменить: `background`→`bg`, `foreground`→`fg`, `text-pane`→`bg-subtle`, `description`→`fg-muted`, `primary`→`accent`.

- [ ] **Step 3: Заменить хардкод размеров контролов на density-токены**

В `button.tsx`, `icon-button.tsx`, `text-input.tsx`, `select.tsx`, `checkbox.tsx`: высоты `h-8/h-10/h-12` → `h-(--size-control-h-sm/-md/-lg)`; горизонтальные паддинги `px-3` → `px-(--space-control-pad-x)`, вертикальные `py-2` → `py-(--space-control-pad-y)`. Применять там, где это размер интерактивного контрола (не любые отступы).

- [ ] **Step 4: Сборка + тесты ui**

Run: `pnpm build && pnpm test src/components/ui`
Expected: успех; существующие тесты компонентов зелёные.

- [ ] **Step 5: Визуальная проверка плотности**

`pnpm dev`, в DevTools поставить `<html data-density="compact">` — контролы становятся ниже/плотнее; `comfortable` — обычные.

- [ ] **Step 6: Закоммитить**

```bash
git add src/components/ui
git commit -m "refactor(ui): migrate primitives to new semantic + density tokens

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: Удалить legacy palette + compat-shim

**Files:**
- Delete: `src/styles/themes/rebus.css`, `src/styles/themes/compat.css`
- Modify: `src/app/globals.css` (убрать импорт compat)
- Modify: `src/app/layout.tsx` (последние `--color-background` → `--color-bg`)

**Interfaces:** после Task 16 ни один компонент не должен использовать старые имена.

- [ ] **Step 1: Убедиться, что старые имена больше не используются**

Run: `grep -rn "color-background\|color-foreground\|color-text-pane\|color-description\|color-primary\|color-danger-fill" src/ --include="*.tsx" --include="*.ts" --include="*.css" | grep -v compat.css | grep -v rebus.css`
Expected: единственные оставшиеся — в `src/app/layout.tsx` (`bg-(--color-background)`). Заменить на `bg-(--color-bg)`.

Если есть прочие совпадения — мигрировать их (повтор Task 16-логики) ПЕРЕД удалением shim.

- [ ] **Step 2: Удалить файлы и импорт**

Run:
```bash
rm src/styles/themes/rebus.css src/styles/themes/compat.css
```
Modify `src/app/globals.css`: удалить `@import "../styles/themes/compat.css";` (и убедиться, что `rebus.css` уже не импортируется — он был убран в Task 10).

- [ ] **Step 3: Фаза-гейт**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное. `pnpm dev` — приложение выглядит корректно, переключение тем/плотности/контраста/шрифта/размера работает.

- [ ] **Step 4: Закоммитить**

```bash
git add src/styles/themes src/app/globals.css src/app/layout.tsx
git commit -m "refactor(styles): remove legacy rebus palette + compat shim (migration complete)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# ФАЗА 4 — Настройки в аккаунте + бэк-синк

### Task 18: Расширить схему preferences (graceful)

**Files:**
- Modify: `src/features/preferences/schemas.ts`
- Test: `src/features/preferences/schemas.test.ts` (добавить кейсы)

**Interfaces:**
- `AppearancePrefsSchema` (Zod) валидирует все 5 осей; экспортить `AppearancePrefsInput`.

- [ ] **Step 1: Тест схемы**

Modify `src/features/preferences/schemas.test.ts` — добавить:
```ts
import { AppearancePrefsSchema } from "./schemas";

describe("AppearancePrefsSchema", () => {
  it("accepts a full valid appearance", () => {
    const r = AppearancePrefsSchema.safeParse({
      theme: "dark", contrast: "high", density: "compact", font: "serif", text_size: "lg",
    });
    expect(r.success).toBe(true);
  });
  it("rejects unknown enum", () => {
    expect(AppearancePrefsSchema.safeParse({ theme: "neon" }).success).toBe(false);
  });
});
```
(Импорт `describe/it/expect` уже есть в файле — не дублировать.)

- [ ] **Step 2: Реализовать схему**

Modify `src/features/preferences/schemas.ts` — добавить:
```ts
export const AppearancePrefsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  contrast: z.enum(["normal", "high"]),
  density: z.enum(["comfortable", "compact"]),
  font: z.enum(["sans", "legible", "serif"]),
  text_size: z.enum(["sm", "md", "lg", "xl"]),
});
export type AppearancePrefsInput = z.infer<typeof AppearancePrefsSchema>;
```

- [ ] **Step 3: Запустить — проходит**

Run: `pnpm test src/features/preferences/schemas.test.ts`
Expected: PASS.

- [ ] **Step 4: Закоммитить**

```bash
git add src/features/preferences/schemas.ts src/features/preferences/schemas.test.ts
git commit -m "feat(preferences): appearance preferences schema (5 axes)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: Секция «Внешний вид» в `/me/settings`

**Files:**
- Create: `src/app/me/settings/appearance/appearance-settings.tsx` (client)
- Modify: `src/app/me/settings/page.tsx` (отрендерить секцию)

**Interfaces:**
- Consumes: `useAppearance` (Task 12), `Select` (`@/components/ui`).
- Каждый контрол вызывает `setAxis(...)` напрямую (оптимистично применяется + cookie + бэк-синк). Без формы-сабмита — мгновенно.

- [ ] **Step 1: Реализовать секцию**

Create `src/app/me/settings/appearance/appearance-settings.tsx`:
```tsx
"use client";
import { Select } from "@/components/ui";
import { useAppearance } from "@/components/appearance";

const THEME = [
  { value: "system", label: "Как в системе" },
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
];
const CONTRAST = [
  { value: "normal", label: "Обычный" },
  { value: "high", label: "Высокий" },
];
const DENSITY = [
  { value: "comfortable", label: "Просторно" },
  { value: "compact", label: "Компактно" },
];
const FONT = [
  { value: "sans", label: "Стандартный" },
  { value: "legible", label: "Высоко-разборчивый" },
  { value: "serif", label: "С засечками (для чтения)" },
];
const TEXT_SIZE = [
  { value: "sm", label: "Меньше" },
  { value: "md", label: "Обычный" },
  { value: "lg", label: "Крупнее" },
  { value: "xl", label: "Максимальный" },
];

export function AppearanceSettings() {
  const { appearance, setAxis } = useAppearance();
  return (
    <section className="flex max-w-xl flex-col gap-4">
      <h2 className="text-lg font-semibold">Внешний вид</h2>
      <Field label="Тема">
        <Select aria-label="Тема" options={THEME} value={appearance.theme}
          onValueChange={(v) => setAxis("theme", v as typeof appearance.theme)} />
      </Field>
      <Field label="Контраст">
        <Select aria-label="Контраст" options={CONTRAST} value={appearance.contrast}
          onValueChange={(v) => setAxis("contrast", v as typeof appearance.contrast)} />
      </Field>
      <Field label="Плотность интерфейса">
        <Select aria-label="Плотность" options={DENSITY} value={appearance.density}
          onValueChange={(v) => setAxis("density", v as typeof appearance.density)} />
      </Field>
      <Field label="Шрифт">
        <Select aria-label="Шрифт" options={FONT} value={appearance.font}
          onValueChange={(v) => setAxis("font", v as typeof appearance.font)} />
      </Field>
      <Field label="Размер текста">
        <Select aria-label="Размер текста" options={TEXT_SIZE} value={appearance.textSize}
          onValueChange={(v) => setAxis("textSize", v as typeof appearance.textSize)} />
      </Field>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
```

- [ ] **Step 2: Вставить секцию в страницу настроек**

Modify `src/app/me/settings/page.tsx`: импортировать `AppearanceSettings` и отрендерить рядом с `PreferencesForm` (внутри существующего layout страницы). `AppearanceSettings` — client-компонент, работает в дереве под `AppearanceProvider` (он в root layout).

- [ ] **Step 3: Проверка**

Run: `pnpm build && pnpm lint && pnpm test`
Expected: успех. `pnpm dev` → `/me/settings`: меняешь любую ось — интерфейс перекрашивается/перемасштабируется мгновенно, после reload сохраняется (cookie).

- [ ] **Step 4: Закоммитить**

```bash
git add src/app/me/settings
git commit -m "feat(settings): appearance section (theme/contrast/density/font/size)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 20: Бэк-синк (когда контракт готов) — reconcile + write-through

**Files:**
- Modify: `src/utils/appearance.ts` (reconcile из `me.preferences.appearance`)
- Modify: `src/components/appearance/persist-appearance.ts` (убрать `as never` после регена schema.ts)
- Modify: `src/features/preferences/actions.ts` (если нужен отдельный action)

**Interfaces:** зависит от бэка — координация с philosophy-api (memory: открытые бэк-аски). Пока поля нет — Task держится как задокументированный план.

- [ ] **Step 1: Дождаться бэк-полей appearance в `preference.Preferences`**

Предусловие: бэк добавил `appearance` в `/api/me/preferences`. Регенерация `src/api/schema.ts` — координированно (CLAUDE.md): `pnpm generate:api`.

- [ ] **Step 2: Reconcile-on-load**

Modify `src/utils/appearance.ts`: после чтения cookie, если `getMe()` вернул `me.preferences.appearance` и оно отличается от cookie — вернуть бэк-значение (бэк авторитетен на свежей сессии). Cookie перезаписывается на клиенте при следующем `setAxis`.

- [ ] **Step 3: Снять graceful-cast**

Modify `src/components/appearance/persist-appearance.ts`: заменить `{ appearance } as never` на типизированный body; оставить try/catch на сетевые ошибки, но логировать реальные 4xx.

- [ ] **Step 4: Тесты + гейт**

Обновить `persist-appearance.test.ts` под реальный контракт. Run: `pnpm lint && pnpm test && pnpm build`.

- [ ] **Step 5: Закоммитить**

```bash
git add src/utils/appearance.ts src/components/appearance/persist-appearance.ts src/features/preferences
git commit -m "feat(appearance): backend sync + reconcile-on-load (cross-device)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- §3 APCA-таргеты → Task 3, 5, 7 ✓
- §4 ярусы/оси/композиция → Task 2–6 (модель), Task 8 (слои) ✓
- §5 палитра/деривация apcach → Task 4, 5 ✓
- §6 Tailwind `@theme inline` + tree-shake → Task 8 (`@theme inline`), Task 10 ✓
- §7 no-FOUC cookie-SSR + гибрид → Task 9, 11, 12, 13, 20 ✓
- §8 типографика (text-scale, px-брейкпоинты, 3 шрифта) → Task 2 (TEXT_SCALE/FONT_STACKS), 10, 11 ✓
- §9 плотность → Task 2 (DENSITY), 8 (слой), 16 (потребление) ✓
- §10 контраст (high + prefers-contrast + forced-colors) → Task 5, 8, 10 ✓
- §11 `.content` flow + выпил плагина → Task 15 ✓
- §12 CI-гард → Task 7 ✓
- §13 настройки + RBAC (self-scoped, аноним cookie-only) → Task 18, 19; аноним обрабатывается в Task 13 (`if (!me) return`) ✓
- §14 фазировка + compat-shim → Task 14, 17 ✓
- §15 структура файлов → соответствует ✓
- §16 зависимости → Task 1, 8, 15 ✓

**2. Placeholder scan:** все code-шаги содержат реальный код; миграционные правки (Task 15/16) перечислены пофайлово с точной трансформацией (механический find-replace — не плейсхолдер). Task 20 явно помечен как зависящий от готовности бэка (предусловие, а не TODO).

**3. Type consistency:** `Appearance`, `ColorTokenName`, `Theme`, `Contrast`, `Density`, `TextSize`, `FontChoice` определены однажды и переиспользуются; `htmlAttrs`/`parseAppearance`/`serializeAppearance`/`getAppearance`/`setAxis`/`persistAppearance`/`deriveOn`/`buildColorLayer`/`TOKENS`/`CONTRAST_PAIRS` — имена согласованы между задачами.

**Известный риск (зафиксирован в spec §18):** `adjustFontFallback` для Google-шрифтов может игнорироваться в рантайме (баг Next) → CLS при свопе шрифта мерить эмпирически после Task 11; при необходимости — ручные `size-adjust`/override-метрики (под-задача, не блокирует фундамент).
