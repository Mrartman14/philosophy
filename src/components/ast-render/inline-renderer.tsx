// src/components/ast-render/inline-renderer.tsx
import type { ReactNode } from "react";
import type {
  AstMark,
  AstNode,
  AstRenderContext,
  RefLinkRenderer,
} from "./types";
import { LinkMark } from "./marks/link";
import { defaultGlossaryRef } from "./marks/glossary-ref";
import { defaultLectureRef } from "./marks/lecture-ref";
import { defaultDocumentRef } from "./marks/document-ref";
import { defaultMediaRef } from "./marks/media-ref";
import { defaultCommentRef } from "./marks/comment-ref";
import { defaultCanvasRef } from "./marks/canvas-ref";

interface Props {
  nodes: AstNode[] | undefined;
  ctx: AstRenderContext;
}

export function InlineRenderer({ nodes, ctx }: Props): ReactNode {
  if (!nodes) return null;
  return nodes.map((node, i) => {
    if (node.type === "hard_break") return <br key={i} />;
    if (node.type === "text") {
      return <TextWithMarks key={i} text={node.text ?? ""} marks={node.marks} ctx={ctx} />;
    }
    return <span key={i} data-unsupported={node.type ?? "unknown"}>{node.text ?? ""}</span>;
  });
}

interface TextWithMarksProps {
  text: string;
  marks: AstMark[] | undefined;
  ctx: AstRenderContext;
}

function TextWithMarks({ text, marks, ctx }: TextWithMarksProps): ReactNode {
  if (!marks || marks.length === 0) return text;
  return marks.reduce<ReactNode>((children, mark) => applyMark(mark, children, ctx), text);
}

function applyMark(mark: AstMark, children: ReactNode, ctx: AstRenderContext): ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong>{children}</strong>;
    case "italic":
      return <em>{children}</em>;
    case "code":
      return <code>{children}</code>;
    case "link": {
      const href = (mark.attrs as { href?: unknown } | undefined)?.href;
      return <LinkMark href={typeof href === "string" ? href : undefined}>{children}</LinkMark>;
    }
    case "glossary_ref":
      return renderRefMark(mark, children, ctx.renderGlossaryRef ?? defaultGlossaryRef);
    case "lecture_ref":
      return renderRefMark(mark, children, ctx.renderLectureRef ?? defaultLectureRef);
    case "document_ref":
      return renderRefMark(mark, children, ctx.renderDocumentRef ?? defaultDocumentRef);
    case "media_ref":
      return renderRefMark(mark, children, ctx.renderMediaRef ?? defaultMediaRef);
    case "comment_ref":
      return renderRefMark(mark, children, ctx.renderCommentRef ?? defaultCommentRef);
    case "canvas_ref":
      return renderRefMark(mark, children, ctx.renderCanvasRef ?? defaultCanvasRef);
    default: {
      // Сюда попадает только `undefined` mark.type (тип в схеме опционален) и
      // будущие mark'и — graceful fallback.
      // @ts-expect-error — drift-detector: при добавлении нового mark.type в схему,
      // TS-компилятор подсветит эту строку (нет ts-error → switch неполный).
      const _exhaustive: never = mark.type;
      if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
        console.warn(`AstRender: unsupported mark type "${String(_exhaustive)}"`);
      }
      return <span data-unsupported-mark={mark.type ?? "unknown"}>{children}</span>;
    }
  }
}

function renderRefMark(
  mark: AstMark,
  children: ReactNode,
  renderer: RefLinkRenderer
): ReactNode {
  const id = (mark.attrs as { id?: unknown } | undefined)?.id;
  if (typeof id !== "string" || id.length === 0) return <>{children}</>;
  const label = nodeToString(children);
  return renderer({ id, label });
}

function nodeToString(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToString).join("");
  if (node && typeof node === "object" && "props" in node) {
    return nodeToString((node as { props: { children: ReactNode } }).props.children);
  }
  return "";
}
