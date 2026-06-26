"use client";
// src/components/anchor-engine/annotation-layer.tsx
// Оркестратор React-слоя движка маргиналий. Собирает: захват выделения →
// аффорданс создания; подсветку через CSS Custom Highlight API (HighlightController),
// с оверлей-фолбэком (HighlightOverlay) когда API нет; позиции карточек на полях
// (MarginNotesColumn по getAnchorRect); двусторонний клик (клик по тексту → активная
// карточка + скролл к ней; клик по карточке → скролл к фрагменту в тексте); пересчёт
// геометрии при resize / загрузке шрифтов / смене нот.
import {
  useCallback,
  useEffect,
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
import { noteAtPoint } from "./hit-test";
import { MarginNotesColumn, type ColumnNote } from "./margin-notes-column";
import { SelectionAffordance } from "./selection-affordance";
import type { AnchorDraft, AnchoredNote } from "./types";
import { useAnchorRanges } from "./use-anchor-ranges";
import { useSelectionCapture } from "./use-selection-capture";

export interface AnnotationLayerProps {
  astRootRef: RefObject<HTMLElement | null>;
  notes: AnchoredNote[];
  renderNote: (note: AnchoredNote, orphan: boolean) => ReactNode;
  highlightEnabled: boolean;
  canCreate: boolean;
  onCreateRequest: (draft: AnchorDraft) => void;
  affordanceLabel: string;
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

export function AnnotationLayer(props: AnnotationLayerProps) {
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
  controllerRef.current ??= new HighlightController();
  const controller = controllerRef.current;

  // Геометрия движка (Range/ready/пересчёт/getAnchorRect) — вынесена в общий хук,
  // переиспользуемый eager/lazy-политиками. Поведение идентично прежней инлайн-логике.
  const { ranges, getAnchorRect, recomputeKey, ready } = useAnchorRanges({ astRootRef, notes });
  const { draft, clear } = useSelectionCapture({ rootRef: astRootRef, enabled: canCreate });
  const [activeId, setActiveId] = useState<string | null>(null);

  // Подсветка (основной путь — CSS Custom Highlight API). Оверлей-фолбэк — ниже
  // через controller.supported.
  useEffect(() => {
    if (!highlightEnabled) {
      controller.clear();
      return;
    }
    const valid = [...ranges.values()].filter((r): r is Range => r !== null);
    controller.apply(valid);
    controller.setActive(activeId ? (ranges.get(activeId) ?? null) : null);
    return () => {
      controller.clear();
    };
  }, [ranges, highlightEnabled, activeId, controller]);

  // Двусторонний клик (текст → карточка): клик в AST-руте → note под caret →
  // активировать + скролл к карточке.
  useEffect(() => {
    const root = astRootRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const id = noteAtPoint(e.clientX, e.clientY, notes, root);
      if (id) {
        setActiveId(id);
        document
          .querySelector(`[data-note-card="${cssEscape(id)}"]`)
          ?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
      }
    };
    root.addEventListener("click", onClick);
    return () => {
      root.removeEventListener("click", onClick);
    };
    // ready в deps: переподписка после готовности рута (root меняется null→element).
  }, [notes, astRootRef, ready]);

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
