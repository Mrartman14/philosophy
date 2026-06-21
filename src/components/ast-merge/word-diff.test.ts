import { describe, expect, it } from "vitest";

import type { AstBlock } from "@/components/ast-editor";

import { blockDiffText, wordDiff } from "./word-diff";

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

describe("blockDiffText", () => {
  it("параграф → ровно плоский текст (поведение как у block.text)", () => {
    const para: AstBlock = {
      id: "p",
      type: "paragraph",
      text: "hello world",
      content: [{ type: "text", text: "hello world" }],
    };
    expect(blockDiffText(para)).toBe("hello world");
  });

  it("параграф с несколькими инлайн-узлами не дробится разделителем", () => {
    const para: AstBlock = {
      id: "p",
      type: "paragraph",
      text: "жирный и курсив",
      content: [
        { type: "text", marks: [{ type: "bold" }], text: "жирный" },
        { type: "text", text: " и " },
        { type: "text", marks: [{ type: "italic" }], text: "курсив" },
      ],
    };
    expect(blockDiffText(para)).toBe("жирный и курсив");
  });

  it("список из двух пунктов → пункты разделены переносом строки", () => {
    const list: AstBlock = {
      id: "ul",
      type: "list",
      attrs: { ordered: false },
      content: [
        {
          type: "list_item",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "item1" }] },
          ],
        },
        {
          type: "list_item",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "item2" }] },
          ],
        },
      ],
      text: "item1item2",
    };
    expect(blockDiffText(list)).toBe("item1\nitem2");
  });

  it("структурный блок без content (image/leaf) → '' (срабатывает fallback contentChanged)", () => {
    const img: AstBlock = {
      id: "i",
      type: "image",
      text: "",
      attrs: { src: "x.png" },
    };
    expect(blockDiffText(img)).toBe("");
  });

  it("code_block без content → его plain text", () => {
    const code: AstBlock = {
      id: "c",
      type: "code_block",
      text: "func main() {}\n",
    };
    expect(blockDiffText(code)).toBe("func main() {}\n");
  });
});
