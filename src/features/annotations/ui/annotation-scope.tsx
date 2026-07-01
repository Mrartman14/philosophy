"use client";
// src/features/annotations/ui/annotation-scope.tsx
// Client-коннектор аннотаций сущности → rail. Тело сущности уже размечено
// data-anchor-scope на странице (документ) / в comment-node-view (комментарий);
// здесь: (1) находим этот корень по уникальному id, (2) регистрируем заякоренные
// заметки в rail (мемоизированный entry — иначе register-цикл в провайдере),
// (3) SSR-фолбэк-список + действие create + композер. Тулбар (add-unanchored +
// тумблер подсветки) рендерим ТОЛЬКО при showToolbar (документ), не на каждый
// комментарий. Тумблер влияет на highlightEnabled этого скоупа в rail.
// Guardrail 4: только pure-фасады + движок + kit + i18n/client + композер.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  anchorScopeSelector,
  useRegisterRailScope,
  useWide,
  type AnchoredNote,
} from "@/components/anchor-engine";
import { Button, Inline } from "@/components/ui";
import { useT } from "@/i18n/client";

import { toEngineAnchor } from "../anchor";
import type { Anchor, ParentEntityType } from "../types";

import { AnnotationComposerDialog } from "./annotation-composer-dialog";
import { AnnotationCreateAction, type AnnotationComposerOpen } from "./annotation-create-action";

interface NoteVM {
  id: string;
  anchor: Anchor | undefined;
  card: ReactNode;
}

interface Props {
  parentEntityType: ParentEntityType;
  parentId: string;
  notes: NoteVM[];
  canCreate: boolean;
  /** Документ: показать тулбар (add-unanchored + тумблер). Комментарии: false. */
  showToolbar?: boolean;
}

const KEY = "annotation-highlights";

export function AnnotationScope({
  parentEntityType,
  parentId,
  notes,
  canCreate,
  showToolbar = false,
}: Props) {
  const t = useT("annotations");
  // composer.parentEntityType/parentId следуют за ВЫДЕЛЕНИЕМ (из драфта), не за
  // пропом скоупа: одно page-level действие «аннотировать» переживает N+1 скоупов
  // (документ + каждый комментарий), и выживший action может принадлежать чужому
  // скоупу. Дефолт = проп скоупа — для пути «add unanchored», где драфта нет.
  const [composer, setComposer] = useState<{
    open: boolean;
    anchor?: Anchor;
    parentId: string;
    parentEntityType: ParentEntityType;
  }>({
    open: false,
    parentId,
    parentEntityType,
  });
  const [highlight, setHighlight] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount read of static localStorage pref; SSR/no-JS default is on
    if (window.localStorage.getItem(KEY) === "off") setHighlight(false);
  }, []);

  const toggle = () => {
    setHighlight((h) => {
      const next = !h;
      window.localStorage.setItem(KEY, next ? "on" : "off");
      return next;
    });
  };

  // Мемоизация по props.notes: стабильно при локальных state (highlight/composer).
  const engineNotes = useMemo<AnchoredNote[]>(
    () =>
      notes.flatMap((n) => {
        const engine = n.anchor ? toEngineAnchor(n.anchor) : null;
        return engine ? [{ id: n.id, anchor: engine }] : [];
      }),
    [notes],
  );
  const cardById = useMemo(() => new Map(notes.map((n) => [n.id, n.card])), [notes]);
  const engineIds = new Set(engineNotes.map((n) => n.id));
  const ssrOnly = notes.filter((n) => !engineIds.has(n.id));

  // Корень сущности (server-rendered) ищем по уникальному id и держим в state,
  // чтобы entry пересобрался, когда узел найден. Один retry через rAF — узел может
  // ещё не быть в DOM при стриминге (CommentSection под Suspense).
  const [rootEl, setRootEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const find = () =>
      document.querySelector<HTMLElement>(anchorScopeSelector(parentEntityType, parentId));
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
  }, [parentEntityType, parentId]);
  const ready = rootEl !== null;

  // Wide-гейт (общий useWide, та же media WIDE, что MarginNotesColumn): на
  // narrow карточки текут inline ПОД своим телом (локальность спеки), в rail
  // регистрируем ТОЛЬКО на wide. SSR → false (показываем inline-фолбэк), после mount
  // поднимаем при совпадении.
  const wide = useWide();

  // renderNote: зависим от РАЗРЕШЁННОЙ строки orphanLabel (стабильна по значению
  // даже если useT отдаёт новую функцию-идентичность) — иначе renderNote→entry
  // менялись бы каждый рендер и крутили register-цикл. (Из ревью.)
  const orphanLabel = t("marginOrphanLabel");
  const renderNote = useCallback(
    (n: AnchoredNote, orphan: boolean): ReactNode => (
      <>
        {orphan && <p className="text-xs text-(--color-fg-muted)">{orphanLabel}</p>}
        {cardById.get(n.id) ?? null}
      </>
    ),
    [cardById, orphanLabel],
  );

  // Стабильный entry: меняется только при смене корня/заметок/renderNote/highlight.
  // Регистрируем в rail ТОЛЬКО на wide (на narrow карточки рендерим inline ниже).
  const entry = useMemo(
    () =>
      rootEl && wide
        ? {
            key: `annotation:${parentEntityType}:${parentId}`,
            rootEl,
            tone: "annotation" as const,
            notes: engineNotes,
            renderNote,
            highlightEnabled: highlight,
          }
        : null,
    [rootEl, wide, parentEntityType, parentId, engineNotes, renderNote, highlight],
  );
  useRegisterRailScope(entry);

  return (
    <div className="flex flex-col gap-4" aria-label={t("marginColumnLabel")}>
      {showToolbar && (
        <Inline gap="tight" align="start">
          {canCreate && (
            <Button
              type="button"
              compact
              tone="primary"
              onClick={() => {
                setComposer({ open: true, parentId, parentEntityType });
              }}
            >
              {t("marginAddUnanchored")}
            </Button>
          )}
          <Button type="button" compact tone="quiet" onClick={toggle}>
            {highlight ? t("marginHighlightToggleOn") : t("marginHighlightToggleOff")}
          </Button>
        </Inline>
      )}

      {/* SSR-фолбэк: карточки без движкового якоря — всегда списком. */}
      {ssrOnly.map((n) => (
        <div key={n.id}>{n.card}</div>
      ))}

      {/* Якорённые карточки inline-списком, когда rail их НЕ позиционирует:
          до mount (SSR/no-JS, есть в HTML) ИЛИ на narrow (локальность под телом
          своего скоупа — требование спеки). На wide+ready их рисует MarginRail. */}
      {(!ready || !wide) && engineNotes.map((n) => <div key={n.id}>{cardById.get(n.id)}</div>)}

      <AnnotationCreateAction
        canCreate={canCreate}
        onOpenComposer={(o: AnnotationComposerOpen) => {
          setComposer({
            open: true,
            anchor: o.anchor,
            parentId: o.parentId,
            parentEntityType: o.parentEntityType,
          });
        }}
      />

      <AnnotationComposerDialog
        parentEntityType={composer.parentEntityType}
        parentId={composer.parentId}
        open={composer.open}
        onOpenChange={(open) => {
          setComposer((c) => ({ ...c, open }));
        }}
        anchor={composer.anchor}
      />
    </div>
  );
}
