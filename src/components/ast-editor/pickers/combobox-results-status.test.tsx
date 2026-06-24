import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Combobox } from "@/components/ui";

import { ComboboxResultsStatus, type ComboboxResultsStatusCopy } from "./combobox-results-status";

afterEach(cleanup);

const copy: ComboboxResultsStatusCopy = {
  empty: "Пусто",
  loading: "Загрузка",
  error: "Ошибка",
  retry: "Повторить",
  loadMore: "Ещё",
};

// Combobox.Empty/Status требуют Combobox.Root-предка (контекст). Оборачиваем.
function wrap(node: React.ReactNode) {
  return (
    <Combobox.Root items={[]} filter={null}>
      {node}
    </Combobox.Root>
  );
}

describe("ComboboxResultsStatus", () => {
  // Base UI Combobox.Empty/Status дописывает word-joiner (U+2060) к тексту,
  // поэтому матчим тексты статуса по regex, а не точной строкой.
  it("empty → показывает текст пустоты", () => {
    render(wrap(<ComboboxResultsStatus status="empty" canLoadMore={false} onReload={() => undefined} onLoadMore={() => undefined} copy={copy} />));
    expect(screen.getByText(/Пусто/)).toBeInTheDocument();
  });

  it("loading → показывает текст загрузки", () => {
    render(wrap(<ComboboxResultsStatus status="loading" canLoadMore={false} onReload={() => undefined} onLoadMore={() => undefined} copy={copy} />));
    expect(screen.getByText(/Загрузка/)).toBeInTheDocument();
  });

  it("error → текст + кнопка retry вызывает onReload", () => {
    const onReload = vi.fn();
    render(wrap(<ComboboxResultsStatus status="error" canLoadMore={false} onReload={onReload} onLoadMore={() => undefined} copy={copy} />));
    expect(screen.getByText(/Ошибка/)).toBeInTheDocument();
    // Base UI Status вставляет word-joiner (U+2060) после текста — матчим по regex.
    fireEvent.click(screen.getByRole("button", { name: /Повторить/ }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("canLoadMore → кнопка «ещё» вызывает onLoadMore (вне Empty/Status)", () => {
    const onLoadMore = vi.fn();
    render(wrap(<ComboboxResultsStatus status="ready" canLoadMore onReload={() => undefined} onLoadMore={onLoadMore} copy={copy} />));
    const btn = screen.getByRole("button", { name: /Ещё/ });
    // «Загрузить ещё» — действие, не статус: НЕ внутри role="status" live-region.
    expect(btn.closest('[role="status"]')).toBeNull();
    fireEvent.click(btn);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("ready без canLoadMore → ничего не рендерит", () => {
    const { container } = render(wrap(<ComboboxResultsStatus status="ready" canLoadMore={false} onReload={() => undefined} onLoadMore={() => undefined} copy={copy} />));
    expect(container.querySelector("button")).toBeNull();
    expect(screen.queryByText("Пусто")).not.toBeInTheDocument();
  });
});
