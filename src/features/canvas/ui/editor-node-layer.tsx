"use client";
// src/features/canvas/ui/editor-node-layer.tsx
import { NodeShapeRender } from "@/components/canvas-render";
import type { RenderNode, Side, EntityRefResolver } from "@/components/canvas-render";

import { portPoint, resizeHandles } from "../editor";
import type { ResizeHandle } from "../editor";

const SIDES: Side[] = ["top", "right", "bottom", "left"];
/** Вынос порта ребра за границу узла, чтобы он не накладывался на среднюю ручку
 *  ресайза (та же точка) — иначе квадрат ресайза перекрывает кружок-порт. */
const PORT_OFFSET = 14;

interface Props {
  nodes: RenderNode[];
  selectedNodeIds: Set<string>;
  resolveEntityRef: EntityRefResolver;
  /** id узла с ошибкой валидации — подсвечивается красным. */
  invalidNodeId?: string | undefined;
  onNodePointerDown: (nodeId: string, e: React.PointerEvent) => void;
  onNodeDoubleClick: (nodeId: string, e: React.MouseEvent) => void;
  onResizeHandleDown: (nodeId: string, handle: ResizeHandle, e: React.PointerEvent) => void;
  onSideHandleDown: (nodeId: string, side: Side, e: React.PointerEvent) => void;
}

/**
 * SVG-слой узлов редактора. Сами узлы рисуются NodeShapeRender (та же
 * презентация, что read-only рендер). Поверх выбранного узла — рамка,
 * на одиночном выделении — 8 ручек ресайза и 4 side-handle для старта ребра.
 */
export function EditorNodeLayer({
  nodes, selectedNodeIds, resolveEntityRef, invalidNodeId,
  onNodePointerDown, onNodeDoubleClick, onResizeHandleDown, onSideHandleDown,
}: Props) {
  const singleSelected = selectedNodeIds.size === 1 ? nodes.find((n) => selectedNodeIds.has(n.id)) ?? null : null;

  return (
    <g data-layer="nodes">
      {nodes.map((n) => {
        const selected = selectedNodeIds.has(n.id);
        const invalid = n.id === invalidNodeId;
        return (
          <g
            key={n.id}
            style={{ cursor: "move" }}
            onPointerDown={(e) => { onNodePointerDown(n.id, e); }}
            onDoubleClick={(e) => { onNodeDoubleClick(n.id, e); }}
          >
            <NodeShapeRender node={n} resolve={resolveEntityRef} />
            {(selected || invalid) && (
              <rect
                x={n.x - 2} y={n.y - 2} width={n.width + 4} height={n.height + 4}
                fill="none"
                stroke={invalid ? "var(--color-danger)" : "var(--color-accent)"}
                strokeWidth={1.5}
                strokeDasharray={invalid ? "4 2" : undefined}
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}

      {/* side-handles на одиночном выделении — старт ребра (вынесены за границу
          узла, чтобы не пересекаться со средними ручками ресайза) */}
      {singleSelected && SIDES.map((side) => {
        const p = portPoint(singleSelected, side, PORT_OFFSET);
        return (
          <circle
            key={`side-${side}`}
            cx={p.x} cy={p.y} r={5}
            fill="var(--color-surface)" stroke="var(--color-accent)" strokeWidth={1.5}
            style={{ cursor: "crosshair" }}
            onPointerDown={(e) => { onSideHandleDown(singleSelected.id, side, e); }}
          />
        );
      })}

      {/* 8 ручек ресайза на одиночном выделении */}
      {singleSelected && (Object.entries(resizeHandles(singleSelected)) as [ResizeHandle, { x: number; y: number }][]).map(([handle, p]) => (
        <rect
          key={`rh-${handle}`}
          x={p.x - 4} y={p.y - 4} width={8} height={8}
          fill="var(--color-accent)"
          style={{ cursor: `${handle}-resize` }}
          onPointerDown={(e) => { onResizeHandleDown(singleSelected.id, handle, e); }}
        />
      ))}
    </g>
  );
}
