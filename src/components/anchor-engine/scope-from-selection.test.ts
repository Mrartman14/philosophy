import { describe, expect, it } from "vitest";

import { scopeFromSelection } from "./scope-from-selection";
import { must } from "./test-support";

function selectWithin(startId: string, endId: string): Selection {
  const sel = must(window.getSelection());
  sel.removeAllRanges();
  const r = document.createRange();
  r.setStart(must(must(document.getElementById(startId)).firstChild), 0);
  r.setEnd(must(must(document.getElementById(endId)).firstChild), 1);
  sel.addRange(r);
  return sel;
}

describe("scopeFromSelection", () => {
  it("returns scope when both endpoints share one scope", () => {
    document.body.innerHTML =
      '<div data-anchor-scope="comment:c1"><p data-block-id="b1"><span id="a">alpha</span> <span id="b">beta</span></p></div>';
    const found = scopeFromSelection(selectWithin("a", "b"));
    expect(found?.scope).toEqual({ entityType: "comment", entityId: "c1" });
  });

  it("returns null when endpoints fall in different scopes", () => {
    document.body.innerHTML =
      '<div data-anchor-scope="comment:c1"><p data-block-id="b1"><span id="a">alpha</span></p></div>' +
      '<div data-anchor-scope="document:d1"><p data-block-id="b2"><span id="b">beta</span></p></div>';
    expect(scopeFromSelection(selectWithin("a", "b"))).toBeNull();
  });

  it("returns null for collapsed/empty selection", () => {
    document.body.innerHTML =
      '<div data-anchor-scope="document:d1"><p data-block-id="b1"><span id="a">x</span></p></div>';
    const sel = must(window.getSelection());
    sel.removeAllRanges();
    expect(scopeFromSelection(sel)).toBeNull();
  });
});
