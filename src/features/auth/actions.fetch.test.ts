import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieStore = { get: vi.fn(() => undefined) };
vi.mock("next/headers", () => ({ cookies: () => Promise.resolve(cookieStore) }));

const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); });
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));

vi.mock("./cookie", () => ({
  setAuthCookie: vi.fn(() => Promise.resolve(undefined)),
  clearAuthCookie: vi.fn(() => Promise.resolve(undefined)),
  getAuthToken: vi.fn(() => Promise.resolve(undefined)),
}));

const instrumentedFetch = vi.fn();
vi.mock("@/services/observability/server-fetch", () => ({
  instrumentedFetch: (...a: unknown[]) => instrumentedFetch(...a) as unknown,
}));

import { loginAction } from "./actions";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("loginAction transport", () => {
  beforeEach(() => {
    instrumentedFetch.mockReset();
    redirect.mockClear();
  });

  it("calls instrumentedFetch with surface auth.login and succeeds", async () => {
    instrumentedFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: { token: "t" } }), { status: 200 }),
    );
    await expect(
      loginAction({ success: true, data: undefined }, form({ username: "neo", password: "trinity99", next: "/" })),
    ).resolves.toBeDefined();

    const call = instrumentedFetch.mock.calls[0];
    const meta = (call?.[2] ?? {}) as { surface: string };
    expect(meta.surface).toBe("auth.login");
  });
});
