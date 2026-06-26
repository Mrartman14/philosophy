"use client";
// src/components/anchor-engine/connector-layer.tsx
// SVG-оверлей выносок-связей карточка↔текст. Портал в document.body, document-
// координаты (rect + scrollX/Y), пересчёт на scroll/resize/recomputeKey — паттерн
// highlight-overlay.tsx. Рисует на каждую заметку с разрешённым якорем И DOM-
// карточкой ([data-note-card-wrapper]) ортогональный локоть (connector-geometry).
// Только на wide (на narrow поля схлопнуты — линии пересекли бы текст). Сторона
// выводится из геометрии (RTL-safe). aria-hidden + pointer-events:none —
// декоративный слой; клавиатурный путь — карточки и доступный список заметок.
import { useLayoutEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

import { cardAttachY, connectorPath } from "./connector-geometry";
import { cssEscape } from "./css-escape";
import { toneColor, type Tone } from "./tone";

const WIDE = "(min-width: 80rem)";
const CARD_ATTACH_PX = 14; // вертикальный отступ точки крепления к карточке
const FIRST_LINE_CLAMP_PX = 24; // оценка высоты первой строки для центра якоря

export interface ConnectorLayerProps {
  ids: string[];
  getAnchorRect: (id: string) => DOMRect | null; // viewport-координаты якоря
  astRootRef: RefObject<HTMLElement | null>;
  activeId: string | null;
  tone: Tone;
  recomputeKey: number;
}

interface Seg {
  id: string;
  d: string;
}

function measure(
  ids: string[],
  getAnchorRect: (id: string) => DOMRect | null,
  astRootRef: RefObject<HTMLElement | null>,
): Seg[] {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return [];
  if (!window.matchMedia(WIDE).matches) return [];
  const root = astRootRef.current;
  if (!root) return [];
  const rootRect = root.getBoundingClientRect();
  const segs: Seg[] = [];
  for (const id of ids) {
    const a = getAnchorRect(id);
    if (!a) continue; // сирота / неразрешённый якорь
    const card = document.querySelector<HTMLElement>(
      `[data-note-card-wrapper="${cssEscape(id)}"]`,
    );
    if (!card) continue; // карточка ещё не смонтирована/спозиционирована
    const c = card.getBoundingClientRect();
    const right = c.left >= a.right; // карточка правее текста → правая сторона (RTL-safe)
    const x1 = (right ? rootRect.right : rootRect.left) + window.scrollX;
    const y1 = a.top + Math.min(a.height, FIRST_LINE_CLAMP_PX) / 2 + window.scrollY;
    const x2 = (right ? c.left : c.right) + window.scrollX;
    // Крепимся к карточке НА ВЫСОТЕ ЯКОРЯ (зажатой в её границы): карточка напротив
    // якоря → y2===y1 → строго горизонтальная линия; увело стэкингом → край → локоть.
    const y2 = cardAttachY(y1, c.top + window.scrollY, c.bottom + window.scrollY, CARD_ATTACH_PX);
    segs.push({ id, d: connectorPath({ x1, y1, x2, y2 }) });
  }
  return segs;
}

export function ConnectorLayer({
  ids,
  getAnchorRect,
  astRootRef,
  activeId,
  tone,
  recomputeKey,
}: ConnectorLayerProps) {
  const [segs, setSegs] = useState<Seg[]>([]);
  const idsKey = ids.join(",");

  useLayoutEffect(() => {
    const update = () => {
      setSegs(measure(ids, getAnchorRect, astRootRef));
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
    // ids покрыт idsKey по значению; getAnchorRect стабилен (useCallback в движке).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, getAnchorRect, astRootRef, recomputeKey]);

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
