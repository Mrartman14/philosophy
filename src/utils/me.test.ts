import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: cookieGet }),
}));
// React.cache в тестах вне рендер-скоупа — делаем passthrough для детерминизма.
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  return { ...actual, cache: <T,>(fn: T) => fn };
});

import { getMe, getBanSignal } from "./me";

const VALID_ME = {
  id: "u1",
  username: "alice",
  role: "user",
  status: "active",
  capabilities: [],
};

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(body), { status })),
    ),
  );
}

beforeEach(() => {
  cookieGet.mockReset();
  vi.unstubAllGlobals();
});

describe("getMe / getBanSignal", () => {
  it("нет токена → null, не забанен, fetch не вызван", async () => {
    cookieGet.mockReturnValue(undefined);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await getMe()).toBeNull();
    expect(await getBanSignal()).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("200 → Me, не забанен", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    stubFetch(200, { data: VALID_ME });
    expect(await getMe()).toMatchObject({ id: "u1", username: "alice" });
    expect(await getBanSignal()).toBe(false);
  });

  it("401 → null, не забанен", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    stubFetch(401, {});
    expect(await getMe()).toBeNull();
    expect(await getBanSignal()).toBe(false);
  });

  it("404 → null, не забанен", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    stubFetch(404, {});
    expect(await getMe()).toBeNull();
    expect(await getBanSignal()).toBe(false);
  });

  it("403 + code BANNED → null, ЗАБАНЕН", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    stubFetch(403, { code: "BANNED" });
    expect(await getMe()).toBeNull();
    expect(await getBanSignal()).toBe(true);
  });

  it("403 без BANNED → null, не забанен", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    stubFetch(403, { code: "FORBIDDEN" });
    expect(await getMe()).toBeNull();
    expect(await getBanSignal()).toBe(false);
  });

  it("500 → throw (инцидент, не гость)", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    stubFetch(500, {});
    await expect(getMe()).rejects.toThrow(/backend returned 500/);
  });
});
