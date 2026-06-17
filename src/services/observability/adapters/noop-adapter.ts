// src/services/observability/adapters/noop-adapter.ts
// No-op sink: безопасный дефолт до инициализации. Изоморфен.
import type { ObservabilitySink } from "../core/ports";

export const noopSink: ObservabilitySink = {
  name: "noop",
  emit: () => {},
};
