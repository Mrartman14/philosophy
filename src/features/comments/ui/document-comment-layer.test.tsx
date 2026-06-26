import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocumentCommentLayer } from "./document-comment-layer";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));
vi.mock("@/components/appearance", () => ({ useReducedMotion: () => false }));

// Module-scope, стабильная ссылка: InlineAnchorLayer → useAnchorRanges держит
// notes в deps+setState; нестабильный литерал в render зациклил бы effect (OOM).
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

// matchMedia стабильно замокан (jsdom его не даёт) — гасит wide-watch effect.
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

describe("DocumentCommentLayer", () => {
  it("рендерит тогл подсветки и доступный список превью (a11y) даже без клика", () => {
    noopMatchMedia(false);
    render(
      <DocumentCommentLayer
        lectureId="L"
        documentId="doc-1"
        rootTypes={["claim"]}
        notes={notes}
        canCreate={false}
      />,
    );
    // тогл присутствует (по дефолту OFF → лейбл "показать")
    expect(screen.getByText("marginHighlightShow")).toBeInTheDocument();
    // a11y/тач-путь: доступный список превью корней рендерится ВСЕГДА (notes>0),
    // независимо от тогла подсветки → превью присутствует в DOM (внутри списка).
    const items = within(screen.getByRole("list")).getAllByText("preview-c1");
    expect(items).toHaveLength(1);
    // ...но это превью из ДОСТУПНОГО СПИСКА, а НЕ из карточки-по-клику
    // (renderCard в InlineAnchorLayer). Без клика по фрагменту карточка не
    // открыта — превью встречается во всём DOM ровно один раз (только в списке).
    expect(screen.getAllByText("preview-c1")).toHaveLength(1);
  });
});
