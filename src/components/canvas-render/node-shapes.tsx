// src/components/canvas-render/node-shapes.tsx
import type { RenderNode, EntityRefResolver } from "./types";

const PADDING = 8;

/** Усечение длинного текста для подписи (рендер read-only, без переноса по словам). */
function clamp(text: string, max = 120): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/** Многострочный перенос текста по ширине (грубая оценка ~7px/символ). */
function wrapLines(text: string, width: number, maxLines = 4): string[] {
  const charsPerLine = Math.max(4, Math.floor((width - PADDING * 2) / 7));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length > charsPerLine && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    } else {
      cur = candidate;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) lines[maxLines - 1] = clamp(lines[maxLines - 1] ?? "", charsPerLine);
  return lines.length ? lines : [""];
}

function NodeText({ node }: { node: RenderNode }) {
  const lines = wrapLines(node.text ?? "", node.width);
  return (
    <g>
      {/* fill="transparent" (а не "none"): без видимого фона, но тело узла
          остаётся кликабельным в редакторе (none убирает hit-area заливки). */}
      <rect
        x={node.x} y={node.y} width={node.width} height={node.height}
        rx={4} fill="transparent" stroke="var(--color-border)"
      />
      <text x={node.x + PADDING} y={node.y + 18} fontSize={12} fill="var(--color-fg)">
        {lines.map((ln, i) => (
          <tspan key={i} x={node.x + PADDING} dy={i === 0 ? 0 : 14}>{ln}</tspan>
        ))}
      </text>
    </g>
  );
}

function NodeShape({ node }: { node: RenderNode }) {
  const { x, y, width, height } = node;
  const fill = "var(--color-surface-subtle)";
  const stroke = "var(--color-border)";
  let shape;
  if (node.shapeKind === "ellipse") {
    shape = <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} fill={fill} stroke={stroke} />;
  } else if (node.shapeKind === "diamond") {
    const pts = `${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`;
    shape = <polygon points={pts} fill={fill} stroke={stroke} />;
  } else {
    shape = <rect x={x} y={y} width={width} height={height} rx={4} fill={fill} stroke={stroke} />;
  }
  return (
    <g>
      {shape}
      {node.text && (
        <text x={x + width / 2} y={y + height / 2} fontSize={12} textAnchor="middle" dominantBaseline="middle" fill="var(--color-fg)">
          {clamp(node.text, 40)}
        </text>
      )}
    </g>
  );
}

function NodeEntityRef({ node, resolve }: { node: RenderNode; resolve: EntityRefResolver }) {
  const view = resolve(node.entityType ?? "", node.entityId ?? "");
  const label = `${view.typeLabel}: ${clamp(node.entityId ?? "", 12)}`;
  const card = (
    <g>
      <rect
        x={node.x} y={node.y} width={node.width} height={node.height}
        rx={6} fill="var(--color-surface-subtle)" stroke="var(--color-accent)"
      />
      <text x={node.x + PADDING} y={node.y + 20} fontSize={12} fill="var(--color-fg)">{label}</text>
    </g>
  );
  if (view.href) {
    return (
      <a href={view.href} aria-label={label} data-entity-type={node.entityType}>
        {card}
      </a>
    );
  }
  return <g data-entity-unlinked={node.entityType}>{card}</g>;
}

export function NodeShapeRender({ node, resolve }: { node: RenderNode; resolve: EntityRefResolver }) {
  switch (node.type) {
    case "text": return <NodeText node={node} />;
    case "shape": return <NodeShape node={node} />;
    case "entity_ref": return <NodeEntityRef node={node} resolve={resolve} />;
    default: return null;
  }
}
