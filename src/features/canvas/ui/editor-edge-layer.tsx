"use client";
// src/features/canvas/ui/editor-edge-layer.tsx
import { edgePath } from "@/components/canvas-render";
import type { Point, RenderNode, RenderEdge } from "@/components/canvas-render";

interface Props {
  edges: RenderEdge[];
  nodesById: Map<string, RenderNode>;
  selectedEdgeIds: Set<string>;
  /** Превью создаваемого ребра: от точки старта к текущей точке курсора (мировые). */
  preview?: { from: Point; to: Point } | undefined;
  onEdgePointerDown: (edgeId: string, e: React.PointerEvent) => void;
}

/**
 * SVG-слой рёбер редактора. Геометрия — та же edgePath, что в read-only
 * рендере (одна система рендеринга). Выделенное ребро подсвечивается;
 * preview-линия рисуется поверх во время drag-создания.
 */
export function EditorEdgeLayer({ edges, nodesById, selectedEdgeIds, preview, onEdgePointerDown }: Props) {
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
            {/* широкая прозрачная подложка для удобного клика */}
            <path
              d={geo.d}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              style={{ cursor: "pointer" }}
              onPointerDown={(ev) => { onEdgePointerDown(e.id, ev); }}
            />
            <path
              d={geo.d}
              fill="none"
              stroke={selected ? "var(--color-accent)" : "var(--color-fg-muted)"}
              strokeWidth={selected ? 2.5 : 1.5}
              strokeDasharray={e.style === "dashed" ? "6 4" : undefined}
              markerEnd={arrow ? "url(#cv-arrow)" : undefined}
              pointerEvents="none"
            />
            {e.label && (
              <text x={geo.mid.x} y={geo.mid.y - 4} fontSize={11} textAnchor="middle" fill="var(--color-fg-muted)" pointerEvents="none">
                {e.label.length > 40 ? e.label.slice(0, 39) + "…" : e.label}
              </text>
            )}
          </g>
        );
      })}
      {preview && (
        <path
          d={`M ${preview.from.x} ${preview.from.y} L ${preview.to.x} ${preview.to.y}`}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          strokeDasharray="4 4"
          pointerEvents="none"
        />
      )}
    </g>
  );
}
