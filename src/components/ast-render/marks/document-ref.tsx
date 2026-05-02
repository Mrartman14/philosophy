// src/components/ast-render/marks/document-ref.tsx
import type { ReactNode } from "react";

export function defaultDocumentRef({ id, label }: { id: string; label: string }): ReactNode {
  return <a href={`/documents/${id}`}>{label}</a>;
}
