import { describe, it, expect } from "vitest";

import { createTokenBucket } from "./rate-limit";

describe("createTokenBucket", () => {
  it("allows up to capacity then blocks the same key", () => {
    const now = () => 0;
    const bucket = createTokenBucket({ capacity: 2, refillPerSec: 1, now });
    expect(bucket.allow("s1")).toBe(true);
    expect(bucket.allow("s1")).toBe(true);
    expect(bucket.allow("s1")).toBe(false);
  });

  it("isolates buckets per key", () => {
    const now = () => 0;
    const bucket = createTokenBucket({ capacity: 1, refillPerSec: 1, now });
    expect(bucket.allow("s1")).toBe(true);
    expect(bucket.allow("s1")).toBe(false);
    expect(bucket.allow("s2")).toBe(true);
  });

  it("refills tokens over elapsed time", () => {
    let t = 0;
    const bucket = createTokenBucket({
      capacity: 1,
      refillPerSec: 1,
      now: () => t,
    });
    expect(bucket.allow("s1")).toBe(true);
    expect(bucket.allow("s1")).toBe(false);
    t = 1000; // +1s → +1 token
    expect(bucket.allow("s1")).toBe(true);
  });

  it("never exceeds capacity on refill", () => {
    let t = 0;
    const bucket = createTokenBucket({
      capacity: 2,
      refillPerSec: 5,
      now: () => t,
    });
    expect(bucket.allow("s1")).toBe(true);
    t = 10_000; // huge elapsed → cap at 2, not more
    expect(bucket.allow("s1")).toBe(true);
    expect(bucket.allow("s1")).toBe(true);
    expect(bucket.allow("s1")).toBe(false);
  });
});
