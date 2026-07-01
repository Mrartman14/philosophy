import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnchorGeometry } from "./types";
import { useTextClick } from "./use-text-click";

// Оборачиваем live-Range в range-geometry (проп hook'а сменился ranges → geometries).
// noteAtPointInGeometry для range-kind читает ТОЛЬКО g.range.comparePoint — bbox/rects
// не консультируются; в jsdom Range.getBoundingClientRect отсутствует → ставим заглушки.
const wrap = (r: Range): AnchorGeometry => ({
  kind: "range",
  range: r,
  boundingRect: new DOMRect(),
  clientRects: [],
});

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
      useTextClick({ astRootRef: ref, geometries: new Map(), ready: false, onPick });
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
      useTextClick({ astRootRef: ref, geometries: new Map(), ready: true, onPick: vi.fn() });
    });
    expect(add).toHaveBeenCalledWith("click", expect.any(Function));
  });

  it("клик внутри range → onPick(id) того note", () => {
    const { root, textNode } = buildRoot("alpha beta gamma");

    // Range, накрывающий "beta" (offset 6..10).
    const r = document.createRange();
    r.setStart(textNode, 6);
    r.setEnd(textNode, 10);
    const geometries = new Map<string, AnchorGeometry | null>([["n1", wrap(r)]]);

    // caret в середине "beta" (offset 8) → внутри range → comparePoint === 0.
    stubCaret(textNode, 8);

    const ref = createRef<HTMLElement>();
    ref.current = root;
    const onPick = vi.fn();
    renderHook(() => {
      useTextClick({ astRootRef: ref, geometries, ready: true, onPick });
    });

    root.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 1, clientY: 1 }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("n1");
  });

  it("клик внутри rect-bbox → onPick(id); caret-стаб не нужен (rect-ветка)", () => {
    // Программный рут без текстового узла — rect-ветка не читает caret.
    const root = document.createElement("div");
    document.body.appendChild(root);

    // rect-geometry: boundingRect (0,0,100,50) накрывает точку клика (10,10).
    const geometries = new Map<string, AnchorGeometry | null>([
      [
        "img1",
        { kind: "rect", boundingRect: new DOMRect(0, 0, 100, 50), clientRects: [new DOMRect(0, 0, 100, 50)] },
      ],
    ]);

    const ref = createRef<HTMLElement>();
    ref.current = root;
    const onPick = vi.fn();
    renderHook(() => {
      useTextClick({ astRootRef: ref, geometries, ready: true, onPick });
    });

    root.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 10, clientY: 10 }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("img1");
  });

  it("клик вне любого range → onPick не зовётся", () => {
    const { root, textNode } = buildRoot("alpha beta gamma");

    const r = document.createRange();
    r.setStart(textNode, 6);
    r.setEnd(textNode, 10);
    const geometries = new Map<string, AnchorGeometry | null>([["n1", wrap(r)]]);

    // caret в "alpha" (offset 2) — вне range "beta".
    stubCaret(textNode, 2);

    const ref = createRef<HTMLElement>();
    ref.current = root;
    const onPick = vi.fn();
    renderHook(() => {
      useTextClick({ astRootRef: ref, geometries, ready: true, onPick });
    });

    root.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 1, clientY: 1 }));
    expect(onPick).not.toHaveBeenCalled();
  });
});
