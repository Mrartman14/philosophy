# Публичная витрина дизайн-системы на /dev/ui Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать `/dev/ui` публичной витриной дизайн-системы (APCA + appearance-оси + motion «в действии»), перенеся существующие dev-only smoke-тесты компонентов на отдельный роут `/dev/kit`.

**Architecture:** `src/app/dev/ui/page.tsx` — публичный server-component (без `notFound`) с `generateMetadata` и секциями, рендерящими client-компоненты: панель осей (`<AppearanceSettings/>`), живую APCA-матрицу (Lc считается в браузере через самодостаточный `apca-lc.ts`) и motion-демки. Тексты — i18n namespace `design` (ru/en). Smoke-витрина переезжает на dev-only `/dev/kit`.

**Tech Stack:** Next.js (App Router, server + client components), React, TypeScript, Tailwind v4, Base UI (через kit), next-intl (фасад `@/i18n`), Vitest, pnpm.

## Global Constraints

- **Guardrail 7 (НОВЫЙ eslint-гард):** вне `src/components/ui/**` и вне тестов ЗАПРЕЩЕНЫ нативные интерактивные теги `<button>`, `<select>`, `<form>`, `<fieldset>`, `<legend>`, `<textarea>` и прямой импорт `@base-ui/react`. Использовать kit (`Button`/`Dialog`/`Select` через `AppearanceSettings`/`Skeleton`). Неинтерактивные нативные теги (`<div>`, `<span>`, `<ul>`, `<li>`, `<code>`, `<p>`, `<a>`, `<h1>`) — разрешены.
- **Роут:** `/dev/ui` — публичный (в проде доступен, `notFound()` убираем). У `/dev/*` нет layout/middleware-гейта. Smoke → новый dev-only `/dev/kit` (с `notFound()`).
- **i18n:** namespace `design` (ru+en, фасад `@/i18n`/`@/i18n/client`). Технические литералы (имена токенов, `Lc`, `pass/FAIL`, `Aa`, note-строки пар) НЕ локализуем. Server-текст — `getT("design")`, client — `useT("design")`.
- **APCA без внешних депов:** `apca-w3`/`culori`/`apcach` — devDependencies, в код страницы НЕЛЬЗЯ (только в `*.test.ts`). `package.json` НЕ трогать. `CONTRAST_PAIRS` импортировать ТОЛЬКО из `@/styles/tokens/apca-targets` (чистый модуль), НЕ из `@/styles/tokens` (индекс тянет apcach/culori).
- **Контролы:** reuse `<AppearanceSettings/>` (реальная запись намеренна; аноним → cookie-only).
- **Тулчейн:** pnpm. Тест файла: `pnpm exec vitest run <path>`.
- **Git (параллельные агенты активно правят `/dev/ui` + eslint):** `git add` ТОЛЬКО свои файлы по имени, path-scoped commit (`git commit -m "msg" -- <files>`), без `-A`/`.`, без деструктивных git, без push. ПЕРЕД правкой `src/app/dev/ui/page.tsx` — перечитать его свежую версию (мог измениться). `package.json`/`src/api/schema.ts` не трогать.
- **Именование** новых файлов — kebab-case. Перед коммитом — `pnpm exec eslint <свои файлы>` чисто (в т.ч. Guardrail 7).

---

## File Structure

**Создаём:**
- `src/app/dev/kit/page.tsx` — перенос текущей smoke-витрины (dev-only).
- `src/app/dev/ui/apca-lc.ts` (+ `apca-lc.test.ts`) — APCA Lc без депов + паритет-тест.
- `src/app/dev/ui/apca-matrix.tsx` (`"use client"`) — живая матрица (без i18n).
- `src/app/dev/ui/motion-showcase.tsx` (`"use client"`) — motion-демки (`useT("design")`).
- `src/i18n/messages/ru/design.ts`, `src/i18n/messages/en/design.ts`.

**Модифицируем:**
- `src/app/dev/ui/page.tsx` — публичная витрина (без `notFound`, `generateMetadata`, секции).
- `src/i18n/messages/ru/index.ts`, `src/i18n/messages/en/index.ts` — регистрация `design`.

