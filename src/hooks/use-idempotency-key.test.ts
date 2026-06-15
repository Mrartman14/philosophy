import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIdempotencyKey } from "./use-idempotency-key";

describe("useIdempotencyKey", () => {
  beforeEach(() => {
    let n = 0;
    vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(
      () => `key-${++n}` as `${string}-${string}-${string}-${string}-${string}`,
    );
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it("returns a stable key across renders until rotated", () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey());
    const first = result.current.key;
    expect(first).toBe("key-1");
    rerender();
    expect(result.current.key).toBe(first);
  });

  it("mints a new key on rotate", () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const first = result.current.key;
    act(() => { result.current.rotate(); });
    expect(result.current.key).not.toBe(first);
  });
});
