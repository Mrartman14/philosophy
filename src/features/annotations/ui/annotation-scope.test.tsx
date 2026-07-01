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

// useWide → true (иначе scope держит карточки inline, в rail не регистрирует).
// useWide мерит size-контейнер .page-shell: clientWidth ≥ 80 × font-size(px).
// jsdom не считает layout — стабим clientWidth (широкий) + getComputedStyle(font)
// + ResizeObserver (паттерн use-wide.test). matchMedia стабим тоже (connector-layer
// и прочие потребители). Под wide rail зовёт геометрию якоря/выносок: jsdom не
// реализует layout у Range — стабим getBoundingClientRect/getClientRects (значения
// не важны, проверяем регистрацию).
beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: true,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  // .page-shell широкий (2000px) при font 16px → 2000 ≥ 80 × 16 = 1280 → wide.
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains("page-shell") ? 2000 : 0;
    },
  });
  const realGCS = window.getComputedStyle.bind(window);
  vi.stubGlobal("getComputedStyle", (el: Element, pseudo?: string | null) => {
    if (el instanceof HTMLElement && el.classList.contains("page-shell")) {
      return { fontSize: "16px" } as CSSStyleDeclaration;
    }
    return realGCS(el, pseudo ?? undefined);
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
  if (typeof Range !== "undefined") {
    Range.prototype.getBoundingClientRect = () => rect();
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  }
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  // @ts-expect-error снять override прототипа (вернётся реализация jsdom)
  delete HTMLElement.prototype.clientWidth;
});

describe("AnnotationScope (migration regression)", () => {
  it("находит размеченный корень, регистрирует заякоренную карточку в rail (wide)", async () => {
    // Обёртка .page-shell — size-контейнер, который useWide мерит для wide-гейта.
    document.body.innerHTML =
      '<main class="page-shell"><div data-anchor-scope="document:d1"><p data-block-id="b1">alpha beta</p></div></main>';
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
