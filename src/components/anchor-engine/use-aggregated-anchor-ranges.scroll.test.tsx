// src/components/anchor-engine/use-aggregated-anchor-ranges.scroll.test.tsx
// F4 scroll-дрейф-фикс (аудит 2026-07-01): use-aggregated обязан ПЕРЕ-СНИМАТЬ
// geometries на scroll (throttled rAF), иначе overlay-фолбэк и выноски дрейфуют
// (viewport-rect stale, scrollY свежий). Файл отдельный от основного
// use-aggregated-anchor-ranges.test.tsx (его rect-кейсы правит Wave2) — во
// избежание коллизии параллельных агентов.
import { render } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAggregatedAnchorRanges } from "./use-aggregated-anchor-ranges";
import type { RailScopeEntry } from "./use-rail-scopes";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function scopeEl(): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-anchor-scope", "document:x");
  const p = document.createElement("p");
  p.dataset.blockId = "b1";
  p.dataset.nodeId = "b1";
  p.appendChild(document.createTextNode("alpha beta"));
  el.appendChild(p);
  document.body.appendChild(el);
  return el;
}

function makeScope(root: HTMLElement): RailScopeEntry {
  return {
    key: "annotation:document:x",
    rootEl: root,
    tone: "annotation",
    notes: [
      {
        id: "n1",
        anchor: {
          startBlockId: "b1",
          startNodeId: "b1",
          endBlockId: "b1",
          endNodeId: "b1",
          startChar: 0,
          endChar: 5,
          exact: "alpha",
        },
      },
    ],
    renderNote: () => null,
  };
}

function Probe({
  scopes,
  onKey,
}: {
  scopes: RailScopeEntry[];
  onKey: (k: number) => void;
}) {
  const { recomputeKey } = useAggregatedAnchorRanges(scopes);
  onKey(recomputeKey);
  return null;
}

describe("useAggregatedAnchorRanges scroll re-snapshot (F4)", () => {
  it("бампит recomputeKey на scroll (пере-снятие geometries), throttled в один rAF", () => {
    // rAF синхронно (кадр = немедленно): throttle-логика сохраняется, но без таймеров.
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);

    const root = scopeEl();
    let key = -1;
    render(<Probe scopes={[makeScope(root)]} onKey={(k) => (key = k)} />);
    const before = key;

    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    // scroll → onScroll → rAF(bump) → recomputeKey++ → geometries пере-снялись свежими.
    expect(key).toBe(before + 1);
  });

  it("снимает scroll-listener в cleanup (нет пере-снятия после unmount)", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);

    const root = scopeEl();
    let key = -1;
    const { unmount } = render(<Probe scopes={[makeScope(root)]} onKey={(k) => (key = k)} />);
    unmount();
    const after = key;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(key).toBe(after); // listener снят → recomputeKey не двигается
  });
});
