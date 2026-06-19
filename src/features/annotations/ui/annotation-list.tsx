// src/features/annotations/ui/annotation-list.tsx
import { getT } from "@/i18n";

import type { Annotation } from "../types";

import { AnnotationCard } from "./annotation-card";

interface Props {
  annotations: Annotation[];
  /** Рендер действий для каждой аннотации (по id). */
  renderActions?: (annotation: Annotation) => React.ReactNode;
  emptyText?: string;
}

/** Server-компонент: список карточек аннотаций. */
export async function AnnotationList({
  annotations,
  renderActions,
  emptyText,
}: Props) {
  const t = await getT("annotations");
  const empty = emptyText ?? t("empty");
  if (annotations.length === 0) {
    return <p className="text-sm text-(--color-fg-muted)">{empty}</p>;
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
