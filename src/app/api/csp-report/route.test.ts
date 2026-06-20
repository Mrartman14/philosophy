import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/observability/server", () => ({
  initServerObservability: vi.fn(),
}));

const warn = vi.fn();
vi.mock("@/services/observability", () => ({
  log: { warn: (...a: unknown[]): void => { warn(...a); } },
}));

import { POST } from "./route";

describe("POST /api/csp-report", () => {
  it("логирует валидный репорт и отвечает 204", async () => {
    warn.mockClear();
    const body = JSON.stringify({ "csp-report": { "violated-directive": "script-src" } });
    const res = await POST(
      new Request("http://localhost/api/csp-report", { method: "POST", body }),
    );
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledWith("csp.violation", expect.any(Object));
  });

  it("не падает на битом теле, отвечает 204", async () => {
    warn.mockClear();
    const res = await POST(
      new Request("http://localhost/api/csp-report", { method: "POST", body: "{не json" }),
    );
    expect(res.status).toBe(204);
  });

  it("принимает массивный конверт application/reports+json", async () => {
    warn.mockClear();
    const body = JSON.stringify([
      { type: "csp-violation", body: { effectiveDirective: "script-src" } },
    ]);
    const res = await POST(
      new Request("http://localhost/api/csp-report", { method: "POST", body }),
    );
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledWith("csp.violation", expect.any(Object));
  });
});
