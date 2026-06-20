// src/features/tokens/token-format.test.ts
import { describe, it, expect } from "vitest";

import { tokenStatus, unixSecToDate } from "./token-format";

const NOW = 1_000_000; // произвольный «сейчас» в секундах

describe("tokenStatus", () => {
  it("без срока и без revoke → active", () => {
    expect(tokenStatus({ id: "t" }, NOW)).toBe("active");
  });
  it("expires_at в будущем → active", () => {
    expect(tokenStatus({ expires_at: NOW + 100 }, NOW)).toBe("active");
  });
  it("expires_at в прошлом → expired", () => {
    expect(tokenStatus({ expires_at: NOW - 1 }, NOW)).toBe("expired");
  });
  it("revoked_at задан → revoked даже если срок ещё не вышел", () => {
    expect(tokenStatus({ revoked_at: NOW - 1, expires_at: NOW + 100 }, NOW)).toBe(
      "revoked",
    );
  });
});

describe("unixSecToDate", () => {
  it("undefined → null", () => {
    expect(unixSecToDate(undefined)).toBeNull();
  });
  it("секунды → Date в миллисекундах", () => {
    expect(unixSecToDate(1_700_000_000)?.getTime()).toBe(1_700_000_000_000);
  });
});
