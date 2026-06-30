// src/components/anchor-engine/margin-rail.regression.test.tsx
// Регресс-канарейка движка (паритет с удалённым MarginAnchorLayer): annotation-
// карточка, размещённая rail'ом, несёт `data-note-card` и тон-акцент бордюром по
// логической стартовой стороне (borderInlineStart 3px). Синтетический RailScopeEntry
// → MarginRail; геометрия в jsdom нулевая — проверяем именно паритет атрибута+акцента.
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AnchorScopeProvider } from "./anchor-actions";
import { MarginRail } from "./margin-rail";
import { useRegisterRailScope, type RailScopeEntry } from "./use-rail-scopes";

function Reg({ entry }: { entry: RailScopeEntry }) {
  useRegisterRailScope(entry);
  return null;
}

describe("MarginRail regression parity", () => {
  // jsdom не реализует CSS Custom Highlight API → controller.supported=false →
  // HighlightOverlay вызывает getClientRects() на разрешённом range. Стабим в [].
  // Без matchMedia wide=false → колонка/выноски рендерятся в потоке, getBoundingClientRect
  // якоря не зовётся; тест проверяет паритет атрибута data-note-card + тон-акцента.
  beforeEach(() => {
    if (typeof Range !== "undefined" && typeof Range.prototype.getClientRects !== "function") {
      Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
    }
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("annotation card carries data-note-card and inline-start accent", () => {
    const el = document.createElement("div");
    el.setAttribute("data-anchor-scope", "document:d1");
    el.innerHTML = '<p data-block-id="b1">alpha beta</p>';
    document.body.appendChild(el);
    const entry: RailScopeEntry = {
      key: "annotation:document:d1",
      rootEl: el,
      tone: "annotation",
      notes: [
        { id: "n1", anchor: { startBlockId: "b1", endBlockId: "b1", startChar: 0, endChar: 5, exact: "alpha" } },
      ],
      renderNote: () => <span>card</span>,
    };
    render(
      <AnchorScopeProvider>
        <Reg entry={entry} />
        <MarginRail tone="annotation" highlightName="annotation" />
      </AnchorScopeProvider>,
    );
    // eslint-disable-next-line testing-library/no-node-access -- структурный ассерт паритета по data-note-card атрибуту карточки rail (прецедент: margin-rail.test.tsx)
    const card = document.querySelector<HTMLElement>('[data-note-card="n1"]');
    expect(card).not.toBeNull();
    expect(card?.style.borderInlineStart).toContain("3px");
  });
});
