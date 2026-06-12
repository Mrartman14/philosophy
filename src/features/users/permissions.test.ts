// src/features/users/permissions.test.ts
import { describe, it, expect } from "vitest";
import type { Me } from "@/utils/me";
import { canListUsers, canModerateUsers } from "./permissions";

const guest = null;

const adminFull: Me = {
  id: "u1",
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: ["user.list", "user.moderate"],
};

const userNoCap: Me = {
  id: "u2",
  username: "user",
  role: "user",
  status: "active",
  capabilities: [],
};

const suspendedAdmin: Me = {
  ...adminFull,
  status: "suspended",
};

const listOnly: Me = {
  ...adminFull,
  capabilities: ["user.list"],
};

describe("canListUsers", () => {
  it("гость → false", () => expect(canListUsers(guest)).toBe(false));
  it("active без cap → false", () => expect(canListUsers(userNoCap)).toBe(false));
  it("suspended с cap → false", () => expect(canListUsers(suspendedAdmin)).toBe(false));
  it("active с cap → true", () => expect(canListUsers(adminFull)).toBe(true));
});

describe("canModerateUsers", () => {
  it("гость → false", () => expect(canModerateUsers(guest)).toBe(false));
  it("active без cap → false", () => expect(canModerateUsers(userNoCap)).toBe(false));
  it("suspended с cap → false", () => expect(canModerateUsers(suspendedAdmin)).toBe(false));
  it("active с cap → true", () => expect(canModerateUsers(adminFull)).toBe(true));
  it("user.list не даёт user.moderate → false", () =>
    expect(canModerateUsers(listOnly)).toBe(false));
});
