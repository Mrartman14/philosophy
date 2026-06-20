import { beforeEach, describe, expect, it, vi } from "vitest";

// updateDocumentBlocks на 412 делает single-GET свежей версии и возвращает
// conflict-данные (см. spec 2026-06-20-ast-conflict-merge-design.md).
const put = vi.fn();
// vi.hoisted: фабрика vi.mock("./api") хойстится выше const'ов, а статический
// `import { getDocumentById } from "./api"` в actions.ts читает мок эагерно при
// загрузке модуля — обычный const попал бы в TDZ. См. probe-lecture-action.test.
const getDocumentById = vi.hoisted(() => vi.fn());

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ PUT: put }),
}));
vi.mock("./api", () => ({ getDocumentById }));
vi.mock("@/utils/me", () => ({
  getMe: () =>
    Promise.resolve({ id: "u1", status: "active", role: "user", capabilities: [] }),
}));
vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));
vi.mock("@/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n")>();
  return { ...actual, getT: () => Promise.resolve((key: string) => key) };
});

import { updateDocumentBlocks } from "./actions";

const initial = { success: true as const, data: { kind: "saved" as const, document: null } };
const ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function blocksForm(version: string): FormData {
  const fd = new FormData();
  fd.set("id", ID);
  fd.set("blocks", JSON.stringify([{ id: "a", type: "paragraph", text: "mine" }]));
  fd.set("version", version);
  return fd;
}

describe("updateDocumentBlocks — ветка conflict", () => {
  beforeEach(() => {
    put.mockReset();
    getDocumentById.mockReset();
  });

  it("412 → single-GET → kind:conflict со свежими blocks+version", async () => {
    put.mockResolvedValue({
      data: undefined,
      error: { code: "VERSION_MISMATCH", error: "version mismatch" },
    });
    getDocumentById.mockResolvedValue({
      id: ID,
      version: 8,
      blocks: [{ id: "a", type: "paragraph", text: "server" }],
    });

    const result = await updateDocumentBlocks(initial, blocksForm("5"));

    expect(getDocumentById).toHaveBeenCalledWith(ID);
    expect(result).toEqual({
      success: true,
      data: {
        kind: "conflict",
        theirs: {
          blocks: [{ id: "a", type: "paragraph", text: "server" }],
          version: 8,
        },
      },
    });
  });

  it("412, но документ исчез при рефетче → kind:gone", async () => {
    put.mockResolvedValue({
      data: undefined,
      error: { code: "VERSION_MISMATCH", error: "version mismatch" },
    });
    getDocumentById.mockResolvedValue(null);

    const result = await updateDocumentBlocks(initial, blocksForm("5"));
    expect(result).toEqual({ success: true, data: { kind: "gone" } });
  });

  it("успех → kind:saved с документом", async () => {
    put.mockResolvedValue({ data: { data: { id: ID, version: 6 } }, error: undefined });
    const result = await updateDocumentBlocks(initial, blocksForm("5"));
    expect(result).toEqual({
      success: true,
      data: { kind: "saved", document: { id: ID, version: 6 } },
    });
    expect(getDocumentById).not.toHaveBeenCalled();
  });
});
