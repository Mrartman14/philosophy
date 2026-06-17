import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined }),
}));

vi.mock("@/utils/me", () => ({ getMe: () => ({ id: "u1", status: "active" }) }));
vi.mock("./permissions", () => ({ canCreateMedia: () => true }));
vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

const instrumentedFetch = vi.fn();
vi.mock("@/services/observability/server-fetch", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
  instrumentedFetch: (...a: any[]) => (instrumentedFetch as (...x: unknown[]) => unknown)(...a),
}));

import { uploadMedia } from "./upload-media";

describe("uploadMedia transport", () => {
  beforeEach(() => instrumentedFetch.mockReset());

  it("passes FormData body untouched with surface media.upload", async () => {
    instrumentedFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "m1" } }), { status: 201 }),
    );
    const fd = new FormData();
    fd.set("file", new File(["x"], "v.mp4", { type: "video/mp4" }));
    fd.set("type", "video");

    const result = await uploadMedia(fd);

    expect(result).toEqual({ success: true, data: { id: "m1" } });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [, init, meta] = instrumentedFetch.mock.calls[0]! as [unknown, RequestInit, { surface: string }];
    expect(init.body).toBe(fd);
    expect(meta).toEqual({ surface: "media.upload" });
  });
});
