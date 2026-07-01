// src/features/comments/lecture-comments-token-wiring.test.ts
//
// Verifies getLectureComments forwards the share-token (?token=) into the
// openapi-fetch query. On a private/share-token lecture the comment tree must
// load under the visitor's grant, not anonymously (else 401 / empty / wrong
// visibility). ⚠️ The route /api/lectures/{id}/comments does NOT declare token in
// schema.ts (backend gap) — FE casts query `as never`; this test locks the wiring.

import { describe, expect, it, vi } from "vitest";

const get = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ GET: get }),
}));

vi.mock("@/i18n", () => ({
  getT: () => Promise.resolve((key: string) => key),
}));

// Import AFTER vi.mock (hoisting).
import { getLectureComments } from "./api";

function okList() {
  return { data: { data: [], pagination: { total: 0 } }, error: undefined };
}

describe("getLectureComments — share-token wiring", () => {
  it("puts token in query when provided", async () => {
    get.mockResolvedValue(okList());
    await getLectureComments("lec-tok-1", { token: "share-def" });

    const [route, init] = get.mock.calls.at(-1) as [string, { params: { query: Record<string, unknown> } }];
    expect(route).toBe("/api/lectures/{id}/comments");
    expect(init.params.query).toMatchObject({ token: "share-def" });
  });

  it("omits token when not provided", async () => {
    get.mockResolvedValue(okList());
    await getLectureComments("lec-tok-2");

    const [, init] = get.mock.calls.at(-1) as [string, { params: { query: Record<string, unknown> } }];
    expect(init.params.query).not.toHaveProperty("token");
  });
});
