import { describe, it, expect } from "vitest";
import type { Me } from "@/utils/me";
import { buildNavItems, canAccessAdmin } from "./admin-access";

const guest = null;

// Полный набор RoleAdmin (зеркало philosophy-api rbac/capabilities.go RoleAdmin).
const admin: Me = {
  id: "a1",
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: [
    "lecture.create", "lecture.delete", "media.create", "media.delete_any",
    "comment.delete_any", "comment.create", "annotation.delete_any",
    "user.list", "user.moderate", "push.send",
    "glossary.create", "glossary.update", "glossary.delete", "audit.read",
    "tag.create", "tag.update", "tag.delete", "tag.assign",
    "document.create", "document.delete_any", "trail.create", "trail.delete_any",
    "annotation.create", "entity.attach", "share_link.moderate",
    "event.read", "event.create", "event.update", "event.delete",
    "banner.read", "banner.create", "banner.update", "banner.delete",
    "banner.view_admin_audience", "form.create", "form.delete_any",
    "canvas.create", "canvas.delete_any",
  ],
};

// Полный набор RoleUser (зеркало rbac/capabilities.go RoleUser).
const ROLE_USER_CAPS = [
  "document.create", "media.create", "trail.create", "annotation.create",
  "comment.create", "entity.attach", "form.create", "canvas.create",
] as const;

const plainUser: Me = {
  id: "u1",
  username: "user",
  role: "user",
  status: "active",
  capabilities: [...ROLE_USER_CAPS],
};

const suspendedAdmin: Me = { ...admin, status: "suspended" };

describe("canAccessAdmin", () => {
  it("гость → false", () => expect(canAccessAdmin(guest)).toBe(false));
  it("обычный active-юзер (только RoleUser-капы) → false", () =>
    expect(canAccessAdmin(plainUser)).toBe(false));
  it("suspended админ → false", () =>
    expect(canAccessAdmin(suspendedAdmin)).toBe(false));
  it("active админ → true", () => expect(canAccessAdmin(admin)).toBe(true));
});

describe("buildNavItems", () => {
  it("гость → пусто", () => expect(buildNavItems(guest)).toHaveLength(0));
  it("обычный active-юзер → пусто", () =>
    expect(buildNavItems(plainUser)).toHaveLength(0));
  it("админ → есть пункты", () =>
    expect(buildNavItems(admin).length).toBeGreaterThan(0));
});
