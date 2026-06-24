import { beforeEach, describe, expect, it, vi } from "vitest";

// createTerm обязан слать title И реальные blocks из формы (один POST),
// а не хардкодить пустой блок. Пустое тело отсекается валидацией до POST.
const post = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ POST: post }),
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

// Мок @/i18n: getT возвращает переводчик-эхо (ключ вместо текста) — фабрики
// схем работают без request-scope next-intl.
vi.mock("@/i18n", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/i18n")>();
  return {
    ...original,
    getT: () => Promise.resolve((key: string) => key),
  };
});

// импорт ПОСЛЕ vi.mock (hoisted)
import { createTerm } from "./actions";

const initial = { success: false as const, error: "" };
const BLOCKS = [{ type: "paragraph", content: [{ type: "text", text: "тело" }] }];

function form(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("title", "Эпистемология");
  fd.set("blocks", JSON.stringify(BLOCKS));
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("createTerm — один POST с title и реальными blocks", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: { data: { id: "t1" } }, error: undefined });
  });

  it("POST /api/admin/glossary с title и blocks из формы", async () => {
    await createTerm(initial, form({ __idempotency_key: "idem-1" }));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      "/api/admin/glossary",
      expect.objectContaining({
        body: { title: "Эпистемология", blocks: BLOCKS },
        headers: { "Idempotency-Key": "idem-1" },
      }),
    );
  });

  it("не шлёт POST при пустом теле (валидация короткозамыкает)", async () => {
    await createTerm(initial, form({ blocks: "[]" }));
    expect(post).not.toHaveBeenCalled();
  });
});
