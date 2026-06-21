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

  it("refresh-fetch отклонён (network error / таймаут) → обе cookie очищены, не падает", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network error"))),
    );
    const res = await proxy(req({ [REFRESH_COOKIE]: "ref" }));
    // middleware должен вернуть ответ, не бросить
    expect(res).toBeDefined();
    expect(res.cookies.get(ACCESS_COOKIE)?.value).toBe("");
    expect(res.cookies.get(REFRESH_COOKIE)?.value).toBe("");
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

describe("middleware — obs route header", () => {
  it("прокидывает путь в request-заголовок x-pathname (источник server-route для телеметрии)", async () => {
    const res = await proxy(req({}, "/lectures/abc"));
    // NextResponse.next({request:{headers}}) сериализует переопределённые
    // request-заголовки как x-middleware-request-* + список в override-headers.
    expect(res.headers.get("x-middleware-override-headers")).toContain("x-pathname");
    expect(res.headers.get("x-middleware-request-x-pathname")).toBe("/lectures/abc");
  });
});

describe("middleware — security headers (CSP)", () => {
  it("гость получает Report-Only CSP с nonce на странице", async () => {
    const res = await proxy(req({}));
    const csp = res.headers.get("content-security-policy-report-only");
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/script-src [^;]*'nonce-/);
    // enforce-заголовка быть не должно (по умолчанию report-only)
    expect(res.headers.get("content-security-policy")).toBeNull();
  });

  it("nonce уникален на каждый запрос", async () => {
    const a = await proxy(req({}));
    const b = await proxy(req({}));
    const nonceA = a.headers
      .get("content-security-policy-report-only")
      ?.match(/'nonce-([^']+)'/)?.[1];
    const nonceB = b.headers
      .get("content-security-policy-report-only")
      ?.match(/'nonce-([^']+)'/)?.[1];
    expect(nonceA).toBeTruthy();
    expect(nonceA).not.toBe(nonceB);
  });

  it("объявлен Reporting-Endpoints", async () => {
    const res = await proxy(req({}));
    expect(res.headers.get("reporting-endpoints")).toContain("csp-endpoint");
  });
});
