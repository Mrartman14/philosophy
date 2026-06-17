// Чистое ядро ingest без Next/Request/Response — легко тестируется.
// Порядок: JSON-parse → rate-limit(sessionId) → validate+re-redact → emit в sink.
import { getSink } from "../core/registry";
import type { ObservabilityRecord } from "../core/types";

import { createTokenBucket } from "./rate-limit";
import { validateBatch, MAX_BYTES } from "./validate";

export interface IngestInput {
  sessionId: string | null;
  rawText: string;
}
export interface IngestOutput {
  status: 204 | 400 | 413 | 429;
  emitted: number;
}

const defaultBucket = createTokenBucket({ capacity: 20, refillPerSec: 1 });

export function createIngestHandler(deps?: {
  bucket?: { allow(key: string): boolean };
  emit?: (r: ObservabilityRecord) => void;
}): (input: IngestInput) => IngestOutput {
  const bucket = deps?.bucket ?? defaultBucket;
  const emit = deps?.emit ?? ((r: ObservabilityRecord) => { getSink().emit(r); });

  return ({ sessionId, rawText }) => {
    const key = sessionId ?? "anon";
    if (!bucket.allow(key)) return { status: 429, emitted: 0 };

    const byteLength =
      typeof TextEncoder !== "undefined"
        ? new TextEncoder().encode(rawText).length
        : rawText.length;
    if (byteLength > MAX_BYTES) return { status: 413, emitted: 0 };

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return { status: 400, emitted: 0 };
    }

    const result = validateBatch(parsed);
    if (!result.ok) {
      return { status: result.reason === "too_many" ? 413 : 400, emitted: 0 };
    }

    for (const rec of result.records) emit(rec);
    return { status: 204, emitted: result.records.length };
  };
}
