import { describe, it, expect } from "vitest";

import { serialize } from "./serializer";
import type { ProseMirrorJSON } from "./serializer";

describe("serializer", () => {
  it("paragraph with text", () => {
    const doc: ProseMirrorJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { blockId: "p1" },
          content: [{ type: "text", text: "Привет" }],
        },
      ],
    };
    expect(serialize(doc)).toEqual([
      {
        id: "p1",
        type: "paragraph",
        position: 0,
        content: [{ type: "text", text: "Привет" }],
        text: "Привет",
      },
    ]);
  });

  it("new block (no blockId) gets empty id", () => {
    const doc: ProseMirrorJSON = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "новый" }] },
      ],
    };
    expect(serialize(doc)[0]?.id).toBe("");
  });

  it("code_block stores text on Block.Text, no Content", () => {
    const doc: ProseMirrorJSON = {
      type: "doc",
      content: [
        {
          type: "code_block",
          attrs: { blockId: "cb1", language: "go" },
          content: [{ type: "text", text: "func main() {}" }],
        },
      ],
    };
    const out = serialize(doc);
    expect(out).toEqual([
      {
        id: "cb1",
        type: "code_block",
        position: 0,
        attrs: { language: "go" },
        text: "func main() {}",
      },
    ]);
    expect(out[0]?.content).toBeUndefined();
  });

  it("link mark gets href + title attrs", () => {
    const doc: ProseMirrorJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { blockId: "p1" },
          content: [
            {
              type: "text",
              text: "click",
              marks: [{ type: "link", attrs: { href: "https://x", title: "y" } }],
            },
          ],
        },
      ],
    };
    expect(serialize(doc)[0]?.content?.[0]?.marks).toEqual([
      { type: "link", attrs: { href: "https://x", title: "y" } },
    ]);
  });

  it("nav-ref mark drops null attrs", () => {
    const doc: ProseMirrorJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { blockId: "p1" },
          content: [
            {
              type: "text",
              text: "ссылка",
              marks: [
                {
                  type: "glossary_ref",
                  attrs: { id: "uuid", start_block_id: null, start_char: null },
                },
              ],
            },
          ],
        },
      ],
    };
    expect(serialize(doc)[0]?.content?.[0]?.marks?.[0]).toEqual({
      type: "glossary_ref",
      attrs: { id: "uuid" },
    });
  });
});
