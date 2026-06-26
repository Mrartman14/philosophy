"use client";
// src/components/anchor-engine/margin-anchor-layer.tsx
// Оркестратор React-слоя движка маргиналий (eager-политика). Собирает: захват выделения →
// аффорданс создания; подсветку через CSS Custom Highlight API (HighlightController),
// с оверлей-фолбэком (HighlightOverlay) когда API нет; позиции карточек на полях
// (MarginNotesColumn по getAnchorRect); двусторонний клик (клик по тексту → активная
// карточка + скролл к ней; клик по карточке → скролл к фрагменту в тексте); пересчёт
// геометрии при resize / загрузке шрифтов / смене нот.
import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import type { Motion } from "@/styles/tokens/enums";
import { isReducedMotion } from "@/utils/is-reduced-motion";

import { cssEscape } from "./css-escape";
import { HighlightController } from "./highlight-controller";
import { HighlightOverlay } from "./highlight-overlay";
import { MarginNotesColumn, type ColumnNote } from "./margin-notes-column";
import { SelectionAffordance } from "./selection-affordance";
import type { AnchorDraft, AnchoredNote } from "./types";
import { useAnchorHighlights } from "./use-anchor-highlights";
import { useAnchorRanges } from "./use-anchor-ranges";
import { useSelectionCapture } from "./use-selection-capture";
import { useTextClick } from "./use-text-click";

export interface MarginAnchorLayerProps {
  astRootRef: RefObject<HTMLElement | null>;
  notes: AnchoredNote[];
  renderNote: (note: AnchoredNote, orphan: boolean) => ReactNode;
  highlightEnabled: boolean;
  canCreate: boolean;
  onCreateRequest: (draft: AnchorDraft) => void;
  affordanceLabel: string;
  // Канал CSS Custom Highlight API (HighlightController). Доменно-агностичный:
  // аннотации не передают → дефолт "annotation". Иные потребители задают свой.
  highlightName?: string;
}

// Поведение скролла под осью motion. ЗЕРКАЛО `reducedNow` из view-transition.ts:
// читаем data-motion с <html> (источник истины осей appearance, SSR-cookie) +
// OS prefers-reduced-motion, прогоняем через общую формулу isReducedMotion.
// Императивный read (не хук useReducedMotion), чтобы НЕ тянуть AppearanceProvider в
// движок — скролл происходит в колбэке, а не в рендере, и слой остаётся
// провайдер-независимым (важно для дым-теста). jsdom: нет matchMedia → не reduced.
function scrollBehavior(): ScrollBehavior {
  if (typeof document === "undefined") return "auto";
  const motion = (document.documentElement.dataset.motion as Motion | undefined) ?? "system";
  const osReduce =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  return isReducedMotion({ motion, osReduce }) ? "auto" : "smooth";
}

// Компенсация sticky-хедера при скролле к фрагменту (ср. --layout-sticky-top).
const ACTIVATE_SCROLL_OFFSET_PX = 100;

export function MarginAnchorLayer(props: MarginAnchorLayerProps) {
  const {
    astRootRef,
    notes,
    renderNote,
    highlightEnabled,
    canCreate,
    onCreateRequest,
    affordanceLabel,
  } = props;

  const controllerRef = useRef<HighlightController | null>(null);
  controllerRef.current ??= new HighlightController(props.highlightName ?? "annotation");
  const controller = controllerRef.current;

  // Геометрия движка (Range/ready/пересчёт/getAnchorRect) — вынесена в общий хук,
  // переиспользуемый eager/lazy-политиками. Поведение идентично прежней инлайн-логике.
  const { ranges, getAnchorRect, recomputeKey, ready } = useAnchorRanges({ astRootRef, notes });
  const { draft, clear } = useSelectionCapture({ rootRef: astRootRef, enabled: canCreate });
  const [activeId, setActiveId] = useState<string | null>(null);

  // Подсветка (основной путь — CSS Custom Highlight API). Оверлей-фолбэк — ниже
  // через controller.supported. Eager-политика: держим подсветку ВСЕХ нот
  // (persistentIds = все id), activeId — отдельный канал.
  const allIds = notes.map((n) => n.id);
  useAnchorHighlights({
    controller,
    ranges,
    persistentIds: allIds,
    activeId,
    enabled: highlightEnabled,
  });

  // Двусторонний клик (текст → карточка): клик в AST-руте → note под caret →
  // активировать + скролл к карточке.
  const pickFromText = useCallback((id: string) => {
    setActiveId(id);
    document
      .querySelector(`[data-note-card="${cssEscape(id)}"]`)
      ?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
  }, []);
  useTextClick({ astRootRef, notes, ready, onPick: pickFromText });

  // Двусторонний клик (карточка → текст): активация карточки → скролл к фрагменту.
  const onActivate = useCallback(
    (id: string) => {
      setActiveId(id);
      const r = ranges.get(id);
      if (r) {
        const rect = r.getBoundingClientRect();
        window.scrollTo({
          top: rect.top + window.scrollY - ACTIVATE_SCROLL_OFFSET_PX,
          behavior: scrollBehavior(),
        });
      }
    },
    [ranges],
  );

  const columnNotes: ColumnNote[] = notes.map((n) => {
    const orphan = (ranges.get(n.id) ?? null) === null;
    return {
      id: n.id,
      orphan,
      node: <div data-note-card={n.id}>{renderNote(n, orphan)}</div>,
    };
  });

  const create = useCallback(() => {
    if (draft) {
      onCreateRequest(draft);
      clear();
    }
  }, [draft, onCreateRequest, clear]);

  const overlayRanges =
    !controller.supported && highlightEnabled
      ? [...ranges.values()].filter((r): r is Range => r !== null)
      : [];

  return (
    <>
      {draft && canCreate && (
        <SelectionAffordance rect={draft.rect} label={affordanceLabel} onCreate={create} />
      )}
      {overlayRanges.length > 0 && (
        <HighlightOverlay
          ranges={overlayRanges}
          activeRange={activeId ? (ranges.get(activeId) ?? null) : null}
        />
      )}
      <MarginNotesColumn
        notes={columnNotes}
        getAnchorRect={getAnchorRect}
        onActivate={onActivate}
        recomputeKey={recomputeKey}
      />
    </>
  );
}
