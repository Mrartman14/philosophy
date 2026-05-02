// src/components/ast-render/__fixtures__/blocks.ts
import type { AstBlock } from "../types";

export const PARAGRAPH_PLAIN: AstBlock = {
  id: "p1",
  type: "paragraph",
  content: [{ type: "text", text: "Простой текст." }],
};

export const PARAGRAPH_WITH_BOLD: AstBlock = {
  id: "p2",
  type: "paragraph",
  content: [
    { type: "text", text: "Жирное " },
    { type: "text", text: "слово", marks: [{ type: "bold" }] },
    { type: "text", text: "." },
  ],
};

export const PARAGRAPH_WITH_HARD_BREAK: AstBlock = {
  id: "p3",
  type: "paragraph",
  content: [
    { type: "text", text: "Первая строка" },
    { type: "hard_break" },
    { type: "text", text: "Вторая строка" },
  ],
};
