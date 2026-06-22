import { describe, it, expect, vi, beforeEach } from "vitest";

const GET = vi.fn();
vi.mock("@/api/client", () => ({ createApiClient: () => Promise.resolve({ GET }) }));

import { getGraph } from "./api";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getGraph", () => {
  it("200 + data → { ok:true, graph }", async () => {
    GET.mockResolvedValue({ data: { data: { nodes: [], edges: [] } }, error: undefined, response: { status: 200 } });
    expect(await getGraph()).toEqual({ ok: true, graph: { nodes: [], edges: [] } });
  });

  it("503 → { ok:false, reason:'building' }", async () => {
    GET.mockResolvedValue({ data: undefined, error: {}, response: { status: 503 } });
    expect(await getGraph()).toEqual({ ok: false, reason: "building" });
  });

  it("прочая ошибка → { ok:false, reason:'error' }", async () => {
    GET.mockResolvedValue({ data: undefined, error: {}, response: { status: 500 } });
    expect(await getGraph()).toEqual({ ok: false, reason: "error" });
  });

  it("200 без data → error", async () => {
    GET.mockResolvedValue({ data: { data: undefined }, error: undefined, response: { status: 200 } });
    expect(await getGraph()).toEqual({ ok: false, reason: "error" });
  });

  it("исключение клиента → error", async () => {
    GET.mockRejectedValue(new Error("boom"));
    expect(await getGraph()).toEqual({ ok: false, reason: "error" });
  });
});
