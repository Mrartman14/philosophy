// src/services/observability/client.test.ts
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./core/registry", async (orig) => {
  const actual = await orig<typeof import("./core/registry")>();
  return { ...actual, setSink: vi.fn(actual.setSink), setContextProvider: vi.fn() };
});

vi.mock("./adapters/beacon-adapter", () => ({
  createBeaconSink: vi.fn(() => ({ name: "beacon", emit(_r: unknown) { void _r; } })),
}));

import * as barrel from "./client";
import { clientContextProvider } from "./context/client";
import { setContextProvider, setSink } from "./core/registry";

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
    expect(barrel.M.apiRequestError).toBe("api.request.error");
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

// Поверхностный ранний предупреждающий guard: матчит прямой `import "server-only"`
// в перечисленных модулях client-графа. НАСТОЯЩАЯ гарантия client-safe — `next build`
// (server-only бросает при попадании в client-бандл) + ESLint G4. Полную транзитивную
// проверку здесь не делаем.
describe("client safety", () => {
  it("ни client.ts, ни его прямые импорты НЕ тянут server-only", () => {
    // matches:  import "server-only";   /   import 'server-only'   /   from "server-only"
    const SERVER_ONLY_IMPORT = /(?:import|from)\s+["']server-only["']/;
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
        SERVER_ONLY_IMPORT,
      );
    }
  });
});
