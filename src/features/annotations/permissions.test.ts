// src/features/annotations/permissions.test.ts
import { describe, it, expect } from "vitest";
import type { Me } from "@/utils/me";
import {
  canCreateAnnotation,
  canEditAnnotation,
  canDeleteAnnotation,
  canAdminDeleteAnnotation,
  canModerateAnnotations,
} from "./permissions";
import type { Annotation } from "./types";

const guest = null;

const author: Me = {
  id: "u-author",
  username: "author",
  role: "user",
  status: "active",
  capabilities: ["annotation.create"],
};

const otherUser: Me = {
  id: "u-other",
  username: "other",
  role: "user",
  status: "active",
  capabilities: ["annotation.create"],
};

const userNoCap: Me = {
  id: "u-nocap",
  username: "nocap",
  role: "user",
  status: "active",
  capabilities: [],
};

const suspendedAuthor: Me = { ...author, status: "suspended" };

const admin: Me = {
  id: "u-admin",
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: ["annotation.create", "annotation.delete_any"],
};

function ann(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: "a-1",
    owner_id: "u-author",
    visibility: "private",
    parent_entity_type: "document",
    parent_entity_id: "d-1",
    blocks: [],
    ...overrides,
  };
}

describe("canCreateAnnotation", () => {
  it("гость → false", () => expect(canCreateAnnotation(guest)).toBe(false));
  it("active без cap → false", () =>
    expect(canCreateAnnotation(userNoCap)).toBe(false));
  it("suspended с cap → false", () =>
    expect(canCreateAnnotation(suspendedAuthor)).toBe(false));
  it("active с annotation.create → true", () =>
    expect(canCreateAnnotation(author)).toBe(true));
});

describe("canEditAnnotation", () => {
  it("гость → false", () =>
    expect(canEditAnnotation(guest, ann())).toBe(false));
  it("автор → true", () =>
    expect(canEditAnnotation(author, ann())).toBe(true));
  it("не автор → false", () =>
    expect(canEditAnnotation(otherUser, ann())).toBe(false));
  it("suspended автор → false", () =>
    expect(canEditAnnotation(suspendedAuthor, ann())).toBe(false));
  it("админ-не-автор → false (admin не правит чужой контент, §6.2)", () =>
    expect(canEditAnnotation(admin, ann())).toBe(false));
});

describe("canDeleteAnnotation", () => {
  it("гость → false", () =>
    expect(canDeleteAnnotation(guest, ann())).toBe(false));
  it("автор private → true", () =>
    expect(canDeleteAnnotation(author, ann())).toBe(true));
  it("автор public → true", () =>
    expect(canDeleteAnnotation(author, ann({ visibility: "public" }))).toBe(
      true,
    ));
  it("не автор → false", () =>
    expect(canDeleteAnnotation(otherUser, ann())).toBe(false));
  it("suspended автор → false", () =>
    expect(canDeleteAnnotation(suspendedAuthor, ann())).toBe(false));
});

describe("canAdminDeleteAnnotation", () => {
  it("админ + public → true", () =>
    expect(
      canAdminDeleteAnnotation(admin, ann({ visibility: "public" })),
    ).toBe(true));
  it("админ + private → false (delete_any только на public, §6.2)", () =>
    expect(
      canAdminDeleteAnnotation(admin, ann({ visibility: "private" })),
    ).toBe(false));
  it("не-админ + public → false", () =>
    expect(
      canAdminDeleteAnnotation(author, ann({ visibility: "public" })),
    ).toBe(false));
  it("гость → false", () =>
    expect(
      canAdminDeleteAnnotation(guest, ann({ visibility: "public" })),
    ).toBe(false));
});

describe("canModerateAnnotations", () => {
  it("админ с delete_any → true", () =>
    expect(canModerateAnnotations(admin)).toBe(true));
  it("обычный user → false", () =>
    expect(canModerateAnnotations(author)).toBe(false));
  it("гость → false", () =>
    expect(canModerateAnnotations(guest)).toBe(false));
});
