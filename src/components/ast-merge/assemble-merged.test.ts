import { describe, expect, it } from "vitest";

import type { AstBlock } from "@/components/ast-editor";

import { assembleMerged } from "./assemble-merged";
import type { MergeEntry } from "./types";

function block(id: string, text: string): AstBlock {
  return { id, type: "paragraph", text };
}
function entry(over: Partial<MergeEntry>): MergeEntry {
  return {
    key: "k",
    id: "k",
    status: "unchanged",
    base: null,
    mine: null,
    theirs: null,
    ...over,
  };
}

describe("assembleMerged", () => {
  it("server-only/added-server берёт theirs; mine-only/added-mine берёт mine", () => {
    const entries: MergeEntry[] = [
      entry({ key: "a", status: "server-only", theirs: block("a", "srv"), mine: block("a", "old") }),
      entry({ key: "b", status: "mine-only", mine: block("b", "mine"), theirs: block("b", "old") }),
    ];
    const out = assembleMerged(entries, {});
    expect(out.map((b) => b.text)).toEqual(["srv", "mine"]);
  });

  it("removed-* выкидываются из результата", () => {
    const entries: MergeEntry[] = [
      entry({ key: "a", status: "unchanged", theirs: block("a", "A"), mine: block("a", "A") }),
      entry({ key: "b", status: "removed-server", mine: block("b", "B") }),
    ];
    expect(assembleMerged(entries, {}).map((b) => b.text)).toEqual(["A"]);
  });

  it("conflict: выбор theirs берёт серверный блок", () => {
    const entries: MergeEntry[] = [
      entry({ key: "c", status: "conflict", mine: block("c", "mine"), theirs: block("c", "srv") }),
    ];
    expect(assembleMerged(entries, { c: "theirs" }).map((b) => b.text)).toEqual([
      "srv",
    ]);
  });

  it("structural-conflict: я удалил, выбор mine → блок выпадает", () => {
    const entries: MergeEntry[] = [
      entry({ key: "d", status: "structural-conflict", mine: null, theirs: block("d", "srv") }),
    ];
    expect(assembleMerged(entries, { d: "mine" })).toEqual([]);
  });

  it("перештамповывает position по финальному порядку", () => {
    const entries: MergeEntry[] = [
      entry({ key: "a", status: "unchanged", theirs: block("a", "A"), mine: block("a", "A") }),
      entry({ key: "b", status: "added-server", theirs: block("b", "B") }),
    ];
    expect(assembleMerged(entries, {}).map((b) => b.position)).toEqual([0, 1]);
  });
});
