// src/components/ast-render/code-block-text.test.tsx
// Регресс: code_block хранит текст в block.text (ast-editor/serializer:
// "code_block stores text on Block.Text, no Content"), а не в content. Рендер
// обязан читать block.text — иначе код виден при правке, но пуст при просмотре.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BlockRenderer } from "./block-renderer";
import type { AstBlock } from "./types";

const markupFor = (block: AstBlock) => renderToStaticMarkup(<BlockRenderer block={block} />);

describe("BlockRenderer code_block", () => {
  it("рендерит текст кода из block.text (канонич. хранилище)", () => {
    const block = { id: "c1", type: "code_block", text: "const x = 1;" } as AstBlock;
    expect(markupFor(block)).toContain("const x = 1;");
  });

  it("фолбэк на content-text-ноды (совместимость)", () => {
    const block = {
      id: "c2",
      type: "code_block",
      content: [{ type: "text", text: "fallback();" }],
    } as AstBlock;
    expect(markupFor(block)).toContain("fallback();");
  });
});
