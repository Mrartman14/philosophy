"use client";
// src/features/comments/ui/comment-anchor-selection-composer.tsx
// ЕДИНСТВЕННЫЙ page-level маунт действия «заякоренный комментарий» (id=comment-anchor):
// регистрирует действие ОДИН раз на страницу (монтируется server-ассемблером
// CommentAnchorCreateAffordance под AnchorScopeProvider) и владеет composer-диалогом.
// appliesTo: только document-скоуп (v1). onCreate строит якорь из draft.scope.entityId.
// Раньше это регистрировалось из каждого CommentAnchorScope. Зеркалит AnnotationSelectionComposer.
// Guardrail 4: только pure-фасады (../anchor, ../types) + движок + i18n/client + композер.
import { useState } from "react";

import { type AnchorDraft, useStableAnchorAction } from "@/components/anchor-engine";
import { useT } from "@/i18n/client";

import { buildCommentTextAnchor } from "../anchor";
import type { Anchor, CommentType } from "../types";

import { CommentComposerDialog } from "./comment-composer-dialog";

// Стабильная module-scope ссылка предиката (defense-in-depth).
const APPLIES_TO_DOCUMENT = (t: string) => t === "document"; // v1: якорь коммента только в документ

export function CommentAnchorSelectionComposer({
  lectureId,
  rootTypes,
}: {
  lectureId: string;
  rootTypes: CommentType[];
}) {
  const t = useT("comments");
  const [composer, setComposer] = useState<{ open: boolean; anchor?: Anchor }>({ open: false });

  useStableAnchorAction({
    id: "comment-anchor",
    label: t("marginCommentAdd"),
    enabled: true,
    appliesTo: APPLIES_TO_DOCUMENT,
    onCreate: (d: AnchorDraft) => {
      setComposer({
        open: true,
        anchor: buildCommentTextAnchor(d.anchor, d.scope.entityId),
      });
    },
  });

  return (
    <CommentComposerDialog
      lectureId={lectureId}
      rootTypes={rootTypes}
      open={composer.open}
      onOpenChange={(open) => {
        setComposer((c) => ({ ...c, open }));
      }}
      anchor={composer.anchor}
    />
  );
}
