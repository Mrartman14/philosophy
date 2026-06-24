// src/features/annotations/create-annotation-idempotency.test.ts
//
// Verifies that createAnnotation forwards the Idempotency-Key header through the
// TYPED openapi-fetch client (per-entity POST routes are now in OpenAPI, so the
// raw-fetch стопгап was removed) and dispatches to the correct literal route per
// parent_entity_type.

import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ POST: post }),
}));

vi.mock("@/utils/me", () => ({
  getMe: () =>
    Promise.resolve({
      id: "u1",
      status: "active",
      role: "user",
      capabilities: ["annotation.create"],
    }),
}));

vi.mock("./permissions", () => ({
  canCreateAnnotation: () => true,
  canEditAnnotation: () => true,
  canDeleteAnnotation: () => true,
  canAdminDeleteAnnotation: () => true,
}));

vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));
// Мок @/i18n: getT возвращает переводчик, возвращающий ключ вместо текста.
// Позволяет схемам-фабрикам и getT("annotations") работать без request-scope next-intl.
vi.mock("@/i18n", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/i18n")>();
  return { ...orig, getT: () => Promise.resolve((key: string) => key) };
});

// Import AFTER vi.mock (hoisting).
import { createAnnotation } from "./actions";

const initial = { success: false as const, error: "" };

const PARENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BLOCKS_JSON = JSON.stringify([{ id: "b1", type: "paragraph", content: [] }]);

function annotationForm(extra: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("parent_entity_type", "document");
  fd.set("parent_entity_id", PARENT_ID);
  fd.set("blocks", BLOCKS_JSON);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("createAnnotation — Idempotency-Key wiring (typed client)", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: { data: { id: "ann-1" } }, error: undefined });
  });

  it("forwards Idempotency-Key header from the hidden field", async () => {
    await createAnnotation(initial, annotationForm({ __idempotency_key: "key-anno-001" }));

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ headers: { "Idempotency-Key": "key-anno-001" } }),
    );
  });

  it("sends no Idempotency-Key header when the hidden field is absent", async () => {
    await createAnnotation(initial, annotationForm({}));

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ headers: {} }),
    );
  });

  it("dispatches to the documents literal route with id path param", async () => {
    await createAnnotation(initial, annotationForm({ __idempotency_key: "key-anno-003" }));

    expect(post).toHaveBeenCalledWith(
      "/api/documents/{id}/annotations",
      expect.objectContaining({ params: { path: { id: PARENT_ID } } }),
    );
  });

  it("dispatches to the per-entity literal route matching parent_entity_type", async () => {
    await createAnnotation(
      initial,
      annotationForm({ parent_entity_type: "glossary" }),
    );

    const [route] = post.mock.calls[0] as [string, unknown];
    expect(route).toBe("/api/glossary/{id}/annotations");
  });
});
