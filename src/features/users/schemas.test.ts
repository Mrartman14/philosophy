// src/features/users/schemas.test.ts
import { describe, it, expect } from "vitest";

import type { NamespaceT } from "@/i18n";

import { makeUserRoleUpdateSchema, makeUserStatusUpdateSchema } from "./schemas";

const t = ((key: string) => key) as unknown as NamespaceT<"validation">;
const UserRoleUpdateSchema = makeUserRoleUpdateSchema(t);
const UserStatusUpdateSchema = makeUserStatusUpdateSchema(t);

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("UserRoleUpdateSchema", () => {
  it("принимает role=user", () => {
    const r = UserRoleUpdateSchema.safeParse({ id: UUID, role: "user" });
    expect(r.success).toBe(true);
  });
  it("принимает role=admin", () => {
    const r = UserRoleUpdateSchema.safeParse({ id: UUID, role: "admin" });
    expect(r.success).toBe(true);
  });
  it("отклоняет неизвестную роль", () => {
    const r = UserRoleUpdateSchema.safeParse({ id: UUID, role: "moderator" });
    expect(r.success).toBe(false);
  });
  it("отклоняет битый uuid", () => {
    const r = UserRoleUpdateSchema.safeParse({ id: "not-uuid", role: "admin" });
    expect(r.success).toBe(false);
  });
  it("отклоняет отсутствующую роль", () => {
    const r = UserRoleUpdateSchema.safeParse({ id: UUID });
    expect(r.success).toBe(false);
  });
});

describe("UserStatusUpdateSchema", () => {
  it("принимает status=active", () => {
    const r = UserStatusUpdateSchema.safeParse({ id: UUID, status: "active" });
    expect(r.success).toBe(true);
  });
  it("принимает status=suspended", () => {
    const r = UserStatusUpdateSchema.safeParse({ id: UUID, status: "suspended" });
    expect(r.success).toBe(true);
  });
  it("принимает status=banned", () => {
    const r = UserStatusUpdateSchema.safeParse({ id: UUID, status: "banned" });
    expect(r.success).toBe(true);
  });
  it("отклоняет неизвестный статус", () => {
    const r = UserStatusUpdateSchema.safeParse({ id: UUID, status: "deleted" });
    expect(r.success).toBe(false);
  });
  it("отклоняет битый uuid", () => {
    const r = UserStatusUpdateSchema.safeParse({ id: "x", status: "active" });
    expect(r.success).toBe(false);
  });
});
