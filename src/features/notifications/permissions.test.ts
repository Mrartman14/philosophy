// src/features/notifications/permissions.test.ts
import { describe, expect, it } from "vitest";

import type { Me } from "@/utils/me";

import { canManageSubscriptions, canUseNotifications } from "./permissions";

const active: Me = { id: "u1", username: "a", role: "user", status: "active", capabilities: [] };
const suspended: Me = { ...active, status: "suspended" };

describe("canUseNotifications", () => {
  it("гость → false", () => {
    expect(canUseNotifications(null)).toBe(false);
  });
  it("залогинен → true", () => {
    expect(canUseNotifications(active)).toBe(true);
  });
  it("suspended может читать → true", () => {
    expect(canUseNotifications(suspended)).toBe(true);
  });
});

describe("canManageSubscriptions", () => {
  it("гость → false", () => {
    expect(canManageSubscriptions(null)).toBe(false);
  });
  it("active → true", () => {
    expect(canManageSubscriptions(active)).toBe(true);
  });
  it("suspended → false", () => {
    expect(canManageSubscriptions(suspended)).toBe(false);
  });
});
