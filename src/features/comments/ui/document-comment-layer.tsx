"use client";
// src/features/comments/ui/document-comment-layer.tsx
// Коннектор движок↔домен (client) для заякоренных комментариев. EAGER-политика
// (как аннотации): постоянная подсветка + позиционированные превью у фрагмента +
// выноски-связи. Зеркалит SSR-инвариант document-annotation-layer: до mount
// (ready=false) превью — простым списком (есть в HTML, no-JS/a11y), после mount
// те же ноды позиционирует MarginAnchorLayer (на narrow — поток, на wide — у
// фрагмента + выноски). Создание из выделения: TextAnchor → buildCommentTextAnchor
// (+target document) → модалка-композер.
// Guardrail 4: импортит только pure-фасады (../anchor, ../types), движок, i18n/client
// и composer-диалог. НЕ тянет server-only api/actions/permissions/schemas.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { MarginAnchorLayer, type AnchorDraft, type AnchoredNote } from "@/components/anchor-engine";
import { useT } from "@/i18n/client";
import { coordsToEngineAnchor } from "@/utils/text-anchor";

import { buildCommentTextAnchor } from "../anchor";
import type { Anchor, CommentType } from "../types";

import { CommentComposerDialog } from "./comment-composer-dialog";

export interface DocumentCommentNote {
  id: string;
  anchor: Anchor;
  preview: ReactNode;
}

export interface DocumentCommentLayerProps {
  lectureId: string;
  documentId: string;
  rootTypes: CommentType[];
  notes: DocumentCommentNote[];
  canCreate: boolean;
}

export function DocumentCommentLayer({
  lectureId,
  documentId,
  rootTypes,
  notes,
  canCreate,
}: DocumentCommentLayerProps) {
  const t = useT("comments");
  const astRootRef = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [composer, setComposer] = useState<{ open: boolean; anchor?: Anchor }>({ open: false });

  // Discover AST-рут после первого коммита → SSR/первый client-рендер видят
  // ready=false (no hydration mismatch), позиционирование включается следующим
  // тиком. Зеркалит document-annotation-layer.
  useEffect(() => {
    astRootRef.current = document.querySelector<HTMLElement>("[data-ast-root]");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount flip to enable positioning; SSR/no-JS render at ready=false
    setReady(true);
  }, []);

  // Доменные ноты → движковые: только валидный text-range (coordsToEngineAnchor != null).
  // Мемоизация по notes: MarginAnchorLayer держит notes в deps useAnchorRanges.
  const engineNotes: AnchoredNote[] = useMemo(
    () =>
      notes.flatMap((n) => {
        const engine = coordsToEngineAnchor(n.anchor);
        return engine ? [{ id: n.id, anchor: engine }] : [];
      }),
    [notes],
  );
  const previewById = useMemo(() => new Map(notes.map((n) => [n.id, n.preview])), [notes]);
  const renderNote = useCallback(
    (n: AnchoredNote) => previewById.get(n.id) ?? null,
    [previewById],
  );

  const engineIds = new Set(engineNotes.map((n) => n.id));
  const ssrOnly = notes.filter((n) => !engineIds.has(n.id)); // без валидного якоря — всегда списком

  return (
    <div className="flex flex-col gap-4" aria-label={t("marginColumnLabel")}>
      {ssrOnly.map((n) => (
        <div key={n.id}>{n.preview}</div>
      ))}

      {!ready ? (
        engineNotes.map((n) => <div key={n.id}>{previewById.get(n.id)}</div>)
      ) : (
        <MarginAnchorLayer
          astRootRef={astRootRef}
          notes={engineNotes}
          renderNote={renderNote}
          highlightEnabled
          canCreate={canCreate}
          onCreateRequest={(d: AnchorDraft) => {
            setComposer({ open: true, anchor: buildCommentTextAnchor(d.anchor, documentId) });
          }}
          affordanceLabel={t("marginCommentAdd")}
          highlightName="comment"
          tone="comment"
        />
      )}

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
