// src/features/audit/permissions.test.ts
import { describe, it, expect } from "vitest";
import type { Me } from "@/utils/me";
import { canReadAudit } from "./permissions";

const guest = null;

const adminWithCap: Me = {
  id: "u1",
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: ["audit.read"],
};

const adminNoCap: Me = {
  id: "u2",
  username: "admin2",
  role: "admin",
  status: "active",
  capabilities: [],
};

const suspendedWithCap: Me = {
  ...adminWithCap,
  status: "suspended",
};

describe("canReadAudit", () => {
  it("гость → false", () => { expect(canReadAudit(guest)).toBe(false); });
  it("active с audit.read → true", () =>
    { expect(canReadAudit(adminWithCap)).toBe(true); });
  it("active без audit.read → false", () =>
    { expect(canReadAudit(adminNoCap)).toBe(false); });
  it("suspended с audit.read → false", () =>
    { expect(canReadAudit(suspendedWithCap)).toBe(false); });
});
