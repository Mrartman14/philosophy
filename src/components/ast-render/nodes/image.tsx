// src/components/ast-render/nodes/image.tsx
import type { ReactNode } from "react";

interface Props {
  attrs: Record<string, unknown> | undefined;
}

export function ImageNode({ attrs }: Props): ReactNode {
  const src = attrs?.src;
  const alt = attrs?.alt;
  if (typeof src !== "string" || src.length === 0) {
    return <div data-unsupported="image" data-reason="missing-src" />;
  }
  return (
    // AstRender — server-only, intentionally uses native <img> to avoid client-side next/image runtime; see docs/superpowers/specs/2026-05-02-glossary-feature-design.md §4.1
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={typeof alt === "string" ? alt : ""}
      loading="lazy"
    />
  );
}
