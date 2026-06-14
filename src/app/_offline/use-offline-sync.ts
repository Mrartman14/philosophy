// src/app/_offline/use-offline-sync.ts
"use client";

import { useEffect } from "react";

import { drainOutbox } from "@/services/offline/sync/drain";
import type { SyncTransport } from "@/services/offline/sync/transport";

import { offlineTransport } from "./transport";

/**
 * Вешает foreground-дренаж outbox на online/visibilitychange, дренажит при
 * старте и возвращает cleanup. Pure (без React) — тестируется в jsdom.
 */
export function startOfflineSync(
  send: SyncTransport = offlineTransport,
): () => void {
  const run = (): void => {
    void drainOutbox({ send });
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
