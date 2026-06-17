// src/services/observability/adapters/beacon-adapter.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { ObservabilityConfig } from "../config";
import { baseContext } from "../core/registry";
import type { LogRecord } from "../core/types";

import { createBeaconSink } from "./beacon-adapter";

function cfg(): ObservabilityConfig {
  return {
    enabled: true,
    adapter: "console",
    sampleRate: 1,
    actorSalt: null,
    ingestPath: "/api/telemetry",
    env: "production",
  };
}

const rec: LogRecord = {
  kind: "log",
  level: "info",
  message: "m",
  attributes: {},
  context: baseContext("production", "client"),
  timestamp: 1,
};

let sendBeacon: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sendBeacon = vi.fn().mockReturnValue(true);
  vi.stubGlobal("navigator", { sendBeacon });
  vi.stubGlobal("Blob", class {
    parts: unknown[];
    type: string;
    constructor(parts: unknown[], opts: { type: string }) {
      this.parts = parts;
      this.type = opts.type;
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createBeaconSink", () => {
  it("буферизует записи и НЕ шлёт до flush", () => {
    const sink = createBeaconSink(cfg());
    sink.emit(rec);
    sink.emit({ ...rec, message: "m2" });
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("flush() шлёт буфер через sendBeacon на ingestPath и очищает буфер", async () => {
    const sink = createBeaconSink(cfg());
    sink.emit(rec);
    await sink.flush?.();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const call = sendBeacon.mock.calls[0] ?? [];
    const [path, body] = call as [string, { type: string }];
    expect(path).toBe("/api/telemetry");
    expect((body as { type: string }).type).toBe("application/json");
    // Повторный flush без новых записей — ничего не шлёт.
    await sink.flush?.();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it("имя sink — beacon", () => {
    expect(createBeaconSink(cfg()).name).toBe("beacon");
  });

  it("flush() деградирует без throw, когда navigator.sendBeacon недоступен", async () => {
    vi.stubGlobal("navigator", {}); // нет sendBeacon
    const sink = createBeaconSink(cfg());
    sink.emit(rec);
    await expect(sink.flush?.()).resolves.not.toThrow();
  });

  it("ring buffer: при переполнении хранит только последние N (старые вытесняются)", async () => {
    const sink = createBeaconSink(cfg());
    // Эмитим 600 записей; кап буфера 500 → шлём ровно 500.
    for (let i = 0; i < 600; i++) sink.emit({ ...rec, timestamp: i });
    await sink.flush?.();
    const body = sendBeacon.mock.calls[0]?.[1] as { parts: string[] };
    const payload = JSON.parse(body.parts[0] ?? "[]") as unknown[];
    expect(payload).toHaveLength(500);
  });
});
