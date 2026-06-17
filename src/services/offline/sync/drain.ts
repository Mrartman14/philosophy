// src/services/offline/sync/drain.ts
// Browser-only generic foreground-драйвер дренажа outbox. Entity-agnostic
// и сетенезависим: исполняет команды через инжектируемый транспорт.
// Конкретный транспорт (POST /api/offline/{entity}) и reconcile снимка —
// в composition root (F4) / слайсе A, вне ядра (для тестируемости).
import type { OutboxCommand } from "../contract/storage";
import { openOfflineDb } from "../store/db";
import { listOutboxByStatus, updateOutboxCommand } from "../store/outbox";

import type {
  DrainDeps,
  DrainOutcome,
  DrainResult,
  SyncSendResult,
} from "./transport";

let draining = false;

// best-effort: исход-хук никогда не валит проход (телеметрия — не критичный путь).
function emitOutcome(deps: DrainDeps, outcome: DrainOutcome): void {
  if (!deps.onOutcome) return;
  try {
    deps.onOutcome(outcome);
  } catch {
    // swallow — onOutcome это съём метрик, не должен ломать дренаж
  }
}

/**
 * Атомарно переводит команду pending→syncing за один readwrite-tx.
 * Возвращает null, если её уже забрали (status !== "pending") —
 * защита от двойной обработки (в т.ч. межвкладочной гонки).
 */
export async function claimPending(
  clientId: string,
): Promise<OutboxCommand | null> {
  const db = await openOfflineDb();
  try {
    const tx = db.transaction("outbox", "readwrite");
    const existing = await tx.store.get(clientId);
    if (existing?.status !== "pending") {
      await tx.done;
      return null;
    }
    const claimed: OutboxCommand = { ...existing, status: "syncing" };
    await tx.store.put(claimed);
    await tx.done;
    return claimed;
  } finally {
    db.close();
  }
}

export async function drainOutbox(deps: DrainDeps): Promise<DrainResult> {
  if (draining) {
    return { skipped: true, attempted: 0, done: 0, failed: 0, deferred: 0 };
  }
  draining = true;
  let attempted = 0;
  let done = 0;
  let failed = 0;
  let deferred = 0;
  try {
    // Recovery: вернуть «осиротевшие» syncing-команды (предыдущий drain умер в
    // середине send — вкладка закрыта/краш) в pending, иначе они навсегда
    // выпадут из выборки. Безопасно для create-only: server-side idempotency
    // (Idempotency-Key=clientId) дедупит команду, если она всё же дошла.
    for (const orphan of await listOutboxByStatus("syncing")) {
      await updateOutboxCommand(orphan.clientId, { status: "pending" });
    }
    const pending = (await listOutboxByStatus("pending")).sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) ||
        a.clientId.localeCompare(b.clientId),
    );
    for (const queued of pending) {
      const claimed = await claimPending(queued.clientId);
      if (!claimed) continue;
      attempted++;

      let outcome: SyncSendResult;
      try {
        outcome = await deps.send(claimed);
      } catch (error) {
        outcome = {
          ok: false,
          retriable: true,
          error: error instanceof Error ? error.message : "send failed",
        };
      }

      if (outcome.ok) {
        await updateOutboxCommand(claimed.clientId, {
          status: "done",
          serverId: outcome.serverId,
        });
        if (deps.onSynced) {
          try {
            await deps.onSynced(claimed, outcome.serverId);
          } catch {
            // reconcile best-effort — команда уже зафиксирована на сервере
          }
        }
        done++;
        emitOutcome(deps, { kind: "done", command: claimed, serverId: outcome.serverId });
      } else if (outcome.retriable) {
        await updateOutboxCommand(claimed.clientId, {
          status: "pending",
          attempts: claimed.attempts + 1,
          lastError: outcome.error,
        });
        deferred++;
        emitOutcome(deps, {
          kind: "deferred",
          command: claimed,
          attempts: claimed.attempts + 1,
          error: outcome.error,
        });
        // backoff: стоп на первом transient-сбое (доминирующий кейс — офлайн,
        // где упадут и все следующие). Цена — head-of-line при «ядовитой»
        // retriable-команде; контракт транспорта (см. transport.ts) обязывает
        // маппить детерминированные ошибки в retriable:false, чтобы не блокировать.
        break;
      } else {
        await updateOutboxCommand(claimed.clientId, {
          status: "failed",
          attempts: claimed.attempts + 1,
          lastError: outcome.error,
        });
        failed++;
        emitOutcome(deps, {
          kind: "failed",
          command: claimed,
          attempts: claimed.attempts + 1,
          error: outcome.error,
        });
      }
    }
  } finally {
    draining = false;
  }
  return { skipped: false, attempted, done, failed, deferred };
}
