// src/services/offline/sync/transport.ts
// Порт-типы sync-слоя. Конкретные реализации (fetch к /api/offline/{entity},
// reconcile снимка) инжектируются из F4/слайса A — ядро их не знает.
import type { OutboxCommand } from "../contract/storage";

/**
 * Результат отправки одной команды.
 * `retriable: true` — ТОЛЬКО для подлинно временных сбоев (офлайн/сеть/5xx):
 * драйвер вернёт команду в pending и остановит проход (backoff).
 * `retriable: false` — для детерминированных/клиентских отказов (4xx): команда
 * уходит в `failed` и НЕ блокирует очередь. КОНТРАКТ транспорта: детерминированную
 * ошибку (невалидный payload и т.п.) обязан маппить в `retriable: false`, иначе
 * она навсегда встанет головой очереди (см. head-of-line в Self-Review).
 */
export type SyncSendResult =
  | { ok: true; serverId: string }
  | { ok: false; retriable: boolean; error: string };

/** Транспорт: исполнить команду (обычно POST /api/offline/{entity}) → результат. */
export type SyncTransport = (command: OutboxCommand) => Promise<SyncSendResult>;

/** Хук пост-успеха (reconcile снимка / инвалидация). Best-effort. */
export type ReconcileHook = (
  command: OutboxCommand,
  serverId: string,
) => Promise<void>;

/** Терминальный исход одной команды за проход (для per-command телеметрии). */
export type DrainOutcome =
  | { kind: "done"; command: OutboxCommand; serverId: string }
  | { kind: "deferred"; command: OutboxCommand; attempts: number; error: string }
  | { kind: "failed"; command: OutboxCommand; attempts: number; error: string };

export interface DrainDeps {
  send: SyncTransport;
  onSynced?: ReconcileHook;
  /**
   * Per-command хук исхода (best-effort, синхронный). Зовётся ПОСЛЕ записи
   * терминального статуса. Ядро не интерпретирует исход — точка съёма телеметрии
   * на composition root (поэтому drain.ts не импортирует observability).
   */
  onOutcome?: (outcome: DrainOutcome) => void;
}

export interface DrainResult {
  /** true, если дренаж уже шёл (single-drain) и вызов проигнорирован. */
  skipped: boolean;
  attempted: number;
  done: number;
  failed: number;
  deferred: number;
}
