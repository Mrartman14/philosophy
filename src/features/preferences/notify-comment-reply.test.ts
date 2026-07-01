/**
 * Тесты setNotifyOnCommentReply (preferences/actions.ts).
 * Патчит /api/me/preferences ТОЛЬКО полем notify_on_comment_reply (partial-patch).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as revalidateModule from "@/utils/revalidate";

const patch = vi.fn();
vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ PATCH: patch }),
}));

const getMeImpl = vi.fn();
vi.mock("@/utils/me", () => ({ getMe: () => getMeImpl() as unknown }));

vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

// Импорт ПОСЛЕ vi.mock (hoisting)
import { setNotifyOnCommentReply } from "./actions";

function activeMe() {
  return {
    id: "u-1",
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
  patch.mockReset();
  getMeImpl.mockReset();
  revalidateSpy().mockReset();
  getMeImpl.mockResolvedValue(activeMe());
  patch.mockResolvedValue({ data: { data: {} }, error: undefined });
});

describe("setNotifyOnCommentReply — happy path", () => {
  it("PATCHes /api/me/preferences с { notify_on_comment_reply: true }", async () => {
    const result = await setNotifyOnCommentReply(true);

    expect(result).toMatchObject({ success: true });
    expect(patch).toHaveBeenCalledOnce();
    const [path, opts] = patch.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/me/preferences");
    expect(opts.body).toEqual({ notify_on_comment_reply: true });
    expect(revalidateSpy()).toHaveBeenCalledOnce();
  });

  it("передаёт false без примеси других полей (partial-patch)", async () => {
    await setNotifyOnCommentReply(false);
    const [, opts] = patch.mock.calls[0] as [string, Record<string, unknown>];
    expect(opts.body).toEqual({ notify_on_comment_reply: false });
  });
});

describe("setNotifyOnCommentReply — backend error mapping", () => {
  it("маппит ошибку бэка в { success: false } и НЕ ревалидирует", async () => {
    patch.mockResolvedValue({
      data: undefined,
      error: { code: "SUSPENDED", error: "suspended" },
    });
    const result = await setNotifyOnCommentReply(true);
    expect(result).toMatchObject({ success: false });
    expect(revalidateSpy()).not.toHaveBeenCalled();
  });
});
