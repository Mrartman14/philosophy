import { describe, expect, it } from "vitest";

import { wordDiff } from "./word-diff";

describe("wordDiff", () => {
  it("одинаковый текст → все same", () => {
    expect(wordDiff("hello world", "hello world")).toEqual([
      { type: "same", text: "hello" },
      { type: "same", text: " " },
      { type: "same", text: "world" },
    ]);
  });

  it("добавленное слово → add", () => {
    const tokens = wordDiff("hello world", "hello brave world");
    expect(tokens.filter((t) => t.type === "add").map((t) => t.text)).toContain(
      "brave",
    );
  });

  it("удалённое слово → del", () => {
    const tokens = wordDiff("hello brave world", "hello world");
    expect(tokens.filter((t) => t.type === "del").map((t) => t.text)).toContain(
      "brave",
    );
  });

  it("пустой base → весь side это add", () => {
    const tokens = wordDiff("", "new text");
    expect(tokens.every((t) => t.type === "add")).toBe(true);
  });

  it("реассемблируется в исходные строки", () => {
    const base = "the quick brown fox";
    const side = "the slow brown cat";
    const tokens = wordDiff(base, side);
    const reBase = tokens
      .filter((t) => t.type !== "add")
      .map((t) => t.text)
      .join("");
    const reSide = tokens
      .filter((t) => t.type !== "del")
      .map((t) => t.text)
      .join("");
    expect(reBase).toBe(base);
    expect(reSide).toBe(side);
  });
});
