/**
 * RBAC-denied path tests for lectures/actions.ts.
 *
 * Strategy:
 * - Use REAL permissions.ts (NOT mocked) — this is what makes the gate real.
 * - Stub getMe to a user that LACKS the required capability/ownership.
 * - For owner-aware actions: stub getLectureById (from "./api") to return a
 *   lecture owned by a DIFFERENT user, so the ownership check rejects.
 * - Stub createApiClient so mutating verbs (POST/PUT/PATCH/DELETE) are spies.
 * - Each test asserts BOTH {success:false,code:"forbidden"} AND spy.not.called.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  activeUserNoCapsMe,
  lectureOwnedByOther,
  otherUserActiveMe,
} from "@/test/action-rbac";

// ── Mutating verb spies ───────────────────────────────────────────────────────
const post = vi.fn();
const put = vi.fn();
const patch = vi.fn();
const del = vi.fn();

// ── Module-level mocks (hoisted by vitest) ────────────────────────────────────

// NOTE: We do NOT mock "./permissions" — we want the REAL permission helpers.

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ POST: post, PUT: put, PATCH: patch, DELETE: del }),
}));

// getMe is controlled per-test via getMeImpl below.
const getMeImpl = vi.fn();
vi.mock("@/utils/me", () => ({ getMe: () => getMeImpl() as unknown }));

// getLectureById is controlled per-test via getLectureByIdImpl below.
const getLectureByIdImpl = vi.fn();
vi.mock("./api", () => ({
  getLectureById: (...args: unknown[]) => getLectureByIdImpl(...args) as unknown,
}));

vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

// next/navigation — needed because createFormAction/createAction may use redirect
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
}));

// Import actions AFTER vi.mock (hoisted ordering).
import {
  attachToLecture,
  clearLectureCover,
  createLecture,
  deleteLecture,
  detachFromLecture,
  reorderLectureAttachment,
  setLectureCover,
  setLectureVisibility,
  updateLecture,
} from "./actions";

// ── Test constants ────────────────────────────────────────────────────────────
const LECTURE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENTITY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UPLOAD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const initial = { success: false as const, error: "" };

function lectureForm(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  post.mockReset();
  put.mockReset();
  patch.mockReset();
  del.mockReset();
  getMeImpl.mockReset();
  getLectureByIdImpl.mockReset();
  // Default: getLectureById returns a lecture owned by "real-owner-id"
  getLectureByIdImpl.mockResolvedValue(lectureOwnedByOther(LECTURE_ID, "real-owner-id"));
});

// ── createLecture: capability-only (lecture.create) ──────────────────────────

describe("createLecture — RBAC denied", () => {
  it("guest → forbidden, POST not called", async () => {
    getMeImpl.mockResolvedValue(null);
    const fd = lectureForm({ title: "Test Lecture", description: "", date: "2024-01-01" });
    const result = await createLecture(initial, fd);
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(post).not.toHaveBeenCalled();
  });

  it("active user without lecture.create → forbidden, POST not called", async () => {
    getMeImpl.mockResolvedValue(activeUserNoCapsMe());
    const fd = lectureForm({ title: "Test Lecture", description: "", date: "2024-01-01" });
    const result = await createLecture(initial, fd);
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(post).not.toHaveBeenCalled();
  });
});

// ── deleteLecture: capability-only (lecture.delete) ──────────────────────────

describe("deleteLecture — RBAC denied", () => {
  it("guest → forbidden, DELETE not called", async () => {
    getMeImpl.mockResolvedValue(null);
    const result = await deleteLecture(LECTURE_ID);
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(del).not.toHaveBeenCalled();
  });

  it("active user without lecture.delete → forbidden, DELETE not called", async () => {
    getMeImpl.mockResolvedValue(activeUserNoCapsMe());
    const result = await deleteLecture(LECTURE_ID);
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(del).not.toHaveBeenCalled();
  });
});

// ── updateLecture: owner-aware (owner_id match) ───────────────────────────────

describe("updateLecture — RBAC denied (non-owner)", () => {
  it("active non-owner → forbidden, PUT not called", async () => {
    // otherUserActiveMe has id "other-user-id", lecture is owned by "real-owner-id"
    getMeImpl.mockResolvedValue(otherUserActiveMe());
    const fd = lectureForm({
      id: LECTURE_ID,
      title: "Updated Title",
      description: "",
      date: "2024-01-01",
    });
    const result = await updateLecture(initial, fd);
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(put).not.toHaveBeenCalled();
  });

  it("guest → forbidden (guest denial before ownership), PUT not called", async () => {
    getMeImpl.mockResolvedValue(null);
    const fd = lectureForm({
      id: LECTURE_ID,
      title: "Updated Title",
      description: "",
      date: "2024-01-01",
    });
    const result = await updateLecture(initial, fd);
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(put).not.toHaveBeenCalled();
  });
});

// ── setLectureVisibility: owner-aware ────────────────────────────────────────

describe("setLectureVisibility — RBAC denied (non-owner)", () => {
  it("active non-owner → forbidden, PATCH not called", async () => {
    getMeImpl.mockResolvedValue(otherUserActiveMe());
    const fd = lectureForm({ id: LECTURE_ID, visibility: "public" });
    const result = await setLectureVisibility(initial, fd);
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(patch).not.toHaveBeenCalled();
  });
});

// ── setLectureCover: owner-aware ─────────────────────────────────────────────

describe("setLectureCover — RBAC denied (non-owner)", () => {
  it("active non-owner → forbidden, PUT not called", async () => {
    getMeImpl.mockResolvedValue(otherUserActiveMe());
    const result = await setLectureCover({ id: LECTURE_ID, upload_id: UPLOAD_ID });
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(put).not.toHaveBeenCalled();
  });
});

// ── clearLectureCover: owner-aware ────────────────────────────────────────────

describe("clearLectureCover — RBAC denied (non-owner)", () => {
  it("active non-owner → forbidden, DELETE not called", async () => {
    getMeImpl.mockResolvedValue(otherUserActiveMe());
    const result = await clearLectureCover(LECTURE_ID);
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(del).not.toHaveBeenCalled();
  });
});

// ── attachToLecture: owner-aware + capability (entity.attach) ────────────────

describe("attachToLecture — RBAC denied", () => {
  it("active non-owner → forbidden, POST not called", async () => {
    // canAttachToLecture requires BOTH ownership AND entity.attach cap.
    // Non-owner fails the ownership check even if they had the cap.
    getMeImpl.mockResolvedValue(otherUserActiveMe());
    const result = await attachToLecture({
      lecture_id: LECTURE_ID,
      entity_id: ENTITY_ID,
      entity_type: "document",
    });
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(post).not.toHaveBeenCalled();
  });

  it("owner without entity.attach capability → forbidden, POST not called", async () => {
    // User IS the owner but lacks entity.attach capability
    const ownerWithoutCap: import("@/utils/me").Me = {
      id: "real-owner-id",
      username: "owner",
      role: "user",
      status: "active",
      capabilities: [], // no entity.attach
    };
    getMeImpl.mockResolvedValue(ownerWithoutCap);
    const result = await attachToLecture({
      lecture_id: LECTURE_ID,
      entity_id: ENTITY_ID,
      entity_type: "document",
    });
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(post).not.toHaveBeenCalled();
  });
});

// ── detachFromLecture: owner-aware ────────────────────────────────────────────

describe("detachFromLecture — RBAC denied (non-owner)", () => {
  it("active non-owner → forbidden, DELETE not called", async () => {
    getMeImpl.mockResolvedValue(otherUserActiveMe());
    const result = await detachFromLecture({
      lecture_id: LECTURE_ID,
      entity_id: ENTITY_ID,
      entity_type: "document",
    });
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(del).not.toHaveBeenCalled();
  });
});

// ── reorderLectureAttachment: owner-aware ─────────────────────────────────────

describe("reorderLectureAttachment — RBAC denied (non-owner)", () => {
  it("active non-owner → forbidden, PATCH not called", async () => {
    getMeImpl.mockResolvedValue(otherUserActiveMe());
    const result = await reorderLectureAttachment({
      lecture_id: LECTURE_ID,
      entity_id: ENTITY_ID,
      entity_type: "document",
      sort_order: 0,
    });
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(patch).not.toHaveBeenCalled();
  });
});

// ── Self-check: sanity that owner IS allowed (gate is wired correctly) ────────

describe("updateLecture — owner is ALLOWED (gate sanity)", () => {
  it("owner with active status → gate passes, PUT is called", async () => {
    const ownerMe: import("@/utils/me").Me = {
      id: "real-owner-id",
      username: "owner",
      role: "user",
      status: "active",
      capabilities: [],
    };
    getMeImpl.mockResolvedValue(ownerMe);
    put.mockResolvedValue({ data: { data: { id: LECTURE_ID } }, error: undefined });
    const fd = lectureForm({
      id: LECTURE_ID,
      title: "Updated Title",
      description: "",
      date: "2024-01-01",
      version: "1",
    });
    const result = await updateLecture(initial, fd);
    expect(result).not.toMatchObject({ code: "forbidden" });
    expect(put).toHaveBeenCalledOnce();
  });
});
