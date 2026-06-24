import { cleanup, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AnnotationLayer } from "./annotation-layer";
import type { AnchoredNote } from "./types";

// jsdom-дым: getBoundingClientRect → нули, нет CSS Custom Highlight API, нет
// AppearanceProvider. Проверяем, что оркестратор монтируется без throw и
// рендерит карточку-сироту через renderNote(note, true). Реальная геометрия /
// двусторонний клик / подсветка — ручной QA (Task 20).

function Harness({ notes }: { notes: AnchoredNote[] }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div ref={ref} data-ast-root>
        <p data-block-id="p1">present</p>
      </div>
      <AnnotationLayer
        astRootRef={ref}
        notes={notes}
        highlightEnabled
        canCreate={false}
        onCreateRequest={() => undefined}
        affordanceLabel="Add"
        renderNote={(n, orphan) => (
          <span>
            {orphan ? "orphan:" : "anchored:"}
            {n.id}
          </span>
        )}
      />
    </div>
  );
}

const orphanNote: AnchoredNote = {
  id: "n1",
  anchor: { startBlockId: "x", endBlockId: "x", startChar: 0, endChar: 4, exact: "zzzz" },
};

describe("AnnotationLayer (smoke)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  afterEach(() => {
    cleanup();
  });

  it("карточка-сирота (неразрешимый якорь) рендерится", () => {
    render(<Harness notes={[orphanNote]} />);
    expect(screen.getByText(/orphan:/)).toBeTruthy();
    expect(screen.getByText(/n1/)).toBeTruthy();
  });

  it("монтируется без throw на пустом списке нот", () => {
    expect(() => {
      render(<Harness notes={[]} />);
    }).not.toThrow();
  });
});
