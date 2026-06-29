import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

// Стрипаем комментарии: гард-проверки (нет голых px-порогов / @media не раскрывает
// поля) проверяют РЕАЛЬНЫЕ правила, а не прозу — иначе пояснительный комментарий,
// упоминающий `@media`/`px`, ложно роняет гард.
const css = readFileSync(resolve(process.cwd(), "src/styles/layout.css"), "utf-8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);
const globals = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf-8");

describe("layout.css", () => {
  it("определяет токены ширины хребта/полей/зазора", () => {
    expect(css).toContain("--layout-spine: 45rem");
    expect(css).toContain("--layout-margin: 0px");
    expect(css).toContain("--layout-gutter: 1rem");
  });

  it("<main> = size-container (.page-shell): inline-size + имя", () => {
    expect(css).toMatch(/\.page-shell[\s\S]*container-type:\s*inline-size/);
    expect(css).toMatch(/\.page-shell[\s\S]*container-name:\s*page-shell/);
  });

  it("поля раскрываются через @container (не @media): порог в em → масштаб-инвариантно", () => {
    // Раскрытие полей решается по СОБСТВЕННОЙ доступной ширине контейнера,
    // мерянной в тех же масштабируемых rem, что и хребет — поэтому порог в em
    // (em в @container резолвится от font-size контейнера, на который уже наложен
    // --text-scale), а не фиксированный px-вьюпорт.
    expect(css).toMatch(/@container page-shell \(min-width:\s*80em\)[\s\S]*--layout-margin:\s*14rem/);
    // --layout-margin теперь ставится на .page-grid (потомок контейнера), НЕ на :root
    // (контейнер-квери не может стилизовать предка :root).
    expect(css).toMatch(/@container page-shell \(min-width:\s*80em\)\s*\{\s*\.page-grid/);
    // старого @media-порога для раскрытия полей быть не должно.
    expect(css).not.toMatch(/@media[\s\S]*--layout-margin:\s*14rem/);
  });

  it("никаких голых px-порогов: ни в @media, ни в @container (только em — scale-aware)", () => {
    expect(css).not.toMatch(/@media[^{]*\d{3,4}px/);
    expect(css).not.toMatch(/@container[^{]*\d{3,4}px/);
  });

  it("грид page-grid использует именованные логические линии", () => {
    expect(css).toContain(".page-grid");
    expect(css).toContain("[content-start]");
    expect(css).toContain("[content-end]");
    expect(css).toContain("[margin-start]");
    expect(css).toContain("[margin-end]");
    expect(css).toContain("[bleed-start]");
    expect(css).toContain("[bleed-end]");
    expect(css).toContain("align-content: start");
  });

  it("дефолт-потомок едет в хребет через :where() (нулевая специфичность)", () => {
    expect(css).toMatch(/:where\(\.page-grid > \*:not\(\.spine-frame\)\)/);
  });

  it("классы размещения и collapse определены логически", () => {
    expect(css).toContain(".col-margin-start");
    expect(css).toContain(".col-margin-end");
    expect(css).toContain(".col-bleed");
    expect(css).toContain(".margin-note--inline");
    expect(css).toContain(".margin-note--hidden");
  });

  it("collapse маргиналий — по узости контейнера (@container width < 80em)", () => {
    expect(css).toMatch(/@container page-shell \(width\s*<\s*80em\)[\s\S]*\.margin-note--inline/);
  });

  it("бордер хребта логический (border-inline) и появляется по ширине контейнера (>= 48em)", () => {
    expect(css).toMatch(/@container page-shell \(min-width:\s*48em\)[\s\S]*border-inline/);
  });

  it("spine-frame держит непрерывность бордера (§5): inset-block/центрирование/ширина", () => {
    expect(css).toMatch(/\.spine-frame[\s\S]*inset-block:\s*0/);
    expect(css).toMatch(/\.spine-frame[\s\S]*margin-inline:\s*auto/);
    expect(css).toMatch(/\.spine-frame[\s\S]*inline-size:\s*min\(\s*var\(--layout-spine\)/);
  });

  it("бордер хребта рисуется ПОВЕРХ контента (не позади) — z-index положительный", () => {
    // z-index:-1 пряtal бы бордер за непрозрачными фонами (напр. сайдбар /me).
    expect(css).toMatch(/\.spine-frame[\s\S]*z-index:\s*40/);
    expect(css).not.toMatch(/\.spine-frame[\s\S]*z-index:\s*-1/);
  });

  it("margin-nav: при широком контейнере уходит в левое поле + sticky", () => {
    expect(css).toContain(".margin-nav");
    expect(css).toMatch(/@container page-shell \(min-width:\s*80em\)[\s\S]*\.margin-nav[\s\S]*grid-column:\s*margin-start\s*\/\s*content-start/);
    expect(css).toMatch(/\.margin-nav[\s\S]*position:\s*sticky/);
  });

  it("sticky-нав не примыкает к хедеру вплотную (хедер + зазор)", () => {
    expect(css).toMatch(/--layout-sticky-top:\s*calc\(\s*var\(--header-height\)\s*\+\s*1rem\s*\)/);
    expect(css).toMatch(/\.margin-nav[\s\S]*inset-block-start:\s*var\(--layout-sticky-top\)/);
  });

  it("в app/wide-режиме (есть .col-bleed) хребет-бордер гасится (§6)", () => {
    expect(css).toMatch(/\.page-grid:has\(>\s*\.col-bleed\)[\s\S]*\.spine-frame[\s\S]*display:\s*none/);
  });

  it("CSS на логических осях — нет физических left/right свойств", () => {
    expect(css).not.toMatch(/(^|[\s;{])(margin|padding|border|inset)-(left|right)/);
    expect(css).not.toMatch(/[\s;{](left|right)\s*:/);
  });

  it("globals.css импортирует layout.css", () => {
    expect(globals).toContain('@import "../styles/layout.css"');
  });
});
