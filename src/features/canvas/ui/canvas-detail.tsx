// src/features/canvas/ui/canvas-detail.tsx
import type { RenderData, RenderEdge, RenderNode } from "@/components/canvas-render";
import { CanvasRender } from "@/components/canvas-render/canvas-render";
import { getT } from "@/i18n";

import { makeEntityRefResolver } from "../entity-ref";
import type { CanvasData } from "../types";

interface Props {
  data: CanvasData | undefined;
}

/** Мапит CanvasData (schema-форма) в доменно-нейтральный RenderData. */
function toRenderData(data: CanvasData | undefined): RenderData {
  const nodes: RenderNode[] = (data?.nodes ?? []).flatMap((n) =>
    n.id && n.type
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

/** Read-only SSR-визуализация графа канваса. */
export async function CanvasDetail({ data }: Props) {
  const t = await getT("canvas");
  return (
    <CanvasRender
      data={toRenderData(data)}
      resolveEntityRef={makeEntityRefResolver(t)}
      className="rounded border border-(--color-border) bg-(--color-surface) p-2"
    />
  );
}
