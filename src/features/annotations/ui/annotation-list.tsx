// src/features/annotations/ui/annotation-list.tsx
import type { Annotation } from "../types";
import { AnnotationCard } from "./annotation-card";

interface Props {
  annotations: Annotation[];
  /** Рендер действий для каждой аннотации (по id). */
  renderActions?: (annotation: Annotation) => React.ReactNode;
  emptyText?: string;
}

/** Server-компонент: список карточек аннотаций. */
export function AnnotationList({
  annotations,
  renderActions,
  emptyText = "Аннотаций пока нет.",
}: Props) {
  if (annotations.length === 0) {
    return <p className="text-sm text-(--color-description)">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {annotations.map((a) => (
        <li key={a.id}>
          <AnnotationCard annotation={a} actions={renderActions?.(a)} />
        </li>
      ))}
    </ul>
  );
}
