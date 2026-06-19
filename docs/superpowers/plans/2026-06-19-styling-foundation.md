# Styling Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Revised 2026-06-19** after a 7-axis multi-agent review (40 findings). All blockers folded in: valid high-contrast CSS, font cyrillic handling, real drift guard, full 158-file legacy-token migration, used appearance schema, @theme mapping, extra APCA pairs.

**Goal:** Строгий, расширяемый фундамент стилизации: APCA-корректные design-токены с единым TS-источником истины, генерацией CSS и CI-гардом контраста; 4 настраиваемые оси внешнего вида (тема/контраст/плотность/шрифт + размер текста) с no-FOUC cookie-SSR; замена `@tailwindcss/typography` на свой flow-слой `.content`; полная миграция legacy-токенов на новую палитру.

**Architecture:** Токены в типизированном TS-модуле (`src/styles/tokens/*`): primitive (OKLCH + apcach-деривация) → semantic (переключаемый ярус) → component. Скрипт `scripts/generate-tokens.mjs` эмитит `src/styles/tokens.generated.css` (`@theme` для шкал + `@theme inline` для цвет/шрифт-маппинга + plain-CSS слои-оверрайды по `data-*`). Тот же TS-модуль импортит vitest-гард, проверяющий APCA-Lc каждой пары fg/bg. Рантайм: cookie читается в root layout (server) → `data-*` + `color-scheme` на `<html>` до пейнта (0 FOUC, 0 hydration mismatch); `AppearanceProvider` применяет смену оптимистично (мутация атрибута = var-swap), пишет cookie, синкает в бэк.

**Tech Stack:** Next.js 16.1.4 (App Router, RSC), React 19.2.3, Tailwind v4 (CSS-first, `@theme`), Base UI, Zod 4, vitest (jsdom, `globals: false`), pnpm@8.14.3. Новые dev-deps: `apcach`, `apca-w3`, `culori`, `tsx`. Шрифты через `next/font/google`.

## Global Constraints

