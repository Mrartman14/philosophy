// src/features/canvas/ui/canvas-detail.tsx
import type { RenderData, RenderEdge, RenderNode } from "@/components/canvas-render";

import type { CanvasData } from "../types";

import { CanvasViewer } from "./canvas-viewer";

interface Props {
  data: CanvasData | undefined;
}

/** Мапит CanvasData (schema-форма) в доменно-нейтральный RenderData. */
function toRenderData(data: CanvasData | undefined): RenderData {
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

/**
 * Read-only визуализация графа канваса. Маппинг чистый → синхронный серверный
 * компонент; интерактив (pan/zoom) и i18n/ссылки ведёт клиентский CanvasViewer.
 * Единая точка для /canvases/[id] и модалки ревизий (CanvasRevisions).
 */
export function CanvasDetail({ data }: Props) {
  return (
    <CanvasViewer
      data={toRenderData(data)}
      className="rounded border border-(--color-border) bg-(--color-surface) p-2"
    />
  );
}
