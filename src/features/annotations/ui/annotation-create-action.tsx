"use client";
// src/features/annotations/ui/annotation-create-action.tsx
// Регистрирует page-level действие «аннотировать»: применимо к ЛЮБОМУ скоупу
// (annotation.ParentEntityType покрывает document/glossary/media/comment). При
// клике открывает композер с parentId = draft.scope.entityId и доменным якорем.
// Guardrail 4: только pure-фасады (../anchor, ../types) + движок + i18n/client.
import { type AnchorDraft, useStableAnchorAction } from "@/components/anchor-engine";
import { useT } from "@/i18n/client";

import { fromEngineAnchor } from "../anchor";
import { PARENT_ENTITY_TYPES, type Anchor, type ParentEntityType } from "../types";

export interface AnnotationComposerOpen {
  parentEntityType: ParentEntityType;
  parentId: string;
  anchor: Anchor;
}

/**
 * Type-guard на границе движок→слайс: `draft.scope.entityType` — это `string`
 * (движок не знает про UI-домен parent-типов). Сужаем к `ParentEntityType`
 * по рантайм-набору `PARENT_ENTITY_TYPES` (document/glossary/media/comment).
 * Если скоуп не является валидным parent аннотации — composer не открываем.
 */
function isParentEntityType(value: string): value is ParentEntityType {
  return (PARENT_ENTITY_TYPES as readonly string[]).includes(value);
}

export function AnnotationCreateAction({
  canCreate,
  onOpenComposer,
}: {
  canCreate: boolean;
  onOpenComposer: (open: AnnotationComposerOpen) => void;
}) {
  const t = useT("annotations");
  useStableAnchorAction({
    id: "annotation",
    label: t("marginAddButton"),
    enabled: canCreate,
    appliesTo: () => true, // аннотировать можно любой AST-скоуп
    onCreate: (d: AnchorDraft) => {
      // Скоуп выделения может быть типом, который не является parent аннотации
      // (движок применяет действие к любому AST-скоупу). Тогда composer не зовём.
      if (!isParentEntityType(d.scope.entityType)) return;
      onOpenComposer({
        parentEntityType: d.scope.entityType,
        parentId: d.scope.entityId,
        anchor: fromEngineAnchor(d.anchor),
      });
    },
  });
  return null;
}
