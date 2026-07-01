"use client";
// src/features/annotations/ui/annotation-selection-composer.tsx
// ЕДИНСТВЕННЫЙ page-level маунт действия «аннотировать»: регистрирует id="annotation"
// в движке ОДИН раз на страницу (монтируется server-ассемблером AnnotationCreateAffordance
// под AnchorScopeProvider) и владеет composer-диалогом. onCreate берёт parent/anchor из
// draft.scope (скоуп выделения), поэтому одно действие корректно обслуживает ВСЕ скоупы
// (документ + каждый комментарий). Раньше это регистрировалось из каждого AnnotationScope
// → N дублей одного id + латентный баг (первый unmount убирал действие для всех).
// Guardrail 4: только pure-фасады (../anchor, ../types) + движок + i18n/client + композер.
import { useState } from "react";

import { type AnchorDraft, useStableAnchorAction } from "@/components/anchor-engine";
import { useT } from "@/i18n/client";

import { fromEngineAnchor } from "../anchor";
import { PARENT_ENTITY_TYPES, type Anchor, type ParentEntityType } from "../types";

import { AnnotationComposerDialog } from "./annotation-composer-dialog";

// Type-guard на границе движок→слайс: draft.scope.entityType это string; сужаем к
// ParentEntityType по рантайм-набору (document/glossary/media/comment).
function isParentEntityType(value: string): value is ParentEntityType {
  return (PARENT_ENTITY_TYPES as readonly string[]).includes(value);
}

// Стабильная module-scope ссылка предиката (defense-in-depth: движок ref-стабилизирует
// appliesTo, но передаём константу, чтобы слайс физически не мог переинтродьюсить инлайн).
const APPLIES_TO_ANY = () => true; // аннотировать можно любой AST-скоуп

export function AnnotationSelectionComposer() {
  const t = useT("annotations");
  const [composer, setComposer] = useState<{
    open: boolean;
    anchor?: Anchor;
    parentId: string;
    parentEntityType: ParentEntityType;
  }>({ open: false, parentId: "", parentEntityType: "document" });

  useStableAnchorAction({
    id: "annotation",
    label: t("marginAddButton"),
    enabled: true,
    appliesTo: APPLIES_TO_ANY,
    onCreate: (d: AnchorDraft) => {
      if (!isParentEntityType(d.scope.entityType)) return;
      setComposer({
        open: true,
        anchor: fromEngineAnchor(d.anchor),
        parentId: d.scope.entityId,
        parentEntityType: d.scope.entityType,
      });
    },
  });

  return (
    <AnnotationComposerDialog
      parentEntityType={composer.parentEntityType}
      parentId={composer.parentId}
      open={composer.open}
      onOpenChange={(open) => {
        setComposer((c) => ({ ...c, open }));
      }}
      anchor={composer.anchor}
    />
  );
}
