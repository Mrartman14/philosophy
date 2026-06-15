import { beforeEach, describe, expect, it, vi } from "vitest";

import { COMMENT_TYPES } from "@/api/enums";

const post = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ POST: post }),
}));
vi.mock("@/utils/me", () => ({
  getMe: () =>
    Promise.resolve({ id: "u1", status: "active", role: "user", capabilities: [] }),
}));
vi.mock("./permissions", () => ({
  canCreateComment: () => true,
  canModerateComments: () => true,
}));
vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

// импорт ПОСЛЕ vi.mock (hoisted)
import { createComment } from "./actions";

const initial = { success: false as const, error: "" };

function commentForm(extra: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("lecture_id", "lec-1");
  fd.set("type", COMMENT_TYPES[0]);
  fd.set("blocks", JSON.stringify(["x"]));
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("createComment idempotency wiring", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: { data: { id: "c1" } }, error: undefined });
  });

  it("forwards Idempotency-Key header from the hidden field", async () => {
    await createComment(initial, commentForm({ __idempotency_key: "key-123" }));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ headers: { "Idempotency-Key": "key-123" } }),
    );
  });

  it("sends no idempotency header when the field is absent", async () => {
    await createComment(initial, commentForm({}));
    expect(post).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ headers: {} }),
    );
  });
});
