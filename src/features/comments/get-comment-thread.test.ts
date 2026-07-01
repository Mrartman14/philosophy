// Тесты getCommentThread (comments/api.ts) — GET /api/comments/{id}/thread для
// deep-link из инбокса. Мягкая деградация к null (404 невидимой лекции / ошибка /
// reject): страница лекции покажет обычную ленту без подмешивания.
import { describe, expect, it, vi } from "vitest";

const get = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ GET: get }),
}));

vi.mock("@/i18n", () => ({
  getT: () => Promise.resolve((key: string) => key),
}));

// Import AFTER vi.mock (hoisting).
import { getCommentThread } from "./api";

describe("getCommentThread", () => {
  it("возвращает RootSubtree корневого треда узла", async () => {
    get.mockResolvedValue({
      data: {
        data: {
          root: { id: "root-1", lecture_id: "lec-1" },
          descendants: [{ id: "cmt-9" }],
        },
      },
      error: undefined,
    });

    const result = await getCommentThread("cmt-9");

    expect(result).toMatchObject({ root: { id: "root-1", lecture_id: "lec-1" } });
    const [route, init] = get.mock.calls.at(-1) as [
      string,
      { params: { path: Record<string, unknown> } },
    ];
    expect(route).toBe("/api/comments/{id}/thread");
    expect(init.params.path).toMatchObject({ id: "cmt-9" });
  });

  it("null при ошибке (мягкая деградация — покажем обычную ленту)", async () => {
    get.mockResolvedValue({ data: undefined, error: { error: "not found" } });

    expect(await getCommentThread("cmt-gone")).toBeNull();
  });

  it("null при reject (сетевой сбой)", async () => {
    get.mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await getCommentThread("cmt-x")).toBeNull();
  });
});
