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
  el.innerHTML = '<p data-block-id="b1" data-node-id="b1">alpha beta</p>';
  document.body.appendChild(el);
  return {
    key,
    rootEl: el,
    tone: "annotation",
    notes: [{ id: noteId, anchor: { startBlockId: "b1", startNodeId: "b1", endBlockId: "b1", endNodeId: "b1", startChar: 0, endChar: 5, exact: "alpha" } }],
    renderNote: () => <span>{label}</span>,
  };
}

// Скоуп-таблица для rect-якоря: две td data-node-id + застабленный
// getBoundingClientRect (jsdom без layout). Rect-якорь (c1→c2, одна таблица)
// резолвится в kind:"rect" → нота НЕ сирота.
function makeTableScope(key: string, noteId: string, label: string): RailScopeEntry {
  const el = document.createElement("div");
  el.setAttribute("data-anchor-scope", "document:t");
  el.innerHTML =
    '<table data-block-id="t1"><tbody><tr>' +
    '<td data-node-id="c1" id="c1">aa</td><td data-node-id="c2" id="c2">bb</td>' +
    "</tr></tbody></table>";
  document.body.appendChild(el);
  // eslint-disable-next-line testing-library/no-node-access -- застабить bbox ячеек: jsdom не делает layout, table-grid считает bbox по getBoundingClientRect
  must(el.querySelector("#c1")).getBoundingClientRect = () => new DOMRect(0, 0, 10, 10);
  // eslint-disable-next-line testing-library/no-node-access -- застабить bbox ячеек: jsdom не делает layout, table-grid считает bbox по getBoundingClientRect
  must(el.querySelector("#c2")).getBoundingClientRect = () => new DOMRect(10, 0, 10, 10);
  return {
    key,
    rootEl: el,
    tone: "annotation",
    notes: [
      {
        id: noteId,
        anchor: { startBlockId: "t1", startNodeId: "c1", endBlockId: "t1", endNodeId: "c2", startChar: 0, endChar: 2, exact: "aabb" },
      },
    ],
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

  // F6 #2 — ЖИВОЙ rect-путь на уровне MarginRail: rect-якорь (две ячейки одной
  // таблицы) резолвится в kind:"rect" → geometries.get !== null → нота НЕ сирота.
  // Карточка присутствует (data-note-card) и размещена в привязанном контейнере
  // (data-note-card-wrapper), а не в orphan-потоке сверху колонки. jsdom без
  // matchMedia → wide=false → колонка в потоке, но привязанные ноты всё равно
  // несут data-note-card-wrapper (дискриминатор orphan/anchored независим от wide).
  it("rect-нота (table-cell) → карточка присутствует и НЕ помечена orphan", () => {
    render(
      <AnchorScopeProvider>
        <Reg entry={makeTableScope("annotation:document:t", "rn", "rect-card")} />
        <MarginRail tone="annotation" highlightName="annotation" />
      </AnchorScopeProvider>,
    );
    // eslint-disable-next-line testing-library/no-node-access -- структурный ассерт наличия карточки rect-ноты по data-note-card (прецедент: margin-rail.regression.test.tsx)
    const card = document.querySelector<HTMLElement>('[data-note-card="rn"]');
    expect(card).not.toBeNull();
    expect(document.body.textContent).toContain("rect-card");
    // НЕ сирота: rect-якорь резолвлен → нота в привязанном wrapper (data-note-card-
    // wrapper), а сироты рендерятся БЕЗ этого атрибута (bare div сверху колонки).
    // eslint-disable-next-line testing-library/no-node-access -- дискриминатор orphan/anchored: привязанные ноты обёрнуты data-note-card-wrapper, сироты — нет
    const wrapper = must(card).closest("[data-note-card-wrapper]");
    expect(wrapper).not.toBeNull();
  });
});
