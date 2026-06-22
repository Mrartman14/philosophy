// src/features/semantic-map/ui/map-point-panel.test.tsx
// Кликаем через fireEvent из @testing-library/react — @testing-library/user-event
// в проекте НЕ установлен (см. history-tracking-toggle.test.tsx как образец).
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

// jsdom не сбрасывает DOM между тестами автоматически (globals: false) —
// иначе getByRole находит элементы прошлых рендеров. См. comment-reactions.test.tsx.
afterEach(cleanup);

// useT возвращает ключ + простую подстановку {ord}.
vi.mock("@/i18n/client", () => ({
  useT: () => (key: string, params?: Record<string, unknown>) =>
    params && "ord" in params ? `${key}:${String(params.ord)}` : key,
}));

import { MapPointPanel } from "./map-point-panel";

describe("MapPointPanel", () => {
  it("заголовок из documents[doc]", () => {
    render(
      <MapPointPanel
        detail={{ doc: "doc-1", chunk_ord: 3, snippet: "текст" }}
        documents={{ "doc-1": "Бытие и время" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Бытие и время")).toBeInTheDocument();
    expect(screen.getByText("текст")).toBeInTheDocument();
  });

  it("фолбэк-заголовок, если документа нет в карте", () => {
    render(
      <MapPointPanel
        detail={{ doc: "doc-x", snippet: "s" }}
        documents={{}}
        onClose={vi.fn()}
      />,
    );
    // фолбэк — сам id документа.
    expect(screen.getByText("doc-x")).toBeInTheDocument();
  });

  it("ссылка ведёт на /documents/[doc]", () => {
    render(
      <MapPointPanel
        detail={{ doc: "doc-1", snippet: "s" }}
        documents={{ "doc-1": "T" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("link", { name: "pointPanelOpenDocument" })).toHaveAttribute(
      "href",
      "/documents/doc-1",
    );
  });

  it("chunk_ord рендерится через ICU-параметр", () => {
    render(
      <MapPointPanel
        detail={{ doc: "doc-1", chunk_ord: 7, snippet: "s" }}
        documents={{ "doc-1": "T" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("pointPanelChunk:7")).toBeInTheDocument();
  });

  it("кнопка закрытия зовёт onClose", () => {
    const onClose = vi.fn();
    render(
      <MapPointPanel detail={{ doc: "doc-1", snippet: "s" }} documents={{}} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "pointPanelClose" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
