import { describe, expect, it } from "vitest";

import { staticSecurityHeaders } from "./security-headers";

describe("staticSecurityHeaders", () => {
  it("всегда содержит nosniff/referrer/frame/permissions", () => {
    const keys = staticSecurityHeaders().map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "X-Content-Type-Options",
        "Referrer-Policy",
        "X-Frame-Options",
        "Permissions-Policy",
      ]),
    );
  });
  it("nosniff именно nosniff", () => {
    const h = staticSecurityHeaders().find(
      (x) => x.key === "X-Content-Type-Options",
    );
    expect(h?.value).toBe("nosniff");
  });
  it("НЕ ставит HSTS — им владеет edge (nginx)", () => {
    const keys = staticSecurityHeaders().map((h) => h.key);
    expect(keys).not.toContain("Strict-Transport-Security");
  });
});
