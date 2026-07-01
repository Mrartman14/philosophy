import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnchorGeometry } from "./types";
import { useHoverReveal } from "./use-hover-reveal";

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
  vi.unstubAllGlobals();
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

// caret внутри текстового узла → мок document.caretRangeFromPoint (в jsdom оба
// caret-API отсутствуют → caretFromPoint вернул бы null без стаба).
function stubCaret(node: Node, offset: number) {
  const caretRange = document.createRange();
  caretRange.setStart(node, offset);
  caretRange.collapse(true);
  (document as unknown as { caretRangeFromPoint: (x: number, y: number) => Range | null }).caretRangeFromPoint =
    () => caretRange;
}

describe("useHoverReveal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("подписывается на mousemove и mouseleave рута", () => {
    const el = document.createElement("div");
    const add = vi.spyOn(el, "addEventListener");
    const ref = createRef<HTMLElement>();
    ref.current = el;
    renderHook(() => {
      useHoverReveal({ astRootRef: ref, geometries: new Map(), ready: true, onHover: vi.fn() });
    });
    expect(add).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(add).toHaveBeenCalledWith("mouseleave", expect.any(Function));
  });

  it("mouseleave вызывает onHover(null)", () => {
    const el = document.createElement("div");
    const ref = createRef<HTMLElement>();
    ref.current = el;
    const onHover = vi.fn();
    renderHook(() => {
      useHoverReveal({ astRootRef: ref, geometries: new Map(), ready: true, onHover });
    });
    el.dispatchEvent(new MouseEvent("mouseleave"));
    expect(onHover).toHaveBeenCalledWith(null);
  });

  it("два mousemove с тем же hit → onHover один раз (дедуп id !== last), mouseleave → null", () => {
    // Синхронный rAF: run() выполняется немедленно при каждом mousemove.
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    const { root, textNode } = buildRoot("alpha beta gamma");

    // Range "beta" (6..10); caret в середине (8) → стабильный hit "n1".
    const r = document.createRange();
    r.setStart(textNode, 6);
    r.setEnd(textNode, 10);
    const geometries = new Map<string, AnchorGeometry | null>([["n1", wrap(r)]]);
    stubCaret(textNode, 8);

    const ref = createRef<HTMLElement>();
    ref.current = root;
    const onHover = vi.fn();
    renderHook(() => {
      useHoverReveal({ astRootRef: ref, geometries, ready: true, onHover });
    });

    root.dispatchEvent(new MouseEvent("mousemove", { clientX: 1, clientY: 1 }));
    root.dispatchEvent(new MouseEvent("mousemove", { clientX: 2, clientY: 2 }));
    // Дедуп: тот же id ("n1") дважды → onHover вызван единожды.
    expect(onHover).toHaveBeenCalledTimes(1);
    expect(onHover).toHaveBeenCalledWith("n1");

    root.dispatchEvent(new MouseEvent("mouseleave"));
    expect(onHover).toHaveBeenLastCalledWith(null);
    expect(onHover).toHaveBeenCalledTimes(2);
  });
});
