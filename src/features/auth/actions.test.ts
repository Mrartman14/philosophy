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

// Мок @/i18n: getT возвращает переводчик, возвращающий ключ вместо текста.
// Это позволяет схемам-фабрикам работать без request-scope next-intl.
vi.mock("@/i18n", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/i18n")>();
  return {
    ...original,
    getT: () => Promise.resolve((key: string) => key),
  };
});

import { loginAction, registerAction, logoutAction, logoutAllAction } from "./actions";

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
  it("200 OK + access+refresh → ставит обе cookie и редиректит", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(new Response(
        JSON.stringify({ data: { access_token: "acc", refresh_token: "ref", expires_in: 900 } }),
        { status: 200 },
      )),
    ));
    await expect(loginAction(initial, fd({ username: "alice", password: "secret", next: "/admin" })))
      .rejects.toThrow("NEXT_REDIRECT");
    expect(cookieSet).toHaveBeenCalledWith("token", "acc", expect.objectContaining({ maxAge: 900 }));
    expect(cookieSet).toHaveBeenCalledWith("refresh_token", "ref", expect.any(Object));
  });

  it("200 OK + опасный next → redirect на /", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ data: { access_token: "jwt", refresh_token: "ref" } }), { status: 200 }))
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

  it("200 без refresh в data → service_unavailable, cookie не выставлена", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data: { access_token: "acc" } }), { status: 200 })))
    );
    const res = await loginAction(initial, fd(validCreds));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("service_unavailable");
    expect(cookieSet).not.toHaveBeenCalled();
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
    // Заглушка getT возвращает ключ, а не текст — по аналогии с schemas.test.ts
    expect(res.fieldErrors.password_confirm).toBe("register.passwordConfirmMismatch");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("logoutAction (per-device)", () => {
  it("шлёт refresh_token в теле и чистит обе cookie", async () => {
    cookieGet.mockImplementation((n: string) => (n === "refresh_token" ? { value: "ref" } : { value: "acc" }));
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT");
    const call = fetchMock.mock.calls[0];
    if (call === undefined) throw new Error("fetch не был вызван");
    const [, opts] = call as unknown as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toEqual({ refresh_token: "ref" });
    expect(cookieDelete).toHaveBeenCalledWith("token");
    expect(cookieDelete).toHaveBeenCalledWith("refresh_token");
  });

  it("бэк недоступен (network reject) → всё равно чистит cookie и redirect", async () => {
    cookieGet.mockImplementation((n: string) => (n === "refresh_token" ? { value: "ref" } : { value: "acc" }));
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
    expect(cookieDelete).toHaveBeenCalledWith("refresh_token");
  });

  it("нет refresh-токена → бэк не зовём, но cookie чистим и redirect на /", async () => {
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
    expect(cookieDelete).toHaveBeenCalledWith("refresh_token");
  });
});

describe("logoutAllAction", () => {
  it("шлёт Bearer access на logout-all и чистит обе cookie", async () => {
    cookieGet.mockImplementation((n: string) => (n === "refresh_token" ? { value: "ref" } : { value: "acc" }));
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(logoutAllAction()).rejects.toThrow("NEXT_REDIRECT");
    const call = fetchMock.mock.calls[0];
    if (call === undefined) throw new Error("fetch не был вызван");
    const [url, opts] = call as unknown as [string, { headers: HeadersInit }];
    expect(url).toContain("/api/auth/logout-all");
    // headers приходят как объект Headers (инструментованный fetch оборачивает через new Headers())
    const headers = new Headers(opts.headers);
    expect(headers.get("Authorization")).toBe("Bearer acc");
    expect(cookieDelete).toHaveBeenCalledWith("token");
    expect(cookieDelete).toHaveBeenCalledWith("refresh_token");
  });

  it("бэк недоступен → всё равно чистит cookie и redirect", async () => {
    cookieGet.mockImplementation((n: string) => (n === "refresh_token" ? { value: "ref" } : { value: "acc" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new TypeError("fetch failed");
      })
    );

    let thrown: Error & { digest?: string } = new Error("not thrown");
    try {
      await logoutAllAction();
    } catch (e) {
      thrown = e as Error & { digest?: string };
    }

    expect(thrown.digest).toBe("NEXT_REDIRECT;/");
    expect(cookieDelete).toHaveBeenCalledWith("token");
    expect(cookieDelete).toHaveBeenCalledWith("refresh_token");
  });

  it("нет access-токена → бэк не зовём, cookie чистим и redirect на /", async () => {
    cookieGet.mockReturnValue(undefined);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    let thrown: Error & { digest?: string } = new Error("not thrown");
    try {
      await logoutAllAction();
    } catch (e) {
      thrown = e as Error & { digest?: string };
    }

    expect(thrown.digest).toBe("NEXT_REDIRECT;/");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(cookieDelete).toHaveBeenCalledWith("token");
    expect(cookieDelete).toHaveBeenCalledWith("refresh_token");
  });
});
