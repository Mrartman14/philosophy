import { describe, expect, it } from "vitest";

import type { AstBlock } from "../types";

import { blocksToPlainText } from "./blocks-text";

describe("blocksToPlainText", () => {
  it("пустой массив → пустая строка", () => {
    expect(blocksToPlainText([])).toBe("");
  });

  it("объединяет текст блоков через двойной перевод строки", () => {
    const blocks: AstBlock[] = [{ text: "Первый" }, { text: "Второй" }];
    expect(blocksToPlainText(blocks)).toBe("Первый\n\nВторой");
  });

  it("пропускает блоки без строкового text и пустые", () => {
    const blocks: AstBlock[] = [
      { text: "A" },
      { id: "no-text-block" }, // нет text
      { text: "" }, // пустой → отфильтрован
      { text: "B" },
    ];
    expect(blocksToPlainText(blocks)).toBe("A\n\nB");
  });

  it("единственный блок → без разделителя", () => {
    expect(blocksToPlainText([{ text: "Один" }])).toBe("Один");
  });
});
