import { afterEach, describe, expect, it, vi } from "vitest";

import robots from "./robots";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("robots", () => {
  it("allow / и disallow приватного", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com");
    const r = robots();
    expect(r.rules).toMatchObject({ userAgent: "*", allow: "/" });
    const disallow = (r.rules as { disallow?: string[] }).disallow ?? [];
    expect(disallow).toEqual(
      expect.arrayContaining(["/admin", "/me", "/api", "/login"]),
    );
  });
  it("sitemap → бэкендный абсолютный /sitemap.xml", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com");
    expect(robots().sitemap).toBe("https://example.com/sitemap.xml");
  });
});
