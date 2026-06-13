// src/components/canvas-render/canvas-render.tsx
import { boundingBox, edgePath } from "./geometry";
import { NodeShapeRender } from "./node-shapes";
import type { CanvasRenderProps, RenderNode } from "./types";

const MARGIN = 24;

/**
 * Generic read-only SSR-рендер canvas-графа. Координаты узлов заданы извне
 * (бек уже посчитал layout). Рисует <svg> с viewBox по bounding box; узлы и
 * прямые рёбра с привязкой к стороне. Без интерактива (pan/zoom) — внешняя
 * обёртка скроллит при необходимости (overflow:auto).
 */
export function CanvasRender({ data, resolveEntityRef, emptyText = "Граф пуст.", className, children }: CanvasRenderProps) {
  if (data.nodes.length === 0) {
    return <p className="text-sm text-(--color-description)">{emptyText}</p>;
  }

  const bbox = boundingBox(data.nodes);
  const vbX = bbox.minX - MARGIN;
  const vbY = bbox.minY - MARGIN;
  const vbW = bbox.maxX - bbox.minX + MARGIN * 2;
  const vbH = bbox.maxY - bbox.minY + MARGIN * 2;

  const byId = new Map<string, RenderNode>(data.nodes.map((n) => [n.id, n]));

  return (
    <div className={className} style={{ overflow: "auto", maxWidth: "100%" }}>
      <svg
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        width={vbW}
        height={vbH}
        role="img"
        aria-label="Граф канваса"
        style={{ maxWidth: "100%", height: "auto" }}
      >
        <defs>
          <marker id="cv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-description)" />
          </marker>
        </defs>

        {data.edges.map((e) => {
          const from = byId.get(e.fromNode);
          const to = byId.get(e.toNode);
          if (!from || !to) return null; // битая ссылка — не рисуем (бек её не пропустит, но рендер не падает)
          const geo = edgePath(from, to, e.fromSide, e.toSide);
          const arrow = (e.end ?? "arrow") === "arrow";
          return (
            <g key={e.id}>
              <path
                d={geo.d}
                fill="none"
                stroke="var(--color-description)"
                strokeWidth={1.5}
                strokeDasharray={e.style === "dashed" ? "6 4" : undefined}
                markerEnd={arrow ? "url(#cv-arrow)" : undefined}
              />
              {e.label && (
                <text x={geo.mid.x} y={geo.mid.y - 4} fontSize={11} textAnchor="middle" fill="var(--color-description)">
                  {e.label.length > 40 ? e.label.slice(0, 39) + "…" : e.label}
                </text>
              )}
            </g>
          );
        })}

        {data.nodes.map((n) => (
          <NodeShapeRender key={n.id} node={n} resolve={resolveEntityRef} />
        ))}
      </svg>
      {children}
    </div>
  );
}
