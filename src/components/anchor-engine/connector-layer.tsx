"use client";
// src/components/anchor-engine/connector-layer.tsx
// SVG-оверлей выносок-связей карточка↔текст. Портал в document.body, document-
// координаты (rect + scrollX/Y), пересчёт на scroll/resize/recomputeKey — паттерн
// highlight-overlay.tsx. Рисует на каждую заметку с разрешённым якорем И DOM-
// карточкой ([data-note-card-wrapper]) ортогональный локоть (connector-geometry).
// Только на wide (на narrow поля схлопнуты — линии пересекли бы текст). Сторона
// выводится из геометрии (RTL-safe). aria-hidden + pointer-events:none —
// декоративный слой; клавиатурный путь — карточки и доступный список заметок.
import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

import { WIDE } from "./breakpoints";
import { anchorAttachY, attachYs, connectorPath } from "./connector-geometry";
import { cssEscape } from "./css-escape";
import { toneColor, type Tone } from "./tone";

const CARD_EDGE_PAD = 8; // отступ внутрь от края карточки при локте (нет пересечения)

export interface ConnectorLayerProps {
  ids: string[];
  getAnchorRect: (id: string) => DOMRect | null; // viewport-координаты якоря
  // Корень-владелец КАЖДОЙ заметки (для X текстовой стороны выноски). Мультикорневой
  // rail (MarginRail) — единственный потребитель; возвращает rect корня скоупа ноты.
  getRootRect: (id: string) => DOMRect | null;
  activeId: string | null;
  tone: Tone;
  recomputeKey: number;
  rectIds: Set<string>; // прямоугольные якоря — их выноска крепится в центр bbox
}

interface Seg {
  id: string;
  d: string;
}

function measure(
  ids: string[],
  getAnchorRect: (id: string) => DOMRect | null,
  getRootRect: (id: string) => DOMRect | null,
  rectIds: Set<string>,
): Seg[] {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return [];
  if (!window.matchMedia(WIDE).matches) return [];
  const segs: Seg[] = [];
  for (const id of ids) {
    const a = getAnchorRect(id);
    if (!a) continue; // сирота / неразрешённый якорь
    // X текстовой стороны — rect корня-владельца ЭТОЙ заметки (мультикорень).
    const rootRect = getRootRect(id);
    if (!rootRect) continue;
    const card = document.querySelector<HTMLElement>(
      `[data-note-card-wrapper="${cssEscape(id)}"]`,
    );
    if (!card) continue; // карточка ещё не смонтирована/спозиционирована
    const c = card.getBoundingClientRect();
    const right = c.left >= a.right; // карточка правее текста → правая сторона (RTL-safe)
    const x1 = (right ? rootRect.right : rootRect.left) + window.scrollX;
    const x2 = (right ? c.left : c.right) + window.scrollX;
    // Высоты крепления — по пересечению вертикальных диапазонов якоря и карточки:
    // пересекаются → горизонталь; нет пересечения → локоть, чтобы «добраться» (attachYs).
    const anchorTop = a.top + window.scrollY;
    const anchorBottom = a.bottom + window.scrollY;
    const anchorY = anchorAttachY(anchorTop, a.height, rectIds.has(id));
    const { y1, y2 } = attachYs(
      anchorTop,
      anchorBottom,
      anchorY,
      c.top + window.scrollY,
      c.bottom + window.scrollY,
      CARD_EDGE_PAD,
    );
    segs.push({ id, d: connectorPath({ x1, y1, x2, y2 }) });
  }
  return segs;
}

export function ConnectorLayer({
  ids,
  getAnchorRect,
  getRootRect,
  activeId,
  tone,
  recomputeKey,
  rectIds,
}: ConnectorLayerProps) {
  const [segs, setSegs] = useState<Seg[]>([]);
  const idsKey = ids.join(",");

  useLayoutEffect(() => {
    const update = () => {
      setSegs(measure(ids, getAnchorRect, getRootRect, rectIds));
    };
    update();
    // rAF: даём MarginNotesColumn спозиционировать карточки в его layout-эффекте,
    // затем перемеряем по их финальным rect'ам.
    const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(update) : 0;
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
    // ids покрыт idsKey по значению; getAnchorRect/getRootRect стабильны (useCallback
    // в MarginRail). rectIds — стабильная идентичность (useMemo в оркестраторе):
    // эффект не дёргается зря.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, getAnchorRect, getRootRect, recomputeKey, rectIds]);

  if (segs.length === 0) return null;
  const stroke = toneColor(tone);

  return createPortal(
    <svg
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 0,
      }}
    >
      {segs.map((s) => {
        const active = activeId === s.id;
        const dimmed = activeId != null && !active;
        return (
          <path
            key={s.id}
            data-connector={s.id}
            d={s.d}
            fill="none"
            stroke={stroke}
            strokeWidth={active ? 2 : 1}
            strokeOpacity={dimmed ? 0.25 : active ? 1 : 0.5}
          />
        );
      })}
    </svg>,
    document.body,
  );
}
