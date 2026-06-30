// src/features/annotations/ui/annotation-scope.test.tsx
// Интеграционная канарейка регресса миграции Task 9: РЕАЛЬНЫЙ AnnotationScope
// (а не синтетический rail-entry) находит размеченный корень [data-anchor-scope],
// маппит снейк-кейс якорь в движковый и регистрирует заякоренную карточку в rail.
// matchMedia → wide=true (иначе scope держит карточки inline и в rail не пишет);
// после mount карточка отрисована rail'ом (data-note-card), inline-дубль погашен.
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnchorScopeProvider, MarginRail } from "@/components/anchor-engine";

import { AnnotationScope } from "./annotation-scope";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

function rect(): DOMRect {
  return {
    top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0,
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- DOMRect.toJSON стаб, не используется
    toJSON() {},
  } as DOMRect;
}

// matchMedia → wide=true (иначе scope держит карточки inline, в rail не регистрирует).
// Под wide rail зовёт геометрию якоря/выносок: jsdom не реализует layout у Range —
// стабим getBoundingClientRect/getClientRects (значения не важны, проверяем регистрацию).
beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: true,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  if (typeof Range !== "undefined") {
    Range.prototype.getBoundingClientRect = () => rect();
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  }
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("AnnotationScope (migration regression)", () => {
  it("находит размеченный корень, регистрирует заякоренную карточку в rail (wide)", async () => {
    document.body.innerHTML =
      '<div data-anchor-scope="document:d1"><p data-block-id="b1">alpha beta</p></div>';
    const notes = [
      {
        id: "n1",
        anchor: { start_block_id: "b1", end_block_id: "b1", start_char: 0, end_char: 5, exact: "alpha" },
        card: <span>card-1</span>,
      },
    ];
    render(
      <AnchorScopeProvider>
        <AnnotationScope
          parentEntityType="document"
          parentId="d1"
          notes={notes as never}
          canCreate={false}
          showToolbar
        />
        <MarginRail tone="annotation" highlightName="annotation" />
      </AnchorScopeProvider>,
    );
    // после mount: карточка зарегистрирована и отрисована rail'ом (data-note-card),
    // inline-дубль погашен (ready && wide).
    await vi.waitFor(() => {
      // eslint-disable-next-line testing-library/no-node-access -- структурный ассерт регистрации в rail по data-note-card (прецедент: margin-rail.test.tsx)
      expect(document.querySelector('[data-note-card="n1"]')).not.toBeNull();
    });
  });
});
