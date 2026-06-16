// src/features/annotations/ui/annotations-section.tsx
import { SchemaContextProvider } from "@/components/ast-editor";
import { getMe } from "@/utils/me";

import { getAnnotationsFor } from "../api";
import { canCreateAnnotation, canEditAnnotation } from "../permissions";
import type { ParentEntityType } from "../types";

import { AnnotationAnchorContext } from "./annotation-anchor-context";
import { AnnotationCard } from "./annotation-card";
import { AnnotationCreateForm } from "./annotation-create-form";
import { AnnotationDeleteButton } from "./annotation-delete-button";
import { AnnotationEditButton } from "./annotation-edit-button";
import { AnnotationExportLinks } from "./annotation-export-links";

interface Props {
  parentEntityType: ParentEntityType;
  parentId: string;
}

/**
 * Единая секция аннотаций для страницы сущности. Server component:
 *  - фетчит видимые аннотации (бек применяет матрицу видимости);
 *  - рендерит карточки + действия (export/delete для автора);
 *  - под формой — SchemaContextProvider + AnnotationCreateForm (если есть
 *    capability annotation.create).
 *
 * Интегрируется в страницы document/glossary/media/comment одним JSX-узлом.
 */
export async function AnnotationsSection({ parentEntityType, parentId }: Props) {
  const me = await getMe();
  const { items } = await getAnnotationsFor(parentEntityType, parentId);
  const canCreate = canCreateAnnotation(me);

  return (
    <section className="flex flex-col gap-4" aria-label="Аннотации">
      <h2 className="text-lg font-semibold">Аннотации</h2>

      {items.length === 0 ? (
        <p className="text-sm text-(--color-description)">Аннотаций пока нет.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => {
            const ownEditable = canEditAnnotation(me, a);
            return (
              <li key={a.id}>
                <AnnotationCard
                  annotation={a}
                  anchorContext={<AnnotationAnchorContext anchor={a.anchor} />}
                  actions={
                    <>
                      {a.id && <AnnotationExportLinks id={a.id} />}
                      {ownEditable && a.id && (
                        <>
                          <AnnotationEditButton annotation={a} />
                          <AnnotationDeleteButton annotationId={a.id} />
                        </>
                      )}
                    </>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {canCreate && (
        <SchemaContextProvider
          fallback={<p className="text-sm">Загрузка редактора…</p>}
        >
          <AnnotationCreateForm
            parentEntityType={parentEntityType}
            parentId={parentId}
          />
        </SchemaContextProvider>
      )}
    </section>
  );
}
