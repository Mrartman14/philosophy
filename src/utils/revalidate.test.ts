// src/utils/revalidate.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

import { revalidateTag } from "next/cache";

import { revalidateEntity } from "./revalidate";

describe("revalidateEntity", () => {
  it("invalidates the list tag", () => {
    vi.mocked(revalidateTag).mockClear();
    revalidateEntity("comments");
    expect(revalidateTag).toHaveBeenCalledTimes(1);
    expect(revalidateTag).toHaveBeenCalledWith("comments", "default");
  });

  it("invalidates list + item tags when id is given", () => {
    vi.mocked(revalidateTag).mockClear();
    revalidateEntity("comments", "abc-123");
    expect(revalidateTag).toHaveBeenCalledTimes(2);
    expect(revalidateTag).toHaveBeenCalledWith("comments", "default");
    expect(revalidateTag).toHaveBeenCalledWith("comments:abc-123", "default");
  });
});
