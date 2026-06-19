import { beforeEach, describe, expect, it, vi } from "vitest";

// Optimistic lock: updateAnnotation обязан слать If-Match как `"<version>"`
// (strong-ETag) из hidden-поля формы — версия приходит body-полем
// `annotation.version` (тело single-GET). См.
// docs/conventions/optimistic-locking.md.
const put = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ PUT: put }),
}));
vi.mock("@/utils/me", () => ({
  getMe: () =>
    Promise.resolve({ id: "u1", status: "active", role: "user", capabilities: [] }),
}));
// Мок @/i18n: getT возвращает переводчик, возвращающий ключ вместо текста.
// Позволяет схемам-фабрикам и getT("annotations") работать без request-scope next-intl.
vi.mock("@/i18n", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/i18n")>();
  return { ...orig, getT: () => Promise.resolve((key: string) => key) };
});
// getAnnotationById (defense-in-depth ownership) → возвращаем свою аннотацию.
vi.mock("./api", () => ({
  getAnnotationById: () => Promise.resolve({ id: "a1", owner_id: "u1" }),
}));
vi.mock("./permissions", () => ({
  canCreateAnnotation: () => true,
  canEditAnnotation: () => true,
  canDeleteAnnotation: () => true,
  canAdminDeleteAnnotation: () => true,
}));
vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

// импорт ПОСЛЕ vi.mock (hoisted)
import { updateAnnotation } from "./actions";

const initial = { success: false as const, error: "" };
const ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function blocksForm(extra: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("id", ID);
  fd.set("blocks", JSON.stringify([{ id: "", type: "paragraph", content: [] }]));
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("updateAnnotation — optimistic lock (If-Match)", () => {
  beforeEach(() => {
    put.mockReset();
    put.mockResolvedValue({ data: { data: { id: "a1" } }, error: undefined });
  });

  it("шлёт If-Match (версия в кавычках) и сохраняет Idempotency-Key", async () => {
    await updateAnnotation(
      initial,
      blocksForm({ version: "5", __idempotency_key: "idem-5" }),
    );
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(
      "/api/annotations/{id}",
      expect.objectContaining({
        params: { path: { id: ID }, header: { "If-Match": '"5"' } },
        headers: { "Idempotency-Key": "idem-5" },
      }),
    );
  });

  it("не шлёт PUT, когда версия отсутствует (428-guard короткозамыкает)", async () => {
    await updateAnnotation(initial, blocksForm({}));
    expect(put).not.toHaveBeenCalled();
  });

  it("412 VERSION_MISMATCH → понятное сообщение", async () => {
    put.mockResolvedValue({
      data: undefined,
      error: { code: "VERSION_MISMATCH", error: "version mismatch" },
    });
    const result = await updateAnnotation(initial, blocksForm({ version: "5" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        "Объект изменён в другом месте. Обновите страницу и повторите.",
      );
    }
  });
});
