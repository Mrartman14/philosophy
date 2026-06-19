/**
 * Happy-path tests for subscribeLecture / unsubscribeLecture в notifications/actions.ts.
 *
 * Инвариант: action-ы НЕ вызывают revalidateEntity (состояние оптимистично на клиенте).
 *
 * Coverage:
 *   subscribeLecture   → POST /api/lectures/{id}/subscribe, no revalidate
 *   unsubscribeLecture → DELETE /api/lectures/{id}/subscribe, no revalidate
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

// Мок ./api чтобы read-actions не делали сетевых вызовов
vi.mock("./api", () => ({
  getNotificationCounts: vi.fn(),
  getNotifications: vi.fn(),
}));

// Ключевой spy — действия на подписку НЕ должны вызывать revalidateEntity.
vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
}));

// Импорты ПОСЛЕ vi.mock (hoisting)
import { subscribeLecture, unsubscribeLecture } from "./actions";

// ── Константы ─────────────────────────────────────────────────────────────────
const LECTURE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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

// ── subscribeLecture ──────────────────────────────────────────────────────────

describe("subscribeLecture — happy path", () => {
  it("POSTs to /api/lectures/{id}/subscribe с корректным path param", async () => {
    const result = await subscribeLecture(LECTURE_ID);

    expect(result).toMatchObject({ success: true });
    expect(post).toHaveBeenCalledOnce();
    const [path, opts] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/lectures/{id}/subscribe");
    expect((opts.params as { path: { id: string } }).path.id).toBe(LECTURE_ID);
  });

  it("NOT вызывает revalidateEntity", async () => {
    await subscribeLecture(LECTURE_ID);
    expect(revalidateSpy()).not.toHaveBeenCalled();
  });
});

// ── unsubscribeLecture ────────────────────────────────────────────────────────

describe("unsubscribeLecture — happy path", () => {
  it("DELETEs /api/lectures/{id}/subscribe с корректным path param", async () => {
    const result = await unsubscribeLecture(LECTURE_ID);

    expect(result).toMatchObject({ success: true });
    expect(del).toHaveBeenCalledOnce();
    const [path, opts] = del.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/lectures/{id}/subscribe");
    expect((opts.params as { path: { id: string } }).path.id).toBe(LECTURE_ID);
  });

  it("NOT вызывает revalidateEntity", async () => {
    await unsubscribeLecture(LECTURE_ID);
    expect(revalidateSpy()).not.toHaveBeenCalled();
  });
});

// ── Error mapping smoke test ──────────────────────────────────────────────────

describe("subscribeLecture — backend error mapping smoke test", () => {
  it("маппит ошибку бэка в { success: false } и НЕ вызывает revalidate", async () => {
    post.mockResolvedValue({
      data: undefined,
      error: { code: "NOT_FOUND", error: "Lecture not found" },
    });
    const result = await subscribeLecture(LECTURE_ID);
    expect(result).toMatchObject({ success: false });
    expect(revalidateSpy()).not.toHaveBeenCalled();
  });
});
