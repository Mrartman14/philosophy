import { beforeEach, describe, expect, it, vi } from "vitest";

// Optimistic lock: updateBanner обязан слать If-Match как `"<version>"`
// (strong-ETag) из hidden-поля формы — версия body-поле `banner.version`
// (тело single-GET). См. docs/conventions/optimistic-locking.md.
const put = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ PUT: put }),
}));
vi.mock("@/utils/me", () => ({
  getMe: () =>
    Promise.resolve({ id: "u1", status: "active", role: "admin", capabilities: [] }),
}));
vi.mock("./permissions", () => ({
  canCreateBanner: () => true,
  canUpdateBanner: () => true,
  canDeleteBanner: () => true,
  canDismissBanner: () => true,
}));
vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

// импорт ПОСЛЕ vi.mock (hoisted)
import { updateBanner } from "./actions";

const initial = { success: false as const, error: "" };
const ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function bannerForm(extra: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("id", ID);
  fd.set("background_color", "#ffffff");
  fd.set("target_audience", "all");
  fd.set("dismissible", "true");
  fd.set("start_at", "2026-07-01T00:00");
  fd.set("event_id", "");
  fd.set("blocks", JSON.stringify([{ id: "", type: "paragraph", content: [] }]));
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("updateBanner — optimistic lock (If-Match)", () => {
  beforeEach(() => {
    put.mockReset();
    put.mockResolvedValue({ data: { data: { id: "b1" } }, error: undefined });
  });

  it("шлёт If-Match (версия в кавычках) и сохраняет Idempotency-Key", async () => {
    await updateBanner(
      initial,
      bannerForm({ version: "4", __idempotency_key: "idem-4" }),
    );
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(
      "/api/admin/banners/{id}",
      expect.objectContaining({
        params: { path: { id: ID }, header: { "If-Match": '"4"' } },
        headers: { "Idempotency-Key": "idem-4" },
      }),
    );
  });

  it("не шлёт PUT, когда версия отсутствует (428-guard короткозамыкает)", async () => {
    await updateBanner(initial, bannerForm({}));
    expect(put).not.toHaveBeenCalled();
  });

  it("412 VERSION_MISMATCH → понятное сообщение", async () => {
    put.mockResolvedValue({
      data: undefined,
      error: { code: "VERSION_MISMATCH", error: "version mismatch" },
    });
    const result = await updateBanner(initial, bannerForm({ version: "4" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        "Объект изменён в другом месте. Обновите страницу и повторите.",
      );
    }
  });
});
