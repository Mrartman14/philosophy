import { describe, it, expect, vi, beforeEach } from "vitest";

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock("./client", () => ({
  errors: { capture },
  initClientObservability: vi.fn(),
}));

import { registerClientErrorHandlers } from "./register-client-error-handlers";

type Handler = (ev: unknown) => void;

function makeTarget() {
  const handlers = new Map<string, Handler>();
  return {
    handlers,
    addEventListener: (type: string, h: Handler) => handlers.set(type, h),
  } as unknown as Window & { handlers: Map<string, Handler> };
}

beforeEach(() => capture.mockClear());

describe("registerClientErrorHandlers", () => {
  it("registers error + unhandledrejection listeners", () => {
    const t = makeTarget();
    registerClientErrorHandlers(t);
    expect(t.handlers.has("error")).toBe(true);
    expect(t.handlers.has("unhandledrejection")).toBe(true);
  });

  it("captures window error events as unhandled with the underlying error", () => {
    const t = makeTarget();
    registerClientErrorHandlers(t);
    const err = new Error("window-boom");
    const handler = t.handlers.get("error");
    expect(handler).toBeDefined();
    handler?.({ error: err, message: "window-boom" });
    expect(capture).toHaveBeenCalledWith(err, { handled: false, attributes: { kind: "window.error" } });
  });

  it("falls back to the event message when error is absent", () => {
    const t = makeTarget();
    registerClientErrorHandlers(t);
    const handler = t.handlers.get("error");
    expect(handler).toBeDefined();
    handler?.({ error: null, message: "msg-only" });
    expect(capture).toHaveBeenCalledWith("msg-only", { handled: false, attributes: { kind: "window.error" } });
  });

  it("captures unhandled promise rejections via reason", () => {
    const t = makeTarget();
    registerClientErrorHandlers(t);
    const reason = new Error("rejected");
    const handler = t.handlers.get("unhandledrejection");
    expect(handler).toBeDefined();
    handler?.({ reason });
    expect(capture).toHaveBeenCalledWith(reason, { handled: false, attributes: { kind: "unhandledrejection" } });
  });
});
