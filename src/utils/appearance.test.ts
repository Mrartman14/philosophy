import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieStore = { get: vi.fn() };
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: () => Promise.resolve(cookieStore) }));

const getMe = vi.fn();
vi.mock("@/utils/me", () => ({ getMe: () => getMe() as unknown }));

const getPreferences = vi.fn();
vi.mock("@/features/preferences", () => ({ getPreferences: () => getPreferences() as unknown }));

import { DEFAULT_APPEARANCE } from "@/components/appearance/appearance-cookie";

import { getAppearance } from "./appearance";

describe("getAppearance", () => {
  beforeEach(() => {
    cookieStore.get.mockReset();
    getMe.mockReset();
    getPreferences.mockReset();
  });

  it("uses the cookie when present and does NOT hit the backend", async () => {
    cookieStore.get.mockReturnValue({ value: JSON.stringify({ ...DEFAULT_APPEARANCE, theme: "dark" }) });
    expect((await getAppearance()).theme).toBe("dark");
    expect(getPreferences).not.toHaveBeenCalled();
  });

  it("seeds from the backend when cookie absent and user is authed (absent contrast → auto)", async () => {
    cookieStore.get.mockReturnValue(undefined);
    getMe.mockResolvedValue({ id: "u1", status: "active", capabilities: [] });
    getPreferences.mockResolvedValue({ appearance: { theme: "dark", density: "compact", font: "serif", text_size: "lg" } });
    const a = await getAppearance();
    expect(a).toEqual({ theme: "dark", contrast: "auto", density: "compact", font: "serif", textSize: "lg", motion: "system" });
  });

  it("defaults for an anonymous user with no cookie (no backend call)", async () => {
    cookieStore.get.mockReturnValue(undefined);
    getMe.mockResolvedValue(null);
    expect(await getAppearance()).toEqual(DEFAULT_APPEARANCE);
    expect(getPreferences).not.toHaveBeenCalled();
  });

  it("falls back to defaults when the backend throws", async () => {
    cookieStore.get.mockReturnValue(undefined);
    getMe.mockResolvedValue({ id: "u1", status: "active", capabilities: [] });
    getPreferences.mockRejectedValue(new Error("503"));
    expect(await getAppearance()).toEqual(DEFAULT_APPEARANCE);
  });
});
