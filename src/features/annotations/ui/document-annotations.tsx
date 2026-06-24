// src/features/annotations/ui/document-annotations.tsx
// Server-сборщик margin-режима для документа. Фетчит видимые аннотации, считает
// права, серверно грузит AST-схему (если нужна для диалогов create/edit) один
// раз, собирает карточки общим билдером (DRY с AnnotationsSection) и связывает с
// client-коннектором под SchemaContextProvider. Связка движок↔домен.
import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

import { getAnnotationsFor } from "../api";
import { canCreateAnnotation, canEditAnnotation } from "../permissions";

import { buildAnnotationCards } from "./annotation-cards-builder";
import { DocumentAnnotationLayer } from "./document-annotation-layer";

/**
 * Margin-режим аннотаций документа. Server component: фетч + RBAC + сборка
 * карточек + связка с движком маргиналий через client-коннектор.
 *
 * Схема нужна, если пользователь может создать аннотацию (диалог-композер) или
 * редактировать хотя бы одну существующую (диалог редактирования монтирует
 * AstEditor). Грузим серверно один раз и прокидываем пропом `initial` —
 * браузер за ней не ходит.
 */
export async function DocumentAnnotations({ parentId }: { parentId: string }) {
  const [me, t] = await Promise.all([getMe(), getT("annotations")]);
  const { items } = await getAnnotationsFor("document", parentId);
  const canCreate = canCreateAnnotation(me);
  const needsSchema =
    canCreate || items.some((a) => Boolean(a.id) && canEditAnnotation(me, a));
  const astSchema = needsSchema ? await getAstSchema() : null;
  const notes = buildAnnotationCards({ items, me, astSchema });

  return (
    <section className="flex flex-col gap-4" aria-label={t("sectionLabel")}>
      <h2 className="text-lg font-semibold">{t("sectionHeading")}</h2>
      <SchemaContextProvider
        initial={astSchema ?? undefined}
        fallback={<p className="text-sm">{t("editorLoading")}</p>}
      >
        <DocumentAnnotationLayer
          parentId={parentId}
          notes={notes}
          canCreate={canCreate}
        />
      </SchemaContextProvider>
    </section>
  );
}
