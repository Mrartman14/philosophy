// src/components/ast-render/ast-render-bidi.test.tsx
import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";

import { BlockRenderer } from "./block-renderer";
import { InlineRenderer } from "./inline-renderer";
import type { AstBlock, AstNode, AstRenderContext } from "./types";

afterEach(cleanup);

const ctx: AstRenderContext = {};

const CODE_BLOCK: AstBlock = {
  id: "code-bidi",
  type: "code_block",
  attrs: { language: "ts" },
  content: [{ type: "text", text: "const x = 1;" }],
};

describe("ast-render bidi-изоляция (always-LTR код)", () => {
  it("code-блок несёт dir=ltr на <pre> (bidi не рвёт код в RTL)", () => {
    const { container } = render(<BlockRenderer block={CODE_BLOCK} ctx={ctx} index={0} />);
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre?.getAttribute("dir")).toBe("ltr");
  });

  it("inline-код несёт dir=ltr на <code>", () => {
    const nodes: AstNode[] = [
      { type: "text", text: "process.env", marks: [{ type: "code" }] },
    ];
    const { container } = render(<InlineRenderer nodes={nodes} ctx={ctx} />);
    const code = container.querySelector("code");
    expect(code).not.toBeNull();
    expect(code?.getAttribute("dir")).toBe("ltr");
  });
});