- **Пакетный менеджер — pnpm.** Никогда не `npm install`. Команды: `pnpm add -D <pkg>`, `pnpm lint`, `pnpm test`, `pnpm build`. **pnpm@8 НЕ исполняет `pre`/`post`-хуки** (`enable-pre-post-scripts=false`) — не полагаться на `prebuild`; генерацию встраивать в `build` через `&&`.
- **Параллельные агенты.** НЕ делать `git stash/reset/checkout ./clean`. НЕ `git add -A`/`git add .` и НЕ `git add <dir>` — добавлять только конкретные файлы по имени (или точный список, полученный grep'ом из codemod). Не трогать чужие изменения: перед коммитом codemod-задач убедиться `git diff` каждого файла содержит ТОЛЬКО переименование токенов.
- **Push заблокирован** — только локальные коммиты.
- **vitest:** `globals: false` → импортировать `describe/it/expect/vi` из `vitest`. Алиас `@` → `src`. `include: ["src/**/*.test.{ts,tsx}"]` — тесты ОБЯЗАНЫ лежать в `src/` (файлы в `scripts/` vitest НЕ запускает). Для server-модулей: `vi.mock("server-only", () => ({}))`.
- **Санкционированные запретные зоны** (этот план — единственный координированный foundation-PR, трогающий их; решение пользователя — полная миграция): `src/app/layout.tsx`, `src/app/globals.css`, `src/components/ui/*`, `package.json`, `vitest.config.ts`, `src/utils/appearance.ts` (новый), `.github/workflows/ci.yml`, **и при миграции токенов** — `src/app/admin/*` (18 файлов), `src/components/app/*`, `src/components/permission/*` (миграция только переименования токенов, без логических правок). `src/api/schema.ts` — НЕ регенерировать; partial-body PATCH типизировать через `as never`.
- **Именование файлов в `src/` — kebab-case.**
- **APCA не нормативен** — внутренняя планка. WCAG 2.x AA через `bridge-pca` — вне этого плана.
- **Коммит-сообщения** заканчивать: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Перед завершением фазы зелёные: `pnpm lint && pnpm test && pnpm build`.

## Canonical legacy→new token rename map (Phase 3)

Детерминированная карта переименования имён CSS-переменных (применяется codemod'ом, Task 16/17). **Порядок важен:** `-fill-hover` до `-fill`.

| legacy | new | файлов |
| --- | --- | --- |
| `--color-danger-fill-hover` | `--color-danger` | 3 |
| `--color-danger-fill` | `--color-danger` | 3 |
| `--color-background` | `--color-surface` | 25 |
| `--color-foreground` | `--color-fg` | 11 |
| `--color-text-pane` | `--color-surface-subtle` | 28 |
| `--color-description` | `--color-fg-muted` | 138 |
| `--color-primary` | `--color-accent` | 16 |

Имена, которые НЕ переименовываются (совпадают с новыми semantic): `--color-border`, `--color-link`, `--color-danger`, `--color-danger-bg`, `--color-success`, **`--color-surface`** (в `lazy-ast-editor.tsx` он сейчас не определён — после ввода нового семейства поверхностей он становится реальным базовым токеном и резолвится сам, миграции/алиаса не требует). Семейство поверхностей: `surface / surface-subtle / surface-raised / surface-overlay`. NB: статусные суффиксы `-bg` (`danger-bg`/`success-bg`/…) — это тинт-подложки, НЕ семейство поверхностей; их codemod не трогает. Всего ~158 distinct файлов; 23 — в запретных зонах (см. Global Constraints).

## File Structure

```
src/styles/tokens/
  enums.ts           # единый источник enum-значений осей (THEMES/CONTRASTS/DENSITIES/FONTS/TEXT_SIZES)
  scales.ts          # type/radius/shadow/z/duration/density/fonts/text-scale
  apca-targets.ts    # ColorTokenName + CONTRAST_PAIRS (пары [fg,bg]→minLc)
  primitives.ts      # фоны + hue/chroma; deriveOn() поверх apcach (maxChroma, in-gamut)
  semantic.ts        # buildColorLayer per (theme × contrast); COLOR_LAYERS
  index.ts           # TOKENS (единый импорт для генератора и тестов)
  apca.test.ts       # CI-гард: |Lc| ≥ target по всем парам × комбинациям
  scales.test.ts
  generated-css.test.ts            # freshness/структура tokens.generated.css (в src/ → vitest видит)
src/styles/tokens.generated.css    # GENERATED (коммитим)
src/styles/content.css             # слой .content (flow)
src/styles/themes/compat.css       # ВРЕМЕННЫЙ shim; удаляется в Task 18
src/app/globals.css                # MOD
scripts/generate-tokens.mjs        # генератор CSS
scripts/migrate-legacy-tokens.mjs  # ВРЕМЕННЫЙ codemod (удаляется после Phase 3)
src/utils/appearance.ts            # server: getAppearance()
src/components/appearance/appearance-cookie.ts   # модель + parse/serialize/htmlAttrs (shared)
src/components/appearance/appearance-provider.tsx
src/components/appearance/persist-appearance.ts
src/components/appearance/index.ts
src/app/me/settings/appearance/appearance-settings.tsx
src/features/preferences/schemas.ts   # MOD: отдельная AppearancePrefsSchema (НЕ в PreferencesUpdateSchema)
.github/workflows/ci.yml              # MOD: drift-guard step
```

---

# ФАЗА 1 — Скелет токенов (clean-room)

### Task 1: Зависимости + смоук реального API контраст-либ

**Files:**
- Modify: `package.json` (devDependencies)
- Create (temp): `src/styles/tokens/apca-smoke.test.ts` (удаляется в конце задачи)

**Interfaces:**
- Produces: проверенные формы `apca-w3` (`APCAcontrast(textY,bgY)`, `sRGBtoY([r,g,b])`), `culori` (`parse`, `converter`, `inGamut`), `apcach` (`apcach`, `apcachToCss`, `crToBg`, `maxChroma`) — **включая 4-арг `crToBg(bg, Lc, "apca", dir)` и `maxChroma()`**, на которые опирается Task 4.

- [ ] **Step 1: Установить dev-зависимости**

Run: `pnpm add -D apcach apca-w3 culori`
Expected: добавлены в `devDependencies`, `pnpm-lock.yaml` обновлён, exit 0.

- [ ] **Step 2: Смоук-тест, фиксирующий ИМЕННО используемые формы**

Create `src/styles/tokens/apca-smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { APCAcontrast, sRGBtoY } from "apca-w3";
import { parse, converter, inGamut } from "culori";
import { apcach, apcachToCss, crToBg, maxChroma } from "apcach";

const toRgb = converter("rgb");
const rgbInGamut = inGamut("rgb");

function oklchToRgb255(oklch: string): [number, number, number] {
  const c = toRgb(parse(oklch));
  if (!c) throw new Error(`culori failed to parse: ${oklch}`);
  const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));
  return [clamp(c.r), clamp(c.g), clamp(c.b)];
}

describe("contrast libs smoke (exact forms used by Task 4)", () => {
  it("apca-w3: positive Lc for dark text on light bg", () => {
    const lc = APCAcontrast(sRGBtoY([0x1a, 0x1a, 0x1a]), sRGBtoY([0xf6, 0xf2, 0xeb]));
    expect(typeof lc).toBe("number");
    expect(lc).toBeGreaterThan(75);
  });

  it("apcach: 4-arg crToBg with explicit searchDirection + maxChroma", () => {
    const darker = apcach(crToBg("#f6f2eb", 75, "apca", "darker"), maxChroma(0.04), 70);
    const css = apcachToCss(darker, "oklch");
    expect(css.startsWith("oklch(")).toBe(true);
    const lc = Math.abs(APCAcontrast(sRGBtoY(oklchToRgb255(css)), sRGBtoY([0xf6, 0xf2, 0xeb])));
    expect(lc).toBeGreaterThanOrEqual(70);
    // maxChroma keeps result in-gamut
    expect(rgbInGamut(parse(css))).toBe(true);
  });

  it("apcach: lighter direction works for dark bg", () => {
    const lighter = apcach(crToBg("#111a20", 75, "apca", "lighter"), maxChroma(0.04), 250);
    const css = apcachToCss(lighter, "oklch");
    const raw = APCAcontrast(sRGBtoY(oklchToRgb255(css)), sRGBtoY([0x11, 0x1a, 0x20]));
    expect(raw).toBeLessThan(0); // light-on-dark → negative
  });
});
```

- [ ] **Step 3: Запустить смоук + typecheck (apca-w3 может не иметь типов)**

Run: `pnpm test src/styles/tokens/apca-smoke.test.ts && pnpm typecheck`
Expected: тест PASS, typecheck без новых ошибок. Если у `apca-w3` нет `.d.ts` под strict — добавить ambient-декларацию `src/types/apca-w3.d.ts` (`declare module "apca-w3";`) и повторить typecheck. Если реальная сигнатура `crToBg`/`maxChroma`/`apcachToCss` отличается — поправить вызовы под установленные версии и зафиксировать рабочую форму (она переиспользуется Task 4).

- [ ] **Step 4: Удалить смоук, закоммитить deps (+ ambient-декл., если создавали)**

Run:
```bash
rm src/styles/tokens/apca-smoke.test.ts
git add package.json pnpm-lock.yaml
# если создавали ambient-декларацию:
# git add src/types/apca-w3.d.ts
git commit -m "chore(styles): add apcach/apca-w3/culori for APCA token derivation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Единый источник enum осей (`enums.ts`) + шкалы (`scales.ts`)

**Files:**
- Create: `src/styles/tokens/enums.ts`, `src/styles/tokens/scales.ts`
- Test: `src/styles/tokens/scales.test.ts`

**Interfaces:**
- Produces (`enums.ts`): `THEMES=["light","dark","system"]`, `CONTRASTS=["normal","high"]`, `DENSITIES=["comfortable","compact"]`, `FONTS=["sans","legible","serif"]`, `TEXT_SIZES=["sm","md","lg","xl"]` (все `as const`), и производные типы `Theme/Contrast/Density/FontChoice/TextSize`. **Единый источник** — переиспользуется в `appearance-cookie.ts` (Task 9) и `AppearancePrefsSchema` (Task 18).
- Produces (`scales.ts`): `TYPE_SCALE`, `RADIUS`, `SHADOW`, `Z`, `DURATION`, `DENSITY`, `FONT_STACKS`, `TEXT_SCALE` (как в исходном плане).

- [ ] **Step 1: Тест шкал**

Create `src/styles/tokens/scales.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { TYPE_SCALE, DENSITY, TEXT_SCALE, FONT_STACKS, Z } from "./scales";
import { THEMES, FONTS } from "./enums";

describe("enums", () => {
  it("expose axis value arrays", () => {
    expect(THEMES).toContain("system");
    expect(FONTS).toEqual(["sans", "legible", "serif"]);
  });
});

describe("scales", () => {
  it("type scale is monotonic in rem size", () => {
    const steps = ["2xs","xs","sm","base","lg","xl","2xl","3xl","4xl"] as const;
    const rems = steps.map((s) => parseFloat(TYPE_SCALE[s].size));
    for (let i = 1; i < rems.length; i++) expect(rems[i]).toBeGreaterThan(rems[i - 1]);
  });
  it("compact density tighter than comfortable", () => {
    expect(parseFloat(DENSITY.compact.controlH.md)).toBeLessThan(parseFloat(DENSITY.comfortable.controlH.md));
  });
  it("md text scale is neutral 1", () => { expect(TEXT_SCALE.md).toBe(1); });
  it("font stacks reference next/font vars", () => {
    expect(FONT_STACKS.sans).toContain("--font-geist-sans");
    expect(FONT_STACKS.legible).toContain("--font-atkinson");
    expect(FONT_STACKS.serif).toContain("--font-serif");
  });
  it("z toast above modal", () => { expect(Z.toast).toBeGreaterThan(Z.modal); });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm test src/styles/tokens/scales.test.ts` → FAIL (нет `./scales`/`./enums`).

- [ ] **Step 3: Реализовать `enums.ts`**

Create `src/styles/tokens/enums.ts`:
```ts
// Единый источник значений настраиваемых осей. Импортится моделью токенов,
// клиентским parseAppearance (appearance-cookie.ts) и серверной Zod-схемой.
export const THEMES = ["light", "dark", "system"] as const;
export const CONTRASTS = ["normal", "high"] as const;
export const DENSITIES = ["comfortable", "compact"] as const;
export const FONTS = ["sans", "legible", "serif"] as const;
export const TEXT_SIZES = ["sm", "md", "lg", "xl"] as const;

export type Theme = (typeof THEMES)[number];
export type Contrast = (typeof CONTRASTS)[number];
export type Density = (typeof DENSITIES)[number];
export type FontChoice = (typeof FONTS)[number];
export type TextSize = (typeof TEXT_SIZES)[number];
```

- [ ] **Step 4: Реализовать `scales.ts`**

Create `src/styles/tokens/scales.ts`:
```ts
import type { Density, FontChoice, TextSize } from "./enums";

export type TypeStep = "2xs" | "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

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
export const RADIUS = { sm: "0.25rem", md: "0.5rem", lg: "0.75rem", full: "9999px" } as const;
export const SHADOW = {
  sm: "0 1px 2px 0 oklch(0% 0 0 / 0.05)",
  md: "0 4px 6px -1px oklch(0% 0 0 / 0.1), 0 2px 4px -2px oklch(0% 0 0 / 0.1)",
  lg: "0 10px 15px -3px oklch(0% 0 0 / 0.1), 0 4px 6px -4px oklch(0% 0 0 / 0.1)",
} as const;
export const Z = { base: 0, dropdown: 10, sticky: 20, overlay: 30, modal: 40, toast: 50 } as const;
export const DURATION = { fast: "120ms", base: "200ms", slow: "320ms" } as const;

export const DENSITY: Record<Density, { controlH: Record<"sm"|"md"|"lg", string>; padX: string; padY: string; stack: string }> = {
  comfortable: { controlH: { sm: "2rem", md: "2.5rem", lg: "3rem" }, padX: "0.75rem", padY: "0.5rem", stack: "1rem" },
  compact:     { controlH: { sm: "1.75rem", md: "2.25rem", lg: "2.75rem" }, padX: "0.5rem", padY: "0.375rem", stack: "0.75rem" },
};

export const FONT_STACKS: Record<FontChoice, string> = {
  sans: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  // legible: латиница — Atkinson, кириллица — Geist-фоллбек (у Atkinson нет cyrillic)
  legible: "var(--font-atkinson), var(--font-geist-sans), sans-serif",
  serif: "var(--font-serif), ui-serif, Georgia, serif",
};
export const TEXT_SCALE: Record<TextSize, number> = { sm: 0.9, md: 1, lg: 1.125, xl: 1.25 };
```

- [ ] **Step 5: Запустить — проходит → коммит**

Run: `pnpm test src/styles/tokens/scales.test.ts` → PASS.
```bash
git add src/styles/tokens/enums.ts src/styles/tokens/scales.ts src/styles/tokens/scales.test.ts
git commit -m "feat(styles): axis enums + non-color design scales

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Таблица APCA-таргетов (`apca-targets.ts`)

**Files:** Create `src/styles/tokens/apca-targets.ts`

**Interfaces:** Produces `ColorTokenName` (union), `CONTRAST_PAIRS: { fg; bg; minLc; note }[]`. **Покрывает реально рендеримые пары** (вкл. текст на accent-hover, на сплошном danger-fill, accent-as-object, видимость тинтов).

- [ ] **Step 1: Реализовать**

Create `src/styles/tokens/apca-targets.ts`:
```ts
export type ColorTokenName =
  | "surface" | "surface-subtle" | "surface-raised" | "surface-overlay"
  | "fg" | "fg-muted" | "fg-subtle" | "fg-on-accent"
  | "border" | "border-strong" | "ring"
  | "accent" | "accent-hover" | "accent-fg"
  | "link" | "link-hover"
  | "danger" | "danger-bg" | "danger-fg"
  | "success" | "success-bg" | "success-fg"
  | "warning" | "warning-bg" | "warning-fg"
  | "info" | "info-bg" | "info-fg";

// NB: ключи fg:/bg: ниже — это поля пары (foreground/background), а не имена токенов.
// Значения — токены ColorTokenName. Статусные -bg/-fg — тинт-подложка/текст-на-тинте.
export const CONTRAST_PAIRS: { fg: ColorTokenName; bg: ColorTokenName; minLc: number; note: string }[] = [
  { fg: "fg", bg: "surface", minLc: 75, note: "body text on app surface (preferred 90)" },
  { fg: "fg", bg: "surface-subtle", minLc: 75, note: "body on subtle surface" },
  { fg: "fg", bg: "surface-raised", minLc: 75, note: "body on raised surface" },
  { fg: "fg-muted", bg: "surface", minLc: 60, note: "secondary text" },
  { fg: "fg-muted", bg: "surface-subtle", minLc: 60, note: "secondary on subtle surface" },
  { fg: "fg-subtle", bg: "surface", minLc: 30, note: "placeholder/disabled" },
  { fg: "link", bg: "surface", minLc: 60, note: "link" },
  { fg: "link-hover", bg: "surface", minLc: 60, note: "link hover" },
  { fg: "accent", bg: "surface", minLc: 15, note: "accent fill discernible as object on surface" },
  { fg: "accent-fg", bg: "accent", minLc: 60, note: "label on accent fill" },
  { fg: "fg-on-accent", bg: "accent", minLc: 60, note: "alt label on accent" },
  { fg: "accent-fg", bg: "accent-hover", minLc: 60, note: "label on accent hover state" },
  { fg: "fg-on-accent", bg: "accent-hover", minLc: 60, note: "alt label on accent hover" },
  { fg: "border", bg: "surface", minLc: 15, note: "discernible border" },
  { fg: "border-strong", bg: "surface", minLc: 30, note: "interactive border" },
  { fg: "ring", bg: "surface", minLc: 45, note: "focus ring on surface" },
  { fg: "ring", bg: "accent", minLc: 45, note: "focus ring must stay visible over accent surface" },
  { fg: "danger", bg: "surface", minLc: 60, note: "danger text/icon" },
  { fg: "fg-on-accent", bg: "danger", minLc: 60, note: "light label on solid danger fill (e.g. danger button)" },
  { fg: "danger-fg", bg: "danger-bg", minLc: 60, note: "danger text on tint" },
  { fg: "danger-bg", bg: "surface", minLc: 8, note: "danger tint discernible from surface" },
  { fg: "success", bg: "surface", minLc: 60, note: "success text/icon" },
  { fg: "success-fg", bg: "success-bg", minLc: 60, note: "success text on tint" },
  { fg: "warning", bg: "surface", minLc: 60, note: "warning text/icon" },
  { fg: "warning-fg", bg: "warning-bg", minLc: 60, note: "warning text on tint" },
  { fg: "info", bg: "surface", minLc: 60, note: "info text/icon" },
  { fg: "info-fg", bg: "info-bg", minLc: 60, note: "info text on tint" },
];
// NB: surface-overlay — полупрозрачный слой; APCAcontrast напрямую его не меряет.
// Контент модалок рендерится на surface-raised поверх overlay → покрыто парой fg на surface-raised.
```

- [ ] **Step 2: typecheck → коммит**

Run: `pnpm exec tsc --noEmit` → без новых ошибок.
```bash
git add src/styles/tokens/apca-targets.ts
git commit -m "feat(styles): APCA target table incl. real-rendered pairs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Примитивы + apcach-деривация in-gamut (`primitives.ts`)

**Files:** Create `src/styles/tokens/primitives.ts`, Test `src/styles/tokens/primitives.test.ts`

**Interfaces:**
- Consumes: `apcach`, `apcachToCss`, `crToBg`, `maxChroma` (формы из Task 1); `Theme` (enums).
- Produces: `BACKDROP: Record<Theme', {bg;bgSubtle;bgRaised}>` (`Theme'` = "light"|"dark"); `HUE`; `deriveOn(bgOklch, targetLc, hue, chroma, dir): string` — использует `maxChroma(chroma)` чтобы результат был В гамуте.

- [ ] **Step 1: Тест деривации (вкл. in-gamut)**

Create `src/styles/tokens/primitives.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { APCAcontrast, sRGBtoY } from "apca-w3";
import { parse, converter, inGamut } from "culori";
import { BACKDROP, HUE, deriveOn } from "./primitives";

const toRgb = converter("rgb");
const rgbInGamut = inGamut("rgb");
function y(oklch: string): number {
  const c = toRgb(parse(oklch))!;
  const k = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));
  return sRGBtoY([k(c.r), k(c.g), k(c.b)]);
}

describe("primitives", () => {
  it("light backdrop is a warm light beige", () => {
    const c = toRgb(parse(BACKDROP.light.bg))!;
    expect(Math.min(c.r, c.g, c.b)).toBeGreaterThan(0.85);
  });
  it("deriveOn hits target Lc on light bg and stays in sRGB gamut", () => {
    const fg = deriveOn(BACKDROP.light.bg, 75, HUE.neutral.h, HUE.neutral.c, "darker");
    expect(Math.abs(APCAcontrast(y(fg), y(BACKDROP.light.bg)))).toBeGreaterThanOrEqual(70);
    expect(rgbInGamut(parse(fg))).toBe(true);
  });
  it("chromatic accent stays in gamut via maxChroma", () => {
    const accent = deriveOn(BACKDROP.light.bg, 45, HUE.accent.h, HUE.accent.c, "darker");
    expect(rgbInGamut(parse(accent))).toBe(true);
  });
  it("deriveOn on dark bg yields lighter text (negative raw Lc)", () => {
    const fg = deriveOn(BACKDROP.dark.bg, 75, HUE.neutral.h, HUE.neutral.c, "lighter");
    expect(APCAcontrast(y(fg), y(BACKDROP.dark.bg))).toBeLessThan(0);
  });
});
```

- [ ] **Step 2: Запустить — падает** → `pnpm test src/styles/tokens/primitives.test.ts`

- [ ] **Step 3: Реализовать**

Create `src/styles/tokens/primitives.ts`:
```ts
import { apcach, apcachToCss, crToBg, maxChroma } from "apcach";

export type ThemeMode = "light" | "dark";

export const BACKDROP: Record<ThemeMode, { bg: string; bgSubtle: string; bgRaised: string }> = {
  light: { bg: "oklch(0.96 0.012 80)", bgSubtle: "oklch(0.90 0.016 80)", bgRaised: "oklch(0.985 0.008 80)" },
  dark:  { bg: "oklch(0.21 0.018 250)", bgSubtle: "oklch(0.27 0.02 250)", bgRaised: "oklch(0.25 0.02 250)" },
};

export const HUE = {
  neutral: { h: 80,  c: 0.012 },
  accent:  { h: 70,  c: 0.14 },
  link:    { h: 250, c: 0.13 },
  danger:  { h: 27,  c: 0.2 },
  success: { h: 149, c: 0.16 },
  warning: { h: 75,  c: 0.16 },
  info:    { h: 250, c: 0.12 },
} as const;

/** oklch-цвет с |Lc| ≈ targetLc против фона; maxChroma() держит результат в gamut. */
export function deriveOn(
  bgOklch: string, targetLc: number, hue: number, chroma: number,
  dir: "lighter" | "darker" | "auto" = "auto",
): string {
  const color = apcach(crToBg(bgOklch, targetLc, "apca", dir), maxChroma(chroma), hue);
  return apcachToCss(color, "oklch");
}
```
Примечание: `bg-subtle` для light сделан заметно темнее bg (L0.90 vs 0.96), чтобы (а) hover/highlight-поверхности были различимы (закрывает регресс Select highlighted), (б) текст на bg-subtle сохранял Lc-запас.

- [ ] **Step 4: Запустить — проходит** (подстроить backdrop/dir, если in-gamut/Lc не сходится) → коммит
```bash
git add src/styles/tokens/primitives.ts src/styles/tokens/primitives.test.ts
git commit -m "feat(styles): OKLCH primitives + in-gamut apcach derivation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Semantic-модель (`semantic.ts`)

**Files:** Create `src/styles/tokens/semantic.ts`, Test `src/styles/tokens/semantic.test.ts`

**Interfaces:**
- Consumes: `BACKDROP`, `HUE`, `deriveOn`, `ThemeMode` (Task 4); `ColorTokenName` (Task 3); `Contrast` (enums).
- Produces: `buildColorLayer(theme, contrast): Record<ColorTokenName, string>`; `COLOR_LAYERS` (4 комбинации).
- **Политика fg:** fg-семейство деривируется против НАИХУДШЕГО (наименее контрастного) фона из {surface, surface-subtle, surface-raised}, т.к. гард ассертит fg на всех трёх. Для light худший = самый светлый фон → surface-raised. Деривируем fg против него, проверяем на всех. (Для dark — наоборот, самый тёмный фон → surface-subtle.) Внутренние поля `BACKDROP` (`bg/bgSubtle/bgRaised`) — это значения этих поверхностей; имена полей внутренние, в токены не протекают.
- accent усиливается в high; тинты статусов — с явным направлением по теме.

- [ ] **Step 1: Тест полноты + high≠normal**

Create `src/styles/tokens/semantic.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { COLOR_LAYERS, buildColorLayer } from "./semantic";
import { CONTRAST_PAIRS, type ColorTokenName } from "./apca-targets";

const ALL: ColorTokenName[] = [
  "surface","surface-subtle","surface-raised","surface-overlay","fg","fg-muted","fg-subtle","fg-on-accent",
  "border","border-strong","ring","accent","accent-hover","accent-fg","link","link-hover",
  "danger","danger-bg","danger-fg","success","success-bg","success-fg",
  "warning","warning-bg","warning-fg","info","info-bg","info-fg",
];

describe("semantic color layers", () => {
  it("defines all 4 combos", () => {
    expect(Object.keys(COLOR_LAYERS).sort()).toEqual(["dark-high","dark-normal","light-high","light-normal"].sort());
  });
  it("every layer defines every token as oklch", () => {
    for (const layer of Object.values(COLOR_LAYERS))
      for (const t of ALL) expect(layer[t], t).toMatch(/^oklch\(/);
  });
  it("high differs from normal", () => {
    const n = buildColorLayer("light","normal"), h = buildColorLayer("light","high");
    expect(ALL.some((t) => n[t] !== h[t])).toBe(true);
  });
  it("CONTRAST_PAIRS reference only known tokens", () => {
    const names = new Set(ALL);
    for (const p of CONTRAST_PAIRS) { expect(names.has(p.fg)).toBe(true); expect(names.has(p.bg)).toBe(true); }
  });
});
```

- [ ] **Step 2: Запустить — падает**

- [ ] **Step 3: Реализовать**

Create `src/styles/tokens/semantic.ts`:
```ts
import { BACKDROP, HUE, deriveOn, type ThemeMode } from "./primitives";
import type { ColorTokenName } from "./apca-targets";
import type { Contrast } from "./enums";

function targets(contrast: Contrast) {
  const boost = contrast === "high" ? 15 : 0;
  return {
    fg: 90, fgMuted: Math.min(90, 60 + boost), fgSubtle: 30 + boost,
    link: 60 + boost, accentFg: 60 + boost,
    border: 15 + boost, borderStrong: 30 + boost, ring: 45 + boost,
    accentFill: 45 + boost, status: 60 + boost, statusOnTint: 60 + boost, tint: 8,
  };
}

export function buildColorLayer(theme: ThemeMode, contrast: Contrast): Record<ColorTokenName, string> {
  const bd = BACKDROP[theme];
  const t = targets(contrast);
  const dirFg = theme === "light" ? "darker" : "lighter";
  const dirTint = theme === "light" ? "darker" : "lighter"; // тинт явно по теме (не auto)
  // fg-семейство деривируем против наименее контрастного фона:
  const worstFg = theme === "light" ? bd.bgRaised : bd.bgSubtle;

  const accent = deriveOn(bd.bg, t.accentFill, HUE.accent.h, HUE.accent.c, dirFg);
  const accentHover = deriveOn(bd.bg, t.accentFill + 10, HUE.accent.h, HUE.accent.c, dirFg);

  const dangerBg = deriveOn(bd.bg, t.tint, HUE.danger.h, HUE.danger.c * 0.3, dirTint);
  const successBg = deriveOn(bd.bg, t.tint, HUE.success.h, HUE.success.c * 0.3, dirTint);
  const warningBg = deriveOn(bd.bg, t.tint, HUE.warning.h, HUE.warning.c * 0.3, dirTint);
  const infoBg = deriveOn(bd.bg, t.tint, HUE.info.h, HUE.info.c * 0.3, dirTint);

  return {
    surface: bd.bg, "surface-subtle": bd.bgSubtle, "surface-raised": bd.bgRaised,
    "surface-overlay": theme === "light" ? "oklch(0.21 0.018 250 / 0.45)" : "oklch(0 0 0 / 0.6)",

    fg: deriveOn(worstFg, t.fg, HUE.neutral.h, HUE.neutral.c, dirFg),
    "fg-muted": deriveOn(worstFg, t.fgMuted, HUE.neutral.h, HUE.neutral.c, dirFg),
    "fg-subtle": deriveOn(bd.bg, t.fgSubtle, HUE.neutral.h, HUE.neutral.c, dirFg),
    "fg-on-accent": deriveOn(accent, t.accentFg, HUE.neutral.h, 0.0, "auto"),

    border: deriveOn(bd.bg, t.border, HUE.neutral.h, HUE.neutral.c, dirFg),
    "border-strong": deriveOn(bd.bg, t.borderStrong, HUE.neutral.h, HUE.neutral.c, dirFg),
    // ring — нейтральный (не accent-hue), чтобы оставаться различимым на любой поверхности
    ring: deriveOn(bd.bg, t.ring, HUE.link.h, HUE.link.c, dirFg),

    accent, "accent-hover": accentHover,
    "accent-fg": deriveOn(accent, t.accentFg, HUE.neutral.h, 0.0, "auto"),

    link: deriveOn(bd.bg, t.link, HUE.link.h, HUE.link.c, dirFg),
    "link-hover": deriveOn(bd.bg, t.link + 10, HUE.link.h, HUE.link.c, dirFg),

    danger: deriveOn(bd.bg, t.status, HUE.danger.h, HUE.danger.c, dirFg),
    "danger-bg": dangerBg,
    "danger-fg": deriveOn(dangerBg, t.statusOnTint, HUE.danger.h, HUE.danger.c, dirFg),
    success: deriveOn(bd.bg, t.status, HUE.success.h, HUE.success.c, dirFg),
    "success-bg": successBg,
    "success-fg": deriveOn(successBg, t.statusOnTint, HUE.success.h, HUE.success.c, dirFg),
    warning: deriveOn(bd.bg, t.status, HUE.warning.h, HUE.warning.c, dirFg),
    "warning-bg": warningBg,
    "warning-fg": deriveOn(warningBg, t.statusOnTint, HUE.warning.h, HUE.warning.c, dirFg),
    info: deriveOn(bd.bg, t.status, HUE.info.h, HUE.info.c, dirFg),
    "info-bg": infoBg,
    "info-fg": deriveOn(infoBg, t.statusOnTint, HUE.info.h, HUE.info.c, dirFg),
  };
}

export const COLOR_LAYERS = {
  "light-normal": buildColorLayer("light", "normal"),
  "light-high": buildColorLayer("light", "high"),
  "dark-normal": buildColorLayer("dark", "normal"),
  "dark-high": buildColorLayer("dark", "high"),
} as const;
```
Примечание: `fg-on-accent` и `accent-fg` оба должны проходить против `accent` И `accent-hover` (пары в Task 3). Т.к. accent-hover контрастнее accent (Lc 55 vs 45 к bg), текст, подобранный против accent, на accent-hover будет ещё контрастнее — порядок сохраняется. Если гард красит — деривировать `*-on-accent` против accent-hover (худший случай для светлого текста).

- [ ] **Step 4: Запустить — проходит → коммит**
```bash
git add src/styles/tokens/semantic.ts src/styles/tokens/semantic.test.ts
git commit -m "feat(styles): semantic color layers (worst-bg fg, explicit tint dir, high boost, neutral ring)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Сборка модели (`index.ts`)

**Files:** Create `src/styles/tokens/index.ts`, Test `src/styles/tokens/index.test.ts`

**Interfaces:** Produces `TOKENS = { colorLayers, scales }`; реэкспорт `ColorTokenName`, `CONTRAST_PAIRS`.

- [ ] **Step 1: Тест** — `src/styles/tokens/index.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { TOKENS } from "./index";
describe("TOKENS", () => {
  it("bundles layers + scales", () => {
    expect(TOKENS.colorLayers["light-normal"].fg).toMatch(/^oklch\(/);
    expect(TOKENS.scales.TYPE_SCALE.base.size).toBe("1rem");
  });
});
```
- [ ] **Step 2: Падает** → `pnpm test src/styles/tokens/index.test.ts`
- [ ] **Step 3: Реализовать** — `src/styles/tokens/index.ts`:
```ts
import { COLOR_LAYERS } from "./semantic";
import { TYPE_SCALE, RADIUS, SHADOW, Z, DURATION, DENSITY, FONT_STACKS, TEXT_SCALE } from "./scales";

export const TOKENS = {
  colorLayers: COLOR_LAYERS,
  scales: { TYPE_SCALE, RADIUS, SHADOW, Z, DURATION, DENSITY, FONT_STACKS, TEXT_SCALE },
} as const;

export type { ColorTokenName } from "./apca-targets";
export { CONTRAST_PAIRS } from "./apca-targets";
```
- [ ] **Step 4: Проходит → коммит**
```bash
git add src/styles/tokens/index.ts src/styles/tokens/index.test.ts
git commit -m "feat(styles): assemble TOKENS model

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: APCA CI-гард (`apca.test.ts`)

**Files:** Create `src/styles/tokens/apca.test.ts`

- [ ] **Step 1: Гард + само-проверка** — `src/styles/tokens/apca.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { APCAcontrast, sRGBtoY } from "apca-w3";
import { parse, converter } from "culori";
import { TOKENS, CONTRAST_PAIRS } from "./index";

const toRgb = converter("rgb");
function lc(fg: string, bg: string): number {
  const f = toRgb(parse(fg))!, b = toRgb(parse(bg))!;
  const k = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));
  return APCAcontrast(sRGBtoY([k(f.r), k(f.g), k(f.b)]), sRGBtoY([k(b.r), k(b.g), k(b.b)]));
}
const COMBOS = ["light-normal","light-high","dark-normal","dark-high"] as const;

describe("APCA guardrail", () => {
  for (const combo of COMBOS) {
    const layer = TOKENS.colorLayers[combo];
    for (const p of CONTRAST_PAIRS) {
      it(`[${combo}] ${p.fg} on ${p.bg} ≥ Lc ${p.minLc} (${p.note})`, () => {
        expect(Math.abs(lc(layer[p.fg], layer[p.bg]))).toBeGreaterThanOrEqual(p.minLc);
      });
    }
  }
  it("self-check: rejects bg-on-bg (Lc≈0)", () => {
    const bg = TOKENS.colorLayers["light-normal"].bg;
    expect(Math.abs(lc(bg, bg))).toBeLessThan(75);
  });
});
```
- [ ] **Step 2: Запустить** → `pnpm test src/styles/tokens/apca.test.ts`. PASS. Если пара красная — подстроить деривацию в Task 5 (целевой Lc/dir/chroma/худший фон), НЕ ослаблять minLc. Особое внимание: `fg на bg-raised` (light) и `fg на bg-subtle` (dark) — наихудшие фоны.
- [ ] **Step 3: Коммит**
```bash
git add src/styles/tokens/apca.test.ts
git commit -m "test(styles): APCA Lc guardrail over all pairs × combos

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Генератор CSS + build-цепочка + freshness в src/

**Files:**
- Create: `scripts/generate-tokens.mjs`, `src/styles/tokens.generated.css` (output), `src/styles/tokens/generated-css.test.ts`
- Modify: `package.json` (scripts: `generate:tokens`, `build` через `&&`)

**Interfaces:** Эмитит CSS: `@theme` (не-цветовые шкалы → утилиты Tailwind), `@theme inline` (цвет/шрифт-маппинг), `:root` (light-normal + default density/font), `@media dark`, `[data-theme]`, **отдельные** `[data-contrast="high"]` и `@media (prefers-contrast: more){:root:not([data-contrast="normal"])}`, `[data-density="compact"]`, `[data-font]`.

- [ ] **Step 1: `tsx` + build-цепочка (БЕЗ prebuild)**

Run: `pnpm add -D tsx`
Modify `package.json`:
- добавить `"generate:tokens": "tsx scripts/generate-tokens.mjs"`
- заменить `"build"` на: `"build": "node scripts/generate-sw-assets.mjs && tsx scripts/generate-tokens.mjs && next build"` (встроено в цепочку — pnpm@8 не запускает prebuild).
- НЕ добавлять `prebuild`.

- [ ] **Step 2: Реализовать генератор (валидный high-contrast CSS)**

Create `scripts/generate-tokens.mjs`:
```js
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOKENS } from "../src/styles/tokens/index.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { colorLayers, scales } = TOKENS;
const colorVars = (layer) => Object.entries(layer).map(([k, v]) => `  --${k}: ${v};`).join("\n");

// Не-цветовые шкалы → в @theme (Tailwind строит из них утилиты text-*/rounded-*/...).
const themeScales = () => {
  const L = [];
  for (const [s, { size, line }] of Object.entries(scales.TYPE_SCALE)) {
    L.push(`  --text-${s}: ${size};`, `  --text-${s}--line-height: ${line};`);
  }
  for (const [k, v] of Object.entries(scales.RADIUS)) L.push(`  --radius-${k}: ${v};`);
  for (const [k, v] of Object.entries(scales.SHADOW)) L.push(`  --shadow-${k}: ${v};`);
  for (const [k, v] of Object.entries(scales.DURATION)) L.push(`  --duration-${k}: ${v};`);
  for (const [k, v] of Object.entries(scales.Z)) L.push(`  --z-${k}: ${v};`);
  // px-брейкпоинты + header
  L.push(`  --breakpoint-sm: 640px;`, `  --breakpoint-md: 768px;`, `  --breakpoint-lg: 1024px;`,
         `  --breakpoint-xl: 1280px;`, `  --breakpoint-2xl: 1536px;`, `  --spacing-header: 50px;`);
  return L.join("\n");
};

// Цвет + шрифт → @theme inline (utility ссылается на рантайм-var, переключаемую через data-*).
const themeInline = () => {
  const names = Object.keys(colorLayers["light-normal"]);
  return `@theme inline {\n${names.map((n) => `  --color-${n}: var(--${n});`).join("\n")}\n  --font-ui: var(--app-font);\n}`;
};

const densityVars = (name) => {
  const d = scales.DENSITY[name];
  return [
    `  --size-control-h-sm: ${d.controlH.sm};`, `  --size-control-h-md: ${d.controlH.md};`,
    `  --size-control-h-lg: ${d.controlH.lg};`, `  --space-control-pad-x: ${d.padX};`,
    `  --space-control-pad-y: ${d.padY};`, `  --space-stack: ${d.stack};`,
  ].join("\n");
};

const css = `/* AUTO-GENERATED by scripts/generate-tokens.mjs — DO NOT EDIT.
   Source: src/styles/tokens/*. Run \`pnpm generate:tokens\`. */

@theme {
${themeScales()}
}

${themeInline()}

:root {
${colorVars(colorLayers["light-normal"])}
${densityVars("comfortable")}
  --app-font: ${scales.FONT_STACKS.sans};
}

@media (prefers-color-scheme: dark) {
  :root {
${colorVars(colorLayers["dark-normal"]).replace(/^/gm, "  ")}
  }
}

[data-theme="dark"] {
${colorVars(colorLayers["dark-normal"])}
}

[data-theme="light"] {
${colorVars(colorLayers["light-normal"])}
}

/* high-contrast: ДВА независимых правила (нельзя смешивать селектор и @media). */
[data-contrast="high"] {
${colorVars(colorLayers["light-high"])}
}
[data-theme="dark"][data-contrast="high"] {
${colorVars(colorLayers["dark-high"])}
}
@media (prefers-contrast: more) {
  :root:not([data-contrast="normal"]) {
${colorVars(colorLayers["light-high"]).replace(/^/gm, "  ")}
  }
}

[data-density="compact"] {
${densityVars("compact")}
}

[data-font="legible"] { --app-font: ${scales.FONT_STACKS.legible}; }
[data-font="serif"]   { --app-font: ${scales.FONT_STACKS.serif}; }
`;

writeFileSync(resolve(root, "src/styles/tokens.generated.css"), css);
console.log("[generate-tokens] wrote src/styles/tokens.generated.css");
```

- [ ] **Step 3: Сгенерировать** → `pnpm generate:tokens`. Файл создан.

- [ ] **Step 4: Freshness/структура-тест В src/ (vitest его видит)**

Create `src/styles/tokens/generated-css.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "src/styles/tokens.generated.css"), "utf-8");

