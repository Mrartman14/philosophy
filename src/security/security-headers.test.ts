import { describe, expect, it } from "vitest";

import { staticSecurityHeaders } from "./security-headers";

describe("staticSecurityHeaders", () => {
  it("всегда содержит nosniff/referrer/frame/permissions", () => {
    const keys = staticSecurityHeaders(false).map((h) => h.key);
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
    const h = staticSecurityHeaders(false).find(
      (x) => x.key === "X-Content-Type-Options",
    );
    expect(h?.value).toBe("nosniff");
  });
  it("без HSTS вне прода", () => {
    const keys = staticSecurityHeaders(false).map((h) => h.key);
    expect(keys).not.toContain("Strict-Transport-Security");
  });
  it("HSTS в проде", () => {
    const hsts = staticSecurityHeaders(true).find(
      (h) => h.key === "Strict-Transport-Security",
    );
    expect(hsts?.value).toContain("max-age=31536000");
    expect(hsts?.value).not.toContain("preload");
  });
});
