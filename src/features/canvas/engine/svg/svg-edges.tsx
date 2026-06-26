"use client";
// src/features/canvas/engine/svg/svg-edges.tsx
import { edgePath } from "@/components/canvas-render";
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
      {edges.map((e) => {
        const from = nodesById.get(e.fromNode);
        const to = nodesById.get(e.toNode);
        if (!from || !to) return null;
        const geo = edgePath(from, to, e.fromSide, e.toSide);
        const selected = selectedEdgeIds.has(e.id);
        const arrow = (e.end ?? "arrow") === "arrow";
        return (
          <g key={e.id}>
            <path
              d={geo.d}
              fill="none"
              stroke={selected ? "var(--color-accent)" : "var(--color-fg-muted)"}
              strokeWidth={selected ? 2.5 : 1.5}
              strokeDasharray={e.style === "dashed" ? "6 4" : undefined}
              markerEnd={arrow ? (selected ? "url(#cv-arrow-selected)" : "url(#cv-arrow)") : undefined}
            />
            {e.label && (
              <text x={geo.mid.x} y={geo.mid.y - 4} fontSize={11} textAnchor="middle" fill="var(--color-fg-muted)">
                {e.label.length > 40 ? e.label.slice(0, 39) + "…" : e.label}
              </text>
            )}
          </g>
        );
      })}
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
