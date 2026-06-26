// src/components/canvas-render/edge-shape.tsx
import { edgePath } from "./geometry";
import type { RenderEdge, RenderNode } from "./types";

const ARROW_MARKER = "cv-arrow";
const ARROW_MARKER_SELECTED = "cv-arrow-selected";

/**
 * Стрелочные маркеры рёбер — общие для всех SVG-поверхностей канваса
 * (редактор / экспорт / read-only). markerUnits=userSpaceOnUse + markerWidth 10.5
 * → размер стрелки НЕ зависит от strokeWidth (у толстого выбранного ребра стрелка
 * не растёт). Для обычного ребра (stroke 1.5) визуально идентично прежнему
 * markerWidth=7 со strokeWidth-units (7×1.5=10.5). `withSelected` добавляет
 * акцентный маркер (нужен только редактору, где есть выделение).
 */
export function ArrowMarkerDefs({ withSelected = false }: { withSelected?: boolean }) {
  return (
    <defs>
      <marker id={ARROW_MARKER} viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10.5" markerHeight="10.5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-fg-muted)" />
      </marker>
      {withSelected && (
        <marker id={ARROW_MARKER_SELECTED} viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10.5" markerHeight="10.5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent)" />
        </marker>
      )}
    </defs>
  );
}

interface EdgeShapeProps {
  edge: RenderEdge;
  nodesById: Map<string, RenderNode>;
  /** Выделено (редактор): акцентный цвет, толще, акцентный маркер. По умолчанию false. */
  selected?: boolean;
}

/**
 * Один SVG-ребро: видимый путь + стрелка + подпись (усечение >40). Общий примитив
 * для всех трёх поверхностей — зеркально NodeShapeRender. Битая ссылка (нет
 * from/to в nodesById) → null (рендер не падает). Геометрия — edgePath.
 * Хит-зону НЕ рисует (ввод считает JS hit-test редактора).
 */
export function EdgeShapeRender({ edge, nodesById, selected = false }: EdgeShapeProps) {
  const from = nodesById.get(edge.fromNode);
  const to = nodesById.get(edge.toNode);
  if (!from || !to) return null;
  const geo = edgePath(from, to, edge.fromSide, edge.toSide);
  const arrow = (edge.end ?? "arrow") === "arrow";
  return (
    <g>
      <path
        d={geo.d}
        fill="none"
        stroke={selected ? "var(--color-accent)" : "var(--color-fg-muted)"}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray={edge.style === "dashed" ? "6 4" : undefined}
        markerEnd={arrow ? (selected ? `url(#${ARROW_MARKER_SELECTED})` : `url(#${ARROW_MARKER})`) : undefined}
      />
      {edge.label && (
        <text x={geo.mid.x} y={geo.mid.y - 4} fontSize={11} textAnchor="middle" fill="var(--color-fg-muted)">
          {edge.label.length > 40 ? edge.label.slice(0, 39) + "…" : edge.label}
        </text>
      )}
    </g>
  );
}
