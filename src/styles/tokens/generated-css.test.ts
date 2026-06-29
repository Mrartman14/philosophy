import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

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
  it("маппит data-text-size → --text-scale (md опущен: фолбэк var(--text-scale,1))", () => {
    expect(css).toContain('[data-text-size="lg"] { --text-scale: 1.125; }');
    expect(css).toContain('[data-text-size="xl"] { --text-scale: 1.25; }');
    expect(css).toContain('[data-text-size="sm"] { --text-scale: 0.9; }');
    expect(css).not.toContain('[data-text-size="md"]');
  });
  it("high-contrast cascade is correct: no bare unqualified rule, correct media selectors", () => {
    // no bare [data-contrast="high"] without theme qualifier
    expect(css).not.toMatch(/^\[data-contrast="high"\]\s*\{/m);
    // prefers-contrast: more light rule uses :not([data-theme="dark"])
    expect(css).toContain(':not([data-contrast]):not([data-theme="dark"])');
    // combined dark prefers-contrast rule
    expect(css).toContain('(prefers-contrast: more) and (prefers-color-scheme: dark)');
    expect(css).toContain(':not([data-contrast]):not([data-theme="light"])');
    // light prefers-color-scheme block with :not([data-theme])[data-contrast="high"]
    expect(css).toContain('(prefers-color-scheme: light)');
    expect(css).toContain(':not([data-theme])[data-contrast="high"]');
    // no comma before @media (invalid CSS)
    expect(css).not.toMatch(/,\s*\n\s*@media/);
  });
});
