import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieSet = vi.fn();
const cookieDelete = vi.fn();
const cookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({ set: cookieSet, delete: cookieDelete, get: cookieGet }),
}));

import { setAuthCookies, clearAuthCookies, getAuthToken, getRefreshToken } from "./cookie";
import { ACCESS_COOKIE, REFRESH_COOKIE, ACCESS_FALLBACK_MAX_AGE, REFRESH_MAX_AGE } from "./cookie-config";

beforeEach(() => {
  cookieSet.mockReset();
  cookieDelete.mockReset();
  cookieGet.mockReset();
});

describe("setAuthCookies", () => {
  it("ставит обе cookie; access maxAge = expires_in, refresh = 30д", async () => {
    await setAuthCookies({ access: "acc", refresh: "ref", expiresIn: 900 });
    expect(cookieSet).toHaveBeenCalledWith(ACCESS_COOKIE, "acc", expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 900 }));
    expect(cookieSet).toHaveBeenCalledWith(REFRESH_COOKIE, "ref", expect.objectContaining({ maxAge: REFRESH_MAX_AGE }));
  });

  it("использует фолбэк maxAge, если expires_in отсутствует", async () => {
    await setAuthCookies({ access: "acc", refresh: "ref" });
    expect(cookieSet).toHaveBeenCalledWith(ACCESS_COOKIE, "acc", expect.objectContaining({ maxAge: ACCESS_FALLBACK_MAX_AGE }));
  });
});

describe("clearAuthCookies", () => {
  it("удаляет обе cookie", async () => {
    await clearAuthCookies();
    expect(cookieDelete).toHaveBeenCalledWith(ACCESS_COOKIE);
    expect(cookieDelete).toHaveBeenCalledWith(REFRESH_COOKIE);
  });
});

describe("getters", () => {
  it("getAuthToken читает access, getRefreshToken — refresh", async () => {
    cookieGet.mockImplementation((name: string) => (name === ACCESS_COOKIE ? { value: "acc" } : { value: "ref" }));
    expect(await getAuthToken()).toBe("acc");
    expect(await getRefreshToken()).toBe("ref");
  });
});
