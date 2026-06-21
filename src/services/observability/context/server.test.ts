// src/services/observability/context/server.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Реальный мемоайзер (не identity): один слот на модуль-инстанс. В Vitest модули
// изолированы по файлу, поэтому это эмулирует один per-request scope для всего файла.
vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  const cache = <A extends unknown[], R>(fn: (...a: A) => R): ((...a: A) => R) => {
    let value: R;
    let has = false;
    return (...a: A): R => {
      if (!has) { value = fn(...a); has = true; }
      return value;
    };
  };
  return { ...actual, cache };
});

import {
  getActorContext,
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
  it("без соли → 'anon'", async () => {
    expect(await hashActor("user-1", null)).toBe("anon");
    expect(await hashActor("user-1", "")).toBe("anon");
  });

  it("с солью → детерминированный псевдоним, не равный сырому id", async () => {
    const a = await hashActor("user-1", "pepper");
    const b = await hashActor("user-1", "pepper");
    expect(a).toBe(b);
    expect(a).not.toBe("user-1");
    expect(a.length).toBeGreaterThan(0);
  });

  it("разные id → разные хеши", async () => {
    expect(await hashActor("a", "pepper")).not.toBe(await hashActor("b", "pepper"));
  });
});

describe("getServerContext + mutators", () => {
  it("requestId присутствует, runtime=server, route=null изначально", () => {
    const ctx = getServerContext();
    expect(ctx.runtime).toBe("server");
    expect(typeof ctx.requestId).toBe("string");
    expect((ctx.requestId ?? "").length).toBeGreaterThan(0);
    expect(ctx.route).toBeNull();
    // до setServerActor актор ещё не разрешён → null (гость)
    expect(getActorContext()).toBeNull();
  });

  it("setServerActor мутирует actorHash/actorRole в держателе контекста", async () => {
    vi.stubEnv("OBSERVABILITY_ACTOR_SALT", "pepper");
    await setServerActor("user-1", "admin");
    const ctx = getServerContext();
    expect(ctx.actorRole).toBe("admin");
    expect(ctx.actorHash).toBe(await hashActor("user-1", "pepper"));
  });

  it("getActorContext возвращает хешированного актора для прокидывания на клиент", async () => {
    vi.stubEnv("OBSERVABILITY_ACTOR_SALT", "pepper");
    await setServerActor("user-1", "admin");
    expect(getActorContext()).toEqual({
      hash: await hashActor("user-1", "pepper"),
      role: "admin",
    });
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
