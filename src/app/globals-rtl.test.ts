import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("globals.css — RTL-готовность", () => {
  it("нет физических left:/right: объявлений", () => {
    expect(/(^|[\s;{])left\s*:/m.test(css)).toBe(false);
    expect(/(^|[\s;{])right\s*:/m.test(css)).toBe(false);
  });
  it("нет transition по физическому left/right", () => {
    expect(/transition\s*:[^;}]*\b(left|right)\b/m.test(css)).toBe(false);
  });
  it("есть .rtl-flip с зеркалированием в [dir=rtl]", () => {
    expect(css).toMatch(/\[dir=["']?rtl["']?\][^{]*\.rtl-flip[^{]*\{[^}]*scaleX\(-1\)/s);
  });
});
