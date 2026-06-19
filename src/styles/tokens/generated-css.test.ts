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
  it("high-contrast is a standalone rule, NOT a selector+@media list (valid CSS)", () => {
    expect(css).toContain('[data-contrast="high"] {');
    expect(css).not.toMatch(/,\s*\n\s*@media/); // запятая перед @media = невалидно
    expect(css).toContain(':root:not([data-contrast="normal"])');
    expect(css).toContain('(prefers-color-scheme: dark) and (prefers-contrast: more)');
  });
});