**Reuse:** `<AppearanceSettings/>`, `Skeleton`/`Dialog`/`Button` из `@/components/ui`, `CONTRAST_PAIRS`/`ColorTokenName`, `useReducedMotion`/`useAppearance`.

---

## Task 1: Перенос smoke-витрины на dev-only `/dev/kit`

**Files:**
- Create: `src/app/dev/kit/page.tsx`

**Interfaces:** —

- [ ] **Step 1: Скопировать текущую витрину в /dev/kit**

Прочитать ТЕКУЩИЙ `src/app/dev/ui/page.tsx` (его недавно рефакторил параллельный агент — бери актуальную версию) и создать `src/app/dev/kit/page.tsx` с тем же содержимым, изменив ровно две вещи:
1. Любой `basePath="/dev/ui"` у `<Pagination .../>` → `basePath="/dev/kit"`.
2. Оставить dev-гард `if (process.env.NODE_ENV === "production") notFound();` и `export const metadata = { title: "UI Kit smoke" };`.

(Импорты, секции Buttons/Form/Table/EmptyState/Skeleton/Pagination — копируются как есть. Не использовать нативные интерактивные теги — текущая версия уже на kit, Guardrail 7 соблюдён.)

- [ ] **Step 2: Lint + dev-guard sanity**

Run: `pnpm exec eslint src/app/dev/kit/page.tsx`
Expected: 0 ошибок (Guardrail 7 чист — всё через kit).

- [ ] **Step 3: Commit**

```bash
git add src/app/dev/kit/page.tsx
git commit -m "feat(dev-kit): перенос UI-kit smoke-витрины на dev-only /dev/kit" -- src/app/dev/kit/page.tsx
```

---

## Task 2: i18n namespace `design` (ru + en)

**Files:**
- Create: `src/i18n/messages/ru/design.ts`, `src/i18n/messages/en/design.ts`
- Modify: `src/i18n/messages/ru/index.ts`, `src/i18n/messages/en/index.ts`

**Interfaces:**
- Produces: namespace `design` с ключами `metaTitle`, `appearanceTitle`, `appearanceWarning`, `tokensTitle`, `tokensHint`, `motionTitle`, `motionStatusPrefix`, `motionOn`, `motionOff`, `motionHint`, `motionSkeleton`, `motionSpin`, `motionFancy`, `motionFancyText`, `motionDialog`, `motionDialogTrigger`, `motionDialogTitle`, `motionDialogBody`, `motionMapNote`. Доступен серверно (`getT("design")`) и клиентски (`useT("design")`).

- [ ] **Step 1: Создать ru/design.ts**

Create `src/i18n/messages/ru/design.ts`:
```ts
const design = {
  metaTitle: "Дизайн-система",
  appearanceTitle: "Оформление",
  appearanceWarning:
    "Меняет ваши настройки внешнего вида на этом устройстве (а если вы вошли — и в аккаунте). Это настоящая система appearance: переключайте оси и смотрите, как реагируют токены и анимации ниже.",
  tokensTitle: "Токены — APCA-контраст",
  tokensHint:
    "Контраст каждой пары посчитан в браузере (APCA Lc) и сверяется с целевым минимумом — как CI-гард.",
  motionTitle: "Движение",
  motionStatusPrefix: "Reduced motion сейчас:",
  motionOn: "ДА",
  motionOff: "НЕТ",
  motionHint: "переключите ось «Анимация» в панели выше.",
  motionSkeleton: "Skeleton (пульс глохнет под reduced)",
  motionSpin: "Keyframe-анимация (глохнет под reduced)",
  motionFancy: "Стрелка едет на hover; под reduced — замирает",
  motionFancyText: "Наведи на меня",
  motionDialog: "Диалог: opacity-fade остаётся под reduced (transition не глушим)",
  motionDialogTrigger: "Открыть диалог",
  motionDialogTitle: "Демо-диалог",
  motionDialogBody: "Открытие/закрытие плавно затухает по opacity даже под reduced motion.",
  motionMapNote: "Инерция камеры карты (three.js) — на /map.",
};

export default design;
```

- [ ] **Step 2: Создать en/design.ts**

