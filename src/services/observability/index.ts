// src/services/observability/index.ts
// Изоморфный барель наблюдаемости: безопасен для клиентских и серверных бандлов.
// Серверные примитивы (initServerObservability, setServerActor, setServerRoute) —
// в @/services/observability/server (server-only entry).

export { log, errors, metrics } from "./core/facade";
export { classifyError } from "./core/taxonomy";
export * from "./core/types";
export { M, webVital } from "./core/names";
