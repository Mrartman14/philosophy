import { describe, it, expect, vi, beforeEach } from "vitest";

const { handle, createIngestHandler, initServerObservability } = vi.hoisted(() => {
  const handle = vi.fn();
  const createIngestHandler = vi.fn(() => handle);
  const initServerObservability = vi.fn();
  return { handle, createIngestHandler, initServerObservability };
});

vi.mock("@/services/observability/ingest/handle-ingest", () => ({
  createIngestHandler,
}));
vi.mock("@/services/observability/server", () => ({ initServerObservability }));

import { POST } from "./route";

function req(body: string, sessionId?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (sessionId) headers["x-session-id"] = sessionId;
  return new Request("https://x.test/api/telemetry", {
    method: "POST",
    headers,
    body,
  });
}

beforeEach(() => {
  handle.mockReset();
  createIngestHandler.mockClear();
  initServerObservability.mockClear();
});

describe("POST /api/telemetry", () => {
  it("returns 204 with an empty body on a valid batch", async () => {
    handle.mockReturnValue({ status: 204, emitted: 2 });
    const res = await POST(req("[]", "s-1"));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(handle).toHaveBeenCalledWith({ sessionId: "s-1", rawText: "[]" });
  });

  it("passes a null sessionId when the header is missing", async () => {
    handle.mockReturnValue({ status: 204, emitted: 0 });
    await POST(req("[]"));
    expect(handle).toHaveBeenCalledWith({ sessionId: null, rawText: "[]" });
  });

  it("propagates a 413 for an oversized batch", async () => {
    handle.mockReturnValue({ status: 413, emitted: 0 });
    const res = await POST(req("[]", "s-1"));
    expect(res.status).toBe(413);
  });

  it("propagates a 429 when rate-limited", async () => {
    handle.mockReturnValue({ status: 429, emitted: 0 });
    const res = await POST(req("[]", "s-1"));
    expect(res.status).toBe(429);
  });

  it("ensures the server sink is initialized before handling", async () => {
    handle.mockReturnValue({ status: 204, emitted: 0 });
    await POST(req("[]", "s-1"));
    expect(initServerObservability).toHaveBeenCalledTimes(1);
  });
});
