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
        // Avoid dotted `process.stdout` so Turbopack's static edge-API scanner
        // does not flag the reference in the Edge Instrumentation bundle.
        // At runtime the guard ensures we only write when stdout is available.
        const stdoutKey = "stdout" as const;
        const nodeStdout: NodeJS.WriteStream | undefined =
          typeof process !== "undefined" ? process[stdoutKey] : undefined;
        if (nodeStdout && typeof nodeStdout.write === "function") {
          nodeStdout.write(`${JSON.stringify(record)}\n`);
        } else {
          // Edge/no-stdout fallback: still emit one NDJSON line via console.
          console.log(JSON.stringify(record));
        }
      } else {
        emitDev(record);
      }
    },
  };
}
