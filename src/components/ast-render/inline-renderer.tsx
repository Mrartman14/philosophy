// src/components/ast-render/inline-renderer.tsx
import type { ReactNode } from "react";

import {
  HOLE,
  MARK_MAP,
  SANITIZE_HREF_MARKS,
  type NeutralSpec,
} from "@/components/ast-content-map";
import { log } from "@/services/observability/client";

import { isExternalHref, isSafeHref } from "./safe-href";
import { specToReact } from "./spec-to-react";
import type { AstMark, AstNode } from "./types";

interface Props {
  nodes: AstNode[] | undefined;
}

export function InlineRenderer({ nodes }: Props): ReactNode {
  if (!nodes) return null;
  return nodes.map((node, i) => {
    if (node.type === "hard_break") return <br key={i} />;
    if (node.type === "text") {
      return <TextWithMarks key={i} text={node.text ?? ""} marks={node.marks} />;
    }
    return (
      <span key={i} data-unsupported={node.type ?? "unknown"}>
        {node.text ?? ""}
      </span>
    );
  });
}

interface TextWithMarksProps {
  text: string;
  marks: AstMark[] | undefined;
}

function TextWithMarks({ text, marks }: TextWithMarksProps): ReactNode {
  if (!marks || marks.length === 0) return text;
  return marks.reduce<ReactNode>((children, mark) => applyMark(mark, children), text);
}

function applyMark(mark: AstMark, children: ReactNode): ReactNode {
  const type = mark.type;
  const renderer = type ? MARK_MAP[type] : undefined;
  if (!renderer) {
    // undefined mark.type (опционален в схеме) или будущая марка — graceful
    // fallback + лог. Полнота MARK_MAP сторожится map-completeness.test.ts:
    // исчерпывающий Record<AstMarkType> ломает компиляцию при дрейфе schema.ts.
    const label = (mark.type as string | undefined) ?? "unknown";
    log.warn(`AstRender: unsupported mark type "${label}"`, { markType: label });
    return <span data-unsupported-mark={label}>{children}</span>;
  }

  const wrapped = renderer(mark);
  // MARK_MAP вернул null (например, nav-ref с пустым id) → голые дети.
  if (wrapped === null) return <>{children}</>;

  const [tag, attrs] = wrapped;
  // READ-only санитайз пользовательского href (link). nav-ref href из id —
  // доверенный, в SANITIZE_HREF_MARKS не входит.
  if (type && SANITIZE_HREF_MARKS.has(type)) {
    const href = attrs.href;
    if (!isSafeHref(href)) return <>{children}</>;
    const enhanced = isExternalHref(href)
      ? { ...attrs, rel: "noopener noreferrer", target: "_blank" }
      : attrs;
    const spec: NeutralSpec = [tag, enhanced, HOLE];
    return specToReact(spec, children);
  }

  const spec: NeutralSpec = [tag, attrs, HOLE];
  return specToReact(spec, children);
}
