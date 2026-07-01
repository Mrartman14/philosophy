// src/features/annotations/ui/document-annotations.tsx
// Server-сборщик margin-режима для документа. Фетчит видимые аннотации, считает
// права, серверно грузит AST-схему (если нужна для диалогов create/edit) один
// раз, собирает карточки общим билдером (DRY с AnnotationsSection) и связывает с
// client-коннектором под SchemaContextProvider. Связка движок↔домен.
import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

import { getAnnotationsFor } from "../api";
import { canCreateAnnotation } from "../permissions";

import {
  buildAnnotationCards,
  loadSchemaIfNeeded,
} from "./annotation-cards-builder";
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
export async function DocumentAnnotations({
  parentId,
  token,
}: {
  parentId: string;
  /** ?token= (share-link) — доступ к аннотациям приватной лекции/документа. */
  token?: string | undefined;
}) {
  const [me, t] = await Promise.all([getMe(), getT("annotations")]);
  const { items } = await getAnnotationsFor("document", parentId, 0, 20, token);
  const canCreate = canCreateAnnotation(me);
  const astSchema = await loadSchemaIfNeeded(me, items, canCreate);
  // margin-режим: цитату якоря прячем на ≥xl (связь показывает выноска-линия), на
  // мобильном (поле схлопнуто) — оставляем.
  const notes = buildAnnotationCards({ items, me, astSchema, hideAnchorOnWide: true });

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
