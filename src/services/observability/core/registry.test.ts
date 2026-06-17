// src/services/observability/core/registry.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ObservabilitySink } from "./ports";
import {
  baseContext,
  getContext,
  getSink,
  setContextProvider,
  setSink,
  type ContextProvider,
} from "./registry";
import type { ObservabilityRecord } from "./types";

function makeSink(): ObservabilitySink {
  const records: ObservabilityRecord[] = [];
  return {
    name: "test",
    emit: (r) => {
      records.push(r);
    },
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("baseContext", () => {
  it("строит контекст-заглушку с null-полями", () => {
    const ctx = baseContext("test", "server");
    expect(ctx).toEqual({
      env: "test",
      runtime: "server",
      release: null,
      requestId: null,
      sessionId: null,
      route: null,
      actorHash: null,
      actorRole: null,
    });
  });
});

describe("sink registry", () => {
  it("по умолчанию getSink() безопасен (no-op emit не бросает)", () => {
    const sink = getSink();
    expect(() =>
      { sink.emit({
        kind: "log",
        level: "info",
        message: "m",
        attributes: {},
        context: baseContext("test", "server"),
        timestamp: 0,
      }); },
    ).not.toThrow();
    expect(typeof sink.name).toBe("string");
  });

  it("setSink → getSink возвращает установленный sink", () => {
    const s = makeSink();
    setSink(s);
    expect(getSink()).toBe(s);
  });
});

describe("context provider registry", () => {
  it("дефолтный провайдер отдаёт server-baseContext", () => {
    const ctx = getContext();
    expect(ctx.runtime).toBe("server");
    expect(ctx.env).toBeDefined();
  });

  it("setContextProvider подменяет источник контекста", () => {
    const provider: ContextProvider = {
      getContext: () => ({
        ...baseContext("production", "client"),
        requestId: "req-1",
      }),
    };
    setContextProvider(provider);
    expect(getContext().requestId).toBe("req-1");
    expect(getContext().runtime).toBe("client");
  });
});
