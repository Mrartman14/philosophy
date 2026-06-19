import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import middleware from "./proxy";

function req(cookies: Record<string, string>): NextRequest {
  const r = new NextRequest("https://app.test/lectures");
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
    await middleware(req({ token: "acc", refresh_token: "ref" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("access нет, refresh есть → рефреш и Set-Cookie новой пары", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(
      JSON.stringify({ data: { access_token: "acc2", refresh_token: "ref2", expires_in: 900 } }),
      { status: 200 },
    )));
    vi.stubGlobal("fetch", fetchMock);
    const res = await middleware(req({ refresh_token: "ref" }));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(res.cookies.get("token")?.value).toBe("acc2");
    expect(res.cookies.get("refresh_token")?.value).toBe("ref2");
  });

  it("refresh протух (401) → чистит обе cookie", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))));
    const res = await middleware(req({ refresh_token: "bad" }));
    expect(res.cookies.get("token")?.value).toBe("");
    expect(res.cookies.get("refresh_token")?.value).toBe("");
  });

  it("нет ни access, ни refresh → пропуск без вызова бэка", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await middleware(req({}));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
