// src/features/lectures/permissions.test.ts
import { describe, it, expect } from "vitest";

import type { Me } from "@/utils/me";

import {
  canCreateLecture,
  canUpdateLecture,
  canDeleteLecture,
  canSetLectureVisibility,
  canManageCover,
  canManageAttachments,
  canAttachToLecture,
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

const ownerWithAttach: Me = {
  ...activeUser,
  capabilities: ["entity.attach"],
};

describe("canManageAttachments", () => {
  it("owner active → true (detach/reorder — только ownership)", () => {
    expect(canManageAttachments(activeUser, lecture)).toBe(true);
  });

  it("not-owner → false", () => {
    expect(canManageAttachments(activeUserNotOwner, lecture)).toBe(false);
  });

  it("гость → false", () => {
    expect(canManageAttachments(null, lecture)).toBe(false);
  });

  it("suspended owner → false", () => {
    const suspended: Me = { ...activeUser, status: "suspended" };
    expect(canManageAttachments(suspended, lecture)).toBe(false);
  });
});

describe("canAttachToLecture", () => {
  it("owner + entity.attach → true", () => {
    expect(canAttachToLecture(ownerWithAttach, lecture)).toBe(true);
  });

  it("owner без entity.attach → false", () => {
    expect(canAttachToLecture(activeUser, lecture)).toBe(false);
  });

  it("entity.attach но не owner → false", () => {
    const strangerWithAttach: Me = {
      ...ownerWithAttach,
      id: "00000000-0000-0000-0000-000000000002",
    };
    expect(canAttachToLecture(strangerWithAttach, lecture)).toBe(false);
  });

  it("гость → false", () => {
    expect(canAttachToLecture(null, lecture)).toBe(false);
  });

  it("suspended owner с cap → false", () => {
    const suspended: Me = { ...ownerWithAttach, status: "suspended" };
    expect(canAttachToLecture(suspended, lecture)).toBe(false);
  });
});
