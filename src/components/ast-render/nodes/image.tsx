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
    <img
      src={src}
      alt={typeof alt === "string" ? alt : ""}
      loading="lazy"
    />
  );
}
