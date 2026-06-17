// src/services/observability/adapters/beacon-adapter.ts
// Client-sink: кольцевой буфер записей, flush на visibilitychange/pagehide
// через navigator.sendBeacon(ingestPath, Blob<json>).
import type { ObservabilityConfig } from "../config";
import type { ObservabilitySink } from "../core/ports";
import type { ObservabilityRecord } from "../core/types";

const RING_CAP = 500;

export function createBeaconSink(cfg: ObservabilityConfig): ObservabilitySink {
  let buffer: ObservabilityRecord[] = [];

  function flush(): Promise<void> {
    if (buffer.length === 0) return Promise.resolve();
    const batch = buffer;
    buffer = [];
    const blob = new Blob([JSON.stringify(batch)], {
      type: "application/json",
    });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(cfg.ingestPath, blob);
    }
    return Promise.resolve();
  }

  // Авто-flush на уходе со страницы (в SSR/тесте window может отсутствовать).
  if (typeof window !== "undefined") {
    const onLeave = (): void => {
      void flush();
    };
    window.addEventListener("visibilitychange", onLeave);
    window.addEventListener("pagehide", onLeave);
  }

  return {
    name: "beacon",
    emit: (record) => {
      buffer.push(record);
      if (buffer.length > RING_CAP) {
        buffer = buffer.slice(buffer.length - RING_CAP);
      }
    },
    flush,
  };
}
