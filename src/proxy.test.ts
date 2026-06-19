import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/features/auth/cookie-config";

import { proxy } from "./proxy";

function req(cookies: Record<string, string>, path = "/lectures"): NextRequest {
  const r = new NextRequest(`https://app.test${path}`);
  for (const [k, v] of Object.entries(cookies)) r.cookies.set(k, v);
  return r;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("middleware — прозрачный refresh", () => {
  it("access есть → не зовёт бэк", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await proxy(req({ [ACCESS_COOKIE]: "acc", [REFRESH_COOKIE]: "ref" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("access нет, refresh есть → рефреш и Set-Cookie новой пары", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(
      JSON.stringify({ data: { access_token: "acc2", refresh_token: "ref2", expires_in: 900 } }),
      { status: 200 },
    )));
    vi.stubGlobal("fetch", fetchMock);
    const res = await proxy(req({ [REFRESH_COOKIE]: "ref" }));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(res.cookies.get(ACCESS_COOKIE)?.value).toBe("acc2");
    expect(res.cookies.get(REFRESH_COOKIE)?.value).toBe("ref2");
  });

  it("refresh протух (401) → чистит обе cookie", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))));
    const res = await proxy(req({ [REFRESH_COOKIE]: "bad" }));
    expect(res.cookies.get(ACCESS_COOKIE)?.value).toBe("");
    expect(res.cookies.get(REFRESH_COOKIE)?.value).toBe("");
  });

  it("нет ни access, ни refresh → пропуск без вызова бэка", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await proxy(req({}));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("middleware — admin-гейт", () => {
  it("гость на /admin (нет cookie) → редирект на /login без вызова бэка", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await proxy(req({}, "/admin"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("/admin с валидным access → проходит без вызова бэка и без редиректа", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await proxy(req({ [ACCESS_COOKIE]: "acc" }, "/admin"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toBeLessThan(300);
  });

  it("/admin с протухшим access + неуспешный refresh (401) → редирект на /login + обе cookie очищены", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))));
    const res = await proxy(req({ [REFRESH_COOKIE]: "bad-ref" }, "/admin"));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toContain("/login");
    // обе cookie должны быть удалены (пустое значение)
    expect(res.cookies.get(ACCESS_COOKIE)?.value).toBe("");
    expect(res.cookies.get(REFRESH_COOKIE)?.value).toBe("");
  });
});
