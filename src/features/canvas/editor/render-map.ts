// src/features/canvas/editor/render-map.ts
import type { RenderData, RenderEdge, RenderNode } from "@/components/canvas-render";

import type { CanvasData } from "../types";

/**
 * Мапит CanvasData (snake_case, схема-форма) в доменно-нейтральный RenderData
 * (camelCase) для canvas-render примитивов. Единый маппинг для рендер-слоёв
 * редактора и read-only вьюера (canvas-detail). Узлы без id и рёбра без обоих
 * концов отбрасываются (бек их не пропустит, рендер не должен падать).
 */
export function canvasDataToRenderData(data: CanvasData | undefined): RenderData {
  const nodes: RenderNode[] = (data?.nodes ?? []).flatMap((n) =>
    n.id
      ? [
          {
            id: n.id,
            type: n.type,
            x: n.x ?? 0,
            y: n.y ?? 0,
            width: n.width ?? 100,
            height: n.height ?? 40,
            text: n.text,
            shapeKind: n.shape_kind,
            entityType: n.entity_type,
            entityId: n.entity_id,
          },
        ]
      : [],
  );
  const edges: RenderEdge[] = (data?.edges ?? []).flatMap((e) =>
    e.id && e.from_node && e.to_node
      ? [
          {
            id: e.id,
            fromNode: e.from_node,
            toNode: e.to_node,
            fromSide: e.from_side,
            toSide: e.to_side,
            label: e.label,
            style: e.style,
            end: e.end,
          },
        ]
      : [],
  );
  return { nodes, edges };
}
