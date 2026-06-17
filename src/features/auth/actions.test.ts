// src/features/auth/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Мокаем next/headers и next/navigation до импорта actions.
const cookieSet = vi.fn();
const cookieDelete = vi.fn();
const cookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({ set: cookieSet, delete: cookieDelete, get: cookieGet }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    // Имитируем NEXT_REDIRECT: throw с правильным digest.
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
}));

import { loginAction, registerAction, logoutAction } from "./actions";

function fd(input: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(input)) f.append(k, v);
  return f;
}

const validCreds = { username: "alice", password: "secret" };
const initial = { success: true as const, data: undefined };

beforeEach(() => {
  cookieSet.mockReset();
  cookieDelete.mockReset();
  cookieGet.mockReset();
  vi.unstubAllGlobals();
});

describe("loginAction", () => {
  it("200 OK + token → ставит cookie и делает redirect", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ data: { token: "jwt-abc" } }), {
          status: 200,
        }))
      )
    );

    await expect(loginAction(initial, fd({ ...validCreds, next: "/admin" })))
      .rejects.toThrow("NEXT_REDIRECT");

    expect(cookieSet).toHaveBeenCalledOnce();
    const cookieSetCall = cookieSet.mock.calls[0] as [string, string, Record<string, unknown>] | undefined;
    if (cookieSetCall === undefined) throw new Error("cookieSet не был вызван");
    const [name, value, opts] = cookieSetCall;
    expect(name).toBe("token");
    expect(value).toBe("jwt-abc");
    expect(opts).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("200 OK + опасный next → redirect на /", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ data: { token: "jwt" } }), { status: 200 }))
      )
    );
    let thrown: Error & { digest?: string } = new Error("not thrown");
    try {
      await loginAction(initial, fd({ ...validCreds, next: "//evil.com" }));
    } catch (e) {
      thrown = e as Error & { digest?: string };
    }
    expect(thrown.digest).toBe("NEXT_REDIRECT;/");
  });

  it("200 без token в data → service_unavailable, cookie не выставлена", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data: {} }), { status: 200 })))
    );
    const res = await loginAction(initial, fd(validCreds));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("service_unavailable");
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("401 → invalid_credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({}), { status: 401 })))
    );
    const res = await loginAction(initial, fd(validCreds));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("invalid_credentials");
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("403 → account_blocked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({}), { status: 403 })))
    );
    const res = await loginAction(initial, fd(validCreds));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("account_blocked");
  });

  it("500 → service_unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({}), { status: 500 })))
    );
    const res = await loginAction(initial, fd(validCreds));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("service_unavailable");
  });

  it("network reject → service_unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new TypeError("fetch failed");
      })
    );
    const res = await loginAction(initial, fd(validCreds));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("service_unavailable");
  });

  it("пустой password → validation, cookie не выставлена", async () => {
    const res = await loginAction(initial, fd({ username: "alice", password: "" }));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("validation");
    expect(cookieSet).not.toHaveBeenCalled();
  });
});

const validReg = {
  username: "alice",
  password: "secret1",
  password_confirm: "secret1",
};

