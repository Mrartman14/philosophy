// src/services/observability/core/ports.ts
// Изоморфные порты-потребители наблюдаемости.
import type { Attributes, ErrorClass, ObservabilityRecord } from "./types";

export interface Logger {
  debug(m: string, a?: Attributes): void;
  info(m: string, a?: Attributes): void;
  warn(m: string, a?: Attributes): void;
  error(m: string, a?: Attributes): void;
}

export interface CaptureOptions {
  errorClass?: ErrorClass;
  backendCode?: string;
  handled?: boolean;
  attributes?: Attributes;
}

export interface ErrorReporter {
  capture(error: unknown, options?: CaptureOptions): void;
}

export type EndTimer = (extra?: Attributes) => void;

export interface Metrics {
  increment(metric: string, attributes?: Attributes, value?: number): void;
  histogram(metric: string, value: number, attributes?: Attributes): void;
  startTimer(metric: string, attributes?: Attributes): EndTimer;
}

export interface ObservabilitySink {
  readonly name: string;
  emit(record: ObservabilityRecord): void;
  flush?(): Promise<void>;
}
