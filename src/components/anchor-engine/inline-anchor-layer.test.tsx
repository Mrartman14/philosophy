import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { InlineAnchorLayer } from "./inline-anchor-layer";
import type { AnchoredNote } from "./types";

const notes: AnchoredNote[] = [
  { id: "c1", anchor: { startBlockId: "b1", endBlockId: "b1", startChar: 0, endChar: 3, exact: "abc" } },
];

function noopMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
}

describe("InlineAnchorLayer", () => {
  it("по умолчанию карточки НЕ отрендерены (lazy): renderCard не вызван без клика", () => {
    noopMatchMedia(true);
    const renderCard = vi.fn((id: string) => <div>card-{id}</div>);
    const ref = createRef<HTMLElement>();
    ref.current = document.createElement("div");
    render(
      <InlineAnchorLayer
        astRootRef={ref}
        notes={notes}
        renderCard={renderCard}
        showAllHighlights={false}
        canCreate={false}
        onCreateRequest={vi.fn()}
        affordanceLabel="x"
        onActivateNarrow={vi.fn()}
      />,
    );
    expect(renderCard).not.toHaveBeenCalled();
    expect(screen.queryByText(/card-/)).toBeNull();
  });
});