describe("tokens.generated.css", () => {
  it("has theme + inline + override layers", () => {
    expect(css).toContain("@theme {");
    expect(css).toContain("@theme inline");
    expect(css).toContain("--color-fg: var(--fg)");
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('[data-density="compact"]');
    expect(css).toContain('[data-font="serif"]');
  });
  it("high-contrast is a standalone rule, NOT a selector+@media list (valid CSS)", () => {
    expect(css).toContain('[data-contrast="high"] {');
    expect(css).not.toMatch(/,\s*\n\s*@media/); // запятая перед @media = невалидно
    expect(css).toContain(':root:not([data-contrast="normal"])');
  });
});
```
Run: `pnpm test src/styles/tokens/generated-css.test.ts` → PASS.

- [ ] **Step 5: CI drift-guard (.github/workflows/ci.yml)**

Modify `.github/workflows/ci.yml`: после шага установки зависимостей, перед/рядом с lint, добавить шаг:
```yaml
      - name: Token CSS is fresh
        run: pnpm generate:tokens && git diff --exit-code src/styles/tokens.generated.css
```
(Адаптировать под реальную структуру job'а. `.github/` не в запретных зонах CLAUDE.md.)

- [ ] **Step 6: Коммит**
```bash
git add scripts/generate-tokens.mjs src/styles/tokens.generated.css src/styles/tokens/generated-css.test.ts package.json pnpm-lock.yaml .github/workflows/ci.yml
git commit -m "feat(styles): token CSS generator (valid high-contrast), build-chain + CI drift guard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Фаза-гейт** → `pnpm lint && pnpm test && pnpm build`. Всё зелёное; `git status` чист по `tokens.generated.css`.

