// src/services/observability/server.ts
// SERVER-ONLY entry: инициализация серверной наблюдаемости + мутаторы контекста.
// Клиентские бандлы импортируют @/services/observability (изоморфный барель).
import "server-only";

import { createConsoleSink } from "./adapters/console-adapter";
import { noopSink } from "./adapters/noop-adapter";
import { readServerConfig } from "./config";
import { serverContextProvider } from "./context/server";
import { setContextProvider, setSink } from "./core/registry";

export { setServerActor, setServerRoute } from "./context/server";

// Идемпотентная инициализация: провайдер контекста + sink по конфигу.
export function initServerObservability(): void {
  const cfg = readServerConfig();
  setContextProvider(serverContextProvider);
  setSink(cfg.enabled && cfg.adapter === "console" ? createConsoleSink(cfg) : noopSink);
}
