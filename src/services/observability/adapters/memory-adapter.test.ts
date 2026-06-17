// src/services/observability/adapters/memory-adapter.test.ts
import { describe, it, expect } from "vitest";

import { baseContext } from "../core/registry";
import type { LogRecord } from "../core/types";
import { noopSink } from "./noop-adapter";
import { createMemorySink } from "./memory-adapter";

const rec: LogRecord = {
  kind: "log",
  level: "info",
  message: "m",
  attributes: {},
  context: baseContext("test", "server"),
  timestamp: 0,
};

describe("noopSink", () => {
  it("имеет имя и не бросает на emit", () => {
    expect(noopSink.name).toBe("noop");
    expect(() => noopSink.emit(rec)).not.toThrow();
  });
});

describe("createMemorySink", () => {
  it("копит записи в records", () => {
    const { sink, records } = createMemorySink();
    sink.emit(rec);
    sink.emit({ ...rec, message: "m2" });
    expect(records).toHaveLength(2);
    expect(records[0]?.kind).toBe("log");
  });

  it("clear() очищает буфер на месте", () => {
    const { sink, records, clear } = createMemorySink();
    sink.emit(rec);
    clear();
    expect(records).toHaveLength(0);
  });

  it("flush() резолвится", async () => {
    const { sink } = createMemorySink();
    await expect(sink.flush?.()).resolves.toBeUndefined();
  });
});
