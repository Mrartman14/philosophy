import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/styles/layout.css"), "utf-8");
const globals = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf-8");

describe("layout.css", () => {
  it("определяет токены ширины хребта/полей/зазора", () => {
    expect(css).toContain("--layout-spine: 45rem");
    expect(css).toContain("--layout-margin: 0px");
    expect(css).toContain("--layout-gutter: 2rem");
  });

  it("раскрывает поля только на >= 1280px", () => {
    expect(css).toMatch(/@media \(min-width:\s*1280px\)[\s\S]*--layout-margin:\s*14rem/);
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

  it("бордер хребта логический (border-inline) и только md+", () => {
    expect(css).toMatch(/@media \(min-width:\s*768px\)[\s\S]*border-inline/);
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
