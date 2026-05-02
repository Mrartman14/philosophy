import { describe, it, expect } from "vitest";
import type { Me } from "@/utils/me";
import { canCreateTerm, canUpdateTerm, canDeleteTerm } from "./permissions";

const guest = null;

const adminFull: Me = {
  id: "u1",
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: ["glossary.create", "glossary.update", "glossary.delete"],
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

describe("canCreateTerm", () => {
  it("гость → false", () => expect(canCreateTerm(guest)).toBe(false));
  it("active без cap → false", () => expect(canCreateTerm(userNoCap)).toBe(false));
  it("suspended с cap → false", () => expect(canCreateTerm(suspendedAdmin)).toBe(false));
  it("active с cap → true", () => expect(canCreateTerm(adminFull)).toBe(true));
});

describe("canUpdateTerm", () => {
  it("гость → false", () => expect(canUpdateTerm(guest)).toBe(false));
  it("active с cap → true", () => expect(canUpdateTerm(adminFull)).toBe(true));
  it("active без cap → false", () => expect(canUpdateTerm(userNoCap)).toBe(false));
});

describe("canDeleteTerm", () => {
  it("гость → false", () => expect(canDeleteTerm(guest)).toBe(false));
  it("active с cap → true", () => expect(canDeleteTerm(adminFull)).toBe(true));
  it("active без cap → false", () => expect(canDeleteTerm(userNoCap)).toBe(false));
});
