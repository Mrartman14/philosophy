// src/features/media/permissions.test.ts
import { describe, it, expect } from "vitest";

import type { Me } from "@/utils/me";

import {
  canCreateMedia,
  canDeleteAnyMedia,
  canDeleteMedia,
  canChangeMediaVisibility,
  canModerateMedia,
} from "./permissions";
import type { Media } from "./types";

const guest = null;

const owner: Me = {
  id: "owner-1",
  username: "owner",
  role: "user",
  status: "active",
  capabilities: ["media.create"],
};

const otherUser: Me = {
  id: "user-2",
  username: "other",
  role: "user",
  status: "active",
  capabilities: ["media.create"],
};

const admin: Me = {
  id: "admin-1",
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: ["media.create", "media.delete_any"],
};

const suspendedOwner: Me = { ...owner, status: "suspended" };
const suspendedAdmin: Me = { ...admin, status: "suspended" };

const ownedPrivate: Media = {
  id: "m1",
  owner_id: "owner-1",
  type: "video",
  filename: "a.mp4",
  visibility: "private",
  created_at: "2026-06-12T00:00:00Z",
};
const ownedPublic: Media = { ...ownedPrivate, visibility: "public" };
const foreignPrivate: Media = { ...ownedPrivate, owner_id: "user-2" };
const foreignPublic: Media = { ...ownedPublic, owner_id: "user-2" };

describe("canCreateMedia", () => {
  it("гость → false", () => { expect(canCreateMedia(guest)).toBe(false); });
  it("active с media.create → true", () =>
    { expect(canCreateMedia(owner)).toBe(true); });
  it("active без media.create → false", () =>
    { expect(canCreateMedia({ ...owner, capabilities: [] })).toBe(false); });
  it("suspended с media.create → false", () =>
    { expect(canCreateMedia(suspendedOwner)).toBe(false); });
});

describe("canDeleteAnyMedia", () => {
  it("гость → false", () => { expect(canDeleteAnyMedia(guest)).toBe(false); });
  it("user без cap → false", () => { expect(canDeleteAnyMedia(owner)).toBe(false); });
  it("admin с media.delete_any → true", () =>
    { expect(canDeleteAnyMedia(admin)).toBe(true); });
  it("suspended admin → false", () =>
    { expect(canDeleteAnyMedia(suspendedAdmin)).toBe(false); });
});

describe("canDeleteMedia (owner OR delete_any, независимо от видимости)", () => {
  it("гость → false", () =>
    { expect(canDeleteMedia(guest, ownedPrivate)).toBe(false); });
  it("owner своего private → true", () =>
    { expect(canDeleteMedia(owner, ownedPrivate)).toBe(true); });
  it("owner своего public → true", () =>
    { expect(canDeleteMedia(owner, ownedPublic)).toBe(true); });
  it("чужой user без delete_any → false", () =>
    { expect(canDeleteMedia(otherUser, ownedPrivate)).toBe(false); });
  it("admin (delete_any) чужой private → true (независимо от видимости)", () =>
    { expect(canDeleteMedia(admin, foreignPrivate)).toBe(true); });
  it("admin (delete_any) чужой public → true", () =>
    { expect(canDeleteMedia(admin, foreignPublic)).toBe(true); });
  it("suspended owner → false", () =>
    { expect(canDeleteMedia(suspendedOwner, ownedPrivate)).toBe(false); });
});

describe("canChangeMediaVisibility (только owner, private→public)", () => {
  it("гость → false", () =>
    { expect(canChangeMediaVisibility(guest, ownedPrivate)).toBe(false); });
  it("owner private → true", () =>
    { expect(canChangeMediaVisibility(owner, ownedPrivate)).toBe(true); });
  it("owner public → false (public иммутабелен)", () =>
    { expect(canChangeMediaVisibility(owner, ownedPublic)).toBe(false); });
  it("admin чужого private → false (только владелец меняет видимость)", () =>
    { expect(canChangeMediaVisibility(admin, foreignPrivate)).toBe(false); });
  it("suspended owner → false", () =>
    { expect(canChangeMediaVisibility(suspendedOwner, ownedPrivate)).toBe(false); });
});

describe("canModerateMedia (доступ к admin-списку медиа = media.delete_any)", () => {
  it("гость → false", () => { expect(canModerateMedia(guest)).toBe(false); });
  it("обычный user без delete_any → false", () =>
    { expect(canModerateMedia(owner)).toBe(false); });
  it("admin с media.delete_any → true", () =>
    { expect(canModerateMedia(admin)).toBe(true); });
  it("suspended admin → false", () =>
    { expect(canModerateMedia(suspendedAdmin)).toBe(false); });
});
