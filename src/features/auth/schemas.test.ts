import { describe, it, expect } from "vitest";
import { LoginSchema } from "./schemas";

describe("LoginSchema", () => {
  it("принимает валидные creds без next", () => {
    const r = LoginSchema.safeParse({ username: "alice", password: "secret123" });
    expect(r.success).toBe(true);
  });

  it("принимает валидные creds с next", () => {
    const r = LoginSchema.safeParse({
      username: "alice",
      password: "secret123",
      next: "/admin",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.next).toBe("/admin");
  });

  it("отклоняет пустой username", () => {
    const r = LoginSchema.safeParse({ username: "  ", password: "x" });
    expect(r.success).toBe(false);
  });

  it("отклоняет пустой password", () => {
    const r = LoginSchema.safeParse({ username: "alice", password: "" });
    expect(r.success).toBe(false);
  });

  it("отклоняет username длиннее 200", () => {
    const r = LoginSchema.safeParse({ username: "a".repeat(201), password: "x" });
    expect(r.success).toBe(false);
  });
});
