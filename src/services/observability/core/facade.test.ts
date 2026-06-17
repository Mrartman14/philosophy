// src/services/observability/core/facade.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import { createMemorySink } from "../adapters/memory-adapter";
import { setContextProvider, setSink, baseContext } from "./registry";
import type { ErrorRecord, LogRecord, MetricRecord } from "./types";
import { errors, log, metrics } from "./facade";

const mem = createMemorySink();

beforeEach(() => {
  mem.clear();
  setSink(mem.sink);
  setContextProvider({
    getContext: () => ({ ...baseContext("test", "server"), requestId: "req-9" }),
  });
  vi.restoreAllMocks();
  // sampleRate=1 по умолчанию (NODE_ENV=test) → метрики не сэмплируются прочь.
  vi.spyOn(Math, "random").mockReturnValue(0); // меньше любого rate ⇒ пропускаем
});

describe("log", () => {
  it("штампует контекст+timestamp и редактирует attrs", () => {
    vi.spyOn(Date, "now").mockReturnValue(1234);
    log.info("hello", { route: "/x", token: "secret" });
    expect(mem.records).toHaveLength(1);
    const r = mem.records[0] as LogRecord;
    expect(r.kind).toBe("log");
    expect(r.level).toBe("info");
    expect(r.message).toBe("hello");
    expect(r.attributes).toEqual({ route: "/x" });
    expect(r.context.requestId).toBe("req-9");
    expect(r.timestamp).toBe(1234);
  });

  it("уровни debug/warn/error прокидываются", () => {
    log.debug("d");
    log.warn("w");
    log.error("e");
    expect(mem.records.map((r) => (r as LogRecord).level)).toEqual([
      "debug",
      "warn",
      "error",
    ]);
  });
});

describe("errors", () => {
  it("классифицирует через taxonomy, когда errorClass не задан; emit всегда", () => {
    errors.capture(new TypeError("fetch failed"), { attributes: { token: "x", a: "1" } });
    const r = mem.records[0] as ErrorRecord;
    expect(r.kind).toBe("error");
    expect(r.errorClass).toBe("network");
    expect(r.handled).toBe(true);
    expect(r.cause?.name).toBe("TypeError");
    expect(r.attributes).toEqual({ a: "1" });
  });

  it("уважает явный errorClass/backendCode/handled", () => {
    errors.capture(new Error("nope"), {
      errorClass: "forbidden.owner",
      backendCode: "forbidden",
      handled: false,
    });
    const r = mem.records[0] as ErrorRecord;
    expect(r.errorClass).toBe("forbidden.owner");
    expect(r.backendCode).toBe("forbidden");
    expect(r.handled).toBe(false);
  });

  it("ошибки НЕ сэмплируются (random=0.99 всё равно emit)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    errors.capture(new Error("x"));
    expect(mem.records).toHaveLength(1);
  });
});

describe("metrics", () => {
  it("increment пишет counter-запись", () => {
    metrics.increment("action.completed", { route: "/x" }, 2);
    const r = mem.records[0] as MetricRecord;
    expect(r.kind).toBe("metric");
    expect(r.metricKind).toBe("counter");
    expect(r.value).toBe(2);
    expect(r.unit).toBe("count");
    expect(r.metric).toBe("action.completed");
  });

  it("increment по умолчанию value=1", () => {
    metrics.increment("action.completed");
    expect((mem.records[0] as MetricRecord).value).toBe(1);
  });

  it("histogram пишет ms-запись", () => {
    metrics.histogram("action.duration", 42, { route: "/x" });
    const r = mem.records[0] as MetricRecord;
    expect(r.metricKind).toBe("histogram");
    expect(r.unit).toBe("ms");
    expect(r.value).toBe(42);
  });

  it("startTimer → endTimer эмитит histogram с прошедшими ms", () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(1000); // старт
    const end = metrics.startTimer("action.duration", { route: "/x" });
    nowSpy.mockReturnValueOnce(1075); // конец
    end({ phase: "done" });
    const r = mem.records[0] as MetricRecord;
    expect(r.metricKind).toBe("histogram");
    expect(r.value).toBe(75);
    expect(r.attributes).toEqual({ route: "/x", phase: "done" });
  });

  it("sampleRate=0 → метрики отбрасываются", () => {
    // random(0) < rate(0) ложно ⇒ при rate=0 ничего не пишем.
    // Перекрываем env на 0 и пересоздаём sink-буфер.
    vi.stubEnv("OBSERVABILITY_SAMPLE_RATE", "0");
    vi.spyOn(Math, "random").mockReturnValue(0);
    metrics.increment("action.completed");
    expect(mem.records).toHaveLength(0);
    vi.unstubAllEnvs();
  });
});
