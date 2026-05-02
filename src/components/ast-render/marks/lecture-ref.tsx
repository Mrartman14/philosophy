// src/components/ast-render/marks/lecture-ref.tsx
import type { ReactNode } from "react";

export function defaultLectureRef({ id, label }: { id: string; label: string }): ReactNode {
  return <a href={`/lectures/${id}`}>{label}</a>;
}
