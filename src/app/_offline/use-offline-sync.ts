// src/app/_offline/use-offline-sync.ts
"use client";

import { useEffect } from "react";

import { metrics, M } from "@/services/observability/client";
import { listOutboxByStatus } from "@/services/offline/store/outbox";
import { drainOutbox } from "@/services/offline/sync/drain";
import type { DrainOutcome , SyncTransport } from "@/services/offline/sync/transport";

import { offlineTransport } from "./transport";

// Порог «ядовитой» команды: столько раз её отложили/завалили — она встала
// головой очереди (head-of-line) и тянет дренаж вниз. Сигнал для алертинга.
const POISON_ATTEMPTS = 4;

// Per-command хук: пересечение порога attempts → инкремент poison{entity}.
function onDrainOutcome(outcome: DrainOutcome): void {
  if (outcome.kind === "done") return;
  if (outcome.attempts >= POISON_ATTEMPTS) {
    metrics.increment(M.offlineCommandPoison, { entity: outcome.command.entity });
  }
}

async function drainAndReport(send: SyncTransport): Promise<void> {
  const result = await drainOutbox({ send, onOutcome: onDrainOutcome });
  if (result.skipped) return; // дренаж уже шёл — чужой проход отметит метрики
  metrics.histogram(M.offlineDrain, result.attempted);
  metrics.increment(M.offlineDrain, { outcome: "done" }, result.done);
  metrics.increment(M.offlineDrain, { outcome: "failed" }, result.failed);
  metrics.increment(M.offlineDrain, { outcome: "deferred" }, result.deferred);
  const pending = await listOutboxByStatus("pending");
  metrics.histogram(M.offlineQueueDepth, pending.length);
}

/**
 * Вешает foreground-дренаж outbox на online/visibilitychange, дренажит при
 * старте и возвращает cleanup. Pure (без React) — тестируется в jsdom.
 * Каждый проход снимает метрики offlineDrain/offlineQueueDepth (root-инструментация,
 * ядро drain.ts остаётся observability-free).
 */
export function startOfflineSync(
  send: SyncTransport = offlineTransport,
): () => void {
  const run = (): void => {
    void drainAndReport(send);
  };
  const onVisible = (): void => {
    if (document.visibilityState === "visible") run();
  };
  run();
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.removeEventListener("online", run);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/** Хук-обёртка: подключает синк на время жизни смонтировавшего компонента. */
export function useOfflineSync(): void {
  useEffect(() => startOfflineSync(), []);
}
