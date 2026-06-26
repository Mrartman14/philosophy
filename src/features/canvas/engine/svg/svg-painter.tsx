"use client";
// src/features/canvas/engine/svg/svg-painter.tsx
import { useMemo } from "react";

import type { RenderNode } from "@/components/canvas-render";

import type { CanvasPainter, Scene, SurfaceSize } from "../painter";

import { SvgEdges } from "./svg-edges";
import { downloadCanvasPng, downloadCanvasSvg } from "./svg-export";
import { SvgNodes } from "./svg-nodes";
import { SvgOverlays } from "./svg-overlays";

/** SVG-поверхность: viewBox по вьюпорту, defs-маркеры, слои, marquee. Указатель
 *  не перехватывает (pointer-events:none) — ввод владеет редактор. */
function SvgSurface({ scene, size }: { scene: Scene; size: SurfaceSize }) {
  const vp = scene.viewport;
  const viewBox = `${vp.x} ${vp.y} ${size.width / vp.zoom} ${size.height / vp.zoom}`;
  const nodesById = useMemo(
    () => new Map<string, RenderNode>(scene.data.nodes.map((n) => [n.id, n])),
    [scene.data.nodes],
  );
  return (
    <svg
      width="100%" height="100%"
      viewBox={viewBox}
      style={{ pointerEvents: "none", background: "var(--color-surface)", display: "block" }}
    >
      <defs>
        {/* markerUnits=userSpaceOnUse: размер стрелки не зависит от strokeWidth.
            Два маркера = два цвета: стрелка перекрашивается под цвет своего ребра. */}
        <marker id="cv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10.5" markerHeight="10.5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-fg-muted)" />
        </marker>
        <marker id="cv-arrow-selected" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10.5" markerHeight="10.5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent)" />
        </marker>
      </defs>

      <SvgEdges
        edges={scene.data.edges}
        nodesById={nodesById}
        selectedEdgeIds={scene.selectedEdgeIds}
        edgeDraft={scene.edgeDraft}
      />
      <SvgNodes nodes={scene.data.nodes} resolveEntityRef={scene.resolveEntityRef} />
      <SvgOverlays
        nodes={scene.data.nodes}
        selectedNodeIds={scene.selectedNodeIds}
        invalidNodeId={scene.invalidNodeId}
        edgeTargetId={scene.edgeTargetId}
        handlesForNodeId={scene.handlesForNodeId}
      />

      {scene.marquee && (
        <rect
          x={scene.marquee.x} y={scene.marquee.y} width={scene.marquee.width} height={scene.marquee.height}
          fill="var(--color-accent)" fillOpacity={0.1}
          stroke="var(--color-accent)" strokeDasharray="4 2"
        />
      )}
    </svg>
  );
}

/** SVG-реализация движка рендеринга редактора (единственная сегодня). */
export const svgPainter: CanvasPainter = {
  Surface: SvgSurface,
  exportSvg: downloadCanvasSvg,
  exportPng: downloadCanvasPng,
};
