// src/features/trails/permissions.test.ts
import { describe, expect, it } from "vitest";

import type { Me } from "@/utils/me";

import {
  canCreateTrail,
  canEditTrail,
  canDeleteTrail,
  canAdminDeleteTrail,
  canListAdminTrails,
} from "./permissions";
import type { Trail } from "./types";

function makeMe(over: Partial<Me> = {}): Me {
  return {
    id: "u1",
    username: "alice",
    role: "user",
    status: "active",
    capabilities: [],
    ...over,
  };
}

const ownPrivate: Trail = { id: "t1", owner_id: "u1", title: "My", visibility: "private" };
const ownPublic: Trail = { id: "t2", owner_id: "u1", title: "My2", visibility: "public" };
const otherPublic: Trail = { id: "t3", owner_id: "u2", title: "Other", visibility: "public" };
const otherPrivate: Trail = { id: "t4", owner_id: "u2", title: "OtherP", visibility: "private" };

describe("canCreateTrail", () => {
  it("гость → false", () => {
    expect(canCreateTrail(null)).toBe(false);
  });
  it("active с trail.create → true", () => {
    expect(canCreateTrail(makeMe({ capabilities: ["trail.create"] }))).toBe(true);
  });
  it("active без капы → false", () => {
    expect(canCreateTrail(makeMe())).toBe(false);
  });
  it("suspended с капой → false", () => {
    expect(
      canCreateTrail(makeMe({ status: "suspended", capabilities: ["trail.create"] })),
    ).toBe(false);
  });
});

describe("canEditTrail (owner-only)", () => {
  it("гость → false", () => {
    expect(canEditTrail(null, ownPrivate)).toBe(false);
  });
  it("владелец active → true", () => {
    expect(canEditTrail(makeMe(), ownPrivate)).toBe(true);
  });
  it("не владелец → false (даже admin)", () => {
    expect(
      canEditTrail(makeMe({ id: "x", role: "admin", capabilities: ["trail.delete_any"] }), otherPublic),
    ).toBe(false);
  });
  it("владелец suspended → false", () => {
    expect(canEditTrail(makeMe({ status: "suspended" }), ownPrivate)).toBe(false);
  });
});

describe("canDeleteTrail", () => {
  it("владелец → true (любая видимость)", () => {
    expect(canDeleteTrail(makeMe(), ownPrivate)).toBe(true);
    expect(canDeleteTrail(makeMe(), ownPublic)).toBe(true);
  });
  it("не владелец без delete_any → false", () => {
    expect(canDeleteTrail(makeMe(), otherPublic)).toBe(false);
  });
  it("admin delete_any на чужой public → true", () => {
    expect(
      canDeleteTrail(makeMe({ id: "a", role: "admin", capabilities: ["trail.delete_any"] }), otherPublic),
    ).toBe(true);
  });
  it("admin delete_any на чужой PRIVATE → false (бек вернёт 404)", () => {
    expect(
      canDeleteTrail(makeMe({ id: "a", role: "admin", capabilities: ["trail.delete_any"] }), otherPrivate),
    ).toBe(false);
  });
  it("suspended владелец → false", () => {
    expect(canDeleteTrail(makeMe({ status: "suspended" }), ownPublic)).toBe(false);
  });
});

describe("canAdminDeleteTrail (admin-список, только public)", () => {
  it("admin delete_any на public → true", () => {
    expect(
      canAdminDeleteTrail(makeMe({ role: "admin", capabilities: ["trail.delete_any"] }), otherPublic),
    ).toBe(true);
  });
  it("без капы → false", () => {
    expect(canAdminDeleteTrail(makeMe(), otherPublic)).toBe(false);
  });
  it("private → false", () => {
    expect(
      canAdminDeleteTrail(makeMe({ role: "admin", capabilities: ["trail.delete_any"] }), otherPrivate),
    ).toBe(false);
  });
});

describe("canListAdminTrails", () => {
  it("с delete_any → true", () => {
    expect(canListAdminTrails(makeMe({ capabilities: ["trail.delete_any"] }))).toBe(true);
  });
  it("без капы → false", () => {
    expect(canListAdminTrails(makeMe())).toBe(false);
  });
  it("гость → false", () => {
    expect(canListAdminTrails(null)).toBe(false);
  });
});
