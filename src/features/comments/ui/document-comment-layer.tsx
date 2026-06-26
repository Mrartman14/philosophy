"use client";
// src/features/comments/ui/document-comment-layer.tsx
// Коннектор движок↔домен (client) для заякоренных комментариев. Ставит lazy-
// политику InlineAnchorLayer: подсветка по hover/тоглу (default OFF — не
// конкурирует с аннотациями), клик по фрагменту → превью-карточка слева (wide)
// или скролл к нижнему треду (narrow). Создание из выделения: TextAnchor →
// buildCommentTextAnchor(+target document) → модалка-композер.
// SSR-расхождение с аннотациями (осознанно): превью-карточки НЕ в HTML — это
// progressive enhancement (контент дублирован в нижнем CommentSection). Поэтому
// слой монтируется client-only ({ready && ...}).
// A11y/тач (исправлено по ревью): hover-reveal недоступен с клавиатуры/тача, а
// CSS Custom Highlight не создаёт фокусируемых DOM-узлов. Поэтому при showAll
// рендерим ДОСТУПНЫЙ список заякоренных корней (фокусируемые превью с
// OpenThreadButton) — единственный клавиатурный/тач-путь к комментариям фрагментов.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { InlineAnchorLayer, type AnchorDraft, type AnchoredNote } from "@/components/anchor-engine";
import { useReducedMotion } from "@/components/appearance";
import { Button, Inline } from "@/components/ui";
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

const KEY = "comment-highlights";

export function DocumentCommentLayer({
  lectureId,
  documentId,
  rootTypes,
  notes,
  canCreate,
}: DocumentCommentLayerProps) {
  const t = useT("comments");
  const reduced = useReducedMotion();
  const astRootRef = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [showAll, setShowAll] = useState(false); // default OFF (не конкурирует с аннотациями)
  const [composer, setComposer] = useState<{ open: boolean; anchor?: Anchor }>({ open: false });

  useEffect(() => {
    astRootRef.current = document.querySelector<HTMLElement>("[data-ast-root]");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount read of localStorage pref; SSR/no-JS default off
    if (window.localStorage.getItem(KEY) === "on") setShowAll(true);
    setReady(true);
  }, []);

  const toggle = () => {
    setShowAll((s) => {
      const next = !s;
      window.localStorage.setItem(KEY, next ? "on" : "off");
      return next;
    });
  };

  // Доменные ноты → движковые: только валидный text-range (coordsToEngineAnchor != null).
  const engineNotes: AnchoredNote[] = notes.flatMap((n) => {
    const engine = coordsToEngineAnchor(n.anchor);
    return engine ? [{ id: n.id, anchor: engine }] : [];
  });
  const previewById = new Map(notes.map((n) => [n.id, n.preview]));

  const scrollToThread = useCallback(
    (id: string) => {
      document
        .getElementById(`comment-${id}`)
        ?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    },
    [reduced],
  );

  return (
    <div className="flex flex-col gap-4" aria-label={t("marginColumnLabel")}>
      <Inline gap="tight" align="start">
        <Button type="button" compact tone="quiet" onClick={toggle} aria-pressed={showAll}>
          {showAll ? t("marginHighlightHide") : t("marginHighlightShow")}
        </Button>
      </Inline>

      {ready && (
        <InlineAnchorLayer
          astRootRef={astRootRef}
          notes={engineNotes}
          renderCard={(id) => previewById.get(id) ?? null}
          showAllHighlights={showAll}
          canCreate={canCreate}
          onCreateRequest={(d: AnchorDraft) => {
            setComposer({ open: true, anchor: buildCommentTextAnchor(d.anchor, documentId) });
          }}
          affordanceLabel={t("marginCommentAdd")}
          onActivateNarrow={scrollToThread}
        />
      )}

      {/* Доступный список (клавиатура/тач): при showAll показываем превью корней
          потоком — фокусируемые, с OpenThreadButton. Закрывает a11y/тач-дыру,
          т.к. hover-reveal и подсветка недостижимы без мыши. */}
      {showAll && notes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id}>{n.preview}</li>
          ))}
        </ul>
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
