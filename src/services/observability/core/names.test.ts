// src/services/observability/core/names.test.ts
import { describe, it, expect } from "vitest";

import { M, webVital } from "./names";

describe("observability names", () => {
  it("M содержит стабильные имена метрик", () => {
    expect(M.actionDuration).toBe("action.duration");
    expect(M.actionCompleted).toBe("action.completed");
    expect(M.backendError).toBe("backend.error");
    expect(M.apiRequestDuration).toBe("api.request.duration");
    expect(M.apiRequestError).toBe("api.request.error");
    expect(M.offlineDrainAttempted).toBe("offline.drain.attempted");
    expect(M.authResolve).toBe("auth.resolve");
    expect(M.rbacDenied).toBe("rbac.denied");
    expect(M.mutationCommit).toBe("mutation.commit");
    expect(M.offlineDrain).toBe("offline.drain");
    expect(M.offlineQueueDepth).toBe("offline.queue.depth");
    expect(M.offlineCommandPoison).toBe("offline.command.poison");
  });

  it("webVital префиксует имя метрики web_vitals.", () => {
    expect(webVital("LCP")).toBe("web_vitals.LCP");
    expect(webVital("CLS")).toBe("web_vitals.CLS");
  });
});
