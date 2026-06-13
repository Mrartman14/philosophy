// src/features/lectures/permissions.test.ts
import { describe, it, expect } from "vitest";
import type { Me } from "@/utils/me";
import {
  canCreateLecture,
  canUpdateLecture,
  canDeleteLecture,
  canSetLectureVisibility,
  canManageCover,
} from "./permissions";

const owner = "00000000-0000-0000-0000-000000000001";
const stranger = "00000000-0000-0000-0000-000000000002";

const activeAdmin: Me = {
  id: owner,
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: ["lecture.create", "lecture.delete"],
};

const activeUser: Me = {
  id: owner,
  username: "user",
  role: "user",
  status: "active",
  capabilities: [],
};

const activeUserNotOwner: Me = { ...activeUser, id: stranger };

const suspendedAdmin: Me = { ...activeAdmin, status: "suspended" };

const lecture = { owner_id: owner };

describe("canCreateLecture", () => {
  it("гость → false", () => {
    expect(canCreateLecture(null)).toBe(false);
  });

  it("user без cap → false", () => {
    expect(canCreateLecture(activeUser)).toBe(false);
  });

  it("admin с lecture.create → true", () => {
    expect(canCreateLecture(activeAdmin)).toBe(true);
  });

  it("suspended admin → false", () => {
    expect(canCreateLecture(suspendedAdmin)).toBe(false);
  });
});

describe("canUpdateLecture", () => {
  it("гость → false", () => {
    expect(canUpdateLecture(null, lecture)).toBe(false);
  });

  it("owner active → true", () => {
    expect(canUpdateLecture(activeUser, lecture)).toBe(true);
  });

  it("not-owner → false", () => {
    expect(canUpdateLecture(activeUserNotOwner, lecture)).toBe(false);
  });

  it("suspended owner → false", () => {
    const suspended: Me = { ...activeUser, status: "suspended" };
    expect(canUpdateLecture(suspended, lecture)).toBe(false);
  });
});

describe("canSetLectureVisibility", () => {
  it("owner active → true", () => {
    expect(canSetLectureVisibility(activeUser, lecture)).toBe(true);
  });

  it("not-owner → false", () => {
    expect(canSetLectureVisibility(activeUserNotOwner, lecture)).toBe(false);
  });

  it("гость → false", () => {
    expect(canSetLectureVisibility(null, lecture)).toBe(false);
  });
});

describe("canDeleteLecture", () => {
  it("гость → false", () => {
    expect(canDeleteLecture(null)).toBe(false);
  });

  it("admin с lecture.delete → true", () => {
    expect(canDeleteLecture(activeAdmin)).toBe(true);
  });

  it("user без cap → false", () => {
    expect(canDeleteLecture(activeUser)).toBe(false);
  });

  it("suspended admin → false", () => {
    expect(canDeleteLecture(suspendedAdmin)).toBe(false);
  });
});

describe("canManageCover", () => {
  it("owner active → true", () => {
    expect(canManageCover(activeUser, lecture)).toBe(true);
  });

  it("not-owner → false", () => {
    expect(canManageCover(activeUserNotOwner, lecture)).toBe(false);
  });

  it("гость → false", () => {
    expect(canManageCover(null, lecture)).toBe(false);
  });

  it("suspended owner → false", () => {
    const suspended: Me = { ...activeUser, status: "suspended" };
    expect(canManageCover(suspended, lecture)).toBe(false);
  });
});
