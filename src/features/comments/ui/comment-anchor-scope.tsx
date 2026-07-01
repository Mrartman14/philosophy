"use client";
// src/features/comments/ui/comment-anchor-scope.tsx
// Client-коннектор заякоренных комментариев → левая rail (tone "comment"). ТОЛЬКО
// позиционирование: находит корень тела документа [data-anchor-scope="document:<id>"],
// регистрирует заякоренные превью в rail (wide-гейт: на narrow превью текут inline под
// телом, в rail — только на wide). Действие создания (id=comment-anchor) вынесено в
// page-level CommentAnchorSelectionComposer (структурный hoist) — здесь его больше нет.
// renderNote зависит от РАЗРЕШЁННОЙ строки orphanLabel (анти-register-цикл), entry мемоизирован.
// Guardrail 4: только pure-фасады (../anchor, ../types), движок, i18n/client, text-anchor util.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  anchorScopeSelector,
  type AnchoredNote,
  useRegisterRailScope,
  useWide,
} from "@/components/anchor-engine";
import { useT } from "@/i18n/client";
import { coordsToEngineAnchor } from "@/utils/text-anchor";

import type { Anchor } from "../types";

export interface CommentAnchorNote {
  id: string;
  anchor: Anchor;
  preview: ReactNode;
}

export function CommentAnchorScope({
  documentId,
  notes,
}: {
  documentId: string;
  notes: CommentAnchorNote[];
}) {
  const t = useT("comments");

  // Корень = тело документа (скоуп document:<id>). Один retry через rAF: узел может ещё
  // не быть в DOM при стриминге (документ/CommentSection под Suspense).
  const [rootEl, setRootEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const find = () =>
      document.querySelector<HTMLElement>(anchorScopeSelector("document", documentId));
    const el = find();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount discovery of server-rendered scope root by unique id; entry rebuilds when found
    if (el) setRootEl(el);
    else if (typeof requestAnimationFrame === "function") {
      const raf = requestAnimationFrame(() => {
        setRootEl(find());
      });
      return () => {
        cancelAnimationFrame(raf);
      };
    }
  }, [documentId]);
  const ready = rootEl !== null;

  const wide = useWide();

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
    </div>
  );
}
