// src/app/_offline/use-offline-sync.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

// vi.hoisted — мок разыменовывается сразу в фабрике vi.mock (TDZ-фикс, см.
// save-offline.test.ts).
const drainMock = vi.hoisted(() =>
  vi.fn(() =>
    Promise.resolve({
      skipped: false,
      attempted: 0,
      done: 0,
      failed: 0,
      deferred: 0,
    }),
  ),
);
vi.mock("@/services/offline/sync/drain", () => ({ drainOutbox: drainMock }));

import { startOfflineSync } from "./use-offline-sync";

beforeEach(() => {
  drainMock.mockClear();
});

describe("startOfflineSync", () => {
  it("дренажит при старте", () => {
    const stop = startOfflineSync();
    expect(drainMock).toHaveBeenCalledTimes(1);
    stop();
  });

  it("дренажит на событие online", () => {
    const stop = startOfflineSync();
    drainMock.mockClear();
    window.dispatchEvent(new Event("online"));
    expect(drainMock).toHaveBeenCalledTimes(1);
    stop();
  });

  it("дренажит на visibilitychange когда документ видим", () => {
    const stop = startOfflineSync();
    drainMock.mockClear();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(drainMock).toHaveBeenCalledTimes(1); // jsdom: visibilityState='visible'
    stop();
  });

  it("после cleanup больше не реагирует на события", () => {
    const stop = startOfflineSync();
    stop();
    drainMock.mockClear();
    window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(drainMock).not.toHaveBeenCalled();
  });
});
