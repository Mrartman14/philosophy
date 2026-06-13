// src/components/ast-render/types.ts
import type { components } from "@/api/schema";
import type { ReactNode } from "react";

export type AstBlock = components["schemas"]["ast.Block"];
export type AstNode = components["schemas"]["ast.Node"];
export type AstMark = components["schemas"]["ast.Mark"];
export type AstNodeType = components["schemas"]["ast.NodeType"];
export type AstMarkType = components["schemas"]["ast.MarkType"];

export interface AstRenderProps {
  blocks: AstBlock[];
  ctx?: AstRenderContext;
}

export interface AstRenderContext {
  /** Override how `glossary_ref` mark is rendered. Default: <a href="/glossary/{id}">{label}</a>. */
  renderGlossaryRef?: RefLinkRenderer;
  /** Override how `lecture_ref` mark is rendered. Default: <a href="/lectures/{id}">{label}</a>. */
  renderLectureRef?: RefLinkRenderer;
  /** Override how `document_ref` mark is rendered. Default: <a href="/documents/{id}">{label}</a>. */
  renderDocumentRef?: RefLinkRenderer;
  /** Override how `media_ref` mark is rendered. Default: <a href="/media/{id}">{label}</a>. */
  renderMediaRef?: RefLinkRenderer;
  /** Override how `comment_ref` mark is rendered. Default: <a href="/comments/{id}">{label}</a>. */
  renderCommentRef?: RefLinkRenderer;
  /** Override how `canvas_ref` mark is rendered. Default: <a href="/canvases/{id}">{label}</a>. */
  renderCanvasRef?: RefLinkRenderer;
}

export type RefLinkRenderer = (props: { id: string; label: string }) => ReactNode;
