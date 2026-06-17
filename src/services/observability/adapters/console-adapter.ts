// src/services/observability/adapters/console-adapter.ts
import "server-only";

// Console-sink: в prod — NDJSON в stdout; в dev — pretty console.*
// ЕДИНСТВЕННОЕ разрешённое исключение на прямой console в проекте.
import type { ObservabilityConfig } from "../config";
import type { ObservabilitySink } from "../core/ports";
import type { ObservabilityRecord } from "../core/types";

function devLevel(record: ObservabilityRecord): "info" | "warn" | "error" {
  if (record.kind === "error") return "error";
  if (record.kind === "log") {
    if (record.level === "error") return "error";
    if (record.level === "warn") return "warn";
  }
  return "info";
}

function emitDev(record: ObservabilityRecord): void {
  const level = devLevel(record);
  const tag = `[obs:${record.kind}]`;
  if (level === "error") console.error(tag, record);
  else if (level === "warn") console.warn(tag, record);
  else console.info(tag, record);
}

export function createConsoleSink(cfg: ObservabilityConfig): ObservabilitySink {
  const prod = cfg.env === "production";
  return {
    name: "console",
    emit: (record) => {
      if (prod) {
        process.stdout.write(`${JSON.stringify(record)}\n`);
      } else {
        emitDev(record);
      }
    },
  };
}
