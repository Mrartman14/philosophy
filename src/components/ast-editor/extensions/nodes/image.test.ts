import { getSchema } from "@tiptap/core";
import { Node as PMNode, DOMSerializer, DOMParser as PMDOMParser } from "@tiptap/pm/model";
import { describe, it, expect } from "vitest";

import type { SchemaSnapshot } from "../../types";
import { buildExtensions } from "../index";

const fullSnapshot: SchemaSnapshot = {
  blockLevels: { full: ["paragraph", "image"] },
  entityBlockLimits: { full: 100 },
  entityContexts: { document: "full" },
  limits: {
    maxDepth: 32,
    maxTextLen: 1_000_000,
    maxContentItems: 10_000,
    maxMarksPerNode: 100,
  },
  urlPolicy: { dangerousSchemes: [] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

const extensions = buildExtensions({ snapshot: fullSnapshot, context: "document" });
const schema = getSchema(extensions);

describe("ImageExt parseHTML/renderHTML", () => {
  it("renderHTML emits data-storage-key/alt/caption/block-id", () => {
    if (!schema.nodes.image) throw new Error("schema.nodes.image не зарегистрирован");
    const node = schema.nodes.image.create({
      storage_key: "abc",
      alt: "alpha",
      caption: "cap",
      blockId: "b-1",
    });
    const dom = DOMSerializer.fromSchema(schema).serializeNode(node);
    const wrap = document.createElement("div");
    wrap.appendChild(dom);
    const fig = wrap.querySelector("figure[data-ast-image]");
    expect(fig).not.toBeNull();
    if (fig === null) throw new Error("figure не найден");
    expect(fig.getAttribute("data-storage-key")).toBe("abc");
    expect(fig.getAttribute("data-alt")).toBe("alpha");
    expect(fig.getAttribute("data-caption")).toBe("cap");
    expect(fig.getAttribute("data-block-id")).toBe("b-1");
  });

  it("renderHTML emits <img> and <figcaption> children for SSR / getHTML", () => {
    if (!schema.nodes.image) throw new Error("schema.nodes.image не зарегистрирован");
    const node = schema.nodes.image.create({
      storage_key: "abc",
      alt: "alpha",
      caption: "look",
      blockId: "b-1",
    });
    const dom = DOMSerializer.fromSchema(schema).serializeNode(node);
    const wrap = document.createElement("div");
    wrap.appendChild(dom);
    const img = wrap.querySelector("figure[data-ast-image] > img");
    expect(img).not.toBeNull();
    if (img === null) throw new Error("img не найден");
    expect(img.getAttribute("src")).toContain("/static/files/abc");
    expect(img.getAttribute("alt")).toBe("alpha");
    const figcap = wrap.querySelector("figure[data-ast-image] > figcaption");
    expect(figcap).not.toBeNull();
    if (figcap === null) throw new Error("figcaption не найден");
    expect(figcap.textContent).toBe("look");
  });

  it("renderHTML omits children when storage_key/caption are empty", () => {
    if (!schema.nodes.image) throw new Error("schema.nodes.image не зарегистрирован");
    const node = schema.nodes.image.create({
      storage_key: "",
      alt: "",
      caption: "",
      blockId: "",
    });
    const dom = DOMSerializer.fromSchema(schema).serializeNode(node);
    const wrap = document.createElement("div");
    wrap.appendChild(dom);
    expect(wrap.querySelector("figure[data-ast-image] > img")).toBeNull();
    expect(wrap.querySelector("figure[data-ast-image] > figcaption")).toBeNull();
  });

  it("renderHTML omits attrs when empty (no noisy attributes in serialized HTML)", () => {
    if (!schema.nodes.image) throw new Error("schema.nodes.image не зарегистрирован");
    const node = schema.nodes.image.create({
      storage_key: "",
      alt: "",
      caption: "",
      blockId: "",
    });
    const dom = DOMSerializer.fromSchema(schema).serializeNode(node);
    const wrap = document.createElement("div");
    wrap.appendChild(dom);
    const fig = wrap.querySelector("figure[data-ast-image]");
    expect(fig).not.toBeNull();
    if (fig === null) throw new Error("figure не найден");
    expect(fig.hasAttribute("data-storage-key")).toBe(false);
    expect(fig.hasAttribute("data-alt")).toBe(false);
    expect(fig.hasAttribute("data-caption")).toBe(false);
    expect(fig.hasAttribute("data-block-id")).toBe(false);
  });

  it("parseHTML round-trips storage_key/alt/caption/blockId", () => {
    const html = `<figure data-ast-image data-storage-key="def" data-alt="bb" data-caption="ccap" data-block-id="b-2"></figure>`;
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    const parsed = PMDOMParser.fromSchema(schema).parse(wrap);
    let imageNode: PMNode | null = null;
    parsed.descendants((n) => {
      if (n.type.name === "image") imageNode = n;
    });
    expect(imageNode).not.toBeNull();
    if (imageNode === null) throw new Error("image-узел не найден");
    const attrs = imageNode.attrs as { storage_key: string; alt: string; caption: string; blockId: string };
    expect(attrs.storage_key).toBe("def");
    expect(attrs.alt).toBe("bb");
    expect(attrs.caption).toBe("ccap");
    expect(attrs.blockId).toBe("b-2");
  });
});
