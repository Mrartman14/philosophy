// src/components/anchor-engine/margin-rail.test.tsx
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AnchorScopeProvider } from "./anchor-actions";
import { MarginRail } from "./margin-rail";
import { useRegisterRailScope, type RailScopeEntry } from "./use-rail-scopes";

function must<T>(v: T | null | undefined): T {
  if (v == null) throw new Error("expected non-null");
  return v;
}

// jsdom не реализует layout: Range.getClientRects отсутствует. С резолвимыми
// якорями (ниже) controller.supported=false → HighlightOverlay вызывает
// getClientRects() на range. Стабим в [] — оверлей рендерит ноль прямоугольников,
// тест проверяет агрегацию КОЛОНКИ карточек, а не геометрию (она — ручной QA).
beforeEach(() => {
  if (typeof Range !== "undefined" && typeof Range.prototype.getClientRects !== "function") {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  }
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function Reg({ entry }: { entry: RailScopeEntry }) {
  useRegisterRailScope(entry);
  return null;
}

function makeScope(key: string, noteId: string, label: string): RailScopeEntry {
  const el = document.createElement("div");
  el.setAttribute("data-anchor-scope", "document:x");
  el.innerHTML = '<p data-block-id="b1">alpha beta</p>';
  document.body.appendChild(el);
  return {
    key,
    rootEl: el,
    tone: "annotation",
    notes: [{ id: noteId, anchor: { startBlockId: "b1", endBlockId: "b1", startChar: 0, endChar: 5, exact: "alpha" } }],
    renderNote: () => <span>{label}</span>,
  };
}

describe("MarginRail", () => {
  it("агрегирует карточки из 2 скоупов в ОДНУ колонку", () => {
    // jsdom: нет matchMedia → wide=false → MarginNotesColumn рендерит в потоке (без
    // абсолютного позиционирования и getBoundingClientRect-геометрии) → карточки в DOM.
    render(
      <AnchorScopeProvider>
        <Reg entry={makeScope("annotation:document:a", "n-a", "card-A")} />
        <Reg entry={makeScope("annotation:document:b", "n-b", "card-B")} />
        <MarginRail tone="annotation" highlightName="annotation" />
      </AnchorScopeProvider>,
    );
    // eslint-disable-next-line testing-library/no-node-access -- структурный ассерт «одна колонка» по data-* атрибутам колонки (прецедент: connector-layer.test.tsx, margin-notes-column.test.tsx)
    const cards = document.querySelectorAll("[data-note-card]");
    expect(cards.length).toBe(2); // обе заметки
    expect(document.body.textContent).toContain("card-A");
    expect(document.body.textContent).toContain("card-B");
    // обе — в ОДНОМ контейнере колонки (общий предок MarginNotesColumn,
    // data-note-column), а не в двух раздельных колонках на скоуп.
    // eslint-disable-next-line testing-library/no-node-access -- closest по data-note-column: проверяем общий контейнер колонки (прецедент: margin-notes-column.test.tsx)
    const colA = must(cards[0]).closest("[data-note-column]");
    // eslint-disable-next-line testing-library/no-node-access -- closest по data-note-column: проверяем общий контейнер колонки (прецедент: margin-notes-column.test.tsx)
    const colB = must(cards[1]).closest("[data-note-column]");
    expect(colA).not.toBeNull();
    expect(colA).toBe(colB);
  });
});
