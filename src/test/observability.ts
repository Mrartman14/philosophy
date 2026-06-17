/**
 * Shared memory-sink test harness for observability tests.
 *
 * USAGE:
 *   const { records, metricsOf, errorsOf, logsOf } = withMemorySink();
 *
 * Registers a MemorySink via setSink() in beforeEach (clears records each run)
 * and restores noopSink in afterAll. Mirror of src/test/action-rbac.ts pattern.
 *
 * EXCLUDE facade.test.ts — it uses a custom provider + sampling spy.
 */

import { afterAll, beforeEach } from "vitest";

import { createMemorySink } from "@/services/observability/adapters/memory-adapter";
import { noopSink } from "@/services/observability/adapters/noop-adapter";
import { setSink } from "@/services/observability/core/registry";
import type {
  ErrorRecord,
  LogRecord,
  MetricRecord,
  ObservabilityRecord,
} from "@/services/observability/core/types";

export interface MemorySinkHandle {
  /** Live reference to the records array (same ref across beforeEach clears). */
  readonly records: ObservabilityRecord[];
  /** Filter metric records by metric name. */
  readonly metricsOf: (name: string) => MetricRecord[];
  /** Filter error records (optionally by errorClass). */
  readonly errorsOf: (errorClass?: string) => ErrorRecord[];
  /** Filter log records (optionally by level). */
  readonly logsOf: (level?: string) => LogRecord[];
}

/**
 * Call at the top-level of a describe block (or at module level).
 * Returns a stable handle — `records` is the live array, filters re-run on each call.
 */
export function withMemorySink(): MemorySinkHandle {
  const mem = createMemorySink();

  beforeEach(() => {
    mem.clear();
    setSink(mem.sink);
  });

  afterAll(() => {
    setSink(noopSink);
  });

  return {
    get records() {
      return mem.records;
    },
    metricsOf: (name: string): MetricRecord[] =>
      mem.records.filter(
        (r): r is MetricRecord => r.kind === "metric" && r.metric === name,
      ),
    errorsOf: (errorClass?: string): ErrorRecord[] =>
      mem.records.filter(
        (r): r is ErrorRecord =>
          r.kind === "error" &&
          (errorClass === undefined || r.errorClass === errorClass),
      ),
    logsOf: (level?: string): LogRecord[] =>
      mem.records.filter(
        (r): r is LogRecord =>
          r.kind === "log" && (level === undefined || r.level === level),
      ),
  };
}
