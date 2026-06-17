import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: cookieGet }),
}));
// redirect() в Next прерывает control flow через throw — мокаем так же,
// чтобы отличать «редиректнул» от «вернул Me».
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT;${url}`);
});
// Доступ к redirectMock отложен в nested-стрелку: фабрика vi.mock исполняется
// на этапе хойстинга (до инициализации const), прямая ссылка дала бы TDZ.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));
// React.cache в тестах вне рендер-скоупа — делаем passthrough для детерминизма.
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  return { ...actual, cache: <T,>(fn: T) => fn };
});

import {
  getMe,
  getBanSignal,
  requireActiveUserOrRedirect,
  requireUserOrRedirect,
} from "./me";

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
  redirectMock.mockClear();
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

  it("403 с не-JSON телом → null, не забанен (best-effort)", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("<html>nope", { status: 403 }))),
    );
    expect(await getMe()).toBeNull();
    expect(await getBanSignal()).toBe(false);
  });

  it("500 → throw (инцидент, не гость)", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    stubFetch(500, {});
    await expect(getMe()).rejects.toThrow(/backend returned 500/);
  });
});

describe("requireActiveUserOrRedirect", () => {
  it("гость → redirect на /login?next=<encoded>, не возвращает", async () => {
    cookieGet.mockReturnValue(undefined);
    await expect(requireActiveUserOrRedirect("/me/forms")).rejects.toThrow(
      /NEXT_REDIRECT/,
    );
    expect(redirectMock).toHaveBeenCalledWith("/login?next=%2Fme%2Fforms");
  });

  it("suspended → redirect (status !== active)", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    stubFetch(200, { data: { ...VALID_ME, status: "suspended" } });
    await expect(requireActiveUserOrRedirect("/me/forms")).rejects.toThrow(
      /NEXT_REDIRECT/,
    );
    expect(redirectMock).toHaveBeenCalledWith("/login?next=%2Fme%2Fforms");
  });

  it("active → возвращает Me, без redirect", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    stubFetch(200, { data: VALID_ME });
    const me = await requireActiveUserOrRedirect("/me/forms");
    expect(me).toMatchObject({ id: "u1", status: "active" });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("requireUserOrRedirect", () => {
  it("гость → redirect на /login?next=<encoded>", async () => {
    cookieGet.mockReturnValue(undefined);
    await expect(requireUserOrRedirect("/me/stats")).rejects.toThrow(
      /NEXT_REDIRECT/,
    );
    expect(redirectMock).toHaveBeenCalledWith("/login?next=%2Fme%2Fstats");
  });

  it("suspended → возвращает Me БЕЗ redirect (ключевое отличие от active-гейта)", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    stubFetch(200, { data: { ...VALID_ME, status: "suspended" } });
    const me = await requireUserOrRedirect("/me/stats");
    expect(me).toMatchObject({ id: "u1", status: "suspended" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("active → возвращает Me, без redirect", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    stubFetch(200, { data: VALID_ME });
    const me = await requireUserOrRedirect("/me/stats");
    expect(me).toMatchObject({ id: "u1" });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
