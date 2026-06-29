// src/components/canvas-render/canvas-scene.tsx
import type { CSSProperties } from "react";

import { EdgeShapeRender, ArrowMarkerDefs } from "./edge-shape";
import { NodeShapeRender } from "./node-shapes";
import type { BBox, EntityRefResolver, RenderData, RenderNode } from "./types";

/** Поле вокруг bounding box для статичного viewBox (px в координатах мира). */
export const CANVAS_MARGIN = 24;

/** viewBox + размеры (px) статичного рендера всего графа (bbox + поле). Единый источник. */
export function staticViewBox(bbox: BBox): { viewBox: string; width: number; height: number } {
  const width = bbox.maxX - bbox.minX + CANVAS_MARGIN * 2;
  const height = bbox.maxY - bbox.minY + CANVAS_MARGIN * 2;
  return {
    viewBox: `${bbox.minX - CANVAS_MARGIN} ${bbox.minY - CANVAS_MARGIN} ${width} ${height}`,
    width,
    height,
  };
}

export interface CanvasSceneProps {
  data: RenderData;
  resolveEntityRef: EntityRefResolver;
  /** "minX minY width height". */
  viewBox: string;
  width: number | string;
  height: number | string;
  ariaLabel: string;
  /** Доп. inline-стиль <svg>. */
  svgStyle?: CSSProperties;
}

/**
 * Тело графа (defs + рёбра + узлы) БЕЗ <svg>-обёртки. Чистое, зависит только от
 * data/resolveEntityRef → клиент может мемоизировать этот элемент, чтобы pan/zoom
 * (смена viewBox у обёртки) не реконсилил всё дерево узлов на каждый кадр.
 */
export function CanvasSceneBody({ data, resolveEntityRef }: { data: RenderData; resolveEntityRef: EntityRefResolver }) {
  const byId = new Map<string, RenderNode>(data.nodes.map((n) => [n.id, n]));
  return (
    <>
      <ArrowMarkerDefs />
      {data.edges.map((e) => (
        <EdgeShapeRender key={e.id} edge={e} nodesById={byId} />
      ))}
      {data.nodes.map((n) => (
        <NodeShapeRender key={n.id} node={n} resolve={resolveEntityRef} />
      ))}
    </>
  );
}

/** Чистое (client-safe, НЕ async) тело SVG canvas-графа с заданным viewBox. */
export function CanvasScene({ data, resolveEntityRef, viewBox, width, height, ariaLabel, svgStyle }: CanvasSceneProps) {
  return (
    <svg viewBox={viewBox} width={width} height={height} role="img" aria-label={ariaLabel} style={svgStyle}>
      <CanvasSceneBody data={data} resolveEntityRef={resolveEntityRef} />
    </svg>
  );
}
