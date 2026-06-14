// src/features/banners/permissions.test.ts
import { describe, it, expect } from "vitest";
import type { Me } from "@/utils/me";
import {
  canReadBanners,
  canCreateBanner,
  canUpdateBanner,
  canDeleteBanner,
  canDismissBanner,
} from "./permissions";

const guest = null;

const adminFull: Me = {
  id: "u1",
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: [
    "banner.read",
    "banner.create",
    "banner.update",
    "banner.delete",
    "banner.view_admin_audience",
  ],
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

describe("canReadBanners", () => {
  it("гость → false", () => { expect(canReadBanners(guest)).toBe(false); });
  it("active без cap → false", () => { expect(canReadBanners(userNoCap)).toBe(false); });
  it("suspended с cap → false", () => { expect(canReadBanners(suspendedAdmin)).toBe(false); });
  it("active с cap → true", () => { expect(canReadBanners(adminFull)).toBe(true); });
});

describe("canCreateBanner", () => {
  it("гость → false", () => { expect(canCreateBanner(guest)).toBe(false); });
  it("active без cap → false", () => { expect(canCreateBanner(userNoCap)).toBe(false); });
  it("suspended с cap → false", () => { expect(canCreateBanner(suspendedAdmin)).toBe(false); });
  it("active с cap → true", () => { expect(canCreateBanner(adminFull)).toBe(true); });
});

describe("canUpdateBanner", () => {
  it("гость → false", () => { expect(canUpdateBanner(guest)).toBe(false); });
  it("active без cap → false", () => { expect(canUpdateBanner(userNoCap)).toBe(false); });
  it("suspended с cap → false", () => { expect(canUpdateBanner(suspendedAdmin)).toBe(false); });
  it("active с cap → true", () => { expect(canUpdateBanner(adminFull)).toBe(true); });
});

describe("canDeleteBanner", () => {
  it("гость → false", () => { expect(canDeleteBanner(guest)).toBe(false); });
  it("active без cap → false", () => { expect(canDeleteBanner(userNoCap)).toBe(false); });
  it("suspended с cap → false", () => { expect(canDeleteBanner(suspendedAdmin)).toBe(false); });
  it("active с cap → true", () => { expect(canDeleteBanner(adminFull)).toBe(true); });
});

describe("canDismissBanner (любой авторизованный active, без capability)", () => {
  it("гость → false", () => { expect(canDismissBanner(guest)).toBe(false); });
  it("suspended → false", () => { expect(canDismissBanner(suspendedAdmin)).toBe(false); });
  it("active user без капов → true", () => { expect(canDismissBanner(userNoCap)).toBe(true); });
  it("active admin → true", () => { expect(canDismissBanner(adminFull)).toBe(true); });
});
