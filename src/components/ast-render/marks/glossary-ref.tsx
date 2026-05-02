// src/components/ast-render/marks/glossary-ref.tsx
import type { ReactNode } from "react";

export function defaultGlossaryRef({ id, label }: { id: string; label: string }): ReactNode {
  return <a href={`/glossary/${id}`}>{label}</a>;
}
