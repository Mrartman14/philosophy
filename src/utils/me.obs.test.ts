import { describe, it, expect, vi, beforeEach } from "vitest";

import { createMemorySink } from "@/services/observability/adapters/memory-adapter";
import { setSink } from "@/services/observability/core/registry";

const setServerActor = vi.fn();
vi.mock("@/services/observability", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/observability")>();
  return { ...actual, setServerActor };
});

const cookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: cookieGet }),
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T,>(fn: T) => fn };
});

const mem = createMemorySink();

beforeEach(() => {
  mem.clear();
  setSink(mem.sink);
  setServerActor.mockClear();
  cookieGet.mockReset();
  vi.unstubAllGlobals();
});

function metric(name: string) {
  return mem.records.filter((r) => r.kind === "metric" && r.metric === name);
}

describe("getAuthState observability", () => {
  it("guest без токена → auth.resolve{result:guest}, без setServerActor", async () => {
    cookieGet.mockReturnValue(undefined);
    const { getMe } = await import("./me");
    expect(await getMe()).toBeNull();
    expect(metric("auth.resolve")[0]?.attributes).toMatchObject({ result: "guest" });
    expect(setServerActor).not.toHaveBeenCalled();
  });

  it("active me → auth.resolve{result:active} + setServerActor(id, role)", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "u1",
                username: "ann",
                role: "user",
                status: "active",
                capabilities: [],
              },
            }),
        }),
      ),
    );
    const { getMe } = await import("./me");
    const me = await getMe();
    expect(me?.id).toBe("u1");
    expect(metric("auth.resolve")[0]?.attributes).toMatchObject({ result: "active" });
    expect(setServerActor).toHaveBeenCalledWith("u1", "user");
  });

  it("5xx → throw + capture backend.5xx{handled:false}", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ status: 503, ok: false, json: () => Promise.resolve({}) })),
    );
    const { getMe } = await import("./me");
    await expect(getMe()).rejects.toThrow(/503/);
    const errs = mem.records.filter((r) => r.kind === "error");
    expect(errs[0]).toMatchObject({ errorClass: "backend.5xx", handled: false });
  });

  it("malformed payload → throw + capture unexpected{handled:false}", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          json: () => Promise.resolve({ data: { id: "x" } }),
        }),
      ),
    );
    const { getMe } = await import("./me");
    await expect(getMe()).rejects.toThrow(/malformed/);
    const errs = mem.records.filter((r) => r.kind === "error");
    expect(errs[0]).toMatchObject({ errorClass: "unexpected", handled: false, attributes: { reason: "malformed_me_payload" } });
  });

  it("suspended me → auth.resolve{result:suspended}", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "u2",
                username: "bob",
                role: "user",
                status: "suspended",
                capabilities: [],
              },
            }),
        }),
      ),
    );
    const { getMe } = await import("./me");
    await getMe();
    expect(metric("auth.resolve")[0]?.attributes).toMatchObject({ result: "suspended" });
  });

  it("banned (403 + BANNED) → auth.resolve{result:banned}", async () => {
    cookieGet.mockReturnValue({ value: "tok" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          status: 403,
          ok: false,
          json: () => Promise.resolve({ code: "BANNED" }),
        }),
      ),
    );
    const { getMe } = await import("./me");
    expect(await getMe()).toBeNull();
    expect(metric("auth.resolve")[0]?.attributes).toMatchObject({ result: "banned" });
  });
});
