import { beforeEach, describe, expect, it, vi } from "vitest";

const put = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ PUT: put }),
}));
vi.mock("@/utils/me", () => ({
  getMe: () =>
    Promise.resolve({ id: "u1", status: "active", role: "user", capabilities: [] }),
}));
vi.mock("./permissions", () => ({ canManageTokens: () => true }));
vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

// импорт ПОСЛЕ vi.mock (hoisted)
import { setUsageTracking } from "./actions";

describe("setUsageTracking", () => {
  beforeEach(() => {
    put.mockReset();
    put.mockResolvedValue({ data: { data: { tracking_enabled: true } }, error: undefined });
  });

  it("шлёт PUT с { enabled: true } при включении", async () => {
    const result = await setUsageTracking(true);
    expect(result.success).toBe(true);
    expect(put).toHaveBeenCalledWith("/api/me/tokens/usage-tracking", {
      body: { enabled: true },
    });
  });

  it("шлёт PUT с { enabled: false } при выключении (purge)", async () => {
    const result = await setUsageTracking(false);
    expect(result.success).toBe(true);
    expect(put).toHaveBeenCalledWith("/api/me/tokens/usage-tracking", {
      body: { enabled: false },
    });
  });
});
