// src/components/canvas-render/canvas-render.tsx
import { getT } from "@/i18n";

import { EdgeShapeRender, ArrowMarkerDefs } from "./edge-shape";
import { boundingBox } from "./geometry";
import { NodeShapeRender } from "./node-shapes";
import type { CanvasRenderProps, RenderNode } from "./types";

const MARGIN = 24;

/**
 * Generic read-only SSR-рендер canvas-графа. Координаты узлов заданы извне
 * (бек уже посчитал layout). Рисует <svg> с viewBox по bounding box; узлы и
 * прямые рёбра с привязкой к стороне. Без интерактива (pan/zoom) — внешняя
 * обёртка скроллит при необходимости (overflow:auto).
 */
export async function CanvasRender({ data, resolveEntityRef, emptyText, className, children }: CanvasRenderProps) {
  const t = await getT("common");
  const resolvedEmptyText = emptyText ?? t("canvasRender.emptyGraph");

  if (data.nodes.length === 0) {
    return <p className="text-sm text-(--color-fg-muted)">{resolvedEmptyText}</p>;
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
        aria-label={t("canvasRender.graphAriaLabel")}
        style={{ maxWidth: "100%", height: "auto" }}
      >
        <ArrowMarkerDefs />

        {data.edges.map((e) => (
          <EdgeShapeRender key={e.id} edge={e} nodesById={byId} />
        ))}

        {data.nodes.map((n) => (
          <NodeShapeRender key={n.id} node={n} resolve={resolveEntityRef} />
        ))}
      </svg>
      {children}
    </div>
  );
}
