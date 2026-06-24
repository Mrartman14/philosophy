// src/features/annotations/ui/annotations-section.tsx
import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

import { getAnnotationsFor } from "../api";
import { canCreateAnnotation, canEditAnnotation } from "../permissions";
import type { ParentEntityType } from "../types";

import { buildAnnotationCards } from "./annotation-cards-builder";
import { AnnotationCreateForm } from "./annotation-create-form";

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

  // Сборка карточек вынесена в общий server-хелпер (DRY: тот же билдер питает
  // margin-режим DocumentAnnotations). Секция отвечает лишь за list-каркас.
  const cards = buildAnnotationCards({ items, me, astSchema });

  return (
    <section className="flex flex-col gap-4" aria-label={t("sectionLabel")}>
      <h2 className="text-lg font-semibold">{t("sectionHeading")}</h2>

      {items.length === 0 ? (
        <p className="text-sm text-(--color-fg-muted)">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map((vm) => (
            <li key={vm.id}>{vm.card}</li>
          ))}
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