Create `src/i18n/messages/en/design.ts`:
```ts
import type ru from "../ru/design";

const design = {
  metaTitle: "Design system",
  appearanceTitle: "Appearance",
  appearanceWarning:
    "Changes your appearance settings on this device (and on your account if you are signed in). This is the real appearance system: toggle the axes and watch the tokens and animations below react.",
  tokensTitle: "Tokens — APCA contrast",
  tokensHint:
    "Each pair's contrast is computed in the browser (APCA Lc) and checked against its target minimum — same as the CI guard.",
  motionTitle: "Motion",
  motionStatusPrefix: "Reduced motion now:",
  motionOn: "YES",
  motionOff: "NO",
  motionHint: "toggle the “Motion” axis in the panel above.",
  motionSkeleton: "Skeleton (pulse stops under reduced)",
  motionSpin: "Keyframe animation (stops under reduced)",
  motionFancy: "Arrow slides on hover; freezes under reduced",
  motionFancyText: "Hover me",
  motionDialog: "Dialog: opacity-fade stays under reduced (we don't kill transitions)",
  motionDialogTrigger: "Open dialog",
  motionDialogTitle: "Demo dialog",
  motionDialogBody: "Open/close still fades by opacity even under reduced motion.",
  motionMapNote: "Map camera inertia (three.js) — at /map.",
} satisfies typeof ru;

export default design;
```

- [ ] **Step 3: Зарегистрировать в ru/index.ts**

В `src/i18n/messages/ru/index.ts`: добавить строку импорта (по алфавиту, после `import comments ...` / перед `import documents ...` — рядом с соседями на `d`):
```ts
import design from "./design";
```
И добавить `design,` в объект `const ru = { ... }` (рядом с `documents`/`editor`).

- [ ] **Step 4: Зарегистрировать в en/index.ts**

В `src/i18n/messages/en/index.ts` — симметрично: `import design from "./design";` + `design,` в объект каталога (как устроен en/index — зеркало ru; `satisfies Messages` гарантирует паритет).

- [ ] **Step 5: Проверить парити (tsc + runtime)**

Run: `pnpm exec vitest run src/i18n/messages/messages.test.ts src/i18n/messages/icu-parity.test.ts`
Expected: PASS (ru/en структурно идентичны; ICU-плейсхолдеров в `design` нет). Также `pnpm exec eslint src/i18n/messages/ru/design.ts src/i18n/messages/en/design.ts src/i18n/messages/ru/index.ts src/i18n/messages/en/index.ts` → 0 ошибок.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/messages/ru/design.ts src/i18n/messages/en/design.ts src/i18n/messages/ru/index.ts src/i18n/messages/en/index.ts
git commit -m "feat(i18n): namespace design (ru/en) для витрины /dev/ui" -- src/i18n/messages/ru/design.ts src/i18n/messages/en/design.ts src/i18n/messages/ru/index.ts src/i18n/messages/en/index.ts
```

---

## Task 3: APCA-хелпер `apca-lc.ts` + паритет-тест

**Files:**
- Create: `src/app/dev/ui/apca-lc.ts`, `src/app/dev/ui/apca-lc.test.ts`

**Interfaces:**
- Produces: `srgbToY(rgb: [number,number,number]): number` (0..255); `apcaContrast(txtY: number, bgY: number): number` (знаковый Lc); `parseRgb(s: string): [number,number,number] | null`; `apcaLc(fgColor: string, bgColor: string): number | null`.

- [ ] **Step 1: Паритет-тест (failing)**

Create `src/app/dev/ui/apca-lc.test.ts`:
```ts
import { APCAcontrast, sRGBtoY } from "apca-w3";
import { describe, it, expect } from "vitest";

import { srgbToY, apcaContrast, parseRgb, apcaLc } from "./apca-lc";

const RGB: [number, number, number][] = [
  [0, 0, 0], [255, 255, 255], [18, 18, 18], [240, 240, 240],
  [10, 80, 200], [200, 30, 40], [120, 120, 120], [0, 128, 96],
];

