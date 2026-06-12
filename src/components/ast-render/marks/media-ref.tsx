// src/components/ast-render/marks/media-ref.tsx
import type { ReactNode } from "react";

export function defaultMediaRef({ id, label }: { id: string; label: string }): ReactNode {
  return <a href={`/media/${id}`}>{label}</a>;
}
