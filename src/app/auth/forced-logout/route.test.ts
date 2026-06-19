import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

const { banSignalMock } = vi.hoisted(() => ({ banSignalMock: vi.fn() }));
vi.mock("@/utils/me", () => ({ getBanSignal: banSignalMock }));

import { GET } from "./route";

beforeEach(() => banSignalMock.mockReset());
afterEach(() => vi.clearAllMocks());

describe("GET /auth/forced-logout", () => {
  it("забанен → 303 /login?blocked=1, чистит token-cookie и refresh-cookie, ставит Clear-Site-Data", async () => {
    banSignalMock.mockResolvedValue(true);
    const res = await GET(new NextRequest("https://app.test/some/page"));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://app.test/login?blocked=1",
    );
    expect(res.headers.get("clear-site-data")).toBe('"cookies", "storage"');

    // Next.js сериализует несколько Set-Cookie через getSetCookie()
    const setCookies = res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie") ?? ""];

    const tokenCookie = setCookies.find((c) => c.startsWith("token="));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toMatch(/Max-Age=0/i);
    expect(tokenCookie).toMatch(/Path=\//);

    // Безопасность: форс-логаут обязан чистить и refresh_token
    const refreshCookie = setCookies.find((c) => c.startsWith("refresh_token="));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/Max-Age=0/i);
    expect(refreshCookie).toMatch(/Path=\//);
  });

  it("НЕ забанен (CSRF/случайный заход) → 303 на /, ничего не трогает", async () => {
    banSignalMock.mockResolvedValue(false);
    const res = await GET(new NextRequest("https://app.test/some/page"));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://app.test/");
    expect(res.headers.get("clear-site-data")).toBeNull();
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
