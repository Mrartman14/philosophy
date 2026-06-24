import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";

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
    render(
      <MarginNotesColumn
        notes={makeNotes()}
        getAnchorRect={noRect}
        onActivate={() => undefined}
        recomputeKey={0}
      />,
    );
    // Привязанные карточки получают role="button"; в потоке у них нет inline-стиля.
    for (const card of screen.getAllByRole("button")) {
      expect(card.getAttribute("style")).toBeNull();
    }
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
