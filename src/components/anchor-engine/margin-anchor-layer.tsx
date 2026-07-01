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
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import type { Motion } from "@/styles/tokens/enums";
import { isReducedMotion } from "@/utils/is-reduced-motion";

import { useStableAnchorAction } from "./anchor-actions";
import { ConnectorLayer } from "./connector-layer";
import { cssEscape } from "./css-escape";
import { HighlightController } from "./highlight-controller";
import { HighlightOverlay } from "./highlight-overlay";
import { MarginNotesColumn, type ColumnNote } from "./margin-notes-column";
import { toneColor } from "./tone";
import type { AnchorDraft, AnchoredNote } from "./types";
import { useAnchorHighlights } from "./use-anchor-highlights";
import { useAnchorRanges } from "./use-anchor-ranges";
import { useHoverReveal } from "./use-hover-reveal";
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
  // Тон выноски/акцента карточки: annotation (тёплый) | comment (синий). Default annotation.
  tone?: "annotation" | "comment";
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
    highlightName = "annotation",
    tone = "annotation",
  } = props;

  const controllerRef = useRef<HighlightController | null>(null);
  controllerRef.current ??= new HighlightController(highlightName);
  const controller = controllerRef.current;

  // Геометрия движка (Range/ready/пересчёт/getAnchorRect) — вынесена в общий хук,
  // переиспользуемый eager/lazy-политиками. Поведение идентично прежней инлайн-логике.
  const { geometries, ranges, getAnchorRect, recomputeKey, ready } = useAnchorRanges({
    astRootRef,
    notes,
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  // Hover-акцент поверх постоянной видимости: наведение на текст (useHoverReveal)
  // или на карточку (onHoverNote колонки) → hoveredId; эмфаза = hoveredId ?? activeId.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  useHoverReveal({ astRootRef, geometries, ready, onHover: setHoveredId });
  const emphasizedId = hoveredId ?? activeId;

  // Захват выделения + аффорданс делегированы общему хосту (SelectionAffordanceHost):
  // слой лишь РЕГИСТРИРУЕТ своё действие (useStableAnchorAction стабилизирует
  // onCreate через ref, чтобы меняющийся onCreateRequest не дёргал re-register loop).
  useStableAnchorAction({
    id: highlightName,
    label: affordanceLabel,
    onCreate: onCreateRequest,
    enabled: canCreate,
  });

  // Подсветка (основной путь — CSS Custom Highlight API). Оверлей-фолбэк — ниже
  // через controller.supported. Eager-политика: держим подсветку ВСЕХ нот
  // (persistentIds = все id), activeId — отдельный канал.
  const allIds = notes.map((n) => n.id);
  // Прямоугольные якоря — их выноска крепится в центр bbox (kind-aware в connector).
  // useMemo: стабильная идентичность Set между recompute'ами (иначе connector-эффект
  // перезапускался бы каждый рендер).
  const rectIds = useMemo(
    () => new Set([...geometries].filter(([, g]) => g?.kind === "rect").map(([id]) => id)),
    [geometries],
  );
  useAnchorHighlights({
    controller,
    ranges,
    persistentIds: allIds,
    activeId: emphasizedId,
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
  useTextClick({ astRootRef, geometries, ready, onPick: pickFromText });

  // Двусторонний клик (карточка → текст): активация карточки → скролл к фрагменту.
  const onActivate = useCallback(
    (id: string) => {
      setActiveId(id);
      const rect = geometries.get(id)?.boundingRect ?? null;
      if (rect) {
        window.scrollTo({
          top: rect.top + window.scrollY - ACTIVATE_SCROLL_OFFSET_PX,
          behavior: scrollBehavior(),
        });
      }
    },
    [geometries],
  );

  // Тон-акцент карточки: бордюр по логической стартовой стороне (RTL-safe).
  const accent = toneColor(tone);
  const columnNotes: ColumnNote[] = notes.map((n) => {
    const orphan = (geometries.get(n.id) ?? null) === null;
    return {
      id: n.id,
      orphan,
      node: (
        <div
          data-note-card={n.id}
          style={{ borderInlineStart: `3px solid ${accent}`, paddingInlineStart: "0.5rem" }}
        >
          {renderNote(n, orphan)}
        </div>
      ),
    };
  });

  // Оверлей: rect-якоря ВСЕГДА (Highlight API их не берёт) + линейные ТОЛЬКО когда
  // Highlight API не поддержан. Активный — в activeRects (annotation-overlay--active).
  const overlayRects: DOMRect[] = [];
  const activeOverlayRects: DOMRect[] = [];
  if (highlightEnabled) {
    for (const [id, g] of geometries) {
      if (!g) continue;
      const toOverlay = g.kind === "rect" || !controller.supported;
      if (!toOverlay) continue;
      (id === emphasizedId ? activeOverlayRects : overlayRects).push(...g.clientRects);
    }
  }

  return (
    <>
      {(overlayRects.length > 0 || activeOverlayRects.length > 0) && (
        <HighlightOverlay rects={overlayRects} activeRects={activeOverlayRects} />
      )}
      <MarginNotesColumn
        notes={columnNotes}
        getAnchorRect={getAnchorRect}
        onActivate={onActivate}
        onHoverNote={setHoveredId}
        recomputeKey={recomputeKey}
      />
      <ConnectorLayer
        ids={allIds}
        getAnchorRect={getAnchorRect}
        astRootRef={astRootRef}
        activeId={emphasizedId}
        tone={tone}
        recomputeKey={recomputeKey}
        rectIds={rectIds}
      />
    </>
  );
}
