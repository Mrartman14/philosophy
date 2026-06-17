// src/services/observability/core/facade.ts
// Потребительский API наблюдаемости: log / errors / metrics. Изоморфен.
import { readServerConfig } from "../config";
import type { Attributes, Level } from "./types";
import type {
  CaptureOptions,
  EndTimer,
  ErrorReporter,
  Logger,
  Metrics,
} from "./ports";
import { getContext, getSink } from "./registry";
import { redactAttributes } from "./redact";
import { classifyError } from "./taxonomy";

// sampleRate читаем лениво на каждый emit — конфиг может меняться в тестах через env.
function sampleRate(): number {
  return readServerConfig().sampleRate;
}

function sampled(): boolean {
  return Math.random() < sampleRate();
}

function emitLog(level: Level, message: string, attributes?: Attributes): void {
  getSink().emit({
    kind: "log",
    level,
    message,
    attributes: redactAttributes(attributes ?? {}),
    context: getContext(),
    timestamp: Date.now(),
  });
}

export const log: Logger = {
  debug: (m, a) => emitLog("debug", m, a),
  info: (m, a) => emitLog("info", m, a),
  warn: (m, a) => emitLog("warn", m, a),
  error: (m, a) => emitLog("error", m, a),
};

function causeOf(
  error: unknown,
): { name: string; message: string; stack: string | null } | null {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }
  return null;
}

export const errors: ErrorReporter = {
  capture: (error: unknown, options?: CaptureOptions): void => {
    const classified = classifyError(error);
    const errorClass = options?.errorClass ?? classified.errorClass;
    const backendCode = options?.backendCode ?? classified.backendCode;
    const cause = causeOf(error);
    // Ошибки эмитим ВСЕГДА — без сэмплирования.
    getSink().emit({
      kind: "error",
      errorClass,
      message: cause?.message ?? String(error),
      backendCode,
      fingerprint: null,
      handled: options?.handled ?? true,
      cause,
      attributes: redactAttributes(options?.attributes ?? {}),
      context: getContext(),
      timestamp: Date.now(),
    });
  },
};

function emitMetric(
  metric: string,
  metricKind: "counter" | "histogram",
  value: number,
  unit: "ms" | "count" | null,
  attributes?: Attributes,
): void {
  if (!sampled()) return;
  getSink().emit({
    kind: "metric",
    metric,
    metricKind,
    value,
    unit,
    attributes: redactAttributes(attributes ?? {}),
    context: getContext(),
    timestamp: Date.now(),
  });
}

export const metrics: Metrics = {
  increment: (metric, attributes, value) =>
    emitMetric(metric, "counter", value ?? 1, "count", attributes),
  histogram: (metric, value, attributes) =>
    emitMetric(metric, "histogram", value, "ms", attributes),
  startTimer: (metric, attributes): EndTimer => {
    const start = Date.now();
    return (extra?: Attributes) => {
      const elapsed = Date.now() - start;
      emitMetric(metric, "histogram", elapsed, "ms", {
        ...(attributes ?? {}),
        ...(extra ?? {}),
      });
    };
  },
};
