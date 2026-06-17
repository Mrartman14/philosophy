// Валидация и серверная ре-редакция входящего батча телеметрии.
// Изоморфно: Zod-схема record-lite + cap'ы по размеру/количеству. Клиенту
// не доверяем — атрибуты ещё раз прогоняем через redactAttributes.
import { z } from "zod";

import { redactAttributes } from "../core/redact";
import type { Attributes, ObservabilityRecord } from "../core/types";

export const MAX_BATCH = 50;

export type IngestResult =
  | { ok: true; records: ObservabilityRecord[] }
  | { ok: false; reason: "too_many" | "invalid" };

const attrValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const attributes = z.record(z.string(), attrValue);

const context = z.object({
  env: z.enum(["development", "production", "test"]),
  runtime: z.enum(["server", "client", "sw"]),
  release: z.string().nullable(),
  requestId: z.string().nullable(),
  sessionId: z.string().nullable(),
  route: z.string().nullable(),
  actorHash: z.string().nullable(),
  actorRole: z.string().nullable(),
});

const logRecord = z.object({
  kind: z.literal("log"),
  level: z.enum(["debug", "info", "warn", "error"]),
  message: z.string().max(2048),
  attributes,
  context,
  timestamp: z.number(),
});

const errorRecord = z.object({
  kind: z.literal("error"),
  errorClass: z.enum([
    "forbidden.role",
    "forbidden.status",
    "forbidden.owner",
    "forbidden.guest",
    "validation",
    "banned",
    "conflict.version",
    "conflict.idempotency",
    "rate_limited",
    "not_found",
    "backend.5xx",
    "network",
    "unexpected",
  ]),
  message: z.string().max(2048),
  backendCode: z.string().max(256).nullable(),
  fingerprint: z.string().max(256).nullable(),
  handled: z.boolean(),
  cause: z
    .object({
      name: z.string().max(256),
      message: z.string().max(2048),
      stack: z.string().max(8192).nullable(),
    })
    .nullable(),
  attributes,
  context,
  timestamp: z.number(),
});

const metricRecord = z.object({
  kind: z.literal("metric"),
  metric: z.string().max(256),
  metricKind: z.enum(["counter", "histogram"]),
  value: z.number(),
  unit: z.enum(["ms", "count"]).nullable(),
  attributes,
  context,
  timestamp: z.number(),
});

const record = z.discriminatedUnion("kind", [
  logRecord,
  errorRecord,
  metricRecord,
]);

export function validateBatch(raw: unknown): IngestResult {
  if (!Array.isArray(raw)) return { ok: false, reason: "invalid" };
  if (raw.length > MAX_BATCH) return { ok: false, reason: "too_many" };

  const parsed = z.array(record).safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const records = parsed.data.map((r) => ({
    ...r,
    attributes: redactAttributes(r.attributes as Attributes),
  })) as ObservabilityRecord[];
  return { ok: true, records };
}
