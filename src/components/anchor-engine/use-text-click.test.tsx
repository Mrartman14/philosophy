import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTextClick } from "./use-text-click";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

// Программно строим <div><p>…</p></div> и держим ссылку на текстовый узел
// напрямую — без querySelector/.firstChild (testing-library/no-node-access).
function buildRoot(text: string): { root: HTMLElement; textNode: Text } {
  const root = document.createElement("div");
  const p = document.createElement("p");
  p.dataset.blockId = "p1";
  const textNode = document.createTextNode(text);
  p.appendChild(textNode);
  root.appendChild(p);
  document.body.appendChild(root);
  return { root, textNode };
}

// caret внутри текстового узла → мок document.caretRangeFromPoint (WebKit/Blink-
// ветка caretFromPoint; в jsdom оба caret-API отсутствуют).
function stubCaret(node: Node, offset: number) {
  const caretRange = document.createRange();
  caretRange.setStart(node, offset);
  caretRange.collapse(true);
  // caretRangeFromPoint нет в lib.dom-типах jsdom → каст для стаба.
  (document as unknown as { caretRangeFromPoint: (x: number, y: number) => Range | null }).caretRangeFromPoint =
    () => caretRange;
}

describe("useTextClick", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("не падает и снимает листенер при unmount, когда root пуст", () => {
    const ref = createRef<HTMLElement>();
    const onPick = vi.fn();
    const { unmount } = renderHook(() => {
      useTextClick({ astRootRef: ref, ranges: new Map(), ready: false, onPick });
    });
    unmount();
    expect(onPick).not.toHaveBeenCalled();
  });

  it("подписывается на click рута при ready", () => {
    const el = document.createElement("div");
    const add = vi.spyOn(el, "addEventListener");
    const ref = createRef<HTMLElement>();
    ref.current = el;
    renderHook(() => {
      useTextClick({ astRootRef: ref, ranges: new Map(), ready: true, onPick: vi.fn() });
    });
    expect(add).toHaveBeenCalledWith("click", expect.any(Function));
  });

  it("клик внутри range → onPick(id) того note", () => {
    const { root, textNode } = buildRoot("alpha beta gamma");

    // Range, накрывающий "beta" (offset 6..10).
    const r = document.createRange();
    r.setStart(textNode, 6);
    r.setEnd(textNode, 10);
    const ranges = new Map<string, Range | null>([["n1", r]]);

    // caret в середине "beta" (offset 8) → внутри range → comparePoint === 0.
    stubCaret(textNode, 8);

    const ref = createRef<HTMLElement>();
    ref.current = root;
    const onPick = vi.fn();
    renderHook(() => {
      useTextClick({ astRootRef: ref, ranges, ready: true, onPick });
    });

    root.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 1, clientY: 1 }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("n1");
  });

  it("клик вне любого range → onPick не зовётся", () => {
    const { root, textNode } = buildRoot("alpha beta gamma");

    const r = document.createRange();
    r.setStart(textNode, 6);
    r.setEnd(textNode, 10);
    const ranges = new Map<string, Range | null>([["n1", r]]);

    // caret в "alpha" (offset 2) — вне range "beta".
    stubCaret(textNode, 2);

    const ref = createRef<HTMLElement>();
    ref.current = root;
    const onPick = vi.fn();
    renderHook(() => {
      useTextClick({ astRootRef: ref, ranges, ready: true, onPick });
    });

    root.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 1, clientY: 1 }));
    expect(onPick).not.toHaveBeenCalled();
  });
});
