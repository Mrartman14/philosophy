// src/services/observability/core/types.ts
// Изоморфные типы наблюдаемости. Без server-only — общий для server/client/sw.
// «Отсутствие» поля моделируется как `| null` (exactOptionalPropertyTypes).

export type Attributes = Record<string, string | number | boolean | null>;

export type Level = "debug" | "info" | "warn" | "error";

export type Runtime = "server" | "client" | "sw";

export type ErrorClass =
  | "forbidden.role"
  | "forbidden.status"
  | "forbidden.owner"
  | "forbidden.guest"
  | "validation"
  | "banned"
  | "conflict.version"
  | "conflict.idempotency"
  | "rate_limited"
  | "not_found"
  | "backend.5xx"
  | "network"
  | "unexpected";

export interface ContextSnapshot {
  env: "development" | "production" | "test";
  runtime: Runtime;
  release: string | null;
  requestId: string | null; // server, на запрос
  sessionId: string | null; // client, на загрузку страницы
  route: string | null;
  actorHash: string | null; // псевдоним; никогда не сырой id
  actorRole: string | null;
}

export interface LogRecord {
  kind: "log";
  level: Level;
  message: string;
  attributes: Attributes;
  context: ContextSnapshot;
  timestamp: number;
}

export interface ErrorRecord {
  kind: "error";
  errorClass: ErrorClass;
  message: string;
  backendCode: string | null;
  fingerprint: string | null;
  handled: boolean;
  cause: { name: string; message: string; stack: string | null } | null;
  attributes: Attributes;
  context: ContextSnapshot;
  timestamp: number;
}

export interface MetricRecord {
  kind: "metric";
  metric: string;
  metricKind: "counter" | "histogram";
  value: number;
  unit: "ms" | "count" | null;
  attributes: Attributes;
  context: ContextSnapshot;
  timestamp: number;
}

export type ObservabilityRecord = LogRecord | ErrorRecord | MetricRecord;
