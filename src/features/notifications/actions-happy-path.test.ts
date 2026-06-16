/**
 * Happy-path tests for notifications/actions.ts.
 *
 * Key invariant: notification actions do NOT call revalidateEntity at all.
 * Notification counts are driven by client read-actions (polling / SSE), not
 * by Next.js unstable_cache tags. Any revalidateEntity call here would be
 * a bug, so the tests assert NON-invocation.
 *
 * Coverage:
 *   markRead            → POST /api/me/notifications/{id}/read, no revalidate
 *   markAllRead         → POST /api/me/notifications/read-all, no revalidate
 *   markAllSeen         → POST /api/me/notifications/seen-all, no revalidate
 *   subscribeDocument   → POST /api/documents/{id}/subscribe, no revalidate
 *   unsubscribeDocument → DELETE /api/documents/{id}/subscribe, no revalidate
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import * as revalidateModule from "@/utils/revalidate";

// ── API verb spies ────────────────────────────────────────────────────────────
const post = vi.fn();
const del = vi.fn();

// ── Module-level mocks (hoisted by vitest) ────────────────────────────────────

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ POST: post, DELETE: del }),
}));

const getMeImpl = vi.fn();
vi.mock("@/utils/me", () => ({ getMe: () => getMeImpl() as unknown }));

// Mock ./api so read-actions (fetchNotificationCounts / fetchNotifications) do
// not make real network calls (not under test here).
vi.mock("./api", () => ({
  getNotificationCounts: vi.fn(),
  getNotifications: vi.fn(),
}));

// Key spy — defined via vi.fn() in factory to satisfy hoisting rules.
// Notification actions must NOT call revalidateEntity at all.
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
  markAllRead,
  markAllSeen,
  markRead,
  subscribeDocument,
  unsubscribeDocument,
} from "./actions";

// ── Constants ─────────────────────────────────────────────────────────────────
const NOTIF_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const DOC_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function activeMe() {
  return {
    id: "active-user-id",
    username: "active",
    role: "user" as const,
    status: "active" as const,
    capabilities: [] as string[],
  };
}

function revalidateSpy() {
  return vi.mocked(revalidateModule.revalidateEntity);
}

beforeEach(() => {
  post.mockReset();
  del.mockReset();
  getMeImpl.mockReset();
  revalidateSpy().mockReset();

  getMeImpl.mockResolvedValue(activeMe());
  post.mockResolvedValue({ data: undefined, error: undefined });
  del.mockResolvedValue({ data: undefined, error: undefined });
});

// ── markRead ──────────────────────────────────────────────────────────────────

describe("markRead — happy path", () => {
  it("POSTs to /api/me/notifications/{id}/read with correct path param", async () => {
    const result = await markRead(NOTIF_ID);

    expect(result).toMatchObject({ success: true });
    expect(post).toHaveBeenCalledOnce();
    const [path, opts] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/me/notifications/{id}/read");
    expect((opts.params as { path: { id: string } }).path.id).toBe(NOTIF_ID);
  });

  it("does NOT call revalidateEntity", async () => {
    await markRead(NOTIF_ID);
    expect(revalidateSpy()).not.toHaveBeenCalled();
  });
});

// ── markAllRead ───────────────────────────────────────────────────────────────

describe("markAllRead — happy path", () => {
  it("POSTs to /api/me/notifications/read-all", async () => {
    const result = await markAllRead();

    expect(result).toMatchObject({ success: true });
    expect(post).toHaveBeenCalledOnce();
    const [path] = post.mock.calls[0] as [string, unknown];
    expect(path).toBe("/api/me/notifications/read-all");
  });

  it("does NOT call revalidateEntity", async () => {
    await markAllRead();
    expect(revalidateSpy()).not.toHaveBeenCalled();
  });
});

// ── markAllSeen ───────────────────────────────────────────────────────────────

describe("markAllSeen — happy path", () => {
  it("POSTs to /api/me/notifications/seen-all", async () => {
    const result = await markAllSeen();

    expect(result).toMatchObject({ success: true });
    expect(post).toHaveBeenCalledOnce();
    const [path] = post.mock.calls[0] as [string, unknown];
    expect(path).toBe("/api/me/notifications/seen-all");
  });

  it("does NOT call revalidateEntity", async () => {
    await markAllSeen();
    expect(revalidateSpy()).not.toHaveBeenCalled();
  });
});

// ── subscribeDocument ─────────────────────────────────────────────────────────

describe("subscribeDocument — happy path", () => {
  it("POSTs to /api/documents/{id}/subscribe with correct path param", async () => {
    const result = await subscribeDocument(DOC_ID);

    expect(result).toMatchObject({ success: true });
    expect(post).toHaveBeenCalledOnce();
    const [path, opts] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/documents/{id}/subscribe");
    expect((opts.params as { path: { id: string } }).path.id).toBe(DOC_ID);
  });

  it("does NOT call revalidateEntity", async () => {
    await subscribeDocument(DOC_ID);
    expect(revalidateSpy()).not.toHaveBeenCalled();
  });
});

// ── unsubscribeDocument ───────────────────────────────────────────────────────

describe("unsubscribeDocument — happy path", () => {
  it("DELETEs /api/documents/{id}/subscribe with correct path param", async () => {
    const result = await unsubscribeDocument(DOC_ID);

    expect(result).toMatchObject({ success: true });
    expect(del).toHaveBeenCalledOnce();
    const [path, opts] = del.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/documents/{id}/subscribe");
    expect((opts.params as { path: { id: string } }).path.id).toBe(DOC_ID);
  });

  it("does NOT call revalidateEntity", async () => {
    await unsubscribeDocument(DOC_ID);
    expect(revalidateSpy()).not.toHaveBeenCalled();
  });
});

// ── Error mapping smoke test ──────────────────────────────────────────────────

describe("markRead — backend error mapping smoke test", () => {
  it("maps backend error to { success: false } and does NOT revalidate", async () => {
    post.mockResolvedValue({
      data: undefined,
      error: { code: "NOT_FOUND", error: "Notification not found" },
    });
    const result = await markRead(NOTIF_ID);
    expect(result).toMatchObject({ success: false });
    expect(revalidateSpy()).not.toHaveBeenCalled();
  });
});
