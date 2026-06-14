// src/features/share-links/permissions.test.ts
import { describe, expect, it } from "vitest";

import type { Me } from "@/utils/me";

import {
  canCreateShareLink,
  canModerateShareLinks,
  canManageOwnLinks,
} from "./permissions";

const owner: Me = {
  id: "u-owner",
  username: "owner",
  role: "user",
  status: "active",
  capabilities: ["share_link.moderate"], // намеренно: проверяем, что create НЕ зависит от капы
};

const stranger: Me = {
  id: "u-stranger",
  username: "stranger",
  role: "user",
  status: "active",
  capabilities: [],
};

const moderator: Me = {
  id: "u-mod",
  username: "mod",
  role: "admin",
  status: "active",
  capabilities: ["share_link.moderate"],
};

const suspended: Me = {
  id: "u-owner",
  username: "owner",
  role: "user",
  status: "suspended",
  capabilities: ["share_link.moderate"],
};

const privateResource = { owner_id: "u-owner", visibility: "private" as const };
const publicResource = { owner_id: "u-owner", visibility: "public" as const };

describe("canCreateShareLink", () => {
  it("гость → false", () => {
    expect(canCreateShareLink(null, privateResource)).toBe(false);
  });

  it("владелец приватного ресурса → true", () => {
    expect(canCreateShareLink(owner, privateResource)).toBe(true);
  });

  it("не-владелец → false (даже с capability)", () => {
    expect(canCreateShareLink(moderator, privateResource)).toBe(false);
  });

  it("владелец публичного ресурса → false (RESOURCE_NOT_PRIVATE)", () => {
    expect(canCreateShareLink(owner, publicResource)).toBe(false);
  });

  it("suspended-владелец → false", () => {
    expect(canCreateShareLink(suspended, privateResource)).toBe(false);
  });

  it("ресурс без owner_id → false", () => {
    expect(canCreateShareLink(owner, { visibility: "private" })).toBe(false);
  });
});

describe("canModerateShareLinks", () => {
  it("гость → false", () => {
    expect(canModerateShareLinks(null)).toBe(false);
  });

  it("active с share_link.moderate → true", () => {
    expect(canModerateShareLinks(moderator)).toBe(true);
  });

  it("active без капы → false", () => {
    expect(canModerateShareLinks(stranger)).toBe(false);
  });

  it("suspended с капой → false", () => {
    expect(canModerateShareLinks(suspended)).toBe(false);
  });
});

describe("canManageOwnLinks", () => {
  it("гость → false", () => {
    expect(canManageOwnLinks(null)).toBe(false);
  });

  it("любой active → true", () => {
    expect(canManageOwnLinks(stranger)).toBe(true);
  });

  it("suspended → false", () => {
    expect(canManageOwnLinks(suspended)).toBe(false);
  });
});
