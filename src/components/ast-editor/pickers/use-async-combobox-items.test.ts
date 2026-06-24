import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { useAsyncComboboxItems } from "./use-async-combobox-items";

const ok = (data: { id: string }[], total: number | null = data.length) =>
  () => Promise.resolve({ data, total });

describe("useAsyncComboboxItems", () => {
  it("делает первичный fetch(offset 0) и отдаёт items", async () => {
    const fetcher = vi.fn(ok([{ id: "a" }]));
    const { result } = renderHook(() => useAsyncComboboxItems(fetcher, 20));
    await waitFor(() => { expect(result.current.items).toHaveLength(1); });
    expect(fetcher).toHaveBeenCalledWith("", 0, 20);
    expect(result.current.status).toBe("ready");
  });

  it("debounce setQuery: фетч с последним значением", async () => {
    const fetcher = vi.fn(ok([{ id: "x" }]));
    const { result } = renderHook(() => useAsyncComboboxItems(fetcher, 20));
    act(() => { result.current.setQuery("ab"); });
    act(() => { result.current.setQuery("abc"); });
    await waitFor(() => { expect(fetcher).toHaveBeenCalledWith("abc", 0, 20); }, { timeout: 600 });
    expect(fetcher).not.toHaveBeenCalledWith("ab", 0, 20);
  });

  it("loadMore append со следующим offset", async () => {
    const fetcher = vi.fn((_q: string, offset: number) =>
      Promise.resolve({ data: [{ id: `${offset}` }], total: 2 }));
    const { result } = renderHook(() => useAsyncComboboxItems(fetcher, 1));
    await waitFor(() => { expect(result.current.items).toHaveLength(1); });
    expect(result.current.canLoadMore).toBe(true);
    act(() => { result.current.loadMore(); });
    await waitFor(() => { expect(result.current.items).toHaveLength(2); });
    expect(fetcher).toHaveBeenLastCalledWith("", 1, 1);
  });

  it("status=empty при пустом ответе", async () => {
    // Fetcher must be a stable reference (see hook docs): an inline `ok([], 0)`
    // would mint a new identity each render, retriggering the load effect → loop.
    const fetcher = vi.fn(ok([], 0));
    const { result } = renderHook(() => useAsyncComboboxItems(fetcher, 20));
    await waitFor(() => { expect(result.current.status).toBe("empty"); });
  });

  it("status=error + reload повторяет запрос", async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error("boom")));
    const { result } = renderHook(() => useAsyncComboboxItems(fetcher, 20));
    await waitFor(() => { expect(result.current.status).toBe("error"); });
    act(() => { result.current.reload(); });
    await waitFor(() => { expect(fetcher).toHaveBeenCalledTimes(2); });
  });

  it("отбрасывает устаревший ответ (resolve out of order)", async () => {
    let resolveOld!: (v: { data: { id: string }[]; total: number }) => void;
    let resolveNew!: (v: { data: { id: string }[]; total: number }) => void;
    const fOld = () => new Promise<{ data: { id: string }[]; total: number }>((r) => { resolveOld = r; });
    const fNew = () => new Promise<{ data: { id: string }[]; total: number }>((r) => { resolveNew = r; });
    const { result, rerender } = renderHook(({ f }) => useAsyncComboboxItems(f, 20), {
      initialProps: { f: fOld },
    });
    rerender({ f: fNew as typeof fOld });
    resolveNew({ data: [{ id: "new" }], total: 1 });
    await waitFor(() => { expect(result.current.items[0]?.id).toBe("new"); });
    resolveOld({ data: [{ id: "old" }], total: 1 });
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.items[0]?.id).toBe("new");
  });
});
