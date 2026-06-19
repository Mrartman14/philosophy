// src/features/forms/submit-form-idempotency.test.ts
//
// Verifies that submitForm and createForm forward the Idempotency-Key
// header via the openapi-fetch client (ctx.idempotencyKey → idempotencyHeaders).
// Form submissions are high-value: a dropped key on retry = duplicate submission.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FORM_SUBMISSION_MODES, VISIBILITY } from "@/api/enums";

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
      capabilities: ["form.create"],
    }),
}));

vi.mock("./permissions", () => ({
  canCreateForm: () => true,
}));

vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

// Mock i18n facade: getT возвращает стаб-переводчик (ключ → ключ).
vi.mock("@/i18n", () => ({
  getT: () => Promise.resolve((key: string) => key),
}));

// Imports AFTER vi.mock (hoisted).
import { createForm, submitForm } from "./actions";

const initial = { success: false as const, error: "" };

const FORM_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const FIELD_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

// ── submitForm ────────────────────────────────────────────────────────────────

function submitFormData(extra: Record<string, string>): FormData {
  const answers = JSON.stringify([{ field_id: FIELD_ID, value: { text: "hello" } }]);
  const fd = new FormData();
  fd.set("formId", FORM_ID);
  fd.set("answers", answers);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("submitForm — Idempotency-Key wiring", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({
      data: { data: { id: "sub-1" } },
      error: undefined,
    });
  });

  it("forwards Idempotency-Key header from the hidden field", async () => {
    await submitForm(initial, submitFormData({ __idempotency_key: "key-submit-001" }));

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ headers: { "Idempotency-Key": "key-submit-001" } }),
    );
  });

  it("sends no idempotency header when the hidden field is absent", async () => {
    await submitForm(initial, submitFormData({}));

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ headers: {} }),
    );
  });
});

// ── createForm ────────────────────────────────────────────────────────────────

function createFormData(extra: Record<string, string>): FormData {
  const payload = JSON.stringify({
    title: "Test Form",
    visibility: VISIBILITY[0],
    submission_mode: FORM_SUBMISSION_MODES[0],
    fields: [
      {
        type: "text",
        prompt: "What is your name?",
        required: true,
        sort_order: 1,
      },
    ],
  });
  const fd = new FormData();
  fd.set("payload", payload);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("createForm — Idempotency-Key wiring", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({
      data: {
        data: {
          id: FORM_ID,
          title: "Test Form",
          owner_id: "u1",
          visibility: "private",
          submission_mode: "editable",
          fields: [],
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      },
      error: undefined,
    });
  });

  it("forwards Idempotency-Key header from the hidden field", async () => {
    await createForm(initial, createFormData({ __idempotency_key: "key-create-form-001" }));

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ headers: { "Idempotency-Key": "key-create-form-001" } }),
    );
  });

  it("sends no idempotency header when the hidden field is absent", async () => {
    await createForm(initial, createFormData({}));

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ headers: {} }),
    );
  });
});
