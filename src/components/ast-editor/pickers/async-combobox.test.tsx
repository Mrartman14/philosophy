import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, screen, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AsyncCombobox } from "./async-combobox";

afterEach(cleanup);

interface Item { id: string; name: string }

describe("AsyncCombobox", () => {
  it("debounces fetcher and renders items", async () => {
    const fetcher = vi.fn(async (q: string, _offset: number, _limit: number) => ({
      data: [{ id: "1", name: `match-${q}` }, { id: "2", name: "other" }],
      total: 2 as number | null,
    }));
    render(
      <AsyncCombobox<Item>
        fetcher={fetcher}
        renderItem={(it) => <span>{it.name}</span>}
        getKey={(it) => it.id}
        onSelect={() => undefined}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "abc" } });
    expect(fetcher).not.toHaveBeenCalledWith("abc", expect.any(Number), expect.any(Number));
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith("abc", 0, 20), { timeout: 600 });
    expect(await screen.findByText("match-abc")).toBeInTheDocument();
  });

  it("Enter selects active item", async () => {
    const onSelect = vi.fn();
    const fetcher = vi.fn(async () => ({ data: [{ id: "x", name: "X" }], total: 1 as number | null }));
    render(
      <AsyncCombobox<Item>
        fetcher={fetcher}
        renderItem={(it) => <span>{it.name}</span>}
        getKey={(it) => it.id}
        onSelect={onSelect}
      />,
    );
    await screen.findByText("X");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith({ id: "x", name: "X" });
  });

  it("shows empty state when fetcher returns no items", async () => {
    const fetcher = vi.fn(async () => ({ data: [] as Item[], total: 0 as number | null }));
    render(
      <AsyncCombobox<Item>
        fetcher={fetcher}
        renderItem={() => null}
        getKey={() => "k"}
        onSelect={() => undefined}
      />,
    );
    expect(await screen.findByText(/ничего не найдено/i)).toBeInTheDocument();
  });

  it("error state shows retry", async () => {
    const fetcher = vi.fn(async () => { throw new Error("boom"); });
    render(
      <AsyncCombobox<Item>
        fetcher={fetcher}
        renderItem={() => null}
        getKey={() => "k"}
        onSelect={() => undefined}
      />,
    );
    expect(await screen.findByText(/ошибка/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /повторить/i }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it("Load more appends next page", async () => {
    const fetcher = vi.fn(async (_q: string, offset: number) => ({
      data: [{ id: `${offset}-a`, name: `${offset}A` }, { id: `${offset}-b`, name: `${offset}B` }],
      total: 4 as number | null,
    }));
    render(
      <AsyncCombobox<Item>
        fetcher={fetcher}
        renderItem={(it) => <span>{it.name}</span>}
        getKey={(it) => it.id}
        onSelect={() => undefined}
        pageSize={2}
      />,
    );
    await screen.findByText("0A");
    fireEvent.click(screen.getByRole("button", { name: /загрузить ещё/i }));
    await screen.findByText("2A");
    expect(fetcher.mock.calls[1]![1]).toBe(2);
  });
});
