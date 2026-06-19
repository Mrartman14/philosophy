/**
 * RBAC-denied path tests for documents/actions.ts.
 *
 * Strategy:
 * - Use REAL permissions.ts (NOT mocked) — this is what makes the gate real.
 * - Stub getMe to a user that LACKS the required capability/active status.
 * - Stub createApiClient so mutating verbs (POST/PUT/PATCH/DELETE) are spies.
 * - Each test asserts BOTH {success:false,code:"forbidden"} AND spy.not.called.
 *
 * Gate breakdown per action:
 *   createDocument          → requireCapability(me, canCreateDocument) [document.create]
 *   uploadDocument          → requireCapability(me, canCreateDocument) [document.create]
 *   updateDocumentMeta      → requireActive(me) [suspended/guest denied]
 *   updateDocumentBlocks    → requireActive(me) [suspended/guest denied]
 *   setDocumentVisibility   → requireActive(me) [suspended/guest denied]
 *   deleteDocument          → requireActive(me) [suspended/guest denied]
 *   adminDeleteDocument     → requireCapability(me, canListAdminDocuments) [document.delete_any]
 *
 * NOTE: updateDocumentMeta/Blocks/setDocumentVisibility/deleteDocument use
 * requireActive(), NOT a full capability check. They are correctly gated — the
 * frontend relies on the backend for ownership enforcement (see permissions.ts
 * comments). We test that the requireActive gate fires for guests/suspended.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  activeUserNoCapsMe,
  suspendedMe,
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

const getMeImpl = vi.fn();
vi.mock("@/utils/me", () => ({ getMe: () => getMeImpl() as unknown }));

vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

// next/headers — needed for uploadDocument which calls cookies()
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: vi.fn(() => ({ value: "mock-token" })) }),
}));

vi.mock("@/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n")>();
  return {
    ...actual,
    getT: () => Promise.resolve((key: string) => key),
  };
});

// next/navigation — createAction/createFormAction may use redirect
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
}));

// Import actions AFTER vi.mock (hoisted ordering).
import {
  adminDeleteDocument,
  createDocument,
  deleteDocument,
  setDocumentVisibility,
  updateDocumentMeta,
  uploadDocument,
} from "./actions";

// ── Test constants ────────────────────────────────────────────────────────────
const DOC_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const initial = { success: false as const, error: "" };

const BLOCKS_JSON = JSON.stringify([{ id: "b1", type: "paragraph", content: [] }]);

function docCreateForm(): FormData {
  const fd = new FormData();
  fd.set("title", "My Document");
  fd.set("blocks", BLOCKS_JSON);
  return fd;
}

function docMetaForm(): FormData {
  const fd = new FormData();
  fd.set("id", DOC_ID);
  fd.set("title", "Updated Title");
  return fd;
}

function docVisibilityForm(): FormData {
  const fd = new FormData();
  fd.set("id", DOC_ID);
  fd.set("visibility", "public");
  return fd;
}

beforeEach(() => {
  post.mockReset();
  put.mockReset();
  patch.mockReset();
  del.mockReset();
  getMeImpl.mockReset();
});

// ── createDocument: capability-only (document.create) ────────────────────────

describe("createDocument — RBAC denied", () => {
  it("guest → forbidden, POST not called", async () => {
    getMeImpl.mockResolvedValue(null);
    const result = await createDocument(initial, docCreateForm());
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(post).not.toHaveBeenCalled();
  });

  it("active user without document.create → forbidden, POST not called", async () => {
    getMeImpl.mockResolvedValue(activeUserNoCapsMe());
    const result = await createDocument(initial, docCreateForm());
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(post).not.toHaveBeenCalled();
  });
});

// ── uploadDocument: capability-only (document.create) ────────────────────────
// uploadDocument calls cookies() then fetch (not createApiClient), so the
// denial fires BEFORE any network call. We verify no fetch was called.

describe("uploadDocument — RBAC denied", () => {
  it("guest → forbidden, no fetch called", async () => {
    getMeImpl.mockResolvedValue(null);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const fd = new FormData();
    fd.set("file", new File(["# Hello"], "test.md", { type: "text/markdown" }));
    const result = await uploadDocument(initial, fd);
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("active user without document.create → forbidden, no fetch called", async () => {
    getMeImpl.mockResolvedValue(activeUserNoCapsMe());
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const fd = new FormData();
    fd.set("file", new File(["# Hello"], "test.md", { type: "text/markdown" }));
    const result = await uploadDocument(initial, fd);
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

// ── updateDocumentMeta: requireActive gate ────────────────────────────────────

describe("updateDocumentMeta — requireActive denied", () => {
  it("guest → forbidden, PATCH not called", async () => {
    getMeImpl.mockResolvedValue(null);
    const result = await updateDocumentMeta(initial, docMetaForm());
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(patch).not.toHaveBeenCalled();
  });

  it("suspended user → forbidden, PATCH not called", async () => {
    getMeImpl.mockResolvedValue(suspendedMe());
    const result = await updateDocumentMeta(initial, docMetaForm());
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(patch).not.toHaveBeenCalled();
  });
});

// ── setDocumentVisibility: requireActive gate ─────────────────────────────────

describe("setDocumentVisibility — requireActive denied", () => {
  it("guest → forbidden, PATCH not called", async () => {
    getMeImpl.mockResolvedValue(null);
    const result = await setDocumentVisibility(initial, docVisibilityForm());
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(patch).not.toHaveBeenCalled();
  });

  it("suspended user → forbidden, PATCH not called", async () => {
    getMeImpl.mockResolvedValue(suspendedMe());
    const result = await setDocumentVisibility(initial, docVisibilityForm());
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(patch).not.toHaveBeenCalled();
  });
});

// ── deleteDocument: requireActive gate ───────────────────────────────────────

describe("deleteDocument — requireActive denied", () => {
  it("guest → forbidden, DELETE not called", async () => {
    getMeImpl.mockResolvedValue(null);
    const result = await deleteDocument(DOC_ID);
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(del).not.toHaveBeenCalled();
  });

  it("suspended user → forbidden, DELETE not called", async () => {
    getMeImpl.mockResolvedValue(suspendedMe());
    const result = await deleteDocument(DOC_ID);
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(del).not.toHaveBeenCalled();
  });
});

// ── adminDeleteDocument: capability-only (document.delete_any) ───────────────

describe("adminDeleteDocument — RBAC denied", () => {
  it("guest → forbidden, DELETE not called", async () => {
    getMeImpl.mockResolvedValue(null);
    const result = await adminDeleteDocument(DOC_ID);
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(del).not.toHaveBeenCalled();
  });

  it("active user without document.delete_any → forbidden, DELETE not called", async () => {
    getMeImpl.mockResolvedValue(activeUserNoCapsMe());
    const result = await adminDeleteDocument(DOC_ID);
    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(del).not.toHaveBeenCalled();
  });
});

// ── Self-check: active user with document.create IS allowed ──────────────────

describe("createDocument — capable user is ALLOWED (gate sanity)", () => {
  it("active user with document.create → gate passes, POST called", async () => {
    const capableMe: import("@/utils/me").Me = {
      id: "capable-user-id",
      username: "capable",
      role: "user",
      status: "active",
      capabilities: ["document.create"],
    };
    getMeImpl.mockResolvedValue(capableMe);
    post.mockResolvedValue({ data: { data: { id: DOC_ID } }, error: undefined });
    const result = await createDocument(initial, docCreateForm());
    expect(result).not.toMatchObject({ code: "forbidden" });
    expect(post).toHaveBeenCalledOnce();
  });
});
