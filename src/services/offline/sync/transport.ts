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

export interface DrainDeps {
  send: SyncTransport;
  onSynced?: ReconcileHook;
}

export interface DrainResult {
  /** true, если дренаж уже шёл (single-drain) и вызов проигнорирован. */
  skipped: boolean;
  attempted: number;
  done: number;
  failed: number;
  deferred: number;
}
