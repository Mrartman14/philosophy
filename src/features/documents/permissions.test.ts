// src/features/documents/permissions.test.ts
import { describe, expect, it } from "vitest";

import type { Me } from "@/utils/me";

import {
  canCreateDocument,
  canEditDocument,
  canDeleteDocument,
  canAdminDeleteDocument,
  canListAdminDocuments,
  canSeeRevisions,
} from "./permissions";
import type { Document } from "./types";

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

const ownDoc: Document = { id: "d1", owner_id: "u1", visibility: "private" };
const otherDoc: Document = { id: "d2", owner_id: "u2", visibility: "public" };

describe("canCreateDocument", () => {
  it("гость → false", () => {
    expect(canCreateDocument(null)).toBe(false);
  });
  it("active с document.create → true", () => {
    expect(canCreateDocument(makeMe({ capabilities: ["document.create"] }))).toBe(true);
  });
  it("active без капы → false", () => {
    expect(canCreateDocument(makeMe())).toBe(false);
  });
  it("suspended с капой → false", () => {
    expect(
      canCreateDocument(makeMe({ status: "suspended", capabilities: ["document.create"] })),
    ).toBe(false);
  });
});

describe("canEditDocument (owner-only)", () => {
  it("гость → false", () => {
    expect(canEditDocument(null, ownDoc)).toBe(false);
  });
  it("владелец active → true", () => {
    expect(canEditDocument(makeMe(), ownDoc)).toBe(true);
  });
  it("не владелец → false (даже admin)", () => {
    expect(
      canEditDocument(makeMe({ role: "admin", capabilities: ["document.delete_any"] }), otherDoc),
    ).toBe(false);
  });
  it("владелец suspended → false", () => {
    expect(canEditDocument(makeMe({ status: "suspended" }), ownDoc)).toBe(false);
  });
});

describe("canDeleteDocument", () => {
  it("владелец → true (любая видимость)", () => {
    expect(canDeleteDocument(makeMe(), ownDoc)).toBe(true);
  });
  it("не владелец без delete_any → false", () => {
    expect(canDeleteDocument(makeMe(), otherDoc)).toBe(false);
  });
  it("admin delete_any на public → true", () => {
    expect(
      canDeleteDocument(
        makeMe({ id: "admin1", role: "admin", capabilities: ["document.delete_any"] }),
        otherDoc,
      ),
    ).toBe(true);
  });
  it("admin delete_any на чужой PRIVATE → false (бек вернёт 404)", () => {
    const privOther: Document = { id: "d3", owner_id: "u9", visibility: "private" };
    expect(
      canDeleteDocument(
        makeMe({ id: "admin1", role: "admin", capabilities: ["document.delete_any"] }),
        privOther,
      ),
    ).toBe(false);
  });
});

describe("canAdminDeleteDocument (admin-список, только public)", () => {
  it("admin delete_any на public → true", () => {
    expect(
      canAdminDeleteDocument(makeMe({ role: "admin", capabilities: ["document.delete_any"] }), otherDoc),
    ).toBe(true);
  });
  it("без капы → false", () => {
    expect(canAdminDeleteDocument(makeMe(), otherDoc)).toBe(false);
  });
  it("private → false", () => {
    const priv: Document = { id: "d4", owner_id: "u9", visibility: "private" };
    expect(
      canAdminDeleteDocument(makeMe({ role: "admin", capabilities: ["document.delete_any"] }), priv),
    ).toBe(false);
  });
});

describe("canListAdminDocuments", () => {
  it("с delete_any → true", () => {
    expect(canListAdminDocuments(makeMe({ capabilities: ["document.delete_any"] }))).toBe(true);
  });
  it("без капы → false", () => {
    expect(canListAdminDocuments(makeMe())).toBe(false);
  });
});

describe("canSeeRevisions", () => {
  it("public документ → true", () => {
    expect(canSeeRevisions(otherDoc)).toBe(true);
  });
  it("private документ → false (бек не пишет ревизии private)", () => {
    expect(canSeeRevisions(ownDoc)).toBe(false);
  });
});
