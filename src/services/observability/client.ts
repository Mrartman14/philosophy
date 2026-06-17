// src/services/observability/client.ts
// Client-safe барель наблюдаемости. КРИТИЧНО: НЕ импортирует ничего server-only.
import { createBeaconSink } from "./adapters/beacon-adapter";
import { noopSink } from "./adapters/noop-adapter";
import { readClientConfig } from "./config";
import { clientContextProvider } from "./context/client";
import { setContextProvider, setSink } from "./core/registry";

export { log, errors, metrics } from "./core/facade";
export * from "./core/types";
export { M, webVital } from "./core/names";
export { setClientActor, setClientRoute } from "./context/client";

// Идемпотентная клиентская инициализация: провайдер + beacon/noop по конфигу.
export function initClientObservability(): void {
  const cfg = readClientConfig();
  setContextProvider(clientContextProvider);
  setSink(cfg.clientEnabled && cfg.adapter === "console" ? createBeaconSink(cfg) : noopSink);
}
