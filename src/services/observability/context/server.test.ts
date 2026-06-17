// src/services/observability/context/server.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// React cache() в Vitest заменяем на identity — мемоизация-холдер работает как обычная функция.
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  return { ...actual, cache: <T,>(fn: T): T => fn };
});

import {
  getServerContext,
  hashActor,
  serverContextProvider,
  setServerActor,
  setServerRoute,
} from "./server";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("hashActor", () => {
  it("без соли → 'anon'", () => {
    vi.stubEnv("OBSERVABILITY_ACTOR_SALT", "");
    expect(hashActor("user-1")).toBe("anon");
  });

  it("с солью → детерминированный псевдоним, не равный сырому id", () => {
    vi.stubEnv("OBSERVABILITY_ACTOR_SALT", "pepper");
    const a = hashActor("user-1");
    const b = hashActor("user-1");
    expect(a).toBe(b);
    expect(a).not.toBe("user-1");
    expect(a.length).toBeGreaterThan(0);
  });

  it("разные id → разные хеши", () => {
    vi.stubEnv("OBSERVABILITY_ACTOR_SALT", "pepper");
    expect(hashActor("a")).not.toBe(hashActor("b"));
  });
});

describe("getServerContext + mutators", () => {
  it("requestId присутствует, runtime=server, route=null изначально", () => {
    const ctx = getServerContext();
    expect(ctx.runtime).toBe("server");
    expect(typeof ctx.requestId).toBe("string");
    expect((ctx.requestId ?? "").length).toBeGreaterThan(0);
    expect(ctx.route).toBeNull();
  });

  it("setServerActor мутирует actorHash/actorRole в держателе контекста", () => {
    vi.stubEnv("OBSERVABILITY_ACTOR_SALT", "pepper");
    setServerActor("user-1", "admin");
    const ctx = getServerContext();
    expect(ctx.actorRole).toBe("admin");
    expect(ctx.actorHash).toBe(hashActor("user-1"));
  });

  it("setServerRoute мутирует route", () => {
    setServerRoute("/lectures/1");
    expect(getServerContext().route).toBe("/lectures/1");
  });
});

describe("serverContextProvider", () => {
  it("getContext() отдаёт server-контекст в скоупе", () => {
    const ctx = serverContextProvider.getContext();
    expect(ctx.runtime).toBe("server");
  });
});