---

# ФАЗА 2 — Рантайм темизации (no-FOUC, 4 оси)

### Task 9: Модель appearance + чтение cookie

**Files:** Create `src/components/appearance/appearance-cookie.ts`, `src/utils/appearance.ts`; Test `src/components/appearance/appearance-cookie.test.ts`, `src/utils/appearance.test.ts`

**Interfaces:**
- Produces: `Appearance = { theme; contrast; density; font; textSize }` (типы из `enums.ts`); `DEFAULT_APPEARANCE`; `APPEARANCE_COOKIE="appearance"`; `parseAppearance(raw)`; `serializeAppearance(a)`; `getAppearance()` (server); `htmlAttrs(a)`.

- [ ] **Step 1: Тест cookie-модуля** — `src/components/appearance/appearance-cookie.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_APPEARANCE, parseAppearance, serializeAppearance, htmlAttrs } from "./appearance-cookie";

describe("appearance-cookie", () => {
  it("defaults on undefined/garbage", () => {
    expect(parseAppearance(undefined)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance("not-json")).toEqual(DEFAULT_APPEARANCE);
  });
  it("round-trips valid appearance", () => {
    const a = { theme: "dark", contrast: "high", density: "compact", font: "serif", textSize: "lg" } as const;
    expect(parseAppearance(serializeAppearance(a))).toEqual(a);
  });
  it("coerces unknown per field", () => {
    const a = parseAppearance(JSON.stringify({ theme: "neon", textSize: "huge" }));
    expect(a.theme).toBe("system"); expect(a.textSize).toBe("md");
  });
  it("htmlAttrs omits data-theme for system, sets color-scheme", () => {
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, theme: "system" })["data-theme"]).toBeUndefined();
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, theme: "system" }).colorScheme).toBe("light dark");
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, theme: "dark" })["data-theme"]).toBe("dark");
  });
  it("htmlAttrs maps textSize → --text-scale", () => {
    expect(htmlAttrs({ ...DEFAULT_APPEARANCE, textSize: "xl" }).style["--text-scale"]).toBe("1.25");
  });
});
```
- [ ] **Step 2: Падает** → `pnpm test src/components/appearance/appearance-cookie.test.ts`
- [ ] **Step 3: Реализовать** — `src/components/appearance/appearance-cookie.ts`:
```ts
import { TEXT_SCALE } from "@/styles/tokens/scales";
import { THEMES, CONTRASTS, DENSITIES, FONTS, TEXT_SIZES,
  type Theme, type Contrast, type Density, type FontChoice, type TextSize } from "@/styles/tokens/enums";

export type Appearance = { theme: Theme; contrast: Contrast; density: Density; font: FontChoice; textSize: TextSize };
export const APPEARANCE_COOKIE = "appearance";
export const DEFAULT_APPEARANCE: Appearance = { theme: "system", contrast: "normal", density: "comfortable", font: "sans", textSize: "md" };

const ENUMS = { theme: THEMES, contrast: CONTRASTS, density: DENSITIES, font: FONTS, textSize: TEXT_SIZES } as const;
function pick<K extends keyof Appearance>(key: K, value: unknown): Appearance[K] {
  return (ENUMS[key] as readonly string[]).includes(value as string) ? (value as Appearance[K]) : DEFAULT_APPEARANCE[key];
}
export function parseAppearance(raw: string | undefined): Appearance {
  if (!raw) return DEFAULT_APPEARANCE;
  let o: Record<string, unknown>;
  try { o = JSON.parse(raw) as Record<string, unknown>; } catch { return DEFAULT_APPEARANCE; }
  return { theme: pick("theme", o.theme), contrast: pick("contrast", o.contrast), density: pick("density", o.density), font: pick("font", o.font), textSize: pick("textSize", o.textSize) };
}
export function serializeAppearance(a: Appearance): string { return JSON.stringify(a); }
export function htmlAttrs(a: Appearance) {
  return {
    ...(a.theme !== "system" ? { "data-theme": a.theme } : {}),
    ...(a.contrast !== "normal" ? { "data-contrast": a.contrast } : {}),
    ...(a.density !== "comfortable" ? { "data-density": a.density } : {}),
    ...(a.font !== "sans" ? { "data-font": a.font } : {}),
    style: { "--text-scale": String(TEXT_SCALE[a.textSize]) } as Record<string, string>,
    colorScheme: a.theme === "system" ? "light dark" : a.theme,
  };
}
```
- [ ] **Step 4: Проходит** → `pnpm test src/components/appearance/appearance-cookie.test.ts`
- [ ] **Step 5: Тест+реализация `getAppearance`** — `src/utils/appearance.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const cookieStore = { get: vi.fn() };
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: () => Promise.resolve(cookieStore) }));
import { getAppearance } from "./appearance";
import { DEFAULT_APPEARANCE } from "@/components/appearance/appearance-cookie";

describe("getAppearance", () => {
  beforeEach(() => cookieStore.get.mockReset());
  it("defaults when absent", async () => { cookieStore.get.mockReturnValue(undefined); expect(await getAppearance()).toEqual(DEFAULT_APPEARANCE); });
  it("parses cookie", async () => { cookieStore.get.mockReturnValue({ value: JSON.stringify({ ...DEFAULT_APPEARANCE, theme: "dark" }) }); expect((await getAppearance()).theme).toBe("dark"); });
});
```
`src/utils/appearance.ts`:
```ts
import "server-only";
import { cookies } from "next/headers";
import { APPEARANCE_COOKIE, parseAppearance, type Appearance } from "@/components/appearance/appearance-cookie";

export async function getAppearance(): Promise<Appearance> {
  const store = await cookies();
  return parseAppearance(store.get(APPEARANCE_COOKIE)?.value);
}
// Reconcile-on-load (бэк авторитетен на свежей сессии) — добавляется в Task 21,
// когда появится бэк-контракт appearance. Пока cookie самодостаточен.
```
- [ ] **Step 6: Проходит → коммит**
```bash
git add src/components/appearance/appearance-cookie.ts src/components/appearance/appearance-cookie.test.ts src/utils/appearance.ts src/utils/appearance.test.ts
git commit -m "feat(appearance): cookie model + server getAppearance() (shared enums)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: globals.css + compat-shim в одном коммите (без окна слома)

**Files:** Modify `src/app/globals.css`; Create `src/styles/themes/compat.css`, `src/styles/content.css` (заглушка)

**Interfaces:** Подключает `tokens.generated.css` + compat-shim АТОМАРНО, чтобы на main не было коммита со сломанным визуалом (старые имена сразу алиасятся на новые).

- [ ] **Step 1: Создать compat-shim** — `src/styles/themes/compat.css`:
```css
/* ВРЕМЕННЫЙ shim миграции. Старые имена = алиасы новых semantic.
   Удаляется в Task 18 после полной миграции. Имена, совпадающие с новыми
   (--color-border/-link/-danger/-danger-bg/-success), уже эмитит @theme inline. */
