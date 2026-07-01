"use client";
// src/components/anchor-engine/margin-rail.tsx
// Page-level агрегатор-приёмник одного тона. Собирает заметки ВСЕХ скоупов
// (useRailScopes) → мультикорневая геометрия → одна колонка карточек + выноски
// (X текстовой стороны из корня-владельца) + подсветка по общему каналу +
// реципрокная навигация текст→карточка (useTextClick/useHoverReveal, слушают
// document.body, хит-тест по агрегированным ranges). Заменяет MarginAnchorLayer.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Motion } from "@/styles/tokens/enums";
import { isReducedMotion } from "@/utils/is-reduced-motion";

import { ConnectorLayer } from "./connector-layer";
import { cssEscape } from "./css-escape";
import { HighlightController } from "./highlight-controller";
import { HighlightOverlay } from "./highlight-overlay";
import { MarginNotesColumn, type ColumnNote } from "./margin-notes-column";
import { railScopeFingerprint } from "./rail-scope-key";
import { toneColor } from "./tone";
import type { AnchoredNote } from "./types";
import { useAggregatedAnchorRanges } from "./use-aggregated-anchor-ranges";
import { useAnchorHighlights } from "./use-anchor-highlights";
import { useHoverReveal } from "./use-hover-reveal";
import { useRailScopes } from "./use-rail-scopes";
import { useTextClick } from "./use-text-click";

function scrollBehavior(): ScrollBehavior {
  if (typeof document === "undefined") return "auto";
  const motion = (document.documentElement.dataset.motion as Motion | undefined) ?? "system";
  const osReduce =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  return isReducedMotion({ motion, osReduce }) ? "auto" : "smooth";
}

const ACTIVATE_SCROLL_OFFSET_PX = 100;

export function MarginRail({
  tone,
  highlightName,
}: {
  tone: "annotation" | "comment";
  highlightName: string;
}) {
  const scopes = useRailScopes(tone);
  const controllerRef = useRef<HighlightController | null>(null);
  controllerRef.current ??= new HighlightController(highlightName);
  const controller = controllerRef.current;

  const { geometries, ranges, getAnchorRect, recomputeKey } =
    useAggregatedAnchorRanges(scopes);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const emphasizedId = hoveredId ?? activeId;

  // Стабильный scope-key (как в useAggregatedAnchorRanges — тот же чистый
  // railScopeFingerprint). ВКЛЮЧАЕТ fingerprint id-нот, иначе при смене notes того
  // же скоупа (новая аннотация, тот же key) `flat` не пересчитается → карточка не
  // появится/останется сиротой (находка ревью Task 7). Стабилен под array-identity-
  // churn от useRailScopes.
  const scopeKey = railScopeFingerprint(scopes);

  const flat = useMemo(() => {
    const items: {
      note: AnchoredNote;
      render: (n: AnchoredNote, orphan: boolean) => React.ReactNode;
      highlight: boolean;
    }[] = [];
    for (const s of scopes)
      for (const n of s.notes)
        items.push({ note: n, render: s.renderNote, highlight: s.highlightEnabled !== false });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);
  const allIds = flat.map((f) => f.note.id);
  const persistentIds = flat.filter((f) => f.highlight).map((f) => f.note.id);

  useAnchorHighlights({ controller, ranges, persistentIds, activeId: emphasizedId, enabled: true });

  // id заметки → корень её скоупа (для X текстовой стороны выносок). Карту держим
  // в ref → getRootRect стабилен по идентичности (не дёргает эффект ConnectorLayer).
  const rootByIdRef = useRef(new Map<string, HTMLElement>());
  rootByIdRef.current = useMemo(() => {
    const m = new Map<string, HTMLElement>();
    for (const s of scopes) for (const n of s.notes) m.set(n.id, s.rootEl);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);
  const getRootRect = useCallback((id: string) => {
    const el = rootByIdRef.current.get(id);
    return el ? el.getBoundingClientRect() : null;
  }, []);

  // Реципрокная навигация (паритет с MarginAnchorLayer): слушаем document.body,
  // хит-тест по агрегированным ranges. bodyRef стабилен; ready после монтирования.
  const bodyRef = useRef<HTMLElement | null>(null);
  const [bodyReady, setBodyReady] = useState(false);
  useEffect(() => {
    bodyRef.current = document.body;
    setBodyReady(true);
  }, []);
  const pickFromText = useCallback((id: string) => {
    setActiveId(id);
    document
      .querySelector(`[data-note-card="${cssEscape(id)}"]`)
      ?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
  }, []);
  useHoverReveal({ astRootRef: bodyRef, geometries, ready: bodyReady, onHover: setHoveredId });
  useTextClick({ astRootRef: bodyRef, geometries, ready: bodyReady, onPick: pickFromText });

  const onActivate = useCallback(
    (id: string) => {
      setActiveId(id);
      const rect = geometries.get(id)?.boundingRect ?? null;
      if (rect) {
        window.scrollTo({ top: rect.top + window.scrollY - ACTIVATE_SCROLL_OFFSET_PX, behavior: scrollBehavior() });
      }
    },
    [geometries],
  );

  // Прямоугольные (table-cell) якоря — их выноска крепится в центр bbox
  // (kind-aware в ConnectorLayer). useMemo: стабильная идентичность Set между
  // recompute'ами (иначе connector-эффект перезапускался бы каждый рендер).
  const rectIds = useMemo(
    () => new Set([...geometries].filter(([, g]) => g?.kind === "rect").map(([id]) => id)),
    [geometries],
  );

  const accent = toneColor(tone);
  const columnNotes: ColumnNote[] = flat.map(({ note, render }) => {
    const orphan = (geometries.get(note.id) ?? null) === null;
    return {
      id: note.id,
      orphan,
      node: (
        <div data-note-card={note.id} style={{ borderInlineStart: `3px solid ${accent}`, paddingInlineStart: "0.5rem" }}>
          {render(note, orphan)}
        </div>
      ),
    };
  });

  // Оверлей-фолбэк: rect-якоря ВСЕГДА (Highlight API их не берёт) + линейные ТОЛЬКО
  // когда Highlight API не поддержан; лишь для нот с включённой подсветкой
  // (persistentIds). Активный → activeOverlayRects. useMemo: стабильная идентичность
  // массивов между recompute'ами (HighlightOverlay useLayoutEffect не дёргается зря).
  const { overlayRects, activeOverlayRects } = useMemo(() => {
    const rects: DOMRect[] = [];
    const active: DOMRect[] = [];
    const highlightSet = new Set(persistentIds);
    for (const [id, g] of geometries) {
      if (!g || !highlightSet.has(id)) continue;
      const toOverlay = g.kind === "rect" || !controller.supported;
      if (!toOverlay) continue;
      (id === emphasizedId ? active : rects).push(...g.clientRects);
    }
    return { overlayRects: rects, activeOverlayRects: active };
    // persistentIds покрыт scopeKey (композиция highlight-нот); прочие — прямые деп.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometries, emphasizedId, controller, scopeKey]);

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
        getRootRect={getRootRect}
        activeId={emphasizedId}
        tone={tone}
        recomputeKey={recomputeKey}
        rectIds={rectIds}
      />
    </>
  );
}
