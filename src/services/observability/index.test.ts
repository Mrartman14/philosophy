// src/services/observability/index.test.ts
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

import * as barrel from "./index";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(setSink).mockClear();
  vi.mocked(setContextProvider).mockClear();
});

describe("server barrel exports", () => {
  it("реэкспортирует фасад, имена и server-мутаторы", () => {
    expect(typeof barrel.log.info).toBe("function");
    expect(typeof barrel.errors.capture).toBe("function");
    expect(typeof barrel.metrics.increment).toBe("function");
    expect(barrel.M.actionDuration).toBe("action.duration");
    expect(barrel.webVital("LCP")).toBe("web_vitals.LCP");
    expect(typeof barrel.setServerActor).toBe("function");
    expect(typeof barrel.setServerRoute).toBe("function");
  });
});

describe("initServerObservability", () => {
  it("adapter=console → подключает console-sink + serverContextProvider", () => {
    vi.stubEnv("OBSERVABILITY_ENABLED", "true");
    vi.stubEnv("OBSERVABILITY_ADAPTER", "console");
    vi.stubEnv("NODE_ENV", "production");
    barrel.initServerObservability();
    expect(setContextProvider).toHaveBeenCalledWith(serverContextProvider);
    const sink = vi.mocked(setSink).mock.calls.at(-1)?.[0];
    expect(sink?.name).toBe("console");
  });

  it("adapter=noop → подключает noop-sink", () => {
    vi.stubEnv("OBSERVABILITY_ADAPTER", "noop");
    barrel.initServerObservability();
    const sink = vi.mocked(setSink).mock.calls.at(-1)?.[0];
    expect(sink?.name).toBe("noop");
  });

  it("enabled=false + adapter=console → noop sink (мастер-флаг)", () => {
    vi.stubEnv("OBSERVABILITY_ENABLED", "");
    vi.stubEnv("OBSERVABILITY_ADAPTER", "console");
    barrel.initServerObservability();
    const sink = vi.mocked(setSink).mock.calls.at(-1)?.[0];
    expect(sink?.name).toBe("noop");
  });
});
