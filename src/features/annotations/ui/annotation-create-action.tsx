"use client";
// src/features/annotations/ui/annotation-create-action.tsx
// Регистрирует page-level действие «аннотировать»: применимо к ЛЮБОМУ скоупу
// (annotation.ParentEntityType покрывает document/glossary/media/comment). При
// клике открывает композер с parentId = draft.scope.entityId и доменным якорем.
// Guardrail 4: только pure-фасады (../anchor, ../types) + движок + i18n/client.
import { type AnchorDraft, useStableAnchorAction } from "@/components/anchor-engine";
import { useT } from "@/i18n/client";

import { fromEngineAnchor } from "../anchor";
import type { Anchor } from "../types";

export interface AnnotationComposerOpen {
  parentEntityType: string;
  parentId: string;
  anchor: Anchor;
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
      onOpenComposer({
        parentEntityType: d.scope.entityType,
        parentId: d.scope.entityId,
        anchor: fromEngineAnchor(d.anchor),
      });
    },
  });
  return null;
}
