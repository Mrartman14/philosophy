import { describe, it, expect } from "vitest";

import {
  IDEMPOTENCY_FIELD,
  IDEMPOTENCY_HEADER,
  idempotencyHeaders,
  readIdempotencyKey,
} from "./idempotency";

function fdWith(value: string | undefined): FormData {
  const fd = new FormData();
  if (value !== undefined) fd.set(IDEMPOTENCY_FIELD, value);
  return fd;
}

describe("readIdempotencyKey", () => {
  it("returns the key when present and valid", () => {
    expect(readIdempotencyKey(fdWith("abc-123"))).toBe("abc-123");
  });

  it("returns undefined when field is absent", () => {
    expect(readIdempotencyKey(fdWith(undefined))).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(readIdempotencyKey(fdWith(""))).toBeUndefined();
  });

  it("returns undefined for keys longer than 255 chars", () => {
    expect(readIdempotencyKey(fdWith("x".repeat(256)))).toBeUndefined();
  });

  it("accepts a key exactly 255 chars long", () => {
    const key = "x".repeat(255);
    expect(readIdempotencyKey(fdWith(key))).toBe(key);
  });
});

describe("idempotencyHeaders", () => {
  it("builds a header object when key is present", () => {
    expect(idempotencyHeaders("k1")).toEqual({ [IDEMPOTENCY_HEADER]: "k1" });
  });

  it("returns an empty object when key is undefined", () => {
    expect(idempotencyHeaders(undefined)).toEqual({});
  });
});
