/**
 * Happy-path tests for lectures/actions.ts.
 *
 * For each mutating action, asserts:
 *  (a) correct API verb + path was called
 *  (b) Idempotency-Key header forwarded (for actions that use idempotencyHeaders)
 *  (c) revalidateEntity called with EXACTLY the right tag(s)
 *  (d) action returns { success: true }
 *
 * Revalidate calibration (from actual actions.ts code):
 *   createLecture         → revalidateEntity(LECTURES)                  [list-only]
 *   updateLecture         → revalidateEntity(LECTURES, id) + (LECTURES)  [item + list]
 *   setLectureVisibility  → revalidateEntity(LECTURES, id) + (LECTURES)  [item + list]
 *   deleteLecture         → revalidateEntity(LECTURES)                  [list-only]
 *   setLectureCover       → revalidateEntity(LECTURES, id) + (LECTURES)  [item + list]
 *   clearLectureCover     → revalidateEntity(LECTURES, id) + (LECTURES)  [item + list]
 *   attachToLecture       → revalidateEntity(LECTURES, lecture_id)      [item-only!]
 *   detachFromLecture     → revalidateEntity(LECTURES, lecture_id)      [item-only!]
 *   reorderLectureAttachment → revalidateEntity(LECTURES, lecture_id)   [item-only!]
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { Tags } from "@/api/tags";
import * as revalidateModule from "@/utils/revalidate";

// ── API verb spies ────────────────────────────────────────────────────────────
const post = vi.fn();
const put = vi.fn();
const patch = vi.fn();
const del = vi.fn();

// ── Module-level mocks (hoisted by vitest) ────────────────────────────────────

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ POST: post, PUT: put, PATCH: patch, DELETE: del }),
}));

const getMeImpl = vi.fn();
vi.mock("@/utils/me", () => ({ getMe: () => getMeImpl() as unknown }));

const getLectureByIdImpl = vi.fn();
vi.mock("./api", () => ({
  getLectureById: (...args: unknown[]) => getLectureByIdImpl(...args) as unknown,
}));

// Key spy — defined via vi.fn() in factory to satisfy hoisting rules (can't
// reference outer vars). Access via the imported module binding below.
vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
}));

// Imports AFTER vi.mock (hoisted ordering).
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

// ── Constants ─────────────────────────────────────────────────────────────────
const LECTURE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENTITY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UPLOAD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OWNER_ID = "real-owner-id";
const IK = "idem-key-lectures-001";

const initial = { success: false as const, error: "" };

function ownerMe() {
  return {
    id: OWNER_ID,
    username: "owner",
    role: "user" as const,
    status: "active" as const,
    capabilities: ["lecture.create", "lecture.delete", "entity.attach"] as string[],
  };
}

function ownedLecture() {
  return {
    id: LECTURE_ID,
    owner_id: OWNER_ID,
    title: "Test Lecture",
    description: "",
    date: "2024-01-01",
    visibility: "private" as const,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

function lectureSuccessEnvelope() {
  return {
    data: {
      data: {
        id: LECTURE_ID,
        title: "Test",
        date: "2024-01-01",
        description: "",
        visibility: "private",
        owner_id: OWNER_ID,
      },
    },
    error: undefined,
  };
}

function voidSuccessEnvelope() {
  return { data: undefined, error: undefined };
}

function form(fields: Record<string, string> = {}): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function revalidateSpy() {
  return vi.mocked(revalidateModule.revalidateEntity);
}

beforeEach(() => {
  post.mockReset();
  put.mockReset();
  patch.mockReset();
  del.mockReset();
  getMeImpl.mockReset();
  getLectureByIdImpl.mockReset();
  revalidateSpy().mockReset();

  getMeImpl.mockResolvedValue(ownerMe());
  getLectureByIdImpl.mockResolvedValue(ownedLecture());
});

// ── createLecture ─────────────────────────────────────────────────────────────

describe("createLecture — happy path", () => {
  it("POSTs to /api/admin/lectures with correct body + idempotency header", async () => {
    post.mockResolvedValue(lectureSuccessEnvelope());
    const fd = form({
      title: "My Lecture",
      description: "Desc",
      date: "2024-06-01",
      __idempotency_key: IK,
    });
    const result = await createLecture(initial, fd);

    expect(result).toMatchObject({ success: true });
    expect(post).toHaveBeenCalledOnce();
    const [path, opts] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/admin/lectures");
    expect((opts.headers as Record<string, string>)["Idempotency-Key"]).toBe(IK);
    expect(opts.body).toMatchObject({ title: "My Lecture", date: "2024-06-01" });
  });

  it("calls revalidateEntity(LECTURES) once — list tag only, no item tag", async () => {
    post.mockResolvedValue(lectureSuccessEnvelope());
    await createLecture(
      initial,
      form({ title: "T", description: "", date: "2024-06-01", __idempotency_key: IK }),
    );

    expect(revalidateSpy()).toHaveBeenCalledTimes(1);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.LECTURES);
    expect(revalidateSpy()).not.toHaveBeenCalledWith(Tags.LECTURES, expect.anything());
  });

  it("returns { success: true, data } on success", async () => {
    post.mockResolvedValue(lectureSuccessEnvelope());
    const result = await createLecture(
      initial,
      form({ title: "T", description: "", date: "2024-06-01", __idempotency_key: IK }),
    );
    expect(result).toMatchObject({ success: true, data: { id: LECTURE_ID } });
  });
});

// ── updateLecture ─────────────────────────────────────────────────────────────

describe("updateLecture — happy path", () => {
  it("PUTs to /api/lectures/{id} with correct params + idempotency header", async () => {
    put.mockResolvedValue(lectureSuccessEnvelope());
    const fd = form({
      id: LECTURE_ID,
      title: "Updated",
      description: "",
      date: "2024-06-01",
      __idempotency_key: IK,
    });
    const result = await updateLecture(initial, fd);

    expect(result).toMatchObject({ success: true });
    expect(put).toHaveBeenCalledOnce();
    const [path, opts] = put.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/lectures/{id}");
    expect((opts.params as { path: { id: string } }).path.id).toBe(LECTURE_ID);
    expect((opts.headers as Record<string, string>)["Idempotency-Key"]).toBe(IK);
  });

  it("calls revalidateEntity TWICE: (LECTURES, id) and (LECTURES)", async () => {
    put.mockResolvedValue(lectureSuccessEnvelope());
    await updateLecture(
      initial,
      form({ id: LECTURE_ID, title: "T", description: "", date: "2024-06-01", __idempotency_key: IK }),
    );

    expect(revalidateSpy()).toHaveBeenCalledTimes(2);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.LECTURES, LECTURE_ID);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.LECTURES);
    // Wrong-tag smoke: must NOT be called with DOCUMENTS
    expect(revalidateSpy()).not.toHaveBeenCalledWith(Tags.DOCUMENTS, expect.anything());
    expect(revalidateSpy()).not.toHaveBeenCalledWith(Tags.DOCUMENTS);
  });
});

// ── setLectureVisibility ──────────────────────────────────────────────────────

describe("setLectureVisibility — happy path", () => {
  it("PATCHes /api/lectures/{id}/visibility with idempotency header", async () => {
    patch.mockResolvedValue(lectureSuccessEnvelope());
    const fd = form({ id: LECTURE_ID, visibility: "public", __idempotency_key: IK });
    const result = await setLectureVisibility(initial, fd);

    expect(result).toMatchObject({ success: true });
    expect(patch).toHaveBeenCalledOnce();
    const [path, opts] = patch.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/lectures/{id}/visibility");
    expect((opts.params as { path: { id: string } }).path.id).toBe(LECTURE_ID);
    expect((opts.headers as Record<string, string>)["Idempotency-Key"]).toBe(IK);
  });

  it("calls revalidateEntity TWICE: (LECTURES, id) and (LECTURES)", async () => {
    patch.mockResolvedValue(lectureSuccessEnvelope());
    await setLectureVisibility(
      initial,
      form({ id: LECTURE_ID, visibility: "public", __idempotency_key: IK }),
    );

    expect(revalidateSpy()).toHaveBeenCalledTimes(2);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.LECTURES, LECTURE_ID);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.LECTURES);
  });
});

// ── deleteLecture ─────────────────────────────────────────────────────────────

describe("deleteLecture — happy path", () => {
  it("DELETEs /api/admin/lectures/{id}", async () => {
    del.mockResolvedValue(voidSuccessEnvelope());
    const result = await deleteLecture(LECTURE_ID);

    expect(result).toMatchObject({ success: true });
    expect(del).toHaveBeenCalledOnce();
    const [path, opts] = del.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/admin/lectures/{id}");
    expect((opts.params as { path: { id: string } }).path.id).toBe(LECTURE_ID);
  });

  it("calls revalidateEntity(LECTURES) once — list tag only", async () => {
    del.mockResolvedValue(voidSuccessEnvelope());
    await deleteLecture(LECTURE_ID);

    expect(revalidateSpy()).toHaveBeenCalledTimes(1);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.LECTURES);
    expect(revalidateSpy()).not.toHaveBeenCalledWith(Tags.LECTURES, expect.anything());
  });
});

// ── setLectureCover ───────────────────────────────────────────────────────────

describe("setLectureCover — happy path", () => {
  it("PUTs to /api/lectures/{id}/cover with correct body", async () => {
    put.mockResolvedValue(voidSuccessEnvelope());
    const result = await setLectureCover({ id: LECTURE_ID, upload_id: UPLOAD_ID });

    expect(result).toMatchObject({ success: true });
    expect(put).toHaveBeenCalledOnce();
    const [path, opts] = put.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/lectures/{id}/cover");
    expect((opts.params as { path: { id: string } }).path.id).toBe(LECTURE_ID);
    expect(opts.body).toMatchObject({ upload_id: UPLOAD_ID });
  });

  it("calls revalidateEntity TWICE: (LECTURES, id) and (LECTURES)", async () => {
    put.mockResolvedValue(voidSuccessEnvelope());
    await setLectureCover({ id: LECTURE_ID, upload_id: UPLOAD_ID });

    expect(revalidateSpy()).toHaveBeenCalledTimes(2);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.LECTURES, LECTURE_ID);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.LECTURES);
  });
});

// ── clearLectureCover ─────────────────────────────────────────────────────────

describe("clearLectureCover — happy path", () => {
  it("DELETEs /api/lectures/{id}/cover", async () => {
    del.mockResolvedValue(voidSuccessEnvelope());
    const result = await clearLectureCover(LECTURE_ID);

    expect(result).toMatchObject({ success: true });
    expect(del).toHaveBeenCalledOnce();
    const [path, opts] = del.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/lectures/{id}/cover");
    expect((opts.params as { path: { id: string } }).path.id).toBe(LECTURE_ID);
  });

  it("calls revalidateEntity TWICE: (LECTURES, id) and (LECTURES)", async () => {
    del.mockResolvedValue(voidSuccessEnvelope());
    await clearLectureCover(LECTURE_ID);

    expect(revalidateSpy()).toHaveBeenCalledTimes(2);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.LECTURES, LECTURE_ID);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.LECTURES);
  });
});

// ── attachToLecture ───────────────────────────────────────────────────────────

describe("attachToLecture — happy path", () => {
  it("POSTs to /api/lectures/{lectureID}/attachments with correct params + body", async () => {
    post.mockResolvedValue(voidSuccessEnvelope());
    const result = await attachToLecture({
      lecture_id: LECTURE_ID,
      entity_id: ENTITY_ID,
      entity_type: "document",
    });

    expect(result).toMatchObject({ success: true });
    expect(post).toHaveBeenCalledOnce();
    const [path, opts] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/lectures/{lectureID}/attachments");
    expect((opts.params as { path: { lectureID: string } }).path.lectureID).toBe(LECTURE_ID);
    expect(opts.body).toMatchObject({ entity_id: ENTITY_ID, entity_type: "document" });
  });

  it("calls revalidateEntity(LECTURES, lecture_id) ONCE — item only, NO list tag", async () => {
    post.mockResolvedValue(voidSuccessEnvelope());
    await attachToLecture({ lecture_id: LECTURE_ID, entity_id: ENTITY_ID, entity_type: "document" });

    expect(revalidateSpy()).toHaveBeenCalledTimes(1);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.LECTURES, LECTURE_ID);
    // Must NOT also call the list-only form
    expect(revalidateSpy()).not.toHaveBeenCalledWith(Tags.LECTURES);
  });
});

// ── detachFromLecture ─────────────────────────────────────────────────────────

describe("detachFromLecture — happy path", () => {
  it("DELETEs /api/lectures/{lectureID}/attachments/{entityType}/{entityID}", async () => {
    del.mockResolvedValue(voidSuccessEnvelope());
    const result = await detachFromLecture({
      lecture_id: LECTURE_ID,
      entity_id: ENTITY_ID,
      entity_type: "document",
    });

    expect(result).toMatchObject({ success: true });
    expect(del).toHaveBeenCalledOnce();
    const [path, opts] = del.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/lectures/{lectureID}/attachments/{entityType}/{entityID}");
    const pathParams = (opts.params as { path: Record<string, string> }).path;
    expect(pathParams.lectureID).toBe(LECTURE_ID);
    expect(pathParams.entityType).toBe("document");
    expect(pathParams.entityID).toBe(ENTITY_ID);
  });

  it("calls revalidateEntity(LECTURES, lecture_id) ONCE — item only, NO list tag", async () => {
    del.mockResolvedValue(voidSuccessEnvelope());
    await detachFromLecture({ lecture_id: LECTURE_ID, entity_id: ENTITY_ID, entity_type: "document" });

    expect(revalidateSpy()).toHaveBeenCalledTimes(1);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.LECTURES, LECTURE_ID);
    expect(revalidateSpy()).not.toHaveBeenCalledWith(Tags.LECTURES);
  });
});

// ── reorderLectureAttachment ──────────────────────────────────────────────────

describe("reorderLectureAttachment — happy path", () => {
  it("PATCHes /api/lectures/{lectureID}/attachments/{entityType}/{entityID}", async () => {
    patch.mockResolvedValue(voidSuccessEnvelope());
    const result = await reorderLectureAttachment({
      lecture_id: LECTURE_ID,
      entity_id: ENTITY_ID,
      entity_type: "document",
      sort_order: 5,
    });

    expect(result).toMatchObject({ success: true });
    expect(patch).toHaveBeenCalledOnce();
    const [path, opts] = patch.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/lectures/{lectureID}/attachments/{entityType}/{entityID}");
    const pathParams = (opts.params as { path: Record<string, string> }).path;
    expect(pathParams.lectureID).toBe(LECTURE_ID);
    expect(pathParams.entityType).toBe("document");
    expect(pathParams.entityID).toBe(ENTITY_ID);
    expect(opts.body).toMatchObject({ sort_order: 5 });
  });

  it("calls revalidateEntity(LECTURES, lecture_id) ONCE — item only, NO list tag", async () => {
    patch.mockResolvedValue(voidSuccessEnvelope());
    await reorderLectureAttachment({
      lecture_id: LECTURE_ID,
      entity_id: ENTITY_ID,
      entity_type: "document",
      sort_order: 5,
    });

    expect(revalidateSpy()).toHaveBeenCalledTimes(1);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.LECTURES, LECTURE_ID);
    expect(revalidateSpy()).not.toHaveBeenCalledWith(Tags.LECTURES);
  });
});

// ── Error mapping smoke test ──────────────────────────────────────────────────

describe("createLecture — backend error mapping smoke test", () => {
  it("maps backend NOT_FOUND error to { success: false } and does NOT revalidate", async () => {
    post.mockResolvedValue({
      data: undefined,
      error: { code: "NOT_FOUND", error: "Not found" },
    });
    const result = await createLecture(
      initial,
      form({ title: "T", description: "", date: "2024-06-01", __idempotency_key: IK }),
    );
    expect(result).toMatchObject({ success: false });
    expect(revalidateSpy()).not.toHaveBeenCalled();
  });
});
