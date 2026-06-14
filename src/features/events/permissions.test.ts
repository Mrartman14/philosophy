// src/features/events/permissions.test.ts
import { describe, it, expect } from "vitest";
import type { Me } from "@/utils/me";
import {
  canReadEvents,
  canCreateEvent,
  canUpdateEvent,
  canDeleteEvent,
} from "./permissions";

const guest = null;

const adminFull: Me = {
  id: "u1",
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: ["event.read", "event.create", "event.update", "event.delete"],
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

describe("canReadEvents", () => {
  it("гость → false", () => { expect(canReadEvents(guest)).toBe(false); });
  it("active без cap → false", () => { expect(canReadEvents(userNoCap)).toBe(false); });
  it("suspended с cap → false", () => { expect(canReadEvents(suspendedAdmin)).toBe(false); });
  it("active с cap → true", () => { expect(canReadEvents(adminFull)).toBe(true); });
});

describe("canCreateEvent", () => {
  it("гость → false", () => { expect(canCreateEvent(guest)).toBe(false); });
  it("active без cap → false", () => { expect(canCreateEvent(userNoCap)).toBe(false); });
  it("suspended с cap → false", () => { expect(canCreateEvent(suspendedAdmin)).toBe(false); });
  it("active с cap → true", () => { expect(canCreateEvent(adminFull)).toBe(true); });
});

describe("canUpdateEvent", () => {
  it("гость → false", () => { expect(canUpdateEvent(guest)).toBe(false); });
  it("active без cap → false", () => { expect(canUpdateEvent(userNoCap)).toBe(false); });
  it("suspended с cap → false", () => { expect(canUpdateEvent(suspendedAdmin)).toBe(false); });
  it("active с cap → true", () => { expect(canUpdateEvent(adminFull)).toBe(true); });
});

describe("canDeleteEvent", () => {
  it("гость → false", () => { expect(canDeleteEvent(guest)).toBe(false); });
  it("active без cap → false", () => { expect(canDeleteEvent(userNoCap)).toBe(false); });
  it("suspended с cap → false", () => { expect(canDeleteEvent(suspendedAdmin)).toBe(false); });
  it("active с cap → true", () => { expect(canDeleteEvent(adminFull)).toBe(true); });
});
