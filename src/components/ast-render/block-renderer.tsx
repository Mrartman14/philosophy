// src/components/ast-render/block-renderer.tsx
import type { ReactNode } from "react";
import type { AstBlock, AstRenderContext } from "./types";
import { InlineRenderer } from "./inline-renderer";
import { ImageNode } from "./nodes/image";

interface Props {
  block: AstBlock;
  ctx: AstRenderContext;
}

export function BlockRenderer({ block, ctx }: Props): ReactNode {
  switch (block.type) {
    case "paragraph":
      return <p><InlineRenderer nodes={block.content} ctx={ctx} /></p>;
    case "heading": {
      const level = readHeadingLevel(block.attrs);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- tsc requires the literal union for the dynamic JSX tag; ESLint mis-flags it as a no-op
      const Tag = (`h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6");
      return <Tag><InlineRenderer nodes={block.content} ctx={ctx} /></Tag>;
    }
    case "list": {
      const kind = (block.attrs as { kind?: unknown } | undefined)?.kind;
      const Tag = kind === "ordered" ? "ol" : "ul";
      const items = (block.content ?? []) as unknown as AstBlock[];
      return (
        <Tag>
          {items.map((child, i) => (
            <BlockRenderer key={child.id ?? i} block={child} ctx={ctx} />
          ))}
        </Tag>
      );
    }
    case "list_item":
      return <li><InlineRenderer nodes={block.content} ctx={ctx} /></li>;
    case "code_block": {
      const lang = (block.attrs as { language?: unknown } | undefined)?.language;
      const langStr = typeof lang === "string" ? lang : undefined;
      const text = (block.content ?? [])
        .map((n) => (n.type === "text" ? n.text ?? "" : ""))
        .join("");
      return (
        <pre data-language={langStr}>
          <code>{text}</code>
        </pre>
      );
    }
    case "image":
      return <ImageNode attrs={block.attrs} />;
    default: {
      // @ts-expect-error — drift-detector: при добавлении нового block.type в схему,
      // TS-компилятор подсветит эту строку (нет ts-error → switch неполный).
      const _exhaustive: never = block.type;
      if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
        console.warn(`AstRender: unsupported block type "${String(_exhaustive ?? "unknown")}"`);
      }
      return (
        <div data-unsupported={block.type ?? "unknown"}>
          <InlineRenderer nodes={block.content} ctx={ctx} />
        </div>
      );
    }
  }
}

function readHeadingLevel(attrs: AstBlock["attrs"]): 1 | 2 | 3 | 4 | 5 | 6 {
  const raw = (attrs as { level?: unknown } | undefined)?.level;
  if (typeof raw !== "number") return 2;
  if (raw < 1 || raw > 6) return 2;
  return raw as 1 | 2 | 3 | 4 | 5 | 6;
}
