// src/services/observability/adapters/console-adapter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ObservabilityConfig } from "../config";
import { baseContext } from "../core/registry";
import type { ErrorRecord, LogRecord } from "../core/types";

import { createConsoleSink } from "./console-adapter";

function cfg(env: ObservabilityConfig["env"]): ObservabilityConfig {
  return {
    enabled: true,
    adapter: "console",
    sampleRate: 1,
    actorSalt: null,
    ingestPath: "/api/telemetry",
    env,
  };
}

const logRec: LogRecord = {
  kind: "log",
  level: "info",
  message: "hi",
  attributes: { route: "/x" },
  context: baseContext("production", "server"),
  timestamp: 7,
};

const errRec: ErrorRecord = {
  kind: "error",
  errorClass: "network",
  message: "boom",
  backendCode: null,
  fingerprint: null,
  handled: false,
  cause: null,
  attributes: {},
  context: baseContext("production", "server"),
  timestamp: 7,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("createConsoleSink prod", () => {
  it("пишет NDJSON в process.stdout (одна строка + \\n)", () => {
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const sink = createConsoleSink(cfg("production"));
    sink.emit(logRec);
    expect(write).toHaveBeenCalledTimes(1);
    const arg = write.mock.calls[0]?.[0] as string;
    expect(arg.endsWith("\n")).toBe(true);
    expect(JSON.parse(arg.trimEnd())).toMatchObject({
      kind: "log",
      message: "hi",
    });
  });

  it("имя sink — console", () => {
    expect(createConsoleSink(cfg("production")).name).toBe("console");
  });
});

describe("createConsoleSink dev", () => {
  it("error-запись идёт в console.error", () => {
    const err = vi.spyOn(console, "error").mockImplementation((..._args) => { void _args; });
    const sink = createConsoleSink(cfg("development"));
    sink.emit(errRec);
    expect(err).toHaveBeenCalledTimes(1);
  });

  it("log-запись уровня info идёт в console.info", () => {
    const info = vi.spyOn(console, "info").mockImplementation((..._args) => { void _args; });
    const sink = createConsoleSink(cfg("development"));
    sink.emit(logRec);
    expect(info).toHaveBeenCalledTimes(1);
  });
});
