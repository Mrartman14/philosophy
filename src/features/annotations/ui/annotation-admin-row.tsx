// src/features/annotations/ui/annotation-admin-row.tsx
import { AstRender } from "@/components/ast-render";

import type { Annotation } from "../types";

import { AnnotationDeleteButton } from "./annotation-delete-button";

interface Props {
  annotation: Annotation;
  /** Можно ли админски удалить (delete_any ∧ public) — вычислено на сервере. */
  canAdminDelete: boolean;
}

/** Строка admin-списка публичных аннотаций. */
export function AnnotationAdminRow({ annotation, canAdminDelete }: Props) {
  return (
    <article className="flex flex-col gap-2 rounded border border-(--color-border) p-3">
      <header className="flex items-center justify-between gap-2 text-xs text-(--color-description)">
        <span>
          {annotation.parent_entity_type} · {annotation.parent_entity_id}
        </span>
        <span>автор: {annotation.owner_id}</span>
      </header>
      <div className="content" data-size="sm">
        <AstRender blocks={annotation.blocks ?? []} />
      </div>
      {canAdminDelete && annotation.id && (
        <div>
          <AnnotationDeleteButton annotationId={annotation.id} admin />
        </div>
      )}
    </article>
  );
}
