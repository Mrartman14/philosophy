import { beforeEach, describe, expect, it, vi } from "vitest";

import { persistLocale } from "./persist-locale";

vi.mock("server-only", () => ({}));

const patch = vi.fn();
vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ PATCH: patch }),
}));

const getMe = vi.fn();
vi.mock("@/utils/me", () => ({
  getMe: () => getMe() as unknown,
}));

describe("persistLocale", () => {
  beforeEach(() => {
    patch.mockReset();
    getMe.mockReset();
  });

  it("PATCHes preferences с locale для залогиненного", async () => {
    getMe.mockResolvedValue({ id: "u1", status: "active", capabilities: [] });
    patch.mockResolvedValue({ data: {}, error: null });
    await persistLocale("en");
    expect(patch).toHaveBeenCalledWith(
      "/api/me/preferences",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      { body: expect.objectContaining({ locale: "en" }) },
    );
  });

  it("no-op для анонима", async () => {
    getMe.mockResolvedValue(null);
    await persistLocale("ru");
    expect(patch).not.toHaveBeenCalled();
  });

  it("глотает ошибки бэка (поле ещё не в контракте)", async () => {
    getMe.mockResolvedValue({ id: "u1", status: "active", capabilities: [] });
    patch.mockRejectedValue(new Error("backend 500"));
    await expect(persistLocale("en")).resolves.toBeUndefined();
  });

  it("глотает падение getMe (5xx)", async () => {
    getMe.mockRejectedValue(new Error("503"));
    await expect(persistLocale("ru")).resolves.toBeUndefined();
    expect(patch).not.toHaveBeenCalled();
  });
});
