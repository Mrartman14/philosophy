import { describe, it, expect } from "vitest";

import { validateBatch, MAX_BATCH, MAX_BYTES } from "./validate";

const ctx = {
  env: "test" as const,
  runtime: "client" as const,
  release: null,
  requestId: null,
  sessionId: "s-1",
  route: "/x",
  actorHash: null,
  actorRole: null,
};

function logRec(attributes: Record<string, string | number | boolean | null>) {
  return {
    kind: "log",
    level: "info",
    message: "hi",
    attributes,
    context: ctx,
    timestamp: 1,
  };
}

describe("validateBatch", () => {
  it("accepts a well-formed batch and re-redacts attributes server-side", () => {
    const res = validateBatch([logRec({ ok: 1, token: "leak" })], 100);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("unreachable");
    expect(res.records).toHaveLength(1);
    const rec = res.records[0];
    if (!rec) throw new Error("no record");
    expect(rec.attributes).toEqual({ ok: 1 });
    expect("token" in rec.attributes).toBe(false);
  });

  it("rejects an oversized payload by byte length", () => {
    const res = validateBatch([logRec({})], MAX_BYTES + 1);
    expect(res).toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects a batch with too many records", () => {
    const batch = Array.from({ length: MAX_BATCH + 1 }, () => logRec({}));
    const res = validateBatch(batch, 200);
    expect(res).toEqual({ ok: false, reason: "too_many" });
  });

  it("rejects a non-array payload", () => {
    const res = validateBatch({ nope: true }, 50);
    expect(res).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a record with an unknown kind", () => {
    const res = validateBatch([{ ...logRec({}), kind: "bogus" }], 80);
    expect(res).toEqual({ ok: false, reason: "invalid" });
  });
});
