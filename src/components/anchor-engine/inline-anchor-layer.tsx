"use client";
// src/components/anchor-engine/inline-anchor-layer.tsx
// Lazy-политика движка (под комментарии): подсветка не постоянная — по hover
// (useHoverReveal) или по глобальному тоглу showAllHighlights; клик по фрагменту
// открывает ОДНУ превью-карточку у якоря (wide) или зовёт onActivateNarrow
// (narrow, напр. скролл к треду внизу). Захват выделения → аффорданс создания —
// как в eager-политике. Side колонки задаёт страница через MarginNote.
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { HighlightController } from "./highlight-controller";
import { HighlightOverlay } from "./highlight-overlay";
import { MarginNotesColumn } from "./margin-notes-column";
import { SelectionAffordance } from "./selection-affordance";
import type { AnchorDraft, AnchoredNote } from "./types";
import { useAnchorHighlights } from "./use-anchor-highlights";
import { useAnchorRanges } from "./use-anchor-ranges";
import { useHoverReveal } from "./use-hover-reveal";
import { useSelectionCapture } from "./use-selection-capture";
import { useTextClick } from "./use-text-click";

const WIDE = "(min-width: 80rem)";

export interface InlineAnchorLayerProps {
  astRootRef: RefObject<HTMLElement | null>;
  notes: AnchoredNote[];
  renderCard: (id: string) => ReactNode;
  showAllHighlights: boolean;
  canCreate: boolean;
  onCreateRequest: (draft: AnchorDraft) => void;
  affordanceLabel: string;
  onActivateNarrow: (id: string) => void;
  highlightName?: string;
}

export function InlineAnchorLayer(props: InlineAnchorLayerProps) {
  const {
    astRootRef,
    notes,
    renderCard,
    showAllHighlights,
    canCreate,
    onCreateRequest,
    affordanceLabel,
    onActivateNarrow,
    highlightName = "comment",
  } = props;

  const controllerRef = useRef<HighlightController | null>(null);
  controllerRef.current ??= new HighlightController(highlightName);
  const controller = controllerRef.current;

  const { ranges, getAnchorRect, recomputeKey, ready } = useAnchorRanges({ astRootRef, notes });
  const { draft, clear } = useSelectionCapture({ rootRef: astRootRef, enabled: canCreate });

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // wide vs narrow — решает «превью-карточка (wide) vs onActivateNarrow». jsdom/SSR
  // → narrow. (MarginNotesColumn детектит wide для абсолют-позиционирования сам;
  // здесь wide гейтит ТОЛЬКО pick/openId — транзиентный рассинхрон на границе
  // брейкпоинта безвреден, см. clear-on-narrow ниже.)
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(WIDE);
    const sync = () => {
      setWide(mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
    };
  }, []);

  // На узком экране карточек нет — закрыть открытую при уходе из wide.
  useEffect(() => {
    if (!wide) setOpenId(null);
  }, [wide]);

  // Hover-подсветка по КЭШИРОВАННЫМ ranges (не пересчитывает на каждый кадр).
  useHoverReveal({ astRootRef, ranges, ready, onHover: setHoveredId });

  const activeId = openId ?? hoveredId; // открытая карточка > наведение
  // persistentIds: при тогле — все, иначе пусто (подсветка не постоянная).
  const persistentIds = showAllHighlights ? notes.map((n) => n.id) : [];
  useAnchorHighlights({ controller, ranges, persistentIds, activeId, enabled: true });

  const pick = useCallback(
    (id: string) => {
      if (wide) setOpenId(id);
      else onActivateNarrow(id);
    },
    [wide, onActivateNarrow],
  );
  useTextClick({ astRootRef, notes, ready, onPick: pick });

  const create = useCallback(() => {
    if (draft) {
      onCreateRequest(draft);
      clear();
    }
  }, [draft, onCreateRequest, clear]);

  // Превью-карточка: только открытая (openId уже null на narrow). Клик по ТЕЛУ
  // карточки её НЕ закрывает (onActivate — no-op): карточка для чтения. Закрытие —
  // клик по другому фрагменту (переоткрывает openId) или уход в narrow.
  const columnNotes = openId
    ? [
        {
          id: openId,
          orphan: (ranges.get(openId) ?? null) === null,
          node: <div data-note-card={openId}>{renderCard(openId)}</div>,
        },
      ]
    : [];

  // Оверлей-фолбэк (нет CSS Highlight API): покрывает persistent ∪ active — иначе
  // hover/тогл в таких браузерах не подсветятся (паритет с аннотациями).
  const overlayIds = !controller.supported
    ? [...new Set([...persistentIds, ...(activeId ? [activeId] : [])])]
    : [];
  const overlayRanges = overlayIds
    .map((id) => ranges.get(id) ?? null)
    .filter((r): r is Range => r != null);
  const activeRange = activeId ? (ranges.get(activeId) ?? null) : null;

  return (
    <>
      {draft && canCreate && (
        <SelectionAffordance rect={draft.rect} label={affordanceLabel} onCreate={create} />
      )}
      {overlayRanges.length > 0 && (
        <HighlightOverlay ranges={overlayRanges} activeRange={activeRange} />
      )}
      <MarginNotesColumn
        notes={columnNotes}
        getAnchorRect={getAnchorRect}
        onActivate={() => undefined}
        recomputeKey={recomputeKey}
      />
    </>
  );
}
