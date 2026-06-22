import { describe, it, expect, vi, beforeEach } from "vitest";

const post = vi.fn();
vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ POST: post }),
}));
// getMe не нужен (optional-auth, без requireCapability), но createApiClient мокнут целиком.
vi.mock("@/i18n", async (orig) => {
  const o = await orig<typeof import("@/i18n")>();
  return { ...o, resolveErrorMessage: (k: string) => Promise.resolve(k) };
});

import { getMapPointDetails } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getMapPointDetails", () => {
  it("200 + карта деталей → success с Record", async () => {
    post.mockResolvedValue({
      data: { data: { "pt-A": { doc: "doc-1", chunk_ord: 3, snippet: "hi" } }, error: undefined },
      error: undefined,
    });
    const res = await getMapPointDetails(["pt-A"]);
    expect(res).toEqual({
      success: true,
      data: { "pt-A": { doc: "doc-1", chunk_ord: 3, snippet: "hi" } },
    });
    expect(post).toHaveBeenCalledWith("/api/map/points", { body: { ids: ["pt-A"] } });
  });

  it("неизвестный id просто отсутствует в карте", async () => {
    post.mockResolvedValue({ data: { data: {} }, error: undefined });
    const res = await getMapPointDetails(["nope"]);
    expect(res).toEqual({ success: true, data: {} });
  });

  it("пустой data → {}", async () => {
    post.mockResolvedValue({ data: {}, error: undefined });
    const res = await getMapPointDetails(["pt-A"]);
    expect(res).toEqual({ success: true, data: {} });
  });

  it("413 REQUEST_BODY_TOO_LARGE → success:false", async () => {
    post.mockResolvedValue({ data: undefined, error: { code: "REQUEST_BODY_TOO_LARGE" } });
    const res = await getMapPointDetails(["pt-A"]);
    expect(res.success).toBe(false);
  });

  it("422 с code+fields → success:false, validation-канал с fieldErrors", async () => {
    // code обязателен: ветка fields→ZodValidationError в rethrowApiError живёт
    // внутри `if (code)`; без code упали бы в serverError-фолбэк (не validation).
    post.mockResolvedValue({
      data: undefined,
      error: { code: "VALIDATION_ERROR", fields: { ids: "too many" } },
    });
    const res = await getMapPointDetails(["pt-A"]);
    expect(res).toMatchObject({
      success: false,
      code: "validation",
      fieldErrors: { ids: "too many" },
    });
  });
});
