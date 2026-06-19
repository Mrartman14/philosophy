import { beforeEach, describe, expect, it, vi } from "vitest";

// Optimistic lock: updateCommentBlocks обязан слать If-Match как `"<version>"`
// (strong-ETag) из hidden-поля формы — у комментария нет single-GET, версия
// приходит body-полем `comment.version` узла дерева. См.
// docs/conventions/optimistic-locking.md.
const put = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ PUT: put }),
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

// Мок @/i18n: getT возвращает переводчик, возвращающий ключ вместо текста.
// Позволяет схемам-фабрикам работать без request-scope next-intl.
vi.mock("@/i18n", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/i18n")>();
  return {
    ...original,
    getT: () => Promise.resolve((key: string) => key),
  };
});

// импорт ПОСЛЕ vi.mock (hoisted)
import { updateCommentBlocks } from "./actions";

const initial = { success: false as const, error: "" };
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function blocksForm(extra: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("id", ID);
  fd.set("blocks", JSON.stringify([{ id: "", type: "paragraph", content: [] }]));
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("updateCommentBlocks — optimistic lock (If-Match)", () => {
  beforeEach(() => {
    put.mockReset();
    put.mockResolvedValue({ data: { data: { id: "c1" } }, error: undefined });
  });

  it("шлёт If-Match (версия в кавычках) и сохраняет Idempotency-Key", async () => {
    await updateCommentBlocks(
      initial,
      blocksForm({ version: "7", __idempotency_key: "idem-7" }),
    );
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(
      "/api/comments/{id}/blocks",
      expect.objectContaining({
        params: { path: { id: ID }, header: { "If-Match": '"7"' } },
        headers: { "Idempotency-Key": "idem-7" },
      }),
    );
  });

  it("не шлёт PUT, когда версия отсутствует (428-guard короткозамыкает)", async () => {
    await updateCommentBlocks(initial, blocksForm({}));
    expect(put).not.toHaveBeenCalled();
  });
});
