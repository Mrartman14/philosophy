import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadImage } from "./upload-image";
import { makePngFile } from "./__fixtures__/png-1x1";

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({
    get: (name: string) => (name === "token" ? { value: "fake-jwt" } : undefined),
  }),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("uploadImage server action", () => {
  it("201 → success { storage_key, upload_id }", async () => {
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      expect(url).toBe("http://localhost:8080/api/uploads/images");
      expect(init.method).toBe("POST");
      const headers = new Headers(init.headers);
      expect(headers.get("authorization")).toBe("Bearer fake-jwt");
      expect(init.body).toBeInstanceOf(FormData);
      const fd = init.body as FormData;
      expect(fd.get("file")).toBeInstanceOf(File);
      return Promise.resolve(jsonResponse({ upload_id: "u-1", storage_key: "abc123" }, 201));
    });

    const fd = new FormData();
    fd.set("file", makePngFile());
    const res = await uploadImage(fd);

    expect(res).toEqual({
      success: true,
      data: { storage_key: "abc123", upload_id: "u-1" },
    });
  });

  it("413 IMAGE_TOO_LARGE → code: image_too_large", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ code: "IMAGE_TOO_LARGE", error: "too large" }, 413),
    );

    const fd = new FormData();
    fd.set("file", makePngFile());
    const res = await uploadImage(fd);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("image_too_large");
  });

  it("422 IMAGE_INVALID_MIME → code: image_invalid_mime", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ code: "IMAGE_INVALID_MIME", error: "only image/* allowed" }, 422),
    );

    const fd = new FormData();
    fd.set("file", new File(["bogus"], "x.txt", { type: "text/plain" }));
    const res = await uploadImage(fd);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("image_invalid_mime");
  });

  it("401 → code: forbidden", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "unauthorized" }, 401));

    const fd = new FormData();
    fd.set("file", makePngFile());
    const res = await uploadImage(fd);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe("forbidden");
  });

  it("missing file → validation error without calling fetch", async () => {
    const res = await uploadImage(new FormData());
    expect(res.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
