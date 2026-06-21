import { describe, it, expect, vi, beforeEach } from "vitest";

const patch = vi.fn();
vi.mock("@/api/client", () => ({ createApiClient: () => Promise.resolve({ PATCH: patch }) }));
const getMe = vi.fn();
vi.mock("@/utils/me", () => ({ getMe: () => getMe() as unknown }));

import { persistTimezone } from "./persist-timezone";

beforeEach(() => {
  vi.clearAllMocks();
  patch.mockResolvedValue({ data: {}, error: undefined });
});

describe("persistTimezone", () => {
  it("аноним → PATCH не вызывается", async () => {
    getMe.mockResolvedValue(null);
    await persistTimezone("Europe/Moscow");
    expect(patch).not.toHaveBeenCalled();
  });

  it("залогинен → PATCH с timezone", async () => {
    getMe.mockResolvedValue({ id: "u1" });
    await persistTimezone("Asia/Tokyo");
    expect(patch).toHaveBeenCalledWith("/api/me/preferences", { body: { timezone: "Asia/Tokyo" } });
  });

  it("ошибка бэка не пробрасывается (graceful)", async () => {
    getMe.mockResolvedValue({ id: "u1" });
    patch.mockRejectedValue(new Error("boom"));
    await expect(persistTimezone("system")).resolves.toBeUndefined();
  });
});
