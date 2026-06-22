// src/features/reference-graph/to-graph-render-model.ts
// Чистая нормализация GraphData → GraphRenderModel (типизированные массивы, один draw-call на слой).
// Здесь живёт устойчивость к контракту: все поля refgraph.* optional, рёбра с неразрешимыми
// концами пропускаются. Цвет узла — по type (enum document|glossary).
import { computeBounds, hexToRgb01 } from "@/components/scene-3d";

import type { GraphData, GraphRenderModel, NodeType } from "./types";

// Два тона на enum-type + нейтральный для ОТСУТСТВУЮЩЕГО type (Node.type optional в контракте).
const COLOR_DOCUMENT = "#5B8FF9";
const COLOR_GLOSSARY = "#F6BD16";
const COLOR_UNKNOWN = "#65789B";

function nodeColor(type: NodeType | undefined): string {
  if (type === "document") return COLOR_DOCUMENT;
  if (type === "glossary") return COLOR_GLOSSARY;
  return COLOR_UNKNOWN;
}

const ALPHA_MIN = 0.15;
/** weight (может отсутствовать) → альфа линии в [ALPHA_MIN, 1]. Насыщение мягкое (1 - e^-w). */
export function edgeAlpha(weight: number | undefined): number {
  const raw = weight ?? 0;
  const w = Number.isFinite(raw) ? Math.max(0, raw) : 0;
  return ALPHA_MIN + (1 - ALPHA_MIN) * (1 - Math.exp(-w));
}

export function toGraphRenderModel(data: GraphData): GraphRenderModel {
  const dims = data.dims ?? 3;
  const nodes = data.nodes ?? [];
  const rawEdges = data.edges ?? [];
  const count = nodes.length;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const ids: string[] = [];
  const indexById = new Map<string, number>();

  nodes.forEach((n, i) => {
    const co = n.coords ?? [];
    const x = co[0] ?? 0;
    const y = co[1] ?? 0;
    const z = dims >= 3 ? co[2] ?? 0 : 0;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const [r, g, b] = hexToRgb01(nodeColor(n.type));
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;

    const id = n.id ?? "";
    ids[i] = id;
    if (id) indexById.set(id, i);
  });

  // Рёбра: резолвим source/target в индексы узлов; неразрешимые молча пропускаем.
  const edgeCoords: number[] = [];
  const alphas: number[] = [];
  for (const e of rawEdges) {
    const si = e.source?.id ? indexById.get(e.source.id) : undefined;
    const ti = e.target?.id ? indexById.get(e.target.id) : undefined;
    if (si === undefined || ti === undefined) continue;
    edgeCoords.push(
      positions[si * 3] ?? 0,
      positions[si * 3 + 1] ?? 0,
      positions[si * 3 + 2] ?? 0,
      positions[ti * 3] ?? 0,
      positions[ti * 3 + 1] ?? 0,
      positions[ti * 3 + 2] ?? 0,
    );
    const a = edgeAlpha(e.weight);
    alphas.push(a, a); // альфа на вершину (2 вершины/ребро)
  }

  return {
    count,
    positions,
    colors,
    ids,
    edges: new Float32Array(edgeCoords),
    edgeAlphas: new Float32Array(alphas),
    bounds: computeBounds(data.bounds, positions, count),
  };
}
