"use client";
// src/features/canvas/engine/svg/svg-edges.tsx
import { EdgeShapeRender } from "@/components/canvas-render";
import type { Point, RenderEdge, RenderNode } from "@/components/canvas-render";

interface Props {
  edges: RenderEdge[];
  nodesById: Map<string, RenderNode>;
  selectedEdgeIds: ReadonlySet<string>;
  /** Превью создаваемого ребра (мировые точки). */
  edgeDraft: { from: Point; to: Point } | null;
}

/**
 * SVG-слой рёбер: видимые пути + стрелки + подписи + превью. Без хит-зон —
 * попадание считает JS hit-test редактора. Весь слой не перехватывает указатель
 * (pointer-events:none на корневом svg painter'а).
 */
export function SvgEdges({ edges, nodesById, selectedEdgeIds, edgeDraft }: Props) {
  return (
    <g data-layer="edges">
      {edges.map((e) => (
        <EdgeShapeRender key={e.id} edge={e} nodesById={nodesById} selected={selectedEdgeIds.has(e.id)} />
      ))}
      {edgeDraft && (
        <path
          d={`M ${edgeDraft.from.x} ${edgeDraft.from.y} L ${edgeDraft.to.x} ${edgeDraft.to.y}`}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
      )}
    </g>
  );
}
