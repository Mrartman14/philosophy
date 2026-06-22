import { beforeEach, describe, expect, it, vi } from "vitest";

// Optimistic lock: updateEvent обязан слать If-Match как `"<version>"`
// (strong-ETag) из hidden-поля формы — версия body-поле `event.version`
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
  canCreateEvent: () => true,
  canUpdateEvent: () => true,
  canDeleteEvent: () => true,
}));
vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));
// getServerTz зовёт cookies() (next/headers) — вне request scope падает; в action
// нужна только зона для нормализации wall-clock. all_day-ветка её всё равно не
// использует, поэтому фиксированный UTC-стаб достаточен.
vi.mock("@/utils/timezone-server", () => ({
  getServerTz: () => Promise.resolve("UTC"),
}));
// getT("validation") используется в action для сборки схемы; в тестах возвращаем
// identity-stub (ключ → ключ), что достаточно для проверки поведения.
// resolveErrorMessage подхватывает реальную реализацию (деградирует к DEFAULT_LOCALE).
vi.mock("@/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n")>();
  return {
    ...actual,
    getT: () => Promise.resolve((key: string) => key),
  };
});

// импорт ПОСЛЕ vi.mock (hoisted)
import { updateEvent } from "./actions";

const initial = { success: false as const, error: "" };
const ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function eventForm(extra: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("id", ID);
  fd.set("title", "Лекция");
  fd.set("start_date", "2026-07-01");
  fd.set("all_day", "true");
  fd.set("blocks", JSON.stringify([{ id: "", type: "paragraph", content: [] }]));
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("updateEvent — optimistic lock (If-Match)", () => {
  beforeEach(() => {
    put.mockReset();
    put.mockResolvedValue({ data: { data: { id: "e1" } }, error: undefined });
  });

  it("шлёт If-Match (версия в кавычках) и сохраняет Idempotency-Key", async () => {
    await updateEvent(
      initial,
      eventForm({ version: "9", __idempotency_key: "idem-9" }),
    );
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(
      "/api/admin/events/{id}",
      expect.objectContaining({
        params: { path: { id: ID }, header: { "If-Match": '"9"' } },
        headers: { "Idempotency-Key": "idem-9" },
      }),
    );
  });

  it("не шлёт PUT, когда версия отсутствует (428-guard короткозамыкает)", async () => {
    await updateEvent(initial, eventForm({}));
    expect(put).not.toHaveBeenCalled();
  });

  it("412 VERSION_MISMATCH → понятное сообщение", async () => {
    put.mockResolvedValue({
      data: undefined,
      error: { code: "VERSION_MISMATCH", error: "version mismatch" },
    });
    const result = await updateEvent(initial, eventForm({ version: "9" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        "Объект изменён в другом месте. Обновите страницу и повторите.",
      );
    }
  });
});
