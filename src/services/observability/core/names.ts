// src/services/observability/core/names.ts
// Константы имён метрик/событий — единый словарь, чтобы не плодить опечатки на швах.

/**
 * api.request.* attribute schemas (H2):
 *  - openapi transport (api/client.ts):  { transport: "openapi", method, route, status }
 *  - raw-fetch transport (server-fetch.ts, _offline/transport.ts, offline/store/images.ts):
 *                                        { transport: "fetch", surface, status }
 */
export const M = {
  actionDuration: "action.duration",
  actionCompleted: "action.completed",
  backendError: "backend.error",
  apiRequestDuration: "api.request.duration",
  apiRequestError: "api.request.error",
  authResolve: "auth.resolve",
  rbacDenied: "rbac.denied",
  mutationCommit: "mutation.commit",
  offlineDrain: "offline.drain",
  offlineDrainAttempted: "offline.drain.attempted",
  offlineQueueDepth: "offline.queue.depth",
  offlineCommandPoison: "offline.command.poison",
} as const;

export const webVital = (name: string): string => `web_vitals.${name}`;
