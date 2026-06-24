// src/features/annotations/ui/annotation-cards-builder.tsx
import "server-only";
import type { ReactNode } from "react";

import type { SchemaResponse } from "@/components/ast-editor";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import type { Me } from "@/utils/me";

import { canEditAnnotation } from "../permissions";
import type { Anchor, Annotation } from "../types";

import { AnnotationAnchorContext } from "./annotation-anchor-context";
import { AnnotationCard } from "./annotation-card";
import { AnnotationDeleteButton } from "./annotation-delete-button";
import { AnnotationEditButton } from "./annotation-edit-button";
import { AnnotationExportLinks } from "./annotation-export-links";

/**
 * View-model одной карточки аннотации: стабильный `id`, исходный `anchor`
 * (нужен margin-режиму для позиционирования у якоря) и готовый server-узел
 * `card` с действиями.
 */
export interface AnnotationCardVM {
  id: string;
  anchor: Anchor | undefined;
  card: ReactNode;
}

/**
 * Серверно грузит AST-схему, только если она реально понадобится в браузере:
 * пользователь может создать аннотацию (диалог-композер) либо редактировать
 * хотя бы одну существующую (диалог редактирования монтирует AstEditor).
 * Иначе → `null` (редактор при необходимости подтянет схему сам).
 *
 * DRY-хелпер: общий для list-режима (`AnnotationsSection`) и margin-режима
 * (`DocumentAnnotations`) — оба считают «нужна ли схема» по одному правилу.
 */
export async function loadSchemaIfNeeded(
  me: Me | null,
  items: Annotation[],
  canCreate: boolean,
): Promise<SchemaResponse | null> {
  const needsSchema =
    canCreate || items.some((a) => Boolean(a.id) && canEditAnnotation(me, a));
  return needsSchema ? await getAstSchema() : null;
}

/**
 * Единый server-сборщик карточек аннотаций (DRY). Инкапсулирует логику,
 * которая раньше жила инлайн в `AnnotationsSection`: фильтрацию по наличию `id`,
 * RBAC-чек `canEditAnnotation` (автор) и сборку `AnnotationCard` со слотами
 * `anchorContext` + действиями (export для всех, edit/delete для автора).
 *
 * Потребляется двумя поверхностями: `AnnotationsSection` (list-режим
 * glossary/media/comment) и `DocumentAnnotations` (margin-режим), чтобы не
 * клонировать сборку. Каркас (`<ul>`/`<li>` vs маргиналии) остаётся за
 * потребителем — он рендерит `vm.card` в нужной обёртке по `vm.id`.
 *
 * `astSchema` — серверно-загруженная схема AST (для диалога редактирования);
 * прокидывается пропом `initial`, браузер за ней не ходит. `null` → редактор
 * подтянет схему сам при открытии (как и в текущем поведении секции).
 */
export function buildAnnotationCards({
  items,
  me,
  astSchema,
}: {
  items: Annotation[];
  me: Me | null;
  astSchema: SchemaResponse | null;
}): AnnotationCardVM[] {
  return items.flatMap((a) => {
    const id = a.id;
    // Без id карточка не имеет стабильного ключа и не поддерживает действия —
    // пропускаем (бек всегда отдаёт id в list-чтениях). flatMap + control-flow
    // сужает id к string без type-assertion.
    if (!id) return [];
    const ownEditable = canEditAnnotation(me, a);
    return [
      {
        id,
        anchor: a.anchor,
        card: (
          <AnnotationCard
            annotation={a}
            anchorContext={<AnnotationAnchorContext anchor={a.anchor} />}
            actions={
              <>
                <AnnotationExportLinks id={id} />
                {ownEditable && (
                  <>
                    <AnnotationEditButton
                      annotation={a}
                      initial={astSchema ?? undefined}
                    />
                    <AnnotationDeleteButton annotationId={id} />
                  </>
                )}
              </>
            }
          />
        ),
      },
    ];
  });
}
