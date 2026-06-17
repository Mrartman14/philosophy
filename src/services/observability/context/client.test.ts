// src/services/observability/context/client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  clientContextProvider,
  getClientContext,
  setClientActor,
  setClientRoute,
} from "./client";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("getClientContext", () => {
  it("singleton: тот же sessionId между вызовами, runtime=client", () => {
    const a = getClientContext();
    const b = getClientContext();
    expect(a.runtime).toBe("client");
    expect(typeof a.sessionId).toBe("string");
    expect((a.sessionId ?? "").length).toBeGreaterThan(0);
    expect(a.sessionId).toBe(b.sessionId);
  });

  it("route берётся из location.pathname", () => {
    expect(getClientContext().route).toBe(window.location.pathname);
  });
});

describe("client mutators", () => {
  it("setClientActor пишет actorHash/actorRole (уже хешированный hash)", () => {
    setClientActor("h-abc", "user");
    const ctx = getClientContext();
    expect(ctx.actorHash).toBe("h-abc");
    expect(ctx.actorRole).toBe("user");
  });

  it("setClientRoute обновляет route", () => {
    setClientRoute("/glossary");
    expect(getClientContext().route).toBe("/glossary");
  });
});

describe("clientContextProvider", () => {
  it("getContext() отдаёт тот же singleton", () => {
    expect(clientContextProvider.getContext().sessionId).toBe(
      getClientContext().sessionId,
    );
  });
});
