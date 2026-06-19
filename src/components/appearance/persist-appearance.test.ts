import { describe, it, expect, vi, beforeEach } from "vitest";

import { DEFAULT_APPEARANCE } from "./appearance-cookie";
import { persistAppearance } from "./persist-appearance";

vi.mock("server-only", () => ({}));

const patch = vi.fn();
vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ PATCH: patch }),
}));

const getMe = vi.fn();
vi.mock("@/utils/me", () => ({
  getMe: () => getMe() as unknown,
}));

describe("persistAppearance", () => {
  beforeEach(() => {
    patch.mockReset();
    getMe.mockReset();
  });

  it("maps camelCase→snake_case and PATCHes for authed user", async () => {
    getMe.mockResolvedValue({ id: "u1", status: "active", capabilities: [] });
    patch.mockResolvedValue({ data: {}, error: null });
    await persistAppearance({ ...DEFAULT_APPEARANCE, textSize: "lg" });
    expect(patch).toHaveBeenCalledWith(
      "/api/me/preferences",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      { body: expect.objectContaining({ text_size: "lg" }) },
    );
  });

  it("swallows backend errors (fields not yet in contract)", async () => {
    getMe.mockResolvedValue({ id: "u1", status: "active", capabilities: [] });
    patch.mockResolvedValue({ data: null, error: { code: "BAD_REQUEST" } });
    await expect(persistAppearance(DEFAULT_APPEARANCE)).resolves.toBeUndefined();
  });

  it("no-ops for anonymous", async () => {
    getMe.mockResolvedValue(null);
    await persistAppearance(DEFAULT_APPEARANCE);
    expect(patch).not.toHaveBeenCalled();
  });
});