describe("apca-lc", () => {
  it("srgbToY matches apca-w3", () => {
    for (const c of RGB) expect(srgbToY(c)).toBeCloseTo(sRGBtoY(c), 6);
  });
  it("apcaContrast matches apca-w3 across all pairs", () => {
    for (const fg of RGB) {
      for (const bg of RGB) {
        const mine = apcaContrast(srgbToY(fg), srgbToY(bg));
        const ref = Number(APCAcontrast(sRGBtoY(fg), sRGBtoY(bg)));
        expect(Math.abs(mine - ref)).toBeLessThan(0.1);
      }
    }
  });
  it("known signed values (polarity)", () => {
    expect(apcaContrast(srgbToY([0, 0, 0]), srgbToY([255, 255, 255]))).toBeCloseTo(106.04, 0);
    expect(apcaContrast(srgbToY([255, 255, 255]), srgbToY([0, 0, 0]))).toBeCloseTo(-107.88, 0);
  });
  it("parseRgb handles comma/space syntax; apcaLc null on unparseable", () => {
    expect(parseRgb("rgb(10, 20, 30)")).toEqual([10, 20, 30]);
    expect(parseRgb("rgb(10 20 30)")).toEqual([10, 20, 30]);
    expect(parseRgb("oklch(0.5 0.1 200)")).toBeNull();
    expect(apcaLc("nope", "rgb(0,0,0)")).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `pnpm exec vitest run src/app/dev/ui/apca-lc.test.ts`
Expected: FAIL (модуль `./apca-lc` не найден).

- [ ] **Step 3: Реализовать `apca-lc.ts`**

Create `src/app/dev/ui/apca-lc.ts`:
```ts
// Самодостаточный порт APCA-W3 (SA98G) — БЕЗ внешних зависимостей
// (apca-w3/culori — devDeps, нельзя в код страницы). Паритет — в apca-lc.test.ts.
const MAIN_TRC = 2.4;
const R_CO = 0.2126729;
const G_CO = 0.7151522;
const B_CO = 0.072175;
const NORM_BG = 0.56;
const NORM_TXT = 0.57;
const REV_TXT = 0.62;
const REV_BG = 0.65;
const BLK_THRS = 0.022;
const BLK_CLMP = 1.414;
const SCALE = 1.14;
const LO_OFFSET = 0.027;
const DELTA_Y_MIN = 0.0005;
const LO_CLIP = 0.1;

/** Линейная яркость Y по sRGB (компоненты 0..255). */
export function srgbToY([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => Math.pow(c / 255, MAIN_TRC);
  return R_CO * lin(r) + G_CO * lin(g) + B_CO * lin(b);
}

/** APCA-контраст Lc (~ -108..106). txtY — текст, bgY — фон. */
export function apcaContrast(txtY: number, bgY: number): number {
  const tY = txtY > BLK_THRS ? txtY : txtY + Math.pow(BLK_THRS - txtY, BLK_CLMP);
  const bY = bgY > BLK_THRS ? bgY : bgY + Math.pow(BLK_THRS - bgY, BLK_CLMP);
  if (Math.abs(bY - tY) < DELTA_Y_MIN) return 0;
  let out: number;
  if (bY > tY) {
    const sapc = (Math.pow(bY, NORM_BG) - Math.pow(tY, NORM_TXT)) * SCALE;
    out = sapc < LO_CLIP ? 0 : sapc - LO_OFFSET;
  } else {
    const sapc = (Math.pow(bY, REV_BG) - Math.pow(tY, REV_TXT)) * SCALE;
    out = sapc > -LO_CLIP ? 0 : sapc + LO_OFFSET;
  }
  return out * 100;
}

/** Парсит CSS `rgb(r,g,b)` / `rgb(r g b)` / `rgba(...)` → [r,g,b] (0..255) или null. */
export function parseRgb(s: string): [number, number, number] | null {
  const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Lc для пары CSS-цветов (текст, фон) как их вернул getComputedStyle. null — если не распарсилось. */
export function apcaLc(fgColor: string, bgColor: string): number | null {
  const fg = parseRgb(fgColor);
  const bg = parseRgb(bgColor);
  if (!fg || !bg) return null;
  return apcaContrast(srgbToY(fg), srgbToY(bg));
}
```

- [ ] **Step 4: Запустить — проходит**

Run: `pnpm exec vitest run src/app/dev/ui/apca-lc.test.ts`
Expected: PASS (4 теста). При расхождении на доли Lc — сверить константы с `node_modules/apca-w3`.

- [ ] **Step 5: Lint + commit**

Run: `pnpm exec eslint src/app/dev/ui/apca-lc.ts src/app/dev/ui/apca-lc.test.ts` → 0 ошибок.
```bash
git add src/app/dev/ui/apca-lc.ts src/app/dev/ui/apca-lc.test.ts
git commit -m "feat(dev-ui): apca-lc — APCA Lc без внешних депов + паритет-тест" -- src/app/dev/ui/apca-lc.ts src/app/dev/ui/apca-lc.test.ts
```

---

## Task 4: APCA-матрица `apca-matrix.tsx`

**Files:**
- Create: `src/app/dev/ui/apca-matrix.tsx`

**Interfaces:**
- Consumes: `apcaLc` (Task 3); `CONTRAST_PAIRS` из `@/styles/tokens/apca-targets`; `useAppearance` из `@/components/appearance`.
- Produces: `export function ApcaMatrix(): JSX.Element`.

ПРИМЕЧАНИЕ: юнит-теста нет (jsdom не резолвит getComputedStyle-цвета; Lc-логика покрыта Task 3). Только неинтерактивные нативные теги (Guardrail 7 чист). Проверка — lint + ручная dev (Task 7).

- [ ] **Step 1: Реализовать компонент**

Create `src/app/dev/ui/apca-matrix.tsx`:
```tsx
"use client";
import { useEffect, useRef, useState } from "react";

import { useAppearance } from "@/components/appearance";
import { CONTRAST_PAIRS } from "@/styles/tokens/apca-targets";

import { apcaLc } from "./apca-lc";

export function ApcaMatrix() {
  const { appearance } = useAppearance();
  const rootRef = useRef<HTMLUListElement>(null);
  const [lcs, setLcs] = useState<(number | null)[]>(() => CONTRAST_PAIRS.map(() => null));

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const recompute = () => {
      setLcs(
        CONTRAST_PAIRS.map((_, i) => {
          const fgEl = root.querySelector<HTMLElement>(`[data-i="${i}"] [data-fg]`);
          const bgEl = root.querySelector<HTMLElement>(`[data-i="${i}"] [data-bg]`);
          if (!fgEl || !bgEl) return null;
          return apcaLc(getComputedStyle(fgEl).color, getComputedStyle(bgEl).backgroundColor);
        }),
      );
    };
    recompute();
    const mqs = [
      window.matchMedia("(prefers-color-scheme: dark)"),
      window.matchMedia("(prefers-contrast: more)"),
    ];
    mqs.forEach((m) => { m.addEventListener("change", recompute); });
    return () => { mqs.forEach((m) => { m.removeEventListener("change", recompute); }); };
  }, [appearance.theme, appearance.contrast]);

  return (
    <ul ref={rootRef} className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
      {CONTRAST_PAIRS.map((p, i) => {
        const lc = lcs[i];
        const abs = lc === null ? null : Math.abs(lc);
        const pass = abs !== null && abs >= p.minLc;
        return (
          <li key={`${p.fg}-${p.bg}`} data-i={i} className="flex flex-col gap-1 rounded border border-(--color-border) p-2">
            <div
              data-bg
              className="flex h-12 items-center justify-center rounded"
              style={{ background: `var(--color-${p.bg})` }}
            >
              <span data-fg className="text-lg font-semibold" style={{ color: `var(--color-${p.fg})` }}>
                Aa
              </span>
            </div>
            <code className="text-xs text-(--color-fg-muted)">{p.fg} / {p.bg}</code>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono">{abs === null ? "—" : abs.toFixed(0)}</span>
              <span className="text-(--color-fg-muted)">/ {p.minLc}</span>
              <span className={pass ? "text-(--color-success)" : "text-(--color-danger)"}>
                {abs === null ? "" : pass ? "pass" : "FAIL"}
              </span>
            </div>
            <span className="text-xs text-(--color-fg-subtle)">{p.note}</span>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 2: Lint + typecheck**

Run: `pnpm exec eslint src/app/dev/ui/apca-matrix.tsx`
Expected: 0 ошибок (Guardrail 7 чист — `<ul>/<li>/<div>/<span>/<code>` не запрещены; `react-hooks/exhaustive-deps` — deps `[appearance.theme, appearance.contrast]`, `recompute` внутри эффекта, `apcaLc`/`CONTRAST_PAIRS` стабильны).

- [ ] **Step 3: Commit**

```bash
git add src/app/dev/ui/apca-matrix.tsx
git commit -m "feat(dev-ui): живая APCA-матрица контраста (27 пар, Lc из getComputedStyle)" -- src/app/dev/ui/apca-matrix.tsx
```

---

## Task 5: Motion-демки `motion-showcase.tsx`

**Files:**
- Create: `src/app/dev/ui/motion-showcase.tsx`

**Interfaces:**
- Consumes: `useReducedMotion` из `@/components/appearance`; `Skeleton`/`Dialog`/`Button` из `@/components/ui`; `useT` из `@/i18n/client` (namespace `design`, Task 2).
- Produces: `export function MotionShowcase(): JSX.Element`.

- [ ] **Step 1: Реализовать компонент**

Create `src/app/dev/ui/motion-showcase.tsx`:
```tsx
"use client";
import { useReducedMotion } from "@/components/appearance";
import { Button, Dialog, Skeleton } from "@/components/ui";
import { useT } from "@/i18n/client";

export function MotionShowcase() {
  const reduce = useReducedMotion();
  const t = useT("design");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        {t("motionStatusPrefix")} <strong>{reduce ? t("motionOn") : t("motionOff")}</strong>{" "}
        <span className="text-(--color-fg-muted)">— {t("motionHint")}</span>
      </p>

      <Row label={t("motionSkeleton")}>
        <Skeleton className="h-4 w-48" />
      </Row>

      <Row label={t("motionSpin")}>
        <div className="size-8 rounded bg-(--color-accent) animate-spin" />
      </Row>

      <Row label={t("motionFancy")}>
        <a href="#" className="fancy-link w-fit">{t("motionFancyText")}</a>
      </Row>

      <Row label={t("motionDialog")}>
        <Dialog title={t("motionDialogTitle")} trigger={<Button variant="secondary">{t("motionDialogTrigger")}</Button>}>
          <p className="text-sm">{t("motionDialogBody")}</p>
        </Dialog>
      </Row>

      <p className="text-sm text-(--color-fg-muted)">{t("motionMapNote")}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-(--color-fg-muted)">{label}</span>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Lint + typecheck**

Run: `pnpm exec eslint src/app/dev/ui/motion-showcase.tsx`
Expected: 0 ошибок (Guardrail 7: `Button`/`Dialog` — kit; `<a>`/`<div>`/`<span>`/`<p>` разрешены).

- [ ] **Step 3: Commit**

```bash
git add src/app/dev/ui/motion-showcase.tsx
git commit -m "feat(dev-ui): motion-демки reduced-motion в действии (i18n design)" -- src/app/dev/ui/motion-showcase.tsx
```

---

## Task 6: Публичная страница `/dev/ui`

**Files:**
- Modify: `src/app/dev/ui/page.tsx`

**Interfaces:**
- Consumes: `AppearanceSettings`, `ApcaMatrix`, `MotionShowcase`, `getT("design")`.

- [ ] **Step 1: Перечитать текущий page.tsx**

ПЕРЕД правкой прочитать актуальный `src/app/dev/ui/page.tsx` (параллельный агент мог его менять). Содержимое smoke уже перенесено в `/dev/kit` (Task 1) — здесь оно заменяется витриной.

- [ ] **Step 2: Заменить файл публичной витриной**

Полностью заменить `src/app/dev/ui/page.tsx` на:
```tsx
// src/app/dev/ui/page.tsx — публичная витрина дизайн-системы (APCA + appearance + motion)
import type { Metadata } from "next";

import { AppearanceSettings } from "@/app/me/settings/appearance/appearance-settings";
import { getT } from "@/i18n";

import { ApcaMatrix } from "./apca-matrix";
import { MotionShowcase } from "./motion-showcase";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("design");
  return { title: t("metaTitle") };
}

export default async function DesignShowcasePage() {
  const t = await getT("design");
  return (
    <div className="flex flex-col gap-10 p-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">{t("appearanceTitle")}</h1>
        <p className="text-sm text-(--color-fg-muted)">{t("appearanceWarning")}</p>
        <AppearanceSettings />
      </section>

      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">{t("tokensTitle")}</h1>
        <p className="text-sm text-(--color-fg-muted)">{t("tokensHint")}</p>
        <ApcaMatrix />
      </section>

      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">{t("motionTitle")}</h1>
        <MotionShowcase />
      </section>
    </div>
  );
}
```
(`notFound`-гард УБРАН — страница публичная. Статический `export const metadata` заменён на `generateMetadata`.)

- [ ] **Step 3: Lint + typecheck**

Run: `pnpm exec eslint src/app/dev/ui/page.tsx`
Expected: 0 ошибок. `pnpm exec tsc --noEmit 2>&1 | grep "src/app/dev"` → пусто (нет новых tsc-ошибок).

- [ ] **Step 4: Commit**

```bash
git add src/app/dev/ui/page.tsx
git commit -m "feat(dev-ui): публичная витрина дизайн-системы (APCA + appearance + motion)" -- src/app/dev/ui/page.tsx
```

---

## Task 7: Финальная верификация

**Files:** —

- [ ] **Step 1: Тесты + линт фичи**

Run: `pnpm exec vitest run src/app/dev/ui/apca-lc.test.ts src/i18n/messages/messages.test.ts src/i18n/messages/icu-parity.test.ts && pnpm exec eslint src/app/dev/ui/ src/i18n/messages/ru/design.ts src/i18n/messages/en/design.ts`
Expected: тесты зелёные; eslint 0 ошибок.

- [ ] **Step 2: Нет новых tsc-ошибок от фичи**

Run: `pnpm exec tsc --noEmit 2>&1 | grep -E "src/app/dev|messages/(ru|en)/design" || echo "нет ошибок в фиче"`
Expected: «нет ошибок в фиче».

- [ ] **Step 3: Ручная проверка**

Run: `pnpm dev` (:3001):
1. `/dev/ui` доступен (в т.ч. как аноним): секции Оформление/Токены/Движение; en-локаль показывает английский.
2. Переключить тему (light/dark) и контраст (normal/high) в панели → APCA-матрица пересчитывает Lc и pass/FAIL; все pass зелёные при normal и high.
3. Ось «Анимация» → «Меньше движения»: skeleton/спин замирают, стрелка fancy-link не едет, **диалог по-прежнему плавно затухает**; бейдж «Reduced motion: ДА».
4. `/dev/kit` — отдаёт smoke-витрину компонентов в dev; в прод-сборке (`NODE_ENV=production`) → `notFound`.

- [ ] **Step 4: Зафиксировать остаток**

Если есть несакоммиченные правки только этой фичи — добавить по именам, path-scoped commit (без `-A`, без `package.json`).

---

## Self-Review (выполнено при написании)

**1. Покрытие спеки:** §2 публичный /dev/ui + перенос smoke (Task 1, 6) + i18n (Task 2) + persist-warning (Task 6) + APCA без депов (Task 3/4); §4 матрица (Task 4) + Lc/паритет (Task 3); §5 motion (Task 5); §6 файлы — все; §7 тесты (Task 3 + i18n parity + ручная). ✅

**2. Плейсхолдеры:** нет TODO/TBD; код приведён дословно.

**3. Согласованность:** `apcaLc/srgbToY/apcaContrast/parseRgb` одинаковы в Task 3 (опр.+тест) и Task 4 (потребление); ключи `design` (Task 2) совпадают с использованием в Task 5 (`useT`) и Task 6 (`getT`); `CONTRAST_PAIRS` поля `{fg,bg,minLc,note}` — как в apca-targets.ts; `ApcaMatrix`/`MotionShowcase` экспорт/импорт согласованы.

**Анти-грабли:** Guardrail 7 (kit, без нативных интерактивных тегов — компоненты соблюдают); CONTRAST_PAIRS из apca-targets (не из индекса); apca-w3/culori/apcach только в тесте; package.json не трогаем; перед правкой page.tsx — перечитать (параллельные агенты).
