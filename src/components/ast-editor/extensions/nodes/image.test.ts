import { describe, it, expect } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node as PMNode, DOMSerializer, DOMParser as PMDOMParser } from "@tiptap/pm/model";
import { buildExtensions } from "../index";
import type { SchemaSnapshot } from "../../types";

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
    const node = schema.nodes["image"]!.create({
      storage_key: "abc",
      alt: "alpha",
      caption: "cap",
      blockId: "b-1",
    });
    const dom = DOMSerializer.fromSchema(schema).serializeNode(node);
    const wrap = document.createElement("div");
    wrap.appendChild(dom);
    const fig = wrap.querySelector("figure[data-ast-image]")!;
    expect(fig).not.toBeNull();
    expect(fig.getAttribute("data-storage-key")).toBe("abc");
    expect(fig.getAttribute("data-alt")).toBe("alpha");
    expect(fig.getAttribute("data-caption")).toBe("cap");
    expect(fig.getAttribute("data-block-id")).toBe("b-1");
  });

  it("renderHTML emits <img> and <figcaption> children for SSR / getHTML", () => {
    const node = schema.nodes["image"]!.create({
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
    expect(img!.getAttribute("src")).toContain("/static/files/abc");
    expect(img!.getAttribute("alt")).toBe("alpha");
    const figcap = wrap.querySelector("figure[data-ast-image] > figcaption");
    expect(figcap).not.toBeNull();
    expect(figcap!.textContent).toBe("look");
  });

  it("renderHTML omits children when storage_key/caption are empty", () => {
    const node = schema.nodes["image"]!.create({
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
    const node = schema.nodes["image"]!.create({
      storage_key: "",
      alt: "",
      caption: "",
      blockId: "",
    });
    const dom = DOMSerializer.fromSchema(schema).serializeNode(node);
    const wrap = document.createElement("div");
    wrap.appendChild(dom);
    const fig = wrap.querySelector("figure[data-ast-image]")!;
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
    expect(imageNode!.attrs["storage_key"]).toBe("def");
    expect(imageNode!.attrs["alt"]).toBe("bb");
    expect(imageNode!.attrs["caption"]).toBe("ccap");
    expect(imageNode!.attrs["blockId"]).toBe("b-2");
  });
});
