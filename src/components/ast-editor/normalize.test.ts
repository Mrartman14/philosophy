import { describe, expect, it } from "vitest";

import { normalizeBlocks } from "./normalize";
import type { AstBlock } from "./types";

describe("normalizeBlocks", () => {
  it("приводит серверный блок (без text, иной порядок ключей) к канонической форме", () => {
    // Серверная форма из GET: произвольный порядок ключей, `text` отсутствует.
    const serverShaped: AstBlock = {
      type: "paragraph",
      id: "a",
      content: [{ type: "text", text: "Hello" }],
    } as AstBlock;

    const [block] = normalizeBlocks([serverShaped]);

    // `text` теперь заполнен (extractText) — это чинит и word-diff.
    expect(block?.text).toBe("Hello");
    // Канонический набор полей редактора: id, type, position, content, text.
    expect(block).toEqual({
      id: "a",
      type: "paragraph",
      position: 0,
      content: [{ type: "text", text: "Hello" }],
      text: "Hello",
    });
  });

  it("идемпотентна: normalizeBlocks(normalizeBlocks(x)) === normalizeBlocks(x)", () => {
    const input: AstBlock[] = [
      {
        type: "paragraph",
        id: "a",
        content: [{ type: "text", text: "Hello" }],
      } as AstBlock,
      {
        type: "code_block",
        id: "b",
        attrs: { language: "go" },
        text: "func main() {}",
      } as AstBlock,
    ];

    const once = normalizeBlocks(input);
    const twice = normalizeBlocks(once);
    expect(twice).toEqual(once);
  });
});
