// src/features/annotations/read-token-wiring.test.ts
//
// Verifies that the annotation READ functions forward the share-token (?token=)
// into the openapi-fetch query when provided, and omit it otherwise. Share-token
// lectures/documents/comments must load annotations under the visitor's grant, not
// anonymously. Mirrors the api-level test style of the slice (mock createApiClient,
// assert on the GET query params). Distinct arg tuples per assertion avoid React
// cache() memoization collisions.

import { describe, expect, it, vi } from "vitest";

const get = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ GET: get }),
}));

// getT только для сообщений об ошибках; вернём заглушку-переводчик.
vi.mock("@/i18n", () => ({
  getT: () => Promise.resolve((key: string) => key),
}));

// Import AFTER vi.mock (hoisting).
import { getAnnotationsFor, getLectureAnnotations } from "./api";

function okList() {
  return { data: { data: [], pagination: { total: 0 } }, error: undefined, response: { status: 200 } };
}

describe("annotation read-path — share-token wiring", () => {
  it("getAnnotationsFor puts token in query when provided", async () => {
    get.mockResolvedValue(okList());
    await getAnnotationsFor("comment", "c-token-1", 0, 20, "share-abc");

    const [route, init] = get.mock.calls.at(-1) as [string, { params: { query: Record<string, unknown> } }];
    expect(route).toBe("/api/comments/{id}/annotations");
    expect(init.params.query).toMatchObject({ token: "share-abc" });
  });

  it("getAnnotationsFor omits token when undefined", async () => {
    get.mockResolvedValue(okList());
    await getAnnotationsFor("comment", "c-notoken-1");

    const [, init] = get.mock.calls.at(-1) as [string, { params: { query: Record<string, unknown> } }];
    expect(init.params.query).not.toHaveProperty("token");
  });

  it("getLectureAnnotations puts token in query when provided", async () => {
    get.mockResolvedValue(okList());
    await getLectureAnnotations("lec-token-1", 0, 20, undefined, "share-xyz");

    const [route, init] = get.mock.calls.at(-1) as [string, { params: { query: Record<string, unknown> } }];
    expect(route).toBe("/api/lectures/{id}/annotations");
    expect(init.params.query).toMatchObject({ token: "share-xyz" });
  });

  it("getLectureAnnotations omits token when undefined", async () => {
    get.mockResolvedValue(okList());
    await getLectureAnnotations("lec-notoken-1");

    const [, init] = get.mock.calls.at(-1) as [string, { params: { query: Record<string, unknown> } }];
    expect(init.params.query).not.toHaveProperty("token");
  });
});