:root {
  --color-background: var(--color-surface);
  --color-foreground: var(--color-fg);
  --color-description: var(--color-fg-muted);
  --color-text-pane: var(--color-surface-subtle);
  --color-primary: var(--color-accent);
  --color-danger-fill: var(--color-danger);
  --color-danger-fill-hover: var(--color-danger);
}
/* NB: --color-surface НЕ алиасим — это реальный новый базовый токен (эмитит @theme inline);
   существующий bg-(--color-surface) в lazy-ast-editor.tsx резолвится в него напрямую. */
```
- [ ] **Step 2: Заглушка content.css** → `printf '/* .content — populated in Task 14 */\n' > src/styles/content.css`
- [ ] **Step 3: Переписать globals.css** (сохранив существующие global-правила: scroll-margin, fancy-link, router-link-wave, sensitive-image, body:has dialog):
```css
@import "tailwindcss";

@import "../styles/tokens.generated.css";
@import "../styles/themes/compat.css";
@import "../styles/content.css";

/* Глобальная ось размера текста: масштабирует все rem (вкл. type-утилиты). */
html { font-size: calc(100% * var(--text-scale, 1)); }

:root { --header-height: var(--spacing-header); }
/* NB: color-scheme НЕ задаём в :root — единственный источник = inline-style на <html> из htmlAttrs (Task 11). */

@media (forced-colors: active) {
  :root {
    --color-accent: AccentColor; --color-surface: Canvas; --color-fg: CanvasText;
    --color-border: ButtonBorder; --color-link: LinkText; --color-fg-muted: GrayText;
  }
  *::target-text { background-color: Highlight; color: HighlightText; }
}