describe("registerAction", () => {
  it("201 + next → redirect на /login?registered=1&next=…, cookie не выставлена", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(
          JSON.stringify({ data: { id: "u1", username: "alice" } }),
          { status: 201 }
        ))
      )
    );
    let thrown: Error & { digest?: string } = new Error("not thrown");
    try {
      await registerAction(initial, fd({ ...validReg, next: "/admin" }));
    } catch (e) {
      thrown = e as Error & { digest?: string };
    }
    expect(thrown.digest).toBe(
      "NEXT_REDIRECT;/login?registered=1&next=%2Fadmin"
    );
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("201 без next → redirect на /login?registered=1", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ data: { id: "u1" } }), { status: 201 }))
      )
    );
    let thrown: Error & { digest?: string } = new Error("not thrown");
    try {
      await registerAction(initial, fd(validReg));
    } catch (e) {
      thrown = e as Error & { digest?: string };
    }
    expect(thrown.digest).toBe("NEXT_REDIRECT;/login?registered=1");
  });

  it("201 + опасный next → next отбрасывается (redirect без next)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ data: { id: "u1" } }), { status: 201 }))
      )
    );
    let thrown: Error & { digest?: string } = new Error("not thrown");
    try {
      await registerAction(initial, fd({ ...validReg, next: "//evil.com" }));
    } catch (e) {
      thrown = e as Error & { digest?: string };
    }
    expect(thrown.digest).toBe("NEXT_REDIRECT;/login?registered=1");
  });

  it("409 → username_taken", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({}), { status: 409 })))
    );
    const res = await registerAction(initial, fd(validReg));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("username_taken");
  });

  it("422 → invalid_input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({}), { status: 422 })))
    );
    const res = await registerAction(initial, fd(validReg));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("invalid_input");
  });

  it("429 → too_many_requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("rate limit exceeded", { status: 429 })))
    );
    const res = await registerAction(initial, fd(validReg));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("too_many_requests");
  });

  it("500 → service_unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({}), { status: 500 })))
    );
    const res = await registerAction(initial, fd(validReg));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("service_unavailable");
  });

  it("network reject → service_unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new TypeError("fetch failed");
      })
    );
    const res = await registerAction(initial, fd(validReg));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("service_unavailable");
  });

  it("пароли не совпадают → validation, fetch не вызван", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await registerAction(
      initial,
      fd({ username: "alice", password: "secret1", password_confirm: "other77" })
    );
    expect(res.success).toBe(false);
    if (res.success || res.code !== "validation") {
      throw new Error("expected validation error");
    }
    expect(res.fieldErrors.password_confirm).toBe("Пароли не совпадают");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("logoutAction", () => {
  it("есть токен → POST /api/auth/logout с Bearer, чистит cookie, redirect на /", async () => {
    cookieGet.mockReturnValue({ value: "jwt-xyz" });
    const fetchSpy = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 204 }))
    );
    vi.stubGlobal("fetch", fetchSpy);

    let thrown: Error & { digest?: string } = new Error("not thrown");
    try {
      await logoutAction();
    } catch (e) {
      thrown = e as Error & { digest?: string };
    }

    expect(thrown.digest).toBe("NEXT_REDIRECT;/");
    expect(fetchSpy).toHaveBeenCalledOnce();
    const call = fetchSpy.mock.calls[0] as [string, RequestInit] | undefined;
    if (call === undefined) throw new Error("fetch не был вызван");
    const [url, init] = call;
    expect(url).toMatch(/\/api\/auth\/logout$/);
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer jwt-xyz");
    // запрос ограничен таймаутом через AbortController
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(cookieDelete).toHaveBeenCalledWith("token");
  });

  it("бэк недоступен (network reject) → всё равно чистит cookie и redirect", async () => {
    cookieGet.mockReturnValue({ value: "jwt-xyz" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new TypeError("fetch failed");
      })
    );

    let thrown: Error & { digest?: string } = new Error("not thrown");
    try {
      await logoutAction();
    } catch (e) {
      thrown = e as Error & { digest?: string };
    }

    expect(thrown.digest).toBe("NEXT_REDIRECT;/");
    expect(cookieDelete).toHaveBeenCalledWith("token");
  });

  it("бэк ответил 401 (токен уже невалиден) → всё равно чистит cookie и redirect", async () => {
    cookieGet.mockReturnValue({ value: "stale-jwt" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({}), { status: 401 }))
      )
    );

    let thrown: Error & { digest?: string } = new Error("not thrown");
    try {
      await logoutAction();
    } catch (e) {
      thrown = e as Error & { digest?: string };
    }

    expect(thrown.digest).toBe("NEXT_REDIRECT;/");
    expect(cookieDelete).toHaveBeenCalledWith("token");
  });

  it("нет токена → бэк не зовём, но cookie чистим и redirect на /", async () => {
    cookieGet.mockReturnValue(undefined);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    let thrown: Error & { digest?: string } = new Error("not thrown");
    try {
      await logoutAction();
    } catch (e) {
      thrown = e as Error & { digest?: string };
    }

    expect(thrown.digest).toBe("NEXT_REDIRECT;/");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(cookieDelete).toHaveBeenCalledWith("token");
  });
});
