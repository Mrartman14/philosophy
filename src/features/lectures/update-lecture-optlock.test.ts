import { beforeEach, describe, expect, it, vi } from "vitest";

// Optimistic lock: updateLecture обязан слать If-Match как `"<version>"`
// (strong-ETag) из hidden-поля формы. Версия НЕ в Zod-схеме — читается из
// FormData напрямую через ifMatchHeader. См.
// docs/conventions/optimistic-locking.md.
const put = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ PUT: put }),
}));
vi.mock("@/utils/me", () => ({
  getMe: () =>
    Promise.resolve({ id: "u1", status: "active", role: "admin", capabilities: ["lecture.update"] }),
}));
vi.mock("./permissions", () => ({
  canUpdateLecture: () => true,
  canCreateLecture: () => true,
  canDeleteLecture: () => true,
  canSetLectureVisibility: () => true,
  canManageCover: () => true,
  canAttachToLecture: () => true,
  canManageAttachments: () => true,
}));
vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));
vi.mock("./api", () => ({
  getLectureById: () =>
    Promise.resolve({
      id: ID,
      title: "Лекция",
      description: "",
      date: "2024-01-01",
      version: 7,
    }),
}));

// импорт ПОСЛЕ vi.mock (hoisted)
import { updateLecture } from "./actions";

const initial = { success: false as const, error: "" };
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function lectureForm(extra: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("id", ID);
  fd.set("title", "Лекция");
  fd.set("description", "Описание");
  fd.set("date", "2024-01-01");
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("updateLecture — optimistic lock (If-Match)", () => {
  beforeEach(() => {
    put.mockReset();
    put.mockResolvedValue({ data: { data: { id: ID } }, error: undefined });
  });

  it("шлёт If-Match (версия в кавычках)", async () => {
    await updateLecture(initial, lectureForm({ version: "7" }));
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(
      "/api/lectures/{id}",
      expect.objectContaining({
        params: { path: { id: ID }, header: { "If-Match": '"7"' } },
      }),
    );
  });

  it("не шлёт PUT без версии (428-guard)", async () => {
    await updateLecture(initial, lectureForm({})); // без version
    expect(put).not.toHaveBeenCalled();
  });
});
