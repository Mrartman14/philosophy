// src/features/tags/permissions.test.ts
import { describe, it, expect } from "vitest";
import type { Me } from "@/utils/me";
import {
  canCreateTag,
  canUpdateTag,
  canDeleteTag,
  canAssignTags,
} from "./permissions";

const guest = null;

const adminFull: Me = {
  id: "u1",
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: ["tag.create", "tag.update", "tag.delete", "tag.assign"],
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

describe("canCreateTag", () => {
  it("гость → false", () => { expect(canCreateTag(guest)).toBe(false); });
  it("active без cap → false", () => { expect(canCreateTag(userNoCap)).toBe(false); });
  it("suspended с cap → false", () => { expect(canCreateTag(suspendedAdmin)).toBe(false); });
  it("active с cap → true", () => { expect(canCreateTag(adminFull)).toBe(true); });
});

describe("canUpdateTag", () => {
  it("гость → false", () => { expect(canUpdateTag(guest)).toBe(false); });
  it("active без cap → false", () => { expect(canUpdateTag(userNoCap)).toBe(false); });
  it("suspended с cap → false", () => { expect(canUpdateTag(suspendedAdmin)).toBe(false); });
  it("active с cap → true", () => { expect(canUpdateTag(adminFull)).toBe(true); });
});

describe("canDeleteTag", () => {
  it("гость → false", () => { expect(canDeleteTag(guest)).toBe(false); });
  it("active без cap → false", () => { expect(canDeleteTag(userNoCap)).toBe(false); });
  it("suspended с cap → false", () => { expect(canDeleteTag(suspendedAdmin)).toBe(false); });
  it("active с cap → true", () => { expect(canDeleteTag(adminFull)).toBe(true); });
});

describe("canAssignTags", () => {
  it("гость → false", () => { expect(canAssignTags(guest)).toBe(false); });
  it("active без cap → false", () => { expect(canAssignTags(userNoCap)).toBe(false); });
  it("suspended с cap → false", () => { expect(canAssignTags(suspendedAdmin)).toBe(false); });
  it("active с cap → true", () => { expect(canAssignTags(adminFull)).toBe(true); });
});
