// src/services/observability/index.test.ts
import { describe, it, expect } from "vitest";

import * as barrel from "./index";

describe("isomorphic barrel exports", () => {
  it("реэкспортирует фасад, имена, таксономию и типы", () => {
    expect(typeof barrel.log.info).toBe("function");
    expect(typeof barrel.errors.capture).toBe("function");
    expect(typeof barrel.metrics.increment).toBe("function");
    expect(barrel.M.actionDuration).toBe("action.duration");
    expect(barrel.webVital("LCP")).toBe("web_vitals.LCP");
    expect(typeof barrel.classifyError).toBe("function");
  });

  it("не экспортирует серверные мутаторы (split в /server)", () => {
    expect((barrel as Record<string, unknown>).setServerActor).toBeUndefined();
    expect((barrel as Record<string, unknown>).setServerRoute).toBeUndefined();
    expect((barrel as Record<string, unknown>).initServerObservability).toBeUndefined();
  });
});

describe("barrel parity", () => {
  it("server и client барели делят один и тот же facade-инстанс", async () => {
    const server = await import("./index");
    const client = await import("./client");
    expect(server.log).toBe(client.log);
    expect(server.errors).toBe(client.errors);
    expect(server.metrics).toBe(client.metrics);
    expect(server.M).toBe(client.M);
  });
});
