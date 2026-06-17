// src/services/observability/index.ts
// Изоморфный барель наблюдаемости: безопасен для клиентских и серверных бандлов.
// Серверные примитивы (initServerObservability, setServerActor, setServerRoute) —
// в @/services/observability/server (server-only entry).

// TODO(obs/sw): SW-lifecycle телеметрия (install/activate/fetch-fail, runtime:"sw")
// ОТЛОЖЕНА. SW — отдельный воркер-бандл без доступа к client-beacon singleton;
// нужен postMessage-мост SW→page→facade. Значение Runtime="sw" зарезервировано
// под него. См. Phase 4 plan, Task 4.5.

export { log, errors, metrics } from "./core/facade";
export { classifyError } from "./core/taxonomy";
export * from "./core/types";
export { M, webVital } from "./core/names";
