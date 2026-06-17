// src/services/observability/core/facade.ts
// Потребительский API наблюдаемости: log / errors / metrics. Изоморфен.
import { readClientConfig, readServerConfig } from "../config";

import type {
  CaptureOptions,
  EndTimer,
  ErrorReporter,
  Logger,
  Metrics,
} from "./ports";
import { redactAttributes } from "./redact";
import { getContext, getSink } from "./registry";
import { classifyError } from "./taxonomy";
import type { Attributes, Level, ContextSnapshot } from "./types";

// sampleRate читаем лениво на каждый emit — конфиг может меняться в тестах через env.
// Клиент читает NEXT_PUBLIC_* переменную; сервер/sw — серверный knob.
function sampleRate(runtime: ContextSnapshot["runtime"]): number {
  return (runtime === "client" ? readClientConfig() : readServerConfig()).sampleRate;
}

function sampled(ctx: ContextSnapshot): boolean {
  return Math.random() < sampleRate(ctx.runtime);
}

function emitLog(level: Level, message: string, attributes?: Attributes): void {
  const ctx = getContext();
  getSink().emit({
    kind: "log",
    level,
    message,
    attributes: redactAttributes(attributes ?? {}),
    context: ctx,
    timestamp: Date.now(),
  });
}

export const log: Logger = {
  debug: (m, a) => { emitLog("debug", m, a); },
  info: (m, a) => { emitLog("info", m, a); },
  warn: (m, a) => { emitLog("warn", m, a); },
  error: (m, a) => { emitLog("error", m, a); },
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
    // message, cause.message и cause.stack — свободный текст из Error-объекта;
    // intentionally NOT passed through redactAttributes (только attributes редактируются).
    // Известный residual по итогам final review — принятый trade-off.
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
  const ctx = getContext();
  if (!sampled(ctx)) return;
  getSink().emit({
    kind: "metric",
    metric,
    metricKind,
    value,
    unit,
    attributes: redactAttributes(attributes ?? {}),
    context: ctx,
    timestamp: Date.now(),
  });
}

export const metrics: Metrics = {
  increment: (metric, attributes, value) =>
    { emitMetric(metric, "counter", value ?? 1, "count", attributes); },
  histogram: (metric, value, attributes) =>
    { emitMetric(metric, "histogram", value, "ms", attributes); },
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
