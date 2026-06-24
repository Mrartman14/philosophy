import { render, fireEvent, screen, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";

// Мок i18n/client: useT возвращает переводчик по реальному каталогу ru.
vi.mock("@/i18n/client", async () => {
  const { default: editor } = await import("@/i18n/messages/ru/editor");
  return {
    useT: (ns: string) => {
      const catalog = ns === "editor" ? editor : {};
      return (key: string) => {
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = catalog;
        for (const part of key.split(".")) { val = val?.[part]; }
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        return typeof val === "string" ? val : key;
      };
    },
  };
});

import { AsyncCombobox } from "./async-combobox";

afterEach(cleanup);

interface Item { id: string; name: string }

describe("AsyncCombobox", () => {
  it("debounce + рендер items", async () => {
    const fetcher = vi.fn((q: string) => Promise.resolve({
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
    // дебаунс: синхронно после ввода серверный фетч с этим query ещё не ушёл
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "abc" } });
    expect(fetcher).not.toHaveBeenCalledWith("abc", expect.any(Number), expect.any(Number));
    await waitFor(() => { expect(fetcher).toHaveBeenCalledWith("abc", 0, 20); }, { timeout: 600 });
    expect(await screen.findByText("match-abc")).toBeInTheDocument();
  });

  it("клик по опции вызывает onSelect", async () => {
    const onSelect = vi.fn();
    const fetcher = vi.fn(() => Promise.resolve({ data: [{ id: "x", name: "X" }], total: 1 as number | null }));
    render(
      <AsyncCombobox<Item>
        fetcher={fetcher}
        renderItem={(it) => <span>{it.name}</span>}
        getKey={(it) => it.id}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(await screen.findByText("X"));
    expect(onSelect).toHaveBeenCalledWith({ id: "x", name: "X" });
  });

  it("Enter выбирает подсвеченный item", async () => {
    const onSelect = vi.fn();
    const fetcher = vi.fn(() => Promise.resolve({ data: [{ id: "x", name: "X" }], total: 1 as number | null }));
    render(
      <AsyncCombobox<Item>
        fetcher={fetcher}
        renderItem={(it) => <span>{it.name}</span>}
        getKey={(it) => it.id}
        onSelect={onSelect}
      />,
    );
    await screen.findByText("X");
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith({ id: "x", name: "X" });
  });

  it("empty state", async () => {
    render(
      <AsyncCombobox<Item>
        fetcher={() => Promise.resolve({ data: [] as Item[], total: 0 as number | null })}
        renderItem={() => null}
        getKey={() => "k"}
        onSelect={() => undefined}
      />,
    );
    expect(await screen.findByText(/ничего не найдено/i)).toBeInTheDocument();
  });

  it("error + retry", async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error("boom")));
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
    await waitFor(() => { expect(fetcher).toHaveBeenCalledTimes(2); });
  });

  it("load more append", async () => {
    const fetcher = vi.fn((_q: string, offset: number) => Promise.resolve({
      data: [{ id: `${offset}-a`, name: `${offset}A` }],
      total: 2 as number | null,
    }));
    render(
      <AsyncCombobox<Item>
        fetcher={fetcher}
        renderItem={(it) => <span>{it.name}</span>}
        getKey={(it) => it.id}
        onSelect={() => undefined}
        pageSize={1}
      />,
    );
    await screen.findByText("0A");
    fireEvent.click(screen.getByRole("button", { name: /загрузить ещё/i }));
    await screen.findByText("1A");
    const secondCall = fetcher.mock.calls[1];
    if (secondCall === undefined) throw new Error("fetcher не был вызван второй раз");
    expect(secondCall[1]).toBe(1);
  });

  it("Esc вызывает onClose", async () => {
    const onClose = vi.fn();
    render(
      <AsyncCombobox<Item>
        fetcher={() => Promise.resolve({ data: [] as Item[], total: 0 as number | null })}
        renderItem={() => null}
        getKey={() => "k"}
        onSelect={() => undefined}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    await waitFor(() => { expect(onClose).toHaveBeenCalled(); });
  });

  it("автофокус на поле поиска при монтировании", async () => {
    // Combobox рендерится inline (не в Popup) — autoFocus на mount корректен и
    // восстанавливает поведение старого async-combobox (клавиатурный доступ без Tab).
    render(
      <AsyncCombobox<Item>
        fetcher={() => Promise.resolve({ data: [] as Item[], total: 0 as number | null })}
        renderItem={() => null}
        getKey={() => "k"}
        onSelect={() => undefined}
      />,
    );
    const input = screen.getByRole("combobox");
    await waitFor(() => { expect(input).toHaveFocus(); });
  });

  it("рефетч при смене identity fetcher", async () => {
    const fA = vi.fn(() => Promise.resolve({ data: [{ id: "a", name: "A" }], total: 1 as number | null }));
    const fB = vi.fn(() => Promise.resolve({ data: [{ id: "b", name: "B" }], total: 1 as number | null }));
    const { rerender } = render(
      <AsyncCombobox<Item>
        fetcher={fA}
        renderItem={(it) => <span>{it.name}</span>}
        getKey={(it) => it.id}
        onSelect={() => undefined}
      />,
    );
    await screen.findByText("A");
    rerender(
      <AsyncCombobox<Item>
        fetcher={fB}
        renderItem={(it) => <span>{it.name}</span>}
        getKey={(it) => it.id}
        onSelect={() => undefined}
      />,
    );
    await screen.findByText("B");
    expect(fB).toHaveBeenCalled();
  });
});
