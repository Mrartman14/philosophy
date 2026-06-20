import { describe, expect, it } from "vitest";

import type { AstBlock } from "@/components/ast-editor";

import { classifyBlocks } from "./classify-blocks";
import type { MergeEntry } from "./types";

function p(id: string, text: string): AstBlock {
  return { id, type: "paragraph", text, content: [{ type: "text", text }] };
}
function statusById(entries: MergeEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of entries) out[e.key] = e.status;
  return out;
}

describe("classifyBlocks", () => {
  it("ничего не менялось → все unchanged", () => {
    const base = [p("a", "A"), p("b", "B")];
    const entries = classifyBlocks(base, base, base);
    expect(entries.map((e) => e.status)).toEqual(["unchanged", "unchanged"]);
  });

  it("я изменил блок, сервер нет → mine-only", () => {
    const base = [p("a", "A")];
    const mine = [p("a", "A2")];
    const theirs = [p("a", "A")];
    expect(statusById(classifyBlocks(base, mine, theirs))).toEqual({
      a: "mine-only",
    });
  });

  it("сервер изменил блок, я нет → server-only", () => {
    const base = [p("a", "A")];
    const mine = [p("a", "A")];
    const theirs = [p("a", "A2")];
    expect(statusById(classifyBlocks(base, mine, theirs))).toEqual({
      a: "server-only",
    });
  });

  it("изменили оба по-разному → conflict", () => {
    const base = [p("a", "A")];
    const mine = [p("a", "A-mine")];
    const theirs = [p("a", "A-srv")];
    expect(statusById(classifyBlocks(base, mine, theirs))).toEqual({
      a: "conflict",
    });
  });

  it("изменили оба одинаково → unchanged", () => {
    const base = [p("a", "A")];
    const same = [p("a", "A-same")];
    expect(statusById(classifyBlocks(base, same, same))).toEqual({
      a: "unchanged",
    });
  });

  it("сервер добавил блок → added-server в порядке theirs", () => {
    const base = [p("a", "A")];
    const mine = [p("a", "A")];
    const theirs = [p("a", "A"), p("b", "B")];
    const entries = classifyBlocks(base, mine, theirs);
    expect(entries.map((e) => `${e.key}:${e.status}`)).toEqual([
      "a:unchanged",
      "b:added-server",
    ]);
  });

  it("я добавил несохранённый блок (пустой id) → added-mine после предшественника", () => {
    const base = [p("a", "A")];
    const mine = [p("a", "A"), { id: "", type: "paragraph", text: "NEW" }];
    const theirs = [p("a", "A")];
    const entries = classifyBlocks(base, mine, theirs);
    expect(entries.map((e) => e.status)).toEqual(["unchanged", "added-mine"]);
    expect(entries[1].mine?.text).toBe("NEW");
  });

  it("я удалил, сервер не трогал → removed-mine", () => {
    const base = [p("a", "A"), p("b", "B")];
    const mine = [p("a", "A")];
    const theirs = [p("a", "A"), p("b", "B")];
    expect(statusById(classifyBlocks(base, mine, theirs)).b).toBe("removed-mine");
  });

  it("сервер удалил, я не трогал → removed-server", () => {
    const base = [p("a", "A"), p("b", "B")];
    const mine = [p("a", "A"), p("b", "B")];
    const theirs = [p("a", "A")];
    expect(statusById(classifyBlocks(base, mine, theirs)).b).toBe(
      "removed-server",
    );
  });

  it("я удалил, сервер изменил → structural-conflict", () => {
    const base = [p("a", "A"), p("b", "B")];
    const mine = [p("a", "A")];
    const theirs = [p("a", "A"), p("b", "B2")];
    expect(statusById(classifyBlocks(base, mine, theirs)).b).toBe(
      "structural-conflict",
    );
  });

  it("сервер удалил, я изменил → structural-conflict", () => {
    const base = [p("a", "A"), p("b", "B")];
    const mine = [p("a", "A"), p("b", "B2")]; // я изменил b
    const theirs = [p("a", "A")]; // сервер удалил b
    expect(statusById(classifyBlocks(base, mine, theirs)).b).toBe(
      "structural-conflict",
    );
  });
});
