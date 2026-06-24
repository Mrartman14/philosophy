// src/components/ast-toc/extract-headings.test.ts
import { describe, it, expect } from "vitest";

import type { AstBlock } from "@/components/ast-render";

import { extractHeadings } from "./extract-headings";

describe("extractHeadings", () => {
  it("извлекает заголовки с id, level, text; пропускает не-заголовки", () => {
    const blocks: AstBlock[] = [
      { id: "h-a", type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Введение" }] },
      { id: "p", type: "paragraph", content: [{ type: "text", text: "абзац" }] },
      { id: "h-b", type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Глава" }] },
    ];
    expect(extractHeadings(blocks)).toEqual([
      { id: "h-a", level: 1, text: "Введение" },
      { id: "h-b", level: 2, text: "Глава" },
    ]);
  });

  it("предпочитает предвычисленный block.text", () => {
    const blocks: AstBlock[] = [
      { id: "h", type: "heading", attrs: { level: 2 }, text: "Готовый", content: [{ type: "text", text: "игнор" }] },
    ];
    expect(extractHeadings(blocks)).toEqual([{ id: "h", level: 2, text: "Готовый" }]);
  });

  it("собирает текст из вложенных inline-нод, когда block.text отсутствует", () => {
    const blocks: AstBlock[] = [
      {
        id: "h",
        type: "heading",
        attrs: { level: 3 },
        content: [
          { type: "text", text: "Тех" },
          { type: "text", text: "ника", marks: [{ type: "bold" }] },
        ],
      },
    ];
    expect(extractHeadings(blocks)[0]).toEqual({ id: "h", level: 3, text: "Техника" });
  });

  it("дефолт уровня 2 без attrs.level", () => {
    const blocks: AstBlock[] = [
      { id: "h", type: "heading", content: [{ type: "text", text: "X" }] },
    ];
    expect(extractHeadings(blocks)[0]?.level).toBe(2);
  });

  it("фолбэк-id берёт позицию в ПОЛНОМ массиве (паритет с рендером)", () => {
    const blocks: AstBlock[] = [
      { type: "paragraph", content: [{ type: "text", text: "intro" }] },
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "H" }] },
    ];
    expect(extractHeadings(blocks)[0]?.id).toBe("heading-1");
  });

  it("пустой ввод → []", () => {
    expect(extractHeadings([])).toEqual([]);
  });
});
