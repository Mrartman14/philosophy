// src/services/observability/core/types.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

import type {
  Attributes,
  ContextSnapshot,
  ErrorRecord,
  LogRecord,
  MetricRecord,
  ObservabilityRecord,
} from "./types";

// Контекст-фикстура: «отсутствие» полей моделируется как null (exactOptionalPropertyTypes).
const ctx: ContextSnapshot = {
  env: "test",
  runtime: "server",
  release: null,
  requestId: null,
  sessionId: null,
  route: null,
  actorHash: null,
  actorRole: null,
};

describe("observability record types", () => {
  it("LogRecord конформен контракту", () => {
    const attrs: Attributes = { a: 1, b: "x", c: true, d: null };
    const rec: LogRecord = {
      kind: "log",
      level: "info",
      message: "hi",
      attributes: attrs,
      context: ctx,
      timestamp: 0,
    };
    expect(rec.kind).toBe("log");
    expect(rec.attributes.d).toBeNull();
  });

  it("ErrorRecord несёт классификацию и cause", () => {
    const rec: ErrorRecord = {
      kind: "error",
      errorClass: "network",
      message: "fetch failed",
      backendCode: null,
      fingerprint: null,
      handled: true,
      cause: { name: "TypeError", message: "fetch failed", stack: null },
      attributes: {},
      context: ctx,
      timestamp: 0,
    };
    expect(rec.errorClass).toBe("network");
    expect(rec.cause?.name).toBe("TypeError");
  });

  it("MetricRecord различает counter/histogram", () => {
    const rec: MetricRecord = {
      kind: "metric",
      metric: "action.duration",
      metricKind: "histogram",
      value: 12,
      unit: "ms",
      attributes: {},
      context: ctx,
      timestamp: 0,
    };
    expect(rec.metricKind).toBe("histogram");
    expect(rec.unit).toBe("ms");
  });

  it("ObservabilityRecord — дискриминированный union по kind", () => {
    const recs: ObservabilityRecord[] = [
      { kind: "log", level: "debug", message: "m", attributes: {}, context: ctx, timestamp: 1 },
    ];
    const r = recs[0];
    expect(r).toBeDefined();
    expect(r?.kind).toBe("log");
  });
});

// beforeEach/vi импортированы для единообразия test-преамбулы (globals:false).
beforeEach(() => {
  vi.clearAllMocks();
});
