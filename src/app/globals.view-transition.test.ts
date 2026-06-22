import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("globals.css — View Transitions", () => {
  it("объявляет VT-токены в :root", () => {
    expect(css).toMatch(/--vt-duration:/);
    expect(css).toMatch(/--vt-easing:/);
  });
  it("отключает UA-кроссфейд корня (под наш clip-reveal)", () => {
    expect(css).toMatch(/::view-transition-old\(root\)/);
    expect(css).toMatch(/::view-transition-new\(root\)/);
  });
  it("глушит view-transition под data-motion=reduced", () => {
    expect(css).toMatch(/\[data-motion="reduced"\][^}]*::view-transition-group/);
  });
});
