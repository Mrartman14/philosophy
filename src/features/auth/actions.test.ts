// src/features/auth/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Мокаем next/headers и next/navigation до импорта actions.
const cookieSet = vi.fn();
const cookieDelete = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSet, delete: cookieDelete }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    // Имитируем NEXT_REDIRECT: throw с правильным digest.
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
}));

import { loginAction } from "./actions";

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
  vi.unstubAllGlobals();
});

describe("loginAction", () => {
  it("200 OK + token → ставит cookie и делает redirect", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ data: { token: "jwt-abc" } }), {
          status: 200,
        })
      )
    );

    await expect(loginAction(initial, fd({ ...validCreds, next: "/admin" })))
      .rejects.toThrow("NEXT_REDIRECT");

    expect(cookieSet).toHaveBeenCalledOnce();
    const [name, value, opts] = cookieSet.mock.calls[0];
    expect(name).toBe("token");
    expect(value).toBe("jwt-abc");
    expect(opts).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("200 OK + опасный next → redirect на /", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ data: { token: "jwt" } }), { status: 200 })
      )
    );
    await expect(
      loginAction(initial, fd({ ...validCreds, next: "//evil.com" }))
    ).rejects.toThrow(/NEXT_REDIRECT/);
    // redirect был вызван с "/"
  });

  it("200 без token в data → service_unavailable, cookie не выставлена", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 }))
    );
    const res = await loginAction(initial, fd(validCreds));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("service_unavailable");
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("401 → invalid_credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 401 }))
    );
    const res = await loginAction(initial, fd(validCreds));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("invalid_credentials");
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("403 → account_blocked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 403 }))
    );
    const res = await loginAction(initial, fd(validCreds));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("account_blocked");
  });

  it("500 → service_unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 500 }))
    );
    const res = await loginAction(initial, fd(validCreds));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("service_unavailable");
  });

  it("network reject → service_unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
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
