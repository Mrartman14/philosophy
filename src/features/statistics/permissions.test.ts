import { describe, it, expect } from "vitest";

import type { Me } from "@/utils/me";

import { canManageOwnHistory } from "./permissions";

const active: Me = {
  id: "u1",
  username: "alice",
  role: "user",
  status: "active",
  capabilities: [],
};

describe("canManageOwnHistory", () => {
  it("active-пользователь → true", () => {
    expect(canManageOwnHistory(active)).toBe(true);
  });
  it("suspended → false", () => {
    expect(canManageOwnHistory({ ...active, status: "suspended" })).toBe(false);
  });
  it("гость (null) → false", () => {
    expect(canManageOwnHistory(null)).toBe(false);
  });
});
