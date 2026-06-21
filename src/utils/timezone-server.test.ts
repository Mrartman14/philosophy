import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: cookieGet }),
}));
const getMe = vi.fn();
vi.mock("@/utils/me", () => ({ getMe: () => getMe() as unknown }));
const getPreferences = vi.fn();
vi.mock("@/features/preferences", () => ({ getPreferences: () => getPreferences() as unknown }));

import { getStoredTzPref, getServerTz } from "./timezone-server";

beforeEach(() => {
  vi.clearAllMocks();
  cookieGet.mockReturnValue(undefined);
  getMe.mockResolvedValue(null);
});

describe("getServerTz", () => {
  it("cookie с конкретной зоной → она же", async () => {
    cookieGet.mockReturnValue({ value: JSON.stringify({ pref: "Asia/Tokyo", resolved: "Asia/Tokyo" }) });
    expect(await getServerTz()).toBe("Asia/Tokyo");
  });

  it("cookie system + resolved → resolved", async () => {
    cookieGet.mockReturnValue({ value: JSON.stringify({ pref: "system", resolved: "America/New_York" }) });
    expect(await getServerTz()).toBe("America/New_York");
  });

  it("нет cookie, гость → фолбэк Europe/Moscow", async () => {
    expect(await getServerTz()).toBe("Europe/Moscow");
  });

  it("нет cookie, авторизован, бэк отдал зону → она", async () => {
    getMe.mockResolvedValue({ id: "u1" });
    getPreferences.mockResolvedValue({ timezone: "Europe/Berlin" });
    expect(await getServerTz()).toBe("Europe/Berlin");
  });

  it("нет cookie, авторизован, бэк отдал system → фолбэк", async () => {
    getMe.mockResolvedValue({ id: "u1" });
    getPreferences.mockResolvedValue({ timezone: "system" });
    expect(await getServerTz()).toBe("Europe/Moscow");
  });
});

describe("getStoredTzPref", () => {
  it("нет cookie, бэк отдал зону → зона", async () => {
    getMe.mockResolvedValue({ id: "u1" });
    getPreferences.mockResolvedValue({ timezone: "Europe/Berlin" });
    expect(await getStoredTzPref()).toBe("Europe/Berlin");
  });

  it("бэк упал → DEFAULT_TZ_PREF (system)", async () => {
    getMe.mockResolvedValue({ id: "u1" });
    getPreferences.mockRejectedValue(new Error("boom"));
    expect(await getStoredTzPref()).toBe("system");
  });
});
