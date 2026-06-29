// src/components/canvas-render/canvas-scene.tsx
import type { CSSProperties } from "react";

import { EdgeShapeRender, ArrowMarkerDefs } from "./edge-shape";
import { NodeShapeRender } from "./node-shapes";
import type { EntityRefResolver, RenderData, RenderNode } from "./types";

/** Поле вокруг bounding box для статичного viewBox (px в координатах мира). */
export const CANVAS_MARGIN = 24;

export interface CanvasSceneProps {
  data: RenderData;
  resolveEntityRef: EntityRefResolver;
  /** "minX minY width height". */
  viewBox: string;
  width: number | string;
  height: number | string;
  ariaLabel: string;
  /** Доп. inline-стиль <svg> (статика: подгон по ширине; интерактив: block). */
  svgStyle?: CSSProperties;
}

/**
 * Чистое (client-safe, НЕ async) тело SVG canvas-графа: defs + рёбра + узлы.
 * Общий субстрат для серверного CanvasRender (статичный viewBox по bbox) и
 * клиентского CanvasViewer (viewBox из стейта pan/zoom). Координаты узлов заданы
 * извне (бек посчитал layout). Рёбра — прямые с привязкой к стороне.
 */
export function CanvasScene({ data, resolveEntityRef, viewBox, width, height, ariaLabel, svgStyle }: CanvasSceneProps) {
  const byId = new Map<string, RenderNode>(data.nodes.map((n) => [n.id, n]));
  return (
    <svg viewBox={viewBox} width={width} height={height} role="img" aria-label={ariaLabel} style={svgStyle}>
      <ArrowMarkerDefs />

      {data.edges.map((e) => (
        <EdgeShapeRender key={e.id} edge={e} nodesById={byId} />
      ))}

      {data.nodes.map((n) => (
        <NodeShapeRender key={n.id} node={n} resolve={resolveEntityRef} />
      ))}
    </svg>
  );
}
