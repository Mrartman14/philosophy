"use client";
// src/features/canvas/ui/editor-rulers.tsx
import { rulerTicks } from "../editor";
import type { Viewport } from "../editor";

const RULER = 18; // толщина линейки, px
const TICK = 5; // длина деления, px

/** Подпись засечки: целое при near-int, иначе 1 знак (накопл. ошибка / zoom-in). */
function fmt(v: number): string {
  const r = Math.round(v);
  return Math.abs(v - r) < 1e-6 ? String(r) : v.toFixed(1);
}

interface Props {
  viewport: Viewport;
  size: { width: number; height: number };
}

/**
 * Координатные линейки (Figma-стиль): верхняя (X) и левая (Y) полосы у краёв
 * поверхности с адаптивными засечками и числами-координатами. Линейки всегда у
 * края → координаты видны, даже когда мировой 0 ушёл из вида. Screen-space
 * оверлей (НЕ часть painter'а), pointer-events:none — ввод не перехватывает.
 */
export function CanvasRulers({ viewport, size }: Props) {
  const xs = rulerTicks(viewport.x, size.width, viewport.zoom);
  const ys = rulerTicks(viewport.y, size.height, viewport.zoom);
  const fg = "var(--color-fg-muted)";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* верхняя линейка — X */}
      <svg width="100%" height={RULER} className="absolute inset-x-0 top-0 block">
        <rect x={0} y={0} width="100%" height={RULER} fill="var(--color-surface)" />
        <line x1={0} y1={RULER - 0.5} x2={size.width} y2={RULER - 0.5} stroke="var(--color-border)" />
        {xs.map((t, i) => (
          <g key={i}>
            <line x1={t.screen} y1={RULER - TICK} x2={t.screen} y2={RULER} stroke={fg} />
            <text x={t.screen + 3} y={10} fontSize={9} fill={fg}>{fmt(t.world)}</text>
          </g>
        ))}
      </svg>
      {/* левая линейка — Y (подписи повёрнуты, чтобы влезали в узкую полосу).
          left-0 — физический left: canvas = LTR-координатное пространство (x→вправо),
          чром-линеек не зеркалим в RTL (как 3D/стрелки канваса). */}
      {/* eslint-disable-next-line no-restricted-syntax -- физический left для canvas-линеек (см. выше) */}
      <svg width={RULER} height="100%" className="absolute inset-y-0 left-0 block">
        <rect x={0} y={0} width={RULER} height="100%" fill="var(--color-surface)" />
        <line x1={RULER - 0.5} y1={0} x2={RULER - 0.5} y2={size.height} stroke="var(--color-border)" />
        {ys.map((t, i) => (
          <g key={i}>
            <line x1={RULER - TICK} y1={t.screen} x2={RULER} y2={t.screen} stroke={fg} />
            <text x={10} y={t.screen + 3} fontSize={9} fill={fg} transform={`rotate(-90 10 ${t.screen + 3})`}>{fmt(t.world)}</text>
          </g>
        ))}
      </svg>
      {/* угол на пересечении линеек */}
      {/* eslint-disable-next-line no-restricted-syntax -- физический left для canvas-линеек */}
      <div className="absolute left-0 top-0 border-b border-e border-(--color-border) bg-(--color-surface)" style={{ width: RULER, height: RULER }} />
    </div>
  );
}
