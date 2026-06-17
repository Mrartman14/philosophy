// src/app/_offline/use-offline-sync.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

import { M } from "@/services/observability/core/names";
import { withMemorySink } from "@/test/observability";

// drainOutbox мокаем: тест проверяет ИНСТРУМЕНТАЦИЮ root'а, а не ядро дренажа.
const drainMock = vi.hoisted(() => vi.fn());
vi.mock("@/services/offline/sync/drain", () => ({ drainOutbox: drainMock }));

// queue-depth читается через listOutboxByStatus("pending").
const listMock = vi.hoisted(() => vi.fn((): Promise<unknown[]> => Promise.resolve([])));
vi.mock("@/services/offline/store/outbox", () => ({ listOutboxByStatus: listMock }));

import { startOfflineSync } from "./use-offline-sync";

const { metricsOf } = withMemorySink();

beforeEach(() => {
  drainMock.mockReset();
  listMock.mockReset();
  listMock.mockReturnValue(Promise.resolve([]));
  // По умолчанию: пустой проход + ничего в onOutcome.
  drainMock.mockResolvedValue({ skipped: false, attempted: 0, done: 0, failed: 0, deferred: 0 });
});

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("startOfflineSync метрики", () => {
  it("эмитит increment offlineDrainAttempted с числом attempted за проход", async () => {
    drainMock.mockResolvedValue({ skipped: false, attempted: 3, done: 2, failed: 0, deferred: 1 });
    const stop = startOfflineSync(vi.fn());
    await flush();
    const drain = metricsOf(M.offlineDrainAttempted).find((m) => m.metricKind === "counter");
    expect(drain?.value).toBe(3);
    stop();
  });

  it("инкрементит offlineDrain по бакетам done/deferred/failed", async () => {
    drainMock.mockResolvedValue({ skipped: false, attempted: 4, done: 2, failed: 1, deferred: 1 });
    const stop = startOfflineSync(vi.fn());
    await flush();
    const counters = metricsOf(M.offlineDrain).filter((m) => m.metricKind === "counter");
    const byOutcome = (o: string): number =>
      counters.find((m) => m.attributes.outcome === o)?.value ?? 0;
    expect(byOutcome("done")).toBe(2);
    expect(byOutcome("failed")).toBe(1);
    expect(byOutcome("deferred")).toBe(1);
    stop();
  });

  it("эмитит increment offlineQueueDepth с числом pending после дренажа", async () => {
    listMock.mockReturnValue(Promise.resolve([{ clientId: "a" }, { clientId: "b" }]));
    const stop = startOfflineSync(vi.fn());
    await flush();
    const depth = metricsOf(M.offlineQueueDepth).find((m) => m.metricKind === "counter");
    expect(depth?.value).toBe(2);
    stop();
  });

  it("инкрементит offlineCommandPoison{entity} при пересечении порога attempts", async () => {
    drainMock.mockImplementation(
      (deps: { onOutcome?: (o: unknown) => void }): Promise<unknown> => {
        deps.onOutcome?.({
          kind: "deferred",
          command: { clientId: "c1", entity: "annotations", attempts: 5 },
          attempts: 5,
          error: "offline",
        });
        return Promise.resolve({ skipped: false, attempted: 1, done: 0, failed: 0, deferred: 1 });
      },
    );
    const stop = startOfflineSync(vi.fn());
    await flush();
    const poison = metricsOf(M.offlineCommandPoison);
    expect(poison).toHaveLength(1);
    expect(poison[0]?.attributes.entity).toBe("annotations");
    stop();
  });

  it("НЕ эмитит offlineCommandPoison при attempts ниже порога", async () => {
    drainMock.mockImplementation(
      (deps: { onOutcome?: (o: unknown) => void }): Promise<unknown> => {
        deps.onOutcome?.({
          kind: "deferred",
          command: { clientId: "c1", entity: "annotations", attempts: 1 },
          attempts: 1,
          error: "offline",
        });
        return Promise.resolve({ skipped: false, attempted: 1, done: 0, failed: 0, deferred: 1 });
      },
    );
    const stop = startOfflineSync(vi.fn());
    await flush();
    expect(metricsOf(M.offlineCommandPoison)).toHaveLength(0);
    stop();
  });

  it("дренажит на событие online (регрессия)", async () => {
    const stop = startOfflineSync(vi.fn());
    await flush();
    drainMock.mockClear();
    window.dispatchEvent(new Event("online"));
    expect(drainMock).toHaveBeenCalledTimes(1);
    stop();
  });

  it("после cleanup больше не реагирует на события (регрессия)", () => {
    const stop = startOfflineSync(vi.fn());
    stop();
    drainMock.mockClear();
    window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(drainMock).not.toHaveBeenCalled();
  });
});
