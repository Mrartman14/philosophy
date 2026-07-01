/**
 * Тесты resolveCommentReplyHref (notifications/actions.ts) — резолв deep-link к
 * ответу ПО КЛИКУ: GET /api/comments/{id} → /lectures/{lecture_id}#comment-{id}.
 * Мягкая деградация → null; гость → forbidden.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ GET: get }),
}));

const getMeImpl = vi.fn();
vi.mock("@/utils/me", () => ({ getMe: () => getMeImpl() as unknown }));

// Импорт ПОСЛЕ vi.mock (hoisting)
import { resolveCommentReplyHref } from "./actions";

function activeMe() {
  return {
    id: "u-1",
    username: "active",
    role: "user" as const,
    status: "active" as const,
    capabilities: [] as string[],
  };
}

beforeEach(() => {
  get.mockReset();
  getMeImpl.mockReset();
  getMeImpl.mockResolvedValue(activeMe());
});

describe("resolveCommentReplyHref", () => {
  it("строит /lectures/{lecture_id}#comment-{id} из GET /api/comments/{id}", async () => {
    get.mockResolvedValue({
      data: { data: { id: "cmt-9", lecture_id: "lec-42" } },
      error: undefined,
    });

    const result = await resolveCommentReplyHref("cmt-9");

    expect(result).toMatchObject({ success: true, data: "/lectures/lec-42?comment=cmt-9#comment-cmt-9" });
    const [path, opts] = get.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe("/api/comments/{id}");
    expect((opts.params as { path: { id: string } }).path.id).toBe("cmt-9");
  });

  it("null при ошибке GET (мягкая деградация — переход не делаем)", async () => {
    get.mockResolvedValue({ data: undefined, error: { error: "not found" } });

    const result = await resolveCommentReplyHref("cmt-gone");

    expect(result).toMatchObject({ success: true, data: null });
  });

  it("null, если у коммента нет lecture_id", async () => {
    get.mockResolvedValue({ data: { data: { id: "cmt-9" } }, error: undefined });

    const result = await resolveCommentReplyHref("cmt-9");

    expect(result).toMatchObject({ success: true, data: null });
  });

  it("forbidden для гостя (canUseNotifications=false) — GET не дергается", async () => {
    getMeImpl.mockResolvedValue(null);

    const result = await resolveCommentReplyHref("cmt-9");

    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(get).not.toHaveBeenCalled();
  });
});
