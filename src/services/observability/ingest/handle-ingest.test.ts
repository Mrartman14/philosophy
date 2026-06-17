import { describe, it, expect, beforeEach } from "vitest";

import { baseContext } from "@/services/observability/core/registry";
import type { ObservabilityRecord } from "@/services/observability/core/types";

import { createIngestHandler } from "./handle-ingest";
import { MAX_BATCH } from "./validate";

const ctx = { ...baseContext("test", "client"), sessionId: "s-1", route: "/x" };

function logText(attributes: Record<string, string | number | boolean | null>) {
  return JSON.stringify([
    {
      kind: "log",
      level: "info",
      message: "hi",
      attributes,
      context: ctx,
      timestamp: 1,
    },
  ]);
}

describe("createIngestHandler", () => {
  let emitted: ObservabilityRecord[];
  let emit: (r: ObservabilityRecord) => void;

  beforeEach(() => {
    emitted = [];
    emit = (r) => emitted.push(r);
  });

  it("emits validated, re-redacted records and returns 204", () => {
    const handle = createIngestHandler({
      bucket: { allow: () => true },
      emit,
    });
    const res = handle({ sessionId: "s-1", rawText: logText({ a: 1, token: "x" }) });
    expect(res).toEqual({ status: 204, emitted: 1 });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.attributes).toEqual({ a: 1 });
  });

  it("returns 400 on malformed JSON without emitting", () => {
    const handle = createIngestHandler({ bucket: { allow: () => true }, emit });
    const res = handle({ sessionId: "s-1", rawText: "{not json" });
    expect(res).toEqual({ status: 400, emitted: 0 });
    expect(emitted).toHaveLength(0);
  });

  it("returns 400 on an invalid (schema-violating) batch", () => {
    const handle = createIngestHandler({ bucket: { allow: () => true }, emit });
    const res = handle({ sessionId: "s-1", rawText: JSON.stringify({ nope: 1 }) });
    expect(res).toEqual({ status: 400, emitted: 0 });
  });

  it("returns 413 on too many records", () => {
    const handle = createIngestHandler({ bucket: { allow: () => true }, emit });
    const big = JSON.parse(logText({})) as unknown[];
    const record = big[0];
    const batch = Array.from({ length: MAX_BATCH + 1 }, () => record);
    const res = handle({ sessionId: "s-1", rawText: JSON.stringify(batch) });
    expect(res).toEqual({ status: 413, emitted: 0 });
  });

  it("returns 429 when the bucket denies the session", () => {
    const handle = createIngestHandler({ bucket: { allow: () => false }, emit });
    const res = handle({ sessionId: "s-1", rawText: logText({}) });
    expect(res).toEqual({ status: 429, emitted: 0 });
    expect(emitted).toHaveLength(0);
  });

  it("rate-limits under the anonymous bucket key when sessionId is null", () => {
    const seen: string[] = [];
    const handle = createIngestHandler({
      bucket: { allow: (k) => (seen.push(k), true) },
      emit,
    });
    handle({ sessionId: null, rawText: logText({}) });
    expect(seen).toEqual(["anon"]);
  });
});
