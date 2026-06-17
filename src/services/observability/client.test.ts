// src/services/observability/client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

vi.mock("./core/registry", async (orig) => {
  const actual = await orig<typeof import("./core/registry")>();
  return { ...actual, setSink: vi.fn(actual.setSink), setContextProvider: vi.fn() };
});

vi.mock("./adapters/beacon-adapter", () => ({
  createBeaconSink: vi.fn(() => ({ name: "beacon", emit: () => {} })),
}));

import { setContextProvider, setSink } from "./core/registry";
import { clientContextProvider } from "./context/client";
import * as barrel from "./client";

const HERE = path.resolve(__dirname);

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(setSink).mockClear();
  vi.mocked(setContextProvider).mockClear();
});

describe("client barrel exports", () => {
  it("реэкспортирует фасад, имена и client-мутаторы", () => {
    expect(typeof barrel.log.info).toBe("function");
    expect(typeof barrel.errors.capture).toBe("function");
    expect(typeof barrel.metrics.increment).toBe("function");
    expect(barrel.M.apiError).toBe("api.request.error");
    expect(barrel.webVital("CLS")).toBe("web_vitals.CLS");
    expect(typeof barrel.setClientActor).toBe("function");
    expect(typeof barrel.setClientRoute).toBe("function");
  });
});

describe("initClientObservability", () => {
  it("clientEnabled + adapter=console → beacon-sink + clientContextProvider", () => {
    vi.stubEnv("NEXT_PUBLIC_OBSERVABILITY_ENABLED", "1");
    vi.stubEnv("NEXT_PUBLIC_OBSERVABILITY_ADAPTER", "console");
    barrel.initClientObservability();
    expect(setContextProvider).toHaveBeenCalledWith(clientContextProvider);
    const sink = vi.mocked(setSink).mock.calls.at(-1)?.[0];
    expect(sink?.name).toBe("beacon");
  });

  it("выключено → noop-sink", () => {
    barrel.initClientObservability();
    const sink = vi.mocked(setSink).mock.calls.at(-1)?.[0];
    expect(sink?.name).toBe("noop");
  });
});

describe("client safety", () => {
  it("ни client.ts, ни его прямые импорты НЕ тянут server-only", () => {
    // Файлы, которые client-барель импортирует (статически).
    const files = [
      "client.ts",
      "core/facade.ts",
      "core/types.ts",
      "core/names.ts",
      "core/registry.ts",
      "core/redact.ts",
      "core/taxonomy.ts",
      "core/ports.ts",
      "config.ts",
      "context/client.ts",
      "adapters/beacon-adapter.ts",
      "adapters/noop-adapter.ts",
    ];
    for (const rel of files) {
      const src = readFileSync(path.join(HERE, rel), "utf8");
      expect(src, `${rel} must NOT import server-only`).not.toMatch(
        /["']server-only["']/,
      );
    }
  });
});
