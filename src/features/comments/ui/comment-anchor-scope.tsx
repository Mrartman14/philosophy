"use client";
// src/features/comments/ui/comment-anchor-scope.tsx
// Client-коннектор заякоренных комментариев → левая rail (tone "comment").
// Зеркалит annotation-scope (Task 9), но канал/тон comment и якорь только в
// документ (v1). Два экспорта:
//   • CommentAnchorCreateAction — регистрирует page-level действие "comment-anchor"
//     (appliesTo: только document-скоуп) через useStableAnchorAction; при клике
//     строит buildCommentTextAnchor(draft.anchor, draft.scope.entityId) и зовёт
//     onOpenComposer({ targetDocumentId, anchor }).
//   • CommentAnchorScope — находит корень тела документа [data-anchor-scope=
//     "document:<id>"], регистрирует заякоренные превью в rail (wide-гейт: на
//     narrow превью текут inline под телом, в rail — только на wide), держит
//     comment-композер. renderNote зависит от РАЗРЕШЁННОЙ строки orphanLabel
//     (анти-register-цикл — не от идентичности t), entry мемоизирован.
// Guardrail 4: импортит только pure-фасады (../anchor, ../types), движок, kit,
// i18n/client, comment-композер — НЕ server-only api/actions/permissions/schemas.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  type AnchorDraft,
  type AnchoredNote,
  useRegisterRailScope,
  useStableAnchorAction,
} from "@/components/anchor-engine";
import { useT } from "@/i18n/client";
import { coordsToEngineAnchor } from "@/utils/text-anchor";

import { buildCommentTextAnchor } from "../anchor";
import type { Anchor, CommentType } from "../types";

import { CommentComposerDialog } from "./comment-composer-dialog";

export interface CommentAnchorComposerOpen {
  targetDocumentId: string;
  anchor: Anchor;
}

export function CommentAnchorCreateAction({
  canCreate,
  onOpenComposer,
}: {
  canCreate: boolean;
  onOpenComposer: (o: CommentAnchorComposerOpen) => void;
}) {
  const t = useT("comments");
  useStableAnchorAction({
    id: "comment-anchor",
    label: t("marginCommentAdd"),
    enabled: canCreate,
    appliesTo: (type) => type === "document", // v1: якорь комментария только в документ
    onCreate: (d: AnchorDraft) => {
      onOpenComposer({
        targetDocumentId: d.scope.entityId,
        anchor: buildCommentTextAnchor(d.anchor, d.scope.entityId),
      });
    },
  });
  return null;
}

export interface CommentAnchorNote {
  id: string;
  anchor: Anchor;
  preview: ReactNode;
}

export function CommentAnchorScope({
  lectureId,
  documentId,
  rootTypes,
  notes,
  canCreate,
}: {
  lectureId: string;
  documentId: string;
  rootTypes: CommentType[];
  notes: CommentAnchorNote[];
  canCreate: boolean;
}) {
  const t = useT("comments");
  const [composer, setComposer] = useState<{ open: boolean; anchor?: Anchor }>({ open: false });

  // Корень = тело документа (скоуп document:<id>) — у него же якорятся комментарии.
  const [rootEl, setRootEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setRootEl(document.querySelector<HTMLElement>(`[data-anchor-scope="document:${documentId}"]`));
  }, [documentId]);
  const ready = rootEl !== null;

  // Wide-гейт (как в AnnotationScope): на narrow превью текут inline, в rail только на wide.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 80rem)");
    const sync = () => {
      setWide(mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
    };
  }, []);

  const engineNotes = useMemo<AnchoredNote[]>(
    () =>
      notes.flatMap((n) => {
        const engine = coordsToEngineAnchor(n.anchor);
        return engine ? [{ id: n.id, anchor: engine }] : [];
      }),
    [notes],
  );
  const previewById = useMemo(() => new Map(notes.map((n) => [n.id, n.preview])), [notes]);
  const engineIds = new Set(engineNotes.map((n) => n.id));
  const ssrOnly = notes.filter((n) => !engineIds.has(n.id));

  // renderNote зависит от РАЗРЕШЁННОЙ строки (не идентичности t) — анти-register-цикл.
  const orphanLabel = t("marginOrphanLabel");
  const renderNote = useCallback(
    (n: AnchoredNote, orphan: boolean): ReactNode => (
      <>
        {orphan && <p className="text-xs text-(--color-fg-muted)">{orphanLabel}</p>}
        {previewById.get(n.id) ?? null}
      </>
    ),
    [previewById, orphanLabel],
  );

  const entry = useMemo(
    () =>
      rootEl && wide
        ? {
            key: `comment:document:${documentId}`,
            rootEl,
            tone: "comment" as const,
            notes: engineNotes,
            renderNote,
          }
        : null,
    [rootEl, wide, documentId, engineNotes, renderNote],
  );
  useRegisterRailScope(entry);

  return (
    <div className="flex flex-col gap-4" aria-label={t("marginColumnLabel")}>
      {ssrOnly.map((n) => (
        <div key={n.id}>{n.preview}</div>
      ))}
      {(!ready || !wide) && engineNotes.map((n) => <div key={n.id}>{previewById.get(n.id)}</div>)}

      <CommentAnchorCreateAction
        canCreate={canCreate}
        onOpenComposer={(o) => {
          setComposer({ open: true, anchor: o.anchor });
        }}
      />

      <CommentComposerDialog
        lectureId={lectureId}
        rootTypes={rootTypes}
        open={composer.open}
        onOpenChange={(open) => {
          setComposer((c) => ({ ...c, open }));
        }}
        anchor={composer.anchor}
      />
    </div>
  );
}
