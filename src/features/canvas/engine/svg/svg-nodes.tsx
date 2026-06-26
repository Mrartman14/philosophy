"use client";
// src/features/canvas/engine/svg/svg-nodes.tsx
import { NodeShapeRender } from "@/components/canvas-render";
import type { EntityRefResolver, RenderNode } from "@/components/canvas-render";

interface Props {
  nodes: RenderNode[];
  resolveEntityRef: EntityRefResolver;
}

/** SVG-слой узлов: та же презентация NodeShapeRender, что в read-only рендере. */
export function SvgNodes({ nodes, resolveEntityRef }: Props) {
  return (
    <g data-layer="nodes">
      {nodes.map((n) => (
        <NodeShapeRender key={n.id} node={n} resolve={resolveEntityRef} />
      ))}
    </g>
  );
}
