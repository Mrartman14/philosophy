// src/features/preferences/permissions.test.ts
import { describe, it, expect } from "vitest";
import type { Me } from "@/utils/me";
import {
  canSendPush,
  canSubscribePush,
  canUpdatePreferences,
} from "./permissions";

const guest = null;

const activeUser: Me = {
  id: "u1",
  username: "user",
  role: "user",
  status: "active",
  capabilities: ["document.create"],
};

const adminWithPush: Me = {
  id: "u2",
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: ["push.send", "user.list"],
};

const suspendedAdmin: Me = { ...adminWithPush, status: "suspended" };
const bannedUser: Me = { ...activeUser, status: "banned" };

describe("canUpdatePreferences", () => {
  it("гость → false", () => expect(canUpdatePreferences(guest)).toBe(false));
  it("active user → true", () =>
    expect(canUpdatePreferences(activeUser)).toBe(true));
  it("active admin → true", () =>
    expect(canUpdatePreferences(adminWithPush)).toBe(true));
  it("suspended → false", () =>
    expect(canUpdatePreferences(suspendedAdmin)).toBe(false));
  it("banned → false", () =>
    expect(canUpdatePreferences(bannedUser)).toBe(false));
});

describe("canSubscribePush", () => {
  it("гость → false", () => expect(canSubscribePush(guest)).toBe(false));
  it("active user → true", () =>
    expect(canSubscribePush(activeUser)).toBe(true));
  it("suspended → false", () =>
    expect(canSubscribePush(suspendedAdmin)).toBe(false));
  it("banned → false", () =>
    expect(canSubscribePush(bannedUser)).toBe(false));
});

describe("canSendPush", () => {
  it("гость → false", () => expect(canSendPush(guest)).toBe(false));
  it("active без push.send → false", () =>
    expect(canSendPush(activeUser)).toBe(false));
  it("active с push.send → true", () =>
    expect(canSendPush(adminWithPush)).toBe(true));
  it("suspended с push.send → false", () =>
    expect(canSendPush(suspendedAdmin)).toBe(false));
});
