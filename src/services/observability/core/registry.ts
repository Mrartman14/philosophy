// src/services/observability/core/registry.ts
// Реестр активного sink и провайдера контекста. Изоморфный модуль-синглтон.
import type { ObservabilitySink } from "./ports";
import type { ContextSnapshot } from "./types";

export interface ContextProvider {
  getContext(): ContextSnapshot;
}

export function baseContext(
  env: ContextSnapshot["env"],
  runtime: ContextSnapshot["runtime"],
): ContextSnapshot {
  return {
    env,
    runtime,
    release: null,
    requestId: null,
    sessionId: null,
    route: null,
    actorHash: null,
    actorRole: null,
  };
}

// Резолв env из NODE_ENV без сужения к строковым литералам кодом снаружи.
function resolveEnv(): ContextSnapshot["env"] {
  const raw = process.env.NODE_ENV;
  if (raw === "production") return "production";
  if (raw === "test") return "test";
  return "development";
}

// Дефолтный sink — безопасный no-op (до initServer/Client он не должен бросать).
const defaultSink: ObservabilitySink = {
  name: "noop",
  emit(_record) { /* no-op */ void _record; },
};

const defaultProvider: ContextProvider = {
  getContext: () => baseContext(resolveEnv(), "server"),
};

let activeSink: ObservabilitySink = defaultSink;
let activeProvider: ContextProvider = defaultProvider;

export function setSink(sink: ObservabilitySink): void {
  activeSink = sink;
}

export function getSink(): ObservabilitySink {
  return activeSink;
}

export function setContextProvider(p: ContextProvider): void {
  activeProvider = p;
}

export function getContext(): ContextSnapshot {
  return activeProvider.getContext();
}
