// src/services/observability/core/names.ts
// Константы имён метрик/событий — единый словарь, чтобы не плодить опечатки на швах.
export const M = {
  actionDuration: "action.duration",
  actionCompleted: "action.completed",
  backendError: "backend.error",
  apiDuration: "api.request.duration",
  apiError: "api.request.error",
  authResolve: "auth.resolve",
  rbacDenied: "rbac.denied",
  mutationCommit: "mutation.commit",
  offlineDrain: "offline.drain",
  offlineQueueDepth: "offline.queue.depth",
  offlineCommandPoison: "offline.command.poison",
} as const;

export const webVital = (name: string): string => `web_vitals.${name}`;
