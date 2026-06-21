import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn (tailwind-merge)", () => {
  it("drops falsy inputs", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("resolves size/height conflicts (last wins): size-7 over h-9 w-9", () => {
    const out = cn("h-9 w-9", "size-7");
    expect(out).toContain("size-7");
    expect(out).not.toContain("h-9");
    expect(out).not.toContain("w-9");
  });

  it("resolves v4 CSS-variable height tokens (sm wins over md)", () => {
    const out = cn("h-(--size-control-h-md)", "h-(--size-control-h-sm)");
    expect(out).toContain("h-(--size-control-h-sm)");
    expect(out).not.toContain("h-(--size-control-h-md)");
  });

  it("resolves gap conflict on a structural surface (consumer gap wins)", () => {
    const out = cn("flex flex-col gap-(--space-stack)", "gap-2");
    expect(out).toContain("gap-2");
    expect(out).not.toContain("gap-(--space-stack)");
    expect(out).toContain("flex-col");
  });
});
