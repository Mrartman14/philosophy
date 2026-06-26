import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DocumentCommentLayer } from "./document-comment-layer";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

// Стабильная module-scope ссылка: useAnchorRanges держит notes в deps+setState;
// нестабильный литерал в render зациклил бы effect.
const note = {
  id: "c1",
  anchor: {
    target_entity_type: "document" as const,
    target_entity_id: "doc-1",
    start_block_id: "b1",
    end_block_id: "b1",
    start_char: 0,
    end_char: 3,
    exact: "abc",
  },
  preview: <div>preview-c1</div>,
};
const notes = [note];

function stubMatch(matches: boolean) {
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("DocumentCommentLayer (eager)", () => {
  it("комментарии всегда видимы: превью отрендерено и тогла подсветки нет", () => {
    stubMatch(false); // narrow → превью в потоке
    render(
      <DocumentCommentLayer
        lectureId="L"
        documentId="doc-1"
        rootTypes={["claim"]}
        notes={notes}
        canCreate={false}
      />,
    );
    // Тогл «показать/скрыть» удалён (eager).
    expect(screen.queryByText("marginHighlightShow")).toBeNull();
    expect(screen.queryByText("marginHighlightHide")).toBeNull();
    // Превью комментария присутствует ровно один раз (SSR-список ИЛИ eager-слой,
    // не оба сразу — тернар по ready).
    expect(screen.getAllByText("preview-c1")).toHaveLength(1);
  });
});
