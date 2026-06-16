/**
 * Happy-path tests for documents/actions.ts.
 *
 * For each mutating action, asserts:
 *  (a) correct API verb + path was called
 *  (b) Idempotency-Key header forwarded (for actions that pass ctx.idempotencyKey)
 *  (c) revalidateEntity called with EXACTLY the right tag(s)
 *  (d) action returns { success: true }
 *
 * Revalidate calibration (from actual actions.ts code):
 *   createDocument        → revalidateEntity(DOCUMENTS)                   [list-only]
 *   updateDocumentMeta    → revalidateEntity(DOCUMENTS, id) + (DOCUMENTS)  [item + list]
 *   updateDocumentBlocks  → revalidateEntity(DOCUMENTS, id) + (DOCUMENTS)  [item + list]
 *   setDocumentVisibility → revalidateEntity(DOCUMENTS, id) + (DOCUMENTS)  [item + list]
 *   deleteDocument        → revalidateEntity(DOCUMENTS)                   [list-only]
 *   adminDeleteDocument   → revalidateEntity(DOCUMENTS)                   [list-only]
 *
 * Note: uploadDocument uses raw fetch (not createApiClient) and is skipped here.
 * Its RBAC-denied gate is tested in actions-rbac.test.ts.
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

// Key spy — defined via vi.fn() in factory to satisfy hoisting rules.
vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

// next/headers — uploadDocument calls cookies(); mock to avoid import errors.
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: vi.fn(() => ({ value: "mock-token" })) }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
}));

// Imports AFTER vi.mock (hoisted ordering).
import {
  adminDeleteDocument,
  createDocument,
  deleteDocument,
  setDocumentVisibility,
  updateDocumentBlocks,
  updateDocumentMeta,
} from "./actions";

// ── Constants ─────────────────────────────────────────────────────────────────
const DOC_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const IK = "idem-key-docs-001";

const initial = { success: false as const, error: "" };

const BLOCKS_JSON = JSON.stringify([{ id: "b1", type: "paragraph", content: [] }]);

function activeMe() {
  return {
    id: "active-user-id",
    username: "active",
    role: "user" as const,
    status: "active" as const,
    capabilities: ["document.create", "document.delete_any"] as string[],
  };
}

function docSuccessEnvelope() {
  return {
    data: {
      data: {
        id: DOC_ID,
        title: "My Document",
        owner_id: "active-user-id",
        visibility: "private",
        blocks: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
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
  revalidateSpy().mockReset();

  getMeImpl.mockResolvedValue(activeMe());
});

// ── createDocument ────────────────────────────────────────────────────────────

describe("createDocument — happy path", () => {
  it("POSTs to /api/documents with correct body + idempotency header", async () => {
    post.mockResolvedValue(docSuccessEnvelope());
    const fd = form({ title: "My Document", blocks: BLOCKS_JSON, __idempotency_key: IK });
    const result = await createDocument(initial, fd);

    expect(result).toMatchObject({ success: true });
    expect(post).toHaveBeenCalledOnce();
    const [path, opts] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/documents");
    expect((opts.headers as Record<string, string>)["Idempotency-Key"]).toBe(IK);
    expect(opts.body).toMatchObject({ title: "My Document" });
  });

  it("calls revalidateEntity(DOCUMENTS) once — list tag only, no item tag", async () => {
    post.mockResolvedValue(docSuccessEnvelope());
    await createDocument(initial, form({ title: "T", blocks: BLOCKS_JSON, __idempotency_key: IK }));

    expect(revalidateSpy()).toHaveBeenCalledTimes(1);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.DOCUMENTS);
    expect(revalidateSpy()).not.toHaveBeenCalledWith(Tags.DOCUMENTS, expect.anything());
    // Wrong-tag smoke
    expect(revalidateSpy()).not.toHaveBeenCalledWith(Tags.LECTURES);
  });

  it("returns { success: true, data } on success", async () => {
    post.mockResolvedValue(docSuccessEnvelope());
    const result = await createDocument(
      initial,
      form({ title: "T", blocks: BLOCKS_JSON, __idempotency_key: IK }),
    );
    expect(result).toMatchObject({ success: true, data: { id: DOC_ID } });
  });
});

// ── updateDocumentMeta ────────────────────────────────────────────────────────

describe("updateDocumentMeta — happy path", () => {
  it("PATCHes /api/documents/{document_id} with correct params + body", async () => {
    patch.mockResolvedValue(docSuccessEnvelope());
    const fd = form({ id: DOC_ID, title: "Updated Title" });
    const result = await updateDocumentMeta(initial, fd);

    expect(result).toMatchObject({ success: true });
    expect(patch).toHaveBeenCalledOnce();
    const [path, opts] = patch.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/documents/{document_id}");
    expect((opts.params as { path: { document_id: string } }).path.document_id).toBe(DOC_ID);
    expect(opts.body).toMatchObject({ title: "Updated Title" });
  });

  it("calls revalidateEntity TWICE: (DOCUMENTS, id) and (DOCUMENTS)", async () => {
    patch.mockResolvedValue(docSuccessEnvelope());
    await updateDocumentMeta(initial, form({ id: DOC_ID, title: "T" }));

    expect(revalidateSpy()).toHaveBeenCalledTimes(2);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.DOCUMENTS, DOC_ID);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.DOCUMENTS);
    // Wrong-tag smoke
    expect(revalidateSpy()).not.toHaveBeenCalledWith(Tags.LECTURES, expect.anything());
    expect(revalidateSpy()).not.toHaveBeenCalledWith(Tags.LECTURES);
  });
});

// ── updateDocumentBlocks ──────────────────────────────────────────────────────

describe("updateDocumentBlocks — happy path", () => {
  it("PUTs to /api/documents/{document_id}/blocks with idempotency header", async () => {
    put.mockResolvedValue(docSuccessEnvelope());
    const fd = form({
      id: DOC_ID,
      blocks: BLOCKS_JSON,
      version: "3",
      __idempotency_key: IK,
    });
    const result = await updateDocumentBlocks(initial, fd);

    expect(result).toMatchObject({ success: true });
    expect(put).toHaveBeenCalledOnce();
    const [path, opts] = put.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/documents/{document_id}/blocks");
    expect((opts.params as { path: { document_id: string } }).path.document_id).toBe(DOC_ID);
    expect((opts.headers as Record<string, string>)["Idempotency-Key"]).toBe(IK);
  });

  it("calls revalidateEntity TWICE: (DOCUMENTS, id) and (DOCUMENTS)", async () => {
    put.mockResolvedValue(docSuccessEnvelope());
    await updateDocumentBlocks(
      initial,
      form({ id: DOC_ID, blocks: BLOCKS_JSON, version: "1", __idempotency_key: IK }),
    );

    expect(revalidateSpy()).toHaveBeenCalledTimes(2);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.DOCUMENTS, DOC_ID);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.DOCUMENTS);
  });
});

// ── setDocumentVisibility ─────────────────────────────────────────────────────

describe("setDocumentVisibility — happy path", () => {
  it("PATCHes /api/documents/{document_id}/visibility with correct body", async () => {
    patch.mockResolvedValue(docSuccessEnvelope());
    const fd = form({ id: DOC_ID, visibility: "public" });
    const result = await setDocumentVisibility(initial, fd);

    expect(result).toMatchObject({ success: true });
    expect(patch).toHaveBeenCalledOnce();
    const [path, opts] = patch.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/documents/{document_id}/visibility");
    expect((opts.params as { path: { document_id: string } }).path.document_id).toBe(DOC_ID);
    expect(opts.body).toMatchObject({ visibility: "public" });
  });

  it("calls revalidateEntity TWICE: (DOCUMENTS, id) and (DOCUMENTS)", async () => {
    patch.mockResolvedValue(docSuccessEnvelope());
    await setDocumentVisibility(initial, form({ id: DOC_ID, visibility: "public" }));

    expect(revalidateSpy()).toHaveBeenCalledTimes(2);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.DOCUMENTS, DOC_ID);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.DOCUMENTS);
  });
});

// ── deleteDocument ────────────────────────────────────────────────────────────

describe("deleteDocument — happy path", () => {
  it("DELETEs /api/documents/{document_id} with idempotency header", async () => {
    del.mockResolvedValue(voidSuccessEnvelope());
    const result = await deleteDocument(DOC_ID, IK);

    expect(result).toMatchObject({ success: true });
    expect(del).toHaveBeenCalledOnce();
    const [path, opts] = del.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/documents/{document_id}");
    expect((opts.params as { path: { document_id: string } }).path.document_id).toBe(DOC_ID);
    expect((opts.headers as Record<string, string>)["Idempotency-Key"]).toBe(IK);
  });

  it("calls revalidateEntity(DOCUMENTS) once — list tag only", async () => {
    del.mockResolvedValue(voidSuccessEnvelope());
    await deleteDocument(DOC_ID, IK);

    expect(revalidateSpy()).toHaveBeenCalledTimes(1);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.DOCUMENTS);
    expect(revalidateSpy()).not.toHaveBeenCalledWith(Tags.DOCUMENTS, expect.anything());
  });
});

// ── adminDeleteDocument ───────────────────────────────────────────────────────

describe("adminDeleteDocument — happy path", () => {
  it("DELETEs /api/admin/documents/{document_id} with idempotency header", async () => {
    del.mockResolvedValue(voidSuccessEnvelope());
    const result = await adminDeleteDocument(DOC_ID, IK);

    expect(result).toMatchObject({ success: true });
    expect(del).toHaveBeenCalledOnce();
    const [path, opts] = del.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/admin/documents/{document_id}");
    expect((opts.params as { path: { document_id: string } }).path.document_id).toBe(DOC_ID);
    expect((opts.headers as Record<string, string>)["Idempotency-Key"]).toBe(IK);
  });

  it("calls revalidateEntity(DOCUMENTS) once — list tag only", async () => {
    del.mockResolvedValue(voidSuccessEnvelope());
    await adminDeleteDocument(DOC_ID, IK);

    expect(revalidateSpy()).toHaveBeenCalledTimes(1);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.DOCUMENTS);
    expect(revalidateSpy()).not.toHaveBeenCalledWith(Tags.DOCUMENTS, expect.anything());
  });
});

// ── Error mapping smoke test ──────────────────────────────────────────────────

describe("createDocument — backend error mapping smoke test", () => {
  it("maps backend error to { success: false } and does NOT revalidate", async () => {
    post.mockResolvedValue({
      data: undefined,
      error: { code: "FORBIDDEN", error: "Forbidden" },
    });
    const result = await createDocument(
      initial,
      form({ title: "T", blocks: BLOCKS_JSON, __idempotency_key: IK }),
    );
    expect(result).toMatchObject({ success: false });
    expect(revalidateSpy()).not.toHaveBeenCalled();
  });
});
