// src/features/tokens/permissions.test.ts
import { describe, it, expect } from "vitest";

import type { Me } from "@/utils/me";

import { canManageTokens } from "./permissions";

const active: Me = {
  id: "u1",
  username: "u1",
  role: "user",
  status: "active",
  capabilities: [],
};

const suspended: Me = { ...active, status: "suspended" };

describe("canManageTokens", () => {
  it("гость → false", () => {
    expect(canManageTokens(null)).toBe(false);
  });
  it("active → true", () => {
    expect(canManageTokens(active)).toBe(true);
  });
  it("suspended → false", () => {
    expect(canManageTokens(suspended)).toBe(false);
  });
});
