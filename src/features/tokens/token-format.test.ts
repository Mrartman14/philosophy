// src/features/tokens/token-format.test.ts
import { describe, it, expect } from "vitest";

import { tokenStatus } from "./token-format";

const NOW = 1_000_000_000_000; // «сейчас» в мс
const DAY = 86_400_000;

describe("tokenStatus", () => {
  it("без срока и без revoke → active", () => {
    expect(tokenStatus({ id: "t" }, NOW)).toBe("active");
  });
  it("expires_at в будущем → active", () => {
    expect(tokenStatus({ expires_at: (NOW + DAY) / 1000 }, NOW)).toBe("active");
  });
  it("expires_at в прошлом → expired", () => {
    expect(tokenStatus({ expires_at: (NOW - DAY) / 1000 }, NOW)).toBe("expired");
  });
  it("revoked_at задан → revoked даже если срок ещё не вышел", () => {
    expect(
      tokenStatus({ revoked_at: (NOW - DAY) / 1000, expires_at: (NOW + DAY) / 1000 }, NOW),
    ).toBe("revoked");
  });
});
