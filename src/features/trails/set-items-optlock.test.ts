import { beforeEach, describe, expect, it, vi } from "vitest";

// Optimistic lock: setTrailItems обязан слать If-Match как `"<version>"`
// (strong-ETag) из hidden-поля формы, а body должен содержать document_ids.
// Без версии — 428-guard короткозамыкает, PUT не вызывается.
const put = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ PUT: put }),
}));
vi.mock("@/utils/me", () => ({
  getMe: () =>
    Promise.resolve({ id: "u1", status: "active", role: "user", capabilities: [] }),
}));
vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

// импорт ПОСЛЕ vi.mock (hoisted)
import { setTrailItems } from "./actions";

const initial = { success: false as const, error: "" };
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DOC1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DOC2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function itemsForm(extra: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("id", ID);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("setTrailItems — optimistic lock (If-Match) + document_ids", () => {
  beforeEach(() => {
    put.mockReset();
    put.mockResolvedValue({ data: { data: { id: ID } }, error: undefined });
  });

  it("шлёт document_ids и If-Match", async () => {
    await setTrailItems(
      initial,
      itemsForm({ version: "3", document_ids: JSON.stringify([DOC1, DOC2]) }),
    );
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(
      "/api/trails/{id}/items",
      expect.objectContaining({
        params: { path: { id: ID }, header: { "If-Match": '"3"' } },
        body: { document_ids: [DOC1, DOC2] },
      }),
    );
  });

  it("не шлёт PUT без версии (428-guard)", async () => {
    await setTrailItems(
      initial,
      itemsForm({ document_ids: JSON.stringify([DOC1]) }),
    );
    expect(put).not.toHaveBeenCalled();
  });
});
