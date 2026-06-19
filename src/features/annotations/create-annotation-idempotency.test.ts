// src/features/annotations/create-annotation-idempotency.test.ts
//
// Verifies that createAnnotation forwards the Idempotency-Key header
// through its RAW fetch path (not createApiClient) — the highest-risk
// drop point because a manual header spread is different from the
// openapi-fetch client used in other slices.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// createAnnotation reads the auth cookie for the Bearer token.
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({ get: (_name: string) => ({ value: "mock-token" }) }),
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

function mockFetchSuccess() {
  const mockResponse = {
    ok: true,
    json: () => Promise.resolve({ data: { id: "ann-1", owner_id: "u1" } }),
  } as unknown as Response;
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);
}

describe("createAnnotation — Idempotency-Key wiring (raw fetch path)", () => {
  let fetchSpy: ReturnType<typeof mockFetchSuccess>;

  beforeEach(() => {
    fetchSpy = mockFetchSuccess();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("forwards Idempotency-Key header from the hidden field", async () => {
    await createAnnotation(initial, annotationForm({ __idempotency_key: "key-anno-001" }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [_url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Idempotency-Key")).toBe("key-anno-001");
  });

  it("sends no Idempotency-Key header when the hidden field is absent", async () => {
    await createAnnotation(initial, annotationForm({}));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [_url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Idempotency-Key")).toBeNull();
  });

  it("still includes Authorization and Content-Type regardless of idempotency key", async () => {
    await createAnnotation(initial, annotationForm({ __idempotency_key: "key-anno-002" }));

    const [_url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer mock-token");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("uses POST method and encodes the correct URL segment for 'document' parent type", async () => {
    await createAnnotation(initial, annotationForm({ __idempotency_key: "key-anno-003" }));

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(url).toContain(`/documents/${PARENT_ID}/annotations`);
  });
});
