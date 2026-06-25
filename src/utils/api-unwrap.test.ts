// src/utils/api-unwrap.test.ts
import { describe, expect, it } from "vitest";

import { parseEnvelope, unwrap, unwrapList } from "./api-unwrap";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("unwrapList", () => {
  it("returns items from resp.data and pagination fields", () => {
    const resp = {
      data: [{ id: "1" }, { id: "2" }],
      pagination: { total: 42, offset: 10, limit: 20 },
    };
    const result = unwrapList(resp, { offset: 0, limit: 20 });
    expect(result).toEqual({ items: [{ id: "1" }, { id: "2" }], total: 42, offset: 10, limit: 20 });
  });

  it("falls back to fallback offset/limit when pagination is absent", () => {
    const resp = { data: [{ id: "3" }] };
    const result = unwrapList(resp, { offset: 5, limit: 50 });
    expect(result).toEqual({ items: [{ id: "3" }], total: 0, offset: 5, limit: 50 });
  });

  it("returns empty items when data is null", () => {
    const resp = { data: null, pagination: { total: 0, offset: 0, limit: 20 } };
    const result = unwrapList(resp, { offset: 0, limit: 20 });
    expect(result.items).toEqual([]);
  });

  it("returns empty items when data is undefined", () => {
    const resp: { data?: string[] | null } = {};
    const result = unwrapList(resp, { offset: 0, limit: 10 });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("returns 0 total when pagination is null", () => {
    const resp = { data: [], pagination: null };
    const result = unwrapList(resp, { offset: 0, limit: 20 });
    expect(result.total).toBe(0);
    expect(result.offset).toBe(0);
    expect(result.limit).toBe(20);
  });
});

describe("unwrap", () => {
  it("returns the data field when present", () => {
    const resp = { data: { id: "abc", name: "test" } };
    expect(unwrap(resp)).toEqual({ id: "abc", name: "test" });
  });

  it("returns null when data is null", () => {
    expect(unwrap({ data: null })).toBeNull();
  });

  it("returns null when data is undefined", () => {
    expect(unwrap({})).toBeNull();
  });
});

describe("parseEnvelope", () => {
  it("unwraps the {data:...} envelope from a raw fetch Response", async () => {
    const res = jsonResponse({ data: { upload_id: "u-1", storage_key: "abc" } });
    await expect(parseEnvelope<{ upload_id: string; storage_key: string }>(res)).resolves.toEqual({
      upload_id: "u-1",
      storage_key: "abc",
    });
  });

  it("returns null when the envelope has no data", async () => {
    await expect(parseEnvelope(jsonResponse({}))).resolves.toBeNull();
  });

  it("returns null when data is null", async () => {
    await expect(parseEnvelope(jsonResponse({ data: null }))).resolves.toBeNull();
  });

  it("returns null on a non-JSON body instead of throwing", async () => {
    const res = new Response("<html>boom</html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
    await expect(parseEnvelope(res)).resolves.toBeNull();
  });
});
