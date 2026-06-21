/**
 * Тесты uploadMedia (канон: createFormAction + rethrowApiError + raw multipart).
 *
 * Покрывают:
 *  - transport happy-path: surface media.upload, пересборку upstream FormData
 *    (только file+type), revalidate(MEDIA), { success: true, data };
 *  - RBAC-отказ: { success:false, code:"forbidden" } и fetch НЕ вызван;
 *  - error mapping: 413 (PAYLOAD_TOO_LARGE → ключ каталога) и role-403
 *    (FORBIDDEN → code:"forbidden"), без revalidate.
 *
 * Параллель структуре documents/actions-*.test.ts (uploadDocument).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { Tags } from "@/api/tags";
import * as revalidateModule from "@/utils/revalidate";

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => ({ value: "mock-token" }) }),
}));

const getMeImpl = vi.fn();
vi.mock("@/utils/me", () => ({ getMe: () => getMeImpl() as unknown }));

// Гейт-функцию мокаем (двигаем разрешение), реальный requireCapability её зовёт.
const canCreateMediaImpl = vi.fn(() => true);
vi.mock("./permissions", () => ({ canCreateMedia: () => canCreateMediaImpl() }));

vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

// Мок @/i18n: getT/resolveErrorMessage возвращают ключ вместо локализованного текста.
vi.mock("@/i18n", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/i18n")>();
  return {
    ...orig,
    getT: () => Promise.resolve((key: string) => key),
    resolveErrorMessage: (key: string) => Promise.resolve(key),
  };
});

// next/navigation — createFormAction может вызвать redirect (banned-ветка).
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = `NEXT_REDIRECT;${url}`;
    throw err;
  }),
}));

const instrumentedFetch = vi.fn();
vi.mock("@/services/observability/server-fetch", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
  instrumentedFetch: (...a: any[]) => (instrumentedFetch as (...x: unknown[]) => unknown)(...a),
}));

import { uploadMedia } from "./upload-media";

const initial = { success: true as const, data: null };

function videoForm(): FormData {
  const fd = new FormData();
  fd.set("file", new File(["x"], "v.mp4", { type: "video/mp4" }));
  fd.set("type", "video");
  return fd;
}

function revalidateSpy() {
  return vi.mocked(revalidateModule.revalidateEntity);
}

beforeEach(() => {
  instrumentedFetch.mockReset();
  getMeImpl.mockReset();
  canCreateMediaImpl.mockReset();
  revalidateSpy().mockReset();

  getMeImpl.mockResolvedValue({ id: "u1", status: "active", capabilities: ["media.create"] });
  canCreateMediaImpl.mockReturnValue(true);
});

describe("uploadMedia — transport happy path", () => {
  it("POSTs rebuilt FormData (file+type) with surface media.upload", async () => {
    instrumentedFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "m1" } }), { status: 201 }),
    );

    const result = await uploadMedia(initial, videoForm());

    expect(result).toEqual({ success: true, data: { id: "m1" } });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [url, init, meta] = instrumentedFetch.mock.calls[0]! as [
      string,
      RequestInit,
      { surface: string },
    ];
    expect(url).toMatch(/\/api\/media$/);
    expect(meta).toEqual({ surface: "media.upload" });
    // Тело пересобрано (новый FormData), несёт только file+type.
    const sent = init.body as FormData;
    expect(sent).toBeInstanceOf(FormData);
    expect(sent.get("type")).toBe("video");
    expect(sent.get("file")).toBeInstanceOf(File);
  });

  it("revalidates MEDIA list tag once on success", async () => {
    instrumentedFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "m1" } }), { status: 201 }),
    );

    await uploadMedia(initial, videoForm());

    expect(revalidateSpy()).toHaveBeenCalledTimes(1);
    expect(revalidateSpy()).toHaveBeenCalledWith(Tags.MEDIA);
  });
});

describe("uploadMedia — RBAC denied", () => {
  it("returns forbidden and does NOT fetch when canCreateMedia is false", async () => {
    canCreateMediaImpl.mockReturnValue(false);

    const result = await uploadMedia(initial, videoForm());

    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(instrumentedFetch).not.toHaveBeenCalled();
    expect(revalidateSpy()).not.toHaveBeenCalled();
  });
});

describe("uploadMedia — backend error mapping", () => {
  it("maps 413 PAYLOAD_TOO_LARGE to { success: false } without revalidate", async () => {
    instrumentedFetch.mockResolvedValue(
      new Response(JSON.stringify({ code: "PAYLOAD_TOO_LARGE", error: "too big" }), {
        status: 413,
      }),
    );

    const result = await uploadMedia(initial, videoForm());

    expect(result).toMatchObject({ success: false });
    expect(revalidateSpy()).not.toHaveBeenCalled();
  });

  it("maps 403 FORBIDDEN to forbidden code", async () => {
    instrumentedFetch.mockResolvedValue(
      new Response(JSON.stringify({ code: "FORBIDDEN", error: "nope" }), { status: 403 }),
    );

    const result = await uploadMedia(initial, videoForm());

    expect(result).toMatchObject({ success: false, code: "forbidden" });
    expect(revalidateSpy()).not.toHaveBeenCalled();
  });
});
