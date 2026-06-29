// src/features/comments/permissions.test.ts
import { describe, it, expect } from "vitest";

import type { Me } from "@/utils/me";

import {
  canCreateComment,
  canEditComment,
  canDeleteComment,
  canReactToComment,
  canSearchComments,
  canModerateComments,
} from "./permissions";
import type { Comment } from "./types";

const guest = null;

const userCreator: Me = {
  id: "u1",
  username: "user",
  role: "user",
  status: "active",
  capabilities: ["comment.create"],
};

const otherUser: Me = {
  id: "u2",
  username: "other",
  role: "user",
  status: "active",
  capabilities: ["comment.create"],
};

const admin: Me = {
  id: "a1",
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: ["comment.create", "comment.delete_any"],
};

const suspended: Me = { ...userCreator, status: "suspended" };

const ownComment = { id: "c1", author: { id: "u1" }, is_deleted: false } as Comment;
const othersComment = { id: "c2", author: { id: "u2" }, is_deleted: false } as Comment;
const deletedComment = { id: "c3", author: { id: "u1" }, is_deleted: true } as Comment;

describe("canCreateComment", () => {
  it("гость → false", () => { expect(canCreateComment(guest)).toBe(false); });
  it("user с cap → true", () => { expect(canCreateComment(userCreator)).toBe(true); });
  it("admin с cap → true", () => { expect(canCreateComment(admin)).toBe(true); });
  it("suspended с cap → false", () => { expect(canCreateComment(suspended)).toBe(false); });
});

describe("canEditComment (owner-only, без admin-override)", () => {
  it("owner своего → true", () => { expect(canEditComment(userCreator, ownComment)).toBe(true); });
  it("не-owner → false", () => { expect(canEditComment(otherUser, ownComment)).toBe(false); });
  it("admin чужого → false (нет override на edit)", () =>
    { expect(canEditComment(admin, othersComment)).toBe(false); });
  it("owner удалённого → false", () => { expect(canEditComment(userCreator, deletedComment)).toBe(false); });
  it("гость → false", () => { expect(canEditComment(guest, ownComment)).toBe(false); });
  it("suspended owner → false", () => { expect(canEditComment(suspended, ownComment)).toBe(false); });
});

describe("canDeleteComment (owner ИЛИ comment.delete_any)", () => {
  it("owner своего → true", () => { expect(canDeleteComment(userCreator, ownComment)).toBe(true); });
  it("не-owner без cap → false", () => { expect(canDeleteComment(otherUser, ownComment)).toBe(false); });
  it("admin чужого (delete_any) → true", () =>
    { expect(canDeleteComment(admin, othersComment)).toBe(true); });
  it("гость → false", () => { expect(canDeleteComment(guest, ownComment)).toBe(false); });
  it("suspended owner → false", () => { expect(canDeleteComment(suspended, ownComment)).toBe(false); });
  it("уже удалённый → false", () => { expect(canDeleteComment(admin, deletedComment)).toBe(false); });
});

describe("canReactToComment (active, не свой, не удалённый)", () => {
  it("чужой комментарий → true", () => { expect(canReactToComment(otherUser, ownComment)).toBe(true); });
  it("свой комментарий → false (SELF_REACTION)", () =>
    { expect(canReactToComment(userCreator, ownComment)).toBe(false); });
  it("гость → false", () => { expect(canReactToComment(guest, ownComment)).toBe(false); });
  it("удалённый → false", () => { expect(canReactToComment(otherUser, deletedComment)).toBe(false); });
  it("suspended → false", () => { expect(canReactToComment(suspended, othersComment)).toBe(false); });
});

describe("canSearchComments (требует auth)", () => {
  it("гость → false", () => { expect(canSearchComments(guest)).toBe(false); });
  it("active user → true", () => { expect(canSearchComments(userCreator)).toBe(true); });
  it("suspended → false", () => { expect(canSearchComments(suspended)).toBe(false); });
});

describe("canModerateComments (comment.delete_any)", () => {
  it("admin → true", () => { expect(canModerateComments(admin)).toBe(true); });
  it("user → false", () => { expect(canModerateComments(userCreator)).toBe(false); });
  it("гость → false", () => { expect(canModerateComments(guest)).toBe(false); });
});
