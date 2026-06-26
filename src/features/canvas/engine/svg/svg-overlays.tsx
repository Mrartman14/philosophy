"use client";
// src/features/canvas/engine/svg/svg-overlays.tsx
import type { Point, RenderNode, Side } from "@/components/canvas-render";

import { PORT_OFFSET, portPoint, resizeHandles } from "../../editor";
import type { ResizeHandle } from "../../editor";

const SIDES: Side[] = ["top", "right", "bottom", "left"];

interface Props {
  nodes: RenderNode[];
  selectedNodeIds: ReadonlySet<string>;
  invalidNodeId: string | null;
  edgeTargetId: string | null;
  handlesForNodeId: string | null;
}

/**
 * Служебные оверлеи редактора: подсветка цели ребра, рамки выделения/ошибки,
 * 8 ручек ресайза и 4 порта на одиночном выделении. Чисто визуальны (указатель
 * не перехватывают — pointer-events:none на корневом svg painter'а).
 */
export function SvgOverlays({ nodes, selectedNodeIds, invalidNodeId, edgeTargetId, handlesForNodeId }: Props) {
  const single = handlesForNodeId ? nodes.find((n) => n.id === handlesForNodeId) ?? null : null;
  return (
    <g data-layer="overlays">
      {nodes.map((n) => {
        const selected = selectedNodeIds.has(n.id);
        const invalid = n.id === invalidNodeId;
        const isEdgeTarget = n.id === edgeTargetId;
        return (
          <g key={n.id}>
            {isEdgeTarget && (
              <rect
                x={n.x - 3} y={n.y - 3} width={n.width + 6} height={n.height + 6}
                rx={4}
                fill="var(--color-accent)" fillOpacity={0.12}
                stroke="var(--color-accent)" strokeWidth={2.5}
              />
            )}
            {(selected || invalid) && (
              <rect
                x={n.x - 2} y={n.y - 2} width={n.width + 4} height={n.height + 4}
                fill="none"
                stroke={invalid ? "var(--color-danger)" : "var(--color-accent)"}
                strokeWidth={1.5}
                strokeDasharray={invalid ? "4 2" : undefined}
              />
            )}
          </g>
        );
      })}

      {single && SIDES.map((side) => {
        const p = portPoint(single, side, PORT_OFFSET);
        return (
          <circle
            key={`side-${side}`}
            cx={p.x} cy={p.y} r={5}
            fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth={1.5}
          />
        );
      })}

      {single && (Object.entries(resizeHandles(single)) as [ResizeHandle, Point][]).map(([handle, p]) => (
        <rect
          key={`rh-${handle}`}
          x={p.x - 4} y={p.y - 4} width={8} height={8}
          fill="var(--color-accent)"
        />
      ))}
    </g>
  );
}
