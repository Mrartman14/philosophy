// Валидация и серверная ре-редакция входящего батча телеметрии.
// Изоморфно: Zod-схема record-lite + cap'ы по размеру/количеству. Клиенту
// не доверяем — атрибуты ещё раз прогоняем через redactAttributes.
import { z } from "zod";

import { redactAttributes } from "../core/redact";
import type { Attributes, ObservabilityRecord } from "../core/types";

export const MAX_BATCH = 50;
export const MAX_BYTES = 64 * 1024;

export type IngestResult =
  | { ok: true; records: ObservabilityRecord[] }
  | { ok: false; reason: "too_large" | "too_many" | "invalid" };

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
  message: z.string(),
  attributes,
  context,
  timestamp: z.number(),
});

const errorRecord = z.object({
  kind: z.literal("error"),
  errorClass: z.string(),
  message: z.string(),
  backendCode: z.string().nullable(),
  fingerprint: z.string().nullable(),
  handled: z.boolean(),
  cause: z
    .object({
      name: z.string(),
      message: z.string(),
      stack: z.string().nullable(),
    })
    .nullable(),
  attributes,
  context,
  timestamp: z.number(),
});

const metricRecord = z.object({
  kind: z.literal("metric"),
  metric: z.string(),
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

export function validateBatch(raw: unknown, byteLength: number): IngestResult {
  if (byteLength > MAX_BYTES) return { ok: false, reason: "too_large" };
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
