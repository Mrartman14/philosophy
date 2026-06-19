import { beforeEach, describe, expect, it, vi } from "vitest";

// Optimistic lock: updateTermBlocks обязан слать If-Match как `"<version>"`
// из hidden-поля формы (версия — body-поле term.version single-GET).
// См. docs/conventions/optimistic-locking.md.
const put = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ PUT: put }),
}));
vi.mock("@/utils/me", () => ({
  getMe: () =>
    Promise.resolve({ id: "u1", status: "active", role: "admin", capabilities: [] }),
}));
vi.mock("./permissions", () => ({
  canCreateTerm: () => true,
  canUpdateTerm: () => true,
  canDeleteTerm: () => true,
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
import { updateTermBlocks } from "./actions";

const initial = { success: false as const, error: "" };
const ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function blocksForm(extra: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("id", ID);
  fd.set("blocks", JSON.stringify([{ id: "", type: "paragraph", content: [] }]));
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("updateTermBlocks — optimistic lock (If-Match)", () => {
  beforeEach(() => {
    put.mockReset();
    put.mockResolvedValue({ data: { data: { id: "t1" } }, error: undefined });
  });

  it("шлёт If-Match (версия в кавычках) и сохраняет Idempotency-Key", async () => {
    await updateTermBlocks(
      initial,
      blocksForm({ version: "3", __idempotency_key: "idem-3" }),
    );
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(
      "/api/admin/glossary/{id}/blocks",
      expect.objectContaining({
        params: { path: { id: ID }, header: { "If-Match": '"3"' } },
        headers: { "Idempotency-Key": "idem-3" },
      }),
    );
  });

  it("не шлёт PUT, когда версия отсутствует (428-guard короткозамыкает)", async () => {
    await updateTermBlocks(initial, blocksForm({}));
    expect(put).not.toHaveBeenCalled();
  });
});
