// src/features/annotations/ui/annotations-section.tsx
import { SchemaContextProvider } from "@/components/ast-editor";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import { getT } from "@/i18n";
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
  const [me, t] = await Promise.all([getMe(), getT("annotations")]);
  const { items } = await getAnnotationsFor(parentEntityType, parentId);
  const canCreate = canCreateAnnotation(me);

  // Схема нужна, если пользователь может создать аннотацию или редактировать
  // хотя бы одну существующую (диалог редактирования монтирует AstEditor).
  // Грузим серверно один раз и прокидываем пропом — браузер за ней не ходит.
  const needsSchema =
    canCreate || items.some((a) => Boolean(a.id) && canEditAnnotation(me, a));
  const astSchema = needsSchema ? await getAstSchema() : null;

  return (
    <section className="flex flex-col gap-4" aria-label={t("sectionLabel")}>
      <h2 className="text-lg font-semibold">{t("sectionHeading")}</h2>

      {items.length === 0 ? (
        <p className="text-sm text-(--color-fg-muted)">{t("empty")}</p>
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
                          <AnnotationEditButton
                            annotation={a}
                            initial={astSchema ?? undefined}
                          />
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
          initial={astSchema ?? undefined}
          fallback={<p className="text-sm">{t("editorLoading")}</p>}
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
