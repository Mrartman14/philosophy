import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

/**
 * Инвариант: всё, что подстраивается под РАСКРЫТИЕ ПОЛЕЙ маргиналий (паддинги
 * к хребту, sticky-инспектор, скрытие цитаты якоря, reflow тулбара), должно
 * координироваться через тот же КОНТЕЙНЕР-порог, что и сам reveal в layout.css
 * (`@container page-shell (min-width: 80em)`), а НЕ через вьюпортный `xl:`.
 *
 * Почему: reveal полей переведён на @container (масштаб-инвариантно к --text-scale,
 * см. layout.css §13). Вьюпортный `xl:` (1280px) рассинхронизируется с reveal при
 * не-дефолтном размере текста → паддинг/sticky/скрытие срабатывают не в такт.
 *
 * Порог токенизирован: `--container-marginalia: 80em` (tokens.generated.css из
 * generate-tokens.mjs) → Tailwind-вариант `@marginalia:` эмитит
 * `@container (min-width: 80em)`, который браузер матчит к ближайшему контейнеру
 * (.page-shell) — тот же порог в em, что и в layout.css §13 → синхронно. Магическое
 * число `80em` НЕ должно повторяться по фиче-файлам (только именованный вариант).
 */
function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf-8");
}

const CONTAINER = "@marginalia:";

const FEATURE_FILES = [
  "src/features/annotations/ui/annotation-card.tsx",
  "src/app/documents/[id]/page.tsx",
  "src/app/lectures/[id]/page.tsx",
  "src/features/canvas/ui/canvas-editor.tsx",
  "src/features/canvas/ui/editor-toolbar.tsx",
];

describe("marginalia: координация-спутники на @container, не на вьюпортный xl", () => {
  it("порог токенизирован: --container-marginalia в сгенерированной теме (даёт @marginalia:)", () => {
    expect(read("src/styles/tokens.generated.css")).toContain("--container-marginalia: 80em");
  });

  it("магическое число 80em НЕ дублируется по фиче-файлам (только именованный вариант)", () => {
    for (const f of FEATURE_FILES) {
      expect(read(f), `${f} использует сырой @min-[80em] вместо @marginalia`).not.toContain("@min-[80em]");
    }
  });

  it("annotation-card: цитата якоря прячется по контейнеру (а не xl:hidden)", () => {
    const src = read("src/features/annotations/ui/annotation-card.tsx");
    expect(src).toContain(`${CONTAINER}hidden`);
    expect(src).not.toContain("xl:hidden");
  });

  it("documents/[id]: внутренний паддинг панели гасится по контейнеру", () => {
    const src = read("src/app/documents/[id]/page.tsx");
    expect(src).toContain(`${CONTAINER}ps-0`);
    expect(src).not.toMatch(/\bxl:ps-0/);
  });

  it("lectures/[id]: оба внутренних паддинга панелей гасятся по контейнеру", () => {
    const src = read("src/app/lectures/[id]/page.tsx");
    expect(src).toContain(`${CONTAINER}ps-0`);
    expect(src).toContain(`${CONTAINER}pe-0`);
    expect(src).not.toMatch(/\bxl:ps-0/);
    expect(src).not.toMatch(/\bxl:pe-0/);
  });

  it("canvas-editor: паддинги + sticky-инспектор по контейнеру", () => {
    const src = read("src/features/canvas/ui/canvas-editor.tsx");
    expect(src).toContain(`${CONTAINER}pe-0`);
    expect(src).toContain(`${CONTAINER}ps-0`);
    expect(src).toContain(`${CONTAINER}sticky`);
    expect(src).toContain(`${CONTAINER}self-start`);
    expect(src).toContain(`${CONTAINER}top-(--layout-sticky-top)`);
    expect(src).not.toMatch(/\bxl:(pe-0|ps-0|sticky|self-start|top-)/);
  });

  it("editor-toolbar: reflow вертикального тулбара по контейнеру", () => {
    const src = read("src/features/canvas/ui/editor-toolbar.tsx");
    expect(src).toContain(`${CONTAINER}grid`);
    expect(src).toContain(`${CONTAINER}grid-cols-2`);
    expect(src).toContain(`${CONTAINER}border`);
    expect(src).not.toMatch(/\bxl:(grid|ms-auto|w-fit|rounded-lg|border)/);
  });
});
