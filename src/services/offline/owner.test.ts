import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./wipe", () => ({ wipeOfflineData: vi.fn() }));

import {
  reconcileOfflineOwner,
  getOfflineOwner,
  OFFLINE_OWNER_KEY,
} from "./owner";
import { wipeOfflineData } from "./wipe";

beforeEach(() => {
  vi.mocked(wipeOfflineData).mockReset().mockResolvedValue();
  localStorage.clear();
});

describe("reconcileOfflineOwner", () => {
  it("гость (null) → не трогает кеш и маркер (владелец может вернуться)", async () => {
    localStorage.setItem(OFFLINE_OWNER_KEY, "alice");
    await reconcileOfflineOwner(null);
    expect(wipeOfflineData).not.toHaveBeenCalled();
    expect(getOfflineOwner()).toBe("alice");
  });

  it("тот же владелец → не трогает кеш (библиотека переживает повторный вход)", async () => {
    localStorage.setItem(OFFLINE_OWNER_KEY, "alice");
    await reconcileOfflineOwner("alice");
    expect(wipeOfflineData).not.toHaveBeenCalled();
    expect(getOfflineOwner()).toBe("alice");
  });

  it("другой пользователь → чистит кеш и переустанавливает владельца", async () => {
    localStorage.setItem(OFFLINE_OWNER_KEY, "alice");
    await reconcileOfflineOwner("bob");
    expect(wipeOfflineData).toHaveBeenCalledOnce();
    expect(getOfflineOwner()).toBe("bob");
  });

  it("нет маркера + есть пользователь → чистит (миграция) и ставит владельца", async () => {
    expect(getOfflineOwner()).toBeNull();
    await reconcileOfflineOwner("alice");
    expect(wipeOfflineData).toHaveBeenCalledOnce();
    expect(getOfflineOwner()).toBe("alice");
  });
});
