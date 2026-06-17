// src/services/observability/server.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react", async (orig) => {
  const actual = await orig<typeof import("react")>();
  return { ...actual, cache: <T,>(fn: T): T => fn };
});

// Шпионим за реестром, чтобы проверить КАКОЙ sink подключён по конфигу.
vi.mock("./core/registry", async (orig) => {
  const actual = await orig<typeof import("./core/registry")>();
  return { ...actual, setSink: vi.fn(actual.setSink), setContextProvider: vi.fn() };
});

import { serverContextProvider } from "./context/server";
import { setContextProvider, setSink } from "./core/registry";
import * as serverBarrel from "./server";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(setSink).mockClear();
  vi.mocked(setContextProvider).mockClear();
});

describe("server barrel exports", () => {
  it("экспортирует setServerActor и setServerRoute", () => {
    expect(typeof serverBarrel.setServerActor).toBe("function");
    expect(typeof serverBarrel.setServerRoute).toBe("function");
  });
});

describe("initServerObservability", () => {
  it("adapter=console → подключает console-sink + serverContextProvider", () => {
    vi.stubEnv("OBSERVABILITY_ENABLED", "true");
    vi.stubEnv("OBSERVABILITY_ADAPTER", "console");
    vi.stubEnv("NODE_ENV", "production");
    serverBarrel.initServerObservability();
    expect(setContextProvider).toHaveBeenCalledWith(serverContextProvider);
    const sink = vi.mocked(setSink).mock.calls.at(-1)?.[0];
    expect(sink?.name).toBe("console");
  });

  it("adapter=noop → подключает noop-sink", () => {
    vi.stubEnv("OBSERVABILITY_ADAPTER", "noop");
    serverBarrel.initServerObservability();
    const sink = vi.mocked(setSink).mock.calls.at(-1)?.[0];
    expect(sink?.name).toBe("noop");
  });

  it("enabled=false + adapter=console → noop sink (мастер-флаг)", () => {
    vi.stubEnv("OBSERVABILITY_ENABLED", "");
    vi.stubEnv("OBSERVABILITY_ADAPTER", "console");
    serverBarrel.initServerObservability();
    const sink = vi.mocked(setSink).mock.calls.at(-1)?.[0];
    expect(sink?.name).toBe("noop");
  });
});
