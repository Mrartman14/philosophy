import { describe, it, expect, vi, beforeEach } from "vitest";

const initServerObservability = vi.fn();
vi.mock("@/services/observability/server", () => ({
  initServerObservability: () => initServerObservability() as unknown,
}));

const capture = vi.fn();
vi.mock("@/services/observability/core/facade", () => ({
  errors: { capture: (...a: unknown[]) => capture(...a) as unknown },
}));

import { register, onRequestError } from "../instrumentation";

describe("instrumentation", () => {
  beforeEach(() => {
    initServerObservability.mockClear();
    capture.mockClear();
  });

  it("register boots server observability", () => {
    register();
    expect(initServerObservability).toHaveBeenCalledTimes(1);
  });

  it("onRequestError captures unhandled error with route + renderSource + method attrs", () => {
    const err = new Error("boom");
    onRequestError(
      err,
      { path: "/x", method: "POST", headers: {} },
      {
        routerKind: "App Router",
        routePath: "/documents/[id]",
        routeType: "render",
        renderSource: "react-server-components",
        revalidateReason: undefined,
      },
    );
    expect(capture).toHaveBeenCalledWith(err, {
      handled: false,
      attributes: {
        route: "/documents/[id]",
        renderSource: "react-server-components",
        method: "POST",
      },
    });
  });
});
