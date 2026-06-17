// src/services/observability/core/registry.ts
// Реестр активного sink и провайдера контекста. Изоморфный модуль-синглтон.
import { noopSink } from "../adapters/noop-adapter";

import { resolveEnv } from "./env";
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

const defaultProvider: ContextProvider = {
  getContext: () => baseContext(resolveEnv(), "server"),
};

let activeSink = noopSink;
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
