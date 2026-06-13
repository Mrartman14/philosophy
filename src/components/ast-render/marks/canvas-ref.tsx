// src/components/ast-render/marks/canvas-ref.tsx
import type { ReactNode } from "react";

export function defaultCanvasRef({ id, label }: { id: string; label: string }): ReactNode {
  return <a href={`/canvases/${id}`}>{label}</a>;
}
