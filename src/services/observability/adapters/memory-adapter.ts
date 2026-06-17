// src/services/observability/adapters/memory-adapter.ts
// In-memory sink для тестов: накапливает записи в массив.
import type { ObservabilitySink } from "../core/ports";
import type { ObservabilityRecord } from "../core/types";

export function createMemorySink(): {
  sink: ObservabilitySink;
  records: ObservabilityRecord[];
  clear(): void;
} {
  const records: ObservabilityRecord[] = [];
  const sink: ObservabilitySink = {
    name: "memory",
    emit: (record) => {
      records.push(record);
    },
    flush: () => Promise.resolve(),
  };
  return {
    sink,
    records,
    clear: () => {
      records.length = 0;
    },
  };
}
