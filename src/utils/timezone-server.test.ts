import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: cookieGet }),
}));
const getMe = vi.fn();
vi.mock("@/utils/me", () => ({ getMe: () => getMe() as unknown }));

// timezone-server берёт бэкенд-настройки напрямую через openapi-клиент
// (а НЕ через @/features/preferences) — иначе возникает цикл импорта
// @/i18n → timezone-server → preferences/api → @/i18n. Поэтому мок —
// на createApiClient().GET("/api/me/preferences").
const apiGet = vi.fn();
vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ GET: () => apiGet() as unknown }),
}));

/** Хелпер: эмулировать ответ бэка на /api/me/preferences (или его падение). */
const mockPrefs = (timezone: string) => apiGet.mockResolvedValue({ data: { data: { timezone } } });

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
    mockPrefs("Europe/Berlin");
    expect(await getServerTz()).toBe("Europe/Berlin");
  });

  it("нет cookie, авторизован, бэк отдал system → фолбэк", async () => {
    getMe.mockResolvedValue({ id: "u1" });
    mockPrefs("system");
    expect(await getServerTz()).toBe("Europe/Moscow");
  });
});

describe("getStoredTzPref", () => {
  it("нет cookie, бэк отдал зону → зона", async () => {
    getMe.mockResolvedValue({ id: "u1" });
    mockPrefs("Europe/Berlin");
    expect(await getStoredTzPref()).toBe("Europe/Berlin");
  });

  it("бэк упал → DEFAULT_TZ_PREF (system)", async () => {
    getMe.mockResolvedValue({ id: "u1" });
    apiGet.mockRejectedValue(new Error("boom"));
    expect(await getStoredTzPref()).toBe("system");
  });
});
