// src/services/observability/index.ts
import "server-only";

// Server-барель наблюдаемости: единая точка для серверных потребителей.
import { createConsoleSink } from "./adapters/console-adapter";
import { noopSink } from "./adapters/noop-adapter";
import { readServerConfig } from "./config";
import { serverContextProvider } from "./context/server";
import { setContextProvider, setSink } from "./core/registry";

export { log, errors, metrics } from "./core/facade";
export { classifyError } from "./core/taxonomy";
export * from "./core/types";
export { M, webVital } from "./core/names";
export { setServerActor, setServerRoute } from "./context/server";

// Идемпотентная инициализация: провайдер контекста + sink по конфигу.
export function initServerObservability(): void {
  const cfg = readServerConfig();
  setContextProvider(serverContextProvider);
  setSink(cfg.enabled && cfg.adapter === "console" ? createConsoleSink(cfg) : noopSink);
}
