import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

import { MarginNotesColumn, type ColumnNote } from "./margin-notes-column";

// Wide-гейт колонки — useWide() (container-детект; реальную геометрию тестируют
// use-wide.test/breakpoints.test). Мокаем его напрямую: wideState → узкий/широкий.
// jsdom не делает layout, реальное позиционирование — ручной QA (Task 20).
let wideState = false;
vi.mock("./use-wide", () => ({ useWide: () => wideState }));

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
    wideState = false;
  });

  it("монтируется без throw при wide=false (jsdom, деградация в поток)", () => {
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

  it("на узких (wide=false) карточки в потоке, без position:absolute", () => {
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

  it("на wide карточки идут в DOM в порядке якоря, а не во входном (таб-порядок = визуальному)", () => {
    // wide=true через мок useWide; tops якорей задаём через getAnchorRect.
    // jsdom не делает layout, но getAnchorRect — наш проп, а container top = 0,
    // поэтому resolveStack получает реальные tops и отдаёт порядок [b,c,a].
    wideState = true;
    const tops: Record<string, number> = { a: 200, b: 0, c: 100 };
    const rectFor = (id: string) => ({ top: tops[id] }) as DOMRect;
    const notes: ColumnNote[] = [
      { id: "a", node: <span>note-a</span>, orphan: false },
      { id: "b", node: <span>note-b</span>, orphan: false },
      { id: "c", node: <span>note-c</span>, orphan: false },
    ];
    const { container } = render(
      <MarginNotesColumn
        notes={notes}
        getAnchorRect={(id) => rectFor(id)}
        onActivate={() => undefined}
        recomputeKey={0}
      />,
    );
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- карточка без роли по дизайну
    const ids = [...container.querySelectorAll("[data-note-card-wrapper]")].map((el) =>
      el.getAttribute("data-note-card-wrapper"),
    );
    expect(ids).toEqual(["b", "c", "a"]);
  });

  it("ResizeObserver карточки → пересчёт раскладки (restack при смене высоты)", () => {
    let roCb: () => void = () => undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          roCb = cb;
        }
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
    wideState = true;
    const tops: Record<string, number> = { a: 0, b: 100 };
    const getRect = vi.fn((id: string) => ({ top: tops[id] }) as DOMRect);
    const notes: ColumnNote[] = [
      { id: "a", node: <span>note-a</span>, orphan: false },
      { id: "b", node: <span>note-b</span>, orphan: false },
    ];
    render(
      <MarginNotesColumn
        notes={notes}
        getAnchorRect={getRect}
        onActivate={() => undefined}
        recomputeKey={0}
      />,
    );
    getRect.mockClear();
    // Имитируем изменение высоты карточки (разворот клампа) — RO дёргает колбэк.
    act(() => {
      roCb();
    });
    expect(getRect).toHaveBeenCalled(); // раскладка пере-измерилась
    vi.unstubAllGlobals();
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

  it("сообщает наведение на карточку через onHoverNote", () => {
    const onHoverNote = vi.fn();
    const { container } = render(
      <MarginNotesColumn
        notes={makeNotes()}
        getAnchorRect={noRect}
        onActivate={() => undefined}
        onHoverNote={onHoverNote}
        recomputeKey={0}
      />,
    );
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- карточка без роли по дизайну
    const card = container.querySelector('[data-note-card-wrapper="a"]');
    if (card === null) throw new Error('card "a" не найдена');
    fireEvent.mouseEnter(card);
    expect(onHoverNote).toHaveBeenCalledWith("a");
    fireEvent.mouseLeave(card);
    expect(onHoverNote).toHaveBeenCalledWith(null);
  });
});
