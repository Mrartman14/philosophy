import { cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, it, expect } from "vitest";

import { must } from "./test-support";
import type { AnchorDraft } from "./types";
import { useSelectionCapture } from "./use-selection-capture";

// jsdom: getBoundingClientRect → нули, selectionchange/getSelection частичны.
// Дым-тест проверяет ТОЛЬКО что хук монтируется и без выделения draft===null,
// без throw. Реальная геометрия/поведение — ручной QA (Task 20).

interface Probe {
  draft: AnchorDraft | null;
  clear: () => void;
}

function Harness({ enabled, seen }: { enabled: boolean; seen: Probe[] }) {
  const rootRef = useRef<HTMLElement | null>(null);
  const state = useSelectionCapture({ rootRef, enabled });
  seen.push(state);
  // Callback-ref присваивает rootRef.current на коммите (host-элемент, не во время рендера).
  const setRoot = (el: HTMLDivElement | null) => {
    rootRef.current = el;
  };
  // Контент-рут с AST-блоком — рендерим, чтобы rootRef мог зацепиться.
  return (
    <div ref={setRoot}>
      <p data-block-id="b1">hello</p>
    </div>
  );
}

function last(seen: Probe[]): Probe {
  return must(seen.at(-1));
}

describe("useSelectionCapture (smoke)", () => {
  afterEach(() => {
    cleanup();
  });

  it("монтируется без throw; без выделения draft===null", () => {
    const seen: Probe[] = [];
    expect(() => {
      render(<Harness enabled seen={seen} />);
    }).not.toThrow();
    expect(last(seen).draft).toBeNull();
  });

  it("selectionchange без выделения не падает и оставляет draft===null", () => {
    const seen: Probe[] = [];
    render(<Harness enabled seen={seen} />);
    expect(() => {
      document.dispatchEvent(new Event("selectionchange"));
      document.dispatchEvent(new Event("pointerup"));
    }).not.toThrow();
    expect(last(seen).draft).toBeNull();
  });

  it("clear() не падает (программное снятие выделения)", () => {
    const seen: Probe[] = [];
    render(<Harness enabled seen={seen} />);
    expect(() => {
      last(seen).clear();
    }).not.toThrow();
    expect(last(seen).draft).toBeNull();
  });

  it("enabled=false: без подписок, монтируется чисто", () => {
    const seen: Probe[] = [];
    expect(() => {
      render(<Harness enabled={false} seen={seen} />);
      document.dispatchEvent(new Event("selectionchange"));
    }).not.toThrow();
    expect(last(seen).draft).toBeNull();
  });
});
