import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

import { MarginNotesColumn, type ColumnNote } from "./margin-notes-column";

// jsdom: getBoundingClientRect/offsetHeight → нули, window.matchMedia ОТСУТСТВУЕТ.
// Компонент несёт defensive-guard (typeof window.matchMedia !== "function" → wide=false),
// поэтому деградирует в чистый поток-список и НЕ падает. Реальное абсолютное
// позиционирование/распорка/раздвижка — ручной QA (Task 20).

const noRect = () => null;

function makeNotes(): ColumnNote[] {
  return [
    { id: "a", node: <span>note-a</span>, orphan: false },
    { id: "b", node: <span>note-b</span>, orphan: false },
    { id: "orphan", node: <span>note-orphan</span>, orphan: true },
  ];
}

describe("MarginNotesColumn (smoke)", () => {
  afterEach(() => {
    cleanup();
  });

  it("монтируется без throw при отсутствующем window.matchMedia (jsdom)", () => {
    expect(() => {
      render(
        <MarginNotesColumn
          notes={makeNotes()}
          getAnchorRect={noRect}
          onActivate={() => undefined}
          recomputeKey={0}
        />,
      );
    }).not.toThrow();
  });

  it("рендерит и сироты, и привязанные карточки", () => {
    render(
      <MarginNotesColumn
        notes={makeNotes()}
        getAnchorRect={noRect}
        onActivate={() => undefined}
        recomputeKey={0}
      />,
    );
    expect(screen.getByText("note-a")).toBeTruthy();
    expect(screen.getByText("note-b")).toBeTruthy();
    expect(screen.getByText("note-orphan")).toBeTruthy();
  });

  it("на узких (нет matchMedia → wide=false) карточки в потоке, без position:absolute", () => {
    const { container } = render(
      <MarginNotesColumn
        notes={makeNotes()}
        getAnchorRect={noRect}
        onActivate={() => undefined}
        recomputeKey={0}
      />,
    );
    // Привязанные карточки помечены data-note-card-wrapper (НЕ role="button" —
    // nested-interactive антипаттерн); в потоке у них нет inline-стиля.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- карточка без роли по дизайну (прецедент: semantic-map-direction.test.tsx)
    const cards = container.querySelectorAll("[data-note-card-wrapper]");
    expect(cards.length).toBe(2);
    for (const card of cards) {
      expect(card.getAttribute("style")).toBeNull();
    }
  });

  it("привязанные карточки НЕ имеют role=button/tabindex (нет nested-interactive)", () => {
    const { container } = render(
      <MarginNotesColumn
        notes={makeNotes()}
        getAnchorRect={noRect}
        onActivate={() => undefined}
        recomputeKey={0}
      />,
    );
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- карточка без роли по дизайну (прецедент: semantic-map-direction.test.tsx)
    for (const card of container.querySelectorAll("[data-note-card-wrapper]")) {
      expect(card.getAttribute("role")).toBeNull();
      expect(card.getAttribute("tabindex")).toBeNull();
    }
  });

  it("клик по телу карточки активирует, клик по внутренней кнопке — нет (guard всплытия)", () => {
    const onActivate = vi.fn();
    const notes: ColumnNote[] = [
      {
        id: "a",
        orphan: false,
        node: (
          <div>
            <span>card-body</span>
            <button type="button">delete</button>
          </div>
        ),
      },
    ];
    const { container } = render(
      <MarginNotesColumn notes={notes} getAnchorRect={noRect} onActivate={onActivate} recomputeKey={0} />,
    );
    fireEvent.click(screen.getByText("card-body"));
    expect(onActivate).toHaveBeenCalledWith("a");
    onActivate.mockClear();
    // Клик по вложенной кнопке всплывает в onClick карточки, но guard его глушит.
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    expect(onActivate).not.toHaveBeenCalled();
    expect(container).toBeTruthy();
  });

  it("пустой список нот не падает", () => {
    expect(() => {
      render(
        <MarginNotesColumn
          notes={[]}
          getAnchorRect={noRect}
          onActivate={() => undefined}
          recomputeKey={0}
        />,
      );
    }).not.toThrow();
  });

  it("смена recomputeKey не падает (триггер пересчёта в потоке)", () => {
    const { rerender } = render(
      <MarginNotesColumn
        notes={makeNotes()}
        getAnchorRect={noRect}
        onActivate={() => undefined}
        recomputeKey={0}
      />,
    );
    expect(() => {
      rerender(
        <MarginNotesColumn
          notes={makeNotes()}
          getAnchorRect={noRect}
          onActivate={() => undefined}
          recomputeKey={1}
        />,
      );
    }).not.toThrow();
  });
});
