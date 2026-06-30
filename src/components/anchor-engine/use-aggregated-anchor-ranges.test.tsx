import { render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { useAggregatedAnchorRanges } from "./use-aggregated-anchor-ranges";
import type { RailScopeEntry } from "./use-rail-scopes";

afterEach(() => {
  document.body.innerHTML = "";
});

// Программно строим <div data-anchor-scope><p data-block-id="b1">…</p></div> и
// держим ссылку на текстовый узел напрямую — без innerHTML/querySelector
// (testing-library/no-node-access — error в anchor-engine-тестах).
function scopeEl(text: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-anchor-scope", "document:x");
  const p = document.createElement("p");
  p.dataset.blockId = "b1";
  p.appendChild(document.createTextNode(text));
  el.appendChild(p);
  document.body.appendChild(el);
  return el;
}

const noopRender = (): null => null;

function Probe({
  scopes,
  onRanges,
}: {
  scopes: RailScopeEntry[];
  onRanges: (ids: string[]) => void;
}) {
  const { ranges } = useAggregatedAnchorRanges(scopes);
  useEffect(() => {
    onRanges([...ranges.keys()].filter((k) => ranges.get(k) !== null));
  });
  return null;
}

describe("useAggregatedAnchorRanges", () => {
  it("resolves each scope's note within its own root", () => {
    // Тот же block-id "b1" в ДВУХ разных скоупах — каждая заметка должна
    // резолвиться в корне своего скоупа, не в чужом.
    const a = scopeEl("alpha beta");
    const b = scopeEl("alpha beta");
    const scopes: RailScopeEntry[] = [
      {
        key: "annotation:document:a",
        rootEl: a,
        tone: "annotation",
        notes: [
          {
            id: "n-a",
            anchor: {
              startBlockId: "b1",
              endBlockId: "b1",
              startChar: 0,
              endChar: 5,
              exact: "alpha",
            },
          },
        ],
        renderNote: noopRender,
      },
      {
        key: "annotation:document:b",
        rootEl: b,
        tone: "annotation",
        notes: [
          {
            id: "n-b",
            anchor: {
              startBlockId: "b1",
              endBlockId: "b1",
              startChar: 6,
              endChar: 10,
              exact: "beta",
            },
          },
        ],
        renderNote: noopRender,
      },
    ];
    let resolved: string[] = [];
    render(<Probe scopes={scopes} onRanges={(r) => (resolved = r)} />);
    expect(resolved.sort()).toEqual(["n-a", "n-b"]);
  });
});