/* ── существующие глобальные правила: перенести из старого globals.css дословно ── */
* { scroll-margin-top: var(--spacing-header); scrollbar-color: var(--color-border) transparent;
    &::target-text { background-color: var(--color-accent); color: #fff; } }
body:has(dialog[open]) { overflow: hidden; }
/* … .fancy-link, @keyframes router-link-wave, .router-link(+reduced-motion), .sensitive-image — дословно … */
```
Примечание: `@theme`-блок с брейкпоинтами/`--spacing-header` теперь в `tokens.generated.css` — отдельный `@theme` в globals НЕ нужен. Старый `@import rebus.css` убран.
- [ ] **Step 4: Сборка** → `pnpm build && pnpm test`. Успех; приложение визуально не сломано (старые имена резолвятся через compat в новую палитру).
- [ ] **Step 5: Коммит (атомарно)**
```bash
git add src/app/globals.css src/styles/themes/compat.css src/styles/content.css
git commit -m "feat(styles): wire generated tokens + compat shim atomically; px breakpoints; text-scale

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Шрифты (cyrillic-safe) + применение appearance на `<html>`

**Files:** Modify `src/app/layout.tsx`

- [ ] **Step 1: Проверить subsets (допущение к валидации)** — до правок убедиться, что у `Atkinson_Hyperlegible` НЕТ `cyrillic` (ожидаемо `latin`/`latin-ext`), а у `Source_Serif_4` cyrillic есть. Источник истины — ошибка `next/font` на сборке.
- [ ] **Step 2: Объявить шрифты и применить атрибуты** — Modify `src/app/layout.tsx`:
```ts
import { Geist, Geist_Mono, Atkinson_Hyperlegible, Source_Serif_4 } from "next/font/google";
import { getAppearance } from "@/utils/appearance";
import { htmlAttrs } from "@/components/appearance/appearance-cookie";
import { AppearanceProvider } from "@/components/appearance";
```
```ts
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "cyrillic"] }); // +cyrillic для legible-фоллбека
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const atkinson = Atkinson_Hyperlegible({ variable: "--font-atkinson", weight: ["400", "700"], subsets: ["latin", "latin-ext"] });
const sourceSerif = Source_Serif_4({ variable: "--font-serif", subsets: ["latin", "cyrillic"] });
```
В `RootLayout` (после получения `me`):
```ts
const appearance = await getAppearance();
const { style, colorScheme, ...dataAttrs } = htmlAttrs(appearance);
```
На `<html>`: `<html lang="ru" {...dataAttrs} style={{ ...style, colorScheme }}>`.
В `className` body добавить `${atkinson.variable} ${sourceSerif.variable}` к существующим font-переменным; заменить жёсткий `font-[family-name:var(--font-geist-sans)]` на `style={{ fontFamily: "var(--font-ui)" }}` на `<body>` (или класс `font-(family-name:--font-ui)`).
Обернуть содержимое `<body>` в `<AppearanceProvider initial={appearance}>…</AppearanceProvider>` (снаружи ToastProvider).
`bg-(--color-background)` оставить (резолвится через compat) — переименуется кодмодом в Task 16.
- [ ] **Step 3: Сборка** → `pnpm build && pnpm test`. Успех. (no-FOUC проверить вручную после Task 12.)
- [ ] **Step 4: Коммит**
```bash
git add src/app/layout.tsx
git commit -m "feat(appearance): cyrillic-safe fonts + SSR data-attrs/color-scheme on <html>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: AppearanceProvider + сеттеры (динамические ключи, тест system)

**Files:** Create `src/components/appearance/appearance-provider.tsx`, `src/components/appearance/index.ts`; Test `src/components/appearance/appearance-provider.test.tsx`

**Interfaces:** `<AppearanceProvider initial>`, `useAppearance(): { appearance; setAxis }`. `setAxis` оптимистичен: мутирует `<html>` (var-swap) → cookie → `persistAppearance`. `applyToHtml` перебирает data-ключи ДИНАМИЧЕСКИ (без хардкод-массива).

- [ ] **Step 1: Тест (вкл. обратный переход в system)** — `src/components/appearance/appearance-provider.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppearanceProvider, useAppearance } from "./appearance-provider";
import { DEFAULT_APPEARANCE } from "./appearance-cookie";

vi.mock("./persist-appearance", () => ({ persistAppearance: vi.fn() }));

function Probe() {
  const { appearance, setAxis } = useAppearance();
  return (<>
    <span data-testid="theme">{appearance.theme}</span>
    <button onClick={() => setAxis("theme", "dark")}>dark</button>
    <button onClick={() => setAxis("theme", "system")}>system</button>
    <button onClick={() => setAxis("density", "compact")}>compact</button>
  </>);
}

describe("AppearanceProvider", () => {
  beforeEach(() => { document.documentElement.removeAttribute("data-theme"); document.documentElement.removeAttribute("data-density"); document.cookie = ""; });
  it("exposes initial", () => { render(<AppearanceProvider initial={DEFAULT_APPEARANCE}><Probe/></AppearanceProvider>); expect(screen.getByTestId("theme").textContent).toBe("system"); });
  it("setAxis mutates <html> + state", () => { render(<AppearanceProvider initial={DEFAULT_APPEARANCE}><Probe/></AppearanceProvider>); fireEvent.click(screen.getByText("dark")); expect(document.documentElement.getAttribute("data-theme")).toBe("dark"); expect(screen.getByTestId("theme").textContent).toBe("dark"); });
  it("explicit→system removes data-theme + sets color-scheme", () => { render(<AppearanceProvider initial={{ ...DEFAULT_APPEARANCE, theme: "dark" }}><Probe/></AppearanceProvider>); fireEvent.click(screen.getByText("system")); expect(document.documentElement.hasAttribute("data-theme")).toBe(false); expect(document.documentElement.style.colorScheme).toBe("light dark"); });
  it("writes cookie", () => { render(<AppearanceProvider initial={DEFAULT_APPEARANCE}><Probe/></AppearanceProvider>); fireEvent.click(screen.getByText("compact")); expect(document.cookie).toContain("appearance="); });
});
```
- [ ] **Step 2: Падает** → `pnpm test src/components/appearance/appearance-provider.test.tsx`
- [ ] **Step 3: Реализовать** — `src/components/appearance/appearance-provider.tsx`:
```tsx
"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { type Appearance, APPEARANCE_COOKIE, htmlAttrs, serializeAppearance } from "./appearance-cookie";
import { persistAppearance } from "./persist-appearance";

type Ctx = { appearance: Appearance; setAxis: <K extends keyof Appearance>(k: K, v: Appearance[K]) => void };
const AppearanceContext = createContext<Ctx | null>(null);

const DATA_KEYS = ["data-theme", "data-contrast", "data-density", "data-font"] as const;
function applyToHtml(a: Appearance) {
  const el = document.documentElement;
  const { style, colorScheme, ...rest } = htmlAttrs(a);
  const data = rest as Record<string, string>;
  for (const key of DATA_KEYS) { const v = data[key]; if (v) el.setAttribute(key, v); else el.removeAttribute(key); }
  el.style.setProperty("--text-scale", style["--text-scale"]);
  el.style.colorScheme = colorScheme;
}

export function AppearanceProvider({ initial, children }: { initial: Appearance; children: React.ReactNode }) {
  const [appearance, setAppearance] = useState(initial);
  const setAxis = useCallback<Ctx["setAxis"]>((k, v) => {
    setAppearance((prev) => {
      const next = { ...prev, [k]: v };
      applyToHtml(next);
      document.cookie = `${APPEARANCE_COOKIE}=${encodeURIComponent(serializeAppearance(next))}; path=/; max-age=31536000; samesite=lax`;
      void persistAppearance(next);
      return next;
    });
  }, []);
  return <AppearanceContext.Provider value={{ appearance, setAxis }}>{children}</AppearanceContext.Provider>;
}
export function useAppearance(): Ctx {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
```
`src/components/appearance/index.ts`:
```ts
export { AppearanceProvider, useAppearance } from "./appearance-provider";
export type { Appearance } from "./appearance-cookie";
```
Примечание: `DATA_KEYS` синхронизирован с `htmlAttrs`; инвариант (множество ключей совпадает) держим через тест выше (любой новый data-атрибут потребует строки тут — покрыто тем, что тест проверяет применение).
- [ ] **Step 4: Проходит** (persist замокан) → `pnpm test src/components/appearance/appearance-provider.test.tsx`
- [ ] **Step 5: Коммит**
```bash
git add src/components/appearance/appearance-provider.tsx src/components/appearance/index.ts src/components/appearance/appearance-provider.test.tsx
git commit -m "feat(appearance): provider with optimistic html mutation + cookie write

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Бэк-синк (write-through, валидируемый, camel→snake)

**Files:** Create `src/components/appearance/persist-appearance.ts`; Test `src/components/appearance/persist-appearance.test.ts`

**Interfaces:** server action; маппит `Appearance` (camelCase) → snake_case payload, глотает ошибки (бэк-поля ещё не в контракте). Аноним → no-op.

- [ ] **Step 1: Тест** — `src/components/appearance/persist-appearance.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
const patch = vi.fn();
vi.mock("@/api/client", () => ({ createApiClient: () => Promise.resolve({ PATCH: patch }) }));
const getMe = vi.fn();
vi.mock("@/utils/me", () => ({ getMe }));
import { persistAppearance } from "./persist-appearance";
import { DEFAULT_APPEARANCE } from "./appearance-cookie";

describe("persistAppearance", () => {
  beforeEach(() => { patch.mockReset(); getMe.mockReset(); });
  it("maps camelCase→snake_case and PATCHes for authed user", async () => {
    getMe.mockResolvedValue({ id: "u1", status: "active", capabilities: [] });
    patch.mockResolvedValue({ data: {}, error: null });
    await persistAppearance({ ...DEFAULT_APPEARANCE, textSize: "lg" });
    expect(patch).toHaveBeenCalledWith("/api/me/preferences", { body: expect.objectContaining({ text_size: "lg" }) });
  });
  it("swallows backend errors (fields not yet in contract)", async () => {
    getMe.mockResolvedValue({ id: "u1", status: "active", capabilities: [] });
    patch.mockResolvedValue({ data: null, error: { code: "BAD_REQUEST" } });
    await expect(persistAppearance(DEFAULT_APPEARANCE)).resolves.toBeUndefined();
  });
  it("no-ops for anonymous", async () => { getMe.mockResolvedValue(null); await persistAppearance(DEFAULT_APPEARANCE); expect(patch).not.toHaveBeenCalled(); });
});
```
- [ ] **Step 2: Падает** → `pnpm test src/components/appearance/persist-appearance.test.ts`
- [ ] **Step 3: Реализовать** — `src/components/appearance/persist-appearance.ts`:
```ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { getMe } from "@/utils/me";
import type { Appearance } from "./appearance-cookie";

/** camelCase Appearance → snake_case payload бэка. */
function toPayload(a: Appearance) {
  return { theme: a.theme, contrast: a.contrast, density: a.density, font: a.font, text_size: a.textSize };
}

export async function persistAppearance(appearance: Appearance): Promise<void> {
  const me = await getMe();
  if (!me) return; // аноним — только cookie
  try {
    const api = await createApiClient();
    // Бэк-поля appearance ещё не в контракте → as never; снять в Task 21 после регена schema.ts.
    await api.PATCH("/api/me/preferences", { body: toPayload(appearance) as never });
  } catch { /* graceful: бэк может не знать про appearance */ }
}
```
- [ ] **Step 4: Проходит → коммит + фаза-гейт**
```bash
git add src/components/appearance/persist-appearance.ts src/components/appearance/persist-appearance.test.ts
git commit -m "feat(appearance): backend write-through (camel→snake, graceful)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
pnpm lint && pnpm test && pnpm build
```
Опционально: `pnpm dev` → DevTools, проверить мгновенное переключение и отсутствие FOUC (reload с cookie).

---

# ФАЗА 3 — Наложение: .content + полная миграция токенов

### Task 14: Слой `.content` (flow) + выпил `@tailwindcss/typography` + миграция prose

**Files:** Modify `src/styles/content.css`, `src/app/globals.css` (убрать `@plugin`), `package.json`; Modify 21 файл с `prose` (22 site)

**Interfaces:** `.content` — flow-слой на semantic-токенах; `data-size="sm"` (≈prose-sm); `.content--measure` (opt-in мера). Всё в одном коммите (атомарно: нельзя удалить плагин, не мигрировав prose).

- [ ] **Step 1: Наполнить `content.css`** (h1–h6, p, a, ul/ol/li, blockquote, code, pre, hr, img, table):
```css
@layer components {
  .content { color: var(--color-fg); font-family: var(--font-ui); font-size: var(--text-base); line-height: var(--text-base--line-height); --flow: var(--space-stack); }
  .content[data-size="sm"] { font-size: var(--text-sm); line-height: var(--text-sm--line-height); }
  .content--measure { max-inline-size: 65ch; }
  /* FLOW: односторонний логический margin — единственный механизм ритма. */
  .content > * + * { margin-block-start: var(--flow); }
  .content > :is(h1,h2,h3) { --flow: calc(var(--space-stack) * 1.75); }
  .content > :is(h4,h5,h6) { --flow: calc(var(--space-stack) * 1.25); }
  .content :is(h1,h2,h3,h4,h5,h6) { font-weight: 600; line-height: 1.2; }
  .content h1 { font-size: var(--text-3xl); } .content h2 { font-size: var(--text-2xl); }
  .content h3 { font-size: var(--text-xl); } .content h4 { font-size: var(--text-lg); }
  .content h5 { font-size: var(--text-base); } .content h6 { font-size: var(--text-sm); }
  .content a { color: var(--color-link); text-decoration: underline; }
  .content a:hover { color: var(--color-link-hover); }
  .content strong { font-weight: 600; }
  .content :is(ul,ol) { padding-inline-start: 1.5em; } .content ul { list-style: disc; } .content ol { list-style: decimal; }
  .content > :is(ul,ol) > li + li { margin-block-start: calc(var(--space-stack) * 0.4); }
  .content blockquote { border-inline-start: 3px solid var(--color-border-strong); padding-inline-start: 1em; color: var(--color-fg-muted); }
  .content code { font-family: var(--font-geist-mono), ui-monospace, monospace; font-size: 0.9em; background: var(--color-surface-subtle); padding: 0.1em 0.3em; border-radius: var(--radius-sm); }
  .content pre { font-family: var(--font-geist-mono), ui-monospace, monospace; background: var(--color-surface-subtle); padding: var(--space-control-pad-x); border-radius: var(--radius-md); overflow-x: auto; }
  .content pre code { background: none; padding: 0; }
  .content hr { border: 0; border-block-start: 1px solid var(--color-border); }
  .content img { max-width: 100%; height: auto; border-radius: var(--radius-md); }
  .content table { width: 100%; border-collapse: collapse; }
  .content :is(th,td) { border: 1px solid var(--color-border); padding: var(--space-control-pad-y) var(--space-control-pad-x); text-align: start; }
  .content th { font-weight: 600; background: var(--color-surface-subtle); }
}
```
- [ ] **Step 2: Убрать плагин** — в `globals.css` удалить `@plugin "@tailwindcss/typography";`; `pnpm remove @tailwindcss/typography`.
- [ ] **Step 3: Мигрировать 22 site (21 файл) `prose`→`.content`** — трансформация: `prose`→`content`; `prose prose-sm`→`content` + `data-size="sm"`; `max-w-none` убрать. Файлы (полный список — см. Task 14 исходного плана; здесь те же 22 строки):
  - saved-lecture-view.tsx:234; admin-comment-row.tsx:22; comment-anchor-context.tsx:36; comment-node-view.tsx:56; comment-revisions.tsx:30; form-detail.tsx:15; submission-detail.tsx:27; form-after-submit.tsx:11; form-field-input.tsx:22 **и** :27; active-banners.tsx:43; banner-revisions.tsx:40; annotation-card.tsx:37; annotation-revisions.tsx:41; annotation-admin-row.tsx:24; glossary-revisions.tsx:43; glossary-detail.tsx:22; document-revisions.tsx:33; document-detail.tsx:13; calendar-view.tsx:75; event-revisions.tsx:37; ast-editor.tsx:110.
  (Каждая замена: `prose[ prose-sm][ max-w-none][ прочие классы]` → `content[ прочие классы]` + `data-size="sm"` если был prose-sm. Прочие утилиты — `mt-1/mt-2/opacity-80/min-w-0/flex-1/font-medium/text-(--color-description)` — сохранить; `text-(--color-description)` оставить, переименуется кодмодом в Task 16.)
- [ ] **Step 4: Проверить** → `grep -rn "prose" src/ --include="*.tsx" --include="*.css"` = пусто.
- [ ] **Step 5: Сборка/линт/тест** → `pnpm build && pnpm lint && pnpm test`. `pnpm dev` — контент рендерится с flow-ритмом.
- [ ] **Step 6: Коммит (поимённо, БЕЗ git add по каталогу)**
```bash
git add src/styles/content.css src/app/globals.css package.json pnpm-lock.yaml \
  src/app/saved/saved-lecture-view.tsx \
  src/features/comments/ui/admin-comment-row.tsx src/features/comments/ui/comment-anchor-context.tsx \
  src/features/comments/ui/comment-node-view.tsx src/features/comments/ui/comment-revisions.tsx \
  src/features/forms/ui/form-detail.tsx src/features/forms/ui/submission-detail.tsx \
  src/features/forms/ui/form-after-submit.tsx src/features/forms/ui/form-field-input.tsx \
  src/features/banners/ui/active-banners.tsx src/features/banners/ui/banner-revisions.tsx \
  src/features/annotations/ui/annotation-card.tsx src/features/annotations/ui/annotation-revisions.tsx \
  src/features/annotations/ui/annotation-admin-row.tsx \
  src/features/glossary/ui/glossary-revisions.tsx src/features/glossary/ui/glossary-detail.tsx \
  src/features/documents/ui/document-revisions.tsx src/features/documents/ui/document-detail.tsx \
  src/features/events/ui/calendar-view.tsx src/features/events/ui/event-revisions.tsx \
  src/components/ast-editor/ast-editor.tsx
git commit -m "feat(styles): .content flow layer; drop @tailwindcss/typography; migrate 22 prose sites

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: UI-kit — миграция токенов + density-токены контролов

**Files:** Modify `src/components/ui/cn.ts` + конкретные файлы `src/components/ui/*`, которые хардкодят высоты/паддинги контролов или используют легаси-имена.

**Interfaces:** Эта задача — НЕ переименование (его сделает общий кодмод Task 16), а смысловые правки ui-kit: focus-ring → `--color-ring`, density-токены вместо хардкода высот, highlight-фон Select на различимый токен.

- [ ] **Step 1: `cn.ts`** — `FOCUS_RING_*`: `outline-(--color-foreground)` → `outline-(--color-ring)`. `SHELL_BASE`: `bg-(--color-background)` оставить как есть — кодмод Task 16 переименует `--color-background` → `--color-surface`. В этой задаче меняем ТОЛЬКО ring и size-токены; переименование surface/fg/etc. — кодмоду Task 16.
- [ ] **Step 2: Density-токены** — в `button.tsx`, `icon-button.tsx`, `text-input.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`: `h-8/h-10/h-12` → `h-(--size-control-h-sm/-md/-lg)`; `px-3`→`px-(--space-control-pad-x)`; `py-2`→`py-(--space-control-pad-y)` (только для контролов).
- [ ] **Step 3: Select highlight** — в `select.tsx` `data-[highlighted]:bg-(--color-text-pane)` → `data-[highlighted]:bg-(--color-surface-subtle)` (surface-subtle заметно отличается от surface, см. Task 4) — различимость hover сохранена. (Кодмод Task 16 переименовал бы `--color-text-pane` → `--color-surface-subtle` сам, но здесь меняем явно вместе с семантикой highlight.)
- [ ] **Step 3b: Danger-кнопка → solid-токены** (следствие Task 7) — в `button.tsx` вариант `danger` сейчас `bg-(--color-danger-fill) text-white`. Заменить на `bg-(--color-danger-solid) text-(--color-danger-on-solid)` (новые токены из Task 7: сплошная заливка, читаемая под светлым лейблом в ОБЕИХ темах; APCA-гард это проверяет). Это явная правда: одна `danger` не может быть и текстом-на-surface, и тёмной заливкой под светлый лейбл в dark. Поэтому здесь НЕ полагаемся на codemod (`--color-danger-fill`→`--color-danger`) для кнопки — мигрируем её на solid вручную; для остальных 2 файлов с `danger-fill` (не-кнопка, danger-текст) правило codemod `→ --color-danger` корректно.
- [ ] **Step 4: Сборка/тесты ui** → `pnpm build && pnpm test src/components/ui`. `pnpm dev` + DevTools `<html data-density="compact">` — контролы плотнее; danger-кнопка читаема в обеих темах.
- [ ] **Step 5: Коммит (поимённо — только реально изменённые файлы)**
```bash
git add src/components/ui/cn.ts src/components/ui/button.tsx src/components/ui/icon-button.tsx \
  src/components/ui/text-input.tsx src/components/ui/textarea.tsx src/components/ui/select.tsx \
  src/components/ui/checkbox.tsx
git commit -m "refactor(ui): focus-ring→--color-ring, density tokens, distinct Select highlight

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Codemod — полное переименование legacy-токенов по всему src/ (non-frozen)

**Files:** Create (temp) `scripts/migrate-legacy-tokens.mjs`; Modify все non-frozen файлы из rename-списка.

**Interfaces:** Детерминированный codemod по canonical rename map (вверху плана). Прогон на NON-frozen областях; frozen-зоны — отдельно в Task 17 (для аудируемости и санкции).

- [ ] **Step 1: Codemod-скрипт** — `scripts/migrate-legacy-tokens.mjs`:
```js
import { readFileSync, writeFileSync } from "node:fs";
// Порядок важен: -fill-hover до -fill.
// --color-surface НЕ в карте: это новое каноническое имя базовой поверхности
// (эмитится @theme inline), а не legacy — существующие ссылки на него уже валидны.
const MAP = [
  ["--color-danger-fill-hover", "--color-danger"],
  ["--color-danger-fill", "--color-danger"],
  ["--color-background", "--color-surface"],
  ["--color-foreground", "--color-fg"],
  ["--color-text-pane", "--color-surface-subtle"],
  ["--color-description", "--color-fg-muted"],
  ["--color-primary", "--color-accent"],
];
const files = process.argv.slice(2);
let changed = 0;
for (const f of files) {
  const src = readFileSync(f, "utf-8");
  let out = src;
  for (const [from, to] of MAP) out = out.split(from).join(to);
  if (out !== src) { writeFileSync(f, out); changed++; }
}
console.log(`[migrate-legacy-tokens] changed ${changed}/${files.length} files`);
```
- [ ] **Step 2: Собрать список NON-frozen файлов и прогнать**
```bash
FILES=$(grep -rlE -- '--color-(background|foreground|text-pane|description|primary|danger-fill)' src/ \
  --include='*.tsx' --include='*.ts' --include='*.css' \
  | grep -vE '^src/(app/admin|components/app|components/permission|components/shared|components/ui|styles/themes/compat\.css|app/layout\.tsx)' )
echo "$FILES" | xargs node scripts/migrate-legacy-tokens.mjs
```
(Исключены: frozen-зоны → Task 17; `components/ui` → уже трогали в Task 15, но кодмод их тоже переименует — включить их в этот прогон, убрав из grep -v; compat.css — НЕ трогать, это источник алиасов; layout.tsx → frozen, Task 17.)
- [ ] **Step 3: Проверить, что diff — только переименования** → `git diff --stat` ожидаемо ~120 файлов; выборочно `git diff <файл>` — только смена имён токенов.
- [ ] **Step 4: Сборка/линт/тест** → `pnpm build && pnpm lint && pnpm test`. Зелёное.
- [ ] **Step 5: Коммит (точный список из codemod, НЕ каталог)**
```bash
git add $(echo "$FILES") src/components/ui   # ui добавить поимённо если входили в прогон
git commit -m "refactor(styles): migrate legacy color tokens to new semantic (non-frozen)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
(`git add $(echo "$FILES")` добавляет ровно файлы, изменённые кодмодом — это «свои файлы по имени», не blanket-add. Перед add убедиться, что в списке нет файлов, параллельно правленных другими агентами с несвязанными изменениями.)

---

### Task 17: Codemod — frozen-зоны (санкционировано) + layout.tsx

**Files:** Modify `src/app/admin/*` (18), `src/components/app/*`, `src/components/permission/*`, `src/app/layout.tsx` — ТОЛЬКО переименование токенов.

**Interfaces:** Тот же codemod, отдельным аудируемым коммитом по запретным зонам (санкционировано в Global Constraints как единый foundation-PR).

- [ ] **Step 1: Прогнать codemod на frozen-зонах + layout**
```bash
FROZEN=$(grep -rlE -- '--color-(background|foreground|text-pane|description|primary|danger-fill)' \
  src/app/admin src/components/app src/components/permission src/components/shared src/app/layout.tsx \
  --include='*.tsx' --include='*.ts' --include='*.css')
echo "$FROZEN" | xargs node scripts/migrate-legacy-tokens.mjs
```
- [ ] **Step 2: Удалить временный codemod** → `rm scripts/migrate-legacy-tokens.mjs`
- [ ] **Step 3: Сборка/линт/тест** → `pnpm build && pnpm lint && pnpm test`. Зелёное.
- [ ] **Step 4: Коммит (поимённо)**
```bash
git add $(echo "$FROZEN")
git commit -m "refactor(styles): migrate legacy color tokens in frozen zones (sanctioned foundation PR)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: Удалить rebus.css + compat-shim (миграция завершена)

**Files:** Delete `src/styles/themes/rebus.css`, `src/styles/themes/compat.css`; Modify `src/app/globals.css` (убрать `@import compat.css`)

- [ ] **Step 1: Проверить, что легаси-имён больше нет**
```bash
grep -rnE -- '--color-(background|foreground|text-pane|description|primary|danger-fill)' src/ \
  --include='*.tsx' --include='*.ts' --include='*.css' | grep -vE 'compat\.css|rebus\.css'
```
Expected: ПУСТО. Если есть — домигрировать (прогнать codemod из git-истории или вручную) ПЕРЕД удалением shim.
- [ ] **Step 2: Удалить файлы + импорт** → `rm src/styles/themes/rebus.css src/styles/themes/compat.css`; в `globals.css` удалить `@import "../styles/themes/compat.css";`.
- [ ] **Step 3: Фаза-гейт** → `pnpm lint && pnpm test && pnpm build`. `pnpm dev` — приложение корректно; все оси переключаются.
- [ ] **Step 4: Коммит**
```bash
git add src/app/globals.css   # + удаления:
git add -u src/styles/themes
git commit -m "refactor(styles): remove legacy rebus palette + compat shim (migration complete)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
(`git add -u src/styles/themes` стейджит только удаления в этом каталоге — безопасно, это наши файлы.)

---

# ФАЗА 4 — Настройки в аккаунте + бэк-синк

### Task 19: `AppearancePrefsSchema` (отдельная, используемая) + единый enum

**Files:** Modify `src/features/preferences/schemas.ts`; Test `src/features/preferences/schemas.test.ts`

**Interfaces:** `AppearancePrefsSchema` (Zod) на snake_case (как payload бэка), enum-значения из `@/styles/tokens/enums`. НЕ вливается в `PreferencesUpdateSchema` (не ломает `updatePreferences`). Реально используется в Task 21 (валидация payload в persist).

- [ ] **Step 1: Тест** — добавить в `src/features/preferences/schemas.test.ts`:
```ts
import { AppearancePrefsSchema } from "./schemas";
describe("AppearancePrefsSchema", () => {
  it("accepts valid snake_case appearance", () => {
    expect(AppearancePrefsSchema.safeParse({ theme: "dark", contrast: "high", density: "compact", font: "serif", text_size: "lg" }).success).toBe(true);
  });
  it("rejects unknown enum", () => { expect(AppearancePrefsSchema.safeParse({ theme: "neon", contrast:"normal", density:"comfortable", font:"sans", text_size:"md" }).success).toBe(false); });
});
```
- [ ] **Step 2: Реализовать** — в `src/features/preferences/schemas.ts` добавить:
```ts
import { THEMES, CONTRASTS, DENSITIES, FONTS, TEXT_SIZES } from "@/styles/tokens/enums";

export const AppearancePrefsSchema = z.object({
  theme: z.enum(THEMES), contrast: z.enum(CONTRASTS), density: z.enum(DENSITIES),
  font: z.enum(FONTS), text_size: z.enum(TEXT_SIZES),
});
export type AppearancePrefsInput = z.infer<typeof AppearancePrefsSchema>;
```
(`z.enum` принимает `readonly [...]` из `as const`-массивов — TS ок.)
- [ ] **Step 3: Проходит → коммит**
```bash
git add src/features/preferences/schemas.ts src/features/preferences/schemas.test.ts
git commit -m "feat(preferences): AppearancePrefsSchema (shared enums, snake_case)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 20: Секция «Внешний вид» в `/me/settings`

**Files:** Create `src/app/me/settings/appearance/appearance-settings.tsx`; Modify `src/app/me/settings/page.tsx`

**Interfaces:** client-компонент под `AppearanceProvider`; контролы вызывают `setAxis` (мгновенно + cookie + бэк-синк).

- [ ] **Step 1: Реализовать секцию** — `src/app/me/settings/appearance/appearance-settings.tsx`:
```tsx
"use client";
import { Select } from "@/components/ui";
import { useAppearance } from "@/components/appearance";

const THEME = [{ value: "system", label: "Как в системе" }, { value: "light", label: "Светлая" }, { value: "dark", label: "Тёмная" }];
const CONTRAST = [{ value: "normal", label: "Обычный" }, { value: "high", label: "Высокий" }];
const DENSITY = [{ value: "comfortable", label: "Просторно" }, { value: "compact", label: "Компактно" }];
const FONT = [{ value: "sans", label: "Стандартный" }, { value: "legible", label: "Высоко-разборчивый" }, { value: "serif", label: "С засечками (для чтения)" }];
const TEXT_SIZE = [{ value: "sm", label: "Меньше" }, { value: "md", label: "Обычный" }, { value: "lg", label: "Крупнее" }, { value: "xl", label: "Максимальный" }];

export function AppearanceSettings() {
  const { appearance, setAxis } = useAppearance();
  return (
    <section className="flex max-w-xl flex-col gap-4">
      <h2 className="text-lg font-semibold">Внешний вид</h2>
      <Row label="Тема"><Select aria-label="Тема" options={THEME} value={appearance.theme} onValueChange={(v) => setAxis("theme", v as typeof appearance.theme)} /></Row>
      <Row label="Контраст"><Select aria-label="Контраст" options={CONTRAST} value={appearance.contrast} onValueChange={(v) => setAxis("contrast", v as typeof appearance.contrast)} /></Row>
      <Row label="Плотность интерфейса"><Select aria-label="Плотность" options={DENSITY} value={appearance.density} onValueChange={(v) => setAxis("density", v as typeof appearance.density)} /></Row>
      <Row label="Шрифт"><Select aria-label="Шрифт" options={FONT} value={appearance.font} onValueChange={(v) => setAxis("font", v as typeof appearance.font)} /></Row>
      <Row label="Размер текста"><Select aria-label="Размер текста" options={TEXT_SIZE} value={appearance.textSize} onValueChange={(v) => setAxis("textSize", v as typeof appearance.textSize)} /></Row>
    </section>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-sm font-medium">{label}</span>{children}</label>;
}
```
- [ ] **Step 2: Вставить в страницу** — `src/app/me/settings/page.tsx`: импортировать и отрендерить `<AppearanceSettings />` рядом с `PreferencesForm` (работает под `AppearanceProvider` из root layout).
- [ ] **Step 3: Проверка** → `pnpm build && pnpm lint && pnpm test`. `pnpm dev` → `/me/settings`: смена любой оси мгновенно перекрашивает/перемасштабирует UI; после reload — сохраняется (cookie).
- [ ] **Step 4: Коммит (поимённо)**
```bash
git add src/app/me/settings/appearance/appearance-settings.tsx src/app/me/settings/page.tsx
git commit -m "feat(settings): appearance section (theme/contrast/density/font/size)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 21: Бэк-синк (когда контракт готов) — валидация + reconcile

**Files:** Modify `src/components/appearance/persist-appearance.ts`, `src/utils/appearance.ts`, `src/api/schema.ts` (реген, координированно)

**Interfaces:** Зависит от бэка (memory: открытые бэк-аски). Держится как задокументированный план.

- [ ] **Step 1: Предусловие** — бэк добавил `appearance` в `/api/me/preferences`. Реген `src/api/schema.ts`: `pnpm generate:api` (координированно).
- [ ] **Step 2: Снять `as never` + валидировать** — в `persistAppearance` заменить `as never` на типизированный body; валидировать `AppearancePrefsSchema.parse(toPayload(appearance))` перед PATCH; логировать реальные 4xx (не глотать молча).
- [ ] **Step 3: Reconcile-on-load** — в `src/utils/appearance.ts`: appearance берём НЕ из `getMe()` (в `Me` его нет), а из `getPreferences()` слайса preferences. Если бэк-значение задано и отличается от cookie — вернуть бэк-значение (авторитет на свежей сессии); cookie перезапишется при следующем `setAxis`.
- [ ] **Step 4: Тесты + гейт** — обновить `persist-appearance.test.ts` под реальный контракт. `pnpm lint && pnpm test && pnpm build`.
- [ ] **Step 5: Коммит**
```bash
git add src/utils/appearance.ts src/components/appearance/persist-appearance.ts src/api/schema.ts src/components/appearance/persist-appearance.test.ts
git commit -m "feat(appearance): backend sync + reconcile-on-load (cross-device)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (после правок ревью)

**Блокеры ревью — устранены:**
- Невалидный high-contrast CSS → Task 8 эмитит ДВА отдельных правила + `:root:not([data-contrast="normal"])`; freshness-тест (Task 8 Step 4) ассертит отсутствие `,\n@media` и наличие standalone-правила. Спека §6 исправлена.
- Atkinson cyrillic build-break → Task 11 Atkinson `["latin","latin-ext"]`, Geist +cyrillic для legible-фоллбека, Source Serif 4 cyrillic; шаг-предусловие на валидацию subsets; спека §8/§18.
- ~158-файловая миграция + frozen-зоны → полная миграция кодмодом (Task 16 non-frozen, Task 17 frozen санкционированно), Task 18 удаляет shim только после пустого grep; Global Constraints перечисляют санкционированные frozen-зоны.
- Фиктивная защита от дрейфа → Task 8: генерация в `build` через `&&` (не prebuild), freshness-тест в `src/`, CI-шаг в ci.yml.

**Mediums/lows — устранены:** `git add` поимённо везде (Task 14/15/16/17/20); `AppearancePrefsSchema` отдельная и используемая + единый enum (Task 19, persist Task 13/21, спека §13); не-цветовые шкалы в `@theme` (Task 8 `themeScales`); `color-scheme` один источник (Task 10 убирает из :root); `maxChroma` + in-gamut (Task 4); недостающие APCA-пары (Task 3: accent-on-bg, текст на accent-hover, на danger-fill, тинт-vs-bg, ring-on-accent); fg против худшего фона (Task 5); ring нейтральный (Task 5); тинты явное направление (Task 5); `--color-surface` в shim (Task 10) и в rename-map; smoke 4-арг `crToBg`+`maxChroma` (Task 1); окно слома свёрнуто (Task 10 атомарен); h5/h6 в `.content` (Task 14); счёт «22 site/21 файл» (Task 14); тест провайдера на `system` (Task 12); `src/utils/appearance.ts` санкционирован (Global Constraints); Task 21 читает `getPreferences()` не `me`.

**Type consistency:** `Appearance`, `Theme/Contrast/Density/FontChoice/TextSize` (единый `enums.ts`), `ColorTokenName`, `ThemeMode`, `deriveOn`, `htmlAttrs`, `TOKENS`, `CONTRAST_PAIRS`, `persistAppearance`, `AppearancePrefsSchema` — согласованы между Produces/Consumes.

**Остаточный риск:** `adjustFontFallback` CLS (мерить эмпирически после Task 11); apcach/apca-w3/culori API (митигировано смоуком Task 1); Task 21 гейтится бэком.
