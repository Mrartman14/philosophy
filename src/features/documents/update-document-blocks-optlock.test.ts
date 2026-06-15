import { beforeEach, describe, expect, it, vi } from "vitest";

// Optimistic lock: updateDocumentBlocks обязан слать If-Match как `"<version>"`
// из hidden-поля формы (версия — body-поле document.version single-GET).
// См. docs/conventions/optimistic-locking.md.
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
import { updateDocumentBlocks } from "./actions";

const initial = { success: false as const, error: "" };
const ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function blocksForm(extra: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("id", ID);
  fd.set("blocks", JSON.stringify([{ id: "", type: "paragraph", content: [] }]));
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("updateDocumentBlocks — optimistic lock (If-Match)", () => {
  beforeEach(() => {
    put.mockReset();
    put.mockResolvedValue({ data: { data: { id: "d1" } }, error: undefined });
  });

  it("шлёт If-Match (версия в кавычках) и сохраняет Idempotency-Key", async () => {
    await updateDocumentBlocks(
      initial,
      blocksForm({ version: "12", __idempotency_key: "idem-12" }),
    );
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(
      "/api/documents/{document_id}/blocks",
      expect.objectContaining({
        params: { path: { document_id: ID }, header: { "If-Match": '"12"' } },
        headers: { "Idempotency-Key": "idem-12" },
      }),
    );
  });

  it("не шлёт PUT, когда версия отсутствует (428-guard короткозамыкает)", async () => {
    await updateDocumentBlocks(initial, blocksForm({}));
    expect(put).not.toHaveBeenCalled();
  });
});
